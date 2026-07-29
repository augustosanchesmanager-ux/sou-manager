/**
 * [SMG][DOMAIN][EVENTS][OUTBOX] Dispatcher
 *
 * Dispatcher infrastructure for delivering outbox items to external providers.
 * Separated from Outbox — the Outbox is a queue, the Dispatcher is the delivery mechanism.
 *
 * DESIGN:
 *   - DispatcherProvider: abstract interface for delivery targets
 *   - Dispatcher: orchestrates polling, processing, and status updates
 *   - Each provider handles its own protocol (HTTP, SMTP, etc.)
 *   - Retry logic is in the OutboxRepository, not the Dispatcher
 *
 * FLOW:
 *   Dispatcher.dispatch()
 *     ↓
 *   Outbox.findNext()
 *     ↓
 *   Outbox.markProcessing()
 *     ↓
 *   provider.deliver(item)
 *     ↓
 *   Outbox.markPublished() | Outbox.markFailed()
 */

import type { OutboxItem, DispatchTarget } from './types';

// ─── Dispatcher Provider Interface ───────────────────────────────

/**
 * A provider that knows how to deliver an outbox item.
 * Each provider handles a specific delivery channel.
 *
 * Examples:
 *   - WebhookProvider: POST to external URL
 *   - EmailProvider: send via SMTP/API
 *   - WhatsAppProvider: send via WhatsApp Business API
 *   - SlackProvider: post to Slack channel
 *   - ConsoleProvider: log to console (testing)
 */
export interface DispatcherProvider {
  /** Provider name (must match DispatchTarget.provider) */
  readonly name: string;

  /**
   * Deliver an outbox item to this provider.
   * Returns success/failure — the Dispatcher handles status updates.
   *
   * @param item - The outbox item to deliver
   * @param target - Provider-specific configuration
   * @returns { success: boolean, error?: string }
   */
  deliver(item: OutboxItem, target: DispatchTarget): Promise<{ success: boolean; error?: string }>;
}

// ─── Dispatcher Interface ────────────────────────────────────────

/**
 * Orchestrates the delivery of outbox items to registered providers.
 * Polls the outbox, dispatches to providers, and updates status.
 *
 * Usage:
 *   const dispatcher = new InMemoryDispatcher(outbox, [webhookProvider, consoleProvider]);
 *   await dispatcher.dispatch(); // processes one pending item
 *   await dispatcher.dispatchAll(); // processes all pending items
 */
export interface Dispatcher {
  /**
   * Register a provider for a specific channel.
   */
  registerProvider(provider: DispatcherProvider): void;

  /**
   * Process the next pending item in the outbox.
   * Returns the processed item, or null if no items pending.
   */
  dispatch(): Promise<OutboxItem | null>;

  /**
   * Process all pending items in the outbox.
   * Returns count of processed items.
   */
  dispatchAll(): Promise<number>;

  /**
   * Get registered provider names.
   */
  getProviders(): string[];
}
