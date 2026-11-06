/**
 * [SMG][API-GATEWAY] routes/comandas — Handler REST de comandas (/v1/comandas)
 *
 * Em conformidade com ADR-032 e requisitos de isolamento multi-tenant da Fase 8.
 * Invariante Contábil: Total calculado estritamente a partir do catálogo do tenant com resíduo zero.
 */

import { hasRequiredScope } from '../auth.ts';
import type { AuthContext, ApiErrorResponse } from '../types.ts';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ComandaItemInput {
  service_id?: string;
  product_id?: string;
  quantity?: number;
}

export interface CreateComandaPayload {
  barber_id?: unknown;
  customer_id?: unknown;
  customer_name?: unknown;
  customer_phone?: unknown;
  services?: unknown;
  products?: unknown;
  notes?: unknown;
}

export interface ComandaItemRecord {
  id: string;
  type: 'service' | 'product';
  item_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface ComandaRecord {
  id: string;
  tenant_id: string;
  client_id: string;
  client_name?: string;
  staff_id: string;
  staff_name?: string;
  status: string;
  total: number;
  created_at: string;
  items_count?: number;
}

export interface ComandaWithItemsRecord extends ComandaRecord {
  items: ComandaItemRecord[];
}

export interface ComandasDbClient {
  getComandas(params: {
    tenantId: string;
    status?: 'open' | 'closed' | 'all';
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<ComandaRecord[]>;

  getBarber(tenantId: string, barberId: string): Promise<{ id: string; name: string } | null>;

  getClientById(
    tenantId: string,
    clientId: string
  ): Promise<{ id: string; name: string; phone?: string } | null>;

  findOrCreateClient(params: {
    tenantId: string;
    name: string;
    phone: string;
  }): Promise<{ id: string; name: string; phone?: string }>;

  getServicesByIds(
    tenantId: string,
    serviceIds: string[]
  ): Promise<Array<{ id: string; name: string; price: number }>>;

  getProductsByIds(
    tenantId: string,
    productIds: string[]
  ): Promise<Array<{ id: string; name: string; sale_price: number }>>;

  createComandaWithItems(params: {
    tenantId: string;
    clientId: string;
    clientName: string;
    barberId: string;
    barberName: string;
    totalAmount: number;
    notes?: string;
    items: Array<{
      type: 'service' | 'product';
      itemId: string;
      name: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }>;
  }): Promise<ComandaWithItemsRecord>;
}

function buildJsonResponse(body: unknown, status: number, requestId: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'X-Request-Id': requestId,
    },
  });
}

function buildErrorResponse(
  code: string,
  message: string,
  status: number,
  requestId: string
): Response {
  const errorPayload: ApiErrorResponse = {
    error: {
      code,
      message,
      request_id: requestId,
    },
  };
  return buildJsonResponse(errorPayload, status, requestId);
}

/**
 * Validador do payload de criação de comanda
 */
