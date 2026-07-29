/**
 * [SMG][DOMAIN][EVENTS][OUTBOX] SlackProvider
 *
 * Provider that dispatches events to Slack channels via webhooks.
 * Formats messages for Slack's Block Kit or simple text.
 *
 * CONFIG:
 *   url: string       — Slack webhook URL
 *   channel?: string  — Channel override (optional)
 *   iconEmoji?: string — Bot icon (default: :robot:)
 */

import type { DispatcherProvider } from '../dispatcher';
import type { OutboxItem, DispatchTarget } from '../types';

export const createSlackProvider = (defaultUrl?: string): DispatcherProvider => ({
  name: 'slack',

  async deliver(item: OutboxItem, target: DispatchTarget): Promise<{ success: boolean; error?: string }> {
    const config = target.config as {
      url?: string;
      channel?: string;
      iconEmoji?: string;
    };

    const url = config.url || defaultUrl;
    if (!url) {
      return { success: false, error: 'No Slack webhook URL configured' };
    }

    const message = {
      channel: config.channel,
      icon_emoji: config.iconEmoji || ':robot:',
      text: `[${item.eventType}] ${item.tenantId}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${item.eventType}*\nTenant: \`${item.tenantId}\`\nEvent: \`${item.eventId}\``,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '```' + JSON.stringify(item.payload, null, 2).slice(0, 1000) + '```',
          },
        },
      ],
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Slack HTTP ${response.status}: ${response.statusText}`,
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
