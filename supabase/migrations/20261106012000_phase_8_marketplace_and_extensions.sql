-- ==============================================================================
-- MIGRATION: Phase 8 — Marketplace & Catálogo de Extensões (Subfase 8.4)
-- Data: 2026-11-06
-- Referência: ADR-039 (ACCEPTED) & SMG Change Control Protocol
-- Autoridade: Augusto (PO) · Antigravity (Platform Architect)
-- Invariantes: Isolamento multi-tenant estrito (tenant_id), RLS defensivo,
--              vedação a service_role irrestrito no data path.
-- ==============================================================================

-- ==============================================================================
-- 1. Tabela: public.marketplace_extensions (Catálogo Geral de Extensões)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.marketplace_extensions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             TEXT NOT NULL UNIQUE,
  name             TEXT NOT NULL,
  headline         TEXT NOT NULL,
  description      TEXT NOT NULL,
  developer_name   TEXT NOT NULL,
  developer_email  TEXT NOT NULL,
  developer_url    TEXT NULL,
  category         TEXT NOT NULL CHECK (category IN ('hardware', 'communication', 'fiscal', 'analytics', 'marketing', 'other')),
  icon_url         TEXT NULL,
  banner_url       TEXT NULL,
  version          TEXT NOT NULL DEFAULT '1.0.0',
  pricing_type     TEXT NOT NULL CHECK (pricing_type IN ('free', 'subscription', 'one_time')),
  price_cents      INT NOT NULL DEFAULT 0,
  required_scopes  TEXT[] NOT NULL DEFAULT '{}',
  webhook_events   TEXT[] NOT NULL DEFAULT '{}',
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'under_review', 'published', 'deprecated')),
  rating_avg       NUMERIC(3,2) NOT NULL DEFAULT 5.00,
  install_count    INT NOT NULL DEFAULT 0,
  active           BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_marketplace_extensions_slug_not_empty CHECK (btrim(slug) <> ''),
  CONSTRAINT chk_marketplace_extensions_name_not_empty CHECK (btrim(name) <> '')
);

CREATE INDEX IF NOT EXISTS idx_marketplace_extensions_slug
  ON public.marketplace_extensions (slug);

CREATE INDEX IF NOT EXISTS idx_marketplace_extensions_status_active
  ON public.marketplace_extensions (status, active);

CREATE INDEX IF NOT EXISTS idx_marketplace_extensions_category
  ON public.marketplace_extensions (category);

ALTER TABLE public.marketplace_extensions ENABLE ROW LEVEL SECURITY;

CREATE POLICY marketplace_extensions_select_policy
  ON public.marketplace_extensions
  FOR SELECT
  USING (
    (status = 'published' AND active = true)
    OR public.current_is_super_admin_from_auth_uid()
  );

CREATE POLICY marketplace_extensions_insert_policy
  ON public.marketplace_extensions
  FOR INSERT
  WITH CHECK (
    public.current_is_super_admin_from_auth_uid()
  );

CREATE POLICY marketplace_extensions_update_policy
  ON public.marketplace_extensions
  FOR UPDATE
  USING (
    public.current_is_super_admin_from_auth_uid()
  )
  WITH CHECK (
    public.current_is_super_admin_from_auth_uid()
  );

CREATE POLICY marketplace_extensions_delete_policy
  ON public.marketplace_extensions
  FOR DELETE
  USING (
    public.current_is_super_admin_from_auth_uid()
  );

GRANT SELECT ON public.marketplace_extensions TO authenticated;

