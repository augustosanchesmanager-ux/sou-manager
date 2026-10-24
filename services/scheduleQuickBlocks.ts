/**
 * Presets de Bloqueio Rápido na Agenda (Frente 1.B - Subfase 7.1)
 *
 * Fornece presets de 1 clique ("Pausa 15m", "Pausa 30m", "Almoço 1h", "Folga Hoje")
 * com cálculo rigoroso de horários e detecção preventiva de conflitos
 * contra agendamentos ativos na grade da barbearia.
 */

export interface QuickBlockAppointmentTarget {
  id: string;
  staffId: string;
  date?: string;
  start?: number;
  duration?: number;
  status: string;
  client?: string;
  service?: string;
  phone?: string;
  price?: number;
}

export type QuickBlockPresetId = 'pausa_15' | 'pausa_30' | 'almoco_1h' | 'folga_hoje';

export interface QuickBlockPreset {
  id: QuickBlockPresetId;
  label: string;
  durationMinutes: number | null; // null se for o dia todo ('folga_hoje')
  defaultReason: string;
  blockType: 'interval' | 'full_day';
  description: string;
}

export const QUICK_BLOCK_PRESETS: readonly QuickBlockPreset[] = [
  {
    id: 'pausa_15',
    label: 'Pausa 15m',
    durationMinutes: 15,
    defaultReason: 'Pausa rápida (15m)',
    blockType: 'interval',
    description: 'Bloqueia 15 minutos a partir do horário selecionado',
  },
  {
    id: 'pausa_30',
    label: 'Pausa 30m',
    durationMinutes: 30,
    defaultReason: 'Pausa (30m)',
    blockType: 'interval',
    description: 'Bloqueia 30 minutos a partir do horário selecionado',
  },
  {
    id: 'almoco_1h',
    label: 'Almoço 1h',
    durationMinutes: 60,
    defaultReason: 'Almoço',
    blockType: 'interval',
    description: 'Bloqueia 1 hora para almoço a partir do horário selecionado',
  },
  {
    id: 'folga_hoje',
    label: 'Folga Hoje',
    durationMinutes: null,
    defaultReason: 'Folga / Ausência no dia',
    blockType: 'full_day',
    description: 'Bloqueia o dia inteiro do profissional selecionado',
  },
] as const;

/**
 * Converte hora decimal (ex: 14.5) para string 'HH:mm' (ex: '14:30').
 */
