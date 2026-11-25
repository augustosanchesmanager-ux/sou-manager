import { describe, it, expect } from 'vitest';
import {
  CLIENT_FALLBACK_LABEL,
  createFiadoOutboxData,
  extractClientNameFromTransactionDescription,
  getAppointmentStartTime,
  getClientData,
  normalizePaymentMethod,
} from './receivablesHelpers';

describe('pages/AccountsReceivable/receivablesHelpers (UXQ-007 #397)', () => {
  it('should_extract_appointment_start_time_from_object_or_array', () => {
    expect(getAppointmentStartTime({ start_time: '2026-11-25T12:00:00Z' })).toBe('2026-11-25T12:00:00Z');
    expect(getAppointmentStartTime([{ start_time: '2026-11-25T14:00:00Z' }])).toBe('2026-11-25T14:00:00Z');
    expect(getAppointmentStartTime(null)).toBeNull();
  });

  it('should_normalize_payment_methods_consistently', () => {
    expect(normalizePaymentMethod('Dinheiro')).toBe('cash');
    expect(normalizePaymentMethod('Cartao Credito')).toBe('credit');
    expect(normalizePaymentMethod('Debito')).toBe('debit');
    expect(normalizePaymentMethod('PIX')).toBe('pix');
    expect(normalizePaymentMethod('')).toBe('pix');
  });

  it('should_extract_client_data_and_description_fallback', () => {
    expect(getClientData([{ name: 'João', phone: '11999999999' }])).toEqual({ name: 'João', phone: '11999999999' });
    expect(getClientData(null)).toEqual({ name: CLIENT_FALLBACK_LABEL, phone: null });
    expect(extractClientNameFromTransactionDescription('Baixa Fiado | Cliente: Carlos Silva (PIX)')).toBe('Carlos Silva');
    expect(extractClientNameFromTransactionDescription('Sem nome')).toBe(CLIENT_FALLBACK_LABEL);
  });

  it('should_build_fiado_outbox_payload_with_idempotency_key', () => {
    const outbox = createFiadoOutboxData('t1', 'cmd-1', 'c1', 's1', 80, 'pix', 'manual');
    expect(outbox.eventType).toBe('CheckoutCompleted');
    expect(outbox.payload.operationType).toBe('create_commission_record');
    expect(outbox.payload.idempotencyKey).toContain('cmd-1');
  });
});
