import React, { useState, useEffect, useMemo } from 'react';
import Modal from '../ui/Modal';
import { waitlistService } from '../../services/waitlistService';
import type { WaitlistEntry, WaitlistStatus } from '../../src/types/waitlist';
import Toast from '../Toast';

interface ClientOption {
  id: string;
  name: string;
  phone: string | null;
}

interface StaffOption {
  id: string;
  name: string;
}

interface ServiceOption {
  id: string;
  name: string;
}

interface WaitlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  selectedDate: string; // YYYY-MM-DD
  clients: ClientOption[];
  staffList: StaffOption[];
  services: ServiceOption[];
  onWaitlistUpdated?: () => void;
}

const statusMeta: Record<WaitlistStatus, { label: string; className: string; icon: string }> = {
  waiting: {
    label: 'Aguardando vaga',
    className: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
    icon: 'hourglass_top',
  },
  notified: {
    label: 'Notificado',
    className: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',
    icon: 'notifications_active',
  },
  booked: {
    label: 'Agendado',
    className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
    icon: 'check_circle',
  },
  expired: {
    label: 'Expirado',
    className: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
    icon: 'event_busy',
  },
};

export const WaitlistModal: React.FC<WaitlistModalProps> = ({
  isOpen,
  onClose,
  tenantId,
  selectedDate,
  clients,
  staffList,
  services,
  onWaitlistUpdated,
}) => {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState<'selected' | 'all'>('selected');
  const [isAdding, setIsAdding] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Form states
  const [newClientId, setNewClientId] = useState('');
  const [newServiceId, setNewServiceId] = useState('');
  const [newStaffId, setNewStaffId] = useState('');
  const [newDate, setNewDate] = useState(selectedDate);
  const [newStartTime, setNewStartTime] = useState('');
  const [newEndTime, setNewEndTime] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadEntries = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const dateParam = filterDate === 'selected' ? selectedDate : undefined;
      const data = await waitlistService.listWaitlist(tenantId, dateParam);
      setEntries(data);
    } catch {
      setToast({ message: 'Erro ao carregar lista de espera.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void loadEntries();
      setNewDate(selectedDate);
    }
  }, [isOpen, tenantId, selectedDate, filterDate]);

  const handleCreateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !newClientId || !newDate) {
      setToast({ message: 'Selecione o cliente e a data desejada.', type: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      await waitlistService.createEntry(tenantId, {
        client_id: newClientId,
        service_id: newServiceId || null,
        preferred_staff_id: newStaffId || null,
        desired_date: newDate,
        start_time_range: newStartTime || null,
        end_time_range: newEndTime || null,
      });

      setToast({ message: 'Cliente adicionado à fila de espera com sucesso!', type: 'success' });
      setIsAdding(false);
      setNewClientId('');
      setNewServiceId('');
      setNewStaffId('');
      setNewStartTime('');
      setNewEndTime('');
      await loadEntries();
      onWaitlistUpdated?.();
    } catch (err: any) {
      setToast({ message: `Erro ao adicionar: ${err.message}`, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: WaitlistStatus) => {
    if (!tenantId) return;
    try {
      await waitlistService.updateStatus(tenantId, id, newStatus);
      setToast({ message: `Status atualizado para ${statusMeta[newStatus].label}.`, type: 'info' });
      await loadEntries();
      onWaitlistUpdated?.();
    } catch (err: any) {
      setToast({ message: `Erro ao alterar status: ${err.message}`, type: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!tenantId) return;
    try {
      await waitlistService.deleteEntry(tenantId, id);
      setToast({ message: 'Registro removido da fila.', type: 'info' });
      setEntries((prev) => prev.filter((item) => item.id !== id));
      onWaitlistUpdated?.();
    } catch (err: any) {
      setToast({ message: `Erro ao remover: ${err.message}`, type: 'error' });
    }
  };

  const handleWhatsApp = (entry: WaitlistEntry) => {
    const rawPhone = entry.client_phone || '';
    const cleanPhone = rawPhone.replace(/\D/g, '');
    if (!cleanPhone) {
      setToast({ message: 'Cliente não possui telefone cadastrado.', type: 'info' });
      return;
    }

    const serviceText = entry.service_name ? ` para ${entry.service_name}` : '';
    const message = encodeURIComponent(
      `Olá ${entry.client_name}! Vemos que você está na nossa lista de espera da barbearia${serviceText}. Acabamos de ter uma vaga disponível! Deseja que reservemos para você?`
    );
    window.open(`https://wa.me/55${cleanPhone}?text=${message}`, '_blank');
  };

  const waitingCount = useMemo(() => entries.filter((e) => e.status === 'waiting').length, [entries]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Fila de Espera de Agendamento"
      maxWidth="lg"
    >
      <div className="space-y-4">
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

        {/* Top bar com métricas e filtros */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
              <span className="material-symbols-outlined text-lg">hourglass_top</span>
            </div>
            <div>
              <p className="text-sm font-black text-slate-900 dark:text-white">
                {waitingCount} {waitingCount === 1 ? 'cliente aguardando' : 'clientes aguardando'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Notificados automaticamente via motor assíncrono ao vagar horário.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <div className="flex rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-card-dark p-0.5 text-xs font-bold">
              <button
                type="button"
                onClick={() => setFilterDate('selected')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  filterDate === 'selected'
                    ? 'bg-[#003366] text-white dark:bg-[#00D2FF] dark:text-[#06111F]'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                Data Atual
              </button>
              <button
                type="button"
                onClick={() => setFilterDate('all')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  filterDate === 'all'
                    ? 'bg-[#003366] text-white dark:bg-[#00D2FF] dark:text-[#06111F]'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                Todas as Datas
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsAdding(!isAdding)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#007BFF] px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#006ADF] transition-all"
            >
              <span className="material-symbols-outlined text-sm">{isAdding ? 'close' : 'person_add'}</span>
              <span>{isAdding ? 'Fechar' : 'Novo'}</span>
            </button>
          </div>
        </div>

        {/* Formulário para Adicionar */}
        {isAdding && (
          <form onSubmit={handleCreateEntry} className="p-4 rounded-2xl border border-[#007BFF]/30 bg-[#F8FBFF] dark:bg-[#0B1828] space-y-3.5 animate-fade-in">
            <p className="text-xs font-black text-[#003366] dark:text-[#72E7FF] uppercase tracking-wider">
              Adicionar Cliente à Fila de Espera
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1 block">
                  Cliente *
                </label>
                <select
                  required
                  value={newClientId}
                  onChange={(e) => setNewClientId(e.target.value)}
                  className="w-full bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white"
                >
                  <option value="">Selecione o cliente...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1 block">
                  Data desejada *
                </label>
                <input
                  type="date"
                  required
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1 block">
                  Serviço de preferência
                </label>
                <select
                  value={newServiceId}
                  onChange={(e) => setNewServiceId(e.target.value)}
                  className="w-full bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white"
                >
                  <option value="">Qualquer serviço</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1 block">
                  Profissional de preferência
                </label>
                <select
                  value={newStaffId}
                  onChange={(e) => setNewStaffId(e.target.value)}
                  className="w-full bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white"
                >
                  <option value="">Qualquer profissional</option>
                  {staffList.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1 block">
                  Horário a partir de
                </label>
                <input
                  type="time"
                  value={newStartTime}
                  onChange={(e) => setNewStartTime(e.target.value)}
                  className="w-full bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-xl p-2 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1 block">
                  Horário até
                </label>
                <input
                  type="time"
                  value={newEndTime}
                  onChange={(e) => setNewEndTime(e.target.value)}
                  className="w-full bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-xl p-2 text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200/60 dark:border-white/10">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 rounded-xl bg-[#003366] dark:bg-[#00D2FF] text-white dark:text-[#06111F] text-xs font-black shadow-xs disabled:opacity-50"
              >
                {submitting ? 'Adicionando...' : 'Salvar na Fila'}
              </button>
            </div>
          </form>
        )}

        {/* Lista de Registros */}
        <div className="max-h-[420px] overflow-y-auto space-y-2.5 pr-1">
          {loading ? (
            <div className="py-12 text-center text-slate-400">
              <div className="size-8 mx-auto border-2 border-primary border-t-transparent animate-spin rounded-full mb-2" />
              <p className="text-xs font-bold">Carregando fila de espera...</p>
            </div>
          ) : entries.length > 0 ? (
            entries.map((entry) => {
              const meta = statusMeta[entry.status];
              return (
                <div
                  key={entry.id}
                  className="p-3.5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-card-dark flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs hover:border-primary/30 transition-all"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-black text-slate-900 dark:text-white truncate">
                        {entry.client_name}
                      </p>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border ${meta.className}`}>
                        <span className="material-symbols-outlined text-xs">{meta.icon}</span>
                        {meta.label}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      📅 {new Date(entry.desired_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                      {entry.start_time_range && ` • Das ${entry.start_time_range.slice(0, 5)}`}
                      {entry.end_time_range && ` até ${entry.end_time_range.slice(0, 5)}`}
                      {entry.service_name && ` • Serviço: ${entry.service_name}`}
                      {entry.preferred_staff_name && ` • Com: ${entry.preferred_staff_name}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 self-end sm:self-center">
                    {entry.client_phone && (
                      <button
                        type="button"
                        onClick={() => handleWhatsApp(entry)}
                        className="p-2 rounded-xl text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors"
                        title="Avisar cliente no WhatsApp"
                      >
                        <span className="material-symbols-outlined text-base">chat</span>
                      </button>
                    )}

                    {entry.status === 'waiting' && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(entry.id, 'booked')}
                        className="px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-bold hover:bg-emerald-500/20 transition-colors"
                        title="Marcar como já agendado"
                      >
                        Agendado
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDelete(entry.id)}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors"
                      title="Remover da fila"
                    >
                      <span className="material-symbols-outlined text-base">delete</span>
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-12 text-center text-slate-400 p-8 border border-dashed border-slate-200 dark:border-white/10 rounded-2xl">
              <span className="material-symbols-outlined text-4xl mb-2 text-slate-300 dark:text-slate-600">
                event_available
              </span>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Nenhum cliente na fila de espera</p>
              <p className="text-xs text-slate-500 mt-1">
                {filterDate === 'selected'
                  ? 'Não há solicitações de fila para a data selecionada.'
                  : 'A lista de espera está vazia no momento.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
