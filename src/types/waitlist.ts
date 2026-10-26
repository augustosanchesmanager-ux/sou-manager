export type WaitlistStatus = 'waiting' | 'notified' | 'expired' | 'booked';

export interface WaitlistEntry {
  id: string;
  tenant_id: string;
  client_id: string;
  client_name?: string;
  client_phone?: string | null;
  service_id?: string | null;
  service_name?: string | null;
  preferred_staff_id?: string | null;
  preferred_staff_name?: string | null;
  desired_date: string;
  start_time_range?: string | null;
  end_time_range?: string | null;
  status: WaitlistStatus;
  notified_at?: string | null;
  created_at: string;
}

export interface CreateWaitlistInput {
  client_id: string;
  service_id?: string | null;
  preferred_staff_id?: string | null;
  desired_date: string;
  start_time_range?: string | null;
  end_time_range?: string | null;
}
