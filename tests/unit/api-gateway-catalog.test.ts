/**
 * [TEST][API-GATEWAY] Testes Unitários de Catálogo (/v1/services e /v1/products)
 *
 * Em conformidade com ADR-032 e requisitos de isolamento multi-tenant da Fase 8.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  handleServicesRoute,
  handleProductsRoute,
  parseCatalogQueryParams,
  type CatalogDbClient,
  type ServiceRecord,
  type ProductRecord,
} from '../../supabase/functions/api-gateway/routes/catalog.ts';
import type { AuthContext } from '../../supabase/functions/api-gateway/types.ts';

const mockAuthContext: AuthContext = {
  apiKeyId: 'key-test-cat',
  tenantId: 'tenant-catalog-01',
  name: 'Storefront Integration',
  scopes: ['services:read', 'products:read'],
  environment: 'live',
  keyPrefix: 'smg_live_catalog',
};

const sampleServices: ServiceRecord[] = [
  {
    id: 'srv-1',
    tenant_id: mockAuthContext.tenantId,
    name: 'Corte Degradê',
    category: 'Cabelo',
    price: 45.0,
    duration_minutes: 30,
    active: true,
    created_at: '2026-11-05T00:00:00Z',
  },
  {
    id: 'srv-2',
    tenant_id: mockAuthContext.tenantId,
    name: 'Barboterapia',
    category: 'Barba',
    price: 35.0,
    duration_minutes: 25,
    active: true,
    created_at: '2026-11-05T00:00:00Z',
  },
  {
    id: 'srv-3-inactive',
    tenant_id: mockAuthContext.tenantId,
    name: 'Tratamento Especial',
    category: 'Cabelo',
    price: 90.0,
    duration_minutes: 60,
    active: false,
    created_at: '2026-11-05T00:00:00Z',
  },
];

const sampleProducts: ProductRecord[] = [
  {
    id: 'prod-1',
    tenant_id: mockAuthContext.tenantId,
    name: 'Pomada Efeito Seco',
    description: 'Fixação forte',
    price: 40.0,
    stock_quantity: 15,
    active: true,
    created_at: '2026-11-05T00:00:00Z',
  },
  {
    id: 'prod-2-inactive',
    tenant_id: mockAuthContext.tenantId,
    name: 'Óleo de Barba Clássico',
    description: '30ml',
    price: 30.0,
    stock_quantity: 0,
    active: false,
    created_at: '2026-11-05T00:00:00Z',
  },
];

function createMockCatalogDbClient(overrides: Partial<CatalogDbClient> = {}): CatalogDbClient {
  return {
    getServices: vi.fn(async ({ includeInactive, category }) => {
      let list = sampleServices;
      if (!includeInactive) {
        list = list.filter((s) => s.active);
      }
      if (category) {
        list = list.filter((s) => s.category.toLowerCase() === category.toLowerCase());
      }
      return { services: list, totalCount: list.length };
    }),
    getProducts: vi.fn(async ({ includeInactive }) => {
      let list = sampleProducts;
      if (!includeInactive) {
        list = list.filter((p) => p.active);
      }
      return { products: list, totalCount: list.length };
    }),
    ...overrides,
  };
}

describe('Catalog Query Parameters Validation', () => {
  it('should_use_default_values_when_no_params_provided', () => {
    const url = new URL('https://api.soumanager.com/v1/services');
    const result = parseCatalogQueryParams(url);

    expect(result.valid).toBe(true);
    expect(result.params?.limit).toBe(50);
    expect(result.params?.offset).toBe(0);
    expect(result.params?.includeInactive).toBe(false);
  });

  it('should_clamp_limit_to_maximum_of_100', () => {
    const url = new URL('https://api.soumanager.com/v1/services?limit=250');
    const result = parseCatalogQueryParams(url);

    expect(result.valid).toBe(true);
    expect(result.params?.limit).toBe(100);
  });

  it('should_reject_negative_limit', () => {
    const url = new URL('https://api.soumanager.com/v1/services?limit=-10');
    const result = parseCatalogQueryParams(url);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('limit');
  });

  it('should_reject_negative_offset', () => {
    const url = new URL('https://api.soumanager.com/v1/services?offset=-5');
    const result = parseCatalogQueryParams(url);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('offset');
  });

  it('should_enable_includeInactive_when_param_is_true', () => {
    const url = new URL('https://api.soumanager.com/v1/services?include_inactive=true');
    const result = parseCatalogQueryParams(url);

    expect(result.valid).toBe(true);
    expect(result.params?.includeInactive).toBe(true);
  });
});

describe('Catalog Route — GET /v1/services', () => {
  it('should_return_403_when_token_lacks_services_read_or_catalog_read', async () => {
    const req = new Request('https://api.soumanager.com/v1/services', { method: 'GET' });
    const authWithoutScope: AuthContext = { ...mockAuthContext, scopes: ['appointments:read'] };
    const dbClient = createMockCatalogDbClient();

    const response = await handleServicesRoute(req, authWithoutScope, dbClient, 'req-srv-1');
    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body.error.code).toBe('INSUFFICIENT_SCOPE');
  });

  it('should_return_200_with_services_read_scope', async () => {
    const req = new Request('https://api.soumanager.com/v1/services', { method: 'GET' });
    const authWithScope: AuthContext = { ...mockAuthContext, scopes: ['services:read'] };
    const dbClient = createMockCatalogDbClient();

    const response = await handleServicesRoute(req, authWithScope, dbClient, 'req-srv-2');
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.count).toBe(2); // Apenas ativos por padrão
    expect(body.meta.tenant_id).toBe(mockAuthContext.tenantId);

    expect(dbClient.getServices).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: mockAuthContext.tenantId,
        includeInactive: false,
      })
    );
  });

  it('should_allow_access_with_umbrella_catalog_read_scope', async () => {
    const req = new Request('https://api.soumanager.com/v1/services', { method: 'GET' });
    const authWithCatalogScope: AuthContext = { ...mockAuthContext, scopes: ['catalog:read'] };
    const dbClient = createMockCatalogDbClient();

    const response = await handleServicesRoute(req, authWithCatalogScope, dbClient, 'req-srv-3');
    expect(response.status).toBe(200);
  });

  it('should_include_inactive_services_when_requested', async () => {
    const req = new Request('https://api.soumanager.com/v1/services?include_inactive=true', {
      method: 'GET',
    });
    const dbClient = createMockCatalogDbClient();

    const response = await handleServicesRoute(req, mockAuthContext, dbClient, 'req-srv-4');
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.count).toBe(3); // Inclui inativo
  });

  it('should_filter_services_by_category', async () => {
    const req = new Request('https://api.soumanager.com/v1/services?category=Barba', {
      method: 'GET',
    });
    const dbClient = createMockCatalogDbClient();

    const response = await handleServicesRoute(req, mockAuthContext, dbClient, 'req-srv-5');
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.count).toBe(1);
    expect(body.data[0].category).toBe('Barba');
  });

  it('should_return_405_when_method_is_not_GET', async () => {
    const req = new Request('https://api.soumanager.com/v1/services', { method: 'POST' });
    const dbClient = createMockCatalogDbClient();

    const response = await handleServicesRoute(req, mockAuthContext, dbClient, 'req-srv-6');
    expect(response.status).toBe(405);
  });
});

describe('Catalog Route — GET /v1/products', () => {
  it('should_return_403_when_token_lacks_products_read_or_catalog_read', async () => {
    const req = new Request('https://api.soumanager.com/v1/products', { method: 'GET' });
    const authWithoutScope: AuthContext = { ...mockAuthContext, scopes: ['services:read'] };
    const dbClient = createMockCatalogDbClient();

    const response = await handleProductsRoute(req, authWithoutScope, dbClient, 'req-prd-1');
    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body.error.code).toBe('INSUFFICIENT_SCOPE');
  });

  it('should_return_200_with_products_read_scope', async () => {
    const req = new Request('https://api.soumanager.com/v1/products', { method: 'GET' });
    const authWithScope: AuthContext = { ...mockAuthContext, scopes: ['products:read'] };
    const dbClient = createMockCatalogDbClient();

    const response = await handleProductsRoute(req, authWithScope, dbClient, 'req-prd-2');
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.count).toBe(1); // Apenas ativo por padrão
    expect(body.data[0].name).toBe('Pomada Efeito Seco');

    expect(dbClient.getProducts).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: mockAuthContext.tenantId,
        includeInactive: false,
      })
    );
  });

  it('should_include_inactive_products_when_requested', async () => {
    const req = new Request('https://api.soumanager.com/v1/products?include_inactive=true', {
      method: 'GET',
    });
    const dbClient = createMockCatalogDbClient();

    const response = await handleProductsRoute(req, mockAuthContext, dbClient, 'req-prd-3');
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.count).toBe(2);
  });

  it('should_return_405_when_method_is_not_GET', async () => {
    const req = new Request('https://api.soumanager.com/v1/products', { method: 'DELETE' });
    const dbClient = createMockCatalogDbClient();

    const response = await handleProductsRoute(req, mockAuthContext, dbClient, 'req-prd-4');
    expect(response.status).toBe(405);
  });
});
