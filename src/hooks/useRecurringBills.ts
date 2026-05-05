import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../context/AuthContext';

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
  const { tenantId } = useAuth();
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
      const { data, error: fetchError } = await supabase
        .from('transactions')
        .select('id, description, amount, date, category, status, notes')
        .eq('tenant_id', tenantId)
        .in('type', ['expense', 'recurring'])
        .order('date', { ascending: false })
        .limit(50);

      if (fetchError) {
        console.warn('Erro ao carregar bills:', fetchError.message);
        setBills([]);
      } else {
        console.log('[fetchBills] data:', data);
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
        setBills(mappedBills);
      }
    } catch (err: any) {
      console.warn('Erro ao carregar bills:', err);
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

    const { data, error } = await supabase
      .from('transactions')
      .insert({
        type: 'recurring',
        description: bill.name,
        amount: bill.amount,
        category: bill.category,
        due_day: bill.due_day,
        status: bill.is_active ? 'pending' : 'cancelled',
        notes: bill.notes,
        tenant_id: tenantId,
      })
      .select()
      .single();

    console.log('[createBill] result - data:', data, 'error:', error);
    if (error) throw error;
    console.log('[createBill] success, data:', data);
    await fetchBills();
    return data;
  };

  const updateBill = async (id: string, updates: Partial<RecurringBill>) => {
    if (!tenantId) throw new Error('Tenant inválido');

    const payload: any = {};
    if (updates.name !== undefined) payload.description = updates.name;
    if (updates.amount !== undefined) payload.amount = updates.amount;
    if (updates.category !== undefined) payload.category = updates.category;
    if (updates.due_day !== undefined) payload.due_day = updates.due_day;
    if (updates.is_active !== undefined) payload.status = updates.is_active ? 'pending' : 'cancelled';
    if (updates.notes !== undefined) payload.notes = updates.notes;

    const { error } = await supabase
      .from('transactions')
      .update(payload)
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;
    await fetchBills();
  };

  const deleteBill = async (id: string) => {
    if (!tenantId) throw new Error('Tenant inválido');

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;
    await fetchBills();
  };

  const markAsPaid = async (billId: string) => {
    if (!tenantId) throw new Error('Tenant inválido');
    
    const today = new Date().toISOString().split('T')[0];
    
    const { error } = await supabase
      .from('transactions')
      .update({ status: 'paid', date: today })
      .eq('id', billId)
      .eq('tenant_id', tenantId);

    if (error) throw error;
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