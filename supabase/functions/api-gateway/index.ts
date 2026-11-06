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
import {
  handleComandasRoute,
  type ComandasDbClient,
} from './routes/comandas.ts';
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

  // 7. Rota Autenticada: Comandas (/v1/comandas)
  if (pathname === '/v1/comandas') {
    const dbClient: ComandasDbClient = {
      async getComandas({ tenantId, status, startDate, endDate, limit = 50 }) {
        let query = adminClient
          .from('comandas')
          .select('id, tenant_id, client_id, staff_id, status, total, created_at')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (status === 'open') {
          query = query.eq('status', 'open');
        } else if (status === 'closed') {
          query = query.in('status', ['paid', 'closed']);
        }

        if (startDate) {
          query = query.gte('created_at', startDate);
        }
        if (endDate) {
          query = query.lte('created_at', endDate);
        }

        const { data, error } = await query;
        if (error) {
          console.error(`[API-GATEWAY] [${requestId}] Error fetching comandas:`, error);
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

      async getClientById(tenantId, clientId) {
        const { data, error } = await adminClient
          .from('clients')
          .select('id, name, phone')
          .eq('tenant_id', tenantId)
          .eq('id', clientId)
          .maybeSingle();

        if (error) {
          console.error(`[API-GATEWAY] [${requestId}] Error fetching client:`, error);
          throw error;
        }
        return data || null;
      },

      async findOrCreateClient({ tenantId, name, phone }) {
        const { data: existing, error: findError } = await adminClient
          .from('clients')
          .select('id, name, phone')
          .eq('tenant_id', tenantId)
          .eq('phone', phone)
          .maybeSingle();

        if (findError) {
          console.error(`[API-GATEWAY] [${requestId}] Error finding client by phone:`, findError);
          throw findError;
        }

        if (existing) {
          return existing;
        }

        const { data: created, error: createError } = await adminClient
          .from('clients')
          .insert({
            tenant_id: tenantId,
            name,
            phone,
            status: 'active',
          })
          .select('id, name, phone')
          .single();

        if (createError) {
          console.error(`[API-GATEWAY] [${requestId}] Error creating client:`, createError);
          throw createError;
        }

        return created;
      },

      async getServicesByIds(tenantId, serviceIds) {
        const { data, error } = await adminClient
          .from('services')
          .select('id, name, price')
          .eq('tenant_id', tenantId)
          .in('id', serviceIds);

        if (error) {
          console.error(`[API-GATEWAY] [${requestId}] Error fetching services by ids:`, error);
          throw error;
        }
        return data || [];
      },

      async getProductsByIds(tenantId, productIds) {
        const { data, error } = await adminClient
          .from('products')
          .select('id, name, sale_price')
          .eq('tenant_id', tenantId)
          .in('id', productIds);

        if (error) {
          console.error(`[API-GATEWAY] [${requestId}] Error fetching products by ids:`, error);
          throw error;
        }
        return (data || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          sale_price: p.sale_price ?? 0,
        }));
      },

      async createComandaWithItems({
        tenantId,
        clientId,
        clientName,
        barberId,
        barberName,
        totalAmount,
        notes: _notes,
        items,
      }) {
        const { data: comanda, error: comandaError } = await adminClient
          .from('comandas')
          .insert({
            tenant_id: tenantId,
            client_id: clientId,
            staff_id: barberId,
            status: 'open',
            total: totalAmount,
          })
          .select('id, tenant_id, client_id, staff_id, status, total, created_at')
          .single();

        if (comandaError) {
          console.error(`[API-GATEWAY] [${requestId}] Error inserting comanda:`, comandaError);
          throw comandaError;
        }

        const itemsToInsert = items.map((it) => ({
          tenant_id: tenantId,
          comanda_id: comanda.id,
          service_id: it.type === 'service' ? it.itemId : null,
          product_name: it.name,
          quantity: it.quantity,
          unit_price: it.unitPrice,
          staff_id: barberId,
        }));

        const { data: insertedItems, error: itemsError } = await adminClient
          .from('comanda_items')
          .insert(itemsToInsert)
          .select('id, service_id, product_name, quantity, unit_price');

        if (itemsError) {
          console.error(`[API-GATEWAY] [${requestId}] Error inserting comanda items:`, itemsError);
          throw itemsError;
        }

        const returnedItems = (insertedItems || []).map((dbItem: any, idx: number) => ({
          id: dbItem.id,
          type: items[idx]?.type || 'service',
          item_id: items[idx]?.itemId || '',
          name: items[idx]?.name || '',
          quantity: dbItem.quantity,
          unit_price: dbItem.unit_price,
          total_price: items[idx]?.totalPrice || 0,
        }));

        return {
          id: comanda.id,
          tenant_id: comanda.tenant_id,
          client_id: comanda.client_id,
          client_name: clientName,
          staff_id: comanda.staff_id,
          staff_name: barberName,
          status: comanda.status,
          total: comanda.total,
          created_at: comanda.created_at,
          items_count: returnedItems.length,
          items: returnedItems,
        };
      },
    };

    return handleComandasRoute(req, authResult.auth, dbClient, requestId);
  }

  // 8. Rota não encontrada
  const notFoundBody: ApiErrorResponse = {
    error: {
      code: 'NOT_FOUND',
      message: `Rota '${pathname}' não implementada no gateway.`,
      request_id: requestId,
    },
  };
  return jsonResponse(req, notFoundBody as unknown as Record<string, unknown>, 404, requestId);
});
