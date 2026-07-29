/**
 * [SMG][DOMAIN][EVENTS][SUBSCRIBERS] FinanceSubscriber
 *
 * Financial subscriber that listens to domain events and enqueues
 * financial operations to the Outbox for reliable processing.
 *
 * DESIGN:
 *   - Group B: writes via Outbox (not direct DB writes)
 *   - Handles: CheckoutCompleted, SubscriptionCancelled, CreditsDeducted, CashClosingCompleted
 *   - Each event maps to one or more FinanceOperation
 *   - Operations are enqueued to the Outbox with idempotency (event.id as dedup key)
 *   - Actual execution happens via DispatcherProvider (future: FinanceProvider)
 *
 * FLOW:
 *   Domain Event
 *     ↓
 *   FinanceSubscriber.handle()
 *     ↓
 *   Map event → FinanceOperation[]
 *     ↓
 *   Outbox.enqueue(operation)
 *     ↓
 *   Dispatcher.process() → FinanceProvider.execute()
 *     ↓
 *   Repository writes (receivables, transactions, commissions)
 *
 * IDEMPOTENCY:
 *   - Each operation includes eventId for deduplication
 *   - FinanceProvider must check if operation was already executed
 *   - Uses operation.idempotencyKey = `${eventId}_${operationType}`
 *
 * FUTURE:
 *   - FinanceProvider as DispatcherProvider
 *   - SupabaseOutbox (persistent queue)
 *   - Dashboard for monitoring financial operations
 */

import type { DomainSubscriber } from '../subscriber';
import type {
  CheckoutCompletedEvent,
  SubscriptionCancelledEvent,
  CreditsDeductedEvent,
  CashClosingCompletedEvent,
  SystemEvent,
} from '../types';
import type { OutboxRepository } from '../outbox/outboxRepository';
import type { OutboxItem, DispatchTarget } from '../outbox/types';

// ─── Finance Operation Types ──────────────────────────────────

export type FinanceOperationType =
  | 'create_receivable'
  | 'create_transaction'
  | 'create_commission_record'
  | 'reverse_revenue'
  | 'deduct_credits'
  | 'close_daily_cash';

export interface FinanceOperation {
  /** Operation type — determines what the FinanceProvider does */
  type: FinanceOperationType;

  /** Business data for the operation */
  data: Record<string, unknown>;
}

// ─── FinanceStrategy Interface ────────────────────────────────

/**
 * Injectable strategy that maps domain events to finance operations.
 * Decouples the subscriber from the business rules.
 * In production, implements the actual financial logic.
 * In tests, easily mockable.
 */
export interface FinanceStrategy {
  /**
   * Map a CheckoutCompleted event to finance operations.
   * Typically: create_transaction + create_commission_record
   */
  mapCheckoutCompleted(event: CheckoutCompletedEvent): FinanceOperation[];

  /**
   * Map a SubscriptionCancelled event to finance operations.
   * Typically: reverse_revenue
   */
  mapSubscriptionCancelled(event: SubscriptionCancelledEvent): FinanceOperation[];

  /**
   * Map a CreditsDeducted event to finance operations.
   * Typically: deduct_credits
   */
  mapCreditsDeducted(event: CreditsDeductedEvent): FinanceOperation[];

  /**
   * Map a CashClosingCompleted event to finance operations.
   * Typically: close_daily_cash
   */
  mapCashClosingCompleted(event: CashClosingCompletedEvent): FinanceOperation[];
}

// ─── FinanceSubscriber Factory ────────────────────────────────

/**
 * Creates a FinanceSubscriber that handles multiple event types.
 * Uses '*' (subscribeAll) since it handles different event types.
 *
 * Usage:
 *   const subscriber = createFinanceSubscriber(outbox, strategy);
 *   registry.register(subscriber);
 */
export const createFinanceSubscriber = (
  outbox: OutboxRepository,
  strategy: FinanceStrategy,
  defaultTarget: DispatchTarget = { provider: 'finance', config: {} },
): DomainSubscriber<SystemEvent> => ({
  name: 'FinanceSubscriber',
  description: 'Enqueues financial operations to the Outbox for reliable processing',
  eventType: '*' as const,

  async handle(event) {
    const { eventId, eventType, metadata } = event;

    let operations: FinanceOperation[] = [];

    switch (eventType) {
      case 'CheckoutCompleted':
        operations = strategy.mapCheckoutCompleted(event as CheckoutCompletedEvent);
        break;
      case 'SubscriptionCancelled':
        operations = strategy.mapSubscriptionCancelled(event as SubscriptionCancelledEvent);
        break;
      case 'CreditsDeducted':
        operations = strategy.mapCreditsDeducted(event as CreditsDeductedEvent);
        break;
      case 'CashClosingCompleted':
        operations = strategy.mapCashClosingCompleted(event as CashClosingCompletedEvent);
        break;
      default:
        // Event type not handled — silently skip
        return;
    }

    if (operations.length === 0) {
      console.log(
        `[FINANCE_SUBSCRIBER] No operations for ${eventType} (${eventId})`,
      );
      return;
    }

    // Enqueue each operation to the Outbox
    for (const operation of operations) {
      const idempotencyKey = `${eventId}_${operation.type}`;

      try {
        await outbox.enqueue({
          eventId,
          eventType,
          tenantId: metadata.tenantId,
          targets: [defaultTarget],
          status: 'pending',
          payload: {
            operationType: operation.type,
            operationData: operation.data,
            sourceEvent: eventType,
            idempotencyKey,
          },
          metadata: {
            tenantId: metadata.tenantId,
            userId: metadata.userId,
            correlationId: metadata.correlationId,
            causationId: eventId,
            source: 'FinanceSubscriber',
          },
        });

        console.log(
          `[FINANCE_SUBSCRIBER] Enqueued ${operation.type} for ${eventType} (${eventId})`,
        );
      } catch (error) {
        console.error(
          `[FINANCE_SUBSCRIBER] Failed to enqueue ${operation.type} for ${eventType} (${eventId}):`,
          error,
        );
      }
    }
  },
});
