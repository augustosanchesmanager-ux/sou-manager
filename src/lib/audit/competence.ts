/**
 * [SMG][LIB][AUDIT] competence
 *
 * Helpers puros para a Data de Competência do estorno auditado.
 *
 * Regras:
 * - A competência é uma data de calendário local (YYYY-MM-DD), não um instante.
 * - O ISO gerado usa 12:00 local para não trocar de dia em nenhum fuso ±12h.
 * - Competência futura é inválida: estorno é correção de fato passado.
 * - PIN gerencial: 6 a 8 dígitos, sem máscara.
 */

const COMPETENCE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const AUDIT_PIN_PATTERN = /^\d{6,8}$/;

export const AUDIT_PIN_MIN_LENGTH = 6;
export const AUDIT_PIN_MAX_LENGTH = 8;

export function toLocalDateInput(value?: string | Date | null): string {
  const parsed = value instanceof Date ? value : value ? new Date(value) : new Date();
  const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function competenceDateToIso(value: string): string | null {
  if (!COMPETENCE_DATE_PATTERN.test(value)) return null;

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);

  const roundTrip =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;

  return roundTrip ? date.toISOString() : null;
}

export function isFutureCompetenceDate(value: string, now: Date = new Date()): boolean {
  const iso = competenceDateToIso(value);
  if (!iso) return false;

  const candidate = new Date(iso);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
  return candidate.getTime() > today.getTime();
}

export function isValidCompetenceDate(value: string, now: Date = new Date()): boolean {
  return Boolean(competenceDateToIso(value)) && !isFutureCompetenceDate(value, now);
}

export function normalizeAuditPin(value: string): string {
  return value.replace(/\D/g, '').slice(0, AUDIT_PIN_MAX_LENGTH);
}

export function isAuditPinFormatValid(value: string): boolean {
  return AUDIT_PIN_PATTERN.test(value);
}

export function formatCompetenceDateLabel(value: string): string {
  const iso = competenceDateToIso(value);
  if (!iso) return value;
  return new Date(iso).toLocaleDateString('pt-BR');
}
