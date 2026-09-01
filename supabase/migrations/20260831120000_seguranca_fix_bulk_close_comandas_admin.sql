-- ==============================================================================
-- SEGURANÇA: Fix de autorização da RPC bulk_close_comandas_admin
-- ==============================================================================
-- Contexto: auditoria de segurança (31/08/2026), achado CRÍTICO F1.1/F3.1.
--   A versão original (migration 20260420110000) era SECURITY DEFINER sem
--   qualquer guarda: não validava auth.uid(), não validava papel, aceitava
--   p_tenant_id NULL e usava `(p_tenant_id IS NULL OR tenant_id = p_tenant_id)`,
--   permitindo que QUALQUER usuário autenticado fechasse (status='paid')
--   comandas e marcasse appointments como 'completed' de QUALQUER tenant
--   (quebra de isolamento multi-tenant + IDOR).
--
-- Correção (mínima, auditável, reversível):
--   Reimplementa a função preservando EXATAMENTE a lógica legítima de fechamento
--   administrativo (status/closure_mode/closure_note/financial_effect/
--   membership_credit_effect/legacy_reference_month/closed_at + retorno JSONB),
--   e adiciona a guarda de autorização no padrão já consagrado no projeto
--   (ver finance_zero_close_comanda / finance_settle_comanda):
--     * auth.uid() obrigatório;
--     * papel gerencial (owner/admin/manager/gerente/superadmin) OU superadmin;
--     * membership no tenant (user_tenants) validado;
--     * p_tenant_id NULL rejeitado para não-superadmin (a exceção explícita
--       superadmin já existe no domínio: Comandas.tsx envia NULL qdo superadmin);
--     * cada comanda validada contra o tenant autorizado (id E tenant_id).
--   A migration histórica 20260420110000 NÃO é alterada/apagada.
-- ==============================================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.bulk_close_comandas_admin(
  p_comanda_ids UUID[],
  p_tenant_id UUID DEFAULT NULL,
  p_closure_note TEXT DEFAULT NULL,
  p_legacy_reference_month DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_uid UUID := auth.uid();
  v_auth_tenant_id UUID;
  v_is_super_admin BOOLEAN := false;
  v_access_role TEXT;
  v_membership_role TEXT;
  v_has_authorized_membership BOOLEAN := false;
  v_eff_tenant_id UUID;

  v_ids UUID[];
  v_updated_count INTEGER := 0;
BEGIN
  -- 1) Usuário autenticado obrigatório (nunca confiar no frontend).
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário autenticado obrigatório';
  END IF;

  -- 2) Resolução SEGURA do contexto do chamador no banco.
  SELECT public.current_tenant_id_from_auth_uid(), public.current_is_super_admin_from_auth_uid()
  INTO v_auth_tenant_id, v_is_super_admin;

  -- Papel de acesso: profiles, com fallback p/ staff (usuários staff-only).
  SELECT LOWER(BTRIM(COALESCE(p.role, ''))) INTO v_access_role
  FROM public.profiles p
  WHERE p.id = v_auth_uid
  LIMIT 1;
  IF v_access_role IS NULL THEN
    SELECT LOWER(BTRIM(COALESCE(s.role, ''))) INTO v_access_role
    FROM public.staff s
    WHERE s.id = v_auth_uid
    LIMIT 1;
  END IF;

  -- 3) p_tenant_id: rejeitado NULL para não-superadmin.
  --    Superadmin pode usar NULL (todos os tenants) — exceção explícita do
  --    domínio (frontend envia NULL quando canAccessSuperAdmin).
  IF NOT COALESCE(v_is_super_admin, false) AND p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id obrigatório';
  END IF;

  -- 4) Membership do chamador no tenant alvo.
  SELECT LOWER(BTRIM(COALESCE(ut.role, ''))) INTO v_membership_role
  FROM public.user_tenants ut
  WHERE ut.user_id = v_auth_uid
    AND ut.tenant_id = p_tenant_id
  ORDER BY COALESCE(ut.is_primary, false) DESC
  LIMIT 1;

  v_has_authorized_membership :=
    COALESCE(v_membership_role IN ('owner', 'admin', 'manager', 'gerente', 'superadmin', 'super admin'), false);

  -- 5) Papel gerencial obrigatório.
  IF NOT COALESCE(v_is_super_admin, false)
     AND COALESCE(v_access_role, '') NOT IN ('owner', 'admin', 'manager', 'gerente', 'superadmin', 'super admin')
     AND NOT COALESCE(v_has_authorized_membership, false) THEN
    RAISE EXCEPTION 'Usuário sem permissão para baixa administrativa';
  END IF;

  -- 6) Isolamento de tenant: não-superadmin só pode operar no seu próprio tenant.
  IF NOT COALESCE(v_is_super_admin, false)
     AND v_auth_tenant_id IS DISTINCT FROM p_tenant_id THEN
    RAISE EXCEPTION 'Tenant não autorizado';
  END IF;

  -- Tenant efetivo: superadmin pode operar 'todos' (NULL) ou um tenant específico.
  v_eff_tenant_id := p_tenant_id;

  -- 7) IDs obrigatórios.
  SELECT COALESCE(array_agg(DISTINCT id), ARRAY[]::UUID[])
  INTO v_ids
  FROM unnest(COALESCE(p_comanda_ids, ARRAY[]::UUID[])) AS id;

  IF COALESCE(array_length(v_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Selecione ao menos uma comanda para baixa administrativa';
  END IF;

  -- 7b) Validação de pertencimento de ID: para não-superadmin, NENHUM id pode
  --     apontar para uma comanda de outro tenant (IDOR/ID swap). Comandas
  --     inexistentes não disparam erro (comportamento seguro, count 0).
  IF NOT COALESCE(v_is_super_admin, false)
     AND v_eff_tenant_id IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM public.comandas c
       WHERE c.id = ANY(v_ids)
         AND c.tenant_id IS DISTINCT FROM v_eff_tenant_id
     ) THEN
    RAISE EXCEPTION 'Uma ou mais comandas não pertencem ao seu tenant';
  END IF;

  -- 8) Fechamento administrativo (lógica legítima preservada).
  --    Para superadmin com p_tenant_id NULL, opera em todas as comandas dos IDs
  --    fornecidos; caso contrário, restringe ao tenant autorizado (isola
  --    Tenant A vs Tenant B e impede fechar comanda de outro tenant por ID).
  UPDATE public.comandas
  SET
    status = 'paid',
    closure_mode = 'legacy_membership',
    closure_note = NULLIF(BTRIM(p_closure_note), ''),
    financial_effect = false,
    membership_credit_effect = false,
    legacy_reference_month = p_legacy_reference_month,
    closed_at = now()
  WHERE id = ANY(v_ids)
    AND status = 'open'
    AND (v_eff_tenant_id IS NULL OR tenant_id = v_eff_tenant_id);

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  UPDATE public.appointments
  SET status = 'completed'
  WHERE id IN (
    SELECT appointment_id
    FROM public.comandas
    WHERE id = ANY(v_ids)
      AND appointment_id IS NOT NULL
      AND status = 'paid'
      AND closure_mode = 'legacy_membership'
      AND (v_eff_tenant_id IS NULL OR tenant_id = v_eff_tenant_id)
  )
    AND (v_eff_tenant_id IS NULL OR tenant_id = v_eff_tenant_id)
    AND status <> 'completed';

  RETURN jsonb_build_object(
    'updated_count', v_updated_count,
    'closure_mode', 'legacy_membership',
    'financial_effect', false,
    'membership_credit_effect', false
  );
END;
$$;

-- Grants: same contract as before (authenticated pode executar), mas a autorização
-- agora é conferida no corpo da função (fail-closed). service_role/anon: nega-se
-- explicitamente (defesa em profundidade).
REVOKE ALL ON FUNCTION public.bulk_close_comandas_admin(UUID[], UUID, TEXT, DATE) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.bulk_close_comandas_admin(UUID[], UUID, TEXT, DATE) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
