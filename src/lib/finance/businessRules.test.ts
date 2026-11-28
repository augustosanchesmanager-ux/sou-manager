import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DEFAULT_TENANT_BUSINESS_RULES,
  resolveTenantBusinessRules,
  deriveComandaPaymentState,
  getTenantBusinessRules,
  upsertTenantBusinessRules,
} from './businessRules';
import { settleComandaSplit } from './settlement';

describe('ADR-059 Fase A — businessRules & settleComandaSplit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('resolveTenantBusinessRules', () => {
    it('should_return_canonical_defaults_when_raw_settings_is_empty', () => {
      const rules = resolveTenantBusinessRules(null);
      expect(rules).toEqual(DEFAULT_TENANT_BUSINESS_RULES);
    });

    it('should_merge_valid_overrides_and_sanitize_invalid_values', () => {
      const rules = resolveTenantBusinessRules(
        {
          partial_payment_commission_policy: 'only_on_full_settlement',
          default_product_commission_rate: 150,
          default_fiado_due_days: 30,
          overdue_open_comanda_policy: 'invalid_policy',
          allow_split_payment: false,
          require_manager_pin_rules: {
            refund: true,
            zero_close: false,
            discount_above_pct: 15,
          },
        },
        'pix',
      );

      expect(rules.partial_payment_commission_policy).toBe('only_on_full_settlement');
      expect(rules.default_product_commission_rate).toBe(100);
      expect(rules.default_fiado_due_days).toBe(30);
      expect(rules.overdue_open_comanda_policy).toBe('auto_pending_payment');
      expect(rules.allow_split_payment).toBe(false);
      expect(rules.refund_method).toBe('pix');
      expect(rules.require_manager_pin_rules).toEqual({
        refund: true,
        zero_close: false,
        discount_above_pct: 15,
      });
    });
  });

  describe('deriveComandaPaymentState', () => {
    it('should_return_open_when_unpaid_comanda_is_from_today', () => {
      const state = deriveComandaPaymentState({
        status: 'open',
        total: 100,
        totalPaid: 0,
        serviceDate: '2026-11-27T14:00:00-03:00',
        todayDateKeyBrt: '2026-11-27',
      });
      expect(state).toBe('open');
    });

    it('should_return_partially_paid_when_partial_payment_made_today', () => {
      const state = deriveComandaPaymentState({
        status: 'open',
        total: 100,
        totalPaid: 50,
        serviceDate: '2026-11-27T14:00:00-03:00',
        todayDateKeyBrt: '2026-11-27',
      });
      expect(state).toBe('partially_paid');
    });

    it('should_return_pending_payment_when_unpaid_comanda_crossed_day_boundary', () => {
      const state = deriveComandaPaymentState({
        status: 'open',
        total: 100,
        totalPaid: 0,
        serviceDate: '2026-11-26T18:00:00-03:00',
        todayDateKeyBrt: '2026-11-27',
      });
      expect(state).toBe('pending_payment');
    });

    it('should_return_pending_payment_when_partial_comanda_crossed_day_boundary', () => {
      const state = deriveComandaPaymentState({
        status: 'open',
        total: 100,
        totalPaid: 40,
        serviceDate: '2026-11-26T18:00:00-03:00',
        todayDateKeyBrt: '2026-11-27',
      });
      expect(state).toBe('pending_payment');
    });

    it('should_return_fiado_when_explicitly_marked_as_fiado', () => {
      const state = deriveComandaPaymentState({
        status: 'open',
        isFiado: true,
        total: 100,
        totalPaid: 0,
        serviceDate: '2026-11-20T18:00:00-03:00',
        todayDateKeyBrt: '2026-11-27',
      });
      expect(state).toBe('fiado');
    });

    it('should_respect_manual_overdue_policy_when_not_marked_pending', () => {
      const state = deriveComandaPaymentState({
        status: 'open',
        total: 100,
        totalPaid: 40,
        serviceDate: '2026-11-26T18:00:00-03:00',
        todayDateKeyBrt: '2026-11-27',
        overduePolicy: 'manual',
      });
      expect(state).toBe('partially_paid');
    });
  });

  describe('RPC wrappers', () => {
    it('should_fallback_to_defaults_when_rpc_not_yet_deployed', async () => {
      const supabase = {
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST202', message: 'function does not exist' },
        }),
      };

      const rules = await getTenantBusinessRules({ tenantId: 'tenant-1', supabase });
      expect(rules).toEqual(DEFAULT_TENANT_BUSINESS_RULES);
    });

    it('should_upsert_business_rules_and_return_resolved_config', async () => {
      const supabase = {
        rpc: vi.fn().mockResolvedValue({
          data: {
            success: true,
            refund_method: 'pix',
            business_rules: {
              partial_payment_commission_policy: 'only_on_full_settlement',
              refund_method: 'pix',
            },
            message: 'Regras de negocio atualizadas com sucesso.',
          },
          error: null,
        }),
      };

      const res = await upsertTenantBusinessRules({
        tenantId: 'tenant-1',
        rules: { partial_payment_commission_policy: 'only_on_full_settlement', refund_method: 'pix' },
        supabase,
      });

      expect(res.success).toBe(true);
      expect(res.rules.partial_payment_commission_policy).toBe('only_on_full_settlement');
      expect(res.rules.refund_method).toBe('pix');
    });

    it('should_settle_comanda_with_multiple_split_payments', async () => {
      const supabase = {
        rpc: vi.fn().mockResolvedValue({
          data: {
            success: true,
            idempotent: false,
            comanda_id: 'cmd-1',
            status: 'paid',
            transaction_id: 'tx-1',
            transaction_ids: ['tx-1', 'tx-2'],
            comanda_payment_ids: ['cp-1', 'cp-2'],
            total_paid: 100,
            remaining: 0,
            message: 'Comanda quitada com sucesso.',
          },
          error: null,
        }),
      };

      const res = await settleComandaSplit({
        tenantId: 'tenant-1',
        comandaId: 'cmd-1',
        supabase,
        payments: [
          { amount: 60, paymentMethod: 'pix' },
          { amount: 40, paymentMethod: 'credit', terminalId: 'term-1', feePercentage: 2.5, feeAmount: 1, netAmount: 39 },
        ],
      });

      expect(res.success).toBe(true);
      expect(res.status).toBe('paid');
      expect(res.transactionIds).toEqual(['tx-1', 'tx-2']);
      expect(res.comandaPaymentIds).toEqual(['cp-1', 'cp-2']);
      expect(res.remaining).toBe(0);
    });

    it('should_reject_split_payment_when_any_amount_is_non_positive', async () => {
      const supabase = { rpc: vi.fn() };
      await expect(
        settleComandaSplit({
          tenantId: 'tenant-1',
          comandaId: 'cmd-1',
          supabase,
          payments: [{ amount: 0, paymentMethod: 'pix' }],
        }),
      ).rejects.toThrow('Cada parcela deve ter valor maior que zero.');
      expect(supabase.rpc).not.toHaveBeenCalled();
    });
  });
});
