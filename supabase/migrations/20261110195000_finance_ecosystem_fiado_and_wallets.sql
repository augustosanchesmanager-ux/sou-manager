-- ============================================================================
-- Migration: 20261110195000_finance_ecosystem_fiado_and_wallets.sql
-- ADR: docs/adr/ADR-045-financial-ecosystem-consolidation.md
-- Description:
--   1. Adiciona marcação explícita de fiado na tabela public.comandas (is_fiado,
--      fiado_marked_at, fiado_marked_by, fiado_due_date, fiado_note).
--   2. Cria as tabelas reais public.client_wallets e public.client_wallet_transactions
--      com RLS multi-tenant e menor privilégio (ADR-003).
--   3. Cria RPC transacional public.mark_comanda_as_fiado (ADR-012 / ADR-021):
--      exige cliente identificado, mantém status = 'open' e NÃO gera receita
--      ou comissão antes da quitação efetiva em Contas a Receber.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Colunas de Fiado explícito em public.comandas
-- ============================================================================

ALTER TABLE public.comandas
  ADD COLUMN IF NOT EXISTS is_fiado BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fiado_marked_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS fiado_marked_by UUID NULL,
  ADD COLUMN IF NOT EXISTS fiado_due_date DATE NULL,
  ADD COLUMN IF NOT EXISTS fiado_note TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_comandas_fiado_open
  ON public.comandas(tenant_id, client_id)
  WHERE status = 'open' AND is_fiado = true;

-- ============================================================================
-- 2. Tabelas reais de Carteira do Cliente (client_wallets + ledger)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.client_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  credit_limit NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (credit_limit >= 0),
  last_movement_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT client_wallets_tenant_client_unique UNIQUE (tenant_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_client_wallets_tenant_client
  ON public.client_wallets(tenant_id, client_id);

ALTER TABLE public.client_wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_wallets_tenant_isolation" ON public.client_wallets;
CREATE POLICY "client_wallets_tenant_isolation" ON public.client_wallets
  FOR ALL TO authenticated
  USING (
    public.current_is_super_admin_from_auth_uid()
    OR tenant_id = public.current_tenant_id_from_auth_uid()
  )
  WITH CHECK (
    public.current_is_super_admin_from_auth_uid()
    OR tenant_id = public.current_tenant_id_from_auth_uid()
  );

REVOKE ALL ON TABLE public.client_wallets FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.client_wallets TO authenticated;

CREATE TABLE IF NOT EXISTS public.client_wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('credit_deposit', 'debit_comanda', 'payment_settlement', 'adjustment')),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  balance_before NUMERIC(12, 2) NOT NULL,
  balance_after NUMERIC(12, 2) NOT NULL,
  comanda_id UUID NULL REFERENCES public.comandas(id) ON DELETE SET NULL,
  payment_method TEXT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL
);

CREATE INDEX IF NOT EXISTS idx_client_wallet_transactions_tenant_client_created
  ON public.client_wallet_transactions(tenant_id, client_id, created_at DESC);

ALTER TABLE public.client_wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_wallet_transactions_tenant_isolation" ON public.client_wallet_transactions;
CREATE POLICY "client_wallet_transactions_tenant_isolation" ON public.client_wallet_transactions
  FOR SELECT TO authenticated
  USING (
    public.current_is_super_admin_from_auth_uid()
    OR tenant_id = public.current_tenant_id_from_auth_uid()
  );

DROP POLICY IF EXISTS "client_wallet_transactions_tenant_insert" ON public.client_wallet_transactions;
CREATE POLICY "client_wallet_transactions_tenant_insert" ON public.client_wallet_transactions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_is_super_admin_from_auth_uid()
    OR tenant_id = public.current_tenant_id_from_auth_uid()
  );

REVOKE ALL ON TABLE public.client_wallet_transactions FROM PUBLIC, anon;
GRANT SELECT, INSERT ON TABLE public.client_wallet_transactions TO authenticated;

-- ============================================================================
-- 3. RPC transacional: mark_comanda_as_fiado
-- ============================================================================

CREATE OR REPLACE FUNCTION public.mark_comanda_as_fiado(
  p_tenant_id UUID,
  p_comanda_id UUID,
  p_due_date DATE DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  v_auth_uid UUID := auth.uid();
  v_has_access BOOLEAN := false;
  v_comanda RECORD;
  v_marked_at TIMESTAMPTZ := now();
  v_clean_note TEXT := NULLIF(btrim(COALESCE(p_note, '')), '');
BEGIN
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF p_tenant_id IS NULL OR p_comanda_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id e comanda_id são obrigatórios';
  END IF;

  v_has_access := public.current_is_super_admin_from_auth_uid()
    OR EXISTS (
      SELECT 1
      FROM public.user_tenants ut
      WHERE ut.user_id = v_auth_uid
        AND ut.tenant_id = p_tenant_id
    )
    OR public.current_tenant_id_from_auth_uid() = p_tenant_id;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'Acesso negado para marcar comanda como fiado neste tenant';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext('mark_comanda_as_fiado:' || p_tenant_id::text || ':' || p_comanda_id::text)
  );

  SELECT * INTO v_comanda
  FROM public.comandas c
  WHERE c.id = p_comanda_id
    AND c.tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comanda não encontrada para este tenant';
  END IF;

  IF v_comanda.status NOT IN ('open', 'blocked') THEN
    RAISE EXCEPTION 'Somente comandas abertas podem ser definidas como fiado (status atual: %)', v_comanda.status;
  END IF;

  IF v_comanda.client_id IS NULL THEN
    RAISE EXCEPTION 'Vincule um cliente identificado antes de definir a comanda como fiado';
  END IF;

  UPDATE public.comandas
  SET
    is_fiado = true,
    fiado_marked_at = COALESCE(fiado_marked_at, v_marked_at),
    fiado_marked_by = COALESCE(fiado_marked_by, v_auth_uid),
    fiado_due_date = COALESCE(p_due_date, fiado_due_date),
    fiado_note = COALESCE(v_clean_note, fiado_note),
    updated_at = v_marked_at
  WHERE id = p_comanda_id
    AND tenant_id = p_tenant_id;

  RETURN jsonb_build_object(
    'success', true,
    'comanda_id', p_comanda_id,
    'client_id', v_comanda.client_id,
    'status', v_comanda.status,
    'is_fiado', true,
    'fiado_marked_at', COALESCE(v_comanda.fiado_marked_at, v_marked_at)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.mark_comanda_as_fiado(UUID, UUID, DATE, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_comanda_as_fiado(UUID, UUID, DATE, TEXT) TO authenticated;

COMMIT;
