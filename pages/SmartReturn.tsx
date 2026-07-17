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
        returning: { label: 'Retorno', icon: 'undo', cls: 'bg-[#EAF7FF] dark:bg-[#0D2238] text-[#007BFF] dark:text-[#72E7FF] border border-[#00D2FF]/25' },
        risk: { label: 'Atenção', icon: 'warning', cls: 'bg-[#FFF6E5] dark:bg-[#2B2110] text-[#9A6F2D] dark:text-[#E3C382] border border-[#B88A44]/30' },
        inactive: { label: 'Inativo', icon: 'person_off', cls: 'bg-rose-50 dark:bg-rose-950/25 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50' },
    };
    const { label, icon, cls } = map[category];
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap ${cls}`}>
            <span className="material-symbols-outlined text-sm">{icon}</span>
            {label}
        </span>
    );
};

/* ─── Main Component ─────────────────────────────────────────── */
const SmartReturn: React.FC = () => {
    const navigate = useNavigate();
    const { tenantId, tenant } = useAuth();

    const [allClients, setAllClients] = useState<SmartReturnClient[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<ActiveTab>('returning');
    const [search, setSearch] = useState('');

    const [selectedClient, setSelectedClient] = useState<SmartReturnClient | null>(null);
    const [whatsappMessage, setWhatsappMessage] = useState('');

    const shopName = tenant?.name?.trim();
    const defaultMessage = useMemo(() => (
        shopName
            ? `Olá, {nome}! Aqui é da ${shopName}. Faz um tempinho que você não aparece por aqui. Que tal agendar seu próximo atendimento essa semana?`
            : 'Olá, {nome}! Aqui é da sua barbearia. Faz um tempinho que você não aparece por aqui. Que tal agendar seu próximo atendimento essa semana?'
    ), [shopName]);

    /* ─── Fetch ────────────────────────────────────────────────── */
    const fetch = useCallback(async () => {
        setLoading(true);
        if (!tenantId) {
            setAllClients([]);
            setLoading(false);
            return;
        }

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
            <div className="relative overflow-hidden rounded-2xl border border-[#D9EAF5] bg-[linear-gradient(135deg,#F8FBFF_0%,#EEF7FF_58%,#F7F2EA_100%)] p-6 shadow-sm dark:border-white/10 dark:bg-[linear-gradient(135deg,#06182F_0%,#08284D_58%,#14100A_100%)]">
                <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#007BFF,#00D2FF,#B88A44)]" />
                <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="size-10 rounded-xl bg-[#007BFF]/10 border border-[#00D2FF]/30 flex items-center justify-center">
                                <span className="material-symbols-outlined text-[#007BFF] dark:text-[#00D2FF] text-xl">psychology</span>
                            </div>
                            <span className="px-3 py-1 bg-white/75 dark:bg-white/10 border border-[#007BFF]/20 dark:border-[#00D2FF]/25 text-[#003366] dark:text-[#9DEBFF] text-[11px] font-black rounded-full">SMG Motor de Retorno</span>
                        </div>
                        <h2 className="text-2xl md:text-3xl font-black text-slate-950 dark:text-white">Motor de Retorno Inteligente</h2>
                        <p className="text-slate-600 dark:text-slate-300 mt-2 max-w-2xl leading-6 text-sm">
                            Clientes reais sem agendamento futuro, organizados pelo tempo desde a última visita para reativar a cadeira antes que o vínculo esfrie.
                        </p>
                    </div>
                    <button onClick={fetch} className="flex items-center justify-center gap-2 px-5 py-3 bg-[#007BFF] hover:bg-[#006ADF] text-white rounded-xl text-sm font-bold transition-all group shadow-sm shadow-[#007BFF]/20">
                        <span className="material-symbols-outlined text-sm group-hover:rotate-180 transition-transform duration-500">refresh</span>
                        Atualizar
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {([
                    { key: 'returning' as SmartReturnCategory, icon: 'undo', label: 'Retorno', desc: '30-60 dias', color: 'text-[#007BFF] dark:text-[#72E7FF]', bg: 'bg-[#007BFF]/10', border: 'border-[#00D2FF]/25' },
                    { key: 'risk' as SmartReturnCategory, icon: 'warning', label: 'Atenção', desc: '61-90 dias', color: 'text-[#9A6F2D] dark:text-[#E3C382]', bg: 'bg-[#B88A44]/15', border: 'border-[#B88A44]/30' },
                    { key: 'inactive' as SmartReturnCategory, icon: 'person_off', label: 'Inativo', desc: '+90 dias', color: 'text-rose-600 dark:text-rose-300', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
                ] as { key: SmartReturnCategory; icon: string; label: string; desc: string; color: string; bg: string; border: string }[]).map((kpi) => (
                    <div key={kpi.key} className="card-boutique p-5">
                        <div className={`size-11 rounded-xl ${kpi.bg} border ${kpi.border} flex items-center justify-center mb-3`}>
                            <span className={`material-symbols-outlined ${kpi.color}`}>{kpi.icon}</span>
                        </div>
                        <p className="text-[11px] font-black text-slate-500 mb-1">{kpi.label}</p>
                        <p className={`text-2xl font-black ${kpi.color}`}>{kpis[kpi.key]}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{kpi.desc}</p>
                    </div>
                ))}
            </div>

            {/* Tabs + Search */}
            <div className="card-boutique p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex items-center gap-2 overflow-x-auto">
                    {([
                        { key: 'returning' as SmartReturnCategory, label: 'Retorno', count: kpis.returning },
                        { key: 'risk' as SmartReturnCategory, label: 'Atenção', count: kpis.risk },
                        { key: 'inactive' as SmartReturnCategory, label: 'Inativos', count: kpis.inactive },
                        { key: 'all' as ActiveTab, label: 'Todos', count: allClients.length },
                    ] as { key: ActiveTab; label: string; count: number }[]).map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${activeTab === tab.key
                                ? 'bg-[#007BFF] text-white shadow-md shadow-[#007BFF]/20'
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
                        className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-[#007BFF]"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="card-boutique overflow-hidden">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#007BFF]" />
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
                                <tr className="text-left text-[11px] font-black text-slate-500 bg-slate-50 dark:bg-white/[0.03] border-b border-slate-100 dark:border-white/5">
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
                                                    className="p-2 text-slate-400 hover:text-[#007BFF] hover:bg-[#007BFF]/10 rounded-lg transition-colors"
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
                            <label className="text-[11px] font-black text-slate-500 flex items-center gap-1">
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
