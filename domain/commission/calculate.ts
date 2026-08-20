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
 * FIX-001: Commission base is now the EFFECTIVELY RECEIVED value, not the
 * gross unit_price. This respects the PO rule:
 *   commissionBase = receivedValue × participantShare
 *   commission = commissionBase × commissionRate
 *
 * Dependencies: shared/numbers/normalize.ts (normalizePercentage)
 */

import { normalizePercentage } from '../../shared/numbers/normalize';
import type { CommissionBaseChoice, ParticipantRow, StaffRoleLike, FinancialBaseInput, FinancialBaseResult, ZeroCommissionReason } from './types';

/**
 * Resolve o valor base de um item para fins de comissão (BRUTO).
 * Tenta unit_price → price → amount → unit_price * quantity.
 * Retorna { value, field, reason } para auditoria.
 *
 * @deprecated Use resolveFinancialBase for production commission calculations.
 * This function returns the GROSS value before discounts and payment adjustments.
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
 * FIX-001 R2: Detect why commission is zero based on evidence.
 *
 * Detection rules (in order of specificity):
 * 1. unit_price = 0 AND membership_credit_effect = true → clube_do_chefe
 * 2. paidAmount = 0 AND NOT club credit → cortesia
 * 3. discount >= grossValue AND grossValue > 0 → desconto_integral
 * 4. paidAmount = 0 → comanda_nao_paga
 * 5. Otherwise → null (commission is not zero)
 *
 * IMPORTANT: Never guess. If evidence is ambiguous, return 'outro'.
 */
export const detectZeroReason = (
  unitPrice: number,
  grossValue: number,
  paidAmount: number,
  discount: number,
  membershipCreditEffect: boolean,
): ZeroCommissionReason | null => {
  if (paidAmount > 0) return null;

  if (unitPrice === 0 && membershipCreditEffect) {
    return 'clube_do_chefe';
  }
  if (discount > 0 && discount >= grossValue && grossValue > 0) {
    return 'desconto_integral';
  }
  if (unitPrice === 0 && !membershipCreditEffect) {
    return 'cortesia';
  }
  if (grossValue > 0 && paidAmount === 0) {
    return 'comanda_nao_paga';
  }
  return 'outro';
};

/**
 * FIX-001 R7: Calculate commission reversal amount.
 *
 * Formula:
 *   proportion = reversedAmount / originalReceivedValue
 *   commissionReversal = originalCommission × proportion
 *
 * Guards:
 *   - proportion capped at 1.0 (never reverse more than 100%)
 *   - reversalAmount capped at originalCommission
 *   - returns 0 if originalReceivedValue <= 0
 */
export const calculateCommissionReversal = (
  originalCommission: number,
  reversedAmount: number,
  originalReceivedValue: number,
): number => {
  if (originalReceivedValue <= 0) return 0;
  if (reversedAmount <= 0) return 0;

  const proportion = Math.min(1, reversedAmount / originalReceivedValue);
  const reversalAmount = originalCommission * proportion;

  return Math.min(reversalAmount, originalCommission);
};

/**
 * Resolve the financial base for commission calculation.
 *
 * Formula:
 *   grossValue = resolveCommissionBase(item).value × quantity
 *   discount = item-level discount (proportional) or comanda-level discount
 *   netValue = max(0, grossValue - discount)
 *   receivedValue = min(netValue, paidAmount) — the effective amount received
 *   commissionBase = receivedValue × participantShare
 *
 * When credits are used (unit_price = 0), receivedValue = 0 → commission = 0.
 * When payment is partial, commission is proportional to what was received.
 * When discount is applied, netValue is reduced before calculating commission.
 */
export const resolveFinancialBase = (input: FinancialBaseInput): FinancialBaseResult => {
  const { item, discount = 0, paidAmount, quantity = 1 } = input;

  const grossChoice = resolveCommissionBase(item);
  const grossValue = grossChoice.value * quantity;

  const itemDiscount = Math.min(discount, grossValue);
  const netValue = Math.max(0, grossValue - itemDiscount);

  const effectivePaid = paidAmount !== undefined ? Math.max(0, paidAmount) : netValue;
  const receivedValue = Math.min(netValue, effectivePaid);

  const zeroReason = receivedValue <= 0 && grossValue > 0
    ? detectZeroReason(grossChoice.value, grossValue, effectivePaid, itemDiscount, false)
    : null;

  return {
    grossValue,
    discount: itemDiscount,
    netValue,
    receivedValue,
    quantity,
    source: grossChoice.field,
    reason: grossChoice.reason,
    zeroReason,
  };
};

