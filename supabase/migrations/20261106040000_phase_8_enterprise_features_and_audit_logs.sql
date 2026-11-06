-- ==============================================================================
-- MIGRATION: Phase 8 — Funcionalidades Enterprise, Auditoria Avançada & Portabilidade LGPD (Subfase 8.10)
-- Data: 2026-11-06
-- Referência: ADR-043 (ACCEPTED) & SMG Change Control Protocol
-- Autoridade: Augusto (PO) · Antigravity (Platform Architect)
-- Invariantes:
--   1. Isolamento multi-tenant estrito (tenant_id) via RLS defensivo;
--   2. Trilho forense imutável (append-only: sem UPDATE/DELETE em audit logs);
--   3. Conformidade estrita com LGPD (Art. 18: Portabilidade e prestação de contas);
--   4. Vedação de service_role irrestrito no data path;
--   5. Idempotência em DDL e RPCs.
-- ==============================================================================

-- ==============================================================================
-- 1. Tabela: public.enterprise_audit_logs (Trilho Forense Corporativo)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.enterprise_audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor_id      UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email   TEXT NULL,
  actor_role    TEXT NULL,
  action        TEXT NOT NULL,
  category      TEXT NOT NULL CHECK (category IN ('security', 'financial', 'compliance_lgpd', 'operational', 'system')),
  severity      TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  resource_type TEXT NOT NULL,
  resource_id   TEXT NULL,
  details       JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address    TEXT NULL,
  user_agent    TEXT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_enterprise_audit_logs_action_not_empty CHECK (btrim(action) <> ''),
  CONSTRAINT chk_enterprise_audit_logs_resource_type_not_empty CHECK (btrim(resource_type) <> '')
);

CREATE INDEX IF NOT EXISTS idx_enterprise_audit_logs_tenant_id
  ON public.enterprise_audit_logs (tenant_id);

CREATE INDEX IF NOT EXISTS idx_enterprise_audit_logs_category
  ON public.enterprise_audit_logs (category);

CREATE INDEX IF NOT EXISTS idx_enterprise_audit_logs_severity
  ON public.enterprise_audit_logs (severity);

CREATE INDEX IF NOT EXISTS idx_enterprise_audit_logs_action
  ON public.enterprise_audit_logs (action);

CREATE INDEX IF NOT EXISTS idx_enterprise_audit_logs_created_at
  ON public.enterprise_audit_logs (created_at DESC);

ALTER TABLE public.enterprise_audit_logs ENABLE ROW LEVEL SECURITY;

-- SELECT Policy: Apenas membros do próprio tenant ou Super-Admin
CREATE POLICY enterprise_audit_logs_select_policy
  ON public.enterprise_audit_logs
  FOR SELECT
  USING (
    tenant_id = public.current_effective_tenant_id()
    OR public.current_is_super_admin_from_auth_uid()
  );

-- INSERT Policy: Permitido para autenticados com o tenant contextual
CREATE POLICY enterprise_audit_logs_insert_policy
  ON public.enterprise_audit_logs
  FOR INSERT
  WITH CHECK (
    tenant_id = public.current_effective_tenant_id()
    OR public.current_is_super_admin_from_auth_uid()
  );

-- Imutabilidade: ZERO políticas de UPDATE ou DELETE (Append-only absoluto)

-- ==============================================================================
-- 2. Tabela: public.enterprise_data_exports (Gestão de Portabilidade LGPD)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.enterprise_data_exports (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  requested_by         UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  export_type          TEXT NOT NULL CHECK (export_type IN ('customers_lgpd', 'financial_ledger', 'appointments_history', 'full_backup')),
  status               TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'expired')),
  record_count         INT NOT NULL DEFAULT 0,
  file_url             TEXT NULL,
  file_checksum_sha256 TEXT NULL,
  expires_at           TIMESTAMPTZ NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at         TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_enterprise_data_exports_tenant_id
  ON public.enterprise_data_exports (tenant_id);

CREATE INDEX IF NOT EXISTS idx_enterprise_data_exports_status
  ON public.enterprise_data_exports (status);

CREATE INDEX IF NOT EXISTS idx_enterprise_data_exports_expires_at
  ON public.enterprise_data_exports (expires_at);

ALTER TABLE public.enterprise_data_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY enterprise_data_exports_select_policy
  ON public.enterprise_data_exports
  FOR SELECT
  USING (
    tenant_id = public.current_effective_tenant_id()
    OR public.current_is_super_admin_from_auth_uid()
  );

CREATE POLICY enterprise_data_exports_insert_policy
  ON public.enterprise_data_exports
  FOR INSERT
  WITH CHECK (
    tenant_id = public.current_effective_tenant_id()
    OR public.current_is_super_admin_from_auth_uid()
  );

