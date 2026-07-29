/**
 * [SMG][DOMAIN][TRANSACTION] types
 *
 * Tipos centrais do domínio de transações financeiras.
 */

export interface Transaction {
  id: string;
  tenant_id: string;
  type: string;
  category: string;
  amount: number;
  description: string;
  payment_method: string | null;
  date: string;
  status: string;
  source_type: string | null;
  source_id: string | null;
  created_at: string;
}

export interface CreateTransactionInput {
  type: string;
  category: string;
  amount: number;
  description: string;
  payment_method?: string | null;
  date: string;
  status?: string;
  source_type?: string | null;
  source_id?: string | null;
}

export interface UpdateTransactionInput {
  type?: string;
  category?: string;
  amount?: number;
  description?: string;
  payment_method?: string | null;
  date?: string;
  status?: string;
  source_type?: string | null;
  source_id?: string | null;
}

export interface TransactionListOptions {
  type?: string;
  status?: string;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  sourceType?: string;
  sourceId?: string;
  limit?: number;
}
