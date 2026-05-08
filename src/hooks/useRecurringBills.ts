import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../context/AuthContext';

const DEBUG_RECURRING_BILLS = true;

const debugRecurringBills = (label: string, details?: unknown) => {
  if (!DEBUG_RECURRING_BILLS) return;
  console.debug(`[RecurringBills] ${label}`, details ?? '');
};

const buildDueDateFromDay = (dueDay: number) => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  const normalizedDueDay = Math.min(Math.max(dueDay, 1), lastDayOfMonth);
  return new Date(year, month, normalizedDueDay, 12, 0, 0).toISOString();
};

export interface RecurringBill {
  id: string;
  name: string;
  amount: number;
  due_day: number;
  category: string;
  is_active: boolean;
  notes?: string;
  last_generated?: string;
}

export interface GeneratedExpense {
  id: string;
  bill_id: string;
  bill_name: string;
  amount: number;
  due_date: string;
  status: 'pending' | 'paid' | 'overdue';
}

export const BILL_CATEGORIES = [
  { id: 'aluguel', label: 'Aluguel', icon: 'home' },
  { id: 'credit_card', label: 'Cartão de Crédito', icon: 'credit_card' },
  { id: 'software', label: 'Software/Assinatura', icon: 'computer' },
  { id: 'produtos_cabelo', label: 'Produtos Cabelo', icon: 'content_cut' },
  { id: 'produtos_barba', label: 'Produtos Barba', icon: 'face' },
  { id: 'produtos_hidratacao', label: 'Hidratação/Tratamento', icon: 'spa' },
  { id: 'funcionario', label: 'Funcionário', icon: 'person' },
  { id: 'veiculo', label: 'Veículo', icon: 'directions_car' },
  { id: 'particular', label: 'Contas Particulares', icon: 'account_balance_wallet' },
  { id: 'luz', label: 'Luz/Energia', icon: 'bolt' },
  { id: 'agua', label: 'Água', icon: 'water_drop' },
  { id: 'internet', label: 'Internet', icon: 'wifi' },
  { id: 'marketing', label: 'Marketing/Ads', icon: 'campaign' },
  { id: 'fornecedor', label: 'Fornecedor', icon: 'local_shipping' },
  { id: 'outros', label: 'Outros', icon: 'more_horiz' },
];

