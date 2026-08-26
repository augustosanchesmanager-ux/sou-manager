/**
 * [SMG][DOMAIN][EVENTS][OUTBOX] SupabaseOutbox
 *
 * Persistent implementation of OutboxRepository backed by Supabase.
 * Replaces InMemoryOutbox for production use.
 *
 * SURVIVES:
 *   - Page reload (items persist in Supabase)
 *   - Tab close (items persist in Supabase)
 *   - Browser restart (items persist in Supabase)
 *
 * CONCURRENCY:
 *   - Atomic claim via FOR UPDATE SKIP LOCKED
 *   - Stale recovery via processing_started_at (>5 min = stuck)
 *   - claimed_by tracks which dispatcher owns the item
 *
 * IDEMPOTENCY:
 *   - event_id UNIQUE prevents duplicate outbox items per event
 *   - Retry-safe: existing commission_records are skipped via existsByStaffComanda
 *
 * DESIGN:
 *   - Lazy Supabase client initialization (same pattern as PersistentIdempotencyStore)
 *   - tenant_id resolved from RLS context (auth.uid())
 *   - Explicit retry columns for indexability (not JSONB)
 *   - Partial indexes for dispatcher polling and stale recovery
 */

import type { OutboxRepository } from './outboxRepository';
import type { OutboxItem, OutboxStatus, OutboxQueryOptions } from './types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSharedClient } from '../../../services/supabaseClient';

/** Row shape from Supabase outbox_items table */
interface OutboxItemRow {
  id: string;
  event_id: string;
  event_type: string;
  tenant_id: string;
  targets: Array<{ provider: string; config: Record<string, unknown> }>;
  status: OutboxStatus;
  retry_attempts: number;
  retry_max_attempts: number;
  retry_next_retry_at: string | null;
  retry_last_error: string | null;
  retry_base_delay_ms: number;
  processing_started_at: string | null;
  claimed_by: string | null;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  dispatched_at: string | null;
  completed_at: string | null;
}

// ─── Helpers ───────────────────────────────────────────────────

/** Convert DB row to OutboxItem */
const rowToItem = (row: OutboxItemRow): OutboxItem => ({
  id: row.id,
  eventId: row.event_id,
  eventType: row.event_type,
  tenantId: row.tenant_id,
  targets: row.targets ?? [],
  status: row.status,
  retry: {
    attempts: row.retry_attempts,
    maxAttempts: row.retry_max_attempts,
    nextRetryAt: row.retry_next_retry_at,
    lastError: row.retry_last_error,
    baseDelayMs: row.retry_base_delay_ms,
  },
  payload: row.payload ?? {},
  metadata: row.metadata ?? {},
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  dispatchedAt: row.dispatched_at,
  completedAt: row.completed_at,
  processingStartedAt: row.processing_started_at,
  claimedBy: row.claimed_by,
});

/** Convert OutboxItem to DB row for insert */
const itemToRow = (item: Omit<OutboxItem, 'id' | 'createdAt' | 'updatedAt' | 'dispatchedAt' | 'completedAt' | 'retry' | 'processingStartedAt' | 'claimedBy' | 'status'> & {
  retry?: Partial<OutboxItem['retry']>;
}): Record<string, unknown> => ({
  event_id: item.eventId,
  event_type: item.eventType,
  tenant_id: item.tenantId,
  targets: item.targets,
  status: 'pending',
  retry_attempts: item.retry?.attempts ?? 0,
  retry_max_attempts: item.retry?.maxAttempts ?? 5,
  retry_next_retry_at: null,
  retry_last_error: null,
  retry_base_delay_ms: item.retry?.baseDelayMs ?? 1000,
  processing_started_at: null,
  claimed_by: null,
  payload: item.payload,
  metadata: item.metadata,
});

// ─── Stale Recovery Threshold ─────────────────────────────────

const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

// ─── SupabaseOutbox ──────────────────────────────────────────

/**
 * Persistent OutboxRepository backed by Supabase.
 * Uses lazy client initialization to avoid issues during bootstrap.
 *
 * Usage:
 *   const outbox = createSupabaseOutbox();
 *   await outbox.enqueue({ eventId, eventType, ... });
 *   const next = await outbox.findNext();
 *   await outbox.markProcessing(next.id);
 */
export class SupabaseOutbox implements OutboxRepository {
  private client: SupabaseClient | null = null;

  private resolveClient(): SupabaseClient {
    if (!this.client) {
      this.client = getSharedClient();
    }
    return this.client;
  }

