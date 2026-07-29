import { describe, it, expect } from 'vitest';
import {
  calculateParticipantPayout,
  calculateParticipantBaseValue,
  calculateCommissionValue,
  resolveCommissionBase,
  isCommissionEligible,
  getEffectiveRate,
  getDefaultRateForRole,
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
    expect(calculateParticipantPayout(100, 1, p)).toBe(0);
  });

  it('calculates percentage payout', () => {
    const p = makeParticipant({ payout_type: 'percentage', payout_value: 50 });
    expect(calculateParticipantPayout(200, 1, p)).toBe(100);
  });

  it('multiplies by quantity', () => {
    const p = makeParticipant({ payout_type: 'percentage', payout_value: 50 });
    expect(calculateParticipantPayout(200, 3, p)).toBe(300);
  });

  it('uses fixed payout value directly', () => {
    const p = makeParticipant({ payout_type: 'fixed', payout_value: 30 });
    expect(calculateParticipantPayout(200, 1, p)).toBe(30);
  });

  it('normalizes percentage values over 1', () => {
    const p = makeParticipant({ payout_type: 'percentage', payout_value: 50 });
    expect(calculateParticipantPayout(200, 1, p)).toBe(100);
  });
});

describe('calculateParticipantBaseValue', () => {
  it('returns fixed payout_value directly', () => {
    const p = makeParticipant({ payout_type: 'fixed', payout_value: 30 });
    expect(calculateParticipantBaseValue(200, p)).toBe(30);
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
    expect(calculateCommissionValue(100, 1, p, 0.5)).toBe(0);
  });

  it('calculates percentage commission', () => {
    const p = makeParticipant({ payout_type: 'percentage', payout_value: 100 });
    expect(calculateCommissionValue(200, 1, p, 0.5)).toBe(100);
  });

  it('calculates fixed commission', () => {
    const p = makeParticipant({ payout_type: 'fixed', payout_value: 50 });
    expect(calculateCommissionValue(200, 1, p, 0.4)).toBe(20);
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

describe('isCommissionEligible', () => {
  it('returns true for barber', () => {
    expect(isCommissionEligible({ role: 'barber' })).toBe(true);
  });

  it('returns true for seller', () => {
    expect(isCommissionEligible({ role: 'seller' })).toBe(true);
  });

  it('returns false for manager', () => {
    expect(isCommissionEligible({ role: 'manager' })).toBe(false);
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
    expect(getEffectiveRate({ role: 'manager', commission_rate: 50 })).toBe(0);
  });

  it('returns normalized rate for eligible staff', () => {
    expect(getEffectiveRate({ role: 'barber', commission_rate: 40 })).toBe(0.4);
  });

  it('normalizes rates over 1', () => {
    expect(getEffectiveRate({ role: 'barber', commission_rate: 50 })).toBe(0.5);
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
