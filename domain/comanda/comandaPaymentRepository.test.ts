/**
 * [SMG][DOMAIN][COMANDA] comandaPaymentRepository tests
 *
 * Regressao: a base liquidada do fechamento de caixa depende de
 * `reversed_at IS NULL` — pagamento estornado nao pode entrar no repasse.
 *
 * Convencoes: AAA, should_<result>_when_<condition>.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

const state = vi.hoisted(() => {
  const selectedColumns: string[] = [];
  const filters: { isNull: string[]; eq: string[]; inFilter: unknown } = {
    isNull: [],
    eq: [],
    inFilter: null,
  };
  const rows: Record<string, unknown>[] = [];
  let errorValue: { message: string; code?: string } | null = null;

  const makeQuery = () => {
    const q: any = {
      select: (cols: string) => {
        selectedColumns.push(cols);
        return q;
      },
      eq: (col: string, _val: unknown) => {
        filters.eq.push(col);
        return q;
      },
      in: (_col: string, values: unknown) => {
        filters.inFilter = values;
        return q;
      },
      is: (col: string, val: unknown) => {
        if (val === null) filters.isNull.push(col);
        return q;
      },
      then: (resolve: (r: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(
          errorValue !== null ? { data: null, error: errorValue } : { data: rows, error: null },
        ).then(resolve, reject),
    };
    return q;
  };

  return {
    selectedColumns,
    filters,
    rows,
    setError: (e: { message: string; code?: string } | null) => {
      errorValue = e;
    },
    client: { from: () => makeQuery() },
  };
});

vi.mock('../shared/supabase-client-factory', () => ({
  createSupabaseClient: () => state.client,
  createSharedSupabaseClient: () => state.client,
}));

import { comandaPaymentRepository } from './comandaPaymentRepository';

describe('comandaPaymentRepository', () => {
  beforeEach(() => {
    state.selectedColumns.length = 0;
    state.filters.isNull.length = 0;
    state.filters.eq.length = 0;
    state.filters.inFilter = null;
    state.rows.length = 0;
    state.setError(null);
  });

  describe('getPaymentsByComandaIds', () => {
    it('should_select_payment_columns_including_reversed_at', async () => {
      state.rows.push({
        id: 'p1',
        comanda_id: 'c1',
        payment_type: 'parcial',
        amount: 60,
        payment_method: 'pix',
        reversed_at: null,
      });

      await comandaPaymentRepository.getPaymentsByComandaIds(['c1'], 't1');

      expect(state.selectedColumns[0]).toContain('reversed_at');
      expect(state.selectedColumns[0]).toContain('amount');
      expect(state.selectedColumns[0]).toContain('comanda_id');
    });

    it('should_filter_reversed_at_null_when_querying', async () => {
      await comandaPaymentRepository.getPaymentsByComandaIds(['c1'], 't1');

      // Sem este filtro a base liquidada contaria pagamento estornado.
      expect(state.filters.isNull).toContain('reversed_at');
    });

    it('should_filter_by_tenant_and_comanda_ids', async () => {
      await comandaPaymentRepository.getPaymentsByComandaIds(['c1', 'c2'], 't1');

      expect(state.filters.eq).toContain('tenant_id');
      expect(state.filters.inFilter).toEqual(['c1', 'c2']);
    });

    it('should_return_empty_without_query_when_no_comanda_ids', async () => {
      const result = await comandaPaymentRepository.getPaymentsByComandaIds([], 't1');

      expect(result).toEqual([]);
      expect(state.selectedColumns).toHaveLength(0);
    });

    it('should_throw_when_query_fails', async () => {
      state.setError({ message: 'column missing', code: '42703' });

      await expect(comandaPaymentRepository.getPaymentsByComandaIds(['c1'], 't1')).rejects.toThrow();
    });
  });

  describe('escrita bloqueada (ADR-018 append-only)', () => {
    it('should_reject_upsert', async () => {
      await expect(comandaPaymentRepository.upsert()).rejects.toThrow();
    });

    it('should_reject_delete', async () => {
      await expect(comandaPaymentRepository.delete()).rejects.toThrow();
    });
  });
});
