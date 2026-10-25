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
  const { inProgress, next, upcoming, completed, metrics } = useMemo(() => {
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
      {/* Topo Móvel: Identificação da Cadeira e Encaixe Rápido */}
      <section className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-card-dark p-3.5 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              {isBarberRole ? 'Sua Cadeira Operacional' : 'Fila da Cadeira'}
            </p>
            <h2 className="text-base font-black text-slate-900 dark:text-white truncate">
              {activeStaff?.name || (selectedStaffId === 'all' ? 'Todas as Cadeiras' : 'Cadeira')}
            </h2>
          </div>

          <button
            type="button"
            onClick={onOpenQuickWalkIn}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs px-3.5 py-2.5 shadow-md shadow-amber-400/20 active:scale-95 transition-all shrink-0"
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
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedStaffId === 'all'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                  : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10'
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
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    isSelected
                      ? 'bg-amber-400 text-slate-950 shadow-xs'
                      : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10'
                  }`}
                >
                  {staff.name.split(' ')[0]}
                </button>
              );
            })}
          </div>
        )}

        {/* Faixa de KPIs Compacta */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-white/5 text-center">
          <div className="rounded-xl bg-sky-500/10 p-2">
            <p className="text-[9px] font-black uppercase text-sky-700 dark:text-sky-300">Na Cadeira</p>
            <p className="text-lg font-black text-sky-800 dark:text-sky-200 leading-tight">
              {metrics.inProgressCount}
            </p>
          </div>
          <div className="rounded-xl bg-amber-500/10 p-2">
            <p className="text-[9px] font-black uppercase text-amber-700 dark:text-amber-300">Aguardando</p>
            <p className="text-lg font-black text-amber-800 dark:text-amber-200 leading-tight">
              {metrics.waitingCount}
            </p>
          </div>
          <div className="rounded-xl bg-emerald-500/10 p-2">
            <p className="text-[9px] font-black uppercase text-emerald-700 dark:text-emerald-300">Concluídos</p>
            <p className="text-lg font-black text-emerald-800 dark:text-emerald-200 leading-tight">
              {metrics.completedCount}
            </p>
          </div>
        </div>
      </section>

      {/* 🟢 CARD HERO: "NA CADEIRA AGORA" */}
      <section className="space-y-1.5">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <span className="relative flex size-2.5">
              {inProgress && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full size-2.5 ${
                  inProgress ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                }`}
              />
            </span>
            <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Na Cadeira Agora
            </span>
          </div>
          {inProgress && (
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              {formatElapsedTime(inProgress.startTime)}
            </span>
          )}
        </div>

        {inProgress ? (
          <div className="rounded-3xl border-2 border-emerald-500/30 bg-gradient-to-br from-[#102235] to-[#152e47] p-5 text-white shadow-xl shadow-emerald-950/10 relative overflow-hidden">
            <div className="pointer-events-none absolute -right-6 -bottom-6 size-32 rounded-full bg-emerald-500/10 blur-2xl" />

            <div className="flex items-start justify-between gap-3 relative z-10">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-black truncate">{inProgress.client}</h3>
                  {inProgress.isOverbooked && (
                    <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[9px] font-black uppercase text-slate-950">
                      Encaixe
                    </span>
                  )}
                </div>
                <p className="text-sm font-semibold text-slate-200 truncate mt-0.5">
                  {inProgress.service}
                </p>
                <div className="flex items-center gap-3 text-xs text-slate-300 mt-2">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-emerald-400">schedule</span>
                    Início: {formatDecimalHour(inProgress.start)}
                  </span>
                  {Boolean(inProgress.price) && (
                    <span className="font-extrabold text-amber-300">
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

            {/* Zona do Polegar: Botão Primário Destacado */}
            <div className="mt-5 pt-3 border-t border-white/10 flex flex-col sm:flex-row gap-2 relative z-10">
              <button
                type="button"
                onClick={() => onFinishAppointment(inProgress)}
                className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-black text-sm py-4 shadow-lg shadow-emerald-500/25 active:scale-[0.98] transition-all"
              >
                <span className="material-symbols-outlined text-xl">task_alt</span>
                <span>Finalizar Atendimento</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenComanda(inProgress)}
                className="flex items-center justify-center gap-1.5 rounded-2xl bg-white/10 hover:bg-white/15 text-slate-100 font-bold text-xs py-3.5 px-4 border border-white/10 transition-colors"
              >
                <span className="material-symbols-outlined text-base">receipt_long</span>
                <span>{orderLabel}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] p-5 text-center">
            <span className="material-symbols-outlined text-3xl text-slate-400">airline_seat_recline_normal</span>
            <p className="mt-1 text-sm font-bold text-slate-700 dark:text-slate-200">
              Cadeira livre no momento
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Nenhum cliente em atendimento agora.
            </p>
            {next && (
              <button
                type="button"
                onClick={() => onStartAppointment(next)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-black text-xs px-4 py-2.5 shadow-sm active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-base">play_arrow</span>
                <span>Chamar {next.client.split(' ')[0]}</span>
              </button>
            )}
          </div>
        )}
      </section>

      {/* ⏱️ CARD: "A SEGUIR" */}
      {next && (
        <section className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-sky-500">alarm</span>
              <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                A Seguir na Fila
              </span>
            </div>
            <span className="text-xs font-bold text-sky-600 dark:text-sky-400">
              {formatDecimalHour(next.start)}
            </span>
          </div>

          <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 dark:bg-sky-500/10 p-4 shadow-sm transition-all">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-base font-black text-slate-900 dark:text-white truncate">
                    {next.client}
                  </h4>
                  <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[9px] font-black uppercase text-sky-700 dark:text-sky-300">
                    {next.status === 'confirmed' ? 'Confirmado' : 'Pendente'}
                  </span>
                </div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {next.service}
                </p>
                {Boolean(next.clientPhone) && (
                  <p className="text-[11px] text-slate-400 mt-1">{next.clientPhone}</p>
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
            <div className="mt-3 pt-3 border-t border-sky-500/15">
              <button
                type="button"
                onClick={() => onStartAppointment(next)}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-black text-xs py-3 shadow-md shadow-sky-500/20 active:scale-[0.99] transition-all"
              >
                <span className="material-symbols-outlined text-lg">play_arrow</span>
                <span>Iniciar Atendimento</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* 📋 RESTANTE DA FILA DO DIA */}
      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Demais na Fila ({upcoming.length})
          </span>
        </div>

        {upcoming.length === 0 ? (
          <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-card-dark p-4 text-center text-xs text-slate-400">
            Nenhum outro atendimento na fila de hoje.
          </div>
        ) : (
          <div className="space-y-2">
            {upcoming.map((apt) => {
              const action = getRecommendedPrimaryAction(apt.status);
              return (
                <div
                  key={apt.id}
                  className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-card-dark p-3.5 shadow-sm transition-all hover:border-slate-300 dark:hover:border-white/20"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                          {formatDecimalHour(apt.start)}
                        </span>
                        <h5 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          {apt.client}
                        </h5>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {apt.service}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {action.actionKey === 'start' && (
                        <button
                          type="button"
                          onClick={() => onStartAppointment(apt)}
                          className="flex items-center gap-1 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 font-bold text-xs px-2.5 py-1.5 transition-colors"
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

      {/* ✅ CONCLUÍDOS HOJE (ACCORDION) */}
      {completed.length > 0 && (
        <section className="pt-2">
          <button
            type="button"
            onClick={() => setShowCompleted((prev) => !prev)}
            className="w-full flex items-center justify-between rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300"
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-emerald-500">check_circle</span>
              <span>Concluídos hoje ({completed.length})</span>
            </div>
            <span className="material-symbols-outlined text-base">
              {showCompleted ? 'expand_less' : 'expand_more'}
            </span>
          </button>

          {showCompleted && (
            <div className="mt-2 space-y-1.5 animate-fade-in">
              {completed.map((apt) => (
                <div
                  key={apt.id}
                  className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-white/5 bg-white dark:bg-card-dark p-2.5 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 dark:text-slate-200 truncate">{apt.client}</p>
                    <p className="text-[11px] text-slate-400 truncate">{apt.service}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenComanda(apt)}
                    className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
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
