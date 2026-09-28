import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  verifyRequestAuth,
  validatePayload,
  buildSuccessResponse,
  buildErrorResponse,
  getRpcErrorStatus,
  type AppointmentPayload,
  type RpcSuccessResult,
  type RpcErrorResult,
} from './contract.ts';

const ALLOWED_DOMAIN_SCHEMAS = new Set(['public', 'barber']);

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

const jsonResponse = (req: Request, body: Record<string, unknown>, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...buildCorsHeaders(req),
      'Content-Type': 'application/json',
    },
  });

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID();

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: buildCorsHeaders(req) });
  }

  if (req.method !== 'POST') {
    return jsonResponse(req, { ok: false, error: 'Method not allowed.', request_id: requestId }, 405);
  }

  const allowedOrigin = Deno.env.get('SANCHEZ_ALLOWED_ORIGIN')?.trim() || '';
  if (allowedOrigin) {
    const origin = req.headers.get('origin');
    if (origin && origin !== allowedOrigin) {
      console.error('site-sanchez-appointments forbidden origin', {
        request_id: requestId,
        origin,
      });
      return jsonResponse(req, { ok: false, error: 'Origin not allowed.', request_id: requestId }, 403);
    }
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
    p_client_name: validation.value!.clientName,
    p_phone: validation.value!.phone,
    p_service_id: validation.value!.serviceId,
    p_professional_id: validation.value!.professionalId,
    p_scheduled_at: validation.value!.scheduledAt,
    p_notes: validation.value!.notes || null,
    p_domain_schema: domainSchema,
    p_status: validation.value!.status,
    p_site_appointment_id: validation.value!.siteAppointmentId,
    p_external_id: validation.value!.externalId || null,
  });

  if (error) {
    const rpcError: RpcErrorResult = {
      ok: false,
      message: error.message,
      code: error.code,
      details: error.details,
    };
    const status = getRpcErrorStatus(rpcError);

    console.error('site-sanchez-appointments rpc error', {
      request_id: requestId,
      status,
      code: error.code,
      message: error.message,
      tenant_id: tenantId,
      service_id: validation.value!.serviceId,
      professional_id: validation.value!.professionalId,
      status: validation.value!.status,
      site_appointment_id: validation.value!.siteAppointmentId,
    });

    // A3: RPC-derived 400 errors include details: [message] for envelope consistency
    const details = status === 400 && error.message ? [error.message] : undefined;
    return jsonResponse(req, buildErrorResponse(error.message || 'Failed to create appointment.', requestId, details, status), status);
  }

  const rpcResult = (data || {}) as RpcSuccessResult;

  const successResponse = buildSuccessResponse(rpcResult, validation.value!.status, requestId);
  return jsonResponse(req, successResponse, validation.value!.status === 'active' ? 201 : 200);
});
