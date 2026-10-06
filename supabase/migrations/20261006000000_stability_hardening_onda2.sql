-- ============================================================================
-- 20261006000000_stability_hardening_onda2.sql
-- ONDA 2: Estabilidade e Performance do Banco (Search Path & Redundant Indexes)
-- ============================================================================

BEGIN;

-- 1. CORREÇÃO DE SEARCH_PATH EM FUNÇÕES SECURITY DEFINER
-- Fix: Garante que funções com privilégios elevados não sejam vulneráveis a search path hijacking.
-- Protocolo: SET search_path = public

ALTER FUNCTION public.set_tenant_id_from_profile() SET search_path = public;
ALTER FUNCTION public.is_super_admin() SET search_path = public;
ALTER FUNCTION public.backfill_service_execution_participants() SET search_path = public;
ALTER FUNCTION public.bulk_close_comandas_normal(uuid[], uuid, text, text) SET search_path = public;
ALTER FUNCTION public.detect_no_show_appointments(uuid, integer) SET search_path = public;
ALTER FUNCTION public.validate_and_fix_comandas(uuid) SET search_path = public;
ALTER FUNCTION public.close_order(uuid) SET search_path = public;
ALTER FUNCTION public.approve_access_request(uuid) SET search_path = public, auth;
ALTER FUNCTION public.get_current_subscription_credits(uuid, uuid) SET search_path = public;

COMMIT;
