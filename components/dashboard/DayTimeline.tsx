import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { getBusinessLabels } from '../../src/lib/apps/businessLabels';
import { getEsteticaDemoServiceName } from '../../src/lib/catalog/display';
import type { DashboardAppointment } from '../../src/modules/dashboard/types';
import { appointmentStatusLabels } from '../../shared/status/appointment';
import WhatsAppModal from './WhatsAppModal';

interface DayTimelineProps {
  appSlug?: string | null;
  appointments: DashboardAppointment[];
  loading?: boolean;
  onSelectAppointment?: (appointment: DashboardAppointment) => void;
  businessName?: string;
}

const STATUS_COLORS: Record<string, { dot: string; bg: string; border: string; text: string }> = {
  confirmed: { dot: 'bg-primary-dark', bg: 'bg-gold-soft', border: 'border-primary-light/60', text: 'text-primary-dark' },
  pending: { dot: 'bg-amber-500', bg: 'bg-gold-pale', border: 'border-line', text: 'text-amber-800 dark:text-amber-300' },
  cancelled: { dot: 'bg-danger', bg: 'bg-danger/10', border: 'border-danger/20', text: 'text-danger' },
  completed: { dot: 'bg-success', bg: 'bg-success/10', border: 'border-success/20', text: 'text-success' },
  in_progress: { dot: 'bg-primary', bg: 'bg-gold-soft', border: 'border-primary-light/40', text: 'text-primary-dark' },
  scheduled: { dot: 'bg-ink-soft', bg: 'bg-gold-pale', border: 'border-line', text: 'text-ink-soft' },
  no_show: { dot: 'bg-line', bg: 'bg-gold-pale', border: 'border-line', text: 'text-ink-soft' },
};

const formatTime = (isoString: string) => {
  const date = new Date(isoString);
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
};

export const DayTimeline: React.FC<DayTimelineProps> = ({
  appSlug,
  appointments,
  loading,
  onSelectAppointment,
  businessName,
}) => {
  const [selectedWhatsAppAppointment, setSelectedWhatsAppAppointment] = useState<DashboardAppointment | null>(null);
  const labels = getBusinessLabels(appSlug);
  const isEsteticaApp = appSlug === 'estetica';

  if (loading) {
    return (
      <div className="rounded-2xl border border-line dark:border-border-dark bg-card dark:bg-card-dark p-5">
        <div className="mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">schedule</span>
          <h3 className="font-bold text-ink dark:text-white">Agenda de hoje</h3>
        </div>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg bg-gold-pale dark:bg-white/5 p-3">
              <div className="h-12 w-12 rounded-lg bg-line dark:bg-border-dark" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-3/4 rounded bg-line dark:bg-border-dark" />
                <div className="h-2 w-1/2 rounded bg-line dark:bg-border-dark" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (appointments.length === 0) {
    return (
      <div className="rounded-2xl border border-line dark:border-border-dark bg-card dark:bg-card-dark p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gold-pale dark:bg-surface-dark text-ink-soft border border-line dark:border-border-dark">
          <span className="material-symbols-outlined text-2xl text-primary-dark dark:text-primary">event_available</span>
        </div>
        <p className="mt-3 text-sm font-bold text-ink dark:text-white">
          {isEsteticaApp ? 'Nenhum atendimento agendado para hoje.' : 'Nenhum agendamento para hoje.'}
        </p>
        <p className="mt-1 text-xs text-ink-soft max-w-sm mx-auto leading-relaxed">
          {isEsteticaApp
            ? `Cadastre ${labels.servicePlural.toLowerCase()} e ${labels.professionalPlural.toLowerCase()} para começar a usar a agenda.`
            : 'Aproveite para cadastrar um encaixe rápido no balcão ou confirmar retornos.'}
        </p>
        <Link
          to="/schedule"
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-primary to-primary-dark px-4 py-2.5 text-xs font-bold text-night shadow-sm hover:brightness-105 transition-all duration-200 active:scale-[0.98] touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          Ver agenda completa
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line dark:border-border-dark bg-card dark:bg-card-dark">
      <div className="flex items-center justify-between border-b border-line dark:border-border-dark p-5">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-ink-soft">{isEsteticaApp ? 'Agenda da unidade' : 'Agenda do dia'}</p>
          <h3 className="mt-1 font-bold text-ink dark:text-white">{isEsteticaApp ? 'Atendimentos de hoje' : 'Agendamentos de hoje'}</h3>
        </div>
        <Link to="/schedule" className="inline-flex items-center gap-1 text-xs font-black text-primary transition-colors hover:text-primary-dark focus:outline-none focus-visible:underline">
          Ver todos
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </Link>
      </div>

      <div className="divide-y divide-line dark:divide-border-dark">
        {appointments.map((apt) => {
          const status = STATUS_COLORS[apt.status as keyof typeof STATUS_COLORS] || STATUS_COLORS.pending;
          return (
            <div
              key={apt.id}
              className="group flex items-center justify-between gap-3 p-3.5 sm:p-4 transition-all duration-150 hover:bg-gold-pale/60 dark:hover:bg-surface-dark/50"
            >
              <button
                type="button"
                onClick={() => onSelectAppointment?.(apt)}
                aria-label={`Agendamento de ${apt.client_name || 'Cliente'} às ${formatTime(apt.start_time)}, ${appointmentStatusLabels[apt.status as keyof typeof appointmentStatusLabels] || 'Pendente'}`}
                className="flex items-center gap-3 min-w-0 flex-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-lg p-0.5"
              >
                <div className="w-12 shrink-0 text-center">
                  <span className="font-display font-bold tabular-nums tracking-tight whitespace-nowrap text-xs text-ink dark:text-white">
                    {formatTime(apt.start_time)}
                  </span>
                </div>

                <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${status.dot}`} />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink dark:text-white">
                    {apt.client_name || 'Cliente não informado'}
                  </p>
                  <p className="truncate text-xs text-ink-soft">
                    {getEsteticaDemoServiceName(apt.service_name, appSlug) || `${labels.service} não informado`}
                    {apt.staff_name && (
                      <>
                        <span className="mx-1.5">•</span>
                        <span className="font-medium text-primary-dark dark:text-primary-light">
                          Prof: {apt.staff_name}
                        </span>
                      </>
                    )}
                  </p>
                </div>

                <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${status.bg} ${status.border} ${status.text} shrink-0`}>
                  {appointmentStatusLabels[apt.status as keyof typeof appointmentStatusLabels] || 'Pendente'}
                </span>
              </button>

              {/* Botão de WhatsApp Rápido */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedWhatsAppAppointment(apt);
                }}
                title={apt.client_phone ? `Enviar WhatsApp para ${apt.client_name}` : 'Cliente sem telefone'}
                aria-label={`Enviar mensagem WhatsApp para ${apt.client_name || 'cliente'}`}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line dark:border-border-dark bg-card dark:bg-card-dark text-emerald-600 dark:text-emerald-400 hover:border-emerald-500/40 hover:bg-emerald-500/10 transition-all touch-manipulation"
              >
                <span className="material-symbols-outlined text-base">chat</span>
              </button>
            </div>
          );
        })}
      </div>

      <WhatsAppModal
        isOpen={Boolean(selectedWhatsAppAppointment)}
        onClose={() => setSelectedWhatsAppAppointment(null)}
        appointment={selectedWhatsAppAppointment}
        businessName={businessName}
      />
    </div>
  );
};

export default DayTimeline;