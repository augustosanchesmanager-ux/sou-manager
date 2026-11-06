import { describe, it, expect, vi, beforeEach } from 'vitest';
import { integrationService } from '../../services/integrationService';
import type { IntegrationProvider, TenantIntegration, IntegrationSyncLog } from '../../src/types/integrations';

describe('IntegrationService — Unit Tests (Subphase 8.5)', () => {
  const mockTenantId = '11111111-1111-1111-1111-111111111111';
  const mockProviderId = 'prov-uuid-001';
  const mockIntegrationId = 'integ-uuid-001';

  const sampleProvider: IntegrationProvider = {
    id: mockProviderId,
    slug: 'mercado_pago',
    name: 'Mercado Pago',
    category: 'payment_gateway',
    auth_type: 'api_key',
    logo_url: 'https://cdn.soumanager.com/logos/mp.png',
    description: 'Pix dinâmico no balcão e checkout com cartão.',
    settings_schema: { access_token: { type: 'string', required: true } },
    active: true,
    created_at: '2026-11-06T00:00:00Z',
    updated_at: '2026-11-06T00:00:00Z',
  };

  const sampleTenantIntegration: TenantIntegration = {
    id: mockIntegrationId,
    tenant_id: mockTenantId,
    provider_id: mockProviderId,
    status: 'active',
    settings: { auto_sync: true },
    last_synced_at: '2026-11-06T12:00:00Z',
    last_error_message: null,
    created_at: '2026-11-06T10:00:00Z',
    updated_at: '2026-11-06T12:00:00Z',
    provider: sampleProvider,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listProviders', () => {
    it('should_list_active_providers_ordered_by_name', async () => {
      const mockQuery: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [sampleProvider], error: null }),
      };

      const mockClient: any = {
        from: vi.fn().mockReturnValue(mockQuery),
      };

      const result = await integrationService.listProviders(undefined, mockClient);

      expect(mockClient.from).toHaveBeenCalledWith('integration_providers');
      expect(mockQuery.eq).toHaveBeenCalledWith('active', true);
      expect(mockQuery.order).toHaveBeenCalledWith('name', { ascending: true });
      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe('mercado_pago');
    });

    it('should_filter_by_category_when_provided', async () => {
      const mockQuery: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [sampleProvider], error: null }),
      };

      const mockClient: any = {
        from: vi.fn().mockReturnValue(mockQuery),
      };

      const result = await integrationService.listProviders('payment_gateway', mockClient);

      expect(mockQuery.eq).toHaveBeenCalledWith('active', true);
      expect(mockQuery.eq).toHaveBeenCalledWith('category', 'payment_gateway');
      expect(result).toHaveLength(1);
    });

    it('should_throw_error_when_db_fails', async () => {
      const mockQuery: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: new Error('DB Provider Error') }),
      };

      const mockClient: any = {
        from: vi.fn().mockReturnValue(mockQuery),
      };

      await expect(integrationService.listProviders(undefined, mockClient)).rejects.toThrow(
        'DB Provider Error'
      );
    });
  });

  describe('getProviderBySlug', () => {
    it('should_return_provider_when_slug_matches', async () => {
      const mockQuery: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: sampleProvider, error: null }),
      };

      const mockClient: any = {
        from: vi.fn().mockReturnValue(mockQuery),
      };

      const result = await integrationService.getProviderBySlug('mercado_pago', mockClient);

      expect(mockClient.from).toHaveBeenCalledWith('integration_providers');
      expect(mockQuery.eq).toHaveBeenCalledWith('slug', 'mercado_pago');
      expect(result).toEqual(sampleProvider);
    });

    it('should_return_null_for_empty_slug_or_not_found', async () => {
      const mockQuery: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      };

      const mockClient: any = {
        from: vi.fn().mockReturnValue(mockQuery),
      };

      const r1 = await integrationService.getProviderBySlug('', mockClient);
      expect(r1).toBeNull();

      const r2 = await integrationService.getProviderBySlug('inexistente', mockClient);
      expect(r2).toBeNull();
    });
  });

  describe('listTenantIntegrations & configureTenantIntegration', () => {
    it('should_throw_error_if_tenant_id_missing_when_listing', async () => {
      await expect(integrationService.listTenantIntegrations('')).rejects.toThrow(
        'tenantId é obrigatório'
      );
    });

    it('should_list_tenant_integrations_with_provider_join', async () => {
      const mockQuery: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [sampleTenantIntegration], error: null }),
      };

      const mockClient: any = {
        from: vi.fn().mockReturnValue(mockQuery),
      };

      const result = await integrationService.listTenantIntegrations(mockTenantId, mockClient);

      expect(mockClient.from).toHaveBeenCalledWith('tenant_integrations');
      expect(mockQuery.eq).toHaveBeenCalledWith('tenant_id', mockTenantId);
      expect(result).toHaveLength(1);
      expect(result[0].provider_id).toBe(mockProviderId);
    });

    it('should_configure_integration_by_upserting_active_status', async () => {
      const mockQuery: any = {
        upsert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: sampleTenantIntegration,
          error: null,
        }),
      };

      const mockClient: any = {
        from: vi.fn().mockReturnValue(mockQuery),
      };

      const result = await integrationService.configureTenantIntegration(
        {
          tenantId: mockTenantId,
          providerId: mockProviderId,
          credentials: { token: 'sec_123' },
          settings: { auto_sync: true },
        },
        mockClient
      );

      expect(mockClient.from).toHaveBeenCalledWith('tenant_integrations');
      expect(mockQuery.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: mockTenantId,
          provider_id: mockProviderId,
          status: 'active',
          encrypted_credentials: { token: 'sec_123' },
        }),
        { onConflict: 'tenant_id,provider_id' }
      );
      expect(result.status).toBe('active');
    });

    it('should_throw_error_if_required_fields_missing_in_configuration', async () => {
      await expect(
        integrationService.configureTenantIntegration({ tenantId: '', providerId: 'p1' })
      ).rejects.toThrow('tenantId e providerId são obrigatórios');
    });
  });

  describe('disableTenantIntegration', () => {
    it('should_disable_integration_by_updating_status', async () => {
      const mockQuery: any = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      };
      mockQuery.eq.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });

      const mockClient: any = {
        from: vi.fn().mockReturnValue(mockQuery),
      };

      const success = await integrationService.disableTenantIntegration(
        mockTenantId,
        mockIntegrationId,
        mockClient
      );

      expect(success).toBe(true);
      expect(mockClient.from).toHaveBeenCalledWith('tenant_integrations');
      expect(mockQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'disabled' })
      );
    });
  });

  describe('recordSyncLog & listSyncLogs', () => {
    it('should_record_sync_log_via_rpc_when_available', async () => {
      const rpcResult = {
        success: true,
        log_id: 'log-uuid-777',
        status: 'success',
      };

      const mockClient: any = {
        rpc: vi.fn().mockResolvedValue({ data: rpcResult, error: null }),
      };

      const result = await integrationService.recordSyncLog(
        {
          tenantId: mockTenantId,
          integrationId: mockIntegrationId,
          eventType: 'nfse.issued',
          direction: 'outbound',
          status: 'success',
          externalRefId: 'nfse-999',
          durationMs: 450,
        },
        mockClient
      );

      expect(mockClient.rpc).toHaveBeenCalledWith('record_integration_sync_event', {
        p_integration_id: mockIntegrationId,
        p_event_type: 'nfse.issued',
        p_direction: 'outbound',
        p_status: 'success',
        p_external_ref_id: 'nfse-999',
        p_duration_ms: 450,
        p_details: {},
        p_error_message: null,
      });
      expect(result.success).toBe(true);
      expect(result.log_id).toBe('log-uuid-777');
    });

    it('should_fallback_to_direct_insert_when_rpc_is_unavailable', async () => {
      const mockClient: any = {
        rpc: vi.fn().mockResolvedValue({ data: null, error: new Error('RPC not available') }),
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'integration_sync_logs') {
            return {
              insert: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: { id: 'fallback-log-id' }, error: null }),
            };
          }
          if (table === 'tenant_integrations') {
            const eqChain = { eq: vi.fn().mockResolvedValue({ error: null }) };
            return {
              update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue(eqChain) }),
            };
          }
          return {};
        }),
      };

      const result = await integrationService.recordSyncLog(
        {
          tenantId: mockTenantId,
          integrationId: mockIntegrationId,
          eventType: 'payment.received',
          direction: 'inbound',
          status: 'success',
        },
        mockClient
      );

      expect(result.success).toBe(true);
      expect(result.log_id).toBe('fallback-log-id');
    });

    it('should_list_sync_logs_for_tenant', async () => {
      const sampleLog: IntegrationSyncLog = {
        id: 'log-01',
        tenant_id: mockTenantId,
        integration_id: mockIntegrationId,
        event_type: 'payment.pix_received',
        direction: 'inbound',
        status: 'success',
        external_ref_id: 'pix-12345',
        duration_ms: 120,
        details: { amount: 65.0 },
        error_message: null,
        created_at: '2026-11-06T12:00:00Z',
      };

      const mockQuery: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [sampleLog], error: null }),
      };

      const mockClient: any = {
        from: vi.fn().mockReturnValue(mockQuery),
      };

      const logs = await integrationService.listSyncLogs(mockTenantId, mockIntegrationId, 20, mockClient);

      expect(mockClient.from).toHaveBeenCalledWith('integration_sync_logs');
      expect(mockQuery.eq).toHaveBeenCalledWith('tenant_id', mockTenantId);
      expect(mockQuery.eq).toHaveBeenCalledWith('integration_id', mockIntegrationId);
      expect(logs).toHaveLength(1);
      expect(logs[0].event_type).toBe('payment.pix_received');
    });
  });
});
