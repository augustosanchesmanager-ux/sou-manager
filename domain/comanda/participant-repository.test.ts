/**
 * [SMG][TD-001][B3.4-H.2] Regression: ParticipantRepository staff_id contract
 *
 * B3.4-H.1 proved production schema has NO professional_id column
 * (canonical contract = staff_id). This suite locks that contract:
 *   1. listByComandaItemIds must NOT select professional_id
 *   2. Rows shaped by the real schema (staff-only) must flow through
 *   3. createCommissionRecordHandler must resolve staff without professional_id
 *   4. Commission participant normalization must work staff-only
 */

import { describe, it, expect, vi } from 'vitest';
import { ServiceExecutionParticipantRepositoryImpl } from './participant-repository';
import { createCommissionRecordHandler } from '../events/outbox/providers/createCommissionRecordHandler';
import type { OperationContext } from '../events/outbox/providers/financeProvider';
import { normalizeCommissionParticipants } from '../commission/participants';

const STAFF_ONLY_SELECT = 'id, comanda_item_id, staff_id, role, payout_type, payout_value, affects_commission';

const makeDb = (rows: unknown[] = []) => {
  const selectCalls: string[] = [];
  const builder: any = {
    select: (cols: string) => {
      selectCalls.push(cols);
      return builder;
    },
    eq: () => builder,
    in: () => Promise.resolve({ data: rows, error: null }),
    insert: () => Promise.resolve({ data: [], error: null }),
  };
  return {
    db: { from: vi.fn(() => builder) } as any,
    selectCalls,
  };
};

/** Row exactly as returned by the REAL remote schema (no professional_id key). */
const makeStaffOnlyRow = () => ({
  id: 'sep-1',
  comanda_item_id: 'item-1',
  staff_id: 'staff-1',
  role: 'primary',
  payout_type: 'percentage',
  payout_value: 100,
  affects_commission: true,
});

describe('B3.4-H.2 — ParticipantRepository staff_id contract', () => {
  it('listByComandaItemIds_does_not_select_professional_id', async () => {
    const { db, selectCalls } = makeDb([makeStaffOnlyRow()]);
    const repo = new ServiceExecutionParticipantRepositoryImpl(db);

    await repo.listByComandaItemIds(['item-1'], 'tenant-1');

    expect(selectCalls).toHaveLength(1);
    expect(selectCalls[0]).toBe(STAFF_ONLY_SELECT);
    expect(selectCalls[0]).not.toContain('professional_id');
  });

  it('maps_staff_only_rows_without_professional_id_key', async () => {
    const row = makeStaffOnlyRow() as Record<string, unknown>;
    expect('professional_id' in row).toBe(false);

    const { db } = makeDb([row]);
    const repo = new ServiceExecutionParticipantRepositoryImpl(db);

    const rows = await repo.listByComandaItemIds(['item-1'], 'tenant-1');

    expect(rows).toHaveLength(1);
    expect(rows[0].staff_id).toBe('staff-1');
    expect(rows[0].payout_type).toBe('percentage');
    expect(rows[0].affects_commission).toBe(true);
  });

  it('short_circuits_empty_item_ids_without_db_call', async () => {
    const { db, selectCalls } = makeDb();
    const repo = new ServiceExecutionParticipantRepositoryImpl(db);

    const rows = await repo.listByComandaItemIds([], 'tenant-1');

    expect(rows).toEqual([]);
    expect(selectCalls).toHaveLength(0);
    expect(db.from).not.toHaveBeenCalled();
  });

  it('throws_RepositoryError_when_query_fails', async () => {
    const failingBuilder: any = {
      select: () => failingBuilder,
      eq: () => failingBuilder,
      in: () => Promise.resolve({ data: null, error: { message: 'boom' } }),
    };
    const repo = new ServiceExecutionParticipantRepositoryImpl({
      from: () => failingBuilder,
    } as any);

    await expect(
      repo.listByComandaItemIds(['item-1'], 'tenant-1'),
    ).rejects.toThrow(/list participants by comanda item ids/);
  });
});

describe('B3.4-H.2 — commission chain independent of professional_id', () => {
  const makeContext = (): OperationContext => ({
    tenantId: 'tenant-1',
    idempotencyKey: 'evt_h2_create_commission_record',
    sourceEvent: 'CheckoutCompleted',
    eventId: 'evt_h2',
  });

  it('createCommissionRecordHandler_resolves_staff_from_staff_only_rows', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'rec-h2' });
    const listByComandaItemIds = vi.fn().mockResolvedValue([
      // Built WITHOUT professional_id entirely — real-schema shape.
      makeStaffOnlyRow(),
    ]);

    const handler = createCommissionRecordHandler({
      comandaRepository: {
        get: vi.fn().mockResolvedValue({ id: 'com-1', staff_id: 'staff-1', status: 'paid', total: 100 }),
      },
      comandaItemRepository: {
        listByComandaIds: vi.fn().mockResolvedValue([
          { id: 'item-1', comanda_id: 'com-1', unit_price: 100, quantity: 1, staff_id: undefined },
        ]),
      },
      participantRepository: { listByComandaItemIds },
      staffRepository: {
        listForCommission: vi.fn().mockResolvedValue([
          { id: 'staff-1', name: 'Barber One', role: 'barber', commission_rate: 0.4 },
        ]),
      },
      commissionRecordRepository: {
        create,
        existsByStaffComanda: vi.fn().mockResolvedValue(false),
      },
    } as any);

    const result = await handler.execute(
      { comandaId: 'com-1', tenantId: 'tenant-1', receivedValue: 100 } as any,
      makeContext(),
    );

    expect(listByComandaItemIds).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0]).toMatchObject({ staff_id: 'staff-1' });
  });

  it('normalizeCommissionParticipants_works_with_staff_only_rows', () => {
    const staffById = new Map([
      ['staff-1', { id: 'staff-1', role: 'barber', commission_rate: 0.4 }],
    ]);

    const { participants, isShared, primaryStaffId } = normalizeCommissionParticipants(
      { id: 'item-1' },
      {},
      [makeStaffOnlyRow()],
      100,
      staffById,
    );

    expect(primaryStaffId).toBe('staff-1');
    expect(participants).toHaveLength(1);
    expect(participants[0].staff_id).toBe('staff-1');
    expect(isShared).toBe(false);
  });
});
