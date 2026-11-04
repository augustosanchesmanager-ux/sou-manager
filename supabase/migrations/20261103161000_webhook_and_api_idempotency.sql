-- ============================================================
-- Migration: 20261103161000_webhook_and_api_idempotency.sql
-- Inbound Webhooks & API Idempotency Hardening
-- ============================================================

-- 1. Inbound Webhook Events Table
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gateway      TEXT NOT NULL,
  event_id     TEXT NOT NULL,
  event_type   TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processing', 'completed', 'failed', 'ignored')),
  payload      JSONB NOT NULL,
  received_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  error_log    TEXT,
  CONSTRAINT uq_webhook_events_gateway_event UNIQUE (gateway, event_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_status_received
  ON public.webhook_events (status, received_at);

CREATE INDEX IF NOT EXISTS idx_webhook_events_gateway_event
  ON public.webhook_events (gateway, event_id);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY webhook_events_superadmin_all
  ON public.webhook_events
  FOR ALL
  USING (public.current_is_super_admin_from_auth_uid());

-- 2. Inbound API Request Idempotency Table
CREATE TABLE IF NOT EXISTS public.api_idempotency_keys (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id        TEXT NOT NULL,
  idempotency_key  TEXT NOT NULL,
  path             TEXT NOT NULL,
  request_hash     TEXT NOT NULL,
  response_status  INTEGER,
  response_body    JSONB,
  status           TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  locked_until     TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 seconds'),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_api_idempotency_tenant_key UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_api_idempotency_tenant_key
  ON public.api_idempotency_keys (tenant_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_api_idempotency_created
  ON public.api_idempotency_keys (created_at);

ALTER TABLE public.api_idempotency_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY api_idempotency_tenant_all
  ON public.api_idempotency_keys
  FOR ALL
  USING (tenant_id = public.current_tenant_id_from_auth_uid() OR public.current_is_super_admin_from_auth_uid())
  WITH CHECK (tenant_id = public.current_tenant_id_from_auth_uid() OR public.current_is_super_admin_from_auth_uid());

-- 3. Atomic RPC for Webhook Event Registration
CREATE OR REPLACE FUNCTION public.record_webhook_event(
  p_gateway TEXT,
  p_event_id TEXT,
  p_event_type TEXT,
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inserted_id UUID;
  v_existing_status TEXT;
BEGIN
  IF p_gateway IS NULL OR p_event_id IS NULL OR p_event_type IS NULL THEN
    RAISE EXCEPTION 'Parâmetros obrigatórios ausentes para registro de webhook.';
  END IF;

  INSERT INTO public.webhook_events (gateway, event_id, event_type, payload)
  VALUES (p_gateway, p_event_id, p_event_type, COALESCE(p_payload, '{}'::jsonb))
  ON CONFLICT (gateway, event_id) DO NOTHING
  RETURNING id INTO v_inserted_id;

  IF v_inserted_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'recorded', true,
      'duplicate', false,
      'event_id', p_event_id,
      'id', v_inserted_id
    );
  END IF;

  SELECT status INTO v_existing_status
  FROM public.webhook_events
  WHERE gateway = p_gateway AND event_id = p_event_id;

  RETURN jsonb_build_object(
    'recorded', false,
    'duplicate', true,
    'event_id', p_event_id,
    'status', v_existing_status
  );
END;
$$;

-- 4. Atomic RPCs for Client API Idempotency
CREATE OR REPLACE FUNCTION public.claim_api_idempotency_key(
  p_tenant_id TEXT,
  p_idempotency_key TEXT,
  p_path TEXT,
  p_request_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing public.api_idempotency_keys%ROWTYPE;
BEGIN
  IF p_tenant_id IS NULL OR p_idempotency_key IS NULL OR p_request_hash IS NULL THEN
    RAISE EXCEPTION 'Parâmetros obrigatórios ausentes para idempotência de API.';
  END IF;

  -- Validação de isolamento do tenant
  IF NOT public.current_is_super_admin_from_auth_uid() THEN
    IF p_tenant_id <> public.current_tenant_id_from_auth_uid() THEN
      RAISE EXCEPTION 'Acesso negado ao tenant especificado.';
    END IF;
  END IF;

  -- Tenta inserir novo registro de processamento
  INSERT INTO public.api_idempotency_keys (
    tenant_id,
    idempotency_key,
    path,
    request_hash,
    status,
    locked_until
  )
  VALUES (
    p_tenant_id,
    p_idempotency_key,
    COALESCE(p_path, ''),
    p_request_hash,
    'processing',
    now() + interval '30 seconds'
  )
  ON CONFLICT (tenant_id, idempotency_key) DO NOTHING;

  IF FOUND THEN
    RETURN jsonb_build_object('action', 'execute', 'status', 'new');
  END IF;

  -- Se já existia, busca com lock de linha
  SELECT * INTO v_existing
  FROM public.api_idempotency_keys
  WHERE tenant_id = p_tenant_id AND idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('action', 'execute', 'status', 'new');
  END IF;

  -- Verifica integridade do payload
  IF v_existing.request_hash <> p_request_hash THEN
    RETURN jsonb_build_object(
      'action', 'reject',
      'status', 'hash_mismatch',
      'error', 'A chave de idempotência foi reutilizada com um payload diferente.'
    );
  END IF;

  IF v_existing.status = 'completed' THEN
    RETURN jsonb_build_object(
      'action', 'replay',
      'status', 'completed',
      'response_status', v_existing.response_status,
      'response_body', v_existing.response_body
    );
  END IF;

  -- Se expirou o lock de 30s de uma tentativa que caiu/travou, permite retomar
  IF v_existing.status = 'processing' AND v_existing.locked_until < now() THEN
    UPDATE public.api_idempotency_keys
    SET locked_until = now() + interval '30 seconds',
        path = COALESCE(p_path, v_existing.path)
    WHERE tenant_id = p_tenant_id AND idempotency_key = p_idempotency_key;

    RETURN jsonb_build_object('action', 'execute', 'status', 'lock_acquired_after_expiry');
  END IF;

  -- Se ainda está em processamento e não expirou
  RETURN jsonb_build_object(
    'action', 'wait',
    'status', 'in_progress',
    'error', 'Operação ainda em andamento. Aguarde antes de reenviar.'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_api_idempotency_key(
  p_tenant_id TEXT,
  p_idempotency_key TEXT,
  p_response_status INTEGER,
  p_response_body JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.current_is_super_admin_from_auth_uid() THEN
    IF p_tenant_id <> public.current_tenant_id_from_auth_uid() THEN
      RAISE EXCEPTION 'Acesso negado ao tenant especificado.';
    END IF;
  END IF;

  UPDATE public.api_idempotency_keys
  SET status = 'completed',
      response_status = p_response_status,
      response_body = p_response_body,
      locked_until = now()
  WHERE tenant_id = p_tenant_id AND idempotency_key = p_idempotency_key;
END;
$$;