/**
 * Calculates the commission value for a single participant.
 *
 * FIX-001: Now accepts receivedValue instead of itemValue.
 * Formula:
 *   if fixed: payout_value × commissionRate
 *   if percentage: receivedValue × payout_share × commissionRate
 *
 * When receivedValue = 0 (e.g., credits, courtesy), commission = 0.
 */
export const calculateParticipantPayout = (
  receivedValue: number,
  participant: ParticipantRow,
): number => {
  if (!participant.affects_commission) return 0;
  const rate = normalizePercentage(participant.payout_value);
  if (participant.payout_type === 'percentage') {
    return receivedValue * rate;
  }
  return Math.min(participant.payout_value, receivedValue);
};

/**
 * Calculates the base value of a participant for shared execution.
 *
 * FIX-001: Uses receivedValue instead of itemValue.
 * If fixed: returns min(payout_value, receivedValue).
 * If percentage: returns receivedValue × payout_share.
 */
export const calculateParticipantBaseValue = (
  receivedValue: number,
  participant: ParticipantRow,
): number => {
  const rate = normalizePercentage(participant.payout_value);
  if (participant.payout_type === 'fixed') {
    return Math.min(participant.payout_value, receivedValue);
  }
  return receivedValue * rate;
};

/**
 * Calculates the total payout of all participants with affects_commission.
 *
 * FIX-001: Uses receivedValue instead of itemValue.
 */
export const calculateTotalPayouts = (
  receivedValue: number,
  participants: ParticipantRow[],
): number => {
  return participants
    .filter((p) => p.affects_commission)
    .reduce((sum, p) => sum + calculateParticipantPayout(receivedValue, p), 0);
};

/**
 * Calculates the commission value for a professional.
 *
 * FIX-001: Uses receivedValue instead of itemValue.
 * Formula:
 *   if fixed: min(payout_value, receivedValue) × commissionRate
 *   if percentage: receivedValue × payout_share × commissionRate
 *
 * The participantShare parameter is the proportion of the receivedValue
 * attributed to this participant (e.g., 0.5 for 50% split).
 */
export const calculateCommissionValue = (
  receivedValue: number,
  participant: ParticipantRow,
  commissionRate: number,
): number => {
  if (!participant.affects_commission) return 0;
  const rate = normalizePercentage(commissionRate);

  if (participant.payout_type === 'fixed') {
    const base = Math.min(participant.payout_value, receivedValue);
    return base * rate;
  }

  const participantBase = receivedValue * normalizePercentage(participant.payout_value);
  return participantBase * rate;
};

/**
 * Determines if a staff member is eligible for commission.
 *
 * FIX-001: Managers with commission_rate > 0 are now eligible.
 * This supports operational managers (like Rubens) who participate
 * in service execution and should earn commission.
 *
 * Rule: barber | seller | (manager with commission_rate > 0)
 */
export const isCommissionEligible = (staff: StaffRoleLike): boolean => {
  const role = (staff.role || '').toLowerCase();
  if (role === 'barber' || role === 'seller') return true;
  if (role === 'manager') {
    const rate = Number(staff.commission_rate ?? 0);
    return rate > 0;
  }
  return false;
};

/**
 * Returns the effective commission rate for a staff member.
 * Returns 0 if not eligible for commission.
 */
export const getEffectiveRate = (staff: StaffRoleLike): number => {
  if (!isCommissionEligible(staff)) return 0;
  return normalizePercentage(staff.commission_rate ?? 0);
};

/**
 * Returns the default commission rate for a role.
 * Barbeiro/vendedor: 50%, manager: 0% (must be explicitly set).
 */
export const getDefaultRateForRole = (role: string): number => {
  const normalized = (role || '').toLowerCase();
  if (normalized === 'barber' || normalized === 'seller') return 0.5;
  return 0;
};
