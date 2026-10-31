-- ============================================================================
-- F03 — is_super_admin() confiava em user_metadata editável pelo usuário
-- ============================================================================
-- Achado: docs/security-audit/relatorio-auditoria-seguranca.pdf (F03, crítico)
-- Superfície: public.is_super_admin() e policies de usage_logs/alerts/
-- notification_channels.
--
-- A função lia auth.jwt() -> 'user_metadata' ->> 'role'. Qualquer usuário
-- autenticado pode gravar user_metadata via auth.updateUser({ data: ... }), então
-- o próprio usuário controlava o critério de autorização. O mesmo atalho existia
-- em supabase/functions/_shared/usage-monitor-auth.ts.
--
-- Correção: a única fonte de verdade passa a ser public.profiles (role persistido
-- + status ativo), consultada pelo helper canônico
-- current_is_super_admin_from_auth_uid(). Nenhum claim editável pelo usuário é
-- considerado.
--
-- Rollback: recriar as funções como em
-- 20260317123000_create_supabase_monitoring_module.sql e 20260308_multitenant_hotfix.sql.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.current_is_super_admin_from_auth_uid()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.status = 'active'
      AND lower(coalesce(p.role, '')) IN ('super admin', 'superadmin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_is_super_admin_from_auth_uid();
$$;

REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.current_is_super_admin_from_auth_uid() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_is_super_admin_from_auth_uid()
  TO authenticated, service_role;
