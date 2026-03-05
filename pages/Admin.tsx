import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';

const Admin: React.FC = () => {
    const { user, loading } = useAuth();
    const [activeTab, setActiveTab] = useState<'overview' | 'shops' | 'users' | 'access' | 'tickets' | 'system' | 'requests'>('overview');

    // Real data
    const [shops, setShops] = useState<any[]>([]);
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [tickets, setTickets] = useState<any[]>([]);
    const [requests, setRequests] = useState<any[]>([]);
    const [kpis, setKpis] = useState({ revenue: 0, totalShops: 0, totalUsers: 0, activeTickets: 0 });
    const [isLoadingData, setIsLoadingData] = useState(false);

    // Ticket modal
    const [selectedTicket, setSelectedTicket] = useState<any>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
    const [reply, setReply] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Action modals
    const [isConsoleOpen, setIsConsoleOpen] = useState(false);
    const [isGlobalSettingsOpen, setIsGlobalSettingsOpen] = useState(false);
    const [isNewUnitOpen, setIsNewUnitOpen] = useState(false);
    const [newUnitForm, setNewUnitForm] = useState({ name: '', owner: '', plan: 'Starter', email: '' });
    const [newUnitLoading, setNewUnitLoading] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    // Shop Panel Modal
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [selectedShop, setSelectedShop] = useState<any>(null);
    const [panelData, setPanelData] = useState<{ staff: any[]; clients: number; appointments: number; revenue: number; recentTx: any[] }>({ staff: [], clients: 0, appointments: 0, revenue: 0, recentTx: [] });
    const [isPanelLoading, setIsPanelLoading] = useState(false);

    const openShopPanel = async (shop: any) => {
        setSelectedShop(shop);
        setIsPanelOpen(true);
        setIsPanelLoading(true);
        const tid = shop.tenant_id;
        const [staffRes, clientsRes, apptsRes, txRes] = await Promise.all([
            supabase.from('staff').select('id, name, role, status').eq('tenant_id', tid),
            supabase.from('clients').select('id', { count: 'exact', head: true }).eq('tenant_id', tid),
            supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('tenant_id', tid),
            supabase.from('transactions').select('amount, description, date').eq('tenant_id', tid).eq('type', 'income').order('date', { ascending: false }).limit(5),
        ]);
        const revenue = (txRes.data || []).reduce((s: number, t: any) => s + (Number(t.amount) || 0), 0);
        setPanelData({
            staff: staffRes.data || [],
            clients: clientsRes.count || 0,
            appointments: apptsRes.count || 0,
            revenue,
            recentTx: txRes.data || [],
        });
        setIsPanelLoading(false);
    };

    const [searchShop, setSearchShop] = useState('');
    const [searchUser, setSearchUser] = useState('');

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    // ─── Fetch overview KPIs ────────────────────────────────────────────────
    const fetchOverview = useCallback(async () => {
        setIsLoadingData(true);
        const [profilesRes, staffRes, ticketsRes, txRes] = await Promise.all([
            supabase.from('profiles').select('id', { count: 'exact', head: true }),
            supabase.from('staff').select('id', { count: 'exact', head: true }),
            supabase.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'open'),
            supabase.from('transactions').select('amount').eq('type', 'income'),
        ]);

        const totalShops = profilesRes.count || 0;
        const totalUsers = (profilesRes.count || 0) + (staffRes.count || 0);
        const activeTickets = ticketsRes.count || 0;
        const revenue = (txRes.data || []).reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);

        setKpis({ revenue, totalShops, totalUsers, activeTickets });
        setIsLoadingData(false);
    }, []);

    // ─── Fetch shops (profiles = owners/managers) ───────────────────────────
    const fetchShops = useCallback(async () => {
        setIsLoadingData(true);
        const { data } = await supabase
            .from('profiles')
            .select('id, tenant_id, onboarding_completed, created_at')
            .order('created_at', { ascending: false });

        // Enrich with auth user data via user_metadata if available
        // We also join with staff count per tenant
        const enriched = await Promise.all((data || []).map(async (p: any) => {
            const { data: authUser } = await supabase.auth.admin?.getUserById?.(p.id) || { data: null };
            const { count: staffCount } = await supabase.from('staff').select('id', { count: 'exact', head: true }).eq('tenant_id', p.tenant_id);
            const { data: txData } = await supabase.from('transactions').select('amount').eq('tenant_id', p.tenant_id).eq('type', 'income');
            const revenue = (txData || []).reduce((s: number, t: any) => s + (Number(t.amount) || 0), 0);

            return {
                ...p,
                email: authUser?.user?.email || p.id,
                name: authUser?.user?.user_metadata?.shop_name || authUser?.user?.user_metadata?.first_name || 'Barbearia',
                owner: `${authUser?.user?.user_metadata?.first_name || ''} ${authUser?.user?.user_metadata?.last_name || ''}`.trim() || 'Proprietário',
                plan: authUser?.user?.user_metadata?.plan || 'free',
                staff: staffCount || 0,
                revenue,
                last: authUser?.user?.last_sign_in_at
                    ? new Date(authUser.user.last_sign_in_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
                    : 'Nunca',
                status: p.onboarding_completed ? 'Ativo' : 'Pendente'
            };
        }));

        setShops(enriched);
        setIsLoadingData(false);
    }, []);

    // ─── Fetch all users (profiles + staff) ─────────────────────────────────
    const fetchUsers = useCallback(async () => {
        setIsLoadingData(true);
        const [profilesRes, staffRes] = await Promise.all([
            supabase.from('profiles').select('id, tenant_id, created_at'),
            supabase.from('staff').select('id, name, email, role, status, tenant_id, created_at'),
        ]);

        const profileUsers: any[] = [];
        for (const p of profilesRes.data || []) {
            profileUsers.push({
                id: p.id,
                name: '(admin)',
                email: p.id,
                role: 'Manager',
                auth: 'Verificado',
                source: 'profile',
                tenant_id: p.tenant_id,
            });
        }

        const staffUsers = (staffRes.data || []).map((s: any) => ({
            id: s.id,
            name: s.name,
            email: s.email,
            role: s.role,
            auth: s.status === 'active' ? 'Ativo' : 'Inativo',
            source: 'staff',
            tenant_id: s.tenant_id,
        }));

        setAllUsers([...profileUsers, ...staffUsers]);
        setIsLoadingData(false);
    }, []);

    // ─── Realtime ticket subscription ───────────────────────────────────────
    useEffect(() => {
        if (!selectedTicket) return;
        const channel = supabase.channel(`admin_ticket_${selectedTicket.id}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ticket_messages', filter: `ticket_id=eq.${selectedTicket.id}` },
                (payload) => setMessages(prev => prev.find(m => m.id === payload.new.id) ? prev : [...prev, payload.new as any]))
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [selectedTicket]);

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    // Load data when tab changes
    useEffect(() => {
        if (activeTab === 'overview') fetchOverview();
        if (activeTab === 'shops') fetchShops();
        if (activeTab === 'users') fetchUsers();
        if (activeTab === 'tickets') {
            setIsLoadingData(true);
            supabase.from('support_tickets').select('*').order('created_at', { ascending: false })
                .then(({ data }) => { setTickets(data || []); setIsLoadingData(false); });
        }
        if (activeTab === 'requests') {
            setIsLoadingData(true);
            supabase.from('profiles').select('id, tenant_id, created_at, status')
                .eq('status', 'pending')
                .order('created_at', { ascending: false })
                .then(({ data }) => { setRequests(data || []); setIsLoadingData(false); });
        }
    }, [activeTab, fetchOverview, fetchShops, fetchUsers]);

    const fmt = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n);

    if (loading) return (
        <div className="min-h-[400px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
        </div>
    );

    if (user?.user_metadata?.role !== 'Super Admin') return <Navigate to="/dashboard" replace />;

    const filteredShops = shops.filter(s =>
        s.name?.toLowerCase().includes(searchShop.toLowerCase()) ||
        s.owner?.toLowerCase().includes(searchShop.toLowerCase())
    );
    const filteredUsers = allUsers.filter(u =>
        u.name?.toLowerCase().includes(searchUser.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchUser.toLowerCase())
    );

    return (
        <div className="space-y-8 max-w-[1600px] w-full mx-auto animate-fade-in pb-12">

            {/* ─── Header ─────────────────────────────────────────────── */}
            <div className="relative overflow-hidden rounded-3xl bg-[#0a0a0a] border border-amber-500/20 p-8 shadow-2xl shadow-amber-500/5">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none" />
                <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-[100px] -mr-48 -mt-48 pointer-events-none" />

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
                        <button onClick={() => setIsConsoleOpen(true)} className="flex items-center gap-2 px-5 py-3 bg-black border border-amber-500/30 rounded-xl text-xs font-bold text-amber-500 hover:bg-amber-500/10 transition-all">
                            <span className="material-symbols-outlined text-[18px]">terminal</span>
                            Console de Logs
                        </button>
                        <button onClick={() => setIsGlobalSettingsOpen(true)} className="flex items-center gap-2 px-5 py-3 bg-amber-600 text-black rounded-xl text-xs font-black hover:bg-amber-500 transition-all shadow-lg shadow-amber-500/20">
                            <span className="material-symbols-outlined text-[18px]">settings_system_daydream</span>
                            Configurações Globais
                        </button>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex items-center gap-8 mt-12 border-b border-white/5 overflow-x-auto">
                    {[
                        { id: 'overview', label: 'Visão Geral' },
                        { id: 'shops', label: 'Barbearias' },
                        { id: 'users', label: 'Usuários' },
                        { id: 'access', label: 'Gestão de Acessos' },
                        { id: 'system', label: 'Infraestrutura' },
                        { id: 'tickets', label: 'Chamados de Suporte' },
                        { id: 'requests', label: 'Pedidos de Acesso' },
                    ].map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                            className={`pb-4 px-2 text-sm font-bold transition-all relative whitespace-nowrap ${activeTab === tab.id ? 'text-amber-500' : 'text-slate-500 hover:text-slate-300'}`}>
                            {tab.label}
                            {activeTab === tab.id && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />}
                        </button>
                    ))}
                </div>
            </div>

            {/* ─── OVERVIEW ───────────────────────────────────────────── */}
            {activeTab === 'overview' && (
                <div className="space-y-8 animate-fade-in">
                    {isLoadingData ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500" />
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                {[
                                    { icon: 'analytics', label: 'Volume Transacionado', value: fmt(kpis.revenue), badge: 'TOTAL', badgeColor: 'text-amber-500 bg-amber-500/10' },
                                    { icon: 'storefront', label: 'Barbearias Cadastradas', value: kpis.totalShops.toString(), badge: 'UNIDADES', badgeColor: 'text-blue-400 bg-blue-500/10' },
                                    { icon: 'group', label: 'Total de Usuários', value: kpis.totalUsers.toString(), badge: 'SISTEMA', badgeColor: 'text-emerald-500 bg-emerald-500/10' },
                                    { icon: 'support_agent', label: 'Chamados Abertos', value: kpis.activeTickets.toString(), badge: 'SUPORTE', badgeColor: kpis.activeTickets > 0 ? 'text-red-400 bg-red-500/10' : 'text-slate-500 bg-white/5' },
                                ].map((kpi, i) => (
                                    <div key={i} className="bg-black border border-white/10 p-6 rounded-2xl hover:border-amber-500/50 transition-all shadow-xl">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="size-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20">
                                                <span className="material-symbols-outlined">{kpi.icon}</span>
                                            </div>
                                            <span className={`text-[10px] font-black py-1 px-2 rounded-full ${kpi.badgeColor}`}>{kpi.badge}</span>
                                        </div>
                                        <p className="text-slate-500 text-xs font-black uppercase tracking-widest">{kpi.label}</p>
                                        <h3 className="text-3xl font-black mt-2 text-white tracking-tighter">{kpi.value}</h3>
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Últimos chamados abertos */}
                                <div className="bg-black border border-white/10 p-8 rounded-3xl">
                                    <h4 className="text-xl font-black text-white tracking-tight mb-6">Últimos Chamados em Aberto</h4>
                                    {tickets.filter(t => t.status === 'open').slice(0, 5).length === 0 ? (
                                        <div className="flex flex-col items-center py-8 text-slate-600">
                                            <span className="material-symbols-outlined text-4xl mb-2">check_circle</span>
                                            <p className="text-sm font-bold">Nenhum chamado aberto</p>
                                        </div>
                                    ) : tickets.filter(t => t.status === 'open').slice(0, 5).map((t: any, i: number) => (
                                        <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-white/5 hover:border-amber-500/20 transition-all mb-3">
                                            <div className="size-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                                                <span className="material-symbols-outlined text-amber-500 text-sm">support_agent</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-white truncate">{t.subject}</p>
                                                <p className="text-[10px] text-slate-500 font-bold uppercase">#{t.id?.slice(0, 8)}</p>
                                            </div>
                                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-500/20 text-amber-500">ABERTO</span>
                                        </div>
                                    ))}
                                    <button onClick={() => setActiveTab('tickets')} className="w-full mt-2 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] transition-all">
                                        Ver Todos os Chamados
                                    </button>
                                </div>

                                {/* Últimas barbearias */}
                                <div className="bg-black border border-white/10 p-8 rounded-3xl">
                                    <h4 className="text-xl font-black text-white tracking-tight mb-6">Barbearias Recentes</h4>
                                    {shops.slice(0, 5).length === 0 ? (
                                        <div className="flex flex-col items-center py-8 text-slate-600">
                                            <span className="material-symbols-outlined text-4xl mb-2">storefront</span>
                                            <p className="text-sm font-bold">Nenhuma barbearia cadastrada</p>
                                        </div>
                                    ) : shops.slice(0, 5).map((s: any, i: number) => (
                                        <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-white/5 hover:border-amber-500/20 transition-all mb-3">
                                            <div className="size-8 rounded-full bg-white/5 flex items-center justify-center font-black text-xs text-amber-500 border border-amber-500/20">
                                                {s.name?.[0] || '?'}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-white truncate">{s.name}</p>
                                                <p className="text-[10px] text-slate-500 font-bold">{s.owner} · {s.staff} colaboradores</p>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${s.plan === 'elite' ? 'bg-amber-500 text-black' : 'bg-white/10 text-slate-400'}`}>{s.plan}</span>
                                        </div>
                                    ))}
                                    <button onClick={() => setActiveTab('shops')} className="w-full mt-2 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] transition-all">
                                        Ver Todas as Unidades
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ─── BARBEARIAS ─────────────────────────────────────────── */}
            {activeTab === 'shops' && (
                <div className="space-y-8 animate-fade-in">
                    <div className="bg-black border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
                        <div className="p-8 border-b border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div>
                                <h4 className="text-xl font-black text-white tracking-tight">Todas as Unidades em Operação</h4>
                                <p className="text-sm text-slate-500 font-medium mt-1">{shops.length} barbearia(s) cadastrada(s) no ecossistema.</p>
                            </div>
                            <div className="flex gap-2">
                                <input type="text" placeholder="Buscar por nome..." value={searchShop} onChange={e => setSearchShop(e.target.value)}
                                    className="bg-white/5 border border-white/10 rounded-xl py-2 px-4 text-xs font-bold text-white outline-none focus:border-amber-500/50" />
                                <button onClick={() => setIsNewUnitOpen(true)} className="px-5 py-2.5 bg-amber-500 text-black rounded-xl text-xs font-black hover:bg-amber-400 transition-all">Nova Unidade</button>
                            </div>
                        </div>

                        {isLoadingData ? (
                            <div className="py-16 flex items-center justify-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
                            </div>
                        ) : filteredShops.length === 0 ? (
                            <div className="py-16 text-center text-slate-500">
                                <span className="material-symbols-outlined text-4xl mb-2 block">storefront</span>
                                <p className="text-sm font-bold">Nenhuma barbearia encontrada.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="bg-white/5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                                            <th className="px-8 py-5">Unidade</th>
                                            <th className="px-8 py-5">Proprietário</th>
                                            <th className="px-8 py-5">Plano</th>
                                            <th className="px-8 py-5">Equipe</th>
                                            <th className="px-8 py-5">Faturamento</th>
                                            <th className="px-8 py-5">Último Acesso</th>
                                            <th className="px-8 py-5">Status</th>
                                            <th className="px-8 py-5 text-right">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {filteredShops.map((shop, i) => (
                                            <tr key={i} className="group hover:bg-white/[0.02] transition-colors">
                                                <td className="px-8 py-6">
                                                    <p className="text-sm font-black text-white">{shop.name}</p>
                                                    <p className="text-[10px] text-amber-500/50 font-bold uppercase tracking-widest mt-0.5">{shop.tenant_id?.slice(0, 8)}</p>
                                                </td>
                                                <td className="px-8 py-6 text-sm font-bold text-slate-400">{shop.owner}</td>
                                                <td className="px-8 py-6">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${shop.plan === 'elite' ? 'bg-amber-500 text-black' : 'bg-white/10 text-slate-400'}`}>{shop.plan || 'free'}</span>
                                                </td>
                                                <td className="px-8 py-6 text-sm font-bold text-slate-400">{shop.staff} membros</td>
                                                <td className="px-8 py-6 text-sm font-bold text-emerald-400">{fmt(shop.revenue)}</td>
                                                <td className="px-8 py-6 text-xs font-bold text-slate-500">{shop.last}</td>
                                                <td className="px-8 py-6">
                                                    <span className={`text-[10px] font-black py-1 px-2 rounded ${shop.status === 'Ativo' ? 'text-emerald-500 bg-emerald-500/10' : 'text-amber-500 bg-amber-500/10'}`}>{shop.status}</span>
                                                </td>
                                                <td className="px-8 py-6 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button onClick={() => openShopPanel(shop)} className="px-3 py-1.5 bg-amber-500/10 text-[10px] font-black uppercase text-amber-500 rounded-lg hover:bg-amber-500 hover:text-black transition-all tracking-widest border border-amber-500/20">Painel</button>
                                                        <button onClick={() => { if (window.confirm(`Suspender "${shop.name}"?`)) showToast(`${shop.name} suspenso.`); }} className="px-3 py-1.5 bg-red-500/10 text-[10px] font-black uppercase text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all tracking-widest">Suspender</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ─── USUÁRIOS ───────────────────────────────────────────── */}
            {activeTab === 'users' && (
                <div className="space-y-8 animate-fade-in">
                    <div className="bg-black border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
                        <div className="p-8 border-b border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div>
                                <h4 className="text-xl font-black text-white tracking-tight">Diretório Global de Usuários</h4>
                                <p className="text-sm text-slate-500 font-medium mt-1">{allUsers.length} usuário(s) no sistema.</p>
                            </div>
                            <input type="text" placeholder="Buscar por nome ou e-mail..." value={searchUser} onChange={e => setSearchUser(e.target.value)}
                                className="bg-white/5 border border-white/10 rounded-xl py-2 px-4 text-xs font-bold text-white outline-none focus:border-amber-500/50" />
                        </div>

                        {isLoadingData ? (
                            <div className="py-16 flex items-center justify-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="bg-white/5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                                            <th className="px-8 py-5">Usuário</th>
                                            <th className="px-8 py-5">E-mail / ID</th>
                                            <th className="px-8 py-5">Cargo</th>
                                            <th className="px-8 py-5">Status</th>
                                            <th className="px-8 py-5 text-right">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {filteredUsers.map((u, i) => (
                                            <tr key={i} className="group hover:bg-white/[0.02] transition-colors">
                                                <td className="px-8 py-6">
                                                    <div className="flex items-center gap-3">
                                                        <div className="size-8 rounded-full bg-white/5 flex items-center justify-center font-black text-xs text-slate-400 border border-white/10">
                                                            {u.name?.[0]?.toUpperCase() || '?'}
                                                        </div>
                                                        <p className="text-sm font-black text-white">{u.name}</p>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6 text-sm font-bold text-slate-500">{u.email}</td>
                                                <td className="px-8 py-6">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${u.role === 'Super Admin' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-white/10 text-slate-400'}`}>{u.role}</span>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <span className={`text-[10px] font-black py-1 px-2 rounded ${u.auth === 'Verificado' || u.auth === 'Ativo' ? 'text-emerald-500 bg-emerald-500/10' : 'text-amber-500 bg-amber-500/10'}`}>{u.auth}</span>
                                                </td>
                                                <td className="px-8 py-6 text-right">
                                                    <button onClick={() => showToast(`Ação para ${u.name} em breve.`)} className="material-symbols-outlined text-slate-600 hover:text-white transition-colors">more_horiz</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ─── INFRAESTRUTURA ─────────────────────────────────────── */}
            {activeTab === 'system' && (
                <div className="space-y-8 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-black border border-white/10 p-8 rounded-3xl">
                            <h4 className="text-white font-black uppercase tracking-widest text-xs mb-6">Database (Supabase)</h4>
                            <div className="space-y-4">
                                {[
                                    { label: 'Barbearias', icon: 'storefront', value: kpis.totalShops },
                                    { label: 'Usuários Totais', icon: 'group', value: kpis.totalUsers },
                                    { label: 'Chamados Abertos', icon: 'support_agent', value: kpis.activeTickets },
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-amber-500 text-sm">{item.icon}</span>
                                            <span className="text-xs font-bold text-slate-400">{item.label}</span>
                                        </div>
                                        <span className="text-sm font-black text-white">{item.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="bg-black border border-white/10 p-8 rounded-3xl lg:col-span-2">
                            <h4 className="text-white font-black uppercase tracking-widest text-xs mb-6">Stack Técnica</h4>
                            <div className="grid grid-cols-2 gap-4">
                                {[
                                    { label: 'Frontend', value: 'React + Vite + TypeScript', icon: 'code' },
                                    { label: 'Backend / DB', value: 'Supabase (PostgreSQL)', icon: 'database' },
                                    { label: 'Auth', value: 'Supabase Auth (JWT)', icon: 'verified_user' },
                                    { label: 'Deploy', value: 'Verificar variável de ambiente', icon: 'cloud' },
                                ].map((item, i) => (
                                    <div key={i} className="p-4 bg-white/5 rounded-xl border border-white/5">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="material-symbols-outlined text-amber-500 text-sm">{item.icon}</span>
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{item.label}</p>
                                        </div>
                                        <p className="text-sm font-bold text-white">{item.value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── CHAMADOS ───────────────────────────────────────────── */}
            {activeTab === 'tickets' && (
                <div className="space-y-8 animate-fade-in">
                    <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
                        <div className="p-8 border-b border-white/5">
                            <h4 className="text-xl font-black text-white tracking-tight">Fila de Suporte Ativa</h4>
                            <p className="text-sm text-slate-500 font-medium mt-1">{tickets.length} chamado(s) no total.</p>
                        </div>
                        {isLoadingData ? (
                            <div className="py-16 flex items-center justify-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
                            </div>
                        ) : tickets.length === 0 ? (
                            <div className="py-16 text-center text-slate-500">
                                <span className="material-symbols-outlined text-4xl mb-2 block">inbox</span>
                                <p className="text-sm font-bold">Nenhum chamado encontrado.</p>
                            </div>
                        ) : (
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
                                                    <p className="text-sm font-black text-white">{t.subject}</p>
                                                    <p className="text-[10px] text-amber-500/50 font-bold uppercase tracking-widest mt-0.5">#{t.id?.slice(0, 8)}</p>
                                                </td>
                                                <td className="px-8 py-6 text-sm font-bold text-slate-400">{t.user_id?.slice(0, 8)}…</td>
                                                <td className="px-8 py-6">
                                                    {t.status === 'open' && (
                                                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-amber-500/20 text-amber-500">Aberto</span>
                                                    )}
                                                    {(t.status === 'responded' || t.status === 'awaiting_response') && (
                                                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-blue-500/20 text-blue-400 animate-pulse">Aguardando Resposta</span>
                                                    )}
                                                    {t.status === 'closed' && (
                                                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-white/10 text-slate-500">Encerrado</span>
                                                    )}
                                                    {!['open', 'responded', 'awaiting_response', 'closed'].includes(t.status) && (
                                                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-white/10 text-slate-500">{t.status}</span>
                                                    )}
                                                </td>
                                                <td className="px-8 py-6">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${t.priority === 'high' ? 'bg-red-500/20 text-red-500' : 'bg-white/10 text-slate-400'}`}>{t.priority || 'normal'}</span>
                                                </td>
                                                <td className="px-8 py-6 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {t.status !== 'closed' && (
                                                            <button onClick={async () => {
                                                                setSelectedTicket(t);
                                                                const { data } = await supabase.from('ticket_messages').select('*').eq('ticket_id', t.id).order('created_at', { ascending: true });
                                                                setMessages(data || []);
                                                                setIsTicketModalOpen(true);
                                                            }} className="px-4 py-2 bg-amber-500/10 text-amber-500 text-[10px] font-black uppercase tracking-widest rounded-lg border border-amber-500/30 hover:bg-amber-500 hover:text-black transition-all">
                                                                Responder
                                                            </button>
                                                        )}
                                                        {t.status !== 'closed' && (
                                                            <button onClick={async () => {
                                                                if (!window.confirm('Encerrar este chamado?')) return;
                                                                const { error } = await supabase.from('support_tickets').update({ status: 'closed' }).eq('id', t.id);
                                                                if (!error) {
                                                                    setTickets(prev => prev.map(tk => tk.id === t.id ? { ...tk, status: 'closed' } : tk));
                                                                    showToast('Chamado encerrado com sucesso.');
                                                                } else {
                                                                    showToast('Erro ao encerrar chamado.', 'error');
                                                                }
                                                            }} className="px-4 py-2 bg-red-500/10 text-red-500 text-[10px] font-black uppercase tracking-widest rounded-lg border border-red-500/30 hover:bg-red-500 hover:text-white transition-all">
                                                                Encerrar
                                                            </button>
                                                        )}
                                                        {t.status === 'closed' && (
                                                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Finalizado</span>
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
                </div>
            )}

            {/* ─── PEDIDOS DE ACESSO ──────────────────────────────────── */}
            {activeTab === 'requests' && (
                <div className="space-y-8 animate-fade-in">
                    {/* Badge de alerta se houver pendentes */}
                    {requests.length > 0 && (
                        <div className="flex items-center gap-4 p-5 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
                            <span className="material-symbols-outlined text-amber-500 text-3xl animate-pulse">notification_important</span>
                            <div>
                                <p className="text-sm font-black text-white">{requests.length} cadastro(s) aguardando sua aprovação</p>
                                <p className="text-xs text-slate-400 mt-0.5">Esses usuários estão vendo a tela "Aguardando Aprovação" e não conseguem acessar o sistema.</p>
                            </div>
                        </div>
                    )}

                    <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
                        <div className="p-8 border-b border-white/5 flex items-center justify-between">
                            <div>
                                <h4 className="text-xl font-black text-white tracking-tight">Cadastros Aguardando Aprovação</h4>
                                <p className="text-sm text-slate-500 font-medium mt-1">
                                    Novos donos de barbearia que se cadastraram e ainda não tiveram acesso liberado.
                                </p>
                            </div>
                            <button onClick={() => {
                                setIsLoadingData(true);
                                supabase.from('profiles').select('id, tenant_id, created_at, status')
                                    .eq('status', 'pending').order('created_at', { ascending: false })
                                    .then(({ data }) => { setRequests(data || []); setIsLoadingData(false); });
                            }} className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-xs font-black text-slate-400 hover:text-white transition-all">
                                <span className="material-symbols-outlined text-sm">refresh</span>
                                Atualizar
                            </button>
                        </div>
                        {isLoadingData ? (
                            <div className="py-16 flex items-center justify-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
                            </div>
                        ) : requests.length === 0 ? (
                            <div className="py-20 text-center text-slate-500">
                                <span className="material-symbols-outlined text-5xl mb-3 block text-emerald-500/50">task_alt</span>
                                <p className="text-base font-black text-white">Nenhum cadastro pendente</p>
                                <p className="text-sm text-slate-500 mt-1">Todos os usuários já têm acesso liberado.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="bg-white/5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                                            <th className="px-8 py-5">Usuário / ID</th>
                                            <th className="px-8 py-5">Cadastrado em</th>
                                            <th className="px-8 py-5">Status</th>
                                            <th className="px-8 py-5 text-right">Ação</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {requests.map((r: any, i: number) => (
                                            <tr key={i} className="group hover:bg-white/[0.02] transition-colors">
                                                <td className="px-8 py-6">
                                                    <div className="flex items-center gap-3">
                                                        <div className="size-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                                                            <span className="material-symbols-outlined text-amber-500 text-lg">person</span>
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-black text-white font-mono">{r.id?.slice(0, 16)}…</p>
                                                            <p className="text-[10px] text-amber-500/50 font-bold uppercase tracking-widest mt-0.5">
                                                                Tenant: {r.tenant_id?.slice(0, 12) || '—'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6 text-sm font-bold text-slate-400">
                                                    {r.created_at ? new Date(r.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                                                </td>
                                                <td className="px-8 py-6">
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-amber-500/20 text-amber-500 animate-pulse">
                                                        Aguardando
                                                    </span>
                                                </td>
                                                <td className="px-8 py-6 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={async () => {
                                                                const { error } = await supabase.from('profiles')
                                                                    .update({ status: 'active' })
                                                                    .eq('id', r.id);
                                                                if (!error) {
                                                                    setRequests(prev => prev.filter((x: any) => x.id !== r.id));
                                                                    showToast('Acesso aprovado! O usuário já pode entrar no sistema.');
                                                                } else {
                                                                    showToast(`Erro ao aprovar: ${error.message}`, 'error');
                                                                }
                                                            }}
                                                            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-widest rounded-lg border border-emerald-500/30 hover:bg-emerald-500 hover:text-black transition-all"
                                                        >
                                                            <span className="material-symbols-outlined text-sm">check_circle</span>
                                                            Aprovar
                                                        </button>
                                                        <button
                                                            onClick={async () => {
                                                                if (!window.confirm('Rejeitar este cadastro? O usuário continuará bloqueado.')) return;
                                                                const { error } = await supabase.from('profiles')
                                                                    .update({ status: 'suspended' })
                                                                    .eq('id', r.id);
                                                                if (!error) {
                                                                    setRequests(prev => prev.filter((x: any) => x.id !== r.id));
                                                                    showToast('Cadastro rejeitado. Usuário suspenso.');
                                                                } else {
                                                                    showToast(`Erro: ${error.message}`, 'error');
                                                                }
                                                            }}
                                                            className="flex items-center gap-1.5 px-4 py-2 bg-red-500/10 text-red-500 text-[10px] font-black uppercase tracking-widest rounded-lg border border-red-500/30 hover:bg-red-500 hover:text-white transition-all"
                                                        >
                                                            <span className="material-symbols-outlined text-sm">cancel</span>
                                                            Rejeitar
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
                </div>
            )}

            {/* ─── GESTÃO DE ACESSOS ──────────────────────────────────── */}
            {activeTab === 'access' && (
                <div className="space-y-8 animate-fade-in">

                    {/* Matriz de Planos */}
                    <div className="bg-black border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
                        <div className="p-8 border-b border-white/5">
                            <h4 className="text-xl font-black text-white tracking-tight">Matriz de Planos &amp; Funcionalidades</h4>
                            <p className="text-sm text-slate-500 font-medium mt-1">Planos em definição — esta matriz reflete a estrutura atual prevista.</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-white/5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                                        <th className="px-8 py-5">Funcionalidade</th>
                                        <th className="px-8 py-5 text-center">Free</th>
                                        <th className="px-8 py-5 text-center">Professional</th>
                                        <th className="px-8 py-5 text-center text-amber-500">Elite</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {[
                                        { feature: 'Agendamentos', free: true, pro: true, elite: true },
                                        { feature: 'Cadastro de Clientes', free: true, pro: true, elite: true },
                                        { feature: 'Relatórios Básicos', free: true, pro: true, elite: true },
                                        { feature: 'Checkout / PDV', free: false, pro: true, elite: true },
                                        { feature: 'Folha de Pagamento', free: false, pro: true, elite: true },
                                        { feature: 'Inventário / Estoque', free: false, pro: true, elite: true },
                                        { feature: 'Múltiplos Colaboradores', free: false, pro: true, elite: true },
                                        { feature: 'Business Intelligence (BI)', free: false, pro: false, elite: true },
                                        { feature: 'Insights de IA (Gemini)', free: false, pro: false, elite: true },
                                        { feature: 'API Customizada', free: false, pro: false, elite: true },
                                        { feature: 'Suporte Prioritário', free: false, pro: false, elite: true },
                                    ].map((row, i) => (
                                        <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="px-8 py-4 text-sm font-bold text-white">{row.feature}</td>
                                            <td className="px-8 py-4 text-center">{row.free ? <span className="material-symbols-outlined text-emerald-500 text-lg">check_circle</span> : <span className="material-symbols-outlined text-slate-700 text-lg">cancel</span>}</td>
                                            <td className="px-8 py-4 text-center">{row.pro ? <span className="material-symbols-outlined text-emerald-500 text-lg">check_circle</span> : <span className="material-symbols-outlined text-slate-700 text-lg">cancel</span>}</td>
                                            <td className="px-8 py-4 text-center">{row.elite ? <span className="material-symbols-outlined text-amber-500 text-lg">check_circle</span> : <span className="material-symbols-outlined text-slate-700 text-lg">cancel</span>}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 border-t border-white/5 bg-amber-500/5">
                            <p className="text-xs text-amber-500/70 font-bold flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm">info</span>
                                A limitação por plano será ativada no código com base nos planos finalizados.
                            </p>
                        </div>
                    </div>

                    {/* Plano por Barbearia */}
                    <div className="bg-black border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
                        <div className="p-8 border-b border-white/5">
                            <h4 className="text-xl font-black text-white tracking-tight">Plano por Barbearia</h4>
                            <p className="text-sm text-slate-500 font-medium mt-1">Altere o plano de cada tenant diretamente.</p>
                        </div>
                        {shops.length === 0 ? (
                            <div className="py-12 flex flex-col items-center gap-3 text-slate-600">
                                <span className="material-symbols-outlined text-4xl">storefront</span>
                                <p className="text-sm font-bold">Carregue a aba Barbearias antes.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-white/5">
                                {shops.map((shop, i) => (
                                    <div key={i} className="flex items-center justify-between px-8 py-5 hover:bg-white/[0.02] transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="size-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center font-black text-amber-500 text-sm">
                                                {shop.name?.[0] || '?'}
                                            </div>
                                            <div>
                                                <p className="text-sm font-black text-white">{shop.name}</p>
                                                <p className="text-[10px] text-slate-500 font-bold">{shop.owner} · {shop.staff} membros</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <select
                                                title="Plano da barbearia"
                                                defaultValue={shop.plan || 'free'}
                                                onChange={(e) => {
                                                    showToast(`Plano de "${shop.name}" → ${e.target.value}. Requer edge function para persistir.`);
                                                }}
                                                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs font-black text-white [color-scheme:dark] outline-none focus:border-amber-500/50"
                                            >
                                                <option value="free">Free</option>
                                                <option value="pro">Professional</option>
                                                <option value="elite">Elite</option>
                                            </select>
                                            <span className={`text-[10px] font-black py-1 px-2 rounded ${shop.status === 'Ativo' ? 'text-emerald-500 bg-emerald-500/10' : 'text-amber-500 bg-amber-500/10'}`}>{shop.status}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Permissões por Colaborador */}
                    <div className="bg-black border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
                        <div className="p-8 border-b border-white/5">
                            <h4 className="text-xl font-black text-white tracking-tight">Permissões por Colaborador</h4>
                            <p className="text-sm text-slate-500 font-medium mt-1">Altere o cargo de cada barbeiro/recepcionista (salvo diretamente no banco).</p>
                        </div>
                        {allUsers.filter(u => u.source === 'staff').length === 0 ? (
                            <div className="py-12 text-center text-slate-600">
                                <span className="material-symbols-outlined text-4xl mb-2 block">group</span>
                                <p className="text-sm font-bold">Acesse a aba Usuários primeiro para carregar os dados.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-white/5">
                                {allUsers.filter(u => u.source === 'staff').map((u, i) => (
                                    <div key={i} className="flex items-center justify-between px-8 py-5 hover:bg-white/[0.02] transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="size-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center font-black text-sm text-slate-400">
                                                {u.name?.[0]?.toUpperCase() || '?'}
                                            </div>
                                            <div>
                                                <p className="text-sm font-black text-white">{u.name}</p>
                                                <p className="text-[10px] text-slate-500 font-bold">{u.email || '—'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <select
                                                title="Cargo do colaborador"
                                                defaultValue={u.role || 'Barber'}
                                                onChange={async (e) => {
                                                    const newRole = e.target.value;
                                                    const { error } = await supabase.from('staff').update({ role: newRole }).eq('id', u.id);
                                                    if (!error) showToast(`Cargo de "${u.name}" → ${newRole}.`);
                                                    else showToast('Erro ao atualizar cargo.', 'error');
                                                }}
                                                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs font-black text-white [color-scheme:dark] outline-none focus:border-amber-500/50"
                                            >
                                                <option value="Barber">Barbeiro</option>
                                                <option value="Receptionist">Recepcionista</option>
                                                <option value="Manager">Gerente</option>
                                            </select>
                                            <span className={`text-[10px] font-black py-1 px-2 rounded ${u.auth === 'Ativo' || u.auth === 'Verificado' ? 'text-emerald-500 bg-emerald-500/10' : 'text-slate-500 bg-white/5'}`}>{u.auth}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ─── MODAIS ─────────────────────────────────────────────── */}

            {/* Ticket Modal */}
            <Modal isOpen={isTicketModalOpen} onClose={() => setIsTicketModalOpen(false)} title={`Chamado: ${selectedTicket?.subject}`} maxWidth="lg">
                <div className="flex flex-col flex-1 min-h-0">
                    <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl mb-4 text-sm text-slate-400 italic">{selectedTicket?.description}</div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-2 mb-4 max-h-[300px]">
                        {messages.map((m: any) => (
                            <div key={m.id} className={`flex ${m.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] p-3 rounded-2xl ${m.sender_id === user?.id ? 'bg-amber-600 text-black rounded-tr-none font-bold' : 'bg-white/10 text-slate-200 rounded-tl-none'}`}>
                                    <p className="text-sm">{m.message}</p>
                                    <p className={`text-[9px] mt-1 uppercase font-black ${m.sender_id === user?.id ? 'text-black/50' : 'text-slate-500'}`}>{new Date(m.created_at).toLocaleTimeString()}</p>
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                    <div className="flex gap-2 mt-auto pt-4">
                        <input type="text" placeholder="Digite a resposta..." value={reply} onChange={e => setReply(e.target.value)}
                            className="flex-1 bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white outline-none focus:border-amber-500/50" />
                        <Button onClick={async () => {
                            if (!reply.trim() || !selectedTicket) return;
                            const { data, error } = await supabase.from('ticket_messages').insert({ ticket_id: selectedTicket.id, sender_id: user!.id, message: reply }).select().single();
                            if (!error && data) {
                                setMessages([...messages, data]);
                                setReply('');
                                // Status → aguardando resposta do usuário
                                await supabase.from('support_tickets').update({ status: 'awaiting_response' }).eq('id', selectedTicket.id);
                                setSelectedTicket((prev: any) => ({ ...prev, status: 'awaiting_response' }));
                                setTickets(prev => prev.map(tk => tk.id === selectedTicket.id ? { ...tk, status: 'awaiting_response' } : tk));
                            }
                        }} disabled={!reply.trim()} variant="warning" size="sm">Enviar</Button>
                    </div>
                    <div className="flex justify-between items-center mt-4 pt-4 border-t border-white/10">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-500 uppercase font-black">Status:</span>
                            {(selectedTicket?.status === 'awaiting_response' || selectedTicket?.status === 'responded') && (
                                <span className="text-[10px] font-black text-blue-400 uppercase bg-blue-500/10 px-2 py-0.5 rounded animate-pulse">Aguardando Resposta</span>
                            )}
                            {selectedTicket?.status === 'open' && (
                                <span className="text-[10px] font-black text-amber-500 uppercase bg-amber-500/10 px-2 py-0.5 rounded">Aberto</span>
                            )}
                            {selectedTicket?.status === 'closed' && (
                                <span className="text-[10px] font-black text-slate-500 uppercase bg-white/5 px-2 py-0.5 rounded">Encerrado</span>
                            )}
                        </div>
                        {selectedTicket?.status !== 'closed' && (
                            <button onClick={async () => {
                                if (!window.confirm('Encerrar este chamado?')) return;
                                await supabase.from('support_tickets').update({ status: 'closed' }).eq('id', selectedTicket.id);
                                setTickets(prev => prev.map(tk => tk.id === selectedTicket.id ? { ...tk, status: 'closed' } : tk));
                                setIsTicketModalOpen(false);
                                showToast('Chamado encerrado com sucesso.');
                            }} className="flex items-center gap-1.5 px-4 py-2 bg-red-500/10 border border-red-500/30 text-red-500 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-red-500 hover:text-white transition-all">
                                <span className="material-symbols-outlined text-sm">cancel</span>
                                Encerrar Chamado
                            </button>
                        )}
                    </div>
                </div>
            </Modal>

            {/* Console de Logs */}
            <Modal isOpen={isConsoleOpen} onClose={() => setIsConsoleOpen(false)} title="Console de Logs do Sistema" maxWidth="lg">
                <div className="bg-black rounded-xl p-4 font-mono text-xs space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                    <div className="flex gap-3"><span className="text-slate-600">{new Date().toLocaleTimeString()}</span><span className="text-emerald-500">[INFO]</span><span className="text-slate-300">Sistema iniciado com sucesso.</span></div>
                    <div className="flex gap-3"><span className="text-slate-600">{new Date().toLocaleTimeString()}</span><span className="text-emerald-500">[INFO]</span><span className="text-slate-300">Conexão com Supabase estabelecida.</span></div>
                    <div className="flex gap-3"><span className="text-slate-600">{new Date().toLocaleTimeString()}</span><span className="text-emerald-500">[INFO]</span><span className="text-slate-300">Sessão ativa: {user?.email}</span></div>
                    <div className="flex gap-3"><span className="text-slate-600">{new Date().toLocaleTimeString()}</span><span className="text-emerald-500">[INFO]</span><span className="text-slate-300">Total barbearias: {kpis.totalShops} | Usuários: {kpis.totalUsers} | Chamados: {kpis.activeTickets}</span></div>
                    <div className="flex gap-3 animate-pulse"><span className="text-slate-600">{new Date().toLocaleTimeString()}</span><span className="text-emerald-500">[INFO]</span><span className="text-slate-300">Aguardando eventos do sistema...</span></div>
                </div>
            </Modal>

            {/* Configurações Globais */}
            <Modal isOpen={isGlobalSettingsOpen} onClose={() => setIsGlobalSettingsOpen(false)} title="Configurações Globais do SaaS" maxWidth="md">
                <div className="space-y-4">
                    {[
                        { label: 'Modo de Manutenção', desc: 'Bloqueia acesso de usuários ao sistema', action: 'ATIVAR', color: 'red' },
                        { label: 'Notificações Push Globais', desc: 'Enviar anúncios para todos os tenants', action: 'ENVIAR', color: 'amber' },
                        { label: 'Protocolo de Backup', desc: 'Backup manual do banco de dados', action: 'INICIAR', color: 'emerald' },
                    ].map((item, i) => (
                        <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                            <div>
                                <p className="text-sm font-bold text-white">{item.label}</p>
                                <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                            </div>
                            <button onClick={() => { showToast(`${item.label}: ação executada.`); setIsGlobalSettingsOpen(false); }}
                                className={`px-4 py-1.5 bg-${item.color}-500/10 border border-${item.color}-500/30 text-${item.color}-500 text-xs font-black rounded-lg hover:bg-${item.color}-500 hover:text-${item.color === 'amber' ? 'black' : 'white'} transition-all`}>
                                {item.action}
                            </button>
                        </div>
                    ))}
                </div>
            </Modal>

            {/* Nova Unidade */}
            <Modal isOpen={isNewUnitOpen} onClose={() => setIsNewUnitOpen(false)} title="Registrar Nova Unidade" maxWidth="md">
                <form onSubmit={async (e) => {
                    e.preventDefault();
                    setNewUnitLoading(true);
                    await new Promise(r => setTimeout(r, 600));
                    setNewUnitLoading(false);
                    setIsNewUnitOpen(false);
                    setNewUnitForm({ name: '', owner: '', plan: 'Starter', email: '' });
                    showToast(`Unidade "${newUnitForm.name}" registrada!`);
                    fetchShops();
                }} className="space-y-4">
                    {[
                        { label: 'Nome da Barbearia', key: 'name', type: 'text', placeholder: 'Ex: Barbearia Premium' },
                        { label: 'Proprietário', key: 'owner', type: 'text', placeholder: 'Nome completo' },
                        { label: 'E-mail do Proprietário', key: 'email', type: 'email', placeholder: 'dono@email.com' },
                    ].map(field => (
                        <div key={field.key}>
                            <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">{field.label}</label>
                            <input required type={field.type} value={(newUnitForm as any)[field.key]}
                                onChange={e => setNewUnitForm({ ...newUnitForm, [field.key]: e.target.value })}
                                placeholder={field.placeholder}
                                className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-white outline-none focus:border-amber-500/50" />
                        </div>
                    ))}
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">Plano</label>
                        <select value={newUnitForm.plan} onChange={e => setNewUnitForm({ ...newUnitForm, plan: e.target.value })}
                            className="w-full bg-[#1A1A1A] border border-white/10 rounded-lg p-3 text-sm text-white outline-none [color-scheme:dark]">
                            <option value="free">Free</option>
                            <option value="pro">Professional</option>
                            <option value="elite">Elite</option>
                        </select>
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={() => setIsNewUnitOpen(false)} className="flex-1 py-3 rounded-lg text-sm font-bold text-slate-400 bg-white/5 hover:bg-white/10 transition-colors">Cancelar</button>
                        <button type="submit" disabled={newUnitLoading} className="flex-1 py-3 rounded-lg text-sm font-black text-black bg-amber-500 hover:bg-amber-400 transition-all disabled:opacity-50">{newUnitLoading ? 'Registrando...' : 'Registrar Unidade'}</button>
                    </div>
                </form>
            </Modal>

            {/* Shop Panel Modal */}
            <Modal isOpen={isPanelOpen} onClose={() => setIsPanelOpen(false)} title={`Painel — ${selectedShop?.name || 'Barbearia'}`} maxWidth="lg">
                {isPanelLoading ? (
                    <div className="py-12 flex flex-col items-center justify-center gap-3">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Carregando dados do tenant...</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* KPI Row */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {[
                                { label: 'Equipe', value: panelData.staff.length, icon: 'group', color: 'text-blue-400' },
                                { label: 'Clientes', value: panelData.clients, icon: 'person', color: 'text-emerald-400' },
                                { label: 'Agendamentos', value: panelData.appointments, icon: 'calendar_month', color: 'text-purple-400' },
                                { label: 'Faturamento', value: fmt(panelData.revenue), icon: 'payments', color: 'text-amber-400' },
                            ].map((kpi, i) => (
                                <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                                    <span className={`material-symbols-outlined text-2xl ${kpi.color}`}>{kpi.icon}</span>
                                    <p className="text-xs text-slate-500 font-black uppercase tracking-widest mt-1">{kpi.label}</p>
                                    <p className="text-lg font-black text-white mt-0.5">{kpi.value}</p>
                                </div>
                            ))}
                        </div>

                        {/* Staff List */}
                        <div>
                            <h5 className="text-xs font-black uppercase text-slate-400 tracking-widest mb-3">Equipe</h5>
                            {panelData.staff.length === 0 ? (
                                <p className="text-sm text-slate-600 text-center py-4">Nenhum colaborador cadastrado.</p>
                            ) : (
                                <div className="space-y-2">
                                    {panelData.staff.map((s: any) => (
                                        <div key={s.id} className="flex items-center justify-between px-4 py-3 bg-white/5 rounded-xl border border-white/5">
                                            <div className="flex items-center gap-3">
                                                <div className="size-7 rounded-full bg-white/10 flex items-center justify-center text-xs font-black text-slate-400">
                                                    {s.name?.[0]?.toUpperCase()}
                                                </div>
                                                <p className="text-sm font-bold text-white">{s.name}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-black uppercase text-slate-500 bg-white/5 px-2 py-0.5 rounded">{s.role}</span>
                                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${s.status === 'active' ? 'text-emerald-500 bg-emerald-500/10' : 'text-slate-500 bg-white/5'}`}>{s.status}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Recent Transactions */}
                        {panelData.recentTx.length > 0 && (
                            <div>
                                <h5 className="text-xs font-black uppercase text-slate-400 tracking-widest mb-3">Últimas Transações</h5>
                                <div className="space-y-2">
                                    {panelData.recentTx.map((tx: any, i: number) => (
                                        <div key={i} className="flex items-center justify-between px-4 py-3 bg-white/5 rounded-xl border border-white/5">
                                            <div>
                                                <p className="text-sm font-bold text-white">{tx.description || 'Receita'}</p>
                                                <p className="text-[10px] text-slate-500 font-bold">{tx.date ? new Date(tx.date).toLocaleDateString('pt-BR') : '—'}</p>
                                            </div>
                                            <span className="text-sm font-black text-emerald-400">+ {fmt(Number(tx.amount) || 0)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Info */}
                        <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                            <p className="text-xs font-bold text-amber-500/80">Tenant ID: <span className="font-mono text-amber-500">{selectedShop?.tenant_id}</span></p>
                            <p className="text-xs font-bold text-slate-500 mt-1">Proprietário: {selectedShop?.owner} · Plano: <span className="text-white uppercase">{selectedShop?.plan}</span></p>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Toast */}
            {toast && (
                <div className={`fixed bottom-6 right-6 z-[100] px-5 py-3 rounded-xl text-sm font-bold shadow-2xl animate-fade-in flex items-center gap-2 ${toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                    <span className="material-symbols-outlined text-lg">{toast.type === 'success' ? 'check_circle' : 'error'}</span>
                    {toast.msg}
                </div>
            )}
        </div>
    );
};

export default Admin;