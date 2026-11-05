/**
 * [TEST][API-GATEWAY] Testes Unitários do Módulo de Agendamentos (/v1/appointments)
 *
 * Em conformidade com ADR-032 e requisitos de isolamento multi-tenant da Fase 8.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  handleAppointmentsRoute,
  validateCreateAppointmentPayload,
  type AppointmentsDbClient,
  type AppointmentRecord,
  type NewAppointmentInput,
} from '../../supabase/functions/api-gateway/routes/appointments.ts';
import type { AuthContext } from '../../supabase/functions/api-gateway/types.ts';

const mockAuthContext: AuthContext = {
  apiKeyId: 'key-test-1',
  tenantId: 'tenant-aaa-111',
  name: 'Integration App',
  scopes: ['appointments:read', 'appointments:write'],
  environment: 'live',
  keyPrefix: 'smg_live_12345678',
};

const mockBarber = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  name: 'Barbeiro Teste',
};

const mockService = {
  id: '550e8400-e29b-41d4-a716-446655440002',
  name: 'Corte Degradê',
  price: 50.0,
  duration_minutes: 45,
};

function createMockDbClient(overrides: Partial<AppointmentsDbClient> = {}): AppointmentsDbClient {
  return {
    getAppointments: vi.fn(async () => []),
    getBarber: vi.fn(async (_tenantId, id) =>
      id === mockBarber.id ? mockBarber : null
    ),
    getService: vi.fn(async (_tenantId, id) =>
      id === mockService.id ? mockService : null
    ),
    checkSlotOverlap: vi.fn(async () => false),
    createAppointment: vi.fn(async (input: NewAppointmentInput) => ({
      id: '550e8400-e29b-41d4-a716-446655440099',
      ...input,
      created_at: new Date().toISOString(),
    })),
    ...overrides,
  };
}

describe('Appointments Route — Payload Validation', () => {
  const futureDate = new Date(Date.now() + 86400000).toISOString(); // Amanhã

  it('should_reject_payload_when_not_an_object', () => {
    const res = validateCreateAppointmentPayload(null);
    expect(res.valid).toBe(false);
    expect(res.error?.code).toBe('INVALID_REQUEST_PAYLOAD');
  });

  it('should_reject_payload_when_client_name_is_missing_or_short', () => {
    const res = validateCreateAppointmentPayload({
      client_name: 'A',
      client_phone: '11999999999',
      barber_id: mockBarber.id,
      service_id: mockService.id,
      start_time: futureDate,
    });
    expect(res.valid).toBe(false);
    expect(res.error?.message).toContain('client_name');
  });

  it('should_reject_payload_when_barber_id_is_not_uuid', () => {
    const res = validateCreateAppointmentPayload({
      client_name: 'Carlos Silva',
      client_phone: '11999999999',
      barber_id: 'invalid-id',
      service_id: mockService.id,
      start_time: futureDate,
    });
    expect(res.valid).toBe(false);
    expect(res.error?.message).toContain('barber_id');
  });

  it('should_reject_payload_when_start_time_is_in_the_past', () => {
    const pastDate = new Date(Date.now() - 3600000).toISOString(); // 1 hora atrás
    const res = validateCreateAppointmentPayload({
      client_name: 'Carlos Silva',
      client_phone: '11999999999',
      barber_id: mockBarber.id,
      service_id: mockService.id,
      start_time: pastDate,
    });
    expect(res.valid).toBe(false);
    expect(res.error?.message).toContain('futura');
  });

  it('should_accept_valid_payload_with_future_date', () => {
    const res = validateCreateAppointmentPayload({
      client_name: 'Carlos Silva',
      client_phone: '11999999999',
      barber_id: mockBarber.id,
      service_id: mockService.id,
      start_time: futureDate,
      notes: 'Cliente prefere tesoura',
    });
    expect(res.valid).toBe(true);
    expect(res.data?.client_name).toBe('Carlos Silva');
    expect(res.data?.notes).toBe('Cliente prefere tesoura');
  });
});

describe('Appointments Route — GET /v1/appointments', () => {
  it('should_return_403_when_auth_context_lacks_appointments_read_scope', async () => {
    const req = new Request('https://api.soumanager.com/v1/appointments', { method: 'GET' });
    const authWithoutScope: AuthContext = { ...mockAuthContext, scopes: ['comandas:read'] };
    const dbClient = createMockDbClient();

    const response = await handleAppointmentsRoute(req, authWithoutScope, dbClient, 'req-1');
    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body.error.code).toBe('INSUFFICIENT_SCOPE');
  });

  it('should_return_200_and_appointments_list_for_tenant', async () => {
    const mockAppointments: AppointmentRecord[] = [
      {
        id: 'app-1',
        tenant_id: mockAuthContext.tenantId,
        client_name: 'João',
        client_phone: '11988887777',
        service_id: mockService.id,
        service_name: mockService.name,
        staff_id: mockBarber.id,
        staff_name: mockBarber.name,
        start_time: '2026-11-06T14:00:00Z',
        end_time: '2026-11-06T14:45:00Z',
        duration: 0.75,
        price: 50,
        status: 'confirmed',
        source: 'public_api',
        created_at: '2026-11-05T12:00:00Z',
      },
    ];

    const dbClient = createMockDbClient({
      getAppointments: vi.fn(async () => mockAppointments),
    });

    const req = new Request('https://api.soumanager.com/v1/appointments?date=2026-11-06', {
      method: 'GET',
    });

    const response = await handleAppointmentsRoute(req, mockAuthContext, dbClient, 'req-2');
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.count).toBe(1);
    expect(body.data[0].client_name).toBe('João');
    expect(body.meta.tenant_id).toBe(mockAuthContext.tenantId);

    expect(dbClient.getAppointments).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: mockAuthContext.tenantId,
        startDate: '2026-11-06T00:00:00.000Z',
        endDate: '2026-11-06T23:59:59.999Z',
      })
    );
  });

  it('should_return_400_when_date_param_has_invalid_format', async () => {
    const req = new Request('https://api.soumanager.com/v1/appointments?date=06-11-2026', {
      method: 'GET',
    });
    const dbClient = createMockDbClient();

    const response = await handleAppointmentsRoute(req, mockAuthContext, dbClient, 'req-3');
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error.code).toBe('INVALID_REQUEST_PAYLOAD');
  });
});

describe('Appointments Route — POST /v1/appointments', () => {
  const futureDate = new Date(Date.now() + 86400000).toISOString();

  it('should_return_403_when_auth_context_lacks_appointments_write_scope', async () => {
    const req = new Request('https://api.soumanager.com/v1/appointments', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const authWithoutScope: AuthContext = { ...mockAuthContext, scopes: ['appointments:read'] };
    const dbClient = createMockDbClient();

    const response = await handleAppointmentsRoute(req, authWithoutScope, dbClient, 'req-4');
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error.code).toBe('INSUFFICIENT_SCOPE');
  });

  it('should_return_400_when_barber_does_not_belong_to_tenant', async () => {
    const dbClient = createMockDbClient({
      getBarber: vi.fn(async () => null), // Barbeiro não encontrado no tenant
    });

    const req = new Request('https://api.soumanager.com/v1/appointments', {
      method: 'POST',
      body: JSON.stringify({
        client_name: 'Marcos',
        client_phone: '11999999999',
        barber_id: mockBarber.id,
        service_id: mockService.id,
        start_time: futureDate,
      }),
    });

    const response = await handleAppointmentsRoute(req, mockAuthContext, dbClient, 'req-5');
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.message).toContain('Profissional');
  });

  it('should_return_400_when_service_does_not_belong_to_tenant', async () => {
    const dbClient = createMockDbClient({
      getService: vi.fn(async () => null), // Serviço não encontrado no tenant
    });

    const req = new Request('https://api.soumanager.com/v1/appointments', {
      method: 'POST',
      body: JSON.stringify({
        client_name: 'Marcos',
        client_phone: '11999999999',
        barber_id: mockBarber.id,
        service_id: mockService.id,
        start_time: futureDate,
      }),
    });

    const response = await handleAppointmentsRoute(req, mockAuthContext, dbClient, 'req-6');
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.message).toContain('Serviço');
  });

  it('should_return_409_when_slot_overlap_is_detected', async () => {
    const dbClient = createMockDbClient({
      checkSlotOverlap: vi.fn(async () => true), // Conflito de horário!
    });

    const req = new Request('https://api.soumanager.com/v1/appointments', {
      method: 'POST',
      body: JSON.stringify({
        client_name: 'Marcos',
        client_phone: '11999999999',
        barber_id: mockBarber.id,
        service_id: mockService.id,
        start_time: futureDate,
      }),
    });

    const response = await handleAppointmentsRoute(req, mockAuthContext, dbClient, 'req-7');
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe('SLOT_UNAVAILABLE');
  });

  it('should_create_appointment_and_return_201_when_payload_and_slot_are_valid', async () => {
    const dbClient = createMockDbClient();

    const req = new Request('https://api.soumanager.com/v1/appointments', {
      method: 'POST',
      body: JSON.stringify({
        client_name: 'Gabriel Martins',
        client_phone: '11988887777',
        barber_id: mockBarber.id,
        service_id: mockService.id,
        start_time: futureDate,
        notes: 'Cliente VIP',
      }),
    });

    const response = await handleAppointmentsRoute(req, mockAuthContext, dbClient, 'req-8');
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.data.id).toBeDefined();
    expect(body.data.client_name).toBe('Gabriel Martins');
    expect(body.data.staff_name).toBe(mockBarber.name);
    expect(body.data.service_name).toBe(mockService.name);
    expect(body.data.status).toBe('confirmed');

    // Garantir que tenant_id do contexto foi aplicado na criação
    expect(dbClient.createAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: mockAuthContext.tenantId,
        staff_id: mockBarber.id,
        service_id: mockService.id,
        source: 'public_api',
      })
    );
  });
});
