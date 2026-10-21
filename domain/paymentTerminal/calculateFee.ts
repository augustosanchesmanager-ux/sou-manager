/**
 * [SMG][DOMAIN][PAYMENT_TERMINAL] calculateFee
 *
 * Cálculo puro e determinístico de taxas de maquininhas e previsão de liquidação (ADR-036).
 *
 * FÓRMULAS:
 *   fee_amount = roundCents((amount * (rate_percentage / 100)) + fixed_fee)
 *   net_amount = roundCents(amount - fee_amount)
 *   estimated_settlement_date = paymentDate + settlement_days (dias úteis)
 */

import { roundCents } from '../payout/money';
import type {
  CalculateFeeParams,
  FeeCalculationResult,
  PaymentTerminalRate,
  TerminalRateMethod,
} from './types';

/**
 * Adiciona dias úteis (segunda a sexta) a uma data, retornando no formato YYYY-MM-DD.
 */
export function addBusinessDays(startDate: Date | string, businessDays: number): string {
  const date = typeof startDate === 'string' ? new Date(startDate) : new Date(startDate);

  // Garantir data válida
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().split('T')[0];
  }

  let remainingDays = Math.max(0, Math.floor(businessDays));

  while (remainingDays > 0) {
    date.setDate(date.getDate() + 1);
    const dayOfWeek = date.getDay();
    // 0 = Domingo, 6 = Sábado
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      remainingDays -= 1;
    }
  }

  return date.toISOString().split('T')[0];
}

/**
 * Encontra a taxa mais aplicável para um terminal, método de pagamento e número de parcelas.
 */
export function findMatchingRate(
  rates: PaymentTerminalRate[],
  method: TerminalRateMethod,
  installments = 1,
): PaymentTerminalRate | null {
  if (!rates || rates.length === 0) return null;

  const matchingMethod = rates.filter((r) => r.method === method);
  if (matchingMethod.length === 0) return null;

  // Se for parcelado, busca a faixa exata
  if (method === 'credit_installment') {
    const rangeMatch = matchingMethod.find(
      (r) => installments >= r.installments_min && installments <= r.installments_max,
    );
    return rangeMatch || matchingMethod[0];
  }

  return matchingMethod[0];
}

/**
 * Realiza o cálculo contábil da taxa e do valor líquido previsto.
 */
export function calculateTerminalFee(params: CalculateFeeParams): FeeCalculationResult {
  const grossAmount = Math.max(0, roundCents(Number(params.amount) || 0));
  const rate = params.rate;

  if (!rate || (Number(rate.rate_percentage || 0) <= 0 && Number(rate.fixed_fee || 0) <= 0)) {
    return {
      feePercentage: 0,
      feeAmount: 0,
      netAmount: grossAmount,
      fixedFee: 0,
      settlementDays: 0,
      estimatedSettlementDate: null,
    };
  }

  const feePercentage = Number(rate.rate_percentage) || 0;
  const fixedFee = roundCents(Number(rate.fixed_fee) || 0);

  const percentageAmount = (grossAmount * feePercentage) / 100;
  const rawFee = percentageAmount + fixedFee;
  const feeAmount = roundCents(Math.min(grossAmount, rawFee));
  const netAmount = roundCents(Math.max(0, grossAmount - feeAmount));

  const settlementDays = Math.max(0, Math.floor(Number(rate.settlement_days) || 0));
  const paymentDate = params.paymentDate || new Date();
  const estimatedSettlementDate = settlementDays > 0
    ? addBusinessDays(paymentDate, settlementDays)
    : (typeof paymentDate === 'string' ? paymentDate.split('T')[0] : paymentDate.toISOString().split('T')[0]);

  return {
    feePercentage,
    feeAmount,
    netAmount,
    fixedFee,
    settlementDays,
    estimatedSettlementDate,
  };
}
