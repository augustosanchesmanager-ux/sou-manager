/**
 * Utilitários de Filtros e KPIs de Comandas (Frente 1.C - Subfase 7.1)
 *
 * Fornece funções puras para:
 * 1. Cálculo de intervalos de datas no fuso 'America/Sao_Paulo' ("Hoje", "Ontem", "Esta Semana", "Este Mês")
 * 2. Filtragem composicional de comandas (Status, Período, Profissional, Busca textual)
 * 3. Cálculo em tempo real dos KPIs (Total Aberto, Total Liquidado, Ticket Médio)
 */

export type QuickPeriodPreset = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom' | 'all';

export type ComandaStatusFilter = 'all' | 'open' | 'paid' | 'cancelled' | 'blocked';

export interface DateRange {
  startDate: string; // 'YYYY-MM-DD'
  endDate: string;   // 'YYYY-MM-DD'
}

export interface ComandaFilterItem {
  id: string;
  staff_id?: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  product_id?: string | null;
  service_id?: string | null;
}

export interface ComandaFilterTarget {
  id: string;
  status: string;
  total: number;
  created_at: string;
  closed_at?: string | null;
  payment_method?: string | null;
  clients?: {
    name: string;
    avatar?: string;
    phone?: string | null;
  };
  staff?: {
    name: string;
  };
  staff_id?: string | null;
  staff_ids?: string[];
  staff_names?: string[];
  comanda_items?: ComandaFilterItem[];
}

export interface ComandaFilterCriteria {
  status: ComandaStatusFilter;
  dateFrom?: string; // 'YYYY-MM-DD'
  dateTo?: string;   // 'YYYY-MM-DD'
  staffId?: string;  // ID do profissional
  searchTerm?: string; // busca por cliente, telefone ou ID
}

export interface ComandaKpiSummary {
  openCount: number;
  openTotal: number;
  paidCount: number;
  paidTotal: number;
  cancelledCount: number;
  cancelledTotal: number;
  totalCount: number;
  averageTicket: number;
}

/**
 * Retorna as partes de data no fuso de São Paulo (YYYY, MM, DD).
 */
export function getSaoPauloDateParts(baseDate: Date = new Date()): { year: number; month: number; day: number } {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(baseDate);
  const year = parseInt(parts.find((p) => p.type === 'year')?.value || '2026', 10);
  const month = parseInt(parts.find((p) => p.type === 'month')?.value || '01', 10);
  const day = parseInt(parts.find((p) => p.type === 'day')?.value || '01', 10);
  return { year, month, day };
}

/**
 * Formata ano, mês e dia no formato 'YYYY-MM-DD'.
 */
