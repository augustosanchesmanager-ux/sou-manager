import { getEffectiveCommissionRateForItem } from '../../lib/staff/roles';
import { calculateCommissionValue } from '../../../domain/commission/calculate';
import type {
  DateRegime,
  GoalContext,
  PerformanceDeltas,
  PerformanceTotals,
  PerformanceWindow,
  StaffPerformanceRecord,
  TenantGoal,
  TimelineGranularity,
  TimelinePoint,
} from './types';

/**
 * Limite de linhas por janela consultada. Quando atingido, a UI precisa dizer
 * que a foto do período é parcial (ver `truncated` em PerformanceResult).
 */
export const MAX_DISPLAY_RECORDS = 500;

const SAO_PAULO_TIME_ZONE = 'America/Sao_Paulo';
const MAX_WINDOW_DAYS = 10_000;

const SAO_PAULO_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: SAO_PAULO_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const pad2 = (value: number) => String(value).padStart(2, '0');

const parseYmd = (ymd: string): { y: number; m: number; d: number } | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  return { y, m, d };
};

export const addDays = (ymd: string, delta: number): string => {
  const parsed = parseYmd(ymd);
  if (!parsed) return ymd;
  const date = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d + delta));
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
};

export const enumerateDays = (from: string, to: string): string[] => {
  if (!parseYmd(from) || !parseYmd(to)) return [];
  const days: string[] = [];
  let cursor = from;
  while (cursor <= to && days.length < MAX_WINDOW_DAYS) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
};

const startOfDayMs = (ymd: string): number =>
  new Date(`${ymd}T00:00:00-03:00`).getTime();

const endOfDayMs = (ymd: string): number =>
  new Date(`${ymd}T23:59:59.999-03:00`).getTime();

export interface ResolvedWindow extends PerformanceWindow {
  fromMs: number;
  toMs: number;
}

/**
 * Resolve o recorte em dias contíguos. Devolve null quando as datas são
 * inválidas ou o intervalo é grande demais para ser desenhado com honestidade.
 */
export const resolveWindow = (
  dateFrom: string,
  dateTo: string,
): ResolvedWindow | null => {
  if (!parseYmd(dateFrom) || !parseYmd(dateTo)) return null;
  const [from, to] = dateFrom <= dateTo ? [dateFrom, dateTo] : [dateTo, dateFrom];
  const days = enumerateDays(from, to);
  if (days.length === 0) return null;
  const granularity: TimelineGranularity = days.length <= 31 ? 'day' : 'week';
  return {
    dateFrom: from,
    dateTo: to,
    days: days.length,
    granularity,
    fromMs: startOfDayMs(from),
    toMs: endOfDayMs(to),
  };
};

/** Janela anterior de mesma duração, terminando na véspera do recorte atual. */
export const resolvePreviousWindow = (
  window: PerformanceWindow,
): ResolvedWindow | null => {
  const from = parseYmd(window.dateFrom);
  const to = parseYmd(window.dateTo);
  const lastDayOfFromMonth =
    from !== null ? new Date(Date.UTC(from.y, from.m, 0)).getUTCDate() : 0;

  // Recorte de mês cheio compara com o mês anterior cheio, que é o que o dono
  // espera de "vs mês passado". Demais recortes comparam janelas de igual
  // duração terminando na véspera.
  if (
    from &&
    to &&
    from.y === to.y &&
    from.m === to.m &&
    from.d === 1 &&
    to.d === lastDayOfFromMonth
  ) {
    const previousMonthLast = new Date(Date.UTC(from.y, from.m - 1, 0));
    const previousFrom = `${previousMonthLast.getUTCFullYear()}-${pad2(
      previousMonthLast.getUTCMonth() + 1,
    )}-01`;
    const previousMonthTo = `${previousMonthLast.getUTCFullYear()}-${pad2(
      previousMonthLast.getUTCMonth() + 1,
    )}-${pad2(previousMonthLast.getUTCDate())}`;
    return resolveWindow(previousFrom, previousMonthTo);
  }

  const previousTo = addDays(window.dateFrom, -1);
  const previousFrom = addDays(previousTo, -(window.days - 1));
  return resolveWindow(previousFrom, previousTo);
};

/**
 * Data de calendário no fuso da operação. O serviço já consulta com offset
 * explícito de -03:00; derivar a chave do dia no mesmo fuso evita que um
 * pagamento às 23h caia no dia seguinte para quem abre a tela em UTC.
 */
