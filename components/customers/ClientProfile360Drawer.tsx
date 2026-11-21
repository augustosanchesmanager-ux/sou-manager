import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { Client, PreferredFrequency } from '../../domain/client/types';
import { clientRepository } from '../../domain/client';
import CustomerVouchersSection from './CustomerVouchersSection';
import { formatCurrency } from '../../shared/format/currency';
import {
  getEligibleDependentCandidates,
} from '../../src/utils/clientFamilySearch';
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
  onBookAppointment: (params?: {
    date?: string;
    time?: string;
    staffId?: string;
    clientId?: string;
    clientName?: string;
    clientPhone?: string;
  }) => void;
  allClients?: Client[];
  onClientsChanged?: () => Promise<void> | void;
  onSelectClient?: (targetClient: Client) => void;
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
  allClients = [],
  onClientsChanged,
  onSelectClient,
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
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Filhos / Dependentes state
  const [dependents, setDependents] = useState<Client[]>([]);
  const [dependentsLoading, setDependentsLoading] = useState(false);
  const [dependentMode, setDependentMode] = useState<'idle' | 'create' | 'link'>('idle');
  const [newDependentName, setNewDependentName] = useState('');
  const [newDependentBirthday, setNewDependentBirthday] = useState('');
  const [linkSearchQuery, setLinkSearchQuery] = useState('');
  const [isMutatingDependent, setIsMutatingDependent] = useState(false);

  // Trava scroll do body enquanto o drawer estiver aberto e restaura ao fechar
  useEffect(() => {
    if (!isOpen) {
      setIsFullscreen(false);
      return;
    }
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

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
      setDependentMode('idle');
      setNewDependentName('');
      setNewDependentBirthday('');
      setLinkSearchQuery('');
    }
  }, [client]);

  // Resolve parent client when viewing a dependent
  const parentClient = useMemo(() => {
    if (!client?.parent_client_id) return null;
    return allClients.find((c) => c.id === client.parent_client_id) || null;
  }, [client?.parent_client_id, allClients]);

  // Load dependents of current client
  const refreshDependents = useCallback(async () => {
    if (!isOpen || !client || !tenantId || client.parent_client_id) {
      setDependents([]);
      return;
    }
    if (allClients.length > 0) {
      setDependents(
        allClients
          .filter((c) => c.parent_client_id === client.id)
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      return;
    }
    setDependentsLoading(true);
    try {
      const list = await clientRepository.listDependents(client.id, tenantId);
      setDependents(list);
    } catch {
      setDependents([]);
    } finally {
      setDependentsLoading(false);
    }
  }, [isOpen, client, tenantId, allClients]);

  useEffect(() => {
    void refreshDependents();
  }, [refreshDependents]);

  const eligibleCandidatesToLink = useMemo(() => {
    if (!client || client.parent_client_id) return [];
    return getEligibleDependentCandidates(allClients, client.id, linkSearchQuery, 6);
  }, [allClients, client, linkSearchQuery]);

  const handleCreateDependent = useCallback(async () => {
    if (!client || !tenantId) return;
    const cleanName = newDependentName.trim();
    if (!cleanName) {
      onToast({ message: 'Informe o nome do filho/dependente.', type: 'warning' });
      return;
    }
    setIsMutatingDependent(true);
    try {
      const created = await clientRepository.createDependent(
        { id: client.id, phone: client.phone, parent_client_id: client.parent_client_id },
        { name: cleanName, birthday: newDependentBirthday || undefined },
        tenantId,
      );
      setDependents((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewDependentName('');
      setNewDependentBirthday('');
      setDependentMode('idle');
      await onClientsChanged?.();
      onToast({ message: `${created.name} vinculado(a) como dependente de ${client.name}.`, type: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao cadastrar dependente.';
      onToast({ message, type: 'error' });
    } finally {
      setIsMutatingDependent(false);
    }
  }, [client, tenantId, newDependentName, newDependentBirthday, onClientsChanged, onToast]);

  const handleLinkExistingDependent = useCallback(
    async (candidate: Client) => {
      if (!client || !tenantId) return;
      setIsMutatingDependent(true);
      try {
        await clientRepository.linkExistingAsDependent(
          candidate.id,
          { id: client.id, phone: client.phone, parent_client_id: client.parent_client_id },
          tenantId,
        );
        setDependentMode('idle');
        setLinkSearchQuery('');
        await onClientsChanged?.();
        await refreshDependents();
        onToast({ message: `${candidate.name} vinculado(a) a ${client.name}.`, type: 'success' });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro ao vincular dependente.';
        onToast({ message, type: 'error' });
      } finally {
        setIsMutatingDependent(false);
      }
    },
    [client, tenantId, onClientsChanged, refreshDependents, onToast],
  );

  const handleUnlinkDependent = useCallback(
    async (targetChild: Client) => {
      if (!tenantId) return;
      setIsMutatingDependent(true);
      try {
        await clientRepository.unlinkDependent(targetChild.id, tenantId);
        if (client && targetChild.id === client.id) {
          onClientUpdated?.({ ...client, parent_client_id: null });
        } else {
          setDependents((prev) => prev.filter((item) => item.id !== targetChild.id));
        }
        await onClientsChanged?.();
        onToast({ message: `Vínculo de ${targetChild.name} removido.`, type: 'info' });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro ao desvincular dependente.';
        onToast({ message, type: 'error' });
      } finally {
        setIsMutatingDependent(false);
      }
    },
    [tenantId, client, onClientUpdated, onClientsChanged, onToast],
  );

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
      await clientRepository.update(client.id, { notes }, tenantId);
      onClientUpdated?.({ ...client, notes });
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
      const scheduleFields = {
        preferred_frequency: preferredFrequency ? (preferredFrequency as PreferredFrequency) : undefined,
        preferred_weekday: preferredWeekday !== '' ? Number(preferredWeekday) : undefined,
        preferred_time: preferredTime || undefined,
        preferred_staff_id: preferredStaffId || undefined,
      };
      await clientRepository.update(
        client.id,
        scheduleFields,
        tenantId
      );
      onClientUpdated?.({ ...client, ...scheduleFields });
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

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-hidden font-sans">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className={`fixed inset-y-0 right-0 flex max-w-full ${isFullscreen ? 'w-full' : 'w-full lg:w-[78vw] xl:max-w-6xl'}`}>
        <section
          aria-labelledby="drawer-client-name"
          className="w-full h-screen bg-[#0E0C0A] text-[#F5F5F0] shadow-2xl flex flex-col border-l border-[#2D2A26] transition-all duration-200"
        >
          {/* Drawer Header (Fixo) */}
          <div className="shrink-0 p-5 sm:p-6 border-b border-[#2D2A26] bg-[#141210]">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="relative size-16 rounded-full bg-slate-800 overflow-hidden border-2 border-[#B88A44]/40 shadow-md shrink-0">
                  {client.avatar ? (
                    <img src={client.avatar} alt={client.name} className="size-full object-cover" />
                  ) : (
                    <div className="size-full flex items-center justify-center bg-slate-900 text-slate-400">
                      <span className="material-symbols-outlined text-3xl">person</span>
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 id="drawer-client-name" className="text-xl font-bold text-white leading-tight">
                      {client.name}
                    </h2>
                    <span className="text-xs font-mono text-slate-500">
                      #{getDisplayId(client.id)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        client.status === 'active'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-white/10 text-slate-400'
                      }`}
                    >
                      <span className="size-1.5 rounded-full bg-current" />
                      {client.status === 'active' ? 'Ativo' : 'Inativo'}
                    </span>
                    {client.preferred_frequency && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <span className="material-symbols-outlined text-xs">chair</span>
                        Cadeira Cativa ({FREQUENCY_LABELS[client.preferred_frequency]})
                      </span>
                    )}
                    {crmAlert?.isVip && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#B88A44] text-neutral-950">
                        VIP · LTV {formatCurrency(crmAlert.lifetimeValue)}
                      </span>
                    )}
                    {client.parent_client_id && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sky-500/15 text-sky-300 border border-sky-500/30">
                        <span className="material-symbols-outlined text-xs">family_restroom</span>
                        <span>
                          Dependente de{' '}
                          {parentClient && onSelectClient ? (
                            <button
                              type="button"
                              onClick={() => onSelectClient(parentClient)}
                              className="underline font-black hover:text-white transition-colors"
                            >
                              {parentClient.name}
                            </button>
                          ) : (
                            parentClient?.name || 'Responsável'
                          )}
                        </span>
                        <button
                          type="button"
                          disabled={isMutatingDependent}
                          onClick={() => void handleUnlinkDependent(client)}
                          className="ml-1 text-sky-200/80 hover:text-red-400 transition-colors"
                          title="Desvincular do responsável"
                        >
                          ×
                        </button>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Controles de Ação de Topo (Tela Inteira / Reduzir + Fechar) */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsFullscreen((prev) => !prev)}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#2D2A26] bg-[#0E0C0A] text-xs font-bold text-slate-300 hover:text-[#B88A44] hover:border-[#B88A44]/50 transition-colors"
                  title={isFullscreen ? 'Reduzir para painel lateral' : 'Expandir para tela inteira (PC)'}
                >
                  <span className="material-symbols-outlined text-base">
                    {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
                  </span>
                  <span>{isFullscreen ? 'Reduzir' : 'Tela Inteira'}</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                  title="Fechar (Esc)"
                >
                  <span className="material-symbols-outlined text-2xl">close</span>
                </button>
              </div>
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

                {/* Seção Filhos / Dependentes (Apenas para Clientes Titulares — Limite de 1 Nível) */}
                {!client.parent_client_id && (
                  <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] p-4.5 space-y-3.5">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="size-9 rounded-lg bg-[#B88A44]/15 text-[#B88A44] flex items-center justify-center border border-[#B88A44]/30">
                          <span className="material-symbols-outlined text-xl">family_restroom</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                              Filhos / Dependentes
                            </h4>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#B88A44]/15 text-[#B88A44]">
                              {dependents.length}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Perfis próprios vinculados ao WhatsApp de {client.name.split(' ')[0]}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setDependentMode((prev) => (prev === 'create' ? 'idle' : 'create'))
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold bg-[#B88A44]/15 text-[#B88A44] hover:bg-[#B88A44]/25 border border-[#B88A44]/30 rounded-lg transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm">person_add</span>
                          + Cadastrar Filho
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDependentMode((prev) => (prev === 'link' ? 'idle' : 'link'))
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200 rounded-lg transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm">link</span>
                          Vincular Existente
                        </button>
                      </div>
                    </div>

                    {dependentMode === 'create' && (
                      <div className="pt-3 border-t border-slate-200 dark:border-white/10 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                              Nome do Filho / Dependente *
                            </label>
                            <input
                              type="text"
                              value={newDependentName}
                              onChange={(e) => setNewDependentName(e.target.value)}
                              placeholder="Ex: Samuel Oliveira"
                              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white font-medium focus:ring-1 focus:ring-primary outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                              Data de Nascimento (Opcional)
                            </label>
                            <input
                              type="date"
                              value={newDependentBirthday}
                              onChange={(e) => setNewDependentBirthday(e.target.value)}
                              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white font-medium focus:ring-1 focus:ring-primary outline-none"
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-slate-400">
                            Herdará automaticamente o telefone {client.phone || 'do responsável'}.
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setDependentMode('idle')}
                              className="px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-white"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              disabled={isMutatingDependent || !newDependentName.trim()}
                              onClick={() => void handleCreateDependent()}
                              className="px-3.5 py-1.5 bg-primary text-night rounded-lg text-xs font-bold hover:bg-primary/90 transition disabled:opacity-50"
                            >
                              {isMutatingDependent ? 'Salvando...' : 'Salvar Filho'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {dependentMode === 'link' && (
                      <div className="pt-3 border-t border-slate-200 dark:border-white/10 space-y-2.5">
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                            Buscar cliente já cadastrado para vincular como filho
                          </label>
                          <input
                            type="text"
                            value={linkSearchQuery}
                            onChange={(e) => setLinkSearchQuery(e.target.value)}
                            placeholder="Digite o nome ou telefone..."
                            className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white font-medium focus:ring-1 focus:ring-primary outline-none"
                          />
                        </div>
                        {eligibleCandidatesToLink.length === 0 ? (
                          <p className="text-xs text-slate-400 py-1">
                            Nenhum cadastro elegível encontrado para o filtro informado.
                          </p>
                        ) : (
                          <div className="max-h-40 overflow-y-auto divide-y divide-slate-200/60 dark:divide-white/5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20">
                            {eligibleCandidatesToLink.map((candidate) => (
                              <div
                                key={candidate.id}
                                className="flex items-center justify-between px-3 py-2 text-xs"
                              >
                                <div>
                                  <p className="font-bold text-slate-900 dark:text-white">
                                    {candidate.name}
                                  </p>
                                  <p className="text-[11px] text-slate-400">
                                    {candidate.phone || 'Sem telefone'}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  disabled={isMutatingDependent}
                                  onClick={() => void handleLinkExistingDependent(candidate)}
                                  className="px-2.5 py-1 rounded bg-[#B88A44]/20 text-[#B88A44] hover:bg-[#B88A44]/30 font-bold text-[11px] transition-colors disabled:opacity-50"
                                >
                                  Vincular
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {dependentsLoading ? (
                      <div className="py-3 text-center text-xs text-slate-400 animate-pulse">
                        Carregando dependentes...
                      </div>
                    ) : dependents.length === 0 ? (
                      <p className="text-xs text-slate-400">
                        Nenhum filho/dependente vinculado a este cliente.
                      </p>
                    ) : (
                      <div className="space-y-2 pt-1">
                        {dependents.map((dep) => (
                          <div
                            key={dep.id}
                            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="size-8 rounded-full bg-[#B88A44]/15 text-[#B88A44] flex items-center justify-center font-bold text-xs border border-[#B88A44]/30">
                                {dep.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  {onSelectClient ? (
                                    <button
                                      type="button"
                                      onClick={() => onSelectClient(dep)}
                                      className="text-xs font-bold text-slate-900 dark:text-white hover:text-[#B88A44] transition-colors text-left"
                                    >
                                      {dep.name}
                                    </button>
                                  ) : (
                                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                                      {dep.name}
                                    </p>
                                  )}
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#B88A44]/15 text-[#B88A44] font-bold">
                                    Filho(a)
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-400">
                                  {dep.birthday ? `Aniv.: ${formatDate(dep.birthday)} • ` : ''}
                                  WhatsApp: {dep.phone || client.phone || '-'}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  onClose();
                                  onBookAppointment({
                                    clientId: dep.id,
                                    clientName: dep.name,
                                    clientPhone: dep.phone || client.phone,
                                    staffId: dep.preferred_staff_id || undefined,
                                  });
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary text-night rounded text-[11px] font-bold hover:bg-primary/90 transition"
                              >
                                <span className="material-symbols-outlined text-xs">calendar_add_on</span>
                                Agendar
                              </button>
                              <button
                                type="button"
                                disabled={isMutatingDependent}
                                onClick={() => void handleUnlinkDependent(dep)}
                                className="px-2 py-1 text-[11px] font-bold text-slate-400 hover:text-red-400 transition-colors"
                                title="Desvincular dependente"
                              >
                                Desvincular
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

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
    </div>,
    document.body
  );
};

export default ClientProfile360Drawer;
