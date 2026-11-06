-- ==============================================================================
-- MIGRATION: Phase 8 — Conectores e Integrações Core (Subfase 8.5)
-- Data: 2026-11-06
-- Referência: ADR-040 (ACCEPTED) & SMG Change Control Protocol
-- Autoridade: Augusto (PO) · Antigravity (Platform Architect)
-- Invariantes: Isolamento multi-tenant estrito (tenant_id), RLS defensivo,
--              preservação dos ciclos contábeis (ADR-001, ADR-017, ADR-018)
--              e vedação a service_role irrestrito no data path.
-- ==============================================================================

-- ==============================================================================
-- 1. Tabela: public.integration_providers (Provedores Nativos Homologados)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.integration_providers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             TEXT NOT NULL UNIQUE,
  name             TEXT NOT NULL,
  category         TEXT NOT NULL CHECK (category IN ('payment_gateway', 'fiscal_erp', 'crm_marketing')),
  auth_type        TEXT NOT NULL CHECK (auth_type IN ('api_key', 'oauth2', 'webhook_secret')),
  logo_url         TEXT NULL,
  description      TEXT NOT NULL,
  settings_schema  JSONB NOT NULL DEFAULT '{}'::jsonb,
  active           BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_integration_providers_slug_not_empty CHECK (btrim(slug) <> ''),
  CONSTRAINT chk_integration_providers_name_not_empty CHECK (btrim(name) <> '')
);

CREATE INDEX IF NOT EXISTS idx_integration_providers_slug
  ON public.integration_providers (slug);

CREATE INDEX IF NOT EXISTS idx_integration_providers_category
  ON public.integration_providers (category);

ALTER TABLE public.integration_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY integration_providers_select_policy
  ON public.integration_providers
  FOR SELECT
  USING (
    active = true
    OR public.current_is_super_admin_from_auth_uid()
  );

CREATE POLICY integration_providers_insert_policy
  ON public.integration_providers
  FOR INSERT
  WITH CHECK (
    public.current_is_super_admin_from_auth_uid()
  );

CREATE POLICY integration_providers_update_policy
  ON public.integration_providers
  FOR UPDATE
  USING (
    public.current_is_super_admin_from_auth_uid()
  )
  WITH CHECK (
    public.current_is_super_admin_from_auth_uid()
  );

CREATE POLICY integration_providers_delete_policy
  ON public.integration_providers
  FOR DELETE
  USING (
    public.current_is_super_admin_from_auth_uid()
  );

GRANT SELECT ON public.integration_providers TO authenticated;

