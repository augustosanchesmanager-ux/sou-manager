/**
 * [SMG][DOMAIN][EVENTS][OUTBOX] WebhookProvider
 *
 * Provider that dispatches events to external webhooks via HTTP POST.
 * Configurable URL, headers, and transform function.
 *
 * CONFIG:
 *   url: string       — Webhook endpoint URL
 *   headers?: Record<string, string> — Custom HTTP headers
 *   transform?: (item) => body — Custom body transformation
 *
 * USAGE:
 *   const provider = createWebhookProvider('https://hooks.example.com/events');
 *   dispatcher.registerProvider(provider);
 */

import type { DispatcherProvider } from '../dispatcher';
import type { OutboxItem, DispatchTarget } from '../types';

export const createWebhookProvider = (defaultUrl?: string): DispatcherProvider => ({
  name: 'webhook',

  async deliver(item: OutboxItem, target: DispatchTarget): Promise<{ success: boolean; error?: string }> {
    const config = target.config as {
      url?: string;
      headers?: Record<string, string>;
      transform?: (item: OutboxItem) => Record<string, unknown>;
    };

    const url = config.url || defaultUrl;
    if (!url) {
      return { success: false, error: 'No webhook URL configured' };
    }

    const body = config.transform
      ? config.transform(item)
      : {
          eventId: item.eventId,
          eventType: item.eventType,
          tenantId: item.tenantId,
          payload: item.payload,
          metadata: item.metadata,
          occurredAt: item.createdAt,
        };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...config.headers,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});
