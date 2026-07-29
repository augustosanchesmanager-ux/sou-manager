/**
 * [SMG][DOMAIN][EVENTS][OUTBOX] Outbox + Dispatcher Tests
 *
 * Suite de testes para o Outbox Pattern.
 * Segue convenções do projeto: AAA, should_<result>_when_<condition>.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InMemoryOutbox, createOutbox } from './inMemoryOutbox';
import { InMemoryDispatcher, createDispatcher } from './inMemoryDispatcher';
import { consoleProvider } from './providers/consoleProvider';
import type { OutboxItem, DispatchTarget } from './types';
import type { DispatcherProvider } from './dispatcher';

// ─── Helpers ─────────────────────────────────────────────────────

const buildEnqueueInput = (overrides?: Partial<OutboxItem>) => ({
  eventId: 'evt_123',
  eventType: 'CheckoutCompleted',
  tenantId: 'tenant-1',
  targets: [{ provider: 'console', config: {} }] as DispatchTarget[],
  payload: { comandaId: 'comanda-1', total: 100 },
  metadata: { tenantId: 'tenant-1', source: 'CheckoutApplicationService', version: 1 },
  ...overrides,
});

const buildFailingProvider = (name = 'failing'): DispatcherProvider => ({
  name,
  async deliver() {
    return { success: false, error: 'Provider failure simulation' };
  },
});

const buildCrashingProvider = (name = 'crashing'): DispatcherProvider => ({
  name,
  async deliver() {
    throw new Error('Provider crash simulation');
  },
});

// ═══════════════════════════════════════════════════════════════════
// OUTBOX REPOSITORY
// ═══════════════════════════════════════════════════════════════════

describe('InMemoryOutbox', () => {
  let outbox: InMemoryOutbox;

  beforeEach(() => {
    outbox = createOutbox();
  });

  // ── Group A: Enqueue ─────────────────────────────────────────

  describe('enqueue', () => {
    it('should_create_pending_item_with_defaults', async () => {
      const item = await outbox.enqueue(buildEnqueueInput());

      expect(item.id).toMatch(/^outbox_/);
      expect(item.status).toBe('pending');
      expect(item.retry.attempts).toBe(0);
      expect(item.retry.maxAttempts).toBe(5);
      expect(item.retry.nextRetryAt).toBeNull();
      expect(item.retry.lastError).toBeNull();
      expect(item.dispatchedAt).toBeNull();
      expect(item.completedAt).toBeNull();
    });

    it('should_set_createdAt_and_updatedAt', async () => {
      const item = await outbox.enqueue(buildEnqueueInput());

      expect(item.createdAt).toBeTruthy();
      expect(item.updatedAt).toBe(item.createdAt);
    });

    it('should_accept_custom_retry_policy', async () => {
      const item = await outbox.enqueue(buildEnqueueInput({
        retry: { maxAttempts: 3, baseDelayMs: 500 },
      }));

      expect(item.retry.maxAttempts).toBe(3);
      expect(item.retry.baseDelayMs).toBe(500);
    });

    it('should_increment_id_sequentially', async () => {
      const i1 = await outbox.enqueue(buildEnqueueInput());
      const i2 = await outbox.enqueue(buildEnqueueInput());

      expect(i1.id).toBe('outbox_1');
      expect(i2.id).toBe('outbox_2');
    });
  });

  // ── Group B: Find Next ──────────────────────────────────────

  describe('findNext', () => {
    it('should_return_oldest_pending_item', async () => {
      const i1 = await outbox.enqueue(buildEnqueueInput({ eventType: 'Event1' }));
      const i2 = await outbox.enqueue(buildEnqueueInput({ eventType: 'Event2' }));

      const next = await outbox.findNext();

      expect(next?.id).toBe(i1.id);
    });

    it('should_return_null_when_no_pending_items', async () => {
      const next = await outbox.findNext();
      expect(next).toBeNull();
    });

    it('should_skip_processing_items', async () => {
      const i1 = await outbox.enqueue(buildEnqueueInput());
      await outbox.markProcessing(i1.id);

      const i2 = await outbox.enqueue(buildEnqueueInput());
      const next = await outbox.findNext();

      expect(next?.id).toBe(i2.id);
    });

    it('should_skip_published_items', async () => {
      const i1 = await outbox.enqueue(buildEnqueueInput());
      await outbox.markProcessing(i1.id);
      await outbox.markPublished(i1.id);

      const next = await outbox.findNext();
      expect(next).toBeNull();
    });

    it('should_skip_items_with_future_nextRetryAt', async () => {
      const i1 = await outbox.enqueue(buildEnqueueInput());
      await outbox.markProcessing(i1.id);
      await outbox.markFailed(i1.id, 'test error');

      // nextRetryAt is in the future (exponential backoff)
      const next = await outbox.findNext();
      expect(next).toBeNull();
    });
  });

  // ── Group C: Status Updates ─────────────────────────────────

  describe('markProcessing', () => {
    it('should_set_status_to_processing', async () => {
      const item = await outbox.enqueue(buildEnqueueInput());
      await outbox.markProcessing(item.id);

      const found = await outbox.findById(item.id);
      expect(found?.status).toBe('processing');
      expect(found?.dispatchedAt).toBeTruthy();
    });

    it('should_throw_when_item_not_found', async () => {
      await expect(outbox.markProcessing('nonexistent')).rejects.toThrow('not found');
    });
  });

  describe('markPublished', () => {
    it('should_set_status_to_published', async () => {
      const item = await outbox.enqueue(buildEnqueueInput());
      await outbox.markProcessing(item.id);
      await outbox.markPublished(item.id);

      const found = await outbox.findById(item.id);
      expect(found?.status).toBe('published');
      expect(found?.completedAt).toBeTruthy();
    });
  });

  describe('markFailed', () => {
    it('should_increment_attempts_and_set_pending_with_nextRetry', async () => {
      const item = await outbox.enqueue(buildEnqueueInput());
      await outbox.markProcessing(item.id);
      await outbox.markFailed(item.id, 'error 1');

      const found = await outbox.findById(item.id);
      expect(found?.status).toBe('pending');
      expect(found?.retry.attempts).toBe(1);
      expect(found?.retry.lastError).toBe('error 1');
      expect(found?.retry.nextRetryAt).toBeTruthy();
    });

    it('should_promote_to_dead_letter_after_maxAttempts', async () => {
      const item = await outbox.enqueue(buildEnqueueInput({
        retry: { maxAttempts: 2 },
      }));

      await outbox.markProcessing(item.id);
      await outbox.markFailed(item.id, 'error 1');
      await outbox.markProcessing(item.id);
      await outbox.markFailed(item.id, 'error 2');

      const found = await outbox.findById(item.id);
      expect(found?.status).toBe('dead_letter');
      expect(found?.retry.attempts).toBe(2);
      expect(found?.completedAt).toBeTruthy();
    });

    it('should_use_exponential_backoff', async () => {
      const item = await outbox.enqueue(buildEnqueueInput({
        retry: { baseDelayMs: 1000 },
      }));

      await outbox.markProcessing(item.id);
      await outbox.markFailed(item.id, 'error 1');

      const found = await outbox.findById(item.id);
      const nextRetry = new Date(found!.retry.nextRetryAt!).getTime();
      const now = Date.now();

      // Should be approximately 1000ms in the future (allow 200ms tolerance)
      expect(nextRetry - now).toBeGreaterThan(800);
      expect(nextRetry - now).toBeLessThan(1500);
    });
  });

  describe('moveToDeadLetter', () => {
    it('should_set_status_to_dead_letter', async () => {
      const item = await outbox.enqueue(buildEnqueueInput());
      await outbox.moveToDeadLetter(item.id, 'manual move');

      const found = await outbox.findById(item.id);
      expect(found?.status).toBe('dead_letter');
      expect(found?.retry.lastError).toBe('manual move');
      expect(found?.completedAt).toBeTruthy();
    });
  });

  // ── Group D: Query ──────────────────────────────────────────

  describe('find', () => {
    it('should_filter_by_status', async () => {
      const i1 = await outbox.enqueue(buildEnqueueInput());
      const i2 = await outbox.enqueue(buildEnqueueInput());
      await outbox.markProcessing(i1.id);
      await outbox.markPublished(i1.id);

      const published = await outbox.find({ status: 'published' });
      expect(published).toHaveLength(1);
      expect(published[0].id).toBe(i1.id);
    });

    it('should_filter_by_eventType', async () => {
      await outbox.enqueue(buildEnqueueInput({ eventType: 'CheckoutCompleted' }));
      await outbox.enqueue(buildEnqueueInput({ eventType: 'AppointmentCreated' }));

      const checkout = await outbox.find({ eventType: 'CheckoutCompleted' });
      expect(checkout).toHaveLength(1);
    });

    it('should_filter_by_tenantId', async () => {
      await outbox.enqueue(buildEnqueueInput({ tenantId: 't-1' }));
      await outbox.enqueue(buildEnqueueInput({ tenantId: 't-2' }));

      const t1 = await outbox.find({ tenantId: 't-1' });
      expect(t1).toHaveLength(1);
    });

    it('should_support_limit', async () => {
      await outbox.enqueue(buildEnqueueInput());
      await outbox.enqueue(buildEnqueueInput());
      await outbox.enqueue(buildEnqueueInput());

      const limited = await outbox.find({ limit: 2 });
      expect(limited).toHaveLength(2);
    });
  });

  describe('count', () => {
    it('should_count_all_items_when_no_status', async () => {
      await outbox.enqueue(buildEnqueueInput());
      await outbox.enqueue(buildEnqueueInput());

      expect(await outbox.count()).toBe(2);
    });

    it('should_count_by_status', async () => {
      const i1 = await outbox.enqueue(buildEnqueueInput());
      await outbox.markProcessing(i1.id);
      await outbox.markPublished(i1.id);
      await outbox.enqueue(buildEnqueueInput());

      expect(await outbox.count('published')).toBe(1);
      expect(await outbox.count('pending')).toBe(1);
    });
  });

  describe('getDeadLetters', () => {
    it('should_return_only_dead_letter_items', async () => {
      const i1 = await outbox.enqueue(buildEnqueueInput({ retry: { maxAttempts: 1 } }));
      await outbox.markProcessing(i1.id);
      await outbox.markFailed(i1.id, 'permanent failure');

      const i2 = await outbox.enqueue(buildEnqueueInput());

      const deadLetters = await outbox.getDeadLetters();
      expect(deadLetters).toHaveLength(1);
      expect(deadLetters[0].id).toBe(i1.id);
    });
  });

  // ── Group E: Factory ────────────────────────────────────────

  describe('createOutbox', () => {
    it('should_return_InMemoryOutbox_instance', () => {
      const o = createOutbox();
      expect(o).toBeInstanceOf(InMemoryOutbox);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// DISPATCHER
// ═══════════════════════════════════════════════════════════════════

describe('InMemoryDispatcher', () => {
  let outbox: InMemoryOutbox;
  let dispatcher: InMemoryDispatcher;

  beforeEach(() => {
    outbox = createOutbox();
    dispatcher = createDispatcher(outbox);
  });

  // ── Group F: Provider Management ─────────────────────────────

  describe('provider management', () => {
    it('should_register_provider', () => {
      dispatcher.registerProvider(consoleProvider);
      expect(dispatcher.getProviders()).toContain('console');
    });

    it('should_register_multiple_providers', () => {
      dispatcher.registerProvider(consoleProvider);
      dispatcher.registerProvider(buildFailingProvider('failing'));
      expect(dispatcher.getProviders()).toHaveLength(2);
    });
  });

  // ── Group G: Dispatch ────────────────────────────────────────

  describe('dispatch', () => {
    it('should_return_null_when_no_pending_items', async () => {
      const result = await dispatcher.dispatch();
      expect(result).toBeNull();
    });

    it('should_dispatch_to_provider_and_mark_published', async () => {
      const handler = vi.fn().mockResolvedValue({ success: true });
      const provider: DispatcherProvider = { name: 'console', deliver: handler };
      dispatcher.registerProvider(provider);

      await outbox.enqueue(buildEnqueueInput());
      const result = await dispatcher.dispatch();

      expect(result).not.toBeNull();
      expect(handler).toHaveBeenCalledTimes(1);

      const item = await outbox.findById(result!.id);
      expect(item?.status).toBe('published');
    });

    it('should_handle_multiple_targets_in_order', async () => {
      const callOrder: string[] = [];
      const p1: DispatcherProvider = {
        name: 'provider1',
        deliver: async () => { callOrder.push('p1'); return { success: true }; },
      };
      const p2: DispatcherProvider = {
        name: 'provider2',
        deliver: async () => { callOrder.push('p2'); return { success: true }; },
      };
      dispatcher.registerProvider(p1);
      dispatcher.registerProvider(p2);

      await outbox.enqueue(buildEnqueueInput({
        targets: [
          { provider: 'provider1', config: {} },
          { provider: 'provider2', config: {} },
        ],
      }));

      await dispatcher.dispatch();

      expect(callOrder).toEqual(['p1', 'p2']);
    });

    it('should_mark_failed_when_provider_not_found', async () => {
      await outbox.enqueue(buildEnqueueInput({
        targets: [{ provider: 'nonexistent', config: {} }],
      }));

      await dispatcher.dispatch();

      const item = await outbox.findById('outbox_1');
      expect(item?.status).toBe('pending');
      expect(item?.retry.lastError).toContain('not registered');
    });

    it('should_mark_failed_when_provider_fails', async () => {
      dispatcher.registerProvider(buildFailingProvider());

      await outbox.enqueue(buildEnqueueInput({
        targets: [{ provider: 'failing', config: {} }],
      }));
      await dispatcher.dispatch();

      const item = await outbox.findById('outbox_1');
      expect(item?.status).toBe('pending');
      expect(item?.retry.lastError).toBe('Provider failure simulation');
    });

    it('should_mark_failed_when_provider_throws', async () => {
      dispatcher.registerProvider(buildCrashingProvider());

      await outbox.enqueue(buildEnqueueInput({
        targets: [{ provider: 'crashing', config: {} }],
      }));
      await dispatcher.dispatch();

      const item = await outbox.findById('outbox_1');
      expect(item?.status).toBe('pending');
      expect(item?.retry.lastError).toBe('Provider crash simulation');
    });

    it('should_stop_on_first_failed_target', async () => {
      const handler = vi.fn().mockResolvedValue({ success: true });
      const provider: DispatcherProvider = { name: 'console', deliver: handler };
      dispatcher.registerProvider(provider);
      dispatcher.registerProvider(buildFailingProvider());

      await outbox.enqueue(buildEnqueueInput({
        targets: [
          { provider: 'failing', config: {} },
          { provider: 'console', config: {} },
        ],
      }));

      await dispatcher.dispatch();

      // Second provider should NOT be called
      expect(handler).not.toHaveBeenCalled();

      const item = await outbox.findById('outbox_1');
      expect(item?.status).toBe('pending');
    });
  });

  // ── Group H: Dispatch All ────────────────────────────────────

  describe('dispatchAll', () => {
    it('should_process_all_pending_items', async () => {
      dispatcher.registerProvider(consoleProvider);

      await outbox.enqueue(buildEnqueueInput());
      await outbox.enqueue(buildEnqueueInput());
      await outbox.enqueue(buildEnqueueInput());

      const count = await dispatcher.dispatchAll();

      expect(count).toBe(3);
      expect(await outbox.count('published')).toBe(3);
    });

    it('should_return_zero_when_no_items', async () => {
      const count = await dispatcher.dispatchAll();
      expect(count).toBe(0);
    });
  });

  // ── Group I: Retry + Dead Letter Integration ─────────────────

  describe('retry + dead letter integration', () => {
    it('should_retry_failed_items_after_backoff', async () => {
      dispatcher.registerProvider(buildFailingProvider());

      const item = await outbox.enqueue(buildEnqueueInput({
        targets: [{ provider: 'failing', config: {} }],
        retry: { maxAttempts: 3, baseDelayMs: 50 },
      }));

      // First attempt fails → goes back to pending with nextRetryAt
      await dispatcher.dispatch();
      let found = await outbox.findById(item.id);
      expect(found?.status).toBe('pending');
      expect(found?.retry.attempts).toBe(1);

      // Simulate time passing (backoff = 50ms)
      await new Promise((r) => setTimeout(r, 100));

      // Second attempt fails
      await dispatcher.dispatch();
      found = await outbox.findById(item.id);
      expect(found?.retry.attempts).toBe(2);

      // Simulate time passing (backoff = 100ms)
      await new Promise((r) => setTimeout(r, 200));

      // Third attempt fails → dead letter
      await dispatcher.dispatch();
      found = await outbox.findById(item.id);
      expect(found?.status).toBe('dead_letter');
      expect(found?.retry.attempts).toBe(3);
    });

    it('should_succeed_on_retry_after_provider_recovers', async () => {
      let callCount = 0;
      const recoveringProvider: DispatcherProvider = {
        name: 'recovering',
        deliver: async () => {
          callCount++;
          if (callCount === 1) return { success: false, error: 'temporary failure' };
          return { success: true };
        },
      };
      dispatcher.registerProvider(recoveringProvider);

      const item = await outbox.enqueue(buildEnqueueInput({
        targets: [{ provider: 'recovering', config: {} }],
        retry: { maxAttempts: 3, baseDelayMs: 50 },
      }));

      // First attempt fails → back to pending with nextRetryAt
      await dispatcher.dispatch();
      let found = await outbox.findById(item.id);
      expect(found?.status).toBe('pending');

      // Simulate time passing (backoff = 50ms)
      await new Promise((r) => setTimeout(r, 100));

      // Second attempt succeeds
      await dispatcher.dispatch();
      found = await outbox.findById(item.id);
      expect(found?.status).toBe('published');
    });
  });

  // ── Group J: Console Provider ────────────────────────────────

  describe('consoleProvider', () => {
    it('should_log_and_return_success', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await consoleProvider.deliver(
        {
          id: 'outbox_1',
          eventId: 'evt_1',
          eventType: 'CheckoutCompleted',
          tenantId: 't-1',
          targets: [],
          status: 'processing',
          retry: { attempts: 0, maxAttempts: 5, nextRetryAt: null, lastError: null, baseDelayMs: 1000 },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          dispatchedAt: null,
          completedAt: null,
          payload: { total: 100 },
          metadata: { tenantId: 't-1', version: 1 },
        },
        { provider: 'console', config: {} },
      );

      expect(result.success).toBe(true);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  // ── Group K: Factory ─────────────────────────────────────────

  describe('createDispatcher', () => {
    it('should_return_InMemoryDispatcher_instance', () => {
      const d = createDispatcher(outbox);
      expect(d).toBeInstanceOf(InMemoryDispatcher);
    });
  });
});
