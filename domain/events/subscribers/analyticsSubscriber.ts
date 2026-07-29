/**
 * [SMG][DOMAIN][EVENTS] AnalyticsSubscriber
 *
 * Read-only subscriber that processes CheckoutCompleted events for analytics.
 * Aggregates metrics: revenue, payment methods, items per checkout, club credit usage.
 *
 * IMPLEMENTATION NOTES:
 *   - Currently logs structured metrics to console
 *   - Future: send to analytics service (Mixpanel, Amplitude, custom)
 *   - Future: aggregate in-memory counters for real-time dashboard
 */

import type { DomainSubscriber } from '../subscriber';
import type { CheckoutCompletedEvent } from '../types';

export const analyticsSubscriber: DomainSubscriber<CheckoutCompletedEvent> = {
  name: 'AnalyticsSubscriber',
  description: 'Tracks checkout metrics for analytics dashboards',
  eventType: 'CheckoutCompleted',

  async handle(event) {
    const { payload, metadata } = event;

    console.log('[ANALYTICS] Checkout completed:', {
      tenantId: metadata.tenantId,
      comandaId: payload.comandaId,
      total: payload.total,
      paymentMethod: payload.paymentMethod,
      itemCount: payload.itemCount,
      hasClubCredit: payload.hasClubCredit,
      timestamp: event.occurredAt,
    });
  },
};
