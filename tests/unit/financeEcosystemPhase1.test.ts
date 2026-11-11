import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const MIGRATION_PATH = resolve(
  process.cwd(),
  'supabase/migrations/20261110195000_finance_ecosystem_fiado_and_wallets.sql',
);
const QUICK_CHECKOUT_PATH = resolve(
  process.cwd(),
  'components/checkout/QuickCheckoutModal.tsx',
);
const CASH_LEDGER_REPO_PATH = resolve(
  process.cwd(),
  'domain/cashLedger/cashLedgerRepository.ts',
);

const sql = readFileSync(MIGRATION_PATH, 'utf-8');
const quickCheckoutSource = readFileSync(QUICK_CHECKOUT_PATH, 'utf-8');
const cashLedgerSource = readFileSync(CASH_LEDGER_REPO_PATH, 'utf-8');

describe('ADR-045 Phase 1 — Fiado Schema, Wallets RLS & CashLedger Sanitization', () => {
  it('should_add_fiado_columns_and_open_fiado_index_to_comandas', () => {
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS is_fiado BOOLEAN NOT NULL DEFAULT false');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS fiado_marked_at TIMESTAMPTZ NULL');
    expect(sql).toContain('idx_comandas_fiado_open');
    expect(sql).toContain("WHERE status = 'open' AND is_fiado = true");
  });

  it('should_create_client_wallets_and_transactions_tables_with_tenant_rls', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.client_wallets');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.client_wallet_transactions');
    expect(sql).toContain('ALTER TABLE public.client_wallets ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE public.client_wallet_transactions ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('public.current_tenant_id_from_auth_uid()');
    expect(sql).toContain('REVOKE ALL ON TABLE public.client_wallets FROM PUBLIC, anon');
    expect(sql).toContain('REVOKE ALL ON TABLE public.client_wallet_transactions FROM PUBLIC, anon');
  });

  it('should_define_mark_comanda_as_fiado_rpc_with_security_definer_client_guard_and_no_settlement', () => {
    const rpcIdx = sql.indexOf('CREATE OR REPLACE FUNCTION public.mark_comanda_as_fiado');
    const rpcBody = sql.slice(rpcIdx);

    expect(rpcBody).toContain('SECURITY DEFINER');
    expect(rpcBody).toContain("SET search_path = 'public', 'extensions'");
    expect(rpcBody).toContain('IF v_comanda.client_id IS NULL THEN');
    expect(rpcBody).toContain("IF v_comanda.status NOT IN ('open', 'blocked') THEN");
    expect(rpcBody).toContain('is_fiado = true');
    expect(rpcBody).not.toContain('INSERT INTO public.transactions');
    expect(rpcBody).not.toContain("status = 'paid'");
    expect(rpcBody).toContain('REVOKE ALL ON FUNCTION public.mark_comanda_as_fiado(UUID, UUID, DATE, TEXT) FROM PUBLIC, anon;');
    expect(rpcBody).toContain('GRANT EXECUTE ON FUNCTION public.mark_comanda_as_fiado(UUID, UUID, DATE, TEXT) TO authenticated;');
  });

  it('should_mark_comanda_as_fiado_without_settling_in_QuickCheckoutModal_executeChargeToAccount', () => {
    const fnStart = quickCheckoutSource.indexOf('const executeChargeToAccount');
    const fnEnd = quickCheckoutSource.indexOf('const handleConfirmPinAndCharge');
    const fnBody = quickCheckoutSource.slice(fnStart, fnEnd);

    expect(fnBody).toContain('markComandaAsFiado');
    expect(fnBody).not.toContain('settleCheckoutComanda');
    expect(fnBody).not.toContain('triggerAsyncFiscalEmission');
  });

  it('should_guard_demo_seed_fallback_and_use_randomUUID_in_cashLedgerRepository', () => {
    expect(cashLedgerSource).toContain('isDemoOrTestMode');
    expect(cashLedgerSource).toContain('crypto.randomUUID()');
    expect(cashLedgerSource).toContain('if (error) {\n            throw error;\n        }');
  });
});
