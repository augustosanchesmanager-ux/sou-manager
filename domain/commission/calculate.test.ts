import { describe, it, expect } from 'vitest';
import {
  calculateParticipantPayout,
  calculateParticipantBaseValue,
  calculateCommissionValue,
  resolveCommissionBase,
  resolveFinancialBase,
  isCommissionEligible,
  isProductComandaItem,
  isEligibleForCommissionItem,
  getEffectiveRate,
  getEffectiveItemRate,
  getDefaultRateForRole,
  detectZeroReason,
  calculateCommissionReversal,
} from './calculate';
import type { ParticipantRow } from './types';

const makeParticipant = (overrides: Partial<ParticipantRow> = {}): ParticipantRow => ({
  id: 'p1',
  comanda_item_id: 'item1',
  staff_id: 'staff1',
  professional_id: 'staff1',
  role: 'primary',
  payout_type: 'percentage',
  payout_value: 100,
  affects_commission: true,
  ...overrides,
});

describe('calculateParticipantPayout', () => {
  it('returns 0 when affects_commission is false', () => {
    const p = makeParticipant({ affects_commission: false });
    expect(calculateParticipantPayout(100, p)).toBe(0);
  });

  it('calculates percentage payout', () => {
    const p = makeParticipant({ payout_type: 'percentage', payout_value: 50 });
    expect(calculateParticipantPayout(200, p)).toBe(100);
  });

  it('returns 0 when receivedValue is 0', () => {
    const p = makeParticipant({ payout_type: 'percentage', payout_value: 50 });
    expect(calculateParticipantPayout(0, p)).toBe(0);
  });

  it('uses fixed payout value directly', () => {
    const p = makeParticipant({ payout_type: 'fixed', payout_value: 30 });
    expect(calculateParticipantPayout(200, p)).toBe(30);
  });

  it('caps fixed payout at receivedValue', () => {
    const p = makeParticipant({ payout_type: 'fixed', payout_value: 30 });
    expect(calculateParticipantPayout(20, p)).toBe(20);
  });

  it('normalizes percentage values over 1', () => {
    const p = makeParticipant({ payout_type: 'percentage', payout_value: 50 });
    expect(calculateParticipantPayout(200, p)).toBe(100);
  });
});

describe('calculateParticipantBaseValue', () => {
  it('returns fixed payout_value directly', () => {
    const p = makeParticipant({ payout_type: 'fixed', payout_value: 30 });
    expect(calculateParticipantBaseValue(200, p)).toBe(30);
  });

  it('caps fixed payout at receivedValue', () => {
    const p = makeParticipant({ payout_type: 'fixed', payout_value: 30 });
    expect(calculateParticipantBaseValue(20, p)).toBe(20);
  });

  it('calculates percentage of item value', () => {
    const p = makeParticipant({ payout_type: 'percentage', payout_value: 40 });
    expect(calculateParticipantBaseValue(200, p)).toBe(80);
  });

  it('normalizes rates over 1', () => {
    const p = makeParticipant({ payout_type: 'percentage', payout_value: 40 });
    expect(calculateParticipantBaseValue(100, p)).toBe(40);
  });
});

describe('calculateCommissionValue', () => {
  it('returns 0 when affects_commission is false', () => {
    const p = makeParticipant({ affects_commission: false });
    expect(calculateCommissionValue(100, p, 0.5)).toBe(0);
  });

  it('calculates percentage commission', () => {
    const p = makeParticipant({ payout_type: 'percentage', payout_value: 100 });
    expect(calculateCommissionValue(200, p, 0.5)).toBe(100);
  });

  it('applies commissionRate to fixed co-execution participant base (ADR-047)', () => {
    const p = makeParticipant({ payout_type: 'fixed', payout_value: 50 });
    expect(calculateCommissionValue(200, p, 0.4)).toBe(20);

    // Real-world example (ADR-047): R$ 80 service, assistant fixed base R$ 20, 50% profile rate -> R$ 10.
    const assistant = makeParticipant({ role: 'assistant', payout_type: 'fixed', payout_value: 20 });
    expect(calculateCommissionValue(80, assistant, 50)).toBe(10);
  });

  it('caps fixed base at receivedValue before applying commissionRate', () => {
    const p = makeParticipant({ payout_type: 'fixed', payout_value: 50 });
    expect(calculateCommissionValue(30, p, 0.4)).toBe(12);
  });

  it('returns 0 when receivedValue is 0', () => {
    const p = makeParticipant({ payout_type: 'percentage', payout_value: 100 });
    expect(calculateCommissionValue(0, p, 0.5)).toBe(0);
  });
});

