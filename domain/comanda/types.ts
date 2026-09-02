/**
 * [SMG][DOMAIN][COMANDA] types
 *
 * Tipos centrais do domínio de comandas.
 */

export interface Comanda {
  id: string;
  tenant_id: string;
  client_id: string | null;
  /** Denormalized — NOT present in comandas select. Resolve via clients when needed. */
  client_name?: string | null;
  appointment_id: string | null;
  staff_id: string | null;
  status: string;
  total: number;
  payment_method: string | null;
  /** NOT a comandas column. Notes live on transactions/closure_note. */
  notes?: string | null;
  created_at: string;
  closed_at: string | null;
}

export interface ComandaItem {
  id: string;
  comanda_id: string;
  service_id: string | null;
  name: string;
  type: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  staff_id: string | null;
  created_at: string;
}

export interface UpdateComandaInput {
  status?: string;
  total?: number;
  payment_method?: string | null;
  staff_id?: string | null;
  closed_at?: string | null;
  cancellation_type?: string | null;
  cancelled_at?: string | null;
  cancelled_by_user_id?: string | null;
  hidden_from_financial?: boolean;
  closure_note?: string | null;
}

export interface ComandaListOptions {
  staffId?: string;
  status?: string;
  clientId?: string;
  appointmentId?: string;
  dateFrom?: string;
  dateTo?: string;
}
