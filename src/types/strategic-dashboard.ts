export type Period = 'today' | 'week' | 'month';

export interface StrategicDashboardFilters {
  period: Period;
}

export interface StrategicKPIs {
  revenue: number;
  revenuePrevious: number;
  revenueGrowth: number;
  avgTicket: number;
  avgTicketPrevious: number;
  avgTicketGrowth: number;
  totalClients: number;
  newClients: number;
  returningClients: number;
  occupationRate: number;
  appointmentCount: number;
  appointmentSlots: number;
}

export interface RevenueDataPoint {
  date: string;
  value: number;
}

export interface ProfessionalRanking {
  id: string;
  name: string;
  revenue: number;
  appointments: number;
  avatar?: string;
}

export interface ClubMacroData {
  mrr: number;
  arr: number;
  activeSubscribers: number;
  pendingAmount: number;
  overdueAmount: number;
  countOverdue: number;
  nextDueDates: {
    clientId: string;
    clientName: string;
    dueDate: string;
    amount: number;
  }[];
}

export interface StrategicAlert {
  id: string;
  type: 'stock' | 'churn' | 'revenue' | 'inadimplence' | 'occupation';
  message: string;
  priority: 'high' | 'medium' | 'low';
  count?: number;
  actionUrl?: string;
}

export interface StrategicDashboardData {
  loading: boolean;
  error: string | null;
  kpis: StrategicKPIs;
  charts: {
    revenueEvolution: RevenueDataPoint[];
    revenueByDay: RevenueDataPoint[];
  };
  rankings: {
    topProfessionals: ProfessionalRanking[];
  };
  club: ClubMacroData;
  alerts: StrategicAlert[];
}

export interface StrategicDashboardResponse {
  period: string;
  kpis: StrategicKPIs;
  charts: {
    revenueEvolution: RevenueDataPoint[];
    revenueByDay: RevenueDataPoint[];
  };
  rankings: {
    topProfessionals: ProfessionalRanking[];
  };
  club: ClubMacroData;
  alerts: StrategicAlert[];
}