describe('resolveCommissionBase', () => {
  it('prefers unit_price when > 0', () => {
    const item = { unit_price: 100, price: 80, amount: 60 };
    expect(resolveCommissionBase(item)).toEqual({
      value: 100,
      field: 'unit_price',
      reason: expect.any(String),
    });
  });

  it('falls back to price', () => {
    const item = { unit_price: 0, price: 80 };
    expect(resolveCommissionBase(item)).toEqual({
      value: 80,
      field: 'price',
      reason: expect.any(String),
    });
  });

  it('falls back to amount/quantity', () => {
    const item = { unit_price: 0, price: 0, amount: 200, quantity: 4 };
    expect(resolveCommissionBase(item)).toEqual({
      value: 50,
      field: 'amount/quantity',
      reason: expect.any(String),
    });
  });

  it('falls back to amount alone (quantity defaults to 1)', () => {
    const item = { unit_price: 0, price: 0, amount: 150 };
    expect(resolveCommissionBase(item)).toEqual({
      value: 150,
      field: 'amount/quantity',
      reason: expect.any(String),
    });
  });

  it('returns 0 when no value found', () => {
    const item = {};
    expect(resolveCommissionBase(item)).toEqual({
      value: 0,
      field: 'none',
      reason: expect.any(String),
    });
  });
});

describe('resolveFinancialBase', () => {
  it('returns grossValue when no discount or paidAmount', () => {
    const result = resolveFinancialBase({ item: { unit_price: 100 } });
    expect(result.grossValue).toBe(100);
    expect(result.discount).toBe(0);
    expect(result.netValue).toBe(100);
    expect(result.receivedValue).toBe(100);
  });

  it('applies discount to reduce netValue', () => {
    const result = resolveFinancialBase({ item: { unit_price: 100 }, discount: 10 });
    expect(result.grossValue).toBe(100);
    expect(result.discount).toBe(10);
    expect(result.netValue).toBe(90);
    expect(result.receivedValue).toBe(90);
  });

  it('caps discount at grossValue', () => {
    const result = resolveFinancialBase({ item: { unit_price: 100 }, discount: 150 });
    expect(result.discount).toBe(100);
    expect(result.netValue).toBe(0);
  });

  it('uses paidAmount when provided', () => {
    const result = resolveFinancialBase({
      item: { unit_price: 100 },
      discount: 10,
      paidAmount: 45,
    });
    expect(result.netValue).toBe(90);
    expect(result.receivedValue).toBe(45);
  });

  it('handles zero paidAmount (credits/courtesy)', () => {
    const result = resolveFinancialBase({
      item: { unit_price: 100 },
      paidAmount: 0,
    });
    expect(result.receivedValue).toBe(0);
  });

  it('multiplies by quantity', () => {
    const result = resolveFinancialBase({ item: { unit_price: 100 }, quantity: 3 });
    expect(result.grossValue).toBe(300);
    expect(result.receivedValue).toBe(300);
  });

  it('handles zero unit_price (credits)', () => {
    const result = resolveFinancialBase({ item: { unit_price: 0 } });
    expect(result.grossValue).toBe(0);
    expect(result.receivedValue).toBe(0);
  });
});

describe('isCommissionEligible', () => {
  it('returns true for barber', () => {
    expect(isCommissionEligible({ role: 'barber' })).toBe(true);
  });

  it('returns true for seller', () => {
    expect(isCommissionEligible({ role: 'seller' })).toBe(true);
  });

  it('returns true for manager with commission_rate > 0', () => {
    expect(isCommissionEligible({ role: 'manager', commission_rate: 50 })).toBe(true);
  });

  it('returns false for manager without commission_rate', () => {
    expect(isCommissionEligible({ role: 'manager' })).toBe(false);
  });

  it('returns false for manager with commission_rate 0', () => {
    expect(isCommissionEligible({ role: 'manager', commission_rate: 0 })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isCommissionEligible({ role: null })).toBe(false);
  });

  it('is case insensitive', () => {
    expect(isCommissionEligible({ role: 'Barber' })).toBe(true);
  });
});

describe('getEffectiveRate', () => {
  it('returns 0 for non-eligible staff', () => {
    expect(getEffectiveRate({ role: 'receptionist', commission_rate: 50 })).toBe(0);
  });

  it('returns normalized rate for eligible staff', () => {
    expect(getEffectiveRate({ role: 'barber', commission_rate: 40 })).toBe(0.4);
  });

  it('normalizes rates over 1', () => {
    expect(getEffectiveRate({ role: 'barber', commission_rate: 50 })).toBe(0.5);
  });

  it('returns rate for manager with commission_rate > 0', () => {
    expect(getEffectiveRate({ role: 'manager', commission_rate: 50 })).toBe(0.5);
  });

  it('returns 0 for manager without commission_rate', () => {
    expect(getEffectiveRate({ role: 'manager' })).toBe(0);
  });
});

