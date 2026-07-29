import { describe, it, expect } from 'vitest';
import {
  isSharedExecution,
  buildSoloParticipant,
  hasPartialSavedPayout,
  buildInferredPrimaryParticipant,
  normalizeCommissionParticipants,
  getPrimaryParticipant,
  getAssistantParticipants,
} from './participants';
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

const makeStaff = (id: string, role = 'barber', commissionRate = 50) => ({
  id,
  role,
  commission_rate: commissionRate,
});

describe('isSharedExecution', () => {
  it('returns false for empty participants', () => {
    expect(isSharedExecution({ service_id: 's1' }, [])).toBe(false);
  });

  it('returns false for undefined participants', () => {
    expect(isSharedExecution({ service_id: 's1' }, undefined)).toBe(false);
  });

  it('returns false for single participant with 100% payout', () => {
    const p = makeParticipant({ payout_value: 100 });
    expect(isSharedExecution({ service_id: 's1' }, [p])).toBe(false);
  });

  it('returns true for single participant with partial payout', () => {
    const p = makeParticipant({ payout_value: 50 });
    expect(isSharedExecution({ service_id: 's1' }, [p])).toBe(true);
  });

  it('returns true for multiple participants', () => {
    const p1 = makeParticipant({ id: 'p1', staff_id: 's1', payout_value: 60 });
    const p2 = makeParticipant({ id: 'p2', staff_id: 's2', payout_value: 40 });
    expect(isSharedExecution({ service_id: 's1' }, [p1, p2])).toBe(true);
  });

  it('ignores non-commissionable participants', () => {
    const p = makeParticipant({ affects_commission: false, payout_value: 50 });
    expect(isSharedExecution({ service_id: 's1' }, [p])).toBe(false);
  });
});

describe('buildSoloParticipant', () => {
  it('creates a 100% primary participant', () => {
    const p = buildSoloParticipant('item1', 'staff1');
    expect(p).toEqual({
      id: 'solo-item1',
      comanda_item_id: 'item1',
      staff_id: 'staff1',
      professional_id: 'staff1',
      role: 'primary',
      payout_type: 'percentage',
      payout_value: 100,
      affects_commission: true,
    });
  });
});

describe('hasPartialSavedPayout', () => {
  it('returns false for non-commissionable participant', () => {
    const p = makeParticipant({ affects_commission: false });
    expect(hasPartialSavedPayout(p, 100)).toBe(false);
  });

  it('returns true for partial percentage', () => {
    const p = makeParticipant({ payout_value: 60 });
    expect(hasPartialSavedPayout(p, 100)).toBe(true);
  });

  it('returns false for 100% payout', () => {
    const p = makeParticipant({ payout_value: 100 });
    expect(hasPartialSavedPayout(p, 100)).toBe(false);
  });

  it('returns false for 0% payout', () => {
    const p = makeParticipant({ payout_value: 0 });
    expect(hasPartialSavedPayout(p, 100)).toBe(false);
  });
});

describe('buildInferredPrimaryParticipant', () => {
  it('infers primary when remaining > 0', () => {
    const staffMap = new Map([
      ['staff1', makeStaff('staff1', 'barber', 50)],
      ['staff2', makeStaff('staff2', 'barber', 50)],
    ]);
    const saved = [makeParticipant({ staff_id: 'staff1', payout_value: 60 })];
    const inferred = buildInferredPrimaryParticipant('item1', saved, staffMap);
    expect(inferred).not.toBeNull();
    expect(inferred!.staff_id).toBe('staff2');
    expect(inferred!.payout_value).toBeCloseTo(40);
  });

  it('returns null when no remaining', () => {
    const staffMap = new Map([
      ['staff1', makeStaff('staff1', 'barber', 50)],
    ]);
    const saved = [makeParticipant({ staff_id: 'staff1', payout_value: 100 })];
    expect(buildInferredPrimaryParticipant('item1', saved, staffMap)).toBeNull();
  });

  it('skips non-commissionable staff', () => {
    const staffMap = new Map([
      ['staff1', makeStaff('staff1', 'barber', 50)],
      ['staff2', makeStaff('staff2', 'manager', 0)],
    ]);
    const saved = [makeParticipant({ staff_id: 'staff1', payout_value: 60 })];
    expect(buildInferredPrimaryParticipant('item1', saved, staffMap)).toBeNull();
  });
});

