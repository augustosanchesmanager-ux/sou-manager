import React, { useEffect, useState } from 'react';
import { useRecurringBills } from '../src/hooks/useRecurringBills';
import type { RecurringBill } from '../src/hooks/useRecurringBills';
import Modal from './ui/Modal';
import Toast from './Toast';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }).format(value);

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
};

interface RecurringBillsWidgetProps {
  embedded?: boolean;
}

export const RecurringBillsWidget: React.FC<RecurringBillsWidgetProps> = ({ embedded = false }) => {
  const {
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
    refresh,
  } = useRecurringBills();

  const [isExpanded, setIsExpanded] = useState(!embedded);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<RecurringBill | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    due_day: '5',
    category: 'aluguel',
    is_active: true,
    notes: '',
  });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    console.debug('[RecurringBills] render filters/state before list render', {
      loading,
      error,
      billsCount: bills.length,
      generatedExpensesCount: generatedExpenses.length,
      activeBillsCount: bills.filter((bill) => bill.is_active).length,
      totals,
    });
  }, [bills, error, generatedExpenses, loading, totals]);

  useEffect(() => {
    if (!error) return;
    setToast({ message: `Erro ao carregar contas fixas: ${error}`, type: 'error' });
  }, [error]);

  const openNewModal = () => {
    setEditingBill(null);
    setFormData({
      name: '',
      amount: '',
      due_day: '5',
      category: 'aluguel',
      is_active: true,
      notes: '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (bill: RecurringBill) => {
    setEditingBill(bill);
    setFormData({
      name: bill.name,
      amount: bill.amount.toString(),
      due_day: bill.due_day.toString(),
      category: bill.category,
      is_active: bill.is_active,
      notes: bill.notes || '',
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        name: formData.name,
        amount: parseFloat(formData.amount.replace(',', '.')),
        due_day: parseInt(formData.due_day),
        category: formData.category,
        is_active: formData.is_active,
        notes: formData.notes,
      };

      if (Number.isNaN(payload.amount) || payload.amount <= 0) {
        throw new Error('Informe um valor válido para a conta fixa.');
      }

      if (Number.isNaN(payload.due_day) || payload.due_day < 1 || payload.due_day > 31) {
        throw new Error('Informe um dia de vencimento entre 1 e 31.');
      }

      console.debug('[RecurringBills] form payload before save', payload);

      if (editingBill) {
        await updateBill(editingBill.id, payload);
        setToast({ message: 'Conta atualizada!', type: 'success' });
      } else {
        await createBill(payload);
        setToast({ message: 'Conta criada!', type: 'success' });
      }

      setIsModalOpen(false);
      refresh();
    } catch (err: any) {
      console.error('[RecurringBills] Erro completo ao salvar conta fixa:', err);
      setToast({ message: err.message || 'Erro ao salvar', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta conta?')) return;

    try {
      await deleteBill(id);
      setToast({ message: 'Conta excluída!', type: 'info' });
      refresh();
    } catch (err: any) {
      console.error('[RecurringBills] Erro completo ao excluir conta fixa:', err);
      setToast({ message: err.message || 'Erro ao excluir', type: 'error' });
    }
  };

  const getCategoryIcon = (catId: string) => {
    const cat = categories.find(c => c.id === catId);
    return cat?.icon || 'receipt';
  };

  const overdue = generatedExpenses.filter(e => e.status === 'overdue');
  const thisMonth = generatedExpenses.filter(e => e.status === 'pending' && new Date(e.due_date) <= new Date());
  const upcoming = generatedExpenses.filter(e => e.status === 'pending' && new Date(e.due_date) > new Date());

  return (
    <div className="space-y-4">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header Collapsible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between bg-gradient-to-r from-slate-800 to-slate-700 dark:from-slate-800 dark:to-slate-900 p-4 rounded-xl text-white"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/10 rounded-lg">
            <span className="material-symbols-outlined">repeat</span>
          </div>
          <div className="text-left">
            <h3 className="font-bold text-sm">CONTAS A PAGAR</h3>
            <p className="text-xs text-white/60">{bills.length} conta(s) cadastrada(s)</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-4 text-right">
            <div>
              <p className="text-[10px] text-white/60 uppercase">Este Mês</p>
              <p className="font-bold">{formatCurrency(totals.pending || 0)}</p>
            </div>
            {totals.overdue > 0 && (
              <div className="px-2 py-1 bg-red-500 rounded-lg">
                <p className="text-[10px]">Vencida</p>
              </div>
            )}
          </div>
          <span className="material-symbols-outlined transition-transform">{isExpanded ? 'expand_less' : 'expand_more'}</span>
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="space-y-4 animate-fade-in">
          {/* KPI Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg text-center">
              <span className="material-symbols-outlined text-red-500 text-lg">warning</span>
              <p className="text-xs text-red-500 font-bold uppercase mt-1">Vencidas</p>
              <p className="text-lg font-black text-red-500">{formatCurrency(totals.overdue)}</p>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg text-center">
              <span className="material-symbols-outlined text-amber-500 text-lg">schedule</span>
              <p className="text-xs text-amber-500 font-bold uppercase mt-1">Este Mês</p>
              <p className="text-lg font-black text-amber-500">{formatCurrency(totals.pending)}</p>
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg text-center">
              <span className="material-symbols-outlined text-emerald-500 text-lg">upcoming</span>
              <p className="text-xs text-emerald-500 font-bold uppercase mt-1">Próximas</p>
              <p className="text-lg font-black text-emerald-500">{formatCurrency(totals.upcoming)}</p>
            </div>
          </div>

          {/* Bills List */}
          <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-border-dark flex items-center justify-between">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">Contas Fixas</h4>
              <button
                onClick={openNewModal}
                className="text-xs flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                Nova Conta
              </button>
            </div>

            {loading ? (
              <div className="p-8 text-center text-slate-500">Carregando...</div>
            ) : bills.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">receipt_long</span>
                <p className="text-sm">Nenhuma conta fixa cadastrada</p>
                <button onClick={openNewModal} className="text-primary text-sm font-bold mt-2">
                  + Cadastrar primeira conta
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-border-dark max-h-80 overflow-y-auto">
                {bills.map(bill => (
                  <div
                    key={bill.id}
                    className={`p-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/5 transition-colors ${!bill.is_active ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-100 dark:bg-white/10 rounded-lg">
                        <span className="material-symbols-outlined text-sm">{getCategoryIcon(bill.category)}</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{bill.name}</p>
                        <p className="text-xs text-slate-500">Dia {bill.due_day} · {categories.find(c => c.id === bill.category)?.label}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(bill.amount)}</p>
                      <button
                        onClick={() => openEditModal(bill)}
                        className="p-1 text-slate-400 hover:text-primary transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">edit</span>
                      </button>
                      <button
                        onClick={() => handleDelete(bill.id)}
                        className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Criar/Editar */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingBill ? 'Editar Conta' : 'Nova Conta Fixa'}
        maxWidth="sm"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Nome</label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Aluguel, Internet, Cartão..."
              className="w-full p-3 bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg text-sm"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Valor</label>
              <input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={e => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0,00"
                className="w-full p-3 bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg text-sm"
                required
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Dia de Vencimento</label>
              <input
                type="number"
                min="1"
                max="31"
                value={formData.due_day}
                onChange={e => setFormData({ ...formData, due_day: e.target.value })}
                className="w-full p-3 bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg text-sm"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Categoria</label>
            <select
              value={formData.category}
              onChange={e => setFormData({ ...formData, category: e.target.value })}
              className="w-full p-3 bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg text-sm"
            >
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Observações</label>
            <textarea
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Informações adicionais..."
              className="w-full p-3 bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg text-sm h-20 resize-none"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.is_active}
              onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4"
            />
            <span className="text-sm text-slate-600 dark:text-slate-300">Conta ativa</span>
          </label>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="flex-1 px-4 py-3 border border-slate-200 dark:border-border-dark rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-3 bg-primary text-white rounded-lg text-sm font-bold hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {saving ? 'Salvando...' : editingBill ? 'Atualizar' : 'Criar Conta'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default RecurringBillsWidget;
