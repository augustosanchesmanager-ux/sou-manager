import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';
import { fetchSmartReturnData } from '../src/modules/smartReturn/smartReturnService';
import type {
    SmartReturnData,
    SmartReturnFilterTab,
    SmartReturnInactivityStatus,
    SmartReturnKPIs,
    SmartReturnRecord,
} from '../src/modules/smartReturn/types';
import { buildWhatsAppUrl } from '../src/lib/utils/phone';

/* ─── Badge Components ───────────────────────────────────────── */
const InactivityBadge: React.FC<{ status: SmartReturnInactivityStatus }> = ({ status }) => {
    const map = {
        up_to_date: {
            label: 'No Prazo',
            icon: 'check_circle',
            cls: 'bg-emerald-50 dark:bg-emerald-950/25 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25',
        },
        attention: {
            label: 'Janela de Retorno',
            icon: 'schedule',
            cls: 'bg-teal-50 dark:bg-teal-950/25 text-teal-700 dark:text-teal-400 border border-teal-500/25',
        },
        risk: {
            label: 'Em Risco',
            icon: 'warning',
            cls: 'bg-[#FFF6E5] dark:bg-[#2B2110] text-[#9A6F2D] dark:text-[#E3C382] border border-[#B88A44]/30',
        },
        inactive: {
            label: 'Inativo',
            icon: 'person_off',
            cls: 'bg-rose-50 dark:bg-rose-950/25 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50',
        },
    };
    const { label, icon, cls } = map[status] || map.inactive;
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

    const [data, setData] = useState<SmartReturnData>({
        records: [],
        kpis: { totalClients: 0, upToDate: 0, attention: 0, risk: 0, inactive: 0 },
        publicBookingUrl: null,
        shopName: tenant?.name?.trim() || 'Barbearia',
    });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<SmartReturnFilterTab>('attention');
    const [search, setSearch] = useState('');

    const [selectedClient, setSelectedClient] = useState<SmartReturnRecord | null>(null);
    const [whatsappMessage, setWhatsappMessage] = useState('');

    /* ─── Fetch Data (via SmartReturnService - Zero .from() in UI) ─ */
    const loadSmartReturn = useCallback(async () => {
        setLoading(true);
        if (!tenantId) {
            setData({
                records: [],
                kpis: { totalClients: 0, upToDate: 0, attention: 0, risk: 0, inactive: 0 },
                publicBookingUrl: null,
                shopName: '',
            });
            setLoading(false);
            return;
        }

        try {
            const res = await fetchSmartReturnData({
                tenantId,
                tenantSlug: tenant?.slug,
                shopName: tenant?.name?.trim(),
            });
            setData(res);
        } catch (error) {
            console.error('Erro ao carregar dados do Motor de Retorno:', error);
        } finally {
            setLoading(false);
        }
    }, [tenantId, tenant?.slug, tenant?.name]);

    useEffect(() => {
        loadSmartReturn();
    }, [loadSmartReturn]);

    /* ─── Derived Records ───────────────────────────────────────── */
    const filteredRecords = useMemo(() => {
        const query = search.trim().toLowerCase();
        return data.records
            .filter((c) => activeTab === 'all' || c.status === activeTab)
            .filter((c) => {
                if (!query) return true;
                return (
                    c.name.toLowerCase().includes(query) ||
                    c.rawPhone.includes(query) ||
                    c.phone.toLowerCase().includes(query) ||
                    (c.lastStaffName && c.lastStaffName.toLowerCase().includes(query))
                );
            });
    }, [data.records, activeTab, search]);

    /* ─── Modal Actions ─────────────────────────────────────────── */
    const handleOpenWhatsAppModal = (client: SmartReturnRecord) => {
        setSelectedClient(client);
        setWhatsappMessage(client.suggestedMessage);
    };

    const finalWhatsAppUrl = useMemo(() => {
        if (!selectedClient) return null;
        return buildWhatsAppUrl(selectedClient.name, selectedClient.rawPhone, whatsappMessage);
    }, [selectedClient, whatsappMessage]);

    return (
        <div className="space-y-8 animate-fade-in pb-12">
            {/* Header */}
            <div className="relative overflow-hidden rounded-2xl border border-line bg-[linear-gradient(135deg,#FFFDF6_0%,#FAF4E7_58%,#F7F2EA_100%)] p-6 shadow-sm dark:border-white/10 dark:bg-[linear-gradient(135deg,#0E0C07_0%,#1A150F_58%,#14100A_100%)]">
                <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#A96F14,#D99A2B,#F3D9A4)]" />
                <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="size-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
                                <span className="material-symbols-outlined text-primary-dark text-xl">psychology</span>
                            </div>
                            <span className="px-3 py-1 bg-white/75 dark:bg-white/10 border border-primary/20 dark:border-primary/30 text-ink text-[11px] font-black rounded-full">
                                SMG Retenção &amp; Recall
                            </span>
                            {data.publicBookingUrl && (
                                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold rounded-full">
                                    <span className="material-symbols-outlined text-xs">link</span>
                                    Agendamento Online Ativo
                                </span>
                            )}
                        </div>
                        <h2 className="text-2xl md:text-3xl font-black text-slate-950 dark:text-white">Motor de Retorno Inteligente</h2>
                        <p className="text-slate-600 dark:text-slate-300 mt-2 max-w-2xl leading-6 text-sm">
                            Inteligência preditiva para identificar clientes no ciclo ideal de retorno, evitar abandono e reativar clientes ausentes com links diretos de WhatsApp.
                        </p>
                    </div>
                    <button
                        onClick={loadSmartReturn}
                        disabled={loading}
                        className="flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-primary to-primary-dark hover:brightness-105 text-night rounded-xl text-sm font-bold transition-all group shadow-sm shadow-primary/20 disabled:opacity-50"
                    >
                        <span className={`material-symbols-outlined text-sm ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`}>
                            refresh
                        </span>
                        Atualizar
                    </button>
                </div>
            </div>

            {/* KPI Cards (4 tiers of inactivity) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div
                    onClick={() => setActiveTab('up_to_date')}
                    className={`card-boutique p-5 cursor-pointer transition-all hover:scale-[1.01] ${activeTab === 'up_to_date' ? 'ring-2 ring-emerald-500/50' : ''}`}
                >
                    <div className="size-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-3">
                        <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400">check_circle</span>
                    </div>
                    <p className="text-[11px] font-black text-slate-500 mb-1">No Prazo</p>
                    <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{data.kpis.upToDate}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">&lt; 20 dias da última visita</p>
                </div>

                <div
                    onClick={() => setActiveTab('attention')}
                    className={`card-boutique p-5 cursor-pointer transition-all hover:scale-[1.01] ${activeTab === 'attention' ? 'ring-2 ring-teal-500/50' : ''}`}
                >
                    <div className="size-11 rounded-xl bg-teal-500/10 border border-teal-500/25 flex items-center justify-center mb-3">
                        <span className="material-symbols-outlined text-teal-700 dark:text-teal-400">schedule</span>
                    </div>
                    <p className="text-[11px] font-black text-slate-500 mb-1">Janela de Retorno</p>
                    <p className="text-2xl font-black text-teal-700 dark:text-teal-400">{data.kpis.attention}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">20 a 35 dias (Momento Ideal)</p>
                </div>

                <div
                    onClick={() => setActiveTab('risk')}
                    className={`card-boutique p-5 cursor-pointer transition-all hover:scale-[1.01] ${activeTab === 'risk' ? 'ring-2 ring-[#B88A44]/50' : ''}`}
                >
                    <div className="size-11 rounded-xl bg-[#B88A44]/15 border border-[#B88A44]/30 flex items-center justify-center mb-3">
                        <span className="material-symbols-outlined text-[#9A6F2D] dark:text-[#E3C382]">warning</span>
                    </div>
                    <p className="text-[11px] font-black text-slate-500 mb-1">Em Risco</p>
                    <p className="text-2xl font-black text-[#9A6F2D] dark:text-[#E3C382]">{data.kpis.risk}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">36 a 60 dias (Atenção / Churn)</p>
                </div>

                <div
                    onClick={() => setActiveTab('inactive')}
                    className={`card-boutique p-5 cursor-pointer transition-all hover:scale-[1.01] ${activeTab === 'inactive' ? 'ring-2 ring-rose-500/50' : ''}`}
                >
                    <div className="size-11 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-3">
                        <span className="material-symbols-outlined text-rose-600 dark:text-rose-300">person_off</span>
                    </div>
                    <p className="text-[11px] font-black text-slate-500 mb-1">Inativo</p>
                    <p className="text-2xl font-black text-rose-600 dark:text-rose-300">{data.kpis.inactive}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">&gt; 60 dias (Resgate)</p>
                </div>
            </div>

            {/* Filter Tabs + Search */}
            <div className="card-boutique p-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 custom-scrollbar">
                    {([
                        { key: 'attention' as SmartReturnFilterTab, label: 'Janela de Retorno', count: data.kpis.attention, highlight: 'text-teal-700 dark:text-teal-400' },
                        { key: 'risk' as SmartReturnFilterTab, label: 'Em Risco', count: data.kpis.risk, highlight: 'text-[#9A6F2D] dark:text-[#E3C382]' },
                        { key: 'inactive' as SmartReturnFilterTab, label: 'Inativos', count: data.kpis.inactive, highlight: 'text-rose-500 dark:text-rose-400' },
                        { key: 'up_to_date' as SmartReturnFilterTab, label: 'No Prazo', count: data.kpis.upToDate, highlight: 'text-emerald-500' },
                        { key: 'all' as SmartReturnFilterTab, label: 'Todos', count: data.records.length, highlight: 'text-slate-400' },
                    ] as const).map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                                activeTab === tab.key
                                    ? 'bg-primary text-night shadow-md shadow-primary/20'
                                    : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'
                            }`}
                        >
                            {tab.label}
                            <span
                                className={`size-5 inline-flex items-center justify-center rounded-full text-[10px] font-black ${
                                    activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-white/10'
                                }`}
                            >
                                {tab.count}
                            </span>
                        </button>
                    ))}
                </div>

                <div className="relative w-full md:max-w-xs">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                    <input
                        type="text"
                        placeholder="Buscar cliente, telefone, barbeiro..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                    />
                </div>
            </div>

            {/* Records Table */}
            <div className="card-boutique overflow-hidden">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-dark" />
                        <p className="text-sm text-slate-500 font-medium">Analisando ciclo de retorno e histórico de atendimentos...</p>
                    </div>
                ) : filteredRecords.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
                        <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-700">person_search</span>
                        <p className="text-base font-bold text-slate-700 dark:text-white">Nenhum cliente encontrado</p>
                        <p className="text-sm text-slate-500">
                            {search ? 'Nenhum resultado corresponde à sua busca.' : 'Não há clientes nesta categoria de inatividade no momento.'}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="text-left text-[11px] font-black text-slate-500 bg-slate-50 dark:bg-white/[0.03] border-b border-slate-100 dark:border-white/5 uppercase tracking-wider">
                                    <th className="px-6 py-4">Cliente</th>
                                    <th className="px-6 py-4">Última Visita</th>
                                    <th className="px-6 py-4">Ciclo de Retorno</th>
                                    <th className="px-6 py-4 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                {filteredRecords.map((client) => (
                                    <tr key={client.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors group">
                                        {/* Client Info */}
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                {client.avatar ? (
                                                    <img
                                                        src={client.avatar}
                                                        alt={client.name}
                                                        className="size-10 rounded-full object-cover shrink-0 border border-slate-200 dark:border-white/10"
                                                    />
                                                ) : (
                                                    <div className="size-10 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0 flex items-center justify-center font-black text-slate-600 dark:text-slate-300 text-sm">
                                                        {client.name[0]?.toUpperCase() || 'C'}
                                                    </div>
                                                )}
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-sm font-bold text-slate-900 dark:text-white">{client.name}</p>
                                                        {client.isClubMember && (
                                                            <span
                                                                title={client.clubPlanName || 'Membro do Clube dos Chefes'}
                                                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black bg-[#B88A44]/15 text-[#9A6F2D] dark:text-[#E3C382] border border-[#B88A44]/30"
                                                            >
                                                                <span className="material-symbols-outlined text-xs">workspace_premium</span>
                                                                {client.clubPlanName || 'Clube'}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                                                        {client.phone || 'Sem telefone cadastrado'}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Last Visit */}
                                        <td className="px-6 py-4">
                                            <div className="space-y-0.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                                        {client.daysSinceLastVisit === 0 ? 'Hoje' : `${client.daysSinceLastVisit} dias atrás`}
                                                    </span>
                                                    {client.hasUpcomingAppointment && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                            <span className="material-symbols-outlined text-[11px]">event_available</span>
                                                            Agendado
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[11px] text-slate-500">
                                                    Data: {client.lastVisitFormatted}
                                                </p>
                                                {client.lastStaffName && (
                                                    <p className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-xs">content_cut</span>
                                                        {client.lastStaffName}
                                                    </p>
                                                )}
                                            </div>
                                        </td>

                                        {/* Inactivity Status */}
                                        <td className="px-6 py-4">
                                            <InactivityBadge status={client.status} />
                                        </td>

                                        {/* Actions */}
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() =>
                                                        navigate(
                                                            `/schedule?clientId=${client.id}&clientName=${encodeURIComponent(
                                                                client.name
                                                            )}`
                                                        )
                                                    }
                                                    title="Agendar horário na agenda"
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg transition-colors"
                                                >
                                                    <span className="material-symbols-outlined text-base">calendar_add_on</span>
                                                    <span className="hidden sm:inline">Agendar</span>
                                                </button>

                                                {client.isPhoneValid ? (
                                                    <>
                                                        <button
                                                            onClick={() => handleOpenWhatsAppModal(client)}
                                                            title="Personalizar e Enviar WhatsApp"
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-500/25 rounded-lg transition-colors"
                                                        >
                                                            <span className="material-symbols-outlined text-base">chat</span>
                                                            <span className="hidden sm:inline">WhatsApp</span>
                                                        </button>
                                                        {client.whatsAppUrl && (
                                                            <a
                                                                href={client.whatsAppUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                title="Envio Rápido via WhatsApp"
                                                                className="p-1.5 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                                                            >
                                                                <span className="material-symbols-outlined text-base">open_in_new</span>
                                                            </a>
                                                        )}
                                                    </>
                                                ) : (
                                                    <span
                                                        title="Telefone não informado ou inválido"
                                                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-slate-400 bg-slate-100 dark:bg-white/5 rounded-lg cursor-not-allowed"
                                                    >
                                                        <span className="material-symbols-outlined text-sm">phone_disabled</span>
                                                        Sem WhatsApp
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

            {/* WhatsApp Recall Modal */}
            <Modal
                isOpen={!!selectedClient}
                onClose={() => setSelectedClient(null)}
                title="Mensagem de Retorno Inteligente"
                maxWidth="md"
            >
                {selectedClient && (
                    <div className="space-y-5">
                        {/* Client Summary Box */}
                        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5">
                            <div className="flex items-center gap-3">
                                <div className="size-11 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-black text-slate-600 dark:text-slate-300 text-base">
                                    {selectedClient.name[0]?.toUpperCase()}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h4 className="font-black text-slate-900 dark:text-white text-base">{selectedClient.name}</h4>
                                        {selectedClient.isClubMember && (
                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-[#B88A44]/15 text-[#9A6F2D] dark:text-[#E3C382] border border-[#B88A44]/30">
                                                Clube
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 font-mono">{selectedClient.phone}</p>
                                </div>
                            </div>
                            <InactivityBadge status={selectedClient.status} />
                        </div>

                        {/* Message Preview and Editor */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-black text-slate-500 flex items-center justify-between">
                                <span className="flex items-center gap-1">
                                    <span className="material-symbols-outlined text-sm">edit_note</span> Mensagem Personalizada
                                </span>
                                <span className="text-[11px] text-slate-400 font-normal">
                                    {whatsappMessage.length} caracteres
                                </span>
                            </label>
                            <textarea
                                value={whatsappMessage}
                                onChange={(e) => setWhatsappMessage(e.target.value)}
                                rows={4}
                                className="w-full p-3.5 text-sm bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-emerald-500 resize-none font-medium leading-relaxed"
                            />
                        </div>

                        {/* Quick Tips */}
                        <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl text-xs text-slate-600 dark:text-slate-300 space-y-1">
                            <p className="font-bold text-primary-dark flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm">info</span> Dica de Retenção
                            </p>
                            <p className="text-[11px] leading-relaxed">
                                {selectedClient.status === 'attention' && 'Cliente na janela ideal de retorno. Um lembrete gentil converte em média 35% mais rápido.'}
                                {selectedClient.status === 'risk' && 'Cliente ausente há mais de 35 dias. Mostre que sente falta dele e ofereça os horários mais disputados.'}
                                {selectedClient.status === 'inactive' && 'Cliente inativo há mais de 60 dias. Vale a pena apresentar novidades do espaço ou uma condição especial.'}
                                {selectedClient.status === 'up_to_date' && 'Cliente realizou atendimento recentemente.'}
                            </p>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setSelectedClient(null)}
                                className="w-1/3 py-3 text-sm font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl transition-colors"
                            >
                                Cancelar
                            </button>
                            {finalWhatsAppUrl ? (
                                <a
                                    href={finalWhatsAppUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => setSelectedClient(null)}
                                    className="w-2/3 flex items-center justify-center gap-2 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-500/20"
                                >
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                    </svg>
                                    Abrir no WhatsApp
                                </a>
                            ) : (
                                <button
                                    disabled
                                    className="w-2/3 py-3 bg-slate-300 dark:bg-white/10 text-slate-500 rounded-xl font-bold text-sm cursor-not-allowed"
                                >
                                    Telefone Inválido
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default SmartReturn;
