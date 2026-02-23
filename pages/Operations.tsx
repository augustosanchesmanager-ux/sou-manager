import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';

interface Appointment {
    id: string;
    client_name: string;
    service_name: string;
    staff_name: string;
    start_time: string;
    status: string;
    avatar?: string;
}

interface Product {
    id: string;
    name: string;
    stock: number;
    min_stock: number;
}

const Operations: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [lowStockItems, setLowStockItems] = useState<Product[]>([]);
    const [stats, setStats] = useState({ attended: 0, avgTicket: 0 });
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setLoading(true);
        const today = new Date();
        const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
        const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();

        // Fetch today's appointments
        const { data: appts } = await supabase
            .from('appointments')
            .select('*')
            .gte('start_time', startOfDay)
            .lte('start_time', endOfDay)
            .neq('status', 'cancelled')
            .order('start_time', { ascending: true });

        // Fetch low stock items
        const { data: products } = await supabase
            .from('products')
            .select('*')
            .or('stock.lte.min_stock,stock.lte.5')
            .limit(5);

        // Fetch completed appointments for stats
        const { data: completed } = await supabase
            .from('appointments')
            .select('id, total_price') // Assuming there's a total_price or similar
            .eq('status', 'completed')
            .gte('start_time', startOfDay)
            .lte('start_time', endOfDay);

        if (appts) setAppointments(appts);
        if (products) setLowStockItems(products);

        if (completed) {
            const attendedCount = completed.length;
            const totalRevenue = completed.reduce((sum, item) => sum + (Number(item.total_price) || 0), 0);
            const avg = attendedCount > 0 ? totalRevenue / attendedCount : 0;
            setStats({ attended: attendedCount, avgTicket: avg });
        }

        setLoading(false);
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const formatTime = (isoString: string) => {
        return new Date(isoString).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    };

    const getStatusLabel = (status: string) => {
        const labels: Record<string, string> = {
            'confirmed': 'Confirmado',
            'waiting': 'Aguardando',
            'pending': 'Pendente',
            'completed': 'Concluido',
            'in_progress': 'Em Atendimento'
        };
        return labels[status] || status;
    };

    return (
        <div className="space-y-8 max-w-7xl mx-auto w-full animate-fade-in pb-10">
            {/* Quick Action Cards */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div onClick={() => navigate('/clients')} className="bg-white dark:bg-card-dark p-6 rounded-xl border border-slate-200 dark:border-border-dark flex items-center justify-between group hover:border-primary/50 cursor-pointer transition-all">
                    <div className="space-y-1">
                        <p className="text-slate-500 text-sm font-medium">Novo Cliente</p>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Cadastrar</h3>
                    </div>
                    <div className="size-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all border border-slate-200 dark:border-border-dark">
                        <span className="material-symbols-outlined text-2xl">person_add</span>
                    </div>
                </div>
                <div onClick={() => navigate('/schedule')} className="bg-white dark:bg-card-dark p-6 rounded-xl border border-slate-200 dark:border-border-dark flex items-center justify-between group hover:border-primary/50 cursor-pointer transition-all">
                    <div className="space-y-1">
                        <p className="text-slate-500 text-sm font-medium">Agendamento</p>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Novo Horário</h3>
                    </div>
                    <div className="size-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all border border-slate-200 dark:border-border-dark">
                        <span className="material-symbols-outlined text-2xl">event_available</span>
                    </div>
                </div>
                <div onClick={() => navigate('/products')} className="bg-white dark:bg-card-dark p-6 rounded-xl border border-slate-200 dark:border-border-dark flex items-center justify-between group hover:border-orange-500/50 cursor-pointer transition-all">
                    <div className="space-y-1">
                        <p className="text-slate-500 text-sm font-medium">Itens em Baixa</p>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">{lowStockItems.length.toString().padStart(2, '0')} Alertas</h3>
                    </div>
                    <div className={`size-12 rounded-full flex items-center justify-center transition-all border border-slate-200 dark:border-border-dark ${lowStockItems.length > 0 ? 'bg-orange-100 dark:bg-orange-950/30 text-orange-500 group-hover:bg-orange-500 group-hover:text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 opacity-50'}`}>
                        <span className="material-symbols-outlined text-2xl">warning</span>
                    </div>
                </div>
            </section>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* Timeline: Next Appointments */}
                <section className="xl:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-bold font-display text-slate-900 dark:text-white">Próximos Agendamentos</h3>
                        <button onClick={() => navigate('/schedule')} className="text-primary text-sm font-bold hover:underline">Ver Agenda Completa</button>
                    </div>
                    <div className="space-y-4 relative before:absolute before:left-5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                        {loading ? (
                            <div className="p-12 text-center text-slate-500">Carregando agendamentos...</div>
                        ) : appointments.length === 0 ? (
                            <div className="p-12 text-center text-slate-500 bg-white dark:bg-card-dark rounded-xl border border-dashed border-slate-300 dark:border-slate-800 ml-12">
                                Fora do horário de expediente ou sem agendamentos para hoje.
                            </div>
                        ) : (
                            appointments.map((apt) => (
                                <div key={apt.id} className="relative pl-12">
                                    <div className={`absolute left-0 top-1/2 -translate-y-1/2 size-10 rounded-full border-4 border-background-light dark:border-background-dark flex items-center justify-center z-10 shadow-lg ${apt.status === 'waiting' ? 'bg-primary' : 'bg-slate-500'}`}>
                                        <span className="text-xs font-bold text-white">{formatTime(apt.start_time)}</span>
                                    </div>
                                    <div className="bg-white dark:bg-card-dark p-5 rounded-xl border border-slate-200 dark:border-border-dark flex flex-wrap gap-4 items-center justify-between hover:shadow-md transition-shadow">
                                        <div className="flex items-center gap-4">
                                            <div className="size-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-border-dark">
                                                {apt.avatar ? (
                                                    <img className="w-full h-full object-cover" alt={apt.client_name} src={apt.avatar} />
                                                ) : (
                                                    <span className="material-symbols-outlined text-slate-400">person</span>
                                                )}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-900 dark:text-white">{apt.client_name}</h4>
                                                <p className="text-sm text-slate-500">{apt.service_name}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-8">
                                            <div className="text-right hidden sm:block">
                                                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Profissional</p>
                                                <p className="font-medium text-slate-900 dark:text-white">{apt.staff_name}</p>
                                            </div>
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase border ${apt.status === 'waiting' ? 'bg-primary/10 text-primary border-primary/20' :
                                                    apt.status === 'completed' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 border-emerald-500/20' :
                                                        'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
                                                }`}>
                                                {getStatusLabel(apt.status)}
                                            </span>
                                            <button onClick={() => navigate('/schedule')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400">
                                                <span className="material-symbols-outlined">more_vert</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </section>

                {/* Inventory Alert Section */}
                <aside className="space-y-6">
                    <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark overflow-hidden shadow-sm">
                        <div className="p-6 border-b border-slate-200 dark:border-border-dark flex items-center justify-between">
                            <h3 className="font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                                <span className="material-symbols-outlined text-orange-500">inventory_2</span>
                                Estoque Crítico
                            </h3>
                            <button onClick={() => navigate('/products')} className="text-xs font-bold text-primary hover:underline">Ver Todos</button>
                        </div>
                        <div className="p-2">
                            {lowStockItems.length === 0 ? (
                                <div className="p-8 text-center text-xs text-slate-500">
                                    <span className="material-symbols-outlined block text-2xl mb-2 text-slate-300">check_circle</span>
                                    Estoque em dia!
                                </div>
                            ) : (
                                lowStockItems.map(item => (
                                    <div key={item.id} className="p-4 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg flex items-center justify-between transition-colors">
                                        <div>
                                            <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.name}</p>
                                            <p className="text-xs text-slate-500">Qtd atual: {item.stock.toString().padStart(2, '0')}</p>
                                        </div>
                                        <span className={`text-[10px] font-bold px-2 py-1 rounded ${item.stock <= 0 ? 'bg-red-100 dark:bg-red-950/50 text-red-600' : 'bg-orange-100 dark:bg-orange-950/30 text-orange-600 font-bold uppercase'}`}>
                                            {item.stock <= 0 ? 'Zerrado' : 'Baixo'}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-white/5 border-t border-slate-100 dark:border-border-dark">
                            <button onClick={() => navigate('/products')} className="w-full py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-lg text-xs font-bold transition-all text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-border-dark">
                                Solicitar Pedido
                            </button>
                        </div>
                    </div>

                    {/* Resumo do Turno */}
                    <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 p-6 rounded-xl space-y-4 shadow-sm shadow-primary/5">
                        <h4 className="text-xs font-bold text-primary dark:text-primary uppercase tracking-widest">Resumo do Turno</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white dark:bg-card-dark p-3 rounded-lg border border-slate-200 dark:border-border-dark shadow-sm">
                                <p className="text-[10px] text-slate-500 font-bold uppercase">Atendidos</p>
                                <p className="text-xl font-black text-slate-900 dark:text-white">{stats.attended}</p>
                            </div>
                            <div className="bg-white dark:bg-card-dark p-3 rounded-lg border border-slate-200 dark:border-border-dark shadow-sm">
                                <p className="text-[10px] text-slate-500 font-bold uppercase">Ticket Médio</p>
                                <p className="text-xl font-black text-slate-900 dark:text-white">R$ {stats.avgTicket.toFixed(0)}</p>
                            </div>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
};

export default Operations;