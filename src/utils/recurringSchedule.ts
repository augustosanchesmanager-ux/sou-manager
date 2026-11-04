/**
 * recurringSchedule.ts
 * Lógica pura para projeção e cálculo de agendamentos recorrentes / "Cadeira Cativa" (Fase 7.1).
 * Suporta frequências semanal (7d), quinzenal (14d), mensal (28d) e customizada (X dias).
 * Gera as datas futuras projetadas com status pendente de confirmação semanal via WhatsApp.
 */

export type RecurrenceFrequency = 'weekly' | 'biweekly' | 'monthly' | 'custom';

export interface ProjectedDateItem {
  index: number;
  date: string; // YYYY-MM-DD
  formattedDate: string; // Ex: "Qui, 12/11/2026"
  dayOfWeek: string; // Ex: "Quinta-feira"
  status: 'scheduled' | 'pending';
  isFirst: boolean;
  label: string;
}

const DAYS_OF_WEEK = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

const DAYS_OF_WEEK_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/**
 * 1. Retorna o intervalo em dias para uma determinada frequência.
 */
export function getIntervalDays(frequency: RecurrenceFrequency, customDays?: number): number {
  switch (frequency) {
    case 'weekly':
      return 7;
    case 'biweekly':
      return 14;
    case 'monthly':
      // 28 dias preserva o mesmo dia da semana (ex: sempre quinta-feira a cada 4 semanas)
      return 28;
    case 'custom':
      return Math.max(1, Number.isFinite(customDays) && (customDays as number) > 0 ? (customDays as number) : 7);
    default:
      return 7;
  }
}

/**
 * 2. Converte YYYY-MM-DD em objeto Date local sem deslocamento de timezone.
 */
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
}

/**
 * 3. Formata objeto Date em string YYYY-MM-DD local.
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 4. Calcula e projeta as datas futuras da série da Cadeira Cativa.
 */
export function calculateProjectedDates(params: {
  startDateStr?: string;
  startDate?: string | Date;
  frequency: RecurrenceFrequency;
  occurrences?: number;
  customDays?: number;
  customIntervalDays?: number;
  endDateStr?: string;
  endDate?: string | Date;
  maxOccurrences?: number;
}): ProjectedDateItem[] {
  const {
    frequency,
    occurrences = 4,
    maxOccurrences = 24,
  } = params;

  let startStr = params.startDateStr;
  if (!startStr && params.startDate) {
    if (params.startDate instanceof Date) {
      startStr = formatLocalDate(params.startDate);
    } else {
      startStr = String(params.startDate);
    }
  }

  let endStr = params.endDateStr;
  if (!endStr && params.endDate) {
    if (params.endDate instanceof Date) {
      endStr = formatLocalDate(params.endDate);
    } else {
      endStr = String(params.endDate);
    }
  }

  const effectiveCustomDays = params.customDays ?? params.customIntervalDays;

  if (!startStr || !/^\d{4}-\d{2}-\d{2}$/.test(startStr)) {
    return [];
  }

  const intervalDays = getIntervalDays(frequency, effectiveCustomDays);
  const baseDate = parseLocalDate(startStr);
  const effectiveMax = Math.min(Math.max(1, occurrences), maxOccurrences);
  const parsedEndDate = endStr && /^\d{4}-\d{2}-\d{2}$/.test(endStr) ? parseLocalDate(endStr) : null;

  const results: ProjectedDateItem[] = [];

  for (let i = 0; i < effectiveMax; i++) {
    const nextDate = new Date(baseDate);
    nextDate.setDate(baseDate.getDate() + i * intervalDays);

    if (parsedEndDate && nextDate.getTime() > parsedEndDate.getTime() && i > 0) {
      break;
    }

    const dateString = formatLocalDate(nextDate);
    const dayOfWeekIndex = nextDate.getDay();
    const dayOfWeek = DAYS_OF_WEEK[dayOfWeekIndex];
    const dayOfWeekShort = DAYS_OF_WEEK_SHORT[dayOfWeekIndex];
    const day = String(nextDate.getDate()).padStart(2, '0');
    const month = String(nextDate.getMonth() + 1).padStart(2, '0');
    const year = nextDate.getFullYear();

    const isFirst = i === 0;
    const status: 'scheduled' | 'pending' = isFirst ? 'scheduled' : 'pending';
    const label = isFirst
      ? '1ª data (Agendamento Base)'
      : `${i + 1}ª data (Cadeira Cativa a confirmar)`;

    results.push({
      index: i,
      date: dateString,
      formattedDate: `${dayOfWeekShort}, ${day}/${month}/${year}`,
      dayOfWeek,
      status,
      isFirst,
      label,
    });
  }

  return results;
}

/**
 * 5. Sanitiza o telefone celular para o link do WhatsApp (DDI 55 se brasileiro).
 */
export function sanitizePhoneForWhatsApp(phone: string): string {
  if (!phone) return '';
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';

  if (trimmed.startsWith('+')) return digits;
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

/**
 * 6. Gera a mensagem de WhatsApp para confirmar a cadeira cativa da semana.
 */
export function generateCativaConfirmationMessage(params: {
  clientName: string;
  shopName?: string;
  dateStr: string; // YYYY-MM-DD
  timeStr: string; // Ex: "18:00"
  barberName?: string;
}): string {
  const { clientName, shopName, dateStr, timeStr, barberName } = params;

  const rawFirstName = clientName ? clientName.trim().split(' ')[0] : '';
  const firstName = rawFirstName || 'amigo';
  const shop = shopName?.trim() ? `da ${shopName.trim()}` : 'da barbearia';
  const barber = barberName?.trim() ? ` com o barbeiro ${barberName.trim()}` : '';

  let dateFormatted = dateStr;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const d = parseLocalDate(dateStr);
    const dayOfWeek = DAYS_OF_WEEK_SHORT[d.getDay()];
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    dateFormatted = `${dayOfWeek}, ${day}/${month}`;
  }

  return `Olá, ${firstName}! Tudo bem? Aqui é ${shop}.\n\nPassando para confirmar o seu horário fixo de Cadeira Cativa nesta semana: *${dateFormatted} às ${timeStr}*${barber}.\n\nPodemos confirmar o seu horário? 💈✂️`;
}

/**
 * 7. Constrói o link oficial do WhatsApp (wa.me) para confirmação de cadeira cativa.
 */
export function buildCativaWhatsAppUrl(phone: string, message: string): string {
  const cleanPhone = sanitizePhoneForWhatsApp(phone);
  if (!cleanPhone) return '';
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}
