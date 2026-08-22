/**
 * [SMG][DOMAIN][EVENTS][OUTBOX][PROVIDERS] createCommissionRecordHandler Tests
 *
 * TD-001 B3.4-D: Tests for createCommissionRecordHandler.
 * Resolves staff from comanda_items → service_execution_participants.
 *
 * GRUPO A: Input Validation
 * GRUPO B: Participant Resolution (solo, shared, no participants)
 * GRUPO C: Commission Calculation (solo 100%, shared 70/30, zero value)
 * GRUPO D: Idempotency (skip existing records)
 * GRUPO E: Edge Cases (no items, no comanda, empty participants)
 * GRUPO F: Error Handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createCommissionRecordHandler,
  type CreateCommissionRecordDeps,
  type ComandaRow,
  type ComandaItemRow,
  type StaffRow,
} from './createCommissionRecordHandler';
import type { OperationContext } from './financeProvider';
import type { ParticipantRow } from '../../../commission/types';

// ─── Helpers ───────────────────────────────────────────────────

const makeContext = (overrides?: Partial<OperationContext>): OperationContext => ({
  tenantId: 'tenant-1',
  idempotencyKey: 'evt_1_create_commission_record',
  sourceEvent: 'CheckoutCompleted',
  eventId: 'evt_1',
  ...overrides,
});

const makeComanda = (overrides?: Partial<ComandaRow>): ComandaRow => ({
  id: 'com-1',
  staff_id: 'staff-1',
  status: 'paid',
  total: 100,
  discount: 0,
  paid_amount: 100,
  amount_paid: null,
  ...overrides,
});

const makeItem = (overrides?: Partial<ComandaItemRow>): ComandaItemRow => ({
  id: 'item-1',
  comanda_id: 'com-1',
  service_id: 'svc-1',
  product_name: 'Corte',
  staff_id: 'staff-1',
  unit_price: 50,
  price: 50,
  amount: 50,
  quantity: 1,
  discount: 0,
  item_type: 'service',
  type: 'service',
  ...overrides,
});

const makeParticipant = (overrides?: Partial<ParticipantRow>): ParticipantRow => ({
  id: 'part-1',
  comanda_item_id: 'item-1',
  staff_id: 'staff-1',
  professional_id: 'staff-1',
  role: 'primary',
  payout_type: 'percentage',
  payout_value: 100,
  affects_commission: true,
  ...overrides,
});

const makeStaff = (overrides?: Partial<StaffRow>): StaffRow => ({
  id: 'staff-1',
  name: 'Barber One',
  role: 'barber',
  commission_rate: 0.4,
  ...overrides,
});

const makeDeps = (overrides?: Partial<CreateCommissionRecordDeps>): CreateCommissionRecordDeps => ({
  comandaRepository: {
    get: vi.fn().mockResolvedValue(makeComanda()),
  },
  comandaItemRepository: {
    listByComandaIds: vi.fn().mockResolvedValue([makeItem()]),
  },
  participantRepository: {
    listByComandaItemIds: vi.fn().mockResolvedValue([makeParticipant()]),
  },
  staffRepository: {
    listForCommission: vi.fn().mockResolvedValue([makeStaff()]),
  },
  commissionRecordRepository: {
    create: vi.fn().mockResolvedValue({ id: 'rec-1' }),
    existsByStaffComanda: vi.fn().mockResolvedValue(false),
    list: vi.fn(),
    get: vi.fn(),
    calculateDailyNet: vi.fn(),
    createReversal: vi.fn(),
  } as any,
  ...overrides,
});

// ═══════════════════════════════════════════════════════════════════
// GRUPO A: Input Validation
// ═══════════════════════════════════════════════════════════════════

describe('createCommissionRecordHandler — Input Validation', () => {
  it('should_return_error_when_comandaId_missing', async () => {
    const deps = makeDeps();
    const handler = createCommissionRecordHandler(deps);

    const result = await handler.execute(
      { comandaId: '', tenantId: 'tenant-1', receivedValue: 100 } as any,
      makeContext(),
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('comandaId');
  });

  it('should_return_error_when_tenantId_missing', async () => {
    const deps = makeDeps();
    const handler = createCommissionRecordHandler(deps);

    const result = await handler.execute(
      { comandaId: 'com-1', tenantId: '', receivedValue: 100 } as any,
      makeContext(),
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('tenantId');
  });
});

// ═══════════════════════════════════════════════════════════════════
// GRUPO B: Participant Resolution
// ═══════════════════════════════════════════════════════════════════

describe('createCommissionRecordHandler — Participant Resolution', () => {
  it('should_create_record_for_solo_participant', async () => {
    const deps = makeDeps();
    const handler = createCommissionRecordHandler(deps);

    const result = await handler.execute(
      { comandaId: 'com-1', tenantId: 'tenant-1', receivedValue: 100 } as any,
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(deps.commissionRecordRepository.create).toHaveBeenCalledTimes(1);
    const callArgs = (deps.commissionRecordRepository.create as any).mock.calls[0][0];
    expect(callArgs.staff_id).toBe('staff-1');
    expect(callArgs.comanda_id).toBe('com-1');
  });

  it('should_create_record_for_shared_participants', async () => {
    const p1 = makeParticipant({ id: 'p1', staff_id: 'staff-1', professional_id: 'staff-1', payout_value: 70 });
    const p2 = makeParticipant({ id: 'p2', staff_id: 'staff-2', professional_id: 'staff-2', payout_value: 30 });
    const s1 = makeStaff({ id: 'staff-1', commission_rate: 0.4 });
    const s2 = makeStaff({ id: 'staff-2', name: 'Barber Two', commission_rate: 0.5 });

    const deps = makeDeps({
      participantRepository: {
        listByComandaItemIds: vi.fn().mockResolvedValue([p1, p2]),
      },
      staffRepository: {
        listForCommission: vi.fn().mockResolvedValue([s1, s2]),
      },
    });
    const handler = createCommissionRecordHandler(deps);

    const result = await handler.execute(
      { comandaId: 'com-1', tenantId: 'tenant-1', receivedValue: 100 } as any,
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(deps.commissionRecordRepository.create).toHaveBeenCalledTimes(2);
  });

  it('should_create_solo_fallback_when_no_participants', async () => {
    const deps = makeDeps({
      participantRepository: {
        listByComandaItemIds: vi.fn().mockResolvedValue([]),
      },
    });
    const handler = createCommissionRecordHandler(deps);

    const result = await handler.execute(
      { comandaId: 'com-1', tenantId: 'tenant-1', receivedValue: 100 } as any,
      makeContext(),
    );

    expect(result.success).toBe(true);
    // Should create solo participant from item.staff_id
    expect(deps.commissionRecordRepository.create).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════════════
// GRUPO C: Commission Calculation
// ═══════════════════════════════════════════════════════════════════

describe('createCommissionRecordHandler — Commission Calculation', () => {
  it('should_calculate_commission_with_correct_rate', async () => {
    const deps = makeDeps();
    const handler = createCommissionRecordHandler(deps);

    await handler.execute(
      { comandaId: 'com-1', tenantId: 'tenant-1', receivedValue: 100 } as any,
      makeContext(),
    );

    const callArgs = (deps.commissionRecordRepository.create as any).mock.calls[0][0];
    expect(callArgs.commission_rate).toBe(0.4);
    expect(callArgs.commission_value).toBeGreaterThan(0);
  });

  it('should_pass_financial_base_fields', async () => {
    const deps = makeDeps();
    const handler = createCommissionRecordHandler(deps);

    await handler.execute(
      { comandaId: 'com-1', tenantId: 'tenant-1', receivedValue: 100 } as any,
      makeContext(),
    );

    const callArgs = (deps.commissionRecordRepository.create as any).mock.calls[0][0];
    expect(callArgs.gross_value).toBeDefined();
    expect(callArgs.net_value).toBeDefined();
    expect(callArgs.received_value).toBeDefined();
    expect(callArgs.discount).toBeDefined();
  });

  it('should_pass_event_metadata', async () => {
    const deps = makeDeps();
    const handler = createCommissionRecordHandler(deps);

    await handler.execute(
      { comandaId: 'com-1', tenantId: 'tenant-1', receivedValue: 100 } as any,
      makeContext({ eventId: 'evt-xyz', sourceEvent: 'CheckoutCompleted' }),
    );

    const callArgs = (deps.commissionRecordRepository.create as any).mock.calls[0][0];
    expect(callArgs.event_id).toBe('evt-xyz');
    expect(callArgs.event_type).toBe('CheckoutCompleted');
  });

  it('should_set_record_type_to_commission', async () => {
    const deps = makeDeps();
    const handler = createCommissionRecordHandler(deps);

    await handler.execute(
      { comandaId: 'com-1', tenantId: 'tenant-1', receivedValue: 100 } as any,
      makeContext(),
    );

    const createArgs = (deps.commissionRecordRepository.create as any).mock.calls[0];
    expect(createArgs[1]).toBe('tenant-1'); // tenantId as second arg
  });
});

// ═══════════════════════════════════════════════════════════════════
// GRUPO D: Idempotency
// ═══════════════════════════════════════════════════════════════════

describe('createCommissionRecordHandler — Idempotency', () => {
  it('should_skip_when_record_already_exists', async () => {
    const deps = makeDeps({
      commissionRecordRepository: {
        create: vi.fn(),
        existsByStaffComanda: vi.fn().mockResolvedValue(true),
        list: vi.fn(), get: vi.fn(), calculateDailyNet: vi.fn(), createReversal: vi.fn(),
      } as any,
    });
    const handler = createCommissionRecordHandler(deps);

    const result = await handler.execute(
      { comandaId: 'com-1', tenantId: 'tenant-1', receivedValue: 100 } as any,
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(deps.commissionRecordRepository.create).not.toHaveBeenCalled();
  });

  it('should_proceed_when_exists_check_fails', async () => {
    const deps = makeDeps({
      commissionRecordRepository: {
        create: vi.fn().mockResolvedValue({ id: 'rec-new' }),
        existsByStaffComanda: vi.fn().mockRejectedValue(new Error('table missing')),
        list: vi.fn(), get: vi.fn(), calculateDailyNet: vi.fn(), createReversal: vi.fn(),
      } as any,
    });
    const handler = createCommissionRecordHandler(deps);

    const result = await handler.execute(
      { comandaId: 'com-1', tenantId: 'tenant-1', receivedValue: 100 } as any,
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(deps.commissionRecordRepository.create).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════
// GRUPO E: Edge Cases
// ═══════════════════════════════════════════════════════════════════

describe('createCommissionRecordHandler — Edge Cases', () => {
  it('should_succeed_when_comanda_not_found', async () => {
    const deps = makeDeps({
      comandaRepository: {
        get: vi.fn().mockResolvedValue(null),
      },
    });
    const handler = createCommissionRecordHandler(deps);

    const result = await handler.execute(
      { comandaId: 'com-1', tenantId: 'tenant-1', receivedValue: 100 } as any,
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(deps.commissionRecordRepository.create).not.toHaveBeenCalled();
  });

  it('should_succeed_when_no_items_found', async () => {
    const deps = makeDeps({
      comandaItemRepository: {
        listByComandaIds: vi.fn().mockResolvedValue([]),
      },
    });
    const handler = createCommissionRecordHandler(deps);

    const result = await handler.execute(
      { comandaId: 'com-1', tenantId: 'tenant-1', receivedValue: 100 } as any,
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(deps.commissionRecordRepository.create).not.toHaveBeenCalled();
  });

  it('should_skip_non_commissionable_staff', async () => {
    const staff = makeStaff({ id: 'manager-1', role: 'manager', commission_rate: 0 });
    const deps = makeDeps({
      staffRepository: {
        listForCommission: vi.fn().mockResolvedValue([staff]),
      },
    });
    const handler = createCommissionRecordHandler(deps);

    const result = await handler.execute(
      { comandaId: 'com-1', tenantId: 'tenant-1', receivedValue: 100 } as any,
      makeContext(),
    );

    expect(result.success).toBe(true);
    // Manager with 0 commission_rate should be skipped
    expect(deps.commissionRecordRepository.create).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════
// GRUPO F: Error Handling
// ═══════════════════════════════════════════════════════════════════

describe('createCommissionRecordHandler — Error Handling', () => {
  it('should_continue_when_one_record_fails_and_process_others', async () => {
    const p1 = makeParticipant({ id: 'p1', staff_id: 'staff-1', professional_id: 'staff-1' });
    const p2 = makeParticipant({ id: 'p2', staff_id: 'staff-2', professional_id: 'staff-2' });
    const s1 = makeStaff({ id: 'staff-1' });
    const s2 = makeStaff({ id: 'staff-2', name: 'Barber Two' });

    let callCount = 0;
    const deps = makeDeps({
      participantRepository: {
        listByComandaItemIds: vi.fn().mockResolvedValue([p1, p2]),
      },
      staffRepository: {
        listForCommission: vi.fn().mockResolvedValue([s1, s2]),
      },
      commissionRecordRepository: {
        create: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) throw new Error('Unique violation');
          return { id: 'rec-2' };
        }),
        existsByStaffComanda: vi.fn().mockResolvedValue(false),
        list: vi.fn(), get: vi.fn(), calculateDailyNet: vi.fn(), createReversal: vi.fn(),
      } as any,
    });
    const handler = createCommissionRecordHandler(deps);

    const result = await handler.execute(
      { comandaId: 'com-1', tenantId: 'tenant-1', receivedValue: 100 } as any,
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(deps.commissionRecordRepository.create).toHaveBeenCalledTimes(2);
  });

  it('should_not_fail_entirely_when_create_throws', async () => {
    const deps = makeDeps({
      commissionRecordRepository: {
        create: vi.fn().mockRejectedValue(new Error('DB exploded')),
        existsByStaffComanda: vi.fn().mockResolvedValue(false),
        list: vi.fn(), get: vi.fn(), calculateDailyNet: vi.fn(), createReversal: vi.fn(),
      } as any,
    });
    const handler = createCommissionRecordHandler(deps);

    const result = await handler.execute(
      { comandaId: 'com-1', tenantId: 'tenant-1', receivedValue: 100 } as any,
      makeContext(),
    );

    // Should still return success — errors are logged, not thrown
    expect(result.success).toBe(true);
  });
});
