import { describe, it, expect } from 'vitest';
import { canPerformServices, shouldAppearOnSchedule, receivesCommission } from '../../src/lib/staff/roles';

describe('src/lib/staff/roles - canPerformServices & shouldAppearOnSchedule', () => {
  it('should allow barber to perform services and appear on schedule', () => {
    expect(canPerformServices({ role: 'barber' })).toBe(true);
    expect(canPerformServices({ role: 'Barber' })).toBe(true);
    expect(shouldAppearOnSchedule({ role: 'barber' })).toBe(true);
  });

  it('should allow manager with commission_rate > 0 to perform services', () => {
    expect(canPerformServices({ role: 'manager', commission_rate: 50 })).toBe(true);
    expect(canPerformServices({ role: 'Manager', commissionRate: 0.4 })).toBe(true);
    expect(shouldAppearOnSchedule({ role: 'manager', commission_rate: 30 })).toBe(true);
  });

  it('should block manager with commission_rate 0 or null from performing services', () => {
    expect(canPerformServices({ role: 'manager', commission_rate: 0 })).toBe(false);
    expect(canPerformServices({ role: 'manager', commission_rate: null })).toBe(false);
    expect(canPerformServices({ role: 'manager' })).toBe(false);
    expect(shouldAppearOnSchedule({ role: 'manager' })).toBe(false);
  });

  it('should block receptionist and admin without service capability from schedule', () => {
    expect(canPerformServices({ role: 'receptionist' })).toBe(false);
    expect(canPerformServices({ role: 'admin' })).toBe(false);
    expect(shouldAppearOnSchedule({ role: 'receptionist' })).toBe(false);
    expect(shouldAppearOnSchedule({ role: 'admin' })).toBe(false);
  });

  it('should handle string roles gracefully', () => {
    expect(canPerformServices('barber')).toBe(true);
    expect(canPerformServices('receptionist')).toBe(false);
    expect(canPerformServices('manager')).toBe(false);
  });

  it('should return false for null or undefined', () => {
    expect(canPerformServices(null)).toBe(false);
    expect(canPerformServices(undefined)).toBe(false);
    expect(shouldAppearOnSchedule(null)).toBe(false);
  });
});
