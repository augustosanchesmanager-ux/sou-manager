import React, { useState, useEffect, useMemo } from 'react';
import {
    BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { useTheme } from '../context/ThemeContext';
import { useSearchParams } from 'react-router-dom';
import { useBusinessInsights } from '../src/hooks/useBusinessInsights';
import { useAuth } from '../context/AuthContext';
import { RevenueAreaChart } from '../components/charts';

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
    
    const initialPeriod = (searchParams.get('period') as any) || '30d';
    const [period, setPeriod] = useState(initialPeriod);
    
    const { data, reload } = useBusinessInsights({ period });

    const tooltipStyle = {
        backgroundColor: theme === 'dark' ? '#1F1F1F' : '#fff',
        borderColor: theme === 'dark' ? '#333' : '#e2e8f0',
        borderRadius: '8px',
        fontSize: '12px'
    };

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
                <KpiCard 
                    icon="payments" 
                    label="Faturamento" 
                    value={formatCurrency(data.financial.revenue)} 
                    delta={data.financial.revenueGrowth} 
                    subLabel="vs período anterior" 
                    color="blue" 
                />
                <KpiCard 
                    icon="receipt_long" 
                    label="Ticket Médio" 
                    value={formatCurrency(data.financial.avgTicket)} 
                    delta={data.financial.avgTicketGrowth} 
                    subLabel="por atendimento" 
                    color="purple" 
                />
                <KpiCard 
                    icon="savings" 
                    label="Lucro Estimado" 
                    value={formatCurrency(data.financial.profit)} 
                    subLabel={`Margem ${data.financial.profitMargin.toFixed(1)}%`} 
                    color="emerald" 
                />
                <KpiCard 
                    icon="trending_down" 
                    label="Despesas" 
                    value={formatCurrency(data.financial.expenses)} 
                    subLabel="custos totais" 
                    color="red" 
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
                <KpiCard icon="person_add" label="Novos Clientes" value={String(data.clients.newClients)} delta={data.clients.newClientsGrowth} subLabel="no período" color="blue" />
                <KpiCard icon="sync" label="Taxa de Retenção" value={`${data.clients.retentionRate.toFixed(0)}%`} subLabel={`${data.clients.inactiveClients60Days} inativos`} color="purple" />
                <KpiCard icon="calendar_month" label="Frequência Média" value={data.clients.avgFrequencyDays > 0 ? `${data.clients.avgFrequencyDays.toFixed(0)} dias` : '—'} subLabel="entre visitas" color="emerald" />
                <KpiCard icon="event_available" label="Agendamentos" value={String(data.operations.totalAppointments)} subLabel={`${data.operations.completedAppointments} concluídos`} color="blue" />
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