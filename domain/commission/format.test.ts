import { describe, it, expect } from 'vitest';
import { formatParticipantPayout, formatSavedPayout, formatPayoutValue, formatRatePercent } from './format';
import type { ParticipantRow } from './types';

const makeParticipant = (overrides: Partial<ParticipantRow> = {}): ParticipantRow => ({
  id: 'p1',
  comanda_item_id: 'item1',
  staff_id: 'staff1',
  professional_id: 'staff1',
  role: 'primary',
  payout_type: 'percentage',
  payout_value: 50,
  affects_commission: true,
  ...overrides,
});

describe('formatParticipantPayout', () => {
  it('formats percentage payout', () => {
    const p = makeParticipant({ payout_type: 'percentage', payout_value: 40 });
    expect(formatParticipantPayout(p, 'Marcos')).toBe('Marcos 40%');
  });

  it('formats 100% payout', () => {
    const p = makeParticipant({ payout_type: 'percentage', payout_value: 100 });
    expect(formatParticipantPayout(p, 'Julia')).toBe('Julia 100%');
  });

  it('formats fixed payout', () => {
    const p = makeParticipant({ payout_type: 'fixed', payout_value: 30 });
    expect(formatParticipantPayout(p, 'Ana')).toMatch(/Ana.*30/);
  });

  it('handles zero percentage', () => {
    const p = makeParticipant({ payout_type: 'percentage', payout_value: 0 });
    expect(formatParticipantPayout(p, 'Pedro')).toBe('Pedro 0%');
  });

  it('normalizes rates over 1', () => {
    const p = makeParticipant({ payout_type: 'percentage', payout_value: 50 });
    expect(formatParticipantPayout(p, 'Lucas')).toBe('Lucas 50%');
  });
});

describe('formatSavedPayout', () => {
  it('is an alias for formatParticipantPayout', () => {
    const p = makeParticipant({ payout_type: 'percentage', payout_value: 40 });
    expect(formatSavedPayout(p, 'Marcos')).toBe(formatParticipantPayout(p, 'Marcos'));
  });
});

describe('formatPayoutValue', () => {
  it('formats as currency', () => {
    expect(formatPayoutValue(100)).toMatch(/100/);
  });

  it('formats zero', () => {
    expect(formatPayoutValue(0)).toMatch(/0/);
  });
});

describe('formatRatePercent', () => {
  it('formats 0.5 as 50%', () => {
    expect(formatRatePercent(0.5)).toBe('50%');
  });

  it('formats 0 as 0%', () => {
    expect(formatRatePercent(0)).toBe('0%');
  });

  it('formats 1 as 100%', () => {
    expect(formatRatePercent(1)).toBe('100%');
  });

  it('formats integer rate over 1', () => {
    expect(formatRatePercent(50)).toBe('50%');
  });
});
