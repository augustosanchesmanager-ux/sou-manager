import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks (topo do arquivo) ──────────────────────────────────────
const mockAppointmentGet = vi.fn();
vi.mock('../../domain/appointment/repository', () => ({
  appointmentRepository: {
    get: (...args: unknown[]) => mockAppointmentGet(...args),
  },
}));

const mockComandaList = vi.fn();
const mockComandaUpdate = vi.fn();
vi.mock('../../domain/comanda/repository', () => ({
  comandaRepository: {
    list: (...args: unknown[]) => mockComandaList(...args),
    update: (...args: unknown[]) => mockComandaUpdate(...args),
  },
}));

const mockComandaItemList = vi.fn();
const mockComandaItemUpdate = vi.fn();
vi.mock('../../domain/comanda/item-repository', () => ({
  comandaItemRepository: {
    list: (...args: unknown[]) => mockComandaItemList(...args),
    update: (...args: unknown[]) => mockComandaItemUpdate(...args),
  },
}));

const mockComandaPayments = vi.fn();
vi.mock('../../domain/comanda/comandaPaymentRepository', () => ({
  comandaPaymentRepository: {
    getPaymentsByComandaIds: (...args: unknown[]) => mockComandaPayments(...args),
  },
}));

// ─── Imports ──────────────────────────────────────────────────────
import { syncComandaForAppointmentUpdate } from './comandaSync';

// ─── Builders ─────────────────────────────────────────────────────
const makePreviousAppointment = (overrides: Record<string, unknown> = {}) => ({
  id: 'apt-1',
  tenant_id: 'tenant-1',
  service_id: 'svc-1',
  service_name: 'Corte',
  staff_id: 'staff-1',
  ...overrides,
});

const makeComanda = (overrides: Record<string, unknown> = {}) => ({
  id: 'com-1',
  tenant_id: 'tenant-1',
  client_id: 'client-1',
  appointment_id: 'apt-1',
  staff_id: 'staff-1',
  status: 'open',
  total: 50,
  payment_method: null,
  created_at: '2026-07-23T09:00:00',
  closed_at: null,
  ...overrides,
});

const makeItem = (overrides: Record<string, unknown> = {}) => ({
  id: 'item-1',
  comanda_id: 'com-1',
  service_id: 'svc-1',
  product_name: 'Corte',
  quantity: 1,
  unit_price: 50,
  staff_id: 'staff-1',
  ...overrides,
});

const arrangeOpenComanda = (itemOverrides: Record<string, unknown> = {}) => {
  mockAppointmentGet.mockResolvedValue(makePreviousAppointment());
  mockComandaList.mockResolvedValue([makeComanda()]);
  mockComandaPayments.mockResolvedValue([]);
  mockComandaItemList.mockResolvedValue([makeItem(itemOverrides)]);
  mockComandaItemUpdate.mockResolvedValue(undefined);
  mockComandaUpdate.mockResolvedValue(undefined);
};

