import { describe, it, expect } from 'vitest';
import {
  normalizePlanServiceCredits,
  normalizeCreditBalances,
  normalizeServiceBalanceEntry,
  getTotalPlannedCredits,
  getTotalAvailableCredits,
  getTotalUsedCredits,
  getAvailableCreditsForService,
  getPlanCreditsForService,
  buildServiceBalancesFromPlan,
  canApplyCredit,
} from './credits';
import type { ServiceCreditsEntry, ServiceBalanceEntry } from './credits';

describe('normalizePlanServiceCredits', () => {
  it('normalizes array of entries', () => {
    const input = [
      { service_id: 's1', service_name: 'Corte', credits: 5 },
      { service_id: 's2', service_name: 'Barba', credits: 3 },
    ];
    const result = normalizePlanServiceCredits(input);
    expect(result).toHaveLength(2);
    expect(result[0].service_id).toBe('s1');
    expect(result[0].credits).toBe(5);
  });

  it('filters entries with 0 credits', () => {
    const input = [
      { service_id: 's1', service_name: 'Corte', credits: 0 },
      { service_id: 's2', service_name: 'Barba', credits: 3 },
    ];
    expect(normalizePlanServiceCredits(input)).toHaveLength(1);
  });

  it('filters entries without service_id', () => {
    const input = [
      { service_id: '', service_name: 'Corte', credits: 5 },
    ];
    expect(normalizePlanServiceCredits(input)).toHaveLength(0);
  });

  it('handles object format', () => {
    const input = {
      s1: { service_name: 'Corte', credits: 5 },
    };
    const result = normalizePlanServiceCredits(input);
    expect(result).toHaveLength(1);
    expect(result[0].service_id).toBe('s1');
  });

  it('handles legacy scalar fallback', () => {
    const result = normalizePlanServiceCredits(null, 10);
    expect(result).toHaveLength(1);
    expect(result[0].credits).toBe(10);
    expect(result[0].service_name).toBe('Credito geral');
  });

  it('returns empty for null with no fallback', () => {
    expect(normalizePlanServiceCredits(null, 0)).toHaveLength(0);
  });

  it('handles camelCase field names', () => {
    const input = [
      { serviceId: 's1', serviceName: 'Corte', credits: 5 },
    ];
    const result = normalizePlanServiceCredits(input);
    expect(result).toHaveLength(1);
    expect(result[0].service_id).toBe('s1');
  });
});

describe('normalizeCreditBalances', () => {
  it('normalizes array of balance entries', () => {
    const input = [
      { service_id: 's1', service_name: 'Corte', available: 5, used: 2 },
    ];
    const result = normalizeCreditBalances(input);
    expect(result).toHaveLength(1);
    expect(result[0].available).toBe(5);
    expect(result[0].used).toBe(2);
  });

  it('handles object format', () => {
    const input = {
      s1: { service_name: 'Corte', available: 5, used: 1 },
    };
    const result = normalizeCreditBalances(input);
    expect(result).toHaveLength(1);
  });

  it('returns fallback for null', () => {
    const result = normalizeCreditBalances(null, 10, 3);
    expect(result).toHaveLength(1);
    expect(result[0].available).toBe(10);
    expect(result[0].used).toBe(3);
  });

  it('returns empty when fallbacks are zero', () => {
    expect(normalizeCreditBalances(null, 0, 0)).toHaveLength(0);
  });
});

describe('normalizeServiceBalanceEntry', () => {
  it('normalizes a valid entry', () => {
    const result = normalizeServiceBalanceEntry({
      service_id: 's1', service_name: 'Corte', available: 5, used: 2,
    });
    expect(result).toEqual({
      service_id: 's1', service_name: 'Corte', available: 5, used: 2,
    });
  });

  it('returns null for non-record', () => {
    expect(normalizeServiceBalanceEntry(null)).toBeNull();
    expect(normalizeServiceBalanceEntry('string')).toBeNull();
  });

  it('returns null when no service_id', () => {
    expect(normalizeServiceBalanceEntry({ service_name: 'Corte', available: 5 })).toBeNull();
  });

  it('returns null when available=0 and used=0', () => {
    expect(normalizeServiceBalanceEntry({
      service_id: 's1', service_name: 'Corte', available: 0, used: 0,
    })).toBeNull();
  });
});

