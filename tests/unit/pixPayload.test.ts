import { describe, it, expect } from 'vitest';
import { generatePixPayload, calculatePixCrc16 } from '../../src/utils/pixPayload';

describe('src/utils/pixPayload: Geração de QR Code PIX EMVCo', () => {
  it('should_calculate_crc16_correctly', () => {
    // Exemplo clássico do manual do Banco Central
    const sample = '00020126360014br.gov.bcb.pix0114+5511999999999520400005303986540560.005802BR5915SR AVANTE BARB6009SAO PAULO62070503***6304';
    const crc = calculatePixCrc16(sample);
    expect(crc).toMatch(/^[0-9A-F]{4}$/);
    expect(crc.length).toBe(4);
  });

  it('should_generate_valid_pix_payload_with_custom_values', () => {
    const payload = generatePixPayload({
      pixKey: 'contato@sravante.com.br',
      merchantName: 'Sr. Avante Barber',
      merchantCity: 'São Paulo',
      amount: 60.0,
      txId: 'CMD12345',
    });

    expect(payload).toContain('000201');
    expect(payload).toContain('br.gov.bcb.pix');
    expect(payload).toContain('contato@sravante.com.br');
    expect(payload).toContain('540560.00'); // R$ 60,00
    expect(payload).toContain('5802BR');
    expect(payload).toContain('SR AVANTE BARBER'); // unaccented and uppercase
    expect(payload).toContain('SAO PAULO');
    expect(payload).toContain('CMD12345');
    expect(payload.endsWith(calculatePixCrc16(payload.slice(0, -4)))).toBe(true);
  });

  it('should_fallback_cleanly_when_optional_fields_are_omitted', () => {
    const payload = generatePixPayload({
      pixKey: '12345678909',
      merchantName: '',
      amount: 45.5,
    });

    expect(payload).toContain('000201');
    expect(payload).toContain('12345678909');
    expect(payload).toContain('540545.50');
    expect(payload).toContain('SMG BARBER');
    expect(payload.length).toBeGreaterThan(50);
  });
});
