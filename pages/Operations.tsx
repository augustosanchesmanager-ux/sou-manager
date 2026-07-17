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
    is_walk_in?: boolean;
    source?: string;
    channel?: string;
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
    }, [tenantId, selectedDate]);

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
            'completed': 'Concluído',
            'in_progress': 'Em Atendimento'
        };
        return labels[status] || status;
    };

    const selectedDateLabel = new Date(`${selectedDate}T00:00:00`).toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
    });

    const activeFlowCount = stats.confirmed + stats.pending + stats.inProgress;

    const getStatusClasses = (status: string) => {
        if (status === 'confirmed') return 'border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300';
        if (status === 'pending' || status === 'waiting') return 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300';
        if (status === 'in_progress') return 'border-[#00D2FF]/25 bg-[#00D2FF]/10 text-[#006CA3] dark:text-[#80E8FF]';
        if (status === 'completed') return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
        if (status === 'cancelled' || status === 'no_show') return 'border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300';
        return 'border-slate-200 bg-slate-100 text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300';
    };

    return (
        <div className="mx-auto w-full max-w-7xl space-y-5 pb-10 animate-fade-in">
            <section className="relative overflow-hidden rounded-[28px] border border-slate-900/10 bg-[#102235] p-4 text-white shadow-sm dark:border-white/10 sm:p-5">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(0,210,255,0.22),transparent_34%),linear-gradient(135deg,rgba(0,51,102,0.98),rgba(15,23,42,0.98)_58%,rgba(146,104,45,0.62))]" />
                <div className="relative grid gap-4 xl:grid-cols-[1.1fr_0.9fr] xl:items-end">
                    <div className="min-w-0">
                        <div className="flex items-start gap-3">
                            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00D2FF] to-[#007BFF] shadow-[0_0_24px_rgba(0,210,255,0.20)]">
                                <span className="material-symbols-outlined text-2xl">assignment</span>
                            </div>
                            <div className="min-w-0">
                                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-100">Operações Diárias</p>
                                <h1 className="text-2xl font-black leading-tight sm:text-3xl">Pulso da barbearia</h1>
                                <p className="mt-1 max-w-2xl text-sm text-slate-200">
                                    {stats.total} atendimento(s) em {selectedDateLabel}, com {activeFlowCount} ainda no fluxo da loja.
                                </p>
                            </div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                            <button
                                onClick={() => navigate('/schedule')}
                                className="flex items-center gap-2 rounded-xl bg-amber-400 px-3.5 py-2.5 text-sm font-black text-slate-950 shadow-[0_8px_22px_rgba(251,191,36,0.20)] transition-all hover:bg-amber-300"
                            >
                                <span className="material-symbols-outlined text-lg">calendar_add_on</span>
                                Novo atendimento
                            </button>
                            <button
                                onClick={() => navigate('/schedule')}
                                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3.5 py-2.5 text-sm font-bold text-slate-100 transition-all hover:bg-white/15"
                            >
                                <span className="material-symbols-outlined text-lg">event_repeat</span>
                                Reagendar cadeira
                            </button>
                            <button
                                onClick={() => navigate('/comandas')}
                                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3.5 py-2.5 text-sm font-bold text-slate-100 transition-all hover:bg-white/15"
                            >
                                <span className="material-symbols-outlined text-lg">receipt_long</span>
                                Ver comandas
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-4 xl:grid-cols-2">
                        <div className="bg-white/[0.04] p-3">
                            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-300">Agenda</p>
                            <p className="mt-1 text-2xl font-black leading-none">{loading ? '...' : stats.total}</p>
                            <p className="mt-1 text-[10px] text-slate-300">atendimentos no dia</p>
                        </div>
                        <div className="bg-white/[0.04] p-3">
                            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-300">Confirmados</p>
                            <p className="mt-1 text-2xl font-black leading-none">{loading ? '...' : stats.confirmed}</p>
                            <p className="mt-1 text-[10px] text-slate-300">clientes com horário firme</p>
                        </div>
                        <div className="bg-white/[0.04] p-3">
                            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-300">No fluxo</p>
                            <p className="mt-1 text-2xl font-black leading-none">{loading ? '...' : activeFlowCount}</p>
                            <p className="mt-1 text-[10px] text-slate-300">confirmados, pendentes e em atendimento</p>
                        </div>
                        <div className="bg-white/[0.04] p-3">
                            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-300">Finalizados</p>
                            <p className="mt-1 text-2xl font-black leading-none">{loading ? '...' : stats.attended}</p>
                            <p className="mt-1 text-[10px] text-slate-300">atendimentos concluídos</p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-card-dark sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF7FF] text-[#007BFF] dark:bg-[#00D2FF]/10 dark:text-[#80E8FF]">
                        <span className="material-symbols-outlined text-xl">today</span>
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Data operacional</p>
                        <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{selectedDateLabel}</p>
                    </div>
                </div>
                <DatePickerInput
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-900 cursor-pointer dark:border-white/10 dark:bg-[#1A1A1A] dark:text-white sm:w-auto"
                />
            </section>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                {/* Timeline: Next Appointments */}
                <section className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Cadeiras e clientes</p>
                            <h2 className="text-xl font-black text-slate-900 dark:text-white">Fila operacional</h2>
                        </div>
                        <button onClick={() => navigate('/schedule')} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-[#007BFF] shadow-sm transition-all hover:bg-[#F7FBFE] dark:border-white/10 dark:bg-card-dark dark:text-[#80E8FF] dark:hover:bg-white/5">Ver agenda completa</button>
                    </div>
                    <div className="space-y-3 relative before:absolute before:left-5 before:top-2 before:bottom-2 before:w-px before:bg-slate-200 dark:before:bg-white/10">
                        {loading ? (
                            <div className="ml-12 rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm font-semibold text-slate-500 dark:border-white/10 dark:bg-card-dark">Carregando operação do dia...</div>
                        ) : appointments.length === 0 ? (
                            <div className="p-10 text-center bg-white dark:bg-card-dark rounded-2xl border border-dashed border-slate-300 dark:border-white/10 ml-12">
                                <span className="material-symbols-outlined text-3xl text-slate-300">event_available</span>
                                <p className="mt-2 text-sm font-bold text-slate-700 dark:text-slate-200">Sem atendimentos para esta data.</p>
                                <p className="mt-1 text-xs text-slate-500">A agenda fica limpa até um novo horário entrar no dia.</p>
                            </div>
                        ) : (
                            appointments.map((apt) => (
                                <div key={apt.id} className="relative pl-12">
                                    <div className="absolute left-0 top-5 z-10 flex size-10 items-center justify-center rounded-full border-4 border-background-light bg-[#102235] shadow-sm dark:border-background-dark">
                                        <span className="text-xs font-bold text-white">{formatTime(apt.start_time)}</span>
                                    </div>
                                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-[#007BFF]/30 hover:shadow-md dark:border-white/10 dark:bg-card-dark">
                                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                            <div className="flex min-w-0 items-center gap-3">
                                                <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-white/5">
                                                    {apt.avatar ? (
                                                        <img className="h-full w-full object-cover" alt={apt.client_name} src={apt.avatar} />
                                                    ) : (
                                                        <span className="material-symbols-outlined text-slate-400">person</span>
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <h3 className="truncate text-base font-black text-slate-900 dark:text-white">{apt.client_name || 'Cliente não informado'}</h3>
                                                        {apt.is_walk_in && (
                                                            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-black uppercase text-amber-700 dark:text-amber-300">Encaixe</span>
                                                        )}
                                                    </div>
                                                    <p className="truncate text-sm font-semibold text-slate-500 dark:text-slate-400">{apt.service_name || 'Serviço não informado'}</p>
                                                    <p className="mt-1 text-xs text-slate-400">Cadeira: {apt.staff_name || 'Profissional não informado'}</p>
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                                                <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase ${getStatusClasses(apt.status)}`}>
                                                    {getStatusLabel(apt.status)}
                                                </span>
                                                {apt.status !== 'completed' && apt.status !== 'cancelled' && (
                                                    <>
                                                        <button 
                                                            onClick={() => {
                                                                setSelectedAppointment(apt);
                                                                setShowDetailsModal(true);
                                                            }}
                                                            className="rounded-lg bg-amber-400 px-3 py-2 text-xs font-black text-slate-950 transition-all hover:bg-amber-300"
                                                        >
                                                            Atender
                                                        </button>
                                                        <button 
                                                            onClick={() => {
                                                                setSelectedAppointment(apt);
                                                                setSharedExecutionParticipants(apt.execution_participants || []);
                                                                setShowSharedExecutionModal(true);
                                                            }}
                                                            className="flex items-center gap-1 rounded-lg border border-[#00D2FF]/20 bg-[#00D2FF]/10 px-3 py-2 text-xs font-black text-[#006CA3] transition-all hover:bg-[#00D2FF]/15 dark:text-[#80E8FF]"
                                                        >
                                                            <span className="material-symbols-outlined text-sm">group</span>
                                                            Compartilhar
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </section>

                {/* Inventory Alert Section */}
                <aside className="space-y-4">
                    <div className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden shadow-sm">
                        <div className="p-4 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Retaguarda</p>
                                <h3 className="font-black flex items-center gap-2 text-slate-900 dark:text-white">
                                    <span className="material-symbols-outlined text-orange-500">inventory_2</span>
                                    Estoque crítico
                                </h3>
                            </div>
                            <button onClick={() => navigate('/products')} className="text-xs font-black text-[#007BFF] dark:text-[#80E8FF]">Produtos</button>
                        </div>
                        <div className="p-2">
                            {lowStockItems.length === 0 ? (
                                <div className="p-8 text-center text-xs text-slate-500">
                                    <span className="material-symbols-outlined block text-3xl text-emerald-400">check_circle</span>
                                    <p className="mt-2 font-bold text-slate-700 dark:text-slate-200">Estoque em dia.</p>
                                </div>
                            ) : (
                                lowStockItems.map(item => (
                                    <div key={item.id} className="p-3 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl flex items-center justify-between transition-colors">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{item.name}</p>
                                            <p className="text-xs text-slate-500">Qtd atual: {item.stock_quantity.toString().padStart(2, '0')}</p>
                                        </div>
                                        <span className={`text-[10px] font-black px-2 py-1 rounded-full uppercase ${item.stock_quantity <= 0 ? 'bg-red-500/10 text-red-700 dark:text-red-300' : 'bg-orange-500/10 text-orange-700 dark:text-orange-300'}`}>
                                            {item.stock_quantity <= 0 ? 'Zerado' : 'Baixo'}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-white/5 border-t border-slate-100 dark:border-white/10">
                            <button onClick={() => navigate('/products')} className="w-full py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-xl text-xs font-black transition-all text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-white/10">
                                Solicitar Pedido
                            </button>
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
                            <p className="text-xs text-slate-500">{selectedAppointment.service_name}</p>
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
                                            <p className="text-xs text-slate-500">{p.role === 'primary' ? 'Principal' : p.role === 'assistant' ? 'Apoio' : 'Coexecutor'}</p>
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
