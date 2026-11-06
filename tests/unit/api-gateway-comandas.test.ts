/**
 * [TEST][API-GATEWAY] Testes Unitários do Módulo de Comandas (/v1/comandas)
 *
 * Em conformidade com ADR-032 e requisitos de isolamento multi-tenant da Fase 8.
 * Invariante Contábil: Total derivado do catálogo do tenant com resíduo zero (Δ = R$ 0,00).
 */

import { describe, it, expect, vi } from 'vitest';
import {
  handleComandasRoute,
  validateCreateComandaPayload,
  type ComandasDbClient,
  type ComandaRecord,
  type ComandaWithItemsRecord,
} from '../../supabase/functions/api-gateway/routes/comandas.ts';
import type { AuthContext } from '../../supabase/functions/api-gateway/types.ts';

const mockAuthContext: AuthContext = {
  apiKeyId: 'key-test-comanda',
  tenantId: 'tenant-barber-001',
  name: 'PDV Integration',
  scopes: ['comandas:read', 'comandas:write'],
  environment: 'live',
  keyPrefix: 'smg_live_comandas',
};

const mockBarber = {
  id: '660e8400-e29b-41d4-a716-446655440010',
  name: 'Eduardo Barbeiro',
};

const mockClient = {
  id: '660e8400-e29b-41d4-a716-446655440020',
  name: 'Lucas Souza',
  phone: '11987654321',
};

const mockService1 = {
  id: '660e8400-e29b-41d4-a716-446655440030',
  name: 'Corte Social',
  price: 45.0,
};

const mockService2 = {
  id: '660e8400-e29b-41d4-a716-446655440031',
  name: 'Barba Terapia',
  price: 35.0,
};

const mockProduct1 = {
  id: '660e8400-e29b-41d4-a716-446655440040',
  name: 'Pomada Matte 100g',
  sale_price: 39.9,
};

function createMockComandasDbClient(overrides: Partial<ComandasDbClient> = {}): ComandasDbClient {
  return {
    getComandas: vi.fn(async () => []),
    getBarber: vi.fn(async (_tenantId, id) => (id === mockBarber.id ? mockBarber : null)),
    getClientById: vi.fn(async (_tenantId, id) => (id === mockClient.id ? mockClient : null)),
    findOrCreateClient: vi.fn(async ({ name, phone }) => ({
      id: '660e8400-e29b-41d4-a716-446655440099',
      name,
      phone,
    })),
    getServicesByIds: vi.fn(async (_tenantId, ids) => {
      const catalog = [mockService1, mockService2];
      return catalog.filter((s) => ids.includes(s.id));
    }),
    getProductsByIds: vi.fn(async (_tenantId, ids) => {
      const catalog = [mockProduct1];
      return catalog.filter((p) => ids.includes(p.id));
    }),
    createComandaWithItems: vi.fn(async (params): Promise<ComandaWithItemsRecord> => ({
      id: '660e8400-e29b-41d4-a716-446655440088',
      tenant_id: params.tenantId,
      client_id: params.clientId,
      client_name: params.clientName,
      staff_id: params.barberId,
      staff_name: params.barberName,
      status: 'open',
      total: params.totalAmount,
      created_at: new Date().toISOString(),
      items_count: params.items.length,
      items: params.items.map((it, idx) => ({
        id: `item-${idx + 1}`,
        type: it.type,
        item_id: it.itemId,
        name: it.name,
        quantity: it.quantity,
        unit_price: it.unitPrice,
        total_price: it.totalPrice,
      })),
    })),
    ...overrides,
  };
}

