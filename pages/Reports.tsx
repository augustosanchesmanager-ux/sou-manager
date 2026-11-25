import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  TrendingUp,
  Calendar,
  Package,
  Wallet,
  Award,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTenantOptional } from '../src/context/TenantContext';
import { chefClubSubscriptionRepository } from '../domain/chefClub/subscription-repository';
import { chefClubPlanRepository } from '../domain/chefClub/plan-repository';
import { chefClubCreditRepository } from '../domain/chefClub/credit-repository';
import DateRangeFilter from '../components/ui/DateRangeFilter';
import Toast from '../components/Toast';
import ExportActionsDropdown from '../src/components/common/ExportActionsDropdown';
import type { ExportPayload } from '../src/utils/export/types';
import {
  fetchAppointmentsReport,
  fetchBarberAdvancesInPeriod,
  fetchFinancialTitlesReport,
  fetchPaidComandasReport,
  fetchProductSalesByStaffReport,
  fetchProductsReport,
  type AllocatedComandaItemDetail,
  type AppointmentReportRow,
  type BarberAdvanceRecord,
  type FinancialTitleRow,
  type PaidComandaDetail,
  type PaymentCategoryKey,
  type ProductCatalogItem,
  type ProductSalesByStaffRow,
  type ProductSalesReportRow,
} from '../src/modules/reports/reportsDataService';
import {
  buildAppointmentsExportPayload,
  buildCommissionsExportPayload,
  buildFinancialTitlesExportPayload,
  buildProductsByStaffExportPayload,
  buildProductsSalesExportPayload,
  buildProductsStockExportPayload,
  buildSalesExportPayload,
} from '../src/modules/reports/reportsExportBuilder';
import { ReportsSalesTab } from '../components/reports/ReportsSalesTab';
import {
  ReportsAppointmentsTab,
  type AppointmentStatusFilter,
} from '../components/reports/ReportsAppointmentsTab';
import { ReportsProductsTab } from '../components/reports/ReportsProductsTab';
import {
  ReportsFinancialTab,
  type FinancialSubTab,
} from '../components/reports/ReportsFinancialTab';
import { ReportsChefClubTab } from '../components/reports/ReportsChefClubTab';
import MetricCard from '../components/ui/MetricCard';

export type ReportsTabKey = 'sales' | 'appointments' | 'products' | 'financial' | 'chefclub';

const VALID_TABS: ReportsTabKey[] = ['sales', 'appointments', 'products', 'financial', 'chefclub'];

const formatLocalYMD = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getInitialMonthRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    dateFrom: formatLocalYMD(start),
    dateTo: formatLocalYMD(end),
  };
};

const fmtDateDisplay = (d: string) => {
  if (!d) return '-';
  const [y, m, day] = d.split('-');
  if (!y || !m || !day) return d;
  return `${day}/${m}/${y}`;
};