-- ==============================================================================
-- 2. Tabela: public.tenant_extensions (Instalações de Extensões por Barbearia)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.tenant_extensions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  extension_id     UUID NOT NULL REFERENCES public.marketplace_extensions(id) ON DELETE CASCADE,
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'uninstalled')),
  granted_scopes   TEXT[] NOT NULL DEFAULT '{}',
  settings         JSONB NOT NULL DEFAULT '{}'::jsonb,
  installed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  uninstalled_at   TIMESTAMPTZ NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_tenant_extension UNIQUE (tenant_id, extension_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_extensions_tenant_id
  ON public.tenant_extensions (tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_extensions_extension_id
  ON public.tenant_extensions (extension_id);

CREATE INDEX IF NOT EXISTS idx_tenant_extensions_status
  ON public.tenant_extensions (tenant_id, status);

ALTER TABLE public.tenant_extensions ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_extensions_tenant_isolation_select
  ON public.tenant_extensions
  FOR SELECT
  USING (
    tenant_id = public.current_effective_tenant_id()
    OR public.current_is_super_admin_from_auth_uid()
  );

CREATE POLICY tenant_extensions_tenant_isolation_insert
  ON public.tenant_extensions
  FOR INSERT
  WITH CHECK (
    tenant_id = public.current_effective_tenant_id()
    OR public.current_is_super_admin_from_auth_uid()
  );

CREATE POLICY tenant_extensions_tenant_isolation_update
  ON public.tenant_extensions
  FOR UPDATE
  USING (
    tenant_id = public.current_effective_tenant_id()
    OR public.current_is_super_admin_from_auth_uid()
  )
  WITH CHECK (
    tenant_id = public.current_effective_tenant_id()
    OR public.current_is_super_admin_from_auth_uid()
  );

CREATE POLICY tenant_extensions_tenant_isolation_delete
  ON public.tenant_extensions
  FOR DELETE
  USING (
    tenant_id = public.current_effective_tenant_id()
    OR public.current_is_super_admin_from_auth_uid()
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_extensions TO authenticated;

-- ==============================================================================
-- 3. Tabela: public.extension_reviews (Avaliações de Extensões por Barbearias)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.extension_reviews (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  extension_id     UUID NOT NULL REFERENCES public.marketplace_extensions(id) ON DELETE CASCADE,
  tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating           INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment          TEXT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_tenant_extension_review UNIQUE (extension_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_extension_reviews_extension_id
  ON public.extension_reviews (extension_id);

CREATE INDEX IF NOT EXISTS idx_extension_reviews_tenant_id
  ON public.extension_reviews (tenant_id);

ALTER TABLE public.extension_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY extension_reviews_select_policy
  ON public.extension_reviews
  FOR SELECT
  USING (true);

CREATE POLICY extension_reviews_insert_policy
  ON public.extension_reviews
  FOR INSERT
  WITH CHECK (
    (
      tenant_id = public.current_effective_tenant_id()
      OR public.current_is_super_admin_from_auth_uid()
    )
    AND user_id = auth.uid()
  );

CREATE POLICY extension_reviews_update_policy
  ON public.extension_reviews
  FOR UPDATE
  USING (
    (
      tenant_id = public.current_effective_tenant_id()
      OR public.current_is_super_admin_from_auth_uid()
    )
    AND user_id = auth.uid()
  )
  WITH CHECK (
    (
      tenant_id = public.current_effective_tenant_id()
      OR public.current_is_super_admin_from_auth_uid()
    )
    AND user_id = auth.uid()
  );

CREATE POLICY extension_reviews_delete_policy
  ON public.extension_reviews
  FOR DELETE
  USING (
    (
      tenant_id = public.current_effective_tenant_id()
      OR public.current_is_super_admin_from_auth_uid()
    )
    AND user_id = auth.uid()
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.extension_reviews TO authenticated;

-- ==============================================================================
-- 4. Função RPC: public.install_marketplace_extension (Instalação Atômica)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.install_marketplace_extension(
  p_extension_id   UUID,
  p_settings       JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id UUID;
  v_ext_status TEXT;
  v_ext_active BOOLEAN;
  v_req_scopes TEXT[];
  v_result RECORD;
BEGIN
  -- 1. Resolver tenant efetivo do usuário autenticado
  v_tenant_id := public.current_effective_tenant_id();
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum tenant ativo identificado para o usuário autenticado.' USING ERRCODE = '42501';
  END IF;

  -- 2. Validar se a extensão existe, está publicada e ativa
  SELECT status, active, required_scopes
    INTO v_ext_status, v_ext_active, v_req_scopes
    FROM public.marketplace_extensions
   WHERE id = p_extension_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Extensão não encontrada no catálogo.' USING ERRCODE = 'P0002';
  END IF;

  IF v_ext_status <> 'published' OR NOT v_ext_active THEN
    RAISE EXCEPTION 'Extensão indisponível para instalação (status: %, active: %).', v_ext_status, v_ext_active USING ERRCODE = 'P0001';
  END IF;

  -- 3. Upsert na tabela tenant_extensions concedendo os escopos requeridos
  INSERT INTO public.tenant_extensions (
    tenant_id,
    extension_id,
    status,
    granted_scopes,
    settings,
    installed_at,
    uninstalled_at,
    updated_at
  )
  VALUES (
    v_tenant_id,
    p_extension_id,
    'active',
    v_req_scopes,
    COALESCE(p_settings, '{}'::jsonb),
    now(),
    NULL,
    now()
  )
  ON CONFLICT (tenant_id, extension_id) DO UPDATE SET
    status = 'active',
    granted_scopes = EXCLUDED.granted_scopes,
    settings = COALESCE(EXCLUDED.settings, tenant_extensions.settings),
    uninstalled_at = NULL,
    updated_at = now()
  RETURNING * INTO v_result;

  -- 4. Atualizar contagem de instalações da extensão
  UPDATE public.marketplace_extensions
     SET install_count = (
           SELECT count(*)
             FROM public.tenant_extensions
            WHERE extension_id = p_extension_id
              AND status = 'active'
         ),
         updated_at = now()
   WHERE id = p_extension_id;

  RETURN jsonb_build_object(
    'success', true,
    'tenant_id', v_result.tenant_id,
    'extension_id', v_result.extension_id,
    'status', v_result.status,
    'granted_scopes', v_result.granted_scopes,
    'installed_at', v_result.installed_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.install_marketplace_extension(UUID, JSONB) TO authenticated;
