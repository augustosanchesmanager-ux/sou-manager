export type BusinessPeriod = 'today' | '7d' | '30d' | '90d' | 'custom';

export interface BusinessInsightsFilters {
  period: BusinessPeriod;
  professionalIds?: string[];
  serviceIds?: string[];
  dateFrom?: string;
  dateTo?: string;
}

export interface FinancialKPIs {
  revenue: number;
  revenuePrevious: number;
  revenueGrowth: number;
  expenses: number;
  profit: number;
  profitMargin: number;
  avgTicket: number;
  avgTicketPrevious: number;
  avgTicketGrowth: number;
}

export interface ClientKPIs {
  newClients: number;
  newClientsPrevious: number;
  newClientsGrowth: number;
  returningClients: number;
  retentionRate: number;
  avgFrequencyDays: number;
  inactiveClients: number;
  inactiveClients60Days: number;
}

export interface OperationalKPIs {
  totalAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  noShowAppointments: number;
  completedRate: number;
  cancelledRate: number;
  noShowRate: number;
}

export interface TopClient {
  id: string;
  name: string;
  ltv: number;
  totalVisits: number;
}

export interface TopService {
  id?: string;
  name: string;
  count: number;
  revenue: number;
}

export interface TopProfessional {
  id: string;
  name: string;
  revenue: number;
  appointments: number;
  avgTicket: number;
}

export interface RevenueByMethod {
  method: string;
  value: number;
}

export interface RevenueEvolutionPoint {
  month: string;
  income: number;
  expense: number;
}

export interface BusinessInsightsData {
  loading: boolean;
  error: string | null;
  period: BusinessPeriod;
  financial: FinancialKPIs;
  clients: ClientKPIs;
  operations: OperationalKPIs;
  analytics: {
    topServices: TopService[];
    topProfessionals: TopProfessional[];
    topClients: TopClient[];
    revenueByMethod: RevenueByMethod[];
    revenueEvolution: RevenueEvolutionPoint[];
  };
  insights: string[];
}

export interface BusinessInsightsResponse {
  period: string;
  financial: FinancialKPIs;
  clients: ClientKPIs;
  operations: OperationalKPIs;
  analytics: {
    topServices: TopService[];
    topProfessionals: TopProfessional[];
    topClients: TopClient[];
    revenueByMethod: RevenueByMethod[];
    revenueEvolution: RevenueEvolutionPoint[];
  };
  insights: string[];
}