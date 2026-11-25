import { describe, it, expect } from 'vitest';
import {
  getAppointmentEndLabel,
  getComandaStatusDisplay,
  getDecimalTimeLabel,
  getOriginLabel,
  getShortNotes,
  getTimelinePercent,
  isHiddenFromScheduleMissingError,
  SCHEDULE_START_HOUR,
} from './scheduleHelpers';

describe('pages/schedule/scheduleHelpers (UXQ-007 #397)', () => {
  it('should_format_decimal_times_and_timeline_percentages', () => {
    expect(getDecimalTimeLabel(9.5)).toBe('09:30');
    expect(getAppointmentEndLabel({ start: 10, duration: 0.75 })).toBe('10:45');
    expect(getTimelinePercent(SCHEDULE_START_HOUR)).toBe(0);
    expect(getTimelinePercent(24)).toBe(100);
  });

  it('should_map_origin_and_comanda_status_labels', () => {
    expect(getOriginLabel('kiosk', 'totem', false)).toBe('Totem');
    expect(getOriginLabel('kiosk', 'qr', false)).toBe('QR');
    expect(getOriginLabel('web', 'whatsapp', false)).toBe('WhatsApp');
    expect(getComandaStatusDisplay('open', false).label).toBe('Aberta');
    expect(getComandaStatusDisplay('paid', false).label).toBe('Paga');
    expect(getComandaStatusDisplay(null, false).label).toBe('Sem comanda');
  });

  it('should_truncate_long_notes_and_detect_missing_column_error', () => {
    expect(getShortNotes('curto')).toBe('curto');
    expect(getShortNotes('a'.repeat(80)).endsWith('...')).toBe(true);
    expect(isHiddenFromScheduleMissingError({ code: '42703', message: 'column hidden_from_schedule does not exist' })).toBe(true);
    expect(isHiddenFromScheduleMissingError({ code: '23505', message: 'duplicate' })).toBe(false);
  });
});