describe('Comandas Route — Payload Validation', () => {
  it('should_reject_payload_when_not_an_object', () => {
    const res = validateCreateComandaPayload(null);
    expect(res.valid).toBe(false);
    expect(res.error?.code).toBe('INVALID_REQUEST_PAYLOAD');
  });

  it('should_reject_payload_when_barber_id_is_missing_or_not_uuid', () => {
    const res = validateCreateComandaPayload({
      customer_id: mockClient.id,
      services: [{ service_id: mockService1.id }],
    });
    expect(res.valid).toBe(false);
    expect(res.error?.message).toContain('barber_id');
  });

  it('should_reject_payload_when_no_client_identification_is_provided', () => {
    const res = validateCreateComandaPayload({
      barber_id: mockBarber.id,
      services: [{ service_id: mockService1.id }],
    });
    expect(res.valid).toBe(false);
    expect(res.error?.message).toContain('Identificação do cliente');
  });

  it('should_reject_payload_when_no_items_are_provided', () => {
    const res = validateCreateComandaPayload({
      barber_id: mockBarber.id,
      customer_id: mockClient.id,
      services: [],
      products: [],
    });
    expect(res.valid).toBe(false);
    expect(res.error?.message).toContain('pelo menos um item');
  });

  it('should_accept_valid_payload_with_customer_id_and_items', () => {
    const res = validateCreateComandaPayload({
      barber_id: mockBarber.id,
      customer_id: mockClient.id,
      services: [{ service_id: mockService1.id, quantity: 1 }],
      products: [{ product_id: mockProduct1.id, quantity: 2 }],
      notes: 'Comanda balcão',
    });
    expect(res.valid).toBe(true);
    expect(res.data?.services).toHaveLength(1);
    expect(res.data?.products).toHaveLength(1);
    expect(res.data?.products[0].quantity).toBe(2);
  });

  it('should_accept_valid_payload_with_walk_in_client_name_and_phone', () => {
    const res = validateCreateComandaPayload({
      barber_id: mockBarber.id,
      customer_name: 'Walk-in Cliente',
      customer_phone: '11988887777',
      services: [{ service_id: mockService1.id }],
    });
    expect(res.valid).toBe(true);
    expect(res.data?.customer_name).toBe('Walk-in Cliente');
    expect(res.data?.customer_phone).toBe('11988887777');
  });
});

describe('Comandas Route — GET /v1/comandas', () => {
  it('should_return_403_when_auth_context_lacks_comandas_read_scope', async () => {
    const req = new Request('https://api.soumanager.com/v1/comandas', { method: 'GET' });
    const authWithoutScope: AuthContext = { ...mockAuthContext, scopes: ['appointments:read'] };
    const dbClient = createMockComandasDbClient();

    const response = await handleComandasRoute(req, authWithoutScope, dbClient, 'req-com-1');
    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body.error.code).toBe('INSUFFICIENT_SCOPE');
  });

  it('should_return_200_and_comandas_list_for_tenant', async () => {
    const mockComandas: ComandaRecord[] = [
      {
        id: 'cmd-01',
        tenant_id: mockAuthContext.tenantId,
        client_id: mockClient.id,
        staff_id: mockBarber.id,
        status: 'open',
        total: 80.0,
        created_at: '2026-11-05T15:00:00Z',
      },
    ];

    const dbClient = createMockComandasDbClient({
      getComandas: vi.fn(async () => mockComandas),
    });

    const req = new Request('https://api.soumanager.com/v1/comandas?status=open&limit=20', {
      method: 'GET',
    });

    const response = await handleComandasRoute(req, mockAuthContext, dbClient, 'req-com-2');
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.count).toBe(1);
    expect(body.data[0].id).toBe('cmd-01');
    expect(body.meta.tenant_id).toBe(mockAuthContext.tenantId);

    expect(dbClient.getComandas).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: mockAuthContext.tenantId,
        status: 'open',
        limit: 20,
      })
    );
  });

  it('should_return_400_when_date_parameter_is_malformed', async () => {
    const req = new Request('https://api.soumanager.com/v1/comandas?date=2026/11/05', {
      method: 'GET',
    });
    const dbClient = createMockComandasDbClient();

    const response = await handleComandasRoute(req, mockAuthContext, dbClient, 'req-com-3');
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error.code).toBe('INVALID_REQUEST_PAYLOAD');
  });
});