describe('getTotalPlannedCredits', () => {
  it('sums credits', () => {
    const entries: ServiceCreditsEntry[] = [
      { service_id: 's1', service_name: 'Corte', credits: 5 },
      { service_id: 's2', service_name: 'Barba', credits: 3 },
    ];
    expect(getTotalPlannedCredits(entries)).toBe(8);
  });

  it('returns 0 for empty', () => {
    expect(getTotalPlannedCredits([])).toBe(0);
  });
});

describe('getTotalAvailableCredits', () => {
  it('sums available', () => {
    const entries: ServiceBalanceEntry[] = [
      { service_id: 's1', service_name: 'Corte', available: 5, used: 2 },
      { service_id: 's2', service_name: 'Barba', available: 3, used: 1 },
    ];
    expect(getTotalAvailableCredits(entries)).toBe(8);
  });
});

describe('getTotalUsedCredits', () => {
  it('sums used', () => {
    const entries: ServiceBalanceEntry[] = [
      { service_id: 's1', service_name: 'Corte', available: 5, used: 2 },
      { service_id: 's2', service_name: 'Barba', available: 3, used: 1 },
    ];
    expect(getTotalUsedCredits(entries)).toBe(3);
  });
});

describe('getAvailableCreditsForService', () => {
  const entries: ServiceBalanceEntry[] = [
    { service_id: 's1', service_name: 'Corte', available: 5, used: 2 },
    { service_id: '', service_name: 'Geral', available: 10, used: 0 },
  ];

  it('returns exact match', () => {
    expect(getAvailableCreditsForService(entries, 's1')).toBe(5);
  });

  it('falls back to generic entry', () => {
    expect(getAvailableCreditsForService(entries, 'unknown')).toBe(10);
  });

  it('returns 0 when no match and no generic', () => {
    const noGeneric: ServiceBalanceEntry[] = [
      { service_id: 's1', service_name: 'Corte', available: 5, used: 2 },
    ];
    expect(getAvailableCreditsForService(noGeneric, 'unknown')).toBe(0);
  });
});

describe('getPlanCreditsForService', () => {
  const entries: ServiceCreditsEntry[] = [
    { service_id: 's1', service_name: 'Corte', credits: 5 },
    { service_id: '', service_name: 'Geral', credits: 10 },
  ];

  it('returns exact match', () => {
    expect(getPlanCreditsForService(entries, 's1')).toBe(5);
  });

  it('falls back to generic', () => {
    expect(getPlanCreditsForService(entries, 'unknown')).toBe(10);
  });
});

describe('buildServiceBalancesFromPlan', () => {
  it('converts plan to balances with available=credits, used=0', () => {
    const plan: ServiceCreditsEntry[] = [
      { service_id: 's1', service_name: 'Corte', credits: 5 },
    ];
    const result = buildServiceBalancesFromPlan(plan);
    expect(result).toHaveLength(1);
    expect(result[0].available).toBe(5);
    expect(result[0].used).toBe(0);
  });

  it('filters entries with 0 credits', () => {
    const plan: ServiceCreditsEntry[] = [
      { service_id: 's1', service_name: 'Corte', credits: 0 },
    ];
    expect(buildServiceBalancesFromPlan(plan)).toHaveLength(0);
  });
});

describe('canApplyCredit', () => {
  const balances: ServiceBalanceEntry[] = [
    { service_id: 's1', service_name: 'Corte', available: 5, used: 2 },
  ];

  it('returns true when credits available and used < available', () => {
    expect(canApplyCredit(balances, 's1', 1)).toBe(true);
  });

  it('returns false when used >= available', () => {
    expect(canApplyCredit(balances, 's1', 5)).toBe(false);
  });

  it('returns false when no credits for service', () => {
    expect(canApplyCredit(balances, 'unknown', 0)).toBe(false);
  });

  it('returns false when available is 0', () => {
    const zeroBalances: ServiceBalanceEntry[] = [
      { service_id: 's1', service_name: 'Corte', available: 0, used: 0 },
    ];
    expect(canApplyCredit(zeroBalances, 's1', 0)).toBe(false);
  });
});
