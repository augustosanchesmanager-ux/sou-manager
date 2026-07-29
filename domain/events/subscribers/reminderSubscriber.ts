/**
 * [SMG][DOMAIN][EVENTS] ReminderSubscriber
 *
 * Read-only subscriber that schedules appointment reminders.
 * Triggers when an appointment is created.
 *
 * IMPLEMENTATION NOTES:
 *   - Currently logs reminder scheduling intent
 *   - Future: schedule push notification 24h before appointment
 *   - Future: schedule SMS/WhatsApp reminder 2h before
 *   - Future: integrate with calendar system
 */

import type { DomainSubscriber } from '../subscriber';
import type { AppointmentCreatedEvent } from '../types';

export const reminderSubscriber: DomainSubscriber<AppointmentCreatedEvent> = {
  name: 'ReminderSubscriber',
  description: 'Schedules appointment reminders (24h, 2h before)',
  eventType: 'AppointmentCreated',

  async handle(event) {
    const { payload, metadata } = event;

    console.log('[REMINDER] Appointment reminder scheduled:', {
      tenantId: metadata.tenantId,
      appointmentId: payload.appointmentId,
      clientId: payload.clientId,
      staffId: payload.staffId,
      startTime: payload.startTime,
      price: payload.price,
    });
  },
};
