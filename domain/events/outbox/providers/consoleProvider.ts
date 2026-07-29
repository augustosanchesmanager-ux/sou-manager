/**
 * [SMG][DOMAIN][EVENTS][OUTBOX] ConsoleProvider
 *
 * A simple provider that logs events to console.
 * Useful for testing, development, and debugging.
 */

import type { DispatcherProvider } from '../dispatcher';
import type { OutboxItem, DispatchTarget } from '../types';

export const consoleProvider: DispatcherProvider = {
  name: 'console',

  async deliver(item: OutboxItem, _target: DispatchTarget): Promise<{ success: boolean; error?: string }> {
    console.log('[DISPATCH][CONSOLE]', {
      eventId: item.eventId,
      eventType: item.eventType,
      tenantId: item.tenantId,
      payload: item.payload,
      metadata: item.metadata,
    });

    return { success: true };
  },
};
