/**
 * [SMG][DOMAIN][COMMISSION] types
 *
 * Tipos centrais do domínio de comissões.
 * Extraídos de pages/Commissions.tsx e src/types/executionParticipants.ts.
 */

export type CommissionTypeFilter = 'all' | 'solo' | 'shared';
export type ProductionDateSource = 'appointment_start' | 'comanda_closed_at' | 'comanda_created_at';

/**
 * FIX-001 R2: Controlled enumeration for why commission is zero.
 * Used for audit trail and reporting — never guess, always detect from evidence.
 */
export type ZeroCommissionReason =
  | 'clube_do_chefe'
  | 'cortesia'
  | 'desconto_integral'
  | 'comanda_nao_paga'
  | 'estorno_integral'
  | 'estorno_parcial'
  | 'outro';

export interface CommissionBaseChoice {
  value: number;
  field: string;
  reason: string;
}

export interface FinancialBaseInput {
  /** Item with unit_price, price, amount, quantity */
  item: Record<string, unknown>;
  /** Discount applied to this item (absolute value) */
  discount?: number;
  /** Amount effectively paid for this item */
  paidAmount?: number;
  /** Item quantity (defaults to 1) */
  quantity?: number;
}

export interface FinancialBaseResult {
  /** Gross value before discount (unit_price × quantity) */
  grossValue: number;
  /** Discount applied (capped at grossValue) */
  discount: number;
  /** Net value after discount (grossValue - discount) */
  netValue: number;
  /** Effective value received (min(netValue, paidAmount)) */
  receivedValue: number;
  /** Item quantity */
  quantity: number;
  /** Which field was used to resolve gross value */
  source: string;
  /** Reason for the chosen source */
  reason: string;
  /** FIX-001 R2: Why commission is zero (null when commission > 0) */
  zeroReason: ZeroCommissionReason | null;
}

export interface CommissionAuditLine {
  comanda_id: string;
  client_name: string;
  comanda_status: string;
  payment_status: string;
  payment_method: string;
  comanda_total: number;
  comanda_paid_amount: number | string;
  item_name: string;
  item_type: string;
  item_value: number;
  item_quantity: number;
  commission_base: number;
  commission_rate: number;
  commission_value: number;
  staff_name: string;
  staff_role: string;
  is_shared: boolean;
  participant_count: number;
  participant_names: string;
  division_method: string;
  date_source: string;
  appointment_date: string | null;
  comanda_created_at: string;
  discount_amount: number;
}

export interface CommissionLine {
  id: string;
  comandaId: string;
  comandaItemId: string;
  createdAt: string;
  clientName: string;
  serviceName: string;
  quantity: number;
  itemValue: number;
  commissionBase: number;
  commissionRate: number;
  commissionValue: number;
  sharedValue: number;
  divisionLaunched: string;
  baseByParticipant: string;
  isShared: boolean;
  participantNames: string;
  comandaStatus: string;
  paymentStatus: string;
  commissionStatus: string;
  paymentMethod: string;
  audit: CommissionAuditLine;
  dateSource: ProductionDateSource;
  discountAmount: number;
  /** FIX-001 R2: Why commission is zero (null when commission > 0) */
  zeroReason: ZeroCommissionReason | null;
}

export interface CommissionRow {
  id: string;
  staffId: string;
  staffName: string;
  staffRole: string;
  commissionRate: number;
  totalItems: number;
  totalSales: number;
  confirmedCommission: number;
  pendingCommission: number;
  cancelledCommission: number;
  lastItemDate: string;
  lines: CommissionLine[];
}

export interface ParticipantRow {
  id: string;
  comanda_item_id: string;
  staff_id: string | null;
  professional_id: string | null;
  role: string;
  payout_type: string;
  payout_value: number;
  affects_commission: boolean;
}

export interface StaffRoleLike {
  role: string;
  commission_rate?: number | null;
}

export interface ServiceItemLike {
  service_id?: string;
  type?: string;
  item_type?: string;
}
