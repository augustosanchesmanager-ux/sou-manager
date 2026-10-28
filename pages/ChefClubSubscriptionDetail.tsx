import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Toast from '../components/Toast';
import Modal from '../components/ui/Modal';
import {
    loadSubscriptionDetail,
    changePlan,
    updateCreditMap,
    updateBillingDate,
    updateSubscriptionStatus,
    cancelSubscriptionWithReceivables,
    loadSubscriptionRecurringSlots,
    addSubscriptionRecurringSlot,
    toggleSubscriptionRecurringSlot,
    removeSubscriptionRecurringSlot,
    triggerRecurringScheduleGeneration,
    type SubscriptionDetailData,
    type SubscriptionDetailClient,
} from '../application/chefClub';
import {
    normalizeCreditBalances,
    getTotalAvailableCredits,
    getTotalUsedCredits,
    cancelReasonLabels,
    isCancelReason,
    type ServiceBalanceEntry,
    type CancelReason,
    type SubscriptionRecurringSlot,
} from '../domain/chefClub';
import { staffRepository } from '../domain/staff';
import { serviceRepository } from '../domain/service/repository';
import { formatCurrency } from '../shared/format/currency';

const DAYS_OF_WEEK = [
    'Domingo',
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado',
];

const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    });
};

type EditTab = 'plan' | 'credits' | 'billing';

