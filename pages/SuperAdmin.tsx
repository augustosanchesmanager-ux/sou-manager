import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Toast from '../components/Toast';

interface Ticket {
    id: string;
    subject: string;
    status: string;
    priority: string;
    created_at: string;
    tenant_id: string;
}

interface AccessRequest {
    id: string;
    tenant_name: string;
    owner_name: string;
    email: string;
    status: string;
    created_at: string;
}

const SuperAdmin: React.FC = () => {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [requests, setRequests] = useState<AccessRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const { user } = useAuth();
    const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null);

    useEffect(() => {
        if (user) {
            checkAccessAndFetchData();
        }
    }, [user]);

    const checkAccessAndFetchData = async () => {
        setLoading(true);
        if (!user) return;

        // Verify role
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        const role = profile?.role;
        const hasAccess = role === 'superadmin' || role === 'Super Admin';
        setIsSuperAdmin(hasAccess);

        if (hasAccess) {
            const [ticketsRes, requestsRes] = await Promise.all([
                supabase.from('support_tickets').select('*').order('created_at', { ascending: false }),
                supabase.from('access_requests').select('*').order('created_at', { ascending: false })
            ]);

            if (ticketsRes.error) console.error('Error fetching tickets:', ticketsRes.error);
            if (requestsRes.error) console.error('Error fetching requests:', requestsRes.error);

            setTickets(ticketsRes.data || []);
            setRequests(requestsRes.data || []);
        }
        setLoading(false);
    };

    const handleApproveRequest = async (requestId: string) => {
        const { error } = await supabase.rpc('approve_access_request', { p_request_id: requestId });

        if (error) {
            setToast({ message: `Erro: ${error.message}`, type: 'error' });
        } else {
            setToast({ message: 'Barbearia ativada com sucesso!', type: 'success' });
            checkAccessAndFetchData();
        }
    };

    return (
        <div className="space-y-8 animate-fade-in">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            ) : isSuperAdmin === false ? (
                <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-2xl p-10 text-center max-w-2xl mx-auto mt-10 shadow-lg shadow-indigo-500/5">
                    <div className="bg-indigo-500 text-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 shadow-md shadow-indigo-500/30">
                        <span className="material-symbols-outlined text-3xl">star</span>
                    </div>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-4 tracking-tight">Recurso Exclusivo PRO</h2>
                    <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-md mx-auto leading-relaxed">
                        Esta área é exclusiva para assinantes dos planos avançados.
                        Faça o upgrade agora e desbloqueie análises profundas e gestão avançada para o seu negócio!
                    </p>
                    <div className="grid grid-cols-2 gap-4 text-left max-w-md mx-auto mb-8">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-emerald-500 text-sm">check_circle</span>
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Análises detalhadas</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-emerald-500 text-sm">check_circle</span>
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Suporte Dedicado</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-emerald-500 text-sm">check_circle</span>
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Múltiplas Filiais</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-emerald-500 text-sm">check_circle</span>
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Marketing Integrado</span>
                        </div>
                    </div>
                    <Button onClick={() => window.location.href = '#/settings'} className="w-full sm:w-auto px-8 py-4 text-base shadow-xl shadow-primary/20">
                        Conhecer Planos
                    </Button>
                </div>
            ) : (
                <>
                    <div>
                        <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Super Admin Dashboard</h2>
                        <p className="text-slate-500 mt-1">Visão global do sistema e gestão de acessos.</p>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                        {/* Tickets Section */}
                        <section className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-slate-200 dark:border-border-dark flex justify-between items-center">
                                <h3 className="font-bold flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary">confirmation_number</span>
                                    Chamados de Suporte (Global)
                                </h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-xs font-bold uppercase tracking-widest">
                                            <th className="px-6 py-4">Assunto</th>
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4 text-right">Data</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-border-dark text-sm">
                                        {loading ? (
                                            <tr><td colSpan={3} className="px-6 py-8 text-center">Carregando...</td></tr>
                                        ) : tickets.length === 0 ? (
                                            <tr><td colSpan={3} className="px-6 py-8 text-center text-slate-500">Nenhum chamado aberto.</td></tr>
                                        ) : (
                                            tickets.map(t => (
                                                <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{t.subject}</td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${t.status === 'open' ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                                            {t.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right text-slate-500">
                                                        {new Date(t.created_at).toLocaleDateString('pt-BR')}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </section>

                        {/* Access Requests Section */}
                        <section className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-slate-200 dark:border-border-dark flex justify-between items-center">
                                <h3 className="font-bold flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary">person_add</span>
                                    Pedidos de Acesso
                                </h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-xs font-bold uppercase tracking-widest">
                                            <th className="px-6 py-4">Barbearia / Responsável</th>
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4 text-right">Ação</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-border-dark text-sm">
                                        {loading ? (
                                            <tr><td colSpan={3} className="px-6 py-8 text-center">Carregando...</td></tr>
                                        ) : requests.length === 0 ? (
                                            <tr><td colSpan={3} className="px-6 py-8 text-center text-slate-500">Nenhum pedido pendente.</td></tr>
                                        ) : (
                                            requests.map(r => (
                                                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <p className="font-bold text-slate-900 dark:text-white">{r.tenant_name}</p>
                                                        <p className="text-xs text-slate-500">{r.owner_name} ({r.email})</p>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${r.status === 'pending' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                                            {r.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        {r.status === 'pending' && (
                                                            <Button size="sm" onClick={() => handleApproveRequest(r.id)}>Aprovar</Button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    </div>
                </>
            )}
        </div>
    );
};

export default SuperAdmin;
