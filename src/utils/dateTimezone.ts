const SAO_PAULO_TIMEZONE = 'America/Sao_Paulo';

const saoPauloDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: SAO_PAULO_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const formatDateInSaoPaulo = (date: Date): string => {
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const parts = saoPauloDateFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    return '';
  }

  return `${year}-${month}-${day}`;
};

/**
 * Converts a Date or ISO string to YYYY-MM-DD in America/Sao_Paulo timezone.
 * Pure YYYY-MM-DD strings are returned unchanged without UTC Date parsing.
 */
export const toLocalDateKey = (dateOrIso: Date | string): string => {
  if (typeof dateOrIso === 'string') {
    const trimmed = dateOrIso.trim();
    if (!trimmed) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    return formatDateInSaoPaulo(new Date(trimmed));
  }

  return formatDateInSaoPaulo(dateOrIso);
};

/**
 * Returns today's date key (YYYY-MM-DD) in America/Sao_Paulo timezone.
 */
export const getTodayDateKey = (): string => toLocalDateKey(new Date());

/**
 * Returns explicit -03:00 day boundaries for Supabase .gte/.lte timestamp queries.
 */
export const getLocalDayRangeIso = (dateKey: string): { startIso: string; endIso: string } => {
  const normalizedKey = toLocalDateKey(dateKey) || getTodayDateKey();
  return {
    startIso: `${normalizedKey}T00:00:00.000-03:00`,
    endIso: `${normalizedKey}T23:59:59.999-03:00`,
  };
};
