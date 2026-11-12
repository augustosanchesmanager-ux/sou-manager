/**
 * [SMG][SHARED][UTIL] timezone
 *
 * Definição canônica do "dia comercial" (business_date) no frontend.
 *
 * Por que existe:
 * - `new Date().toISOString().split('T')[0]` devolve o dia em UTC, não o dia
 *   operacional do tenant. Às 21h30 em America/Sao_Paulo o UTC já virou, então
 *   um fechamento gravado assim recebe o business_date do dia SEGUINTE e o
 *   upsert (`onConflict: 'tenant_id,business_date'`) sobrescreve o fechamento
 *   real do dia seguinte.
 * - O banco já resolve isso com `(X AT TIME ZONE v_timezone)::date`
 *   (ver `20261105120000_add_audit_pin_and_retroactive_adjustment.sql`), usando
 *   `tenant_settings.timezone` com fallback 'America/Sao_Paulo'. Este helper
 *   replica a mesma regra no cliente para que front e banco concordem.
 *
 * Implementação:
 * - Somente `Intl.DateTimeFormat` nativo (zero dependência nova).
 * - `formatToParts` em vez de formatar direto: a ordem dos campos no output de
 *   um locale não é garantida por contrato, os names de part são.
 * - Independente do timezone da máquina/browser — o `timeZone` é explícito,
 *   portanto o resultado é determinístico em CI (UTC) e em máquina local (BR).
 */

export const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

/**
 * Retorna o dia comercial no timezone informado, no formato `YYYY-MM-DD`.
 *
 * @param reference instante de referência (default: agora)
 * @param timeZone IANA timezone (default: 'America/Sao_Paulo')
 */
export const businessDateInTimeZone = (
  reference: Date = new Date(),
  timeZone: string = DEFAULT_TIMEZONE,
): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(reference);

  const partMap: Record<string, string> = {};
  for (const part of parts) {
    partMap[part.type] = part.value;
  }

  return `${partMap.year}-${partMap.month}-${partMap.day}`;
};
