import React, { useMemo, useState, useEffect } from 'react';
import {
  ArrowRightLeft,
  BanknoteArrowDown,
  BanknoteArrowUp,
  BarChart3,
  Download,
  HandCoins,
  Landmark,
  TrendingUp,
} from 'lucide-react';
import FilterBar from '../components/financial/FilterBar';
import FinancialSummaryCard from '../components/financial/FinancialSummaryCard';
import CashFlowChart from '../components/financial/CashFlowChart';
import ExpenseCategoryChart from '../components/financial/ExpenseCategoryChart';
import CashFlowTable from '../components/financial/CashFlowTable';
import UpcomingBillsPanel from '../components/financial/UpcomingBillsPanel';
import EmptyStateFinance from '../components/financial/EmptyStateFinance';
import { cashFlowEntries, financialAccounts } from '../components/financial/mockData';
import { CashFlowEntry, EnrichedCashFlowEntry, FilterState, SummaryCardData } from '../components/financial/types';

type ScreenState = 'sucesso' | 'loading' | 'erro' | 'vazio';

const now = new Date('2026-03-11T10:00:00');

const defaultFilters: FilterState = {
  period: 'mesAtual',
  accountId: 'todas',
  category: 'todas',
  costCenter: 'todos',
  status: 'todos',
  paymentMethod: 'todas',
  search: '',
  customStart: '2026-03-01',
  customEnd: '2026-03-31',
};

const screenStateConfig: Record<ScreenState, string> = {
  sucesso: 'Sucesso',
  loading: 'Loading',
  erro: 'Erro',
  vazio: 'Vazio',
};

