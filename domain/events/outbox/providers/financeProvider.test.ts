/**
 * [SMG][DOMAIN][EVENTS][OUTBOX] FinanceProvider Tests
 *
 * Suite de testes para FinanceProvider — o executor de operações financeiras do Outbox.
 * Segue convenções do projeto: AAA, should_<result>_when_<condition>.
 *
 * GRUPO A: Basic Behavior
 * GRUPO B: Operation Routing (6 types)
 * GRUPO C: Idempotency
 * GRUPO D: Error Handling
 * GRUPO E: Integration with Dispatcher
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InMemoryOutbox } from '../inMemoryOutbox';
import { InMemoryDispatcher } from '../inMemoryDispatcher';
import {
  createFinanceProvider,
  InMemoryIdempotencyStore,
  type OperationHandler,
  type OperationContext,
} from './financeProvider';
import type { OutboxItem, DispatchTarget } from '../types';

// ─── Helpers ─────────────────────────────────────────────────────

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
    operationData: { amount: 100, category: 'services' },
    idempotencyKey: 'evt_1_create_transaction',
    sourceEvent: 'CheckoutCompleted',
  },
  metadata: { tenantId: 'tenant-1', source: 'FinanceSubscriber' },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  dispatchedAt: null,
  completedAt: null,
  ...overrides,
});

const buildHandler = (result?: { success: boolean; error?: string }): OperationHandler => ({
  execute: vi.fn().mockResolvedValue(result ?? { success: true }),
});

const buildFailingHandler = (error = 'Handler crash'): OperationHandler => ({
  execute: vi.fn().mockRejectedValue(new Error(error)),
});

const buildTarget: DispatchTarget = { provider: 'finance', config: {} };

// ═══════════════════════════════════════════════════════════════════
// GRUPO A: Basic Behavior
// ═══════════════════════════════════════════════════════════════════

describe('FinanceProvider', () => {
  // ── Group A1: Provider Interface ─────────────────────────────

  describe('provider interface', () => {
    it('should_have_correct_name', () => {
      const handler = buildHandler();
      const provider = createFinanceProvider({
        handlers: { create_transaction: handler },
      });

      expect(provider.name).toBe('finance');
    });

    it('should_accept_custom_name', () => {
      const handler = buildHandler();
      const provider = createFinanceProvider({
        handlers: { create_transaction: handler },
        name: 'custom-finance',
      });

      expect(provider.name).toBe('custom-finance');
    });

    it('should_implement_deliver_method', () => {
      const handler = buildHandler();
      const provider = createFinanceProvider({
        handlers: { create_transaction: handler },
      });

      expect(typeof provider.deliver).toBe('function');
    });
  });

  // ── Group A2: Payload Validation ─────────────────────────────

  describe('payload validation', () => {
    it('should_return_error_when_operationType_missing', async () => {
      const handler = buildHandler();
      const provider = createFinanceProvider({
        handlers: { create_transaction: handler },
      });

      const item = buildOutboxItem({
        payload: { /* no operationType */ },
      });

      const result = await provider.deliver(item, buildTarget);

      expect(result.success).toBe(false);
      expect(result.error).toContain('missing operationType');
    });

    it('should_return_error_when_operationType_unknown', async () => {
      const handler = buildHandler();
      const provider = createFinanceProvider({
        handlers: { create_transaction: handler },
      });

      const item = buildOutboxItem({
        payload: {
          operationType: 'unknown_operation',
          operationData: {},
        },
      });

      const result = await provider.deliver(item, buildTarget);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No handler for operation type: unknown_operation');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// GRUPO B: Operation Routing (6 types)
// ═══════════════════════════════════════════════════════════════════

describe('FinanceProvider — Operation Routing', () => {
  it('should_route_create_transaction_to_handler', async () => {
    const handler = buildHandler();
    const provider = createFinanceProvider({
      handlers: { create_transaction: handler },
    });

    const item = buildOutboxItem({
      payload: {
        operationType: 'create_transaction',
        operationData: { amount: 100, category: 'services' },
        idempotencyKey: 'evt_1_create_transaction',
      },
    });

    const result = await provider.deliver(item, buildTarget);

    expect(result.success).toBe(true);
    expect(handler.execute).toHaveBeenCalledTimes(1);
    expect(handler.execute).toHaveBeenCalledWith(
      { amount: 100, category: 'services' },
      expect.objectContaining({
        tenantId: 'tenant-1',
        idempotencyKey: 'evt_1_create_transaction',
        sourceEvent: 'CheckoutCompleted',
      }),
    );
  });

  it('should_route_create_receivable_to_handler', async () => {
    const handler = buildHandler();
    const provider = createFinanceProvider({
      handlers: { create_receivable: handler },
    });

    const item = buildOutboxItem({
      payload: {
        operationType: 'create_receivable',
        operationData: { subscriptionId: 'sub-1', amount: 50 },
        idempotencyKey: 'evt_1_create_receivable',
      },
    });

    const result = await provider.deliver(item, buildTarget);

    expect(result.success).toBe(true);
    expect(handler.execute).toHaveBeenCalledWith(
      { subscriptionId: 'sub-1', amount: 50 },
      expect.anything(),
    );
  });

  it('should_route_create_commission_record_to_handler', async () => {
    const handler = buildHandler();
    const provider = createFinanceProvider({
      handlers: { create_commission_record: handler },
    });

    const item = buildOutboxItem({
      payload: {
        operationType: 'create_commission_record',
        operationData: { staffId: 'staff-1', amount: 50 },
        idempotencyKey: 'evt_1_create_commission_record',
      },
    });

    const result = await provider.deliver(item, buildTarget);

    expect(result.success).toBe(true);
    expect(handler.execute).toHaveBeenCalledTimes(1);
  });

  it('should_route_reverse_revenue_to_handler', async () => {
    const handler = buildHandler();
    const provider = createFinanceProvider({
      handlers: { reverse_revenue: handler },
    });

    const item = buildOutboxItem({
      eventType: 'SubscriptionCancelled',
      payload: {
        operationType: 'reverse_revenue',
        operationData: { subscriptionId: 'sub-1' },
        idempotencyKey: 'evt_1_reverse_revenue',
      },
    });

    const result = await provider.deliver(item, buildTarget);

    expect(result.success).toBe(true);
    expect(handler.execute).toHaveBeenCalledTimes(1);
  });

  it('should_route_deduct_credits_to_handler', async () => {
    const handler = buildHandler();
    const provider = createFinanceProvider({
      handlers: { deduct_credits: handler },
    });

    const item = buildOutboxItem({
      eventType: 'CreditsDeducted',
      payload: {
        operationType: 'deduct_credits',
        operationData: { amount: 1, serviceId: 'svc-1' },
        idempotencyKey: 'evt_1_deduct_credits',
      },
    });

    const result = await provider.deliver(item, buildTarget);

    expect(result.success).toBe(true);
    expect(handler.execute).toHaveBeenCalledTimes(1);
  });

  it('should_route_close_daily_cash_to_handler', async () => {
    const handler = buildHandler();
    const provider = createFinanceProvider({
      handlers: { close_daily_cash: handler },
    });

    const item = buildOutboxItem({
      eventType: 'CashClosingCompleted',
      payload: {
        operationType: 'close_daily_cash',
        operationData: { closingId: 'closing-1', expectedBalance: 1000 },
        idempotencyKey: 'evt_1_close_daily_cash',
      },
    });

    const result = await provider.deliver(item, buildTarget);

    expect(result.success).toBe(true);
    expect(handler.execute).toHaveBeenCalledTimes(1);
  });

  it('should_handle_multiple_handlers_registered', async () => {
    const txHandler = buildHandler();
    const commissionHandler = buildHandler();
    const reversalHandler = buildHandler();

    const provider = createFinanceProvider({
      handlers: {
        create_transaction: txHandler,
        create_commission_record: commissionHandler,
        reverse_revenue: reversalHandler,
      },
    });

    // Execute different operations
    await provider.deliver(buildOutboxItem({
      payload: { operationType: 'create_transaction', operationData: {}, idempotencyKey: 'k1' },
    }), buildTarget);

    await provider.deliver(buildOutboxItem({
      payload: { operationType: 'create_commission_record', operationData: {}, idempotencyKey: 'k2' },
    }), buildTarget);

    await provider.deliver(buildOutboxItem({
      payload: { operationType: 'reverse_revenue', operationData: {}, idempotencyKey: 'k3' },
    }), buildTarget);

    expect(txHandler.execute).toHaveBeenCalledTimes(1);
    expect(commissionHandler.execute).toHaveBeenCalledTimes(1);
    expect(reversalHandler.execute).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════════════
// GRUPO C: Idempotency
// ═══════════════════════════════════════════════════════════════════

describe('FinanceProvider — Idempotency', () => {
  let store: InMemoryIdempotencyStore;

  beforeEach(() => {
    store = new InMemoryIdempotencyStore();
  });

  it('should_execute_when_not_previously_executed', async () => {
    const handler = buildHandler();
    const provider = createFinanceProvider({
      handlers: { create_transaction: handler },
      idempotencyStore: store,
    });

    const item = buildOutboxItem();
    const result = await provider.deliver(item, buildTarget);

    expect(result.success).toBe(true);
    expect(handler.execute).toHaveBeenCalledTimes(1);
  });

  it('should_skip_when_already_executed', async () => {
    const handler = buildHandler();
    const provider = createFinanceProvider({
      handlers: { create_transaction: handler },
      idempotencyStore: store,
    });

    const item = buildOutboxItem();

    // First execution
    await provider.deliver(item, buildTarget);
    expect(handler.execute).toHaveBeenCalledTimes(1);

    // Second execution — should be skipped
    const result = await provider.deliver(item, buildTarget);
    expect(result.success).toBe(true);
    expect(handler.execute).toHaveBeenCalledTimes(1); // Still 1, not 2
  });

  it('should_mark_as_executed_after_success', async () => {
    const handler = buildHandler();
    const provider = createFinanceProvider({
      handlers: { create_transaction: handler },
      idempotencyStore: store,
    });

    const item = buildOutboxItem();
    await provider.deliver(item, buildTarget);

    expect(await store.has('evt_1_create_transaction')).toBe(true);
  });

  it('should_not_mark_as_executed_after_failure', async () => {
    const handler = buildHandler({ success: false, error: 'insufficient funds' });
    const provider = createFinanceProvider({
      handlers: { create_transaction: handler },
      idempotencyStore: store,
    });

    const item = buildOutboxItem();
    await provider.deliver(item, buildTarget);

    expect(await store.has('evt_1_create_transaction')).toBe(false);
  });

  it('should_not_mark_as_executed_after_handler_error', async () => {
    const handler = buildFailingHandler();
    const provider = createFinanceProvider({
      handlers: { create_transaction: handler },
      idempotencyStore: store,
    });

    const item = buildOutboxItem();
    await provider.deliver(item, buildTarget);

    expect(await store.has('evt_1_create_transaction')).toBe(false);
  });

  it('should_use_fallback_key_when_idempotencyKey_missing', async () => {
    const handler = buildHandler();
    const provider = createFinanceProvider({
      handlers: { create_transaction: handler },
      idempotencyStore: store,
    });

    const item = buildOutboxItem({
      payload: {
        operationType: 'create_transaction',
        operationData: {},
        // No idempotencyKey
      },
    });

    // Should not throw — uses fallback key
    const result = await provider.deliver(item, buildTarget);
    expect(result.success).toBe(true);
  });

  it('should_use_separate_keys_per_operation_type', async () => {
    const txHandler = buildHandler();
    const commissionHandler = buildHandler();
    const provider = createFinanceProvider({
      handlers: {
        create_transaction: txHandler,
        create_commission_record: commissionHandler,
      },
      idempotencyStore: store,
    });

    // Different operation types, same event
    await provider.deliver(buildOutboxItem({
      payload: { operationType: 'create_transaction', idempotencyKey: 'evt_1_create_transaction' },
    }), buildTarget);

    await provider.deliver(buildOutboxItem({
      payload: { operationType: 'create_commission_record', idempotencyKey: 'evt_1_create_commission_record' },
    }), buildTarget);

    // Both should execute
    expect(txHandler.execute).toHaveBeenCalledTimes(1);
    expect(commissionHandler.execute).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════════════
// GRUPO D: Error Handling
// ═══════════════════════════════════════════════════════════════════

describe('FinanceProvider — Error Handling', () => {
  it('should_return_error_when_handler_throws', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const handler = buildFailingHandler('DB timeout');
    const provider = createFinanceProvider({
      handlers: { create_transaction: handler },
    });

    const item = buildOutboxItem();
    const result = await provider.deliver(item, buildTarget);

    expect(result.success).toBe(false);
    expect(result.error).toContain('DB timeout');
    consoleSpy.mockRestore();
  });

  it('should_return_error_when_handler_returns_failure', async () => {
    const handler = buildHandler({ success: false, error: 'validation failed' });
    const provider = createFinanceProvider({
      handlers: { create_transaction: handler },
    });

    const item = buildOutboxItem();
    const result = await provider.deliver(item, buildTarget);

    expect(result.success).toBe(false);
    expect(result.error).toBe('validation failed');
  });

  it('should_log_handler_error_with_context', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const handler = buildFailingHandler('RPC failed');
    const provider = createFinanceProvider({
      handlers: { create_transaction: handler },
    });

    const item = buildOutboxItem();
    await provider.deliver(item, buildTarget);

    const errorCall = consoleSpy.mock.calls.find((call) =>
      call[0]?.toString().includes('outbox_1'),
    );
    expect(errorCall).toBeTruthy();
    consoleSpy.mockRestore();
  });

  it('should_continue_after_handler_returns_success_false', async () => {
    const handler1 = buildHandler({ success: false, error: 'insufficient' });
    const handler2 = buildHandler();
    const provider = createFinanceProvider({
      handlers: {
        create_transaction: handler1,
        create_commission_record: handler2,
      },
    });

    await provider.deliver(buildOutboxItem({
      payload: { operationType: 'create_transaction', idempotencyKey: 'k1' },
    }), buildTarget);

    await provider.deliver(buildOutboxItem({
      payload: { operationType: 'create_commission_record', idempotencyKey: 'k2' },
    }), buildTarget);

    expect(handler2.execute).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════════════
// GRUPO E: Integration with Dispatcher
// ═══════════════════════════════════════════════════════════════════

describe('FinanceProvider — Dispatcher Integration', () => {
  let outbox: InMemoryOutbox;
  let dispatcher: InMemoryDispatcher;

  beforeEach(() => {
    outbox = new InMemoryOutbox();
    dispatcher = new InMemoryDispatcher(outbox);
  });

  it('should_work_with_dispatcher_end_to_end', async () => {
    const handler = buildHandler();
    const provider = createFinanceProvider({
      handlers: { create_transaction: handler },
    });
    dispatcher.registerProvider(provider);

    // Enqueue an item
    await outbox.enqueue({
      eventId: 'evt_1',
      eventType: 'CheckoutCompleted',
      tenantId: 'tenant-1',
      targets: [{ provider: 'finance', config: {} }],
      payload: {
        operationType: 'create_transaction',
        operationData: { amount: 100 },
        idempotencyKey: 'evt_1_create_transaction',
      },
      metadata: { tenantId: 'tenant-1' },
    });

    // Dispatch
    const processed = await dispatcher.dispatch();

    expect(processed).not.toBeNull();
    expect(handler.execute).toHaveBeenCalledTimes(1);

    // Item should be published
    const item = await outbox.findById('outbox_1');
    expect(item?.status).toBe('published');
  });

  it('should_mark_failed_when_no_handler', async () => {
    const provider = createFinanceProvider({
      handlers: {}, // No handlers registered
    });
    dispatcher.registerProvider(provider);

    await outbox.enqueue({
      eventId: 'evt_1',
      eventType: 'CheckoutCompleted',
      tenantId: 'tenant-1',
      targets: [{ provider: 'finance', config: {} }],
      payload: {
        operationType: 'create_transaction',
        operationData: { amount: 100 },
      },
      metadata: { tenantId: 'tenant-1' },
    });

    await dispatcher.dispatch();

    const item = await outbox.findById('outbox_1');
    expect(item?.status).toBe('pending'); // Retryable (no handler = will always fail)
    expect(item?.retry.attempts).toBe(1);
  });

  it('should_dispatch_multiple_operations_sequentially', async () => {
    const txHandler = buildHandler();
    const commissionHandler = buildHandler();
    const provider = createFinanceProvider({
      handlers: {
        create_transaction: txHandler,
        create_commission_record: commissionHandler,
      },
    });
    dispatcher.registerProvider(provider);

    // Enqueue two different operations
    await outbox.enqueue({
      eventId: 'evt_1',
      eventType: 'CheckoutCompleted',
      tenantId: 'tenant-1',
      targets: [{ provider: 'finance', config: {} }],
      payload: {
        operationType: 'create_transaction',
        operationData: { amount: 100 },
        idempotencyKey: 'evt_1_create_transaction',
      },
      metadata: { tenantId: 'tenant-1' },
    });

    await outbox.enqueue({
      eventId: 'evt_1',
      eventType: 'CheckoutCompleted',
      tenantId: 'tenant-1',
      targets: [{ provider: 'finance', config: {} }],
      payload: {
        operationType: 'create_commission_record',
        operationData: { staffId: 'staff-1' },
        idempotencyKey: 'evt_1_create_commission_record',
      },
      metadata: { tenantId: 'tenant-1' },
    });

    const count = await dispatcher.dispatchAll();

    expect(count).toBe(2);
    expect(txHandler.execute).toHaveBeenCalledTimes(1);
    expect(commissionHandler.execute).toHaveBeenCalledTimes(1);
  });

  it('should_not_duplicate_idempotent_operations_in_dispatcher', async () => {
    const store = new InMemoryIdempotencyStore();
    const handler = buildHandler();
    const provider = createFinanceProvider({
      handlers: { create_transaction: handler },
      idempotencyStore: store,
    });
    dispatcher.registerProvider(provider);

    // Enqueue same operation twice (simulates retry)
    const itemDef = {
      eventId: 'evt_1',
      eventType: 'CheckoutCompleted',
      tenantId: 'tenant-1',
      targets: [{ provider: 'finance', config: {} }],
      payload: {
        operationType: 'create_transaction',
        operationData: { amount: 100 },
        idempotencyKey: 'evt_1_create_transaction',
      },
      metadata: { tenantId: 'tenant-1' },
    };

    await outbox.enqueue(itemDef);
    await outbox.enqueue({ ...itemDef, eventId: 'evt_1_dup' });

    await dispatcher.dispatchAll();

    // First should execute, second should be skipped (idempotent)
    expect(handler.execute).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════════════
// GRUPO F: InMemoryIdempotencyStore
// ═══════════════════════════════════════════════════════════════════

describe('InMemoryIdempotencyStore', () => {
  let store: InMemoryIdempotencyStore;

  beforeEach(() => {
    store = new InMemoryIdempotencyStore();
  });

  it('should_return_false_when_key_not_set', async () => {
    expect(await store.has('key-1')).toBe(false);
  });

  it('should_return_true_after_set', async () => {
    await store.set('key-1');
    expect(await store.has('key-1')).toBe(true);
  });

  it('should_handle_multiple_keys', async () => {
    await store.set('key-1');
    await store.set('key-2');
    await store.set('key-3');

    expect(await store.has('key-1')).toBe(true);
    expect(await store.has('key-2')).toBe(true);
    expect(await store.has('key-3')).toBe(true);
    expect(await store.has('key-4')).toBe(false);
  });

  it('should_clear_all_entries', async () => {
    await store.set('key-1');
    await store.set('key-2');
    store.clear();

    expect(await store.has('key-1')).toBe(false);
    expect(await store.has('key-2')).toBe(false);
  });

  it('should_track_count', async () => {
    expect(store.count()).toBe(0);
    await store.set('key-1');
    expect(store.count()).toBe(1);
    await store.set('key-2');
    expect(store.count()).toBe(2);
  });
});
