-- ============================================================================
-- 20261105190000_add_audit_pin_management.sql
--
-- Frente: AUDIT-PIN-COMPETENCE — autoatendimento do PIN gerencial.
-- Decisão do PO (2026-11-05): o gestor cadastra e troca o próprio PIN em
-- Configurações → Segurança. Esta migration substitui o R-04 anterior
-- ("provisionamento manual, sem UI"), mantendo integralmente:
--   - manager_pins como tabela deny-all para a API (RLS sem policy + REVOKE);
--   - hash bcrypt lido apenas por funções SECURITY DEFINER;
--   - PIN obrigatório em competência retroativa (R-02);
--   - throttle de 250 ms sem lockout (R-03).
--
-- Contrato desta migration:
--   1. can_manage_audit_pin(user_id, tenant_id) — helper interno, sem EXECUTE
--      para anon/authenticated. Espelha a autorização de
--      finance_reverse_transaction (perfil, staff ou vínculo em user_tenants).
--   2. get_audit_pin_status(tenant_id) — devolve apenas { configured, updated_at }
--      do próprio chamador. Nunca devolve hash.
--   3. set_audit_pin(tenant_id, new_pin, current_pin) — grava o PIN do próprio
--      auth.uid(). Exige PIN atual quando já existe. Registra auditoria
--      sanitizada em audit_logs (sem hash).
--
-- APLICAR SOMENTE EM STAGING. NÃO APLICAR EM PRODUÇÃO SEM AUTORIZAÇÃO
-- EXPLÍCITA DO PO.
-- ============================================================================

BEGIN;

