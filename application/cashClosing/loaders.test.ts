/**
 * [SMG][APPLICATION][CASH_CLOSING] loaders tests
 *
 * Regression guard P1-01/H-7: comanda item staff_id must flow into
 * ComandaItemDetail.staffId; null item staff falls back to comanda staff.
 *
 * Convenções: AAA, should_<result>_when_<condition>.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockComandaList = vi.fn();
const mockItemListByComandaIds = vi.fn();

vi.mock('../../domain/comanda/repository', () => ({
  comandaRepository: {
    list: (...args: unknown[]) => mockComandaList(...args),
  },
}));

vi.mock('../../domain/comanda/item-repository', () => ({
  comandaItemRepository: {
    listByComandaIds: (...args: unknown[]) => mockItemListByComandaIds(...args),
  },
}));

vi.mock('../../domain/cashClosing/repository', () => ({
  cashClosingRepository: {},
  barberClosingRepository: {},
  cashClosingEventRepository: {},
}));
vi.mock('../../domain/transaction/repository', () => ({ transactionRepository: {} }));
vi.mock('../../domain/receivable/repository', () => ({ receivableRepository: {} }));
vi.mock('../../domain/staff/repository', () => ({ staffRepository: {} }));
vi.mock('../../domain/client/repository', () => ({ clientRepository: {} }));
vi.mock('../../domain/service/repository', () => ({ serviceRepository: {} }));
vi.mock('../../domain/appointment/repository', () => ({ appointmentRepository: {} }));
vi.mock('../../domain/financial/reversal-repository', () => ({ financialReversalRepository: {} }));

import { loadComandasWithDetails } from './loaders';

const staffMap = {
  'staff-1': { name: 'Marcos', role: 'barber' },
  'staff-2': { name: 'Julia', role: 'barber' },
};
const clientMap = { cl1: 'Cliente A' };
const serviceMap = { sv1: 'Corte' };

const makeComanda = (overrides: Record<string, unknown> = {}) => ({
  id: 'c1',
  staff_id: 'staff-1',
  client_id: 'cl1',
  client_name: null,
  payment_method: 'cash',
  total: 150,
  status: 'paid',
  appointment_id: null,
  ...overrides,
});

const makeItem = (overrides: Record<string, unknown> = {}) => ({
  id: 'i1',
  comanda_id: 'c1',
  service_id: 'sv1',
  product_name: null,
  quantity: 1,
  unit_price: 50,
  staff_id: 'staff-2',
  ...overrides,
});

describe('loadComandasWithDetails — P1-01 staff_id flow', () => {
  beforeEach(() => {
    mockComandaList.mockReset();
    mockItemListByComandaIds.mockReset();
  });

  it('should_map_item_staff_id_when_item_has_staff_id', async () => {
    mockComandaList.mockResolvedValue([makeComanda()]);
    mockItemListByComandaIds.mockResolvedValue([makeItem()]);

    const result = await loadComandasWithDetails('t1', 'start', 'end', staffMap, clientMap, serviceMap);

    expect(mockItemListByComandaIds).toHaveBeenCalledWith(['c1'], 't1');
    const detail = result.comandaDetails[0];
    expect(detail.items[0].staffId).toBe('staff-2');
    expect(detail.items[0].staffName).toBe('Julia');
    expect(detail.staffId).toBe('staff-1');
  });

  it('should_fall_back_to_comanda_staff_when_item_staff_null', async () => {
    mockComandaList.mockResolvedValue([makeComanda()]);
    mockItemListByComandaIds.mockResolvedValue([makeItem({ staff_id: null })]);

    const result = await loadComandasWithDetails('t1', 'start', 'end', staffMap, clientMap, serviceMap);

    const detail = result.comandaDetails[0];
    expect(detail.items[0].staffId).toBe('staff-1');
    expect(detail.items[0].staffName).toBe('Marcos');
  });

  it('should_resolve_detail_staff_from_items_when_comanda_staff_null', async () => {
    mockComandaList.mockResolvedValue([makeComanda({ staff_id: null })]);
    mockItemListByComandaIds.mockResolvedValue([makeItem({ staff_id: 'staff-2' })]);

    const result = await loadComandasWithDetails('t1', 'start', 'end', staffMap, clientMap, serviceMap);

    const detail = result.comandaDetails[0];
    expect(detail.staffId).toBe('staff-2');
    expect(detail.staffName).toBe('Julia');
  });

  it('should_pass_comanda_ids_to_items_query_when_multiple_comandas', async () => {
    mockComandaList.mockResolvedValue([
      makeComanda(),
      makeComanda({ id: 'c2', staff_id: 'staff-2' }),
    ]);
    mockItemListByComandaIds.mockResolvedValue([]);

    const result = await loadComandasWithDetails('t1', 'start', 'end', staffMap, clientMap, serviceMap);

    expect(mockItemListByComandaIds).toHaveBeenCalledWith(['c1', 'c2'], 't1');
    expect(result.comandaDetails).toHaveLength(2);
  });
});
