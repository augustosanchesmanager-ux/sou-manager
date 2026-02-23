import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { generateBusinessInsights } from '../services/geminiService';

/* ───────────── TYPES ───────────── */
interface Transaction { id: string; date: string; amount: number; type: 'income' | 'expense'; method: string; description: string; }
interface Appointment { id: string; start_time: string; status: string; client_id: string; staff_id: string; staff_name: string; service_name: string; client_name: string; }
interface Client { id: string; name: string; created_at: string; last_visit: string; total_spent: number; }
interface Staff { id: string; name: string; }
interface Product { id: string; name: string; stock_quantity: number; minimum_stock: number; price: number; }
interface ComandaItem { id: string; product_id: string | null; service_id: string | null; product_name: string; quantity: number; unit_price: number; comanda_id: string; }
interface Comanda { id: string; total: number; staff_id: string; status: string; created_at: string; }

type Period = 'today' | '7d' | '30d' | '90d' | 'custom';

/* ───────────── HELPERS ───────────── */
const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (n: number) => (n >= 0 ? '+' : '') + n.toFixed(1) + '%';
const diffDays = (a: Date, b: Date) => Math.floor((a.getTime() - b.getTime()) / 86400000);

const periodLabel: Record<Period, string> = {
    today: 'Hoje', '7d': '7 Dias', '30d': '30 Dias', '90d': '90 Dias', custom: 'Personalizado'
};

const COLORS = ['#3c83f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#ef4444', '#a78bfa'];

