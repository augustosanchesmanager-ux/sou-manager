/**
 * [SMG][DOMAIN][COMMISSION] commissionRecordTypes
 *
 * Types for commission_records table.
 * Append-only: records are never updated or deleted.
 */

export type CommissionRecordType = 'commission' | 'reversal';

export interface CommissionRecord {
  id: string;
  tenant_id: string;
  record_type: CommissionRecordType;
  comanda_id: string;
  comanda_item_id: string | null;
  staff_id: string;
  gross_value: number;
  discount: number;
  net_value: number;
  received_value: number;
  commission_rate: number;
  commission_value: number;
  participant_share: number;
  payout_type: string;
  affects_commission: boolean;
  original_record_id: string | null;
  idempotency_key: string;
  event_id: string | null;
  event_type: string | null;
  status: string;
  created_at: string;
}

export interface CreateCommissionRecordInput {
  tenant_id: string;
  comanda_id: string;
  comanda_item_id?: string;
  staff_id: string;
  gross_value: number;
  discount?: number;
  net_value: number;
  received_value: number;
  commission_rate: number;
  commission_value: number;
  participant_share?: number;
  payout_type?: string;
  affects_commission?: boolean;
  idempotency_key: string;
  event_id?: string;
  event_type?: string;
}

export interface CommissionReversalResult {
  success: boolean;
  idempotent?: boolean;
  reversal_id?: string;
  original_record_id?: string;
  commission_value?: number;
  message?: string;
  error?: string;
}

export interface CommissionRecordListOptions {
  comanda_id?: string;
  staff_id?: string;
  record_type?: CommissionRecordType;
  dateFrom?: string;
  dateTo?: string;
}
