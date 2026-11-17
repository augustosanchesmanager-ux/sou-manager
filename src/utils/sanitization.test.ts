import { describe, it, expect } from 'vitest';
import { sanitizeNullableString, sanitizeOptionalFields } from './sanitization';

describe('sanitization utils', () => {
  describe('sanitizeNullableString', () => {
    it('should return null for undefined or null', () => {
      expect(sanitizeNullableString(undefined)).toBeNull();
      expect(sanitizeNullableString(null)).toBeNull();
    });

    it('should return null for empty string or whitespace only', () => {
      expect(sanitizeNullableString('')).toBeNull();
      expect(sanitizeNullableString('   ')).toBeNull();
      expect(sanitizeNullableString('\t\n')).toBeNull();
    });

    it('should return trimmed string for valid content', () => {
      expect(sanitizeNullableString('12345678900')).toBe('12345678900');
      expect(sanitizeNullableString('  user@email.com  ')).toBe('user@email.com');
    });
  });

  describe('sanitizeOptionalFields', () => {
    it('should convert empty strings to null in an object', () => {
      const input = {
        name: 'Carlos Barbeiro',
        email: '   ',
        cpf: '',
        pix_key: 'carlos@pix.com',
        age: 30,
        isActive: true,
      };

      const result = sanitizeOptionalFields(input);

      expect(result).toEqual({
        name: 'Carlos Barbeiro',
        email: null,
        cpf: null,
        pix_key: 'carlos@pix.com',
        age: 30,
        isActive: true,
      });
    });

    it('should handle nested objects recursively', () => {
      const input = {
        profile: {
          rg: '   ',
          address: 'Rua Principal, 100',
        },
        other: '',
      };

      const result = sanitizeOptionalFields(input);

      expect(result).toEqual({
        profile: {
          rg: null,
          address: 'Rua Principal, 100',
        },
        other: null,
      });
    });
  });
});
