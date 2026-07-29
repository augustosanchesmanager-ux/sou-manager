/**
 * [SMG][DOMAIN][CASH_CLOSING] types
 *
 * Tipos do domínio de fechamento de caixa.
 * Tabelas: cash_closings, barber_closings, cash_closing_events
 *
 * Reutiliza os tipos já definidos em cashCloseUtils.ts para manter
 * compatibilidade com o código existente.
 */

export type CashClosingStatus = 'draft' | 'confirmed' | 'adjusted';
export type BarberClosingStatus = 'open' | 'closed' | 'discrepancy';
export type CashClosingEventType =
  | 'opening'
  | 'service'
  | 'sangria'
  | 'suprimento'
  | 'reversal'
  | 'closing'
  | 'barber_closing'
  | 'audit'
  | 'adjustment';

export interface CashClosingRecord {
  id: string;
  tenant_id: string;
  business_date: string;
  period_start: string;
  period_end: string;
  status: CashClosingStatus;
  created_by_user_id: string | null;
  confirmed_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  confirmed_at: string | null;
  notes: string | null;
  expected_income: number;
  expected_expense: number;
  expected_balance: number;
  total_counted: number;
  total_difference: number;
  opening_time: string | null;
  closing_time: string | null;
  ip_address: string | null;
  total_sangrias: number;
  total_suprimentos: number;
  barber_closings_count: number;
  barber_closings_complete: boolean;
  appointments_scheduled_count: number;
  appointments_completed_count: number;
  appointments_received_count: number;
  appointments_cancelled_count: number;
  appointments_pending_count: number;
  appointments_no_show_count: number;
  appointments_summary: string | Record<string, unknown>;
  financial_summary: string | Record<string, unknown>;
}

export interface BarberClosingRecord {
  id: string;
  tenant_id: string;
  cash_closing_id: string;
  business_date: string;
  staff_id: string;
  status: BarberClosingStatus;
  total_produced: number;
  total_received: number;
  commission_total: number;
  repasse_total: number;
  discounts_total: number;
  advances_total: number;
  balance: number;
  payment_methods: Record<string, number>;
  counted_cash: number;
  expected_cash: number;
  cash_difference: number;
  conference_justification: string | null;
  checklist: Record<string, boolean>;
  comandas_count: number;
  clients_served_count: number;
  products_sold_count: number;
  closed_by_user_id: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CashClosingEventRecord {
  id: string;
  tenant_id: string;
  cash_closing_id: string | null;
  barber_closing_id: string | null;
  business_date: string;
  event_type: CashClosingEventType;
  event_time: string;
  label: string;
  detail: string | null;
  metadata: Record<string, unknown>;
  created_by_user_id: string | null;
  created_at: string;
}
