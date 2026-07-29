/**
 * [SMG][DOMAIN][EVENTS][OUTBOX] types
 *
 * Type definitions for the Outbox Pattern.
 * Separates the Event Store (append-only audit) from the Delivery Queue (work queue).
 *
 * DESIGN:
 *   - OutboxItem references an eventId from the EventStore
 *   - Each item tracks delivery state: pending → processing → published/failed
 *   - Retry policy with exponential backoff
 *   - Dead letter queue after max attempts
 *   - Provider-agnostic: each item can target different providers
 *
 * FLOW:
 *   Application Service
 *     ↓
 *   EventStore.append(event)
 *     ↓
 *   Outbox.enqueue(eventId, targets)
 *     ↓
 *   Dispatcher.poll() → process → Outbox.updateStatus()
 */

// ─── Outbox Status ───────────────────────────────────────────────

export type OutboxStatus = 'pending' | 'processing' | 'published' | 'failed' | 'dead_letter';

// ─── Retry Policy ────────────────────────────────────────────────

export interface RetryPolicy {
  /** Current attempt count (0-based) */
  attempts: number;

  /** Maximum retry attempts before dead letter */
  maxAttempts: number;

  /** ISO timestamp of next scheduled retry */
  nextRetryAt: string | null;

  /** Last error message (if any) */
  lastError: string | null;

  /** Base delay in milliseconds for exponential backoff */
  baseDelayMs: number;
}

// ─── Dispatch Target ─────────────────────────────────────────────

/**
 * Identifies where an event should be dispatched.
 * Each target maps to a DispatcherProvider.
 */
export interface DispatchTarget {
  /** Provider name (e.g., 'webhook', 'email', 'slack') */
  provider: string;

  /** Provider-specific configuration */
  config: Record<string, unknown>;
}

// ─── Outbox Item ─────────────────────────────────────────────────

/**
 * A pending delivery in the outbox queue.
 * References an event from the EventStore and tracks delivery state.
 */
export interface OutboxItem {
  /** DB surrogate key */
  id: string;

  /** Reference to EventStore.eventId */
  eventId: string;

  /** Event type (denormalized for query performance) */
  eventType: string;

  /** Tenant that owns this item */
  tenantId: string;

  /** Delivery targets (providers to dispatch to) */
  targets: DispatchTarget[];

  /** Current delivery status */
  status: OutboxStatus;

  /** Retry policy */
  retry: RetryPolicy;

  /** When the item was created */
  createdAt: string;

  /** When the item was last updated */
  updatedAt: string;

  /** When the item was dispatched (null if not yet) */
  dispatchedAt: string | null;

  /** When the item was completed (published or dead-lettered) */
  completedAt: string | null;

  /** Aggregated payload for dispatch (denormalized from event) */
  payload: Record<string, unknown>;

  /** Metadata for dispatch (denormalized from event) */
  metadata: Record<string, unknown>;
}

// ─── Outbox Query Options ────────────────────────────────────────

export interface OutboxQueryOptions {
  /** Filter by status */
  status?: OutboxStatus;

  /** Filter by event type */
  eventType?: string;

  /** Filter by tenant */
  tenantId?: string;

  /** Max items to return */
  limit?: number;

  /** Skip N items (pagination) */
  offset?: number;
}