CREATE POLICY enterprise_data_exports_update_policy
  ON public.enterprise_data_exports
  FOR UPDATE
  USING (
    tenant_id = public.current_effective_tenant_id()
    OR public.current_is_super_admin_from_auth_uid()
  );

CREATE POLICY enterprise_data_exports_delete_policy
  ON public.enterprise_data_exports
  FOR DELETE
  USING (
    public.current_is_super_admin_from_auth_uid()
  );

-- ==============================================================================
-- 3. RPC: Registrar Evento de Auditoria Corporativa (Seguro e Transacional)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.record_enterprise_audit_event(
  p_tenant_id     UUID,
  p_action        TEXT,
  p_category      TEXT,
  p_severity      TEXT DEFAULT 'info',
  p_resource_type TEXT DEFAULT 'system',
  p_resource_id   TEXT DEFAULT NULL,
  p_details       JSONB DEFAULT '{}'::jsonb,
  p_actor_email   TEXT DEFAULT NULL,
  p_actor_role    TEXT DEFAULT NULL,
  p_ip_address    TEXT DEFAULT NULL,
  p_user_agent    TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_effective_tenant UUID;
  v_is_super_admin BOOLEAN;
  v_actor_id UUID;
  v_new_id UUID;
BEGIN
  -- 1. Obter contexto autenticado
  v_effective_tenant := public.current_effective_tenant_id();
  v_is_super_admin := public.current_is_super_admin_from_auth_uid();
  v_actor_id := auth.uid();

  -- 2. Barreira de Segurança Multi-Tenant
  IF p_tenant_id IS NULL THEN
    p_tenant_id := v_effective_tenant;
  END IF;

  IF p_tenant_id <> v_effective_tenant AND NOT v_is_super_admin THEN
    RAISE EXCEPTION 'Acesso negado: não é permitido registrar eventos em outro tenant.';
  END IF;

  -- 3. Inserir log de auditoria
  INSERT INTO public.enterprise_audit_logs (
    tenant_id,
    actor_id,
    actor_email,
    actor_role,
    action,
    category,
    severity,
    resource_type,
    resource_id,
    details,
    ip_address,
    user_agent,
    created_at
  )
  VALUES (
    p_tenant_id,
    v_actor_id,
    p_actor_email,
    p_actor_role,
    p_action,
    p_category,
    COALESCE(p_severity, 'info'),
    p_resource_type,
    p_resource_id,
    COALESCE(p_details, '{}'::jsonb),
    p_ip_address,
    p_user_agent,
    now()
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_enterprise_audit_event(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT
) TO authenticated;

-- ==============================================================================
-- 4. RPC: Solicitar Exportação Corporativa com Auto-Auditoria LGPD
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.request_enterprise_data_export(
  p_tenant_id     UUID,
  p_export_type   TEXT,
  p_expires_days  INT DEFAULT 7
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_effective_tenant UUID;
  v_is_super_admin BOOLEAN;
  v_actor_id UUID;
  v_export_id UUID;
  v_expires_at TIMESTAMPTZ;
  v_days INT;
BEGIN
  v_effective_tenant := public.current_effective_tenant_id();
  v_is_super_admin := public.current_is_super_admin_from_auth_uid();
  v_actor_id := auth.uid();

  IF p_tenant_id IS NULL THEN
    p_tenant_id := v_effective_tenant;
  END IF;

  IF p_tenant_id <> v_effective_tenant AND NOT v_is_super_admin THEN
    RAISE EXCEPTION 'Acesso negado: solicitação de exportação de dados não autorizada para outro tenant.';
  END IF;

  v_days := COALESCE(p_expires_days, 7);
  IF v_days < 1 OR v_days > 30 THEN
    v_days := 7;
  END IF;

  v_expires_at := now() + (v_days || ' days')::interval;

  -- Inserir ordem de exportação
  INSERT INTO public.enterprise_data_exports (
    tenant_id,
    requested_by,
    export_type,
    status,
    expires_at,
    created_at
  )
  VALUES (
    p_tenant_id,
    v_actor_id,
    p_export_type,
    'pending',
    v_expires_at,
    now()
  )
  RETURNING id INTO v_export_id;

  -- Auto-registro no log de auditoria corporativa (LGPD compliance)
  PERFORM public.record_enterprise_audit_event(
    p_tenant_id,
    'compliance_lgpd.export_requested',
    'compliance_lgpd',
    'warning',
    'enterprise_data_exports',
    v_export_id::text,
    jsonb_build_object(
      'export_type', p_export_type,
      'expires_at', v_expires_at,
      'requested_by', v_actor_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'export_id', v_export_id,
    'status', 'pending',
    'export_type', p_export_type,
    'expires_at', v_expires_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_enterprise_data_export(
  UUID, TEXT, INT
) TO authenticated;
