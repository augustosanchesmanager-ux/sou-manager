import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { getScopedClient } from '../services/supabaseClient';
import DateRangeFilter, { type DatePreset } from '../components/ui/DateRangeFilter';
import Toast from '../components/Toast';
import { getDashboardKpis } from '../src/modules/dashboard/rpc';
import type { DashboardKpiFinancial, DashboardKpiPeriod } from '../src/modules/dashboard/kpiTypes';
import {
  canonicalPeriodLabel,
  INITIAL_CANONICAL_PERIOD,
  resolveCanonicalPeriod,
} from '../src/modules/reports/presetMapping';

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
// YYYY-MM-DD puro — evita parse UTC (new Date('YYYY-MM-DD') = midnight UTC,
// que em America/Sao_Paulo renderiza o dia ANTERIOR).
const fmtDate = (d: string) => {
  if (!d) return '-';
  const [y, m, day] = d.split('-');
  if (!y || !m || !day) return d;
  return `${day}/${m}/${y}`;
};
const fmtDateTime = (d: string) => d ? new Date(d).toLocaleString('pt-BR') : '-';

interface FilterState {
  dateFrom: string;
  dateTo: string;
}

interface SaleRecord {
  id: string;
  client_name: string;
  total: number;
  status: string;
  created_at: string;
  staff_names: string[];
}

const getInitialMonthRange = (): FilterState => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    dateFrom: start.toISOString().split('T')[0],
    dateTo: end.toISOString().split('T')[0],
  };
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Aberta',
  blocked: 'Bloqueada',
  paid: 'Paga',
  cancelled: 'Cancelada',
};

