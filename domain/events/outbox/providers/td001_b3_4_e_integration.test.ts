/**
 * [SMG][DOMAIN][EVENTS][OUTBOX][PROVIDERS] TD-001 B3.4-E Integration Tests
 *
 * Integration tests for FinanceProvider handlers covering:
 *   1. Idempotency — replay, different events for same comanda/staff
 *   2. Shared execution — 2 professionals → 2 records, replay → still 2
 *   3. Clube do Chefe — receivedValue=0 → no commission
 *   4. Reversal — integral, partial, concurrent, replay, already reversed
 *   5. Integrity — UNIQUE constraint simulation, append-only, values preserved
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createCommissionRecordHandler,
  type CreateCommissionRecordDeps,
  type ComandaRow,
  type ComandaItemRow,
  type StaffRow,
} from './createCommissionRecordHandler';
import {
  createReverseCommissionHandler,
  type ReverseCommissionData,
  type ReverseCommissionHandlerDeps,
} from './reverseCommissionHandler';
import type { OperationContext } from './financeProvider';
import type { ParticipantRow } from '../../../commission/types';
import type { CommissionRecord } from '../../../commission/commissionRecordTypes';

// ─── Shared Helpers ─────────────────────────────────────────────

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

const makeCreateDeps = (overrides?: Partial<CreateCommissionRecordDeps>): CreateCommissionRecordDeps => ({
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

const makeRecord = (overrides?: Partial<CommissionRecord>): CommissionRecord => ({
  id: 'rec-1',
  tenant_id: 'tenant-1',
  record_type: 'commission',
  comanda_id: 'com-1',
  comanda_item_id: 'item-1',
  staff_id: 'staff-1',
  gross_value: 100,
  discount: 0,
  net_value: 100,
  received_value: 100,
  commission_rate: 0.4,
  commission_value: 40,
  participant_share: 1.0,
  payout_type: 'percentage',
  affects_commission: true,
  original_record_id: null,
  idempotency_key: 'key-1',
  event_id: null,
  event_type: null,
  status: 'active',
  created_at: new Date().toISOString(),
  ...overrides,
});

const makeReverseDeps = (overrides?: Partial<ReverseCommissionHandlerDeps>): ReverseCommissionHandlerDeps => ({
  commissionRecordRepository: {
    list: vi.fn().mockResolvedValue([makeRecord()]),
    createReversal: vi.fn().mockResolvedValue({ success: true }),
    create: vi.fn(),
    get: vi.fn(),
    existsByStaffComanda: vi.fn(),
    calculateDailyNet: vi.fn(),
  } as any,
  ...overrides,
});

const makeReverseData = (overrides?: Partial<ReverseCommissionData>): ReverseCommissionData => ({
  comandaId: 'com-1',
  tenantId: 'tenant-1',
  reversedAmount: 100,
  originalCommission: 50,
  originalReceivedValue: 100,
  commissionReversal: 50,
  ...overrides,
});

// ═══════════════════════════════════════════════════════════════════
// 1. IDEMPOTENCY
// ═══════════════════════════════════════════════════════════════════

describe('B3.4-E Idempotency', () => {
  describe('replay of same CheckoutCompleted event', () => {
    it('should_skip_when_same_event_replayed', async () => {
      const deps = makeCreateDeps({
        commissionRecordRepository: {
          create: vi.fn().mockResolvedValue({ id: 'rec-1' }),
          existsByStaffComanda: vi.fn().mockResolvedValue(false),
          list: vi.fn(), get: vi.fn(), calculateDailyNet: vi.fn(), createReversal: vi.fn(),
        } as any,
      });
      const handler = createCommissionRecordHandler(deps);
      const ctx = makeContext({ eventId: 'evt_A', idempotencyKey: 'evt_A_create_commission_record' });

      const result1 = await handler.execute(
        { comandaId: 'com-1', tenantId: 'tenant-1', receivedValue: 100 } as any,
        ctx,
      );

      expect(result1.success).toBe(true);
      expect(deps.commissionRecordRepository.create).toHaveBeenCalledTimes(1);

      // Simulate replay: existsByStaffComanda now returns true
      (deps.commissionRecordRepository.existsByStaffComanda as any).mockResolvedValue(true);

      const result2 = await handler.execute(
        { comandaId: 'com-1', tenantId: 'tenant-1', receivedValue: 100 } as any,
        ctx,
      );

      expect(result2.success).toBe(true);
      expect(deps.commissionRecordRepository.create).toHaveBeenCalledTimes(1); // No new record
    });
  });

  describe('different events for same comanda/staff', () => {
    it('should_skip_second_event_when_record_exists', async () => {
      const deps = makeCreateDeps({
        commissionRecordRepository: {
          create: vi.fn().mockResolvedValue({ id: 'rec-1' }),
          existsByStaffComanda: vi.fn().mockResolvedValue(false),
          list: vi.fn(), get: vi.fn(), calculateDailyNet: vi.fn(), createReversal: vi.fn(),
        } as any,
      });
      const handler = createCommissionRecordHandler(deps);

      // First event
      const ctx1 = makeContext({ eventId: 'evt_A', idempotencyKey: 'evt_A_create_commission_record' });
      await handler.execute(
        { comandaId: 'com-1', tenantId: 'tenant-1', receivedValue: 100 } as any,
        ctx1,
      );
      expect(deps.commissionRecordRepository.create).toHaveBeenCalledTimes(1);

      // Second event (different eventId) for same comanda/staff
      // existsByStaffComanda now returns true (record from first event exists)
      (deps.commissionRecordRepository.existsByStaffComanda as any).mockResolvedValue(true);
      const ctx2 = makeContext({ eventId: 'evt_B', idempotencyKey: 'evt_B_create_commission_record' });
      await handler.execute(
        { comandaId: 'com-1', tenantId: 'tenant-1', receivedValue: 100 } as any,
        ctx2,
      );
      expect(deps.commissionRecordRepository.create).toHaveBeenCalledTimes(1); // Still 1
    });
  });

  describe('sequential calls with existsByStaffComanda', () => {
    it('should_create_only_once_across_sequential_calls', async () => {
      let existsCallCount = 0;
      const deps = makeCreateDeps({
        commissionRecordRepository: {
          create: vi.fn().mockResolvedValue({ id: 'rec-1' }),
          existsByStaffComanda: vi.fn().mockImplementation(async () => {
            existsCallCount++;
            return existsCallCount > 1; // First call: false, subsequent: true
          }),
          list: vi.fn(), get: vi.fn(), calculateDailyNet: vi.fn(), createReversal: vi.fn(),
        } as any,
      });
      const handler = createCommissionRecordHandler(deps);

      await handler.execute(
        { comandaId: 'com-1', tenantId: 'tenant-1', receivedValue: 100 } as any,
        makeContext({ eventId: 'evt_A' }),
      );
      await handler.execute(
        { comandaId: 'com-1', tenantId: 'tenant-1', receivedValue: 100 } as any,
        makeContext({ eventId: 'evt_B' }),
      );
      await handler.execute(
        { comandaId: 'com-1', tenantId: 'tenant-1', receivedValue: 100 } as any,
        makeContext({ eventId: 'evt_C' }),
      );

      expect(deps.commissionRecordRepository.create).toHaveBeenCalledTimes(1);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// 2. SHARED EXECUTION
// ═══════════════════════════════════════════════════════════════════

describe('B3.4-E Shared Execution', () => {
  it('should_create_2_independent_records_for_2_professionals', async () => {
    const p1 = makeParticipant({ id: 'p1', staff_id: 'staff-1', professional_id: 'staff-1', payout_value: 70 });
    const p2 = makeParticipant({ id: 'p2', staff_id: 'staff-2', professional_id: 'staff-2', payout_value: 30 });
    const s1 = makeStaff({ id: 'staff-1', commission_rate: 0.4 });
    const s2 = makeStaff({ id: 'staff-2', name: 'Barber Two', commission_rate: 0.5 });

    const createCalls: any[] = [];
    const deps = makeCreateDeps({
      participantRepository: {
        listByComandaItemIds: vi.fn().mockResolvedValue([p1, p2]),
      },
      staffRepository: {
        listForCommission: vi.fn().mockResolvedValue([s1, s2]),
      },
      commissionRecordRepository: {
        create: vi.fn().mockImplementation(async (input: any) => {
          createCalls.push({ ...input });
          return { id: `rec-${createCalls.length}` };
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

    // Verify independent staff_ids
    expect(createCalls[0].staff_id).toBe('staff-1');
    expect(createCalls[1].staff_id).toBe('staff-2');

    // Verify different commission values (70% vs 30% split)
    expect(createCalls[0].commission_value).toBeGreaterThan(createCalls[1].commission_value);
  });

  it('should_still_have_2_records_after_replay', async () => {
    const p1 = makeParticipant({ id: 'p1', staff_id: 'staff-1', professional_id: 'staff-1', payout_value: 70 });
    const p2 = makeParticipant({ id: 'p2', staff_id: 'staff-2', professional_id: 'staff-2', payout_value: 30 });
    const s1 = makeStaff({ id: 'staff-1', commission_rate: 0.4 });
    const s2 = makeStaff({ id: 'staff-2', name: 'Barber Two', commission_rate: 0.5 });

    let existsForStaff1 = false;
    let existsForStaff2 = false;

    const deps = makeCreateDeps({
      participantRepository: {
        listByComandaItemIds: vi.fn().mockResolvedValue([p1, p2]),
      },
      staffRepository: {
        listForCommission: vi.fn().mockResolvedValue([s1, s2]),
      },
      commissionRecordRepository: {
        create: vi.fn().mockResolvedValue({ id: 'rec-new' }),
        existsByStaffComanda: vi.fn().mockImplementation(async (staffId: string) => {
          if (staffId === 'staff-1') return existsForStaff1;
          if (staffId === 'staff-2') return existsForStaff2;
          return false;
        }),
        list: vi.fn(), get: vi.fn(), calculateDailyNet: vi.fn(), createReversal: vi.fn(),
      } as any,
    });
    const handler = createCommissionRecordHandler(deps);
    const ctx = makeContext({ eventId: 'evt_shared', idempotencyKey: 'evt_shared_create_commission_record' });

    // First execution — no records exist
    await handler.execute(
      { comandaId: 'com-1', tenantId: 'tenant-1', receivedValue: 100 } as any,
      ctx,
    );
    expect(deps.commissionRecordRepository.create).toHaveBeenCalledTimes(2);

    // Both records now exist
    existsForStaff1 = true;
    existsForStaff2 = true;

    // Replay — should create 0 new records
    await handler.execute(
      { comandaId: 'com-1', tenantId: 'tenant-1', receivedValue: 100 } as any,
      ctx,
    );
    expect(deps.commissionRecordRepository.create).toHaveBeenCalledTimes(2); // Still 2, not 4
  });
});

// ═══════════════════════════════════════════════════════════════════
// 3. CLUBE DO CHEFE
// ═══════════════════════════════════════════════════════════════════

describe('B3.4-E Clube do Chefe', () => {
  it('should_create_no_commission_when_unit_price_is_zero', async () => {
    const item = makeItem({ unit_price: 0, price: 0, amount: 0 });
    const deps = makeCreateDeps({
      comandaItemRepository: {
        listByComandaIds: vi.fn().mockResolvedValue([item]),
      },
    });
    const handler = createCommissionRecordHandler(deps);

    const result = await handler.execute(
      { comandaId: 'com-1', tenantId: 'tenant-1', receivedValue: 0 } as any,
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(deps.commissionRecordRepository.create).not.toHaveBeenCalled();
  });

  it('should_create_no_commission_when_receivedValue_is_zero', async () => {
    const item = makeItem({ unit_price: 0, price: 0, amount: 0 });
    const comanda = makeComanda({ total: 0, paid_amount: 0 });
    const deps = makeCreateDeps({
      comandaRepository: {
        get: vi.fn().mockResolvedValue(comanda),
      },
      comandaItemRepository: {
        listByComandaIds: vi.fn().mockResolvedValue([item]),
      },
    });
    const handler = createCommissionRecordHandler(deps);

    const result = await handler.execute(
      { comandaId: 'com-1', tenantId: 'tenant-1', receivedValue: 0 } as any,
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(deps.commissionRecordRepository.create).not.toHaveBeenCalled();
  });

  it('should_create_commission_when_receivedValue_is_positive', async () => {
    const deps = makeCreateDeps();
    const handler = createCommissionRecordHandler(deps);

    const result = await handler.execute(
      { comandaId: 'com-1', tenantId: 'tenant-1', receivedValue: 100 } as any,
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(deps.commissionRecordRepository.create).toHaveBeenCalledTimes(1);
    const callArgs = (deps.commissionRecordRepository.create as any).mock.calls[0][0];
    expect(callArgs.commission_value).toBeGreaterThan(0);
  });

  it('should_create_no_commission_when_item_discount_covers_full_value', async () => {
    const item = makeItem({ unit_price: 50, discount: 50 });
    const comanda = makeComanda({ total: 50, paid_amount: 0 });
    const deps = makeCreateDeps({
      comandaRepository: {
        get: vi.fn().mockResolvedValue(comanda),
      },
      comandaItemRepository: {
        listByComandaIds: vi.fn().mockResolvedValue([item]),
      },
    });
    const handler = createCommissionRecordHandler(deps);

    const result = await handler.execute(
      { comandaId: 'com-1', tenantId: 'tenant-1', receivedValue: 0 } as any,
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(deps.commissionRecordRepository.create).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════
// 4. REVERSAL
// ═══════════════════════════════════════════════════════════════════

describe('B3.4-E Reversal', () => {
  describe('integral reversal', () => {
    it('should_reverse_100_percent_when_reversedAmount_equals_originalReceivedValue', async () => {
      const record = makeRecord({ commission_value: 40, received_value: 100 });
      const deps = makeReverseDeps({
        commissionRecordRepository: {
          list: vi.fn().mockResolvedValue([record]),
          createReversal: vi.fn().mockResolvedValue({ success: true }),
          create: vi.fn(), get: vi.fn(), existsByStaffComanda: vi.fn(), calculateDailyNet: vi.fn(),
        } as any,
      });
      const handler = createReverseCommissionHandler(deps);
      const data = makeReverseData({ reversedAmount: 100, originalReceivedValue: 100 });

      await handler.execute(data as any, makeContext());

      const callArgs = (deps.commissionRecordRepository.createReversal as any).mock.calls[0][0];
      // proportion = min(1, 100/100) = 1, reversal = 40 × 1 = 40
      expect(callArgs.commissionValue).toBeCloseTo(40, 1);
    });
  });

  describe('partial reversal', () => {
    it('should_reverse_proportionally_when_reversedAmount_is_less_than_original', async () => {
      const record = makeRecord({ commission_value: 40, received_value: 100 });
      const deps = makeReverseDeps({
        commissionRecordRepository: {
          list: vi.fn().mockResolvedValue([record]),
          createReversal: vi.fn().mockResolvedValue({ success: true }),
          create: vi.fn(), get: vi.fn(), existsByStaffComanda: vi.fn(), calculateDailyNet: vi.fn(),
        } as any,
      });
      const handler = createReverseCommissionHandler(deps);
      const data = makeReverseData({ reversedAmount: 50, originalReceivedValue: 100 });

      await handler.execute(data as any, makeContext());

      const callArgs = (deps.commissionRecordRepository.createReversal as any).mock.calls[0][0];
      // proportion = 50/100 = 0.5, reversal = 40 × 0.5 = 20
      expect(callArgs.commissionValue).toBeCloseTo(20, 1);
    });
  });

  describe('concurrent reversals', () => {
    it('should_handle_two_sequential_reversals_for_different_comandas', async () => {
      const record1 = makeRecord({ id: 'rec-1', comanda_id: 'com-1', commission_value: 40, received_value: 100 });
      const record2 = makeRecord({ id: 'rec-2', comanda_id: 'com-2', commission_value: 30, received_value: 80 });

      const deps = makeReverseDeps({
        commissionRecordRepository: {
          list: vi.fn().mockImplementation(async (_tenantId: string, opts?: any) => {
            if (opts?.record_type === 'reversal') return [];
            if (opts?.comanda_id === 'com-1') return [record1];
            if (opts?.comanda_id === 'com-2') return [record2];
            return [];
          }),
          createReversal: vi.fn().mockResolvedValue({ success: true }),
          create: vi.fn(), get: vi.fn(), existsByStaffComanda: vi.fn(), calculateDailyNet: vi.fn(),
        } as any,
      });
      const handler = createReverseCommissionHandler(deps);

      const data1 = makeReverseData({ comandaId: 'com-1', reversedAmount: 50, originalReceivedValue: 100 });
      const data2 = makeReverseData({ comandaId: 'com-2', reversedAmount: 40, originalReceivedValue: 80 });

      const result1 = await handler.execute(data1 as any, makeContext({ eventId: 'evt_rev_1' }));
      const result2 = await handler.execute(data2 as any, makeContext({ eventId: 'evt_rev_2' }));

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(deps.commissionRecordRepository.createReversal).toHaveBeenCalledTimes(2);
    });
  });

  describe('replay of reversal', () => {
    it('should_skip_when_reversal_already_exists', async () => {
      const original = makeRecord({ id: 'rec-1', status: 'active', commission_value: 40, received_value: 100 });
      const reversal = makeRecord({
        id: 'rev-1', status: 'active', record_type: 'reversal', original_record_id: 'rec-1',
      });
      const deps = makeReverseDeps({
        commissionRecordRepository: {
          list: vi.fn()
            .mockResolvedValueOnce([original])   // commission records
            .mockResolvedValueOnce([reversal]),   // reversal check
          createReversal: vi.fn(),
          create: vi.fn(), get: vi.fn(), existsByStaffComanda: vi.fn(), calculateDailyNet: vi.fn(),
        } as any,
      });
      const handler = createReverseCommissionHandler(deps);

      // First execution
      await handler.execute(makeReverseData() as any, makeContext());
      expect(deps.commissionRecordRepository.createReversal).not.toHaveBeenCalled();

      // Replay (same event) — reversal still exists
      await handler.execute(makeReverseData() as any, makeContext({ eventId: 'evt_1_replay' }));
      expect(deps.commissionRecordRepository.createReversal).not.toHaveBeenCalled();
    });
  });

  describe('reversal after fully reversed', () => {
    it('should_skip_when_already_fully_reversed', async () => {
      const original = makeRecord({ id: 'rec-1', status: 'active', commission_value: 40, received_value: 100 });
      // Existing reversal that already covers the full amount
      const fullReversal = makeRecord({
        id: 'rev-full', status: 'active', record_type: 'reversal',
        original_record_id: 'rec-1', commission_value: -40,
      });
      const deps = makeReverseDeps({
        commissionRecordRepository: {
          list: vi.fn()
            .mockResolvedValueOnce([original])
            .mockResolvedValueOnce([fullReversal]),
          createReversal: vi.fn(),
          create: vi.fn(), get: vi.fn(), existsByStaffComanda: vi.fn(), calculateDailyNet: vi.fn(),
        } as any,
      });
      const handler = createReverseCommissionHandler(deps);
      const data = makeReverseData({ reversedAmount: 100, originalReceivedValue: 100 });

      const result = await handler.execute(data as any, makeContext());

      expect(result.success).toBe(true);
      // alreadyReversed check returns true → skip
      expect(deps.commissionRecordRepository.createReversal).not.toHaveBeenCalled();
    });
  });

  describe('concurrent reversals on same original record', () => {
    it('should_prevent_double_reversal_via_rpc_advisory_lock', async () => {
      // original commission = R$100
      // Two concurrent handlers each attempt to reverse R$100
      // RPC advisory lock + SUM validation must reject the second
      const original = makeRecord({ id: 'rec-1', commission_value: 100, received_value: 200 });

      let rpcCallCount = 0;
      const dbReversals: CommissionRecord[] = [];

      const deps = makeReverseDeps({
        commissionRecordRepository: {
          list: vi.fn().mockImplementation(async (_tenantId: string, opts?: any) => {
            if (opts?.record_type === 'reversal') return [...dbReversals];
            return [original];
          }),
          createReversal: vi.fn().mockImplementation(async () => {
            rpcCallCount++;
            if (rpcCallCount === 1) {
              dbReversals.push(makeRecord({
                id: 'rev-1', status: 'active', record_type: 'reversal',
                original_record_id: 'rec-1', commission_value: -100,
              }));
              return { success: true, reversal_id: 'rev-1' };
            }
            return {
              success: false,
              error: 'Reversao excede comissao original. Original: 100, Ja revertido: 100, Novo total: 200',
            };
          }),
          create: vi.fn(), get: vi.fn(), existsByStaffComanda: vi.fn(), calculateDailyNet: vi.fn(),
        } as any,
      });

      const handler1 = createReverseCommissionHandler(deps);
      const handler2 = createReverseCommissionHandler(deps);
      const data = makeReverseData({ reversedAmount: 100, originalReceivedValue: 200 });

      await Promise.all([
        handler1.execute(data as any, makeContext({ eventId: 'evt_rev_A', idempotencyKey: 'evt_rev_A_reverse_commission' })),
        handler2.execute(data as any, makeContext({ eventId: 'evt_rev_B', idempotencyKey: 'evt_rev_B_reverse_commission' })),
      ]);

      // Both handlers reached the RPC (both passed alreadyReversed check)
      expect(deps.commissionRecordRepository.createReversal).toHaveBeenCalledTimes(2);

      // Simulated DB: exactly 1 reversal exists (not 2)
      expect(dbReversals).toHaveLength(1);

      // Invariant: net commission >= 0 (never exceeds original)
      const totalReversed = dbReversals.reduce(
        (sum, r) => sum + Number(r.commission_value), 0,
      );
      expect(totalReversed).toBe(-100);

      // Net: original(100) + reversed(-100) = 0 — never -200
      const netCommission = original.commission_value + totalReversed;
      expect(netCommission).toBe(0);
      expect(netCommission).toBeGreaterThanOrEqual(0);
    });

    it('should_allow_partial_then_reject_overflow', async () => {
      // original commission = R$100
      // Two concurrent handlers each attempt to reverse R$60
      // First: SUM=0+(-60)=-60, |−60|≤|100| → OK
      // Second: SUM=-60+(-60)=-120, |−120|>|100| → REJECT
      const original = makeRecord({ id: 'rec-1', commission_value: 100, received_value: 200 });

      let rpcCallCount = 0;
      const dbReversals: CommissionRecord[] = [];

      const deps = makeReverseDeps({
        commissionRecordRepository: {
          list: vi.fn().mockImplementation(async (_tenantId: string, opts?: any) => {
            if (opts?.record_type === 'reversal') return [...dbReversals];
            return [original];
          }),
          createReversal: vi.fn().mockImplementation(async () => {
            rpcCallCount++;
            if (rpcCallCount === 1) {
              dbReversals.push(makeRecord({
                id: 'rev-partial', status: 'active', record_type: 'reversal',
                original_record_id: 'rec-1', commission_value: -60,
              }));
              return { success: true, reversal_id: 'rev-partial' };
            }
            return {
              success: false,
              error: 'Reversao excede comissao original. Original: 100, Ja revertido: 60, Novo total: 160',
            };
          }),
          create: vi.fn(), get: vi.fn(), existsByStaffComanda: vi.fn(), calculateDailyNet: vi.fn(),
        } as any,
      });

      const handler1 = createReverseCommissionHandler(deps);
      const handler2 = createReverseCommissionHandler(deps);

      // Both attempt 60% reversal (60) — total would be 120 > 100 (overflow)
      const data = makeReverseData({ reversedAmount: 120, originalReceivedValue: 200 });

      await Promise.all([
        handler1.execute(data as any, makeContext({ eventId: 'evt_A', idempotencyKey: 'evt_A_reverse_commission' })),
        handler2.execute(data as any, makeContext({ eventId: 'evt_B', idempotencyKey: 'evt_B_reverse_commission' })),
      ]);

      expect(deps.commissionRecordRepository.createReversal).toHaveBeenCalledTimes(2);

      // Only 1 reversal in simulated DB (not 2)
      expect(dbReversals).toHaveLength(1);

      // Invariant: net commission >= 0
      const totalReversed = dbReversals.reduce(
        (sum, r) => sum + Number(r.commission_value), 0,
      );
      expect(totalReversed).toBe(-60);

      // Net: original(100) + reversed(-60) = 40 — never -20
      const netCommission = original.commission_value + totalReversed;
      expect(netCommission).toBe(40);
      expect(netCommission).toBeGreaterThanOrEqual(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// 5. INTEGRITY
// ═══════════════════════════════════════════════════════════════════

describe('B3.4-E Integrity', () => {
  describe('commission record field preservation', () => {
    it('should_preserve_all_financial_fields_in_created_record', async () => {
      const deps = makeCreateDeps();
      const handler = createCommissionRecordHandler(deps);

      await handler.execute(
        { comandaId: 'com-1', tenantId: 'tenant-1', receivedValue: 100 } as any,
        makeContext(),
      );

      const callArgs = (deps.commissionRecordRepository.create as any).mock.calls[0][0];

      // Financial fields preserved
      expect(callArgs.gross_value).toBeGreaterThan(0);
      expect(typeof callArgs.discount).toBe('number');
      expect(typeof callArgs.net_value).toBe('number');
      expect(typeof callArgs.received_value).toBe('number');
      expect(typeof callArgs.commission_rate).toBe('number');
      expect(typeof callArgs.commission_value).toBe('number');

      // Participant fields preserved
      expect(typeof callArgs.participant_share).toBe('number');
      expect(typeof callArgs.payout_type).toBe('string');
      expect(typeof callArgs.affects_commission).toBe('boolean');

      // Metadata preserved
      expect(callArgs.tenant_id).toBe('tenant-1');
      expect(callArgs.comanda_id).toBe('com-1');
      expect(callArgs.staff_id).toBe('staff-1');
      expect(typeof callArgs.idempotency_key).toBe('string');
      expect(callArgs.idempotency_key.length).toBeGreaterThan(0);
    });
  });

  describe('idempotency key format', () => {
    it('should_format_create_key_as_eventId_create_commission_record_staffId', async () => {
      const deps = makeCreateDeps();
      const handler = createCommissionRecordHandler(deps);

      await handler.execute(
        { comandaId: 'com-1', tenantId: 'tenant-1', receivedValue: 100 } as any,
        makeContext({ eventId: 'evt_ABC', idempotencyKey: 'evt_ABC_create_commission_record' }),
      );

      const callArgs = (deps.commissionRecordRepository.create as any).mock.calls[0][0];
      expect(callArgs.idempotency_key).toBe('evt_ABC_create_commission_record_staff-1');
    });
  });

  describe('reversal idempotency key format', () => {
    it('should_format_reverse_key_as_eventId_reverse_commission_recordId', async () => {
      const record = makeRecord({ id: 'rec-XYZ', commission_value: 40, received_value: 100 });
      const deps = makeReverseDeps({
        commissionRecordRepository: {
          list: vi.fn().mockResolvedValue([record]),
          createReversal: vi.fn().mockResolvedValue({ success: true }),
          create: vi.fn(), get: vi.fn(), existsByStaffComanda: vi.fn(), calculateDailyNet: vi.fn(),
        } as any,
      });
      const handler = createReverseCommissionHandler(deps);

      await handler.execute(
        makeReverseData() as any,
        makeContext({ eventId: 'evt_DEF', idempotencyKey: 'evt_DEF_reverse_commission' }),
      );

      const callArgs = (deps.commissionRecordRepository.createReversal as any).mock.calls[0][0];
      expect(callArgs.idempotencyKey).toBe('evt_DEF_reverse_commission_rec-XYZ');
    });
  });

  describe('append-only semantics', () => {
    it('should_only_call_create_and_list_never_update_or_delete', async () => {
      const deps = makeCreateDeps();
      const handler = createCommissionRecordHandler(deps);

      await handler.execute(
        { comandaId: 'com-1', tenantId: 'tenant-1', receivedValue: 100 } as any,
        makeContext(),
      );

      // Verify only allowed operations were called
      expect(deps.commissionRecordRepository.create).toHaveBeenCalled();
      expect(deps.commissionRecordRepository.list).not.toHaveBeenCalled();
      expect(deps.commissionRecordRepository.get).not.toHaveBeenCalled();
      // No update/delete methods should exist on the mock (they don't exist on the real repo)
    });

    it('reversal_should_only_call_list_and_createReversal_never_update_or_delete', async () => {
      const record = makeRecord({ commission_value: 40, received_value: 100 });
      const deps = makeReverseDeps({
        commissionRecordRepository: {
          list: vi.fn().mockResolvedValue([record]),
          createReversal: vi.fn().mockResolvedValue({ success: true }),
          create: vi.fn(), get: vi.fn(), existsByStaffComanda: vi.fn(), calculateDailyNet: vi.fn(),
        } as any,
      });
      const handler = createReverseCommissionHandler(deps);

      await handler.execute(makeReverseData() as any, makeContext());

      // Only list and createReversal called — no update/delete
      expect(deps.commissionRecordRepository.list).toHaveBeenCalled();
      expect(deps.commissionRecordRepository.createReversal).toHaveBeenCalled();
      expect(deps.commissionRecordRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('reversal RPC parameters', () => {
    it('should_pass_correct_RPC_parameters', async () => {
      const record = makeRecord({ id: 'rec-999', staff_id: 'staff-5', commission_value: 40, received_value: 100 });
      const deps = makeReverseDeps({
        commissionRecordRepository: {
          list: vi.fn().mockResolvedValue([record]),
          createReversal: vi.fn().mockResolvedValue({ success: true }),
          create: vi.fn(), get: vi.fn(), existsByStaffComanda: vi.fn(), calculateDailyNet: vi.fn(),
        } as any,
      });
      const handler = createReverseCommissionHandler(deps);
      const ctx = makeContext({ eventId: 'evt_RPC', idempotencyKey: 'evt_RPC_reverse_commission', sourceEvent: 'CheckoutReverted' });

      await handler.execute(makeReverseData() as any, ctx);

      const callArgs = (deps.commissionRecordRepository.createReversal as any).mock.calls[0][0];
      expect(callArgs.tenantId).toBe('tenant-1');
      expect(callArgs.originalRecordId).toBe('rec-999');
      expect(callArgs.commissionValue).toBeGreaterThan(0);
      expect(callArgs.idempotencyKey).toBe('evt_RPC_reverse_commission_rec-999');
      expect(callArgs.eventId).toBe('evt_RPC');
      expect(callArgs.eventType).toBe('CheckoutReverted');
    });
  });
});
