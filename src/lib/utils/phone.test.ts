import { describe, expect, it } from 'vitest';
import { buildWhatsAppUrl, findClientByCanonicalPhone, getCanonicalBrPhone, normalizePhone } from './phone';

describe('normalizePhone', () => {
  it('should return valid digits when phone is formatted without country code (11 digits)', () => {
    const result = normalizePhone('(11) 98306-8852');
    expect(result.isValid).toBe(true);
    expect(result.digits).toBe('11983068852');
  });

  it('should return valid digits when phone has country code +55 (13 digits)', () => {
    const result = normalizePhone('+55 11 98306-8852');
    expect(result.isValid).toBe(true);
    expect(result.digits).toBe('11983068852');
  });

  it('should return valid digits when phone has country code 55 without plus', () => {
    const result = normalizePhone('5511983068852');
    expect(result.isValid).toBe(true);
    expect(result.digits).toBe('11983068852');
  });

  it('should return valid digits for landline with country code +55 (12 digits)', () => {
    const result = normalizePhone('+55 11 3306-8852');
    expect(result.isValid).toBe(true);
    expect(result.digits).toBe('1133068852');
  });

  it('should return valid digits for landline without country code (10 digits)', () => {
    const result = normalizePhone('(11) 3306-8852');
    expect(result.isValid).toBe(true);
    expect(result.digits).toBe('1133068852');
  });

  it('should return invalid when phone is missing DDD (less than 10 digits)', () => {
    const result = normalizePhone('98306-8852');
    expect(result.isValid).toBe(false);
    expect(result.digits).toBe('983068852');
  });

  it('should return invalid when phone is empty or null', () => {
    expect(normalizePhone(null)).toEqual({ digits: '', isValid: false });
    expect(normalizePhone(undefined)).toEqual({ digits: '', isValid: false });
    expect(normalizePhone('')).toEqual({ digits: '', isValid: false });
  });
});

describe('buildWhatsAppUrl', () => {
  it('should build proper wa.me link with 55 prefix without duplicating when country code was present', () => {
    const url = buildWhatsAppUrl('Gabriel', '+55 11 98306-8852', 'Mensagem teste');
    expect(url).toContain('https://wa.me/5511983068852?text=');
    expect(url).not.toContain('5555');
  });

  it('should return null when phone is invalid', () => {
    const url = buildWhatsAppUrl('Gabriel', '123', 'Mensagem teste');
    expect(url).toBeNull();
  });
});

describe('getCanonicalBrPhone & findClientByCanonicalPhone', () => {
  it('should_strip_ddi_55_and_reject_repeated_digit_placeholders', () => {
    expect(getCanonicalBrPhone('+55 11 97684-4344')).toBe('11976844344');
    expect(getCanonicalBrPhone('5511961142570')).toBe('11961142570');
    expect(getCanonicalBrPhone('11976844344')).toBe('11976844344');
    expect(getCanonicalBrPhone('11111111111')).toBeNull();
    expect(getCanonicalBrPhone('+5511111111111')).toBeNull();
    expect(getCanonicalBrPhone('0000000000')).toBeNull();
  });

  it('should_prefer_primary_owner_over_shared_phone_dependent', () => {
    const clients = [
      { id: 'son-1', name: 'SAMUEL - ISRAEL', phone: '5511958713888', is_shared_phone: true },
      { id: 'dad-1', name: 'ISRAEL', phone: '+55 11 95871-3888', is_shared_phone: false },
    ];

    const matched = findClientByCanonicalPhone(clients, '11958713888');
    expect(matched?.id).toBe('dad-1');
  });
});