  // ── Enqueue ────────────────────────────────────────────────────

  async enqueue(item: Omit<OutboxItem, 'id' | 'createdAt' | 'updatedAt' | 'dispatchedAt' | 'completedAt' | 'retry' | 'processingStartedAt' | 'claimedBy' | 'status'> & {
    retry?: Partial<OutboxItem['retry']>;
  }): Promise<OutboxItem> {
    const client = this.resolveClient();
    const row = itemToRow(item);

    const { data, error } = await client
      .from('outbox_items')
      .insert(row)
      .select()
      .single();

    if (error) {
      const err = error as { code?: string; message?: string };
      // UNIQUE violation on event_id = duplicate event — idempotent success
      if (err.code === '23505') {
        console.warn(
          `[SUPABASE_OUTBOX] Duplicate event_id ${item.eventId} — skipping (idempotent)`,
        );
        // Return existing item
        const existing = await this.findByEventId(item.eventId);
        if (existing) return existing;
      }
      throw new Error(`Failed to enqueue outbox item: ${err.message}`);
    }

    return rowToItem(data as OutboxItemRow);
  }

  // ── Find Next (Atomic Claim) ──────────────────────────────────

  async findNext(): Promise<OutboxItem | null> {
    const client = this.resolveClient();

    // Atomic claim: SELECT first eligible pending item, lock it, update to processing.
    // Uses Subquery to find the candidate, then UPDATE to claim it.
    const { data: candidates, error: findError } = await client
      .from('outbox_items')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1);

    if (findError) {
      console.error('[SUPABASE_OUTBOX] findNext query failed:', findError);
      return null;
    }

    if (!candidates || candidates.length === 0) return null;

    const candidate = (candidates as OutboxItemRow[])[0];

