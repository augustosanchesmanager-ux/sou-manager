import { describe, it, expect, vi, afterEach } from 'vitest';
import { isCycleDateValid, isFutureOrOpenDate, isCycleActive, daysRemainingInCycle } from './cycle';

describe('isCycleDateValid', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('returns true for null (open cycle)', () => {
    expect(isCycleDateValid(null)).toBe(true);
  });

  it('returns true for future date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-23T12:00:00Z'));
    expect(isCycleDateValid('2026-07-24T00:00:00Z')).toBe(true);
  });

  it('returns true for same time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-23T12:00:00Z'));
    expect(isCycleDateValid('2026-07-23T12:00:00Z')).toBe(true);
  });

  it('returns false for past date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-23T12:00:00Z'));
    expect(isCycleDateValid('2026-07-22T00:00:00Z')).toBe(false);
  });

  it('returns false for invalid date', () => {
    expect(isCycleDateValid('not-a-date')).toBe(false);
  });
});

describe('isFutureOrOpenDate', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('returns true for null', () => {
    expect(isFutureOrOpenDate(null)).toBe(true);
  });

  it('returns true for undefined', () => {
    expect(isFutureOrOpenDate(undefined)).toBe(true);
  });

  it('returns true for future date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-23T12:00:00Z'));
    expect(isFutureOrOpenDate('2026-07-24T00:00:00Z')).toBe(true);
  });

  it('returns true for invalid date (permissive)', () => {
    expect(isFutureOrOpenDate('invalid')).toBe(true);
  });

  it('returns false for past date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-23T12:00:00Z'));
    expect(isFutureOrOpenDate('2026-07-22T00:00:00Z')).toBe(false);
  });
});

describe('isCycleActive', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('returns true when start is past and end is future', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T12:00:00Z'));
    expect(isCycleActive('2026-07-01T00:00:00Z', '2026-07-31T00:00:00Z')).toBe(true);
  });

  it('returns true when start is null and end is future', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T12:00:00Z'));
    expect(isCycleActive(null, '2026-07-31T00:00:00Z')).toBe(true);
  });

  it('returns false when end is past', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T12:00:00Z'));
    expect(isCycleActive('2026-07-01T00:00:00Z', '2026-07-10T00:00:00Z')).toBe(false);
  });

  it('returns false when start is future', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T12:00:00Z'));
    expect(isCycleActive('2026-07-20T00:00:00Z', '2026-07-31T00:00:00Z')).toBe(false);
  });

  it('returns true when end is null (open)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T12:00:00Z'));
    expect(isCycleActive('2026-07-01T00:00:00Z', null)).toBe(true);
  });
});

describe('daysRemainingInCycle', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('returns null for null end date', () => {
    expect(daysRemainingInCycle(null)).toBeNull();
  });

  it('returns null for invalid date', () => {
    expect(daysRemainingInCycle('invalid')).toBeNull();
  });

  it('returns days remaining for future end', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-23T12:00:00Z'));
    expect(daysRemainingInCycle('2026-07-26T12:00:00Z')).toBe(3);
  });

  it('returns 0 for past end', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-23T12:00:00Z'));
    expect(daysRemainingInCycle('2026-07-20T00:00:00Z')).toBe(0);
  });
});
