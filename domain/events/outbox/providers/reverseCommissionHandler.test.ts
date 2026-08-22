/**
 * [SMG][DOMAIN][EVENTS][OUTBOX][PROVIDERS] reverseCommissionHandler Tests
 *
 * TD-001 B3.4-D: Tests for reverseCommissionHandler with CommissionRecordRepository.
 *
 * GRUPO A: Input Validation
 * GRUPO B: Reversal Logic (proportional, single record, multi-record)
 * GRUPO C: Edge Cases (no records, zero amounts, already reversed)
 * GRUPO D: Error Handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createReverseCommissionHandler,
  type ReverseCommissionData,
  type ReverseCommissionHandlerDeps,
} from './reverseCommissionHandler';
import type { OperationContext } from './financeProvider';
import type { CommissionRecord } from '../../../commission/commissionRecordTypes';

// ─── Helpers ───────────────────────────────────────────────────

const makeContext = (overrides?: Partial<OperationContext>): OperationContext => ({
  tenantId: 'tenant-1',
  idempotencyKey: 'evt_1_reverse_commission',
  sourceEvent: 'CheckoutReverted',
  eventId: 'evt_1',
  ...overrides,
});

const makeData = (overrides?: Partial<ReverseCommissionData>): ReverseCommissionData => ({
  comandaId: 'com-1',
  tenantId: 'tenant-1',
  reversedAmount: 100,
  originalCommission: 50,
  originalReceivedValue: 100,
  commissionReversal: 50,
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

const makeDeps = (overrides?: Partial<ReverseCommissionHandlerDeps>): ReverseCommissionHandlerDeps => ({
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

// ═══════════════════════════════════════════════════════════════════
// GRUPO A: Input Validation
// ═══════════════════════════════════════════════════════════════════

describe('reverseCommissionHandler — Input Validation', () => {
  it('should_return_error_when_comandaId_missing', async () => {
    const deps = makeDeps();
    const handler = createReverseCommissionHandler(deps);
    const data = makeData({ comandaId: '' });

    const result = await handler.execute(data as any, makeContext());

    expect(result.success).toBe(false);
    expect(result.error).toContain('comandaId');
  });

  it('should_return_error_when_tenantId_missing', async () => {
    const deps = makeDeps();
    const handler = createReverseCommissionHandler(deps);
    const data = makeData({ tenantId: '' });

    const result = await handler.execute(data as any, makeContext());

    expect(result.success).toBe(false);
    expect(result.error).toContain('tenantId');
  });

  it('should_return_error_when_reversedAmount_negative', async () => {
    const deps = makeDeps();
    const handler = createReverseCommissionHandler(deps);
    const data = makeData({ reversedAmount: -10 });

    const result = await handler.execute(data as any, makeContext());

    expect(result.success).toBe(false);
    expect(result.error).toContain('reversedAmount');
  });

  it('should_return_error_when_originalCommission_negative', async () => {
    const deps = makeDeps();
    const handler = createReverseCommissionHandler(deps);
    const data = makeData({ originalCommission: -5 });

    const result = await handler.execute(data as any, makeContext());

    expect(result.success).toBe(false);
    expect(result.error).toContain('originalCommission');
  });

  it('should_return_error_when_originalReceivedValue_negative', async () => {
    const deps = makeDeps();
    const handler = createReverseCommissionHandler(deps);
    const data = makeData({ originalReceivedValue: -50 });

    const result = await handler.execute(data as any, makeContext());

    expect(result.success).toBe(false);
    expect(result.error).toContain('originalReceivedValue');
  });
});

// ═══════════════════════════════════════════════════════════════════
// GRUPO B: Reversal Logic
// ═══════════════════════════════════════════════════════════════════

describe('reverseCommissionHandler — Reversal Logic', () => {
  it('should_create_reversal_for_single_active_record', async () => {
    const record = makeRecord({ commission_value: 40, received_value: 100 });
    const deps = makeDeps({
      commissionRecordRepository: {
        list: vi.fn().mockResolvedValue([record]),
        createReversal: vi.fn().mockResolvedValue({ success: true }),
        create: vi.fn(), get: vi.fn(), existsByStaffComanda: vi.fn(), calculateDailyNet: vi.fn(),
      } as any,
    });
    const handler = createReverseCommissionHandler(deps);
    const data = makeData({ reversedAmount: 50, originalReceivedValue: 100 });

    const result = await handler.execute(data as any, makeContext());

    expect(result.success).toBe(true);
    expect(deps.commissionRecordRepository.createReversal).toHaveBeenCalledTimes(1);
    const callArgs = (deps.commissionRecordRepository.createReversal as any).mock.calls[0][0];
    expect(callArgs.originalRecordId).toBe('rec-1');
    expect(callArgs.commissionValue).toBeGreaterThan(0);
    expect(callArgs.tenantId).toBe('tenant-1');
  });

  it('should_create_proportional_reversal_for_50_percent', async () => {
    const record = makeRecord({ commission_value: 40, received_value: 100 });
    const deps = makeDeps({
      commissionRecordRepository: {
        list: vi.fn().mockResolvedValue([record]),
        createReversal: vi.fn().mockResolvedValue({ success: true }),
        create: vi.fn(), get: vi.fn(), existsByStaffComanda: vi.fn(), calculateDailyNet: vi.fn(),
      } as any,
    });
    const handler = createReverseCommissionHandler(deps);
    const data = makeData({ reversedAmount: 50, originalReceivedValue: 100 });

    await handler.execute(data as any, makeContext());

    const callArgs = (deps.commissionRecordRepository.createReversal as any).mock.calls[0][0];
    // proportion = 50/100 = 0.5, reversal = 40 × 0.5 = 20
    expect(callArgs.commissionValue).toBeCloseTo(20, 1);
  });

  it('should_cap_reversal_at_original_commission', async () => {
    const record = makeRecord({ commission_value: 40, received_value: 100 });
    const deps = makeDeps({
      commissionRecordRepository: {
        list: vi.fn().mockResolvedValue([record]),
        createReversal: vi.fn().mockResolvedValue({ success: true }),
        create: vi.fn(), get: vi.fn(), existsByStaffComanda: vi.fn(), calculateDailyNet: vi.fn(),
      } as any,
    });
    const handler = createReverseCommissionHandler(deps);
    const data = makeData({ reversedAmount: 200, originalReceivedValue: 100 });

    await handler.execute(data as any, makeContext());

    const callArgs = (deps.commissionRecordRepository.createReversal as any).mock.calls[0][0];
    // proportion = min(1, 200/100) = 1, reversal = 40 × 1 = 40
    expect(callArgs.commissionValue).toBeCloseTo(40, 1);
  });

  it('should_create_reversals_for_multiple_records', async () => {
    const record1 = makeRecord({ id: 'rec-1', staff_id: 'staff-1', commission_value: 40, received_value: 100 });
    const record2 = makeRecord({ id: 'rec-2', staff_id: 'staff-2', commission_value: 20, received_value: 100 });
    const deps = makeDeps({
      commissionRecordRepository: {
        list: vi.fn().mockResolvedValue([record1, record2]),
        createReversal: vi.fn().mockResolvedValue({ success: true }),
        create: vi.fn(), get: vi.fn(), existsByStaffComanda: vi.fn(), calculateDailyNet: vi.fn(),
      } as any,
    });
    const handler = createReverseCommissionHandler(deps);
    const data = makeData({ reversedAmount: 100, originalReceivedValue: 200 });

    const result = await handler.execute(data as any, makeContext());

    expect(result.success).toBe(true);
    expect(deps.commissionRecordRepository.createReversal).toHaveBeenCalledTimes(2);
  });

  it('should_pass_idempotency_key_with_record_id_suffix', async () => {
    const record = makeRecord({ id: 'rec-abc', commission_value: 40, received_value: 100 });
    const deps = makeDeps({
      commissionRecordRepository: {
        list: vi.fn().mockResolvedValue([record]),
        createReversal: vi.fn().mockResolvedValue({ success: true }),
        create: vi.fn(), get: vi.fn(), existsByStaffComanda: vi.fn(), calculateDailyNet: vi.fn(),
      } as any,
    });
    const handler = createReverseCommissionHandler(deps);

    await handler.execute(makeData() as any, makeContext({ idempotencyKey: 'key-xyz' }));

    const callArgs = (deps.commissionRecordRepository.createReversal as any).mock.calls[0][0];
    expect(callArgs.idempotencyKey).toBe('key-xyz_rec-abc');
  });
});

// ═══════════════════════════════════════════════════════════════════
// GRUPO C: Edge Cases
// ═══════════════════════════════════════════════════════════════════

describe('reverseCommissionHandler — Edge Cases', () => {
  it('should_succeed_when_no_active_records_found', async () => {
    const deps = makeDeps({
      commissionRecordRepository: {
        list: vi.fn().mockResolvedValue([]),
        createReversal: vi.fn(),
        create: vi.fn(), get: vi.fn(), existsByStaffComanda: vi.fn(), calculateDailyNet: vi.fn(),
      } as any,
    });
    const handler = createReverseCommissionHandler(deps);

    const result = await handler.execute(makeData() as any, makeContext());

    expect(result.success).toBe(true);
    expect(deps.commissionRecordRepository.createReversal).not.toHaveBeenCalled();
  });

  it('should_succeed_when_reversedAmount_is_zero', async () => {
    const deps = makeDeps();
    const handler = createReverseCommissionHandler(deps);
    const data = makeData({ reversedAmount: 0 });

    const result = await handler.execute(data as any, makeContext());

    expect(result.success).toBe(true);
    expect(deps.commissionRecordRepository.createReversal).not.toHaveBeenCalled();
  });

  it('should_succeed_when_originalCommission_is_zero', async () => {
    const deps = makeDeps();
    const handler = createReverseCommissionHandler(deps);
    const data = makeData({ originalCommission: 0 });

    const result = await handler.execute(data as any, makeContext());

    expect(result.success).toBe(true);
    expect(deps.commissionRecordRepository.createReversal).not.toHaveBeenCalled();
  });

  it('should_skip_inactive_records', async () => {
    const inactiveRecord = makeRecord({ status: 'reversed', commission_value: 40, received_value: 100 });
    const deps = makeDeps({
      commissionRecordRepository: {
        list: vi.fn().mockResolvedValue([inactiveRecord]),
        createReversal: vi.fn(),
        create: vi.fn(), get: vi.fn(), existsByStaffComanda: vi.fn(), calculateDailyNet: vi.fn(),
      } as any,
    });
    const handler = createReverseCommissionHandler(deps);

    const result = await handler.execute(makeData() as any, makeContext());

    expect(result.success).toBe(true);
    expect(deps.commissionRecordRepository.createReversal).not.toHaveBeenCalled();
  });

  it('should_skip_records_with_zero_commission_value', async () => {
    const zeroRecord = makeRecord({ commission_value: 0, received_value: 100 });
    const deps = makeDeps({
      commissionRecordRepository: {
        list: vi.fn().mockResolvedValue([zeroRecord]),
        createReversal: vi.fn(),
        create: vi.fn(), get: vi.fn(), existsByStaffComanda: vi.fn(), calculateDailyNet: vi.fn(),
      } as any,
    });
    const handler = createReverseCommissionHandler(deps);

    const result = await handler.execute(makeData() as any, makeContext());

    expect(result.success).toBe(true);
    expect(deps.commissionRecordRepository.createReversal).not.toHaveBeenCalled();
  });

  it('should_skip_already_reversed_records', async () => {
    const original = makeRecord({ id: 'rec-1', status: 'active', commission_value: 40, received_value: 100 });
    const reversal = makeRecord({ id: 'rev-1', status: 'active', record_type: 'reversal', original_record_id: 'rec-1' });
    const deps = makeDeps({
      commissionRecordRepository: {
        list: vi.fn()
          .mockResolvedValueOnce([original]) // first call: commission records
          .mockResolvedValueOnce([reversal]), // second call: reversal records check
        createReversal: vi.fn(),
        create: vi.fn(), get: vi.fn(), existsByStaffComanda: vi.fn(), calculateDailyNet: vi.fn(),
      } as any,
    });
    const handler = createReverseCommissionHandler(deps);

    const result = await handler.execute(makeData() as any, makeContext());

    expect(result.success).toBe(true);
    expect(deps.commissionRecordRepository.createReversal).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════
// GRUPO D: Error Handling
// ═══════════════════════════════════════════════════════════════════

describe('reverseCommissionHandler — Error Handling', () => {
  it('should_return_error_when_list_fails', async () => {
    const deps = makeDeps({
      commissionRecordRepository: {
        list: vi.fn().mockRejectedValue(new Error('DB connection lost')),
        createReversal: vi.fn(),
        create: vi.fn(), get: vi.fn(), existsByStaffComanda: vi.fn(), calculateDailyNet: vi.fn(),
      } as any,
    });
    const handler = createReverseCommissionHandler(deps);

    const result = await handler.execute(makeData() as any, makeContext());

    expect(result.success).toBe(false);
    expect(result.error).toContain('DB connection lost');
  });

  it('should_log_error_when_createReversal_fails_but_continue', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const record = makeRecord({ commission_value: 40, received_value: 100 });
    const deps = makeDeps({
      commissionRecordRepository: {
        list: vi.fn().mockResolvedValue([record]),
        createReversal: vi.fn().mockResolvedValue({ success: false, error: 'RPC timeout' }),
        create: vi.fn(), get: vi.fn(), existsByStaffComanda: vi.fn(), calculateDailyNet: vi.fn(),
      } as any,
    });
    const handler = createReverseCommissionHandler(deps);

    const result = await handler.execute(makeData() as any, makeContext());

    // Handler should still succeed even if one record fails
    expect(result.success).toBe(true);
    consoleSpy.mockRestore();
  });

  it('should_continue_when_one_record_throws_and_process_others', async () => {
    const record1 = makeRecord({ id: 'rec-1', staff_id: 'staff-1', commission_value: 40, received_value: 100 });
    const record2 = makeRecord({ id: 'rec-2', staff_id: 'staff-2', commission_value: 20, received_value: 100 });
    let callCount = 0;
    const deps = makeDeps({
      commissionRecordRepository: {
        list: vi.fn().mockResolvedValue([record1, record2]),
        createReversal: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) throw new Error('RPC crash on first');
          return { success: true };
        }),
        create: vi.fn(), get: vi.fn(), existsByStaffComanda: vi.fn(), calculateDailyNet: vi.fn(),
      } as any,
    });
    const handler = createReverseCommissionHandler(deps);

    const result = await handler.execute(makeData() as any, makeContext());

    expect(result.success).toBe(true);
    expect(deps.commissionRecordRepository.createReversal).toHaveBeenCalledTimes(2);
  });
});
