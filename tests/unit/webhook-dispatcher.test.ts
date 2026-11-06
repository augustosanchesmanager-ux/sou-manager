import { describe, it, expect, vi } from 'vitest';
import {
  generateWebhookSignature,
  verifyWebhookSignature,
  constantTimeCompare,
  computeHmacSha256,
} from '../../supabase/functions/webhook-dispatcher/crypto.ts';
import {
  calculateNextRetry,
  truncateString,
  dispatchSingleWebhook,
  RETRY_DELAYS_SECONDS,
} from '../../supabase/functions/webhook-dispatcher/dispatcher.ts';
import type { WebhookDeliveryRecord } from '../../supabase/functions/webhook-dispatcher/types.ts';

describe('Webhook Dispatcher — Cryptography & Signatures', () => {
  const secret = 'whsec_test_secret_1234567890abcdef';
  const samplePayload = JSON.stringify({
    event: 'appointment.created',
    data: { id: 'app-001', customer_name: 'Carlos Silva', total: 65.0 },
  });

  it('should_generate_valid_signature_header_with_timestamp_and_digest', async () => {
    const fixedTimestamp = 1730851200; // Exemplo de timestamp fixo
    const { signatureHeader, timestamp, digestHex } = await generateWebhookSignature(
      samplePayload,
      secret,
      fixedTimestamp
    );

    expect(timestamp).toBe(fixedTimestamp);
    expect(signatureHeader).toBe(`t=${fixedTimestamp},v1=${digestHex}`);
    expect(digestHex).toMatch(/^[0-9a-f]{64}$/); // SHA-256 hex é 64 chars
  });

  it('should_produce_different_digests_for_different_payloads', async () => {
    const ts = 1730851200;
    const sig1 = await generateWebhookSignature('payload_A', secret, ts);
    const sig2 = await generateWebhookSignature('payload_B', secret, ts);

    expect(sig1.digestHex).not.toBe(sig2.digestHex);
  });

  it('should_produce_different_digests_for_different_secrets', async () => {
    const ts = 1730851200;
    const sig1 = await generateWebhookSignature(samplePayload, 'secret_1', ts);
    const sig2 = await generateWebhookSignature(samplePayload, 'secret_2', ts);

    expect(sig1.digestHex).not.toBe(sig2.digestHex);
  });

  it('should_verify_valid_signature_within_tolerance', async () => {
    const ts = 1000;
    const { signatureHeader } = await generateWebhookSignature(samplePayload, secret, ts);

    const result = await verifyWebhookSignature(samplePayload, secret, signatureHeader, 300, 1050);
    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('should_reject_signature_when_payload_is_tampered', async () => {
    const ts = 1000;
    const { signatureHeader } = await generateWebhookSignature(samplePayload, secret, ts);

    const tamperedPayload = JSON.stringify({ event: 'appointment.created', data: { total: 0.0 } });
    const result = await verifyWebhookSignature(tamperedPayload, secret, signatureHeader, 300, 1050);

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Digest criptográfico HMAC incompatível');
  });

  it('should_reject_signature_when_secret_is_incorrect', async () => {
    const ts = 1000;
    const { signatureHeader } = await generateWebhookSignature(samplePayload, secret, ts);

    const result = await verifyWebhookSignature(samplePayload, 'wrong_secret', signatureHeader, 300, 1050);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Digest criptográfico HMAC incompatível');
  });

  it('should_reject_signature_when_timestamp_exceeds_tolerance_window_replay_attack', async () => {
    const oldTs = 1000;
    const nowTs = 2000; // 1000s de diferença (tolerância = 300s)
    const { signatureHeader } = await generateWebhookSignature(samplePayload, secret, oldTs);

    const result = await verifyWebhookSignature(samplePayload, secret, signatureHeader, 300, nowTs);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Assinatura expirada');
  });

  it('should_reject_malformed_signature_headers', async () => {
    const res1 = await verifyWebhookSignature(samplePayload, secret, 'invalid_header', 300);
    expect(res1.valid).toBe(false);

    const res2 = await verifyWebhookSignature(samplePayload, secret, '', 300);
    expect(res2.valid).toBe(false);

    const res3 = await verifyWebhookSignature(samplePayload, secret, 't=notanumber,v1=abc', 300);
    expect(res3.valid).toBe(false);
  });

  it('should_perform_constant_time_string_comparison_correctly', () => {
    expect(constantTimeCompare('abcdef', 'abcdef')).toBe(true);
    expect(constantTimeCompare('abcdef', 'abcdeg')).toBe(false);
    expect(constantTimeCompare('abcdef', 'abc')).toBe(false);
  });
});

describe('Webhook Dispatcher — Retries & Backoff Strategy', () => {
  const baseTime = new Date('2026-11-06T12:00:00.000Z');

  it('should_calculate_first_retry_as_plus_1_minute', () => {
    const nextRetry = calculateNextRetry(1, baseTime);
    expect(nextRetry).not.toBeNull();
    // 12:00:00 + 60s = 12:01:00
    expect(nextRetry!.toISOString()).toBe('2026-11-06T12:01:00.000Z');
  });

  it('should_calculate_second_retry_as_plus_5_minutes', () => {
    const nextRetry = calculateNextRetry(2, baseTime);
    expect(nextRetry).not.toBeNull();
    // 12:00:00 + 300s = 12:05:00
    expect(nextRetry!.toISOString()).toBe('2026-11-06T12:05:00.000Z');
  });

  it('should_calculate_third_retry_as_plus_15_minutes', () => {
    const nextRetry = calculateNextRetry(3, baseTime);
    expect(nextRetry).not.toBeNull();
    // 12:00:00 + 900s = 12:15:00
    expect(nextRetry!.toISOString()).toBe('2026-11-06T12:15:00.000Z');
  });

  it('should_calculate_fourth_retry_as_plus_1_hour', () => {
    const nextRetry = calculateNextRetry(4, baseTime);
    expect(nextRetry).not.toBeNull();
    // 12:00:00 + 3600s = 13:00:00
    expect(nextRetry!.toISOString()).toBe('2026-11-06T13:00:00.000Z');
  });

  it('should_calculate_fifth_retry_as_plus_6_hours', () => {
    const nextRetry = calculateNextRetry(5, baseTime);
    expect(nextRetry).not.toBeNull();
    // 12:00:00 + 21600s = 18:00:00
    expect(nextRetry!.toISOString()).toBe('2026-11-06T18:00:00.000Z');
  });

  it('should_return_null_for_attempts_equal_or_greater_than_6_terminating_retries', () => {
    expect(calculateNextRetry(6, baseTime)).toBeNull();
    expect(calculateNextRetry(7, baseTime)).toBeNull();
    expect(calculateNextRetry(10, baseTime)).toBeNull();
  });

  it('should_truncate_strings_properly', () => {
    expect(truncateString(null)).toBeNull();
    expect(truncateString('curto', 10)).toBe('curto');
    expect(truncateString('1234567890EXTRA', 10)).toBe('1234567890');
  });
});

describe('Webhook Dispatcher — HTTP Delivery Execution', () => {
  const secret = 'whsec_prod_key_777';
  const mockDelivery: WebhookDeliveryRecord = {
    id: 'del-uuid-001',
    subscription_id: 'sub-uuid-001',
    tenant_id: 'tenant-uuid-001',
    event_type: 'appointment.completed',
    payload: { appointment_id: 'app-999', status: 'completed' },
    status: 'pending',
    attempts: 0,
    next_retry_at: null,
    response_status: null,
    response_body: null,
    delivered_at: null,
    created_at: '2026-11-06T10:00:00Z',
  };

  const fixedNow = new Date('2026-11-06T12:00:00.000Z');

  it('should_deliver_successfully_on_http_200_and_transition_to_delivered', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{"received": true}',
    });

    const result = await dispatchSingleWebhook(
      mockDelivery,
      'https://partner.example.com/webhook',
      secret,
      {
        fetchImpl: mockFetch as any,
        now: fixedNow,
      }
    );

    expect(result.status).toBe('delivered');
    expect(result.attempts).toBe(1);
    expect(result.nextRetryAt).toBeNull();
    expect(result.responseStatus).toBe(200);
    expect(result.responseBody).toBe('{"received": true}');
    expect(result.deliveredAt).toBe(fixedNow.toISOString());

    // Verificar chamadas de rede e cabeçalhos
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [calledUrl, requestInit] = mockFetch.mock.calls[0];
    expect(calledUrl).toBe('https://partner.example.com/webhook');
    expect(requestInit.method).toBe('POST');
    expect(requestInit.headers['Content-Type']).toBe('application/json');
    expect(requestInit.headers['User-Agent']).toBe('SMG-Webhook-Dispatcher/1.0');
    expect(requestInit.headers['X-SMG-Delivery-Id']).toBe('del-uuid-001');
    expect(requestInit.headers['X-SMG-Event']).toBe('appointment.completed');
    expect(requestInit.headers['X-SMG-Signature']).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);
  });

  it('should_handle_http_500_failure_and_schedule_first_retry', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });

    const result = await dispatchSingleWebhook(
      mockDelivery,
      'https://partner.example.com/webhook',
      secret,
      {
        fetchImpl: mockFetch as any,
        now: fixedNow,
      }
    );

    expect(result.status).toBe('pending');
    expect(result.attempts).toBe(1);
    // 12:00:00 + 1m = 12:01:00
    expect(result.nextRetryAt).toBe('2026-11-06T12:01:00.000Z');
    expect(result.responseStatus).toBe(500);
    expect(result.responseBody).toBe('Internal Server Error');
    expect(result.deliveredAt).toBeNull();
  });

  it('should_transition_to_failed_when_attempts_reach_threshold_of_6', async () => {
    const deliveryWith5Attempts: WebhookDeliveryRecord = {
      ...mockDelivery,
      attempts: 5, // Esta será a 6ª tentativa
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => 'Bad Gateway',
    });

    const result = await dispatchSingleWebhook(
      deliveryWith5Attempts,
      'https://partner.example.com/webhook',
      secret,
      {
        fetchImpl: mockFetch as any,
        now: fixedNow,
      }
    );

    expect(result.status).toBe('failed');
    expect(result.attempts).toBe(6);
    expect(result.nextRetryAt).toBeNull();
    expect(result.responseStatus).toBe(502);
    expect(result.deliveredAt).toBeNull();
  });

  it('should_handle_timeout_abort_and_schedule_retry_with_status_504', async () => {
    const mockFetch = vi.fn().mockRejectedValue({
      name: 'AbortError',
      message: 'The operation was aborted',
    });

    const result = await dispatchSingleWebhook(
      mockDelivery,
      'https://partner.example.com/webhook',
      secret,
      {
        fetchImpl: mockFetch as any,
        now: fixedNow,
        timeoutMs: 100,
      }
    );

    expect(result.status).toBe('pending');
    expect(result.attempts).toBe(1);
    expect(result.responseStatus).toBe(504);
    expect(result.responseBody).toContain('Timeout excedido');
    expect(result.nextRetryAt).toBe('2026-11-06T12:01:00.000Z');
  });

  it('should_truncate_response_body_if_it_exceeds_maxBodyLength', async () => {
    const longBody = 'A'.repeat(2000);
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => longBody,
    });

    const result = await dispatchSingleWebhook(
      mockDelivery,
      'https://partner.example.com/webhook',
      secret,
      {
        fetchImpl: mockFetch as any,
        now: fixedNow,
        maxBodyLength: 50,
      }
    );

    expect(result.status).toBe('delivered');
    expect(result.responseBody).toHaveLength(50);
  });
});
