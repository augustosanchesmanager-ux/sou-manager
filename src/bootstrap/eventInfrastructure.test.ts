import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  initializeEventInfrastructure,
  getEventInfrastructure,
  disposeEventInfrastructure,
} from './eventInfrastructure';
import { appEventBus } from '../../domain/events/app-bus';
import { createEvent } from '../../domain/events/types';
import type {
  CheckoutCompletedEvent,
  CheckoutRevertedEvent,
  SubscriptionCancelledEvent,
  CreditsDeductedEvent,
  CashClosingCompletedEvent,
} from '../../domain/events/types';
import type { DispatchTarget } from '../../domain/events/outbox/types';

const buildEnqueueInput = (overrides?: Record<string, unknown>) => ({
  eventId: 'evt_123',
  eventType: 'CheckoutCompleted',
  tenantId: 'tenant-1',
  status: 'pending' as const,
  targets: [{ provider: 'console', config: {} }] as DispatchTarget[],
  payload: { comandaId: 'comanda-1', total: 100 },
  metadata: { tenantId: 'tenant-1', source: 'EventInfrastructureTest', version: 1 },
  ...overrides,
});

describe('EventInfrastructure', () => {
  beforeEach(() => {
    disposeEventInfrastructure();
  });

  // ── B1 Tests ────────────────────────────────────────────────

  it('should_initialize_and_return_infrastructure', () => {
    const infra = initializeEventInfrastructure();
    expect(infra.isInitialized).toBe(true);
    expect(infra.registry.count()).toBe(7);
  });

  it('should_return_same_instance_on_double_initialize', () => {
    const first = initializeEventInfrastructure();
    const second = initializeEventInfrastructure();
    expect(first).toBe(second);
  });

  it('should_create_new_instance_after_dispose', () => {
    const first = initializeEventInfrastructure();
    disposeEventInfrastructure();
    const second = initializeEventInfrastructure();
    expect(first).not.toBe(second);
    expect(second.isInitialized).toBe(true);
  });

  it('should_register_all_6_read_only_subscribers', () => {
    const infra = initializeEventInfrastructure();
    const names = infra.registry.names();
    expect(names).toContain('AnalyticsSubscriber');
    expect(names).toContain('AuditSubscriber');
    expect(names).toContain('NotificationSubscriber');
    expect(names).toContain('ReminderSubscriber');
    expect(names).toContain('MarketingSubscriber');
    expect(names).toContain('BiSubscriber');
    expect(names).toContain('FinanceSubscriber');
  });

  it('should_not_duplicate_subscribers_on_repeated_initialize', () => {
    initializeEventInfrastructure();
    initializeEventInfrastructure();
    const infra = getEventInfrastructure();
    expect(infra?.registry.count()).toBe(7);
  });

  it('should_return_null_after_dispose', () => {
    initializeEventInfrastructure();
    disposeEventInfrastructure();
    expect(getEventInfrastructure()).toBeNull();
  });

  it('should_return_null_when_never_initialized', () => {
    expect(getEventInfrastructure()).toBeNull();
  });

  // ── B3.3 Tests: FinanceSubscriber ────────────────────────────

  it('should_register_finance_subscriber', () => {
    const infra = initializeEventInfrastructure();
    const names = infra.registry.names();
    expect(names).toContain('FinanceSubscriber');
  });

  it('should_register_7_subscribers_total', () => {
    const infra = initializeEventInfrastructure();
    expect(infra.registry.count()).toBe(7);
  });

  // ── B2 Tests: Outbox ────────────────────────────────────────

  it('should_initialize_outbox_and_dispatcher', () => {
    const infra = initializeEventInfrastructure();
    expect(infra.outbox).toBeDefined();
    expect(infra.dispatcher).toBeDefined();
  });

  it('should_register_console_provider', () => {
    const infra = initializeEventInfrastructure();
    expect(infra.dispatcher.getProviders()).toContain('console');
  });

  it('should_register_finance_and_console_providers_b34g', () => {
    const infra = initializeEventInfrastructure();
    const providers = infra.dispatcher.getProviders();
    expect(providers).toContain('console');
    expect(providers).toContain('finance');
  });

  it('should_not_register_webhook_or_slack_by_default', () => {
    const infra = initializeEventInfrastructure();
    expect(infra.dispatcher.getProviders()).not.toContain('webhook');
    expect(infra.dispatcher.getProviders()).not.toContain('slack');
  });

  // 🔒 B3.4-G Tests: Activation Routing

  it('should_enqueue_only_commission_operation_targeting_finance_provider', async () => {
    const infra = initializeEventInfrastructure();

    await appEventBus.publish(
      createEvent<CheckoutCompletedEvent>({
        eventType: 'CheckoutCompleted',
        aggregateId: 'comanda-b34g',
        aggregateType: 'comanda',
        payload: {
          comandaId: 'comanda-b34g',
          clientId: 'client-1',
          staffId: 'staff-1',
          total: 100,
          paymentMethod: 'pix',
          paymentStatus: 'paid',
          closureMode: 'standard',
          itemCount: 1,
          hasClubCredit: false,
          financialEffect: true,
        },
        metadata: { tenantId: 'tenant-1', source: 'B34GTest' },
      }),
    );

    const pending = await infra.outbox.find({ status: 'pending' });
    expect(pending).toHaveLength(1);
    expect(pending[0].targets[0].provider).toBe('finance');
    expect(pending[0].payload.operationType).toBe('create_commission_record');

    disposeEventInfrastructure();
  });

  it('should_enqueue_reverse_commission_targeting_finance_provider', async () => {
    const infra = initializeEventInfrastructure();

    await appEventBus.publish(
      createEvent<CheckoutRevertedEvent>({
        eventType: 'CheckoutReverted',
        aggregateId: 'comanda-rev',
        aggregateType: 'comanda',
        payload: {
          comandaId: 'comanda-rev',
          reason: 'wrong_settlement',
          reversedBy: 'u-1',
          originalTotal: 100,
          reversedAmount: 50,
          originalCommission: 25,
          originalReceivedValue: 100,
        },
        metadata: { tenantId: 'tenant-1', source: 'B34GTest' },
      }),
    );

    const pending = await infra.outbox.find({ status: 'pending' });
    expect(pending).toHaveLength(1);
    expect(pending[0].targets[0].provider).toBe('finance');
    expect(pending[0].payload.operationType).toBe('reverse_commission');

    disposeEventInfrastructure();
  });

  it('should_not_enqueue_operations_for_out_of_scope_events', async () => {
    const infra = initializeEventInfrastructure();

    await appEventBus.publish(
      createEvent<SubscriptionCancelledEvent>({
        eventType: 'SubscriptionCancelled',
        aggregateId: 'sub-1',
        aggregateType: 'subscription',
        payload: { subscriptionId: 'sub-1', reason: 'customer_request' },
        metadata: { tenantId: 'tenant-1', source: 'B34GTest' },
      }),
    );
    await appEventBus.publish(
      createEvent<CreditsDeductedEvent>({
        eventType: 'CreditsDeducted',
        aggregateId: 'sub-1',
        aggregateType: 'subscription',
        payload: { subscriptionId: 'sub-1', serviceId: 'svc-1', amount: 1, reference: 'Comanda #c1' },
        metadata: { tenantId: 'tenant-1', source: 'B34GTest' },
      }),
    );
    await appEventBus.publish(
      createEvent<CashClosingCompletedEvent>({
        eventType: 'CashClosingCompleted',
        aggregateId: 'closing-1',
        aggregateType: 'cash_closing',
        payload: {
          closingId: 'closing-1',
          businessDate: '2026-08-23',
          closedBy: 'u-1',
          expectedBalance: 100,
          countedBalance: 100,
          difference: 0,
          extrasCount: 0,
          hasDiscrepancy: false,
        },
        metadata: { tenantId: 'tenant-1', source: 'B34GTest' },
      }),
    );

    const items = await infra.outbox.find({});
    expect(items).toHaveLength(0);

    disposeEventInfrastructure();
  });

  // ── B2 Tests: Dispatch Contract ─────────────────────────────

  it('should_dispatch_pending_item_and_mark_published', async () => {
    const infra = initializeEventInfrastructure();

    // 1. Enqueue
    const item = await infra.outbox.enqueue(buildEnqueueInput());
    expect(item.status).toBe('pending');

    // 2. Dispatch
    const count = await infra.dispatcher.dispatchAll();
    expect(count).toBe(1);

    // 3. Verify final state
    const final = await infra.outbox.findById(item.id);
    expect(final?.status).toBe('published');
    expect(final?.completedAt).toBeTruthy();
    expect(final?.dispatchedAt).toBeTruthy();
  });

  it('should_dispatch_multiple_items_in_order', async () => {
    const infra = initializeEventInfrastructure();

    const i1 = await infra.outbox.enqueue(buildEnqueueInput({ eventType: 'Event1' }));
    const i2 = await infra.outbox.enqueue(buildEnqueueInput({ eventType: 'Event2' }));
    const i3 = await infra.outbox.enqueue(buildEnqueueInput({ eventType: 'Event3' }));

    const count = await infra.dispatcher.dispatchAll();
    expect(count).toBe(3);

    const f1 = await infra.outbox.findById(i1.id);
    const f2 = await infra.outbox.findById(i2.id);
    const f3 = await infra.outbox.findById(i3.id);

    expect(f1?.status).toBe('published');
    expect(f2?.status).toBe('published');
    expect(f3?.status).toBe('published');
  });

  it('should_return_zero_when_no_pending_items', async () => {
    const infra = initializeEventInfrastructure();
    const count = await infra.dispatcher.dispatchAll();
    expect(count).toBe(0);
  });

  // ── B2 Tests: Concurrency Guard ─────────────────────────────

  it('should_not_overlap_concurrent_dispatch', async () => {
    const infra = initializeEventInfrastructure();
    let activeCount = 0;
    let maxActive = 0;
    let callCount = 0;

    // Slow provider: takes 200ms, tracks concurrent active calls
    infra.dispatcher.registerProvider({
      name: 'slow',
      deliver: async () => {
        callCount++;
        activeCount++;
        maxActive = Math.max(maxActive, activeCount);
        await new Promise((r) => setTimeout(r, 200));
        activeCount--;
        return { success: true };
      },
    });

    await infra.outbox.enqueue(buildEnqueueInput({
      targets: [{ provider: 'slow', config: {} }],
    }));
    await infra.outbox.enqueue(buildEnqueueInput({
      targets: [{ provider: 'slow', config: {} }],
    }));

    // Replicate the dispatch loop guard pattern from eventInfrastructure.ts
    let dispatching = false;
    const simulateDispatchLoop = async () => {
      if (dispatching) return;
      dispatching = true;
      try {
        await infra.dispatcher.dispatchAll();
      } finally {
        dispatching = false;
      }
    };

    // Two concurrent dispatch loop invocations
    await Promise.all([simulateDispatchLoop(), simulateDispatchLoop()]);

    // 2 items → 2 calls to slow provider
    expect(callCount).toBe(2);
    // maxActive = 1: second loop was blocked by guard while first was running
    expect(maxActive).toBe(1);
  });

  // ── B2 Tests: Lifecycle ─────────────────────────────────────

  it('should_stop_dispatch_loop_on_dispose', () => {
    const infra = initializeEventInfrastructure();
    expect(infra.stopDispatchLoop).toBeInstanceOf(Function);

    // Should not throw
    infra.stopDispatchLoop();
    disposeEventInfrastructure();

    const after = getEventInfrastructure();
    expect(after).toBeNull();
  });

  it('should_have_stopDispatchLoop_function', () => {
    const infra = initializeEventInfrastructure();
    expect(typeof infra.stopDispatchLoop).toBe('function');
  });
});
