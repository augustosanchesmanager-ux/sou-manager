import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useResolvedClient } from '@/src/hooks/useResolvedClient';
import {
  RecurringBill,
  AccountPayable,
  AccountPayableWithOverdue,
  AccountPayableStatus,
} from '@/domain/accountsPayable/types';
import { createAccountsPayableRepository } from '@/domain/accountsPayable/repository';
import { createAccountsPayableApplicationService } from '@/domain/accountsPayable/service';

/** Extract a human-readable message from any thrown value (including PostgrestError) */
function extractError(err: unknown): string {
  if (err && typeof err === 'object') {
    const obj = err as Record<string, unknown>;
    if (typeof obj.message === 'string') return obj.message;
    if (typeof obj.error === 'string') return obj.error;
    if (obj.error && typeof obj.error === 'object' && typeof (obj.error as Record<string, unknown>).message === 'string') {
      return String((obj.error as Record<string, unknown>).message);
    }
  }
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return `Erro desconhecido: ${JSON.stringify(err)}`;
}

export function useAccountsPayable() {
  const supabase = useResolvedClient();
  const { tenantId, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const repository = createAccountsPayableRepository(supabase);
  const service = createAccountsPayableApplicationService(repository, tenantId || '', user?.id ?? null);

  // Recurring Bills
  const [recurringBills, setRecurringBills] = useState<RecurringBill[]>([]);

  // Accounts Payable
  const [accountsPayable, setAccountsPayable] = useState<AccountPayableWithOverdue[]>([]);

  const fetchRecurringBills = useCallback(async () => {
    if (!tenantId) return;
    try {
      const bills = await service.getRecurringBills();
      setRecurringBills(bills);
    } catch (err) {
      setError(extractError(err));
    }
  }, [tenantId]);

  const fetchAccountsPayable = useCallback(async (filters?: { status?: AccountPayableStatus; competenceMonth?: number; competenceYear?: number }) => {
    if (!tenantId) return;
    try {
      setLoading(true);
      setError(null);
      const items = await service.listAccountsPayable(filters);
      setAccountsPayable(items);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  const ensureCurrentMonthInstances = useCallback(async () => {
    if (!tenantId) return;
    try {
      await service.ensureCurrentMonthInstances();
      await fetchAccountsPayable();
    } catch (err) {
      setError(extractError(err));
    }
  }, [tenantId, fetchAccountsPayable]);

  const createRecurringBill = useCallback(async (data: { name: string; amount: number; due_day: number; category?: string; notes?: string }) => {
    try {
      const bill = await service.createRecurringBill(data);
      setRecurringBills((prev) => [...prev, bill]);
      return bill;
    } catch (err) {
      setError(extractError(err));
      throw err;
    }
  }, []);

  const updateRecurringBill = useCallback(async (id: string, data: Partial<Pick<RecurringBill, 'name' | 'amount' | 'due_day' | 'category' | 'notes' | 'is_active'>>) => {
    try {
      const bill = await service.updateRecurringBill(id, data);
      setRecurringBills((prev) => prev.map((b) => (b.id === id ? bill : b)));
      return bill;
    } catch (err) {
      setError(extractError(err));
      throw err;
    }
  }, []);

  const deactivateRecurringBill = useCallback(async (id: string) => {
    try {
      await service.deactivateRecurringBill(id);
      setRecurringBills((prev) => prev.map((b) => (b.id === id ? { ...b, is_active: false } : b)));
    } catch (err) {
      setError(extractError(err));
      throw err;
    }
  }, []);

  const createOneTimeAccountPayable = useCallback(async (data: { name: string; amount: number; due_date: string; category?: string; notes?: string; idempotency_key: string }) => {
    try {
      const result = await service.createOneTimeAccountPayable(data);
      await fetchAccountsPayable();
      return result;
    } catch (err) {
      setError(extractError(err));
      throw err;
    }
  }, [fetchAccountsPayable]);

  const editAccountPayable = useCallback(async (id: string, data: Partial<Pick<AccountPayable, 'amount' | 'due_date' | 'category' | 'notes'>>) => {
    try {
      const ap = await service.editAccountPayable(id, data);
      await fetchAccountsPayable();
      return ap;
    } catch (err) {
      setError(extractError(err));
      throw err;
    }
  }, [fetchAccountsPayable]);

  const payAccountPayable = useCallback(async (apId: string) => {
    try {
      const result = await service.payAccountPayable(apId);
      await fetchAccountsPayable();
      return result;
    } catch (err) {
      setError(extractError(err));
      throw err;
    }
  }, [fetchAccountsPayable]);

  const cancelAccountPayable = useCallback(async (apId: string) => {
    try {
      const result = await service.cancelAccountPayable(apId);
      await fetchAccountsPayable();
      return result;
    } catch (err) {
      setError(extractError(err));
      throw err;
    }
  }, [fetchAccountsPayable]);

  useEffect(() => {
    if (tenantId) {
      fetchRecurringBills();
      ensureCurrentMonthInstances();
    }
  }, [tenantId, fetchRecurringBills, ensureCurrentMonthInstances]);

  return {
    loading,
    error,
    recurringBills,
    accountsPayable,
    fetchAccountsPayable,
    createRecurringBill,
    updateRecurringBill,
    deactivateRecurringBill,
    createOneTimeAccountPayable,
    editAccountPayable,
    payAccountPayable,
    cancelAccountPayable,
    ensureCurrentMonthInstances,
  };
}
