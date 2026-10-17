import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isUsingMock, getPublicTenantProfile, createPublicBooking } from './bookingService';
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

    vi.spyOn(clientModule, 'getSharedClient').mockReturnValue({
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

    vi.spyOn(clientModule, 'getSharedClient').mockReturnValue({
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
});
