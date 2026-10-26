export type BankAccountType = 'checking' | 'savings' | 'investment' | 'payment_gateway' | 'cash';

export interface BankAccount {
  id: string;
  tenant_id: string;
  name: string;
  bank_name: string;
  bank_code?: string | null;
  agency?: string | null;
  account_number?: string | null;
  account_type: BankAccountType;
  initial_balance: number;
  current_balance: number;
  color?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BankStatement {
  id: string;
  tenant_id: string;
  bank_account_id: string;
  filename: string;
  file_format: 'ofx' | 'csv' | 'manual';
  period_start?: string | null;
  period_end?: string | null;
  opening_balance?: number | null;
  closing_balance?: number | null;
  transactions_count: number;
  imported_by?: string | null;
  created_at: string;
}

export type StatementTransactionStatus = 'unreconciled' | 'reconciled' | 'ignored';

export interface BankStatementTransaction {
  id: string;
  tenant_id: string;
  statement_id: string;
  bank_account_id: string;
  fitid: string;
  transaction_date: string;
  amount: number; // positive = credit/deposit, negative = debit/payment
  transaction_type: 'credit' | 'debit' | 'other';
  description: string;
  memo?: string | null;
  status: StatementTransactionStatus;
  reconciled_transaction_id?: string | null;
  reconciled_at?: string | null;
  reconciled_by?: string | null;
  notes?: string | null;
  created_at: string;
  reconciled_transaction?: {
    id: string;
    description: string;
    amount: number;
    type: 'income' | 'expense';
    date: string;
    category?: string;
  } | null;
}

export interface SystemTransactionCandidate {
  id: string;
  tenant_id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  date: string;
  category: string;
  payment_method?: string | null;
  matchScore?: number; // 0 to 100
  matchReason?: string;
}

export interface ReconciliationSummary {
  bankBalance: number;
  systemBalance: number;
  difference: number;
  reconciledCount: number;
  unreconciledCount: number;
  ignoredCount: number;
  totalStatementCount: number;
  reconciliationPercentage: number;
}

export interface CreateBankAccountInput {
  name: string;
  bank_name: string;
  bank_code?: string;
  agency?: string;
  account_number?: string;
  account_type: BankAccountType;
  initial_balance: number;
  color?: string;
}

export interface CreateTransactionFromStatementInput {
  tenant_id: string;
  bank_account_id: string;
  statement_transaction_id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  date: string;
  category: string;
  payment_method?: string;
}
