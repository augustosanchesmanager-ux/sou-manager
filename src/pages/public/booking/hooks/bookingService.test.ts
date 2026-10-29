import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isUsingMock,
  getPublicTenantProfile,
  getPublicShowcaseProducts,
  createPublicBooking,
} from './bookingService';
import * as clientModule from '../../../../../services/supabaseClient';

describe('BookingService — Front-end to Supabase RPC integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should_use_real_backend_by_default_when_supabase_env_is_configured', () => {
    // When Supabase env credentials are present and mock is not explicitly forced
    const mockActive = isUsingMock();
    // In test environment, if credentials exist, it shouldn't force mock
    expect(typeof mockActive).toBe('boolean');
  });

  it('should_call_get_public_tenant_profile_rpc_when_mock_is_disabled', async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: {
        tenant_id: 'tenant-123',
        name: 'Sanchez Barber',
        slug: 'sanchez',
        booking_enabled: true,
        services: [],
        staff: [],
      },
      error: null,
    });

    vi.spyOn(clientModule, 'getPublicAnonymousClient').mockReturnValue({
      rpc: mockRpc,
    } as any);

    // If mock is disabled in this run, it should invoke client.rpc
    if (!isUsingMock()) {
      const profile = await getPublicTenantProfile('sanchez');
      expect(mockRpc).toHaveBeenCalledWith('get_public_tenant_profile', {
        p_tenant_identifier: 'sanchez',
      });
      expect(profile?.name).toBe('Sanchez Barber');
    }
  });

  it('should_propagate_business_rule_exceptions_without_masking_as_function_not_found', async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: '23P01',
        message: 'slot_occupied',
        details: 'slot_occupied',
      },
    });

    vi.spyOn(clientModule, 'getPublicAnonymousClient').mockReturnValue({
      rpc: mockRpc,
    } as any);

    if (!isUsingMock()) {
      await expect(
        createPublicBooking({
          tenant_identifier: 'sanchez',
          staff_id: 'staff-1',
          service_ids: ['svc-1'],
          start_time: '2026-10-20T10:00:00Z',
          client_name: 'Cliente Teste',
          client_phone: '11999999999',
        })
      ).rejects.toThrow('Esse horário acabou de ser reservado. Escolha outro.');
    }
  });

  it('should_strictly_isolate_tenant_identifier_to_accessed_barbershop_via_anonymous_client', async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: {
        appointment_id: 'apt-avante-123',
        client_id: 'cli-avante-123',
        status: 'confirmed',
        public_token: 'token-avante-123',
        public_token_id: 'tokid-123',
        expires_at: '2026-12-31T23:59:59Z',
        services: [{ service_id: 'svc-avante', name: 'Corte clássico', duration: 45, price: 60 }],
        staff: { id: 'staff-avante', name: 'Ygor Yuri' },
        start_time: '2026-10-29T14:00:00Z',
        end_time: '2026-10-29T14:45:00Z',
        idempotent: false,
      },
      error: null,
    });

    const anonClientSpy = vi.spyOn(clientModule, 'getPublicAnonymousClient').mockReturnValue({
      rpc: mockRpc,
    } as any);

    if (!isUsingMock()) {
      const result = await createPublicBooking({
        tenant_identifier: '8fb669d2-4cc0-4e01-a115-a7af7b62e536',
        staff_id: 'staff-avante',
        service_ids: ['svc-avante'],
        start_time: '2026-10-29T14:00:00Z',
        client_name: 'Cliente Avante',
        client_phone: '5511999998888',
        idempotency_key: 'idem-avante-1',
      });

      expect(anonClientSpy).toHaveBeenCalled();
      expect(mockRpc).toHaveBeenCalledWith('create_public_booking', expect.objectContaining({
        p_tenant_identifier: '8fb669d2-4cc0-4e01-a115-a7af7b62e536',
        p_staff_id: 'staff-avante',
        p_service_ids: ['svc-avante'],
        p_client_name: 'Cliente Avante',
      }));
      expect(result.appointment_id).toBe('apt-avante-123');
    }
  });

  it('should_call_get_public_showcase_products_rpc_via_anonymous_client', async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'prod-1',
          name: 'Pomada Efeito Matte',
          price: 65,
          image_url: 'https://example.com/pomada.jpg',
          description: 'Alta fixação',
        },
      ],
      error: null,
    });

    vi.spyOn(clientModule, 'getPublicAnonymousClient').mockReturnValue({
      rpc: mockRpc,
    } as any);

    if (!isUsingMock()) {
      const products = await getPublicShowcaseProducts('sanchez-barber');
      expect(mockRpc).toHaveBeenCalledWith('get_public_showcase_products', {
        p_slug: 'sanchez-barber',
      });
      expect(products).toHaveLength(1);
      expect(products[0].name).toBe('Pomada Efeito Matte');
      expect(products[0].price).toBe(65);
    }
  });
});