export function decimalHourToTimeString(decimal: number): string {
  const totalMinutes = Math.round(decimal * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Converte string 'HH:mm' para hora decimal (ex: '14:30' -> 14.5).
 */
export function timeStringToDecimalHour(timeStr: string): number {
  const [h, m] = timeStr.split(':').map((v) => parseInt(v, 10) || 0);
  return h + m / 60;
}

/**
 * Adiciona minutos a uma string 'HH:mm', travando em 23:59 se exceder o dia.
 */
export function addMinutesToTimeString(timeStr: string, minutesToAdd: number): string {
  const [h, m] = timeStr.split(':').map((v) => parseInt(v, 10) || 0);
  const totalMinutes = h * 60 + m + minutesToAdd;
  const clamped = Math.min(totalMinutes, 23 * 60 + 59);
  const finalH = Math.floor(clamped / 60);
  const finalM = clamped % 60;
  return `${String(finalH).padStart(2, '0')}:${String(finalM).padStart(2, '0')}`;
}

/**
 * Retorna o horário atual no fuso horário 'America/Sao_Paulo' no formato 'HH:mm'.
 * Se baseDate for fornecido, extrai o horário local daquela data.
 */
export function getSaoPauloCurrentTime(baseDate: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(baseDate);
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '08';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
}

/**
 * Arredonda um horário 'HH:mm' para o próximo múltiplo de 15 minutos.
 * Ex: '14:03' -> '14:15', '14:15' -> '14:15', '14:52' -> '15:00'.
 */
export function roundTimeToNextSlot(timeStr: string, slotMinutes: number = 15): string {
  const [h, m] = timeStr.split(':').map((v) => parseInt(v, 10) || 0);
  const totalMinutes = h * 60 + m;
  const rounded = Math.ceil(totalMinutes / slotMinutes) * slotMinutes;
  const clamped = Math.min(rounded, 23 * 60 + 45);
  const finalH = Math.floor(clamped / 60);
  const finalM = clamped % 60;
  return `${String(finalH).padStart(2, '0')}:${String(finalM).padStart(2, '0')}`;
}

export interface CalculatedPresetTimes {
  startTime: string;
  endTime: string;
  blockType: 'interval' | 'full_day';
  reason: string;
  preset: QuickBlockPreset;
}

/**
 * Calcula os horários de início e fim para um preset rápido.
 * @param presetId ID do preset ('pausa_15', 'pausa_30', 'almoco_1h', 'folga_hoje')
 * @param referenceTime Horário base em 'HH:mm'. Se não informado ou vazio, usa o horário atual de SP arredondado.
 * @param businessStartInMinutes Horário de abertura da loja (padrão 8h = 480m)
 * @param businessEndInMinutes Horário de fechamento da loja (padrão 20h = 1200m)
 */
export function calculatePresetTimes(
  presetId: QuickBlockPresetId,
  referenceTime?: string,
  businessStartInMinutes: number = 8 * 60,
  businessEndInMinutes: number = 20 * 60
): CalculatedPresetTimes {
  const preset = QUICK_BLOCK_PRESETS.find((p) => p.id === presetId);
  if (!preset) {
    throw new Error(`Preset desconhecido: ${presetId}`);
  }

  if (preset.blockType === 'full_day') {
    const startH = Math.floor(businessStartInMinutes / 60);
    const startM = businessStartInMinutes % 60;
    const endH = Math.floor(businessEndInMinutes / 60);
    const endM = businessEndInMinutes % 60;

    return {
      startTime: `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`,
      endTime: `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`,
      blockType: 'full_day',
      reason: preset.defaultReason,
      preset,
    };
  }

  const base = referenceTime && referenceTime.trim() !== ''
    ? referenceTime
    : roundTimeToNextSlot(getSaoPauloCurrentTime());

  const duration = preset.durationMinutes ?? 30;
  const calculatedEnd = addMinutesToTimeString(base, duration);

  return {
    startTime: base,
    endTime: calculatedEnd,
    blockType: 'interval',
    reason: preset.defaultReason,
    preset,
  };
}

export interface ConflictDetail {
  appointmentId: string;
  clientName: string;
  serviceName: string;
  startTimeFormatted: string;
  endTimeFormatted: string;
  status: string;
}

export interface ConflictCheckResult {
  hasConflict: boolean;
  conflictingAppointments: ConflictDetail[];
  summaryMessage: string | null;
}

/**
 * Verifica se um bloqueio colide com agendamentos ativos do profissional no dia.
 * Agendamentos cancelados ou no-show são ignorados.
 *
 * @param appointments Lista de agendamentos carregados na grade
 * @param professionalId ID do barbeiro/staff
 * @param targetDate Data no formato 'YYYY-MM-DD'
 * @param blockType 'interval' ou 'full_day'
 * @param startTime Horário inicial em 'HH:mm'
 * @param endTime Horário final em 'HH:mm'
 */
export function detectPresetAppointmentConflicts(
  appointments: QuickBlockAppointmentTarget[],
  professionalId: string,
  targetDate: string,
  blockType: 'interval' | 'full_day',
  startTime: string,
  endTime: string
): ConflictCheckResult {
  const targetDateClean = targetDate.split('T')[0];

  // Filtra agendamentos ativos para o profissional na data
  const relevantAppointments = appointments.filter((apt) => {
    if (apt.staffId !== professionalId) return false;
    const aptDateClean = (apt.date || '').split('T')[0];
    if (aptDateClean !== targetDateClean) return false;

    // Ignora status cancelado ou no-show
    const status = (apt.status || '').toLowerCase();
    if (status === 'cancelled' || status === 'canceled' || status === 'no_show') {
      return false;
    }

    return true;
  });

  const conflicts: ConflictDetail[] = [];

  if (blockType === 'full_day') {
    // Se for o dia todo, qualquer agendamento ativo é conflito
    for (const apt of relevantAppointments) {
      const aptStartDec = apt.start ?? 0;
      const aptDurDec = apt.duration ?? 0.5;
      const aptEndDec = aptStartDec + aptDurDec;

      conflicts.push({
        appointmentId: apt.id,
        clientName: apt.client || 'Cliente não identificado',
        serviceName: apt.service || 'Serviço',
        startTimeFormatted: decimalHourToTimeString(aptStartDec),
        endTimeFormatted: decimalHourToTimeString(aptEndDec),
        status: apt.status,
      });
    }
  } else {
    // Intervalo específico: checa sobreposição
    const blockStartDec = timeStringToDecimalHour(startTime);
    const blockEndDec = timeStringToDecimalHour(endTime);

    for (const apt of relevantAppointments) {
      const aptStartDec = apt.start ?? 0;
      const aptDurDec = apt.duration ?? 0.5;
      const aptEndDec = aptStartDec + aptDurDec;

      // Há sobreposição se: blockStart < aptEnd && blockEnd > aptStart
      const overlaps = blockStartDec < aptEndDec && blockEndDec > aptStartDec;

      if (overlaps) {
        conflicts.push({
          appointmentId: apt.id,
          clientName: apt.client || 'Cliente não identificado',
          serviceName: apt.service || 'Serviço',
          startTimeFormatted: decimalHourToTimeString(aptStartDec),
          endTimeFormatted: decimalHourToTimeString(aptEndDec),
          status: apt.status,
        });
      }
    }
  }

  if (conflicts.length === 0) {
    return {
      hasConflict: false,
      conflictingAppointments: [],
      summaryMessage: null,
    };
  }

  // Monta mensagem amigável de impedimento
  const count = conflicts.length;
  const clientList = conflicts
    .map((c) => `• ${c.clientName} (${c.serviceName}) às ${c.startTimeFormatted} - ${c.endTimeFormatted}`)
    .join('\n');

  const summary =
    count === 1
      ? `Conflito com 1 agendamento ativo:\n${clientList}\nCancele ou remarque o cliente antes de bloquear este horário.`
      : `Conflito com ${count} agendamentos ativos:\n${clientList}\nCancele ou remarque os clientes antes de bloquear este horário.`;

  return {
    hasConflict: true,
    conflictingAppointments: conflicts,
    summaryMessage: summary,
  };
}
