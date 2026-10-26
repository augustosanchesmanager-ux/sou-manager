import React, { useState, useMemo } from 'react';
import {
  classifyChairQueue,
  formatElapsedTime,
  getRecommendedPrimaryAction,
  type QueueAppointment,
} from '../../src/utils/barberQueue';
import AppointmentActionMenu from './AppointmentActionMenu';

export interface BarberChairQueueProps {
  appointments: QueueAppointment[];
  staffList: Array<{ id: string; name: string }>;
  selectedStaffId: string;
  onSelectStaff: (staffId: string) => void;
  isBarberRole: boolean;
  onStartAppointment: (apt: QueueAppointment) => void;
  onFinishAppointment: (apt: QueueAppointment) => void;
  onOpenDetails: (apt: QueueAppointment) => void;
  onEditAppointment: (apt: QueueAppointment) => void;
  onCancelAppointment: (apt: QueueAppointment) => void;
  onOpenClient: (apt: QueueAppointment) => void;
  onOpenComanda: (apt: QueueAppointment) => void;
  onStatusChange?: (apt: QueueAppointment, status: string, label: string) => void;
  onWhatsApp?: (apt: QueueAppointment) => void;
  onOpenQuickWalkIn: () => void;
  orderLabel?: string;
}

export const BarberChairQueue: React.FC<BarberChairQueueProps> = ({
  appointments,
  staffList,
  selectedStaffId,
  onSelectStaff,
  isBarberRole,
  onStartAppointment,
  onFinishAppointment,
  onOpenDetails,
  onEditAppointment,
  onCancelAppointment,
  onOpenClient,
  onOpenComanda,
  onStatusChange,
  onWhatsApp,
  onOpenQuickWalkIn,
  orderLabel = 'Comanda',
}) => {
  const [showCompleted, setShowCompleted] = useState(false);

  // Classifica a fila para o profissional selecionado
  const { inProgress, next, upcoming, completed } = useMemo(() => {
    return classifyChairQueue(appointments, selectedStaffId);
  }, [appointments, selectedStaffId]);

  const activeStaff = staffList.find((s) => s.id === selectedStaffId);

  const formatDecimalHour = (decimal: number) => {
    const h = Math.floor(decimal);
    const m = Math.round((decimal - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4 animate-fade-in pb-12">
      {/* 🧭 Topo de Bancada: Identificação da Cadeira e Encaixe Rápido */}
      <section className="rounded-2xl border border-line dark:border-border-dark bg-card dark:bg-card-dark p-3.5 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
              {isBarberRole ? 'Sua Cadeira Operacional' : 'Fila da Cadeira'}
            </p>
            <h2 className="font-display text-base font-bold text-ink dark:text-white truncate">
              {activeStaff?.name || (selectedStaffId === 'all' ? 'Todas as Cadeiras' : 'Cadeira')}
            </h2>
          </div>

          <button
            type="button"
            onClick={onOpenQuickWalkIn}
            aria-label="Adicionar encaixe rápido na cadeira"
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-primary to-primary-dark text-night font-bold text-xs px-3.5 py-2.5 shadow-sm hover:brightness-105 active:scale-[0.98] transition-all shrink-0 touch-manipulation"
          >
            <span className="material-symbols-outlined text-base">person_add</span>
            <span>+ Encaixe Rápido</span>
          </button>
        </div>

        {/* Alternância Rápida de Profissional (para gerentes / recepção) */}
        {!isBarberRole && staffList.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1 pt-1 no-scrollbar">
            <button
              type="button"
              onClick={() => onSelectStaff('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                selectedStaffId === 'all'
                  ? 'bg-primary/20 text-primary-light border-primary/40 shadow-xs'
                  : 'bg-card dark:bg-surface-dark text-ink-soft hover:text-ink dark:hover:text-white border-line dark:border-border-dark hover:border-primary/30'
              }`}
            >
              Todas
            </button>
            {staffList.map((staff) => {
              const isSelected = selectedStaffId === staff.id;
              return (
                <button
                  key={staff.id}
                  type="button"
                  onClick={() => onSelectStaff(staff.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                    isSelected
                      ? 'bg-primary/20 text-primary-light border-primary/40 shadow-xs'
                      : 'bg-card dark:bg-surface-dark text-ink-soft hover:text-ink dark:hover:text-white border-line dark:border-border-dark hover:border-primary/30'
                  }`}
                >
                  {staff.name.split(' ')[0]}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* 🟢 CARD HERO: "NA CADEIRA AGORA" (Spotlight de Atendimento) */}
      <section className="space-y-1.5">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <span className="relative flex size-2.5">
              {inProgress && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full size-2.5 ${
                  inProgress ? 'bg-emerald-500' : 'bg-ink-soft/40'
                }`}
              />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-ink-soft">
              Na Cadeira Agora
            </span>
          </div>
          {inProgress && (
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold tabular-nums text-emerald-400 border border-emerald-500/30">
              {formatElapsedTime(inProgress.startTime)}
            </span>
          )}
        </div>

        {inProgress ? (
          <div className="rounded-2xl border-2 border-emerald-500/40 bg-card-dark p-5 text-white shadow-xl relative">
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
              <div className="absolute -right-6 -bottom-6 size-40 rounded-full bg-emerald-500/10 blur-3xl" />
            </div>

            <div className="flex items-start justify-between gap-3 relative z-30">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-xl font-bold truncate text-white">{inProgress.client}</h3>
                  {inProgress.isOverbooked && (
                    <span className="rounded bg-primary/20 text-primary-light border border-primary/30 px-1.5 py-0.5 text-[10px] font-bold uppercase">
                      Encaixe
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium text-ink-soft truncate mt-0.5">
                  {inProgress.service}
                </p>
                <div className="flex items-center gap-3 text-xs text-ink-soft mt-2">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-emerald-400">schedule</span>
                    Início: <strong className="font-display font-bold tabular-nums text-emerald-400">{formatDecimalHour(inProgress.start)}</strong>
                  </span>
                  {Boolean(inProgress.price) && (
                    <span className="font-display font-bold tabular-nums text-primary-light">
                      R$ {Number(inProgress.price).toFixed(2).replace('.', ',')}
                    </span>
                  )}
                </div>
              </div>

              <AppointmentActionMenu
                appointment={inProgress}
                onOpenDetails={onOpenDetails}
                onEdit={onEditAppointment}
                onStatusChange={onStatusChange}
                onCancel={onCancelAppointment}
                onOpenClient={onOpenClient}
                onOpenComanda={onOpenComanda}
                onWhatsApp={onWhatsApp}
                orderLabel={orderLabel}
              />
            </div>

            {/* Zona do Polegar: 1 Toque para Finalizar ou Comanda */}
            <div className="mt-5 pt-3 border-t border-border-dark flex flex-col sm:flex-row gap-2 relative z-10">
              <button
                type="button"
                onClick={() => onFinishAppointment(inProgress)}
                aria-label={`Finalizar atendimento de ${inProgress.client}`}
                className="flex-1 h-12 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold text-sm shadow-md transition-all touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                <span className="material-symbols-outlined text-xl">task_alt</span>
                <span>Finalizar Atendimento</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenComanda(inProgress)}
                aria-label={`Abrir ${orderLabel.toLowerCase()} de ${inProgress.client}`}
                className="h-12 px-4 flex items-center justify-center gap-1.5 rounded-xl bg-surface-dark hover:bg-white/10 text-white font-semibold text-xs border border-border-dark transition-colors touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <span className="material-symbols-outlined text-base text-primary">receipt_long</span>
                <span>{orderLabel}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-line dark:border-border-dark bg-card dark:bg-card-dark p-6 text-center">
            <span className="material-symbols-outlined text-3xl text-ink-soft">airline_seat_recline_normal</span>
            <p className="mt-1 font-display text-sm font-bold text-ink dark:text-white">
              Cadeira livre no momento
            </p>
            <p className="text-xs text-ink-soft mt-0.5">
              Nenhum cliente em atendimento agora.
            </p>
            {next && (
              <button
                type="button"
                onClick={() => onStartAppointment(next)}
                aria-label={`Chamar ${next.client} para a cadeira`}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-dark text-night font-bold text-xs px-4 py-2.5 shadow-sm hover:brightness-105 active:scale-[0.98] transition-all touch-manipulation"
              >
                <span className="material-symbols-outlined text-base">play_arrow</span>
                <span>Chamar {next.client.split(' ')[0]}</span>
              </button>
            )}
          </div>
        )}
      </section>

      {/* ⏱️ CARD: "A SEGUIR" (On-Deck Queue) */}
      {next && (
        <section className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-primary">alarm</span>
              <span className="text-xs font-bold uppercase tracking-wider text-ink-soft">
                A Seguir na Fila
              </span>
            </div>
            <span className="font-display font-bold tabular-nums text-xs text-primary-dark dark:text-primary-light">
              {formatDecimalHour(next.start)}
            </span>
          </div>

          <div className="rounded-2xl border border-primary/30 bg-card dark:bg-card-dark p-4 shadow-sm transition-all relative">
            <div className="flex items-start justify-between gap-3 relative z-30">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-display text-base font-bold text-ink dark:text-white truncate">
                    {next.client}
                  </h4>
                  <span className="rounded-full bg-gold-soft dark:bg-surface-dark border border-line dark:border-border-dark px-2 py-0.5 text-[10px] font-bold uppercase text-primary-dark dark:text-primary-light">
                    {next.status === 'confirmed' ? 'Confirmado' : 'Pendente'}
                  </span>
                </div>
                <p className="text-xs font-medium text-ink-soft truncate mt-0.5">
                  {next.service}
                </p>
                {Boolean(next.clientPhone) && (
                  <p className="text-[11px] text-ink-soft/80 mt-1 font-mono">{next.clientPhone}</p>
                )}
              </div>

              <AppointmentActionMenu
                appointment={next}
                onOpenDetails={onOpenDetails}
                onEdit={onEditAppointment}
                onStatusChange={onStatusChange}
                onCancel={onCancelAppointment}
                onOpenClient={onOpenClient}
                onOpenComanda={onOpenComanda}
                onWhatsApp={onWhatsApp}
                orderLabel={orderLabel}
              />
            </div>

            {/* Botão de 1 Toque: Iniciar Atendimento */}
            <div className="mt-3 pt-3 border-t border-line dark:border-border-dark flex items-center gap-2 relative z-10">
              <button
                type="button"
                onClick={() => onStartAppointment(next)}
                aria-label={`Iniciar atendimento de ${next.client}`}
                className="flex-1 h-11 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-dark text-night font-bold text-xs shadow-sm hover:brightness-105 active:scale-[0.98] transition-all touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <span className="material-symbols-outlined text-lg">play_arrow</span>
                <span>Iniciar Atendimento</span>
              </button>

              {onWhatsApp && Boolean(next.clientPhone) && (
                <button
                  type="button"
                  onClick={() => onWhatsApp(next)}
                  aria-label={`Avisar ${next.client} no WhatsApp`}
                  title="Avisar no WhatsApp"
                  className="h-11 w-11 flex items-center justify-center rounded-xl border border-line dark:border-border-dark bg-card dark:bg-surface-dark hover:border-success text-success transition-colors touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-success"
                >
                  <span className="material-symbols-outlined text-base">chat</span>
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {/* 📋 RESTANTE DA FILA DO DIA (Alta Densidade Operacional) */}
      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold uppercase tracking-wider text-ink-soft">
            Demais na Fila ({upcoming.length})
          </span>
        </div>

        {upcoming.length === 0 ? (
          <div className="rounded-xl border border-line dark:border-border-dark bg-card dark:bg-card-dark p-4 text-center text-xs text-ink-soft">
            Nenhum outro atendimento na fila de hoje.
          </div>
        ) : (
          <div className="space-y-2">
            {upcoming.map((apt) => {
              const action = getRecommendedPrimaryAction(apt.status);
              return (
                <div
                  key={apt.id}
                  className="rounded-xl border border-line dark:border-border-dark bg-card dark:bg-card-dark p-3 shadow-xs transition-all hover:border-primary/30"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-display text-xs font-bold tabular-nums whitespace-nowrap text-primary-dark dark:text-primary-light">
                          {formatDecimalHour(apt.start)}
                        </span>
                        <h5 className="font-semibold text-sm text-ink dark:text-white truncate">
                          {apt.client}
                        </h5>
                      </div>
                      <p className="text-xs text-ink-soft truncate mt-0.5">
                        {apt.service}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {action.actionKey === 'start' && (
                        <button
                          type="button"
                          onClick={() => onStartAppointment(apt)}
                          aria-label={`Iniciar atendimento de ${apt.client}`}
                          className="flex items-center gap-1 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary-dark dark:text-primary-light font-bold text-xs px-2.5 py-1.5 transition-colors touch-manipulation"
                        >
                          <span className="material-symbols-outlined text-sm">play_arrow</span>
                          <span>Iniciar</span>
                        </button>
                      )}

                      <AppointmentActionMenu
                        appointment={apt}
                        onOpenDetails={onOpenDetails}
                        onEdit={onEditAppointment}
                        onStatusChange={onStatusChange}
                        onCancel={onCancelAppointment}
                        onOpenClient={onOpenClient}
                        onOpenComanda={onOpenComanda}
                        onWhatsApp={onWhatsApp}
                        orderLabel={orderLabel}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ✅ CONCLUÍDOS HOJE (ACCORDION RECOLHIDO) */}
      {completed.length > 0 && (
        <section className="pt-2">
          <button
            type="button"
            onClick={() => setShowCompleted((prev) => !prev)}
            aria-expanded={showCompleted}
            aria-label="Alternar visualização de atendimentos concluídos hoje"
            className="w-full flex items-center justify-between rounded-xl border border-line dark:border-border-dark bg-card dark:bg-card-dark px-3.5 py-2.5 text-xs font-bold text-ink-soft hover:text-ink dark:hover:text-white transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-success">check_circle</span>
              <span>Concluídos hoje ({completed.length})</span>
            </div>
            <span className={`material-symbols-outlined text-base transition-transform duration-200 ${showCompleted ? 'rotate-180' : ''}`}>
              expand_more
            </span>
          </button>

          {showCompleted && (
            <div className="mt-2 space-y-1.5 animate-fade-in">
              {completed.map((apt) => (
                <div
                  key={apt.id}
                  className="flex items-center justify-between rounded-xl border border-line/60 dark:border-border-dark/60 bg-card dark:bg-surface-dark p-2.5 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-ink dark:text-white truncate">{apt.client}</p>
                    <p className="text-[11px] text-ink-soft truncate">{apt.service}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenComanda(apt)}
                    aria-label={`Ver ${orderLabel.toLowerCase()} de ${apt.client}`}
                    className="flex items-center gap-1 text-[11px] font-bold text-emerald-500 hover:underline touch-manipulation"
                  >
                    <span>{orderLabel}</span>
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default BarberChairQueue;