export function validateCreateComandaPayload(raw: unknown): {
  valid: boolean;
  error?: { code: string; message: string; status: number };
  data?: {
    barber_id: string;
    customer_id?: string;
    customer_name?: string;
    customer_phone?: string;
    services: Array<{ service_id: string; quantity: number }>;
    products: Array<{ product_id: string; quantity: number }>;
    notes?: string;
  };
} {
  if (!raw || typeof raw !== 'object') {
    return {
      valid: false,
      error: {
        code: 'INVALID_REQUEST_PAYLOAD',
        message: 'Payload da requisição deve ser um objeto JSON válido.',
        status: 400,
      },
    };
  }

  const p = raw as CreateComandaPayload;

  // 1. barber_id
  if (!p.barber_id || typeof p.barber_id !== 'string' || !UUID_REGEX.test(p.barber_id.trim())) {
    return {
      valid: false,
      error: {
        code: 'INVALID_REQUEST_PAYLOAD',
        message: 'Campo obrigatório "barber_id" ausente ou com formato UUID inválido.',
        status: 400,
      },
    };
  }

  // 2. Cliente (customer_id OU customer_name + customer_phone)
  let customerId: string | undefined;
  let customerName: string | undefined;
  let customerPhone: string | undefined;

  if (p.customer_id) {
    if (typeof p.customer_id !== 'string' || !UUID_REGEX.test(p.customer_id.trim())) {
      return {
        valid: false,
        error: {
          code: 'INVALID_REQUEST_PAYLOAD',
          message: 'Campo "customer_id" com formato UUID inválido.',
          status: 400,
        },
      };
    }
    customerId = p.customer_id.trim();
  } else if (p.customer_name && p.customer_phone) {
    if (typeof p.customer_name !== 'string' || p.customer_name.trim().length < 2) {
      return {
        valid: false,
        error: {
          code: 'INVALID_REQUEST_PAYLOAD',
          message: 'Campo "customer_name" deve conter pelo menos 2 caracteres.',
          status: 400,
        },
      };
    }
    if (typeof p.customer_phone !== 'string' || p.customer_phone.trim().length < 8) {
      return {
        valid: false,
        error: {
          code: 'INVALID_REQUEST_PAYLOAD',
          message: 'Campo "customer_phone" inválido.',
          status: 400,
        },
      };
    }
    customerName = p.customer_name.trim();
    customerPhone = p.customer_phone.trim();
  } else {
    return {
      valid: false,
      error: {
        code: 'INVALID_REQUEST_PAYLOAD',
        message:
          'Identificação do cliente é obrigatória: informe "customer_id" ou ("customer_name" e "customer_phone").',
        status: 400,
      },
    };
  }

  // 3. Validação dos itens (services e products)
  const normalizedServices: Array<{ service_id: string; quantity: number }> = [];
  if (Array.isArray(p.services)) {
    for (const s of p.services) {
      if (!s || typeof s !== 'object' || !s.service_id || !UUID_REGEX.test(String(s.service_id).trim())) {
        return {
          valid: false,
          error: {
            code: 'INVALID_REQUEST_PAYLOAD',
            message: 'Item de serviço inválido: "service_id" deve ser um UUID válido.',
            status: 400,
          },
        };
      }
      const qty = typeof s.quantity === 'number' && Number.isInteger(s.quantity) && s.quantity > 0 ? s.quantity : 1;
      normalizedServices.push({ service_id: String(s.service_id).trim(), quantity: qty });
    }
  }

  const normalizedProducts: Array<{ product_id: string; quantity: number }> = [];
  if (Array.isArray(p.products)) {
    for (const pr of p.products) {
      if (!pr || typeof pr !== 'object' || !pr.product_id || !UUID_REGEX.test(String(pr.product_id).trim())) {
        return {
          valid: false,
          error: {
            code: 'INVALID_REQUEST_PAYLOAD',
            message: 'Item de produto inválido: "product_id" deve ser um UUID válido.',
            status: 400,
          },
        };
      }
      const qty = typeof pr.quantity === 'number' && Number.isInteger(pr.quantity) && pr.quantity > 0 ? pr.quantity : 1;
      normalizedProducts.push({ product_id: String(pr.product_id).trim(), quantity: qty });
    }
  }

  if (normalizedServices.length === 0 && normalizedProducts.length === 0) {
    return {
      valid: false,
      error: {
        code: 'INVALID_REQUEST_PAYLOAD',
        message: 'A comanda deve conter pelo menos um item (serviço ou produto).',
        status: 400,
      },
    };
  }

  return {
    valid: true,
    data: {
      barber_id: p.barber_id.trim(),
      customer_id: customerId,
      customer_name: customerName,
      customer_phone: customerPhone,
      services: normalizedServices,
      products: normalizedProducts,
      notes: typeof p.notes === 'string' ? p.notes.trim() : undefined,
    },
  };
}

/**
 * Handler HTTP principal para /v1/comandas
 */
