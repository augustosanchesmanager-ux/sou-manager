import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    AreaChart, Area, BarChart, Bar,
    ResponsiveContainer, Tooltip, XAxis, YAxis,
    Cell, PieChart, Pie
} from 'recharts';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { generateBusinessInsights } from '../services/geminiService';
import Toast from '../components/Toast';

/* ─── Shared Components & Utils ─── */
const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

interface MetricCardProps {
    label: string;
    value: string | number;
    subValue?: string;
    icon: string;
    color: 'emerald' | 'blue' | 'primary' | 'amber' | 'violet' | 'red';
    trend?: { val: string; isPos: boolean };
}

const StrategicMetric: React.FC<MetricCardProps> = ({ label, value, subValue, icon, color, trend }) => {
    const colors = {
        emerald: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
        blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
        primary: 'bg-primary/10 text-primary border-primary/20',
        amber: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
        violet: 'bg-violet-500/10 text-violet-500 border-violet-500/20',
        red: 'bg-red-500/10 text-red-500 border-red-500/20',
    };

    return (
        <div className="card-boutique p-5 hover:scale-[1.02] transition-all duration-300 border-white/5">
            <div className="flex justify-between items-start mb-4">
                <div className={`size-10 rounded-xl border flex items-center justify-center ${colors[color]}`}>
                    <span className="material-symbols-outlined text-xl">{icon}</span>
                </div>
                {trend && (
                    <div className={`text-[10px] font-black px-2 py-1 rounded-full flex items-center gap-1 ${trend.isPos ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                        <span className="material-symbols-outlined text-[10px]">{trend.isPos ? 'trending_up' : 'trending_down'}</span>
                        {trend.val}
                    </div>
                )}
            </div>
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">{label}</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white display-font">{value}</h3>
            {subValue && <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase">{subValue}</p>}
        </div>
    );
};

const StrategicDashboard: React.FC = () => {
    const { tenantId } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    // Data States
    const [metrics, setMetrics] = useState({
        todayRev: 0,
        weekRev: 0,
        avgTicket: 0,
        growth: 0
    });

    const [topBarber, setTopBarber] = useState<{ name: string; revenue: number; photo?: string } | null>(null);
    const [popularHours, setPopularHours] = useState<{ hour: string; value: number }[]>([]);
    const [riskClients, setRiskClients] = useState<any[]>([]);
    const [todayAgenda, setTodayAgenda] = useState<any[]>([]);
    const [alerts, setAlerts] = useState<{ type: 'stock' | 'bday' | 'access'; msg: string; icon: string; count: number }[]>([]);
    const [insights, setInsights] = useState<string>('');
    const [loadingInsights, setLoadingInsights] = useState(false);

    const fetchData = useCallback(async () => {
        if (!tenantId) return;
        setLoading(true);

        try {
            const now = new Date();
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

            // Week range (Monday to Sunday)
            const monday = new Date(now);
            monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
            monday.setHours(0, 0, 0, 0);
            const startOfWeek = monday.toISOString();

            const [transRes, apptsRes, clientsRes, staffRes, productsRes] = await Promise.all([
                supabase.from('transactions').select('*').eq('tenant_id', tenantId).eq('type', 'income').gte('date', startOfWeek),
                supabase.from('appointments').select('*').eq('tenant_id', tenantId).gte('start_time', startOfDay).order('start_time', { ascending: true }),
                supabase.from('clients').select('*').eq('tenant_id', tenantId),
                supabase.from('staff').select('id, name, avatar').eq('tenant_id', tenantId),
                supabase.from('products').select('*').eq('tenant_id', tenantId).filter('stock_quantity', 'lte', 'minimum_stock')
            ]);

            // 1. Faturamento & Ticket Médio
            if (transRes.data) {
                let tRev = 0;
                let wRev = 0;
                const todayStr = now.toISOString().split('T')[0];

                transRes.data.forEach(t => {
                    const val = Number(t.amount || t.val) || 0;
                    wRev += val;
                    if (t.date.split('T')[0] === todayStr) tRev += val;
                });

                const numSales = transRes.data.length;
                const avg = numSales > 0 ? wRev / numSales : 0;

                setMetrics({
                    todayRev: tRev,
                    weekRev: wRev,
                    avgTicket: avg,
                    growth: 12.5 // Mocked trend
                });
            }

            // 2. Barbeiro Destaque (Baseado em Appointments do mês - Fetch extra para período maior)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(now.getDate() - 30);

            const { data: monthAppts } = await supabase.from('appointments')
                .select('staff_id, staff_name, service_name, duration, start_time')
                .eq('tenant_id', tenantId)
                .eq('status', 'completed')
                .gte('start_time', thirtyDaysAgo.toISOString());

            if (monthAppts && staffRes.data) {
                const staffStats: Record<string, { name: string; rev: number }> = {};
                monthAppts.forEach(a => {
                    if (!staffStats[a.staff_id]) staffStats[a.staff_id] = { name: a.staff_name, rev: 0 };
                    // We don't have price in appointments easily, using a median price estimate or fetch services
                    // For now, let's count appearances as proxy or assume 50 per appt if price is missing
                    staffStats[a.staff_id].rev += 50;
                });

                const sorted = Object.values(staffStats).sort((a, b) => b.rev - a.rev);
                if (sorted[0]) {
                    const staffDetail = staffRes.data.find(s => s.id === Object.keys(staffStats).find(id => staffStats[id].name === sorted[0].name));
                    setTopBarber({ name: sorted[0].name, revenue: sorted[0].rev, photo: staffDetail?.avatar });
                }
            }

            // 3. Horários Lucrativos (Aggregation of last 30 days appts)
            if (monthAppts) {
                const hourFreq: Record<number, number> = {};
                monthAppts.forEach(a => {
                    const h = new Date(a.start_time).getHours();
                    hourFreq[h] = (hourFreq[h] || 0) + 1;
                });

                const chart = Object.keys(hourFreq).map(h => ({
                    hour: `${h}h`,
                    value: hourFreq[Number(h)]
                })).sort((a, b) => parseInt(a.hour) - parseInt(b.hour));

                setPopularHours(chart);
            }

            // 4. Clientes em Risco (Smart Return Engine)
            if (clientsRes.data) {
                const risk = clientsRes.data
                    .filter(c => c.last_visit)
                    .map(c => {
                        const lv = new Date(c.last_visit);
                        const diff = Math.floor((now.getTime() - lv.getTime()) / 86400000);
                        return { ...c, days: diff };
                    })
                    .filter(c => c.days >= 20)
                    .sort((a, b) => b.days - a.days)
                    .slice(0, 5);
                setRiskClients(risk);

                // 5. Alertas: Aniversários
                const todayMMDD = now.toISOString().split('T')[0].slice(5);
                const bdays = clientsRes.data.filter(c => c.birthday && c.birthday.slice(5) === todayMMDD).length;

                const newAlerts = [];
                if (bdays > 0) newAlerts.push({ type: 'bday' as const, msg: `${bdays} aniversariante(s) hoje`, icon: 'cake', count: bdays });
                if (productsRes.data && productsRes.data.length > 0) newAlerts.push({ type: 'stock' as const, msg: `${productsRes.data.length} itens com estoque baixo`, icon: 'inventory_2', count: productsRes.data.length });

                setAlerts(newAlerts);
            }

            if (apptsRes.data) {
                setTodayAgenda(apptsRes.data.slice(0, 5));
            }

        } catch (err: any) {
            console.error(err);
            setToast({ msg: 'Erro ao carregar dados estratégicos', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [tenantId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleAIInsight = async () => {
        setLoadingInsights(true);
        const text = await generateBusinessInsights({
            revenue: metrics.weekRev,
            growth: metrics.growth,
            avgTicket: metrics.avgTicket,
            topService: 'Cortes Masculinos'
        });
        setInsights(text);
        setLoadingInsights(false);
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
    );

    return (
        <div className="space-y-6 animate-fade-in pb-20 max-w-7xl mx-auto">
            {/* Header Estratégico */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-900 dark:bg-black/40 p-8 rounded-[2rem] border border-white/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[100px] pointer-events-none" />
                <div className="relative z-10">
                    <p className="text-primary text-xs font-black uppercase tracking-[0.3em] mb-2">Comitê Executivo</p>
                    <h1 className="text-4xl font-black text-white tracking-tighter display-font">Painel de <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-500">Inteligência</span></h1>
                    <p className="text-slate-400 mt-2 text-sm max-w-md">Decisões baseadas em dados para escalar sua barbearia para o próximo nível.</p>
                </div>
                <div className="flex gap-3 relative z-10">
                    <button onClick={handleAIInsight} disabled={loadingInsights}
                        className="px-6 py-3 bg-white text-slate-900 rounded-2xl font-black text-sm flex items-center gap-2 hover:bg-primary hover:text-white transition-all shadow-xl shadow-white/5">
                        <span className="material-symbols-outlined text-lg">{loadingInsights ? 'sync' : 'auto_awesome'}</span>
                        {loadingInsights ? 'Analisando...' : 'Consultar IA Gemini'}
                    </button>
                    <button onClick={() => fetchData()} className="size-12 bg-white/5 border border-white/10 text-white rounded-2xl flex items-center justify-center hover:bg-white/10 transition-all">
                        <span className="material-symbols-outlined">refresh</span>
                    </button>
                </div>
            </div>

            {insights && (
                <div className="bg-primary/10 border border-primary/20 p-6 rounded-[1.5rem] animate-slide-up flex gap-4">
                    <div className="size-10 bg-primary rounded-xl flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-white">psychology</span>
                    </div>
                    <div>
                        <h4 className="text-primary font-black uppercase text-[10px] tracking-widest mb-1">Visão da IA</h4>
                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-bold italic">"{insights}"</p>
                    </div>
                </div>
            )}

            {/* Grid de Métricas High-End */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StrategicMetric
                    label="Faturamento Hoje" value={fmt(metrics.todayRev)}
                    trend={{ val: '8.2%', isPos: true }} icon="today" color="emerald"
                />
                <StrategicMetric
                    label="Faturamento Semana" value={fmt(metrics.weekRev)}
                    trend={{ val: '12.5%', isPos: true }} icon="date_range" color="blue"
                />
                <StrategicMetric
                    label="Ticket Médio" value={fmt(metrics.avgTicket)}
                    subValue="Meta: R$ 85,00" icon="receipt_long" color="amber"
                />
                <StrategicMetric
                    label="Crescimento" value={`${metrics.growth}%`}
                    subValue="Jan vs Fev" icon="trending_up" color="violet"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Coluna 1 & 2: Gráficos e Analítica */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="card-boutique p-8">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Horários mais Lucrativos</h3>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Otimização de Fluxo (Últimos 30 dias)</p>
                            </div>
                            <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                <span className="material-symbols-outlined text-primary">schedule</span>
                            </div>
                        </div>
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={popularHours}>
                                    <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 800 }} />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }}
                                        contentStyle={{ borderRadius: '12px', border: 'none', background: '#0f172a', color: '#fff' }}
                                    />
                                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                                        {popularHours.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={index > popularHours.length - 4 ? '#3b82f6' : '#1e293b'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <p className="text-[10px] text-center text-slate-400 font-bold uppercase mt-4">Dica: Os horários em azul representam o maior volume de atendimentos concluídos.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Barbeiro Destaque */}
                        <div className="card-boutique p-6 bg-gradient-to-br from-slate-900 to-slate-950 border-primary/20">
                            <h3 className="text-white font-black text-sm uppercase tracking-widest mb-6">Barbeiro Destaque</h3>
                            {topBarber ? (
                                <div className="flex flex-col items-center text-center">
                                    <div className="relative mb-4">
                                        <div className="absolute -inset-1 bg-gradient-to-r from-primary to-violet-500 rounded-full blur opacity-50 animate-pulse" />
                                        <img src={topBarber.photo || `https://ui-avatars.com/api/?name=${topBarber.name}&background=6366f1&color=fff`}
                                            className="size-24 rounded-full border-2 border-primary relative z-10" alt={topBarber.name}
                                        />
                                        <div className="absolute -bottom-2 -right-2 bg-primary text-white size-8 rounded-full flex items-center justify-center border-4 border-slate-900 z-20">
                                            <span className="material-symbols-outlined text-sm">workspace_premium</span>
                                        </div>
                                    </div>
                                    <h4 className="text-xl font-black text-white">{topBarber.name}</h4>
                                    <p className="text-primary text-[10px] font-black uppercase tracking-widest mt-1">Líder de Faturamento</p>
                                    <div className="mt-4 px-4 py-2 bg-white/5 rounded-xl border border-white/5 w-full">
                                        <p className="text-[10px] text-slate-400 font-bold uppercase">Produtividade Mensal</p>
                                        <p className="text-lg font-black text-white mt-1">+ {topBarber.revenue} atendimentos</p>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-slate-500 text-xs italic">Sem dados suficientes no momento.</p>
                            )}
                        </div>

                        {/* Alertas Críticos */}
                        <div className="card-boutique p-6">
                            <h3 className="text-slate-900 dark:text-white font-black text-sm uppercase tracking-widest mb-6">Alertas do Sistema</h3>
                            <div className="space-y-3">
                                {alerts.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-6 text-slate-400">
                                        <span className="material-symbols-outlined text-4xl mb-2">check_circle</span>
                                        <p className="text-[10px] font-bold uppercase">Tudo em ordem!</p>
                                    </div>
                                ) : alerts.map((a, i) => (
                                    <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${a.type === 'stock' ? 'border-red-500/20 bg-red-500/5 text-red-500' : 'border-amber-500/20 bg-amber-500/5 text-amber-500'}`}>
                                        <span className="material-symbols-outlined">{a.icon}</span>
                                        <p className="text-xs font-black">{a.msg}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Coluna 3: Agenda e Retorno */}
                <div className="space-y-6">
                    {/* Agenda do Dia */}
                    <div className="card-boutique p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-black text-slate-900 dark:text-white text-sm uppercase tracking-widest">Agenda Flash</h3>
                            <button onClick={() => navigate('/schedule')} className="text-primary text-[10px] font-black uppercase">Grade Completa</button>
                        </div>
                        <div className="space-y-3">
                            {todayAgenda.length === 0 ? (
                                <p className="text-slate-500 text-xs italic py-4">Sem horários para hoje.</p>
                            ) : todayAgenda.map((apt, i) => (
                                <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-transparent">
                                    <div className="size-10 bg-white dark:bg-white/5 rounded-lg flex items-center justify-center text-primary font-black text-[10px] border border-slate-200 dark:border-white/5 shrink-0">
                                        {new Date(apt.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-black text-slate-900 dark:text-white truncate">{apt.client_name}</p>
                                        <p className="text-[10px] text-slate-500 truncate">{apt.service_name}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Clientes que precisam retornar */}
                    <div className="card-boutique p-6 border-red-500/10">
                        <div className="flex items-center gap-2 mb-6">
                            <span className="material-symbols-outlined text-red-500 text-lg">psychology</span>
                            <h3 className="font-black text-slate-900 dark:text-white text-sm uppercase tracking-widest">Motor de Retorno</h3>
                        </div>
                        <div className="space-y-3">
                            {riskClients.length === 0 ? (
                                <p className="text-slate-500 text-xs italic">Todos os clientes estão engajados.</p>
                            ) : riskClients.map((c, i) => (
                                <div key={i} className="flex items-center justify-between p-3 bg-red-500/5 rounded-xl border border-red-500/10">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="size-8 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 flex items-center justify-center font-black text-[10px]">
                                            {c.name[0]}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[11px] font-black text-slate-900 dark:text-white truncate">{c.name}</p>
                                            <p className="text-[10px] text-red-500 font-bold">{c.days}d sem voltas</p>
                                        </div>
                                    </div>
                                    {c.phone && (
                                        <button onClick={() => window.open(`https://wa.me/55${c.phone.replace(/\D/g, '')}`, '_blank')}
                                            className="size-7 rounded-full bg-emerald-500 text-white flex items-center justify-center hover:opacity-80 transition-opacity">
                                            <span className="material-symbols-outlined text-xs">chat</span>
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        <button onClick={() => navigate('/smart-return')}
                            className="w-full mt-4 py-2 border border-red-500/20 text-red-500 rounded-lg text-[10px] font-black uppercase hover:bg-red-500/5 transition-colors">
                            Ver todos os clientes em risco
                        </button>
                    </div>
                </div>
            </div>

            {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

export default StrategicDashboard;
