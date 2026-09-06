-- ============================================================
-- 20260830040000_m4_p8_tenant_refund_method.sql
-- M4-P8: Configuração de refund_method por tenant (PO Opção A).
-- DECISÃO DO PO (29/08/2026):
--   Coluna settings JSONB em public.tenants
--   Padrão inicial: internal_credit
--   Cada estorno grava refund_method usado
--   UI de configuração na tela de Settings do tenant
-- ============================================================

BEGIN;

-- ── 1. Alter table: tenants.settings ─────────────────────────
-- Coluna JSONB com default vazio. Estrutura futura extensível.

ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.tenants.settings IS
  'M4-P8: Configuracoes por tenant (JSONB). refund_method padrao: internal_credit. Extensivel para futuras configs.';

-- ── 2. RPC: get_tenant_refund_method ─────────────────────────
-- Retorna o refund_method configurado para o tenant.

CREATE OR REPLACE FUNCTION public.get_tenant_refund_method(
  p_tenant_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings JSONB;
  v_refund_method TEXT;
BEGIN
  IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id obrigatorio'; END IF;

  SELECT settings INTO v_settings FROM public.tenants
  WHERE id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant nao encontrado';
  END IF;

  v_refund_method := COALESCE(v_settings->>'refund_method', 'internal_credit');

  RETURN jsonb_build_object(
    'tenant_id', p_tenant_id,
    'refund_method', v_refund_method,
    'settings', COALESCE(v_settings, '{}'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_tenant_refund_method(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_tenant_refund_method(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_tenant_refund_method(UUID) IS
  'M4-P8: Retorna refund_method configurado para o tenant. Default: internal_credit.';

-- ── 3. RPC: upsert_tenant_refund_method ──────────────────────
-- Atualiza refund_method na coluna settings do tenant.
-- Gate: gestão (owner/admin/manager/gerente/superadmin).

CREATE OR REPLACE FUNCTION public.upsert_tenant_refund_method(
  p_tenant_id    UUID,
  p_refund_method TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_uid       UUID := auth.uid();
  v_is_super_admin BOOLEAN;
  v_access_role    TEXT;
  v_membership_role TEXT;
  v_normalized_role TEXT;
  v_settings       JSONB;
BEGIN
  IF v_auth_uid IS NULL THEN RAISE EXCEPTION 'Usuario autenticado obrigatorio'; END IF;
  IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id obrigatorio'; END IF;
  IF p_refund_method IS NULL OR BTRIM(p_refund_method) = '' THEN
    RAISE EXCEPTION 'refund_method obrigatorio';
  END IF;
  IF p_refund_method NOT IN ('internal_credit', 'pix', 'cash', 'card_reversal', 'store_credit') THEN
    RAISE EXCEPTION 'refund_method invalido: %. Valores aceitos: internal_credit, pix, cash, card_reversal, store_credit', p_refund_method;
  END IF;

  -- Management gate
  SELECT public.current_is_super_admin_from_auth_uid() INTO v_is_super_admin;
  SELECT LOWER(BTRIM(COALESCE(p2.role, ''))) INTO v_access_role
  FROM public.profiles p2 WHERE p2.id = v_auth_uid LIMIT 1;
  IF v_access_role IS NULL THEN
    SELECT LOWER(BTRIM(COALESCE(s.role, ''))) INTO v_access_role
    FROM public.staff s WHERE s.id = v_auth_uid LIMIT 1;
  END IF;
  SELECT LOWER(BTRIM(COALESCE(ut.role, ''))) INTO v_membership_role
  FROM public.user_tenants ut
  WHERE ut.user_id = v_auth_uid AND ut.tenant_id = p_tenant_id
  ORDER BY COALESCE(ut.is_primary, false) DESC LIMIT 1;

  v_normalized_role := COALESCE(NULLIF(v_access_role, ''), v_membership_role, '');

  IF NOT COALESCE(v_is_super_admin, false)
     AND v_normalized_role NOT IN ('owner', 'admin', 'manager', 'gerente', 'superadmin', 'super admin')
     AND v_membership_role NOT IN ('owner', 'admin', 'manager', 'gerente', 'superadmin')
  THEN
    RAISE EXCEPTION 'Somente gestao pode alterar configuracoes de reembolso';
  END IF;

  -- Load current settings, merge refund_method
  SELECT COALESCE(settings, '{}'::jsonb) INTO v_settings
  FROM public.tenants WHERE id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant nao encontrado';
  END IF;

  v_settings := v_settings || jsonb_build_object('refund_method', p_refund_method);

  UPDATE public.tenants
  SET settings = v_settings,
      updated_at = now()
  WHERE id = p_tenant_id;

  RETURN jsonb_build_object(
    'success', true,
    'tenant_id', p_tenant_id,
    'refund_method', p_refund_method,
    'settings', v_settings,
    'message', 'Metodo de reembolso atualizado com sucesso.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_tenant_refund_method(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_tenant_refund_method(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.upsert_tenant_refund_method(UUID, TEXT) IS
  'M4-P8: Atualiza refund_method nas settings do tenant. Gate: gestao. Valores: internal_credit, pix, cash, card_reversal, store_credit.';

NOTIFY pgrst, 'reload schema';

COMMIT;
