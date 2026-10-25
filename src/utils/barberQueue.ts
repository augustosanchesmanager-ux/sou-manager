/**
 * [SMG][UTILS] barberQueue
 *
 * Funções puras para organização da fila de atendimento do barbeiro (Modo Cadeira Móvel).
 * Responsabilidades:
 *  - Classificação atômica de agendamentos em: Na Cadeira (in_progress), A Seguir (next),
 *    Fila do Dia (upcoming), Concluídos (completed) e Cancelados (cancelled).
 *  - Resolução de ação primária contextual com 1 toque por estado.
 *  - Formatação amigável de tempo decorrido do corte.
 *  - Validação pura de formulário de encaixe rápido walk-in.
 */

export interface QueueAppointment {
  id: string;
  clientId?: string | null;
  staffId: string;
  staffName: string;
  serviceId?: string | null;
  service: string;
  client: string;
  clientPhone?: string;
  start: number;
  duration: number;
  startTime: string;
  status: string;
  price?: number;
  notes?: string;
  date?: string;
  source?: string | null;
  channel?: string | null;
  isOverbooked?: boolean;
  attendedAt?: string | null;
}

export interface ChairQueueClassification {
  inProgress: QueueAppointment | null;
  next: QueueAppointment | null;
  upcoming: QueueAppointment[];
  completed: QueueAppointment[];
  cancelled: QueueAppointment[];
  metrics: {
    total: number;
    completedCount: number;
    inProgressCount: number;
    waitingCount: number;
    cancelledCount: number;
  };
}

export interface RecommendedAction {
  actionKey: 'start' | 'finish' | 'view_comanda' | 'none';
  label: string;
  icon: string;
  variant: 'primary' | 'success' | 'amber' | 'neutral';
}

/**
 * Classifica a lista de agendamentos para a visualização da cadeira do barbeiro.
 */
export function classifyChairQueue(
  appointments: QueueAppointment[],
  professionalId?: string | null,
): ChairQueueClassification {
  const filtered = appointments.filter((apt) => {
    if (!professionalId || professionalId === 'all') return true;
    return apt.staffId === professionalId;
  });

  const inProgressList: QueueAppointment[] = [];
  const waitingList: QueueAppointment[] = [];
  const completedList: QueueAppointment[] = [];
  const cancelledList: QueueAppointment[] = [];

  for (const apt of filtered) {
    if (apt.status === 'in_progress') {
      inProgressList.push(apt);
    } else if (apt.status === 'confirmed' || apt.status === 'pending' || apt.status === 'scheduled') {
      waitingList.push(apt);
    } else if (apt.status === 'completed') {
      completedList.push(apt);
    } else if (apt.status === 'cancelled' || apt.status === 'no_show') {
      cancelledList.push(apt);
    }
  }

  // Ordenar por horário de início
  const sortByTime = (a: QueueAppointment, b: QueueAppointment) => {
    return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
  };

  inProgressList.sort(sortByTime);
  waitingList.sort(sortByTime);
  completedList.sort(sortByTime);
  cancelledList.sort(sortByTime);

  const inProgress = inProgressList[0] || null;
  // Se houver mais de um in_progress (anomalia de banco/estado), os demais vão para o topo dos aguardando
  const excessInProgress = inProgressList.slice(1);
  const combinedWaiting = [...excessInProgress, ...waitingList];

  const next = combinedWaiting[0] || null;
  const upcoming = combinedWaiting.slice(1);

  return {
    inProgress,
    next,
    upcoming,
    completed: completedList,
    cancelled: cancelledList,
    metrics: {
      total: filtered.length,
      completedCount: completedList.length,
      inProgressCount: inProgress ? 1 + excessInProgress.length : 0,
      waitingCount: waitingList.length,
      cancelledCount: cancelledList.length,
    },
  };
}

/**
 * Determina a ação primária recomendada para a ergonomia de 1 toque no polegar.
 */
export function getRecommendedPrimaryAction(status: string): RecommendedAction {
  switch (status) {
    case 'in_progress':
      return {
        actionKey: 'finish',
        label: 'Finalizar Atendimento',
        icon: 'task_alt',
        variant: 'success',
      };
    case 'confirmed':
      return {
        actionKey: 'start',
        label: 'Iniciar Atendimento',
        icon: 'play_arrow',
        variant: 'primary',
      };
    case 'pending':
    case 'scheduled':
      return {
        actionKey: 'start',
        label: 'Iniciar Atendimento',
        icon: 'play_arrow',
        variant: 'amber',
      };
    case 'completed':
      return {
        actionKey: 'view_comanda',
        label: 'Ver Comanda',
        icon: 'receipt_long',
        variant: 'neutral',
      };
    case 'cancelled':
    case 'no_show':
    default:
      return {
        actionKey: 'none',
        label: '',
        icon: '',
        variant: 'neutral',
      };
  }
}

/**
 * Formata o tempo decorrido do corte de forma humanizada.
 */
export function formatElapsedTime(startTimeIso: string, referenceTime: Date = new Date()): string {
  const startMs = new Date(startTimeIso).getTime();
  if (isNaN(startMs)) return '';

  const diffMs = referenceTime.getTime() - startMs;
  const mins = Math.floor(diffMs / 60000);

  if (mins < 0) return 'Horário agendado';
  if (mins === 0) return 'Iniciado agora';
  if (mins < 60) return `Há ${mins} min`;

  const hours = Math.floor(mins / 60);
  const remMinutes = mins % 60;
  if (remMinutes === 0) return `Há ${hours}h`;
  return `Há ${hours}h ${remMinutes}m`;
}

/**
 * Validação pura dos dados de encaixe rápido na cadeira.
 */
export function validateWalkInForm(input: {
  clientName?: string;
  serviceId?: string;
  staffId?: string;
}): { isValid: boolean; error?: string } {
  if (!input.clientName || input.clientName.trim().length < 2) {
    return {
      isValid: false,
      error: 'Nome do cliente deve conter pelo menos 2 caracteres.',
    };
  }

  if (!input.serviceId || !input.serviceId.trim()) {
    return {
      isValid: false,
      error: 'Selecione um serviço para o atendimento.',
    };
  }

  if (!input.staffId || !input.staffId.trim()) {
    return {
      isValid: false,
      error: 'Profissional da cadeira é obrigatório.',
    };
  }

  return { isValid: true };
}