export const dateKeyInSaoPaulo = (value?: string | null): string | null => {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return null;
  const parts = SAO_PAULO_DATE_FORMATTER.formatToParts(new Date(timestamp));
  const y = parts.find((part) => part.type === 'year')?.value;
  const m = parts.find((part) => part.type === 'month')?.value;
  const d = parts.find((part) => part.type === 'day')?.value;
  if (!y || !m || !d) return null;
  return `${y}-${m}-${d}`;
};

export const todayInSaoPaulo = (): string =>
  dateKeyInSaoPaulo(new Date().toISOString()) ?? '';

const shortLabel = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;
const fullLabel = (ymd: string) => `${shortLabel(ymd)}/${ymd.slice(0, 4)}`;

const mondayOf = (ymd: string): string => {
  const parsed = parseYmd(ymd);
  if (!parsed) return ymd;
  const date = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  const offset = (date.getUTCDay() + 6) % 7;
  return addDays(ymd, -offset);
};

/**
 * A meta da unidade é mensal. Comparar um recorte de 7 dias com ela produziria
 * um percentual sem significado, então o bloco de meta só é habilitado quando
 * o recorte cobre o mês inteiro ou o mês corrente até hoje.
 */
export const resolveGoalContext = (
  window: PerformanceWindow,
  goal: TenantGoal | null,
  todayYmd: string,
): GoalContext => {
  if (!goal || !(goal.revenue_goal > 0 || goal.appointments_goal > 0)) {
    return { applies: false, reason: 'no_goal', pacePercent: null };
  }

  const from = parseYmd(window.dateFrom);
  const to = parseYmd(window.dateTo);
  if (!from || !to) return { applies: false, reason: 'partial_range', pacePercent: null };

  const sameMonth = from.y === to.y && from.m === to.m;
  if (!sameMonth) {
    return { applies: false, reason: 'multi_month', pacePercent: null };
  }

  const lastDay = new Date(Date.UTC(from.y, from.m, 0)).getUTCDate();
  const startsAtMonthStart = from.d === 1;
  const endsAtMonthEnd = to.d === lastDay;
  const isCurrentMonth = todayYmd.startsWith(`${from.y}-${pad2(from.m)}`);
  const endsToday = to.d === Number(todayYmd.slice(8, 10));

  if (!startsAtMonthStart || !(endsAtMonthEnd || (isCurrentMonth && endsToday))) {
    return { applies: false, reason: 'partial_range', pacePercent: null };
  }

  const todayDay = Number(todayYmd.slice(8, 10));
  const pacePercent = isCurrentMonth
    ? Math.min(100, Math.max(0, (todayDay / lastDay) * 100))
    : null;

  return { applies: true, reason: null, pacePercent };
};

export interface PerformanceStaffInfo {
  id: string;
  name: string;
  role: string;
  commission_rate: number | null;
  product_commission_rate: number | null;
}

export interface PerformanceComandaRow {
  id: string;
  appointment_id?: string | null;
  status?: string | null;
  total?: number | string | null;
  payment_method?: string | null;
  closure_mode?: string | null;
  financial_effect?: boolean | null;
  created_at?: string | null;
  closed_at?: string | null;
  staff_id?: string | null;
}

export interface PerformanceComandaItemRow {
  id: string;
  comanda_id: string;
  service_id?: string | null;
  product_id?: string | null;
  product_name?: string | null;
  quantity?: number | string | null;
  unit_price?: number | string | null;
  staff_id?: string | null;
}

export interface PerformanceParticipantRow {
  id: string;
  comanda_item_id: string;
  professional_id?: string | null;
  staff_id?: string | null;
  role?: string | null;
  payout_type?: string | null;
  payout_value?: number | string | null;
  affects_commission?: boolean | null;
}

export interface PerformancePaymentRow {
  id: string;
  comanda_id: string;
  amount?: number | string | null;
  payment_method?: string | null;
  reversed_at?: string | null;
}

export interface PerformanceCommissionRecordRow {
  id: string;
  comanda_id: string;
  staff_id?: string | null;
  record_type?: string | null;
  commission_value?: number | string | null;
  status?: string | null;
}

export interface PerformanceAppointmentRow {
  id: string;
  start_time?: string | null;
}

export interface PerformanceSnapshotContext {
  dateRegime: DateRegime;
  staffById: Map<string, PerformanceStaffInfo>;
  appointmentById: Map<string, PerformanceAppointmentRow>;
  itemsByComandaId: Map<string, PerformanceComandaItemRow[]>;
  participantsByItemId: Map<string, PerformanceParticipantRow[]>;
  paymentsByComandaId: Map<string, PerformancePaymentRow[]>;
  commissionRecordsByComandaId: Map<string, PerformanceCommissionRecordRow[]>;
}

