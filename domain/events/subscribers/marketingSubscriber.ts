/**
 * [SMG][DOMAIN][EVENTS] MarketingSubscriber
 *
 * Read-only subscriber that tracks appointment creation for marketing.
 * Identifies client engagement patterns and triggers retention campaigns.
 *
 * IMPLEMENTATION NOTES:
 *   - Currently logs marketing event
 *   - Future: update client engagement score
 *   - Future: trigger re-engagement campaigns for inactive clients
 *   - Future: suggest loyalty rewards based on appointment frequency
 */

import type { DomainSubscriber } from '../subscriber';
import type { AppointmentCreatedEvent } from '../types';

export const marketingSubscriber: DomainSubscriber<AppointmentCreatedEvent> = {
  name: 'MarketingSubscriber',
  description: 'Tracks client engagement for marketing campaigns',
  eventType: 'AppointmentCreated',

  async handle(event) {
    const { payload, metadata } = event;

    console.log('[MARKETING] Appointment tracked:', {
      tenantId: metadata.tenantId,
      appointmentId: payload.appointmentId,
      clientId: payload.clientId,
      serviceIds: payload.serviceIds,
      price: payload.price,
    });
  },
};
