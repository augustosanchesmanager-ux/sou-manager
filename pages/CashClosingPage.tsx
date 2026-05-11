import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, CalendarRange, CheckCircle, AlertTriangle, FileText, Package, Users } from 'lucide-react';
import Toast from '../components/Toast';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import FinancialSummaryCard from '../components/financial/FinancialSummaryCard';
import { EnrichedCashFlowEntry } from '../components/financial/types';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';

interface TransactionRecord {
    id: string;
    type: string;
    category: string | null;
    amount: number | string | null;
    description: string | null;
    payment_method: string | null;
    date: string | null;
    created_at?: string | null;
}

const CashClosingPage: React.FC = () => {
    const { tenantId } = useAuth();
    const hasTenantContext = Boolean(tenantId);
    const [filterMonth, setFilterMonth] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
    const [loading, setLoading] = useState(true);
    const [entries, setEntries] = useState<EnrichedCashFlowEntry[]>([]);
    const [showSummary, setShowSummary] = useState(false);

    const [openComandasCount, setOpenComandasCount] = useState(0);
    const [openComandasTotal, setOpenComandasTotal] = useState(0);
    const [clubOverdueCount, setClubOverdueCount] = useState(0);
    const [clubOverdueTotal, setClubOverdueTotal] = useState(0);
    const [pendingReceiptsCount, setPendingReceiptsCount] = useState(0);
    const [pendingReceiptsTotal, setPendingReceiptsTotal] = useState(0);

    const fetchData = useCallback(async () => {
        if (!tenantId || !filterMonth) {
            setEntries([]);
            setLoading(false);
            return;
        }

        setLoading(true);

        const [yearStr, monthStr] = filterMonth.split('-');
        const year = Number(yearStr);
        const month = Number(monthStr);
        const startOfMonth = new Date(year, month - 1, 1).toISOString();
        const endOfMonth = new Date(year, month, 0, 23, 59, 59).toISOString();

        try {
            const [
                transactionsResult,
                comandasResult,
                clubResult,
                receiptsResult,
            ] = await Promise.all([
                supabase
                    .from('transactions')
                    .select('id, type, category, amount, description, payment_method, date, created_at')
                    .eq('tenant_id', tenantId)
                    .gte('date', startOfMonth)
                    .lte('date', endOfMonth)
                    .order('date', { ascending: true }),
                supabase
                    .from('comandas')
                    .select('id, status, total')
                    .eq('tenant_id', tenantId)
                    .eq('status', 'open'),
                supabase.rpc('generate_club_receivables', { p_tenant_id: tenantId }).then(() =>
                    supabase
                        .from('customer_subscription_receivables')
                        .select('id, amount, status')
                        .eq('tenant_id', tenantId)
                        .in('status', ['pending', 'overdue'])
                ),
                supabase
                    .from('transactions')
                    .select('id, status, amount')
                    .eq('tenant_id', tenantId)
                    .gte('date', startOfMonth)
                    .lte('date', endOfMonth),
            ]);

            if (transactionsResult.error) throw transactionsResult.error;

            const txData = (transactionsResult.data || []) as TransactionRecord[];
            const mappedEntries: EnrichedCashFlowEntry[] = txData.map(transaction => {
                const type = transaction.type === 'income' ? 'entrada' : 'saida';
                const value = Number(transaction.amount || 0);
                return {
                    id: transaction.id,
                    date: transaction.date || transaction.created_at || new Date().toISOString(),
                    description: transaction.description || transaction.category || 'Lancamento sem descricao',
                    category: transaction.category || 'Sem categoria',
                    accountId: transaction.payment_method || 'nao-informado',
                    accountName: transaction.payment_method || 'Nao informado',
                    costCenter: transaction.category || 'Sem centro',
                    type,
                    paymentMethod: transaction.payment_method || 'Nao informado',
                    status: 'realizado',
                    value,
                    runningBalance: 0,
                };
            });
            setEntries(mappedEntries);

            if (comandasResult.data) {
                const openCmds = comandasResult.data as any[];
                setOpenComandasCount(openCmds.length);
                setOpenComandasTotal(openCmds.reduce((sum: number, c: any) => sum + Number(c.total || 0), 0));
            }

            if (clubResult.data) {
                const clubData = (clubResult.data as any[]).filter((r: any) => !r.transaction_id);
                const overdue = clubData.filter((r: any) => r.status === 'overdue');
                setClubOverdueCount(overdue.length);
                setClubOverdueTotal(overdue.reduce((sum: number, r: any) => sum + Number(r.amount || 0), 0));
            }

            if (receiptsResult.data) {
                const txAll = receiptsResult.data as any[];
                const pendentes = txAll.filter((tx: any) => {
                    let status = tx.status || 'Pago';
                    if (status !== 'Pago' && status !== 'Pendente' && status !== 'Cancelado') {
                        status = status === 'paid' ? 'Pago' : (status === 'pending' ? 'Pendente' : 'Pago');
                    }
                    return status === 'Pendente';
                });
                setPendingReceiptsCount(pendentes.length);
                setPendingReceiptsTotal(pendentes.reduce((sum: number, r: any) => sum + Number(r.amount || 0), 0));
            }

        } catch (error: any) {
            console.error('Erro ao carregar conferencia de caixa:', error);
            setToast({ message: error?.message || 'Erro ao carregar conferencia de caixa.', type: 'error' });
            setEntries([]);
        } finally {
            setLoading(false);
        }
    }, [filterMonth, tenantId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const totalEntradas = entries
        .filter(e => e.type === 'entrada')
        .reduce((sum, e) => sum + e.value, 0);
    const totalSaidas = entries
        .filter(e => e.type === 'saida')
        .reduce((sum, e) => sum + e.value, 0);
    const saldoAtual = totalEntradas - totalSaidas;
    const entradasCount = entries.filter(e => e.type === 'entrada').length;
    const saidasCount = entries.filter(e => e.type === 'saida').length;

    const paymentMethodBreakdown = useMemo(() => {
        const map: Record<string, { entradas: number; saidas: number; count: number }> = {};
        entries.forEach(e => {
            if (!map[e.paymentMethod]) map[e.paymentMethod] = { entradas: 0, saidas: 0, count: 0 };
            if (e.type === 'entrada') map[e.paymentMethod].entradas += e.value;
            else map[e.paymentMethod].saidas += e.value;
            map[e.paymentMethod].count += 1;
        });
        return Object.entries(map).sort((a, b) => b[1].count - a[1].count);
    }, [entries]);

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Conferencia de Caixa</h2>
                    <p className="text-slate-500 mt-1">Resumo operacional de Conferencia de Caixa do periodo selecionado.</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                    <label className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark px-3 py-2.5">
                        <CalendarRange className="h-4 w-4 text-slate-400" />
                        <input
                            type="month"
                            value={filterMonth}
                            onChange={e => setFilterMonth(e.target.value)}
                            className="bg-transparent text-sm font-semibold text-slate-700 dark:text-slate-200 outline-none [color-scheme:light] dark:[color-scheme:dark]"
                        />
                    </label>
                    <Button leftIcon="sync" onClick={fetchData}>
                        Atualizar
                    </Button>
                </div>
            </div>

            <div className="flex items-center gap-3 p-4 rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-500/10">
                <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400 shrink-0" />
                <p className="text-sm text-amber-700 dark:text-amber-300">
                    <strong>Conferencia operacional.</strong> Esta tela faz a leitura dos lancamentos registrados. O fechamento definitivo exigira persistencia no banco de dados.
                </p>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="rounded-2xl border border-slate-200/80 dark:border-border-dark bg-white/95 dark:bg-card-dark/90 p-5 h-32 animate-pulse" />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    <FinancialSummaryCard
                        title="Entradas"
                        value={totalEntradas}
                        changeText={`${entradasCount} registros`}
                        trend="up"
                        tone="positive"
                        helperText="Total de receitas do periodo"
                        icon={<ArrowUpCircle size={18} />}
                    />
                    <FinancialSummaryCard
                        title="Saidas"
                        value={totalSaidas}
                        changeText={`${saidasCount} registros`}
                        trend="down"
                        tone="negative"
                        helperText="Total de despesas do periodo"
                        icon={<ArrowDownCircle size={18} />}
                    />
                    <FinancialSummaryCard
                        title="Saldo Operacional"
                        value={saldoAtual}
                        changeText={saldoAtual >= 0 ? 'Conferencia positiva' : 'Conferencia negativa'}
                        trend={saldoAtual >= 0 ? 'up' : 'down'}
                        tone={saldoAtual >= 0 ? 'positive' : 'negative'}
                        helperText="Entradas menos saidas"
                        icon={<CheckCircle size={18} />}
                    />
                </div>
            )}

            <div className="rounded-2xl border border-slate-200/80 dark:border-border-dark bg-white dark:bg-card-dark p-8">
                <div className="flex items-start gap-4 mb-6">
                    <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        <span className="material-symbols-outlined text-2xl">fact_check</span>
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-slate-950 dark:text-white mb-1">Resumo de Conferencia</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Revise os valores antes de qualquer acao de fechamento definitivo.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                    <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-800 p-4">
                        <p className="text-xs font-black uppercase text-emerald-600 dark:text-emerald-400 mb-1">Total Entradas</p>
                        <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                            {totalEntradas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                        <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-1">{entradasCount} lancamentos</p>
                    </div>
                    <div className="rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-800 p-4">
                        <p className="text-xs font-black uppercase text-rose-600 dark:text-rose-400 mb-1">Total Saidas</p>
                        <p className="text-2xl font-black text-rose-600 dark:text-rose-400">
                            {totalSaidas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                        <p className="text-xs text-rose-600/70 dark:text-rose-400/70 mt-1">{saidasCount} lancamentos</p>
                    </div>
                </div>

                <div className="border-t border-slate-200 dark:border-border-dark pt-6 flex flex-col sm:flex-row gap-3">
                    <Button
                        leftIcon="fact_check"
                        onClick={() => setShowSummary(prev => !prev)}
                        className="flex-1"
                    >
                        {showSummary ? 'Ocultar Resumo' : 'Gerar Resumo de Conferencia'}
                    </Button>
                    <Button
                        variant="secondary"
                        leftIcon="print"
                        onClick={handlePrint}
                        className="flex-1"
                    >
                        Imprimir Relatorio
                    </Button>
                </div>
            </div>

            <Modal
                isOpen={showSummary}
                onClose={() => setShowSummary(false)}
                title="Resumo de Conferencia"
                maxWidth="lg"
            >
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-800 p-4 text-center">
                            <p className="text-xs font-black uppercase text-emerald-600 mb-1">Entradas</p>
                            <p className="text-xl font-black text-emerald-600">
                                {totalEntradas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                            <p className="text-[10px] text-emerald-600/70 mt-1">{entradasCount} registros</p>
                        </div>
                        <div className="rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-800 p-4 text-center">
                            <p className="text-xs font-black uppercase text-rose-600 mb-1">Saidas</p>
                            <p className="text-xl font-black text-rose-600">
                                {totalSaidas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                            <p className="text-[10px] text-rose-600/70 mt-1">{saidasCount} registros</p>
                        </div>
                    </div>

                    <div className="rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-border-dark p-4 text-center">
                        <p className="text-xs font-black uppercase text-slate-500 mb-1">Saldo Operacional Esperado</p>
                        <p className={`text-2xl font-black ${saldoAtual >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {saldoAtual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                    </div>

                    <div className="border-t border-slate-200 dark:border-border-dark pt-4">
                        <h4 className="text-xs font-black uppercase text-slate-500 mb-3">Pendencias antes do fechamento</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-800">
                                <Package className="size-4 text-amber-600 shrink-0" />
                                <div>
                                    <p className="text-xs font-bold text-amber-600">{openComandasCount} comandas abertas</p>
                                    <p className="text-[10px] text-amber-600/70">
                                        {openComandasTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-800">
                                <Users className="size-4 text-red-600 shrink-0" />
                                <div>
                                    <p className="text-xs font-bold text-red-600">{clubOverdueCount} planos atrasados</p>
                                    <p className="text-[10px] text-red-600/70">
                                        {clubOverdueTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-800">
                                <FileText className="size-4 text-blue-600 shrink-0" />
                                <div>
                                    <p className="text-xs font-bold text-blue-600">{pendingReceiptsCount} recibos pendentes</p>
                                    <p className="text-[10px] text-blue-600/70">
                                        {pendingReceiptsTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {paymentMethodBreakdown.length > 0 && (
                        <div className="border-t border-slate-200 dark:border-border-dark pt-4">
                            <h4 className="text-xs font-black uppercase text-slate-500 mb-3">Por forma de pagamento</h4>
                            <div className="space-y-2">
                                {paymentMethodBreakdown.map(([method, data]) => (
                                    <div key={method} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-white/5 last:border-0">
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{method}</span>
                                        <div className="flex gap-4">
                                            <span className="text-xs text-emerald-600 font-bold">
                                                +{data.entradas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            </span>
                                            <span className="text-xs text-rose-600 font-bold">
                                                -{data.saidas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default CashClosingPage;
