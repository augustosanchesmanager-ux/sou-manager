export type DateRegime = 'attendance' | 'payment';

export interface PerformanceFilterState {
  dateFrom: string;
  dateTo: string;
}

export interface TenantGoal {
  id: string;
  period: string;
  revenue_goal: number;
  appointments_goal: number;
  clients_goal: number;
  active: boolean;
}

export interface StaffPerformanceRecord {
  id: string;
  name: string;
  role: string;
  commission_rate: number | null;
  appointments_count: number;
  cash_revenue: number;
  club_credit_volume: number;
  total_revenue: number;
  average_ticket: number;
  commission_generated: number;
  share_percentage: number;
}

export type TimelineGranularity = 'day' | 'week';

export interface TimelinePoint {
  /** YYYY-MM-DD do dia, ou da segunda-feira que abre a semana. */
  key: string;
  /** Rótulo curto de eixo: 05/11. */
  label: string;
  /** Rótulo completo para tooltip: 05/11/2026 ou 03 a 09/11. */
  tooltipLabel: string;
  cash: number;
  club: number;
  total: number;
  count: number;
}

export interface PerformanceTotals {
  totalRevenue: number;
  cashRevenue: number;
  clubCreditVolume: number;
  totalAttendances: number;
  averageTicket: number;
  totalCommissions: number;
  netMargin: number;
  netMarginPercent: number;
}

export interface PerformanceWindow {
  dateFrom: string;
  dateTo: string;
  days: number;
  granularity: TimelineGranularity;
}

export interface PerformanceDeltas {
  /** null quando o período anterior não tem base para comparação. */
  revenuePct: number | null;
  appointmentsPct: number | null;
  averageTicketPct: number | null;
  commissionPct: number | null;
  /** Variação em pontos percentuais, não em %. */
  netMarginPctPoints: number | null;
}

export type GoalUnavailableReason = 'no_goal' | 'multi_month' | 'partial_range';

export interface GoalContext {
  applies: boolean;
  reason: GoalUnavailableReason | null;
  /** 0 a 100, apenas quando o recorte é o mês corrente em andamento. */
  pacePercent: number | null;
}

export interface PerformanceResult {
  tenantGoal: TenantGoal | null;
  goalContext: GoalContext;
  rankedStaff: StaffPerformanceRecord[];
  timeline: TimelinePoint[];
  totals: PerformanceTotals;
  previousTotals: PerformanceTotals | null;
  deltas: PerformanceDeltas;
  window: PerformanceWindow;
  previousWindow: PerformanceWindow | null;
  /** Cap de registros atingido no período exibido. */
  truncated: boolean;
  /** Cap de registros atingido na janela anterior usada no delta. */
  previousTruncated: boolean;
}
