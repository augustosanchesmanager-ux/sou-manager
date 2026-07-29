import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarRange, CheckCircle2, CreditCard, Search, WalletCards } from 'lucide-react';
import Toast from '../components/Toast';
import Modal from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../shared/format/currency';
import type { ReceivableStatus } from '../domain/chefClub';
import { receivableStatusLabels, receivableStatusMeta } from '../domain/chefClub';
import {
    loadReceivablePage,
    settleReceivableWithDetails,
    canPayReceivable,
    getDisplayStatus,
    filterReceivables,
    computeReceivableTotals,
} from '../application/chefClub';
import type {
    ReceivableRecord,
    ClientRecord,
    PlanRecord,
} from '../application/chefClub';

const paymentMethods = ['Pix', 'Dinheiro', 'Crédito', 'Débito', 'Outros'];

const formatDate = (value?: string | null) => {
    if (!value) return 'Sem data';
    return new Date(`${value.includes('T') ? value : `${value}T12:00:00`}`).toLocaleDateString('pt-BR');
};

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

const ChefClubReceivables: React.FC = () => {
    const { tenantId } = useAuth();
    const navigate = useNavigate();
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
            const data = await loadReceivablePage(tenantId, {
                status: statusFilter,
                dateFrom: periodStart,
                dateTo: periodEnd,
            });
            setReceivables(data.receivables);
            setClients(data.clients);
            setPlans(data.plans);
        } catch (error: any) {
            console.error('Erro ao carregar recebimentos do Clube:', error);
            setToast({ message: error?.message || 'Erro ao carregar recebimentos do Clube.', type: 'error' });
            setReceivables([]);
        } finally {
            setLoading(false);
        }
    }, [periodEnd, periodStart, statusFilter, tenantId]);

    useEffect(() => {
        void fetchReceivables();
    }, [fetchReceivables]);

    const filteredReceivables = useMemo(
        () => filterReceivables(receivables, clients, plans, search),
        [clients, plans, receivables, search],
    );

    const totals = useMemo(() => computeReceivableTotals(filteredReceivables), [filteredReceivables]);
    totals.statusCounts.all = filteredReceivables.length;

    const metricCards = [
        {
            label: 'Total no período',
            value: formatCurrency(totals.total),
            helper: `${totals.count} mensalidades no filtro`,
            icon: 'account_balance_wallet',
            tone: 'text-slate-900 dark:text-white',
        },
        {
            label: 'Já recebido',
            value: formatCurrency(totals.paid),
            helper: 'Ciclos pagos e liberados',
            icon: 'verified',
            tone: 'text-emerald-700 dark:text-emerald-300',
        },
        {
            label: 'Em aberto',
            value: formatCurrency(totals.pending),
            helper: `${totals.statusCounts.pending} mensalidades pendentes`,
            icon: 'schedule',
            tone: 'text-amber-700 dark:text-amber-300',
        },
        {
            label: 'Atrasado',
            value: formatCurrency(totals.overdue),
            helper: `${totals.statusCounts.overdue} clientes para priorizar`,
            icon: 'priority_high',
            tone: 'text-red-700 dark:text-red-300',
        },
    ];

    const openPaymentModal = (receivable: ReceivableRecord) => {
        if (!canPayReceivable(receivable)) {
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
            await settleReceivableWithDetails({
                receivableId: selected.id,
                paymentMethod,
                paidAt,
                notes,
            });

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
        <div className="mx-auto w-full max-w-7xl space-y-6 p-4 pb-20 md:p-6">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <section className="overflow-hidden rounded-2xl border border-[#D8E8F3] bg-[#003366] text-white shadow-sm dark:border-[#14304A]">
                <div className="grid gap-5 p-5 md:grid-cols-[1fr_auto] md:items-end md:p-6">
                    <div className="max-w-3xl">
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-[#BFEFFF]">
                            <WalletCards className="h-4 w-4" />
                            Caixa recorrente do Club dos Chefes
                        </div>
                        <h1 className="mt-4 text-2xl font-black leading-tight md:text-3xl">Recebimentos do Clube</h1>
                        <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-200">
                            Baixe mensalidades, libere créditos do ciclo e mantenha a receita recorrente conectada ao financeiro real da barbearia.
                        </p>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                        <button
                            onClick={() => navigate('/chef-club-subscriptions')}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-[#00D2FF]/40"
                        >
                            <span className="material-symbols-outlined text-base">group</span>
                            Assinaturas
                        </button>
                        <button
                            onClick={fetchReceivables}
                            disabled={loading}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#E5A158] px-4 py-3 text-sm font-bold text-[#171717] transition-colors hover:bg-[#D97706] focus:outline-none focus:ring-2 focus:ring-[#E5A158]/40 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                            <span className="material-symbols-outlined text-base">{loading ? 'progress_activity' : 'sync'}</span>
                            Atualizar
                        </button>
                    </div>
                </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {metricCards.map((metric) => (
                    <div
                        key={metric.label}
                        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-card-dark"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{metric.label}</p>
                                <p className={`mt-2 text-xl font-black ${metric.tone}`}>{metric.value}</p>
                            </div>
                            <span className="material-symbols-outlined rounded-xl border border-[#D8E8F3] bg-[#F1F8FC] p-2 text-[#003366] dark:border-[#14304A] dark:bg-[#071426] dark:text-[#00D2FF]">
                                {metric.icon}
                            </span>
                        </div>
                        <p className="mt-3 text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">{metric.helper}</p>
                    </div>
                ))}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-card-dark">
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_auto_auto]">
                    <label className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Buscar por cliente, telefone ou plano"
                            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm font-medium text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#007BFF] focus:ring-2 focus:ring-[#007BFF]/10 dark:border-white/10 dark:bg-white/5 dark:text-white"
                        />
                    </label>

                    <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-white/10 dark:bg-white/5 sm:flex-row sm:items-center">
                        <div className="flex items-center gap-2 px-1 text-xs font-bold text-slate-500 dark:text-slate-400">
                            <CalendarRange className="h-4 w-4" />
                            Período
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={periodStart}
                                onChange={(event) => setPeriodStart(event.target.value)}
                                className="min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm font-semibold text-slate-800 outline-none [color-scheme:light] focus:border-[#007BFF] dark:border-white/10 dark:bg-[#0F172A] dark:text-slate-100 dark:[color-scheme:dark]"
                            />
                            <span className="text-xs font-bold text-slate-400">até</span>
                            <input
                                type="date"
                                value={periodEnd}
                                onChange={(event) => setPeriodEnd(event.target.value)}
                                className="min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm font-semibold text-slate-800 outline-none [color-scheme:light] focus:border-[#007BFF] dark:border-white/10 dark:bg-[#0F172A] dark:text-slate-100 dark:[color-scheme:dark]"
                            />
                        </div>
                    </div>

                    <div className="flex gap-2 overflow-x-auto pb-1">
                        {(['all', 'pending', 'overdue', 'paid', 'cancelled', 'refunded'] as const).map((status) => {
                            const isSelected = statusFilter === status;
                            return (
                                <button
                                    key={status}
                                    onClick={() => setStatusFilter(status)}
                                    className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-[#007BFF]/20 ${
                                        isSelected
                                            ? 'border-[#003366] bg-[#003366] text-white dark:border-[#00D2FF] dark:bg-[#00D2FF] dark:text-[#06111F]'
                                            : 'border-slate-200 bg-white text-slate-600 hover:border-[#007BFF]/40 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'
                                    }`}
                                >
                                    {receivableStatusLabels[status]}
                                    <span className="ml-2 text-[11px] opacity-70">{status === 'all' ? totals.statusCounts.all : totals.statusCounts[status]}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-card-dark">
                <div className="border-b border-slate-200 px-4 py-4 dark:border-white/10 md:px-5">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <h2 className="text-base font-black text-slate-900 dark:text-white">Mensalidades do ciclo</h2>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                Cada baixa usa o fluxo real: lançamento financeiro e liberação dos créditos do Clube.
                            </p>
                        </div>
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{filteredReceivables.length} registros</span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full min-w-[1040px] text-left">
                        <thead className="border-b border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5">
                            <tr>
                                {['Cliente', 'Plano', 'Ciclo', 'Vencimento', 'Valor', 'Status', 'Pagamento', 'Ações'].map((column) => (
                                    <th key={column} className="px-5 py-3 text-xs font-bold text-slate-500 dark:text-slate-400">
                                        {column}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-16 text-center">
                                        <div className="mx-auto flex max-w-xs flex-col items-center">
                                            <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-b-[#007BFF] dark:border-white/10 dark:border-b-[#00D2FF]" />
                                            <p className="mt-4 text-sm font-bold text-slate-600 dark:text-slate-300">Carregando recebimentos</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredReceivables.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-16 text-center">
                                        <div className="mx-auto flex max-w-sm flex-col items-center">
                                            <span className="material-symbols-outlined rounded-2xl border border-[#D8E8F3] bg-[#F1F8FC] p-3 text-3xl text-[#003366] dark:border-[#14304A] dark:bg-[#071426] dark:text-[#00D2FF]">
                                                receipt_long
                                            </span>
                                            <p className="mt-4 text-base font-black text-slate-900 dark:text-white">Nenhum recebimento encontrado</p>
                                            <p className="mt-2 text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">
                                                Ajuste o período ou acompanhe as assinaturas ativas para gerar os ciclos de cobrança do Clube.
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredReceivables.map((receivable) => {
                                    const client = clients[receivable.customer_id];
                                    const plan = plans[receivable.plan_id];
                                    const displayStatus = getDisplayStatus(receivable);
                                    const status = receivableStatusMeta[displayStatus];
                                    const canPay = canPayReceivable(receivable);

                                    return (
                                        <tr key={receivable.id} className="transition-colors hover:bg-slate-50/80 dark:hover:bg-white/5">
                                            <td className="px-5 py-4 align-top">
                                                <p className="max-w-[220px] truncate text-sm font-black text-slate-900 dark:text-white">{client?.name || 'Cliente não encontrado'}</p>
                                                <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{client?.phone || 'Sem telefone'}</p>
                                            </td>
                                            <td className="px-5 py-4 align-top">
                                                <p className="text-sm font-black text-[#003366] dark:text-[#00D2FF]">{plan?.name || 'Plano não encontrado'}</p>
                                                <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                                                    Mensalidade recorrente
                                                </p>
                                            </td>
                                            <td className="px-5 py-4 align-top">
                                                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{formatDate(receivable.billing_cycle_start)}</p>
                                                <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                                                    até {formatDate(receivable.billing_cycle_end)}
                                                </p>
                                            </td>
                                            <td className="px-5 py-4 align-top">
                                                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{formatDate(receivable.due_date)}</p>
                                            </td>
                                            <td className="px-5 py-4 align-top">
                                                <p className="text-sm font-black text-slate-900 dark:text-white">{formatCurrency(receivable.amount)}</p>
                                            </td>
                                            <td className="px-5 py-4 align-top">
                                                <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black ${status.className}`}>
                                                    <span className="material-symbols-outlined text-sm">{status.icon}</span>
                                                    {receivableStatusLabels[displayStatus]}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 align-top">
                                                {receivable.status === 'paid' ? (
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{receivable.payment_method || 'Não informado'}</span>
                                                        <span className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{formatDate(receivable.paid_at)}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-sm font-medium text-slate-400">Aguardando baixa</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 align-top">
                                                <button
                                                    type="button"
                                                    onClick={() => openPaymentModal(receivable)}
                                                    disabled={!canPay}
                                                    className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 transition-colors hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/15 dark:disabled:border-white/10 dark:disabled:bg-white/5 dark:disabled:text-slate-500"
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
                        <div className="rounded-2xl border border-[#D8E8F3] bg-[#F1F8FC] p-4 dark:border-[#14304A] dark:bg-[#071426]">
                            <p className="text-xs font-bold text-[#003366] dark:text-[#00D2FF]">Baixa transacional do Clube</p>
                            <p className="mt-1 text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">
                                Ao confirmar, o sistema registra a receita e libera os créditos do ciclo conforme a regra existente.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
                                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Cliente</p>
                                <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{selectedClient?.name || 'Cliente não encontrado'}</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
                                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Plano</p>
                                <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{selectedPlan?.name || 'Plano não encontrado'}</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
                                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Valor</p>
                                <p className="mt-1 text-xl font-black text-emerald-700 dark:text-emerald-300">{formatCurrency(selected.amount)}</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
                                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Vencimento</p>
                                <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{formatDate(selected.due_date)}</p>
                            </div>
                        </div>

                        <div>
                            <label className="mb-2 block text-xs font-bold text-slate-500 dark:text-slate-400">Forma de pagamento</label>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                                {paymentMethods.map((method) => (
                                    <button
                                        key={method}
                                        type="button"
                                        onClick={() => setPaymentMethod(method)}
                                        className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-xs font-black transition-colors focus:outline-none focus:ring-2 focus:ring-[#007BFF]/20 ${
                                            paymentMethod === method
                                                ? 'border-[#003366] bg-[#003366] text-white dark:border-[#00D2FF] dark:bg-[#00D2FF] dark:text-[#06111F]'
                                                : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-[#007BFF]/40 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'
                                        }`}
                                    >
                                        <CreditCard className="h-4 w-4" />
                                        {method}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="mb-2 block text-xs font-bold text-slate-500 dark:text-slate-400">Data de pagamento</label>
                            <input
                                type="date"
                                required
                                value={paidAt}
                                onChange={(event) => setPaidAt(event.target.value)}
                                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-900 outline-none [color-scheme:light] focus:border-[#007BFF] focus:ring-2 focus:ring-[#007BFF]/10 dark:border-white/10 dark:bg-white/5 dark:text-white dark:[color-scheme:dark]"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-xs font-bold text-slate-500 dark:text-slate-400">Observação</label>
                            <textarea
                                value={notes}
                                onChange={(event) => setNotes(event.target.value)}
                                rows={3}
                                placeholder="Observação opcional da baixa"
                                className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#007BFF] focus:ring-2 focus:ring-[#007BFF]/10 dark:border-white/10 dark:bg-white/5 dark:text-white"
                            />
                        </div>

                        <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                            <button
                                type="button"
                                disabled={paying}
                                onClick={() => setSelected(null)}
                                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={paying}
                                className="flex-1 rounded-xl bg-[#003366] px-4 py-3 text-sm font-black text-white transition-colors hover:bg-[#007BFF] focus:outline-none focus:ring-2 focus:ring-[#007BFF]/30 disabled:opacity-60 dark:bg-[#00D2FF] dark:text-[#06111F] dark:hover:bg-[#38DFFF]"
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
