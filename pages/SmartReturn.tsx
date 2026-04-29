import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import Modal from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';
import { buildSmartReturnClients } from '../src/modules/dashboard/selectors';
import type { SmartReturnClient, SmartReturnCategory } from '../src/modules/dashboard/types';
import { buildWhatsAppUrl } from '../src/lib/utils/phone';

/* ─── Types ─────────────────────────────────────────────────── */
type ActiveTab = SmartReturnCategory | 'all';

/* ─── Badge components ───────────────────────────────────────── */
const CategoryBadge: React.FC<{ category: SmartReturnCategory }> = ({ category }) => {
    const map = {
        returning: { label: '🔵 Retorno', cls: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700/50' },
        risk: { label: '🟠 Risco', cls: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-700/50' },
        inactive: { label: '🔴 Inativo', cls: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-700/50' },
    };
    const { label, cls } = map[category];
    return <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider whitespace-nowrap ${cls}`}>{label}</span>;
};

/* ─── Main Component ─────────────────────────────────────────── */
const SmartReturn: React.FC = () => {
    const navigate = useNavigate();
    const { tenantId } = useAuth();

    const [allClients, setAllClients] = useState<SmartReturnClient[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<ActiveTab>('returning');
    const [search, setSearch] = useState('');

    const [selectedClient, setSelectedClient] = useState<SmartReturnClient | null>(null);
    const [whatsappMessage, setWhatsappMessage] = useState('');

    const defaultMessage = 'Olá, {nome}! Aqui é da Sanchez Barber. Faz um tempinho que você não aparece por aqui. Que tal agendar seu próximo atendimento essa semana?';

    /* ─── Fetch ────────────────────────────────────────────────── */
    const fetch = useCallback(async () => {
        setLoading(true);
        const [clientsRes, appointmentsRes] = await Promise.all([
            supabase
                .from('clients')
                .select('id, name, phone, email, avatar, last_visit')
                .eq('status', 'active')
                .eq('tenant_id', tenantId),
            supabase
                .from('appointments')
                .select('client_id, start_time')
                .eq('tenant_id', tenantId)
                .in('status', ['completed', 'confirmed'])
                .order('start_time', { ascending: true }),
        ]);

        const rawClients = (clientsRes.data || []) as any[];
        const rawAppointments = (appointmentsRes.data || []) as any[];

        const upcomingAppointmentsRes = await supabase
            .from('appointments')
            .select('client_id')
            .eq('tenant_id', tenantId)
            .gte('start_time', new Date().toISOString())
            .in('status', ['pending', 'confirmed']);

        const upcomingClientIds = new Set(
            (upcomingAppointmentsRes.data || [])
                .map((a: any) => a.client_id)
                .filter(Boolean)
        );

        const enriched = buildSmartReturnClients({
            clients: rawClients.map(c => ({ id: c.id, name: c.name, phone: c.phone || '', email: c.email || '', avatar: c.avatar || null, last_visit: c.last_visit })),
            appointments: rawAppointments,
            upcomingClientIds,
        });

        setAllClients(enriched);
        setLoading(false);
    }, [tenantId]);

    useEffect(() => { fetch(); }, [fetch]);

    /* ─── Derived ──────────────────────────────────────────────── */
    const kpis = useMemo(() => {
        return {
            returning: allClients.filter(c => c.category === 'returning').length,
            risk: allClients.filter(c => c.category === 'risk').length,
            inactive: allClients.filter(c => c.category === 'inactive').length,
        };
    }, [allClients]);

    const filtered = useMemo(() => {
        return allClients
            .filter(c => activeTab === 'all' || c.category === activeTab)
            .filter(c =>
                c.name.toLowerCase().includes(search.toLowerCase()) ||
                c.phone.includes(search)
            )
            .sort((a, b) => b.daysSinceVisit - a.daysSinceVisit);
    }, [allClients, activeTab, search]);

    /* ─── Actions ──────────────────────────────────────────────── */
    const openWhatsAppModal = (client: SmartReturnClient) => {
        setSelectedClient(client);
        setWhatsappMessage(defaultMessage.replace('{nome}', client.name.split(' ')[0]));
    };

    /* ─── Render ──────────────────────────────────────────────── */
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
                            Clientes classificados por tempo desde última visita. Sem agendamento futuro.
                        </p>
                    </div>
                    <button onClick={fetch} className="flex items-center gap-2 px-5 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-sm font-bold transition-all group">
                        <span className="material-symbols-outlined text-sm group-hover:rotate-180 transition-transform duration-500">refresh</span>
                        Atualizar
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-3 gap-4">
                {([
                    { key: 'returning' as SmartReturnCategory, icon: 'undo', label: 'Retorno', desc: '30-60 dias', color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
                    { key: 'risk' as SmartReturnCategory, icon: 'warning', label: 'Risco', desc: '61-90 dias', color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
                    { key: 'inactive' as SmartReturnCategory, icon: 'person_off', label: 'Inativo', desc: '+90 dias', color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20' },
                ] as { key: SmartReturnCategory; icon: string; label: string; desc: string; color: string; bg: string; border: string }[]).map((kpi) => (
                    <div key={kpi.key} className="card-boutique p-5">
                        <div className={`size-11 rounded-xl ${kpi.bg} border ${kpi.border} flex items-center justify-center mb-3`}>
                            <span className={`material-symbols-outlined ${kpi.color}`}>{kpi.icon}</span>
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">{kpi.label}</p>
                        <p className={`text-2xl font-black ${kpi.color}`}>{kpis[kpi.key]}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{kpi.desc}</p>
                    </div>
                ))}
            </div>

            {/* Tabs + Search */}
            <div className="card-boutique p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex items-center gap-2 overflow-x-auto">
                    {([
                        { key: 'returning' as SmartReturnCategory, label: '🔵 Retorno', count: kpis.returning },
                        { key: 'risk' as SmartReturnCategory, label: '🟠 Risco', count: kpis.risk },
                        { key: 'inactive' as SmartReturnCategory, label: '🔴 Inativo', count: kpis.inactive },
                        { key: 'all' as ActiveTab, label: 'Todos', count: allClients.length },
                    ] as { key: ActiveTab; label: string; count: number }[]).map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${activeTab === tab.key
                                ? 'bg-primary text-white shadow-md shadow-primary/20'
                                : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'
                            }`}
                        >
                            {tab.label} <span className={`size-4 inline-flex items-center justify-center rounded-full text-[9px] font-black ${activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-white/10'}`}>{tab.count}</span>
                        </button>
                    ))}
                </div>
                <div className="relative flex-1 w-full sm:max-w-xs">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                    <input
                        type="text"
                        placeholder="Buscar por nome ou telefone..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="card-boutique overflow-hidden">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                        <p className="text-sm text-slate-500 font-medium">Analisando comportamento dos clientes...</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
                        <span className="material-symbols-outlined text-5xl text-slate-300">person_search</span>
                        <p className="text-base font-bold text-slate-700 dark:text-white">Nenhum cliente nesta categoria</p>
                        <p className="text-sm text-slate-500">Todos os clientes estão em dia ou já possuem agendamento futuro.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="text-left text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 dark:bg-white/[0.03] border-b border-slate-100 dark:border-white/5">
                                    <th className="px-6 py-4">Cliente</th>
                                    <th className="px-6 py-4">Última Visita</th>
                                    <th className="px-6 py-4">Categoria</th>
                                    <th className="px-6 py-4 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                {filtered.map(client => (
                                    <tr key={client.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="size-9 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0 flex items-center justify-center font-black text-slate-500 dark:text-slate-400 text-sm">
                                                    {client.name[0]?.toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-900 dark:text-white">{client.name}</p>
                                                    <p className="text-[10px] text-slate-500">{client.phone || 'Sem telefone'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                                {client.daysSinceVisit} dias atrás
                                            </p>
                                            <p className="text-[10px] text-slate-500">
                                                {new Date(client.lastVisit).toLocaleDateString('pt-BR')}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <CategoryBadge category={client.category} />
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    onClick={() => navigate(`/schedule?clientId=${client.id}&clientName=${encodeURIComponent(client.name)}`)}
                                                    title="Agendar"
                                                    className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                                >
                                                    <span className="material-symbols-outlined text-lg">calendar_add_on</span>
                                                </button>
                                                {client.phone ? (
                                                    <button
                                                        onClick={() => openWhatsAppModal(client)}
                                                        title="Enviar WhatsApp"
                                                        className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                                                    >
                                                        <span className="material-symbols-outlined text-lg">chat</span>
                                                    </button>
                                                ) : (
                                                    <span title="Sem telefone" className="p-2 text-slate-300 dark:text-slate-600 cursor-not-allowed">
                                                        <span className="material-symbols-outlined text-lg">chat</span>
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* WhatsApp Modal */}
            <Modal
                isOpen={!!selectedClient}
                onClose={() => setSelectedClient(null)}
                title="Enviar WhatsApp"
                maxWidth="sm"
            >
                {selectedClient && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-white/5 rounded-xl">
                            <div className="size-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-black text-slate-500 text-lg">
                                {selectedClient.name[0]?.toUpperCase()}
                            </div>
                            <div>
                                <h4 className="font-black text-slate-900 dark:text-white">{selectedClient.name}</h4>
                                <p className="text-xs text-slate-500">{selectedClient.phone || 'Sem telefone'}</p>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm">edit</span> Mensagem
                            </label>
                            <textarea
                                value={whatsappMessage}
                                onChange={e => setWhatsappMessage(e.target.value)}
                                className="w-full h-28 p-3 text-sm bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-emerald-500 resize-none custom-scrollbar font-medium"
                            />
                        </div>
                        {selectedClient.phone && (
                            <a
                                href={buildWhatsAppUrl(selectedClient.name, selectedClient.phone, whatsappMessage) || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-500/20"
                            >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                                Abrir WhatsApp
                            </a>
                        )}
                        <button onClick={() => setSelectedClient(null)} className="w-full py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl transition-colors">
                            Fechar
                        </button>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default SmartReturn;