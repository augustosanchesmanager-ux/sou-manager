/**
 * [SMG][API-GATEWAY] routes/catalog — Handlers REST de catálogo (/v1/services e /v1/products)
 *
 * Em conformidade com ADR-032 e requisitos de isolamento multi-tenant da Fase 8.
 */

import { hasRequiredScope } from '../auth.ts';
import type { AuthContext, ApiErrorResponse } from '../types.ts';

export interface ServiceRecord {
  id: string;
  tenant_id: string;
  name: string;
  category: string;
  price: number;
  duration_minutes: number;
  active: boolean;
  created_at: string;
}

export interface ProductRecord {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  price: number;
  stock_quantity: number;
  active: boolean;
  created_at: string;
}

export interface CatalogDbClient {
  getServices(params: {
    tenantId: string;
    includeInactive?: boolean;
    category?: string;
    limit: number;
    offset: number;
  }): Promise<{ services: ServiceRecord[]; totalCount: number }>;

  getProducts(params: {
    tenantId: string;
    includeInactive?: boolean;
    category?: string;
    limit: number;
    offset: number;
  }): Promise<{ products: ProductRecord[]; totalCount: number }>;
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
 * Normaliza e valida parâmetros de paginação e filtros de catálogo
 */
export function parseCatalogQueryParams(url: URL): {
  valid: boolean;
  error?: string;
  params?: {
    includeInactive: boolean;
    category?: string;
    limit: number;
    offset: number;
  };
} {
  const limitRaw = url.searchParams.get('limit');
  const offsetRaw = url.searchParams.get('offset');
  const categoryRaw = url.searchParams.get('category') || url.searchParams.get('category_id');
  const includeInactiveRaw = url.searchParams.get('include_inactive');

  let limit = 50;
  if (limitRaw !== null) {
    const parsedLimit = parseInt(limitRaw, 10);
    if (isNaN(parsedLimit) || parsedLimit < 0) {
      return {
        valid: false,
        error: 'Parâmetro "limit" inválido: deve ser um número inteiro não-negativo.',
      };
    }
    limit = Math.min(parsedLimit, 100);
  }

  let offset = 0;
  if (offsetRaw !== null) {
    const parsedOffset = parseInt(offsetRaw, 10);
    if (isNaN(parsedOffset) || parsedOffset < 0) {
      return {
        valid: false,
        error: 'Parâmetro "offset" inválido: deve ser um número inteiro não-negativo.',
      };
    }
    offset = parsedOffset;
  }

  const includeInactive = includeInactiveRaw?.toLowerCase() === 'true';
  const category = categoryRaw?.trim() ? categoryRaw.trim() : undefined;

  return {
    valid: true,
    params: {
      includeInactive,
      category,
      limit,
      offset,
    },
  };
}

/**
 * Handler HTTP principal para /v1/services
 */
export async function handleServicesRoute(
  req: Request,
  authContext: AuthContext,
  dbClient: CatalogDbClient,
  requestId: string
): Promise<Response> {
  const method = req.method.toUpperCase();

  if (method !== 'GET') {
    return buildErrorResponse(
      'METHOD_NOT_ALLOWED',
      `Método ${method} não permitido para este recurso.`,
      405,
      requestId
    );
  }

  // Validar escopo: services:read OU catalog:read
  if (!hasRequiredScope(authContext.scopes, ['services:read', 'catalog:read'])) {
    return buildErrorResponse(
      'INSUFFICIENT_SCOPE',
      "Permissão insuficiente: requer o escopo 'services:read' ou 'catalog:read'.",
      403,
      requestId
    );
  }

  const url = new URL(req.url);
  const parsed = parseCatalogQueryParams(url);
  if (!parsed.valid || !parsed.params) {
    return buildErrorResponse('INVALID_QUERY_PARAMETERS', parsed.error!, 400, requestId);
  }

  const { includeInactive, category, limit, offset } = parsed.params;

  try {
    const result = await dbClient.getServices({
      tenantId: authContext.tenantId,
      includeInactive,
      category,
      limit,
      offset,
    });

    return buildJsonResponse(
      {
        data: result.services,
        count: result.services.length,
        total: result.totalCount,
        meta: {
          tenant_id: authContext.tenantId,
          request_id: requestId,
          timestamp: new Date().toISOString(),
          limit,
          offset,
        },
      },
      200,
      requestId
    );
  } catch (err) {
    console.error(`[API-GATEWAY] [${requestId}] Error fetching services:`, err);
    return buildErrorResponse('INTERNAL_SERVER_ERROR', 'Erro ao consultar serviços.', 500, requestId);
  }
}

/**
 * Handler HTTP principal para /v1/products
 */
export async function handleProductsRoute(
  req: Request,
  authContext: AuthContext,
  dbClient: CatalogDbClient,
  requestId: string
): Promise<Response> {
  const method = req.method.toUpperCase();

  if (method !== 'GET') {
    return buildErrorResponse(
      'METHOD_NOT_ALLOWED',
      `Método ${method} não permitido para este recurso.`,
      405,
      requestId
    );
  }

  // Validar escopo: products:read OU catalog:read
  if (!hasRequiredScope(authContext.scopes, ['products:read', 'catalog:read'])) {
    return buildErrorResponse(
      'INSUFFICIENT_SCOPE',
      "Permissão insuficiente: requer o escopo 'products:read' ou 'catalog:read'.",
      403,
      requestId
    );
  }

  const url = new URL(req.url);
  const parsed = parseCatalogQueryParams(url);
  if (!parsed.valid || !parsed.params) {
    return buildErrorResponse('INVALID_QUERY_PARAMETERS', parsed.error!, 400, requestId);
  }

  const { includeInactive, category, limit, offset } = parsed.params;

  try {
    const result = await dbClient.getProducts({
      tenantId: authContext.tenantId,
      includeInactive,
      category,
      limit,
      offset,
    });

    return buildJsonResponse(
      {
        data: result.products,
        count: result.products.length,
        total: result.totalCount,
        meta: {
          tenant_id: authContext.tenantId,
          request_id: requestId,
          timestamp: new Date().toISOString(),
          limit,
          offset,
        },
      },
      200,
      requestId
    );
  } catch (err) {
    console.error(`[API-GATEWAY] [${requestId}] Error fetching products:`, err);
    return buildErrorResponse('INTERNAL_SERVER_ERROR', 'Erro ao consultar produtos.', 500, requestId);
  }
}
