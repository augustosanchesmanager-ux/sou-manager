/**
 * TD-001 B3.4-H — Commission base regression (Elo 2).
 *
 * Reproduces the production defect end-to-end:
 *   raw DB row (no paid_amount column) → ComandaRepository.get() → handler
 *
 * The repository mapper used to synthesize paid_amount=0 for the absent
 * column; the commission handler's nullish chain then treated that 0 as a
 * real zero payment and silently created ZERO commission records.
 *
 * Acceptance (PO): total=100, paid_amount absent, barber at 40%, participant
 * share 100% → receivedValue=100 and commissionValue=40.
 *
 * This test FAILS against the pre-fix mapper (commission_value would be 0).
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

const state = vi.hoisted(() => {
  const rows: Record<string, unknown>[] = [];
  const makeQuery = () => {
    const q: any = {
      select: () => q,
      eq: () => q,
      single: () =>
        Promise.resolve({ data: rows[0] ?? null, error: null }),
    };
    return q;
  };
  return {
    rows,
    client: {
      from: () => makeQuery(),
      rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
    },
  };
});

vi.mock('../../../shared/supabase-client-factory', () => ({
  createSupabaseClient: vi.fn(() => state.client),
  createSharedSupabaseClient: vi.fn(() => state.client),
}));

import { comandaRepository } from '../../../comanda/repository';
import { createCommissionRecordHandler } from './createCommissionRecordHandler';
import type { OperationContext } from './financeProvider';
import type { ParticipantRow } from '../../../commission/types';

const RAW_PAID_COMANDA = {
  id: 'com-1',
  tenant_id: 'tenant-1',
  client_id: null,
  appointment_id: null,
  staff_id: 'staff-1',
  status: 'paid',
  total: 100,
  payment_method: 'credit',
  created_at: '2026-08-24T00:00:00.000Z',
  closed_at: '2026-08-24T00:05:00.000Z',
};

const makeContext = (): OperationContext => ({
  tenantId: 'tenant-1',
  idempotencyKey: 'evt_1_create_commission_record',
  sourceEvent: 'CheckoutCompleted',
  eventId: 'evt_1',
});

describe('TD-001 B3.4-H — commission base through real repository mapping', () => {
  beforeEach(() => {
    state.rows.length = 0;
    state.rows.push({ ...RAW_PAID_COMANDA });
  });

  it('should_create_commission_of_40_when_paid_amount_is_absent_and_total_is_100', async () => {
    // Real repository path: raw row → toComanda. Absent column must stay absent.
    const comanda = await comandaRepository.get('com-1', 'tenant-1');
    expect(comanda).not.toBeNull();
    expect(comanda!.total).toBe(100);
    expect(comanda).not.toHaveProperty('paid_amount');

    const create = vi.fn().mockResolvedValue({ success: true });
    const existsByStaffComanda = vi.fn().mockResolvedValue(false);
    const handler = createCommissionRecordHandler({
      comandaRepository: { get: vi.fn().mockResolvedValue(comanda) },
      comandaItemRepository: {
        listByComandaIds: vi.fn().mockResolvedValue([
          {
            id: 'item-1',
            comanda_id: 'com-1',
            service_id: 'svc-1',
            product_name: 'Corte',
            staff_id: 'staff-1',
            unit_price: 100,
            quantity: 1,
          },
        ]),
      },
      participantRepository: {
        listByComandaItemIds: vi.fn().mockResolvedValue([
          {
            id: 'part-1',
            comanda_item_id: 'item-1',
            staff_id: 'staff-1',
            role: 'primary',
            payout_type: 'percentage',
            payout_value: 100,
            affects_commission: true,
          } as unknown as ParticipantRow,
        ]),
      },
      staffRepository: {
        listForCommission: vi.fn().mockResolvedValue([
          { id: 'staff-1', name: 'Barber', role: 'barber', commission_rate: 40 },
          { id: 'mgr-1', name: 'Manager', role: 'manager', commission_rate: 0 },
        ]),
      },
      commissionRecordRepository: { create, existsByStaffComanda } as any,
    });

    const result = await handler.execute(
      { comandaId: 'com-1', tenantId: 'tenant-1', receivedValue: 100 } as any,
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(create).toHaveBeenCalledTimes(1);
    const record = create.mock.calls[0][0];
    expect(record.commission_value).toBe(40);
    expect(record.participant_share).toBe(1);
    expect(record.commission_rate).toBe(0.4);
  });

  it('should_keep_explicit_zero_payment_when_field_is_present', async () => {
    state.rows.length = 0;
    // Handler-level contract: an EXPLICIT paid_amount=0 is a real zero payment.
    const create = vi.fn().mockResolvedValue({ success: true });
    const handler = createCommissionRecordHandler({
      comandaRepository: {
        get: vi
          .fn()
          .mockResolvedValue({ ...RAW_PAID_COMANDA, paid_amount: 0 }),
      },
      comandaItemRepository: {
        listByComandaIds: vi.fn().mockResolvedValue([
          {
            id: 'item-1',
            comanda_id: 'com-1',
            service_id: 'svc-1',
            product_name: 'Corte',
            staff_id: 'staff-1',
            unit_price: 100,
            quantity: 1,
          },
        ]),
      },
      participantRepository: {
        listByComandaItemIds: vi.fn().mockResolvedValue([
          {
            id: 'part-1',
            comanda_item_id: 'item-1',
            staff_id: 'staff-1',
            role: 'primary',
            payout_type: 'percentage',
            payout_value: 100,
            affects_commission: true,
          } as unknown as ParticipantRow,
        ]),
      },
      staffRepository: {
        listForCommission: vi.fn().mockResolvedValue([
          { id: 'staff-1', name: 'Barber', role: 'barber', commission_rate: 40 },
        ]),
      },
      commissionRecordRepository: {
        create,
        existsByStaffComanda: vi.fn().mockResolvedValue(false),
      } as any,
    });

    const result = await handler.execute(
      { comandaId: 'com-1', tenantId: 'tenant-1', receivedValue: 0 } as any,
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(create).not.toHaveBeenCalled();
  });
});
