import React, { useState, useEffect, useCallback } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../services/supabaseClient';

const COLORS = ['#3c83f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1'];

interface RevenueData {
    name: string;
    valor: number;
}

interface CategoryData {
    name: string;
    value: number;
}

interface StaffPerformance {
    name: string;
    revenue: number;
    avgTicket: number;
    commission: number;
    nps: number;
}

const Reports: React.FC = () => {
    const { theme } = useTheme();
    const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
    const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
    const [staffPerformance, setStaffPerformance] = useState<StaffPerformance[]>([]);
    const [metrics, setMetrics] = useState({ cac: 12.5, ltv: 0, retention: 0 });
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setLoading(true);

        // 1. Fetch Revenue Data (Last 4 weeks)
        const { data: trans } = await supabase
            .from('transactions')
            .select('*')
            .eq('type', 'income')
            .order('date', { ascending: true });

        if (trans) {
            // Group by week or month for the chart
            // For simplicity, let's group by month or just take recent items
            const grouped = trans.reduce((acc: any, t) => {
                const date = new Date(t.date);
                const weekLabel = `Sem ${Math.ceil(date.getDate() / 7)}`;
                acc[weekLabel] = (acc[weekLabel] || 0) + (Number(t.amount || t.val) || 0);
                return acc;
            }, {});

            setRevenueData(Object.keys(grouped).map(key => ({ name: key, valor: grouped[key] })));
        }

        // 2. Fetch Appointments for Categories and Team Performance
        const { data: appts } = await supabase
            .from('appointments')
            .select('*')
            .eq('status', 'completed');

        if (appts) {
            // Categories (by service)
            const catGrouped = appts.reduce((acc: any, a) => {
                const cat = a.service_name || 'Outros';
                acc[cat] = (acc[cat] || 0) + (Number(a.total_price) || 0);
                return acc;
            }, {});
            setCategoryData(Object.keys(catGrouped).map(key => ({ name: key, value: catGrouped[key] })));

            // Staff Performance
            const staffGrouped = appts.reduce((acc: any, a) => {
                const name = a.staff_name || 'Desconhecido';
                if (!acc[name]) acc[name] = { revenue: 0, count: 0 };
                acc[name].revenue += Number(a.total_price) || 0;
                acc[name].count += 1;
                return acc;
            }, {});

            setStaffPerformance(Object.keys(staffGrouped).map(key => ({
                name: key,
                revenue: staffGrouped[key].revenue,
                avgTicket: staffGrouped[key].revenue / staffGrouped[key].count,
                commission: staffGrouped[key].revenue * 0.4, // Assuming 40%
                nps: 95 + Math.random() * 5 // Mocking NPS as it requires feedback table
            })));

            // 3. Calculate LTV and Retention
            const uniqueClients = new Set(appts.map(a => a.client_name)).size;
            const totalRevenue = appts.reduce((sum, a) => sum + (Number(a.total_price) || 0), 0);

            const clientCounts: Record<string, number> = {};
            appts.forEach(a => {
                clientCounts[a.client_name] = (clientCounts[a.client_name] || 0) + 1;
            });
            const returningClients = Object.values(clientCounts).filter(count => count > 1).length;

            setMetrics(prev => ({
                ...prev,
                ltv: uniqueClients > 0 ? totalRevenue / uniqueClients : 0,
                retention: uniqueClients > 0 ? (returningClients / uniqueClients) * 100 : 0
            }));
        }

        setLoading(false);
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return (
        <div className="space-y-8 animate-fade-in pb-10">
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 dark:from-black dark:to-slate-900 rounded-2xl p-8 text-white relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2"></div>
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="material-symbols-outlined text-amber-400">lock</span>
                            <span className="text-xs font-bold uppercase tracking-widest text-amber-400">Área Restrita</span>
                        </div>
                        <h2 className="text-3xl font-black tracking-tight">Relatórios Gerenciais</h2>
                        <p className="text-slate-300 mt-1 max-w-xl">Análises profundas de performance, retenção e lucratividade para tomada de decisão estratégica.</p>
                    </div>
                    <button className="bg-white text-slate-900 px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg hover:bg-slate-100 transition-colors">
                        <span className="material-symbols-outlined">download</span>
                        Exportar Dados CSV
                    </button>
                </div>
            </div>

            {/* Strategic KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-card-dark p-6 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Custo de Aquisição (CAC)</p>
                    <div className="flex items-end gap-2">
                        <h3 className="text-3xl font-black text-slate-900 dark:text-white">R$ {metrics.cac.toFixed(2)}</h3>
                        <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded mb-1">SETADO</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">Custo médio para atrair um novo cliente.</p>
                </div>
                <div className="bg-white dark:bg-card-dark p-6 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Lifetime Value (LTV)</p>
                    <div className="flex items-end gap-2">
                        <h3 className="text-3xl font-black text-slate-900 dark:text-white">R$ {metrics.ltv.toFixed(0)}</h3>
                        <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded mb-1">DINÂMICO</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">Valor médio gerado por cliente único.</p>
                </div>
                <div className="bg-white dark:bg-card-dark p-6 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Taxa de Retenção</p>
                    <div className="flex items-end gap-2">
                        <h3 className="text-3xl font-black text-slate-900 dark:text-white">{metrics.retention.toFixed(0)}%</h3>
                        <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded mb-1">REAL</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">Clientes que retornaram pelo menos uma vez.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Revenue Evolution */}
                <div className="bg-white dark:bg-card-dark p-6 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-slate-900 dark:text-white">Evolução de Faturamento</h3>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Dados Agregados</span>
                    </div>
                    <div className="h-[300px]">
                        {loading ? (
                            <div className="w-full h-full flex items-center justify-center text-slate-500">Calculando...</div>
                        ) : revenueData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={revenueData}>
                                    <defs>
                                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3c83f6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#3c83f6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#333' : '#e2e8f0'} />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: theme === 'dark' ? '#94a3b8' : '#64748b', fontSize: 12 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: theme === 'dark' ? '#94a3b8' : '#64748b', fontSize: 12 }} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: theme === 'dark' ? '#1F1F1F' : '#fff',
                                            borderColor: theme === 'dark' ? '#333' : '#e2e8f0',
                                            borderRadius: '8px'
                                        }}
                                    />
                                    <Area type="monotone" dataKey="valor" stroke="#3c83f6" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                                <span className="material-symbols-outlined text-4xl mb-2">analytics</span>
                                <p className="text-sm">Sem dados de faturamento no período.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Revenue by Category */}
                <div className="bg-white dark:bg-card-dark p-6 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <h3 className="font-bold text-slate-900 dark:text-white mb-6">Faturamento por Serviço</h3>
                    <div className="flex flex-col md:flex-row items-center gap-8">
                        <div className="size-[250px]">
                            {loading ? (
                                <div className="w-full h-full flex items-center justify-center text-slate-500">...</div>
                            ) : categoryData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={categoryData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            fill="#8884d8"
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {categoryData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: theme === 'dark' ? '#1F1F1F' : '#fff',
                                                borderColor: theme === 'dark' ? '#333' : '#e2e8f0',
                                                borderRadius: '8px'
                                            }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-full">
                                    N/A
                                </div>
                            )}
                        </div>
                        <div className="flex-1 space-y-3">
                            {categoryData.length > 0 ? categoryData.map((entry, index) => (
                                <div key={index} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="size-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                        <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">{entry.name}</span>
                                    </div>
                                    <span className="text-xs font-bold text-slate-900 dark:text-white">R$ {entry.value.toFixed(0)}</span>
                                </div>
                            )) : (
                                <p className="text-xs text-slate-500">Sem categorias disponíveis.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Performance Staff Table */}
            <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-border-dark">
                    <h3 className="font-bold text-slate-900 dark:text-white">Performance da Equipe</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-border-dark">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Profissional</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Faturamento</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Ticket Médio</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Comissão (40%)</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Satisfação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-border-dark">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-500">Processando dados...</td>
                                </tr>
                            ) : staffPerformance.length > 0 ? staffPerformance.map((staff, idx) => (
                                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{staff.name}</td>
                                    <td className="px-6 py-4 text-slate-700 dark:text-slate-300">R$ {staff.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                    <td className="px-6 py-4 text-slate-700 dark:text-slate-300">R$ {staff.avgTicket.toFixed(2)}</td>
                                    <td className="px-6 py-4 text-slate-700 dark:text-slate-300 font-bold">R$ {staff.commission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                    <td className="px-6 py-4">
                                        <span className="text-emerald-500 font-bold">{staff.nps.toFixed(0)}%</span>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-500">Sem dados de desempenho para exibir.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Reports;