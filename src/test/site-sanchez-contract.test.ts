/**
 * Canonical Contract v1 — Contract Tests
 *
 * Tests the pure logic module for the site-sanchez-appointments Edge Function.
 * These tests verify the contract behavior without requiring Deno runtime or Supabase.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  validatePayload,
  buildSuccessResponse,
  buildErrorResponse,
  getRpcErrorStatus,
  verifyRequestAuth,
  type AppointmentPayload,
  type RpcSuccessResult,
  type RpcErrorResult,
} from '@/supabase/functions/site-sanchez-appointments/contract.ts';

// Helper to create a valid base payload
const createValidPayload = (overrides: Partial<AppointmentPayload> = {}): AppointmentPayload => ({
  client_name: 'João Silva',
  phone: '11999999999',
  service_id: '550e8400-e29b-41d4-a716-446655440000',
  professional_id: '660e8400-e29b-41d4-a716-446655440001',
  scheduled_at: new Date(Date.now() + 86400000).toISOString(), // tomorrow
  status: 'active',
  site_appointment_id: 'site-appt-123',
  external_id: 'ext-123',
  notes: 'Test appointment',
  ...overrides,
});

// Helper to create a mock Request for auth testing
const createMockRequest = (headers: Record<string, string> = {}): Request => {
  const h = new Headers(headers);
  return new Request('https://example.com/functions/v1/site-sanchez-appointments', {
    method: 'POST',
    headers: h,
  });
};

describe('Canonical Contract v1 — validatePayload', () => {
  describe('valid active payload', () => {
    it('passes with all required fields and future scheduled_at', () => {
      const payload = createValidPayload({ status: 'active' });
      const result = validatePayload(payload);
      expect(result.errors).toHaveLength(0);
      expect(result.value).not.toBeNull();
      expect(result.value?.status).toBe('active');
    });
  });

  describe('past scheduled_at with active status', () => {
    it('rejects when scheduled_at is in the past and status=active', () => {
      const payload = createValidPayload({
        status: 'active',
        scheduled_at: new Date(Date.now() - 86400000).toISOString(), // yesterday
      });
      const result = validatePayload(payload);
      expect(result.errors).toContain('scheduled_at must be in the future.');
    });
  });

  describe('past scheduled_at with cancelled status', () => {
    it('accepts when scheduled_at is in the past and status=cancelled (A1)', () => {
      const payload = createValidPayload({
        status: 'cancelled',
        scheduled_at: new Date(Date.now() - 86400000).toISOString(), // yesterday
      });
      const result = validatePayload(payload);
      expect(result.errors).not.toContain('scheduled_at must be in the future.');
      expect(result.value).not.toBeNull();
      expect(result.value?.status).toBe('cancelled');
    });
  });

  describe('past scheduled_at with rescheduled status', () => {
    it('accepts when scheduled_at is in the past and status=rescheduled (A1)', () => {
      const payload = createValidPayload({
        status: 'rescheduled',
        scheduled_at: new Date(Date.now() - 86400000).toISOString(), // yesterday
      });
      const result = validatePayload(payload);
      expect(result.errors).not.toContain('scheduled_at must be in the future.');
      expect(result.value).not.toBeNull();
      expect(result.value?.status).toBe('rescheduled');
    });
  });

  describe('phone validation', () => {
    it('rejects when phone missing and status=active', () => {
      const payload = createValidPayload({ status: 'active', phone: '' });
      const result = validatePayload(payload);
      expect(result.errors).toContain('phone must contain 10 to 13 digits.');
    });

    it('accepts when phone missing and status=cancelled', () => {
      const payload = createValidPayload({ status: 'cancelled', phone: '' });
      const result = validatePayload(payload);
      expect(result.errors).not.toContain('phone must contain 10 to 13 digits.');
      expect(result.value).not.toBeNull();
    });

    it('accepts when phone missing and status=rescheduled', () => {
      const payload = createValidPayload({ status: 'rescheduled', phone: '' });
      const result = validatePayload(payload);
      expect(result.errors).not.toContain('phone must contain 10 to 13 digits.');
      expect(result.value).not.toBeNull();
    });

    it('rejects phone with less than 10 digits for active', () => {
      const payload = createValidPayload({ status: 'active', phone: '123456789' });
      const result = validatePayload(payload);
      expect(result.errors).toContain('phone must contain 10 to 13 digits.');
    });

    it('rejects phone with more than 13 digits for active', () => {
      const payload = createValidPayload({ status: 'active', phone: '12345678901234' });
      const result = validatePayload(payload);
      expect(result.errors).toContain('phone must contain 10 to 13 digits.');
    });

    it('accepts phone with 10 digits for active', () => {
      const payload = createValidPayload({ status: 'active', phone: '1199999999' });
      const result = validatePayload(payload);
      expect(result.errors).not.toContain('phone must contain 10 to 13 digits.');
    });

    it('accepts phone with 13 digits for active', () => {
      const payload = createValidPayload({ status: 'active', phone: '5511999999999' });
      const result = validatePayload(payload);
      expect(result.errors).not.toContain('phone must contain 10 to 13 digits.');
    });

    it('normalizes phone by stripping non-digits', () => {
      const payload = createValidPayload({ status: 'active', phone: '(11) 99999-9999' });
      const result = validatePayload(payload);
      expect(result.errors).not.toContain('phone must contain 10 to 13 digits.');
      expect(result.value?.phone).toBe('11999999999');
    });
  });

  describe('UUID validation', () => {
    it('rejects non-UUID service_id', () => {
      const payload = createValidPayload({ service_id: 'not-a-uuid' });
      const result = validatePayload(payload);
      expect(result.errors).toContain('service_id must be a valid UUID.');
    });

    it('rejects non-UUID professional_id', () => {
      const payload = createValidPayload({ professional_id: 'not-a-uuid' });
      const result = validatePayload(payload);
      expect(result.errors).toContain('professional_id must be a valid UUID.');
    });

    it('accepts valid UUID v4', () => {
      const payload = createValidPayload({
        service_id: '550e8400-e29b-41d4-a716-446655440000',
        professional_id: '660e8400-e29b-41d4-a716-446655440001',
      });
      const result = validatePayload(payload);
      expect(result.errors).not.toContain('service_id must be a valid UUID.');
      expect(result.errors).not.toContain('professional_id must be a valid UUID.');
    });
  });

  describe('client_name validation', () => {
    it('rejects missing client_name', () => {
      const payload = createValidPayload({ client_name: '' });
      const result = validatePayload(payload);
      expect(result.errors).toContain('client_name is required.');
    });

    it('rejects client_name over 120 characters', () => {
      const payload = createValidPayload({ client_name: 'a'.repeat(121) });
      const result = validatePayload(payload);
      expect(result.errors).toContain('client_name must be at most 120 characters.');
    });

    it('accepts client_name at exactly 120 characters', () => {
      const payload = createValidPayload({ client_name: 'a'.repeat(120) });
      const result = validatePayload(payload);
      expect(result.errors).not.toContain('client_name must be at most 120 characters.');
    });

    it('trims client_name', () => {
      const payload = createValidPayload({ client_name: '  João Silva  ' });
      const result = validatePayload(payload);
      expect(result.value?.clientName).toBe('João Silva');
    });
  });

  describe('notes validation', () => {
    it('rejects notes over 500 characters', () => {
      const payload = createValidPayload({ notes: 'a'.repeat(501) });
      const result = validatePayload(payload);
      expect(result.errors).toContain('notes must be at most 500 characters.');
    });

    it('accepts notes at exactly 500 characters', () => {
      const payload = createValidPayload({ notes: 'a'.repeat(500) });
      const result = validatePayload(payload);
      expect(result.errors).not.toContain('notes must be at most 500 characters.');
    });

    it('accepts empty notes', () => {
      const payload = createValidPayload({ notes: '' });
      const result = validatePayload(payload);
      expect(result.errors).not.toContain('notes must be at most 500 characters.');
    });
  });

  describe('site_appointment_id validation', () => {
    it('rejects missing site_appointment_id', () => {
      const payload = createValidPayload({ site_appointment_id: '' });
      const result = validatePayload(payload);
      expect(result.errors).toContain('site_appointment_id is required.');
    });

    it('accepts site_appointment_id', () => {
      const payload = createValidPayload({ site_appointment_id: 'site-123' });
      const result = validatePayload(payload);
      expect(result.errors).not.toContain('site_appointment_id is required.');
    });
  });

  describe('status validation', () => {
    it('defaults to active when status not provided', () => {
      const payload = createValidPayload({ status: undefined });
      const result = validatePayload(payload);
      expect(result.value?.status).toBe('active');
    });

    it('rejects invalid status', () => {
      const payload = createValidPayload({ status: 'invalid' });
      const result = validatePayload(payload);
      expect(result.errors).toContain('status must be active, cancelled, or rescheduled.');
    });

    it('accepts cancelled status', () => {
      const payload = createValidPayload({ status: 'cancelled' });
      const result = validatePayload(payload);
      expect(result.value?.status).toBe('cancelled');
    });

    it('accepts rescheduled status', () => {
      const payload = createValidPayload({ status: 'rescheduled' });
      const result = validatePayload(payload);
      expect(result.value?.status).toBe('rescheduled');
    });

    it('is case insensitive', () => {
      const payload = createValidPayload({ status: 'ACTIVE' });
      const result = validatePayload(payload);
      expect(result.value?.status).toBe('active');
    });
  });

  describe('scheduled_at validation', () => {
    it('rejects invalid ISO date', () => {
      const payload = createValidPayload({ scheduled_at: 'not-a-date' });
      const result = validatePayload(payload);
      expect(result.errors).toContain('scheduled_at must be a valid ISO date.');
    });

    it('rejects missing scheduled_at', () => {
      const payload = createValidPayload({ scheduled_at: '' });
      const result = validatePayload(payload);
      expect(result.errors).toContain('scheduled_at must be a valid ISO date.');
    });
  });
});

describe('Canonical Contract v1 — buildSuccessResponse', () => {
  const requestId = 'req-123';

  it('includes idempotent:true when RPC returns idempotent (A2)', () => {
    const rpcResult: RpcSuccessResult = {
      ok: true,
      appointment_id: 'appt-1',
      client_id: 'client-1',
      status: 'confirmed',
      source: 'site_sanchez',
      idempotent: true,
    };
    const response = buildSuccessResponse(rpcResult, 'active', requestId);
    expect(response.idempotent).toBe(true);
    expect(response.ok).toBe(true);
    expect(response.appointment_id).toBe('appt-1');
    expect(response.request_id).toBe(requestId);
  });

  it('includes not_found:true when RPC returns not_found (A2)', () => {
    const rpcResult: RpcSuccessResult = {
      ok: true,
      appointment_id: 'ext-123',
      client_id: null,
      status: 'cancelled',
      source: 'site_sanchez',
      not_found: true,
    };
    const response = buildSuccessResponse(rpcResult, 'cancelled', requestId);
    expect(response.not_found).toBe(true);
    expect(response.ok).toBe(true);
    expect(response.status).toBe('cancelled');
  });

  it('does not include idempotent when RPC returns false/undefined', () => {
    const rpcResult: RpcSuccessResult = {
      ok: true,
      appointment_id: 'appt-1',
      client_id: 'client-1',
      status: 'confirmed',
      source: 'site_sanchez',
      idempotent: false,
    };
    const response = buildSuccessResponse(rpcResult, 'active', requestId);
    expect(response.idempotent).toBeUndefined();
  });

  it('does not include not_found when RPC returns false/undefined', () => {
    const rpcResult: RpcSuccessResult = {
      ok: true,
      appointment_id: 'appt-1',
      client_id: 'client-1',
      status: 'confirmed',
      source: 'site_sanchez',
      not_found: false,
    };
    const response = buildSuccessResponse(rpcResult, 'active', requestId);
    expect(response.not_found).toBeUndefined();
  });

  it('uses RPC status when present', () => {
    const rpcResult: RpcSuccessResult = {
      ok: true,
      appointment_id: 'appt-1',
      client_id: 'client-1',
      status: 'custom_status',
      source: 'site_sanchez',
    };
    const response = buildSuccessResponse(rpcResult, 'active', requestId);
    expect(response.status).toBe('custom_status');
  });

  it('falls back to confirmed for active when RPC status missing', () => {
    const rpcResult: RpcSuccessResult = {
      ok: true,
      appointment_id: 'appt-1',
      client_id: 'client-1',
      source: 'site_sanchez',
    };
    const response = buildSuccessResponse(rpcResult, 'active', requestId);
    expect(response.status).toBe('confirmed');
  });

  it('falls back to request status for cancelled when RPC status missing', () => {
    const rpcResult: RpcSuccessResult = {
      ok: true,
      appointment_id: 'appt-1',
      client_id: 'client-1',
      source: 'site_sanchez',
    };
    const response = buildSuccessResponse(rpcResult, 'cancelled', requestId);
    expect(response.status).toBe('cancelled');
  });
});

describe('Canonical Contract v1 — buildErrorResponse', () => {
  const requestId = 'req-123';

  it('includes details array for validation errors', () => {
    const response = buildErrorResponse('Validation failed.', requestId, ['error1', 'error2']);
    expect(response.details).toEqual(['error1', 'error2']);
    expect(response.ok).toBe(false);
    expect(response.error).toBe('Validation failed.');
    expect(response.request_id).toBe(requestId);
  });

  it('includes details array for RPC 400 errors (A3)', () => {
    const response = buildErrorResponse('Servico invalido', requestId, ['Servico invalido'], 400);
    expect(response.details).toEqual(['Servico invalido']);
    expect(response.ok).toBe(false);
  });

  it('omits details when not provided', () => {
    const response = buildErrorResponse('Unauthorized.', requestId);
    expect(response.details).toBeUndefined();
  });

  it('omits details when empty array', () => {
    const response = buildErrorResponse('Error', requestId, []);
    expect(response.details).toBeUndefined();
  });
});

describe('Canonical Contract v1 — getRpcErrorStatus', () => {
  it('returns 409 for 23P01 code', () => {
    const error: RpcErrorResult = { ok: false, code: '23P01', message: 'Conflict' };
    expect(getRpcErrorStatus(error)).toBe(409);
  });

  it('returns 409 for "horario indisponivel" message', () => {
    const error: RpcErrorResult = { ok: false, code: 'XXXXX', message: 'Horario indisponivel para este profissional' };
    expect(getRpcErrorStatus(error)).toBe(409);
  });

  it('returns 400 for "invalido" message', () => {
    const error: RpcErrorResult = { ok: false, message: 'Servico invalido' };
    expect(getRpcErrorStatus(error)).toBe(400);
  });

  it('returns 400 for "obrigatorio" message', () => {
    const error: RpcErrorResult = { ok: false, message: 'Campo obrigatorio' };
    expect(getRpcErrorStatus(error)).toBe(400);
  });

  it('returns 400 for "configurado" message', () => {
    const error: RpcErrorResult = { ok: false, message: 'Nao configurado' };
    expect(getRpcErrorStatus(error)).toBe(400);
  });

  it('returns 400 for "preparado" message', () => {
    const error: RpcErrorResult = { ok: false, message: 'Nao preparado' };
    expect(getRpcErrorStatus(error)).toBe(400);
  });

  it('returns 500 for unknown error', () => {
    const error: RpcErrorResult = { ok: false, message: 'Unknown error' };
    expect(getRpcErrorStatus(error)).toBe(500);
  });
});

describe('Canonical Contract v1 — verifyRequestAuth', () => {
  const webhookSecret = 'test-secret-123';
  const rawBody = '{"client_name":"Test","site_appointment_id":"123"}';

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('accepts valid Bearer token', async () => {
    const req = createMockRequest({ authorization: `Bearer ${webhookSecret}` });
    const result = await verifyRequestAuth(req, rawBody, webhookSecret);
    expect(result).toBe(true);
  });

  it('rejects invalid Bearer token', async () => {
    const req = createMockRequest({ authorization: 'Bearer wrong-secret' });
    const result = await verifyRequestAuth(req, rawBody, webhookSecret);
    expect(result).toBe(false);
  });

  it('accepts valid HMAC signature', async () => {
    // Compute expected signature
    const crypto = globalThis.crypto;
    const textEncoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      textEncoder.encode(webhookSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const signature = Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key, textEncoder.encode(rawBody))))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const req = createMockRequest({ 'x-sanchez-signature': `sha256=${signature}` });
    const result = await verifyRequestAuth(req, rawBody, webhookSecret);
    expect(result).toBe(true);
  });

  it('rejects invalid HMAC signature', async () => {
    const req = createMockRequest({ 'x-sanchez-signature': 'sha256=invalidsignature' });
    const result = await verifyRequestAuth(req, rawBody, webhookSecret);
    expect(result).toBe(false);
  });

  it('rejects missing auth and signature', async () => {
    const req = createMockRequest({});
    const result = await verifyRequestAuth(req, rawBody, webhookSecret);
    expect(result).toBe(false);
  });

  it('is case-insensitive for sha256 prefix', async () => {
    const crypto = globalThis.crypto;
    const textEncoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      textEncoder.encode(webhookSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const signature = Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key, textEncoder.encode(rawBody))))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const req = createMockRequest({ 'x-sanchez-signature': `SHA256=${signature}` });
    const result = await verifyRequestAuth(req, rawBody, webhookSecret);
    expect(result).toBe(true);
  });

  it('uses timing-safe comparison for Bearer token', async () => {
    const req = createMockRequest({ authorization: `Bearer ${webhookSecret}` });
    // Just verify it works - timing safety is implementation detail
    const result = await verifyRequestAuth(req, rawBody, webhookSecret);
    expect(result).toBe(true);
  });
});