export interface PerformanceSnapshot {
  rankedStaff: StaffPerformanceRecord[];
  timeline: TimelinePoint[];
  totals: PerformanceTotals;
}

interface DayBucket {
  cash: number;
  club: number;
  total: number;
  count: number;
}

const emptyBucket = (): DayBucket => ({ cash: 0, club: 0, total: 0, count: 0 });

const isClubPaymentMethod = (
  method?: string | null,
  closureMode?: string | null,
  financialEffect?: boolean | null,
): boolean => {
  if (closureMode === 'legacy_membership' || financialEffect === false) return true;
  const normalized = String(method || '').toLowerCase().trim();
  return (
    normalized.includes('clube') ||
    normalized.includes('chef') ||
    normalized.includes('assinatura') ||
    normalized === 'membership' ||
    normalized === 'subscription' ||
    normalized === 'club_credit' ||
    normalized === 'credito_clube' ||
    normalized === 'crédito clube'
  );
};

const buildTimeline = (
  daily: Map<string, DayBucket>,
  window: PerformanceWindow,
): TimelinePoint[] => {
  const days = enumerateDays(window.dateFrom, window.dateTo);
  const bucketAt = (day: string): DayBucket => daily.get(day) ?? emptyBucket();

  if (window.granularity === 'day') {
    return days.map((day) => {
      const bucket = bucketAt(day);
      return {
        key: day,
        label: shortLabel(day),
        tooltipLabel: fullLabel(day),
        cash: bucket.cash,
        club: bucket.club,
        total: bucket.total,
        count: bucket.count,
      };
    });
  }

  const weeks = new Map<string, DayBucket & { start: string; end: string }>();
  for (const day of days) {
    const weekKey = mondayOf(day);
    const bucket = bucketAt(day);
    const week = weeks.get(weekKey);
    if (!week) {
      weeks.set(weekKey, { ...bucket, start: day, end: day });
      continue;
    }
    week.cash += bucket.cash;
    week.club += bucket.club;
    week.total += bucket.total;
    week.count += bucket.count;
    week.end = day;
  }

  return Array.from(weeks.values()).map((week) => ({
    key: week.start,
    label: shortLabel(week.start),
    tooltipLabel:
      week.start === week.end
        ? fullLabel(week.start)
        : `${shortLabel(week.start)} a ${shortLabel(week.end)}`,
    cash: week.cash,
    club: week.club,
    total: week.total,
    count: week.count,
  }));
};

/**
 * Construtor puro: recebe as comandas da janela e o contexto já enriquecido,
 * devolve totais, ranking e timeline contígua. Não consulta banco, o que
 * permite testar zero-fill, agrupamento semanal e arredondamentos sem mocks.
 */
