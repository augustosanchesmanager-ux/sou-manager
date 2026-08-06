/**
 * [SMG][DOMAIN][BILLING] limits tests
 *
 * Limites por plano (6.0.3): free = 1, pro = 5, premium = ∞.
 */

import { describe, expect, it } from 'vitest';
import { getStaffLimit, isStaffLimitExceeded, isUnlimited, PLAN_LIMITS } from './limits';

describe('PLAN_LIMITS', () => {
  it('should_map_free_to_1', () => {
    expect(PLAN_LIMITS.free).toBe(1);
  });

  it('should_map_pro_to_5', () => {
    expect(PLAN_LIMITS.pro).toBe(5);
  });

  it('should_map_premium_to_infinity', () => {
    expect(PLAN_LIMITS.premium).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('getStaffLimit', () => {
  it('should_return_1_for_free', () => expect(getStaffLimit('free')).toBe(1));
  it('should_return_5_for_pro', () => expect(getStaffLimit('pro')).toBe(5));
  it('should_return_infinity_for_premium', () => expect(getStaffLimit('premium')).toBe(Infinity));
});

describe('isStaffLimitExceeded', () => {
  it('should_not_exceed_free_at_1', () => expect(isStaffLimitExceeded('free', 1)).toBe(false));
  it('should_exceed_free_at_2', () => expect(isStaffLimitExceeded('free', 2)).toBe(true));
  it('should_not_exceed_pro_at_5', () => expect(isStaffLimitExceeded('pro', 5)).toBe(false));
  it('should_exceed_pro_at_6', () => expect(isStaffLimitExceeded('pro', 6)).toBe(true));
  it('should_never_exceed_premium', () => expect(isStaffLimitExceeded('premium', 100)).toBe(false));
});

describe('isUnlimited', () => {
  it('should_be_unlimited_for_premium', () => expect(isUnlimited('premium')).toBe(true));
  it('should_not_be_unlimited_for_free', () => expect(isUnlimited('free')).toBe(false));
});