describe('getDefaultRateForRole', () => {
  it('returns 0.5 for barber', () => {
    expect(getDefaultRateForRole('barber')).toBe(0.5);
  });

  it('returns 0.5 for seller', () => {
    expect(getDefaultRateForRole('seller')).toBe(0.5);
  });

  it('returns 0 for manager', () => {
    expect(getDefaultRateForRole('manager')).toBe(0);
  });
});

describe('FIX-001 — Commission scenarios', () => {
  it('full payment: 100 gross, 0 discount, 100 received, 50% rate → 50 commission', () => {
    const base = resolveFinancialBase({ item: { unit_price: 100 }, paidAmount: 100 });
    const p = makeParticipant({ payout_type: 'percentage', payout_value: 100 });
    const commission = calculateCommissionValue(base.receivedValue, p, 0.5);
    expect(commission).toBe(50);
  });

  it('discount: 100 gross, 10 discount, 90 received, 50% rate → 45 commission', () => {
    const base = resolveFinancialBase({ item: { unit_price: 100 }, discount: 10, paidAmount: 90 });
    const p = makeParticipant({ payout_type: 'percentage', payout_value: 100 });
    const commission = calculateCommissionValue(base.receivedValue, p, 0.5);
    expect(commission).toBe(45);
  });

  it('partial payment: 100 gross, 10 discount, 45 received, 50% rate → 22.50 commission', () => {
    const base = resolveFinancialBase({ item: { unit_price: 100 }, discount: 10, paidAmount: 45 });
    const p = makeParticipant({ payout_type: 'percentage', payout_value: 100 });
    const commission = calculateCommissionValue(base.receivedValue, p, 0.5);
    expect(commission).toBe(22.5);
  });

  it('zero payment: 100 gross, 0 received → 0 commission', () => {
    const base = resolveFinancialBase({ item: { unit_price: 100 }, paidAmount: 0 });
    const p = makeParticipant({ payout_type: 'percentage', payout_value: 100 });
    const commission = calculateCommissionValue(base.receivedValue, p, 0.5);
    expect(commission).toBe(0);
  });

  it('split 50/50: 100 received, 50% each, 50% rate → 25 each', () => {
    const base = resolveFinancialBase({ item: { unit_price: 100 }, paidAmount: 100 });
    const p1 = makeParticipant({ payout_type: 'percentage', payout_value: 50 });
    const p2 = makeParticipant({ id: 'p2', staff_id: 'staff2', professional_id: 'staff2', payout_type: 'percentage', payout_value: 50 });
    const c1 = calculateCommissionValue(base.receivedValue, p1, 0.5);
    const c2 = calculateCommissionValue(base.receivedValue, p2, 0.5);
    expect(c1).toBe(25);
    expect(c2).toBe(25);
  });

  it('manager operational: 100 received, manager with 50% rate → 50 commission', () => {
    const base = resolveFinancialBase({ item: { unit_price: 100 }, paidAmount: 100 });
    const p = makeParticipant({ payout_type: 'percentage', payout_value: 100 });
    const commission = calculateCommissionValue(base.receivedValue, p, 0.5);
    expect(commission).toBe(50);
  });

  it('manager with rate 0: 100 received, manager with 0% rate → 0 commission', () => {
    const base = resolveFinancialBase({ item: { unit_price: 100 }, paidAmount: 100 });
    const p = makeParticipant({ payout_type: 'percentage', payout_value: 100 });
    const commission = calculateCommissionValue(base.receivedValue, p, 0);
    expect(commission).toBe(0);
  });

  it('credits: unit_price 0 → 0 commission with reason preserved', () => {
    const base = resolveFinancialBase({ item: { unit_price: 0 }, paidAmount: 0 });
    expect(base.receivedValue).toBe(0);
    expect(base.source).toBe('none');
    const p = makeParticipant({ payout_type: 'percentage', payout_value: 100 });
    const commission = calculateCommissionValue(base.receivedValue, p, 0.5);
    expect(commission).toBe(0);
  });

  it('split with partial payment: 100 gross, 10 discount, 45 received, 70/30 split', () => {
    const base = resolveFinancialBase({ item: { unit_price: 100 }, discount: 10, paidAmount: 45 });
    const p1 = makeParticipant({ payout_type: 'percentage', payout_value: 70 });
    const p2 = makeParticipant({ id: 'p2', staff_id: 'staff2', professional_id: 'staff2', payout_type: 'percentage', payout_value: 30 });
    const c1 = calculateCommissionValue(base.receivedValue, p1, 0.5);
    const c2 = calculateCommissionValue(base.receivedValue, p2, 0.5);
    expect(c1).toBeCloseTo(15.75, 2);
    expect(c2).toBeCloseTo(6.75, 2);
  });

  // ── QAT-C04: detectZeroReason (7 scenarios) ──────────────────────

  describe('detectZeroReason', () => {
    it('clube_do_chefe: unit_price=0 + credit_effect → clube_do_chefe', () => {
      expect(detectZeroReason(0, 0, 0, 0, true)).toBe('clube_do_chefe');
    });

    it('cortesia: unit_price=0 + no credit effect → cortesia', () => {
      expect(detectZeroReason(0, 0, 0, 0, false)).toBe('cortesia');
    });

    it('desconto_integral: discount >= grossValue → desconto_integral', () => {
      expect(detectZeroReason(50, 50, 0, 50, false)).toBe('desconto_integral');
    });

    it('comanda_nao_paga: paidAmount=0, no discount, no credit → comanda_nao_paga', () => {
      expect(detectZeroReason(80, 80, 0, 0, false)).toBe('comanda_nao_paga');
    });

    it('normal payment: paidAmount>0 → null (not zero)', () => {
      expect(detectZeroReason(100, 100, 100, 0, false)).toBeNull();
    });

    it('partial payment: paidAmount>0 → null (not zero)', () => {
      expect(detectZeroReason(100, 100, 50, 0, false)).toBeNull();
    });

    it('all zeros, no credit → cortesia (first matching branch)', () => {
      expect(detectZeroReason(0, 0, 0, 0, false)).toBe('cortesia');
    });
  });

  // ── QAT-C01+C02: calculateCommissionReversal ─────────────────────

  describe('calculateCommissionReversal', () => {
    it('integral reversal: 100% reversed → full commission back', () => {
      const reversal = calculateCommissionReversal(25, 100, 100);
      expect(reversal).toBe(25);
    });

    it('partial reversal: 50% reversed → proportional commission', () => {
      const reversal = calculateCommissionReversal(25, 50, 100);
      expect(reversal).toBeCloseTo(12.5, 2);
    });

    it('partial reversal: 30% reversed → proportional commission', () => {
      const reversal = calculateCommissionReversal(25, 30, 100);
      expect(reversal).toBeCloseTo(7.5, 2);
    });

    it('reversal capped at original commission', () => {
      const reversal = calculateCommissionReversal(25, 200, 100);
      expect(reversal).toBe(25);
    });

    it('zero originalReceivedValue → 0', () => {
      expect(calculateCommissionReversal(25, 100, 0)).toBe(0);
    });

    it('zero reversedAmount → 0', () => {
      expect(calculateCommissionReversal(25, 0, 100)).toBe(0);
    });

    it('negative reversedAmount → 0', () => {
      expect(calculateCommissionReversal(25, -10, 100)).toBe(0);
    });
  });

  describe('ADR-047: product vs service item classification & rate selection', () => {
    it('should_classify_as_product_when_product_id_or_name_without_service_id', () => {
      expect(isProductComandaItem({ product_id: 'prod-1', service_id: null })).toBe(true);
      expect(isProductComandaItem({ service_id: null, product_name: 'Pomada' })).toBe(true);
      expect(isProductComandaItem({ service_id: 'svc-1', product_name: 'Corte' })).toBe(false);
      // Legacy minimal fixtures with no service_id, product_id, or product_name remain services.
      expect(isProductComandaItem({ service_id: null })).toBe(false);
    });

    it('should_apply_product_commission_rate_only_to_products_and_commission_rate_to_services', () => {
      const barberNoProduct = { role: 'barber', commission_rate: 50, product_commission_rate: 0 };
      const barberWithProduct = { role: 'barber', commission_rate: 50, product_commission_rate: 10 };
      const managerProductOnly = { role: 'manager', commission_rate: 0, product_commission_rate: 15 };

      const serviceItem = { service_id: 'svc-1', product_id: null };
      const productItem = { service_id: null, product_id: 'prod-1' };

      expect(getEffectiveItemRate(barberNoProduct, serviceItem)).toBeCloseTo(0.5, 6);
      expect(getEffectiveItemRate(barberNoProduct, productItem)).toBe(0);
      expect(getEffectiveItemRate(barberWithProduct, productItem)).toBeCloseTo(0.1, 6);
      expect(isEligibleForCommissionItem(managerProductOnly, productItem)).toBe(true);
      expect(getEffectiveItemRate(managerProductOnly, productItem)).toBeCloseTo(0.15, 6);
      expect(getEffectiveItemRate(managerProductOnly, serviceItem)).toBe(0);
    });
  });
});
