import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/ui/Modal';
import DatePickerInput from '../components/ui/DatePickerInput';

interface Appointment {
    id: string;
    client_name: string;
    service_name: string;
    staff_name: string;
    staff_id: string;
    start_time: string;
    status: string;
    avatar?: string;
    price?: number;
    execution_participants?: ExecutionParticipant[];
}

interface ExecutionParticipant {
    id: string;
    professional_id: string;
    professional_name: string;
    role: 'primary' | 'assistant' | 'co_executor';
    payout_type: 'percentage' | 'fixed';
    payout_value: number;
}

type ExecutionRole = 'assistant' | 'co_executor';
type PayoutType = 'percentage' | 'fixed';

interface Product {
    id: string;
    name: string;
    stock_quantity: number;
    minimum_stock: number;
}

const Operations: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { tenantId, user } = useAuth();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [lowStockItems, setLowStockItems] = useState<Product[]>([]);
    const [staffList, setStaffList] = useState<{id: string; name: string}[]>([]);
    const [stats, setStats] = useState({ attended: 0, avgTicket: 0, total: 0, confirmed: 0, pending: 0, inProgress: 0, cancelled: 0, revenue: 0 });
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    
    // Modal states
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showSharedExecutionModal, setShowSharedExecutionModal] = useState(false);
    const [sharedExecutionParticipants, setSharedExecutionParticipants] = useState<ExecutionParticipant[]>([]);

    const fetchData = useCallback(async () => {
        if (!tenantId) {
            setAppointments([]);
            setLowStockItems([]);
            setStats({ attended: 0, avgTicket: 0, total: 0, confirmed: 0, pending: 0, inProgress: 0, cancelled: 0, revenue: 0 });
            setLoading(false);
            return;
        }

        setLoading(true);
        const [year, month, day] = selectedDate.split('-').map(Number);
        const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0).toISOString();
        const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999).toISOString();

        // Fetch today's appointments
        const { data: appts } = await supabase
            .from('appointments')
            .select('*')
            .eq('tenant_id', tenantId)
            .gte('start_time', startOfDay)
            .lte('start_time', endOfDay)
            .order('start_time', { ascending: true });

        // Fetch low stock items
        const { data: products } = await supabase
            .from('products')
            .select('id, name, stock_quantity, minimum_stock')
            .eq('tenant_id', tenantId)
            .lte('stock_quantity', 5)
            .limit(5);

        // Fetch staff for execution participants
        const { data: staff } = await supabase
            .from('staff')
            .select('id, name')
            .eq('tenant_id', tenantId)
            .eq('status', 'active')
            .in('role', ['Barber', 'Manager']);

        if (appts) setAppointments(appts);
        if (products) setLowStockItems(products);
        if (staff) setStaffList(staff);

        // Calculate appointment KPIs
        const appointmentStats = (appts || []).reduce((acc, apt) => {
            acc.total++;
            if (apt.status === 'confirmed') acc.confirmed++;
            else if (apt.status === 'pending') acc.pending++;
            else if (apt.status === 'in_progress') acc.inProgress++;
            else if (apt.status === 'completed') acc.attended++;
            else if (apt.status === 'cancelled' || apt.status === 'no_show') acc.cancelled++;
            return acc;
        }, { total: 0, confirmed: 0, pending: 0, inProgress: 0, attended: 0, cancelled: 0 });

        const completedAppointmentIds = (appts || [])
            .filter((appointment) => appointment.status === 'completed')
            .map((appointment) => appointment.id);

        if (completedAppointmentIds.length > 0) {
            const { data: completedComandas } = await supabase
                .from('comandas')
                .select('appointment_id, total')
                .eq('tenant_id', tenantId)
                .in('appointment_id', completedAppointmentIds);

            const attendedCount = completedAppointmentIds.length;
            const totalRevenue = (completedComandas || []).reduce((sum, item) => sum + (Number(item.total) || 0), 0);
            const avg = attendedCount > 0 ? totalRevenue / attendedCount : 0;
            setStats({ 
                attended: attendedCount, 
                avgTicket: avg,
                total: appointmentStats.total,
                confirmed: appointmentStats.confirmed,
                pending: appointmentStats.pending,
                inProgress: appointmentStats.inProgress,
                cancelled: appointmentStats.cancelled,
                revenue: totalRevenue
            });
        } else {
            setStats({ 
                attended: 0, 
                avgTicket: 0,
                total: appointmentStats.total,
                confirmed: appointmentStats.confirmed,
                pending: appointmentStats.pending,
                inProgress: appointmentStats.inProgress,
                cancelled: appointmentStats.cancelled,
                revenue: 0
            });
        }

        setLoading(false);
    }, [tenantId]);

    useEffect(() => {
        fetchData();
    }, [fetchData, selectedDate]);

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
            {/* Quick Action Buttons - Compactos */}
            <section className="flex items-center gap-3 flex-wrap">
                <button
                    onClick={() => navigate('/schedule')}
                    className="px-4 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-primary/20 transition-all"
                >
                    <span className="material-symbols-outlined text-lg">add</span>
                    Novo Agendamento
                </button>
                <button
                    onClick={() => navigate('/schedule')}
                    className="px-4 py-2.5 bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-sm flex items-center gap-2 shadow-sm transition-all"
                >
                    <span className="material-symbols-outlined text-lg">schedule</span>
                    Reagendar
                </button>
                {lowStockItems.length > 0 && (
                    <button
                        onClick={() => navigate('/products')}
                        className="px-3 py-2.5 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-950/40 text-orange-700 dark:text-orange-400 rounded-xl font-bold text-sm flex items-center gap-2 transition-all"
                    >
                        <span className="material-symbols-outlined text-lg">warning</span>
                        {lowStockItems.length} {lowStockItems.length === 1 ? 'alerta' : 'alertas'}
                    </button>
                )}
            </section>

            <div className="flex items-center gap-4 mb-2">
                <DatePickerInput
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className="bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-900 dark:text-white cursor-pointer"
                />
                <span className="text-sm text-slate-500 dark:text-slate-400">
                    {new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </span>
            </div>

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
                                            <div className="flex items-center gap-2">
                                                {apt.status !== 'completed' && apt.status !== 'cancelled' && (
                                                    <>
                                                        <button 
                                                            onClick={() => {
                                                                setSelectedAppointment(apt);
                                                                setShowDetailsModal(true);
                                                            }}
                                                            className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold rounded-lg"
                                                        >
                                                            Atender
                                                        </button>
                                                        <button 
                                                            onClick={() => {
                                                                setSelectedAppointment(apt);
                                                                setSharedExecutionParticipants(apt.execution_participants || []);
                                                                setShowSharedExecutionModal(true);
                                                            }}
                                                            className="px-3 py-1.5 bg-violet-100 dark:bg-violet-900/30 hover:bg-violet-200 dark:hover:bg-violet-900/50 text-violet-600 dark:text-violet-400 text-xs font-bold rounded-lg flex items-center gap-1"
                                                        >
                                                            <span className="material-symbols-outlined text-sm">group</span>
                                                            Compartilhar
                                                        </button>
                                                    </>
                                                )}
                                                <button onClick={() => navigate('/schedule')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400">
                                                    <span className="material-symbols-outlined">more_vert</span>
                                                </button>
                                            </div>
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
                                            <p className="text-xs text-slate-500">Qtd atual: {item.stock_quantity.toString().padStart(2, '0')}</p>
                                        </div>
                                        <span className={`text-[10px] font-bold px-2 py-1 rounded ${item.stock_quantity <= 0 ? 'bg-red-100 dark:bg-red-950/50 text-red-600' : 'bg-orange-100 dark:bg-orange-950/30 text-orange-600 font-bold uppercase'}`}>
                                            {item.stock_quantity <= 0 ? 'Zerado' : 'Baixo'}
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

                    {/* Resumo do Turno - KPIs */}
                    <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 p-6 rounded-xl space-y-4 shadow-sm shadow-primary/5">
                        <h4 className="text-xs font-bold text-primary dark:text-primary uppercase tracking-widest">KPIs do Dia</h4>
                        <div className="grid grid-cols-4 gap-2">
                            <div className="bg-white dark:bg-card-dark p-3 rounded-lg border border-slate-200 dark:border-border-dark shadow-sm text-center">
                                <p className="text-[10px] text-slate-500 font-bold uppercase">Total</p>
                                <p className="text-xl font-black text-slate-900 dark:text-white">{stats.total}</p>
                            </div>
                            <div className="bg-white dark:bg-card-dark p-3 rounded-lg border border-slate-200 dark:border-border-dark shadow-sm text-center">
                                <p className="text-[10px] text-blue-500 font-bold uppercase">Confirm.</p>
                                <p className="text-xl font-black text-blue-600 dark:text-blue-400">{stats.confirmed}</p>
                            </div>
                            <div className="bg-white dark:bg-card-dark p-3 rounded-lg border border-slate-200 dark:border-border-dark shadow-sm text-center">
                                <p className="text-[10px] text-amber-500 font-bold uppercase">Pendente</p>
                                <p className="text-xl font-black text-amber-600 dark:text-amber-400">{stats.pending}</p>
                            </div>
                            <div className="bg-white dark:bg-card-dark p-3 rounded-lg border border-slate-200 dark:border-border-dark shadow-sm text-center">
                                <p className="text-[10px] text-violet-500 font-bold uppercase">Em Atend.</p>
                                <p className="text-xl font-black text-violet-600 dark:text-violet-400">{stats.inProgress}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <div className="bg-white dark:bg-card-dark p-3 rounded-lg border border-slate-200 dark:border-border-dark shadow-sm text-center">
                                <p className="text-[10px] text-emerald-500 font-bold uppercase">Finaliz.</p>
                                <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">{stats.attended}</p>
                            </div>
                            <div className="bg-white dark:bg-card-dark p-3 rounded-lg border border-slate-200 dark:border-border-dark shadow-sm text-center">
                                <p className="text-[10px] text-red-500 font-bold uppercase">Cancel.</p>
                                <p className="text-xl font-black text-red-600 dark:text-red-400">{stats.cancelled}</p>
                            </div>
                            <div className="bg-white dark:bg-card-dark p-3 rounded-lg border border-slate-200 dark:border-border-dark shadow-sm text-center">
                                <p className="text-[10px] text-emerald-600 font-bold uppercase">Receita</p>
                                <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">R$ {stats.revenue.toFixed(0)}</p>
                            </div>
                        </div>
                    </div>
                </aside>
            </div>

            {/* Modal de Detalhes do Agendamento */}
            <Modal
                isOpen={showDetailsModal}
                onClose={() => { setShowDetailsModal(false); setSelectedAppointment(null); }}
                title="Detalhes do Agendamento"
                maxWidth="md"
            >
                {selectedAppointment && (
                    <div className="space-y-4">
                        <div className="bg-slate-50 dark:bg-white/5 rounded-lg p-4">
                            <div className="flex items-center gap-4">
                                <div className="size-12 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-slate-400">person</span>
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 dark:text-white">{selectedAppointment.client_name}</h3>
                                    <p className="text-sm text-slate-500">{selectedAppointment.service_name}</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs text-slate-500 uppercase font-bold">Horário</p>
                                <p className="font-bold text-slate-900 dark:text-white">{formatTime(selectedAppointment.start_time)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase font-bold">Profissional</p>
                                <p className="font-bold text-slate-900 dark:text-white">{selectedAppointment.staff_name}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase font-bold">Status</p>
                                <span className={`inline-block px-2 py-1 rounded-full text-xs font-bold ${selectedAppointment.status === 'confirmed' ? 'bg-blue-100 text-blue-700' : selectedAppointment.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}`}>
                                    {getStatusLabel(selectedAppointment.status)}
                                </span>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase font-bold">Valor</p>
                                <p className="font-bold text-slate-900 dark:text-white">R$ {selectedAppointment.price?.toFixed(2) || '0,00'}</p>
                            </div>
                        </div>

                        {sharedExecutionParticipants.length > 0 && (
                            <div className="bg-violet-50 dark:bg-violet-900/20 rounded-lg p-4">
                                <p className="text-xs font-bold text-violet-600 dark:text-violet-400 uppercase mb-2">Execução Compartilhada</p>
                                {sharedExecutionParticipants.map((p, idx) => (
                                    <div key={idx} className="flex justify-between text-sm">
                                        <span className="text-slate-700 dark:text-slate-200">{p.professional_name}</span>
                                        <span className="text-slate-500">{p.role === 'primary' ? 'Principal' : p.role === 'assistant' ? 'Apoio' : 'Coexecutor'}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-white/10">
                            <button
                                onClick={() => {
                                    const cartWithParticipants = [{
                                        id: selectedAppointment.id,
                                        service_id: selectedAppointment.id,
                                        name: selectedAppointment.service_name,
                                        price: selectedAppointment.price || 0,
                                        quantity: 1,
                                        staff_id: selectedAppointment.staff_id,
                                        execution_participants: []
                                    }];

                                    setShowDetailsModal(false);
                                    navigate('/checkout', { 
                                        state: { 
                                            fromAppointment: true, 
                                            appointmentId: selectedAppointment.id,
                                            clientName: selectedAppointment.client_name,
                                            staffId: selectedAppointment.staff_id,
                                            cart: cartWithParticipants
                                        } 
                                    });
                                }}
                                className="flex-1 py-2.5 bg-primary text-white rounded-lg font-bold text-sm"
                            >
                                Iniciar Atendimento
                            </button>
                            <button
                                onClick={() => setShowDetailsModal(false)}
                                className="px-4 py-2.5 border border-slate-200 dark:border-white/10 rounded-lg font-bold text-sm text-slate-600 dark:text-slate-300"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Modal de Execução Compartilhada */}
            <Modal
                isOpen={showSharedExecutionModal}
                onClose={() => { setShowSharedExecutionModal(false); setSharedExecutionParticipants([]); }}
                title="Execução Compartilhada"
                maxWidth="md"
            >
                {selectedAppointment && (
                    <div className="space-y-4">
                        <div className="bg-slate-50 dark:bg-white/5 rounded-lg p-3">
                            <p className="text-sm font-bold text-slate-900 dark:text-white">{selectedAppointment.client_name}</p>
                            <p className="text-xs text-slate-500">{selectedAppointment.service_name} • R$ {selectedAppointment.price?.toFixed(2) || '0,00'}</p>
                        </div>

                        <div className="space-y-2">
                            <p className="text-xs font-bold text-slate-500 uppercase">Participantes Atuais</p>
                            {sharedExecutionParticipants.length === 0 ? (
                                <p className="text-sm text-slate-400 italic">Nenhum participante adicionado</p>
                            ) : (
                                sharedExecutionParticipants.map((p, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-white/5 rounded-lg">
                                        <div>
                                            <p className="text-sm font-bold text-slate-800 dark:text-white">{p.professional_name}</p>
                                            <p className="text-xs text-slate-500">{p.role === 'primary' ? 'Principal' : p.role === 'assistant' ? 'Apoio' : 'Coexecutor'} • {p.payout_value}{p.payout_type === 'percentage' ? '%' : 'R$'}</p>
                                        </div>
                                        <button 
                                            onClick={() => setSharedExecutionParticipants(prev => prev.filter((_, i) => i !== idx))}
                                            className="p-1 text-slate-400 hover:text-red-500"
                                        >
                                            <span className="material-symbols-outlined text-sm">close</span>
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="border-t border-slate-200 dark:border-white/10 pt-4">
                            <p className="text-xs font-bold text-slate-500 uppercase mb-2">Adicionar Participante</p>
                            <div className="grid grid-cols-2 gap-2">
                                <select
                                    id="newParticipantProfessional"
                                    className="px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1A1A1A] text-sm"
                                >
                                    <option value="">Selecionar...</option>
                                    {staffList.filter(s => s.id !== selectedAppointment.staff_id).map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                                <select
                                    id="newParticipantRole"
                                    className="px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1A1A1A] text-sm"
                                >
                                    <option value="assistant">Apoio</option>
                                    <option value="co_executor">Coexecutor</option>
                                </select>
                                <select
                                    id="newParticipantPayoutType"
                                    className="px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1A1A1A] text-sm"
                                >
                                    <option value="percentage">Porcentagem</option>
                                    <option value="fixed">Valor Fixo</option>
                                </select>
                                <input
                                    id="newParticipantPayoutValue"
                                    type="number"
                                    placeholder="Valor"
                                    className="px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1A1A1A] text-sm"
                                />
                            </div>
                            <button
                                onClick={async () => {
                                    const proId = (document.getElementById('newParticipantProfessional') as HTMLSelectElement)?.value;
                                    const proName = staffList.find(s => s.id === proId)?.name || 'Profissional';
                                    const role = (document.getElementById('newParticipantRole') as HTMLSelectElement)?.value as ExecutionRole;
                                    const payoutType = (document.getElementById('newParticipantPayoutType') as HTMLSelectElement)?.value as PayoutType;
                                    const payoutValue = parseFloat((document.getElementById('newParticipantPayoutValue') as HTMLInputElement)?.value) || 0;

                                    if (!proId || payoutValue <= 0) {
                                        return;
                                    }

                                    const newParticipant: ExecutionParticipant = {
                                        id: Date.now().toString(),
                                        professional_id: proId,
                                        professional_name: proName,
                                        role,
                                        payout_type: payoutType,
                                        payout_value: payoutValue
                                    };

                                    setSharedExecutionParticipants(prev => [...prev, newParticipant]);
                                }}
                                className="w-full mt-2 py-2 bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 rounded-lg text-sm font-bold hover:bg-violet-200 dark:hover:bg-violet-900/50"
                            >
                                + Adicionar Participante
                            </button>
                        </div>

                        <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-white/10">
                            <button
                                onClick={() => {
                                    const cartWithParticipants = [{
                                        id: selectedAppointment!.id,
                                        service_id: selectedAppointment!.id,
                                        name: selectedAppointment!.service_name,
                                        price: selectedAppointment!.price || 0,
                                        quantity: 1,
                                        staff_id: selectedAppointment!.staff_id,
                                        execution_participants: sharedExecutionParticipants
                                    }];

                                    setShowSharedExecutionModal(false);
                                    setShowDetailsModal(false);
                                    
                                    navigate('/checkout', {
                                        state: {
                                            fromAppointment: true,
                                            appointmentId: selectedAppointment!.id,
                                            clientName: selectedAppointment!.client_name,
                                            staffId: selectedAppointment!.staff_id,
                                            cart: cartWithParticipants
                                        }
                                    });
                                }}
                                className="flex-1 py-2.5 bg-violet-500 text-white rounded-lg font-bold text-sm"
                            >
                                Ir para Checkout ({sharedExecutionParticipants.length} participante{sharedExecutionParticipants.length !== 1 ? 's' : ''})
                            </button>
                            <button
                                onClick={() => setShowSharedExecutionModal(false)}
                                className="px-4 py-2.5 border border-slate-200 dark:border-white/10 rounded-lg font-bold text-sm text-slate-600 dark:text-slate-300"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default Operations;
