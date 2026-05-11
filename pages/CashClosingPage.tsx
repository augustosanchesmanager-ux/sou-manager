import React, { useCallback, useEffect, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, CalendarRange, CheckCircle, AlertTriangle } from 'lucide-react';
import Toast from '../components/Toast';
import Button from '../components/ui/Button';
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
            const { data, error } = await supabase
                .from('transactions')
                .select('id, type, category, amount, description, payment_method, date, created_at')
                .eq('tenant_id', tenantId)
                .gte('date', startOfMonth)
                .lte('date', endOfMonth)
                .order('date', { ascending: true });

            if (error) throw error;

            const mappedEntries: EnrichedCashFlowEntry[] = ((data || []) as TransactionRecord[]).map((transaction) => {
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
        } catch (error: any) {
            console.error('Erro ao carregar fechamento de caixa:', error);
            setToast({ message: error?.message || 'Erro ao carregar fechamento de caixa.', type: 'error' });
            setEntries([]);
        } finally {
            setLoading(false);
        }
    }, [filterMonth, tenantId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const totalEntradas = entries
        .filter((entry) => entry.type === 'entrada')
        .reduce((sum, entry) => sum + entry.value, 0);
    const totalSaidas = entries
        .filter((entry) => entry.type === 'saida')
        .reduce((sum, entry) => sum + entry.value, 0);
    const saldoAtual = totalEntradas - totalSaidas;
    const entradasCount = entries.filter((entry) => entry.type === 'entrada').length;
    const saidasCount = entries.filter((entry) => entry.type === 'saida').length;

    const handleGenerateReport = () => {
        setToast({
            message: 'Resumo de fechamento gerado com sucesso. Esta e uma conferenca operacional — nenhum dado foi persistido.',
            type: 'info',
        });
    };

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Fechamento de Caixa</h2>
                    <p className="text-slate-500 mt-1">Conferencia operacional do caixa do periodo selecionado.</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                    <label className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark px-3 py-2.5">
                        <CalendarRange className="h-4 w-4 text-slate-400" />
                        <input
                            type="month"
                            value={filterMonth}
                            onChange={(event) => setFilterMonth(event.target.value)}
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
                    <strong>Conferencia operacional.</strong> Esta tela mostra um resumo de leitura dos lancamentos registrados. Nenhum fechamento real e persistido no banco.
                </p>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {[1, 2, 3].map((i) => (
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
                        changeText={saldoAtual >= 0 ? 'Fechamento positivo' : 'Fechamento negativo'}
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
                        <h3 className="text-base font-bold text-slate-950 dark:text-white mb-1">Resumo do Periodo</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Conferencie os valores de entradas e saidas do periodo selecionado antes de registrar o fechamento.
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
                        onClick={handleGenerateReport}
                        className="flex-1"
                    >
                        Gerar Resumo de Conferencia
                    </Button>
                    <Button
                        variant="secondary"
                        leftIcon="print"
                        onClick={() => window.print()}
                        className="flex-1"
                    >
                        Imprimir Relatorio
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default CashClosingPage;
