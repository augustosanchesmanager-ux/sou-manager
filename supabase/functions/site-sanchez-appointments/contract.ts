/**
 * Canonical Contract v1 — Pure Logic Module
 *
 * This module contains all validation, response building, and auth verification logic
 * for the site-sanchez-appointments Edge Function. It contains NO Deno-specific APIs
 * and can be imported by both the Edge Function (index.ts) and vitest tests.
 *
 * Crypto uses globalThis.crypto which exists in both Deno and Node ≥18.
 */

type AppointmentPayload = {
  client_name?: unknown;
  phone?: unknown;
  service_id?: unknown;
  professional_id?: unknown;
  scheduled_at?: unknown;
  status?: unknown;
  site_appointment_id?: unknown;
  external_id?: unknown;
  notes?: unknown;
};

type ValidatedPayload = {
  clientName: string;
  phone: string;
  serviceId: string;
  professionalId: string;
  scheduledAt: string;
  status: 'active' | 'cancelled' | 'rescheduled';
  siteAppointmentId: string;
  externalId: string;
  notes: string;
};

type ValidationResult = {
  errors: string[];
  value: ValidatedPayload | null;
};

type RpcSuccessResult = {
  ok: true;
  appointment_id?: string;
  client_id?: string;
  status?: string;
  source?: string;
  start_time?: string;
  end_time?: string;
  idempotent?: boolean;
  not_found?: boolean;
};

type RpcErrorResult = {
  ok: false;
  message?: string;
  code?: string;
  details?: string;
};

type RpcResult = RpcSuccessResult | RpcErrorResult;

type SuccessResponse = {
  ok: true;
  appointment_id?: string;
  client_id?: string;
  status: string;
  request_id: string;
  idempotent?: boolean;
  not_found?: boolean;
};

type ErrorResponse = {
  ok: false;
  error: string;
  details?: string[];
  request_id: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_NAME_LENGTH = 120;
const MAX_NOTES_LENGTH = 500;

const textEncoder = new TextEncoder();

const normalizePhone = (phone: string): string => phone.replace(/\D/g, '');

const timingSafeEqual = (left: string, right: string): boolean => {
  const leftBytes = textEncoder.encode(left);
  const rightBytes = textEncoder.encode(right);
  if (leftBytes.length !== rightBytes.length) return false;

  let diff = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    diff |= leftBytes[index] ^ rightBytes[index];
  }

  return diff === 0;
};

const toHex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

const hmacSha256 = async (secret: string, value: string): Promise<string> => {
  const crypto = globalThis.crypto;
  if (!crypto || !crypto.subtle) {
    throw new Error('Web Crypto API not available');
  }
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  return toHex(await crypto.subtle.sign('HMAC', key, textEncoder.encode(value)));
};

/**
 * Verifies request authentication via Bearer token or HMAC signature.
 * Uses timing-safe comparison for both methods.
 */
export const verifyRequestAuth = async (
  req: Request,
  rawBody: string,
  webhookSecret: string
): Promise<boolean> => {
  const authHeader = req.headers.get('authorization') || '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim();
    if (timingSafeEqual(token, webhookSecret)) return true;
  }

  const signatureHeader = req.headers.get('x-sanchez-signature') || '';
  const providedSignature = signatureHeader.replace(/^sha256=/i, '').trim().toLowerCase();
  if (!providedSignature) return false;

  const expectedSignature = await hmacSha256(webhookSecret, rawBody);
  return timingSafeEqual(providedSignature, expectedSignature);
};

/**
 * Validates the appointment payload per Canonical Contract v1.
 *
 * A1 Amendment: scheduled_at future-check is ONLY enforced when status === 'active'.
 * Required fields (client_name, service_id, professional_id, scheduled_at, site_appointment_id)
 * are validated for ALL statuses (RPC SQL lines 129-143 will raise otherwise).
 */
