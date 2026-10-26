import React, { useState, useEffect, useMemo } from 'react';
import {
    BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { useTheme } from '../context/ThemeContext';
import { useSearchParams } from 'react-router-dom';
import { useBusinessInsights } from '../src/hooks/useBusinessInsights';
import { useAuth } from '../context/AuthContext';
import { RevenueAreaChart, ExpenseChart, StaffPerformanceCard, ProductSalesChart, AppointmentTimeline } from '../components/charts';
import MetricCard from '../components/ui/MetricCard';
import { getClientForTable, getScopedClient, supabase } from '../services/supabaseClient';
import { formatCurrency } from '../shared/format/currency';

// Novos componentes dedicados de BI Avançado
import { ScheduleHeatmap } from '../components/bi/ScheduleHeatmap';
import { StaffProfitabilityTable } from '../components/bi/StaffProfitabilityTable';
import { LiquidityWaterfallCard } from '../components/bi/LiquidityWaterfallCard';
import {
    ScheduleHeatmapCell,
    StaffProductivityDetail,
    LiquidityOverview,
} from '../src/types/business-insights';

const COLORS = ['#D99A2B', '#A96F14', '#178A50', '#F3D9A4', '#C92A2A', '#F7E7C2', '#E8DFC9', '#6B6252'];

const periodLabels: Record<string, string> = {
    today: 'Hoje',
    '7d': '7 Dias',
    '30d': '30 Dias',
    '90d': '90 Dias',
};

type ActiveBiTab = 'executive' | 'staff' | 'heatmap' | 'legacy_charts';

const BusinessIntelligence: React.FC = () => {
    const { theme } = useTheme();
    const { tenantId } = useAuth();
    const [searchParams] = useSearchParams();
    const barberSupabase = getScopedClient('barber');

    const initialPeriod = (searchParams.get('period') as any) || '30d';
    const [period, setPeriod] = useState<string>(initialPeriod);
    const [activeTab, setActiveTab] = useState<ActiveBiTab>('executive');

    // Estados dos novos dados de inteligência
    const [heatmapCells, setHeatmapCells] = useState<ScheduleHeatmapCell[]>([]);
    const [staffDetails, setStaffDetails] = useState<StaffProductivityDetail[]>([]);
    const [liquidity, setLiquidity] = useState<LiquidityOverview>({
        grossRevenue: 0,
        bankingFees: 0,
        staffCommissions: 0,
        operatingExpenses: 0,
        netOperatingCash: 0,
        netMarginPercent: 0,
        reconciledCount: 0,
        unreconciledCount: 0,
    });

    const [expenseData, setExpenseData] = useState<any[]>([]);
    const [productSales, setProductSales] = useState<any[]>([]);
    const [appointmentTimeline, setAppointmentTimeline] = useState<any[]>([]);
    const [cancellationData, setCancellationData] = useState<{
        byReason: { reason: string; count: number; label: string; percentage: number }[];
        total: number;
        recoveryRate: number;
        recoveryAttempts: number;
        recovered: number;
        timeline: { date: string; count: number }[];
    }>({
        byReason: [],
        total: 0,
        recoveryRate: 0,
        recoveryAttempts: 0,
        recovered: 0,
        timeline: [],
    });

    const { data, reload } = useBusinessInsights({ period: period as any });

    // Carregar e agregar dados de inteligência avançada (Heatmap, Staff e Liquidez Real)
    useEffect(() => {
        if (!tenantId) return;

        const fetchAdvancedBI = async () => {
            try {
                // Determinar filtro de datas com base no período
                const now = new Date();
                let fromDate = new Date();
                if (period === 'today') {
                    fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                } else if (period === '7d') {
                    fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                } else if (period === '30d') {
                    fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                } else if (period === '90d') {
                    fromDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                }
                const fromIso = fromDate.toISOString();

                // 1. Heatmap e Produtividade via Appointments
                const appointmentsClient = getClientForTable('appointments', 'barber');
                const { data: appts } = await appointmentsClient
                    .from('appointments')
                    .select('id, start_time, staff_id, staff_name, price, status, service_name')
                    .eq('tenant_id', tenantId)
                    .gte('start_time', fromIso);

                const appointments = appts || [];

                // Agregar Heatmap (Dia x Hora)
                const matrixCount: Record<string, { count: number; revenue: number }> = {};
                appointments.forEach((apt: any) => {
                    if (apt.start_time) {
                        const d = new Date(apt.start_time);
                        const dayOfWeek = d.getDay(); // 0 a 6
                        const hour = d.getHours();    // 0 a 23
                        if (hour >= 8 && hour <= 20) {
                            const key = `${dayOfWeek}-${hour}`;
                            if (!matrixCount[key]) {
                                matrixCount[key] = { count: 0, revenue: 0 };
                            }
                            matrixCount[key].count++;
                            if (apt.status === 'completed' || apt.status === 'confirmed') {
                                matrixCount[key].revenue += Number(apt.price) || 0;
                            }
                        }
                    }
                });

                const daysList = [
                    { day: 1, label: 'Segunda' },
                    { day: 2, label: 'Terça' },
                    { day: 3, label: 'Quarta' },
                    { day: 4, label: 'Quinta' },
                    { day: 5, label: 'Sexta' },
                    { day: 6, label: 'Sábado' },
                    { day: 0, label: 'Domingo' },
                ];

                const cells: ScheduleHeatmapCell[] = [];
                daysList.forEach((d) => {
                    for (let h = 8; h <= 20; h++) {
                        const key = `${d.day}-${h}`;
                        const found = matrixCount[key] || { count: 0, revenue: 0 };
                        // Estimativa baseada em capacidade de 4 cortes/hora no salão
                        const occupancy = Math.min(Math.round((found.count / 4) * 100), 100);

                        cells.push({
                            dayOfWeek: d.day,
                            dayLabel: d.label,
                            hour: h,
                            hourLabel: `${String(h).padStart(2, '0')}:00`,
                            appointmentsCount: found.count,
                            occupancyRate: occupancy,
                            revenue: found.revenue,
                        });
                    }
                });
                setHeatmapCells(cells);

                // 2. Produtividade por Barbeiro (Rubens, Heron, Lucas)
                const staffMap: Record<
                    string,
                    { name: string; appointments: number; revenue: number }
                > = {};

                appointments.forEach((apt: any) => {
                    const sId = apt.staff_id || 'unknown';
                    const sName = apt.staff_name || 'Profissional';
                    if (!staffMap[sId]) {
                        staffMap[sId] = { name: sName, appointments: 0, revenue: 0 };
                    }
                    if (apt.status !== 'cancelled' && apt.status !== 'canceled') {
                        staffMap[sId].appointments++;
                        staffMap[sId].revenue += Number(apt.price) || 0;
                    }
                });

                // Comissões teóricas (50% de média padrão na barbearia, salvo rateio customizado)
                const staffList: StaffProductivityDetail[] = Object.entries(staffMap).map(
                    ([staffId, info]) => {
                        const totalGrossRevenue = info.revenue;
                        const avgTicket = info.appointments > 0 ? totalGrossRevenue / info.appointments : 0;
                        const totalCommission = totalGrossRevenue * 0.5; // taxa base padrão
                        const netShopMargin = totalGrossRevenue - totalCommission;
                        const netMarginPercent = totalGrossRevenue > 0 ? (netShopMargin / totalGrossRevenue) * 100 : 0;

                        return {
                            staffId,
                            name: info.name,
                            appointmentsCount: info.appointments,
                            totalGrossRevenue,
                            avgTicket,
                            totalCommission,
                            netShopMargin,
                            netMarginPercent,
                        };
                    }
                );
                setStaffDetails(staffList);

                // 3. Liquidez Real e Conciliação Bancária
                const transactionsClient = getClientForTable('transactions', 'barber');
                const { data: txData } = await transactionsClient
                    .from('transactions')
                    .select('type, amount, category')
                    .eq('tenant_id', tenantId)
                    .gte('date', fromIso.split('T')[0]);

                let totalGross = 0;
                let bankingFees = 0;
                let otherExpenses = 0;

                (txData || []).forEach((t: any) => {
                    const amt = Math.abs(Number(t.amount) || 0);
                    if (t.type === 'income') {
                        totalGross += amt;
                    } else if (t.type === 'expense') {
                        const cat = (t.category || '').toLowerCase();
                        if (cat.includes('taxa') || cat.includes('tarifa') || cat.includes('banco') || cat.includes('cartao')) {
                            bankingFees += amt;
                        } else {
                            otherExpenses += amt;
                        }
                    }
                });

                // Se o faturamento em transactions for menor que nos agendamentos, usar a maior base real
                const effectiveGross = Math.max(
                    totalGross,
                    staffList.reduce((acc, s) => acc + s.totalGrossRevenue, 0)
                );
                const totalCommissions = staffList.reduce((acc, s) => acc + s.totalCommission, 0);

                // Buscar contagem de transações conciliadas
                const { data: stmtTxs } = await supabase
                    .from('bank_statement_transactions')
                    .select('status')
                    .eq('tenant_id', tenantId);

                const reconciledCount = (stmtTxs || []).filter((s: any) => s.status === 'reconciled').length;
                const unreconciledCount = (stmtTxs || []).filter((s: any) => s.status === 'unreconciled').length;

                // Estimar taxa de maquininha em ~2.5% do bruto caso ainda não haja taxa lançada
                const effectiveBankingFees = bankingFees > 0 ? bankingFees : effectiveGross * 0.025;
                const netOperatingCash = effectiveGross - totalCommissions - effectiveBankingFees;
                const netMarginPercent = effectiveGross > 0 ? (netOperatingCash / effectiveGross) * 100 : 0;

                setLiquidity({
                    grossRevenue: effectiveGross,
                    bankingFees: effectiveBankingFees,
                    staffCommissions: totalCommissions,
                    operatingExpenses: otherExpenses,
                    netOperatingCash,
                    netMarginPercent,
                    reconciledCount,
                    unreconciledCount,
                });
            } catch (err) {
                console.warn('Erro ao carregar inteligência avançada:', err);
            }
        };

        fetchAdvancedBI();
    }, [tenantId, period]);

    // Fetch legados para gráficos tradicionais
    useEffect(() => {
        if (!tenantId) return;

        const fetchAll = async () => {
            try {
                const transactionsClient = getClientForTable('transactions', 'barber');

                try {
                    const { data: expenses } = await transactionsClient
                        .from('transactions')
                        .select('category, amount')
                        .eq('tenant_id', tenantId)
                        .eq('type', 'expense');

                    if (expenses && expenses.length > 0) {
                        const categoryTotals: Record<string, number> = {};
                        expenses.forEach((e: any) => {
                            const cat = e.category || 'Outros';
                            categoryTotals[cat] = (categoryTotals[cat] || 0) + Math.abs(e.amount || 0);
                        });
                        setExpenseData(
                            Object.entries(categoryTotals).map(([category, amount]) => ({
                                category,
                                amount,
                                color: '#B88A44',
                            }))
                        );
                    }
                } catch (err) {
                    console.warn('Erro ao carregar despesas:', err);
                }
            } catch (err) {
                console.warn('Erro ao carregar dados dos gráficos:', err);
            }
        };

        fetchAll();
    }, [tenantId, period]);

    const tooltipStyle = {
        backgroundColor: '#fff',
        borderColor: '#E8DFC9',
        borderRadius: '8px',
        fontSize: '12px',
        color: '#191611',
    };

    return (
        <div className="min-h-screen bg-cream space-y-6 animate-fade-in pb-12 p-6 max-w-7xl mx-auto">
            {/* Header Executivo & Filtros */}
            <div className="rounded-2xl border border-line bg-card p-6 shadow-sm">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-3xl">
                        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-gold-soft px-3 py-1 text-[11px] font-bold text-gold-deep">
                            <span className="material-symbols-outlined text-sm">monitoring</span>
                            SMG BARBER • BUSINESS INTELLIGENCE
                        </div>
                        <h1 className="text-2xl font-black text-ink">
                            Painel de Decisão Estratégica
                        </h1>
                        <p className="mt-1 max-w-2xl text-xs sm:text-sm text-ink-soft">
                            DRE gerencial de liquidez, produtividade dos barbeiros e mapas de calor de ociosidade da grade da Sanchez Barber.
                        </p>
                    </div>

                    {/* Filtros de Período */}
                    <div className="flex items-center gap-1.5 rounded-xl border border-line bg-card p-1 shadow-sm">
                        {(['today', '7d', '30d', '90d'] as const).map((p) => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    period === p
                                        ? 'bg-gold text-night shadow-sm'
                                        : 'text-ink-soft hover:bg-gold-pale hover:text-ink'
                                }`}
                            >
                                {periodLabels[p]}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Abas de Navegação Analítica */}
                <div className="flex items-center gap-2 mt-6 pt-4 border-t border-line overflow-x-auto">
                    {[
                        { key: 'executive', label: '1. Liquidez Real & DRE Cascata', icon: 'payments' },
                        { key: 'staff', label: '2. Produtividade & Lucro da Equipe', icon: 'badge' },
                        { key: 'heatmap', label: '3. Mapa de Ocupação da Grade (Heatmap)', icon: 'calendar_month' },
                        { key: 'legacy_charts', label: '4. Visão Operacional & Clientes', icon: 'insights' },
                    ].map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key as ActiveBiTab)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold shrink-0 transition-all ${
                                activeTab === tab.key
                                    ? 'bg-night text-white dark:bg-gold dark:text-night shadow-sm'
                                    : 'bg-gold-pale/40 text-ink-soft hover:text-ink hover:bg-gold-pale'
                            }`}
                        >
                            <span className="material-symbols-outlined text-sm">{tab.icon}</span>
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* ABA 1: DRE Gerencial de Liquidez e Indicadores Financeiros */}
            {activeTab === 'executive' && (
                <div className="space-y-6">
                    <LiquidityWaterfallCard liquidity={liquidity} />

                    {/* KPIs Rápidos */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <MetricCard
                            label="Faturamento Bruto"
                            value={formatCurrency(liquidity.grossRevenue)}
                            trend={{
                                direction: data.financial.revenueGrowth >= 0 ? 'up' : 'down',
                                label: `${data.financial.revenueGrowth >= 0 ? '+' : ''}${data.financial.revenueGrowth.toFixed(1)}%`,
                            }}
                            helper="período selecionado"
                            icon="payments"
                            tone="info"
                        />
                        <MetricCard
                            label="Comissões Pagas"
                            value={formatCurrency(liquidity.staffCommissions)}
                            helper="repasse aos barbeiros"
                            icon="group"
                            tone="warning"
                        />
                        <MetricCard
                            label="Taxas de Maquininha"
                            value={formatCurrency(liquidity.bankingFees)}
                            helper="adquirência & tarifas"
                            icon="credit_card"
                            tone="negative"
                        />
                        <MetricCard
                            label="Lucro Líquido Real"
                            value={formatCurrency(liquidity.netOperatingCash)}
                            helper={`Margem ${liquidity.netMarginPercent.toFixed(1)}%`}
                            icon="savings"
                            tone={liquidity.netOperatingCash >= 0 ? 'positive' : 'negative'}
                        />
                    </div>
                </div>
            )}

            {/* ABA 2: Produtividade dos Barbeiros (Rubens, Heron, Lucas) */}
            {activeTab === 'staff' && (
                <div className="space-y-6">
                    <StaffProfitabilityTable staffDetails={staffDetails} />
                </div>
            )}

            {/* ABA 3: Mapa de Calor da Grade (Ociosidade e Campanhas) */}
            {activeTab === 'heatmap' && (
                <div className="space-y-6">
                    <ScheduleHeatmap cells={heatmapCells} />
                </div>
            )}

            {/* ABA 4: Visão Operacional e Clientes */}
            {activeTab === 'legacy_charts' && (
                <div className="space-y-6">
                    {/* Charts Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 bg-card p-6 rounded-xl border border-line shadow-sm">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-base font-bold text-ink flex items-center gap-2">
                                    <span className="material-symbols-outlined text-gold-deep text-base bg-gold-soft p-1.5 rounded-lg">show_chart</span>
                                    Evolução do Faturamento
                                </h3>
                                <span className="text-[10px] font-bold text-ink-soft uppercase">Últimos Meses</span>
                            </div>
                            <div className="h-[280px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={data.analytics.revenueEvolution}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8DFC9" />
                                        <XAxis dataKey="month" stroke="#6B6252" fontSize={11} tickLine={false} />
                                        <YAxis stroke="#6B6252" fontSize={11} tickLine={false} tickFormatter={(v) => `R$${v}`} />
                                        <Tooltip contentStyle={tooltipStyle} />
                                        <Bar dataKey="income" name="Receita" fill="#D99A2B" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="expense" name="Despesa" fill="#C92A2A" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Top Serviços */}
                        <div className="bg-card p-6 rounded-xl border border-line shadow-sm">
                            <h3 className="text-base font-bold text-ink flex items-center gap-2 mb-4">
                                <span className="material-symbols-outlined text-gold-deep text-base bg-gold-soft p-1.5 rounded-lg">content_cut</span>
                                Serviços Mais Vendidos
                            </h3>
                            {data.analytics.topServices.length > 0 ? (
                                <div className="space-y-3">
                                    {data.analytics.topServices.slice(0, 5).map((srv, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-gold-pale/40">
                                            <div>
                                                <p className="text-xs font-bold text-ink">{srv.name}</p>
                                                <p className="text-[10px] text-ink-soft">{srv.count} realizados</p>
                                            </div>
                                            <span className="text-xs font-bold text-[#178A50]">
                                                {formatCurrency(srv.revenue)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-ink-soft">Sem dados de serviços.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BusinessIntelligence;
