-- ==============================================================================
-- Migration: 20261105183000_phase_8_public_api_and_webhooks.sql
-- Description: Infraestrutura da Public API e Webhooks Externos (Fase 8)
-- Reference: ADR-032 (ACCEPTED) & PHASE_8_ENTRY_AUDIT.md
-- ==============================================================================

BEGIN;

-- 1. Garantir extensões criptográficas necessárias
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 2. Helper de Contexto Efetivo de Tenant (Suporte a auth.uid() e Sessão API)
CREATE OR REPLACE FUNCTION public.current_effective_tenant_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claim_tenant text;
BEGIN
  -- Tentar resolver claim de tenant injetado na sessão pelo API Gateway
  BEGIN
    v_claim_tenant := current_setting('request.jwt.claims', true)::jsonb->>'tenant_id';
    IF v_claim_tenant IS NOT NULL AND v_claim_tenant ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RETURN v_claim_tenant::uuid;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Em caso de erro no parse do JSON, prosseguir para o auth.uid()
    NULL;
  END;

  -- Fallback canônico para usuário autenticado via Supabase Auth
  RETURN public.current_tenant_id_from_auth_uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.current_effective_tenant_id() TO authenticated, anon;

-- ==============================================================================
-- 3. Tabela: public.api_keys (Credenciais de Acesso Externo)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.api_keys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  key_prefix   VARCHAR(16) NOT NULL,
  key_hash     TEXT NOT NULL UNIQUE,
  scopes       TEXT[] NOT NULL DEFAULT '{}'::text[],
  revoked_at   TIMESTAMPTZ NULL,
  expires_at   TIMESTAMPTZ NULL,
  last_used_at TIMESTAMPTZ NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by   UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT chk_api_keys_name_not_empty CHECK (btrim(name) <> '')
);

CREATE INDEX IF NOT EXISTS idx_api_keys_tenant_id
  ON public.api_keys (tenant_id);

CREATE INDEX IF NOT EXISTS idx_api_keys_lookup
  ON public.api_keys (key_hash, revoked_at, expires_at);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY api_keys_tenant_isolation_select
  ON public.api_keys
  FOR SELECT
  USING (
    tenant_id = public.current_effective_tenant_id()
    OR public.current_is_super_admin_from_auth_uid()
  );

CREATE POLICY api_keys_tenant_isolation_insert
  ON public.api_keys
  FOR INSERT
  WITH CHECK (
    tenant_id = public.current_effective_tenant_id()
    OR public.current_is_super_admin_from_auth_uid()
  );

CREATE POLICY api_keys_tenant_isolation_update
  ON public.api_keys
  FOR UPDATE
  USING (
    tenant_id = public.current_effective_tenant_id()
    OR public.current_is_super_admin_from_auth_uid()
  )
  WITH CHECK (
    tenant_id = public.current_effective_tenant_id()
    OR public.current_is_super_admin_from_auth_uid()
  );

CREATE POLICY api_keys_tenant_isolation_delete
  ON public.api_keys
  FOR DELETE
  USING (
    tenant_id = public.current_effective_tenant_id()
    OR public.current_is_super_admin_from_auth_uid()
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO authenticated;

-- ==============================================================================
-- 4. Tabela: public.webhook_subscriptions (Assinaturas de Webhook)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.webhook_subscriptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  url        TEXT NOT NULL,
  secret     TEXT NOT NULL,
  events     TEXT[] NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_webhook_subscriptions_url_not_empty CHECK (btrim(url) <> '')
);

CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_tenant_id
  ON public.webhook_subscriptions (tenant_id);

ALTER TABLE public.webhook_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY webhook_subscriptions_tenant_isolation_select
  ON public.webhook_subscriptions
  FOR SELECT
  USING (
    tenant_id = public.current_effective_tenant_id()
    OR public.current_is_super_admin_from_auth_uid()
  );

CREATE POLICY webhook_subscriptions_tenant_isolation_insert
  ON public.webhook_subscriptions
  FOR INSERT
  WITH CHECK (
    tenant_id = public.current_effective_tenant_id()
    OR public.current_is_super_admin_from_auth_uid()
  );

CREATE POLICY webhook_subscriptions_tenant_isolation_update
  ON public.webhook_subscriptions
  FOR UPDATE
  USING (
    tenant_id = public.current_effective_tenant_id()
    OR public.current_is_super_admin_from_auth_uid()
  )
  WITH CHECK (
    tenant_id = public.current_effective_tenant_id()
    OR public.current_is_super_admin_from_auth_uid()
  );

