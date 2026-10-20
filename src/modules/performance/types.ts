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

export interface TimelinePoint {
  key: string;
  label: string;
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

export interface PerformanceResult {
  tenantGoal: TenantGoal | null;
  rankedStaff: StaffPerformanceRecord[];
  timeline: TimelinePoint[];
  totals: PerformanceTotals;
}
