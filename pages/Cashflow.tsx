import React, { useMemo, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Landmark, Wallet } from 'lucide-react';
import Toast from '../components/Toast';
import Button from '../components/ui/Button';
import CashFlowChart from '../components/financial/CashFlowChart';
import CashFlowTable from '../components/financial/CashFlowTable';
import FinancialSummaryCard from '../components/financial/FinancialSummaryCard';
import { cashFlowEntries, financialAccounts } from '../components/financial/mockData';
import { EnrichedCashFlowEntry } from '../components/financial/types';

const Cashflow: React.FC = () => {
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    const accountMap = useMemo(
        () =>
            financialAccounts.reduce<Record<string, string>>((acc, account) => {
                acc[account.id] = account.name;
                return acc;
            }, {}),
        []
    );

    const sortedEntries = useMemo(
        () => [...cashFlowEntries].sort((a, b) => a.date.localeCompare(b.date)),
        []
    );

    const entries = useMemo<EnrichedCashFlowEntry[]>(() => {
        const initialBalance = financialAccounts.reduce((sum, account) => sum + account.initialBalance, 0);
        let runningBalance = initialBalance;

        return sortedEntries.map((entry) => {
            runningBalance += entry.type === 'entrada' ? entry.value : -entry.value;
            return {
                ...entry,
                accountName: accountMap[entry.accountId] || 'Conta nao identificada',
                runningBalance,
            };
        });
    }, [accountMap, sortedEntries]);

    const totalEntradas = entries
        .filter((entry) => entry.type === 'entrada')
        .reduce((sum, entry) => sum + entry.value, 0);
    const totalSaidas = entries
        .filter((entry) => entry.type === 'saida')
        .reduce((sum, entry) => sum + entry.value, 0);
    const saldoInicial = financialAccounts.reduce((sum, account) => sum + account.initialBalance, 0);
    const saldoAtual = saldoInicial + totalEntradas - totalSaidas;
    const saldoProjetado = saldoInicial + entries.reduce((sum, entry) => sum + (entry.type === 'entrada' ? entry.value : -entry.value), 0);

    const chartData = useMemo(() => {
        const grouped = entries.reduce<Record<string, { entradas: number; saidas: number; saldo: number }>>((acc, entry) => {
            const label = new Date(`${entry.date}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

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

        let runningBalance = saldoInicial;
        return Object.entries(grouped).map(([label, value]) => {
            runningBalance += value.saldo;
            return {
                label,
                entradas: value.entradas,
                saidas: value.saidas,
                saldo: runningBalance,
            };
        });
    }, [entries, saldoInicial]);

    const handlePlaceholderAction = (message: string) => {
        setToast({ message, type: 'info' });
    };

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Fluxo de Caixa</h2>
                    <p className="text-slate-500 mt-1">Leitura dedicada de entradas, saídas e saldo acumulado do negócio.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="secondary" leftIcon="download" onClick={() => handlePlaceholderAction('Exportacao do fluxo disponivel em breve.')}>
                        Exportar
                    </Button>
                    <Button leftIcon="sync" onClick={() => handlePlaceholderAction('Dados de fluxo atualizados com sucesso.')}>
                        Atualizar
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <FinancialSummaryCard
                    title="Saldo inicial"
                    value={saldoInicial}
                    changeText="+0,0%"
                    trend="up"
                    tone="neutral"
                    helperText="Soma dos saldos base das contas"
                    icon={<Landmark size={18} />}
                />
                <FinancialSummaryCard
                    title="Entradas"
                    value={totalEntradas}
                    changeText="+12,4%"
                    trend="up"
                    tone="positive"
                    helperText="Receitas registradas no periodo"
                    icon={<ArrowUpCircle size={18} />}
                />
                <FinancialSummaryCard
                    title="Saidas"
                    value={totalSaidas}
                    changeText="-4,1%"
                    trend="down"
                    tone="negative"
                    helperText="Despesas e compromissos financeiros"
                    icon={<ArrowDownCircle size={18} />}
                />
                <FinancialSummaryCard
                    title="Saldo atual"
                    value={saldoAtual}
                    changeText="+8,7%"
                    trend="up"
                    tone={saldoAtual >= 0 ? 'positive' : 'negative'}
                    helperText="Saldo consolidado das contas"
                    icon={<Wallet size={18} />}
                />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <CashFlowChart
                    title="Entradas x saídas"
                    subtitle="Comparativo diario do movimento financeiro"
                    variant="bar"
                    data={chartData}
                />
                <CashFlowChart
                    title="Saldo acumulado"
                    subtitle="Evolucao do caixa consolidado ao longo do periodo"
                    variant="area"
                    data={chartData}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark p-5">
                    <p className="text-[11px] uppercase tracking-[0.16em] font-bold text-slate-500 mb-2">Contas monitoradas</p>
                    <div className="space-y-3">
                        {financialAccounts.map((account) => (
                            <div key={account.id} className="flex items-center justify-between text-sm">
                                <span className="font-semibold text-slate-900 dark:text-white">{account.name}</span>
                                <span className="text-slate-500">{account.initialBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark p-5">
                    <p className="text-[11px] uppercase tracking-[0.16em] font-bold text-slate-500 mb-2">Resultado do periodo</p>
                    <p className={`text-3xl font-black ${saldoAtual >= saldoInicial ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {(saldoAtual - saldoInicial).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                    <p className="text-sm text-slate-500 mt-2">Movimento liquido entre receitas e despesas registradas.</p>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark p-5">
                    <p className="text-[11px] uppercase tracking-[0.16em] font-bold text-slate-500 mb-2">Saldo projetado</p>
                    <p className="text-3xl font-black text-slate-900 dark:text-white">
                        {saldoProjetado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                    <p className="text-sm text-slate-500 mt-2">Considera lancamentos realizados, previstos e vencidos do mock financeiro atual.</p>
                </div>
            </div>

            <CashFlowTable
                entries={entries}
                onView={() => handlePlaceholderAction('Visualizacao detalhada do movimento sera adicionada nesta pagina.')}
                onEdit={() => handlePlaceholderAction('Edicao dedicada do fluxo sera adicionada em breve.')}
                onDuplicate={() => handlePlaceholderAction('Duplicacao de lancamento ainda nao disponivel nesta tela.')}
                onDelete={() => handlePlaceholderAction('Exclusao de lancamento protegida nesta versao inicial.')}
            />
        </div>
    );
};

export default Cashflow;