describe('normalizeCommissionParticipants', () => {
  const staffMap = new Map([
    ['staff1', makeStaff('staff1', 'barber', 50)],
    ['staff2', makeStaff('staff2', 'barber', 40)],
    ['manager1', makeStaff('manager1', 'manager', 0)],
  ]);

  it('returns solo participant when no raw participants', () => {
    const result = normalizeCommissionParticipants(
      { id: 'item1', staff_id: 'staff1' },
      { staff_id: 'staff1' },
      [],
      100,
      staffMap,
    );
    expect(result.participants).toHaveLength(1);
    expect(result.isShared).toBe(false);
    expect(result.primaryStaffId).toBe('staff1');
  });

  it('returns empty when no staff and no raw participants', () => {
    const result = normalizeCommissionParticipants(
      { id: 'item1' },
      {},
      [],
      100,
      staffMap,
    );
    expect(result.participants).toHaveLength(0);
    expect(result.isShared).toBe(false);
    expect(result.primaryStaffId).toBeNull();
  });

  it('deduplicates by staff_id, preferring primary', () => {
    const raw = [
      makeParticipant({ id: 'p1', staff_id: 'staff1', role: 'assistant', payout_value: 30 }),
      makeParticipant({ id: 'p2', staff_id: 'staff1', role: 'primary', payout_value: 70 }),
    ];
    const result = normalizeCommissionParticipants(
      { id: 'item1', staff_id: 'staff1' },
      { staff_id: 'staff1' },
      raw,
      100,
      staffMap,
    );
    expect(result.participants).toHaveLength(1);
    expect(result.participants[0].role).toBe('primary');
  });

  it('filters non-commissionable staff', () => {
    const raw = [
      makeParticipant({ id: 'p1', staff_id: 'manager1', role: 'primary', payout_value: 100 }),
    ];
    const result = normalizeCommissionParticipants(
      { id: 'item1', staff_id: 'staff1' },
      { staff_id: 'staff1' },
      raw,
      100,
      staffMap,
    );
    expect(result.participants).toHaveLength(1);
    expect(result.participants[0].staff_id).toBe('staff1');
  });

  it('detects shared when multiple commissionable staff', () => {
    const raw = [
      makeParticipant({ id: 'p1', staff_id: 'staff1', role: 'primary', payout_value: 60 }),
      makeParticipant({ id: 'p2', staff_id: 'staff2', role: 'assistant', payout_value: 40 }),
    ];
    const result = normalizeCommissionParticipants(
      { id: 'item1', staff_id: 'staff1' },
      { staff_id: 'staff1' },
      raw,
      100,
      staffMap,
    );
    expect(result.isShared).toBe(true);
    expect(result.participants).toHaveLength(2);
  });
});

describe('getPrimaryParticipant', () => {
  it('finds primary commissionable participant', () => {
    const p1 = makeParticipant({ role: 'assistant' });
    const p2 = makeParticipant({ id: 'p2', role: 'primary' });
    expect(getPrimaryParticipant([p1, p2])).toBe(p2);
  });

  it('ignores non-commissionable primary', () => {
    const p = makeParticipant({ role: 'primary', affects_commission: false });
    expect(getPrimaryParticipant([p])).toBeUndefined();
  });
});

describe('getAssistantParticipants', () => {
  it('returns assistants and co-executors', () => {
    const p1 = makeParticipant({ id: 'p1', role: 'primary' });
    const p2 = makeParticipant({ id: 'p2', role: 'assistant' });
    const p3 = makeParticipant({ id: 'p3', role: 'co_executor' });
    const result = getAssistantParticipants([p1, p2, p3]);
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.id)).toEqual(['p2', 'p3']);
  });

  it('excludes non-commissionable', () => {
    const p = makeParticipant({ role: 'assistant', affects_commission: false });
    expect(getAssistantParticipants([p])).toHaveLength(0);
  });
});
