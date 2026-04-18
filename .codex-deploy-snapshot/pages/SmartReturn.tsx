import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import Modal from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';

/* ─── Types ─────────────────────────────────────────────────── */
interface ClientReturnData {
    id: string;
    name: string;
    phone: string;
    email: string;
    avatar: string;
    last_visit: string;
    avg_return_days: number;     // média calculada dinamicamente
    days_since_last: number;     // dias desde a última visita
    status: 'normal' | 'attention' | 'overdue' | 'new';
    overdue_days: number;        // quantos dias está atrasado (negativo = adiantado)
    total_appointments: number;
    total_spent: number;
}

type FilterStatus = 'all' | 'overdue' | 'attention' | 'normal';

/* ─── Helper ─────────────────────────────────────────────────── */
const daysBetween = (dateA: string, dateB: Date = new Date()): number => {
    const d = new Date(dateA);
    return Math.floor((dateB.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
};

const calcAvgReturn = (dates: string[]): number => {
    if (dates.length < 2) return 21; // padrão de 3 semanas se não tiver histórico suficiente
    const sorted = [...dates].sort();
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
        gaps.push(daysBetween(sorted[i - 1], new Date(sorted[i])));
    }
    const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    return Math.round(avg);
};

const getStatus = (daysSince: number, avg: number): ClientReturnData['status'] => {
    const tolerance = Math.max(3, Math.round(avg * 0.25)); // 25% de tolerância
    if (avg === 21 && daysSince < 7) return 'new'; // provavelmente novo cliente
    if (daysSince >= avg + tolerance) return 'overdue';
    if (daysSince >= avg - tolerance) return 'attention';
    return 'normal';
};

/* ─── Badge components ───────────────────────────────────────── */
const StatusBadge: React.FC<{ status: ClientReturnData['status']; overdueDays: number }> = ({ status, overdueDays }) => {
    const map = {
        overdue: { label: `🔴 Atrasado +${overdueDays}d`, cls: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-700/50' },
        attention: { label: '🟡 Próximo', cls: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700/50' },
        normal: { label: '🟢 Normal', cls: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-500 border border-emerald-200 dark:border-emerald-700/50' },
        new: { label: '🆕 Novo', cls: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700/50' },
    };
    const { label, cls } = map[status];
    return <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider whitespace-nowrap ${cls}`}>{label}</span>;
};

/* ─── WhatsApp message template ─────────────────────────────── */
const buildWhatsApp = (name: string, phone: string, daysSince: number): string => {
    const cleanPhone = phone.replace(/\D/g, '');
    const msg = encodeURIComponent(
        `Fala ${name.split(' ')[0]}! 😄\n\nJá faz ${daysSince} dias desde sua última visita. Tá na hora de alinhar o corte! ✂️\n\nQuer agendar agora? Responde aqui que a gente encaixa você!`
    );
    return `https://wa.me/55${cleanPhone}?text=${msg}`;
};

/* ─── Main Component ─────────────────────────────────────────── */
const SmartReturn: React.FC = () => {
    const navigate = useNavigate();
    const { tenantId } = useAuth();

    const [clients, setClients] = useState<ClientReturnData[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<FilterStatus>('all');
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState<'overdue' | 'avg' | 'name'>('overdue');

    // Modais de ação
    const [couponClient, setCouponClient] = useState<ClientReturnData | null>(null);
    const [selectedClient, setSelectedClient] = useState<ClientReturnData | null>(null);
    const [whatsappMessage, setWhatsappMessage] = useState('');

    const openCouponModal = (client: ClientReturnData) => {
        setCouponClient(client);
        setWhatsappMessage(`Fala ${client.name.split(' ')[0]}! 😄\n\nSentimos muito a sua falta por aqui. Já faz ${client.days_since_last} dias desde sua última visita.\n\nComo você é especial para nós, liberamos um presente: *10% de desconto* no seu próximo serviço!\n\nMostre esse número na recepção: *VOLTA10*\n\nBora agendar seu horário? É só me responder aqui!`);
    };

    const openAnalysisModal = (client: ClientReturnData) => {
        setSelectedClient(client);
        setWhatsappMessage(`Fala ${client.name.split(' ')[0]}! 😄\n\nJá faz ${client.days_since_last} dias desde sua última visita. Tá na hora de alinhar o corte e dar aquele talento no visual! ✂️\n\nQuer agendar agora? Responde aqui que a gente encaixa você no melhor horário!`);
    };

    /* ─── Fetch + Algorithm ──────────────────────────────────── */
    const fetch = useCallback(async () => {
        setLoading(true);

        const [clientsRes, apptRes, comandasRes] = await Promise.all([
            supabase.from('clients').select('id, name, phone, email, avatar, last_visit, total_spent').eq('status', 'active').eq('tenant_id', tenantId),
            supabase.from('appointments').select('client_id, start_time').eq('tenant_id', tenantId).in('status', ['completed', 'confirmed']).order('start_time', { ascending: true }),
            supabase.from('comandas').select('client_id, total').eq('tenant_id', tenantId).eq('status', 'paid')
        ]);

        const rawClients = clientsRes.data || [];
        const rawAppts = apptRes.data || [];
        const rawComandas = (comandasRes as any)?.data || [];

        // Group appointments by client
        const apptMap: Record<string, string[]> = {};
        for (const appt of rawAppts) {
            if (!apptMap[appt.client_id]) apptMap[appt.client_id] = [];
            apptMap[appt.client_id].push(appt.start_time);
        }

        // Group spending by client
        const spendMap: Record<string, number> = {};
        for (const cmd of rawComandas) {
            if (cmd.client_id) {
                spendMap[cmd.client_id] = (spendMap[cmd.client_id] || 0) + (Number(cmd.total) || 0);
            }
        }

        const now = new Date();
        const enriched: ClientReturnData[] = rawClients.map(c => {
            const dates = apptMap[c.id] || (c.last_visit ? [c.last_visit] : []);
            const avg = calcAvgReturn(dates);
            const daysSince = c.last_visit ? daysBetween(c.last_visit, now) : 999;
            const status = getStatus(daysSince, avg);
            const overdueDays = Math.max(0, daysSince - avg);

            return {
                id: c.id,
                name: c.name,
                phone: c.phone || '',
                email: c.email || '',
                avatar: c.avatar || '',
                last_visit: c.last_visit || '',
                avg_return_days: avg,
                days_since_last: daysSince,
                status,
                overdue_days: overdueDays,
                total_appointments: dates.length,
                total_spent: spendMap[c.id] || Number(c.total_spent) || 0,
            };
        });

        setClients(enriched);
        setLoading(false);
    }, [tenantId]);

    useEffect(() => { fetch(); }, [fetch]);

    /* ─── Derived Data ───────────────────────────────────────── */
    const kpis = useMemo(() => {
        const overdue = clients.filter(c => c.status === 'overdue');
        const attention = clients.filter(c => c.status === 'attention');
        const avgTicket = clients.reduce((s, c) => s + c.total_spent, 0) / (clients.length || 1);
        const estimatedRecovery = overdue.length * avgTicket;
        return {
            total: clients.length,
            overdue: overdue.length,
            attention: attention.length,
            estimatedRecovery,
        };
    }, [clients]);

    const filtered = useMemo(() => {
        return clients
            .filter(c => {
                const matchFilter = filter === 'all' || c.status === filter;
                const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search);
                return matchFilter && matchSearch;
            })
            .sort((a, b) => {
                if (sortBy === 'overdue') return b.overdue_days - a.overdue_days;
                if (sortBy === 'avg') return b.avg_return_days - a.avg_return_days;
                return a.name.localeCompare(b.name);
            });
    }, [clients, filter, search, sortBy]);

    const fmt = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

    /* ─── Render ─────────────────────────────────────────────── */
    return (
        <div className="space-y-8 animate-fade-in pb-12">

            {/* Header */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 dark:from-black dark:via-[#0d0d0d] dark:to-black border border-white/10 p-8 shadow-2xl">
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute top-0 right-0 w-72 h-72 bg-primary/10 rounded-full blur-[80px] -mr-20 -mt-20" />
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-[60px] -ml-10 -mb-10" />
                </div>
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="size-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
                                <span className="material-symbols-outlined text-primary text-xl">psychology</span>
                            </div>
                            <span className="px-3 py-1 bg-primary/20 border border-primary/30 text-primary text-[10px] font-black uppercase tracking-[0.2em] rounded-full">Smart Return Engine</span>
                        </div>
                        <h2 className="text-3xl font-black text-white tracking-tight">Motor de Retorno Inteligente</h2>
                        <p className="text-slate-400 mt-2 max-w-lg leading-relaxed">
                            Identificamos automaticamente quais clientes estão demorando para voltar. Aja agora e recupere faturamento.
                        </p>
                    </div>
                    <button onClick={fetch} className="flex items-center gap-2 px-5 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-sm font-bold transition-all group">
                        <span className="material-symbols-outlined text-sm group-hover:rotate-180 transition-transform duration-500">refresh</span>
                        Atualizar
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { icon: 'group', label: 'Clientes Ativos', value: kpis.total.toString(), color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20' },
                    { icon: 'warning', label: 'Clientes Atrasados', value: kpis.overdue.toString(), color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20', highlight: kpis.overdue > 0 },
                    { icon: 'schedule', label: 'Próximos de Voltar', value: kpis.attention.toString(), color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
                    { icon: 'trending_up', label: 'Faturamento Estimado', value: fmt(kpis.estimatedRecovery), color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
                ].map((kpi, i) => (
                    <div key={i} className={`card-boutique p-5 relative overflow-hidden ${kpi.highlight ? 'ring-1 ring-red-500/30' : ''}`}>
                        <div className={`size-11 rounded-xl ${kpi.bg} border ${kpi.border} flex items-center justify-center mb-3`}>
                            <span className={`material-symbols-outlined ${kpi.color}`}>{kpi.icon}</span>
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">{kpi.label}</p>
                        <p className={`text-2xl font-black ${kpi.color}`}>{kpi.value}</p>
                        {kpi.highlight && <div className="absolute top-3 right-3 size-2 bg-red-500 rounded-full animate-pulse" />}
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="card-boutique p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="relative flex-1 w-full">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                    <input
                        type="text"
                        placeholder="Buscar por nome ou telefone..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        title="Buscar clientes"
                        className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                    />
                </div>
                <div className="flex items-center gap-2 overflow-x-auto">
                    {([
                        { v: 'all', l: 'Todos', count: kpis.total },
                        { v: 'overdue', l: '🔴 Atrasados', count: kpis.overdue },
                        { v: 'attention', l: '🟡 Atenção', count: kpis.attention },
                        { v: 'normal', l: '🟢 Normal', count: kpis.total - kpis.overdue - kpis.attention },
                    ] as { v: FilterStatus; l: string; count: number }[]).map(f => (
                        <button key={f.v} onClick={() => setFilter(f.v)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${filter === f.v
                                ? 'bg-primary text-white shadow-md shadow-primary/20'
                                : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'
                                }`}>
                            {f.l} <span className={`size-4 inline-flex items-center justify-center rounded-full text-[9px] font-black ${filter === f.v ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-white/10'}`}>{f.count}</span>
                        </button>
                    ))}
                    <select title="Ordenar por" value={sortBy} onChange={e => setSortBy(e.target.value as any)}
                        className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-white/5 border-0 text-slate-600 dark:text-slate-400 outline-none [color-scheme:light] dark:[color-scheme:dark]">
                        <option value="overdue">Mais atrasado</option>
                        <option value="avg">Maior padrão</option>
                        <option value="name">Nome A-Z</option>
                    </select>
                </div>
            </div>

            {/* Main Table */}
            <div className="card-boutique overflow-hidden">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                        <p className="text-sm text-slate-500 font-medium">Analisando comportamento dos clientes...</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
                        <span className="material-symbols-outlined text-5xl text-emerald-500">check_circle</span>
                        <p className="text-base font-bold text-slate-700 dark:text-white">Nenhum cliente neste filtro!</p>
                        <p className="text-sm text-slate-500">Todos os seus clientes estão dentro do padrão.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="text-left text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 dark:bg-white/[0.03] border-b border-slate-100 dark:border-white/5">
                                    <th className="px-6 py-4">Cliente</th>
                                    <th className="px-6 py-4 hidden md:table-cell">Última Visita</th>
                                    <th className="px-6 py-4 hidden sm:table-cell">Padrão</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                {filtered.map(client => (
                                    <tr key={client.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="size-9 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0 overflow-hidden border border-slate-100 dark:border-white/5 flex items-center justify-center font-black text-slate-500 dark:text-slate-400 text-sm">
                                                    {client.avatar
                                                        ? <img src={client.avatar} alt={client.name} className="size-full object-cover" />
                                                        : client.name[0]?.toUpperCase()
                                                    }
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-900 dark:text-white">{client.name}</p>
                                                    <p className="text-[10px] text-slate-500">{client.phone || 'Sem telefone'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 hidden md:table-cell">
                                            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                                {client.last_visit ? `${client.days_since_last} dias atrás` : 'Sem visita'}
                                            </p>
                                            <p className="text-[10px] text-slate-500">
                                                {client.last_visit ? new Date(client.last_visit).toLocaleDateString('pt-BR') : '—'}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4 hidden sm:table-cell">
                                            <div className="flex items-center gap-2">
                                                <div className="size-7 rounded-full border-2 border-primary/30 flex items-center justify-center">
                                                    <span className="text-[9px] font-black text-primary">{client.avg_return_days}d</span>
                                                </div>
                                                <span className="text-[10px] text-slate-500">{client.total_appointments} visitas</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <StatusBadge status={client.status} overdueDays={client.overdue_days} />
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-1">
                                                {/* Quick Schedule */}
                                                <button
                                                    onClick={() => navigate(`/schedule?clientId=${client.id}&clientName=${encodeURIComponent(client.name)}`)}
                                                    title="Agendar rápido"
                                                    className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                                >
                                                    <span className="material-symbols-outlined text-lg">calendar_add_on</span>
                                                </button>
                                                {/* WhatsApp */}
                                                {client.phone && (
                                                    <button
                                                        onClick={() => openAnalysisModal(client)}
                                                        title="Enviar WhatsApp"
                                                        className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                                                    >
                                                        <span className="material-symbols-outlined text-lg">chat</span>
                                                    </button>
                                                )}
                                                {/* Coupon */}
                                                <button
                                                    onClick={() => openCouponModal(client)}
                                                    title="Gerar cupom de retorno"
                                                    className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                                                >
                                                    <span className="material-symbols-outlined text-lg">local_offer</span>
                                                </button>
                                                {/* Details */}
                                                <button
                                                    onClick={() => openAnalysisModal(client)}
                                                    title="Ver análise completa"
                                                    className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <span className="material-symbols-outlined text-lg">analytics</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Info Block */}
            <div className="card-boutique p-6 bg-gradient-to-r from-primary/5 to-emerald-500/5 border-primary/20">
                <div className="flex items-start gap-4">
                    <div className="size-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-primary">lightbulb</span>
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-900 dark:text-white mb-1">Como funciona o algoritmo?</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                            O sistema analisa os últimos agendamentos de cada cliente e calcula o <strong className="text-primary">intervalo médio de retorno</strong>. Quando um cliente ultrapassa esse intervalo (com uma tolerância de 25%), ele entra no alerta de <strong className="text-red-500">Atrasado</strong>. Clientes próximos da marca entram em <strong className="text-amber-500">Atenção</strong>. Use as ações para enviar lembretes via WhatsApp, gerar cupons de incentivo ou agendar diretamente.
                        </p>
                    </div>
                </div>
            </div>

            {/* ─── Modal: Cupom de Retorno ─────────────────────────── */}
            <Modal
                isOpen={!!couponClient}
                onClose={() => setCouponClient(null)}
                title="Cupom de Retorno"
                maxWidth="sm"
            >
                {couponClient && (
                    <div className="space-y-5">
                        <div className="relative overflow-hidden rounded-2xl border border-dashed border-primary/40 bg-gradient-to-br from-primary/5 to-emerald-500/5 p-6 text-center">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full blur-2xl -mr-8 -mt-8" />
                            <span className="material-symbols-outlined text-4xl text-primary mb-2 block">local_offer</span>
                            <p className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-1">Cupom Especial</p>
                            <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">{couponClient.name.split(' ')[0]}, sentimos sua falta!</h3>
                            <div className="mt-4 px-4 py-3 bg-primary text-white rounded-xl">
                                <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Código do Cupom</p>
                                <p className="text-3xl font-black tracking-tighter mt-0.5">VOLTA10</p>
                            </div>
                            <p className="text-sm text-slate-500 mt-3">10% de desconto na próxima visita<br />Válido por 7 dias</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl text-center">
                                <p className="text-[10px] font-black uppercase text-slate-500">Última visita</p>
                                <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">{couponClient.days_since_last} dias atrás</p>
                            </div>
                            <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl text-center">
                                <p className="text-[10px] font-black uppercase text-slate-500">Padrão médio</p>
                                <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">A cada {couponClient.avg_return_days} dias</p>
                            </div>
                        </div>
                        <div className="space-y-1 mt-4">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1"><span className="material-symbols-outlined text-sm">edit</span> Editar Mensagem (WhatsApp)</label>
                            <textarea
                                value={whatsappMessage}
                                onChange={(e) => setWhatsappMessage(e.target.value)}
                                className="w-full h-32 p-3 text-sm bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-emerald-500 resize-none custom-scrollbar font-medium"
                            />
                        </div>
                        {couponClient.phone && (
                            <a
                                href={`https://wa.me/55${couponClient.phone.replace(/\D/g, '')}?text=${encodeURIComponent(whatsappMessage)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-500/20"
                            >
                                <span className="material-symbols-outlined text-lg">chat</span>
                                Enviar cupom via WhatsApp
                            </a>
                        )}
                        <button onClick={() => setCouponClient(null)}
                            className="w-full py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl transition-colors">
                            Fechar
                        </button>
                    </div>
                )}
            </Modal>

            {/* ─── Modal: Análise do Cliente ──────────────────────── */}
            <Modal
                isOpen={!!selectedClient}
                onClose={() => setSelectedClient(null)}
                title="Análise de Retorno"
                maxWidth="sm"
            >
                {selectedClient && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-white/5 rounded-xl">
                            <div className="size-14 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden border-2 border-primary/30 flex items-center justify-center font-black text-slate-500 text-xl">
                                {selectedClient.avatar
                                    ? <img src={selectedClient.avatar} alt={selectedClient.name} className="size-full object-cover" />
                                    : selectedClient.name[0]?.toUpperCase()
                                }
                            </div>
                            <div>
                                <h4 className="font-black text-slate-900 dark:text-white text-lg">{selectedClient.name}</h4>
                                <StatusBadge status={selectedClient.status} overdueDays={selectedClient.overdue_days} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { icon: 'schedule', label: 'Dias desde a visita', value: `${selectedClient.days_since_last}d` },
                                { icon: 'repeat', label: 'Padrão de retorno', value: `${selectedClient.avg_return_days}d` },
                                { icon: 'event_note', label: 'Total de visitas', value: selectedClient.total_appointments.toString() },
                                { icon: 'payments', label: 'Total gasto', value: `R$ ${(selectedClient.total_spent || 0).toFixed(2)}` },
                            ].map((stat, i) => (
                                <div key={i} className="p-4 bg-slate-50 dark:bg-white/5 rounded-xl">
                                    <span className="material-symbols-outlined text-primary text-lg block mb-1">{stat.icon}</span>
                                    <p className="text-[10px] text-slate-500 uppercase font-black tracking-wider">{stat.label}</p>
                                    <p className="text-lg font-black text-slate-900 dark:text-white mt-0.5">{stat.value}</p>
                                </div>
                            ))}
                        </div>
                        {/* Diagnostic bar */}
                        <div>
                            <div className="flex items-center justify-between text-xs mb-1.5">
                                <span className="text-slate-500 font-bold">Termômetro de Retorno</span>
                                <span className={`font-black ${selectedClient.status === 'overdue' ? 'text-red-500' : selectedClient.status === 'attention' ? 'text-amber-500' : 'text-emerald-500'}`}>
                                    {Math.round((selectedClient.days_since_last / (selectedClient.avg_return_days * 1.5)) * 100)}%
                                </span>
                            </div>
                            <div className="w-full rounded-full h-2.5 bg-slate-200 dark:bg-white/10 overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all ${selectedClient.status === 'overdue' ? 'bg-red-500' : selectedClient.status === 'attention' ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                    style={{ width: `${Math.min(100, Math.round((selectedClient.days_since_last / (selectedClient.avg_return_days * 1.5)) * 100))}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-[9px] text-slate-400 mt-1">
                                <span>Normal</span>
                                <span>Atenção</span>
                                <span>Atrasado</span>
                            </div>
                        </div>

                        <div className="space-y-1 mt-4">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1"><span className="material-symbols-outlined text-sm">edit</span> Mensagem de Retorno (WhatsApp)</label>
                            <textarea
                                value={whatsappMessage}
                                onChange={(e) => setWhatsappMessage(e.target.value)}
                                className="w-full h-24 p-3 text-sm bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-emerald-500 resize-none custom-scrollbar font-medium"
                            />
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button onClick={() => { setSelectedClient(null); navigate(`/schedule?clientId=${selectedClient.id}&clientName=${encodeURIComponent(selectedClient.name)}`); }}
                                className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/20">
                                <span className="material-symbols-outlined text-lg">calendar_add_on</span>
                                Agendar
                            </button>
                            {selectedClient.phone && (
                                <a href={`https://wa.me/55${selectedClient.phone.replace(/\D/g, '')}?text=${encodeURIComponent(whatsappMessage)}`} target="_blank" rel="noopener noreferrer"
                                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-500/20">
                                    <span className="material-symbols-outlined text-lg">chat</span>
                                    Enviar Whats
                                </a>
                            )}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default SmartReturn;