/* ───────────── COMPONENT ───────────── */
const BusinessIntelligence: React.FC = () => {
    const { theme } = useTheme();
    const { tenantId } = useAuth();
    const [period, setPeriod] = useState<Period>('30d');
    const [loading, setLoading] = useState(true);

    // Raw data
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [staff, setStaff] = useState<Staff[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [comandaItems, setCmdItems] = useState<ComandaItem[]>([]);
    const [comandas, setComandas] = useState<Comanda[]>([]);

    // IA Insights
    const [insights, setInsights] = useState<string[]>([]);
    const [loadingInsights, setLoadingInsights] = useState(false);

    /* ──── Date range ──── */
    const dateRange = useMemo(() => {
        const now = new Date();
        let from = new Date();
        switch (period) {
            case 'today': from = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break;
            case '7d': from.setDate(now.getDate() - 7); break;
            case '30d': from.setDate(now.getDate() - 30); break;
            case '90d': from.setDate(now.getDate() - 90); break;
            default: from.setDate(now.getDate() - 30);
        }
        return { from, to: now };
    }, [period]);

    const prevRange = useMemo(() => {
        const dur = dateRange.to.getTime() - dateRange.from.getTime();
        return { from: new Date(dateRange.from.getTime() - dur), to: new Date(dateRange.from.getTime()) };
    }, [dateRange]);

    /* ──── FETCH ──── */
    const fetchAll = useCallback(async () => {
        setLoading(true);
        const [txRes, aptRes, cliRes, stfRes, prdRes, ciRes, cmdRes] = await Promise.all([
            supabase.from('transactions').select('*').order('date', { ascending: true }),
            supabase.from('appointments').select('*').order('start_time', { ascending: false }),
            supabase.from('clients').select('*').order('name'),
            supabase.from('staff').select('id, name').eq('status', 'active'),
            supabase.from('products').select('*'),
            supabase.from('comanda_items').select('*'),
            supabase.from('comandas').select('*').eq('status', 'paid'),
        ]);

        if (txRes.data) setTransactions(txRes.data);
        if (aptRes.data) setAppointments(aptRes.data);
        if (cliRes.data) setClients(cliRes.data);
        if (stfRes.data) setStaff(stfRes.data);
        if (prdRes.data) setProducts(prdRes.data);
        if (ciRes.data) setCmdItems(ciRes.data);
        if (cmdRes.data) setComandas(cmdRes.data);
        setLoading(false);
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    /* ──── DERIVED METRICS ──── */

    // Filter by period
    const filteredTx = useMemo(() => transactions.filter(t => {
        const d = new Date(t.date);
        return d >= dateRange.from && d <= dateRange.to;
    }), [transactions, dateRange]);

    const prevTx = useMemo(() => transactions.filter(t => {
        const d = new Date(t.date);
        return d >= prevRange.from && d < prevRange.to;
    }), [transactions, prevRange]);

    const filteredApts = useMemo(() => appointments.filter(a => {
        const d = new Date(a.start_time);
        return d >= dateRange.from && d <= dateRange.to;
    }), [appointments, dateRange]);

    const prevApts = useMemo(() => appointments.filter(a => {
        const d = new Date(a.start_time);
        return d >= prevRange.from && d < prevRange.to;
    }), [appointments, prevRange]);

    // ═══════ FINANCIAL KPIs ═══════
    const income = useMemo(() => filteredTx.filter(t => t.type === 'income').reduce((s, t) => s + (Number(t.amount) || 0), 0), [filteredTx]);
    const expense = useMemo(() => filteredTx.filter(t => t.type === 'expense').reduce((s, t) => s + (Number(t.amount) || 0), 0), [filteredTx]);
    const prevIncome = useMemo(() => prevTx.filter(t => t.type === 'income').reduce((s, t) => s + (Number(t.amount) || 0), 0), [prevTx]);
    const prevExpense = useMemo(() => prevTx.filter(t => t.type === 'expense').reduce((s, t) => s + (Number(t.amount) || 0), 0), [prevTx]);
    const profit = income - expense;
    const profitMargin = income > 0 ? (profit / income) * 100 : 0;
    const growthPct = prevIncome > 0 ? ((income - prevIncome) / prevIncome) * 100 : 0;

    // Ticket Médio
    const incomeCount = filteredTx.filter(t => t.type === 'income').length;
    const avgTicket = incomeCount > 0 ? income / incomeCount : 0;
    const prevIncomeCount = prevTx.filter(t => t.type === 'income').length;
    const prevAvgTicket = prevIncomeCount > 0 ? prevIncome / prevIncomeCount : 0;
    const avgTicketGrowth = prevAvgTicket > 0 ? ((avgTicket - prevAvgTicket) / prevAvgTicket) * 100 : 0;

    // ═══════ CLIENT KPIs ═══════
    const newClients = useMemo(() => clients.filter(c => {
        const d = new Date(c.created_at);
        return d >= dateRange.from && d <= dateRange.to;
    }).length, [clients, dateRange]);

    const prevNewClients = useMemo(() => clients.filter(c => {
        const d = new Date(c.created_at);
        return d >= prevRange.from && d < prevRange.to;
    }).length, [clients, prevRange]);

    // Retention: clients who visited in prev period AND also in current period
    const retentionRate = useMemo(() => {
        const prevVisitorIds = new Set(
            appointments.filter(a => {
                const d = new Date(a.start_time);
                return d >= prevRange.from && d < prevRange.to && a.status !== 'cancelled';
            }).map(a => a.client_id).filter(Boolean)
        );
        if (prevVisitorIds.size === 0) return 0;
        const currentVisitorIds = new Set(
            filteredApts.filter(a => a.status !== 'cancelled').map(a => a.client_id).filter(Boolean)
        );
        let returning = 0;
        prevVisitorIds.forEach(id => { if (currentVisitorIds.has(id)) returning++; });
        return (returning / prevVisitorIds.size) * 100;
    }, [appointments, filteredApts, prevRange]);

    // Inactive clients (no visit in 60+ days)
    const inactiveClients = useMemo(() => {
        const now = new Date();
        return clients.filter(c => {
            if (!c.last_visit) return true;
            return diffDays(now, new Date(c.last_visit)) > 60;
        }).length;
    }, [clients]);

    // avg visit frequency (days between visits per client)
    const avgFrequency = useMemo(() => {
        if (appointments.length === 0) return 0;
        const clientVisits: Record<string, Date[]> = {};
        appointments.filter(a => a.status !== 'cancelled' && a.client_id).forEach(a => {
            if (!clientVisits[a.client_id]) clientVisits[a.client_id] = [];
            clientVisits[a.client_id].push(new Date(a.start_time));
        });
        let totalGaps = 0, gapCount = 0;
        Object.values(clientVisits).forEach(visits => {
            visits.sort((a, b) => a.getTime() - b.getTime());
            for (let i = 1; i < visits.length; i++) {
                totalGaps += diffDays(visits[i], visits[i - 1]);
                gapCount++;
            }
        });
        return gapCount > 0 ? totalGaps / gapCount : 0;
    }, [appointments]);

    // Top Clients
    const topClients = useMemo(() => {
        return [...clients].sort((a, b) => (b.total_spent || 0) - (a.total_spent || 0)).slice(0, 5);
    }, [clients]);

    // ═══════ OPERATIONAL KPIs ═══════
    const totalAppts = filteredApts.length;
    const completedAppts = filteredApts.filter(a => a.status === 'completed').length;
    const cancelledAppts = filteredApts.filter(a => a.status === 'cancelled').length;
    const noShowAppts = filteredApts.filter(a => a.status === 'no_show' || a.status === 'no-show').length;
    const showRate = totalAppts > 0 ? (completedAppts / totalAppts) * 100 : 0;
    const cancelRate = totalAppts > 0 ? (cancelledAppts / totalAppts) * 100 : 0;
    const noShowRate = totalAppts > 0 ? (noShowAppts / totalAppts) * 100 : 0;

    // Top Services
    const topServices = useMemo(() => {
        const serviceMap: Record<string, { name: string; count: number; revenue: number }> = {};
        filteredApts.filter(a => a.service_name && a.status !== 'cancelled').forEach(a => {
            if (!serviceMap[a.service_name]) serviceMap[a.service_name] = { name: a.service_name, count: 0, revenue: 0 };
            serviceMap[a.service_name].count++;
        });
        // Try to add revenue from comanda items
        comandaItems.forEach(ci => {
            if (ci.service_id && ci.product_name) {
                if (serviceMap[ci.product_name]) {
                    serviceMap[ci.product_name].revenue += (ci.unit_price || 0) * (ci.quantity || 1);
                }
            }
        });
        return Object.values(serviceMap).sort((a, b) => b.count - a.count).slice(0, 6);
    }, [filteredApts, comandaItems]);

    // Staff Performance
    const staffPerf = useMemo(() => {
        const map: Record<string, { name: string; revenue: number; count: number }> = {};
        staff.forEach(s => { map[s.id] = { name: s.name, revenue: 0, count: 0 }; });
        comandas.forEach(cmd => {
            const d = new Date(cmd.created_at);
            if (d >= dateRange.from && d <= dateRange.to && map[cmd.staff_id]) {
                map[cmd.staff_id].revenue += Number(cmd.total) || 0;
                map[cmd.staff_id].count++;
            }
        });
        return Object.values(map).filter(s => s.count > 0).sort((a, b) => b.revenue - a.revenue);
    }, [staff, comandas, dateRange]);

    // ═══════ INVENTORY KPIs ═══════
    const lowStockProducts = useMemo(() =>
        products.filter(p => p.stock_quantity <= (p.minimum_stock || 0) && p.minimum_stock > 0), [products]
    );

    const topProducts = useMemo(() => {
        const map: Record<string, { name: string; qtd: number; revenue: number }> = {};
        comandaItems.filter(ci => ci.product_id).forEach(ci => {
            if (!map[ci.product_name]) map[ci.product_name] = { name: ci.product_name, qtd: 0, revenue: 0 };
            map[ci.product_name].qtd += ci.quantity || 1;
            map[ci.product_name].revenue += (ci.unit_price || 0) * (ci.quantity || 1);
        });
        return Object.values(map).sort((a, b) => b.qtd - a.qtd).slice(0, 5);
    }, [comandaItems]);

    // ═══════ CHART DATA ═══════

    // Revenue evolution (line chart)
    const revenueEvolution = useMemo(() => {
        const grouped: Record<string, { receita: number; despesa: number }> = {};
        const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            grouped[months[d.getMonth()]] = { receita: 0, despesa: 0 };
        }
        transactions.forEach(t => {
            const d = new Date(t.date);
            const key = months[d.getMonth()];
            if (grouped[key]) {
                if (t.type === 'income') grouped[key].receita += Number(t.amount) || 0;
                else grouped[key].despesa += Number(t.amount) || 0;
            }
        });
        return Object.entries(grouped).map(([name, v]) => ({ name, ...v }));
    }, [transactions]);

    // Revenue by Method (pie)
    const revenueByMethod = useMemo(() => {
        const map: Record<string, number> = {};
        filteredTx.filter(t => t.type === 'income').forEach(t => {
            const m = t.method || 'Outros';
            map[m] = (map[m] || 0) + (Number(t.amount) || 0);
        });
        return Object.entries(map).map(([name, value]) => ({ name, value }));
    }, [filteredTx]);

    // ═══════ AUTO INSIGHTS ═══════
    const autoInsights = useMemo(() => {
        const arr: string[] = [];
        if (growthPct > 0) arr.push(`📈 Seu faturamento cresceu ${growthPct.toFixed(1)}% comparado ao período anterior.`);
        else if (growthPct < 0) arr.push(`📉 Seu faturamento caiu ${Math.abs(growthPct).toFixed(1)}% comparado ao período anterior.`);
        if (inactiveClients > 0) arr.push(`⚠️ Você tem ${inactiveClients} cliente(s) inativos há mais de 60 dias.`);
        if (topServices.length > 0) arr.push(`✂️ Seu serviço mais popular é "${topServices[0].name}" com ${topServices[0].count} atendimentos.`);
        if (noShowRate > 10) arr.push(`🚫 Sua taxa de falta (${noShowRate.toFixed(1)}%) está acima da média recomendada (10%).`);
        if (cancelRate > 15) arr.push(`❌ Sua taxa de cancelamento (${cancelRate.toFixed(1)}%) está alta. Considere confirmar agendamentos via WhatsApp.`);
        if (retentionRate > 0 && retentionRate < 40) arr.push(`🔄 Sua taxa de retenção está em ${retentionRate.toFixed(0)}%. Promoções de retorno podem ajudar!`);
        if (lowStockProducts.length > 0) arr.push(`📦 ${lowStockProducts.length} produto(s) com estoque crítico precisam de reposição.`);
        if (profitMargin < 30 && income > 0) arr.push(`💰 Margem de lucro de ${profitMargin.toFixed(1)}% está abaixo do ideal (30%+). Revise seus custos.`);
        if (avgTicket > 0 && avgTicketGrowth > 5) arr.push(`🎯 Ticket médio subiu ${avgTicketGrowth.toFixed(1)}%! Ótimo trabalho em upsell.`);
        return arr;
    }, [growthPct, inactiveClients, topServices, noShowRate, cancelRate, retentionRate, lowStockProducts, profitMargin, income, avgTicket, avgTicketGrowth]);

    const handleAIInsights = async () => {
        setLoadingInsights(true);
        const result = await generateBusinessInsights({
            revenue: income, expenses: expense, profit,
            profitMargin, growthPct, avgTicket,
            newClients, inactiveClients, retentionRate,
            totalAppointments: totalAppts, showRate, cancelRate, noShowRate,
            topService: topServices[0]?.name || 'N/A',
            staffCount: staff.length,
            lowStockCount: lowStockProducts.length
        });
        setInsights(result.split('\n').filter(Boolean));
        setLoadingInsights(false);
    };

    /* ──── TOOLTIP STYLE ──── */
    const tooltipStyle = {
        backgroundColor: theme === 'dark' ? '#1F1F1F' : '#fff',
        borderColor: theme === 'dark' ? '#333' : '#e2e8f0',
        borderRadius: '8px', fontSize: '12px'
    };

    // ═══════ KPI Card Component ═══════
    const KpiCard = ({ icon, label, value, subLabel, delta, color = 'blue' }: {
        icon: string; label: string; value: string; subLabel?: string; delta?: number; color?: string;
    }) => (
        <div className="bg-white dark:bg-card-dark p-5 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm hover:shadow-md transition-shadow">
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
                        {fmtPct(delta)}
                    </span>
                )}
                {subLabel && <span className="text-[10px] text-slate-400">{subLabel}</span>}
            </div>
        </div>
    );

    /* ═════════════════════ RENDER ═════════════════════ */
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
                    {(['today', '7d', '30d', '90d'] as Period[]).map(p => (
                        <button key={p} onClick={() => setPeriod(p)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${period === p ? 'bg-primary text-white shadow-md shadow-primary/20' : 'bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>
                            {periodLabel[p]}
                        </button>
                    ))}
                </div>
            </div>

            {/* ══════════════ FINANCIAL KPIs ══════════════ */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard icon="payments" label="Faturamento" value={`R$ ${fmt(income)}`} delta={growthPct} subLabel="vs período anterior" color="blue" />
                <KpiCard icon="receipt_long" label="Ticket Médio" value={`R$ ${fmt(avgTicket)}`} delta={avgTicketGrowth} subLabel="por atendimento" color="purple" />
                <KpiCard icon="savings" label="Lucro Estimado" value={`R$ ${fmt(profit)}`} subLabel={`Margem ${profitMargin.toFixed(1)}%`} color="emerald" />
                <KpiCard icon="trending_down" label="Despesas" value={`R$ ${fmt(expense)}`} delta={prevExpense > 0 ? ((expense - prevExpense) / prevExpense) * 100 : 0} subLabel="custos totais" color="red" />
            </div>

            {/* ══════════════ CHARTS ROW ══════════════ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Revenue Evolution */}
                <div className="lg:col-span-2 bg-white dark:bg-card-dark p-6 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="material-symbols-outlined text-blue-500 text-lg">show_chart</span>
                            Evolução do Faturamento
                        </h3>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Últimos 6 Meses</span>
                    </div>
                    <div className="h-[280px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={revenueEvolution} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#333' : '#e2e8f0'} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: theme === 'dark' ? '#94a3b8' : '#64748b', fontSize: 11 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: theme === 'dark' ? '#94a3b8' : '#64748b', fontSize: 11 }} />
                                <Tooltip contentStyle={tooltipStyle} />
                                <Legend iconType="circle" />
                                <Line type="monotone" dataKey="receita" name="Receitas" stroke="#3c83f6" strokeWidth={3} dot={{ r: 4, fill: '#3c83f6' }} activeDot={{ r: 6 }} />
                                <Line type="monotone" dataKey="despesa" name="Despesas" stroke="#ef4444" strokeWidth={2} dot={{ r: 3, fill: '#ef4444' }} strokeDasharray="5 5" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Distribution Pie */}
                <div className="bg-white dark:bg-card-dark p-6 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-6">
                        <span className="material-symbols-outlined text-purple-500 text-lg">pie_chart</span>
                        Formas de Pagamento
                    </h3>
                    <div className="h-[240px] w-full">
                        {revenueByMethod.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={revenueByMethod} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                                        {revenueByMethod.map((_, i) => (
                                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`R$ ${fmt(v)}`, 'Valor']} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-400 text-sm">Sem dados</div>
                        )}
                    </div>
                </div>
            </div>

            {/* ══════════════ CLIENT + OPERATIONAL ══════════════ */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard icon="person_add" label="Novos Clientes" value={String(newClients)} delta={prevNewClients > 0 ? ((newClients - prevNewClients) / prevNewClients) * 100 : 0} subLabel="no período" color="blue" />
                <KpiCard icon="sync" label="Taxa de Retenção" value={`${retentionRate.toFixed(0)}%`} subLabel={`${inactiveClients} inativos`} color="purple" />
                <KpiCard icon="calendar_month" label="Frequência Média" value={avgFrequency > 0 ? `${avgFrequency.toFixed(0)} dias` : '—'} subLabel="entre visitas" color="emerald" />
                <KpiCard icon="event_available" label="Agendamentos" value={String(totalAppts)} subLabel={`${completedAppts} concluídos`} color="blue" />
            </div>

            {/* ══════════════ OPERATIONAL CHART + TOP SERVICES ══════════════ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Attendance Breakdown */}
                <div className="bg-white dark:bg-card-dark p-6 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                        <span className="material-symbols-outlined text-emerald-500 text-lg">bar_chart</span>
                        Indicadores de Agendamento
                    </h3>
                    <div className="space-y-4">
                        {[
                            { label: 'Comparecimento', pct: showRate, color: 'bg-emerald-500' },
                            { label: 'Cancelamento', pct: cancelRate, color: 'bg-amber-500' },
                            { label: 'Faltas (No-Show)', pct: noShowRate, color: 'bg-red-500' },
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
                    {staffPerf.length > 0 && (
                        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-border-dark">
                            <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Performance da Equipe</h4>
                            <div className="space-y-2">
                                {staffPerf.map((s, i) => (
                                    <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5">
                                        <div className="flex items-center gap-2">
                                            <span className={`size-6 rounded-full flex items-center justify-center text-[10px] font-black text-white ${i === 0 ? 'bg-amber-500' : i === 1 ? 'bg-slate-400' : 'bg-amber-800/60'}`}>{i + 1}</span>
                                            <span className="text-sm font-bold text-slate-900 dark:text-white">{s.name}</span>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-bold text-emerald-500">R$ {fmt(s.revenue)}</p>
                                            <p className="text-[10px] text-slate-400">{s.count} atend. • TM R$ {s.count > 0 ? fmt(s.revenue / s.count) : '0'}</p>
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
                    {topServices.length > 0 ? (
                        <div className="h-[220px] w-full mb-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={topServices} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
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
                            {topClients.map((c, i) => (
                                <div key={c.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5">
                                    <div className="flex items-center gap-2">
                                        <span className={`size-6 rounded-full flex items-center justify-center text-[10px] font-black text-white ${i === 0 ? 'bg-amber-500' : i === 1 ? 'bg-slate-400' : 'bg-amber-800/60'}`}>{i + 1}</span>
                                        <span className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[140px]">{c.name}</span>
                                    </div>
                                    <span className="text-sm font-bold text-emerald-500">R$ {fmt(c.total_spent || 0)}</span>
                                </div>
                            ))}
                            {topClients.length === 0 && <p className="text-xs text-slate-400 text-center">Sem dados</p>}
                        </div>
                    </div>
                </div>
            </div>

            {/* ══════════════ INVENTORY KPIs ══════════════ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Products */}
                <div className="bg-white dark:bg-card-dark p-6 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                        <span className="material-symbols-outlined text-amber-500 text-lg">inventory_2</span>
                        Produtos Mais Vendidos
                    </h3>
                    {topProducts.length > 0 ? (
                        <div className="space-y-3">
                            {topProducts.map((p, i) => (
                                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-white/5">
                                    <div className="flex items-center gap-3">
                                        <span className={`size-8 rounded-lg flex items-center justify-center text-xs font-black text-white ${i === 0 ? 'bg-amber-500' : 'bg-slate-400'}`}>{i + 1}</span>
                                        <div>
                                            <p className="text-sm font-bold text-slate-900 dark:text-white">{p.name}</p>
                                            <p className="text-[10px] text-slate-500">{p.qtd} vendido(s)</p>
                                        </div>
                                    </div>
                                    <span className="text-sm font-bold text-emerald-500">R$ {fmt(p.revenue)}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-center text-sm text-slate-400 py-6">Nenhum produto vendido ainda.</p>
                    )}
                </div>

                {/* Low Stock Alerts */}
                <div className="bg-white dark:bg-card-dark p-6 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                        <span className="material-symbols-outlined text-red-500 text-lg">warning</span>
                        Alertas de Estoque
                    </h3>
                    {lowStockProducts.length > 0 ? (
                        <div className="space-y-3">
                            {lowStockProducts.map(p => (
                                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/20">
                                    <div>
                                        <p className="text-sm font-bold text-slate-900 dark:text-white">{p.name}</p>
                                        <p className="text-[10px] text-red-500 font-bold">Estoque: {p.stock_quantity} / Mínimo: {p.minimum_stock}</p>
                                    </div>
                                    <div className="size-10 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-lg">priority_high</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <div className="size-14 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-3">
                                <span className="material-symbols-outlined text-2xl">check_circle</span>
                            </div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">Estoque Saudável</p>
                            <p className="text-xs text-slate-500 mt-1">Todos os produtos dentro do nível mínimo.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* ══════════════ INSIGHTS SECTION ══════════════ */}
            <div className="bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-pink-500/5 border border-indigo-500/20 rounded-xl p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div className="flex items-center gap-3">
                        <div className="size-10 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                            <span className="material-symbols-outlined text-white">psychology</span>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Insights Automáticos</h3>
                            <p className="text-xs text-slate-500">Inteligência gerada a partir dos seus dados reais.</p>
                        </div>
                    </div>
                    <button onClick={handleAIInsights} disabled={loadingInsights} className="px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-bold rounded-lg hover:opacity-90 transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">auto_awesome</span>
                        {loadingInsights ? 'Analisando com IA...' : 'Gerar Insights Avançados (IA)'}
                    </button>
                </div>

                {/* Auto insights */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {autoInsights.map((txt, i) => (
                        <div key={i} className="bg-white/70 dark:bg-white/5 backdrop-blur-sm border border-white/30 dark:border-white/10 p-3.5 rounded-lg">
                            <p className="text-sm text-slate-700 dark:text-slate-300">{txt}</p>
                        </div>
                    ))}
                    {autoInsights.length === 0 && (
                        <div className="col-span-2 text-center text-sm text-slate-400 py-4">Dados insuficientes para gerar insights automáticos.</div>
                    )}
                </div>

                {/* AI Insights */}
                {insights.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-indigo-500/10">
                        <p className="text-[10px] font-bold text-indigo-500 uppercase mb-3">Análise Gemini AI</p>
                        <div className="space-y-2">
                            {insights.map((txt, i) => (
                                <p key={i} className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{txt}</p>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {loading && (
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
