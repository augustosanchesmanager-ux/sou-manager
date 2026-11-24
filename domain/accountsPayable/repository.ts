// ============================================================================
// P0.4 — Contas a Pagar — Repository
// ============================================================================

import { SupabaseClient } from '@supabase/supabase-js';
import {
  RecurringBill,
  AccountPayable,
  AccountPayableStatus,
  AccountsPayableFilters,
  PayAccountPayableResult,
  CancelAccountPayableResult,
  CreateAccountPayableFromRecurringResult,
} from './types';

export interface CreateOneTimeAPResult {
  success: boolean;
  id?: string;
  created?: boolean;
  message?: string;
}

export interface CreateRecurringBillResult {
  success: boolean;
  id?: string;
  created?: boolean;
  message?: string;
}

export interface AccountsPayableRepository {
  // Recurring Bills
  createRecurringBill(data: { name: string; amount: number; due_day: number; category?: string; notes?: string; idempotency_key: string }): Promise<CreateRecurringBillResult>;
  updateRecurringBill(id: string, tenantId: string, data: Partial<Pick<RecurringBill, 'name' | 'amount' | 'due_day' | 'category' | 'notes' | 'is_active'>>): Promise<RecurringBill>;
  deleteRecurringBill(id: string, tenantId: string): Promise<void>;
  getRecurringBillsByTenant(tenantId: string): Promise<RecurringBill[]>;
  getRecurringBillById(id: string, tenantId: string): Promise<RecurringBill | null>;

  // Accounts Payable
  getAccountsPayableByTenant(tenantId: string, filters?: AccountsPayableFilters): Promise<AccountPayable[]>;
  getAccountsPayableById(id: string, tenantId: string): Promise<AccountPayable | null>;
  createOneTimeAccountPayable(data: { name: string; amount: number; due_date: string; category?: string; notes?: string; idempotency_key: string }): Promise<CreateOneTimeAPResult>;
  updateAccountPayable(id: string, tenantId: string, data: Partial<Pick<AccountPayable, 'amount' | 'due_date' | 'category' | 'notes'>>): Promise<AccountPayable>;

  // RPCs
  payAccountPayable(apId: string, paymentMethod?: string, paidAt?: string): Promise<PayAccountPayableResult>;
  cancelAccountPayable(apId: string): Promise<CancelAccountPayableResult>;
  createAccountsPayableFromRecurring(recurringBillId: string, month: number, year: number): Promise<CreateAccountPayableFromRecurringResult>;
}

export function createAccountsPayableRepository(supabase: SupabaseClient): AccountsPayableRepository {
  return {
    // Recurring Bills
    async createRecurringBill(data) {
      const { data: result, error } = await supabase.rpc('create_recurring_bill', {
        p_name: data.name,
        p_amount: data.amount,
        p_due_day: data.due_day,
        p_idempotency_key: data.idempotency_key,
        p_category: data.category || 'Outros',
        p_notes: data.notes || null,
      });

      if (error) throw error;
      return result;
    },

    async updateRecurringBill(id, tenantId, data) {
      if (!tenantId) throw new Error('tenantId é obrigatório para updateRecurringBill.');
      const { data: result, error } = await supabase
        .from('recurring_bills')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('tenant_id', tenantId)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },

    async deleteRecurringBill(id, tenantId) {
      if (!tenantId) throw new Error('tenantId é obrigatório para deleteRecurringBill.');
      const { error } = await supabase
        .from('recurring_bills')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('id', id);

      if (error) throw error;
    },

    async getRecurringBillsByTenant(tenantId) {
      const { data, error } = await supabase
        .from('recurring_bills')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('name');

      if (error) throw error;
      return data || [];
    },

    async getRecurringBillById(id, tenantId) {
      if (!tenantId) throw new Error('tenantId é obrigatório para getRecurringBillById.');
      const { data, error } = await supabase
        .from('recurring_bills')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },

    // Accounts Payable
    async getAccountsPayableByTenant(tenantId, filters) {
      let query = supabase
        .from('accounts_payable')
        .select('*')
        .eq('tenant_id', tenantId);

      const status = filters?.status;
      const month = filters?.competenceMonth ?? filters?.competence_month;
      const year = filters?.competenceYear ?? filters?.competence_year;

      if (status) {
        query = query.eq('status', status);
      }
      if (month !== undefined && month !== null) {
        query = query.eq('competence_month', month);
      }
      if (year !== undefined && year !== null) {
        query = query.eq('competence_year', year);
      }

      const { data, error } = await query.order('due_date', { ascending: true });

      if (error) throw error;
      return data || [];
    },

    async getAccountsPayableById(id, tenantId) {
      if (!tenantId) throw new Error('tenantId é obrigatório para getAccountsPayableById.');
      const { data, error } = await supabase
        .from('accounts_payable')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },

    async createOneTimeAccountPayable(data) {
      const { data: result, error } = await supabase.rpc('create_one_time_account_payable', {
        p_name: data.name,
        p_amount: data.amount,
        p_due_date: data.due_date,
        p_idempotency_key: data.idempotency_key,
        p_category: data.category || 'outros',
        p_notes: data.notes || null,
      });

      if (error) throw error;
      return result;
    },

    async updateAccountPayable(id, tenantId, data) {
      if (!tenantId) throw new Error('tenantId é obrigatório para updateAccountPayable.');
      const { data: result, error } = await supabase
        .from('accounts_payable')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('tenant_id', tenantId)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },

    // RPCs
    async payAccountPayable(apId, paymentMethod, paidAt) {
      const { data, error } = await supabase.rpc('pay_account_payable', {
        p_ap_id: apId,
        p_payment_method: paymentMethod || 'Não informado',
        p_paid_at: paidAt || new Date().toISOString(),
      });

      if (error) throw error;
      return data;
    },

    async cancelAccountPayable(apId) {
      const { data, error } = await supabase.rpc('cancel_account_payable', {
        ap_id: apId,
      });

      if (error) throw error;
      return data;
    },

    async createAccountsPayableFromRecurring(recurringBillId, month, year) {
      const { data, error } = await supabase.rpc('create_accounts_payable_from_recurring', {
        p_recurring_bill_id: recurringBillId,
        p_month: month,
        p_year: year,
      });

      if (error) throw error;
      return data;
    },
  };
}
