/**
 * [SMG][DOMAIN][COMMISSION] types
 *
 * Tipos centrais do domínio de comissões.
 * Extraídos de pages/Commissions.tsx e src/types/executionParticipants.ts.
 */

export type CommissionTypeFilter = 'all' | 'solo' | 'shared';
export type ProductionDateSource = 'appointment_start' | 'comanda_closed_at' | 'comanda_created_at';

export interface CommissionBaseChoice {
  value: number;
  field: string;
  reason: string;
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
