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
vi.mock('../../domain/comanda/comandaPaymentRepository', () => ({
  comandaPaymentRepository: {
    getPaymentsByComandaIds: async () => [],
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

describe('loadComandasWithDetails — discriminador type do item', () => {
  beforeEach(() => {
    mockComandaList.mockReset();
    mockItemListByComandaIds.mockReset();
  });

  it('should_type_as_product_when_product_name_present_and_service_id_null', async () => {
    mockComandaList.mockResolvedValue([makeComanda()]);
    mockItemListByComandaIds.mockResolvedValue([
      makeItem({ service_id: null, product_name: 'Pomada Matiz', unit_price: 40 }),
    ]);

    const result = await loadComandasWithDetails('t1', 'start', 'end', staffMap, clientMap, serviceMap);

    const item = result.comandaDetails[0].items[0];
    expect(item.type).toBe('product');
    expect(item.serviceName).toBe('Pomada Matiz');
  });

  it('should_expose_type_for_items_built_without_discriminator', async () => {
    // Trava o contrato: todo item mapeado precisa sair com 'type' definido.
    // Sem o campo, summary.ts cairia no fallback por substring do nome.
    mockComandaList.mockResolvedValue([makeComanda()]);
    mockItemListByComandaIds.mockResolvedValue([
      makeItem({ service_id: 'sv1' }),
      makeItem({ id: 'i2', service_id: null, product_name: 'Shampoo' }),
    ]);

    const result = await loadComandasWithDetails('t1', 'start', 'end', staffMap, clientMap, serviceMap);

    const items = result.comandaDetails[0].items;
    expect(items.every((i) => i.type !== undefined)).toBe(true);
    expect(items.map((i) => i.type)).toEqual(['service', 'product']);
  });

  it('should_type_as_service_when_service_id_resolves_even_with_product_name', async () => {
    mockComandaList.mockResolvedValue([makeComanda()]);
    mockItemListByComandaIds.mockResolvedValue([
      makeItem({ service_id: 'sv1', product_name: 'Pomada Matiz', unit_price: 40 }),
    ]);

    const result = await loadComandasWithDetails('t1', 'start', 'end', staffMap, clientMap, serviceMap);

    const item = result.comandaDetails[0].items[0];
    expect(item.type).toBe('service');
    expect(item.serviceName).toBe('Corte');
  });

  it('should_type_as_service_when_neither_service_nor_product_name', async () => {
    mockComandaList.mockResolvedValue([makeComanda()]);
    mockItemListByComandaIds.mockResolvedValue([
      makeItem({ service_id: null, product_name: null }),
    ]);

    const result = await loadComandasWithDetails('t1', 'start', 'end', staffMap, clientMap, serviceMap);

    const item = result.comandaDetails[0].items[0];
    expect(item.type).toBe('service');
    expect(item.serviceName).toBe('Item');
  });

  it('should_type_as_product_when_service_id_absent_from_service_map', async () => {
    mockComandaList.mockResolvedValue([makeComanda()]);
    mockItemListByComandaIds.mockResolvedValue([
      makeItem({ service_id: 'sv-inexistente', product_name: 'Shampoo' }),
    ]);

    const result = await loadComandasWithDetails('t1', 'start', 'end', staffMap, clientMap, serviceMap);

    const item = result.comandaDetails[0].items[0];
    expect(item.type).toBe('product');
    expect(item.serviceName).toBe('Shampoo');
  });

  it('should_treat_blank_product_name_as_absent', async () => {
    mockComandaList.mockResolvedValue([makeComanda()]);
    mockItemListByComandaIds.mockResolvedValue([
      makeItem({ service_id: null, product_name: '   ' }),
    ]);

    const result = await loadComandasWithDetails('t1', 'start', 'end', staffMap, clientMap, serviceMap);

    expect(result.comandaDetails[0].items[0].type).toBe('service');
  });
});

describe('loadComandasWithDetails — paidAmount / pendingAmount (ADR-018)', () => {
  beforeEach(() => {
    mockComandaList.mockReset();
    mockItemListByComandaIds.mockReset();
  });

  it('should_assume_full_payment_when_legacy_comanda_paid_without_payment_rows', async () => {
    mockComandaList.mockResolvedValue([makeComanda({ status: 'paid', total: 100 })]);
    mockItemListByComandaIds.mockResolvedValue([makeItem({ unit_price: 100 })]);

    const result = await loadComandasWithDetails('t1', 'start', 'end', staffMap, clientMap, serviceMap);

    const cmd = result.comandaDetails[0];
    expect(cmd.paidAmount).toBe(100);
    expect(cmd.pendingAmount).toBe(0);
  });

  it('should_sum_only_settled_payments_when_partial_payment_rows_exist', async () => {
    mockComandaList.mockResolvedValue([makeComanda({ status: 'paid', total: 100 })]);
    mockItemListByComandaIds.mockResolvedValue([makeItem({ unit_price: 100 })]);
    const payments = [{ comanda_id: 'c1', amount: 60, payment_type: 'parcial', reversed_at: null }];

    const result = await loadComandasWithDetails(
      't1', 'start', 'end', staffMap, clientMap, serviceMap, payments,
    );

    const cmd = result.comandaDetails[0];
    expect(cmd.paidAmount).toBe(60);
    expect(cmd.pendingAmount).toBe(40);
  });

  it('should_ignore_reversed_payments_when_summing_paid_amount', async () => {
    mockComandaList.mockResolvedValue([makeComanda({ status: 'paid', total: 100 })]);
    mockItemListByComandaIds.mockResolvedValue([makeItem({ unit_price: 100 })]);
    const payments = [
      { comanda_id: 'c1', amount: 60, payment_type: 'parcial', reversed_at: null },
      { comanda_id: 'c1', amount: 100, payment_type: 'final', reversed_at: '2026-10-01T12:00:00Z' },
    ];

    const result = await loadComandasWithDetails(
      't1', 'start', 'end', staffMap, clientMap, serviceMap, payments,
    );

    const cmd = result.comandaDetails[0];
    // O pagamento estornado de 100 nao conta; resta 60 liquidados.
    expect(cmd.paidAmount).toBe(60);
    expect(cmd.pendingAmount).toBe(40);
  });

  it('should_treat_open_comanda_as_fully_pending', async () => {
    mockComandaList.mockResolvedValue([makeComanda({ status: 'open', total: 80 })]);
    mockItemListByComandaIds.mockResolvedValue([makeItem({ unit_price: 80 })]);

    const result = await loadComandasWithDetails('t1', 'start', 'end', staffMap, clientMap, serviceMap);

    const cmd = result.comandaDetails[0];
    expect(cmd.paidAmount).toBe(0);
    expect(cmd.pendingAmount).toBe(80);
  });

  it('should_never_yield_negative_pending_when_payments_exceed_total', async () => {
    mockComandaList.mockResolvedValue([makeComanda({ status: 'paid', total: 50 })]);
    mockItemListByComandaIds.mockResolvedValue([makeItem({ unit_price: 50 })]);
    const payments = [{ comanda_id: 'c1', amount: 70, payment_type: 'final', reversed_at: null }];

    const result = await loadComandasWithDetails(
      't1', 'start', 'end', staffMap, clientMap, serviceMap, payments,
    );

    const cmd = result.comandaDetails[0];
    expect(cmd.paidAmount).toBe(70);
    expect(cmd.pendingAmount).toBe(0);
  });
});