const ChefClubSubscriptionDetail: React.FC = () => {
    const { subscriptionId } = useParams<{ subscriptionId: string }>();
    const navigate = useNavigate();
    const { tenantId } = useAuth();

    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
    const [detail, setDetail] = useState<SubscriptionDetailData | null>(null);

    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editTab, setEditTab] = useState<EditTab>('plan');
    const [selectedPlanId, setSelectedPlanId] = useState('');
    const [editCredits, setEditCredits] = useState<ServiceBalanceEntry[]>([]);
    const [nextBillingDate, setNextBillingDate] = useState('');
    const [saving, setSaving] = useState(false);

    const [statusModalOpen, setStatusModalOpen] = useState(false);
    const [pendingStatus, setPendingStatus] = useState<'paused' | 'canceled' | 'active' | null>(null);
    const [cancelReason, setCancelReason] = useState<CancelReason | ''>('');
    const [cancelObservation, setCancelObservation] = useState('');
    const [cancelReceivables, setCancelReceivables] = useState(false);

    // Horários Fixos Recorrentes (ADR-038)
    const [recurringSlots, setRecurringSlots] = useState<SubscriptionRecurringSlot[]>([]);
    const [staffList, setStaffList] = useState<Array<{ id: string; name: string }>>([]);
    const [serviceList, setServiceList] = useState<Array<{ id: string; name: string }>>([]);
    const [slotModalOpen, setSlotModalOpen] = useState(false);
    const [newSlotDay, setNewSlotDay] = useState(4); // Default: Quinta-feira
    const [newSlotTime, setNewSlotTime] = useState('18:00');
    const [newSlotStaffId, setNewSlotStaffId] = useState('');
    const [newSlotServiceId, setNewSlotServiceId] = useState('');
    const [newSlotDuration, setNewSlotDuration] = useState(30);
    const [savingSlot, setSavingSlot] = useState(false);
    const [generatingSlots, setGeneratingSlots] = useState(false);

    const loadData = useCallback(async () => {
        if (!tenantId || !subscriptionId) return;

        setLoading(true);
        try {
            const [result, slots, staffMembers, services] = await Promise.all([
                loadSubscriptionDetail(tenantId, subscriptionId),
                loadSubscriptionRecurringSlots(tenantId, subscriptionId),
                staffRepository.list(tenantId),
                serviceRepository.list(tenantId),
            ]);

            if (!result) {
                setToast({ message: 'Assinatura não encontrada', type: 'error' });
                return;
            }
            setDetail(result);
            setRecurringSlots(slots);
            setStaffList(staffMembers.map((s) => ({ id: s.id, name: s.name })));
            setServiceList(services.map((srv) => ({ id: srv.id, name: srv.name })));
            setNextBillingDate(result.subscription.next_billing_date || '');
            setSelectedPlanId(result.plan?.id || '');

            if (result.credits) {
                setEditCredits(normalizeCreditBalances(
                    result.credits.service_balance_map,
                    result.credits.available_credits,
                    result.credits.used_credits,
                ));
            }
        } catch (err: any) {
            setToast({ message: `Erro ao carregar detalhes: ${err.message}`, type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [tenantId, subscriptionId]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const handleCreateSlot = async () => {
        if (!tenantId || !subscriptionId || !detail?.subscription.client_id) return;
        if (!newSlotStaffId) {
            setToast({ message: 'Selecione o profissional de preferência', type: 'error' });
            return;
        }
        if (!newSlotServiceId) {
            setToast({ message: 'Selecione o serviço', type: 'error' });
            return;
        }
        if (!newSlotTime) {
            setToast({ message: 'Informe o horário do agendamento', type: 'error' });
            return;
        }

        setSavingSlot(true);
        try {
            await addSubscriptionRecurringSlot({
                tenant_id: tenantId,
                subscription_id: subscriptionId,
                client_id: detail.subscription.client_id,
                professional_id: newSlotStaffId,
                service_id: newSlotServiceId,
                day_of_week: Number(newSlotDay),
                start_time: newSlotTime,
                duration_minutes: Number(newSlotDuration),
            });
            setToast({ message: 'Horário fixo adicionado com sucesso!', type: 'success' });
            setSlotModalOpen(false);
            const nextSlots = await loadSubscriptionRecurringSlots(tenantId, subscriptionId);
            setRecurringSlots(nextSlots);
        } catch (err: any) {
            setToast({ message: `Erro ao adicionar horário fixo: ${err.message}`, type: 'error' });
        } finally {
            setSavingSlot(false);
        }
    };

    const handleToggleSlot = async (slotId: string, currentActive: boolean) => {
        if (!tenantId || !subscriptionId) return;
        try {
            await toggleSubscriptionRecurringSlot(tenantId, slotId, !currentActive);
            setToast({ message: !currentActive ? 'Horário fixo ativado' : 'Horário fixo pausado', type: 'info' });
            const nextSlots = await loadSubscriptionRecurringSlots(tenantId, subscriptionId);
            setRecurringSlots(nextSlots);
        } catch (err: any) {
            setToast({ message: `Erro ao alterar status: ${err.message}`, type: 'error' });
        }
    };

    const handleDeleteSlot = async (slotId: string) => {
        if (!tenantId || !subscriptionId) return;
        try {
            await removeSubscriptionRecurringSlot(tenantId, slotId);
            setToast({ message: 'Horário fixo removido com sucesso', type: 'success' });
            const nextSlots = await loadSubscriptionRecurringSlots(tenantId, subscriptionId);
            setRecurringSlots(nextSlots);
        } catch (err: any) {
            setToast({ message: `Erro ao remover horário: ${err.message}`, type: 'error' });
        }
    };

    const handleGenerateCycleSlots = async () => {
        if (!tenantId) return;
        setGeneratingSlots(true);
        try {
            const result = await triggerRecurringScheduleGeneration(tenantId, 30);
            if (result.success) {
                let msg = `${result.generated_count} agendamento(s) gerado(s) na janela de 30 dias!`;
                if (result.skipped_conflict_count > 0) {
                    msg += ` (${result.skipped_conflict_count} conflito(s) de barbeiro pulados)`;
                }
                if (result.skipped_quota_count > 0) {
                    msg += ` (${result.skipped_quota_count} cotas esgotadas)`;
                }
                setToast({ message: msg, type: 'success' });
            } else {
                setToast({ message: 'Geração concluída sem novos agendamentos gerados', type: 'info' });
            }
        } catch (err: any) {
            setToast({ message: `Erro ao gerar agendamentos: ${err.message}`, type: 'error' });
        } finally {
            setGeneratingSlots(false);
        }
    };

    const handleSaveChanges = async () => {
        if (!tenantId || !subscriptionId || !detail) return;

        setSaving(true);
        try {
            if (editTab === 'plan' && selectedPlanId !== detail.subscription.plan_id) {
                await changePlan(tenantId, subscriptionId, selectedPlanId);
                setToast({ message: 'Plano atualizado com sucesso!', type: 'success' });
            }

            if (editTab === 'credits') {
                await updateCreditMap(tenantId, subscriptionId, editCredits);
                setToast({ message: 'Créditos ajustados com sucesso!', type: 'success' });
            }

            if (editTab === 'billing' && nextBillingDate) {
                await updateBillingDate(tenantId, subscriptionId, nextBillingDate);
                setToast({ message: 'Data de cobrança atualizada!', type: 'success' });
            }

            setEditModalOpen(false);
            void loadData();
        } catch (err: any) {
            setToast({ message: `Erro ao salvar: ${err.message}`, type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleStatusChange = async () => {
        if (!tenantId || !subscriptionId || !pendingStatus) return;

        setSaving(true);
        try {
            if (pendingStatus === 'canceled') {
                if (cancelReceivables && !cancelReason) {
                    setToast({ message: 'Motivo do cancelamento é obrigatório', type: 'error' });
                    setSaving(false);
                    return;
                }

                const result = await cancelSubscriptionWithReceivables({
                    subscriptionId,
                    tenantId,
                    cancelReceivables,
                    cancelReason: cancelReason || undefined,
                    cancelObservation: cancelObservation || null,
                });

                const messages = [];
                messages.push('Assinatura cancelada');
                if (result.receivablesCancelled > 0) {
                    messages.push(`${result.receivablesCancelled} recebível(is) cancelado(s)`);
                }
                setToast({ message: messages.join(' + '), type: 'success' });
            } else {
                await updateSubscriptionStatus(tenantId, subscriptionId, pendingStatus);
                const statusLabels = { active: 'reativada', paused: 'pausada', canceled: 'cancelada' };
                setToast({ message: `Assinatura ${statusLabels[pendingStatus]} com sucesso!`, type: 'success' });
            }

            setStatusModalOpen(false);
            setCancelReason('');
            setCancelObservation('');
            setCancelReceivables(false);
            void loadData();
        } catch (err: any) {
            setToast({ message: `Erro ao atualizar: ${err.message}`, type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const openEditModal = (tab: EditTab) => {
        setEditTab(tab);
        setEditModalOpen(true);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!detail) {
        return (
            <div className="p-6">
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-center">
                    <p className="font-bold">Assinatura não encontrada</p>
                    <button onClick={() => navigate('/chef-club-subscriptions')} className="mt-2 text-sm underline">
                        Voltar para Assinaturas
                    </button>
                </div>
            </div>
        );
    }

    const { subscription, plan, credits, client, availablePlans } = detail;

    const planServices = plan ? plan.service_credits : [];
    const serviceBalances = normalizeCreditBalances(
        credits?.service_balance_map,
        credits?.available_credits || 0,
        credits?.used_credits || 0,
    );
    const totalAvailable = serviceBalances.length > 0 ? getTotalAvailableCredits(serviceBalances) : credits?.available_credits || 0;
    const totalUsed = serviceBalances.length > 0 ? getTotalUsedCredits(serviceBalances) : credits?.used_credits || 0;

    return (
        <div className="max-w-5xl mx-auto space-y-6 animate-fade-in p-4 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/chef-club-subscriptions')} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors">
                        <span className="material-symbols-outlined text-slate-500">arrow_back</span>
                    </button>
                    <div className="size-14 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/20">
                        <span className="material-symbols-outlined text-amber-500 text-3xl">workspace_premium</span>
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{client?.name || 'Assinante'}</h2>
                        <p className="text-slate-500 text-sm font-medium">Detalhes da Assinatura</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => { setPendingStatus(subscription.status === 'active' ? 'paused' : 'active'); setStatusModalOpen(true); }}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                            subscription.status === 'active'
                                ? 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20'
                                : 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20'
                        }`}
                    >
                        <span className="material-symbols-outlined text-sm mr-1">{subscription.status === 'active' ? 'pause' : 'play_arrow'}</span>
                        {subscription.status === 'active' ? 'Pausar' : 'Reativar'}
                    </button>
                    {subscription.status !== 'canceled' && (
                        <button
                            onClick={() => { setPendingStatus('canceled'); setStatusModalOpen(true); }}
                            className="px-4 py-2 rounded-xl bg-red-500/10 text-red-600 hover:bg-red-500/20 text-sm font-bold transition-all"
                        >
                            <span className="material-symbols-outlined text-sm mr-1">cancel</span>
                            Cancelar
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-border-dark p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Status</p>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                            subscription.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' :
                            subscription.status === 'past_due' ? 'bg-amber-500/10 text-amber-500' :
                            subscription.status === 'paused' ? 'bg-slate-500/10 text-slate-500' :
                            'bg-red-500/10 text-red-500'
                        }`}>
                            {subscription.status === 'active' ? 'Ativo' :
                             subscription.status === 'past_due' ? 'Atrasado' :
                             subscription.status === 'paused' ? 'Pausado' : 'Cancelado'}
                        </span>
                    </div>
                    <h3 className="text-xl font-black text-primary">{plan?.name || 'Plano não encontrado'}</h3>
                    <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                        {formatCurrency(plan?.monthly_price || 0)}<span className="text-xs text-slate-500 font-bold">/mês</span>
                    </p>
                </div>

                <div className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-border-dark p-6 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">Créditos Atuais</p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black text-amber-500">{totalAvailable}</span>
                        <span className="text-sm text-slate-500 font-bold">disponíveis</span>
                    </div>
                    <p className="text-sm text-slate-500 mt-2">{totalUsed} créditos consumidos neste ciclo</p>
                    <button onClick={() => openEditModal('credits')} className="mt-3 text-xs text-primary font-bold uppercase tracking-widest hover:underline">
                        Ajustar Créditos
                    </button>
                </div>

                <div className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-border-dark p-6 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">Próxima Cobrança</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white">{formatDate(subscription.next_billing_date)}</p>
                    <button onClick={() => openEditModal('billing')} className="mt-3 text-xs text-primary font-bold uppercase tracking-widest hover:underline">
                        Ajustar Data
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                    <div>
                        <h3 className="font-black text-slate-900 dark:text-white">Créditos e Cotas por Serviço</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Acompanhamento do saldo disponível versus a cota contratada no ciclo atual.</p>
                    </div>
                    <button onClick={() => openEditModal('plan')} className="text-xs text-[#007BFF] dark:text-[#72E7FF] font-black uppercase tracking-widest hover:underline">
                        Trocar Plano
                    </button>
                </div>
                <div className="p-6">
                    {planServices.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {planServices.map((entry) => {
                                const balance = serviceBalances.find((b: ServiceBalanceEntry) => b.service_id === entry.service_id);
                                const available = balance?.available ?? 0;
                                const quota = entry.credits;
                                const used = Math.max(0, quota - available);
                                const percent = quota > 0 ? Math.min(100, Math.round((available / quota) * 100)) : 100;
                                const isExhausted = available === 0;

                                return (
                                    <div key={entry.service_id || entry.service_name} className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 flex flex-col justify-between gap-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="font-bold text-slate-900 dark:text-white">{entry.service_name}</p>
                                                <p className="text-xs text-slate-500 mt-0.5">Cota contratada: {quota} sessões/ciclo</p>
                                            </div>
                                            <div className="text-right">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black ${
                                                    isExhausted
                                                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                                        : available < quota
                                                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                                            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                                }`}>
                                                    {available}/{quota} restantes no mês
                                                </span>
                                            </div>
                                        </div>

                                        <div>
                                            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                                                <span>{used} consumidos</span>
                                                <span className="font-bold text-slate-700 dark:text-slate-300">{percent}% disponível</span>
                                            </div>
                                            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                                                <div
                                                    className={`h-full rounded-full transition-all ${
                                                        isExhausted
                                                            ? 'bg-rose-500'
                                                            : percent <= 50
                                                                ? 'bg-amber-500'
                                                                : 'bg-emerald-500'
                                                    }`}
                                                    style={{ width: `${percent}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-slate-500 text-sm text-center py-8">Nenhum crédito configurado neste plano.</p>
                    )}
                </div>
            </div>

            {/* Cadeira Cativa / Horários Fixos Recorrentes (ADR-038) */}
            <div className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-amber-500">event_repeat</span>
                            <h3 className="font-black text-slate-900 dark:text-white">Cadeira Cativa / Horários Fixos Recorrentes</h3>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Reserva automática de inventário por janela rolante para assinantes ativos do Chef Club (ADR-038).
                        </p>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={handleGenerateCycleSlots}
                            disabled={generatingSlots || subscription.status !== 'active'}
                            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 transition-all disabled:opacity-50"
                            title="Materializa agendamentos para os próximos 30 dias na agenda"
                        >
                            <span className={`material-symbols-outlined text-sm ${generatingSlots ? 'animate-spin' : ''}`}>sync</span>
                            {generatingSlots ? 'Gerando...' : 'Gerar Ciclo'}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setNewSlotDay(4);
                                setNewSlotTime('18:00');
                                setNewSlotStaffId(staffList[0]?.id || '');
                                setNewSlotServiceId(serviceList[0]?.id || '');
                                setNewSlotDuration(30);
                                setSlotModalOpen(true);
                            }}
                            disabled={subscription.status !== 'active'}
                            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-primary hover:bg-primary/90 text-white shadow-sm transition-all disabled:opacity-50"
                        >
                            <span className="material-symbols-outlined text-sm">add</span>
                            Adicionar Horário
                        </button>
                    </div>
                </div>

                <div className="p-6">
                    {recurringSlots.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {recurringSlots.map((slot) => {
                                const staff = staffList.find((s) => s.id === slot.professional_id);
                                const service = serviceList.find((srv) => srv.id === slot.service_id);
                                const dayName = DAYS_OF_WEEK[slot.day_of_week] || 'Dia Indefinido';

                                return (
                                    <div
                                        key={slot.id}
                                        className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                                            slot.is_active
                                                ? 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10'
                                                : 'bg-slate-100/50 dark:bg-white/[0.02] border-slate-200/50 dark:border-white/5 opacity-60'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                                        {dayName}
                                                    </span>
                                                    <span className="text-sm font-black text-slate-900 dark:text-white">
                                                        {slot.start_time.slice(0, 5)} ({slot.duration_minutes} min)
                                                    </span>
                                                </div>
                                                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 mt-1">
                                                    <span className="material-symbols-outlined text-xs text-primary">person</span>
                                                    {staff?.name || 'Profissional não identificado'}
                                                </p>
                                                <p className="text-xs text-slate-500 flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-xs">content_cut</span>
                                                    {service?.name || 'Serviço não identificado'}
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleSlot(slot.id, slot.is_active)}
                                                    className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                                                        slot.is_active
                                                            ? 'text-emerald-600 hover:bg-emerald-500/10'
                                                            : 'text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'
                                                    }`}
                                                    title={slot.is_active ? 'Pausar horário fixo' : 'Ativar horário fixo'}
                                                >
                                                    <span className="material-symbols-outlined text-lg">
                                                        {slot.is_active ? 'toggle_on' : 'toggle_off'}
                                                    </span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteSlot(slot.id)}
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-all"
                                                    title="Excluir horário fixo"
                                                >
                                                    <span className="material-symbols-outlined text-lg">delete</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <span className="material-symbols-outlined text-3xl text-slate-400 mb-2">event_busy</span>
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Nenhum horário fixo configurado</p>
                            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                                Clique em "Adicionar Horário" para garantir a cadeira cativa semanal deste assinante com o profissional de preferência.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-border-dark overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-white/5">
                    <h3 className="font-bold text-slate-900 dark:text-white">Informações da Assinatura</h3>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Cliente</p>
                        <p className="font-bold text-slate-900 dark:text-white">{client?.name || 'N/A'}</p>
                        <p className="text-sm text-slate-500">{client?.phone || 'Sem telefone'}</p>
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Início da Assinatura</p>
                        <p className="font-bold text-slate-900 dark:text-white">{formatDate(subscription.started_at)}</p>
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Ciclo Atual</p>
                        <p className="font-bold text-slate-900 dark:text-white">{formatDate(subscription.cycle_start)} — {formatDate(subscription.cycle_end)}</p>
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Criado em</p>
                        <p className="font-bold text-slate-900 dark:text-white">{formatDate(subscription.created_at)}</p>
                    </div>
                </div>
            </div>

            <Modal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} title="Ajustar Assinatura" maxWidth="md">
                <div className="space-y-4">
                    <div className="flex gap-2 border-b border-slate-200 dark:border-white/10 pb-2">
                        {(['plan', 'credits', 'billing'] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setEditTab(tab)}
                                className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                                    editTab === tab ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5'
                                }`}
                            >
                                {tab === 'plan' ? 'Plano' : tab === 'credits' ? 'Créditos' : 'Cobrança'}
                            </button>
                        ))}
                    </div>

                    {editTab === 'plan' && (
                        <div className="space-y-3">
                            <p className="text-sm text-slate-500">Selecione um novo plano para este assinante.</p>
                            {availablePlans.map((p) => (
                                <button
                                    key={p.id}
                                    onClick={() => setSelectedPlanId(p.id)}
                                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                                        selectedPlanId === p.id
                                            ? 'border-primary bg-primary/5'
                                            : 'border-slate-200 dark:border-white/10 hover:border-primary/40'
                                    }`}
                                >
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="font-bold text-slate-900 dark:text-white">{p.name}</p>
                                            <p className="text-xs text-slate-500 mt-1">{p.description || 'Sem descrição'}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-black text-primary">{formatCurrency(p.monthly_price)}/mês</p>
                                            {selectedPlanId === p.id && <span className="material-symbols-outlined text-primary">check_circle</span>}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {editTab === 'credits' && (
                        <div className="space-y-3">
                            <p className="text-sm text-slate-500">Ajuste manualmente os créditos disponíveis por serviço.</p>
                            {editCredits.length > 0 ? editCredits.map((balance, index) => (
                                <div key={`${balance.service_id}-${index}`} className="grid grid-cols-[1fr_100px] gap-3 items-end">
                                    <div>
                                        <label className="text-[10px] uppercase font-black text-slate-500 mb-1 block">Serviço</label>
                                        <div className="rounded-lg border border-slate-200 dark:border-border-dark px-3 py-2 text-sm font-bold text-slate-900 dark:text-white bg-slate-50 dark:bg-background-dark">
                                            {balance.service_name}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase font-black text-slate-500 mb-1 block">Disponíveis</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={balance.available}
                                            onChange={(e) => {
                                                const next = [...editCredits];
                                                next[index] = { ...next[index], available: Math.max(0, Number(e.target.value) || 0) };
                                                setEditCredits(next);
                                            }}
                                            className="w-full bg-white dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg px-3 py-2 text-sm font-bold text-amber-600 outline-none focus:ring-1 focus:ring-primary"
                                        />
                                    </div>
                                </div>
                            )) : (
                                <p className="text-center text-slate-500 py-4">Nenhum crédito para ajustar.</p>
                            )}
                        </div>
                    )}

                    {editTab === 'billing' && (
                        <div className="space-y-3">
                            <p className="text-sm text-slate-500">Ajuste a próxima data de cobrança.</p>
                            <div>
                                <label className="text-[10px] uppercase font-black text-slate-500 mb-1 block">Próxima Cobrança</label>
                                <input
                                    type="date"
                                    value={nextBillingDate}
                                    onChange={(e) => setNextBillingDate(e.target.value)}
                                    className="w-full bg-white dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl px-3 py-2 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                                />
                            </div>
                        </div>
                    )}

                    <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-white/10">
                        <button onClick={() => setEditModalOpen(false)} className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 font-bold text-sm">
                            Cancelar
                        </button>
                        <button onClick={handleSaveChanges} disabled={saving} className="flex-1 py-3 rounded-xl bg-primary text-white font-black uppercase tracking-widest text-sm disabled:opacity-50">
                            {saving ? 'Salvando...' : 'Salvar'}
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={statusModalOpen} onClose={() => setStatusModalOpen(false)} title={pendingStatus === 'canceled' ? 'Cancelar Assinatura' : 'Confirmar Ação'} maxWidth="sm">
                <div className="space-y-4">
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                        {pendingStatus === 'active' && 'Tem certeza que deseja reativar esta assinatura?'}
                        {pendingStatus === 'paused' && 'Tem certeza que deseja pausar esta assinatura? O cliente perderá o acesso aos benefícios.'}
                        {pendingStatus === 'canceled' && 'Tem certeza que deseja cancelar esta assinatura? Esta ação não pode ser desfeita.'}
                    </p>

                    {pendingStatus === 'canceled' && (
                        <div className="space-y-3 p-3 bg-red-50 dark:bg-red-500/10 rounded-xl border border-red-200 dark:border-red-500/20">
                            <div>
                                <label className="text-[10px] uppercase font-black text-slate-500 mb-1 block">Motivo do Cancelamento *</label>
                                <select
                                    value={cancelReason}
                                    onChange={(e) => setCancelReason(e.target.value as CancelReason | '')}
                                    className="w-full bg-white dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl px-3 py-2 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                                >
                                    <option value="">Selecione o motivo</option>
                                    {Object.entries(cancelReasonLabels).map(([key, label]) => (
                                        <option key={key} value={key}>{label}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-[10px] uppercase font-black text-slate-500 mb-1 block">Observação (opcional)</label>
                                <textarea
                                    value={cancelObservation}
                                    onChange={(e) => setCancelObservation(e.target.value)}
                                    rows={2}
                                    className="w-full bg-white dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl px-3 py-2 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary resize-none"
                                    placeholder="Detalhes adicionais..."
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="cancelReceivables"
                                    checked={cancelReceivables}
                                    onChange={(e) => setCancelReceivables(e.target.checked)}
                                    className="rounded border-slate-300 text-red-500 focus:ring-red-500"
                                />
                                <label htmlFor="cancelReceivables" className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                    Cancelar cobranças pendentes/atrasadas
                                </label>
                            </div>
                            <p className="text-[10px] text-slate-500 -mt-1 ml-6">
                                Recebíveis já pagos não serão afetados
                            </p>
                        </div>
                    )}

                    <div className="flex gap-3">
                        <button onClick={() => setStatusModalOpen(false)} className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 font-bold text-sm">
                            Voltar
                        </button>
                        <button onClick={handleStatusChange} disabled={saving || (pendingStatus === 'canceled' && cancelReceivables && !cancelReason)} className={`flex-1 py-3 rounded-xl font-black uppercase tracking-widest text-sm text-white disabled:opacity-50 ${
                            pendingStatus === 'canceled' ? 'bg-red-500 hover:bg-red-600' : 'bg-primary hover:bg-blue-600'
                        }`}>
                            {saving ? 'Aguarde...' : 'Confirmar'}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Modal: Adicionar Horário Fixo (ADR-038) */}
            <Modal isOpen={slotModalOpen} onClose={() => setSlotModalOpen(false)} title="Adicionar Horário Fixo (Cadeira Cativa)" maxWidth="md">
                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] uppercase font-black text-slate-500 mb-1 block">Dia da Semana</label>
                        <select
                            value={newSlotDay}
                            onChange={(e) => setNewSlotDay(Number(e.target.value))}
                            className="w-full bg-white dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl px-3 py-2 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                        >
                            {DAYS_OF_WEEK.map((dayName, idx) => (
                                <option key={idx} value={idx}>{dayName}</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] uppercase font-black text-slate-500 mb-1 block">Horário de Início</label>
                            <input
                                type="time"
                                value={newSlotTime}
                                onChange={(e) => setNewSlotTime(e.target.value)}
                                className="w-full bg-white dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl px-3 py-2 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] uppercase font-black text-slate-500 mb-1 block">Duração (minutos)</label>
                            <select
                                value={newSlotDuration}
                                onChange={(e) => setNewSlotDuration(Number(e.target.value))}
                                className="w-full bg-white dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl px-3 py-2 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                            >
                                <option value={15}>15 minutos</option>
                                <option value={30}>30 minutos</option>
                                <option value={45}>45 minutos</option>
                                <option value={60}>60 minutos</option>
                                <option value={90}>90 minutos</option>
                                <option value={120}>120 minutos</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] uppercase font-black text-slate-500 mb-1 block">Profissional de Preferência</label>
                        <select
                            value={newSlotStaffId}
                            onChange={(e) => setNewSlotStaffId(e.target.value)}
                            className="w-full bg-white dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl px-3 py-2 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                        >
                            <option value="">Selecione o profissional...</option>
                            {staffList.map((st) => (
                                <option key={st.id} value={st.id}>{st.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-[10px] uppercase font-black text-slate-500 mb-1 block">Serviço</label>
                        <select
                            value={newSlotServiceId}
                            onChange={(e) => setNewSlotServiceId(e.target.value)}
                            className="w-full bg-white dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl px-3 py-2 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                        >
                            <option value="">Selecione o serviço...</option>
                            {serviceList.map((srv) => (
                                <option key={srv.id} value={srv.id}>{srv.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-white/10">
                        <button
                            type="button"
                            onClick={() => setSlotModalOpen(false)}
                            className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 font-bold text-sm"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleCreateSlot}
                            disabled={savingSlot}
                            className="flex-1 py-3 rounded-xl bg-primary text-white font-black uppercase tracking-widest text-sm disabled:opacity-50"
                        >
                            {savingSlot ? 'Salvando...' : 'Salvar Horário Fixo'}
                        </button>
                    </div>
                </div>
            </Modal>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

export default ChefClubSubscriptionDetail;
