/**
 * [SMG][DOMAIN][EVENTS] NotificationSubscriber
 *
 * Read-only subscriber that triggers notifications on CheckoutCompleted.
 * Sends checkout confirmation to client via available channels.
 *
 * IMPLEMENTATION NOTES:
 *   - Currently logs notification intent
 *   - Future: send email, push notification, WhatsApp message
 *   - Future: respect client notification preferences
 *   - Future: integrate with notification queue for async delivery
 */

import type { DomainSubscriber } from '../subscriber';
import type { CheckoutCompletedEvent } from '../types';

export const notificationSubscriber: DomainSubscriber<CheckoutCompletedEvent> = {
  name: 'NotificationSubscriber',
  description: 'Sends checkout confirmation notifications to clients',
  eventType: 'CheckoutCompleted',

  async handle(event) {
    const { payload, metadata } = event;

    console.log('[NOTIFICATION] Checkout confirmation:', {
      tenantId: metadata.tenantId,
      clientId: payload.clientId,
      comandaId: payload.comandaId,
      total: payload.total,
      paymentMethod: payload.paymentMethod,
    });
  },
};