export async function handleComandasRoute(
  req: Request,
  authContext: AuthContext,
  dbClient: ComandasDbClient,
  requestId: string
): Promise<Response> {
  const method = req.method.toUpperCase();

  // =========================================================================
  // GET /v1/comandas — Listar comandas do tenant
  // =========================================================================
  if (method === 'GET') {
    if (!hasRequiredScope(authContext.scopes, 'comandas:read')) {
      return buildErrorResponse(
        'INSUFFICIENT_SCOPE',
        "Permissão insuficiente: requer o escopo 'comandas:read'.",
        403,
        requestId
      );
    }

    const url = new URL(req.url);
    const statusParam = (url.searchParams.get('status') || 'open').toLowerCase();
    const dateParam = url.searchParams.get('date');
    const startDateParam = url.searchParams.get('start_date');
    const endDateParam = url.searchParams.get('end_date');
    const limitParam = parseInt(url.searchParams.get('limit') || '50', 10);

    const safeLimit = Math.min(Math.max(1, isNaN(limitParam) ? 50 : limitParam), 100);

    let statusFilter: 'open' | 'closed' | 'all' = 'open';
    if (statusParam === 'closed' || statusParam === 'paid') {
      statusFilter = 'closed';
    } else if (statusParam === 'all') {
      statusFilter = 'all';
    }

    let startDate: string | undefined = startDateParam || undefined;
    let endDate: string | undefined = endDateParam || undefined;

    if (dateParam) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
        return buildErrorResponse(
          'INVALID_REQUEST_PAYLOAD',
          'Parâmetro "date" inválido. Esperado formato YYYY-MM-DD.',
          400,
          requestId
        );
      }
      startDate = `${dateParam}T00:00:00.000Z`;
      endDate = `${dateParam}T23:59:59.999Z`;
    }

    try {
      const comandas = await dbClient.getComandas({
        tenantId: authContext.tenantId,
        status: statusFilter,
        startDate,
        endDate,
        limit: safeLimit,
      });

      return buildJsonResponse(
        {
          data: comandas,
          count: comandas.length,
          meta: {
            tenant_id: authContext.tenantId,
            request_id: requestId,
            timestamp: new Date().toISOString(),
          },
        },
        200,
        requestId
      );
    } catch (err) {
      console.error(`[API-GATEWAY] [${requestId}] Failed to fetch comandas:`, err);
      return buildErrorResponse(
        'INTERNAL_SERVER_ERROR',
        'Erro ao consultar comandas.',
        500,
        requestId
      );
    }
  }

  // =========================================================================
  // POST /v1/comandas — Abertura ágil de nova comanda
  // =========================================================================
  if (method === 'POST') {
    if (!hasRequiredScope(authContext.scopes, 'comandas:write')) {
      return buildErrorResponse(
        'INSUFFICIENT_SCOPE',
        "Permissão insuficiente: requer o escopo 'comandas:write'.",
        403,
        requestId
      );
    }

    let bodyJson: unknown;
    try {
      bodyJson = await req.json();
    } catch {
      return buildErrorResponse(
        'INVALID_REQUEST_PAYLOAD',
        'Corpo da requisição deve ser um JSON válido.',
        400,
        requestId
      );
    }

    const validation = validateCreateComandaPayload(bodyJson);
    if (!validation.valid || !validation.data) {
      return buildErrorResponse(
        validation.error?.code || 'INVALID_REQUEST_PAYLOAD',
        validation.error?.message || 'Payload inválido.',
        validation.error?.status || 400,
        requestId
      );
    }

    const payload = validation.data;

    try {
      // 1. Validar existência do profissional no tenant
      const barber = await dbClient.getBarber(authContext.tenantId, payload.barber_id);
      if (!barber) {
        return buildErrorResponse(
          'RESOURCE_NOT_FOUND',
          'Profissional (barber_id) não encontrado no estabelecimento.',
          404,
          requestId
        );
      }

      // 2. Resolver cliente no tenant
      let resolvedClient: { id: string; name: string };
      if (payload.customer_id) {
        const client = await dbClient.getClientById(authContext.tenantId, payload.customer_id);
        if (!client) {
          return buildErrorResponse(
            'RESOURCE_NOT_FOUND',
            'Cliente (customer_id) não encontrado no estabelecimento.',
            404,
            requestId
          );
        }
        resolvedClient = client;
      } else {
        resolvedClient = await dbClient.findOrCreateClient({
          tenantId: authContext.tenantId,
          name: payload.customer_name!,
          phone: payload.customer_phone!,
        });
      }

      // 3. Validar e precificar serviços do tenant
      const serviceIds = payload.services.map((s) => s.service_id);
      const serviceCatalog = serviceIds.length > 0
        ? await dbClient.getServicesByIds(authContext.tenantId, serviceIds)
        : [];

      const serviceMap = new Map<string, { id: string; name: string; price: number }>();
      for (const s of serviceCatalog) {
        serviceMap.set(s.id, s);
      }

      for (const s of payload.services) {
        if (!serviceMap.has(s.service_id)) {
          return buildErrorResponse(
            'RESOURCE_NOT_FOUND',
            `Serviço '${s.service_id}' não encontrado no catálogo do estabelecimento.`,
            404,
            requestId
          );
        }
      }

      // 4. Validar e precificar produtos do tenant
      const productIds = payload.products.map((p) => p.product_id);
      const productCatalog = productIds.length > 0
        ? await dbClient.getProductsByIds(authContext.tenantId, productIds)
        : [];

      const productMap = new Map<string, { id: string; name: string; sale_price: number }>();
      for (const p of productCatalog) {
        productMap.set(p.id, p);
      }

      for (const p of payload.products) {
        if (!productMap.has(p.product_id)) {
          return buildErrorResponse(
            'RESOURCE_NOT_FOUND',
            `Produto '${p.product_id}' não encontrado no catálogo do estabelecimento.`,
            404,
            requestId
          );
        }
      }

      // 5. Computar total derivado estritamente do catálogo oficial (Δ = R$ 0,00)
      const itemsToCreate: Array<{
        type: 'service' | 'product';
        itemId: string;
        name: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
      }> = [];

      let rawTotal = 0;

      for (const s of payload.services) {
        const item = serviceMap.get(s.service_id)!;
        const lineTotal = Number((item.price * s.quantity).toFixed(2));
        rawTotal += lineTotal;
        itemsToCreate.push({
          type: 'service',
          itemId: item.id,
          name: item.name,
          quantity: s.quantity,
          unitPrice: item.price,
          totalPrice: lineTotal,
        });
      }

      for (const p of payload.products) {
        const item = productMap.get(p.product_id)!;
        const lineTotal = Number((item.sale_price * p.quantity).toFixed(2));
        rawTotal += lineTotal;
        itemsToCreate.push({
          type: 'product',
          itemId: item.id,
          name: item.name,
          quantity: p.quantity,
          unitPrice: item.sale_price,
          totalPrice: lineTotal,
        });
      }

      const totalAmount = Number(rawTotal.toFixed(2));

      // 6. Criar comanda e itens associados
      const createdComanda = await dbClient.createComandaWithItems({
        tenantId: authContext.tenantId,
        clientId: resolvedClient.id,
        clientName: resolvedClient.name,
        barberId: barber.id,
        barberName: barber.name,
        totalAmount,
        notes: payload.notes,
        items: itemsToCreate,
      });

      return buildJsonResponse(
        {
          data: createdComanda,
          meta: {
            request_id: requestId,
            timestamp: new Date().toISOString(),
          },
        },
        201,
        requestId
      );
    } catch (err) {
      console.error(`[API-GATEWAY] [${requestId}] Error creating comanda:`, err);
      return buildErrorResponse(
        'INTERNAL_SERVER_ERROR',
        'Erro interno ao abrir comanda.',
        500,
        requestId
      );
    }
  }

  // Método HTTP não permitido
  return buildErrorResponse(
    'METHOD_NOT_ALLOWED',
    `Método ${method} não permitido para este recurso.`,
    405,
    requestId
  );
}