-- ==============================================================================
-- 2. Tabela: public.tenant_integrations (Conectores Ativos por Barbearia)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.tenant_integrations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider_id           UUID NOT NULL REFERENCES public.integration_providers(id) ON DELETE CASCADE,
  status                TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'error', 'disabled')),
  encrypted_credentials JSONB NOT NULL DEFAULT '{}'::jsonb,
  settings              JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at        TIMESTAMPTZ NULL,
  last_error_message    TEXT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_tenant_integration UNIQUE (tenant_id, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_integrations_tenant_id
  ON public.tenant_integrations (tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_integrations_provider_id
  ON public.tenant_integrations (provider_id);

CREATE INDEX IF NOT EXISTS idx_tenant_integrations_status
  ON public.tenant_integrations (tenant_id, status);

ALTER TABLE public.tenant_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_integrations_tenant_isolation_select
  ON public.tenant_integrations
  FOR SELECT
  USING (
    tenant_id = public.current_effective_tenant_id()
    OR public.current_is_super_admin_from_auth_uid()
  );

CREATE POLICY tenant_integrations_tenant_isolation_insert
  ON public.tenant_integrations
  FOR INSERT
  WITH CHECK (
    tenant_id = public.current_effective_tenant_id()
    OR public.current_is_super_admin_from_auth_uid()
  );

CREATE POLICY tenant_integrations_tenant_isolation_update
  ON public.tenant_integrations
  FOR UPDATE
  USING (
    tenant_id = public.current_effective_tenant_id()
    OR public.current_is_super_admin_from_auth_uid()
  )
  WITH CHECK (
    tenant_id = public.current_effective_tenant_id()
    OR public.current_is_super_admin_from_auth_uid()
  );

CREATE POLICY tenant_integrations_tenant_isolation_delete
  ON public.tenant_integrations
  FOR DELETE
  USING (
    tenant_id = public.current_effective_tenant_id()
    OR public.current_is_super_admin_from_auth_uid()
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_integrations TO authenticated;

-- ==============================================================================
-- 3. Tabela: public.integration_sync_logs (Trilho de Auditoria de Sincronizações)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.integration_sync_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  integration_id   UUID NOT NULL REFERENCES public.tenant_integrations(id) ON DELETE CASCADE,
  event_type       TEXT NOT NULL,
  direction        TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  status           TEXT NOT NULL CHECK (status IN ('success', 'failed', 'ignored')),
  external_ref_id  TEXT NULL,
  duration_ms      INT NOT NULL DEFAULT 0,
  details          JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message    TEXT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_sync_logs_tenant_id
  ON public.integration_sync_logs (tenant_id);

CREATE INDEX IF NOT EXISTS idx_integration_sync_logs_integration_id
  ON public.integration_sync_logs (integration_id);

CREATE INDEX IF NOT EXISTS idx_integration_sync_logs_status
  ON public.integration_sync_logs (tenant_id, status);

ALTER TABLE public.integration_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY integration_sync_logs_tenant_isolation_select
  ON public.integration_sync_logs
  FOR SELECT
  USING (
    tenant_id = public.current_effective_tenant_id()
    OR public.current_is_super_admin_from_auth_uid()
  );

CREATE POLICY integration_sync_logs_tenant_isolation_insert
  ON public.integration_sync_logs
  FOR INSERT
  WITH CHECK (
    tenant_id = public.current_effective_tenant_id()
    OR public.current_is_super_admin_from_auth_uid()
  );

GRANT SELECT, INSERT ON public.integration_sync_logs TO authenticated;

-- ==============================================================================
-- 4. Função RPC: public.record_integration_sync_event (Registro Atômico de Auditoria)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.record_integration_sync_event(
  p_integration_id   UUID,
  p_event_type       TEXT,
  p_direction        TEXT,
  p_status           TEXT,
  p_external_ref_id  TEXT DEFAULT NULL,
  p_duration_ms      INT DEFAULT 0,
  p_details          JSONB DEFAULT '{}'::jsonb,
  p_error_message    TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id UUID;
  v_log_id UUID;
BEGIN
  -- 1. Resolver tenant efetivo do chamador
  v_tenant_id := public.current_effective_tenant_id();
  IF v_tenant_id IS NULL AND NOT public.current_is_super_admin_from_auth_uid() THEN
    RAISE EXCEPTION 'Acesso negado: tenant não identificado.' USING ERRCODE = '42501';
  END IF;

  -- 2. Validar que a integração pertence ao tenant
  IF NOT public.current_is_super_admin_from_auth_uid() THEN
    SELECT tenant_id INTO v_tenant_id
      FROM public.tenant_integrations
     WHERE id = p_integration_id
       AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Integração não encontrada ou não pertencente ao tenant.' USING ERRCODE = 'P0002';
    END IF;
  ELSE
    SELECT tenant_id INTO v_tenant_id
      FROM public.tenant_integrations
     WHERE id = p_integration_id;
  END IF;

  -- 3. Inserir log de auditoria
  INSERT INTO public.integration_sync_logs (
    tenant_id,
    integration_id,
    event_type,
    direction,
    status,
    external_ref_id,
    duration_ms,
    details,
    error_message,
    created_at
  )
  VALUES (
    v_tenant_id,
    p_integration_id,
    p_event_type,
    p_direction,
    p_status,
    p_external_ref_id,
    p_duration_ms,
    COALESCE(p_details, '{}'::jsonb),
    p_error_message,
    now()
  )
  RETURNING id INTO v_log_id;

  -- 4. Atualizar status e timestamps da integração
  UPDATE public.tenant_integrations
     SET last_synced_at = now(),
         last_error_message = CASE WHEN p_status = 'failed' THEN p_error_message ELSE last_error_message END,
         status = CASE WHEN p_status = 'failed' THEN 'error' ELSE 'active' END,
         updated_at = now()
   WHERE id = p_integration_id;

  RETURN jsonb_build_object(
    'success', true,
    'log_id', v_log_id,
    'status', p_status,
    'recorded_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_integration_sync_event(UUID, TEXT, TEXT, TEXT, TEXT, INT, JSONB, TEXT) TO authenticated;

-- ==============================================================================
-- 5. Seed: Provedores Nativos Homologados
-- ==============================================================================

INSERT INTO public.integration_providers (slug, name, category, auth_type, description, settings_schema)
VALUES
  (
    'mercado_pago',
    'Mercado Pago',
    'payment_gateway',
    'api_key',
    'Gateway oficial para geração de Pix dinâmico no balcão e checkout com cartão.',
    '{"access_token":{"type":"string","required":true},"public_key":{"type":"string","required":true}}'::jsonb
  ),
  (
    'asaas',
    'Asaas',
    'payment_gateway',
    'api_key',
    'Gestão de cobranças recorrentes do Club dos Chefes, split de pagamento e boletos.',
    '{"api_key":{"type":"string","required":true},"sandbox":{"type":"boolean","default":false}}'::jsonb
  ),
  (
    'conta_azul',
    'ContaAzul ERP',
    'fiscal_erp',
    'oauth2',
    'Exportação automatizada de fechamentos diários de caixa e emissão de NFS-e.',
    '{"auto_sync_closing":{"type":"boolean","default":true}}'::jsonb
  ),
  (
    'omie',
    'Omie ERP',
    'fiscal_erp',
    'api_key',
    'Sincronização financeira corporativa multi-unidade e gestão contábil.',
    '{"app_key":{"type":"string","required":true},"app_secret":{"type":"string","required":true}}'::jsonb
  ),
  (
    'rd_station',
    'RD Station Marketing',
    'crm_marketing',
    'api_key',
    'Automação de engajamento, boas-vindas a clientes novos e régua de reativação.',
    '{"token":{"type":"string","required":true}}'::jsonb
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  auth_type = EXCLUDED.auth_type,
  description = EXCLUDED.description,
  settings_schema = EXCLUDED.settings_schema,
  updated_at = now();
