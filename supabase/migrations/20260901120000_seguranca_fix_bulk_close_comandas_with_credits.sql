-- ==============================================================================
-- SEGURANÇA: Fix de autorização da RPC bulk_close_comandas_with_credits
-- ==============================================================================
-- Contexto: RPC AUTH SWEEP (01/09/2026), achado CRÍTICO F1.4.
--   A versão original (arquivo não versionado bulk_close_comandas_with_credits.sql)
--   era SECURITY DEFINER + GRANT TO authenticated SEM qualquer guarda:
--     * não validava auth.uid();
--     * não validava papel (barber/receptionist podiam executar);
--     * aceitava p_tenant_id NULL e usava `(p_tenant_id IS NULL OR tenant_id = p_tenant_id)`,
--       permitindo que QUALQUER usuário autenticado fechasse comandas (status='paid')
--       e consumisse CRÉDITOS do Clube (membership) de QUALQUER tenant
--       (quebra de isolamento multi-tenant + IDOR + mutação financeira em lote).
--
-- Correção (mínima, auditável, reversível) — copia o padrão já aprovado em F1.1
--   (migration 20260831120000_seguranca_fix_bulk_close_comandas_admin.sql):
--     * auth.uid() obrigatório;
--     * papel gerencial (owner/admin/manager/gerente/superadmin) OU superadmin;
--     * membership no tenant (user_tenants) validado;
--     * p_tenant_id NULL rejeitado para não-superadmin (exceção explícita:
--       Comandas.tsx envia NULL qdo superadmin);
--     * cada comanda validada contra o tenant autorizado (id E tenant_id) —
--       lote misto A+B DENY (fail-closed, não ignora IDs estranhos);
--     * lógica legítima de fechamento+créditos preservada EXATAMENTE.
--   A migration/arquivo original NÃO é alterado/apagado.
-- ==============================================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.bulk_close_comandas_with_credits(
  p_comanda_ids UUID[],
  p_tenant_id UUID DEFAULT NULL,
  p_closure_note TEXT DEFAULT NULL,
  p_payment_method TEXT DEFAULT 'Dinheiro',
  p_apply_credits BOOLEAN DEFAULT true
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
  v_credits_consumed JSONB := '[]'::jsonb;
  v_credits_by_service JSONB := '{}'::jsonb;
  v_subscription_id UUID;
  v_client_id UUID;
  v_service_id UUID;
  v_item_count INTEGER;
  v_credit_consumed INTEGER;
  v_service_key TEXT;
  v_current_service JSONB;
  v_found_index INTEGER;
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
    RAISE EXCEPTION 'Usuário sem permissão para baixa em massa';
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
    RAISE EXCEPTION 'Selecione ao menos uma comanda';
  END IF;

  -- 7b) Validação de pertencimento de ID (fail-closed): para não-superadmin,
  --     NENHUM id pode apontar para uma comanda de outro tenant (IDOR/ID swap).
  --     O lote inteiro falha — não ignora IDs estranhos.
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

  -- 8) Consumo de créditos do Clube (lógica legítima preservada, agora isolada
  --    ao tenant efetivo). Opera apenas em comandas 'open' do tenant autorizado.
  IF p_apply_credits THEN
    FOR v_client_id IN
      SELECT DISTINCT c.client_id
      FROM public.comandas c
      WHERE c.id = ANY(v_ids)
        AND c.status = 'open'
        AND (v_eff_tenant_id IS NULL OR c.tenant_id = v_eff_tenant_id)
        AND c.client_id IS NOT NULL
    LOOP
      SELECT cs.id
      INTO v_subscription_id
      FROM public.customer_subscriptions cs
      WHERE cs.client_id = v_client_id
        AND cs.status = 'active'
        AND (v_eff_tenant_id IS NULL OR cs.tenant_id = v_eff_tenant_id)
      ORDER BY cs.created_at DESC
      LIMIT 1;

      IF v_subscription_id IS NOT NULL THEN
        FOR v_service_id, v_item_count IN
          SELECT ci.service_id, COUNT(*)::INTEGER
          FROM public.comanda_items ci
          JOIN public.comandas c ON c.id = ci.comanda_id
          WHERE c.id = ANY(v_ids)
            AND c.client_id = v_client_id
            AND c.status = 'open'
            AND (v_eff_tenant_id IS NULL OR c.tenant_id = v_eff_tenant_id)
            AND ci.service_id IS NOT NULL
          GROUP BY ci.service_id
        LOOP
          IF v_service_id IS NOT NULL THEN
            v_service_key := v_service_id::text;

            v_credit_consumed := 0;

            PERFORM public.deduct_chef_club_credits(
                v_subscription_id,
                v_service_id,
                v_item_count,
                'Baixa em massa - Comandas'
            );

            v_credit_consumed := v_item_count;

            v_current_service := COALESCE(
                (v_credits_by_service -> v_service_key)::jsonb,
                ('{"service_id": "' || v_service_key || '", "consumed": 0}')::jsonb
            );

            v_current_service := jsonb_set(
                v_current_service,
                '{consumed}',
                to_jsonb((v_current_service ->> 'consumed')::integer + v_credit_consumed)
            );

            v_credits_by_service := jsonb_set(
                v_credits_by_service,
                ARRAY[v_service_key],
                v_current_service,
                true
            );

            v_credits_consumed := v_credits_consumed || jsonb_build_object(
                'subscription_id', v_subscription_id,
                'service_id', v_service_id,
                'consumed', v_credit_consumed
            );
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  -- 9) Fechamento em lote (lógica legítima preservada), isolado ao tenant efetivo.
  UPDATE public.comandas
  SET
    status = 'paid',
    closure_mode = 'standard',
    closure_note = NULLIF(BTRIM(p_closure_note), ''),
    financial_effect = true,
    membership_credit_effect = p_apply_credits,
    payment_method = p_payment_method,
    closed_at = NOW()
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
      AND closure_mode = 'standard'
      AND (v_eff_tenant_id IS NULL OR tenant_id = v_eff_tenant_id)
  )
    AND (v_eff_tenant_id IS NULL OR tenant_id = v_eff_tenant_id);

  RETURN jsonb_build_object(
    'updated_count', v_updated_count,
    'closure_mode', 'standard',
    'financial_effect', true,
    'membership_credit_effect', p_apply_credits,
    'credits_consumed', jsonb_build_object(
      'total', jsonb_array_length(v_credits_consumed),
      'by_service', v_credits_by_service
    )
  );
END;
$$;

-- Grants: manter o contrato original (authenticated pode executar), mas a
-- autorização agora é conferida no corpo (fail-closed). anon/PUBLIC/service_role:
-- nega-se explicitamente (defesa em profundidade).
REVOKE ALL ON FUNCTION public.bulk_close_comandas_with_credits(UUID[], UUID, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.bulk_close_comandas_with_credits(UUID[], UUID, TEXT, TEXT, BOOLEAN) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
