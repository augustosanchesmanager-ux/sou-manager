/**
 * clientProfile.ts
 * Utilitário puro de lógica para o Perfil 360° do Cliente e Fidelização (Fase 7.1).
 * Inclui cálculo analítico de barbeiro preferido, ticket médio, próxima data
 * de horário fixo (cadeira cativa) e formatação de preferências.
 */

import type { PreferredFrequency } from '../../domain/client/types';

export interface ServiceHistoryEntry {
  staffId: string | null;
  staffName?: string | null;
  staffAvatar?: string | null;
}

export interface PreferredBarberSummary {
  staffId: string;
  name: string;
  avatar: string;
  serviceCount: number;
}

export const WEEKDAY_LABELS: Record<number, { short: string; full: string }> = {
  1: { short: 'Seg', full: 'Segunda-feira' },
  2: { short: 'Ter', full: 'Terça-feira' },
  3: { short: 'Qua', full: 'Quarta-feira' },
  4: { short: 'Qui', full: 'Quinta-feira' },
  5: { short: 'Sex', full: 'Sexta-feira' },
  6: { short: 'Sáb', full: 'Sábado' },
  7: { short: 'Dom', full: 'Domingo' },
};

export const FREQUENCY_LABELS: Record<PreferredFrequency, string> = {
  weekly: 'Semanal',
  biweekly: 'Quinzenal',
  monthly: 'Mensal',
};

/**
 * 1. Apura dinamicamente o barbeiro preferido com base no histórico de serviços/atendimentos.
 * Retorna o profissional com maior número de atendimentos ou null se não houver histórico.
 */
export function calculatePreferredBarber(
  history: ServiceHistoryEntry[]
): PreferredBarberSummary | null {
  if (!history || history.length === 0) return null;

  const countMap = new Map<string, { count: number; name: string; avatar: string }>();

  for (const entry of history) {
    if (!entry.staffId) continue;
    const existing = countMap.get(entry.staffId);
    if (existing) {
      existing.count += 1;
      if (!existing.name && entry.staffName) existing.name = entry.staffName;
      if (!existing.avatar && entry.staffAvatar) existing.avatar = entry.staffAvatar;
    } else {
      countMap.set(entry.staffId, {
        count: 1,
        name: entry.staffName || 'Barbeiro',
        avatar: entry.staffAvatar || '',
      });
    }
  }

  if (countMap.size === 0) return null;

  let bestStaffId = '';
  let bestData = { count: 0, name: '', avatar: '' };

  for (const [staffId, data] of countMap.entries()) {
    if (data.count > bestData.count) {
      bestStaffId = staffId;
      bestData = data;
    }
  }

  return {
    staffId: bestStaffId,
    name: bestData.name,
    avatar: bestData.avatar,
    serviceCount: bestData.count,
  };
}

/**
 * 2. Calcula o ticket médio individual por visita.
 * Se o número de visitas for zero mas houver total gasto, retorna o total.
 */
export function calculateAverageTicket(totalSpent: number, visitsCount: number): number {
  const safeSpent = Number.isFinite(totalSpent) && totalSpent > 0 ? totalSpent : 0;
  if (visitsCount <= 0) return safeSpent;
  return Math.round((safeSpent / visitsCount) * 100) / 100;
}

/**
 * 3. Calcula a próxima data correspondente ao dia da semana ISO informado (1 = Seg ... 7 = Dom).
 * Se o dia for hoje, agenda para a próxima ocorrência (7 dias à frente), garantindo sempre data futura.
 */
export function calculateNextPreferredDate(
  preferredWeekday: number,
  referenceDate: Date = new Date()
): string {
  if (!Number.isInteger(preferredWeekday) || preferredWeekday < 1 || preferredWeekday > 7) {
    return referenceDate.toISOString().split('T')[0];
  }

  const jsDay = referenceDate.getDay(); // 0 = Domingo, 1 = Segunda ... 6 = Sábado
  const currentIsoWeekday = jsDay === 0 ? 7 : jsDay;

  let daysAhead = preferredWeekday - currentIsoWeekday;
  if (daysAhead <= 0) {
    daysAhead += 7; // Próxima semana
  }

  const targetDate = new Date(referenceDate);
  targetDate.setDate(targetDate.getDate() + daysAhead);

  const year = targetDate.getFullYear();
  const month = String(targetDate.getMonth() + 1).padStart(2, '0');
  const day = String(targetDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 4. Formata a descrição resumida da cadeira cativa / horário fixo.
 * Ex: "Semanal • Sexta-feira às 18:00"
 */
export function formatPreferredScheduleSummary(params: {
  frequency?: PreferredFrequency | null;
  weekday?: number | null;
  time?: string | null;
  staffName?: string | null;
}): string {
  const { frequency, weekday, time, staffName } = params;
  if (!frequency || !weekday) {
    return 'Sem horário fixo definido';
  }

  const freqLabel = FREQUENCY_LABELS[frequency] || frequency;
  const dayLabel = WEEKDAY_LABELS[weekday]?.full || `Dia ${weekday}`;
  const timeLabel = time ? ` às ${time}` : '';
  const proLabel = staffName ? ` com ${staffName}` : '';

  return `${freqLabel} • ${dayLabel}${timeLabel}${proLabel}`;
}