export const validatePayload = (payload: AppointmentPayload): ValidationResult => {
  const errors: string[] = [];
  const status = typeof payload.status === 'string' ? payload.status.trim().toLowerCase() : 'active';

  if (!['active', 'cancelled', 'rescheduled'].includes(status)) {
    errors.push('status must be active, cancelled, or rescheduled.');
  }

  const clientName = typeof payload.client_name === 'string' ? payload.client_name.trim() : '';
  if (!clientName) errors.push('client_name is required.');
  if (clientName.length > MAX_NAME_LENGTH) errors.push(`client_name must be at most ${MAX_NAME_LENGTH} characters.`);

  const rawPhone = typeof payload.phone === 'string' || typeof payload.phone === 'number' ? String(payload.phone) : '';
  const phone = normalizePhone(rawPhone);
  // Phone required ONLY for active status (RPC SQL:145)
  if (status === 'active' && (phone.length < 10 || phone.length > 13)) {
    errors.push('phone must contain 10 to 13 digits.');
  }

  const serviceId = typeof payload.service_id === 'string' ? payload.service_id.trim() : '';
  if (!UUID_RE.test(serviceId)) errors.push('service_id must be a valid UUID.');

  const professionalId = typeof payload.professional_id === 'string' ? payload.professional_id.trim() : '';
  if (!UUID_RE.test(professionalId)) errors.push('professional_id must be a valid UUID.');

  const scheduledAtText = typeof payload.scheduled_at === 'string' ? payload.scheduled_at.trim() : '';
  const scheduledAt = scheduledAtText ? new Date(scheduledAtText) : null;
  if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) {
    errors.push('scheduled_at must be a valid ISO date.');
  } else if (status === 'active' && scheduledAt.getTime() <= Date.now()) {
    // A1: future-check scoped to active only
    errors.push('scheduled_at must be in the future.');
  }

  const notes = typeof payload.notes === 'string' ? payload.notes.trim() : '';
  if (notes.length > MAX_NOTES_LENGTH) errors.push(`notes must be at most ${MAX_NOTES_LENGTH} characters.`);

  const siteAppointmentId = typeof payload.site_appointment_id === 'string' ? payload.site_appointment_id.trim() : '';
  if (!siteAppointmentId) errors.push('site_appointment_id is required.');

  const externalId = typeof payload.external_id === 'string' ? payload.external_id.trim() : '';

  return {
    errors,
    value: errors.length === 0
      ? {
          clientName,
          phone,
          serviceId,
          professionalId,
          scheduledAt: scheduledAt?.toISOString() || '',
          status: status as 'active' | 'cancelled' | 'rescheduled',
          siteAppointmentId,
          externalId,
          notes,
        }
      : null,
  };
};

/**
 * Builds the success response envelope per Canonical Contract v1.
 *
 * A2 Amendment: forwards RPC's `idempotent` and `not_found` fields when present.
 * Status code: 201 for active, 200 for cancelled/rescheduled (handled by caller).
 */
export const buildSuccessResponse = (
  rpcResult: RpcSuccessResult,
  requestStatus: 'active' | 'cancelled' | 'rescheduled',
  requestId: string
): SuccessResponse => {
  const response: SuccessResponse = {
    ok: true,
    appointment_id: rpcResult.appointment_id,
    client_id: rpcResult.client_id,
    status: rpcResult.status || (requestStatus === 'active' ? 'confirmed' : requestStatus),
    request_id: requestId,
  };

  // A2: forward idempotent and not_found from RPC
  if (rpcResult.idempotent === true) {
    response.idempotent = true;
  }
  if (rpcResult.not_found === true) {
    response.not_found = true;
  }

  return response;
};

/**
 * Builds the error response envelope per Canonical Contract v1.
 *
 * A3 Amendment: RPC-derived 400 errors include details: [message] for envelope consistency.
 * Validation 400 errors keep details[] as before.
 */
export const buildErrorResponse = (
  error: string,
  requestId: string,
  details?: string[],
  statusCode: number = 400
): ErrorResponse => {
  const response: ErrorResponse = {
    ok: false,
    error,
    request_id: requestId,
  };

  if (details && details.length > 0) {
    response.details = details;
  }

  return response;
};

/**
 * Determines HTTP status code from RPC error per contract spec.
 * 409 for conflict (23P01 / horario indisponivel), 400 for validation, 500 otherwise.
 */
export const getRpcErrorStatus = (error: RpcErrorResult): number => {
  const message = error.message || 'Failed to create appointment.';
  const isConflict = error.code === '23P01' || /horario indisponivel/i.test(message);
  if (isConflict) return 409;
  return /invalido|obrigatorio|configurado|preparado/i.test(message) ? 400 : 500;
};

export type {
  AppointmentPayload,
  ValidatedPayload,
  ValidationResult,
  RpcSuccessResult,
  RpcErrorResult,
  RpcResult,
  SuccessResponse,
  ErrorResponse,
};
