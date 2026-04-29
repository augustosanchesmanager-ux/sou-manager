export interface DashboardClient {
  id: string;
  name: string;
  phone: string;
  email: string;
  birthday?: string | null;
  last_visit?: string | null;
  avatar?: string | null;
}

export interface DashboardStaff {
  id: string;
  name: string;
}

export interface DashboardService {
  id: string;
  name: string;
  duration: number;
  duration_minutes?: number;
  price?: number;
}

export type Client = DashboardClient;
export type Service = DashboardService;
export type Staff = DashboardStaff;

export interface DashboardAppointment {
  id: string;
  client_name: string;
  client_phone?: string | null;
  service_name: string;
  staff_name: string;
  start_time: string;
  status: string;
}

export interface DashboardMetrics {
  revenue: number;
  revenuePrevious: number;
  revenueGrowth: number;
  revenueGoal: number;
  activeStaffPercent: number;
  todayAppointments: number;
  previousAppointments: number;
  appointmentsGrowth: number;
  appointmentsGoal: number;
  avgTicket: number;
  avgTicketPrevious: number;
  avgTicketGrowth: number;
}

export interface DashboardChartPoint {
  name: string;
  value: number;
}

export interface DashboardProfile {
  onboarding_completed?: boolean | null;
}

export type UpcomingBirthdayStatus = 'due_soon' | 'visited_recently' | 'overdue';

export interface UpcomingBirthday extends DashboardClient {
  displayDate: string;
  daysUntil: number;
  lastVisitText: string;
  status: UpcomingBirthdayStatus;
}

export interface RiskClient extends DashboardClient {
  days: number;
}

export interface DashboardData {
  clients: DashboardClient[];
  staffList: DashboardStaff[];
  servicesList: DashboardService[];
  appointments: DashboardAppointment[];
  upcomingBirthdays: UpcomingBirthday[];
  chartData: DashboardChartPoint[];
  metrics: DashboardMetrics;
  profile: DashboardProfile | null;
}

export interface QuickAppointmentPayload {
  clientId?: string | null;
  clientName: string;
  serviceId: string;
  staffId: string;
  startTime: string;
}

export interface QuickAppointmentResult {
  appointment_id: string;
  comanda_id: string;
  comanda_item_id: string;
  service_price: number;
  appointment_status: string;
}

export interface QuickAppointmentFormState {
  date: string;
  time: string;
  clientSearch: string;
  selectedClientId: string;
  serviceId: string;
  staffId: string;
}

export interface NewClientPayload {
  name: string;
  phone: string;
  email: string;
}

export interface NewClientFormState extends NewClientPayload {}

export interface BusyState {
  creatingClient: boolean;
  creatingQuickAppointment: boolean;
  appointmentUpdateId: string | null;
}

