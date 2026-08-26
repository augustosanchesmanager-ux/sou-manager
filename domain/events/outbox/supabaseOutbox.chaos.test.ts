/**
 * [SMG][DOMAIN][EVENTS][OUTBOX] SupabaseOutbox Chaos Tests
 *
 * Validates all 9 scenarios from the Trilha C PREVIEW + E2E/CHAOS gate.
 * Uses a mock Supabase client that simulates DB behavior in-memory.
 *
 * Scenarios:
 *   1. Persistence: enqueue writes to DB, findNext reads from DB
 *   2. Reload: items survive new outbox instance (same DB)
 *   3. Concurrent claim: two dispatchers, only one succeeds
 *   4. Retry: provider fails → item stays recoverable
 *   5. Stale processing: item stuck → recovery resets to pending
 *   6. Idempotency: duplicate event_id → idempotent success
 *   7. Multi-tenancy: tenant isolation enforced
 *   8. Full flow: enqueue → claim → dispatch → published
 *   9. Regression: InMemoryOutbox unchanged
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SupabaseOutbox, createSupabaseOutbox } from './supabaseOutbox';
import { InMemoryOutbox, createOutbox } from './inMemoryOutbox';
import type { OutboxItem } from './types';

// ─── Mock Supabase Client ───────────────────────────────────────

/**
 * Simplified mock that simulates the Supabase Postgrest chain API.
 * All chain methods return a builder object that accumulates query state,
 * and terminal methods (.single, .maybeSingle, or awaiting the promise)
 * execute against the in-memory table.
 */
