import type {
  PerformanceAppointmentRow,
  PerformanceComandaItemRow,
  PerformanceComandaRow,
  PerformanceCommissionRecordRow,
  PerformanceParticipantRow,
  PerformancePaymentRow,
  PerformanceSnapshotContext,
  PerformanceStaffInfo,
} from '../../src/modules/performance/snapshot';

const DEFAULT_DAY = '2026-11-05';

let seq = 0;

export const resetPerformanceSeq = () => {
  seq = 0;
};

export const makePerformanceComanda = (
  overrides: Partial<PerformanceComandaRow> = {},
): PerformanceComandaRow => ({
  id: `cmd-${++seq}`,
  status: 'paid',
  total: 100,
  payment_method: 'dinheiro',
  closure_mode: null,
  financial_effect: true,
  created_at: `${DEFAULT_DAY}T15:00:00-03:00`,
  closed_at: `${DEFAULT_DAY}T15:10:00-03:00`,
  staff_id: 'staff-1',
  appointment_id: null,
  ...overrides,
});

export const makePerformanceItem = (
  overrides: Partial<PerformanceComandaItemRow> = {},
): PerformanceComandaItemRow => ({
  id: `item-${++seq}`,
  comanda_id: 'cmd-1',
  service_id: 'svc-1',
  quantity: 1,
  unit_price: 100,
  staff_id: 'staff-1',
  ...overrides,
});

export const makePerformanceParticipant = (
  overrides: Partial<PerformanceParticipantRow> = {},
): PerformanceParticipantRow => ({
  id: `part-${++seq}`,
  comanda_item_id: 'item-1',
  professional_id: 'staff-1',
  role: 'primary',
  payout_type: 'percentage',
  payout_value: 100,
  affects_commission: true,
  ...overrides,
});

export const makePerformancePayment = (
  overrides: Partial<PerformancePaymentRow> = {},
): PerformancePaymentRow => ({
  id: `pay-${++seq}`,
  comanda_id: 'cmd-1',
  amount: 100,
  payment_method: 'dinheiro',
  reversed_at: null,
  ...overrides,
});

export const makePerformanceCommissionRecord = (
  overrides: Partial<PerformanceCommissionRecordRow> = {},
): PerformanceCommissionRecordRow => ({
  id: `rec-${++seq}`,
  comanda_id: 'cmd-1',
  staff_id: 'staff-1',
  record_type: 'commission',
  commission_value: 50,
  status: 'active',
  ...overrides,
});

export const makePerformanceAppointment = (
  overrides: Partial<PerformanceAppointmentRow> = {},
): PerformanceAppointmentRow => ({
  id: `apt-${++seq}`,
  start_time: `${DEFAULT_DAY}T15:00:00-03:00`,
  ...overrides,
});

export const makePerformanceStaff = (
  overrides: Partial<PerformanceStaffInfo> = {},
): PerformanceStaffInfo => ({
  id: 'staff-1',
  name: 'Barbeiro 1',
  role: 'barber',
  commission_rate: 50,
  product_commission_rate: 0,
  ...overrides,
});

export const makePerformanceContext = (
  overrides: Partial<PerformanceSnapshotContext> = {},
): PerformanceSnapshotContext => ({
  dateRegime: 'payment',
  staffById: new Map(),
  appointmentById: new Map(),
  itemsByComandaId: new Map(),
  participantsByItemId: new Map(),
  paymentsByComandaId: new Map(),
  commissionRecordsByComandaId: new Map(),
  ...overrides,
});
