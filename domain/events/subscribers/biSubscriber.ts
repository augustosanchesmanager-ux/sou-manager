/**
 * [SMG][DOMAIN][EVENTS] BiSubscriber
 *
 * Read-only subscriber that processes CashClosingCompleted for BI.
 * Updates business intelligence dashboards with daily closing data.
 *
 * IMPLEMENTATION NOTES:
 *   - Currently logs BI event
 *   - Future: update real-time BI dashboard
 *   - Future: calculate daily KPIs (revenue, discrepancy rate, extras)
 *   - Future: feed data warehouse for historical analysis
 */

import type { DomainSubscriber } from '../subscriber';
import type { CashClosingCompletedEvent } from '../types';

export const biSubscriber: DomainSubscriber<CashClosingCompletedEvent> = {
  name: 'BiSubscriber',
  description: 'Updates BI dashboards with cash closing data',
  eventType: 'CashClosingCompleted',

  async handle(event) {
    const { payload, metadata } = event;

    console.log('[BI] Cash closing completed:', {
      tenantId: metadata.tenantId,
      closingId: payload.closingId,
      businessDate: payload.businessDate,
      expectedBalance: payload.expectedBalance,
      countedBalance: payload.countedBalance,
      difference: payload.difference,
      hasDiscrepancy: payload.hasDiscrepancy,
      extrasCount: payload.extrasCount,
    });
  },
};
