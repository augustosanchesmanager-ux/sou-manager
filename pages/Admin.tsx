import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import { useRef, useEffect } from 'react';

const Admin: React.FC = () => {
    const { user, loading } = useAuth();
    const [activeTab, setActiveTab] = useState<'overview' | 'shops' | 'users' | 'tickets' | 'system' | 'requests'>('overview');
    const [tickets, setTickets] = useState<any[]>([]);
    const [requests, setRequests] = useState<any[]>([]);
    const [selectedTicket, setSelectedTicket] = useState<any>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
    const [reply, setReply] = useState('');
    const [isLoadingData, setIsLoadingData] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (!selectedTicket) return;

        const channel = supabase.channel(`admin_ticket_${selectedTicket.id}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'ticket_messages',
                filter: `ticket_id=eq.${selectedTicket.id}`
            }, (payload) => {
                setMessages(prev => {
                    if (prev.find(m => m.id === payload.new.id)) return prev;
                    return [...prev, payload.new as any];
                });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [selectedTicket]);

    // Show spinner while auth state is loading
    if (loading) {
        return (
            <div className="min-h-[400px] flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
            </div>
        );
    }

    // Redirect non-super-admins after loading is complete
    if (user?.user_metadata?.role !== 'Super Admin') {
        return <Navigate to="/dashboard" replace />;
    }

    return (
        <div className="space-y-8 max-w-[1600px] w-full mx-auto animate-fade-in pb-12">
            {/* Elite Header */}
            <div className="relative overflow-hidden rounded-3xl bg-[#0a0a0a] border border-amber-500/20 p-8 shadow-2xl shadow-amber-500/5">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none"></div>
                <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-[100px] -mr-48 -mt-48 pointer-events-none"></div>

                <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-0.5 rounded bg-amber-500 text-[10px] font-black uppercase text-black tracking-widest">Elite Access</span>
                            <span className="text-amber-500/50 text-[10px] font-bold uppercase tracking-widest">Protocolo SOU-99</span>
                        </div>
                        <h2 className="text-4xl font-black tracking-tighter text-white">Central de Comando SaaS</h2>
                        <p className="text-slate-400 mt-1 font-medium max-w-xl">Bem-vindo, {user?.user_metadata?.first_name || 'Administrador'}. Você possui autoridade total sobre o ecossistema SOU MANA.GER.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button className="flex items-center gap-2 px-5 py-3 bg-black border border-amber-500/30 rounded-xl text-xs font-bold text-amber-500 hover:bg-amber-500/10 transition-all">
                            <span className="material-symbols-outlined text-[18px]">terminal</span>
                            Console de Logs
                        </button>
                        <button className="flex items-center gap-2 px-5 py-3 bg-amber-600 text-black rounded-xl text-xs font-black hover:bg-amber-500 transition-all shadow-lg shadow-amber-500/20">
                            <span className="material-symbols-outlined text-[18px]">settings_system_daydream</span>
                            Configurações Globais
                        </button>
                    </div>
                </div>

                {/* System Tab Navigation */}
                <div className="flex items-center gap-8 mt-12 border-b border-white/5">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`pb-4 px-2 text-sm font-bold transition-all relative ${activeTab === 'overview' ? 'text-amber-500' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        Visão Geral
                        {activeTab === 'overview' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div>}
                    </button>
                    <button
                        onClick={() => setActiveTab('shops')}
                        className={`pb-4 px-2 text-sm font-bold transition-all relative ${activeTab === 'shops' ? 'text-amber-500' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        Barbearias Unificadas
                        {activeTab === 'shops' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div>}
                    </button>
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`pb-4 px-2 text-sm font-bold transition-all relative ${activeTab === 'users' ? 'text-amber-500' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        Gestão de Usuários
                        {activeTab === 'users' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div>}
                    </button>
                    <button
                        onClick={() => setActiveTab('system')}
                        className={`pb-4 px-2 text-sm font-bold transition-all relative ${activeTab === 'system' ? 'text-amber-500' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        Infraestrutura
                        {activeTab === 'system' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div>}
                    </button>
                    <button
                        onClick={async () => {
                            setActiveTab('tickets');
                            setIsLoadingData(true);
                            const { data } = await supabase.from('support_tickets').select('*').order('created_at', { ascending: false });
                            setTickets(data || []);
                            setIsLoadingData(false);
                        }}
                        className={`pb-4 px-2 text-sm font-bold transition-all relative ${activeTab === 'tickets' ? 'text-amber-500' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        Chamados de Suporte
                        {activeTab === 'tickets' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div>}
                    </button>
                    <button
                        onClick={async () => {
                            setActiveTab('requests');
                            setIsLoadingData(true);
                            const { data } = await supabase.from('access_requests').select('*').order('created_at', { ascending: false });
                            setRequests(data || []);
                            setIsLoadingData(false);
                        }}
                        className={`pb-4 px-2 text-sm font-bold transition-all relative ${activeTab === 'requests' ? 'text-amber-500' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        Pedidos de Acesso
                        {activeTab === 'requests' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div>}
                    </button>
                </div>
            </div>

            {activeTab === 'overview' && (
                <div className="space-y-8 animate-fade-in">
                    {/* Elite KPI Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="bg-black border border-white/10 p-6 rounded-2xl group hover:border-amber-500/50 transition-all shadow-xl">
                            <div className="flex items-center justify-between mb-4">
                                <div className="size-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20">
                                    <span className="material-symbols-outlined">analytics</span>
                                </div>
                                <span className="text-amber-500 text-[10px] font-black py-1 px-2 bg-amber-500/10 rounded-full">ATIVO</span>
                            </div>
                            <p className="text-slate-500 text-xs font-black uppercase tracking-widest">Volume Transacionado (Total)</p>
                            <h3 className="text-3xl font-black mt-2 text-white tracking-tighter">R$ 1.842.200</h3>
                            <div className="mt-4 flex items-center gap-1 text-emerald-500 text-[10px] font-bold">
                                <span className="material-symbols-outlined text-xs">trending_up</span> +24% este mês
                            </div>
                        </div>

                        <div className="bg-black border border-white/10 p-6 rounded-2xl group hover:border-amber-500/50 transition-all shadow-xl">
                            <div className="flex items-center justify-between mb-4">
                                <div className="size-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20">
                                    <span className="material-symbols-outlined">storefront</span>
                                </div>
                                <button className="text-[10px] font-black text-amber-500 border-b border-amber-500/30 hover:border-amber-500 transition-all">GERENCIAR</button>
                            </div>
                            <p className="text-slate-500 text-xs font-black uppercase tracking-widest">Unidades SaaS</p>
                            <h3 className="text-3xl font-black mt-2 text-white tracking-tighter">1.240</h3>
                            <p className="mt-4 text-slate-600 text-[10px] font-bold">Último cadastro: 14 min atrás</p>
                        </div>

                        <div className="bg-black border border-white/10 p-6 rounded-2xl group hover:border-amber-500/50 transition-all shadow-xl">
                            <div className="flex items-center justify-between mb-4">
                                <div className="size-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20">
                                    <span className="material-symbols-outlined">group</span>
                                </div>
                                <span className="px-2 py-1 rounded bg-blue-500/10 text-blue-400 text-[10px] font-bold">LIVE</span>
                            </div>
                            <p className="text-slate-500 text-xs font-black uppercase tracking-widest">Usuários Conectados</p>
                            <h3 className="text-3xl font-black mt-2 text-white tracking-tighter">4.802</h3>
                            <div className="mt-4 w-full bg-white/5 h-1 rounded-full overflow-hidden">
                                <div className="bg-amber-500 h-full w-2/3 shadow-[0_0_8px_rgba(245,158,11,0.8)]"></div>
                            </div>
                        </div>

                        <div className="bg-black border border-white/10 p-6 rounded-2xl group hover:border-amber-500/50 transition-all shadow-xl">
                            <div className="flex items-center justify-between mb-4">
                                <div className="size-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20">
                                    <span className="material-symbols-outlined">monitoring</span>
                                </div>
                                <div className="size-2 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]"></div>
                            </div>
                            <p className="text-slate-500 text-xs font-black uppercase tracking-widest">Health Score Global</p>
                            <h3 className="text-3xl font-black mt-2 text-emerald-500 tracking-tighter">99.98%</h3>
                            <p className="mt-4 text-slate-600 text-[10px] font-bold">Latência média: 28ms</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 bg-black border border-white/10 p-8 rounded-3xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 opacity-5">
                                <span className="material-symbols-outlined text-[120px] text-amber-500">query_stats</span>
                            </div>
                            <div className="flex items-center justify-between mb-10">
                                <div>
                                    <h4 className="text-xl font-black text-white tracking-tight">Curva de Adoção da Plataforma</h4>
                                    <p className="text-sm text-slate-500 font-medium">Novos parceiros vs Churn Rate</p>
                                </div>
                                <select className="bg-[#1A1A1A] border border-white/10 rounded-lg py-2 px-4 text-xs font-bold text-white outline-none focus:border-amber-500/50 [color-scheme:dark]">
                                    <option className="bg-[#1A1A1A]">Ano de 2024</option>
                                    <option className="bg-[#1A1A1A]">Ano de 2023</option>
                                </select>
                            </div>

                            <div className="h-[300px] flex items-end justify-between gap-2 px-4">
                                {[45, 60, 55, 80, 70, 95, 85, 110, 100, 130, 120, 150].map((val, i) => (
                                    <div key={i} className="flex-1 flex flex-col items-center gap-2 group cursor-pointer">
                                        <div
                                            className="w-full bg-amber-500/20 group-hover:bg-amber-500/40 rounded-t-lg transition-all relative"
                                            style={{ height: `${val * 1.5}px` }}
                                        >
                                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-amber-500 text-black text-[10px] font-black px-1.5 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                                {val}
                                            </div>
                                        </div>
                                        <span className="text-[10px] text-slate-600 font-bold">{['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'][i]}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-black border border-white/10 p-8 rounded-3xl">
                            <h4 className="text-xl font-black text-white tracking-tight mb-8">Alertas Críticos</h4>
                            <div className="space-y-4">
                                {[
                                    { type: 'warning', msg: 'Banco de Dados: Perto do limite de conexões', time: '5 min ago' },
                                    { type: 'error', msg: 'Falha de checkout: Unidade #882 (Salvador)', time: '12 min ago' },
                                    { type: 'info', msg: 'Backup global concluído com sucesso', time: '1h ago' },
                                    { type: 'warning', msg: 'Latência elevada em rotas de API (AWS-East)', time: '2h ago' },
                                ].map((alert, i) => (
                                    <div key={i} className={`p-4 rounded-xl border flex gap-4 ${alert.type === 'error' ? 'bg-red-500/5 border-red-500/20' :
                                        alert.type === 'warning' ? 'bg-amber-500/5 border-amber-500/20' :
                                            'bg-white/5 border-white/10'
                                        }`}>
                                        <span className={`material-symbols-outlined text-[20px] ${alert.type === 'error' ? 'text-red-500' :
                                            alert.type === 'warning' ? 'text-amber-500' :
                                                'text-slate-400'
                                            }`}>
                                            {alert.type === 'error' ? 'error_outline' : alert.type === 'warning' ? 'warning' : 'info'}
                                        </span>
                                        <div>
                                            <p className="text-xs font-bold text-white mb-1">{alert.msg}</p>
                                            <p className="text-[10px] text-slate-500 uppercase font-black">{alert.time}</p>
                                        </div>
                                    </div>
                                ))}

                                <button className="w-full py-4 mt-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] transition-all">
                                    Limpar Logs de Alerta
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'shops' && (
                <div className="space-y-8 animate-fade-in">
                    <div className="bg-black border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
                        <div className="p-8 border-b border-white/5 flex items-center justify-between">
                            <div>
                                <h4 className="text-xl font-black text-white tracking-tight">Todas as Unidades em Operação</h4>
                                <p className="text-sm text-slate-500 font-medium mt-1">Gestão centralizada de todas as barbearias cadastradas no ecossistema.</p>
                            </div>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Buscar por ID ou Nome..."
                                    className="bg-white/5 border border-white/10 rounded-xl py-2 px-4 text-xs font-bold text-white outline-none focus:border-amber-500/50"
                                />
                                <button className="px-5 py-2.5 bg-amber-500 text-black rounded-xl text-xs font-black hover:bg-amber-400 transition-all">Nova Unidade</button>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-white/5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                                        <th className="px-8 py-5">Unidade</th>
                                        <th className="px-8 py-5">Proprietário</th>
                                        <th className="px-8 py-5">Contrato / Plano</th>
                                        <th className="px-8 py-5">Última Atividade</th>
                                        <th className="px-8 py-5 text-right">Ações de Admin</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {[
                                        { name: 'SOU MANA.GER HQ', id: '#001', owner: 'Augusto Sanches', plan: 'Elite', last: 'Agora mesmo', status: 'Ativo' },
                                        { name: 'Barbearia do Zé', id: '#929', owner: 'José Silva', plan: 'Starter', last: '2h atrás', status: 'Ativo' },
                                        { name: 'Corte Fino', id: '#882', owner: 'Ana Paula', plan: 'Professional', last: '1d atrás', status: 'Suspenso' },
                                        { name: 'The Beard House', id: '#771', owner: 'Carlos Eduardo', plan: 'Professional', last: '5 min atrás', status: 'Ativo' },
                                    ].map((shop, i) => (
                                        <tr key={i} className="group hover:bg-white/[0.02] transition-colors">
                                            <td className="px-8 py-6">
                                                <div>
                                                    <p className="text-sm font-black text-white">{shop.name}</p>
                                                    <p className="text-[10px] text-amber-500/50 font-bold uppercase tracking-widest mt-0.5">{shop.id}</p>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-sm font-bold text-slate-400">{shop.owner}</td>
                                            <td className="px-8 py-6">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${shop.plan === 'Elite' ? 'bg-amber-500 text-black' : 'bg-white/10 text-slate-400'}`}>{shop.plan}</span>
                                            </td>
                                            <td className="px-8 py-6 text-xs font-bold text-slate-500">{shop.last}</td>
                                            <td className="px-8 py-6 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button className="px-3 py-1.5 bg-white/5 text-[10px] font-black uppercase text-slate-400 rounded-lg hover:text-white hover:bg-white/10 transition-all tracking-widest">Painel</button>
                                                    <button className="px-3 py-1.5 bg-red-500/10 text-[10px] font-black uppercase text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all tracking-widest">Suspender</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'users' && (
                <div className="space-y-8 animate-fade-in">
                    <div className="bg-black border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
                        <div className="p-8 border-b border-white/5 flex items-center justify-between">
                            <div>
                                <h4 className="text-xl font-black text-white tracking-tight">Diretório Global de Usuários</h4>
                                <p className="text-sm text-slate-500 font-medium mt-1">Audit de todos os colaboradores e administradores ativos no sistema.</p>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-white/5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                                        <th className="px-8 py-5">Usuário</th>
                                        <th className="px-8 py-5">E-mail</th>
                                        <th className="px-8 py-5">Cargo / Role</th>
                                        <th className="px-8 py-5">Status Auth</th>
                                        <th className="px-8 py-5 text-right">Ações Diretas</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {[
                                        { name: 'Augusto Sanches', email: 'sanches.augusto@outlook.com', role: 'Super Admin', auth: 'Verificado' },
                                        { name: 'Ricardo Oliveira', email: 'ricardo@email.com', role: 'Gerente', auth: 'Verificado' },
                                        { name: 'Gustavo Silva', email: 'gustavo.viking@email.com', role: 'Barbeiro', auth: 'Verificado' },
                                        { name: 'Felipe Costa', email: 'felipe@email.com', role: 'Gerente', auth: 'Pendente' },
                                    ].map((u, i) => (
                                        <tr key={i} className="group hover:bg-white/[0.02] transition-colors">
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="size-8 rounded-full bg-white/5 flex items-center justify-center font-black text-xs text-slate-400 border border-white/10">
                                                        {u.name.substring(0, 1)}
                                                    </div>
                                                    <p className="text-sm font-black text-white">{u.name}</p>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-sm font-bold text-slate-500">{u.email}</td>
                                            <td className="px-8 py-6">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${u.role === 'Super Admin' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-white/10 text-slate-400'}`}>{u.role}</span>
                                            </td>
                                            <td className="px-8 py-6">
                                                <span className={`text-[10px] font-black py-1 px-2 rounded ${u.auth === 'Verificado' ? 'text-emerald-500 bg-emerald-500/10' : 'text-amber-500 bg-amber-500/10'}`}>{u.auth}</span>
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                <button className="material-symbols-outlined text-slate-600 hover:text-white transition-colors">more_horiz</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'tickets' && (
                <div className="space-y-8 animate-fade-in">
                    <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
                        <div className="p-8 border-b border-white/5 flex items-center justify-between">
                            <div>
                                <h4 className="text-xl font-black text-white tracking-tight">Fila de Suporte Ativa</h4>
                                <p className="text-sm text-slate-500 font-medium mt-1">Gerencie chamados de usuários e resolva pendências críticas.</p>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-white/5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                                        <th className="px-8 py-5">Protocolo / Assunto</th>
                                        <th className="px-8 py-5">Usuário</th>
                                        <th className="px-8 py-5">Status</th>
                                        <th className="px-8 py-5">Prioridade</th>
                                        <th className="px-8 py-5 text-right">Intervenção</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {tickets.map((t, i) => (
                                        <tr key={i} className="group hover:bg-white/[0.02] transition-colors">
                                            <td className="px-8 py-6">
                                                <div>
                                                    <p className="text-sm font-black text-white">{t.subject}</p>
                                                    <p className="text-[10px] text-amber-500/50 font-bold uppercase tracking-widest mt-0.5">#{t.id.slice(0, 8)}</p>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-sm font-bold text-slate-400">Usuário ID: {t.user_id?.slice(0, 8)}</td>
                                            <td className="px-8 py-6">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${t.status === 'open' ? 'bg-amber-500/20 text-amber-500' : t.status === 'responded' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-white/10 text-slate-500'}`}>{t.status}</span>
                                            </td>
                                            <td className="px-8 py-6">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${t.priority === 'high' ? 'bg-red-500/20 text-red-500' : 'bg-white/10 text-slate-400'}`}>{t.priority}</span>
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                <button
                                                    onClick={async () => {
                                                        setSelectedTicket(t);
                                                        const { data } = await supabase.from('ticket_messages').select('*').eq('ticket_id', t.id).order('created_at', { ascending: true });
                                                        setMessages(data || []);
                                                        setIsTicketModalOpen(true);
                                                    }}
                                                    className="px-4 py-2 bg-amber-500/10 text-amber-500 text-[10px] font-black uppercase tracking-widest rounded-lg border border-amber-500/30 hover:bg-amber-500 hover:text-black transition-all"
                                                >
                                                    Responder
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
            {activeTab === 'requests' && (
                <div className="space-y-8 animate-fade-in">
                    <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
                        <div className="p-8 border-b border-white/5 flex items-center justify-between">
                            <div>
                                <h4 className="text-xl font-black text-white tracking-tight">Novos Pedidos de Acesso</h4>
                                <p className="text-sm text-slate-500 font-medium mt-1">Aprovação de novas barbearias no ecossistema.</p>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-white/5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                                        <th className="px-8 py-5">Barbearia / Responsável</th>
                                        <th className="px-8 py-5">Status</th>
                                        <th className="px-8 py-5 text-right">Ação</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {isLoadingData ? (
                                        <tr><td colSpan={3} className="px-8 py-10 text-center text-slate-500">Carregando pedidos...</td></tr>
                                    ) : requests.length === 0 ? (
                                        <tr><td colSpan={3} className="px-8 py-10 text-center text-slate-500">Nenhum pedido pendente.</td></tr>
                                    ) : requests.map((r, i) => (
                                        <tr key={i} className="group hover:bg-white/[0.02] transition-colors">
                                            <td className="px-8 py-6">
                                                <div>
                                                    <p className="text-sm font-black text-white">{r.tenant_name}</p>
                                                    <p className="text-[10px] text-amber-500/50 font-bold uppercase tracking-widest mt-0.5">{r.owner_name} ({r.email})</p>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${r.status === 'pending' ? 'bg-amber-500/20 text-amber-500' : 'bg-emerald-500/20 text-emerald-500'}`}>{r.status}</span>
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                {r.status === 'pending' && (
                                                    <button
                                                        onClick={async () => {
                                                            const { error } = await supabase.rpc('approve_access_request', { p_request_id: r.id });
                                                            if (error) {
                                                                alert(`Erro ao aprovar: ${error.message}`);
                                                            } else {
                                                                const { data } = await supabase.from('access_requests').select('*').order('created_at', { ascending: false });
                                                                setRequests(data || []);
                                                            }
                                                        }}
                                                        className="px-4 py-2 bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-widest rounded-lg border border-emerald-500/30 hover:bg-emerald-500 hover:text-black transition-all"
                                                    >
                                                        Aprovar Acesso
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
            {activeTab === 'system' && (
                <div className="space-y-8 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-black border border-white/10 p-8 rounded-3xl">
                            <h4 className="text-white font-black uppercase tracking-widest text-xs mb-6">Database Health (Supabase)</h4>
                            <div className="space-y-6">
                                <div>
                                    <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                                        <span>Read Throughput</span>
                                        <span className="text-emerald-500">Normal</span>
                                    </div>
                                    <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                        <div className="w-3/4 h-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-black border border-white/10 p-8 rounded-3xl lg:col-span-2">
                            <h4 className="text-white font-black uppercase tracking-widest text-xs mb-6">Vite Dev Server Metrics</h4>
                            <div className="flex items-center gap-12">
                                <div>
                                    <p className="text-2xl font-black text-amber-500 tracking-tighter">TypeScript</p>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Health Level: Optimal</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Ticket Management Modal */}
            <Modal
                isOpen={isTicketModalOpen}
                onClose={() => setIsTicketModalOpen(false)}
                title={`Gestão de Chamado: ${selectedTicket?.subject}`}
                maxWidth="lg"
            >
                <div className="flex flex-col flex-1 min-h-0">
                    <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl mb-4 text-sm text-slate-400 italic">
                        {selectedTicket?.description}
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-2 mb-4">
                        {messages.map((m: any) => (
                            <div key={m.id} className={`flex ${m.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] p-3 rounded-2xl ${m.sender_id === user?.id ? 'bg-amber-600 text-black rounded-tr-none font-bold' : 'bg-white/10 text-slate-200 rounded-tl-none'}`}>
                                    <p className="text-sm">{m.message}</p>
                                    <p className={`text-[9px] mt-1 uppercase font-black ${m.sender_id === user?.id ? 'text-black/50' : 'text-slate-500'}`}>
                                        {new Date(m.created_at).toLocaleTimeString()}
                                    </p>
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className="flex flex-col gap-3 mt-auto pt-4">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Digite a resposta oficial..."
                                value={reply}
                                onChange={(e) => setReply(e.target.value)}
                                className="flex-1 bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white outline-none focus:border-amber-500/50"
                            />
                            <Button
                                onClick={async () => {
                                    if (!reply.trim() || !selectedTicket) return;
                                    const { data, error } = await supabase.from('ticket_messages').insert({
                                        ticket_id: selectedTicket.id,
                                        sender_id: user.id,
                                        message: reply
                                    }).select().single();

                                    if (!error && data) {
                                        setMessages([...messages, data]);
                                        setReply('');
                                        await supabase.from('support_tickets').update({ status: 'responded' }).eq('id', selectedTicket.id);
                                        setTickets(prev => prev.map(t => t.id === selectedTicket.id ? { ...t, status: 'responded' } : t));

                                        await supabase.from('notifications').insert({
                                            user_id: selectedTicket.user_id,
                                            type: 'admin_message',
                                            title: 'Seu chamado foi respondido',
                                            description: `Nova mensagem sobre: ${selectedTicket.subject}`
                                        });
                                    }
                                }}
                                disabled={!reply.trim()}
                                variant="warning"
                                size="sm"
                            >
                                Enviar
                            </Button>
                        </div>
                        <div className="flex justify-between items-center">
                            <button
                                onClick={async () => {
                                    await supabase.from('support_tickets').update({ status: 'closed' }).eq('id', selectedTicket.id);
                                    setTickets(prev => prev.map(t => t.id === selectedTicket.id ? { ...t, status: 'closed' } : t));
                                    setIsTicketModalOpen(false);
                                }}
                                className="text-[10px] font-black text-red-500 uppercase hover:underline"
                            >
                                Encerrar Chamado
                            </button>
                            <p className="text-[10px] text-slate-500 uppercase font-bold">Status: <span className="text-amber-500">{selectedTicket?.status}</span></p>
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default Admin;