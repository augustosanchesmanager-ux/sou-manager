import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Client, PreferredFrequency } from '../../domain/client/types';
import { clientRepository } from '../../domain/client';
import CustomerVouchersSection from './CustomerVouchersSection';
import { formatCurrency } from '../../shared/format/currency';
import {
  fetchClientCrmFrictionAlert,
  type ClientCrmFrictionAlert,
} from '../../src/lib/reviews/qualityService';
import {
  calculateNextPreferredDate,
  formatPreferredScheduleSummary,
  WEEKDAY_LABELS,
  FREQUENCY_LABELS,
  type PreferredBarberSummary,
} from '../../src/utils/clientProfile';

export interface UpcomingAppointmentSummary {
  id: string;
  start_time: string;
  duration?: number;
  service_name?: string;
  staff_name?: string;
  staff_id?: string;
  status: string;
}

export interface StaffOption {
  id: string;
  name: string;
  avatar?: string | null;
}

export interface OpenComandaSummary {
  id: string;
  total: number;
  status: 'open';
  created_at: string;
}

interface ClientProfile360DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
  onClientUpdated?: (updated: Client) => void;
  chefClub: { planName: string; credits: number; status: string } | null;
  openComandas: OpenComandaSummary[];
  openComandasCount: number;
  openComandasLoading: boolean;
  upcomingAppointments: UpcomingAppointmentSummary[];
  upcomingLoading: boolean;
  preferredBarber: PreferredBarberSummary | null;
  visitsCount: number;
  averageTicket: number;
  staffOptions: StaffOption[];
  tenantId: string | null;
  currentUserId?: string | null;
  orderLabel: string;
  orderLabelLower: string;
  orderPluralLower: string;
  serviceLabel: string;
  isEsteticaApp: boolean;
  onToast: (toast: { message: string; type: 'success' | 'error' | 'info' | 'warning' }) => void;
  onOpenComanda: (comandaId: string) => void;
  onBookAppointment: (params?: { date?: string; time?: string; staffId?: string }) => void;
}

const getDisplayId = (id: string) => {
  const hexStr = id.replace(/-/g, '').slice(0, 8);
  const num = parseInt(hexStr, 16);
  return Number.isNaN(num) ? 1000 : (num % 89999) + 1000;
};

