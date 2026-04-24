import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

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

type JsonBody = Record<string, unknown>;

type AppointmentResult = {
  appointment_id?: string;
  client_id?: string;
  status?: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_NAME_LENGTH = 120;
const MAX_NOTES_LENGTH = 500;
const ALLOWED_DOMAIN_SCHEMAS = new Set(['public', 'barber']);

const textEncoder = new TextEncoder();

const buildCorsHeaders = (req: Request) => {
  const allowedOrigin = Deno.env.get('SANCHEZ_ALLOWED_ORIGIN')?.trim() || '';
  const origin = req.headers.get('origin') || '';
  const allowOrigin = allowedOrigin
    ? origin === allowedOrigin
      ? allowedOrigin
      : 'null'
    : '*';

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sanchez-signature',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
};

const jsonResponse = (req: Request, body: JsonBody, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...buildCorsHeaders(req),
      'Content-Type': 'application/json',
    },
  });

const normalizePhone = (phone: string) => phone.replace(/\D/g, '');

const timingSafeEqual = (left: string, right: string) => {
  const leftBytes = textEncoder.encode(left);
  const rightBytes = textEncoder.encode(right);
  if (leftBytes.length !== rightBytes.length) return false;

  let diff = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    diff |= leftBytes[index] ^ rightBytes[index];
  }

  return diff === 0;
};

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

const hmacSha256 = async (secret: string, value: string) => {
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  return toHex(await crypto.subtle.sign('HMAC', key, textEncoder.encode(value)));
};

const verifyRequestAuth = async (req: Request, rawBody: string, webhookSecret: string) => {
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

const validateOrigin = (req: Request) => {
  const allowedOrigin = Deno.env.get('SANCHEZ_ALLOWED_ORIGIN')?.trim() || '';
  if (!allowedOrigin) return true;

  const origin = req.headers.get('origin');
  if (!origin) return true;

  return origin === allowedOrigin;
};

const validatePayload = (payload: AppointmentPayload) => {
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
  } else if (scheduledAt.getTime() <= Date.now()) {
    errors.push('scheduled_at must be in the future.');
  }

  const notes = typeof payload.notes === 'string' ? payload.notes.trim() : '';
  if (notes.length > MAX_NOTES_LENGTH) errors.push(`notes must be at most ${MAX_NOTES_LENGTH} characters.`);

  const siteAppointmentId =
    typeof payload.site_appointment_id === 'string' ? payload.site_appointment_id.trim() : '';
  if (!siteAppointmentId) errors.push('site_appointment_id is required.');

  const externalId = typeof payload.external_id === 'string' ? payload.external_id.trim() : '';

  return {
    errors,
    value: {
      clientName,
      phone,
      serviceId,
      professionalId,
      scheduledAt: scheduledAt?.toISOString() || '',
      status,
      siteAppointmentId,
      externalId,
      notes,
    },
  };
};

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID();

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: buildCorsHeaders(req) });
  }

  if (req.method !== 'POST') {
    return jsonResponse(req, { ok: false, error: 'Method not allowed.', request_id: requestId }, 405);
  }

  if (!validateOrigin(req)) {
    console.error('site-sanchez-appointments forbidden origin', {
      request_id: requestId,
      origin: req.headers.get('origin'),
    });
    return jsonResponse(req, { ok: false, error: 'Origin not allowed.', request_id: requestId }, 403);
  }

  const tenantId = Deno.env.get('SANCHEZ_TENANT_ID')?.trim() || '';
  const webhookSecret = Deno.env.get('SANCHEZ_WEBHOOK_SECRET')?.trim() || '';
  const domainSchema = Deno.env.get('SANCHEZ_DOMAIN_SCHEMA')?.trim() || 'public';
  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim() || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() || '';

  if (!tenantId || !webhookSecret || !supabaseUrl || !serviceRoleKey) {
    console.error('site-sanchez-appointments missing configuration', {
      request_id: requestId,
      hasTenantId: Boolean(tenantId),
      hasWebhookSecret: Boolean(webhookSecret),
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasServiceRoleKey: Boolean(serviceRoleKey),
    });
    return jsonResponse(req, { ok: false, error: 'Integration is not configured.', request_id: requestId }, 500);
  }

  if (!ALLOWED_DOMAIN_SCHEMAS.has(domainSchema)) {
    console.error('site-sanchez-appointments invalid domain schema', {
      request_id: requestId,
      domainSchema,
    });
    return jsonResponse(req, { ok: false, error: 'Integration schema is invalid.', request_id: requestId }, 500);
  }

  let rawBody = '';
  try {
    rawBody = await req.text();
  } catch (error) {
    console.error('site-sanchez-appointments body read failed', { request_id: requestId, error });
    return jsonResponse(req, { ok: false, error: 'Invalid request body.', request_id: requestId }, 400);
  }

  if (!(await verifyRequestAuth(req, rawBody, webhookSecret))) {
    console.error('site-sanchez-appointments unauthorized request', { request_id: requestId });
    return jsonResponse(req, { ok: false, error: 'Unauthorized.', request_id: requestId }, 401);
  }

  let payload: AppointmentPayload;
  try {
    payload = JSON.parse(rawBody) as AppointmentPayload;
  } catch {
    return jsonResponse(req, { ok: false, error: 'Body must be valid JSON.', request_id: requestId }, 400);
  }

  const validation = validatePayload(payload);
  if (validation.errors.length > 0) {
    return jsonResponse(
      req,
      { ok: false, error: 'Validation failed.', details: validation.errors, request_id: requestId },
      400,
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.rpc('create_site_sanchez_appointment', {
    p_tenant_id: tenantId,
    p_client_name: validation.value.clientName,
    p_phone: validation.value.phone,
    p_service_id: validation.value.serviceId,
    p_professional_id: validation.value.professionalId,
    p_scheduled_at: validation.value.scheduledAt,
    p_notes: validation.value.notes || null,
    p_domain_schema: domainSchema,
    p_status: validation.value.status,
    p_site_appointment_id: validation.value.siteAppointmentId,
    p_external_id: validation.value.externalId || null,
  });

  if (error) {
    const message = error.message || 'Failed to create appointment.';
    const isConflict = error.code === '23P01' || /horario indisponivel/i.test(message);
    const status = isConflict ? 409 : /invalido|obrigatorio|configurado|preparado/i.test(message) ? 400 : 500;

    console.error('site-sanchez-appointments rpc error', {
      request_id: requestId,
      status,
      code: error.code,
      message,
      tenant_id: tenantId,
      service_id: validation.value.serviceId,
      professional_id: validation.value.professionalId,
      status: validation.value.status,
      site_appointment_id: validation.value.siteAppointmentId,
    });

    return jsonResponse(req, { ok: false, error: message, request_id: requestId }, status);
  }

  const result = (data || {}) as AppointmentResult;

  return jsonResponse(
    req,
    {
      ok: true,
      appointment_id: result.appointment_id,
      client_id: result.client_id,
      status: result.status || 'confirmed',
      request_id: requestId,
    },
    validation.value.status === 'active' ? 201 : 200,
  );
});