describe('Comandas Route — POST /v1/comandas', () => {
  it('should_return_403_when_auth_context_lacks_comandas_write_scope', async () => {
    const req = new Request('https://api.soumanager.com/v1/comandas', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const authWithoutScope: AuthContext = { ...mockAuthContext, scopes: ['comandas:read'] };
    const dbClient = createMockComandasDbClient();

    const response = await handleComandasRoute(req, authWithoutScope, dbClient, 'req-com-4');
    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body.error.code).toBe('INSUFFICIENT_SCOPE');
  });

  it('should_return_404_when_barber_is_not_found_in_tenant', async () => {
    const dbClient = createMockComandasDbClient({
      getBarber: vi.fn(async () => null),
    });

    const req = new Request('https://api.soumanager.com/v1/comandas', {
      method: 'POST',
      body: JSON.stringify({
        barber_id: mockBarber.id,
        customer_id: mockClient.id,
        services: [{ service_id: mockService1.id }],
      }),
    });

    const response = await handleComandasRoute(req, mockAuthContext, dbClient, 'req-com-5');
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.error.code).toBe('RESOURCE_NOT_FOUND');
    expect(body.error.message).toContain('Profissional');
  });

  it('should_return_404_when_customer_id_is_not_found_in_tenant', async () => {
    const dbClient = createMockComandasDbClient({
      getClientById: vi.fn(async () => null),
    });

    const req = new Request('https://api.soumanager.com/v1/comandas', {
      method: 'POST',
      body: JSON.stringify({
        barber_id: mockBarber.id,
        customer_id: mockClient.id,
        services: [{ service_id: mockService1.id }],
      }),
    });

    const response = await handleComandasRoute(req, mockAuthContext, dbClient, 'req-com-6');
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.error.code).toBe('RESOURCE_NOT_FOUND');
    expect(body.error.message).toContain('Cliente');
  });

  it('should_return_404_when_service_is_not_found_in_tenant_catalog', async () => {
    const dbClient = createMockComandasDbClient({
      getServicesByIds: vi.fn(async () => []), // Serviço ausente no tenant
    });

    const req = new Request('https://api.soumanager.com/v1/comandas', {
      method: 'POST',
      body: JSON.stringify({
        barber_id: mockBarber.id,
        customer_id: mockClient.id,
        services: [{ service_id: mockService1.id }],
      }),
    });

    const response = await handleComandasRoute(req, mockAuthContext, dbClient, 'req-com-7');
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.error.code).toBe('RESOURCE_NOT_FOUND');
    expect(body.error.message).toContain('Serviço');
  });

  it('should_return_404_when_product_is_not_found_in_tenant_catalog', async () => {
    const dbClient = createMockComandasDbClient({
      getProductsByIds: vi.fn(async () => []), // Produto ausente no tenant
    });

    const req = new Request('https://api.soumanager.com/v1/comandas', {
      method: 'POST',
      body: JSON.stringify({
        barber_id: mockBarber.id,
        customer_id: mockClient.id,
        products: [{ product_id: mockProduct1.id }],
      }),
    });

    const response = await handleComandasRoute(req, mockAuthContext, dbClient, 'req-com-8');
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.error.code).toBe('RESOURCE_NOT_FOUND');
    expect(body.error.message).toContain('Produto');
  });

  it('should_create_comanda_with_exact_total_derived_from_catalog_and_return_201', async () => {
    const dbClient = createMockComandasDbClient();

    // 1x Corte Social (R$ 45,00) + 2x Pomada Matte (2 * R$ 39,90 = R$ 79,80)
    // Total esperado: R$ 124,80 (Δ = R$ 0,00)
    const req = new Request('https://api.soumanager.com/v1/comandas', {
      method: 'POST',
      body: JSON.stringify({
        barber_id: mockBarber.id,
        customer_id: mockClient.id,
        services: [{ service_id: mockService1.id, quantity: 1 }],
        products: [{ product_id: mockProduct1.id, quantity: 2 }],
        notes: 'Cliente solicitou nota fiscal',
      }),
    });

    const response = await handleComandasRoute(req, mockAuthContext, dbClient, 'req-com-9');
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.data.id).toBeDefined();
    expect(body.data.status).toBe('open');
    expect(body.data.total).toBe(124.8);
    expect(body.data.items).toHaveLength(2);

    expect(dbClient.createComandaWithItems).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: mockAuthContext.tenantId,
        barberId: mockBarber.id,
        clientId: mockClient.id,
        totalAmount: 124.8,
        items: expect.arrayContaining([
          expect.objectContaining({
            type: 'service',
            itemId: mockService1.id,
            quantity: 1,
            unitPrice: 45.0,
            totalPrice: 45.0,
          }),
          expect.objectContaining({
            type: 'product',
            itemId: mockProduct1.id,
            quantity: 2,
            unitPrice: 39.9,
            totalPrice: 79.8,
          }),
        ]),
      })
    );
  });

  it('should_provision_or_find_walk_in_client_and_create_comanda', async () => {
    const dbClient = createMockComandasDbClient();

    const req = new Request('https://api.soumanager.com/v1/comandas', {
      method: 'POST',
      body: JSON.stringify({
        barber_id: mockBarber.id,
        customer_name: 'Novo Cliente Balcão',
        customer_phone: '11977776666',
        services: [{ service_id: mockService2.id, quantity: 1 }],
      }),
    });

    const response = await handleComandasRoute(req, mockAuthContext, dbClient, 'req-com-10');
    expect(response.status).toBe(201);

    expect(dbClient.findOrCreateClient).toHaveBeenCalledWith({
      tenantId: mockAuthContext.tenantId,
      name: 'Novo Cliente Balcão',
      phone: '11977776666',
    });

    const body = await response.json();
    expect(body.data.total).toBe(35.0);
  });
});
