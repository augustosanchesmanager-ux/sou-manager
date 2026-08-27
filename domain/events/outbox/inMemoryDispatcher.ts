/**
 * [SMG][DOMAIN][EVENTS][OUTBOX] InMemoryDispatcher
 *
 * In-memory dispatcher for processing outbox items.
 * Orchestrates: findNext → markProcessing → provider.deliver → markPublished/markFailed.
 *
 * GARANTIAS:
 *   - Matches items to providers by DispatchTarget.provider name
 *   - Handles provider-not-found gracefully (marks as failed)
 *   - Error isolation: provider failures don't crash the dispatcher
 *   - Logs all dispatch attempts for debugging
 */

import type { Dispatcher, DispatcherProvider } from './dispatcher';
import type { OutboxRepository } from './outboxRepository';
import type { OutboxItem } from './types';

/**
 * ADR-015: Observability hooks for the dispatch loop.
 * Injected by bootstrap layer — domain code stays clean.
 */
export interface DispatcherHooks {
  onItemDelivered?: (item: OutboxItem, provider: string) => void;
  onItemError?: (item: OutboxItem, provider: string, error: string) => void;
  onProviderMissing?: (item: OutboxItem, provider: string) => void;
}

export class InMemoryDispatcher implements Dispatcher {
  private providers = new Map<string, DispatcherProvider>();

  constructor(
    private outbox: OutboxRepository,
    private hooks?: DispatcherHooks,
  ) {}

  // ── Provider Management ───────────────────────────────────────

  registerProvider(provider: DispatcherProvider): void {
    this.providers.set(provider.name, provider);
  }

  getProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  // ── Dispatch ──────────────────────────────────────────────────

  async dispatch(): Promise<OutboxItem | null> {
    const item = await this.outbox.findNext();
    if (!item) return null;

    await this.processItem(item);
    return item;
  }

  async dispatchAll(): Promise<number> {
    let count = 0;

    // Process until no more items are available
    // Use a safety counter to prevent infinite loops
    let safety = 0;
    const MAX_BATCH = 100;

    while (safety < MAX_BATCH) {
      const processed = await this.dispatch();
      if (!processed) break;
      count++;
      safety++;
    }

    return count;
  }

  // ── Internals ─────────────────────────────────────────────────

  private async processItem(item: OutboxItem): Promise<void> {
    await this.outbox.markProcessing(item.id);

    for (const target of item.targets) {
      const provider = this.providers.get(target.provider);

      if (!provider) {
        this.hooks?.onProviderMissing?.(item, target.provider);
        console.error(
          `[OUTBOX] Provider "${target.provider}" not found for item ${item.id}`,
        );
        await this.outbox.markFailed(
          item.id,
          `Provider "${target.provider}" not registered`,
        );
        return;
      }

      try {
        const result = await provider.deliver(item, target);

        if (result.success) {
          this.hooks?.onItemDelivered?.(item, target.provider);
          console.log(
            `[OUTBOX] Item ${item.id} delivered via ${target.provider}`,
          );
        } else {
          this.hooks?.onItemError?.(item, target.provider, result.error || 'Delivery failed');
          console.error(
            `[OUTBOX] Item ${item.id} delivery failed via ${target.provider}:`,
            result.error,
          );
          await this.outbox.markFailed(item.id, result.error || 'Delivery failed');
          return;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        this.hooks?.onItemError?.(item, target.provider, errorMsg);
        console.error(
          `[OUTBOX] Item ${item.id} provider error (${target.provider}):`,
          errorMsg,
        );
        await this.outbox.markFailed(item.id, errorMsg);
        return;
      }
    }

    // All targets delivered successfully
    await this.outbox.markPublished(item.id);
  }
}

/**
 * Factory for creating an InMemoryDispatcher.
 */
export const createDispatcher = (outbox: OutboxRepository, hooks?: DispatcherHooks): InMemoryDispatcher =>
  new InMemoryDispatcher(outbox, hooks);
