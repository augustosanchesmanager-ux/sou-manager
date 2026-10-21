/**
 * [SMG][DOMAIN][PAYMENT_TERMINAL] types
 *
 * Tipos canônicos para maquininhas de cartão, taxas de operadoras e
 * snapshots de liquidação (ADR-036).
 */

export type TerminalAcquirer =
  | 'Stone'
  | 'PagBank'
  | 'InfinitePay'
  | 'Cielo'
  | 'Rede'
  | 'Mercado Pago'
  | 'Ton'
  | 'SafraPay'
  | 'Outro';

export type TerminalRateMethod = 'debit' | 'credit_sight' | 'credit_installment' | 'pix';

export interface PaymentTerminal {
  id: string;
  tenant_id: string;
  name: string;
  acquirer: TerminalAcquirer | string;
  is_default: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PaymentTerminalRate {
  id: string;
  tenant_id: string;
  terminal_id: string;
  method: TerminalRateMethod;
  installments_min: number;
  installments_max: number;
  rate_percentage: number;
  fixed_fee: number;
  settlement_days: number;
  created_at?: string;
  updated_at?: string;
}

export interface PaymentTerminalWithRates extends PaymentTerminal {
  rates: PaymentTerminalRate[];
}

export interface CalculateFeeParams {
  amount: number;
  rate?: PaymentTerminalRate | null;
  paymentDate?: Date | string;
}

export interface FeeCalculationResult {
  feePercentage: number;
  feeAmount: number;
  netAmount: number;
  fixedFee: number;
  settlementDays: number;
  estimatedSettlementDate: string | null;
}