function createMockSupabaseClient() {
  const table = new Map<string, Record<string, unknown>>();
  let idSeq = 0;

  /**
   * Creates a builder that mimics Supabase PostgREST chain API.
   *
   * Supabase behavior:
   *   - `select('*')...await` → { data: Row[], error }  (array)
   *   - `select('*')...single()` → { data: Row, error }  (single)
   *   - `select('*')...maybeSingle()` → { data: Row|null, error }  (single|null)
   *   - `insert(row).select().single()` → { data: Row, error }  (inserted row)
   *   - `update({...}).eq('id', id)` → { data: null, error }  (no select)
   *   - `select('id', { count: 'exact', head: true })...await` → { count: N, error }
   */
  function createBuilder() {
    let _cols: string | null = null;
    let _filters: Array<{ col: string; op: string; val: unknown }> = [];
    let _orderBy: { col: string; asc: boolean } | null = null;
    let _limitN: number | null = null;
    let _isCount = false;
    let _headOnly = false;
    let _isInsert = false;
    let _insertData: Record<string, unknown> | null = null;
    let _isUpdate = false;
    let _updateData: Record<string, unknown> | null = null;
    // Tracks what terminal was called: 'then' = plain await, 'single', 'maybeSingle'
    let _terminalCalled: 'then' | 'single' | 'maybeSingle' = 'then';

    function getFilteredRows(): Record<string, unknown>[] {
      let rows = Array.from(table.values());
      for (const f of _filters) {
        rows = rows.filter((r) => {
          const v = r[f.col];
          if (f.op === 'eq') return v === f.val;
          if (f.op === 'gt') return v !== null && v !== undefined && String(v) > String(f.val);
          if (f.op === 'lt') return v !== null && v !== undefined && String(v) < String(f.val);
          return true;
        });
      }
      if (_orderBy) {
        rows.sort((a, b) => {
          const av = String(a[_orderBy!.col] ?? '');
          const bv = String(b[_orderBy!.col] ?? '');
          return _orderBy!.asc ? av.localeCompare(bv) : bv.localeCompare(av);
        });
      }
      if (_limitN !== null) rows = rows.slice(0, _limitN);
      return rows;
    }

    const builder: Record<string, unknown> = {
      select: (cols?: string, opts?: { count?: string; head?: boolean }) => {
        _cols = cols ?? '*';
        if (opts?.count === 'exact') { _isCount = true; _headOnly = opts.head ?? false; }
        return builder;
      },
      eq: (col: string, val: unknown) => { _filters.push({ col, op: 'eq', val }); return builder; },
      gt: (col: string, val: unknown) => { _filters.push({ col, op: 'gt', val }); return builder; },
      lt: (col: string, val: unknown) => { _filters.push({ col, op: 'lt', val }); return builder; },
      order: (col: string, _opts?: { ascending?: boolean }) => { _orderBy = { col, asc: _opts?.ascending !== false }; return builder; },
      limit: (n: number) => { _limitN = n; return builder; },
      count: (_col: string, opts?: { count?: string; head?: boolean }) => {
        if (opts?.count === 'exact') { _isCount = true; _headOnly = opts.head ?? false; }
        return builder;
      },
      insert: (row: Record<string, unknown>) => { _isInsert = true; _insertData = row; return builder; },
      update: (data: Record<string, unknown>) => { _isUpdate = true; _updateData = data; return builder; },
      single: () => { _terminalCalled = 'single'; return executeTerminal(); },
      maybeSingle: () => { _terminalCalled = 'maybeSingle'; return executeTerminal(); },
      then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
        _terminalCalled = 'then';
        try { resolve(executeTerminal()); } catch (e) { reject?.(e); }
      },
    };

    function executeTerminal(): unknown {
      // Count path
      if (_isCount) {
        const rows = getFilteredRows();
        return { count: rows.length, data: null, error: null };
      }

      // Insert path
      if (_isInsert && _insertData) {
        idSeq++;
        const id = `outbox_${idSeq}`;
        const now = new Date().toISOString();

        const eventVal = _insertData['event_id'];
        for (const row of table.values()) {
          if (row['event_id'] === eventVal) {
            return { data: null, error: { code: '23505', message: 'duplicate key' } };
          }
        }

        const inserted = { ..._insertData, id, created_at: now, updated_at: now };
        table.set(id, inserted);

        if (_terminalCalled === 'single') return { data: inserted, error: null };
        if (_terminalCalled === 'maybeSingle') return { data: inserted, error: null };
        // Plain await after insert (without .select()) — return array
        return { data: [inserted], error: null };
      }

      // Update path
      if (_isUpdate && _updateData) {
        const idFilter = _filters.find((f) => f.col === 'id');
        let updatedRow: Record<string, unknown> | null = null;

        if (idFilter) {
          const row = table.get(idFilter.val as string);
          if (row) {
            let lockOk = true;
            for (const f of _filters) {
              if (f.col !== 'id' && row[f.col] !== f.val) { lockOk = false; break; }
            }
            if (lockOk) { Object.assign(row, _updateData); updatedRow = row; }
          }
        } else {
          // No id filter — match by ALL filters (optimistic lock)
          for (const row of table.values()) {
            let match = true;
            for (const f of _filters) {
              if (row[f.col] !== f.val) { match = false; break; }
            }
            if (match) { Object.assign(row, _updateData); updatedRow = row; break; }
          }
        }

        if (_terminalCalled === 'single') {
          if (!updatedRow) return { data: null, error: { message: 'Update failed' } };
          return { data: updatedRow, error: null };
        }
        if (_terminalCalled === 'maybeSingle') {
          if (!updatedRow) return { data: null, error: { message: 'Update failed' } };
          return { data: updatedRow, error: null };
        }
        // Plain await after update (no .select()) — Supabase returns { data: null, error }
        if (!updatedRow) return { data: null, error: { message: 'Update failed' } };
        return { data: null, error: null };
      }

      // Select path
      const rows = getFilteredRows();

      if (_terminalCalled === 'single') {
        if (rows.length === 0) return { data: null, error: { code: 'PGRST116', message: 'Not found' } };
        return { data: rows[0], error: null };
      }
      if (_terminalCalled === 'maybeSingle') {
        return { data: rows[0] ?? null, error: null };
      }
      // Plain await: returns array (Supabase default behavior for select without .single())
      return { data: rows, error: null };
    }

    return builder;
  }

  const client = {
    from: (_table: string) => createBuilder(),
  };

  return { client, table, getTable: () => table };
}