const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return '-';
  const [y, m, d] = dateStr.split('-');
  if (!y || !m || !d) return dateStr;
  return `${d}/${m}/${y}`;
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export const ClientProfile360Drawer: React.FC<ClientProfile360DrawerProps> = ({
  isOpen,
  onClose,
  client,
  onClientUpdated,
  chefClub,
  openComandas,
  openComandasCount,
  openComandasLoading,
  upcomingAppointments,
  upcomingLoading,
  preferredBarber,
  visitsCount,
  averageTicket,
  staffOptions,
  tenantId,
  currentUserId,
  orderLabel,
  orderLabelLower,
  orderPluralLower,
  serviceLabel,
  isEsteticaApp,
  onToast,
  onOpenComanda,
  onBookAppointment,
}) => {
  // Notes state
  const [notes, setNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [notesSavedFeedback, setNotesSavedFeedback] = useState(false);

  // Preferred schedule (cadeira cativa) state
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);
  const [preferredFrequency, setPreferredFrequency] = useState<PreferredFrequency | ''>('');
  const [preferredWeekday, setPreferredWeekday] = useState<number | ''>('');
  const [preferredTime, setPreferredTime] = useState<string>('');
  const [preferredStaffId, setPreferredStaffId] = useState<string>('');
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);

  // Active sub-tab in drawer
  const [activeTab, setActiveTab] = useState<'overview' | 'vouchers'>('overview');
  const [crmAlert, setCrmAlert] = useState<ClientCrmFrictionAlert | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!isOpen || !client || !tenantId) {
      setCrmAlert(null);
      return;
    }
    void fetchClientCrmFrictionAlert(tenantId, client.id, Number(client.total_spent || 0)).then(
      (res) => {
        if (!cancelled) setCrmAlert(res);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [isOpen, client, tenantId]);

  // Synchronize internal state when client changes
  useEffect(() => {
    if (client) {
      setNotes(client.notes || '');
      setPreferredFrequency(client.preferred_frequency || '');
      setPreferredWeekday(client.preferred_weekday ?? '');
      setPreferredTime(client.preferred_time || '');
      setPreferredStaffId(client.preferred_staff_id || '');
      setIsEditingSchedule(false);
      setNotesSavedFeedback(false);
    }
  }, [client]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Find preferred staff object if assigned
  const assignedStaff = useMemo(() => {
    if (!client?.preferred_staff_id) return null;
    return staffOptions.find((s) => s.id === client.preferred_staff_id) || null;
  }, [client?.preferred_staff_id, staffOptions]);

  // Format schedule summary
  const scheduleSummary = useMemo(() => {
    if (!client) return 'Sem horário fixo definido';
    return formatPreferredScheduleSummary({
      frequency: client.preferred_frequency,
      weekday: client.preferred_weekday,
      time: client.preferred_time,
      staffName: assignedStaff?.name || preferredBarber?.name,
    });
  }, [client, assignedStaff, preferredBarber]);

  // Calculate next preferred booking date
  const nextBookingDate = useMemo(() => {
    if (!client?.preferred_weekday) return null;
    return calculateNextPreferredDate(client.preferred_weekday);
  }, [client?.preferred_weekday]);

  // WhatsApp link preparation
  const whatsappUrl = useMemo(() => {
    if (!client?.phone) return null;
    const cleanPhone = client.phone.replace(/\D/g, '');
    if (!cleanPhone) return null;
    const fullPhone = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
    const greeting = `Olá, ${client.name}!`;
    return `https://wa.me/${fullPhone}?text=${encodeURIComponent(greeting)}`;
  }, [client?.phone, client?.name]);

  // Save Notes handler
  const handleSaveNotes = useCallback(async () => {
    if (!client || !tenantId) return;
    setIsSavingNotes(true);
    try {
      const updated = await clientRepository.update(client.id, { notes }, tenantId);
      onClientUpdated?.(updated);
      setNotesSavedFeedback(true);
      setTimeout(() => setNotesSavedFeedback(false), 2500);
      onToast({ message: 'Notas salvas com sucesso.', type: 'success' });
    } catch (error) {
      console.error('Erro ao salvar notas:', error);
      onToast({ message: 'Erro ao salvar notas operacionais.', type: 'error' });
    } finally {
      setIsSavingNotes(false);
    }
  }, [client, notes, tenantId, onClientUpdated, onToast]);

  // Save Schedule Preferences handler
  const handleSaveSchedule = useCallback(async () => {
    if (!client || !tenantId) return;
    setIsSavingSchedule(true);
    try {
      const updated = await clientRepository.update(
        client.id,
        {
          preferred_frequency: preferredFrequency ? (preferredFrequency as PreferredFrequency) : undefined,
          preferred_weekday: preferredWeekday !== '' ? Number(preferredWeekday) : undefined,
          preferred_time: preferredTime || undefined,
          preferred_staff_id: preferredStaffId || undefined,
        },
        tenantId
      );
      onClientUpdated?.(updated);
      setIsEditingSchedule(false);
      onToast({ message: 'Preferência de horário fixo atualizada.', type: 'success' });
    } catch (error) {
      console.error('Erro ao salvar horário fixo:', error);
      onToast({ message: 'Erro ao salvar preferências de horário.', type: 'error' });
    } finally {
      setIsSavingSchedule(false);
    }
  }, [
    client,
    preferredFrequency,
    preferredWeekday,
    preferredTime,
    preferredStaffId,
    tenantId,
    onClientUpdated,
    onToast,
  ]);

  if (!isOpen || !client) return null;

  return (
    <div className="fixed inset-0 z-[90] overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <section
          aria-labelledby="drawer-client-name"
          className="w-screen max-w-2xl bg-white dark:bg-[#151921] shadow-2xl flex flex-col border-l border-slate-200 dark:border-white/10"
        >
          {/* Drawer Header */}
          <div className="p-6 border-b border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02]">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="relative size-16 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden border-2 border-primary/30 shadow-md shrink-0">
                  {client.avatar ? (
                    <img src={client.avatar} alt={client.name} className="size-full object-cover" />
                  ) : (
                    <div className="size-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400">
                      <span className="material-symbols-outlined text-3xl">person</span>
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 id="drawer-client-name" className="text-xl font-bold text-slate-900 dark:text-white leading-tight">
                      {client.name}
                    </h2>
                    <span className="text-xs font-mono text-slate-400 dark:text-slate-500">
                      #{getDisplayId(client.id)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        client.status === 'active'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          : 'bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-400'
                      }`}
                    >
                      <span className="size-1.5 rounded-full bg-current" />
                      {client.status === 'active' ? 'Ativo' : 'Inativo'}
                    </span>
                    {client.preferred_frequency && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        <span className="material-symbols-outlined text-xs">chair</span>
                        Cadeira Cativa ({FREQUENCY_LABELS[client.preferred_frequency]})
                      </span>
                    )}
                    {crmAlert?.isVip && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#B88A44] text-neutral-950">
                        VIP · LTV {formatCurrency(crmAlert.lifetimeValue)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                title="Fechar (Esc)"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 mt-5">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onBookAppointment();
                }}
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-primary text-night rounded-lg text-xs font-bold hover:bg-primary/90 transition-all shadow-sm"
              >
                <span className="material-symbols-outlined text-[16px]">calendar_add_on</span>
                Novo Agendamento
              </button>

              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                >
                  <span className="material-symbols-outlined text-[16px]">chat</span>
                  WhatsApp
                </a>
              )}

              {client.phone && (
                <a
                  href={`tel:${client.phone}`}
                  className="inline-flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">call</span>
                  {client.phone}
                </a>
              )}

              {client.email && (
                <a
                  href={`mailto:${client.email}`}
                  className="inline-flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-colors truncate max-w-[200px]"
                  title={client.email}
                >
                  <span className="material-symbols-outlined text-[16px]">mail</span>
                  <span className="truncate">{client.email}</span>
                </a>
              )}
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-4 mt-5 border-t border-slate-200 dark:border-white/10 pt-3">
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className={`pb-1 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${
                  activeTab === 'overview'
                    ? 'border-primary text-slate-900 dark:text-white'
                    : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
              >
                Visão 360° & Preferências
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('vouchers')}
                className={`pb-1 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 flex items-center gap-1.5 ${
                  activeTab === 'vouchers'
                    ? 'border-primary text-slate-900 dark:text-white'
                    : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
              >
                <span className="material-symbols-outlined text-sm">confirmation_number</span>
                Vouchers & Fidelidade
              </button>
            </div>
          </div>

          {/* Drawer Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {activeTab === 'overview' ? (
              <>
                {/* Alerta Tático no Check-in (CRM VIP + Atrito Anterior) */}
                {crmAlert?.hasFriction && (
                  <div
                    className={`rounded-2xl border p-4 space-y-2 shadow-sm ${
                      crmAlert.isVip
                        ? 'border-red-500/40 bg-red-500/10'
                        : 'border-amber-500/40 bg-amber-500/10'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-black uppercase tracking-wider text-amber-400">
                        {crmAlert.isVip
                          ? `⚠️ Alerta Tático VIP (LTV ${formatCurrency(crmAlert.lifetimeValue)}) — Atendimento de Exceção`
                          : `⚠️ Atenção no Atendimento — Atrito Anterior (${crmAlert.lastLowRating}★)`}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-black/30 text-amber-300">
                        {crmAlert.lastReviewStatus === 'resolved' ? 'Tratado pela Gestão' : 'Atenção Redobrada'}
                      </span>
                    </div>
                    {crmAlert.lastComment && (
                      <p className="text-xs text-slate-700 dark:text-slate-200">
                        <strong>Relato anterior:</strong> “{crmAlert.lastComment}”
                      </p>
                    )}
                    {crmAlert.lastResolutionNote && (
                      <p className="text-xs text-emerald-700 dark:text-emerald-300 bg-black/20 p-2.5 rounded-xl border border-emerald-500/20">
                        <strong>Playbook de Resolução:</strong> {crmAlert.lastResolutionNote}
                      </p>
                    )}
                  </div>
                )}

                {/* Alert: Comanda Aberta */}
                {openComandasLoading && (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 animate-pulse">
                    <p className="text-xs font-bold text-amber-700 dark:text-amber-300">
                      Verificando {orderPluralLower} abertos...
                    </p>
                  </div>
                )}
                {!openComandasLoading && openComandasCount > 0 && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 shadow-sm">
                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-xl">
                          receipt_long
                        </span>
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
                            {orderLabel} em Aberto
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-300">
                            {openComandasCount === 1
                              ? `1 ${orderLabelLower} aguardando fechamento`
                              : `${openComandasCount} ${orderPluralLower} aguardando fechamento`}
                          </p>
                        </div>
                      </div>
                      <span className="inline-flex w-fit items-center gap-1 rounded-full border border-amber-500/30 bg-white/70 px-2.5 py-1 text-[10px] font-black uppercase text-amber-700 dark:bg-white/5 dark:text-amber-300">
                        Pendente
                      </span>
                    </div>
                    <div className="space-y-2">
                      {openComandas.map((comanda) => (
                        <div
                          key={comanda.id}
                          className="flex flex-col gap-2 rounded-lg bg-white/90 p-3 dark:bg-white/5 sm:flex-row sm:items-center sm:justify-between border border-amber-500/20"
                        >
                          <div>
                            <p className="text-sm font-black text-slate-900 dark:text-white">
                              {orderLabel} #{getDisplayId(comanda.id)}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {formatCurrency(comanda.total)} • {formatDateTime(comanda.created_at)}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onOpenComanda(comanda.id);
                            }}
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-night transition hover:bg-primary/90 shadow-sm"
                          >
                            <span className="material-symbols-outlined text-[14px]">payments</span>
                            Ver / Fechar Caixa
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 360° Metrics Grid */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">donut_large</span>
                    Indicadores de Fidelidade (360°)
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {/* Total Gasto / LTV */}
                    <div className="bg-slate-50 dark:bg-white/5 p-3.5 rounded-xl border border-slate-200 dark:border-white/5">
                      <div className="flex items-center justify-between text-slate-400 mb-1">
                        <span className="text-[10px] uppercase font-bold tracking-wider">LTV Total</span>
                        <span className="material-symbols-outlined text-base text-emerald-500">payments</span>
                      </div>
                      <p className="text-base font-black text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(client.total_spent || 0)}
                      </p>
                      <p className="text-[9px] text-slate-400 mt-0.5">Total gasto</p>
                    </div>

                    {/* Ticket Médio */}
                    <div className="bg-slate-50 dark:bg-white/5 p-3.5 rounded-xl border border-slate-200 dark:border-white/5">
                      <div className="flex items-center justify-between text-slate-400 mb-1">
                        <span className="text-[10px] uppercase font-bold tracking-wider">Ticket Médio</span>
                        <span className="material-symbols-outlined text-base text-amber-500">query_stats</span>
                      </div>
                      <p className="text-base font-black text-slate-900 dark:text-white">
                        {formatCurrency(averageTicket)}
                      </p>
                      <p className="text-[9px] text-slate-400 mt-0.5">Por atendimento</p>
                    </div>

                    {/* Total de Visitas */}
                    <div className="bg-slate-50 dark:bg-white/5 p-3.5 rounded-xl border border-slate-200 dark:border-white/5">
                      <div className="flex items-center justify-between text-slate-400 mb-1">
                        <span className="text-[10px] uppercase font-bold tracking-wider">Visitas</span>
                        <span className="material-symbols-outlined text-base text-slate-400">storefront</span>
                      </div>
                      <p className="text-base font-black text-slate-900 dark:text-white">
                        {visitsCount}
                      </p>
                      <p className="text-[9px] text-slate-400 mt-0.5 truncate">
                        Últ: {client.last_visit ? formatDate(client.last_visit) : '-'}
                      </p>
                    </div>

                    {/* Barbeiro Preferido */}
                    <div className="bg-slate-50 dark:bg-white/5 p-3.5 rounded-xl border border-slate-200 dark:border-white/5">
                      <div className="flex items-center justify-between text-slate-400 mb-1">
                        <span className="text-[10px] uppercase font-bold tracking-wider">Preferido</span>
                        <span className="material-symbols-outlined text-base text-primary">content_cut</span>
                      </div>
                      <p className="text-sm font-black text-slate-900 dark:text-white truncate">
                        {preferredBarber?.name || assignedStaff?.name || '-'}
                      </p>
                      <p className="text-[9px] text-slate-400 mt-0.5 truncate">
                        {preferredBarber
                          ? `${preferredBarber.serviceCount} atendimentos`
                          : assignedStaff
                          ? 'Definido no perfil'
                          : 'Sem histórico'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Seção Cadeira Cativa / Horário Fixo */}
                <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] p-4.5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="size-9 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
                        <span className="material-symbols-outlined text-xl">event_repeat</span>
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Cadeira Cativa & Horário Fixo
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {scheduleSummary}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsEditingSchedule((prev) => !prev)}
                      className="px-2.5 py-1 text-xs font-bold border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-700 dark:text-slate-200 transition-colors"
                    >
                      {isEditingSchedule ? 'Cancelar' : 'Alterar'}
                    </button>
                  </div>

                  {/* Agendar Próxima Ocorrência (se configurado) */}
                  {!isEditingSchedule && client.preferred_weekday && (
                    <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-200/60 dark:border-white/5">
                      <div className="text-xs text-slate-600 dark:text-slate-300">
                        <span className="font-bold">Próxima data sugerida: </span>
                        <span>{formatDate(nextBookingDate)}</span>
                        {client.preferred_time && <span> às {client.preferred_time}</span>}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onBookAppointment({
                            date: nextBookingDate || undefined,
                            time: client.preferred_time || undefined,
                            staffId: client.preferred_staff_id || undefined,
                          });
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-night rounded-lg text-xs font-bold hover:bg-primary/90 transition shadow-sm"
                      >
                        <span className="material-symbols-outlined text-sm">calendar_add_on</span>
                        Agendar Horário Fixo
                      </button>
                    </div>
                  )}

                  {/* Formulário de Edição do Horário Fixo */}
                  {isEditingSchedule && (
                    <div className="pt-3 border-t border-slate-200 dark:border-white/10 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Periodicidade */}
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                            Frequência
                          </label>
                          <select
                            value={preferredFrequency}
                            onChange={(e) => setPreferredFrequency(e.target.value as PreferredFrequency | '')}
                            className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white font-medium focus:ring-1 focus:ring-primary"
                          >
                            <option value="">Nenhuma (Sem horário fixo)</option>
                            <option value="weekly">Semanal (Toda semana)</option>
                            <option value="biweekly">Quinzenal (A cada 15 dias)</option>
                            <option value="monthly">Mensal (1 vez por mês)</option>
                          </select>
                        </div>

                        {/* Dia da Semana ISO */}
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                            Dia da Semana Preferido
                          </label>
                          <select
                            value={preferredWeekday}
                            onChange={(e) =>
                              setPreferredWeekday(e.target.value === '' ? '' : Number(e.target.value))
                            }
                            className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white font-medium focus:ring-1 focus:ring-primary"
                          >
                            <option value="">Selecione o dia</option>
                            {Object.entries(WEEKDAY_LABELS).map(([isoStr, label]) => (
                              <option key={isoStr} value={isoStr}>
                                {label.full}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Horário */}
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                            Horário Fixo
                          </label>
                          <input
                            type="time"
                            value={preferredTime}
                            onChange={(e) => setPreferredTime(e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white font-medium focus:ring-1 focus:ring-primary"
                          />
                        </div>

                        {/* Barbeiro Fixo */}
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                            Profissional de Preferência
                          </label>
                          <select
                            value={preferredStaffId}
                            onChange={(e) => setPreferredStaffId(e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white font-medium focus:ring-1 focus:ring-primary"
                          >
                            <option value="">Qualquer profissional disponível</option>
                            {staffOptions.map((staff) => (
                              <option key={staff.id} value={staff.id}>
                                {staff.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setIsEditingSchedule(false)}
                          className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-white"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveSchedule}
                          disabled={isSavingSchedule}
                          className="px-4 py-1.5 bg-primary text-night rounded-lg text-xs font-bold hover:bg-primary/90 transition disabled:opacity-50"
                        >
                          {isSavingSchedule ? 'Salvando...' : 'Salvar Preferências'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Seção Notas Técnicas Operacionais */}
                <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] p-4.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-slate-400 text-lg">edit_note</span>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        Notas Técnicas & Preferências Operacionais
                      </h4>
                    </div>
                    {notesSavedFeedback && (
                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">check_circle</span>
                        Salvo
                      </span>
                    )}
                  </div>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    onBlur={handleSaveNotes}
                    placeholder="Ex: Usa degradê navalhado na zero alta, tesoura desfiadeira no topo. Sensibilidade na nuca. Prefere café sem açúcar..."
                    rows={3}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-1 focus:ring-primary outline-none transition"
                  />
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Salva automaticamente ao sair do campo.</span>
                    <button
                      type="button"
                      onClick={handleSaveNotes}
                      disabled={isSavingNotes || notes === (client.notes || '')}
                      className="px-3 py-1 bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-200 rounded text-xs font-bold hover:bg-slate-300 dark:hover:bg-white/20 transition disabled:opacity-40"
                    >
                      {isSavingNotes ? 'Salvando...' : 'Salvar Nota'}
                    </button>
                  </div>
                </div>

                {/* Seção Próximos Agendamentos Futuros */}
                <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] p-4.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-slate-400 text-lg">calendar_month</span>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        Próximos Agendamentos
                      </h4>
                    </div>
                    <span className="text-xs font-bold text-slate-400">
                      {upcomingAppointments.length} agendado(s)
                    </span>
                  </div>

                  {upcomingLoading ? (
                    <div className="py-6 text-center text-xs text-slate-400 animate-pulse">
                      Carregando agendamentos futuros...
                    </div>
                  ) : upcomingAppointments.length === 0 ? (
                    <div className="py-4 text-center border border-dashed border-slate-200 dark:border-white/10 rounded-lg">
                      <p className="text-xs text-slate-400">Nenhum agendamento futuro encontrado.</p>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onBookAppointment();
                        }}
                        className="mt-2 text-xs font-bold text-primary hover:underline"
                      >
                        + Agendar novo horário
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {upcomingAppointments.map((apt) => (
                        <div
                          key={apt.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5"
                        >
                          <div className="space-y-0.5">
                            <p className="text-xs font-bold text-slate-900 dark:text-white">
                              {apt.service_name || serviceLabel}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {formatDateTime(apt.start_time)} • {apt.staff_name || 'Profissional'}
                            </p>
                          </div>
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                            {apt.status === 'confirmed' ? 'Confirmado' : 'Pendente'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Club dos Chefes Banner */}
                {!isEsteticaApp && chefClub && (
                  <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="size-10 bg-amber-500 text-white rounded-lg flex items-center justify-center shadow-lg shadow-amber-500/20">
                        <span className="material-symbols-outlined">workspace_premium</span>
                      </div>
                      <div>
                        <p className="text-[10px] text-amber-600 font-black uppercase">Club dos Chefes</p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{chefClub.planName}</p>
                        <p className="text-[10px] text-slate-500 font-bold">
                          Status: {chefClub.status === 'active' ? 'Ativo' : 'Pendente'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-amber-600 leading-none">{chefClub.credits}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Créditos</p>
                    </div>
                  </div>
                )}

                {/* Additional Metadata */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-lg border border-slate-200 dark:border-white/5">
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Aniversário</p>
                    <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">
                      {formatDate(client.birthday)}
                    </p>
                  </div>
                  <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-lg border border-slate-200 dark:border-white/5">
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Último Serviço</p>
                    <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5 truncate">
                      {client.last_service || '-'}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              /* Vouchers & Fidelidade Tab */
              <div className="space-y-4">
                <CustomerVouchersSection
                  tenantId={tenantId}
                  customerId={client.id}
                  currentUserId={currentUserId}
                  onToast={onToast}
                />
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default ClientProfile360Drawer;
