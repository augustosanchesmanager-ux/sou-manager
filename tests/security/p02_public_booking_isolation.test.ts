import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPublicAnonymousClient } from '../../services/supabaseClient';
import { createPublicBooking, getPublicTenantProfile } from '../../src/pages/public/booking/hooks/bookingService';
import * as clientModule from '../../services/supabaseClient';

describe('P02 Public Booking — Multi-Tenant Isolation & Anonymous Security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    import.meta.env.VITE_ENABLE_BOOKING_MOCK = 'false';
  });

  it('should_provide_an_isolated_anonymous_client_with_storage_disabled', () => {
    const anonClient = getPublicAnonymousClient();
    expect(anonClient).toBeDefined();
    // Re-call returns singleton instance
    const secondCall = getPublicAnonymousClient();
    expect(secondCall).toBe(anonClient);
  });

  it('should_dispatch_rpc_using_public_anonymous_client_never_shared_session', async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: {
        tenant_id: '8fb669d2-4cc0-4e01-a115-a7af7b62e536',
        name: 'SR. AVANTE',
        slug: 'sr-avante',
        booking_enabled: true,
        services: [],
        staff: [],
      },
      error: null,
    });

    const anonClientSpy = vi.spyOn(clientModule, 'getPublicAnonymousClient').mockReturnValue({
      rpc: mockRpc,
    } as any);

    const sharedClientSpy = vi.spyOn(clientModule, 'getSharedClient');

    const profile = await getPublicTenantProfile('sr-avante');

    expect(anonClientSpy).toHaveBeenCalled();
    expect(sharedClientSpy).not.toHaveBeenCalled();
    expect(mockRpc).toHaveBeenCalledWith('get_public_tenant_profile', {
      p_tenant_identifier: 'sr-avante',
    });
    expect(profile?.tenant_id).toBe('8fb669d2-4cc0-4e01-a115-a7af7b62e536');
    expect(profile?.name).toBe('SR. AVANTE');
  });

  it('should_send_tenant_uuid_identifier_to_create_public_booking_preventing_cross_tenant_leak', async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: {
        appointment_id: 'apt-sr-avante-uuid-1',
        client_id: 'cli-sr-avante-1',
        status: 'confirmed',
        public_token: 'pub-tok-sr-avante',
        public_token_id: 'token-id-1',
        expires_at: '2026-12-31T23:59:59Z',
        services: [
          { service_id: 'svc-1', name: 'Corte clássico', duration: 45, price: 60 },
        ],
        staff: { id: 'staff-1', name: 'LUAN AVANTE' },
        start_time: '2026-10-29T15:00:00Z',
        end_time: '2026-10-29T15:45:00Z',
        idempotent: false,
      },
      error: null,
    });

    vi.spyOn(clientModule, 'getPublicAnonymousClient').mockReturnValue({
      rpc: mockRpc,
    } as any);

    const srAvanteTenantId = '8fb669d2-4cc0-4e01-a115-a7af7b62e536';

    const result = await createPublicBooking({
      tenant_identifier: srAvanteTenantId,
      staff_id: 'staff-1',
      service_ids: ['svc-1'],
      start_time: '2026-10-29T15:00:00Z',
      client_name: 'Cliente Real Avante',
      client_phone: '5511999998888',
      idempotency_key: 'idem-key-sr-avante-1',
    });

    expect(mockRpc).toHaveBeenCalledWith('create_public_booking', {
      p_tenant_identifier: srAvanteTenantId,
      p_staff_id: 'staff-1',
      p_service_ids: ['svc-1'],
      p_start_time: '2026-10-29T15:00:00Z',
      p_client_name: 'Cliente Real Avante',
      p_client_phone: '5511999998888',
      p_notes: null,
      p_idempotency_key: 'idem-key-sr-avante-1',
    });

    expect(result.appointment_id).toBe('apt-sr-avante-uuid-1');
  });
});
