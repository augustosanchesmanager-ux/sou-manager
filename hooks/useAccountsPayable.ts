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
      setError(err instanceof Error ? err.message : 'Erro ao buscar recorrências');
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
      setError(err instanceof Error ? err.message : 'Erro ao buscar contas a pagar');
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
      setError(err instanceof Error ? err.message : 'Erro ao gerar ocorrências do mês');
    }
  }, [tenantId, fetchAccountsPayable]);

  const createRecurringBill = useCallback(async (data: { name: string; amount: number; due_day: number; category?: string; notes?: string }) => {
    try {
      const bill = await service.createRecurringBill(data);
      setRecurringBills((prev) => [...prev, bill]);
      return bill;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar recorrência');
      throw err;
    }
  }, []);

  const updateRecurringBill = useCallback(async (id: string, data: Partial<Pick<RecurringBill, 'name' | 'amount' | 'due_day' | 'category' | 'notes' | 'is_active'>>) => {
    try {
      const bill = await service.updateRecurringBill(id, data);
      setRecurringBills((prev) => prev.map((b) => (b.id === id ? bill : b)));
      return bill;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar recorrência');
      throw err;
    }
  }, []);

  const deactivateRecurringBill = useCallback(async (id: string) => {
    try {
      await service.deactivateRecurringBill(id);
      setRecurringBills((prev) => prev.map((b) => (b.id === id ? { ...b, is_active: false } : b)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao desativar recorrência');
      throw err;
    }
  }, []);

  const createOneTimeAccountPayable = useCallback(async (data: { name: string; amount: number; due_date: string; category?: string; notes?: string }) => {
    try {
      const ap = await service.createOneTimeAccountPayable(data);
      await fetchAccountsPayable();
      return ap;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar conta avulsa');
      throw err;
    }
  }, [fetchAccountsPayable]);

  const editAccountPayable = useCallback(async (id: string, data: Partial<Pick<AccountPayable, 'amount' | 'due_date' | 'category' | 'notes'>>) => {
    try {
      const ap = await service.editAccountPayable(id, data);
      await fetchAccountsPayable();
      return ap;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao editar conta');
      throw err;
    }
  }, [fetchAccountsPayable]);

  const payAccountPayable = useCallback(async (apId: string) => {
    try {
      const result = await service.payAccountPayable(apId);
      await fetchAccountsPayable();
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao dar baixa');
      throw err;
    }
  }, [fetchAccountsPayable]);

  const cancelAccountPayable = useCallback(async (apId: string) => {
    try {
      const result = await service.cancelAccountPayable(apId);
      await fetchAccountsPayable();
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao cancelar conta');
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
