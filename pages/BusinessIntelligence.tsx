import React, { useState, useEffect } from 'react';
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

const COLORS = ['#D99A2B', '#A96F14', '#178A50', '#F3D9A4', '#C92A2A', '#F7E7C2', '#E8DFC9', '#6B6252'];

const periodLabels = {
    today: 'Hoje',
    '7d': '7 Dias',
    '30d': '30 Dias',
    '90d': '90 Dias',
    custom: 'Personalizado'
};

const BusinessIntelligence: React.FC = () => {
    const { theme } = useTheme();
    const { tenantId } = useAuth();
    const [searchParams] = useSearchParams();
    const barberSupabase = getScopedClient('barber');
    
    const initialPeriod = (searchParams.get('period') as any) || '30d';
    const [period, setPeriod] = useState(initialPeriod);
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
    
    const { data, reload } = useBusinessInsights({ period });

    // Fetch additional data for new charts
    useEffect(() => {
        if (!tenantId) return;

        const fetchAll = async () => {
            try {
                const transactionsClient = getClientForTable('transactions', 'barber');
                const appointmentsClient = getClientForTable('appointments', 'barber');

                // Expenses by category - with error handling
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
                        const expenseColors: Record<string, string> = {
                            'Aluguel': '#C92A2A',
                            'Cartão de Crédito': '#D99A2B',
                            'Software': '#A96F14',
                            'Produtos Cabelo': '#178A50',
                            'Produtos Barba': '#14B8A6',
                            'Funcionário': '#D99A2B',
                            'Veículo': '#F3D9A4',
                            'Contas Particulares': '#6B6252',
                            'Luz': '#F59E0B',
                            'Água': '#84CC16',
                            'Internet': '#F7E7C2',
                            'Marketing': '#B88A44',
                            'Fornecedor': '#E8DFC9',
                            'Outros': '#6B6252'
                        };
                        setExpenseData(Object.entries(categoryTotals).map(([category, amount]) => ({
                            category,
                            amount,
                            color: expenseColors[category] || '#64748B'
                        })).sort((a: any, b: any) => b.amount - a.amount));
                    } else {
                        setExpenseData([]);
                    }
                } catch (err) {
                    console.warn('Erro ao carregar despesas:', err);
                    setExpenseData([]);
                }
                
                // Product sales - with error handling
                try {
                    const { data: items } = await barberSupabase
                        .from('comanda_items')
                        .select('product_name, quantity, unit_price, comanda_id')
                        .eq('tenant_id', tenantId);

                    const comandasClient = getClientForTable('comandas', 'barber');
                    const { data: paidComandas } = await comandasClient
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
                        setProductSales(Object.entries(productTotals).map(([id, data]: [string, any]) => ({
                            id,
                            name: id,
                            revenue: data.revenue,
                            quantity: data.quantity,
                            trendData: []
                        })).sort((a: any, b: any) => b.revenue - a.revenue).slice(0, 5));
                    } else {
                        setProductSales([]);
                    }
                } catch (err) {
                    console.warn('Erro ao carregar vendas de produtos:', err);
                    setProductSales([]);
                }
                
                // Appointment timeline and Staff performance - with error handling
                let allAppointments: any[] = [];
                try {
                    const { data: appts } = await appointmentsClient
                        .from('appointments')
                        .select('id, status, start_time, client_name, staff_id, staff_name, service_name')
                        .eq('tenant_id', tenantId)
                        .order('start_time', { ascending: false })
                        .limit(15);
                    
                    allAppointments = appts || [];
                    
                    if (allAppointments.length > 0) {
                        setAppointmentTimeline(allAppointments.map((a: any) => ({
                            id: a.id,
                            date: a.start_time,
                            professional: a.staff_name || 'Profissional não informado',
                            service: a.service_name || 'Serviço não informado',
                            client: a.client_name || 'Cliente não informado',
                            status: a.status === 'no-show' ? 'no_show' : a.status,
                        })));
                    } else {
                        setAppointmentTimeline([]);
                    }
                } catch (err) {
                    console.warn('Erro ao carregar appointments:', err);
                    setAppointmentTimeline([]);
                }
                // Cancellation Analysis - with error handling
                try {
                    const { data: cancelledAppts } = await supabase
                        .from('appointments')
                        .select('id, status, start_time, cancellation_reason, client_name, staff_name')
                        .eq('tenant_id', tenantId)
                        .in('status', ['cancelled', 'no_show'])
                        .order('start_time', { ascending: false })
                        .limit(500);
                    
                    if (cancelledAppts && cancelledAppts.length > 0) {
                        // Group by reason
                        const reasonMap: Record<string, { count: number; label: string }> = {
                            'client_request': { count: 0, label: 'Solicitação do cliente' },
                            'no_show': { count: 0, label: 'Não compareceu' },
                            'error_registration': { count: 0, label: 'Erro de cadastro' },
                            'reschedule': { count: 0, label: 'Reagendamento' },
                            'other': { count: 0, label: 'Outro motivo' },
                        };
                        
                        cancelledAppts.forEach((apt: any) => {
                            const reason = apt.cancellation_reason || (apt.status === 'no_show' ? 'no_show' : 'other');
                            if (reasonMap[reason]) {
                                reasonMap[reason].count++;
                            } else {
                                reasonMap['other']!.count++;
                            }
                        });
                        
                        const total = cancelledAppts.length;
                        const byReason = Object.entries(reasonMap)
                            .filter(([_, data]) => data.count > 0)
                            .map(([reason, data]) => ({
                                reason,
                                label: data.label,
                                count: data.count,
                                percentage: (data.count / total) * 100,
                            }))
                            .sort((a, b) => b.count - a.count);
                        
                        // Timeline of cancellations (last 7 days)
                        const timelineMap: Record<string, number> = {};
                        for (let i = 6; i >= 0; i--) {
                            const d = new Date();
                            d.setDate(d.getDate() - i);
                            const key = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
                            timelineMap[key] = 0;
                        }
                        
                        cancelledAppts.forEach((apt: any) => {
                            const d = new Date(apt.start_time);
                            const key = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
                            if (timelineMap[key] !== undefined) {
                                timelineMap[key]++;
                            }
                        });
                        
                        setCancellationData({
                            byReason,
                            total,
                            recoveryRate: 0,
                            recoveryAttempts: 0,
                            recovered: 0,
                            timeline: Object.entries(timelineMap).map(([date, count]) => ({ date, count })),
                        });
                    } else {
                        setCancellationData({
                            byReason: [],
                            total: 0,
                            recoveryRate: 0,
                            recoveryAttempts: 0,
                            recovered: 0,
                            timeline: [],
                        });
                    }
                } catch (err) {
                    console.warn('Erro ao carregar dados de cancelamento:', err);
                }
            } catch (err) {
                console.warn('Erro ao carregar dados dos gráficos:', err);
            }
        };
        
        fetchAll();
    }, [tenantId, period]);

    if (data.error) {
        return (
            <div className="p-6">
                <div className="bg-[#FEF2F2] border border-[#FECACA] text-[#C92A2A] p-4 rounded-lg">
                    <p className="font-bold">Erro ao carregar dados</p>
                    <p className="text-sm">{data.error}</p>
                    <button onClick={reload} className="mt-2 px-4 py-2 bg-[#C92A2A] text-white rounded-lg text-sm font-bold">
                        Tentar novamente
                    </button>
                </div>
            </div>
        );
    }

    const tooltipStyle = {
        backgroundColor: '#fff',
        borderColor: '#E8DFC9',
        borderRadius: '8px',
        fontSize: '12px',
        color: '#191611'
    };

    return (
        <div className="min-h-screen bg-cream space-y-6 animate-fade-in pb-10">
            {/* Header */}
            <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-3xl">
                        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-gold-soft px-3 py-1 text-[11px] font-bold text-gold-deep">
                            <span className="material-symbols-outlined text-sm">monitoring</span>
                            SMG BI OPERACIONAL
                        </div>
                        <h2 className="text-2xl font-black text-ink md:text-3xl">
                            Visão do Negócio
                        </h2>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">
                            Receita, custos, equipe, produtos e agenda em uma leitura real da barbearia para dono e gerente decidirem sem ruído.
                        </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap rounded-xl border border-line bg-white p-1 shadow-sm">
                    {(['today', '7d', '30d', '90d'] as const).map(p => (
                        <button 
                            key={p} 
                            onClick={() => setPeriod(p)} 
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${period === p ? 'bg-gold text-night shadow-md' : 'text-ink-soft bg-white hover:bg-gold-pale hover:text-ink border border-line'}`}
                        >
                            {periodLabels[p]}
                        </button>
                    ))}
                    </div>
                </div>
            </div>

            {/* Financial KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard
                    label="Faturamento"
                    value={formatCurrency(data.financial.revenue)}
                    trend={{
                        direction: data.financial.revenueGrowth > 0 ? 'up' : data.financial.revenueGrowth < 0 ? 'down' : 'flat',
                        label: `${data.financial.revenueGrowth >= 0 ? '+' : ''}${data.financial.revenueGrowth.toFixed(1)}%`,
                    }}
                    helper="vs período anterior"
                    icon="payments"
                    tone="info"
                    density="comfortable"
                />
                <MetricCard
                    label="Ticket Médio"
                    value={formatCurrency(data.financial.avgTicket)}
                    trend={{
                        direction: data.financial.avgTicketGrowth > 0 ? 'up' : data.financial.avgTicketGrowth < 0 ? 'down' : 'flat',
                        label: `${data.financial.avgTicketGrowth >= 0 ? '+' : ''}${data.financial.avgTicketGrowth.toFixed(1)}%`,
                    }}
                    helper="por atendimento"
                    icon="receipt_long"
                    tone="info"
                    density="compact"
                />
                <MetricCard
                    label="Resultado"
                    value={formatCurrency(data.financial.profit)}
                    helper={`Margem ${data.financial.profitMargin.toFixed(1)}%`}
                    icon="savings"
                    tone={data.financial.profit >= 0 ? 'positive' : 'negative'}
                    density="compact"
                />
                <MetricCard
                    label="Despesas"
                    value={formatCurrency(data.financial.expenses)}
                    helper="custos totais"
                    icon="trending_down"
                    tone="warning"
                    density="compact"
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Revenue Evolution - NOVO GRÁFICO COM GRADIENTE METÁLICO */}
                <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-line shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-base font-bold text-ink flex items-center gap-2">
                            <span className="material-symbols-outlined text-gold-deep text-lg bg-gold-soft p-1.5 rounded-lg">show_chart</span>
                            Evolução do Faturamento
                        </h3>
                        <span className="text-[10px] font-bold text-ink-soft uppercase">Últimos 6 Meses</span>
                    </div>
                    <div className="h-[280px] w-full min-h-[280px]">
                        {data.loading ? (
                            <div className="h-full flex items-center justify-center text-ink-soft">Carregando...</div>
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
                <div className="bg-white p-6 rounded-xl border border-line shadow-sm">
                    <h3 className="text-base font-bold text-ink flex items-center gap-2 mb-6">
                        <span className="material-symbols-outlined text-gold-deep text-lg bg-gold-soft p-1.5 rounded-lg">pie_chart</span>
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
                            <div className="h-full flex items-center justify-center text-ink-soft text-sm">Sem dados</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Client + Operational KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard
                    label="Novos Clientes"
                    value={String(data.clients.newClients)}
                    trend={{
                        direction: data.clients.newClientsGrowth > 0 ? 'up' : data.clients.newClientsGrowth < 0 ? 'down' : 'flat',
                        label: `${data.clients.newClientsGrowth >= 0 ? '+' : ''}${data.clients.newClientsGrowth.toFixed(1)}%`,
                    }}
                    helper="no período"
                    icon="person_add"
                    tone="info"
                    density="compact"
                />
                <MetricCard label="Taxa de Retenção" value={`${data.clients.retentionRate.toFixed(0)}%`} helper={`${data.clients.inactiveClients60Days} inativos`} icon="sync" tone="info" density="compact" />
                <MetricCard label="Frequência Média" value={data.clients.avgFrequencyDays > 0 ? `${data.clients.avgFrequencyDays.toFixed(0)} dias` : 'Sem histórico'} helper="entre visitas" icon="calendar_month" tone="positive" density="compact" />
                <MetricCard label="Agendamentos" value={String(data.operations.totalAppointments)} helper={`${data.operations.completedAppointments} concluídos`} icon="event_available" tone="info" density="compact" />
            </div>

            {/* Operational Chart + Top Services */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Attendance Breakdown */}
                <div className="bg-white p-6 rounded-xl border border-line shadow-sm">
                    <h3 className="text-base font-bold text-ink flex items-center gap-2 mb-4">
                        <span className="material-symbols-outlined text-[#178A50] text-lg bg-[#F0FDF4] p-1.5 rounded-lg">bar_chart</span>
                        Indicadores de Agendamento
                    </h3>
                    <div className="space-y-4">
                        {[
                            { label: 'Comparecimento', pct: data.operations.completedRate, color: 'bg-[#178A50]' },
                            { label: 'Cancelamento', pct: data.operations.cancelledRate, color: 'bg-[#D99A2B]' },
                            { label: 'Faltas (No-Show)', pct: data.operations.noShowRate, color: 'bg-[#C92A2A]' },
                        ].map(item => (
                            <div key={item.label}>
                                <div className="flex justify-between text-xs font-bold text-ink-soft mb-1">
                                    <span>{item.label}</span>
                                    <span>{item.pct.toFixed(1)}%</span>
                                </div>
                                <div className="w-full h-2.5 bg-[#F7E7C2] rounded-full overflow-hidden">
                                    <div className={`h-full ${item.color} rounded-full transition-all duration-700`} style={{ width: `${Math.min(item.pct, 100)}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Staff Ranking */}
                    {data.analytics.topProfessionals.length > 0 && (
                        <div className="mt-6 pt-4 border-t border-line">
                            <h4 className="text-xs font-bold text-ink-soft uppercase mb-3">Performance da Equipe</h4>
                            <div className="space-y-2">
                                {data.analytics.topProfessionals.slice(0, 5).map((s, i) => (
                                    <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-gold-pale">
                                        <div className="flex items-center gap-2">
                                            <span className={`size-6 rounded-full flex items-center justify-center text-[10px] font-black text-white ${i === 0 ? 'bg-[#D99A2B]' : i === 1 ? 'bg-[#E8DFC9]' : 'bg-[#A96F14]'}`}>{i + 1}</span>
                                            <span className="text-sm font-bold text-ink">{s.name}</span>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-bold text-[#178A50]">{formatCurrency(s.revenue)}</p>
                                            <p className="text-[10px] text-ink-soft">{s.appointments} atend. • TM {formatCurrency(s.avgTicket)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Top Services */}
                <div className="bg-white p-6 rounded-xl border border-line shadow-sm">
                    <h3 className="text-base font-bold text-ink flex items-center gap-2 mb-4">
                        <span className="material-symbols-outlined text-gold-deep text-lg bg-gold-soft p-1.5 rounded-lg">content_cut</span>
                        Serviços Mais Vendidos
                    </h3>
                    {data.analytics.topServices.length > 0 ? (
                        <div className="h-[220px] w-full mb-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data.analytics.topServices} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E8DFC9" />
                                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: "#6B6252", fontSize: 11 }} />
                                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#6B6252", fontSize: 11 }} width={120} />
                                    <Tooltip contentStyle={tooltipStyle} />
                                    <Bar dataKey="count" name="Atendimentos" fill="#D99A2B" radius={[0, 4, 4, 0]} barSize={16} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-[220px] flex items-center justify-center text-ink-soft text-sm">Sem dados de serviços</div>
                    )}

                    {/* Top Clients Ranking */}
                    <div className="mt-4 pt-4 border-t border-line">
                        <h4 className="text-xs font-bold text-ink-soft uppercase mb-3 flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm text-gold-deep">workspace_premium</span>
                            Top 5 Clientes (LTV)
                        </h4>
                        <div className="space-y-2">
                            {data.analytics.topClients.map((c, i) => (
                                <div key={c.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gold-pale">
                                    <div className="flex items-center gap-2">
                                        <span className={`size-6 rounded-full flex items-center justify-center text-[10px] font-black text-white ${i === 0 ? 'bg-[#D99A2B]' : i === 1 ? 'bg-[#E8DFC9]' : 'bg-[#A96F14]'}`}>{i + 1}</span>
                                        <span className="text-sm font-bold text-ink truncate max-w-[140px]">{c.name}</span>
                                    </div>
                                    <span className="text-sm font-bold text-[#178A50]">{formatCurrency(c.ltv)}</span>
                                </div>
                            ))}
                            {data.analytics.topClients.length === 0 && <p className="text-xs text-ink-soft text-center">Sem dados</p>}
                        </div>
                    </div>
                </div>
            </div>

            {/* NEW SECTION: Performance da Equipe com mini gráficos */}
            {data.analytics.topProfessionals.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                            <span className="material-symbols-outlined text-gold-deep bg-gold-soft p-1.5 rounded-lg">groups</span>
                            Performance da Equipe
                        </h3>
                        <span className="text-xs text-ink-soft">Comandas pagas e atendimentos concluídos</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {data.analytics.topProfessionals.slice(0, 6).map((staff: any, index: number) => (
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
                <div className="bg-white rounded-2xl border border-line p-6 shadow-lg">
                    <ProductSalesChart data={productSales} showTrend />
                </div>
            )}

            {/* NEW SECTION: Timeline de Agendamentos */}
            {appointmentTimeline.length > 0 && (
                <div className="bg-white rounded-2xl border border-line p-6 shadow-lg">
                    <AppointmentTimeline data={appointmentTimeline} maxItems={8} />
                </div>
            )}

            {/* NEW SECTION: Despesas por Categoria */}
            {expenseData.length > 0 && (
                <div className="bg-white rounded-2xl border border-line p-6 shadow-lg">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="size-10 rounded-xl bg-[#FEF2F2] border border-[#FECACA] flex items-center justify-center text-[#C92A2A]">
                            <span className="material-symbols-outlined">receipt_long</span>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-ink">Despesas por Categoria</h3>
                            <p className="text-xs text-ink-soft">Visão detalhada dos custos operacionais</p>
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
                <div className="rounded-xl border border-line bg-white p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="size-10 rounded-xl bg-gold-soft border border-primary-light/40 flex items-center justify-center text-gold-deep">
                            <span className="material-symbols-outlined">psychology</span>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-ink">Insights Automáticos</h3>
                            <p className="text-xs text-ink-soft">Inteligência gerada a partir dos seus dados reais.</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {data.insights.map((txt, i) => (
                            <div key={i} className="bg-gold-pale border border-line p-3.5 rounded-lg">
                                <p className="text-sm text-ink">{txt}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Cancellation Analysis Section */}
            {cancellationData.total > 0 && (
                <div className="bg-white rounded-2xl border border-line p-6 shadow-lg">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="size-10 rounded-xl bg-[#FEF2F2] border border-[#FECACA] flex items-center justify-center text-[#C92A2A]">
                            <span className="material-symbols-outlined">event_busy</span>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-ink">Análise de Cancelamentos</h3>
                            <p className="text-xs text-ink-soft">{cancellationData.total} agendamentos cancelados/no-show no período</p>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* By Reason Breakdown */}
                        <div>
                            <h4 className="text-sm font-bold text-ink-soft mb-4">Por Motivo</h4>
                            <div className="space-y-3">
                                {cancellationData.byReason.map((item) => {
                                    const reasonColors: Record<string, string> = {
                                        'no_show': 'bg-[#C92A2A]',
                                        'client_request': 'bg-[#D99A2B]',
                                        'error_registration': 'bg-[#6B6252]',
                                        'reschedule': 'bg-[#D99A2B]',
                                        'other': 'bg-[#E8DFC9]',
                                    };
                                    return (
                                        <div key={item.reason}>
                                            <div className="flex justify-between text-xs font-medium text-ink-soft mb-1">
                                                <span className="flex items-center gap-2">
                                                    <span className={`size-2 rounded-full ${reasonColors[item.reason] || 'bg-[#E8DFC9]'}`} />
                                                    {item.label}
                                                </span>
                                                <span>{item.count} ({item.percentage.toFixed(1)}%)</span>
                                            </div>
                                            <div className="w-full h-2 bg-[#F7E7C2] rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full ${reasonColors[item.reason] || 'bg-[#E8DFC9]'} rounded-full transition-all duration-700`}
                                                    style={{ width: `${item.percentage}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            
                            {/* Error registrations don't count for metrics */}
                            {cancellationData.byReason.find(r => r.reason === 'error_registration') && (
                                <div className="mt-4 p-3 bg-[#F7E7C2] border border-[#E8DFC9] rounded-lg">
                                    <p className="text-xs text-[#A96F14] flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm">info</span>
                                        Erros de cadastro não impactam métricas de cancelamento
                                    </p>
                                </div>
                            )}
                        </div>
                        
                        {/* Recovery Section */}
                        <div>
                            <h4 className="text-sm font-bold text-ink-soft mb-4">Recuperação de Clientes</h4>
                            
                            <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl p-4">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="size-10 rounded-full bg-[#178A50]/20 flex items-center justify-center">
                                        <svg viewBox="0 0 24 24" fill="#178A50" className="size-5">
                                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.559 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-[#178A50]">
                                            Tentar recuperar clientes
                                        </p>
                                        <p className="text-xs text-[#178A50]">
                                            {cancellationData.byReason.filter(r => ['no_show', 'client_request', 'other'].includes(r.reason)).reduce((sum, r) => sum + r.count, 0)} clientes podem ser recuperados
                                        </p>
                                    </div>
                                </div>
                                <p className="text-xs text-[#178A50] mb-3">
                                    Agendamentos cancelados por não comparecimento ou solicitação do cliente podem ser recuperados via WhatsApp com mensagem automática personalizada.
                                </p>
                                <button 
                                    onClick={() => window.location.href = '/schedule?filter=cancelled'}
                                    className="w-full px-4 py-2 rounded-lg bg-[#178A50] text-white text-sm font-bold hover:bg-[#157A45] transition-colors"
                                >
                                    Ver agendamentos cancelados
                                </button>
                            </div>
                            
                            {/* Top professionals with most cancellations */}
                            {cancellationData.byReason.length > 0 && cancellationData.total > 3 && (
                                <div className="mt-4 p-4 bg-gold-pale rounded-xl border border-line">
                                    <p className="text-xs font-bold text-ink-soft uppercase mb-2">Dica</p>
                                    <p className="text-sm text-ink">
                                        {cancellationData.byReason[0]?.reason === 'no_show' && (
                                            <>
                                                <span className="font-bold text-[#C92A2A]">{(cancellationData.byReason[0]?.percentage || 0).toFixed(0)}% das ausências</span>. Considere enviar lembretes 1 dia antes via WhatsApp para reduzir faltas.
                                            </>
                                        )}
                                        {cancellationData.byReason[0]?.reason === 'client_request' && (
                                            <>
                                                <span className="font-bold text-[#D99A2B]">{(cancellationData.byReason[0]?.percentage || 0).toFixed(0)}% por solicitação</span>. Pergunte o motivo para entender padrões e melhorar o serviço.
                                            </>
                                        )}
                                        {!['no_show', 'client_request'].includes(cancellationData.byReason[0]?.reason || '') && (
                                            <span>Acompanhe os motivos para identificar oportunidades de melhoria.</span>
                                        )}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {data.loading && (
                <div className="fixed inset-0 bg-[#0B0B0C]/20 flex items-center justify-center z-50">
                    <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-3">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gold"></div>
                        <p className="text-sm font-bold text-ink">Carregando dados...</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BusinessIntelligence;
