/**
 * [SMG][DOMAIN][PAYMENT_TERMINAL] cardFeeSplitEngine.ts
 *
 * Motor puro e determinístico de rateio de taxas de maquininha de cartão
 * sobre as comissões dos profissionais (Frente B - Paridade AppBarber).
 *
 * POLÍTICAS SUPORTADAS:
 *   - 'gross': Barbearia absorve 100% da taxa da maquininha (barbeiro isento de taxa administrativa).
 *   - 'split': Taxa da maquininha é rateada proporcionalmente à comissão (ex: se barbeiro ganha 50%, arca com 50% da taxa).
 *   - 'deducted': A taxa da maquininha é deduzida da comissão do profissional.
 *
 * TRANSPARÊNCIA:
 *   - Quando a taxa for 0% ou quando a política for 'gross', sinaliza explicitamente:
 *     "Isento de taxa administrativa da máquina", exibindo o valor absorvido pela casa.
 */

import { roundCents } from '../payout/money';

export type CardFeePolicy = 'gross' | 'split' | 'deducted';

export interface CardFeeSplitInput {
  grossAmount: number;
  commissionRate: number; // Percentual 0 a 100 (ex: 50 = 50%)
  feePercentage: number; // Taxa percentual da máquina (ex: 2.89)
  fixedFee?: number; // Taxa fixa em R$ (opcional, default 0)
  policy?: CardFeePolicy; // Default: 'gross'
}

export interface CardFeeSplitResult {
  grossAmount: number;
  baseCommission: number;
  feeAmount: number;
  feePercentage: number;
  policy: CardFeePolicy;
  barberFeeDeduction: number;
  shopFeeAbsorption: number;
  netCommission: number;
  isFeeExempt: boolean;
  exemptValue: number;
  exemptionBadgeText: string | null;
}

export const EXEMPTION_BADGE_TEXT = 'Isento de taxa administrativa da máquina';

/**
 * Resolve a política efetiva de taxa de cartão para um profissional,
 * priorizando o ajuste individual do barbeiro com fallback para a regra da barbearia.
 */
export function resolveCardFeePolicyForStaff(
  staffPolicy?: string | null,
  tenantDefaultPolicy?: string | null
): CardFeePolicy {
  const validPolicies: CardFeePolicy[] = ['gross', 'split', 'deducted'];

  if (staffPolicy && validPolicies.includes(staffPolicy as CardFeePolicy)) {
    return staffPolicy as CardFeePolicy;
  }

  if (tenantDefaultPolicy && validPolicies.includes(tenantDefaultPolicy as CardFeePolicy)) {
    return tenantDefaultPolicy as CardFeePolicy;
  }

  return 'gross'; // Padrão seguro e favorável à retenção do profissional
}

/**
 * Calcula a divisão da taxa da maquininha e a comissão líquida do barbeiro.
 */
export function calculateCardFeeSplit(input: CardFeeSplitInput): CardFeeSplitResult {
  const grossAmount = Math.max(0, roundCents(Number(input.grossAmount) || 0));
  const commissionRate = Math.max(0, Math.min(100, Number(input.commissionRate) || 0));
  const feePercentage = Math.max(0, Number(input.feePercentage) || 0);
  const fixedFee = Math.max(0, roundCents(Number(input.fixedFee) || 0));
  const policy: CardFeePolicy = input.policy || 'gross';

  // Comissão nominal teórica sobre o valor bruto
  const baseCommission = roundCents((grossAmount * commissionRate) / 100);

  // Taxa total cobrada pela operadora da maquininha
  const percentageFee = (grossAmount * feePercentage) / 100;
  const rawFeeAmount = percentageFee + fixedFee;
  const feeAmount = roundCents(Math.min(grossAmount, rawFeeAmount));

  // Cenário 1: Taxa zerada (dinheiro, pix sem taxa ou taxa 0%)
  if (feeAmount <= 0) {
    return {
      grossAmount,
      baseCommission,
      feeAmount: 0,
      feePercentage: 0,
      policy,
      barberFeeDeduction: 0,
      shopFeeAbsorption: 0,
      netCommission: baseCommission,
      isFeeExempt: true,
      exemptValue: 0,
      exemptionBadgeText: EXEMPTION_BADGE_TEXT,
    };
  }

  // Cenário 2: Política 'gross' (Barbearia absorve 100% da taxa)
  if (policy === 'gross') {
    // A parcela da taxa que o barbeiro pagaria em um modelo de rateio proporcional é a isenção que ele recebeu
    const exemptValue = roundCents(feeAmount * (commissionRate / 100));

    return {
      grossAmount,
      baseCommission,
      feeAmount,
      feePercentage,
      policy: 'gross',
      barberFeeDeduction: 0,
      shopFeeAbsorption: feeAmount,
      netCommission: baseCommission,
      isFeeExempt: true,
      exemptValue,
      exemptionBadgeText: EXEMPTION_BADGE_TEXT,
    };
  }

  // Cenário 3: Política 'split' (Rateio proporcional à comissão)
  if (policy === 'split') {
    const barberFeeDeduction = roundCents(feeAmount * (commissionRate / 100));
    const shopFeeAbsorption = roundCents(feeAmount - barberFeeDeduction);
    const netCommission = roundCents(Math.max(0, baseCommission - barberFeeDeduction));

    return {
      grossAmount,
      baseCommission,
      feeAmount,
      feePercentage,
      policy: 'split',
      barberFeeDeduction,
      shopFeeAbsorption,
      netCommission,
      isFeeExempt: false,
      exemptValue: 0,
      exemptionBadgeText: null,
    };
  }

  // Cenário 4: Política 'deducted' (Taxa deduzida da parcela do barbeiro)
  const barberFeeDeduction = roundCents(Math.min(baseCommission, feeAmount));
  const shopFeeAbsorption = roundCents(Math.max(0, feeAmount - barberFeeDeduction));
  const netCommission = roundCents(Math.max(0, baseCommission - barberFeeDeduction));

  return {
    grossAmount,
    baseCommission,
    feeAmount,
    feePercentage,
    policy: 'deducted',
    barberFeeDeduction,
    shopFeeAbsorption,
    netCommission,
    isFeeExempt: false,
    exemptValue: 0,
    exemptionBadgeText: null,
  };
}
