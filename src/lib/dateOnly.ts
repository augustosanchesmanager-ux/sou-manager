/**
 * Date-only utilities — avoid timezone issues when handling YYYY-MM-DD strings.
 * NEVER use new Date() for date-only fields. Store and compare as strings.
 */

export const getDayFromDateOnly = (dateOnly: string | null | undefined): number | null => {
  if (!dateOnly) return null;
  const parts = dateOnly.split('-');
  if (parts.length !== 3) return null;
  const day = parseInt(parts[2], 10);
  return isNaN(day) ? null : day;
};

export const formatDateOnlyBR = (dateOnly: string | null | undefined): string => {
  if (!dateOnly) return '';
  const parts = dateOnly.split('-');
  if (parts.length !== 3) return dateOnly;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

export const getTodayDateOnly = (): string => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const formatDateOnlyForInput = (value?: string | null): string => {
  if (!value) return getTodayDateOnly();
  return value.includes('T') ? value.split('T')[0] : value;
};

export const parseDateOnlyFromISO = (isoDate: string | null | undefined): string | null => {
  if (!isoDate) return null;
  return isoDate.includes('T') ? isoDate.split('T')[0] : isoDate;
};