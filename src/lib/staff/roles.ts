export type LegacyStaffRole = 'Barber' | 'Manager' | 'Receptionist' | string;

export interface StaffRoleLike {
  role?: LegacyStaffRole | null;
  commission_rate?: number | string | null;
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
 * Determines if a staff member receives commission.
 *
 * FIX-001: Managers with commission_rate > 0 are now eligible.
 * This supports operational managers who participate in service execution.
 */
export const receivesCommission = (staff?: StaffRoleLike | null) => {
  const role = normalizeRole(staff?.role);
  if (role === 'barber' || role === 'seller') return true;
  if (role === 'manager') {
    const rate = Number(staff?.commission_rate ?? 0);
    return rate > 0;
  }
  return false;
};

/**
 * Returns the effective commission rate for a staff member.
 * Returns 0 if not eligible for commission.
 */
export const getEffectiveCommissionRate = (staff?: StaffRoleLike | null) => {
  if (!receivesCommission(staff)) return 0;
  return normalizeSavedRate(staff?.commission_rate);
};

export const getDefaultCommissionRateForRole = (role?: LegacyStaffRole | null) => {
  const r = normalizeRole(role);
  return r === 'barber' || r === 'seller' ? 50 : 0;
};
