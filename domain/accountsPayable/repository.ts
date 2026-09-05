// ============================================================================
// P0.4 — Contas a Pagar — Repository
// ============================================================================

import { SupabaseClient } from '@supabase/supabase-js';
import {
  RecurringBill,
  AccountPayable,
  AccountPayableStatus,
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

export interface AccountsPayableRepository {
  // Recurring Bills
  createRecurringBill(data: Omit<RecurringBill, 'id' | 'created_at' | 'updated_at'>): Promise<RecurringBill>;
  updateRecurringBill(id: string, data: Partial<Pick<RecurringBill, 'name' | 'amount' | 'due_day' | 'category' | 'notes' | 'is_active'>>): Promise<RecurringBill>;
  deleteRecurringBill(id: string): Promise<void>;
  getRecurringBillsByTenant(tenantId: string): Promise<RecurringBill[]>;
  getRecurringBillById(id: string): Promise<RecurringBill | null>;

  // Accounts Payable
  getAccountsPayableByTenant(tenantId: string, filters?: { status?: AccountPayableStatus; competenceMonth?: number; competenceYear?: number }): Promise<AccountPayable[]>;
  getAccountsPayableById(id: string): Promise<AccountPayable | null>;
  createOneTimeAccountPayable(data: { name: string; amount: number; due_date: string; category?: string; notes?: string; idempotency_key: string }): Promise<CreateOneTimeAPResult>;
  updateAccountPayable(id: string, data: Partial<Pick<AccountPayable, 'amount' | 'due_date' | 'category' | 'notes'>>): Promise<AccountPayable>;

  // RPCs
  payAccountPayable(apId: string): Promise<PayAccountPayableResult>;
  cancelAccountPayable(apId: string): Promise<CancelAccountPayableResult>;
  createAccountsPayableFromRecurring(recurringBillId: string, month: number, year: number): Promise<CreateAccountPayableFromRecurringResult>;
}

export function createAccountsPayableRepository(supabase: SupabaseClient): AccountsPayableRepository {
  return {
    // Recurring Bills
    async createRecurringBill(data) {
      const { data: result, error } = await supabase
        .from('recurring_bills')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },

    async updateRecurringBill(id, data) {
      const { data: result, error } = await supabase
        .from('recurring_bills')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },

    async deleteRecurringBill(id) {
      const { error } = await supabase
        .from('recurring_bills')
        .delete()
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

    async getRecurringBillById(id) {
      const { data, error } = await supabase
        .from('recurring_bills')
        .select('*')
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

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.competenceMonth) {
        query = query.eq('competence_month', filters.competenceMonth);
      }
      if (filters?.competenceYear) {
        query = query.eq('competence_year', filters.competenceYear);
      }

      const { data, error } = await query.order('due_date', { ascending: true });

      if (error) throw error;
      return data || [];
    },

    async getAccountsPayableById(id) {
      const { data, error } = await supabase
        .from('accounts_payable')
        .select('*')
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

    async updateAccountPayable(id, data) {
      const { data: result, error } = await supabase
        .from('accounts_payable')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },

    // RPCs
    async payAccountPayable(apId) {
      const { data, error } = await supabase.rpc('pay_account_payable', {
        ap_id: apId,
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
