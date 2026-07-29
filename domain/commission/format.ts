/**
 * [SMG][DOMAIN][COMMISSION] format
 *
 * Formatação de valores de comissão para exibição.
 * Extraídas de pages/Commissions.tsx, pages/Schedule.tsx, pages/Comandas.tsx.
 *
 * Elimina duplicação de formatSavedPayout / formatParticipantPayout.
 */

import { normalizePercentage } from '../../shared/numbers/normalize';
import { formatCurrency } from '../../shared/format/currency';
import type { ParticipantRow } from './types';

/**
 * Formata o payout de um participante para exibição.
 * Exemplos: "Marcos 40%", "Julia R$ 30,00"
 */
export const formatParticipantPayout = (
  participant: ParticipantRow,
  staffName: string,
): string => {
  const rate = normalizePercentage(participant.payout_value);

  if (participant.payout_type === 'fixed') {
    return `${staffName} ${formatCurrency(participant.payout_value)}`;
  }

  const percentage = Math.round(rate * 100);
  return `${staffName} ${percentage}%`;
};

/**
 * Alias para compatibilidade com código existente.
 */
export const formatSavedPayout = formatParticipantPayout;

/**
 * Formata o valor de payout como string monetária.
 */
export const formatPayoutValue = (
  value: number,
): string => formatCurrency(value);

/**
 * Formata uma taxa de comissão como porcentagem legível.
 * Exemplos: "50%", "33.3%"
 */
export const formatRatePercent = (rate: number): string => {
  const normalized = normalizePercentage(rate);
  const percentage = Math.round(normalized * 100);
  return `${percentage}%`;
};