const Reports: React.FC = () => {
  const { tenantId } = useAuth();
  const tenantCtx = useTenantOptional();
  const tenantName = tenantCtx?.tenant?.name || 'Unidade SMG Barber';
  const [searchParams, setSearchParams] = useSearchParams();

  // Sincronização de Aba Ativa com URL (?tab=sales | appointments | products | financial | chefclub)
  const rawTabParam = searchParams.get('tab') as ReportsTabKey | null;
  const activeTab: ReportsTabKey =
    rawTabParam && VALID_TABS.includes(rawTabParam) ? rawTabParam : 'sales';

  const initialDates = useMemo(() => getInitialMonthRange(), []);
  const dateFrom = searchParams.get('from') || initialDates.dateFrom;
  const dateTo = searchParams.get('to') || initialDates.dateTo;

  const setActiveTab = useCallback(
    (tab: ReportsTabKey) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('tab', tab);
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const setDateRange = useCallback(
    (newFrom: string, newTo: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('from', newFrom);
          next.set('to', newTo);
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [loadIssues, setLoadIssues] = useState<string[]>([]);

  // Dados Carregados
  const [paidComandas, setPaidComandas] = useState<PaidComandaDetail[]>([]);
  const [allocatedItems, setAllocatedItems] = useState<AllocatedComandaItemDetail[]>([]);
  const [appointments, setAppointments] = useState<AppointmentReportRow[]>([]);
  const navigate = useNavigate();
  const [productSales, setProductSales] = useState<ProductSalesReportRow[]>([]);
  const [productSalesByStaff, setProductSalesByStaff] = useState<ProductSalesByStaffRow[]>([]);
  const [productCatalog, setProductCatalog] = useState<ProductCatalogItem[]>([]);
  const [barberAdvances, setBarberAdvances] = useState<BarberAdvanceRecord[]>([]);
  const [receivables, setReceivables] = useState<FinancialTitleRow[]>([]);
  const [payables, setPayables] = useState<FinancialTitleRow[]>([]);
  const [chefClubStats, setChefClubStats] = useState({
    activeSubscriptions: 0,
    totalCreditsAvailable: 0,
    totalCreditsUsed: 0,
    popularPlan: null as string | null,
  });

  // Filtros locais por aba
  const [salesStaffFilter, setSalesStaffFilter] = useState('all');
  const [salesPaymentFilter, setSalesPaymentFilter] = useState<'all' | PaymentCategoryKey>('all');
  const [apptStaffFilter, setApptStaffFilter] = useState('all');
  const [apptStatusFilter, setApptStatusFilter] = useState<AppointmentStatusFilter>('all');
  const [productsSubView, setProductsSubView] = useState<'sales' | 'by_staff' | 'stock'>('sales');
  const [financialSubTab, setFinancialSubTab] = useState<FinancialSubTab>('commissions');
  const [selectedBarberId, setSelectedBarberId] = useState('all');
  const [dateFieldMode, setDateFieldMode] = useState<'due_date' | 'paid_at'>('due_date');

  // Carregar dados consolidados.
  // Cada bloco é isolado (allSettled): falha em uma seção não zera as demais.
  const loadReportData = useCallback(async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const issues: string[] = [];
    const fail = (label: string, err: unknown) => {
      console.error(`[reports] falha ao carregar ${label}:`, err);
      issues.push(label);
    };
    const unwrap = <T,>(result: PromiseSettledResult<T>, label: string): T | null => {
      if (result.status === 'fulfilled') return result.value;
      fail(label, result.reason);
      return null;
    };

    try {
      // Clube dos Chefes: assinaturas + saldo real de créditos (customer_credits).
      const loadChefClub = async () => {
        const [subscriptions, credits] = await Promise.all([
          chefClubSubscriptionRepository.list(tenantId, { status: 'active' }),
          chefClubCreditRepository.listAll(tenantId),
        ]);
        const planIds = Array.from(
          new Set(subscriptions.map((s) => s.plan_id).filter((id): id is string => Boolean(id)))
        );
        const plans = planIds.length > 0 ? await chefClubPlanRepository.getByIds(planIds, tenantId) : [];
        const planNameById = new Map(plans.map((p) => [p.id, p.name]));
        return {
          subscriptions: subscriptions.map((s) => ({
            ...s,
            customer_plans: { name: planNameById.get(s.plan_id) },
          })),
          credits,
        };
      };

      const [comandasRes, apptsRes, advancesRes, titlesRes, clubRes] = await Promise.allSettled([
        fetchPaidComandasReport(tenantId, dateFrom, dateTo),
        fetchAppointmentsReport(tenantId, dateFrom, dateTo),
        fetchBarberAdvancesInPeriod(tenantId, dateFrom, dateTo),
        fetchFinancialTitlesReport(tenantId, dateFrom, dateTo, dateFieldMode),
        loadChefClub(),
      ]);

      const comandas = unwrap(comandasRes, 'Vendas & Faturamento');
      const appts = unwrap(apptsRes, 'Atendimentos');
      const advances = unwrap(advancesRes, 'Vales e adiantamentos');
      const titles = unwrap(titlesRes, 'Financeiro');
      const club = unwrap(clubRes, 'Clube dos Chefes');

      if (comandas) {
        setPaidComandas(comandas.comandas);
        setAllocatedItems(comandas.allocatedItems);
      }
      if (appts) setAppointments(appts);
      if (advances) setBarberAdvances(advances);
      if (titles) {
        setReceivables(titles.receivables);
        setPayables(titles.payables);
      }

      // Catálogo de produtos é carregado mesmo se comandas falhar (com fallback []),
      // garantindo a aba de Posição Atual de Estoque independente.
      try {
        const [productsRes, staffProductsRes] = await Promise.all([
          fetchProductsReport(tenantId, comandas ? comandas.allocatedItems : []),
          fetchProductSalesByStaffReport(tenantId, comandas ? comandas.allocatedItems : []),
        ]);
        setProductSales(productsRes.salesRows);
        setProductCatalog(productsRes.catalogItems);
        setProductSalesByStaff(staffProductsRes);
      } catch (err) {
        fail('Produtos & Estoque', err);
      }

      if (club) {
        const planCounts: Record<string, number> = {};
        for (const sub of club.subscriptions) {
          const planName = sub.customer_plans?.name || 'Plano Padrão';
          planCounts[planName] = (planCounts[planName] || 0) + 1;
        }
        const popularPlan =
          Object.entries(planCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

        setChefClubStats({
          activeSubscriptions: club.subscriptions.length,
          totalCreditsAvailable: club.credits.reduce(
            (acc, c) => acc + Number(c.available_credits || 0),
            0
          ),
          totalCreditsUsed: club.credits.reduce(
            (acc, c) => acc + Number(c.used_credits || 0),
            0
          ),
          popularPlan,
        });
      }

      setLoadIssues(issues);
      if (issues.length > 0) {
        setToast({
          msg: `Não foi possível carregar: ${issues.join(', ')}.`,
          type: 'error',
        });
      }
    } catch (err: any) {
      console.error('Erro ao carregar relatórios:', err);
      setLoadIssues(['Relatórios']);
      setToast({
        msg: err?.message || 'Não foi possível carregar os dados do relatório.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [tenantId, dateFrom, dateTo, dateFieldMode]);

  useEffect(() => {
    loadReportData();
  }, [loadReportData]);

  // Listas de profissionais para filtros
  const availableSalesStaff = useMemo(() => {
    const set = new Set<string>();
    paidComandas.forEach((c) => c.staffNames.forEach((n) => set.add(n)));
    return Array.from(set).sort();
  }, [paidComandas]);

  const availableApptStaff = useMemo(() => {
    const set = new Set<string>();
    appointments.forEach((a) => {
      if (a.staffName) set.add(a.staffName);
    });
    return Array.from(set).sort();
  }, [appointments]);

  const availableBarbersForCommissions = useMemo(() => {
    const map = new Map<string, string>();
    allocatedItems.forEach((it) => {
      if (it.barber_id && it.barber_name && it.barber_name !== 'Sem profissional') {
        map.set(it.barber_id, it.barber_name);
      }
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allocatedItems]);

  // Gerador de Payload Contextual para ExportActionsDropdown
  const periodLabel = `${fmtDateDisplay(dateFrom)} a ${fmtDateDisplay(dateTo)}`;

  const getExportPayload = useCallback((): ExportPayload<any> => {
    if (activeTab === 'sales') {
      const filtered = paidComandas.filter((c) => {
        if (salesStaffFilter !== 'all' && !c.staffNames.includes(salesStaffFilter)) return false;
        if (salesPaymentFilter !== 'all') {
          if (
            salesPaymentFilter === 'club' &&
            c.paymentBreakdown.club <= 0 &&
            c.primaryPaymentCategory !== 'club'
          ) {
            return false;
          }
          if (
            salesPaymentFilter !== 'club' &&
            c.paymentBreakdown[salesPaymentFilter] <= 0 &&
            c.primaryPaymentCategory !== salesPaymentFilter
          ) {
            return false;
          }
        }
        return true;
      });
      return buildSalesExportPayload(filtered, tenantName, periodLabel);
    }

    if (activeTab === 'appointments') {
      const filtered = appointments.filter((a) => {
        if (apptStaffFilter !== 'all' && a.staffName !== apptStaffFilter) return false;
        if (apptStatusFilter !== 'all' && a.statusCategory !== apptStatusFilter) return false;
        return true;
      });
      return buildAppointmentsExportPayload(filtered, tenantName, periodLabel);
    }

    if (activeTab === 'products') {
      if (productsSubView === 'sales') {
        return buildProductsSalesExportPayload(productSales, tenantName, periodLabel);
      }
      if (productsSubView === 'by_staff') {
        return buildProductsByStaffExportPayload(productSalesByStaff, tenantName, periodLabel);
      }
      return buildProductsStockExportPayload(productCatalog, tenantName, periodLabel);
    }

    if (activeTab === 'financial') {
      if (financialSubTab === 'commissions') {
        const filteredItems = allocatedItems.filter(
          (it) => selectedBarberId === 'all' || it.barber_id === selectedBarberId
        );
        const filteredAdv = barberAdvances.filter(
          (adv) => selectedBarberId === 'all' || adv.staffId === selectedBarberId
        );
        const barberLabel =
          selectedBarberId === 'all'
            ? 'Todos os Barbeiros'
            : availableBarbersForCommissions.find((b) => b.id === selectedBarberId)?.name ||
              'Barbeiro';

        return buildCommissionsExportPayload(
          filteredItems,
          filteredAdv,
          barberLabel,
          tenantName,
          periodLabel
        );
      }

      if (financialSubTab === 'receivables') {
        return buildFinancialTitlesExportPayload(
          receivables,
          'Relatório de Contas a Receber',
          tenantName,
          periodLabel
        );
      }

      return buildFinancialTitlesExportPayload(
        payables,
        'Relatório de Contas a Pagar',
        tenantName,
        periodLabel
      );
    }

    // Fallback para Chef Club
    return {
      metadata: {
        title: 'Indicadores Clube dos Chefes',
        tenantName,
        periodLabel,
        generatedAt: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
      },
      columns: [
        { header: 'Indicador', key: 'label' },
        { header: 'Valor', key: 'value' },
      ],
      data: [
        { label: 'Assinaturas Ativas', value: chefClubStats.activeSubscriptions },
        { label: 'Créditos Disponíveis', value: chefClubStats.totalCreditsAvailable },
        { label: 'Créditos Utilizados', value: chefClubStats.totalCreditsUsed },
        { label: 'Plano Mais Popular', value: chefClubStats.popularPlan || '-' },
      ],
    };
  }, [
    activeTab,
    paidComandas,
    salesStaffFilter,
    salesPaymentFilter,
    appointments,
    apptStaffFilter,
    apptStatusFilter,
    productsSubView,
    productSales,
    productCatalog,
    financialSubTab,
    allocatedItems,
    barberAdvances,
    selectedBarberId,
    availableBarbersForCommissions,
    receivables,
    payables,
    chefClubStats,
    tenantName,
    periodLabel,
  ]);

  const exportFilename = useMemo(() => {
    const suffix = `${dateFrom}_a_${dateTo}`;
    if (activeTab === 'sales') return `vendas-faturamento-${suffix}`;
    if (activeTab === 'appointments') return `atendimentos-${suffix}`;
    if (activeTab === 'products') {
      if (productsSubView === 'sales') return `produtos-vendas-${suffix}`;
      if (productsSubView === 'by_staff') return `produtos-por-profissional-${suffix}`;
      return `produtos-estoque-${dateTo}`;
    }
    if (activeTab === 'financial') {
      if (financialSubTab === 'commissions') return `extrato-comissoes-${suffix}`;
      if (financialSubTab === 'receivables') return `contas-a-receber-${suffix}`;
      return `contas-a-pagar-${suffix}`;
    }
    return `clube-dos-chefes-${suffix}`;
  }, [activeTab, productsSubView, financialSubTab, dateFrom, dateTo]);

  const tabsConfig: Array<{
    key: ReportsTabKey;
    label: string;
    icon: React.ReactNode;
  }> = [
    { key: 'sales', label: 'Vendas & Faturamento', icon: <TrendingUp className="w-4 h-4" /> },
    { key: 'appointments', label: 'Atendimentos', icon: <Calendar className="w-4 h-4" /> },
    { key: 'products', label: 'Produtos & Estoque', icon: <Package className="w-4 h-4" /> },
    { key: 'financial', label: 'Financeiro & Comissões', icon: <Wallet className="w-4 h-4" /> },
    { key: 'chefclub', label: 'Clube dos Chefes', icon: <Award className="w-4 h-4" /> },
  ];

  const totalRevenue = useMemo(() => paidComandas.reduce((s, c) => s + Number(c.appliedTotal || 0), 0), [paidComandas]);
  const totalPaidComandas = useMemo(() => paidComandas.length, [paidComandas]);
  const totalAppointments = useMemo(() => appointments.length, [appointments]);
  const activeSubs = chefClubStats.activeSubscriptions;

  return (
    <div className="min-h-screen bg-background-dark text-ink p-4 sm:p-6 lg:p-8 space-y-6">
      {toast && (
        <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* ===== TIER 1 — Identidade, Período Único & CTAs ===== */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-border-dark pb-6">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-widest text-primary-light">
            Gestão &amp; Inteligência
          </span>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-white mt-1 tracking-tight">
            Relatórios
          </h1>
          <p className="text-xs text-ink-soft mt-1">
            Separação clara entre faturamento liquidado, operação da cadeira, giro de produtos e extrato de comissões.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={loadReportData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-card-dark border border-border-dark text-ink-soft hover:border-primary/40 hover:text-white transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-primary' : ''}`} />
            Atualizar
          </button>

          <ExportActionsDropdown
            getPayload={getExportPayload}
            baseFilename={exportFilename}
            disabled={loading}
            className="bg-card-dark border border-border-dark text-ink-soft hover:border-primary/40 hover:text-white"
          />
        </div>
      </div>

      {/* ===== TIER 2 — Período + Abas (segmented control) ===== */}
      <div className="space-y-4">
        <div className="bg-card-dark border border-border-dark rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <DateRangeFilter
            startDate={dateFrom}
            endDate={dateTo}
            onStartDateChange={(newStart) => setDateRange(newStart, dateTo)}
            onEndDateChange={(newEnd) => setDateRange(dateFrom, newEnd)}
          />
          <div className="text-xs text-ink-soft">
            Período ativo: <strong className="text-primary-light">{periodLabel}</strong>
          </div>
        </div>

        {/* Navegação de Abas — Segmented Control */}
        <div
          className="inline-flex items-center gap-1 p-1 bg-night/60 border border-border-dark/60 rounded-2xl"
          role="tablist"
        >
          {tabsConfig.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-150 flex items-center gap-2 ${
                  isActive
                    ? 'bg-primary/20 text-primary-light border border-primary/30 shadow-xs'
                    : 'text-ink-soft hover:text-white hover:bg-white/5 border-transparent'
                }`}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Resumo rápido da aba ativa (KPIs contextuais) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Faturamento no Período"
          value={totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          helper={`• ${totalPaidComandas} comanda(s) paga(s)`}
          icon="trending_up"
          tone="brass"
        />
        <MetricCard
          label="Atendimentos no Período"
          value={totalAppointments.toLocaleString('pt-BR')}
          helper="Agendamentos realizados"
          icon="calendar"
          tone="info"
        />
        <MetricCard
          label="Assinaturas Ativas"
          value={activeSubs.toLocaleString('pt-BR')}
          helper="Clube dos Chefes"
          icon="award"
          tone="brass"
        />
        <MetricCard
          label="Produtos no Catálogo"
          value={productCatalog.length.toLocaleString('pt-BR')}
          helper="Itens cadastrados"
          icon="package"
          tone="neutral"
        />
      </div>

      {/* Aviso persistente de carga parcial (não depende do toast de 4s) */}
      {loadIssues.length > 0 && (
        <div
          role="alert"
          className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger/90"
        >
          <div className="flex items-center gap-2 font-semibold text-danger">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Alguns dados não puderam ser carregados
          </div>
          <p className="mt-1 text-danger/80">
            Seções afetadas: <strong className="text-danger">{loadIssues.join(' · ')}</strong>. Os
            demais blocos abaixo continuam exibindo os dados disponíveis. Use “Atualizar” para tentar
            novamente.
          </p>
        </div>
      )}

      {/* ===== TIER 3 — Conteúdo da Aba Selecionada ===== */}
      <div className="pt-4">
        {activeTab === 'sales' && (
          <ReportsSalesTab
            comandas={paidComandas}
            loading={loading}
            selectedStaff={salesStaffFilter}
            onSelectStaff={setSalesStaffFilter}
            selectedPayment={salesPaymentFilter}
            onSelectPayment={setSalesPaymentFilter}
            availableStaff={availableSalesStaff}
          />
        )}

        {activeTab === 'appointments' && (
          <ReportsAppointmentsTab
            appointments={appointments}
            loading={loading}
            selectedStaff={apptStaffFilter}
            onSelectStaff={setApptStaffFilter}
            selectedStatus={apptStatusFilter}
            onSelectStatus={setApptStatusFilter}
            availableStaff={availableApptStaff}
          />
        )}

        {activeTab === 'products' && (
          <ReportsProductsTab
            salesRows={productSales}
            staffRows={productSalesByStaff}
            catalogItems={productCatalog}
            loading={loading}
            subView={productsSubView}
            onChangeSubView={setProductsSubView}
            onSendBonusToPayroll={(row) => {
              navigate('/payroll', {
                state: {
                  suggestedBonus: {
                    staffId: row.staffId,
                    staffName: row.staffName,
                    amount: row.goalEvaluation.bonusAmount,
                    tierLabel: row.goalEvaluation.achievedTier?.label || 'Meta de Produtos',
                    periodFrom: dateFrom,
                    periodTo: dateTo,
                  },
                },
              });
            }}
          />
        )}

        {activeTab === 'financial' && (
          <ReportsFinancialTab
            subTab={financialSubTab}
            onChangeSubTab={setFinancialSubTab}
            allocatedItems={allocatedItems}
            advances={barberAdvances}
            receivables={receivables}
            payables={payables}
            loading={loading}
            selectedBarberId={selectedBarberId}
            onSelectBarberId={setSelectedBarberId}
            availableBarbers={availableBarbersForCommissions}
            dateFieldMode={dateFieldMode}
            onChangeDateFieldMode={setDateFieldMode}
          />
        )}

        {activeTab === 'chefclub' && (
          <ReportsChefClubTab stats={chefClubStats} loading={loading} />
        )}
      </div>
    </div>
  );
};

export default Reports;
