/**
 * barberStatement.ts
 * Utilitário puro de lógica para o Extrato Instantâneo de Comissões e Produtividade do Barbeiro (Fase 7.1).
 * Calcula dois saldos (Comissão Confirmada vs Comissão a Liberar/Prevista), Produção Bruta,
 * Contagem de Atendimentos e Ticket Médio, além dos intervalos de períodos de apuração.
 */

export interface BarberStatementItem {
  id: string;
  comandaId?: string | null;
  appointmentId?: string | null;
  createdAt: string;
  clientName: string;
  itemName: string;
  itemType: 'service' | 'product';
  grossValue: number;
  commissionRate: number; // Percentual 0..100 (ex: 50 = 50%)
  commissionValue: number;
  comandaStatus: 'open' | 'paid' | 'cancelled' | 'blocked' | 'scheduled' | 'in_progress' | 'completed' | string;
  isPaid: boolean;
}

export interface BarberStatementSummary {
  confirmedCommission: number; // Comandas pagas
  pendingCommission: number; // Comandas abertas / a liberar
  totalCommission: number; // Confirmada + Prevista
  grossProduction: number; // Produção bruta total gerada
  totalItems: number; // Quantidade de itens atendidos
  totalComandas: number; // Quantidade de comandas únicas
  averageTicket: number; // Produção bruta / total de comandas
}

export type StatementPeriod = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

export const STATEMENT_PERIOD_LABELS: Record<StatementPeriod, string> = {
  today: 'Hoje',
  yesterday: 'Ontem',
  week: 'Esta Semana',
  month: 'Este Mês',
  custom: 'Personalizado',
};

/**
 * 1. Calcula o resumo financeiro consolidado do extrato do barbeiro.
 * Segrega saldos entre Confirmado (comanda paga) e Previsto (comanda aberta).
 * Ignora itens de comandas canceladas.
 */
export function calculateBarberStatementSummary(
  items: BarberStatementItem[]
): BarberStatementSummary {
  if (!items || items.length === 0) {
    return {
      confirmedCommission: 0,
      pendingCommission: 0,
      totalCommission: 0,
      grossProduction: 0,
      totalItems: 0,
      totalComandas: 0,
      averageTicket: 0,
    };
  }

  let confirmedCommission = 0;
  let pendingCommission = 0;
  let grossProduction = 0;
  let validItemsCount = 0;
  const uniqueComandas = new Set<string>();

  for (const item of items) {
    if (item.comandaStatus === 'cancelled') continue;

    validItemsCount += 1;
    if (item.comandaId) {
      uniqueComandas.add(item.comandaId);
    } else if (item.appointmentId) {
      uniqueComandas.add(`appt-${item.appointmentId}`);
    } else if (item.id) {
      uniqueComandas.add(item.id);
    }

    const itemGross = Number.isFinite(item.grossValue) && item.grossValue > 0 ? item.grossValue : 0;
    const itemCommission =
      Number.isFinite(item.commissionValue) && item.commissionValue > 0
        ? item.commissionValue
        : (itemGross * (item.commissionRate || 0)) / 100;

    grossProduction += itemGross;

    if (item.isPaid || item.comandaStatus === 'paid') {
      confirmedCommission += itemCommission;
    } else {
      pendingCommission += itemCommission;
    }
  }

  const totalComandas = uniqueComandas.size || (validItemsCount > 0 ? 1 : 0);
  const averageTicket =
    totalComandas > 0 ? Math.round((grossProduction / totalComandas) * 100) / 100 : 0;

  return {
    confirmedCommission: Math.round(confirmedCommission * 100) / 100,
    pendingCommission: Math.round(pendingCommission * 100) / 100,
    totalCommission: Math.round((confirmedCommission + pendingCommission) * 100) / 100,
    grossProduction: Math.round(grossProduction * 100) / 100,
    totalItems: validItemsCount,
    totalComandas,
    averageTicket,
  };
}

/**
 * 2. Retorna o intervalo de datas (início e fim em YYYY-MM-DD) para cada período pré-definido.
 */
export function getDateRangeForStatementPeriod(
  period: StatementPeriod,
  referenceDate: Date = new Date(),
  customRange?: { startDate: string; endDate: string }
): { startDate: string; endDate: string } {
  if (period === 'custom' && customRange?.startDate && customRange?.endDate) {
    return {
      startDate: customRange.startDate,
      endDate: customRange.endDate,
    };
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  const formatYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const current = new Date(referenceDate);

  if (period === 'today') {
    const todayStr = formatYMD(current);
    return { startDate: todayStr, endDate: todayStr };
  }

  if (period === 'yesterday') {
    const yest = new Date(current);
    yest.setDate(yest.getDate() - 1);
    const yestStr = formatYMD(yest);
    return { startDate: yestStr, endDate: yestStr };
  }

  if (period === 'week') {
    // Semana começando na segunda-feira
    const day = current.getDay(); // 0 = Domingo, 1 = Segunda ...
    const diffToMonday = day === 0 ? 6 : day - 1;

    const startOfWeek = new Date(current);
    startOfWeek.setDate(current.getDate() - diffToMonday);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    return {
      startDate: formatYMD(startOfWeek),
      endDate: formatYMD(endOfWeek),
    };
  }

  if (period === 'month') {
    const startOfMonth = new Date(current.getFullYear(), current.getMonth(), 1);
    const endOfMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0);

    return {
      startDate: formatYMD(startOfMonth),
      endDate: formatYMD(endOfMonth),
    };
  }

  const fallbackStr = formatYMD(current);
  return { startDate: fallbackStr, endDate: fallbackStr };
}
