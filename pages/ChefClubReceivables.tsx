import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarRange, CheckCircle2, CreditCard, Search, WalletCards } from 'lucide-react';
import Toast from '../components/Toast';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';
import { getScopedClient, supabase } from '../services/supabaseClient';

type ReceivableStatus = 'pending' | 'paid' | 'overdue' | 'cancelled' | 'refunded';

interface ReceivableRecord {
  id: string;
  tenant_id: string;
  customer_id: string;
  subscription_id: string;
  plan_id: string;
  billing_cycle_start: string;
  billing_cycle_end: string;
  due_date: string;
  amount: number | string;
  status: ReceivableStatus;
  payment_method: string | null;
  paid_at: string | null;
  transaction_id: string | null;
  notes: string | null;
  created_at: string;
}

interface ClientRecord {
  id: string;
  name: string;
  phone: string | null;
}

interface PlanRecord {
  id: string;
  name: string;
  monthly_price: number | string | null;
}

const paymentMethods = ['Pix', 'Dinheiro', 'Crédito', 'Débito', 'Outros'];

const statusLabels: Record<ReceivableStatus | 'all', string> = {
  all: 'Todos',
  pending: 'Pendente',
  paid: 'Pago',
  overdue: 'Atrasado',
  cancelled: 'Cancelado',
  refunded: 'Estornado',
};

const statusStyles: Record<ReceivableStatus, string> = {
  pending: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  paid: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  overdue: 'bg-red-500/10 text-red-600 border-red-500/20',
  cancelled: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
  refunded: 'bg-violet-500/10 text-violet-600 border-violet-500/20',
};

const formatCurrency = (value: number | string | null | undefined) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

const toDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getCurrentMonthRange = () => {
  const now = new Date();
  return {
    start: toDateInput(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: toDateInput(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
};

const toPaidAtIso = (date: string) => {
  if (!date) return new Date().toISOString();
  return new Date(`${date}T12:00:00`).toISOString();
};

const ChefClubReceivables: React.FC = () => {
  const { tenantId } = useAuth();
  const navigate = useNavigate();
  const barberSupabase = getScopedClient('barber');
  const monthRange = useMemo(() => getCurrentMonthRange(), []);

  const [receivables, setReceivables] = useState<ReceivableRecord[]>([]);
  const [clients, setClients] = useState<Record<string, ClientRecord>>({});
  const [plans, setPlans] = useState<Record<string, PlanRecord>>({});
  const [statusFilter, setStatusFilter] = useState<ReceivableStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [periodStart, setPeriodStart] = useState(monthRange.start);
  const [periodEnd, setPeriodEnd] = useState(monthRange.end);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [selected, setSelected] = useState<ReceivableRecord | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('Pix');
  const [paidAt, setPaidAt] = useState(toDateInput(new Date()));
  const [notes, setNotes] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const paymentInFlightRef = useRef(false);

  const fetchReceivables = useCallback(async () => {
    if (!tenantId) {
      setReceivables([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { error: generateError } = await barberSupabase.rpc('generate_club_receivables', { p_tenant_id: tenantId });
      if (generateError) throw generateError;

      let query = barberSupabase
        .from('customer_subscription_receivables')
        .select('id, tenant_id, customer_id, subscription_id, plan_id, billing_cycle_start, billing_cycle_end, due_date, amount, status, payment_method, paid_at, transaction_id, notes, created_at')
        .eq('tenant_id', tenantId)
        .gte('due_date', periodStart)
        .lte('due_date', periodEnd)
        .order('due_date', { ascending: true })
        .order('created_at', { ascending: true });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      const rows = (data || []) as ReceivableRecord[];
      setReceivables(rows);

      const customerIds = Array.from(new Set(rows.map((row) => row.customer_id).filter(Boolean)));
      const planIds = Array.from(new Set(rows.map((row) => row.plan_id).filter(Boolean)));

      const [clientsRes, plansRes] = await Promise.all([
        customerIds.length > 0
          ? supabase.from('clients').select('id, name, phone').eq('tenant_id', tenantId).in('id', customerIds)
          : Promise.resolve({ data: [], error: null }),
        planIds.length > 0
          ? barberSupabase.from('customer_plans').select('id, name, monthly_price').eq('tenant_id', tenantId).in('id', planIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (clientsRes.error) throw clientsRes.error;
      if (plansRes.error) throw plansRes.error;

      setClients(
        ((clientsRes.data || []) as ClientRecord[]).reduce<Record<string, ClientRecord>>((acc, client) => {
          acc[client.id] = client;
          return acc;
        }, {}),
      );
      setPlans(
        ((plansRes.data || []) as PlanRecord[]).reduce<Record<string, PlanRecord>>((acc, plan) => {
          acc[plan.id] = plan;
          return acc;
        }, {}),
      );
    } catch (error: any) {
      console.error('Erro ao carregar recebimentos do Clube:', error);
      setToast({ message: error?.message || 'Erro ao carregar recebimentos do Clube.', type: 'error' });
      setReceivables([]);
    } finally {
      setLoading(false);
    }
  }, [barberSupabase, periodEnd, periodStart, statusFilter, tenantId]);

  useEffect(() => {
    void fetchReceivables();
  }, [fetchReceivables]);

  const filteredReceivables = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return receivables;

    return receivables.filter((receivable) => {
      const client = clients[receivable.customer_id];
      const plan = plans[receivable.plan_id];
      return [
        client?.name,
        client?.phone,
        plan?.name,
        receivable.id,
      ].some((value) => `${value || ''}`.toLowerCase().includes(term));
    });
  }, [clients, plans, receivables, search]);

  const totals = useMemo(() => {
    return filteredReceivables.reduce(
      (acc, receivable) => {
        const amount = Number(receivable.amount || 0);
        acc.total += amount;
        if (receivable.status === 'paid') acc.paid += amount;
        if (receivable.status === 'pending') acc.pending += amount;
        if (receivable.status === 'overdue') acc.overdue += amount;
        return acc;
      },
      { total: 0, paid: 0, pending: 0, overdue: 0 },
    );
  }, [filteredReceivables]);

  const openPaymentModal = (receivable: ReceivableRecord) => {
    if (!['pending', 'overdue'].includes(receivable.status)) {
      setToast({ message: 'Somente recebimentos pendentes ou atrasados podem receber baixa.', type: 'info' });
      return;
    }

    setSelected(receivable);
    setPaymentMethod('Pix');
    setPaidAt(toDateInput(new Date()));
    setNotes('');
  };

  const confirmPayment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || paymentInFlightRef.current) return;

    paymentInFlightRef.current = true;
    setPaying(true);
    try {
      const { error } = await barberSupabase.rpc('pay_club_receivable', {
        p_receivable_id: selected.id,
        p_payment_method: paymentMethod,
        p_paid_at: toPaidAtIso(paidAt),
        p_notes: notes.trim() || null,
      });

      if (error) throw error;

      setToast({ message: 'Recebimento baixado, receita lançada e créditos liberados.', type: 'success' });
      setSelected(null);
      await fetchReceivables();
    } catch (error: any) {
      console.error('Erro ao dar baixa no recebimento:', error);
      setToast({ message: error?.message || 'Erro ao dar baixa no recebimento.', type: 'error' });
    } finally {
      paymentInFlightRef.current = false;
      setPaying(false);
    }
  };

  const selectedClient = selected ? clients[selected.customer_id] : null;
  const selectedPlan = selected ? plans[selected.plan_id] : null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full animate-fade-in p-4 md:p-6 pb-20">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="size-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20">
            <WalletCards className="h-7 w-7 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Recebimentos do Clube</h2>
            <p className="text-slate-500 text-sm font-medium">Baixa mensal das assinaturas e liberação dos créditos do ciclo.</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
          <Button variant="secondary" leftIcon="group" onClick={() => navigate('/chef-club-subscriptions')}>
            Assinaturas
          </Button>
          <Button leftIcon="sync" onClick={fetchReceivables}>
            Atualizar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-card-dark p-4">
          <p className="text-[10px] uppercase font-black text-slate-500">Total no filtro</p>
          <p className="mt-1 text-xl font-black text-slate-900 dark:text-white">{formatCurrency(totals.total)}</p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <p className="text-[10px] uppercase font-black text-emerald-600">Recebido</p>
          <p className="mt-1 text-xl font-black text-emerald-600">{formatCurrency(totals.paid)}</p>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-[10px] uppercase font-black text-amber-600">Pendente</p>
          <p className="mt-1 text-xl font-black text-amber-600">{formatCurrency(totals.pending)}</p>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <p className="text-[10px] uppercase font-black text-red-600">Atrasado</p>
          <p className="mt-1 text-xl font-black text-red-600">{formatCurrency(totals.overdue)}</p>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark p-4">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto] gap-3">
          <label className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por cliente, telefone ou plano..."
              className="w-full rounded-xl border border-slate-200 dark:border-border-dark bg-slate-50 dark:bg-background-dark py-3 pl-10 pr-4 text-sm text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
            />
          </label>

          <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-border-dark bg-slate-50 dark:bg-background-dark px-3">
            <CalendarRange className="h-4 w-4 text-slate-400" />
            <input
              type="date"
              value={periodStart}
              onChange={(event) => setPeriodStart(event.target.value)}
              className="bg-transparent py-3 text-sm font-semibold outline-none [color-scheme:light] dark:[color-scheme:dark]"
            />
            <span className="text-slate-400">até</span>
            <input
              type="date"
              value={periodEnd}
              onChange={(event) => setPeriodEnd(event.target.value)}
              className="bg-transparent py-3 text-sm font-semibold outline-none [color-scheme:light] dark:[color-scheme:dark]"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto">
            {(['all', 'pending', 'overdue', 'paid', 'cancelled', 'refunded'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                  statusFilter === status
                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                    : 'bg-white dark:bg-background-dark text-slate-500 border border-slate-200 dark:border-border-dark'
                }`}
              >
                {statusLabels[status]}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-card-dark overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10">
              <tr>
                {['Cliente', 'Plano', 'Ciclo', 'Vencimento', 'Valor', 'Status', 'Pagamento', 'Ações'].map((column) => (
                  <th key={column} className="px-5 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center text-sm text-slate-500">
                    Carregando recebimentos...
                  </td>
                </tr>
              ) : filteredReceivables.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center">
                    <p className="text-sm font-black uppercase tracking-widest text-slate-500">Nenhum recebimento encontrado</p>
                    <p className="mt-1 text-xs text-slate-400">Ajuste os filtros ou gere uma assinatura ativa do Clube.</p>
                  </td>
                </tr>
              ) : (
                filteredReceivables.map((receivable) => {
                  const client = clients[receivable.customer_id];
                  const plan = plans[receivable.plan_id];
                  const today = toDateInput(new Date());
                  const displayStatus: ReceivableStatus =
                    receivable.status === 'pending' && receivable.due_date < today ? 'overdue' : receivable.status;
                  const canPay = displayStatus === 'pending' || displayStatus === 'overdue';

                  return (
                    <tr key={receivable.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-5 py-4">
                        <p className="text-sm font-black text-slate-900 dark:text-white uppercase">{client?.name || 'Cliente não encontrado'}</p>
                        <p className="text-[10px] font-bold text-slate-500">{client?.phone || 'Sem telefone'}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm font-bold text-primary">{plan?.name || 'Plano não encontrado'}</p>
                      </td>
                      <td className="px-5 py-4 text-xs font-bold text-slate-500">
                        {new Date(receivable.billing_cycle_start).toLocaleDateString('pt-BR')}
                        {' - '}
                        {new Date(receivable.billing_cycle_end).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-5 py-4 text-sm font-bold text-slate-700 dark:text-slate-200">
                        {new Date(`${receivable.due_date}T12:00:00`).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-5 py-4 text-sm font-black text-slate-900 dark:text-white">
                        {formatCurrency(receivable.amount)}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${statusStyles[displayStatus]}`}>
                          {statusLabels[displayStatus]}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs font-bold text-slate-500">
                        {receivable.status === 'paid' ? (
                          <div className="flex flex-col">
                            <span>{receivable.payment_method || 'Não informado'}</span>
                            <span>{receivable.paid_at ? new Date(receivable.paid_at).toLocaleDateString('pt-BR') : '-'}</span>
                          </div>
                        ) : (
                          <span>-</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => openPaymentModal(receivable)}
                          disabled={!canPay}
                          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-600/20 transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none dark:disabled:bg-white/5"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Dar baixa
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        isOpen={!!selected}
        onClose={() => (paying ? undefined : setSelected(null))}
        title="Dar baixa no recebimento"
        maxWidth="lg"
      >
        {selected && (
          <form onSubmit={confirmPayment} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 dark:border-border-dark p-4">
                <p className="text-[10px] font-black uppercase text-slate-500">Cliente</p>
                <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{selectedClient?.name || 'Cliente não encontrado'}</p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-border-dark p-4">
                <p className="text-[10px] font-black uppercase text-slate-500">Plano</p>
                <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{selectedPlan?.name || 'Plano não encontrado'}</p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-border-dark p-4">
                <p className="text-[10px] font-black uppercase text-slate-500">Valor</p>
                <p className="mt-1 text-xl font-black text-emerald-600">{formatCurrency(selected.amount)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-border-dark p-4">
                <p className="text-[10px] font-black uppercase text-slate-500">Vencimento</p>
                <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                  {new Date(`${selected.due_date}T12:00:00`).toLocaleDateString('pt-BR')}
                </p>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">Forma de pagamento</label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {paymentMethods.map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-xs font-black transition-all ${
                      paymentMethod === method
                        ? 'border-primary bg-primary text-white shadow-lg shadow-primary/20'
                        : 'border-slate-200 dark:border-border-dark bg-slate-50 dark:bg-background-dark text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <CreditCard className="h-4 w-4" />
                    {method}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">Data de pagamento</label>
              <input
                type="date"
                required
                value={paidAt}
                onChange={(event) => setPaidAt(event.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-border-dark bg-slate-50 dark:bg-background-dark px-4 py-3 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary [color-scheme:light] dark:[color-scheme:dark]"
              />
            </div>

            <div>
              <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">Observação</label>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                placeholder="Observação opcional da baixa..."
                className="w-full resize-none rounded-xl border border-slate-200 dark:border-border-dark bg-slate-50 dark:bg-background-dark px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                disabled={paying}
                onClick={() => setSelected(null)}
                className="flex-1 rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-60 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={paying}
                className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-600/20 transition-colors hover:bg-emerald-700 disabled:opacity-60"
              >
                {paying ? 'Baixando...' : 'Confirmar baixa'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default ChefClubReceivables;