const Reports: React.FC = () => {
  const { tenantId } = useAuth();
  const clubSupabase = getScopedClient('barber');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [activeTab, setActiveTab] = useState<'chefclub' | 'sales'>('chefclub');

  const [filters, setFilters] = useState<FilterState>(getInitialMonthRange);

  // ─── Período canônico (§5 do Design Gate) ────────────────────
  // anchor só é atualizado por presets com correspondência direta no
  // contrato P1.3; presets sem equivalente (last_7_days/last_month/custom)
  // mantêm os cards no último período canônico renderizado.
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

  useEffect(() => {
    if (!tenantId) return;
    setLoading(true);
    if (activeTab === 'chefclub') {
      fetchChefClubData();
    } else if (activeTab === 'sales') {
      fetchSales();
    }
  }, [tenantId, activeTab, filters.dateFrom, filters.dateTo]);

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

  // Detalhamento de vendas: query local por tabela, com intervalo livre.
  // Não computa KPI — apenas lista comandas do intervalo selecionado.
  const fetchSales = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const from = filters.dateFrom ? `${filters.dateFrom}T00:00:00` : undefined;
      const to = filters.dateTo ? `${filters.dateTo}T23:59:59.999` : undefined;

      let comandasQuery = clubSupabase
        .from('comandas')
        .select('id, client_id, status, total, created_at, staff_id, clients(name)')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(200);
      if (from) comandasQuery = comandasQuery.gte('created_at', from);
      if (to) comandasQuery = comandasQuery.lte('created_at', to);

      const [comandasRes, staffRes] = await Promise.all([
        comandasQuery,
        clubSupabase
          .from('staff')
          .select('id, name')
          .eq('tenant_id', tenantId),
      ]);

      if (comandasRes.error) throw comandasRes.error;

      const staffById = new Map(
        (staffRes.data || []).map((s: any) => [s.id, String(s.name || 'Profissional')]),
      );

      const records: SaleRecord[] = (comandasRes.data || []).map((comanda: any) => ({
        id: comanda.id,
        client_name: comanda.clients?.name || 'Cliente não informado',
        total: Number(comanda.total || 0),
        status: String(comanda.status || ''),
        created_at: comanda.created_at,
        staff_names: comanda.staff_id && staffById.has(comanda.staff_id)
          ? [staffById.get(comanda.staff_id) as string]
          : [],
      }));

      setSales(records);
    } catch (err) {
      console.error('Erro ao buscar vendas:', err);
      setToast({ msg: 'Erro ao carregar vendas', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [tenantId, clubSupabase, filters.dateFrom, filters.dateTo]);

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
    const detailRange = filters.dateFrom || filters.dateTo
      ? `${filters.dateFrom ? fmtDate(filters.dateFrom) : '—'} → ${filters.dateTo ? fmtDate(filters.dateTo) : '—'}`
      : 'Todo o período';

    const growthText = kpi?.growth == null ? '—' : `${(kpi.growth * 100).toFixed(1)}%`;

    return (
      <div className="space-y-4">
        {!isMapped && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs font-semibold text-amber-700 dark:text-amber-300">
            <span className="material-symbols-outlined align-middle text-sm mr-1">info</span>
            Período dos KPIs: <strong>{canonicalPeriodLabel(canonicalPeriod)}</strong>
            <span className="mx-2 text-amber-500/60">·</span>
            Detalhamento: <strong>{detailRange}</strong>
          </div>
        )}

        <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 rounded-xl border border-emerald-500/20 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-2xl">point_of_sale</span>
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-lg">Relatório de Vendas</h3>
              <p className="text-sm text-slate-500">
                KPIs canônicos: {canonicalPeriodLabel(canonicalPeriod)}
              </p>
            </div>
          </div>

          {kpiError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10 px-4 py-3 text-xs font-semibold text-red-700 dark:text-red-300">
              KPIs canônicos indisponíveis: {kpiError}. A listagem de vendas abaixo continua
              funcionando com os filtros selecionados.
            </div>
          )}

          {kpiError ? (
            <div className="flex items-center justify-center py-8 text-sm font-semibold text-slate-400">
              KPIs indisponíveis — use o detalhamento abaixo.
            </div>
          ) : kpiLoading || !kpi ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {renderKpiCard('Faturamento', fmt(kpi.revenue), 'text-emerald-600', isMapped ? canonicalPeriodLabel(canonicalPeriod) : undefined)}
              {renderKpiCard('Despesas', fmt(kpi.expenses), 'text-slate-700 dark:text-slate-200', isMapped ? canonicalPeriodLabel(canonicalPeriod) : undefined)}
              {renderKpiCard('Resultado', fmt(kpi.result), kpi.result >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-600 dark:text-red-300', isMapped ? canonicalPeriodLabel(canonicalPeriod) : undefined)}
              {renderKpiCard('Ticket Médio', fmt(kpi.average_ticket), 'text-[#007BFF] dark:text-[#00D2FF]', isMapped ? canonicalPeriodLabel(canonicalPeriod) : undefined)}
              {renderKpiCard('Crescimento', growthText, 'text-indigo-600 dark:text-indigo-300', 'vs. período anterior')}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Comandas no período</h4>
            <span className="text-[11px] font-semibold text-slate-500">{detailRange}</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : sales.length === 0 ? (
            <div className="text-center py-12">
              <span className="material-symbols-outlined text-5xl text-slate-300 mb-3">receipt_long</span>
              <p className="text-sm font-semibold text-slate-500">Nenhuma comanda no período selecionado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-widest text-slate-400 border-b border-slate-200 dark:border-slate-700">
                    <th className="px-4 py-2 font-bold">Data</th>
                    <th className="px-4 py-2 font-bold">Cliente</th>
                    <th className="px-4 py-2 font-bold">Valor</th>
                    <th className="px-4 py-2 font-bold">Status</th>
                    <th className="px-4 py-2 font-bold">Profissional</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => (
                    <tr key={sale.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{fmtDateTime(sale.created_at)}</td>
                      <td className="px-4 py-2.5 font-semibold text-slate-900 dark:text-white">{sale.client_name}</td>
                      <td className="px-4 py-2.5 font-bold text-slate-900 dark:text-white">{fmt(sale.total)}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          sale.status === 'paid'
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                            : sale.status === 'cancelled'
                              ? 'bg-red-500/10 text-red-600 dark:text-red-300'
                              : 'bg-slate-500/10 text-slate-600 dark:text-slate-300'
                        }`}>
                          {STATUS_LABELS[sale.status] || sale.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                        {sale.staff_names.length > 0 ? sale.staff_names.join(', ') : '—'}
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

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Relatórios</h1>
          <p className="text-sm text-slate-500">Visão completa do seu negócio</p>
        </div>
        <DateRangeFilter
          startDate={filters.dateFrom}
          endDate={filters.dateTo}
          onStartDateChange={(v) => setFilters(f => ({ ...f, dateFrom: v }))}
          onEndDateChange={(v) => setFilters(f => ({ ...f, dateTo: v }))}
          onPresetChange={handlePresetChange}
          showPresets={true}
        />
      </div>

      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
        {tabs.map(tab => (
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