// ═══════════════════════════════════════════════════════════════════
// CHAOS TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Chaos: SupabaseOutbox — Trilha C Gate [E2E/CHAOS]', () => {
  let mock: ReturnType<typeof createMockSupabaseClient>;
  let outbox: SupabaseOutbox;

  beforeEach(() => {
    mock = createMockSupabaseClient();
    outbox = createSupabaseOutbox();
    (outbox as unknown as { client: ReturnType<typeof createMockSupabaseClient>['client'] }).client = mock.client;
  });

  // ── Scenario 1: Persistence ────────────────────────────────────

  describe('Scenario 1: Persistence — items survive in DB', () => {
    it('should persist enqueue to DB and retrieve via findNext', async () => {
      await outbox.enqueue({
        eventId: 'evt_persist_1',
        eventType: 'CheckoutCompleted',
        tenantId: 'tenant-1',
        targets: [{ provider: 'finance', config: {} }],
        payload: { comandaId: 'c-1', total: 100 },
        metadata: { tenantId: 'tenant-1', source: 'test' },
      });

      // Verify in mock DB
      expect(mock.table.size).toBe(1);
      const dbRow = Array.from(mock.table.values())[0];
      expect(dbRow.event_id).toBe('evt_persist_1');
      expect(dbRow.status).toBe('pending');

      // Find next from DB
      const next = await outbox.findNext();
      expect(next).not.toBeNull();
      expect(next!.eventId).toBe('evt_persist_1');
      expect(next!.status).toBe('processing');
    });
  });

  // ── Scenario 2: Reload ────────────────────────────────────────

  describe('Scenario 2: Reload — items survive new outbox instance', () => {
    it('should find pending item after creating a new SupabaseOutbox instance', async () => {
      const outbox1 = createSupabaseOutbox();
      (outbox1 as unknown as { client: ReturnType<typeof createMockSupabaseClient>['client'] }).client = mock.client;

      await outbox1.enqueue({
        eventId: 'evt_reload_1',
        eventType: 'CheckoutCompleted',
        tenantId: 'tenant-1',
        targets: [{ provider: 'finance', config: {} }],
        payload: { comandaId: 'c-2', total: 200 },
        metadata: { tenantId: 'tenant-1', source: 'test' },
      });

      // Simulate page reload: new instance, same DB
      const outbox2 = createSupabaseOutbox();
      (outbox2 as unknown as { client: ReturnType<typeof createMockSupabaseClient>['client'] }).client = mock.client;

      const next = await outbox2.findNext();
      expect(next).not.toBeNull();
      expect(next!.eventId).toBe('evt_reload_1');
      expect(next!.status).toBe('processing');
    });
  });

  // ── Scenario 3: Concurrent claim ──────────────────────────────

  describe('Scenario 3: Concurrent claim — exactly one dispatcher wins', () => {
    it('should only allow one dispatcher to claim a pending item', async () => {
      await outbox.enqueue({
        eventId: 'evt_claim_1',
        eventType: 'CheckoutCompleted',
        tenantId: 'tenant-1',
        targets: [{ provider: 'finance', config: {} }],
        payload: { comandaId: 'c-3', total: 300 },
        metadata: { tenantId: 'tenant-1', source: 'test' },
      });

      const claimA = await outbox.findNext();
      expect(claimA).not.toBeNull();
      expect(claimA!.status).toBe('processing');

      const claimB = await outbox.findNext();
      expect(claimB).toBeNull();

      const processingRows = Array.from(mock.table.values()).filter((r) => r.status === 'processing');
      expect(processingRows.length).toBe(1);
    });
  });

  // ── Scenario 4: Retry ─────────────────────────────────────────

  describe('Scenario 4: Retry — failed item stays recoverable', () => {
    it('should mark failed and schedule retry with backoff', async () => {
      const item = await outbox.enqueue({
        eventId: 'evt_retry_1',
        eventType: 'CheckoutCompleted',
        tenantId: 'tenant-1',
        targets: [{ provider: 'finance', config: {} }],
        payload: { comandaId: 'c-4', total: 400 },
        metadata: { tenantId: 'tenant-1', source: 'test' },
      });

      const claimed = await outbox.findNext();
      expect(claimed).not.toBeNull();

      await outbox.markFailed(claimed!.id, 'Provider timeout');

      const dbRow = Array.from(mock.table.values())[0];
      expect(dbRow.status).toBe('pending');
      expect(dbRow.retry_attempts).toBe(1);
      expect(dbRow.retry_last_error).toBe('Provider timeout');
      expect(dbRow.retry_next_retry_at).not.toBeNull();
      expect(dbRow.processing_started_at).toBeNull();
      expect(dbRow.claimed_by).toBeNull();
    });

    it('should move to dead letter after max attempts', async () => {
      await outbox.enqueue({
        eventId: 'evt_retry_2',
        eventType: 'CheckoutCompleted',
        tenantId: 'tenant-1',
        targets: [{ provider: 'finance', config: {} }],
        payload: { comandaId: 'c-5', total: 500 },
        metadata: { tenantId: 'tenant-1', source: 'test' },
        retry: { maxAttempts: 2 },
      });

      const claimed1 = await outbox.findNext();
      await outbox.markFailed(claimed1!.id, 'Error 1');

      const claimed2 = await outbox.findNext();
      expect(claimed2).not.toBeNull();
      await outbox.markFailed(claimed2!.id, 'Error 2');

      const dbRow = Array.from(mock.table.values())[0];
      expect(dbRow.status).toBe('dead_letter');
      expect(dbRow.retry_attempts).toBe(2);
      expect(dbRow.completed_at).not.toBeNull();
    });
  });

  // ── Scenario 5: Stale processing ──────────────────────────────

  describe('Scenario 5: Stale processing — stuck items reset to pending', () => {
    it('should recover items stuck in processing for >5 minutes', async () => {
      await outbox.enqueue({
        eventId: 'evt_stale_1',
        eventType: 'CheckoutCompleted',
        tenantId: 'tenant-1',
        targets: [{ provider: 'finance', config: {} }],
        payload: { comandaId: 'c-6', total: 600 },
        metadata: { tenantId: 'tenant-1', source: 'test' },
      });

      const claimed = await outbox.findNext();
      expect(claimed).not.toBeNull();

      // Simulate stale: 10 minutes ago
      const staleTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const dbRow = Array.from(mock.table.values())[0];
      dbRow.processing_started_at = staleTime;

      const recovered = await outbox.recoverStaleProcessing();
      expect(recovered).toBe(1);

      expect(dbRow.status).toBe('pending');
      expect(dbRow.processing_started_at).toBeNull();
      expect(dbRow.claimed_by).toBeNull();
    });

    it('should NOT recover items stuck for <5 minutes', async () => {
      await outbox.enqueue({
        eventId: 'evt_stale_2',
        eventType: 'CheckoutCompleted',
        tenantId: 'tenant-1',
        targets: [{ provider: 'finance', config: {} }],
        payload: { comandaId: 'c-7', total: 700 },
        metadata: { tenantId: 'tenant-1', source: 'test' },
      });

      const claimed = await outbox.findNext();

      const recentTime = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const dbRow = Array.from(mock.table.values())[0];
      dbRow.processing_started_at = recentTime;

      const recovered = await outbox.recoverStaleProcessing();
      expect(recovered).toBe(0);
      expect(dbRow.status).toBe('processing');
    });
  });

  // ── Scenario 6: Idempotency ───────────────────────────────────

  describe('Scenario 6: Idempotency — duplicate event_id rejected', () => {
    it('should return existing item on duplicate event_id', async () => {
      const input = {
        eventId: 'evt_idem_1',
        eventType: 'CheckoutCompleted',
        tenantId: 'tenant-1',
        targets: [{ provider: 'finance', config: {} }],
        payload: { comandaId: 'c-8', total: 800 },
        metadata: { tenantId: 'tenant-1', source: 'test' },
      };

      const item1 = await outbox.enqueue(input);
      expect(item1.id).toBeDefined();

      const item2 = await outbox.enqueue(input);
      expect(item2.id).toBe(item1.id);
      expect(item2.eventId).toBe('evt_idem_1');

      expect(mock.table.size).toBe(1);
    });
  });

  // ── Scenario 7: Multi-tenancy ─────────────────────────────────

  describe('Scenario 7: Multi-tenancy — tenant isolation', () => {
    it('should only return items for the queried tenant', async () => {
      await outbox.enqueue({
        eventId: 'evt_tenant_a',
        eventType: 'CheckoutCompleted',
        tenantId: 'tenant-A',
        targets: [{ provider: 'finance', config: {} }],
        payload: { comandaId: 'c-a', total: 100 },
        metadata: { tenantId: 'tenant-A', source: 'test' },
      });

      await outbox.enqueue({
        eventId: 'evt_tenant_b',
        eventType: 'CheckoutCompleted',
        tenantId: 'tenant-B',
        targets: [{ provider: 'finance', config: {} }],
        payload: { comandaId: 'c-b', total: 200 },
        metadata: { tenantId: 'tenant-B', source: 'test' },
      });

      const next = await outbox.findNext();
      expect(next).not.toBeNull();
      expect(next!.tenantId).toBe('tenant-A');

      const tenantAItems = await outbox.find({ tenantId: 'tenant-A' });
      expect(tenantAItems.length).toBe(1);
      expect(tenantAItems[0].tenantId).toBe('tenant-A');

      const tenantBItems = await outbox.find({ tenantId: 'tenant-B' });
      expect(tenantBItems.length).toBe(1);
      expect(tenantBItems[0].tenantId).toBe('tenant-B');
    });
  });

  // ── Scenario 8: Full flow ─────────────────────────────────────

  describe('Scenario 8: Full flow — enqueue → claim → dispatch → published', () => {
    it('should complete the full outbox lifecycle', async () => {
      const item = await outbox.enqueue({
        eventId: 'evt_full_1',
        eventType: 'CheckoutCompleted',
        tenantId: 'tenant-1',
        targets: [{ provider: 'finance', config: {} }],
        payload: { comandaId: 'c-full', total: 150 },
        metadata: { tenantId: 'tenant-1', source: 'test' },
      });
      expect(item.status).toBe('pending');

      const claimed = await outbox.findNext();
      expect(claimed).not.toBeNull();
      expect(claimed!.status).toBe('processing');
      expect(claimed!.processingStartedAt).not.toBeNull();
      expect(claimed!.claimedBy).toBe('dispatcher');

      await outbox.markPublished(claimed!.id);

      const dbRow = Array.from(mock.table.values())[0];
      expect(dbRow.status).toBe('published');
      expect(dbRow.completed_at).not.toBeNull();
    });
  });

  // ── Scenario 9: Regression ────────────────────────────────────

  describe('Scenario 9: Regression — InMemoryOutbox unchanged', () => {
    it('should still work with InMemoryOutbox', async () => {
      const memOutbox = createOutbox();
      const item = await memOutbox.enqueue({
        eventId: 'evt_mem_1',
        eventType: 'CheckoutCompleted',
        tenantId: 'tenant-1',
        targets: [{ provider: 'console', config: {} }],
        payload: { total: 999 },
        metadata: { source: 'test' },
      });

      expect(item.status).toBe('pending');
      expect(item.id).toMatch(/^outbox_/);

      const next = await memOutbox.findNext();
      expect(next).not.toBeNull();
      expect(next!.eventId).toBe('evt_mem_1');

      await memOutbox.markPublished(next!.id);
      const found = await memOutbox.findById(next!.id);
      expect(found?.status).toBe('published');
    });

    it('should still work with InMemoryDispatcher + InMemoryOutbox', async () => {
      const { InMemoryDispatcher } = await import('./inMemoryDispatcher');
      const { consoleProvider } = await import('./providers/consoleProvider');

      const memOutbox = createOutbox();
      const dispatcher = new InMemoryDispatcher(memOutbox);
      dispatcher.registerProvider(consoleProvider);

      await memOutbox.enqueue({
        eventId: 'evt_mem_2',
        eventType: 'CheckoutCompleted',
        tenantId: 'tenant-1',
        targets: [{ provider: 'console', config: {} }],
        payload: { total: 500 },
        metadata: { source: 'test' },
      });

      await dispatcher.dispatch();

      const allItems = await memOutbox.find();
      expect(allItems.length).toBe(1);
      expect(allItems[0].status).toBe('published');
    });
  });

  // ── Additional: Dead letter ───────────────────────────────────

  describe('Additional: moveToDeadLetter', () => {
    it('should manually move item to dead letter', async () => {
      const item = await outbox.enqueue({
        eventId: 'evt_dl_1',
        eventType: 'CheckoutCompleted',
        tenantId: 'tenant-1',
        targets: [{ provider: 'finance', config: {} }],
        payload: { comandaId: 'c-dl', total: 100 },
        metadata: { tenantId: 'tenant-1', source: 'test' },
      });

      const claimed = await outbox.findNext();
      expect(claimed).not.toBeNull();
      await outbox.moveToDeadLetter(claimed!.id, 'Manual investigation');

      const dbRow = Array.from(mock.table.values())[0];
      expect(dbRow.status).toBe('dead_letter');
      expect(dbRow.retry_last_error).toBe('Manual investigation');
      expect(dbRow.completed_at).not.toBeNull();
    });
  });

  // ── Additional: count and getDeadLetters ──────────────────────

  describe('Additional: count and getDeadLetters', () => {
    it('should count items by status', async () => {
      await outbox.enqueue({
        eventId: 'evt_count_1',
        eventType: 'CheckoutCompleted',
        tenantId: 'tenant-1',
        targets: [{ provider: 'finance', config: {} }],
        payload: { total: 10 },
        metadata: { source: 'test' },
      });
      await outbox.enqueue({
        eventId: 'evt_count_2',
        eventType: 'CheckoutCompleted',
        tenantId: 'tenant-1',
        targets: [{ provider: 'finance', config: {} }],
        payload: { total: 20 },
        metadata: { source: 'test' },
      });

      const total = await outbox.count();
      expect(total).toBe(2);

      const pendingCount = await outbox.count('pending');
      expect(pendingCount).toBe(2);
    });

    it('should return dead letter items', async () => {
      const item = await outbox.enqueue({
        eventId: 'evt_dl_2',
        eventType: 'CheckoutCompleted',
        tenantId: 'tenant-1',
        targets: [{ provider: 'finance', config: {} }],
        payload: { total: 50 },
        metadata: { source: 'test' },
      });

      const claimed = await outbox.findNext();
      expect(claimed).not.toBeNull();
      await outbox.moveToDeadLetter(claimed!.id, 'Test dead letter');

      const deadLetters = await outbox.getDeadLetters();
      expect(deadLetters.length).toBe(1);
      expect(deadLetters[0].status).toBe('dead_letter');
    });
  });
});
