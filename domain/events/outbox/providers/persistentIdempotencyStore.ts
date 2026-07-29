/**
 * [SMG][DOMAIN][EVENTS][OUTBOX][PROVIDERS] PersistentIdempotencyStore
 *
 * Production-grade idempotency store backed by Supabase.
 * Uses the processed_operations table with UNIQUE constraint on (tenant_id, idempotency_key).
 *
 * MECHANISM:
 *   has(key, tenantId):
 *     SELECT 1 FROM processed_operations WHERE tenant_id = ? AND idempotency_key = ?
 *     → returns true/false
 *
 *   set(key, tenantId):
 *     INSERT INTO processed_operations (tenant_id, event_id, operation_type, idempotency_key)
 *     → on UNIQUE VIOLATION: silently succeeds (already processed)
 *
 * GUARANTEES:
 *   - O(1) dedup via UNIQUE index
 *   - Multi-tenant isolation via tenant_id
 *   - No locks — UNIQUE violation is the concurrency mechanism
 *   - Audit trail: processed_at, handler_version, metadata
 *
 * FUTURE:
 *   - TTL-based cleanup (e.g., delete records older than 90 days)
 *   - handler_version for migration support
 */

import type { IdempotencyStore } from './financeProvider';

// ─── Database Client Interface ─────────────────────────────────

/**
 * Minimal Supabase-like client for idempotency operations.
 * Follows the same DatabaseClient pattern used by repositories.
 */
export interface SupabaseClient {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: unknown): {
        eq(column: string, value: unknown): {
          maybeSingle(): Promise<{ data: unknown; error: unknown }>;
        };
      };
    };
    insert(row: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>;
  };
}

// ─── Persistent Store ──────────────────────────────────────────

/**
 * Configuration for PersistentIdempotencyStore.
 */
export interface PersistentStoreConfig {
  /** Supabase client instance */
  db: SupabaseClient;

  /** Table name (default: 'processed_operations') */
  tableName?: string;
}

/**
 * Creates a persistent idempotency store backed by Supabase.
 *
 * Usage:
 *   const store = createPersistentIdempotencyStore({ db: supabaseClient });
 *   const provider = createFinanceProvider({
 *     handlers: { ... },
 *     idempotencyStore: store,
 *   });
 */
export const createPersistentIdempotencyStore = (
  config: PersistentStoreConfig,
): IdempotencyStore => {
  const table = config.tableName ?? 'processed_operations';
  const { db } = config;

  return {
    async has(key: string, tenantId?: string): Promise<boolean> {
      if (!tenantId) {
        // Fallback: no tenant context — cannot query persistent store
        console.warn(
          `[PERSISTENT_IDEMPOTENCY] has() called without tenantId for key ${key}`,
        );
        return false;
      }

      try {
        const result = await db
          .from(table)
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('idempotency_key', key)
          .maybeSingle();

        return result.data !== null;
      } catch {
        // On error, assume not executed (safe default — allows retry)
        return false;
      }
    },

    async set(key: string, tenantId?: string): Promise<void> {
      if (!tenantId) {
        console.warn(
          `[PERSISTENT_IDEMPOTENCY] set() called without tenantId for key ${key}`,
        );
        return;
      }

      try {
        // Extract event_id and operation_type from key format: {eventId}_{operationType}
        const lastUnderscore = key.lastIndexOf('_');
        const eventId = lastUnderscore > 0 ? key.substring(0, lastUnderscore) : key;
        const operationType = lastUnderscore > 0 ? key.substring(lastUnderscore + 1) : 'unknown';

        const error = await db.from(table).insert({
          tenant_id: tenantId,
          event_id: eventId,
          operation_type: operationType,
          idempotency_key: key,
        });

        // UNIQUE violation = already processed — silently succeed
        // Other errors — log but don't throw (idempotency is best-effort)
        if (error.error) {
          const err = error.error as { code?: string; message?: string };
          if (err.code === '23505') {
            // UNIQUE violation — already exists, that's fine
            return;
          }
          console.error(
            `[PERSISTENT_IDEMPOTENCY] Failed to record operation ${key}:`,
            err.message,
          );
        }
      } catch (error) {
        // Don't throw — idempotency recording is best-effort
        console.error(
          `[PERSISTENT_IDEMPOTENCY] Exception recording operation ${key}:`,
          error,
        );
      }
    },
  };
};
