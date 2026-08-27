/**
 * [SMG][DOMAIN][EVENTS][OUTBOX][PROVIDERS] FinanceProvider
 *
 * DispatcherProvider that executes financial operations from the Outbox.
 * This is the official executor for FinanceOperations enqueued by FinanceSubscriber.
 *
 * ARCHITECTURE:
 *   FinanceSubscriber → Outbox → Dispatcher → FinanceProvider → Repositories
 *
 * RESPONSABILIDADE:
 *   - Parse FinanceOperation from OutboxItem payload
 *   - Check idempotency (skip if already executed)
 *   - Delegate execution to injectable OperationHandler map
 *   - Return success/failure to Dispatcher
 *
 * IDEMPOTENCY:
 *   - Uses idempotencyKey from operation payload
 *   - Handler must check if operation was already executed
 *   - In-memory dedup for testing; persistent in production
 *
 * ERROR HANDLING:
 *   - Handler errors are caught and returned as { success: false, error }
 *   - Dispatcher handles retry logic (Outbox markFailed)
 *   - No direct DB errors propagate to caller
 *
 * FUTURE:
 *   - Persistent idempotency store (DB table)
 *   - Transaction wrapping for multi-operation consistency
 *   - Compensation logic for partial failures
 *   - Dead letter investigation dashboard
 */

import type { DispatcherProvider, OutboxItem, DispatchTarget } from '../types';

// ─── ADR-015: Finance Provider Hooks ────────────────────────

export interface FinanceProviderHooks {
  onDelivered?: (itemId: string, operationType: string, tenantId: string) => void;
  onError?: (itemId: string, operationType: string, error: string) => void;
  onSkipped?: (itemId: string, operationType: string, reason: string) => void;
  onHandlerMissing?: (itemId: string, operationType: string) => void;
}

// ─── Operation Handler Interface ──────────────────────────────

/**
 * A handler that executes a specific finance operation type.
 * Each handler receives the operation data and must be idempotent.
 *
 * @param data - The operation-specific data from FinanceOperation.data
 * @param context - Execution context (tenantId, idempotencyKey, sourceEvent)
 * @returns { success: boolean, error?: string }
 */
export interface OperationHandler {
  execute(
    data: Record<string, unknown>,
    context: OperationContext,
  ): Promise<{ success: boolean; error?: string }>;
}

export interface OperationContext {
  tenantId: string;
  idempotencyKey: string;
  sourceEvent: string;
  eventId: string;
}

// ─── Idempotency Store Interface ──────────────────────────────

/**
 * Interface for checking/storing executed operations.
 * In-memory for testing; persistent (DB table) for production.
 *
 * tenantId is optional — InMemoryIdempotencyStore doesn't need it,
 * but PersistentIdempotencyStore uses it for multi-tenant isolation.
 */
export interface IdempotencyStore {
  /** Check if an operation was already executed */
  has(key: string, tenantId?: string): Promise<boolean>;

  /** Mark an operation as executed */
  set(key: string, tenantId?: string): Promise<void>;
}

/**
 * In-memory idempotency store for testing.
 * NOT suitable for production (lost on restart).
 */
export class InMemoryIdempotencyStore implements IdempotencyStore {
  private executed = new Set<string>();

  async has(key: string, _tenantId?: string): Promise<boolean> {
    return this.executed.has(key);
  }

  async set(key: string, _tenantId?: string): Promise<void> {
    this.executed.add(key);
  }

  /** Clear all entries (for testing) */
  clear(): void {
    this.executed.clear();
  }

  /** Get count of executed operations */
  count(): number {
    return this.executed.size;
  }
}

// ─── FinanceProvider ──────────────────────────────────────────

/**
 * Configuration for creating a FinanceProvider.
 */
export interface FinanceProviderConfig {
  /** Map of operation type → handler */
  handlers: Record<string, OperationHandler>;

  /** Idempotency store (defaults to InMemoryIdempotencyStore) */
  idempotencyStore?: IdempotencyStore;

  /** Provider name (default: 'finance') */
  name?: string;

  /** ADR-015: Observability hooks */
  hooks?: FinanceProviderHooks;
}

/**
 * Creates a DispatcherProvider that executes financial operations.
 *
 * Usage:
 *   const provider = createFinanceProvider({
 *     handlers: {
 *       create_transaction: transactionHandler,
 *       create_commission_record: commissionHandler,
 *       reverse_revenue: reversalHandler,
 *       deduct_credits: creditsHandler,
 *       close_daily_cash: cashClosingHandler,
 *     },
 *   });
 *   dispatcher.registerProvider(provider);
 */
export const createFinanceProvider = (config: FinanceProviderConfig): DispatcherProvider => {
  const store = config.idempotencyStore ?? new InMemoryIdempotencyStore();
  const providerName = config.name ?? 'finance';
  const hooks = config.hooks;

  return {
    name: providerName,

    async deliver(item: OutboxItem, _target: DispatchTarget) {
      const payload = item.payload as {
        operationType?: string;
        operationData?: Record<string, unknown>;
        idempotencyKey?: string;
        sourceEvent?: string;
      };

      // Validate payload structure
      if (!payload.operationType) {
        hooks?.onSkipped?.(item.id, 'unknown', 'missing operationType');
        return {
          success: false,
          error: `Invalid outbox item ${item.id}: missing operationType`,
        };
      }

      const { operationType, operationData = {}, idempotencyKey, sourceEvent } = payload;

      // Check idempotency
      if (idempotencyKey) {
        const alreadyExecuted = await store.has(idempotencyKey, item.tenantId);
        if (alreadyExecuted) {
          hooks?.onSkipped?.(item.id, operationType, 'idempotent — already executed');
          console.log(
            `[FINANCE_PROVIDER] Skipping ${operationType} — already executed (${idempotencyKey})`,
          );
          return { success: true }; // Idempotent: already done
        }
      }

      // Find handler
      const handler = config.handlers[operationType];
      if (!handler) {
        hooks?.onHandlerMissing?.(item.id, operationType);
        return {
          success: false,
          error: `No handler for operation type: ${operationType}`,
        };
      }

      // Execute
      const context: OperationContext = {
        tenantId: item.tenantId,
        idempotencyKey: idempotencyKey ?? `${item.eventId}_${operationType}`,
        sourceEvent: sourceEvent ?? item.eventType,
        eventId: item.eventId,
      };

      try {
        const result = await handler.execute(operationData, context);

        if (result.success && idempotencyKey) {
          await store.set(idempotencyKey, item.tenantId);
        }

        if (result.success) {
          hooks?.onDelivered?.(item.id, operationType, item.tenantId);
        } else {
          hooks?.onError?.(item.id, operationType, result.error || 'Handler returned failure');
        }

        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        hooks?.onError?.(item.id, operationType, errorMsg);
        console.error(
          `[FINANCE_PROVIDER] Handler error for ${operationType} (${item.id}):`,
          errorMsg,
        );
        return { success: false, error: errorMsg };
      }
    },
  };
};
