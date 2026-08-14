-- ==============================================================================
-- ROLLBACK — 20260813130000_h6_fix_f6_a_public_select_tenants_services.sql
-- Restaura as policies LEGADAS e os GRANTS ORIGINAIS de public.tenants/services
-- Fonte:
--   policies: supabase/migrations/20260305050000_kiosk_rls_fix.sql:7-12
--   grants:   docs/backups/backup_pre_migration_20260728_152717.sql:12831-12834, 13132-13134
-- ==============================================================================
-- Reversão do fix F6-A (least-privilege): volta a expor TODAS as linhas/colunas
-- de tenants/services ao anon. ⚠️ Reintroduz o achado F6-A (P0).
-- Exige aprovação explícita do PO (AGENTS.md — operação reversa/destrutiva).
-- ==============================================================================

-- 1. Remove as policies anon scoped criadas pelo fix
DROP POLICY IF EXISTS "anon_select_active_tenants" ON public.tenants;
DROP POLICY IF EXISTS "anon_select_services_active_tenant" ON public.services;

-- 2. Restaura as policies públicas legadas
CREATE POLICY "public_select_tenants" ON public.tenants
  FOR SELECT
  USING (true);

CREATE POLICY "public_select_services" ON public.services
  FOR SELECT
  USING (true);

-- 3. Remove os column grants mínimos concedidos ao anon
REVOKE SELECT (id, name, slug, status) ON public.tenants FROM anon;
REVOKE SELECT (id, tenant_id, name, price, duration, active, category) ON public.services FROM anon;

-- 4. Remove grants de compatibilidade futura (se as colunas existirem)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'duration_minutes'
  ) THEN
    EXECUTE 'REVOKE SELECT (duration_minutes) ON public.services FROM anon';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'is_active'
  ) THEN
    EXECUTE 'REVOKE SELECT (is_active) ON public.services FROM anon';
  END IF;
END
$$;

-- 5. Restaura os grants originais (anon + authenticated + service_role = ALL)
REVOKE ALL ON TABLE public.tenants FROM anon;
REVOKE ALL ON TABLE public.tenants FROM PUBLIC;
REVOKE ALL ON TABLE public.services FROM anon;
REVOKE ALL ON TABLE public.services FROM PUBLIC;
GRANT ALL ON TABLE public.tenants TO anon;
GRANT ALL ON TABLE public.tenants TO authenticated;
GRANT ALL ON TABLE public.tenants TO service_role;
GRANT ALL ON TABLE public.services TO anon;
GRANT ALL ON TABLE public.services TO authenticated;
GRANT ALL ON TABLE public.services TO service_role;

-- NOTIFY pgrst, 'reload schema';
