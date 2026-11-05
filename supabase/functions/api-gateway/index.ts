import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  authenticateApiKey,
  maskApiKey,
  extractBearerToken,
} from './auth.ts';
import {
  handleAppointmentsRoute,
  type AppointmentsDbClient,
} from './routes/appointments.ts';
import type {
  ApiKeyRecord,
  ApiErrorResponse,
  ApiSuccessResponse,
} from './types.ts';

const buildCorsHeaders = (req: Request) => {
  const origin = req.headers.get('origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-request-id',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Vary': 'Origin',
  };
};

const jsonResponse = (
  req: Request,
  body: Record<string, unknown>,
  status: number,
  requestId: string
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...buildCorsHeaders(req),
      'Content-Type': 'application/json',
      'X-Request-Id': requestId,
    },
  });

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID();

  // 1. Tratamento de Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: buildCorsHeaders(req),
    });
  }

  const url = new URL(req.url);
  const pathname = url.pathname.replace(/^\/api-gateway/, '');

  // 2. Rota Pública: Healthcheck
  if (pathname === '/v1/health' || pathname === '/health') {
    return jsonResponse(
      req,
      {
        status: 'healthy',
        service: 'smg-public-api-gateway',
        version: 'v1.8.0',
        timestamp: new Date().toISOString(),
      },
      200,
      requestId
    );
  }

  // 3. Inicializar cliente Supabase para validação de credencial no gateway
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!supabaseUrl || !supabaseServiceKey) {
    const errorBody: ApiErrorResponse = {
      error: {
        code: 'INTERNAL_AUTH_ERROR',
        message: 'Configuração de backend indisponível no gateway.',
        request_id: requestId,
      },
    };
    return jsonResponse(req, errorBody as unknown as Record<string, unknown>, 500, requestId);
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  // Função para buscar a chave por hash
  const findRecordByHash = async (hash: string): Promise<ApiKeyRecord | null> => {
    const { data, error } = await adminClient
      .from('api_keys')
      .select('id, tenant_id, name, key_prefix, key_hash, scopes, revoked_at, expires_at, last_used_at, created_at, created_by')
      .eq('key_hash', hash)
      .maybeSingle();

    if (error) {
      console.error(`[API-GATEWAY] [${requestId}] DB lookup error:`, error.message);
      throw error;
    }

    return (data as ApiKeyRecord) ?? null;
  };

  // 4. Autenticação por API Key
  const authHeader = req.headers.get('Authorization');
  const authResult = await authenticateApiKey(authHeader, findRecordByHash);

  if (!authResult.ok) {
    const rawToken = extractBearerToken(authHeader);
    console.warn(
      `[API-GATEWAY] [${requestId}] Auth failed (${authResult.error}) for key prefix: ${maskApiKey(rawToken ?? '')}`
    );

    const errorBody: ApiErrorResponse = {
      error: {
        code: authResult.error,
        message: authResult.message,
        request_id: requestId,
      },
    };
    return jsonResponse(req, errorBody as unknown as Record<string, unknown>, authResult.status, requestId);
  }

  // Atualizar last_used_at assincronamente (best effort)
  EdgeRuntime.waitUntil?.(
    adminClient
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', authResult.auth.apiKeyId)
      .then(() => {})
      .catch((err) => console.error(`[API-GATEWAY] Error updating last_used_at:`, err))
  );

  // 5. Rota Autenticada: Verificação de Credenciais e Contexto
  if (pathname === '/v1/auth/verify') {
    const successBody: ApiSuccessResponse = {
      data: {
        valid: true,
        tenant_id: authResult.auth.tenantId,
        key_name: authResult.auth.name,
        key_prefix: authResult.auth.keyPrefix,
        environment: authResult.auth.environment,
        scopes: authResult.auth.scopes,
      },
      meta: {
        request_id: requestId,
        timestamp: new Date().toISOString(),
      },
    };
    return jsonResponse(req, successBody as unknown as Record<string, unknown>, 200, requestId);
  }

  // 6. Rota Autenticada: Agendamentos (/v1/appointments)
  if (pathname === '/v1/appointments') {
    const dbClient: AppointmentsDbClient = {
      async getAppointments({ tenantId, startDate, endDate, barberId }) {
        let query = adminClient
          .from('appointments')
          .select('id, tenant_id, client_name, client_phone, service_id, service_name, staff_id, staff_name, start_time, end_time, duration, price, status, source, created_at')
          .eq('tenant_id', tenantId)
          .order('start_time', { ascending: true });

        if (startDate) {
          query = query.gte('start_time', startDate);
        }
        if (endDate) {
          query = query.lte('start_time', endDate);
        }
        if (barberId) {
          query = query.eq('staff_id', barberId);
        }

        const { data, error } = await query;
        if (error) {
          console.error(`[API-GATEWAY] [${requestId}] Error fetching appointments:`, error);
          throw error;
        }
        return data || [];
      },

      async getBarber(tenantId, barberId) {
        const { data, error } = await adminClient
          .from('staff')
          .select('id, name')
          .eq('tenant_id', tenantId)
          .eq('id', barberId)
          .maybeSingle();

        if (error) {
          console.error(`[API-GATEWAY] [${requestId}] Error fetching barber:`, error);
          throw error;
        }
        return data || null;
      },

      async getService(tenantId, serviceId) {
        const { data, error } = await adminClient
          .from('services')
          .select('id, name, price, duration_minutes')
          .eq('tenant_id', tenantId)
          .eq('id', serviceId)
          .maybeSingle();

        if (error) {
          console.error(`[API-GATEWAY] [${requestId}] Error fetching service:`, error);
          throw error;
        }
        return data || null;
      },

      async checkSlotOverlap({ tenantId, barberId, startTime, endTime }) {
        const { data, error } = await adminClient
          .from('appointments')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('staff_id', barberId)
          .not('status', 'in', '("cancelled","no_show")')
          .lt('start_time', endTime)
          .gt('end_time', startTime)
          .limit(1);

        if (error) {
          console.error(`[API-GATEWAY] [${requestId}] Error checking slot overlap:`, error);
          throw error;
        }
        return Array.isArray(data) && data.length > 0;
      },

      async createAppointment(appointment) {
        const { data, error } = await adminClient
          .from('appointments')
          .insert(appointment)
          .select('id, tenant_id, client_name, client_phone, service_id, service_name, staff_id, staff_name, start_time, end_time, duration, price, status, source, created_at')
          .single();

        if (error) {
          console.error(`[API-GATEWAY] [${requestId}] Error inserting appointment:`, error);
          throw error;
        }
        return data;
      },
    };

    return handleAppointmentsRoute(req, authResult.auth, dbClient, requestId);
  }

  // 7. Rota não encontrada
  const notFoundBody: ApiErrorResponse = {
    error: {
      code: 'NOT_FOUND',
      message: `Rota '${pathname}' não implementada no gateway.`,
      request_id: requestId,
    },
  };
  return jsonResponse(req, notFoundBody as unknown as Record<string, unknown>, 404, requestId);
});
