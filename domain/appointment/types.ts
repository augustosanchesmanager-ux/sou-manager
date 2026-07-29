/**
 * [SMG][DOMAIN][APPOINTMENT] types
 *
 * Tipos centrais do domínio de agendamentos.
 * Extraídos de pages/Schedule.tsx.
 */

export interface Appointment {
  id: string;
  tenant_id: string;
  client_id: string | null;
  client_name: string;
  client_phone: string;
  staff_id: string | null;
  staff_name: string;
  service_id: string | null;
  service_name: string;
  start_time: string;
  end_time: string;
  duration: number;
  price: number;
  status: string;
  notes: string;
  source: string;
  hidden_from_schedule: boolean;
  cancellation_reason: string | null;
  cancellation_type: string | null;
  cancelled_at: string | null;
  cancelled_by_user_id: string | null;
  created_at: string;
}

export interface UpdateAppointmentInput {
  service_id?: string | null;
  staff_id?: string | null;
  staff_name?: string;
  client_id?: string | null;
  client_name?: string;
  client_phone?: string;
  service_name?: string;
  start_time?: string;
  end_time?: string;
  duration?: number;
  price?: number;
  notes?: string;
}

export interface CancelAppointmentInput {
  status: 'cancelled' | 'no_show';
  cancellation_reason: string;
  cancellation_type: string | null;
  hidden_from_schedule: boolean;
  cancelled_at: string;
  cancelled_by_user_id: string | null;
}

export interface AppointmentListOptions {
  staffId?: string;
  includeHidden?: boolean;
  startTimeFrom?: string;
  startTimeTo?: string;
}
