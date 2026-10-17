import React, { useState, useEffect } from 'react';
import { useAccountsPayable } from '@/hooks/useAccountsPayable';
import { AccountPayableWithOverdue, RecurringBill } from '@/domain/accountsPayable/types';
import Modal from './ui/Modal';
import Toast from './Toast';

type TabType = 'pending' | 'paid' | 'cancelled' | 'recurring';

const AccountsPayableWidget: React.FC = () => {
  const {
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
  } = useAccountsPayable();

  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
  const [isOneTimeModalOpen, setIsOneTimeModalOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<RecurringBill | null>(null);
  const [editingAP, setEditingAP] = useState<AccountPayableWithOverdue | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [isRecurringSubmitting, setIsRecurringSubmitting] = useState(false);
  const [recurringIdempotencyKey, setRecurringIdempotencyKey] = useState<string | null>(null);

  // Pay Modal State
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payingAP, setPayingAP] = useState<AccountPayableWithOverdue | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [payForm, setPayForm] = useState({
    paid_at: new Date().toISOString().split('T')[0],
    payment_method: 'Dinheiro',
  });

  // Recurring Bill Form
  const [billForm, setBillForm] = useState({
    name: '',
    amount: '',
    due_day: '10',
    category: 'Outros',
    notes: '',
  });

  // One-time AP Form
  const [apForm, setApForm] = useState({
    name: '',
    amount: '',
    due_date: new Date().toISOString().split('T')[0],
    category: 'Outros',
    notes: '',
  });

  // Competence State
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];
  const currentMonthLabel = `${monthNames[selectedMonth - 1]} ${selectedYear}`;
  const isCurrentMonth = selectedMonth === (now.getMonth() + 1) && selectedYear === now.getFullYear();

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  const handleResetToCurrentMonth = () => {
    setSelectedMonth(now.getMonth() + 1);
    setSelectedYear(now.getFullYear());
  };

  useEffect(() => {
    fetchAccountsPayable({ competence_month: selectedMonth, competence_year: selectedYear });
  }, [fetchAccountsPayable, selectedMonth, selectedYear]);

  // Filter by tab
  const filteredAP = accountsPayable.filter((ap) => {
    if (activeTab === 'pending') return ap.status === 'pending';
    if (activeTab === 'paid') return ap.status === 'paid';
    if (activeTab === 'cancelled') return ap.status === 'cancelled';
    return false;
  });

  // KPIs
  const pendingTotal = accountsPayable
    .filter((ap) => ap.status === 'pending')
    .reduce((sum, ap) => sum + ap.amount, 0);
  const pendingCount = accountsPayable.filter((ap) => ap.status === 'pending').length;

  const paidTotal = accountsPayable
    .filter((ap) => ap.status === 'paid')
    .reduce((sum, ap) => sum + ap.amount, 0);
  const paidCount = accountsPayable.filter((ap) => ap.status === 'paid').length;

  const overdueBills = accountsPayable.filter((ap) => ap.is_overdue);
  const overdueTotal = overdueBills.reduce((sum, ap) => sum + ap.amount, 0);
  const overdueCount = overdueBills.length;

  const getDaysDiff = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
    const target = new Date(year, month - 1, day);
    target.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - target.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  };

  const handleCreateRecurringBill = async (e: React.FormEvent) => {
    e.preventDefault();
    const key = recurringIdempotencyKey || crypto.randomUUID();
    setRecurringIdempotencyKey(key);
    setIsRecurringSubmitting(true);
    try {
      const result = await createRecurringBill({
        name: billForm.name,
        amount: parseFloat(billForm.amount),
        due_day: parseInt(billForm.due_day, 10),
        category: billForm.category,
        notes: billForm.notes || undefined,
        idempotency_key: key,
      });
      if (result.created) {
        setToast({ message: 'Recorrência criada!', type: 'success' });
      } else {
        setToast({ message: 'Recorrência já existe', type: 'info' });
      }
      setIsRecurringModalOpen(false);
      setBillForm({ name: '', amount: '', due_day: '10', category: 'Outros', notes: '' });
      setRecurringIdempotencyKey(null);
    } catch {
      setToast({ message: 'Erro ao criar recorrência', type: 'error' });
    } finally {
      setIsRecurringSubmitting(false);
    }
  };

  const handleEditRecurringBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBill) return;
    try {
      await updateRecurringBill(editingBill.id, {
        name: billForm.name,
        amount: parseFloat(billForm.amount),
        due_day: parseInt(billForm.due_day, 10),
        category: billForm.category,
        notes: billForm.notes || null,
      });
      setToast({ message: 'Recorrência atualizada!', type: 'success' });
      setIsRecurringModalOpen(false);
      setEditingBill(null);
    } catch {
      setToast({ message: 'Erro ao atualizar recorrência', type: 'error' });
    }
  };

  const handleDeactivateRecurringBill = async (id: string) => {
    try {
      await deactivateRecurringBill(id);
      setToast({ message: 'Recorrência desativada.', type: 'info' });
    } catch {
      setToast({ message: 'Erro ao desativar recorrência', type: 'error' });
    }
  };

  const handleCreateOneTimeAP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    const key = idempotencyKey || crypto.randomUUID();
    setIdempotencyKey(key);
    try {
      await createOneTimeAccountPayable({
        name: apForm.name,
        amount: parseFloat(apForm.amount),
        due_date: apForm.due_date,
        category: apForm.category,
        notes: apForm.notes || undefined,
        idempotency_key: key,
      });
      setToast({ message: 'Conta avulsa criada!', type: 'success' });
      setIsOneTimeModalOpen(false);
      setApForm({ name: '', amount: '', due_date: new Date().toISOString().split('T')[0], category: 'Outros', notes: '' });
      setIdempotencyKey(null);
    } catch {
      setToast({ message: 'Erro ao criar conta avulsa', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditAP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAP) return;
    try {
      await editAccountPayable(editingAP.id, {
        amount: parseFloat(apForm.amount),
        due_date: apForm.due_date,
        category: apForm.category,
        notes: apForm.notes || null,
      });
      setToast({ message: 'Conta atualizada!', type: 'success' });
      setIsOneTimeModalOpen(false);
      setEditingAP(null);
    } catch {
      setToast({ message: 'Erro ao editar conta', type: 'error' });
    }
  };

  const openPayModal = (ap: AccountPayableWithOverdue) => {
    setPayingAP(ap);
    setPayForm({
      paid_at: new Date().toISOString().split('T')[0],
      payment_method: 'Dinheiro',
    });
    setIsPayModalOpen(true);
  };

  const handleConfirmPay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingAP) return;
    setIsPaying(true);
    try {
      const paidAtIso = payForm.paid_at
        ? new Date(`${payForm.paid_at}T12:00:00Z`).toISOString()
        : new Date().toISOString();
      const result = await payAccountPayable(payingAP.id, payForm.payment_method, paidAtIso);
      setToast({ message: result.message || 'Baixa realizada com sucesso!', type: 'success' });
      setIsPayModalOpen(false);
      setPayingAP(null);
    } catch {
      setToast({ message: 'Erro ao dar baixa na conta', type: 'error' });
    } finally {
      setIsPaying(false);
    }
  };

  const handleCancel = async (apId: string) => {
    try {
      const result = await cancelAccountPayable(apId);
      setToast({ message: result.message || 'Conta cancelada.', type: 'info' });
    } catch {
      setToast({ message: 'Erro ao cancelar conta', type: 'error' });
    }
  };

  const openEditBillModal = (bill: RecurringBill) => {
    setEditingBill(bill);
    setBillForm({
      name: bill.name,
      amount: bill.amount.toString(),
      due_day: bill.due_day.toString(),
      category: bill.category,
      notes: bill.notes || '',
    });
    setIsRecurringModalOpen(true);
  };

  const openEditAPModal = (ap: AccountPayableWithOverdue) => {
    setEditingAP(ap);
    setApForm({
      name: ap.name,
      amount: ap.amount.toString(),
      due_date: ap.due_date.split('T')[0],
      category: ap.category,
      notes: ap.notes || '',
    });
    setIsOneTimeModalOpen(true);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR');
  };

  const getStatusBadge = (ap: AccountPayableWithOverdue) => {
    if (ap.status === 'paid') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
          <span className="size-1.5 rounded-full bg-emerald-500"></span>
          Pago
        </span>
      );
    }
    if (ap.status === 'cancelled') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border bg-slate-500/10 text-slate-500 border-slate-500/20">
          <span className="size-1.5 rounded-full bg-slate-500"></span>
          Cancelado
        </span>
      );
    }
    const daysDiff = getDaysDiff(ap.due_date);
    if (ap.is_overdue || daysDiff > 0) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide border bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30">
          <span className="size-1.5 rounded-full bg-rose-500 animate-pulse"></span>
          {daysDiff > 0 ? `Vencida há ${daysDiff} ${daysDiff === 1 ? 'dia' : 'dias'}` : 'Vencida'}
        </span>
      );
    }
    if (daysDiff === 0) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30">
          <span className="size-1.5 rounded-full bg-amber-500"></span>
          Vence hoje
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border bg-amber-500/10 text-amber-500 border-amber-500/20">
        <span className="size-1.5 rounded-full bg-amber-500"></span>
        Pendente
      </span>
    );
  };

  if (loading && accountsPayable.length === 0) {
    return (
      <div className="bg-white dark:bg-card-dark p-6 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-primary">account_balance</span>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Contas a Pagar</h3>
        </div>
        <p className="text-sm text-slate-500">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-card-dark p-6 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-sm text-red-500">error</span>
            <p className="text-xs font-bold text-red-600 dark:text-red-400" data-testid="widget-error">{error}</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">account_balance</span>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Contas a Pagar</h3>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setEditingBill(null); setBillForm({ name: '', amount: '', due_day: '10', category: 'Outros', notes: '' }); setRecurringIdempotencyKey(crypto.randomUUID()); setIsRecurringModalOpen(true); }}
            className="bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-sm">autorenew</span>
            + Recorrência
          </button>
          <button
            onClick={() => { setEditingAP(null); setApForm({ name: '', amount: '', due_date: new Date().toISOString().split('T')[0], category: 'Outros', notes: '' }); setIsOneTimeModalOpen(true); }}
            className="bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-sm">add_circle</span>
            + Avulsa
          </button>
        </div>
      </div>

      {/* Competence Navigation Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4 p-3 bg-slate-50 dark:bg-white/[0.03] rounded-xl border border-slate-200/80 dark:border-white/10">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-slate-400 text-lg">calendar_month</span>
          <span className="text-xs font-bold uppercase text-slate-500">Competência:</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-white dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition-colors"
            title="Mês anterior"
          >
            <span className="material-symbols-outlined text-sm">chevron_left</span>
          </button>
          <span className="text-sm font-bold text-slate-900 dark:text-white px-3 min-w-[140px] text-center">
            {currentMonthLabel}
          </span>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-white dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition-colors"
            title="Próximo mês"
          >
            <span className="material-symbols-outlined text-sm">chevron_right</span>
          </button>
          {!isCurrentMonth && (
            <button
              type="button"
              onClick={handleResetToCurrentMonth}
              className="text-[11px] font-bold text-primary hover:underline ml-2"
            >
              Mês atual
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="bg-amber-50 dark:bg-amber-500/10 p-3.5 rounded-xl border border-amber-200/60 dark:border-amber-500/20">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide">Total a Pagar</p>
            <span className="material-symbols-outlined text-amber-500 text-base">schedule</span>
          </div>
          <p className="text-xl font-black text-amber-700 dark:text-amber-300">
            R$ {pendingTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-amber-600/80 dark:text-amber-400/80 mt-0.5">
            {pendingCount} conta(s) pendente(s)
          </p>
        </div>

        <div className="bg-emerald-50 dark:bg-emerald-500/10 p-3.5 rounded-xl border border-emerald-200/60 dark:border-emerald-500/20">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Total Pago</p>
            <span className="material-symbols-outlined text-emerald-500 text-base">check_circle</span>
          </div>
          <p className="text-xl font-black text-emerald-700 dark:text-emerald-300">
            R$ {paidTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">
            {paidCount} conta(s) liquidada(s)
          </p>
        </div>

        <div
          className={`p-3.5 rounded-xl border transition-colors ${
            overdueCount > 0
              ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-300 dark:border-rose-500/30'
              : 'bg-slate-50 dark:bg-white/[0.02] border-slate-200 dark:border-white/10'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <p
              className={`text-[10px] font-bold uppercase tracking-wide ${
                overdueCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500'
              }`}
            >
              Vencidas
            </p>
            <span
              className={`material-symbols-outlined text-base ${
                overdueCount > 0 ? 'text-rose-500' : 'text-slate-400'
              }`}
            >
              {overdueCount > 0 ? 'warning' : 'verified'}
            </span>
          </div>
          <p
            className={`text-xl font-black ${
              overdueCount > 0 ? 'text-rose-700 dark:text-rose-300' : 'text-slate-700 dark:text-slate-300'
            }`}
          >
            R$ {overdueTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p
            className={`text-[11px] mt-0.5 ${
              overdueCount > 0 ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-400'
            }`}
          >
            {overdueCount > 0 ? `${overdueCount} conta(s) em atraso` : 'Nenhuma conta vencida'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-slate-100 dark:bg-white/5 p-1 rounded-lg">
        {([
          { key: 'pending', label: 'Pendentes', count: accountsPayable.filter((ap) => ap.status === 'pending').length },
          { key: 'paid', label: 'Pagas', count: accountsPayable.filter((ap) => ap.status === 'paid').length },
          { key: 'cancelled', label: 'Canceladas', count: accountsPayable.filter((ap) => ap.status === 'cancelled').length },
          { key: 'recurring', label: 'Recorrências', count: recurringBills.length },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2 rounded-md text-xs font-bold transition-colors ${
              activeTab === tab.key
                ? 'bg-white dark:bg-card-dark text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'recurring' ? (
        <div className="space-y-2">
          {recurringBills.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">Nenhuma recorrência cadastrada.</p>
          ) : (
            recurringBills.map((bill) => (
              <div key={bill.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-white/[0.02] rounded-lg border border-slate-100 dark:border-border-dark">
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{bill.name}</p>
                  <p className="text-xs text-slate-500">
                    Dia {bill.due_day} · {bill.category} · {bill.is_active ? 'Ativa' : 'Inativa'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    R$ {bill.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                  <button onClick={() => openEditBillModal(bill)} className="text-slate-400 hover:text-primary p-1" title="Editar">
                    <span className="material-symbols-outlined text-sm">edit</span>
                  </button>
                  {bill.is_active && (
                    <button onClick={() => handleDeactivateRecurringBill(bill.id)} className="text-slate-400 hover:text-red-500 p-1" title="Desativar">
                      <span className="material-symbols-outlined text-sm">pause_circle</span>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredAP.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">Nenhuma conta nesta categoria.</p>
          ) : (
            filteredAP.map((ap) => (
              <div key={ap.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-white/[0.02] rounded-lg border border-slate-100 dark:border-border-dark">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{ap.name}</p>
                    {getStatusBadge(ap)}
                  </div>
                  <p className="text-xs text-slate-500">
                    {formatDate(ap.due_date)} · {ap.category} · Competência {ap.competence_month}/{ap.competence_year}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    R$ {ap.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                  {ap.status === 'pending' && (
                    <>
                      <button onClick={() => openPayModal(ap)} className="bg-emerald-500 hover:bg-emerald-600 text-white px-2 py-1 rounded text-[10px] font-bold transition-colors" title="Dar baixa">
                        BAIXAR
                      </button>
                      <button onClick={() => openEditAPModal(ap)} className="text-slate-400 hover:text-primary p-1" title="Editar">
                        <span className="material-symbols-outlined text-sm">edit</span>
                      </button>
                      <button onClick={() => handleCancel(ap.id)} className="text-slate-400 hover:text-red-500 p-1" title="Cancelar">
                        <span className="material-symbols-outlined text-sm">cancel</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Recurring Bill Modal */}
      <Modal
        isOpen={isRecurringModalOpen}
        onClose={() => { setIsRecurringModalOpen(false); setEditingBill(null); }}
        title={editingBill ? 'Editar Recorrência' : 'Nova Recorrência'}
        maxWidth="md"
      >
        <form onSubmit={editingBill ? handleEditRecurringBill : handleCreateRecurringBill} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Nome</label>
            <input
              type="text"
              required
              placeholder="Ex: Aluguel"
              value={billForm.name}
              onChange={(e) => setBillForm({ ...billForm, name: e.target.value })}
              className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Valor (R$)</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="0.00"
                value={billForm.amount}
                onChange={(e) => setBillForm({ ...billForm, amount: e.target.value })}
                className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Dia de Vencimento</label>
              <input
                type="number"
                min="1"
                max="31"
                required
                value={billForm.due_day}
                onChange={(e) => setBillForm({ ...billForm, due_day: e.target.value })}
                className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Categoria</label>
            <select
              value={billForm.category}
              onChange={(e) => setBillForm({ ...billForm, category: e.target.value })}
              className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none"
            >
              <option value="Infraestrutura">Infraestrutura</option>
              <option value="Utilidades">Utilidades</option>
              <option value="Estoque">Estoque</option>
              <option value="Manutenção">Manutenção</option>
              <option value="Marketing">Marketing</option>
              <option value="Pessoal">Pessoal</option>
              <option value="Impostos">Impostos</option>
              <option value="Outros">Outros</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Observações</label>
            <textarea
              value={billForm.notes}
              onChange={(e) => setBillForm({ ...billForm, notes: e.target.value })}
              className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
              rows={2}
            />
          </div>
          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={() => { setIsRecurringModalOpen(false); setEditingBill(null); }}
              className="flex-1 py-3 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isRecurringSubmitting}
              data-testid="recurring-submit"
              className="flex-1 py-3 rounded-lg text-sm font-bold text-white bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRecurringSubmitting ? 'Criando...' : editingBill ? 'Atualizar' : 'Criar Recorrência'}
            </button>
          </div>
        </form>
      </Modal>

      {/* One-time AP Modal */}
      <Modal
        isOpen={isOneTimeModalOpen}
              onClose={() => { setIsOneTimeModalOpen(false); setEditingAP(null); setIdempotencyKey(null); }}
        title={editingAP ? 'Editar Conta' : 'Nova Conta Avulsa'}
        maxWidth="md"
      >
        <form onSubmit={editingAP ? handleEditAP : handleCreateOneTimeAP} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Nome</label>
            <input
              type="text"
              required
              placeholder="Ex: Compra de Material"
              value={apForm.name}
              onChange={(e) => setApForm({ ...apForm, name: e.target.value })}
              className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Valor (R$)</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="0.00"
                value={apForm.amount}
                onChange={(e) => setApForm({ ...apForm, amount: e.target.value })}
                className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Data de Vencimento</label>
              <input
                type="date"
                required
                value={apForm.due_date}
                onChange={(e) => setApForm({ ...apForm, due_date: e.target.value })}
                className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Categoria</label>
            <select
              value={apForm.category}
              onChange={(e) => setApForm({ ...apForm, category: e.target.value })}
              className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none"
            >
              <option value="Infraestrutura">Infraestrutura</option>
              <option value="Utilidades">Utilidades</option>
              <option value="Estoque">Estoque</option>
              <option value="Manutenção">Manutenção</option>
              <option value="Marketing">Marketing</option>
              <option value="Pessoal">Pessoal</option>
              <option value="Impostos">Impostos</option>
              <option value="Outros">Outros</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Observações</label>
            <textarea
              value={apForm.notes}
              onChange={(e) => setApForm({ ...apForm, notes: e.target.value })}
              className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
              rows={2}
            />
          </div>
          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={() => { setIsOneTimeModalOpen(false); setEditingAP(null); setIdempotencyKey(null); }}
              className="flex-1 py-3 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 rounded-lg text-sm font-bold text-white bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Criando...' : editingAP ? 'Atualizar' : 'Criar Conta'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Pay Modal */}
      <Modal
        isOpen={isPayModalOpen}
        onClose={() => { if (!isPaying) { setIsPayModalOpen(false); setPayingAP(null); } }}
        title="Confirmar Pagamento"
        maxWidth="sm"
      >
        {payingAP && (
          <form onSubmit={handleConfirmPay} className="space-y-4">
            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/10">
              <p className="text-xs text-slate-500 uppercase font-bold">Despesa</p>
              <p className="text-base font-bold text-slate-900 dark:text-white mt-0.5">{payingAP.name}</p>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200/60 dark:border-white/10">
                <span className="text-xs text-slate-500">Valor a liquidar</span>
                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                  R$ {payingAP.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Data do Pagamento</label>
              <input
                type="date"
                required
                value={payForm.paid_at}
                onChange={(e) => setPayForm({ ...payForm, paid_at: e.target.value })}
                className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Forma de Pagamento</label>
              <select
                value={payForm.payment_method}
                onChange={(e) => setPayForm({ ...payForm, payment_method: e.target.value })}
                className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none"
              >
                <option value="Dinheiro">Dinheiro (Caixa Físico)</option>
                <option value="PIX">PIX</option>
                <option value="Cartão de Débito">Cartão de Débito</option>
                <option value="Cartão de Crédito">Cartão de Crédito</option>
                <option value="Boleto">Boleto Bancário</option>
                <option value="Transferência">Transferência / TED</option>
                <option value="Outro">Outro</option>
              </select>
            </div>

            {payForm.payment_method === 'Dinheiro' && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
                <span className="material-symbols-outlined text-sm mt-0.5">info</span>
                <span>Esta despesa será registrada como saída no <strong>Fechamento de Caixa Físico</strong> da data informada.</span>
              </div>
            )}

            <div className="pt-2 flex gap-3">
              <button
                type="button"
                disabled={isPaying}
                onClick={() => { setIsPayModalOpen(false); setPayingAP(null); }}
                className="flex-1 py-3 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPaying}
                className="flex-1 py-3 rounded-lg text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPaying ? 'Processando...' : 'Confirmar Baixa'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default AccountsPayableWidget;
