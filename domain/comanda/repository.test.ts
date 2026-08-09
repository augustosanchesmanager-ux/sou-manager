/**
 * [SMG][DOMAIN][COMANDA] repository tests
 *
 * Verifica que COMANDA_COLUMNS usa SOMENTE colunas reais do schema.
 * Regression guard para EB-2 (42703: colunas fantasma client_name/paid_amount/notes).
 *
 * Convenções: AAA, should_<result>_when_<condition>.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

const state = vi.hoisted(() => {
  const selectedColumns: string[] = [];
  const rows: Record<string, unknown>[] = [];
  let errorValue: { message: string; code?: string } | null = null;

  const makeQuery = () => {
    const resultFor = (single: boolean) =>
      errorValue !== null
        ? { data: null, error: errorValue }
        : single
          ? { data: rows[0] ?? null, error: null }
          : { data: rows.length ? rows : null, error: null };

    const q: any = {
      select: (cols: string) => {
        selectedColumns.push(cols);
        return q;
      },
      eq: () => q,
      gte: () => q,
      lte: () => q,
      order: () => q,
      limit: () => q,
      in: () => q,
      or: () => q,
      update: () => q,
      insert: () => q,
      delete: () => q,
      maybeSingle: () => Promise.resolve(resultFor(true)),
      single: () => Promise.resolve(resultFor(true)),
      then: (resolve: (r: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(resultFor(false)).then(resolve, reject),
    };
    return q;
  };

  return {
    selectedColumns,
    rows,
    error: () => errorValue,
    setError: (e: { message: string; code?: string } | null) => {
      errorValue = e;
    },
    client: {
      from: () => makeQuery(),
      rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
    },
  };
});

vi.mock('../shared/supabase-client-factory', () => ({
  createSupabaseClient: vi.fn(() => state.client),
  createSharedSupabaseClient: vi.fn(() => state.client),
}));

import { comandaRepository } from './repository';

describe('ComandaRepository — EB-2 regression guard', () => {
  beforeEach(() => {
    state.selectedColumns.length = 0;
    state.rows.length = 0;
    state.setError(null);
  });

  it('should_not_select_phantom_columns_in_list', async () => {
    state.rows.push({
      id: 'c1',
      tenant_id: 't1',
      client_id: 'cl1',
      appointment_id: 'a1',
      staff_id: 's1',
      status: 'paid',
      total: 120,
      payment_method: 'pix',
      created_at: '2026-08-01T10:00:00.000Z',
      closed_at: '2026-08-01T10:05:00.000Z',
    });

    const result = await comandaRepository.list('t1');

    const select = state.selectedColumns[0];
    expect(select).not.toContain('client_name');
    expect(select).not.toContain('paid_amount');
    expect(select).not.toContain('notes');

    expect(select).toContain('id');
    expect(select).toContain('tenant_id');
    expect(select).toContain('client_id');
    expect(select).toContain('appointment_id');
    expect(select).toContain('staff_id');
    expect(select).toContain('status');
    expect(select).toContain('total');
    expect(select).toContain('payment_method');
    expect(select).toContain('created_at');
    expect(select).toContain('closed_at');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('c1');
    expect(result[0].total).toBe(120);
    expect(result[0].status).toBe('paid');
    expect(result[0].client_id).toBe('cl1');
    expect(result[0].client_name ?? null).toBeNull();
    expect(result[0].paid_amount ?? 0).toBe(0);
    expect(result[0].notes ?? null).toBeNull();
  });

  it('should_not_select_phantom_columns_in_get', async () => {
    state.rows.push({
      id: 'c1',
      tenant_id: 't1',
      client_id: null,
      appointment_id: null,
      staff_id: null,
      status: 'open',
      total: 0,
      payment_method: null,
      created_at: '2026-08-01T10:00:00.000Z',
      closed_at: null,
    });

    const result = await comandaRepository.get('c1', 't1');

    const select = state.selectedColumns[0];
    expect(select).not.toContain('client_name');
    expect(select).not.toContain('paid_amount');
    expect(select).not.toContain('notes');

    expect(result).not.toBeNull();
    expect(result!.status).toBe('open');
    expect(result!.total).toBe(0);
  });

  it('should_not_select_phantom_columns_in_getByAppointment', async () => {
    state.rows.push({
      id: 'c1',
      tenant_id: 't1',
      client_id: 'cl1',
      appointment_id: 'a1',
      staff_id: null,
      status: 'open',
      total: 90,
      payment_method: null,
      created_at: '2026-08-01T10:00:00.000Z',
      closed_at: null,
    });

    const result = await comandaRepository.getByAppointment('a1', 't1');

    const select = state.selectedColumns[0];
    expect(select).not.toContain('client_name');
    expect(select).not.toContain('paid_amount');
    expect(select).not.toContain('notes');

    expect(result).not.toBeNull();
    expect(result!.appointment_id).toBe('a1');
  });

  it('should_not_select_phantom_columns_in_getByClient', async () => {
    state.rows.push({
      id: 'c1',
      tenant_id: 't1',
      client_id: 'cl1',
      appointment_id: null,
      staff_id: null,
      status: 'paid',
      total: 50,
      payment_method: 'cash',
      created_at: '2026-08-01T10:00:00.000Z',
      closed_at: '2026-08-01T10:01:00.000Z',
    });

    const result = await comandaRepository.getByClient('cl1', 't1');

    const select = state.selectedColumns[0];
    expect(select).not.toContain('client_name');
    expect(select).not.toContain('paid_amount');
    expect(select).not.toContain('notes');

    expect(result).toHaveLength(1);
  });

  it('should_throw_repository_error_when_list_fails', async () => {
    state.setError({ message: 'column client_name does not exist', code: '42703' });

    await expect(comandaRepository.list('t1')).rejects.toThrow(/column client_name/);
  });
});
