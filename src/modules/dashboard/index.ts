export { useDashboardData } from './hooks/useDashboardData';
export { useDashboardActions } from './hooks/useDashboardActions';
export { MetricsPanel } from './components/MetricsPanel';
export { SmartReturnWidget } from './components/SmartReturnWidget';
export { QuickAppointmentCard } from './components/QuickAppointmentCard';
export { UpcomingAppointmentsCard } from './components/UpcomingAppointmentsCard';
export { AppointmentDetailModal } from './components/AppointmentDetailModal';
export { TeamStatusCard } from './components/TeamStatusCard';
export { UpcomingBirthdaysCard } from './components/UpcomingBirthdaysCard';
export { NewClientModal } from './components/NewClientModal';
export { QuickScheduleModal } from './components/QuickScheduleModal';
export type {
  DashboardAppointment,
  DashboardChartPoint,
  DashboardClient,
  DashboardData,
  DashboardMetrics,
  DashboardPeriod,
  DashboardProfile,
  DashboardService,
  DashboardStaff,
  NewClientFormState,
  NewClientPayload,
  QuickAppointmentFormState,
  QuickAppointmentPayload,
  QuickAppointmentResult,
  UpcomingBirthday,
} from './types';

export type {
  DashboardClient as Client,
  DashboardService as Service,
  DashboardStaff as Staff,
} from './types';