export const buildSnapshot = (
  comandas: PerformanceComandaRow[],
  context: PerformanceSnapshotContext,
  window: PerformanceWindow & { fromMs?: number; toMs?: number },
): PerformanceSnapshot => {
  const staffById = context.staffById;
  const appointmentById = context.appointmentById;
  const itemsByComandaId = context.itemsByComandaId;
  const participantsByItemId = context.participantsByItemId;
  const paymentsByComandaId = context.paymentsByComandaId;
  const commissionRecordsByComandaId = context.commissionRecordsByComandaId;
  const dateRegime = context.dateRegime;
  const fromMs = window.fromMs ?? startOfDayMs(window.dateFrom);
  const toMs = window.toMs ?? endOfDayMs(window.dateTo);

  const staffMetricsMap = new Map<
    string,
    {
      cash_revenue: number;
      club_credit_volume: number;
      commission_generated: number;
      comandaIds: Set<string>;
    }
  >();

  const initStaffMetrics = (id: string) => {
    let metrics = staffMetricsMap.get(id);
    if (!metrics) {
      metrics = {
        cash_revenue: 0,
        club_credit_volume: 0,
        commission_generated: 0,
        comandaIds: new Set<string>(),
      };
      staffMetricsMap.set(id, metrics);
    }
    return metrics;
  };

  for (const staff of staffById.values()) {
    initStaffMetrics(staff.id);
  }

  let houseCashRevenue = 0;
  let houseClubVolume = 0;
  let houseTotalRevenue = 0;
  let houseTotalCommissions = 0;
  let houseTotalAttendances = 0;

  const daily = new Map<string, DayBucket>();

  for (const comanda of comandas) {
    const appointment = comanda.appointment_id
      ? appointmentById.get(comanda.appointment_id)
      : null;
    const attendanceDate = appointment?.start_time || comanda.created_at;
    const paymentDate = comanda.closed_at || comanda.created_at;
    const targetDate = dateRegime === 'attendance' ? attendanceDate : paymentDate;
    const dayKey = dateKeyInSaoPaulo(targetDate);

    // Comanda sem data atribuível não pode ser desenhada em um eixo temporal.
    // Some do total de propósito, em vez de cair em um balde "outros" invisível.
    if (!dayKey) continue;
    const targetTimestamp = new Date(targetDate as string).getTime();
    if (targetTimestamp < fromMs || targetTimestamp > toMs) continue;

    const comandaTotal = Number(comanda.total || 0);
    const items = itemsByComandaId.get(comanda.id) || [];
    const activePayments = paymentsByComandaId.get(comanda.id) || [];

    let comandaCash = 0;
    let comandaClub = 0;
    const comandaIsClub = isClubPaymentMethod(
      comanda.payment_method,
      comanda.closure_mode,
      comanda.financial_effect,
    );

    if (activePayments.length > 0) {
      for (const payment of activePayments) {
        const amount = Number(payment.amount || 0);
        const isClub =
          comandaIsClub ||
          isClubPaymentMethod(
            payment.payment_method,
            comanda.closure_mode,
            comanda.financial_effect,
          );
        if (isClub) {
          comandaClub += amount;
        } else {
          comandaCash += amount;
        }
      }
    } else if (comandaIsClub) {
      comandaClub = comandaTotal;
    } else {
      comandaCash = comandaTotal;
    }

    const calculatedComandaTotal = comandaCash + comandaClub;
    const effectiveTotal =
      calculatedComandaTotal > 0 ? calculatedComandaTotal : comandaTotal;
    const cashRatio = effectiveTotal > 0 ? comandaCash / effectiveTotal : 1;
    const clubRatio = effectiveTotal > 0 ? comandaClub / effectiveTotal : 0;

    houseCashRevenue += comandaCash;
    houseClubVolume += comandaClub;
    houseTotalRevenue += effectiveTotal;
    houseTotalAttendances += 1;

    const day = daily.get(dayKey) ?? emptyBucket();
    day.cash += comandaCash;
    day.club += comandaClub;
    day.total += effectiveTotal;
    day.count += 1;
    daily.set(dayKey, day);

    if (items.length > 0) {
      for (const item of items) {
        const quantity = Math.max(1, Number(item.quantity || 1));
        const itemPrice = Number(item.unit_price || 0) * quantity;
        const itemCash = itemPrice * cashRatio;
        const itemClub = itemPrice * clubRatio;
        const participants = participantsByItemId.get(item.id) || [];

        if (participants.length > 0) {
          const share = 1 / participants.length;
          for (const participant of participants) {
            const professionalId =
              participant.professional_id ||
              participant.staff_id ||
              item.staff_id ||
              comanda.staff_id;
            if (!professionalId) continue;
            const metrics = initStaffMetrics(professionalId);
            metrics.cash_revenue += itemCash * share;
            metrics.club_credit_volume += itemClub * share;
            metrics.comandaIds.add(comanda.id);
          }
        } else {
          const professionalId = item.staff_id || comanda.staff_id;
          if (professionalId) {
            const metrics = initStaffMetrics(professionalId);
            metrics.cash_revenue += itemCash;
            metrics.club_credit_volume += itemClub;
            metrics.comandaIds.add(comanda.id);
          }
        }
      }
    } else if (comanda.staff_id) {
      const metrics = initStaffMetrics(comanda.staff_id);
      metrics.cash_revenue += comandaCash;
      metrics.club_credit_volume += comandaClub;
      metrics.comandaIds.add(comanda.id);
    }

    const commissionRecords = commissionRecordsByComandaId.get(comanda.id) || [];
    if (commissionRecords.length > 0) {
      const activeOriginals = commissionRecords.filter(
        (record) => record.record_type === 'commission' && record.status === 'active',
      );
      const recordsToProcess =
        activeOriginals.length > 0 ? activeOriginals : commissionRecords;

      for (const record of recordsToProcess) {
        const value = Number(record.commission_value || 0);
        houseTotalCommissions += value;
        if (record.staff_id) {
          initStaffMetrics(record.staff_id).commission_generated += value;
        }
      }
    } else if (comanda.financial_effect !== false) {
      for (const item of items) {
        const quantity = Math.max(1, Number(item.quantity || 1));
        const lineTotal = Number(item.unit_price || 0) * quantity;
        if (lineTotal <= 0) continue;

        const participants = (participantsByItemId.get(item.id) || []).filter(
          (participant) => participant.affects_commission !== false,
        );

        if (participants.length > 0) {
          for (const participant of participants) {
            const professionalId =
              participant.professional_id ||
              participant.staff_id ||
              item.staff_id ||
              comanda.staff_id;
            const staff = professionalId ? staffById.get(professionalId) : undefined;
            const effectiveRate = getEffectiveCommissionRateForItem(staff, item);
            const commission = calculateCommissionValue(
              lineTotal,
              {
                id: participant.id,
                comanda_item_id: item.id,
                staff_id: professionalId || null,
                role: participant.role || 'primary',
                payout_type: participant.payout_type || 'percentage',
                payout_value: Number(participant.payout_value ?? 100),
                affects_commission: participant.affects_commission !== false,
              },
              effectiveRate,
            );
            houseTotalCommissions += commission;
            if (professionalId && commission > 0) {
              initStaffMetrics(professionalId).commission_generated += commission;
            }
          }
        } else {
          const professionalId = item.staff_id || comanda.staff_id;
          const staff = professionalId ? staffById.get(professionalId) : undefined;
          const effectiveRate = getEffectiveCommissionRateForItem(staff, item);
          if (effectiveRate > 0) {
            const commission = lineTotal * effectiveRate;
            houseTotalCommissions += commission;
            if (professionalId) {
              initStaffMetrics(professionalId).commission_generated += commission;
            }
          }
        }
      }
    }
  }

  const rankedStaff: StaffPerformanceRecord[] = [];
  staffMetricsMap.forEach((metrics, staffId) => {
    const staff = staffById.get(staffId);
    const totalRevenue = metrics.cash_revenue + metrics.club_credit_volume;
    const appointmentsCount = metrics.comandaIds.size;
    rankedStaff.push({
      id: staffId,
      name: staff ? staff.name : 'Colaborador',
      role: staff ? staff.role : 'barber',
      commission_rate: staff ? staff.commission_rate : null,
      appointments_count: appointmentsCount,
      cash_revenue: metrics.cash_revenue,
      club_credit_volume: metrics.club_credit_volume,
      total_revenue: totalRevenue,
      average_ticket: appointmentsCount > 0 ? totalRevenue / appointmentsCount : 0,
      commission_generated: metrics.commission_generated,
      share_percentage:
        houseTotalRevenue > 0 ? (totalRevenue / houseTotalRevenue) * 100 : 0,
    });
  });

  rankedStaff.sort((a, b) => {
    if (b.total_revenue !== a.total_revenue) return b.total_revenue - a.total_revenue;
    return b.appointments_count - a.appointments_count;
  });

  const averageTicket =
    houseTotalAttendances > 0 ? houseTotalRevenue / houseTotalAttendances : 0;
  const netMargin = Math.max(0, houseTotalRevenue - houseTotalCommissions);

  return {
    rankedStaff,
    timeline: buildTimeline(daily, window),
    totals: {
      totalRevenue: houseTotalRevenue,
      cashRevenue: houseCashRevenue,
      clubCreditVolume: houseClubVolume,
      totalAttendances: houseTotalAttendances,
      averageTicket,
      totalCommissions: houseTotalCommissions,
      netMargin,
      netMarginPercent:
        houseTotalRevenue > 0 ? (netMargin / houseTotalRevenue) * 100 : 0,
    },
  };
};

