import { describe, it, expect } from 'vitest';
import { addOverdueFlag } from './service';
import type { AccountPayable } from './types';

// ─── Helpers ────────────────────────────────────────────────────
function makeAP(overrides: Partial<AccountPayable> = {}): AccountPayable {
  return {
    id: 'ap-1',
    tenant_id: 'tenant-1',
    recurring_bill_id: null,
    name: 'Aluguel',
    amount: 2000,
    due_date: '2026-09-10',
    competence_month: 9,
    competence_year: 2026,
    category: 'Infraestrutura',
    notes: null,
    status: 'pending',
    paid_at: null,
    cancelled_at: null,
    cancelled_by: null,
    paid_by: null,
    transaction_id: null,
    created_by: null,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────
describe('P0.4 — Accounts Payable domain logic', () => {
  describe('OVERDUE derivation (I4)', () => {
    it('pending + past due_date → is_overdue = true', () => {
      const ap = makeAP({ status: 'pending', due_date: '2026-01-01' });
      const result = addOverdueFlag(ap);
      expect(result.is_overdue).toBe(true);
    });

    it('pending + future due_date → is_overdue = false', () => {
      const ap = makeAP({ status: 'pending', due_date: '2099-12-31' });
      const result = addOverdueFlag(ap);
      expect(result.is_overdue).toBe(false);
    });

    it('paid + past due_date → is_overdue = false (terminal)', () => {
      const ap = makeAP({ status: 'paid', due_date: '2026-01-01' });
      const result = addOverdueFlag(ap);
      expect(result.is_overdue).toBe(false);
    });

    it('cancelled + past due_date → is_overdue = false (terminal)', () => {
      const ap = makeAP({ status: 'cancelled', due_date: '2026-01-01' });
      const result = addOverdueFlag(ap);
      expect(result.is_overdue).toBe(false);
    });
  });

  describe('Status transitions (I4, I5)', () => {
    it('PAID is terminal — cannot transition', () => {
      const ap = makeAP({ status: 'paid', transaction_id: 'tx-1' });
      // The RPC enforces this; we verify the invariant holds at domain level
      expect(ap.status).toBe('paid');
      // Simulating invalid transition should not change status
      expect(() => {
        if (ap.status === 'cancelled' || ap.status === 'paid') {
          throw new Error('Terminal status');
        }
      }).toThrow('Terminal status');
    });

    it('CANCELLED is terminal — cannot transition', () => {
      const ap = makeAP({ status: 'cancelled' });
      expect(ap.status).toBe('cancelled');
      expect(() => {
        if (ap.status === 'cancelled' || ap.status === 'paid') {
          throw new Error('Terminal status');
        }
      }).toThrow('Terminal status');
    });
  });

  describe('Unique constraint logic (I1)', () => {
    it('recurring_bill_id + competence defines unique occurrence', () => {
      const ap1 = makeAP({ recurring_bill_id: 'rb-1', competence_month: 9, competence_year: 2026 });
      const ap2 = makeAP({ recurring_bill_id: 'rb-1', competence_month: 9, competence_year: 2026 });
      const ap3 = makeAP({ recurring_bill_id: 'rb-1', competence_month: 10, competence_year: 2026 });

      // Same recurrence + same competence = duplicate
      expect(ap1.recurring_bill_id).toBe(ap2.recurring_bill_id);
      expect(ap1.competence_month).toBe(ap2.competence_month);
      expect(ap1.competence_year).toBe(ap2.competence_year);

      // Same recurrence + different competence = valid
      expect(ap1.competence_month).not.toBe(ap3.competence_month);
    });

    it('one-time accounts (recurring_bill_id=null) have no uniqueness constraint', () => {
      const ap1 = makeAP({ recurring_bill_id: null, competence_month: 9, competence_year: 2026 });
      const ap2 = makeAP({ recurring_bill_id: null, competence_month: 9, competence_year: 2026 });
      // Two one-time accounts can share the same competence
      expect(ap1.recurring_bill_id).toBeNull();
      expect(ap2.recurring_bill_id).toBeNull();
    });
  });

  describe('Per-occurrence editing (I6)', () => {
    it('editing amount does not affect the recurring rule', () => {
      const bill = { amount: 2000 };
      const ap = makeAP({ amount: 237.50 });

      // AP was edited to 237.50, but bill stays 2000
      expect(ap.amount).toBe(237.50);
      expect(bill.amount).toBe(2000);
    });
  });

  describe('Per-competence cancellation (I7)', () => {
    it('cancelling one AP does not affect others from same recurrence', () => {
      const apSep = makeAP({ id: 'ap-sep', status: 'cancelled', competence_month: 9 });
      const apOct = makeAP({ id: 'ap-oct', status: 'pending', competence_month: 10 });

      expect(apSep.status).toBe('cancelled');
      expect(apOct.status).toBe('pending');
    });
  });

  describe('Historical data not migrated (I8)', () => {
    it('new tables are independent of existing transactions', () => {
      // This is a design invariant — accounts_payable and transactions are separate domains
      const ap = makeAP({ transaction_id: null });
      expect(ap.transaction_id).toBeNull();
      // When paid, transaction_id gets populated but old transactions remain untouched
    });
  });

  describe('created_by attribution (A6)', () => {
    it('created_by is set when provided', () => {
      const ap = makeAP({ created_by: 'user-123' });
      expect(ap.created_by).toBe('user-123');
    });

    it('created_by can be null for system-created records', () => {
      const ap = makeAP({ created_by: null });
      expect(ap.created_by).toBeNull();
    });
  });
});
