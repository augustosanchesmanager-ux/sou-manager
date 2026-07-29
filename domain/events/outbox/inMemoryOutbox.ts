/**
 * [SMG][DOMAIN][EVENTS][OUTBOX] InMemoryOutbox
 *
 * In-memory implementation of OutboxRepository.
 * Used for testing, demo mode, and development.
 *
 * GARANTIAS:
 *   - Atomic status transitions (pending → processing → published/failed)
 *   - Exponential backoff for retries
 *   - Dead letter promotion after maxAttempts
 *   - Sorted by createdAt (FIFO processing)
 *   - Full query support
 */

import type { OutboxRepository } from './outboxRepository';
import type { OutboxItem, OutboxStatus, OutboxQueryOptions } from './types';

export class InMemoryOutbox implements OutboxRepository {
  private items = new Map<string, OutboxItem>();
  private idIndex = new Map<string, OutboxItem>();
  private counter = 0;

  // ── Enqueue ────────────────────────────────────────────────────

  async enqueue(item: Omit<OutboxItem, 'id' | 'createdAt' | 'updatedAt' | 'dispatchedAt' | 'completedAt' | 'retry'> & {
    retry?: Partial<OutboxItem['retry']>;
  }): Promise<OutboxItem> {
    this.counter += 1;
    const now = new Date().toISOString();

    const outboxItem: OutboxItem = {
      id: `outbox_${this.counter}`,
      eventId: item.eventId,
      eventType: item.eventType,
      tenantId: item.tenantId,
      targets: item.targets,
      status: 'pending',
      retry: {
        attempts: 0,
        maxAttempts: item.retry?.maxAttempts ?? 5,
        nextRetryAt: null,
        lastError: null,
        baseDelayMs: item.retry?.baseDelayMs ?? 1000,
        ...item.retry,
      },
      payload: item.payload,
      metadata: item.metadata,
      createdAt: now,
      updatedAt: now,
      dispatchedAt: null,
      completedAt: null,
    };

    this.items.set(outboxItem.id, outboxItem);
    this.idIndex.set(outboxItem.id, outboxItem);
    return outboxItem;
  }

  // ── Find Next ─────────────────────────────────────────────────

  async findNext(): Promise<OutboxItem | null> {
    const now = new Date().toISOString();

    const eligible = Array.from(this.items.values())
      .filter((item) => {
        if (item.status !== 'pending') return false;
        // Skip items waiting for retry backoff
        if (item.retry.nextRetryAt && item.retry.nextRetryAt > now) return false;
        return true;
      })
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    return eligible[0] ?? null;
  }

  // ── Status Updates ────────────────────────────────────────────

  async markProcessing(id: string): Promise<void> {
    const item = this.items.get(id);
    if (!item) throw new Error(`Outbox item ${id} not found`);

    item.status = 'processing';
    item.dispatchedAt = new Date().toISOString();
    item.updatedAt = new Date().toISOString();
  }

  async markPublished(id: string): Promise<void> {
    const item = this.items.get(id);
    if (!item) throw new Error(`Outbox item ${id} not found`);

    item.status = 'published';
    item.completedAt = new Date().toISOString();
    item.updatedAt = new Date().toISOString();
  }

  async markFailed(id: string, error: string): Promise<void> {
    const item = this.items.get(id);
    if (!item) throw new Error(`Outbox item ${id} not found`);

    item.retry.attempts += 1;
    item.retry.lastError = error;
    item.updatedAt = new Date().toISOString();

    if (item.retry.attempts >= item.retry.maxAttempts) {
      // No more retries → dead letter
      item.status = 'dead_letter';
      item.completedAt = new Date().toISOString();
    } else {
      // Still has retries → back to pending with scheduled nextRetryAt
      item.status = 'pending';
      const delayMs = item.retry.baseDelayMs * Math.pow(2, item.retry.attempts - 1);
      item.retry.nextRetryAt = new Date(Date.now() + delayMs).toISOString();
    }
  }

  async moveToDeadLetter(id: string, reason: string): Promise<void> {
    const item = this.items.get(id);
    if (!item) throw new Error(`Outbox item ${id} not found`);

    item.status = 'dead_letter';
    item.retry.lastError = reason;
    item.completedAt = new Date().toISOString();
    item.updatedAt = new Date().toISOString();
  }

  // ── Query ─────────────────────────────────────────────────────

  async find(options?: OutboxQueryOptions): Promise<OutboxItem[]> {
    let results = Array.from(this.items.values());

    if (options?.status) {
      results = results.filter((item) => item.status === options.status);
    }
    if (options?.eventType) {
      results = results.filter((item) => item.eventType === options.eventType);
    }
    if (options?.tenantId) {
      results = results.filter((item) => item.tenantId === options.tenantId);
    }

    results.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    if (options?.offset) {
      results = results.slice(options.offset);
    }
    if (options?.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  async findById(id: string): Promise<OutboxItem | null> {
    return this.idIndex.get(id) ?? null;
  }

  async count(status?: OutboxStatus): Promise<number> {
    if (!status) return this.items.size;
    return Array.from(this.items.values()).filter((item) => item.status === status).length;
  }

  async getDeadLetters(options?: OutboxQueryOptions): Promise<OutboxItem[]> {
    return this.find({ ...options, status: 'dead_letter' });
  }
}

/**
 * Factory for creating an InMemoryOutbox.
 * Matches the pattern used by createEventStore().
 */
export const createOutbox = (): InMemoryOutbox => new InMemoryOutbox();
