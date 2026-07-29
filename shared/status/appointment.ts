/**
 * [SMG][SHARED][STATUS] appointment
 *
 * Status de agendamentos: labels, ícones, cores, normalização.
 * Substitui definições em Schedule.tsx, OperationSuccess.tsx, AppointmentTimeline.tsx,
 * NextAppointmentCard.tsx, AppointmentDetailModal.tsx.
 *
 * Canonical source: pages/Schedule.tsx:155
 */

export interface AppointmentStatusMeta {
  label: string;
  icon: string;
  badge: string;
}

export type AppointmentStatus =
  | 'scheduled'
  | 'pending'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';

/**
 * Metadados completos de status de agendamento.
 * Inclui label em pt-BR, ícone Material e classes de badge (light + dark).
 */
export const appointmentStatusMeta: Record<
  AppointmentStatus | string,
  AppointmentStatusMeta
> = {
  scheduled: {
    label: 'Agendado',
    icon: 'event',
    badge:
      'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  },
  pending: {
    label: 'Pendente',
    icon: 'schedule',
    badge:
      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  },
  confirmed: {
    label: 'Confirmado',
    icon: 'check_circle',
    badge:
      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  },
  in_progress: {
    label: 'Em atendimento',
    icon: 'content_cut',
    badge:
      'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  },
  completed: {
    label: 'Finalizado',
    icon: 'task_alt',
    badge:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  },
  cancelled: {
    label: 'Cancelado',
    icon: 'cancel',
    badge:
      'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  },
  no_show: {
    label: 'Não compareceu',
    icon: 'person_off',
    badge:
      'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  },
};

/**
 * Normaliza um status para o formato canônico.
 * Mapeia variações como "waiting" → "pending", "done" → "completed".
 */
export const normalizeAppointmentStatus = (
  status: string | null | undefined,
): AppointmentStatus | string => {
  if (!status) return 'scheduled';
  const normalized = status.toLowerCase().trim();
  const aliasMap: Record<string, AppointmentStatus> = {
    waiting: 'pending',
    agendado: 'scheduled',
    pendente: 'pending',
    confirmado: 'confirmed',
    em_atendimento: 'in_progress',
    'em atendimento': 'in_progress',
    finalizado: 'completed',
    concluido: 'completed',
    cancelado: 'cancelled',
  };
  return aliasMap[normalized] || normalized;
};

/**
 * Busca metadados completos de um status.
 * Retorna label, ícone e badge. Suporta override para Estética app.
 */
export const getAppointmentStatusMeta = (
  status: string | null | undefined,
  isEsteticaApp = false,
): AppointmentStatusMeta & { normalized: string } => {
  const normalized = normalizeAppointmentStatus(status);
  const meta = appointmentStatusMeta[normalized] || {
    label: normalized,
    icon: 'help',
    badge: 'bg-slate-100 text-slate-700',
  };
  return {
    normalized,
    ...meta,
    label:
      isEsteticaApp && normalized === 'completed' ? 'Concluído' : meta.label,
  };
};

/**
 * Cores de dot para status de agendamento.
 */
export const appointmentDotColors: Record<string, string> = {
  confirmed: 'bg-blue-500',
  pending: 'bg-amber-500',
  completed: 'bg-emerald-500',
  in_progress: 'bg-sky-500',
  scheduled: 'bg-slate-400',
  cancelled: 'bg-rose-500',
  no_show: 'bg-slate-400',
};

/**
 * Labels de status de agendamento (para filtros/selects).
 */
export const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  scheduled: 'Agendado',
  pending: 'Pendente',
  confirmed: 'Confirmado',
  in_progress: 'Em atendimento',
  completed: 'Finalizado',
  cancelled: 'Cancelado',
  no_show: 'Não compareceu',
};

/**
 * Retorna label de status de agendamento.
 */
export const getAppointmentStatusLabel = (
  status: string,
  isEsteticaApp?: boolean,
): string => {
  const normalized = normalizeAppointmentStatus(status);
  const label = appointmentStatusLabels[normalized] || status;
  return isEsteticaApp && normalized === 'completed' ? 'Concluído' : label;
};

/**
 * Verifica se um valor é um AppointmentStatus válido.
 */
export const isAppointmentStatus = (value: string): value is AppointmentStatus =>
  value in appointmentStatusMeta;
