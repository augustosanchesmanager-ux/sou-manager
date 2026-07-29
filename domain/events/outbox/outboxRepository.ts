/**
 * [SMG][DOMAIN][EVENTS][OUTBOX] OutboxRepository
 *
 * Repository interface for the outbox delivery queue.
 * Manages the lifecycle of pending deliveries.
 *
 * RESPONSABILIDADE:
 *   - Enfileirar eventos para dispatch externo
 *   - Gerenciar status: pending → processing → published/failed
 *   - Suportar retry com backoff exponencial
 *   - Mover itens falhos para dead letter queue
 *   - Query por status, tipo, tenant
 *
 * GARANTIAS:
 *   - Sem dependência de infraestrutura externa
 *   - Cada enqueue retorna o item com id e timestamps gerados
 *   - Atomic operations: markProcessing, markPublished, markFailed
 *   - Dead letter promotion após maxAttempts
 */

import type { OutboxItem, OutboxStatus, OutboxQueryOptions } from './types';

export interface OutboxRepository {
  /**
   * Enqueue a new item for dispatch.
   * Creates item with status='pending', retry.attempts=0.
   * Returns the created item.
   */
  enqueue(item: Omit<OutboxItem, 'id' | 'createdAt' | 'updatedAt' | 'dispatchedAt' | 'completedAt' | 'retry'> & {
    retry?: Partial<OutboxItem['retry']>;
  }): Promise<OutboxItem>;

  /**
   * Find a pending item eligible for processing.
   * Returns the oldest pending item where nextRetryAt is null or in the past.
   * Returns null if no items are available.
   */
  findNext(): Promise<OutboxItem | null>;

  /**
   * Mark an item as processing.
   * Sets status='processing', dispatchedAt=now.
   */
  markProcessing(id: string): Promise<void>;

  /**
   * Mark an item as successfully published.
   * Sets status='published', completedAt=now.
   */
  markPublished(id: string): Promise<void>;

  /**
   * Mark an item as failed.
   * Increments retry.attempts, calculates nextRetryAt with exponential backoff.
   * If retry.attempts >= retry.maxAttempts, promotes to dead_letter.
   */
  markFailed(id: string, error: string): Promise<void>;

  /**
   * Manually move an item to dead letter queue.
   * Sets status='dead_letter', completedAt=now.
   */
  moveToDeadLetter(id: string, reason: string): Promise<void>;

  /**
   * Query items by filters.
   */
  find(options?: OutboxQueryOptions): Promise<OutboxItem[]>;

  /**
   * Find a single item by ID.
   */
  findById(id: string): Promise<OutboxItem | null>;

  /**
   * Count items by status (for metrics/monitoring).
   */
  count(status?: OutboxStatus): Promise<number>;

  /**
   * Get dead letter items for investigation.
   */
  getDeadLetters(options?: OutboxQueryOptions): Promise<OutboxItem[]>;
}
