export type LegacyStaffRole = 'Barber' | 'Manager' | 'Receptionist' | string;

export interface StaffRoleLike {
  role?: LegacyStaffRole | null;
  commission_rate?: number | string | null;
  commissionRate?: number | string | null;
}

const normalizeRole = (role?: LegacyStaffRole | null) => String(role || '').trim().toLowerCase();

const normalizeSavedRate = (value?: number | string | null) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return 0;
  return numeric > 1 ? numeric / 100 : numeric;
};

export const shouldAppearOnSchedule = (staff?: StaffRoleLike | null) => {
  const role = normalizeRole(staff?.role);
  return role === 'barber' || role === 'manager' || role === 'seller';
};

/**
 * Helper to extract raw commission rate supporting both snake_case and camelCase.
 */
const getRawCommissionRate = (staff?: StaffRoleLike | null): number | string | null => {
  return staff?.commission_rate ?? staff?.commissionRate ?? null;
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

export const getDefaultCommissionRateForRole = (role?: LegacyStaffRole | null) => {
  const r = normalizeRole(role);
  return r === 'barber' || r === 'seller' ? 50 : 0;
};
