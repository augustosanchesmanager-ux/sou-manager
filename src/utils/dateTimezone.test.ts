import { describe, expect, it } from 'vitest';
import { getLocalDayRangeIso, getTodayDateKey, toLocalDateKey } from './dateTimezone';

describe('dateTimezone', () => {
  it('should_preserve_pure_date_string_without_utc_shift', () => {
    expect(toLocalDateKey('2026-11-18')).toBe('2026-11-18');
  });

  it('should_convert_late_night_brt_utc_timestamp_to_same_sao_paulo_day', () => {
    // 2026-11-18 21:30 BRT == 2026-11-19 00:30 UTC
    expect(toLocalDateKey('2026-11-19T00:30:00+00:00')).toBe('2026-11-18');
    expect(toLocalDateKey('2026-11-19T02:59:59.999Z')).toBe('2026-11-18');
    expect(toLocalDateKey(new Date('2026-11-19T00:30:00.000Z'))).toBe('2026-11-18');
  });

  it('should_convert_midnight_brt_utc_timestamp_to_next_sao_paulo_day', () => {
    // 2026-11-19 00:00 BRT == 2026-11-19 03:00 UTC
    expect(toLocalDateKey('2026-11-19T03:00:00.000Z')).toBe('2026-11-19');
  });

  it('should_return_empty_string_for_invalid_or_empty_inputs', () => {
    expect(toLocalDateKey('')).toBe('');
    expect(toLocalDateKey('invalid-date')).toBe('');
    expect(toLocalDateKey(new Date('invalid'))).toBe('');
  });

  it('should_return_valid_date_key_for_today', () => {
    expect(getTodayDateKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should_build_day_range_with_explicit_sao_paulo_offset', () => {
    expect(getLocalDayRangeIso('2026-11-18')).toEqual({
      startIso: '2026-11-18T00:00:00.000-03:00',
      endIso: '2026-11-18T23:59:59.999-03:00',
    });
  });
});
