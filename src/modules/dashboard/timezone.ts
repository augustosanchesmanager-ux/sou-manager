/**
 * [SMG][DASHBOARD][UTIL] timezone
 *
 * Helper para timezone America/Sao_Paulo usando Intl.DateTimeFormat.
 * Substitui uso de browser-local new Date().getHours() que falha em DST
 * e não respeita o timezone do tenant (Brasil).
 *
 * Por que Intl com timeZone pin:
 * - new Date().getHours() usa o timezone do browser do usuário (pode ser UTC, US, etc.)
 * - Intl.DateTimeFormat com timeZone 'America/Sao_Paulo' garante hora correta de SP
 * - Funciona corretamente com horário de verão (DST) quando aplicável
 * - Consistente entre server (RPC get_dashboard_kpis) e client
 */

const SAO_PAULO_TZ = 'America/Sao_Paulo';

/**
 * Retorna a data/hora atual no timezone America/Sao_Paulo.
 */
export const nowInSaoPaulo = (): Date => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: SAO_PAULO_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(new Date());
  const partMap: Record<string, string> = {};
  for (const part of parts) {
    partMap[part.type] = part.value;
  }

  // en-CA format: YYYY-MM-DD, HH:MM:SS
  const isoString = `${partMap.year}-${partMap.month}-${partMap.day}T${partMap.hour}:${partMap.minute}:${partMap.second}`;
  return new Date(isoString);
};

/**
 * Retorna o início do dia (00:00:00.000) em America/Sao_Paulo.
 */
export const startOfDayInSaoPaulo = (date?: Date): Date => {
  const spDate = date || nowInSaoPaulo();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: SAO_PAULO_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(spDate);
  const partMap: Record<string, string> = {};
  for (const part of parts) {
    partMap[part.type] = part.value;
  }

  const isoString = `${partMap.year}-${partMap.month}-${partMap.day}T00:00:00`;
  return new Date(isoString);
};

/**
 * Retorna o fim do dia (23:59:59.999) em America/Sao_Paulo.
 */
export const endOfDayInSaoPaulo = (date?: Date): Date => {
  const spDate = date || nowInSaoPaulo();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: SAO_PAULO_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(spDate);
  const partMap: Record<string, string> = {};
  for (const part of parts) {
    partMap[part.type] = part.value;
  }

  const isoString = `${partMap.year}-${partMap.month}-${partMap.day}T23:59:59.999`;
  return new Date(isoString);
};

/**
 * Retorna a hora atual (0-23) em America/Sao_Paulo.
 */
export const getHourInSaoPaulo = (): number => {
  return nowInSaoPaulo().getHours();
};

/**
 * Retorna saudação baseada na hora em America/Sao_Paulo.
 * 0-11: Bom dia, 12-17: Boa tarde, 18-23: Boa noite
 */
export const getTimeOfDayGreeting = (): { icon: string; text: string } => {
  const hour = getHourInSaoPaulo();
  if (hour < 12) return { icon: 'wb_sunny', text: 'Bom dia' };
  if (hour < 18) return { icon: 'wb_twilight', text: 'Boa tarde' };
  return { icon: 'nights_stay', text: 'Boa noite' };
};

/**
 * Formata data para exibição em pt-BR usando timezone America/Sao_Paulo.
 */
export const formatDateInSaoPaulo = (date: Date, options?: Intl.DateTimeFormatOptions): string => {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: SAO_PAULO_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...options,
  };
  return date.toLocaleDateString('pt-BR', defaultOptions);
};

/**
 * Formata data/hora para ISO string (YYYY-MM-DDTHH:mm:ss) em America/Sao_Paulo.
 * Útil para queries Supabase que esperam timestamps.
 */
export const toISOInSaoPaulo = (date: Date): string => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: SAO_PAULO_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const partMap: Record<string, string> = {};
  for (const part of parts) {
    partMap[part.type] = part.value;
  }

  return `${partMap.year}-${partMap.month}-${partMap.day}T${partMap.hour}:${partMap.minute}:${partMap.second}`;
};

/**
 * Retorna o range de "hoje" em America/Sao_Paulo para queries.
 * { start: ISO string 00:00:00, end: ISO string 23:59:59.999 }
 */
export const getTodayRangeInSaoPaulo = (): { start: string; end: string } => {
  const start = startOfDayInSaoPaulo();
  const end = endOfDayInSaoPaulo();
  return {
    start: toISOInSaoPaulo(start),
    end: toISOInSaoPaulo(end),
  };
};