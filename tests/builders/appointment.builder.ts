import type { Appointment } from '../../domain/appointment/types';

let _aptSeq = 0;

export const resetAppointmentSeq = () => { _aptSeq = 0; };

export const makeAppointment = (
  overrides: Partial<Appointment> = {},
): Appointment => ({
  id: `apt-${++_aptSeq}`,
  tenant_id: 'tenant-1',
  client_id: 'client-1',
  client_name: 'João',
  client_phone: '(11) 99999-0000',
  staff_id: 'staff-1',
  staff_name: 'Barbeiro 1',
  service_id: 'svc-1',
  service_name: 'Corte',
  start_time: new Date().toISOString(),
  end_time: new Date(Date.now() + 30 * 60000).toISOString(),
  duration: 30,
  price: 50,
  status: 'confirmed',
  notes: '',
  source: 'online',
  hidden_from_schedule: false,
  cancellation_reason: null,
  cancellation_type: null,
  cancelled_at: null,
  cancelled_by_user_id: null,
  created_at: new Date().toISOString(),
  ...overrides,
});

export const makeConfirmedAppointment = (overrides: Partial<Appointment> = {}) =>
  makeAppointment({ status: 'confirmed', ...overrides });

export const makeCompletedAppointment = (overrides: Partial<Appointment> = {}) =>
  makeAppointment({ status: 'completed', ...overrides });

export const makeCancelledAppointment = (overrides: Partial<Appointment> = {}) =>
  makeAppointment({
    status: 'cancelled',
    cancellation_reason: 'Cliente desistiu',
    cancellation_type: 'client',
    cancelled_at: new Date().toISOString(),
    cancelled_by_user_id: 'user-1',
    ...overrides,
  });