export function formatYmd(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Calcula o intervalo de datas 'YYYY-MM-DD' para os presets no fuso de São Paulo.
 */
export function getQuickPeriodDateRange(preset: QuickPeriodPreset, now: Date = new Date()): DateRange {
  const spNow = getSaoPauloDateParts(now);
  // Data base de referência em UTC representando o dia em SP
  const todayDate = new Date(Date.UTC(spNow.year, spNow.month - 1, spNow.day));

  switch (preset) {
    case 'today': {
      const todayStr = formatYmd(spNow.year, spNow.month, spNow.day);
      return { startDate: todayStr, endDate: todayStr };
    }

    case 'yesterday': {
      const yesterday = new Date(todayDate);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const yParts = {
        year: yesterday.getUTCFullYear(),
        month: yesterday.getUTCMonth() + 1,
        day: yesterday.getUTCDate(),
      };
      const yesterdayStr = formatYmd(yParts.year, yParts.month, yParts.day);
      return { startDate: yesterdayStr, endDate: yesterdayStr };
    }

    case 'this_week': {
      // Início da semana (Segunda-feira) e fim (Domingo)
      const currentDayOfWeek = todayDate.getUTCDay(); // 0 = Domingo, 1 = Segunda, ...
      // Segunda-feira = 1. Se Domingo (0), distância = 6 dias atrás. Se Seg (1), dist = 0.
      const diffToMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;

      const monday = new Date(todayDate);
      monday.setUTCDate(monday.getUTCDate() - diffToMonday);

      const sunday = new Date(monday);
      sunday.setUTCDate(sunday.getUTCDate() + 6);

      return {
        startDate: formatYmd(monday.getUTCFullYear(), monday.getUTCMonth() + 1, monday.getUTCDate()),
        endDate: formatYmd(sunday.getUTCFullYear(), sunday.getUTCMonth() + 1, sunday.getUTCDate()),
      };
    }

    case 'this_month': {
      const firstDayStr = formatYmd(spNow.year, spNow.month, 1);
      // Último dia do mês
      const lastDayDate = new Date(Date.UTC(spNow.year, spNow.month, 0));
      const lastDayStr = formatYmd(spNow.year, spNow.month, lastDayDate.getUTCDate());
      return { startDate: firstDayStr, endDate: lastDayStr };
    }

    case 'all':
    case 'custom':
    default:
      return { startDate: '', endDate: '' };
  }
}

/**
 * Converte data 'YYYY-MM-DD' para objeto Date ajustado para 00:00:00 ou 23:59:59 em UTC.
 */
export function parseDateInputToUtcBoundary(dateStr: string, isEndOfDay: boolean = false): Date | null {
  if (!dateStr || !dateStr.includes('-')) return null;
  const [year, month, day] = dateStr.split('-').map((v) => parseInt(v, 10));
  if (!year || !month || !day) return null;

  if (isEndOfDay) {
    return new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
  }
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

/**
 * Filtra a lista de comandas de acordo com os critérios fornecidos.
 */
export function filterComandas<T extends ComandaFilterTarget>(
  comandas: T[],
  criteria: ComandaFilterCriteria
): T[] {
  const normalizedSearch = (criteria.searchTerm || '').trim().toLowerCase();
  const startBoundary = criteria.dateFrom ? parseDateInputToUtcBoundary(criteria.dateFrom, false) : null;
  const endBoundary = criteria.dateTo ? parseDateInputToUtcBoundary(criteria.dateTo, true) : null;

  return comandas.filter((comanda) => {
    // 1. Filtro por status
    if (criteria.status && criteria.status !== 'all') {
      const status = (comanda.status || '').toLowerCase();
      if (criteria.status === 'open' && status !== 'open') return false;
      if (criteria.status === 'paid' && status !== 'paid' && status !== 'closed') return false;
      if (criteria.status === 'cancelled' && status !== 'cancelled' && status !== 'canceled') return false;
      if (criteria.status === 'blocked' && status !== 'blocked') return false;
    }

    // 2. Filtro por período (baseado em created_at)
    if (startBoundary || endBoundary) {
      const createdAt = new Date(comanda.created_at);
      if (!Number.isNaN(createdAt.getTime())) {
        if (startBoundary && createdAt < startBoundary) return false;
        if (endBoundary && createdAt > endBoundary) return false;
      }
    }

    // 3. Filtro por profissional (staffId)
    if (criteria.staffId && criteria.staffId.trim() !== '') {
      const targetStaffId = criteria.staffId.trim();
      const hasDirectStaff = comanda.staff_id === targetStaffId;
      const hasInStaffIds = Array.isArray(comanda.staff_ids) && comanda.staff_ids.includes(targetStaffId);
      const hasInItems = Array.isArray(comanda.comanda_items) && comanda.comanda_items.some((item) => item.staff_id === targetStaffId);

      if (!hasDirectStaff && !hasInStaffIds && !hasInItems) {
        return false;
      }
    }

    // 4. Filtro por termo de busca (cliente, telefone, ID da comanda)
    if (normalizedSearch) {
      const clientName = (comanda.clients?.name || '').toLowerCase();
      const clientPhone = (comanda.clients?.phone || '').toLowerCase();
      const comandaId = (comanda.id || '').toLowerCase();
      const shortId = comandaId.slice(-6);

      const matchesClientName = clientName.includes(normalizedSearch);
      const matchesPhone = clientPhone.includes(normalizedSearch);
      const matchesId = comandaId.includes(normalizedSearch) || shortId.includes(normalizedSearch);

      if (!matchesClientName && !matchesPhone && !matchesId) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Calcula os KPIs agregados a partir de um conjunto de comandas.
 */
export function calculateComandaKpiSummary(comandas: ComandaFilterTarget[]): ComandaKpiSummary {
  let openCount = 0;
  let openTotal = 0;
  let paidCount = 0;
  let paidTotal = 0;
  let cancelledCount = 0;
  let cancelledTotal = 0;

  for (const comanda of comandas) {
    const status = (comanda.status || '').toLowerCase();
    const total = Number(comanda.total) || 0;

    if (status === 'open') {
      openCount++;
      openTotal += total;
    } else if (status === 'paid' || status === 'closed') {
      paidCount++;
      paidTotal += total;
    } else if (status === 'cancelled' || status === 'canceled') {
      cancelledCount++;
      cancelledTotal += total;
    }
  }

  const totalCount = comandas.length;
  // Ticket médio considerando comandas pagas ou abertas (ignora canceladas para métrica de consumo real)
  const nonCancelledComandas = comandas.filter((c) => {
    const s = (c.status || '').toLowerCase();
    return s !== 'cancelled' && s !== 'canceled';
  });
  const nonCancelledTotal = nonCancelledComandas.reduce((acc, c) => acc + (Number(c.total) || 0), 0);
  const averageTicket = nonCancelledComandas.length > 0 ? nonCancelledTotal / nonCancelledComandas.length : 0;

  return {
    openCount,
    openTotal: Math.round(openTotal * 100) / 100,
    paidCount,
    paidTotal: Math.round(paidTotal * 100) / 100,
    cancelledCount,
    cancelledTotal: Math.round(cancelledTotal * 100) / 100,
    totalCount,
    averageTicket: Math.round(averageTicket * 100) / 100,
  };
}
