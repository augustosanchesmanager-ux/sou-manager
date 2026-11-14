import { describe, it, expect } from 'vitest';
import {
  getCanonicalBrPhone,
  applyCpfMask,
  normalizeCpf,
  isValidBrCpf,
} from './phone';

describe('phone — canonical placeholder rejection', () => {
  it('should_reject_placeholder_phones_when_digits_are_fake', () => {
    expect(getCanonicalBrPhone('(00) 00000-0000')).toBeNull();
    expect(getCanonicalBrPhone('(11) 90000-0000')).toBeNull();
    expect(getCanonicalBrPhone('(11) 0000-0000')).toBeNull();
    expect(getCanonicalBrPhone('11111111111')).toBeNull();
  });

  it('should_accept_valid_phones_when_number_is_real', () => {
    expect(getCanonicalBrPhone('(11) 98765-4321')).toBe('11987654321');
    expect(getCanonicalBrPhone('+55 11 99999-0000')).toBe('11999990000');
  });
});

describe('cpf utilities', () => {
  it('should_apply_cpf_mask_when_typing', () => {
    expect(applyCpfMask('52998224725')).toBe('529.982.247-25');
    expect(applyCpfMask('529982')).toBe('529.982');
  });

  it('should_validate_cpf_check_digits', () => {
    expect(isValidBrCpf('529.982.247-25')).toBe(true);
    expect(isValidBrCpf('529.982.247-24')).toBe(false);
    expect(isValidBrCpf('000.000.000-00')).toBe(false);
    expect(isValidBrCpf('')).toBe(false);
  });

  it('should_normalize_cpf_to_digits_only', () => {
    expect(normalizeCpf('529.982.247-25')).toBe('52998224725');
    expect(normalizeCpf('123')).toBeNull();
  });
});
