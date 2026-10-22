/**
 * Unit tests for staff roles and commission rate normalization:
 * - snake_case (commission_rate) and camelCase (commissionRate) compatibility
 * - FIX-001 manager commission eligibility
 * - Default commission rate fallback for barbers/sellers
 */

import { describe, it, expect } from 'vitest';
import {
  receivesCommission,
  getEffectiveCommissionRate,
  getDefaultCommissionRateForRole,
  shouldAppearOnSchedule,
} from './roles';

describe('Staff Roles & Commission Rate Normalization', () => {
  describe('receivesCommission', () => {
    it('should return true for barbers regardless of rate', () => {
      expect(receivesCommission({ role: 'barber' })).toBe(true);
      expect(receivesCommission({ role: 'Barber' })).toBe(true);
      expect(receivesCommission({ role: 'seller' })).toBe(true);
    });

    it('should return true for managers only when commission rate > 0', () => {
      // snake_case
      expect(receivesCommission({ role: 'manager', commission_rate: 0 })).toBe(false);
      expect(receivesCommission({ role: 'manager', commission_rate: 40 })).toBe(true);
      expect(receivesCommission({ role: 'Manager', commission_rate: '30' })).toBe(true);

      // camelCase
      expect(receivesCommission({ role: 'manager', commissionRate: 0 })).toBe(false);
      expect(receivesCommission({ role: 'manager', commissionRate: 50 })).toBe(true);
    });

    it('should return false for receptionist or undefined', () => {
      expect(receivesCommission({ role: 'receptionist', commission_rate: 50 })).toBe(false);
      expect(receivesCommission(null)).toBe(false);
      expect(receivesCommission(undefined)).toBe(false);
    });
  });

  describe('getEffectiveCommissionRate', () => {
    it('should resolve percentage rates to fractions (40 -> 0.4)', () => {
      expect(getEffectiveCommissionRate({ role: 'barber', commission_rate: 40 })).toBe(0.4);
      expect(getEffectiveCommissionRate({ role: 'barber', commissionRate: 35 })).toBe(0.35);
    });

    it('should accept already normalized fractions (0.45 -> 0.45)', () => {
      expect(getEffectiveCommissionRate({ role: 'barber', commission_rate: 0.45 })).toBe(0.45);
      expect(getEffectiveCommissionRate({ role: 'barber', commissionRate: 0.5 })).toBe(0.5);
    });

    it('should return 0 when commission_rate is null, 0 or unset', () => {
      expect(getEffectiveCommissionRate({ role: 'barber' })).toBe(0);
      expect(getEffectiveCommissionRate({ role: 'barber', commission_rate: null })).toBe(0);
      expect(getEffectiveCommissionRate({ role: 'barber', commission_rate: 0 })).toBe(0);
      expect(getEffectiveCommissionRate({ role: 'barber', commissionRate: 0 })).toBe(0);
    });

    it('should return 0 for uncommissioned roles or manager with 0 rate', () => {
      expect(getEffectiveCommissionRate({ role: 'receptionist' })).toBe(0);
      expect(getEffectiveCommissionRate({ role: 'manager' })).toBe(0);
      expect(getEffectiveCommissionRate({ role: 'manager', commission_rate: 0 })).toBe(0);
    });
  });

  describe('shouldAppearOnSchedule', () => {
    it('should include barber, manager and seller', () => {
      expect(shouldAppearOnSchedule({ role: 'barber' })).toBe(true);
      expect(shouldAppearOnSchedule({ role: 'manager' })).toBe(true);
      expect(shouldAppearOnSchedule({ role: 'seller' })).toBe(true);
      expect(shouldAppearOnSchedule({ role: 'receptionist' })).toBe(false);
    });
  });

  describe('getDefaultCommissionRateForRole', () => {
    it('should return 50 for barber or seller and 0 for manager or receptionist', () => {
      expect(getDefaultCommissionRateForRole('barber')).toBe(50);
      expect(getDefaultCommissionRateForRole('Barber')).toBe(50);
      expect(getDefaultCommissionRateForRole('seller')).toBe(50);
      expect(getDefaultCommissionRateForRole('manager')).toBe(0);
      expect(getDefaultCommissionRateForRole('receptionist')).toBe(0);
    });
  });
});