CREATE POLICY webhook_subscriptions_tenant_isolation_delete
  ON public.webhook_subscriptions
  FOR DELETE
  USING (
    tenant_id = public.current_effective_tenant_id()
    OR public.current_is_super_admin_from_auth_uid()
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhook_subscriptions TO authenticated;

-- ==============================================================================
-- 5. Tabela: public.webhook_deliveries (Fila Outbox & Auditoria de Entregas)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.webhook_subscriptions(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL,
  payload         JSONB NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed')),
  attempts        INT NOT NULL DEFAULT 0,
  next_retry_at   TIMESTAMPTZ NULL,
  response_status INT NULL,
  response_body   TEXT NULL,
  delivered_at    TIMESTAMPTZ NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_tenant_status
  ON public.webhook_deliveries (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_retry
  ON public.webhook_deliveries (status, next_retry_at);

ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY webhook_deliveries_tenant_isolation_select
  ON public.webhook_deliveries
  FOR SELECT
  USING (
    tenant_id = public.current_effective_tenant_id()
    OR public.current_is_super_admin_from_auth_uid()
  );

CREATE POLICY webhook_deliveries_tenant_isolation_insert
  ON public.webhook_deliveries
  FOR INSERT
  WITH CHECK (
    tenant_id = public.current_effective_tenant_id()
    OR public.current_is_super_admin_from_auth_uid()
  );

CREATE POLICY webhook_deliveries_tenant_isolation_update
  ON public.webhook_deliveries
  FOR UPDATE
  USING (
    tenant_id = public.current_effective_tenant_id()
    OR public.current_is_super_admin_from_auth_uid()
  )
  WITH CHECK (
    tenant_id = public.current_effective_tenant_id()
    OR public.current_is_super_admin_from_auth_uid()
  );

CREATE POLICY webhook_deliveries_tenant_isolation_delete
  ON public.webhook_deliveries
  FOR DELETE
  USING (
    tenant_id = public.current_effective_tenant_id()
    OR public.current_is_super_admin_from_auth_uid()
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhook_deliveries TO authenticated;

-- ==============================================================================
-- 6. RPC: Criação Segura de API Key (Retorno do Secret em Texto Plano Apenas Uma Vez)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.create_api_key(
  p_name text,
  p_scopes text[] DEFAULT '{}'::text[],
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  name text,
  key_prefix varchar(16),
  plain_key text,
  scopes text[],
  expires_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_tenant_id uuid;
  v_raw_token text;
  v_plain_key text;
  v_key_prefix varchar(16);
  v_key_hash text;
  v_new_id uuid;
  v_created_at timestamptz;
BEGIN
  -- 1. Obter tenant do usuário autenticado
  v_tenant_id := public.current_effective_tenant_id();
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Não autorizado: usuário não vinculado a tenant ativo'
      USING ERRCODE = 'P0001';
  END IF;

  -- 2. Validar nome da chave
  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'Nome da chave é obrigatório'
      USING ERRCODE = 'P0002';
  END IF;

  -- 3. Gerar token aleatório criptograficamente seguro (24 bytes hex = 48 chars)
  v_raw_token := encode(extensions.gen_random_bytes(24), 'hex');
  v_plain_key := 'smg_live_' || v_raw_token;
  v_key_prefix := substring(v_plain_key from 1 for 16);
  v_key_hash := encode(extensions.digest(v_plain_key, 'sha256'), 'hex');

  -- 4. Inserir registro com hash unidirecional (nunca texto plano)
  INSERT INTO public.api_keys (
    tenant_id,
    name,
    key_prefix,
    key_hash,
    scopes,
    expires_at,
    created_by
  ) VALUES (
    v_tenant_id,
    btrim(p_name),
    v_key_prefix,
    v_key_hash,
    COALESCE(p_scopes, '{}'::text[]),
    p_expires_at,
    auth.uid()
  )
  RETURNING public.api_keys.id, public.api_keys.created_at
  INTO v_new_id, v_created_at;

  -- 5. Retornar dados com o plain_key para exibição única ao usuário
  RETURN QUERY
  SELECT
    v_new_id,
    v_tenant_id,
    btrim(p_name),
    v_key_prefix,
    v_plain_key,
    COALESCE(p_scopes, '{}'::text[]),
    p_expires_at,
    v_created_at;
END;
$$;

-- ==============================================================================
-- 7. RPC: Revogação Imediata de API Key
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.revoke_api_key(p_key_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  v_tenant_id := public.current_effective_tenant_id();
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Não autorizado' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.api_keys
  SET revoked_at = now()
  WHERE id = p_key_id
    AND tenant_id = v_tenant_id
    AND revoked_at IS NULL;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_api_key(text, text[], timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_api_key(uuid) TO authenticated;

COMMIT;