-- ── 1. Autorização interna ──────────────────────────────────────────────────
-- Sem EXECUTE para anon/authenticated: chamado apenas pelas RPCs deste arquivo.
CREATE OR REPLACE FUNCTION public.can_manage_audit_pin(
  p_user_id   UUID,
  p_tenant_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_role TEXT;
  v_staff_role   TEXT;
  v_membership_role TEXT;
BEGIN
  IF p_user_id IS NULL OR p_tenant_id IS NULL THEN
    RETURN false;
  END IF;

  IF COALESCE(public.current_is_super_admin_from_auth_uid(), false) THEN
    RETURN true;
  END IF;

  SELECT LOWER(BTRIM(COALESCE(p.role, ''))) INTO v_profile_role
  FROM public.profiles p
  WHERE p.id = p_user_id
  LIMIT 1;

  SELECT LOWER(BTRIM(COALESCE(s.role, ''))) INTO v_staff_role
  FROM public.staff s
  WHERE s.id = p_user_id
  LIMIT 1;

  IF COALESCE(v_profile_role, v_staff_role, '') IN
     ('owner', 'admin', 'manager', 'gerente', 'superadmin', 'super admin') THEN
    IF (p_user_id = auth.uid() AND public.current_tenant_id_from_auth_uid() = p_tenant_id)
       OR EXISTS (
         SELECT 1 FROM public.user_tenants ut
         WHERE ut.user_id = p_user_id AND ut.tenant_id = p_tenant_id
       ) THEN
      RETURN true;
    END IF;
  END IF;

  SELECT LOWER(BTRIM(COALESCE(ut.role, ''))) INTO v_membership_role
  FROM public.user_tenants ut
  WHERE ut.user_id = p_user_id AND ut.tenant_id = p_tenant_id
  ORDER BY COALESCE(ut.is_primary, false) DESC
  LIMIT 1;

  RETURN COALESCE(
    v_membership_role IN ('owner', 'admin', 'manager', 'gerente', 'superadmin', 'super admin'),
    false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.can_manage_audit_pin(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_audit_pin(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.can_manage_audit_pin(UUID, UUID) FROM authenticated;

COMMENT ON FUNCTION public.can_manage_audit_pin(UUID, UUID) IS
  'Helper interno de autorizacao para gestao do PIN gerencial. Sem EXECUTE para anon/authenticated.';

-- ── 2. Status do PIN (sem hash) ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_audit_pin_status(
  p_tenant_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_uid  UUID := auth.uid();
  v_updated_at TIMESTAMPTZ;
BEGIN
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'Usuario autenticado obrigatorio';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id obrigatorio';
  END IF;

  IF NOT public.can_manage_audit_pin(v_auth_uid, p_tenant_id) THEN
    RAISE EXCEPTION 'Usuario sem permissao para gerenciar PIN gerencial';
  END IF;

  SELECT mp.updated_at INTO v_updated_at
  FROM public.manager_pins mp
  WHERE mp.user_id = v_auth_uid
    AND mp.tenant_id = p_tenant_id;

  RETURN jsonb_build_object(
    'configured', v_updated_at IS NOT NULL,
    'updated_at', v_updated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_audit_pin_status(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_audit_pin_status(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_audit_pin_status(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_audit_pin_status(UUID) IS
  'Retorna apenas { configured, updated_at } do PIN do proprio usuario no tenant. Nunca retorna hash.';

-- ── 3. Cadastro / troca do PIN ──────────────────────────────────────────────
-- Sem p_user_id de propósito: o alvo e sempre auth.uid(). Isso elimina
-- qualquer possibilidade de um gestor sobrescrever o PIN de outro usuario.
CREATE OR REPLACE FUNCTION public.set_audit_pin(
  p_tenant_id   UUID,
  p_new_pin     TEXT,
  p_current_pin TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_auth_uid      UUID := auth.uid();
  v_new_pin       TEXT := NULLIF(BTRIM(COALESCE(p_new_pin, '')), '');
  v_current_pin   TEXT := NULLIF(BTRIM(COALESCE(p_current_pin, '')), '');
  v_existing_hash TEXT;
  v_created       BOOLEAN := false;
BEGIN
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'Usuario autenticado obrigatorio';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id obrigatorio';
  END IF;

  IF NOT public.can_manage_audit_pin(v_auth_uid, p_tenant_id) THEN
    RAISE EXCEPTION 'Usuario sem permissao para gerenciar PIN gerencial';
  END IF;

  IF v_new_pin IS NULL OR v_new_pin !~ '^[0-9]{6,8}$' THEN
    RAISE EXCEPTION 'PIN deve ter de 6 a 8 digitos';
  END IF;

  SELECT mp.pin_hash INTO v_existing_hash
  FROM public.manager_pins mp
  WHERE mp.user_id = v_auth_uid
    AND mp.tenant_id = p_tenant_id
  FOR UPDATE;

  IF v_existing_hash IS NOT NULL AND BTRIM(v_existing_hash) <> '' THEN
    IF v_current_pin IS NULL THEN
      RAISE EXCEPTION 'PIN atual obrigatorio para alterar o PIN';
    END IF;

    IF NOT public.verify_audit_pin(v_auth_uid, p_tenant_id, v_current_pin) THEN
      -- Mesmo throttle de validate_audit_pin: desencoraja varredura de PIN
      -- sem introduzir lockout persistente (R-03).
      PERFORM pg_sleep(0.25);
      RAISE EXCEPTION 'PIN atual invalido';
    END IF;
  ELSE
    v_created := true;
  END IF;

  INSERT INTO public.manager_pins (user_id, tenant_id, pin_hash)
  VALUES (v_auth_uid, p_tenant_id, crypt(v_new_pin, gen_salt('bf', 12)))
  ON CONFLICT (user_id, tenant_id)
  DO UPDATE SET pin_hash = EXCLUDED.pin_hash, updated_at = now();

  -- Auditoria sanitizada: o trigger generico NAO e anexado a manager_pins
  -- porque to_jsonb(NEW) gravaria o pin_hash. Aqui registramos apenas o fato.
  INSERT INTO public.audit_logs (
    table_name, record_id, action, old_data, new_data, changed_by, tenant_id
  )
  VALUES (
    'manager_pins',
    v_auth_uid::text || ':' || p_tenant_id::text,
    CASE WHEN v_created THEN 'INSERT' ELSE 'UPDATE' END,
    CASE WHEN v_created THEN NULL ELSE jsonb_build_object('configured', true) END,
    jsonb_build_object('configured', true, 'changed_by_user_id', v_auth_uid),
    v_auth_uid,
    p_tenant_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'created', v_created,
    'message', CASE WHEN v_created THEN 'PIN gerencial cadastrado.' ELSE 'PIN gerencial atualizado.' END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_audit_pin(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_audit_pin(UUID, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_audit_pin(UUID, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.set_audit_pin(UUID, TEXT, TEXT) IS
  'Cadastra ou troca o PIN gerencial do proprio auth.uid() no tenant. Exige PIN atual quando ja existe e audita sem gravar hash.';

NOTIFY pgrst, 'reload schema';

COMMIT;