export const useRecurringBills = () => {
  const { tenantId, user } = useAuth();
  const [bills, setBills] = useState<RecurringBill[]>([]);
  const [generatedExpenses, setGeneratedExpenses] = useState<GeneratedExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const categories = BILL_CATEGORIES;

  const fetchBills = useCallback(async () => {
    if (!tenantId) {
      setBills([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const filters = {
        table: 'transactions',
        tenant_id: tenantId,
        type: 'expense',
        date: 'current month due date',
        order: 'date desc',
        limit: 50,
      };
      debugRecurringBills('fetchBills filters before query', filters);

      const { data, error: fetchError } = await supabase
        .from('transactions')
        .select('id, description, amount, date, category, status, notes')
        .eq('tenant_id', tenantId)
        .eq('type', 'expense')
        .order('date', { ascending: false })
        .limit(50);

      if (fetchError) {
        console.error('[RecurringBills] Erro completo ao carregar contas fixas:', fetchError);
        setError(fetchError.message);
        setBills([]);
      } else {
        const mappedBills = (data || []).map((item: any) => ({
          id: item.id,
          name: item.description,
          amount: Number(item.amount),
          due_day: item.due_day || (item.date ? new Date(item.date).getDate() : 5),
          category: item.category || 'outros',
          is_active: item.status !== 'cancelled' && item.status !== 'Pago',
          notes: item.notes,
          last_generated: null,
        }));
        debugRecurringBills('fetchBills Supabase response', { data, error: fetchError });
        debugRecurringBills('fetchBills mapped result before render', {
          count: mappedBills.length,
          bills: mappedBills,
        });
        setBills(mappedBills);
      }
    } catch (err: any) {
      console.error('[RecurringBills] Erro inesperado ao carregar contas fixas:', err);
      setError(err.message);
      setBills([]);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  const generateExpenses = useCallback(async () => {
    if (!tenantId || bills.length === 0) return;

    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const upcoming: GeneratedExpense[] = [];
    const overdue: GeneratedExpense[] = [];

    bills.filter(b => b.is_active).forEach(bill => {
      const dueDay = Math.min(bill.due_day, 28);
      const dueDate = new Date(currentYear, currentMonth, dueDay);
      
      let status: 'pending' | 'paid' | 'overdue' = 'pending';
      
      if (dueDate < today) {
        status = 'overdue';
        overdue.push({
          id: `temp-${bill.id}`,
          bill_id: bill.id,
          bill_name: bill.name,
          amount: bill.amount,
          due_date: dueDate.toISOString(),
          status,
        });
      } else {
        status = 'pending';
        upcoming.push({
          id: `temp-${bill.id}`,
          bill_id: bill.id,
          bill_name: bill.name,
          amount: bill.amount,
          due_date: dueDate.toISOString(),
          status,
        });
      }
    });

    setGeneratedExpenses([...overdue, ...upcoming]);
  }, [bills, tenantId]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  useEffect(() => {
    if (bills.length > 0) {
      generateExpenses();
    }
  }, [bills, generateExpenses]);

  const createBill = async (bill: Omit<RecurringBill, 'id'>) => {
    if (!tenantId) throw new Error('Tenant inválido');
    if (!user) throw new Error('Usuário inválido');

    const payload = {
      user_id: user.id,
      type: 'expense',
      description: bill.name,
      amount: bill.amount,
      category: bill.category,
      date: buildDueDateFromDay(bill.due_day),
      status: bill.is_active ? 'pending' : 'cancelled',
      notes: bill.notes,
      tenant_id: tenantId,
    };

    debugRecurringBills('createBill payload', payload);

    const response = await supabase
      .from('transactions')
      .insert(payload)
      .select()
      .single();

    debugRecurringBills('createBill Supabase response', response);

    if (response.error) {
      console.error('[RecurringBills] Erro completo ao criar conta fixa:', response.error, { payload });
      throw response.error;
    }
    await fetchBills();
    return response.data;
  };

  const updateBill = async (id: string, updates: Partial<RecurringBill>) => {
    if (!tenantId) throw new Error('Tenant inválido');

    const payload: any = {};
    if (updates.name !== undefined) payload.description = updates.name;
    if (updates.amount !== undefined) payload.amount = updates.amount;
    if (updates.category !== undefined) payload.category = updates.category;
    if (updates.due_day !== undefined) payload.date = buildDueDateFromDay(updates.due_day);
    if (updates.is_active !== undefined) payload.status = updates.is_active ? 'pending' : 'cancelled';
    if (updates.notes !== undefined) payload.notes = updates.notes;

    debugRecurringBills('updateBill payload', { id, tenantId, payload });

    const response = await supabase
      .from('transactions')
      .update(payload)
      .eq('id', id)
      .eq('tenant_id', tenantId);

    debugRecurringBills('updateBill Supabase response', response);

    if (response.error) {
      console.error('[RecurringBills] Erro completo ao atualizar conta fixa:', response.error, { id, tenantId, payload });
      throw response.error;
    }
    await fetchBills();
  };

  const deleteBill = async (id: string) => {
    if (!tenantId) throw new Error('Tenant inválido');

    debugRecurringBills('deleteBill filters', { id, tenantId });

    const response = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    debugRecurringBills('deleteBill Supabase response', response);

    if (response.error) {
      console.error('[RecurringBills] Erro completo ao excluir conta fixa:', response.error, { id, tenantId });
      throw response.error;
    }
    await fetchBills();
  };

  const markAsPaid = async (billId: string) => {
    if (!tenantId) throw new Error('Tenant inválido');
    
    const today = new Date().toISOString().split('T')[0];
    
    const payload = { status: 'paid', date: today };
    debugRecurringBills('markAsPaid payload', { billId, tenantId, payload });

    const response = await supabase
      .from('transactions')
      .update(payload)
      .eq('id', billId)
      .eq('tenant_id', tenantId);

    debugRecurringBills('markAsPaid Supabase response', response);

    if (response.error) {
      console.error('[RecurringBills] Erro completo ao marcar conta fixa como paga:', response.error, { billId, tenantId, payload });
      throw response.error;
    }
    await fetchBills();
  };

  const totals = {
    overdue: generatedExpenses.filter(e => e.status === 'overdue').reduce((sum, e) => sum + e.amount, 0),
    pending: generatedExpenses.filter(e => e.status === 'pending' && new Date(e.due_date) <= new Date()).reduce((sum, e) => sum + e.amount, 0),
    upcoming: generatedExpenses.filter(e => e.status === 'pending').reduce((sum, e) => sum + e.amount, 0),
    total: bills.filter(b => b.is_active).reduce((sum, b) => sum + b.amount, 0),
  };

  return {
    bills,
    generatedExpenses,
    loading,
    error,
    categories,
    totals,
    createBill,
    updateBill,
    deleteBill,
    markAsPaid,
    refresh: fetchBills,
  };
};

export default useRecurringBills;
