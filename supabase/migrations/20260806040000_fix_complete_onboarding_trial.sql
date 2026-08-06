-- =====================================================
-- PHASE 6.0.4.3 (PARTE 2) — LIFECYCLE BILLING: complete_onboarding
-- =====================================================
-- Objetivo (F10/D5):
--   complete_onboarding passa a efetuar a transição OBRIGATÓRIA
--   `draft -> trial` (invocando start_trial), nunca `draft -> active` direto.
--   start_trial cria a subscription (status trialing) e transiciona
--   tenants.status para 'trial'. Idempotente (re-executar o onboarding
--   devolve a subscription existente sem reverter o estado).
--
-- Correções incluídas:
--   1. Guard legado `profiles.role = 'manager'` -> helper oficial
--      current_is_tenant_manager_from_auth_uid (owner/manager/admin + superadmin).
--      Alinhamento com 6.0.3 (mesmo vínculo de current_tenant_id_from_auth_uid).
--   2. `UPDATE tenants SET status='active'` -> `PERFORM start_trial(p_tenant_id)`.
--   3. Grants conforme ADR-012: REVOKE anon/PUBLIC, GRANT authenticated
--      (complete_onboarding era anon-callable por default — sem GRANT explícito
--      na migration sprint1).
--
-- Padrão: idempotente (CREATE OR REPLACE).
-- =====================================================

-- 1. complete_onboarding — draft -> trial via start_trial (F10/D5)
CREATE OR REPLACE FUNCTION public.complete_onboarding(
  p_tenant_id UUID,
  p_chair_count INTEGER DEFAULT NULL,
  p_business_hours JSONB DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_cnpj TEXT DEFAULT NULL,
  p_address_street TEXT DEFAULT NULL,
  p_address_number TEXT DEFAULT NULL,
  p_address_city TEXT DEFAULT NULL,
  p_address_state TEXT DEFAULT NULL,
  p_address_zip TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Security: gestor ativo do tenant (owner/manager/admin) ou superadmin
  IF NOT public.current_is_tenant_manager_from_auth_uid(p_tenant_id) THEN
    RAISE EXCEPTION 'Acesso negado: apenas gestores do tenant podem completar onboarding';
  END IF;

  INSERT INTO public.tenant_settings (
    tenant_id, chair_count, business_hours, phone, cnpj,
    address_street, address_number, address_city, address_state, address_zip
  ) VALUES (
    p_tenant_id, p_chair_count, p_business_hours, p_phone, p_cnpj,
    p_address_street, p_address_number, p_address_city, p_address_state, p_address_zip
  )
  ON CONFLICT (tenant_id) DO UPDATE SET
    chair_count = EXCLUDED.chair_count,
    business_hours = EXCLUDED.business_hours,
    phone = EXCLUDED.phone,
    cnpj = EXCLUDED.cnpj,
    address_street = EXCLUDED.address_street,
    address_number = EXCLUDED.address_number,
    address_city = EXCLUDED.address_city,
    address_state = EXCLUDED.address_state,
    address_zip = EXCLUDED.address_zip,
    updated_at = now();

  -- F10/D5: draft -> trial (nunca draft -> active direto).
  -- start_trial cria a subscription (trialing) e transiciona tenants.status.
  -- Idempotente: re-executar devolve a subscription ativa existente.
  PERFORM public.start_trial(p_tenant_id);

  UPDATE public.profiles SET onboarding_completed = true WHERE tenant_id = p_tenant_id;
END;
$$;

-- =====================================================
-- GRANTS (ADR-012): authenticated-only; complete_onboarding era
-- anon-callable por default (sem GRANT explícito na sprint1).
-- =====================================================
REVOKE EXECUTE ON FUNCTION public.complete_onboarding(uuid, integer, jsonb, text, text, text, text, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.complete_onboarding(uuid, integer, jsonb, text, text, text, text, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.complete_onboarding(uuid, integer, jsonb, text, text, text, text, text, text, text) TO authenticated;
