import { describe, expect, it } from 'vitest';
import {
  AUDIT_PIN_MAX_LENGTH,
  competenceDateToIso,
  formatCompetenceDateLabel,
  isAuditPinFormatValid,
  isFutureCompetenceDate,
  isValidCompetenceDate,
  normalizeAuditPin,
  toLocalDateInput,
} from './competence';

describe('audit competence helpers', () => {
  describe('toLocalDateInput', () => {
    it('should_return_local_calendar_date_when_receiving_a_local_date', () => {
      // Arrange
      const localDate = new Date(2026, 9, 19, 12, 0, 0);

      // Act
      const result = toLocalDateInput(localDate);

      // Assert
      expect(result).toBe('2026-10-19');
    });

    it('should_return_current_local_date_when_value_is_null', () => {
      expect(toLocalDateInput(null)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('competenceDateToIso', () => {
    it('should_keep_the_same_calendar_day_when_converting_to_iso', () => {
      // Act
      const iso = competenceDateToIso('2026-10-19');

      // Assert
      expect(iso).not.toBeNull();
      const parsed = new Date(iso as string);
      expect(parsed.getFullYear()).toBe(2026);
      expect(parsed.getMonth()).toBe(9);
      expect(parsed.getDate()).toBe(19);
      expect(parsed.getHours()).toBe(12);
    });

    it('should_return_null_when_date_does_not_exist', () => {
      expect(competenceDateToIso('2026-02-31')).toBeNull();
    });

    it('should_return_null_when_format_is_invalid', () => {
      expect(competenceDateToIso('19/10/2026')).toBeNull();
      expect(competenceDateToIso('')).toBeNull();
    });
  });

  describe('isFutureCompetenceDate', () => {
    const now = new Date(2026, 0, 10, 9, 30, 0);

    it('should_return_true_when_date_is_after_today', () => {
      expect(isFutureCompetenceDate('2026-01-11', now)).toBe(true);
    });

    it('should_return_false_when_date_is_today', () => {
      expect(isFutureCompetenceDate('2026-01-10', now)).toBe(false);
    });

    it('should_return_false_when_date_is_in_the_past', () => {
      expect(isFutureCompetenceDate('2026-01-09', now)).toBe(false);
    });
  });

  describe('isValidCompetenceDate', () => {
    const now = new Date(2026, 0, 10, 9, 30, 0);

    it('should_return_true_when_date_is_valid_and_not_future', () => {
      expect(isValidCompetenceDate('2026-01-10', now)).toBe(true);
    });

    it('should_return_false_when_date_is_future', () => {
      expect(isValidCompetenceDate('2026-01-11', now)).toBe(false);
    });

    it('should_return_false_when_date_is_malformed', () => {
      expect(isValidCompetenceDate('2026-13-01', now)).toBe(false);
    });
  });

  describe('normalizeAuditPin', () => {
    it('should_strip_non_digits_and_cap_length_when_receiving_masked_input', () => {
      expect(normalizeAuditPin('12a34-5678 9')).toBe('12345678');
      expect(normalizeAuditPin('12a34-5678 9')).toHaveLength(AUDIT_PIN_MAX_LENGTH);
    });

    it('should_return_empty_string_when_input_has_no_digits', () => {
      expect(normalizeAuditPin('abc-!@#')).toBe('');
    });
  });

  describe('isAuditPinFormatValid', () => {
    it('should_accept_six_to_eight_digits', () => {
      expect(isAuditPinFormatValid('123456')).toBe(true);
      expect(isAuditPinFormatValid('12345678')).toBe(true);
    });

    it('should_reject_five_or_nine_digits', () => {
      expect(isAuditPinFormatValid('12345')).toBe(false);
      expect(isAuditPinFormatValid('123456789')).toBe(false);
    });

    it('should_reject_non_numeric_characters', () => {
      expect(isAuditPinFormatValid('12a456')).toBe(false);
    });
  });

  describe('formatCompetenceDateLabel', () => {
    it('should_format_as_brazilian_date_when_value_is_valid', () => {
      expect(formatCompetenceDateLabel('2026-10-19')).toBe('19/10/2026');
    });

    it('should_return_raw_value_when_value_is_invalid', () => {
      expect(formatCompetenceDateLabel('invalid')).toBe('invalid');
    });
  });
});