describe('syncComandaForAppointmentUpdate', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should_update_item_and_professional_when_comanda_is_open', async () => {
    // Arrange: troca de profissional + serviço numa comanda aberta sem pagamentos.
    arrangeOpenComanda();

    // Act.
    const result = await syncComandaForAppointmentUpdate({
      tenantId: 'tenant-1',
      appointmentId: 'apt-1',
      staffId: 'staff-2',
      serviceId: 'svc-2',
      serviceName: 'Barba',
      unitPrice: 70,
    });

    // Assert: item atualizado in-place, cabeçalho com novo profissional e total recalculado.
    expect(result.status).toBe('synced');
    expect(mockComandaItemUpdate).toHaveBeenCalledTimes(1);
    expect(mockComandaItemUpdate).toHaveBeenCalledWith(
      'item-1',
      expect.objectContaining({
        staff_id: 'staff-2',
        service_id: 'svc-2',
        product_name: 'Barba',
        unit_price: 70,
      }),
      'tenant-1',
    );
    expect(mockComandaUpdate).toHaveBeenCalledWith(
      'com-1',
      expect.objectContaining({ staff_id: 'staff-2', total: 70 }),
      'tenant-1',
    );
  });

  it('should_keep_extra_items_untouched_when_comanda_has_more_items', async () => {
    // Arrange: item do agendamento + produto extra lançado no balcão.
    mockAppointmentGet.mockResolvedValue(makePreviousAppointment());
    mockComandaList.mockResolvedValue([makeComanda({ total: 90 })]);
    mockComandaPayments.mockResolvedValue([]);
    mockComandaItemList.mockResolvedValue([
      makeItem(),
      makeItem({ id: 'item-2', service_id: null, product_name: 'Pomada', quantity: 2, unit_price: 20, staff_id: 'staff-1' }),
    ]);
    mockComandaItemUpdate.mockResolvedValue(undefined);
    mockComandaUpdate.mockResolvedValue(undefined);

    // Act.
    const result = await syncComandaForAppointmentUpdate({
      tenantId: 'tenant-1',
      appointmentId: 'apt-1',
      staffId: 'staff-2',
      serviceId: 'svc-2',
      serviceName: 'Barba',
      unitPrice: 70,
    });

    // Assert: só o item do agendamento muda; extra preservado e somado no total.
    expect(result.status).toBe('synced');
    expect(mockComandaItemUpdate).toHaveBeenCalledTimes(1);
    expect(mockComandaItemUpdate).toHaveBeenCalledWith(
      'item-1',
      expect.objectContaining({ service_id: 'svc-2' }),
      'tenant-1',
    );
    expect(mockComandaUpdate).toHaveBeenCalledWith(
      'com-1',
      expect.objectContaining({ total: 110 }),
      'tenant-1',
    );
  });

  it('should_block_sync_when_comanda_is_paid', async () => {
    // Arrange: comanda vinculada já liquidada.
    mockAppointmentGet.mockResolvedValue(makePreviousAppointment());
    mockComandaList.mockResolvedValue([makeComanda({ status: 'paid', total: 50 })]);

    // Act.
    const result = await syncComandaForAppointmentUpdate({
      tenantId: 'tenant-1',
      appointmentId: 'apt-1',
      staffId: 'staff-2',
    });

    // Assert: nada é tocado e a UI recebe o bloqueio com mensagem.
    expect(result.status).toBe('blocked_closed');
    expect(result.comandaId).toBe('com-1');
    expect(result.message).toBeDefined();
    expect(mockComandaItemUpdate).not.toHaveBeenCalled();
    expect(mockComandaUpdate).not.toHaveBeenCalled();
  });

  it('should_block_sync_when_comanda_has_partial_payments', async () => {
    // Arrange: comanda aberta mas com pagamento parcial válido.
    mockAppointmentGet.mockResolvedValue(makePreviousAppointment());
    mockComandaList.mockResolvedValue([makeComanda()]);
    mockComandaPayments.mockResolvedValue([{ id: 'pay-1' }]);

    // Act.
    const result = await syncComandaForAppointmentUpdate({
      tenantId: 'tenant-1',
      appointmentId: 'apt-1',
      staffId: 'staff-2',
    });

    // Assert: bloqueio sem tocar em itens ou cabeçalho.
    expect(result.status).toBe('blocked_payment');
    expect(mockComandaItemList).not.toHaveBeenCalled();
    expect(mockComandaItemUpdate).not.toHaveBeenCalled();
    expect(mockComandaUpdate).not.toHaveBeenCalled();
  });

  it('should_return_no_comanda_when_appointment_has_no_linked_comanda', async () => {
    // Arrange: agendamento sem comanda vinculada.
    mockComandaList.mockResolvedValue([]);

    // Act.
    const result = await syncComandaForAppointmentUpdate({
      tenantId: 'tenant-1',
      appointmentId: 'apt-1',
      staffId: 'staff-2',
    });

    // Assert.
    expect(result.status).toBe('no_comanda');
    expect(mockComandaItemUpdate).not.toHaveBeenCalled();
    expect(mockComandaUpdate).not.toHaveBeenCalled();
  });

  it('should_sync_item_and_professional_when_comanda_is_blocked', async () => {
    // Arrange: agendamento futuro com comanda 'blocked'.
    mockAppointmentGet.mockResolvedValue(makePreviousAppointment());
    mockComandaList.mockResolvedValue([makeComanda({ status: 'blocked', total: 50 })]);
    mockComandaPayments.mockResolvedValue([]);
    mockComandaItemList.mockResolvedValue([makeItem()]);
    mockComandaItemUpdate.mockResolvedValue(undefined);
    mockComandaUpdate.mockResolvedValue(undefined);

    // Act.
    const result = await syncComandaForAppointmentUpdate({
      tenantId: 'tenant-1',
      appointmentId: 'apt-1',
      staffId: 'staff-2',
      serviceId: 'svc-2',
      serviceName: 'Barba',
      unitPrice: 65,
    });

    // Assert.
    expect(result).toEqual({
      status: 'synced',
      comandaId: 'com-1',
      comandaStatus: 'blocked',
    });
    expect(mockComandaItemUpdate).toHaveBeenCalledWith(
      'item-1',
      expect.objectContaining({
        staff_id: 'staff-2',
        service_id: 'svc-2',
        product_name: 'Barba',
        unit_price: 65,
      }),
      'tenant-1',
    );
    expect(mockComandaUpdate).toHaveBeenCalledWith(
      'com-1',
      expect.objectContaining({ staff_id: 'staff-2', total: 65 }),
      'tenant-1',
    );
  });

  it('should_transition_comanda_from_open_to_blocked_when_rescheduled_to_future_date_in_sao_paulo', async () => {
    // Arrange: comanda 'open' hoje (2026-07-23 em SP) reagendada para 2026-07-25.
    arrangeOpenComanda();

    // Act.
    const result = await syncComandaForAppointmentUpdate({
      tenantId: 'tenant-1',
      appointmentId: 'apt-1',
      staffId: 'staff-1',
      startTime: '2026-07-25T14:00:00.000Z',
      now: new Date('2026-07-23T15:00:00.000Z'),
    });

    // Assert.
    expect(result).toEqual({
      status: 'synced',
      comandaId: 'com-1',
      comandaStatus: 'blocked',
    });
    expect(mockComandaUpdate).toHaveBeenCalledWith(
      'com-1',
      expect.objectContaining({ status: 'blocked' }),
      'tenant-1',
    );
  });

  it('should_transition_comanda_from_blocked_to_open_when_rescheduled_to_today_in_sao_paulo', async () => {
    // Arrange: comanda 'blocked' antecipada para hoje às 22:30 BRT (01:30 UTC do dia seguinte).
    mockAppointmentGet.mockResolvedValue(makePreviousAppointment());
    mockComandaList.mockResolvedValue([makeComanda({ status: 'blocked', total: 50 })]);
    mockComandaPayments.mockResolvedValue([]);
    mockComandaItemList.mockResolvedValue([makeItem()]);
    mockComandaItemUpdate.mockResolvedValue(undefined);
    mockComandaUpdate.mockResolvedValue(undefined);

    // Act.
    const result = await syncComandaForAppointmentUpdate({
      tenantId: 'tenant-1',
      appointmentId: 'apt-1',
      staffId: 'staff-1',
      startTime: '2026-07-24T01:30:00.000Z',
      now: new Date('2026-07-23T15:00:00.000Z'),
    });

    // Assert: 2026-07-24T01:30:00Z = 2026-07-23 22:30 em America/Sao_Paulo (mesmo dia).
    expect(result).toEqual({
      status: 'synced',
      comandaId: 'com-1',
      comandaStatus: 'open',
    });
    expect(mockComandaUpdate).toHaveBeenCalledWith(
      'com-1',
      expect.objectContaining({ status: 'open' }),
      'tenant-1',
    );
  });

  it('should_sync_staff_id_across_multiple_service_items_while_preserving_counter_products', async () => {
    // Arrange: comanda com 2 itens de serviço e 1 produto de balcão (service_id: null).
    mockAppointmentGet.mockResolvedValue(makePreviousAppointment({ service_id: null }));
    mockComandaList.mockResolvedValue([makeComanda({ total: 115 })]);
    mockComandaPayments.mockResolvedValue([]);
    mockComandaItemList.mockResolvedValue([
      makeItem({ id: 'item-svc-1', service_id: 'svc-1', product_name: 'Corte', unit_price: 50, staff_id: 'staff-1' }),
      makeItem({ id: 'item-svc-2', service_id: 'svc-2', product_name: 'Barba', unit_price: 40, staff_id: 'staff-1' }),
      makeItem({ id: 'item-prod-1', service_id: null, product_name: 'Cerveja', unit_price: 25, staff_id: 'staff-balcao' }),
    ]);
    mockComandaItemUpdate.mockResolvedValue(undefined);
    mockComandaUpdate.mockResolvedValue(undefined);

    // Act: troca apenas de profissional (ex: drag-and-drop).
    const result = await syncComandaForAppointmentUpdate({
      tenantId: 'tenant-1',
      appointmentId: 'apt-1',
      staffId: 'staff-2',
    });

    // Assert: os 2 itens de serviço mudam para staff-2; o produto de balcão permanece intocado.
    expect(result.status).toBe('synced');
    expect(mockComandaItemUpdate).toHaveBeenCalledTimes(2);
    expect(mockComandaItemUpdate).toHaveBeenCalledWith('item-svc-1', { staff_id: 'staff-2' }, 'tenant-1');
    expect(mockComandaItemUpdate).toHaveBeenCalledWith('item-svc-2', { staff_id: 'staff-2' }, 'tenant-1');
  });

  it('should_block_sync_when_comanda_is_closed_or_billed', async () => {
    // Arrange: comanda vinculada com status 'closed'.
    mockAppointmentGet.mockResolvedValue(makePreviousAppointment());
    mockComandaList.mockResolvedValue([makeComanda({ status: 'closed', total: 50 })]);

    // Act.
    const resultClosed = await syncComandaForAppointmentUpdate({
      tenantId: 'tenant-1',
      appointmentId: 'apt-1',
      staffId: 'staff-2',
    });

    expect(resultClosed.status).toBe('blocked_closed');
    expect(resultClosed.message).toContain('reabertura contábil prévia');

    // Arrange: comanda vinculada com status 'billed'.
    mockComandaList.mockResolvedValue([makeComanda({ status: 'billed', total: 50 })]);

    const resultBilled = await syncComandaForAppointmentUpdate({
      tenantId: 'tenant-1',
      appointmentId: 'apt-1',
      staffId: 'staff-2',
    });

    expect(resultBilled.status).toBe('blocked_closed');
  });

  it('should_sync_staff_and_service_together_updating_service_item_and_preserving_counter_products', async () => {
    // Arrange: troca simultânea de profissional e serviço numa comanda que também possui produto de balcão.
    mockAppointmentGet.mockResolvedValue(makePreviousAppointment({ service_id: 'svc-1' }));
    mockComandaList.mockResolvedValue([makeComanda({ total: 75 })]);
    mockComandaPayments.mockResolvedValue([]);
    mockComandaItemList.mockResolvedValue([
      makeItem({ id: 'item-svc-1', service_id: 'svc-1', product_name: 'Corte', unit_price: 50, staff_id: 'staff-1' }),
      makeItem({ id: 'item-prod-1', service_id: null, product_name: 'Pomada', unit_price: 25, staff_id: 'staff-balcao' }),
    ]);
    mockComandaItemUpdate.mockResolvedValue(undefined);
    mockComandaUpdate.mockResolvedValue(undefined);

    // Act: troca simultânea de profissional e serviço.
    const result = await syncComandaForAppointmentUpdate({
      tenantId: 'tenant-1',
      appointmentId: 'apt-1',
      staffId: 'staff-2',
      serviceId: 'svc-2',
      serviceName: 'Barba',
      unitPrice: 40,
    });

    expect(result.status).toBe('synced');
    // Deve atualizar item de serviço in-place
    expect(mockComandaItemUpdate).toHaveBeenCalledWith(
      'item-svc-1',
      expect.objectContaining({
        staff_id: 'staff-2',
        service_id: 'svc-2',
        product_name: 'Barba',
        unit_price: 40,
      }),
      'tenant-1',
    );
    // Produto de balcão NÃO deve ser atualizado
    expect(mockComandaItemUpdate).not.toHaveBeenCalledWith(
      'item-prod-1',
      expect.anything(),
      expect.anything(),
    );
    // Comanda atualizada com novo total e novo staff_id
    expect(mockComandaUpdate).toHaveBeenCalledWith(
      'com-1',
      expect.objectContaining({
        staff_id: 'staff-2',
        total: 65, // 40 (novo serviço) + 25 (produto existente)
      }),
      'tenant-1',
    );
  });
});
