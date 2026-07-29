/**
 * [SMG][DOMAIN][RECEIVABLE] types
 *
 * Tipos centrais do domínio de recebimentos de assinatura do Clube.
 */

export type ReceivableStatus = 'pending' | 'paid' | 'overdue' | 'cancelled' | 'refunded';

export interface CustomerSubscriptionReceivable {
  id: string;
  tenant_id: string;
  customer_id: string;
  subscription_id: string;
  plan_id: string;
  billing_cycle_start: string;
  billing_cycle_end: string;
  due_date: string;
  amount: number;
  status: ReceivableStatus;
  payment_method: string | null;
  paid_at: string | null;
  transaction_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface ReceivableListOptions {
  status?: ReceivableStatus;
  statuses?: ReceivableStatus[];
  customerId?: string;
  subscriptionId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}