const pctChange = (current: number, previous: number): number | null => {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
};

/**
 * Deltas contra a janela anterior. Base zero devolve null: "sem base de
 * comparação" é informação honesta; +∞% não é.
 */
export const computeDeltas = (
  current: PerformanceTotals,
  previous: PerformanceTotals | null,
): PerformanceDeltas => {
  if (!previous) {
    return {
      revenuePct: null,
      appointmentsPct: null,
      averageTicketPct: null,
      commissionPct: null,
      netMarginPctPoints: null,
    };
  }

  return {
    revenuePct: pctChange(current.totalRevenue, previous.totalRevenue),
    appointmentsPct: pctChange(current.totalAttendances, previous.totalAttendances),
    averageTicketPct: pctChange(current.averageTicket, previous.averageTicket),
    commissionPct: pctChange(current.totalCommissions, previous.totalCommissions),
    netMarginPctPoints: current.netMarginPercent - previous.netMarginPercent,
  };
};

/** Aplica o cap de linhas e informa se a foto do período ficou parcial. */
export const clampToRecordLimit = <T>(
  rows: T[],
  limit: number = MAX_DISPLAY_RECORDS,
): { rows: T[]; truncated: boolean } => ({
  rows: rows.length > limit ? rows.slice(0, limit) : rows,
  truncated: rows.length > limit,
});
