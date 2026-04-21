import React, { useState, useEffect, useMemo } from 'react';
import {
    BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { useTheme } from '../context/ThemeContext';
import { useSearchParams } from 'react-router-dom';
import { useBusinessInsights } from '../src/hooks/useBusinessInsights';
import { useAuth } from '../context/AuthContext';
import { RevenueAreaChart, SparkLineChart, TrendBadge, MetricCard, ExpenseChart, StaffPerformanceCard, ProductSalesChart, AppointmentTimeline, RevenueModal } from '../components/charts';
import { getScopedClient, supabase } from '../services/supabaseClient';

const COLORS = ['#3c83f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#ef4444', '#a78bfa'];

const periodLabels = {
    today: 'Hoje',
    '7d': '7 Dias',
    '30d': '30 Dias',
    '90d': '90 Dias',
    custom: 'Personalizado'
};

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }).format(value);

const formatPercent = (value: number) => (value >= 0 ? '+' : '') + value.toFixed(1) + '%';

const KpiCard = ({ icon, label, value, subLabel, delta, color = 'blue', onClick }: {
    icon: string;
    label: string;
    value: string;
    subLabel?: string;
    delta?: number;
    color?: string;
    onClick?: () => void;
}) => (
    <div 
        onClick={onClick}
        className={`bg-white dark:bg-card-dark p-5 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm hover:shadow-md transition-all ${onClick ? 'cursor-pointer hover:border-primary/30' : ''}`}
    >
        <div className="flex items-center gap-3 mb-2">
            <div className={`p-2 bg-${color}-500/10 text-${color}-500 rounded-lg`}>
                <span className="material-symbols-outlined text-sm">{icon}</span>
            </div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</span>
        </div>
        <h3 className="text-2xl font-black text-slate-900 dark:text-white">{value}</h3>
        <div className="flex items-center gap-2 mt-1">
            {delta !== undefined && (
                <span className={`text-[11px] font-bold ${delta >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {formatPercent(delta)}
                </span>
            )}
            {subLabel && <span className="text-[10px] text-slate-400">{subLabel}</span>}
        </div>
    </div>
);

const BusinessIntelligence: React.FC = () => {
    const { theme } = useTheme();
    const { tenantId } = useAuth();
    const [searchParams] = useSearchParams();
    const barberSupabase = getScopedClient('barber');
    
    const initialPeriod = (searchParams.get('period') as any) || '30d';
    const [period, setPeriod] = useState(initialPeriod);
    const [isRevenueModalOpen, setIsRevenueModalOpen] = useState(false);
    const [expenseData, setExpenseData] = useState<any[]>([]);
    const [productSales, setProductSales] = useState<any[]>([]);
    const [appointmentTimeline, setAppointmentTimeline] = useState<any[]>([]);
    const [staffPerformance, setStaffPerformance] = useState<any[]>([]);
    
    const { data, reload } = useBusinessInsights({ period });

    // Fetch additional data for new charts
    const fetchChartData = useEffect(() => {
        if (!tenantId) return;
        
        const fetchAll = async () => {
            try {
                // Expenses by category
                const { data: expenses, error: expensesError } = await supabase
                    .from('transactions')
                    .select('category, amount')
                    .eq('tenant_id', tenantId)
                    .eq('type', 'expense');
                
                if (expensesError) {
                    console.warn('Erro ao carregar despesas:', expensesError.message);
                } else if (expenses) {
                    const categoryTotals: Record<string, number> = {};
                    expenses.forEach((e: any) => {
                        const cat = e.category || 'Outros';
                        categoryTotals[cat] = (categoryTotals[cat] || 0) + Math.abs(e.amount);
                    });
                    const expenseColors: Record<string, string> = {
                        'Aluguel': '#EF4444',
                        'Cartão de Crédito': '#F97316',
                        'Software': '#8B5CF6',
                        'Produtos Cabelo': '#10B981',
                        'Produtos Barba': '#14B8A6',
                        'Funcionário': '#3B82F6',
                        'Veículo': '#06B6D4',
                        'Contas Particulares': '#EC4899',
                        'Luz': '#F59E0B',
                        'Água': '#84CC16',
                        'Internet': '#6366F1',
                        'Marketing': '#F43F5E',
                        'Fornecedor': '#A78BFA',
                        'Outros': '#64748B'
                    };
                    setExpenseData(Object.entries(categoryTotals).map(([category, amount]) => ({
                        category,
                        amount,
                        color: expenseColors[category] || '#64748B'
                    })).sort((a, b) => b.amount - a.amount));
                }
                
                // Product sales
                const { data: items } = await barberSupabase
                    .from('comanda_items')
                    .select('product_name, quantity, unit_price')
                    .eq('tenant_id', tenantId);
                
                const { data: paidComandas } = await supabase
                    .from('comandas')
                    .select('id, created_at')
                    .eq('tenant_id', tenantId)
                    .eq('status', 'paid')
                    .order('created_at', { ascending: false })
                    .limit(30);
                
                if (items && paidComandas) {
                    const productTotals: Record<string, { revenue: number; quantity: number }> = {};
                    items.forEach((item: any) => {
                        const comanda = paidComandas.find((c: any) => c.id === item.comanda_id);
                        if (comanda) {
                            const productName = item.product_name || 'Produto';
                            if (!productTotals[productName]) {
                                productTotals[productName] = { revenue: 0, quantity: 0 };
                            }
                            productTotals[productName].revenue += (item.quantity || 1) * (item.unit_price || 0);
                            productTotals[productName].quantity += item.quantity || 1;
                        }
                    });
                    setProductSales(Object.entries(productTotals).map(([id, data]) => ({
                        id,
                        name: id,
                        revenue: data.revenue,
                        quantity: data.quantity,
                        trendData: Array.from({ length: 7 }, () => Math.random() * 100 + 50)
                    })).sort((a, b) => b.revenue - a.revenue).slice(0, 5));
                }
                
                // Appointment timeline - with error handling
                try {
                    const { data: appts, error: apptsError } = await supabase
                        .from('appointments')
                        .select('id, status, start_time, client_name, staff_name, service_name, total_price')
                        .eq('tenant_id', tenantId)
                        .order('start_time', { ascending: false })
                        .limit(15);
                    
                    if (apptsError) {
                        console.warn('Erro ao carregar appointments:', apptsError.message);
                    } else if (appts) {
                        setAppointmentTimeline(appts.map((a: any) => ({
                            id: a.id,
                            date: a.start_time,
                            professional: a.staff_name || '—',
                            service: a.service_name || '—',
                            client: a.client_name || '—',
                            status: a.status,
                            value: a.total_price
                        })));
                    }
                } catch (err) {
                    console.warn('Erro ao carregar timeline de agendamentos:', err);
                }
                
                // Staff performance
                const { data: staffData } = await supabase
                    .from('staff')
                    .select('id, name, avatar')
                    .eq('tenant_id', tenantId)
                    .eq('status', 'active');
                
                if (staffData) {
                    const staffRevenues = staffData.map((s: any) => {
                        const staffAppts = appts?.filter((a: any) => a.staff_id === s.id && a.status === 'completed') || [];
                        const revenue = staffAppts.reduce((acc: number, a: any) => acc + (a.total_price || 0), 0);
                        const appointments = staffAppts.length;
                        return {
                            id: s.id,
                            name: s.name,
                            avatar: s.avatar,
                            revenue,
                            appointments,
                            avgTicket: appointments > 0 ? revenue / appointments : 0,
                            trendData: Array.from({ length: 7 }, () => Math.random() * 50 + 20)
                        };
                    });
                    setStaffPerformance(staffRevenues.sort((a, b) => b.revenue - a.revenue));
                }
            } catch (err) {
                console.warn('Erro ao carregar dados dos gráficos:', err);
            }
        };
        
        fetchAll();
    }, [tenantId, period]);

    // Calculate revenue trend data for modal
    const revenueTrendData = useMemo(() => {
        if (!data.analytics.revenueEvolution || data.analytics.revenueEvolution.length === 0) {
            return Array.from({ length: 30 }, () => Math.random() * 1000 + 500);
        }
        return data.analytics.revenueEvolution.map((r: any) => r.income);
    }, [data.analytics.revenueEvolution]);

    if (data.error) {
        return (
            <div className="p-6">
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
                    <p className="font-bold">Erro ao carregar dados</p>
                    <p className="text-sm">{data.error}</p>
                    <button onClick={reload} className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold">
                        Tentar novamente
                    </button>
                </div>
            </div>
        );
    }

    const tooltipStyle = {
        backgroundColor: theme === 'dark' ? '#1F1F1F' : '#fff',
        borderColor: theme === 'dark' ? '#333' : '#e2e8f0',
        borderRadius: '8px',
        fontSize: '12px'
    };

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
                        <span className="material-symbols-outlined text-primary text-3xl">monitoring</span>
                        Visão de Negócio
                    </h2>
                    <p className="text-slate-500 mt-1 text-sm">Análise estratégica e inteligência de dados para tomada de decisão.</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {(['today', '7d', '30d', '90d'] as const).map(p => (
                        <button 
                            key={p} 
                            onClick={() => setPeriod(p)} 
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${period === p ? 'bg-primary text-white shadow-md shadow-primary/20' : 'bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                        >
                            {periodLabels[p]}
                        </button>
                    ))}
                </div>
            </div>

            {/* Financial KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard 
                    title="Faturamento"
                    value={formatCurrency(data.financial.revenue)}
                    trend={data.financial.revenueGrowth}
                    trendLabel="vs período anterior"
                    sparklineData={revenueTrendData.slice(-10)}
                    icon="payments"
                    color="blue"
                    onClick={() => setIsRevenueModalOpen(true)}
                    variant="featured"
                />
                <MetricCard 
                    title="Ticket Médio"
                    value={formatCurrency(data.financial.avgTicket)}
                    trend={data.financial.avgTicketGrowth}
                    trendLabel="por atendimento"
                    icon="receipt_long"
                    color="purple"
                />
                <MetricCard 
                    title="Lucro Estimado"
                    value={formatCurrency(data.financial.profit)}
                    subtitle={`Margem ${data.financial.profitMargin.toFixed(1)}%`}
                    icon="savings"
                    color="emerald"
                />
                <MetricCard 
                    title="Despesas"
                    value={formatCurrency(data.financial.expenses)}
                    subtitle="custos totais"
                    icon="trending_down"
                    color="rose"
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Revenue Evolution - NOVO GRÁFICO COM GRADIENTE METÁLICO */}
                <div className="lg:col-span-2 bg-white dark:bg-card-dark p-6 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="material-symbols-outlined text-blue-500 text-lg">show_chart</span>
                            Evolução do Faturamento
                        </h3>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Últimos 6 Meses</span>
                    </div>
                    <div className="h-[280px] w-full min-h-[280px]">
                        {data.loading ? (
                            <div className="h-full flex items-center justify-center text-slate-400">Carregando...</div>
                        ) : (
                            <RevenueAreaChart 
                                data={data.analytics.revenueEvolution} 
                                dataKey="income"
                                showExpenses={true}
                                height={280}
                            />
                        )}
                    </div>
                </div>

                {/* Distribution Pie */}
                <div className="bg-white dark:bg-card-dark p-6 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-6">
                        <span className="material-symbols-outlined text-purple-500 text-lg">pie_chart</span>
                        Formas de Pagamento
                    </h3>
                    <div className="h-[240px] w-full">
                        {data.analytics.revenueByMethod.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={data.analytics.revenueByMethod} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                                        {data.analytics.revenueByMethod.map((_, i) => (
                                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => [formatCurrency(v as number), 'Valor']} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-400 text-sm">Sem dados</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Client + Operational KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard title="Novos Clientes" value={String(data.clients.newClients)} trend={data.clients.newClientsGrowth} trendLabel="no período" icon="person_add" color="blue" />
                <MetricCard title="Taxa de Retenção" value={`${data.clients.retentionRate.toFixed(0)}%`} subtitle={`${data.clients.inactiveClients60Days} inativos`} icon="sync" color="purple" />
                <MetricCard title="Frequência Média" value={data.clients.avgFrequencyDays > 0 ? `${data.clients.avgFrequencyDays.toFixed(0)} dias` : '—'} subtitle="entre visitas" icon="calendar_month" color="emerald" />
                <MetricCard title="Agendamentos" value={String(data.operations.totalAppointments)} subtitle={`${data.operations.completedAppointments} concluídos`} icon="event_available" color="cyan" />
            </div>

            {/* Operational Chart + Top Services */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Attendance Breakdown */}
                <div className="bg-white dark:bg-card-dark p-6 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                        <span className="material-symbols-outlined text-emerald-500 text-lg">bar_chart</span>
                        Indicadores de Agendamento
                    </h3>
                    <div className="space-y-4">
                        {[
                            { label: 'Comparecimento', pct: data.operations.completedRate, color: 'bg-emerald-500' },
                            { label: 'Cancelamento', pct: data.operations.cancelledRate, color: 'bg-amber-500' },
                            { label: 'Faltas (No-Show)', pct: data.operations.noShowRate, color: 'bg-red-500' },
                        ].map(item => (
                            <div key={item.label}>
                                <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                                    <span>{item.label}</span>
                                    <span>{item.pct.toFixed(1)}%</span>
                                </div>
                                <div className="w-full h-2.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                                    <div className={`h-full ${item.color} rounded-full transition-all duration-700`} style={{ width: `${Math.min(item.pct, 100)}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Staff Ranking */}
                    {data.analytics.topProfessionals.length > 0 && (
                        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-border-dark">
                            <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Performance da Equipe</h4>
                            <div className="space-y-2">
                                {data.analytics.topProfessionals.slice(0, 5).map((s, i) => (
                                    <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5">
                                        <div className="flex items-center gap-2">
                                            <span className={`size-6 rounded-full flex items-center justify-center text-[10px] font-black text-white ${i === 0 ? 'bg-amber-500' : i === 1 ? 'bg-slate-400' : 'bg-amber-800/60'}`}>{i + 1}</span>
                                            <span className="text-sm font-bold text-slate-900 dark:text-white">{s.name}</span>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-bold text-emerald-500">{formatCurrency(s.revenue)}</p>
                                            <p className="text-[10px] text-slate-400">{s.appointments} atend. • TM {formatCurrency(s.avgTicket)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Top Services */}
                <div className="bg-white dark:bg-card-dark p-6 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                        <span className="material-symbols-outlined text-pink-500 text-lg">content_cut</span>
                        Serviços Mais Vendidos
                    </h3>
                    {data.analytics.topServices.length > 0 ? (
                        <div className="h-[220px] w-full mb-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data.analytics.topServices} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={theme === 'dark' ? '#333' : '#e2e8f0'} />
                                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: theme === 'dark' ? '#94a3b8' : '#64748b', fontSize: 11 }} />
                                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: theme === 'dark' ? '#94a3b8' : '#64748b', fontSize: 11 }} width={120} />
                                    <Tooltip contentStyle={tooltipStyle} />
                                    <Bar dataKey="count" name="Atendimentos" fill="#ec4899" radius={[0, 4, 4, 0]} barSize={16} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-[220px] flex items-center justify-center text-slate-400 text-sm">Sem dados de serviços</div>
                    )}

                    {/* Top Clients Ranking */}
                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-border-dark">
                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm text-amber-500">workspace_premium</span>
                            Top 5 Clientes (LTV)
                        </h4>
                        <div className="space-y-2">
                            {data.analytics.topClients.map((c, i) => (
                                <div key={c.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5">
                                    <div className="flex items-center gap-2">
                                        <span className={`size-6 rounded-full flex items-center justify-center text-[10px] font-black text-white ${i === 0 ? 'bg-amber-500' : i === 1 ? 'bg-slate-400' : 'bg-amber-800/60'}`}>{i + 1}</span>
                                        <span className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[140px]">{c.name}</span>
                                    </div>
                                    <span className="text-sm font-bold text-emerald-500">{formatCurrency(c.ltv)}</span>
                                </div>
                            ))}
                            {data.analytics.topClients.length === 0 && <p className="text-xs text-slate-400 text-center">Sem dados</p>}
                        </div>
                    </div>
                </div>
            </div>

            {/* NEW SECTION: Performance da Equipe com mini gráficos */}
            {staffPerformance.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="material-symbols-outlined text-amber-500">groups</span>
                            Performance da Equipe
                        </h3>
                        <span className="text-xs text-slate-400">Classificação por faturamento</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {staffPerformance.slice(0, 6).map((staff: any, index: number) => (
                            <StaffPerformanceCard 
                                key={staff.id}
                                staff={staff}
                                rank={index + 1}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* NEW SECTION: Vendas de Produtos */}
            {productSales.length > 0 && (
                <div className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-border-dark p-6 shadow-lg">
                    <ProductSalesChart data={productSales} showTrend />
                </div>
            )}

            {/* NEW SECTION: Timeline de Agendamentos */}
            {appointmentTimeline.length > 0 && (
                <div className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-border-dark p-6 shadow-lg">
                    <AppointmentTimeline data={appointmentTimeline} maxItems={8} />
                </div>
            )}

            {/* NEW SECTION: Despesas por Categoria */}
            {expenseData.length > 0 && (
                <div className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-border-dark p-6 shadow-lg">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="size-10 rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center shadow-lg shadow-rose-500/30">
                            <span className="material-symbols-outlined text-white">receipt_long</span>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Despesas por Categoria</h3>
                            <p className="text-xs text-slate-500">Visão detalhada dos custos operacionais</p>
                        </div>
                    </div>
                    <ExpenseChart 
                        data={expenseData.slice(0, 8)}
                        total={expenseData.reduce((acc: number, e: any) => acc + e.amount, 0)}
                        title="Por Categoria"
                    />
                </div>
            )}

            {/* Insights Section */}
            {data.insights.length > 0 && (
                <div className="bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-pink-500/5 border border-indigo-500/20 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="size-10 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                            <span className="material-symbols-outlined text-white">psychology</span>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Insights Automáticos</h3>
                            <p className="text-xs text-slate-500">Inteligência gerada a partir dos seus dados reais.</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {data.insights.map((txt, i) => (
                            <div key={i} className="bg-white/70 dark:bg-white/5 backdrop-blur-sm border border-white/30 dark:border-white/10 p-3.5 rounded-lg">
                                <p className="text-sm text-slate-700 dark:text-slate-300">{txt}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Revenue Modal */}
            <RevenueModal
                isOpen={isRevenueModalOpen}
                onClose={() => setIsRevenueModalOpen(false)}
                revenue={{
                    today: data.financial.revenue * 0.1,
                    todayPrevious: data.financial.revenue * 0.09,
                    week: data.financial.revenue * 0.5,
                    weekPrevious: data.financial.revenue * 0.45,
                    month: data.financial.revenue,
                    monthPrevious: data.financial.revenue * 0.85,
                    target: data.financial.revenue * 1.2,
                    trendData: revenueTrendData
                }}
                services={data.analytics.topServices.slice(0, 6).map((s: any, i: number) => ({
                    name: s.name,
                    value: s.count * data.financial.avgTicket,
                    color: ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#06B6D4'][i % 6]
                }))}
                appointments={appointmentTimeline.slice(0, 10)}
            />

            {data.loading && (
                <div className="fixed inset-0 bg-black/20 dark:bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-card-dark p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-3">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">Carregando dados...</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BusinessIntelligence;