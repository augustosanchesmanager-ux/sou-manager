/**
 * [SMG][DOMAIN][EVENTS] AuditSubscriber
 *
 * Read-only subscriber that logs all domain events for audit trail.
 * Provides compliance-ready event logging with full context.
 *
 * IMPLEMENTATION NOTES:
 *   - Currently logs to console with structured format
 *   - Future: persist to audit_logs table via repository
 *   - Future: support filtering by event type, tenant, time range
 *   - Covers ALL event types via subscribeAll pattern
 */

import type { DomainSubscriber } from '../subscriber';
import type { SystemEvent } from '../types';

export const auditSubscriber: DomainSubscriber<SystemEvent> = {
  name: 'AuditSubscriber',
  description: 'Logs all domain events for compliance audit trail',
  eventType: '*' as any, // Will use subscribeAll in registry

  async handle(event) {
    console.log('[AUDIT] Domain event:', {
      eventId: event.eventId,
      eventType: event.eventType,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      tenantId: event.metadata.tenantId,
      source: event.metadata.source,
      version: event.eventTypeVersion,
      correlationId: event.metadata.correlationId,
      occurredAt: event.occurredAt,
    });
  },
};
