-- ==============================================================================
-- H6 F6-A: public_select_tenants / public_select_services — least-privilege anon
-- ==============================================================================
-- Contexto: homologação H-6 (docs/audit/H6_SECURITY_AUDIT.md). Achado F6-A (P0).
--   Policies legadas USING (true) de 20260305050000_kiosk_rls_fix.sql expunham
--   TODAS as linhas e TODAS as colunas de public.tenants e public.services ao
--   anon (dado real do tenant Sanchez retornado em probe — plan 'pro' e demais
--   colunas sensíveis). O kiosk/portal são fluxos anônimos por design, logo o
--   DROP puro quebraria o produto — o PO aprovou mínimo privilégio.
-- Correção (aprovada pelo PO):
--   1. tenants: anon enxerga apenas tenants ativos/trial e apenas as colunas
--      (id, name, slug, status) — necessário ao kiosk/portal (resolução por slug).
--   2. services: anon enxerga apenas serviços de tenants ativos/trial e apenas
--      as colunas públicas do catálogo (id, tenant_id, name, price, duration,
--      active, category).
--   3. revoke de anon/PUBLIC + re-grant seletivo (defesa em profundidade).
-- Autenticados NÃO são afetados: leituras já cobertas por
--   tenant_isolation_tenants_select (20260723000000) e n_v2/n_insert_v2
--   (20260715010000) — policies TO authenticated.
-- OBS produto (fora do escopo, registrado): KioskSchedule.tsx:56 e
--   PortalSchedule.tsx:95 consultam services com as colunas duration_minutes /
--   is_active que NÃO existem em public.services — o catálogo anon já estava
--   quebrado antes desta correção (mesmo cenário de clients/appointments anon,
--   sem policies desde 20260308_multitenant_hotfix.sql). Grants dessas colunas
--   são adicionados via guarda IF EXISTS para compatibilidade futura, caso o
--   schema de services seja corrigido.
-- ------------------------------------------------------------------------------

-- 1. Tenants — remove a policy pública legada
DROP POLICY IF EXISTS "public_select_tenants" ON public.tenants;

-- 2. Services — remove a policy pública legada
DROP POLICY IF EXISTS "public_select_services" ON public.services;

-- 3. Revoke de anon/PUBLIC (defesa em profundidade — RLS sozinha não basta)
REVOKE ALL ON TABLE public.tenants FROM anon;
REVOKE ALL ON TABLE public.tenants FROM PUBLIC;
REVOKE ALL ON TABLE public.services FROM anon;
REVOKE ALL ON TABLE public.services FROM PUBLIC;

-- 4. Tenants — policy anon scoped: apenas tenants operacionais
CREATE POLICY "anon_select_active_tenants" ON public.tenants
  FOR SELECT TO anon
  USING (status IN ('active'::public.tenant_status, 'trial'::public.tenant_status));

-- 5. Tenants — grants mínimos ao anon (id, name, slug, status)
GRANT SELECT (id, name, slug, status) ON public.tenants TO anon;

-- 6. Services — policy anon scoped: apenas serviços de tenants operacionais
CREATE POLICY "anon_select_services_active_tenant" ON public.services
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.id = services.tenant_id
        AND t.status IN ('active'::public.tenant_status, 'trial'::public.tenant_status)
    )
  );

-- 7. Services — grants mínimos ao anon (colunas públicas do catálogo)
GRANT SELECT (id, tenant_id, name, price, duration, active, category)
  ON public.services TO anon;

-- 8. Compatibilidade futura: duration_minutes / is_active (ver OBS acima)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'duration_minutes'
  ) THEN
    EXECUTE 'GRANT SELECT (duration_minutes) ON public.services TO anon';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'is_active'
  ) THEN
    EXECUTE 'GRANT SELECT (is_active) ON public.services TO anon';
  END IF;
END
$$;

-- NOTIFY pgrst, 'reload schema';