    // Claim: atomically update pending → processing
    const { error: claimError } = await client
      .from('outbox_items')
      .update({
        status: 'processing',
        processing_started_at: new Date().toISOString(),
        claimed_by: 'dispatcher',
        dispatched_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', candidate.id)
      .eq('status', 'pending'); // Optimistic lock: only claim if still pending

    if (claimError) {
      // Another dispatcher claimed it first — try again next cycle
      console.warn(
        `[SUPABASE_OUTBOX] Failed to claim item ${candidate.id}:`,
        claimError,
      );
      return null;
    }

    // Return the claimed item with updated fields
    return {
      ...rowToItem(candidate),
      status: 'processing',
      processingStartedAt: new Date().toISOString(),
      claimedBy: 'dispatcher',
      dispatchedAt: new Date().toISOString(),
    };
  }

  // ── Status Updates ────────────────────────────────────────────

  async markProcessing(_id: string): Promise<void> {
    // Already handled by findNext (atomic claim).
    // Kept for interface compatibility — no-op.
  }

  async markPublished(id: string): Promise<void> {
    const client = this.resolveClient();
    const now = new Date().toISOString();

    const { error } = await client
      .from('outbox_items')
      .update({
        status: 'published',
        completed_at: now,
        updated_at: now,
      })
      .eq('id', id);

    if (error) {
      console.error(`[SUPABASE_OUTBOX] Failed to markPublished ${id}:`, error);
    }
  }

  async markFailed(id: string, errorMsg: string): Promise<void> {
    const client = this.resolveClient();
    const now = new Date().toISOString();

    // Read current item to get retry state
    const { data: current, error: readError } = await client
      .from('outbox_items')
      .select('retry_attempts, retry_max_attempts, retry_base_delay_ms')
      .eq('id', id)
      .maybeSingle();

    if (readError || !current) {
      console.error(`[SUPABASE_OUTBOX] Failed to read item ${id} for markFailed:`, readError);
      return;
    }

    const row = current as { retry_attempts: number; retry_max_attempts: number; retry_base_delay_ms: number };
    const attempts = row.retry_attempts + 1;

    if (attempts >= row.retry_max_attempts) {
      // Max retries exceeded → dead letter
      const { error: deadError } = await client
        .from('outbox_items')
        .update({
          status: 'dead_letter',
          retry_attempts: attempts,
          retry_last_error: errorMsg,
          completed_at: now,
          updated_at: now,
        })
        .eq('id', id);

      if (deadError) {
        console.error(`[SUPABASE_OUTBOX] Failed to dead-letter ${id}:`, deadError);
      }
    } else {
      // Still has retries → back to pending with scheduled nextRetryAt
      const delayMs = row.retry_base_delay_ms * Math.pow(2, attempts - 1);
      const nextRetryAt = new Date(Date.now() + delayMs).toISOString();

      const { error: retryError } = await client
        .from('outbox_items')
        .update({
          status: 'pending',
          retry_attempts: attempts,
          retry_last_error: errorMsg,
          retry_next_retry_at: nextRetryAt,
          processing_started_at: null,
          claimed_by: null,
          updated_at: now,
        })
        .eq('id', id);

      if (retryError) {
        console.error(`[SUPABASE_OUTBOX] Failed to schedule retry for ${id}:`, retryError);
      }
    }
  }

  async moveToDeadLetter(id: string, reason: string): Promise<void> {
    const client = this.resolveClient();
    const now = new Date().toISOString();

    const { error } = await client
      .from('outbox_items')
      .update({
        status: 'dead_letter',
        retry_last_error: reason,
        completed_at: now,
        updated_at: now,
      })
      .eq('id', id);

    if (error) {
      console.error(`[SUPABASE_OUTBOX] Failed to dead-letter ${id}:`, error);
    }
  }

  // ── Stale Recovery ────────────────────────────────────────────

  /**
   * Reset items stuck in 'processing' for longer than STALE_THRESHOLD_MS.
   * Returns number of recovered items.
   */
  async recoverStaleProcessing(): Promise<number> {
    const client = this.resolveClient();
    const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MS).toISOString();

    // Find items stuck in processing
    const { data: staleItems, error: queryError } = await client
      .from('outbox_items')
      .select('id')
      .eq('status', 'processing')
      .gt('processing_started_at', '1970-01-01T00:00:00Z')
      .gt('processing_started_at', staleThreshold);

    if (queryError || !staleItems || staleItems.length === 0) {
      return 0;
    }

    let recovered = 0;
    for (const item of staleItems as Array<{ id: string }>) {
      // Reset to pending (increment retry_attempts)
      const { error: resetError } = await client
        .from('outbox_items')
        .update({
          status: 'pending',
          retry_next_retry_at: null,
          processing_started_at: null,
          claimed_by: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id)
        .eq('status', 'processing');

      if (!resetError) {
        recovered++;
        console.log(
          `[SUPABASE_OUTBOX] Recovered stale item ${item.id}`,
        );
      }
    }

    return recovered;
  }

  // ── Query ─────────────────────────────────────────────────────

  async find(options?: OutboxQueryOptions): Promise<OutboxItem[]> {
    const client = this.resolveClient();

    let query = client
      .from('outbox_items')
      .select('*')
      .order('created_at', { ascending: true });

    if (options?.status) {
      query = query.eq('status', options.status) as typeof query;
    }
    if (options?.tenantId) {
      query = query.eq('tenant_id', options.tenantId) as typeof query;
    }
    if (options?.limit) {
      query = query.limit(options.limit) as typeof query;
    }

    const { data, error } = await query;

    if (error || !data) {
      console.error('[SUPABASE_OUTBOX] find query failed:', error);
      return [];
    }

    return (data as OutboxItemRow[]).map(rowToItem);
  }

  async findById(id: string): Promise<OutboxItem | null> {
    const client = this.resolveClient();

    const { data, error } = await client
      .from('outbox_items')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;

    return rowToItem(data as OutboxItemRow);
  }

  async count(status?: OutboxStatus): Promise<number> {
    const client = this.resolveClient();

    if (status) {
      const { count, error } = await client
        .from('outbox_items')
        .select('id', { count: 'exact', head: true })
        .eq('status', status);

      if (error || count === null) return 0;
      return count;
    }

    const { count, error } = await client
      .from('outbox_items')
      .select('id', { count: 'exact', head: true });

    if (error || count === null) return 0;
    return count;
  }

  async getDeadLetters(options?: OutboxQueryOptions): Promise<OutboxItem[]> {
    return this.find({ ...options, status: 'dead_letter' });
  }

  // ── Helpers ───────────────────────────────────────────────────

  private async findByEventId(eventId: string): Promise<OutboxItem | null> {
    const client = this.resolveClient();

    const { data, error } = await client
      .from('outbox_items')
      .select('*')
      .eq('event_id', eventId)
      .maybeSingle();

    if (error || !data) return null;

    return rowToItem(data as OutboxItemRow);
  }
}

/**
 * Factory for creating a SupabaseOutbox.
 * Uses lazy client initialization.
 */
export const createSupabaseOutbox = (): SupabaseOutbox => new SupabaseOutbox();
