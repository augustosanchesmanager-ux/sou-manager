import type { Comanda, ComandaItem } from '../../domain/comanda/types';

let _comandaSeq = 0;

export const resetComandaSeq = () => { _comandaSeq = 0; };

export const makeComanda = (
  overrides: Partial<Comanda> = {},
): Comanda => ({
  id: `comanda-${++_comandaSeq}`,
  tenant_id: 'tenant-1',
  client_id: 'client-1',
  client_name: 'João',
  appointment_id: null,
  staff_id: 'staff-1',
  status: 'open',
  total: 50,
  paid_amount: 0,
  payment_method: null,
  notes: null,
  created_at: new Date().toISOString(),
  closed_at: null,
  ...overrides,
});

export const makeComandaItem = (
  overrides: Partial<ComandaItem> = {},
): ComandaItem => ({
  id: `item-${++_comandaSeq}`,
  comanda_id: 'comanda-1',
  service_id: 'svc-1',
  name: 'Corte',
  type: 'service',
  quantity: 1,
  unit_price: 50,
  total_price: 50,
  staff_id: 'staff-1',
  created_at: new Date().toISOString(),
  ...overrides,
});

export const makeOpenComanda = (overrides: Partial<Comanda> = {}) =>
  makeComanda({ status: 'open', ...overrides });

export const makeClosedComanda = (overrides: Partial<Comanda> = {}) =>
  makeComanda({
    status: 'closed',
    closed_at: new Date().toISOString(),
    ...overrides,
  });

export const makePaidComanda = (overrides: Partial<Comanda> = {}) =>
  makeComanda({
    status: 'paid',
    paid_amount: 50,
    closed_at: new Date().toISOString(),
    ...overrides,
  });
