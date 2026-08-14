-- ==============================================================================
-- H6 F6-B: profiles — "Superadmins can view all profiles" sem TO (anon)
-- ==============================================================================
-- Contexto: homologação H-6 (docs/audit/H6_SECURITY_AUDIT.md). Achado F6-B (P0).
--   Policy legada de 20260227223434_fix_all_rls_policies_use_security_definer_function.sql
--   SEM cláusula TO: como profiles tem RLS e a policy aplica a PUBLIC (incl.
--   anon), qualquer leitura anônima de profiles retornava o filtro completo
--   ((role IN ('Super Admin','superadmin')) OR id = auth.uid()) — com auth.uid()
--   nulo, o probe anon viu todos os perfis com role Super Admin (dados reais do
--   Sanchez). A policy NÃO usava o helper SECURITY DEFINER da central fix.
-- Correção (aprovada pelo PO): recriar com TO authenticated e o helper
--   current_is_super_admin_from_auth_uid() (padrão das policies modernas),
--   além do revoke de anon/PUBLIC em profiles (defesa em profundidade).
-- Nota: a policy legada "Users can view own profile" (id = auth.uid()) fica
--   intocada — para anon auth.uid() é nulo, logo nunca devolve linhas, e o
--   revoke abaixo já bloqueia qualquer leitura anônima de profiles.
-- Nenhum fluxo anônimo (kiosk/portal) lê profiles.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Superadmins can view all profiles" ON public.profiles;

CREATE POLICY "Superadmins can view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.current_is_super_admin_from_auth_uid());

-- Revoke de anon/PUBLIC (defesa em profundidade — RLS já bloqueia anon)
REVOKE ALL ON TABLE public.profiles FROM anon;
REVOKE ALL ON TABLE public.profiles FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;

-- NOTIFY pgrst, 'reload schema';
