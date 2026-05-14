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
  return role === 'barber' || role === 'manager';
};

export const receivesCommission = (staff?: StaffRoleLike | null) => {
  return normalizeRole(staff?.role) === 'barber';
};

export const getEffectiveCommissionRate = (staff?: StaffRoleLike | null) => {
  if (!receivesCommission(staff)) return 0;
  return normalizeSavedRate(staff?.commission_rate);
};

export const getDefaultCommissionRateForRole = (role?: LegacyStaffRole | null) => {
  return normalizeRole(role) === 'barber' ? 50 : 0;
};
