export type ShiftType = 'morning' | 'evening';
export type PreviewChannel = 'WHATSAPP' | 'EMAIL';
export type DispatchStatus = 'SENT' | 'SKIPPED_DUPLICATE' | 'FAILED';

export interface StaffOccupancyItem {
  staffId: string;
  name: string;
  initials: string;
  roleBadge: string;
  isManager?: boolean;
  scheduledCount: number;
  projectedRevenue: number;
  occupancyPercentage: number;
  freeWindows: string;
  timeRangeDescription: string;
}

export interface ClubClientItem {
  time: string;
  clientName: string;
  serviceDescription: string;
  status: 'Em dia' | 'Renova Hoje' | 'Pendente';
}

export interface FinancialAlertItem {
  id: string;
  title: string;
  subtitle: string;
  amount: number;
  type: 'payable' | 'receivable' | 'club_renewal';
}

export interface MorningSummaryData {
  scheduledCount: number;
  scheduledDeltaLabel: string;
  projectedRevenue: number;
  projectedBreakdownLabel: string;
  occupancyRate: number;
  freeSlotsLabel: string;
  clubSubscribersCount: number;
  staffOccupancy: StaffOccupancyItem[];
  clubClients: ClubClientItem[];
  financialAlerts: FinancialAlertItem[];
}

export interface OpenComandaItem {
  id: string;
  comandaNumber: string;
  clientName: string;
  staffName: string;
  serviceDescription: string;
  time: string;
  amount: number;
}

export interface StaffClosingItem {
  staffId: string;
  name: string;
  roleDescription: string;
  completedCount: number;
  cashRevenue: number;
  clubCredits: number;
  commissionAmount: number;
}

export interface EveningSummaryData {
  realizedRevenue: number;
  paymentBreakdownLabel: string;
  clubCreditsCount: number;
  completedCount: number;
  totalAppointments: number;
  openCount: number;
  cancelledCount: number;
  ticketMedio: number;
  ticketMedioDeltaLabel: string;
  openComandasTotal: number;
  openComandas: OpenComandaItem[];
  staffClosing: StaffClosingItem[];
  totalCashRevenue: number;
  totalClubCredits: number;
  totalCommissions: number;
}

export interface AutomationSettings {
  morningEnabled: boolean;
  morningTime: string;
  eveningEnabled: boolean;
  eveningTime: string;
  sendIndividualBarber: boolean;
}

export interface DispatchLogItem {
  id: string;
  date: string;
  shift: ShiftType;
  channel: PreviewChannel;
  idempotencyKey: string;
  status: DispatchStatus;
  dispatchedAt: string;
}

export interface DailySummaryPayload {
  date: string;
  formattedDate: string;
  tenantName: string;
  unitName: string;
  timezone: string;
  morning: MorningSummaryData;
  evening: EveningSummaryData;
  automationSettings: AutomationSettings;
  recentLogs: DispatchLogItem[];
}
