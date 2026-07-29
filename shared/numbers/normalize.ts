/**
 * [SMG][SHARED][UTIL] normalizePercentage
 *
 * Consolida normalizePercentage, normalizeRate, normalizeParticipantPercentage,
 * normalizePercentageValue — todos com a mesma lógica.
 *
 * Canonical source: pages/Commissions.tsx:168
 * Migração: Fase 2.1 — Padronização
 */

/**
 * Normaliza um valor de porcentagem.
 * Aceita tanto decimal (0.30 = 30%) quanto percentual (30 = 30%).
 * - Se > 1, assume que é percentual (30 → 0.30)
 * - Se <= 1, assume que já é decimal (0.30 → 0.30)
 * - Guarda contra NaN e Infinity
 */
export const normalizePercentage = (
  value: number | null | undefined,
): number => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return 0;
  return numeric > 1 ? numeric / 100 : numeric;
};

/**
 * Alias para normalizePercentage.
 * Mantido para compatibilidade com código que usa o nome "normalizeRate".
 */
export const normalizeRate = normalizePercentage;

/**
 * Alias para normalizePercentage.
 * Mantido para compatibilidade com código que usa o nome "normalizeParticipantPercentage".
 */
export const normalizeParticipantPercentage = normalizePercentage;

/**
 * Alias para normalizePercentage.
 * Mantido para compatibilidade com código que usa o nome "normalizePercentageValue".
 */
export const normalizePercentageValue = normalizePercentage;
