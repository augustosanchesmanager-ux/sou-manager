import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, CalendarRange, Wallet } from 'lucide-react';
import Toast from '../components/Toast';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import CashFlowChart from '../components/financial/CashFlowChart';
import FinancialSummaryCard from '../components/financial/FinancialSummaryCard';
import EmptyStateFinance from '../components/financial/EmptyStateFinance';
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

const Cashflow: React.FC = () => {
    const { tenantId } = useAuth();
    const hasTenantContext = Boolean(tenantId);
    const [filterMonth, setFilterMonth] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
    const [loading, setLoading] = useState(true);
    const [entries, setEntries] = useState<EnrichedCashFlowEntry[]>([]);
    const [selectedEntry, setSelectedEntry] = useState<EnrichedCashFlowEntry | null>(null);

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

            let runningBalance = 0;
            const mappedEntries: EnrichedCashFlowEntry[] = ((data || []) as TransactionRecord[]).map((transaction) => {
                const type = transaction.type === 'income' ? 'entrada' : 'saida';
                const value = Number(transaction.amount || 0);
                runningBalance += type === 'entrada' ? value : -value;

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
                    runningBalance,
                };
            });

            setEntries(mappedEntries);
        } catch (error: any) {
            console.error('Erro ao carregar fluxo de caixa:', error);
            setToast({ message: error?.message || 'Erro ao carregar fluxo de caixa.', type: 'error' });
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
    const ticketMedioEntrada = entries.filter((entry) => entry.type === 'entrada').length > 0
        ? totalEntradas / entries.filter((entry) => entry.type === 'entrada').length
        : 0;

    const chartData = useMemo(() => {
        const grouped = entries.reduce<Record<string, { entradas: number; saidas: number; saldo: number }>>((acc, entry) => {
            const label = new Date(`${entry.date}`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

            if (!acc[label]) {
                acc[label] = { entradas: 0, saidas: 0, saldo: 0 };
            }

            if (entry.type === 'entrada') {
                acc[label].entradas += entry.value;
                acc[label].saldo += entry.value;
            } else {
                acc[label].saidas += entry.value;
                acc[label].saldo -= entry.value;
            }

            return acc;
        }, {});

        let runningBalance = 0;
        return Object.entries(grouped).map(([label, value]) => {
            runningBalance += value.saldo;
            return {
                label,
                entradas: value.entradas,
                saidas: value.saidas,
                saldo: runningBalance,
            };
        });
    }, [entries]);

    const handleExport = () => {
        if (entries.length === 0) {
            setToast({ message: 'Nao ha dados para exportar neste periodo.', type: 'info' });
            return;
        }

        const headers = ['Data', 'Descricao', 'Categoria', 'Forma de pagamento', 'Tipo', 'Valor', 'Saldo acumulado'];
        const rows = entries.map((entry) => [
            new Date(entry.date).toLocaleDateString('pt-BR'),
            entry.description,
            entry.category,
            entry.paymentMethod,
            entry.type,
            entry.value.toFixed(2).replace('.', ','),
            entry.runningBalance.toFixed(2).replace('.', ','),
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(';'), ...rows.map((row) => row.join(';'))].join('\n');
        const link = document.createElement('a');
        link.setAttribute('href', encodeURI(csvContent));
        link.setAttribute('download', `fluxo-caixa-${filterMonth}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setToast({ message: 'Fluxo exportado com sucesso.', type: 'success' });
    };

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Fluxo de Caixa</h2>
                    <p className="text-slate-500 mt-1">Leitura real das transacoes financeiras registradas no periodo.</p>
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
                    <Button variant="secondary" leftIcon="download" onClick={handleExport}>
                        Exportar
                    </Button>
                    <Button leftIcon="sync" onClick={fetchData}>
                        Atualizar
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <FinancialSummaryCard
                    title="Entradas"
                    value={totalEntradas}
                    changeText={`${entries.filter((entry) => entry.type === 'entrada').length} registros`}
                    trend="up"
                    tone="positive"
                    helperText="Total de receitas do periodo"
                    icon={<ArrowUpCircle size={18} />}
                />
                <FinancialSummaryCard
                    title="Saidas"
                    value={totalSaidas}
                    changeText={`${entries.filter((entry) => entry.type === 'saida').length} registros`}
                    trend="down"
                    tone="negative"
                    helperText="Total de despesas do periodo"
                    icon={<ArrowDownCircle size={18} />}
                />
                <FinancialSummaryCard
                    title="Saldo atual"
                    value={saldoAtual}
                    changeText={saldoAtual >= 0 ? 'Fechamento positivo' : 'Fechamento negativo'}
                    trend={saldoAtual >= 0 ? 'up' : 'down'}
                    tone={saldoAtual >= 0 ? 'positive' : 'negative'}
                    helperText="Entradas menos saidas no periodo"
                    icon={<Wallet size={18} />}
                />
                <FinancialSummaryCard
                    title="Ticket medio"
                    value={ticketMedioEntrada}
                    changeText="Receitas por lancamento"
                    trend="up"
                    tone="neutral"
                    helperText="Media das entradas registradas"
                    icon={<Wallet size={18} />}
                />
            </div>

            {loading ? (
                <section className="rounded-2xl border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark p-10 text-center">
                    <div className="mx-auto size-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                    <p className="mt-3 text-sm text-slate-500">Carregando transacoes do periodo...</p>
                </section>
            ) : entries.length === 0 ? (
                <EmptyStateFinance
                    title="Nenhuma movimentacao encontrada"
                    description={
                        hasTenantContext
                            ? 'Nao ha transacoes registradas para o periodo selecionado.'
                            : 'Esta conta nao possui contexto de tenant para consultar o financeiro.'
                    }
                    actionLabel="Atualizar"
                    onAction={fetchData}
                />
            ) : (
                <>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        <CashFlowChart
                            title="Entradas x saidas"
                            subtitle="Comparativo diario das transacoes registradas"
                            variant="bar"
                            data={chartData}
                        />
                        <CashFlowChart
                            title="Saldo acumulado"
                            subtitle="Evolucao real do saldo ao longo do periodo"
                            variant="area"
                            data={chartData}
                        />
                    </div>

                    <section className="rounded-2xl border border-slate-200/80 dark:border-border-dark bg-white dark:bg-card-dark overflow-hidden">
                        <div className="flex items-center justify-between gap-3 border-b border-slate-200 dark:border-border-dark px-5 py-4">
                            <div>
                                <h3 className="text-base font-bold text-slate-950 dark:text-white">Lancamentos do periodo</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Tabela somente leitura com dados reais do financeiro.</p>
                            </div>
                            <div className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600 dark:bg-white/5 dark:text-slate-300">
                                {entries.length} registros
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full text-left">
                                <thead className="bg-slate-50/90 dark:bg-white/5">
                                    <tr>
                                        {['Data', 'Descricao', 'Categoria', 'Forma de pagamento', 'Tipo', 'Valor', 'Saldo', 'Acao'].map((column) => (
                                            <th key={column} className="px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                                                {column}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                    {entries.map((entry) => (
                                        <tr key={entry.id} className="hover:bg-slate-50/80 dark:hover:bg-white/5">
                                            <td className="px-5 py-4 text-sm text-slate-700 dark:text-slate-200">{new Date(entry.date).toLocaleDateString('pt-BR')}</td>
                                            <td className="px-5 py-4 text-sm font-semibold text-slate-900 dark:text-white">{entry.description}</td>
                                            <td className="px-5 py-4 text-sm text-slate-700 dark:text-slate-200">{entry.category}</td>
                                            <td className="px-5 py-4 text-sm text-slate-700 dark:text-slate-200">{entry.paymentMethod}</td>
                                            <td className="px-5 py-4">
                                                <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase ${entry.type === 'entrada' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
                                                    {entry.type}
                                                </span>
                                            </td>
                                            <td className={`px-5 py-4 text-sm font-bold ${entry.type === 'entrada' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                {entry.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            </td>
                                            <td className="px-5 py-4 text-sm font-semibold text-slate-900 dark:text-white">
                                                {entry.runningBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            </td>
                                            <td className="px-5 py-4">
                                                <Button variant="secondary" size="sm" className="rounded-xl" onClick={() => setSelectedEntry(entry)}>
                                                    Ver detalhes
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </>
            )}

            <Modal
                isOpen={!!selectedEntry}
                onClose={() => setSelectedEntry(null)}
                title={selectedEntry ? `Lancamento ${selectedEntry.type}` : 'Detalhes do lancamento'}
                maxWidth="lg"
            >
                {selectedEntry && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="rounded-xl border border-slate-200 dark:border-border-dark p-4">
                                <p className="text-xs font-bold uppercase text-slate-500">Descricao</p>
                                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{selectedEntry.description}</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 dark:border-border-dark p-4">
                                <p className="text-xs font-bold uppercase text-slate-500">Data</p>
                                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{new Date(selectedEntry.date).toLocaleString('pt-BR')}</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 dark:border-border-dark p-4">
                                <p className="text-xs font-bold uppercase text-slate-500">Categoria</p>
                                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{selectedEntry.category}</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 dark:border-border-dark p-4">
                                <p className="text-xs font-bold uppercase text-slate-500">Forma de pagamento</p>
                                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{selectedEntry.paymentMethod}</p>
                            </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 dark:border-border-dark p-4">
                            <p className="text-xs font-bold uppercase text-slate-500">Valor</p>
                            <p className={`mt-2 text-2xl font-black ${selectedEntry.type === 'entrada' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {selectedEntry.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default Cashflow;
