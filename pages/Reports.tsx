import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { getScopedClient, getSharedClient } from '../services/supabaseClient';
import DateRangeFilter, { type DatePreset } from '../components/ui/DateRangeFilter';
import Toast from '../components/Toast';
import { getDashboardKpis } from '../src/modules/dashboard/rpc';
import type { DashboardKpiFinancial, DashboardKpiPeriod } from '../src/modules/dashboard/kpiTypes';
import {
  canonicalPeriodLabel,
  INITIAL_CANONICAL_PERIOD,
  resolveCanonicalPeriod,
} from '../src/modules/reports/presetMapping';
import {
  fetchSalesData,
  MAX_DISPLAY_RECORDS,
  type DateRegime,
  type FilterState,
  type PaymentBadgeInfo,
  type SaleRecord,
} from '../src/modules/reports/salesReportService';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

// YYYY-MM-DD puro — evita parse UTC (new Date('YYYY-MM-DD') = midnight UTC,
// que em America/Sao_Paulo renderiza o dia ANTERIOR).
const fmtDate = (d: string) => {
  if (!d) return '-';
  const [y, m, day] = d.split('-');
  if (!y || !m || !day) return d;
  return `${day}/${m}/${y}`;
};

const fmtDateTime = (d?: string | null) =>
  d
    ? new Date(d).toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '-';

const formatLocalYMD = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getInitialMonthRange = (): FilterState => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    dateFrom: formatLocalYMD(start),
    dateTo: formatLocalYMD(end),
  };
};

