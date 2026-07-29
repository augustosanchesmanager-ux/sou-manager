/**
 * [SMG][DOMAIN][EVENTS][OUTBOX] PersistentIdempotencyStore Tests
 *
 * Suite de testes para PersistentIdempotencyStore.
 * Segue convenções do projeto: AAA, should_<result>_when_<condition>.
 *
 * GRUPO A: has() — Check if operation was executed
 * GRUPO B: set() — Record executed operation
 * GRUPO C: Edge Cases (missing tenantId, DB errors, UNIQUE violations)
 * GRUPO D: Integration with FinanceProvider
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPersistentIdempotencyStore, type SupabaseClient } from './persistentIdempotencyStore';
import { createFinanceProvider, InMemoryIdempotencyStore } from './financeProvider';
import { InMemoryOutbox } from '../../inMemoryOutbox';
import { InMemoryDispatcher } from '../../inMemoryDispatcher';
import type { OutboxItem, DispatchTarget } from '../../types';
import type { OperationHandler } from './financeProvider';

// ─── Mock Helpers ────────────────────────────────────────────────

const buildMockDb = () => {
  const store = new Map<string, Record<string, unknown>>();

  const db = {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockImplementation(async () => {
              // The chain is: .from().select().eq().eq().maybeSingle()
              // We need to check what was stored
              const calls = db.from.mock.results;
              const lastCall = calls[calls.length - 1];
              const table = lastCall?.args?.[0];

              // Get the eq chain values
              const eqCalls = db.from.mock.results;
              let tenantId = '';
              let idempotencyKey = '';

              // Walk the mock chain to extract values
              const selectResult = db.from.mock.results[0]?.value?.select.mock.results[0];
              const eq1Result = selectResult?.value?.eq.mock.results[0];
              const eq2Result = eq1Result?.value?.eq.mock.results[0];

              if (eq1Result?.args) tenantId = eq1Result.args[1] as string;
              if (eq2Result?.args) idempotencyKey = eq2Result.args[1] as string;

              const compositeKey = `${tenantId}:${idempotencyKey}`;
              const exists = store.has(compositeKey);

              return {
                data: exists ? { id: 'existing-id' } : null,
                error: null,
              };
            }),
          }),
        }),
      }),
      insert: vi.fn().mockImplementation(async (row: Record<string, unknown>) => {
        const compositeKey = `${row.tenant_id}:${row.idempotency_key}`;
        if (store.has(compositeKey)) {
          return {
            data: null,
            error: { code: '23505', message: 'duplicate key value violates unique constraint' },
          };
        }
        store.set(compositeKey, row);
        return { data: row, error: null };
      }),
    }),
  };

  return { db: db as unknown as SupabaseClient, store };
};

const buildSimpleMockDb = () => {
  const stored = new Map<string, boolean>();

  const mockEq = (column: string, value: unknown) => ({
    eq: vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({
        data: stored.has(`${value}:${(mockEq as any)._nextValue}`) ? { id: '1' } : null,
        error: null,
      }),
    }),
    _nextValue: value,
  });

  // Simpler approach: use a closure to track the last two eq values
  let lastTenantId = '';
  let lastIdempotencyKey = '';

  const db = {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockImplementation((_col: string, val: unknown) => {
          lastTenantId = val as string;
          return {
            eq: vi.fn().mockImplementation((_col2: string, val2: unknown) => {
              lastIdempotencyKey = val2 as string;
              return {
                maybeSingle: vi.fn().mockResolvedValue({
                  data: stored.has(`${lastTenantId}:${lastIdempotencyKey}`) ? { id: '1' } : null,
                  error: null,
                }),
              };
            }),
          };
        }),
      }),
      insert: vi.fn().mockImplementation(async (row: Record<string, unknown>) => {
        const key = `${row.tenant_id}:${row.idempotency_key}`;
        if (stored.has(key)) {
          return { data: null, error: { code: '23505', message: 'unique violation' } };
        }
        stored.set(key, true);
        return { data: row, error: null };
      }),
    }),
  };

  return { db: db as unknown as SupabaseClient, stored };
};

const buildOutboxItem = (overrides?: Partial<OutboxItem>): OutboxItem => ({
  id: 'outbox_1',
  eventId: 'evt_1',
  eventType: 'CheckoutCompleted',
  tenantId: 'tenant-1',
  targets: [{ provider: 'finance', config: {} }],
  status: 'pending',
  retry: { attempts: 0, maxAttempts: 5, nextRetryAt: null, lastError: null, baseDelayMs: 1000 },
  payload: {
    operationType: 'create_transaction',
    operationData: { amount: 100 },
    idempotencyKey: 'evt_1_create_transaction',
    sourceEvent: 'CheckoutCompleted',
  },
  metadata: { tenantId: 'tenant-1' },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  dispatchedAt: null,
  completedAt: null,
  ...overrides,
});

// ═══════════════════════════════════════════════════════════════════
// GRUPO A: has() — Check if operation was executed
// ═══════════════════════════════════════════════════════════════════

describe('PersistentIdempotencyStore', () => {
  // ── Group A: has() ───────────────────────────────────────────

  describe('has()', () => {
    it('should_return_false_when_key_not_found', async () => {
      const { db } = buildSimpleMockDb();
      const store = createPersistentIdempotencyStore({ db });

      const result = await store.has('evt_1_create_transaction', 'tenant-1');

      expect(result).toBe(false);
    });

    it('should_return_true_when_key_exists', async () => {
      const { db, stored } = buildSimpleMockDb();
      stored.set('tenant-1:evt_1_create_transaction', true);
      const store = createPersistentIdempotencyStore({ db });

      const result = await store.has('evt_1_create_transaction', 'tenant-1');

      expect(result).toBe(true);
    });

    it('should_return_false_when_no_tenant_id', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { db } = buildSimpleMockDb();
      const store = createPersistentIdempotencyStore({ db });

      const result = await store.has('evt_1_create_transaction');

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  // ── Group B: set() ──────────────────────────────────────────

  describe('set()', () => {
    it('should_insert_operation', async () => {
      const { db, stored } = buildSimpleMockDb();
      const store = createPersistentIdempotencyStore({ db });

      await store.set('evt_1_create_transaction', 'tenant-1');

      expect(stored.has('tenant-1:evt_1_create_transaction')).toBe(true);
    });

    it('should_handle_unique_violation_gracefully', async () => {
      const { db, stored } = buildSimpleMockDb();
      stored.set('tenant-1:evt_1_create_transaction', true); // Pre-existing
      const store = createPersistentIdempotencyStore({ db });

      // Should not throw
      await expect(
        store.set('evt_1_create_transaction', 'tenant-1'),
      ).resolves.not.toThrow();
    });

    it('should_warn_when_no_tenant_id', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { db } = buildSimpleMockDb();
      const store = createPersistentIdempotencyStore({ db });

      await store.set('evt_1_create_transaction');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should_parse_event_id_and_operation_type_from_key', async () => {
      const { db, stored } = buildSimpleMockDb();
      const store = createPersistentIdempotencyStore({ db });

      await store.set('evt_abc123_create_transaction', 'tenant-1');

      expect(stored.has('tenant-1:evt_abc123_create_transaction')).toBe(true);
    });
  });

  // ── Group C: Edge Cases ─────────────────────────────────────

  describe('edge cases', () => {
    it('should_return_false_on_db_error_in_has', async () => {
      const db = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockRejectedValue(new Error('DB connection lost')),
              }),
            }),
          }),
        }),
      } as unknown as SupabaseClient;

      const store = createPersistentIdempotencyStore({ db });
      const result = await store.has('key-1', 'tenant-1');

      expect(result).toBe(false); // Safe default
    });

    it('should_not_throw_on_db_error_in_set', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const db = {
        from: vi.fn().mockReturnValue({
          insert: vi.fn().mockRejectedValue(new Error('DB connection lost')),
        }),
      } as unknown as SupabaseClient;

      const store = createPersistentIdempotencyStore({ db });

      await expect(
        store.set('key-1', 'tenant-1'),
      ).resolves.not.toThrow();
      consoleSpy.mockRestore();
    });

    it('should_use_custom_table_name', async () => {
      const { db } = buildSimpleMockDb();
      const store = createPersistentIdempotencyStore({
        db,
        tableName: 'custom_idempotency',
      });

      await store.has('key-1', 'tenant-1');

      expect(db.from).toHaveBeenCalledWith('custom_idempotency');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// GRUPO D: Integration with FinanceProvider
// ═══════════════════════════════════════════════════════════════════

describe('PersistentIdempotencyStore — FinanceProvider Integration', () => {
  it('should_prevent_duplicate_execution_via_persistent_store', async () => {
    const mock = buildSimpleMockDb();
    // Pre-store the idempotency key
    mock.stored.set('tenant-1:evt_1_create_transaction', true);

    const handler: OperationHandler = {
      execute: vi.fn().mockResolvedValue({ success: true }),
    };

    const store = createPersistentIdempotencyStore({
      db: mock.db,
    });

    const provider = createFinanceProvider({
      handlers: { create_transaction: handler },
      idempotencyStore: store,
    });

    const item = buildOutboxItem();
    const target: DispatchTarget = { provider: 'finance', config: {} };

    const result = await provider.deliver(item, target);

    // Should be skipped (already in persistent store)
    expect(result.success).toBe(true);
    expect(handler.execute).not.toHaveBeenCalled();
  });

  it('should_execute_when_not_in_persistent_store', async () => {
    const mock = buildSimpleMockDb();
    const handler: OperationHandler = {
      execute: vi.fn().mockResolvedValue({ success: true }),
    };

    const store = createPersistentIdempotencyStore({
      db: mock.db,
    });

    const provider = createFinanceProvider({
      handlers: { create_transaction: handler },
      idempotencyStore: store,
    });

    const item = buildOutboxItem();
    const target: DispatchTarget = { provider: 'finance', config: {} };

    const result = await provider.deliver(item, target);

    expect(result.success).toBe(true);
    expect(handler.execute).toHaveBeenCalledTimes(1);
  });
});
