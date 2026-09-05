// ============================================================================
// P0.4 — Contas a Pagar — Types
// ============================================================================

export interface RecurringBill {
  id: string;
  tenant_id: string;
  name: string;
  amount: number;
  due_day: number;
  category: string;
  notes: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type AccountPayableStatus = 'pending' | 'paid' | 'cancelled';

export interface AccountPayable {
  id: string;
  tenant_id: string;
  recurring_bill_id: string | null;
  name: string;
  amount: number;
  due_date: string;
  competence_month: number;
  competence_year: number;
  category: string;
  notes: string | null;
  status: AccountPayableStatus;
  paid_at: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  paid_by: string | null;
  transaction_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Derivado — não gravado no banco
export interface AccountPayableWithOverdue extends AccountPayable {
  is_overdue: boolean;
}

export interface PayAccountPayableResult {
  success: boolean;
  transaction_id?: string;
  amount?: number;
  message?: string;
}

export interface CancelAccountPayableResult {
  success: boolean;
  message?: string;
}

export interface CreateAccountPayableFromRecurringResult {
  success: boolean;
  created?: boolean;
  existing_id?: string;
  message?: string;
}