const Reports: React.FC = () => {
  const { tenantId } = useAuth();
  const clubSupabase = getScopedClient('barber');
  const sharedSupabase = getSharedClient();
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [activeTab, setActiveTab] = useState<'chefclub' | 'sales'>('chefclub');

  const [filters, setFilters] = useState<FilterState>(getInitialMonthRange);
  const [dateRegime, setDateRegime] = useState<DateRegime>('payment');
  const [isTruncated, setIsTruncated] = useState<boolean>(false);

  // ─── Período canônico (§5 do Design Gate) ────────────────────
  const [preset, setPreset] = useState<DatePreset>('this_month');
  const [anchorPeriod, setAnchorPeriod] = useState<DashboardKpiPeriod>(INITIAL_CANONICAL_PERIOD);
  const { period: canonicalPeriod, isMapped } = resolveCanonicalPeriod(preset, anchorPeriod);

  const [chefClubStats, setChefClubStats] = useState({
    activeSubscriptions: 0,
    totalCreditsAvailable: 0,
    totalCreditsUsed: 0,
    popularPlan: null as string | null,
  });

  const [sales, setSales] = useState<SaleRecord[]>([]);

  // KPIs vêm EXCLUSIVAMENTE do RPC canônico — zero recálculo local (§4.4/§4.5).
  const [kpi, setKpi] = useState<DashboardKpiFinancial | null>(null);
  const [kpiLoading, setKpiLoading] = useState(false);
  const [kpiError, setKpiError] = useState<string | null>(null);

  const handlePresetChange = useCallback((nextPreset: DatePreset) => {
    setPreset(nextPreset);
    setAnchorPeriod((prevAnchor) => resolveCanonicalPeriod(nextPreset, prevAnchor).anchor);
  }, []);

  const fetchChefClubData = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const [subsRes, creditsRes, plansRes] = await Promise.all([
        clubSupabase
          .from('customer_subscriptions')
          .select('id, status, plan_id')
          .eq('tenant_id', tenantId)
          .eq('status', 'active'),
        clubSupabase
          .from('customer_credits')
          .select('available_credits, used_credits')
          .eq('tenant_id', tenantId),
        clubSupabase
          .from('customer_plans')
          .select('id, name')
          .eq('tenant_id', tenantId),
      ]);

      const activeCount = (subsRes.data || []).length;
      const planMap = new Map((plansRes.data || []).map((p: any) => [p.id, p.name]));

      const planCounts = new Map<string, number>();
      (subsRes.data || []).forEach((sub: any) => {
        const planName = planMap.get(sub.plan_id) || 'Standard';
        planCounts.set(planName, (planCounts.get(planName) || 0) + 1);
      });

      let popularPlan: string | null = null;
      let maxCount = 0;
      planCounts.forEach((count, plan) => {
        if (count > maxCount) {
          maxCount = count;
          popularPlan = plan;
        }
      });

      let totalAvailable = 0;
      let totalUsed = 0;
      (creditsRes.data || []).forEach((c: any) => {
        totalAvailable += Number(c.available_credits || 0);
        totalUsed += Number(c.used_credits || 0);
      });

      setChefClubStats({
        activeSubscriptions: activeCount,
        totalCreditsAvailable: totalAvailable,
        totalCreditsUsed: totalUsed,
        popularPlan,
      });
    } catch (err) {
      console.error('Erro ao buscar dados do Clube:', err);
      setToast({ msg: 'Erro ao carregar dados do Clube', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [tenantId, clubSupabase]);

  // Detalhamento de vendas enriquecido (somente leitura, isolamento por tenant_id via salesReportService)
  const fetchSales = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const result = await fetchSalesData(tenantId, filters, dateRegime);
      setIsTruncated(result.isTruncated);
      setSales(result.sales);
    } catch (err) {
      console.error("Erro ao buscar vendas:", err);
      setToast({ msg: "Erro ao carregar vendas", type: "error" });
    } finally {
      setLoading(false);
    }
  }, [tenantId, filters, dateRegime]);

  // Efeito dedicado à aba Clube dos Chefs (não re-executa ao mudar filtros de data de vendas)
  useEffect(() => {
    if (!tenantId || activeTab !== 'chefclub') return;
    void fetchChefClubData();
  }, [tenantId, activeTab, fetchChefClubData]);

  // Efeito dedicado à aba Vendas
  useEffect(() => {
    if (!tenantId || activeTab !== 'sales') return;
    void fetchSales();
  }, [tenantId, activeTab, fetchSales]);

  // Cards canônicos: período derivado do preset ativo (nunca do intervalo livre).
  useEffect(() => {
    if (!tenantId || activeTab !== 'sales') return;

    let cancelled = false;
    setKpiLoading(true);
    getDashboardKpis(canonicalPeriod)
      .then((result) => {
        if (!cancelled) {
          setKpi(result?.financial ?? null);
          setKpiError(null);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setKpi(null);
          setKpiError(err.message || 'Falha ao carregar KPIs canônicos');
        }
      })
      .finally(() => {
        if (!cancelled) setKpiLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tenantId, activeTab, canonicalPeriod]);

  // Totalizadores rápidos calculados diretamente sobre o período e regime selecionados
  const periodTotals = useMemo(() => {
    return sales.reduce(
      (acc, sale) => {
        acc.cashRevenue += sale.cash_revenue;
        acc.clubCreditVolume += sale.club_credit_volume;
        acc.totalCommissions += sale.commission_generated;
        acc.totalAttendances += 1;
        return acc;
      },
      {
        cashRevenue: 0,
        clubCreditVolume: 0,
        totalCommissions: 0,
        totalAttendances: 0,
      },
    );
  }, [sales]);

  const tabs = [
    { id: 'chefclub', label: 'Clube dos Chefs', icon: 'workspace_premium' },
    { id: 'sales', label: 'Vendas', icon: 'point_of_sale' },
  ];

  const renderKpiCard = (label: string, value: string, tone: string, helper?: string) => (
    <div className="bg-white/50 dark:bg-black/20 rounded-lg p-4">
      <p className="text-[10px] uppercase text-slate-500 font-bold mb-1">{label}</p>
      <p className={`text-2xl font-black ${tone}`}>{value}</p>
      {helper && <p className="text-[11px] text-slate-400 mt-0.5">{helper}</p>}
    </div>
  );

  const renderSalesTab = () => {
    const detailRange =
      filters.dateFrom || filters.dateTo
        ? `${filters.dateFrom ? fmtDate(filters.dateFrom) : '—'} → ${filters.dateTo ? fmtDate(filters.dateTo) : '—'}`
        : 'Todo o período';

    const regimeLabel =
      dateRegime === 'payment' ? 'Regime de Caixa (Data do Pagamento)' : 'Competência (Data do Atendimento)';

    const growthText = kpi?.growth == null ? '—' : `${(kpi.growth * 100).toFixed(1)}%`;

    return (
      <div className="space-y-5">
        {/* Seletor de Regime Temporal (Atendimento vs. Pagamento/Caixa) */}
        <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Critério Temporal da Auditoria
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Escolha se o período selecionado filtra as comandas pela data em que o serviço ocorreu ou pela data da baixa financeira.
            </p>
          </div>

          <div
            className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800/80 p-1 border border-slate-200 dark:border-slate-700 shrink-0"
            role="group"
            aria-label="Seletor de Regime de Data"
          >
            <button
              type="button"
              onClick={() => setDateRegime('payment')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                dateRegime === 'payment'
                  ? 'bg-primary text-night shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-base">payments</span>
              <span>Data do Pagamento / Caixa</span>
            </button>

            <button
              type="button"
              onClick={() => setDateRegime('attendance')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                dateRegime === 'attendance'
                  ? 'bg-primary text-night shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-base">event_available</span>
              <span>Data do Atendimento</span>
            </button>
          </div>
        </div>

        {/* Cards Totalizadores Rápidos do Período Selecionado */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-card-dark rounded-xl border border-emerald-500/30 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
                Faturamento de Caixa
              </p>
              <span className="material-symbols-outlined text-emerald-500 text-lg">account_balance_wallet</span>
            </div>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              {fmt(periodTotals.cashRevenue)}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Apenas Dinheiro, PIX e Cartões ({detailRange})
            </p>
          </div>

          <div className="bg-white dark:bg-card-dark rounded-xl border border-amber-500/30 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
                Consumo Créditos do Clube
              </p>
              <span className="material-symbols-outlined text-amber-500 text-lg">workspace_premium</span>
            </div>
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
              {fmt(periodTotals.clubCreditVolume)}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Volume facial de assinaturas (isolado do caixa)
            </p>
          </div>

          <div className="bg-white dark:bg-card-dark rounded-xl border border-sky-500/30 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
                Comissões Geradas
              </p>
              <span className="material-symbols-outlined text-sky-500 text-lg">badge</span>
            </div>
            <p className="text-2xl font-black text-sky-600 dark:text-sky-400 tabular-nums">
              {fmt(periodTotals.totalCommissions)}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Total apurado nas comandas do período
            </p>
          </div>

          <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark p-4 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
                Total de Atendimentos
              </p>
              <span className="material-symbols-outlined text-primary text-lg">receipt_long</span>
            </div>
            <p className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">
              {periodTotals.totalAttendances}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Comandas baixadas no filtro ativo
            </p>
          </div>
        </div>

        {!isMapped && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs font-semibold text-amber-700 dark:text-amber-300">
            <span className="material-symbols-outlined align-middle text-sm mr-1">info</span>
            Período dos KPIs institucionais: <strong>{canonicalPeriodLabel(canonicalPeriod)}</strong>
            <span className="mx-2 text-amber-500/60">·</span>
            Auditoria e totalizadores acima: <strong>{detailRange}</strong> ({regimeLabel})
          </div>
        )}

        {/* KPIs Canônicos Consolidados (RPC get_dashboard_kpis) */}
        <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 rounded-xl border border-emerald-500/20 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-2xl">point_of_sale</span>
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-lg">Resumo Executivo (DRE / Caixa)</h3>
              <p className="text-sm text-slate-500">
                KPIs canônicos: {canonicalPeriodLabel(canonicalPeriod)}
              </p>
            </div>
          </div>

          {kpiError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10 px-4 py-3 text-xs font-semibold text-red-700 dark:text-red-300">
              KPIs canônicos indisponíveis: {kpiError}. A auditoria detalhada abaixo continua
              funcionando com os filtros selecionados.
            </div>
          )}

          {kpiError ? (
            <div className="flex items-center justify-center py-4 text-sm font-semibold text-slate-400">
              KPIs indisponíveis — consulte os totalizadores do período e o detalhamento abaixo.
            </div>
          ) : kpiLoading || !kpi ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {renderKpiCard('Faturamento Líquido', fmt(kpi.revenue), 'text-emerald-600', isMapped ? canonicalPeriodLabel(canonicalPeriod) : undefined)}
              {renderKpiCard('Despesas', fmt(kpi.expenses), 'text-slate-700 dark:text-slate-200', isMapped ? canonicalPeriodLabel(canonicalPeriod) : undefined)}
              {renderKpiCard('Resultado', fmt(kpi.result), kpi.result >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-600 dark:text-red-300', isMapped ? canonicalPeriodLabel(canonicalPeriod) : undefined)}
              {renderKpiCard('Ticket Médio', fmt(kpi.average_ticket), 'text-[#007BFF] dark:text-[#00D2FF]', isMapped ? canonicalPeriodLabel(canonicalPeriod) : undefined)}
              {renderKpiCard('Crescimento', growthText, 'text-indigo-600 dark:text-indigo-300', 'vs. período anterior')}
            </div>
          )}
        </div>

        {isTruncated && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-2">
            <span className="material-symbols-outlined text-base">warning</span>
            <span>
              Exibindo os primeiros <strong>{MAX_DISPLAY_RECORDS}</strong> registros do intervalo selecionado. Para auditorias mais extensas, refine o filtro de datas.
            </span>
          </div>
        )}

        {/* Tabela de Auditoria de Comandas */}
        <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Auditoria de Comandas no Período
              </h4>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {sales.length} {sales.length === 1 ? 'registro' : 'registros'}
              </span>
            </div>
            <span className="text-[11px] font-semibold text-slate-500">
              {detailRange} · {regimeLabel} (BRT -03:00)
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : sales.length === 0 ? (
            <div className="text-center py-12">
              <span className="material-symbols-outlined text-5xl text-slate-300 mb-3">receipt_long</span>
              <p className="text-sm font-semibold text-slate-500">Nenhuma comanda encontrada no período e regime selecionados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-widest text-slate-400 border-b border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40">
                    <th className="px-3.5 py-2.5 font-bold whitespace-nowrap">Comanda</th>
                    <th className="px-3.5 py-2.5 font-bold whitespace-nowrap">Data Atendimento</th>
                    <th className="px-3.5 py-2.5 font-bold whitespace-nowrap">Data Pagamento</th>
                    <th className="px-3.5 py-2.5 font-bold whitespace-nowrap">Canal</th>
                    <th className="px-3.5 py-2.5 font-bold whitespace-nowrap">Cliente</th>
                    <th className="px-3.5 py-2.5 font-bold whitespace-nowrap">Profissional(is)</th>
                    <th className="px-3.5 py-2.5 font-bold">Itens</th>
                    <th className="px-3.5 py-2.5 font-bold whitespace-nowrap">Forma de Pagamento</th>
                    <th className="px-3.5 py-2.5 font-bold text-right whitespace-nowrap">Valor Total</th>
                    <th className="px-3.5 py-2.5 font-bold text-right whitespace-nowrap">Comissão Gerada</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => (
                    <tr
                      key={sale.id}
                      className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Comanda (#ID) */}
                      <td className="px-3.5 py-3 font-mono text-xs font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap" title={sale.id}>
                        {sale.short_id}
                      </td>

                      {/* Data Atendimento */}
                      <td className="px-3.5 py-3 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {fmtDateTime(sale.attendance_date)}
                      </td>

                      {/* Data Pagamento */}
                      <td className="px-3.5 py-3 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {fmtDateTime(sale.payment_date)}
                      </td>

                      {/* Canal */}
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        {sale.channel === 'online' ? (
                          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30">
                            <span aria-hidden="true">🌐</span>
                            <span>Online</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/30">
                            <span aria-hidden="true">🏬</span>
                            <span>Balcão</span>
                          </span>
                        )}
                      </td>

                      {/* Cliente + Indicador Assinante do Clube */}
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {sale.client_name}
                          </span>
                          {sale.is_club_member && (
                            <span
                              className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                              title="Assinante do Clube dos Chefes"
                            >
                              <span className="material-symbols-outlined text-[12px]">workspace_premium</span>
                              Clube
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Profissional(is) */}
                      <td className="px-3.5 py-3 text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {sale.staff_names.length > 0 ? sale.staff_names.join(', ') : '—'}
                      </td>

                      {/* Itens (resumo) */}
                      <td className="px-3.5 py-3 text-xs text-slate-600 dark:text-slate-300 max-w-[240px]">
                        <div className="truncate" title={sale.items_summary}>
                          {sale.items_summary}
                        </div>
                      </td>

                      {/* Forma de Pagamento */}
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <div className="flex flex-wrap items-center gap-1">
                          {sale.payment_badges.map((badge, idx) => (
                            <span
                              key={`${sale.id}-pay-${idx}`}
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badge.toneClass}`}
                            >
                              <span>{badge.label}</span>
                              {sale.payment_badges.length > 1 && (
                                <span className="opacity-80">({fmt(badge.amount)})</span>
                              )}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Valor Total */}
                      <td className="px-3.5 py-3 font-bold text-slate-900 dark:text-white text-right tabular-nums whitespace-nowrap">
                        {fmt(sale.total)}
                      </td>

                      {/* Comissão Gerada */}
                      <td className="px-3.5 py-3 font-bold text-sky-600 dark:text-sky-400 text-right tabular-nums whitespace-nowrap">
                        {fmt(sale.commission_generated)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderTabContent = () => {
    if (loading && activeTab === 'chefclub') {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      );
    }

    switch (activeTab) {
      case 'chefclub':
        return (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-xl border border-amber-500/20 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-2xl">workspace_premium</span>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-lg">Clube dos Chefs</h3>
                  <p className="text-sm text-slate-500">Programa de fidelidade</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white/50 dark:bg-black/20 rounded-lg p-4">
                  <p className="text-[10px] uppercase text-slate-500 font-bold mb-1">Assinantes Ativos</p>
                  <p className="text-3xl font-black text-amber-600">{chefClubStats.activeSubscriptions}</p>
                </div>
                <div className="bg-white/50 dark:bg-black/20 rounded-lg p-4">
                  <p className="text-[10px] uppercase text-slate-500 font-bold mb-1">Créditos Usados</p>
                  <p className="text-3xl font-black text-amber-600">{chefClubStats.totalCreditsUsed}</p>
                </div>
                <div className="bg-white/50 dark:bg-black/20 rounded-lg p-4">
                  <p className="text-[10px] uppercase text-slate-500 font-bold mb-1">Créditos Disponíveis</p>
                  <p className="text-3xl font-black text-emerald-600">{chefClubStats.totalCreditsAvailable}</p>
                </div>
                <div className="bg-white/50 dark:bg-black/20 rounded-lg p-4">
                  <p className="text-[10px] uppercase text-slate-500 font-bold mb-1">Plano Mais Popular</p>
                  <p className="text-xl font-black text-amber-600 truncate">{chefClubStats.popularPlan || 'N/A'}</p>
                </div>
              </div>

              {chefClubStats.activeSubscriptions > 0 && (
                <div className="mt-4 pt-4 border-t border-amber-500/20">
                  <a
                    href="/chef-club-subscriptions"
                    className="text-sm font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1"
                  >
                    Ver todos os assinantes
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        );

      case 'sales':
        return renderSalesTab();
    }
  };

  return (
    <div className="space-y-6">
      {toast && (
        <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Relatórios</h1>
          <p className="text-sm text-slate-500">Visão completa de faturamento, caixa e auditoria operacional</p>
        </div>
        <DateRangeFilter
          startDate={filters.dateFrom}
          endDate={filters.dateTo}
          onStartDateChange={(v) => setFilters((f) => ({ ...f, dateFrom: v }))}
          onEndDateChange={(v) => setFilters((f) => ({ ...f, dateTo: v }))}
          onPresetChange={handlePresetChange}
          showPresets={true}
        />
      </div>

      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as 'chefclub' | 'sales')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <span className="material-symbols-outlined text-lg">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4">
        {renderTabContent()}
      </div>
    </div>
  );
};

export default Reports;