const Financial: React.FC = () => {
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [screenState, setScreenState] = useState<ScreenState>('loading');

  useEffect(() => {
    const timer = window.setTimeout(() => setScreenState('sucesso'), 900);
    return () => window.clearTimeout(timer);
  }, []);

  const accountMap = useMemo(
    () =>
      financialAccounts.reduce<Record<string, string>>((acc, account) => {
        acc[account.id] = account.name;
        return acc;
      }, {}),
    [],
  );

  const accountOptions = useMemo(
    () => [{ value: 'todas', label: 'Todas as contas' }, ...financialAccounts.map((item) => ({ value: item.id, label: item.name }))],
    [],
  );

  const categoryOptions = useMemo(() => {
    const unique = Array.from(new Set(cashFlowEntries.map((entry) => entry.category))).sort();
    return [{ value: 'todas', label: 'Todas as categorias' }, ...unique.map((value) => ({ value, label: value }))];
  }, []);

  const costCenterOptions = useMemo(() => {
    const unique = Array.from(new Set(cashFlowEntries.map((entry) => entry.costCenter))).sort();
    return [{ value: 'todos', label: 'Todos os centros' }, ...unique.map((value) => ({ value, label: value }))];
  }, []);

  const paymentOptions = useMemo(() => {
    const unique = Array.from(new Set(cashFlowEntries.map((entry) => entry.paymentMethod))).sort();
    return [{ value: 'todas', label: 'Todas as formas' }, ...unique.map((value) => ({ value, label: value }))];
  }, []);

  const periodFilteredEntries = useMemo(() => {
    const filterByPeriod = (entry: CashFlowEntry) => {
      const entryDate = new Date(`${entry.date}T12:00:00`);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      if (filters.period === 'hoje') {
        return entryDate.toDateString() === now.toDateString();
      }

      if (filters.period === '7dias') {
        const start = new Date(now);
        start.setDate(now.getDate() - 6);
        return entryDate >= start && entryDate <= now;
      }

      if (filters.period === '30dias') {
        const start = new Date(now);
        start.setDate(now.getDate() - 29);
        return entryDate >= start && entryDate <= now;
      }

      if (filters.period === 'mesAtual') {
        return entryDate >= startOfMonth && entryDate.getMonth() === now.getMonth() && entryDate.getFullYear() === now.getFullYear();
      }

      if (filters.period === 'personalizado' && filters.customStart && filters.customEnd) {
        const start = new Date(`${filters.customStart}T00:00:00`);
        const end = new Date(`${filters.customEnd}T23:59:59`);
        return entryDate >= start && entryDate <= end;
      }

      return true;
    };

    return cashFlowEntries.filter(filterByPeriod);
  }, [filters.customEnd, filters.customStart, filters.period]);

  const filteredEntries = useMemo(() => {
    return periodFilteredEntries
      .filter((entry) => (filters.accountId === 'todas' ? true : entry.accountId === filters.accountId))
      .filter((entry) => (filters.category === 'todas' ? true : entry.category === filters.category))
      .filter((entry) => (filters.costCenter === 'todos' ? true : entry.costCenter === filters.costCenter))
      .filter((entry) => (filters.status === 'todos' ? true : entry.status === filters.status))
      .filter((entry) => (filters.paymentMethod === 'todas' ? true : entry.paymentMethod === filters.paymentMethod))
      .filter((entry) => {
        if (!filters.search) {
          return true;
        }
        const search = filters.search.toLowerCase();
        return entry.description.toLowerCase().includes(search) || entry.category.toLowerCase().includes(search);
      })
      .sort((a, b) => (a.date > b.date ? 1 : -1));
  }, [filters.accountId, filters.category, filters.costCenter, filters.paymentMethod, filters.search, filters.status, periodFilteredEntries]);

  const globalCurrentBalance = 18540;
  const globalEntries = 27890;
  const globalExits = 16320;
  const globalProjectedBalance = 21140;

  const filteredCurrentBalance = useMemo(() => {
    const base = financialAccounts
      .filter((account) => (filters.accountId === 'todas' ? true : account.id === filters.accountId))
      .reduce((sum, account) => sum + account.initialBalance, 0);

    const realized = filteredEntries.reduce((sum, entry) => {
      if (entry.status !== 'realizado') return sum;
      return sum + (entry.type === 'entrada' ? entry.value : -entry.value);
    }, 0);

    return base + realized;
  }, [filteredEntries, filters.accountId]);

  const filteredProjectedBalance = useMemo(() => {
    const base = financialAccounts
      .filter((account) => (filters.accountId === 'todas' ? true : account.id === filters.accountId))
      .reduce((sum, account) => sum + account.initialBalance, 0);

    const allMoves = filteredEntries.reduce((sum, entry) => sum + (entry.type === 'entrada' ? entry.value : -entry.value), 0);
    return base + allMoves;
  }, [filteredEntries, filters.accountId]);

  const currentEntriesValue = filteredEntries
    .filter((entry) => entry.type === 'entrada')
    .reduce((sum, entry) => sum + entry.value, 0);

  const currentExitsValue = filteredEntries
    .filter((entry) => entry.type === 'saida')
    .reduce((sum, entry) => sum + entry.value, 0);

  const periodResult = currentEntriesValue - currentExitsValue;

  const summaryData: SummaryCardData[] = [
    {
      title: 'Saldo atual',
      value: filters.accountId === 'todas' ? globalCurrentBalance : filteredCurrentBalance,
      changeText: '+4,8%',
      trend: 'up',
      tone: 'neutral',
      helperText: 'Baseado em movimentos realizados',
    },
    {
      title: 'Total de entradas',
      value: filters.accountId === 'todas' ? globalEntries : currentEntriesValue,
      changeText: '+8,4%',
      trend: 'up',
      tone: 'positive',
      helperText: 'Comparado ao periodo anterior',
    },
    {
      title: 'Total de saídas',
      value: filters.accountId === 'todas' ? globalExits : currentExitsValue,
      changeText: '-2,1%',
      trend: 'down',
      tone: 'negative',
      helperText: 'Controle de custos em evolucao',
    },
    {
      title: 'Saldo previsto',
      value: filters.accountId === 'todas' ? globalProjectedBalance : filteredProjectedBalance,
      changeText: '+13,9%',
      trend: 'up',
      tone: 'positive',
      helperText: 'Inclui realizados e previstos',
    },
    {
      title: 'Resultado do periodo',
      value: filters.accountId === 'todas' ? globalEntries - globalExits : periodResult,
      changeText: periodResult >= 0 ? '+6,7%' : '-6,7%',
      trend: periodResult >= 0 ? 'up' : 'down',
      tone: periodResult >= 0 ? 'positive' : 'negative',
      helperText: 'Entradas menos saidas',
    },
  ];

  const chartData = useMemo(() => {
    const grouped = filteredEntries.reduce<Record<string, { entradas: number; saidas: number; saldo: number }>>((acc, entry) => {
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

    let rolling = financialAccounts.reduce((sum, account) => sum + account.initialBalance, 0);
    return Object.entries(grouped).map(([label, value]) => {
      rolling += value.saldo;
      return { label, entradas: value.entradas, saidas: value.saidas, saldo: rolling };
    });
  }, [filteredEntries]);

  const expenseCategoryData = useMemo(() => {
    const grouped = filteredEntries
      .filter((entry) => entry.type === 'saida')
      .reduce<Record<string, number>>((acc, entry) => {
        acc[entry.category] = (acc[entry.category] || 0) + entry.value;
        return acc;
      }, {});

    return Object.entries(grouped).map(([name, value]) => ({ name, value }));
  }, [filteredEntries]);

  const costCenterData = useMemo(() => {
    const grouped = filteredEntries
      .filter((entry) => entry.type === 'saida')
      .reduce<Record<string, number>>((acc, entry) => {
        acc[entry.costCenter] = (acc[entry.costCenter] || 0) + entry.value;
        return acc;
      }, {});

    return Object.entries(grouped).map(([name, value]) => ({ name, value }));
  }, [filteredEntries]);

  const tableEntries = useMemo<EnrichedCashFlowEntry[]>(() => {
    const initialBalance = financialAccounts
      .filter((account) => (filters.accountId === 'todas' ? true : account.id === filters.accountId))
      .reduce((sum, account) => sum + account.initialBalance, 0);

    let runningBalance = initialBalance;
    return filteredEntries.map((entry) => {
      runningBalance += entry.type === 'entrada' ? entry.value : -entry.value;
      return {
        ...entry,
        accountName: accountMap[entry.accountId] || 'Conta nao identificada',
        runningBalance,
      };
    });
  }, [accountMap, filteredEntries, filters.accountId]);

  const payableUpcoming = filteredEntries
    .filter((entry) => entry.type === 'saida' && entry.status !== 'realizado')
    .slice(0, 3)
    .map((entry) => ({ title: entry.description, date: entry.date, value: entry.value, kind: 'pagar' as const }));

  const receivableUpcoming = filteredEntries
    .filter((entry) => entry.type === 'entrada' && entry.status !== 'realizado')
    .slice(0, 3)
    .map((entry) => ({ title: entry.description, date: entry.date, value: entry.value, kind: 'receber' as const }));

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleExport = () => {
    const header = ['Data', 'Descricao', 'Categoria', 'Conta', 'Tipo', 'Forma', 'Status', 'Valor'];
    const rows = tableEntries.map((item) => [
      new Date(item.date).toLocaleDateString('pt-BR'),
      item.description,
      item.category,
      item.accountName,
      item.type,
      item.paymentMethod,
      item.status,
      item.value.toFixed(2).replace('.', ','),
    ]);

    const csv = [header.join(';'), ...rows.map((row) => row.join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fluxo-caixa-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderLoadingState = () => (
    <section className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-36 rounded-2xl border border-slate-200 dark:border-border-dark bg-slate-100/70 dark:bg-white/5 animate-pulse" />
        ))}
      </div>
      <div className="h-72 rounded-2xl border border-slate-200 dark:border-border-dark bg-slate-100/70 dark:bg-white/5 animate-pulse" />
      <div className="h-96 rounded-2xl border border-slate-200 dark:border-border-dark bg-slate-100/70 dark:bg-white/5 animate-pulse" />
    </section>
  );

  const renderErrorState = () => (
    <EmptyStateFinance
      title="Nao foi possivel carregar o fluxo de caixa"
      description="Houve uma falha temporaria de sincronizacao. Tente novamente em alguns instantes."
      actionLabel="Tentar novamente"
      onAction={() => setScreenState('loading')}
    />
  );

  const hasNoData = filteredEntries.length === 0 || screenState === 'vazio';

  return (
    <div className="space-y-6 pb-8 animate-fade-in">
      <header className="sticky top-0 z-20 rounded-2xl border border-slate-200/80 dark:border-border-dark bg-gradient-to-r from-white/98 to-slate-50/95 dark:from-[#111111]/95 dark:to-[#151515]/95 backdrop-blur-sm p-5">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black text-slate-900 dark:text-white">Fluxo de Caixa</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Acompanhe entradas, saídas, saldo realizado e projeções financeiras</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button className="h-10 px-4 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition-colors inline-flex items-center gap-2">
              <BanknoteArrowUp size={16} />
              Nova entrada
            </button>
            <button className="h-10 px-4 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 transition-colors inline-flex items-center gap-2">
              <BanknoteArrowDown size={16} />
              Nova saída
            </button>
            <button className="h-10 px-4 rounded-xl bg-slate-900 dark:bg-slate-700 text-white text-sm font-bold hover:bg-slate-800 dark:hover:bg-slate-600 transition-colors inline-flex items-center gap-2">
              <ArrowRightLeft size={16} />
              Transferência
            </button>
            <button
              onClick={handleExport}
              className="h-10 px-4 rounded-xl border border-slate-300 dark:border-border-dark text-slate-700 dark:text-slate-200 bg-white/90 dark:bg-white/5 text-sm font-bold hover:bg-slate-100 dark:hover:bg-white/10 transition-colors inline-flex items-center gap-2"
            >
              <Download size={16} />
              Exportar relatório
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">Estado da tela:</span>
          {Object.entries(screenStateConfig).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setScreenState(key as ScreenState)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                screenState === key
                  ? 'border-primary bg-primary/10 text-primary font-bold'
                  : 'border-slate-300 dark:border-border-dark text-slate-600 dark:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <FilterBar
        filters={filters}
        onChange={handleFilterChange}
        accountOptions={accountOptions}
        categoryOptions={categoryOptions}
        costCenterOptions={costCenterOptions}
        paymentOptions={paymentOptions}
      />

      {screenState === 'loading' && renderLoadingState()}
      {screenState === 'erro' && renderErrorState()}
      {screenState !== 'loading' && screenState !== 'erro' && (
        <>
          {hasNoData ? (
            <EmptyStateFinance
              title="Nenhuma movimentação encontrada"
              description="Ajuste os filtros ou registre uma nova entrada/saída para visualizar o fluxo de caixa."
              actionLabel="Limpar filtros"
              onAction={() => setFilters(defaultFilters)}
            />
          ) : (
            <>
              <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                <FinancialSummaryCard
                  {...summaryData[0]}
                  icon={<Landmark size={17} />}
                />
                <FinancialSummaryCard
                  {...summaryData[1]}
                  icon={<BanknoteArrowUp size={17} />}
                />
                <FinancialSummaryCard
                  {...summaryData[2]}
                  icon={<BanknoteArrowDown size={17} />}
                />
                <FinancialSummaryCard
                  {...summaryData[3]}
                  icon={<TrendingUp size={17} />}
                />
                <FinancialSummaryCard
                  {...summaryData[4]}
                  icon={<BarChart3 size={17} />}
                />
              </section>

              <section className="grid grid-cols-1 2xl:grid-cols-12 gap-5">
                <div className="2xl:col-span-8 space-y-5">
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <CashFlowChart
                      title="Entradas x Saídas por período"
                      subtitle="Comparativo diário com base nos filtros ativos"
                      variant="bar"
                      data={chartData}
                    />
                    <CashFlowChart
                      title="Evolução do saldo ao longo do tempo"
                      subtitle="Saldo realizado e impacto das movimentações previstas"
                      variant="area"
                      data={chartData}
                    />
                  </div>

                  <ExpenseCategoryChart pieData={expenseCategoryData} costCenterData={costCenterData} />

                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">Movimentações financeiras</h3>
                    <CashFlowTable entries={tableEntries} />
                  </div>
                </div>

                <div className="2xl:col-span-4">
                  <UpcomingBillsPanel
                    dueTodayCount={4}
                    payable={payableUpcoming}
                    receivable={receivableUpcoming}
                    delinquencySummary="Inadimplência em 3,2% da carteira ativa, com R$ 2.940,00 acima de 15 dias."
                    nextDaysProjection="Projeção para os próximos 10 dias: saldo estimado em R$ 24.680,00 com teto mínimo de R$ 17.900,00."
                  />
                </div>
              </section>
            </>
          )}
        </>
      )}

      <footer className="rounded-2xl border border-slate-200/80 dark:border-border-dark bg-white/80 dark:bg-card-dark/70 p-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500 dark:text-slate-400">Saldo inicial por contas: {financialAccounts.reduce((sum, account) => sum + account.initialBalance, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 inline-flex items-center gap-1">
          <HandCoins size={14} />
          Filtros combináveis ativos: leitura rápida para tomada de decisão operacional.
        </p>
      </footer>
    </div>
  );
};

export default Financial;
