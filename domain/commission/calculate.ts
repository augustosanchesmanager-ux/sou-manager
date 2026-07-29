/**
 * [SMG][DOMAIN][COMMISSION] calculate
 *
 * Theoretical commission formulas — calculates what commission was generated
 * from service execution, NOT the financial settlement during cash closing.
 *
 * These values are used in the Commission Dashboard to show "how much did
 * this professional earn in commission from executed services."
 *
 * Cash Closing uses different algorithms (application/cashClosing/).
 * See docs/adr/ADR-001-Commission-vs-Settlement.md
 *
 * Dependencies: shared/numbers/normalize.ts (normalizePercentage)
 */

import { normalizePercentage } from '../../shared/numbers/normalize';
import type { CommissionBaseChoice, ParticipantRow, StaffRoleLike } from './types';

/**
 * Resolve o valor base de um item para fins de comissão.
 * Tenta unit_price → price → amount → unit_price * quantity.
 * Retorna { value, field, reason } para auditoria.
 */
export const resolveCommissionBase = (item: Record<string, unknown>): CommissionBaseChoice => {
  const unitPrice = Number(item.unit_price ?? 0);
  const price = Number(item.price ?? 0);
  const amount = Number(item.amount ?? 0);
  const quantity = Number(item.quantity ?? 1);

  if (unitPrice > 0) {
    return { value: unitPrice, field: 'unit_price', reason: 'unit_price presente' };
  }
  if (price > 0) {
    return { value: price, field: 'price', reason: 'fallback para price' };
  }
  if (amount > 0 && quantity > 0) {
    return { value: amount / quantity, field: 'amount/quantity', reason: 'fallback para amount/quantity' };
  }
  if (amount > 0) {
    return { value: amount, field: 'amount', reason: 'fallback para amount' };
  }
  return { value: 0, field: 'none', reason: 'nenhum valor encontrado' };
};

/**
 * Calcula o valor de comissão de um participante individual.
 * Se payout_type === 'percentage': itemValue * quantity * (payout_value / 100)
 * Se payout_type === 'fixed': payout_value (valor fixo)
 */
export const calculateParticipantPayout = (
  itemValue: number,
  itemQuantity: number,
  participant: ParticipantRow,
): number => {
  if (!participant.affects_commission) return 0;
  const rate = normalizePercentage(participant.payout_value);
  if (participant.payout_type === 'percentage') {
    return itemValue * itemQuantity * rate;
  }
  return participant.payout_value;
};

/**
 * Calcula o valor base de um participante para divisão compartilhada.
 * Se fixed: retorna payout_value direto.
 * Se percentage: retorna itemValue * normalizePercentage(payout_value).
 */
export const calculateParticipantBaseValue = (
  itemValue: number,
  participant: ParticipantRow,
): number => {
  const rate = normalizePercentage(participant.payout_value);
  if (participant.payout_type === 'fixed') {
    return participant.payout_value;
  }
  return itemValue * rate;
};

/**
 * Calcula o total de pagamentos de todos os participantes com affect_commission.
 */
export const calculateTotalPayouts = (
  itemValue: number,
  itemQuantity: number,
  participants: ParticipantRow[],
): number => {
  return participants
    .filter((p) => p.affects_commission)
    .reduce((sum, p) => sum + calculateParticipantPayout(itemValue, itemQuantity, p), 0);
};

/**
 * Calcula o valor de comissão para um profissional.
 * Fórmula: commissionBase * commissionRate
 * Se o participante tem payout_type fixed, usa o valor fixo como base.
 */
export const calculateCommissionValue = (
  itemValue: number,
  itemQuantity: number,
  participant: ParticipantRow,
  commissionRate: number,
): number => {
  if (!participant.affects_commission) return 0;
  const rate = normalizePercentage(commissionRate);

  if (participant.payout_type === 'fixed') {
    return participant.payout_value * rate;
  }

  const participantBase = itemValue * itemQuantity * normalizePercentage(participant.payout_value);
  return participantBase * rate;
};

/**
 * Determina se recebi comissão baseado no role.
 */
export const isCommissionEligible = (staff: StaffRoleLike): boolean => {
  const role = (staff.role || '').toLowerCase();
  return role === 'barber' || role === 'seller';
};

/**
 * Retorna a taxa efetiva de comissão de um profissional.
 * Retorna 0 se não elegível para comissão.
 */
export const getEffectiveRate = (staff: StaffRoleLike): number => {
  if (!isCommissionEligible(staff)) return 0;
  return normalizePercentage(staff.commission_rate ?? 0);
};

/**
 * Retorna a taxa padrão de comissão para um role.
 * Barbeiro/vendedor: 50%, outros: 0%.
 */
export const getDefaultRateForRole = (role: string): number => {
  const normalized = (role || '').toLowerCase();
  return normalized === 'barber' || normalized === 'seller' ? 0.5 : 0;
};
