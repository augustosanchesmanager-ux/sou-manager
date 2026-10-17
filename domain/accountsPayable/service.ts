// ============================================================================
// P0.4 — Contas a Pagar — Application Service
// ============================================================================

import {
  RecurringBill,
  AccountPayable,
  AccountPayableWithOverdue,
  AccountPayableStatus,
  AccountsPayableFilters,
  PayAccountPayableResult,
  CancelAccountPayableResult,
  CreateAccountPayableFromRecurringResult,
} from './types';
import { AccountsPayableRepository, CreateOneTimeAPResult, CreateRecurringBillResult } from './repository';

export interface AccountsPayableApplicationService {
  // Recurring Bills
  createRecurringBill(data: { name: string; amount: number; due_day: number; category?: string; notes?: string; idempotency_key: string }): Promise<CreateRecurringBillResult>;
  updateRecurringBill(id: string, data: Partial<Pick<RecurringBill, 'name' | 'amount' | 'due_day' | 'category' | 'notes' | 'is_active'>>): Promise<RecurringBill>;
  deactivateRecurringBill(id: string): Promise<void>;
  getRecurringBills(): Promise<RecurringBill[]>;

  // Accounts Payable
  listAccountsPayable(filters?: AccountsPayableFilters): Promise<AccountPayableWithOverdue[]>;
  getAccountsPayableById(id: string): Promise<AccountPayableWithOverdue | null>;
  createOneTimeAccountPayable(data: { name: string; amount: number; due_date: string; category?: string; notes?: string; idempotency_key: string }): Promise<CreateOneTimeAPResult>;
  editAccountPayable(id: string, data: Partial<Pick<AccountPayable, 'amount' | 'due_date' | 'category' | 'notes'>>): Promise<AccountPayable>;

  // Actions
  payAccountPayable(apId: string, paymentMethod?: string, paidAt?: string): Promise<PayAccountPayableResult>;
  cancelAccountPayable(apId: string): Promise<CancelAccountPayableResult>;

  // Recurrence generation
  ensureCurrentMonthInstances(month?: number, year?: number): Promise<void>;
  generateRecurringInstances(month?: number, year?: number): Promise<{ created: number; total: number }>;
  createAccountPayableFromRecurring(recurringBillId: string, month: number, year: number): Promise<CreateAccountPayableFromRecurringResult>;
}

export function createAccountsPayableApplicationService(
  repository: AccountsPayableRepository,
  tenantId: string,
  createdBy: string | null = null
): AccountsPayableApplicationService {
  return {
    // Recurring Bills
    async createRecurringBill(data) {
      return repository.createRecurringBill({
        name: data.name,
        amount: data.amount,
        due_day: data.due_day,
        category: data.category || 'Outros',
        notes: data.notes || null,
        idempotency_key: data.idempotency_key,
      });
    },

    async updateRecurringBill(id, data) {
      return repository.updateRecurringBill(id, data);
    },

    async deactivateRecurringBill(id) {
      await repository.updateRecurringBill(id, { is_active: false });
    },

    async getRecurringBills() {
      return repository.getRecurringBillsByTenant(tenantId);
    },

    // Accounts Payable
    async listAccountsPayable(filters) {
      const items = await repository.getAccountsPayableByTenant(tenantId, filters);
      return items.map(addOverdueFlag);
    },

    async getAccountsPayableById(id) {
      const item = await repository.getAccountsPayableById(id);
      return item ? addOverdueFlag(item) : null;
    },

    async createOneTimeAccountPayable(data) {
      return repository.createOneTimeAccountPayable({
        name: data.name,
        amount: data.amount,
        due_date: data.due_date,
        category: data.category || 'outros',
        notes: data.notes || null,
        idempotency_key: data.idempotency_key,
      });
    },

    async editAccountPayable(id, data) {
      return repository.updateAccountPayable(id, data);
    },

    // Actions
    async payAccountPayable(apId, paymentMethod, paidAt) {
      return repository.payAccountPayable(apId, paymentMethod, paidAt);
    },

    async cancelAccountPayable(apId) {
      return repository.cancelAccountPayable(apId);
    },

    // Recurrence generation
    async generateRecurringInstances(month?: number, year?: number) {
      const bills = await repository.getRecurringBillsByTenant(tenantId);
      const now = new Date();
      const targetMonth = month ?? (now.getMonth() + 1);
      const targetYear = year ?? now.getFullYear();

      let createdCount = 0;
      for (const bill of bills) {
        if (!bill.is_active) continue;

        try {
          const res = await repository.createAccountsPayableFromRecurring(bill.id, targetMonth, targetYear);
          if (res?.created) createdCount++;
        } catch (error) {
          // Log but don't fail — idempotência via UNIQUE constraint
          console.error(`Failed to create instance for bill ${bill.id}:`, error);
        }
      }
      return { created: createdCount, total: bills.filter((b) => b.is_active).length };
    },

    async ensureCurrentMonthInstances(month?: number, year?: number) {
      await this.generateRecurringInstances(month, year);
    },

    async createAccountPayableFromRecurring(recurringBillId, month, year) {
      return repository.createAccountsPayableFromRecurring(recurringBillId, month, year);
    },
  };
}

// Helper: derivar is_overdue em runtime (I4: OVERDUE não é status gravado)
export function addOverdueFlag(ap: AccountPayable): AccountPayableWithOverdue {
  const isOverdue = ap.status === 'pending' && new Date(ap.due_date) < new Date();
  return { ...ap, is_overdue: isOverdue };
}
