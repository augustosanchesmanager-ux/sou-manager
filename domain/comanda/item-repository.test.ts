/**
 * [SMG][DOMAIN][COMANDA] item-repository tests
 *
 * Regression guard P1-01: listByComandaIds must SELECT staff_id so shared
 * comanda rateio can attribute items to professionals.
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
      in: () => q,
      insert: () => q,
      delete: () => q,
      then: (resolve: (r: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(resultFor(false)).then(resolve, reject),
    };
    return q;
  };

  return {
    selectedColumns,
    rows,
    setError: (e: { message: string; code?: string } | null) => {
      errorValue = e;
    },
    client: {
      from: () => makeQuery(),
    },
  };
});

vi.mock('../shared/supabase-client-factory', () => ({
  createSupabaseClient: vi.fn(() => state.client),
}));

import { comandaItemRepository } from './item-repository';

describe('ComandaItemRepository — P1-01 staff_id regression guard', () => {
  beforeEach(() => {
    state.selectedColumns.length = 0;
    state.rows.length = 0;
    state.setError(null);
  });

  it('should_select_staff_id_when_listByComandaIds', async () => {
    state.rows.push({
      id: 'i1',
      comanda_id: 'c1',
      service_id: 's1',
      product_name: null,
      quantity: 1,
      unit_price: 100,
      staff_id: 'staff-2',
    });

    const result = await comandaItemRepository.listByComandaIds(['c1'], 't1');

    expect(state.selectedColumns[0]).toContain('staff_id');
    expect(result[0].staff_id).toBe('staff-2');
  });

  it('should_return_row_with_null_staff_id_when_item_has_none', async () => {
    state.rows.push({
      id: 'i2',
      comanda_id: 'c1',
      service_id: null,
      product_name: 'Pomada',
      quantity: 2,
      unit_price: 30,
      staff_id: null,
    });

    const result = await comandaItemRepository.listByComandaIds(['c1'], 't1');

    expect(result[0].staff_id).toBeNull();
  });

  it('should_return_empty_without_query_when_no_comanda_ids', async () => {
    const result = await comandaItemRepository.listByComandaIds([], 't1');

    expect(result).toEqual([]);
    expect(state.selectedColumns).toHaveLength(0);
  });

  it('should_throw_when_query_fails', async () => {
    state.setError({ message: 'column missing', code: '42703' });

    await expect(comandaItemRepository.listByComandaIds(['c1'], 't1')).rejects.toThrow();
  });
});
