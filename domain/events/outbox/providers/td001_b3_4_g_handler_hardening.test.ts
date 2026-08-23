/**
 * [SMG][DOMAIN][EVENTS][OUTBOX][PROVIDERS] TD-001 B3.4-G Handler Failure Semantics
 *
 * PO decision: "Falha financeira não pode ser mascarada como sucesso."
 *
 * Validates the hardened failure semantics:
 *   Case A — idempotency skip (already exists)        -> success:true
 *   Case B — nothing to create (no comanda/no items)  -> success:true
 *   Case C — reversal already performed               -> success:true
 *   Case D — real persistence error                   -> success:false (retry)
 *
 * Covered Case D paths:
 *   - existsByStaffComanda throws            -> success:false
 *   - commissionRecordRepository.create throws -> success:false
 *   - reversal pre-check list() throws       -> success:false
 *   - createReversal returns {success:false} -> success:false
 *   - createReversal throws                  -> success:false
 */

import { describe, it, expect, vi } from 'vitest';
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

// ─── Shared Helpers ──────────────────────────────────────────────

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
  originalCommission: 40,
  originalReceivedValue: 100,
  commissionReversal: 40,
  ...overrides,
});

// ─── createCommissionRecordHandler: Failure Semantics ───────────

describe('B3.4-G createCommissionRecordHandler - failure semantics', () => {
  it('CASE A — already existing record skips and returns success', async () => {
    const deps = makeCreateDeps();
    deps.commissionRecordRepository.existsByStaffComanda = vi.fn().mockResolvedValue(true);

    const result = await createCommissionRecordHandler(deps).execute(
      { comandaId: 'com-1', tenantId: 'tenant-1', receivedValue: 100 },
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(deps.commissionRecordRepository.create).not.toHaveBeenCalled();
  });

  it('CASE B — missing comanda skips gracefully with success', async () => {
    const deps = makeCreateDeps();
    deps.comandaRepository.get = vi.fn().mockResolvedValue(null);

    const result = await createCommissionRecordHandler(deps).execute(
      { comandaId: 'ghost', tenantId: 'tenant-1', receivedValue: 100 },
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(deps.commissionRecordRepository.create).not.toHaveBeenCalled();
  });

  it('CASE B — comanda without items creates nothing with success', async () => {
    const deps = makeCreateDeps();
    deps.comandaItemRepository.listByComandaIds = vi.fn().mockResolvedValue([]);

    const result = await createCommissionRecordHandler(deps).execute(
      { comandaId: 'com-1', tenantId: 'tenant-1', receivedValue: 100 },
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(deps.commissionRecordRepository.create).not.toHaveBeenCalled();
  });

  it('CASE D — existsByStaffComanda throwing fails the operation', async () => {
    const deps = makeCreateDeps();
    deps.commissionRecordRepository.existsByStaffComanda =
      vi.fn().mockRejectedValue(new Error('DB unavailable'));

    const result = await createCommissionRecordHandler(deps).execute(
      { comandaId: 'com-1', tenantId: 'tenant-1', receivedValue: 100 },
      makeContext(),
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('DB unavailable');
    expect(deps.commissionRecordRepository.create).not.toHaveBeenCalled();
  });

  it('CASE D — repository.create throwing fails the operation for retry', async () => {
    const deps = makeCreateDeps();
    deps.commissionRecordRepository.create =
      vi.fn().mockRejectedValue(new Error('unique violation'));

    const result = await createCommissionRecordHandler(deps).execute(
      { comandaId: 'com-1', tenantId: 'tenant-1', receivedValue: 100 },
      makeContext(),
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('unique violation');
  });

  it('happy path still succeeds after hardening', async () => {
    const deps = makeCreateDeps();

    const result = await createCommissionRecordHandler(deps).execute(
      { comandaId: 'com-1', tenantId: 'tenant-1', receivedValue: 100 },
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(deps.commissionRecordRepository.create).toHaveBeenCalledTimes(1);
  });
});

// ─── reverseCommissionHandler: Failure Semantics ────────────────

describe('B3.4-G reverseCommissionHandler - failure semantics', () => {
  it('CASE B — nothing to reverse returns success', async () => {
    const deps = makeReverseDeps();

    const result = await createReverseCommissionHandler(deps).execute(
      makeReverseData({ reversedAmount: 0 }) as any,
      makeContext({ sourceEvent: 'CheckoutReverted' }),
    );

    expect(result.success).toBe(true);
    expect(deps.commissionRecordRepository.createReversal).not.toHaveBeenCalled();
  });

  it('CASE C — no active records returns success', async () => {
    const deps = makeReverseDeps();
    deps.commissionRecordRepository.list = vi.fn().mockResolvedValue([
      makeRecord({ status: 'reversed' }),
    ]);

    const result = await createReverseCommissionHandler(deps).execute(
      makeReverseData() as any,
      makeContext({ sourceEvent: 'CheckoutReverted' }),
    );

    expect(result.success).toBe(true);
    expect(deps.commissionRecordRepository.createReversal).not.toHaveBeenCalled();
  });

  it('CASE C — already-reversed record is skipped idempotently', async () => {
    const deps = makeReverseDeps();
    let call = 0;
    deps.commissionRecordRepository.list = vi.fn().mockImplementation(async (_t, opts) => {
      call++;
      if ((opts as any)?.record_type === 'reversal') {
        return [makeRecord({
          record_type: 'reversal',
          original_record_id: 'rec-1',
          status: 'active',
        })];
      }
      return [makeRecord()];
    });

    const result = await createReverseCommissionHandler(deps).execute(
      makeReverseData() as any,
      makeContext({ sourceEvent: 'CheckoutReverted' }),
    );

    expect(result.success).toBe(true);
    expect(deps.commissionRecordRepository.createReversal).not.toHaveBeenCalled();
  });

  it('CASE D — reversal pre-check failing fails the operation', async () => {
    const deps = makeReverseDeps();
    let call = 0;
    deps.commissionRecordRepository.list = vi.fn().mockImplementation(async () => {
      call++;
      if (call === 1) return [makeRecord()];
      throw new Error('list failed mid-flight');
    });

    const result = await createReverseCommissionHandler(deps).execute(
      makeReverseData() as any,
      makeContext({ sourceEvent: 'CheckoutReverted' }),
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to check existing reversals');
    expect(deps.commissionRecordRepository.createReversal).not.toHaveBeenCalled();
  });

  it('CASE D — RPC returning success:false fails the operation for retry', async () => {
    const deps = makeReverseDeps();
    deps.commissionRecordRepository.createReversal =
      vi.fn().mockResolvedValue({ success: false, error: 'rpc constraint' });

    const result = await createReverseCommissionHandler(deps).execute(
      makeReverseData() as any,
      makeContext({ sourceEvent: 'CheckoutReverted' }),
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('rpc constraint');
  });

  it('CASE D — createReversal throwing fails the operation', async () => {
    const deps = makeReverseDeps();
    deps.commissionRecordRepository.createReversal =
      vi.fn().mockRejectedValue(new Error('connection reset'));

    const result = await createReverseCommissionHandler(deps).execute(
      makeReverseData() as any,
      makeContext({ sourceEvent: 'CheckoutReverted' }),
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('connection reset');
  });
});
