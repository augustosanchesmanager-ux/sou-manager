import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TIMEZONE,
  businessDateInTimeZone,
} from './timezone';

/**
 * Instantes fixos (UTC) escolhidos nas viradas do relógio de America/Sao_Paulo
 * (UTC-3). Nenhum teste depende do timezone da máquina porque o `timeZone` é
 * sempre explícito.
 */
const INSTANT = {
  // 23:59:59 de 10/11 em SP
  beforeMidnight: '2026-11-11T02:59:59.000Z',
  // 00:00:00 de 11/11 em SP
  midnight: '2026-11-11T03:00:00.000Z',
  // 21:00 de 11/11 em SP — UTC já em 12/11 (o caso do bug)
  ninePm: '2026-11-12T00:00:00.000Z',
  // 23:59:59 de 11/11 em SP — ainda 11/11, UTC já em 12/11
  lateNight: '2026-11-12T02:59:59.000Z',
  // 00:00:00 de 12/11 em SP
  nextMidnight: '2026-11-12T03:00:00.000Z',
} as const;

describe('businessDateInTimeZone', () => {
  it('should_return_previous_day_when_sp_is_two_seconds_before_midnight', () => {
    expect(businessDateInTimeZone(new Date(INSTANT.beforeMidnight))).toBe('2026-11-10');
  });

  it('should_return_new_day_when_sp_crosses_midnight', () => {
    expect(businessDateInTimeZone(new Date(INSTANT.midnight))).toBe('2026-11-11');
  });

  it('should_keep_business_date_when_utc_already_moved_to_next_day', () => {
    // Arrange — 21:00 de 11/11 em SP; toISOString() devolveria '2026-11-12'
    const reference = new Date(INSTANT.ninePm);

    // Act
    const businessDate = businessDateInTimeZone(reference);

    // Assert
    expect(businessDate).toBe('2026-11-11');
    expect(reference.toISOString().split('T')[0]).toBe('2026-11-12');
  });

  it('should_keep_business_date_when_sp_is_two_minutes_before_midnight', () => {
    expect(businessDateInTimeZone(new Date(INSTANT.lateNight))).toBe('2026-11-11');
  });

  it('should_advance_business_date_only_when_sp_crosses_midnight', () => {
    expect(businessDateInTimeZone(new Date(INSTANT.nextMidnight))).toBe('2026-11-12');
  });

  it('should_pad_month_and_day_when_value_is_single_digit', () => {
    expect(businessDateInTimeZone(new Date('2026-01-05T15:00:00.000Z'))).toBe('2026-01-05');
  });

  it('should_respect_explicit_timezone_when_one_is_provided', () => {
    // Arrange — 00:00 UTC de 12/11 é 19:00 de 11/11 em Nova York (UTC-5)
    const reference = new Date('2026-11-12T00:00:00.000Z');

    // Act
    const inNewYork = businessDateInTimeZone(reference, 'America/New_York');

    // Assert
    expect(inNewYork).toBe('2026-11-11');
  });

  it('should_throw_when_timezone_is_invalid', () => {
    expect(() => businessDateInTimeZone(new Date(INSTANT.midnight), 'Mars/Olympus')).toThrow(
      RangeError,
    );
  });

  it('should_use_sao_paulo_as_default_timezone', () => {
    expect(DEFAULT_TIMEZONE).toBe('America/Sao_Paulo');
  });
});

describe('timezone default', () => {
  it('should_be_sao_paulo_when_no_timezone_is_informed', () => {
    // Arrange — 21:00 de 11/11 em SP (UTC já em 12/11)
    const reference = new Date(INSTANT.ninePm);

    // Act
    const implicit = businessDateInTimeZone(reference);
    const explicit = businessDateInTimeZone(reference, DEFAULT_TIMEZONE);

    // Assert
    expect(implicit).toBe(explicit);
    expect(implicit).toBe('2026-11-11');
  });
});
