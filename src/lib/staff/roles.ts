import { isProductComandaItem } from '../../../domain/commission/calculate';
import type { CommissionItemLike } from '../../../domain/commission/types';

export type LegacyStaffRole = 'Barber' | 'Manager' | 'Receptionist' | string;

export interface StaffRoleLike {
  role?: LegacyStaffRole | null;
  commission_rate?: number | string | null;
  commissionRate?: number | string | null;
  product_commission_rate?: number | string | null;
  productCommissionRate?: number | string | null;
}

const normalizeRole = (role?: LegacyStaffRole | null) => String(role || '').trim().toLowerCase();

const normalizeSavedRate = (value?: number | string | null) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return 0;
  return numeric > 1 ? numeric / 100 : numeric;
};

/**
 * Helper to extract raw commission rate supporting both snake_case and camelCase.
 */
const getRawCommissionRate = (staff?: StaffRoleLike | null): number | string | null => {
  return staff?.commission_rate ?? staff?.commissionRate ?? null;
};

const getRawProductCommissionRate = (staff?: StaffRoleLike | null): number | string | null => {
  return staff?.product_commission_rate ?? staff?.productCommissionRate ?? null;
};

/**
 * Determines if a staff member can perform services on chair/schedule.
 * Returns true for role === 'barber' and for role === 'manager' with commission_rate > 0.
 * Defensively supports both staff object and raw role string.
 */
export const canPerformServices = (staff?: StaffRoleLike | string | null): boolean => {
  if (!staff) return false;
  const roleStr = typeof staff === 'string' ? staff : staff.role;
  const role = normalizeRole(roleStr);
  if (role === 'barber') return true;
  if (role === 'manager') {
    if (typeof staff === 'string') return false;
    const rawRate = getRawCommissionRate(staff);
    const rate = Number(rawRate ?? 0);
    return rate > 0;
  }
  return false;
};

export const shouldAppearOnSchedule = (staff?: StaffRoleLike | string | null): boolean => {
  return canPerformServices(staff);
};

/**
 * Determines if a staff member receives commission.
 *
 * FIX-001: Managers with commission_rate > 0 are now eligible.
 * This supports operational managers who participate in service execution.
 */
export const receivesCommission = (staff?: StaffRoleLike | null) => {
  const role = normalizeRole(staff?.role);
  if (role === 'barber' || role === 'seller') return true;
  if (role === 'manager') {
    const rawRate = getRawCommissionRate(staff);
    const rate = Number(rawRate ?? 0);
    return rate > 0;
  }
  return false;
};

/**
 * Returns the effective commission rate for a staff member.
 * Returns 0 if not eligible for commission.
 * Supports both snake_case (commission_rate) and camelCase (commissionRate).
 * For barbers/sellers without an explicit rate, falls back to the default role rate.
 */
export const getEffectiveCommissionRate = (staff?: StaffRoleLike | null) => {
  if (!receivesCommission(staff)) return 0;
  const rawRate = getRawCommissionRate(staff);
  return normalizeSavedRate(rawRate);
};

export const receivesCommissionForItem = (
  staff?: StaffRoleLike | null,
  item?: CommissionItemLike | null,
): boolean => {
  if (receivesCommission(staff)) return true;
  if (normalizeRole(staff?.role) === 'manager' && isProductComandaItem(item)) {
    return Number(getRawProductCommissionRate(staff) ?? 0) > 0;
  }
  return false;
};

export const getEffectiveCommissionRateForItem = (
  staff?: StaffRoleLike | null,
  item?: CommissionItemLike | null,
): number => {
  if (!receivesCommissionForItem(staff, item)) return 0;
  if (isProductComandaItem(item)) {
    return normalizeSavedRate(getRawProductCommissionRate(staff));
  }
  return normalizeSavedRate(getRawCommissionRate(staff));
};

export const getDefaultCommissionRateForRole = (role?: LegacyStaffRole | null) => {
  const r = normalizeRole(role);
  return r === 'barber' || r === 'seller' ? 50 : 0;
};
