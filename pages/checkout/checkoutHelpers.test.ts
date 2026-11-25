import { describe, it, expect } from 'vitest';
import {
  generateIdempotencyKey,
  getParticipantStaffId,
  getQuickComandaClient,
  getServiceCategoryDisplay,
  isCreatedAfterAppointmentDay,
  toMonthInputValue,
} from './checkoutHelpers';

describe('pages/checkout/checkoutHelpers (UXQ-007 #397)', () => {
  it('should_generate_prefixed_idempotency_keys', () => {
    const key = generateIdempotencyKey('checkout');
    expect(key.startsWith('checkout-')).toBe(true);
  });

  it('should_format_month_input_value_and_handle_invalid_dates', () => {
    expect(toMonthInputValue('2026-11-15T12:00:00Z')).toBe('2026-11');
    expect(toMonthInputValue('invalid')).toBe('');
    expect(toMonthInputValue(null)).toBe('');
  });

  it('should_resolve_participant_staff_id_and_quick_comanda_client', () => {
    expect(getParticipantStaffId({ staff_id: 's1' })).toBe('s1');
    expect(getParticipantStaffId({ professional_id: 'p1' })).toBe('p1');
    expect(getQuickComandaClient({ id: '1', created_at: '', status: 'open', clients: [{ name: 'Lucas', phone: '119' }] }))
      .toEqual({ name: 'Lucas', phone: '119' });
    expect(getQuickComandaClient({ id: '1', created_at: '', status: 'open', clients: null }))
      .toEqual({ name: 'Cliente não identificado', phone: null });
  });

  it('should_detect_comanda_created_after_appointment_day_and_map_category_display', () => {
    expect(isCreatedAfterAppointmentDay('2026-11-26T10:00:00', '2026-11-25T10:00:00')).toBe(true);
    expect(isCreatedAfterAppointmentDay('2026-11-25T15:00:00', '2026-11-25T10:00:00')).toBe(false);
    expect(getServiceCategoryDisplay('Cabelo', false)).toBe('Cabelo');
    expect(getServiceCategoryDisplay('Cabelo', true)).toBe('Facial');
  });
});
