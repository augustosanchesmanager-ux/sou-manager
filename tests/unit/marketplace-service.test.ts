import { describe, it, expect, vi, beforeEach } from 'vitest';
import { marketplaceService } from '../../services/marketplaceService';
import type { MarketplaceExtension, TenantExtension } from '../../src/types/marketplace';

describe('MarketplaceService — Unit Tests (Subphase 8.4)', () => {
  const mockTenantId = '11111111-1111-1111-1111-111111111111';
  const mockUserId = '99999999-9999-9999-9999-999999999999';
  const mockExtensionId = 'ext-uuid-001';

  const sampleExtension: MarketplaceExtension = {
    id: mockExtensionId,
    slug: 'totem-autoatendimento',
    name: 'Totem de Autoatendimento SMG',
    headline: 'Check-in rápido e abertura de comandas na recepção',
    description: 'Permite que clientes façam check-in ao entrar na barbearia.',
    developer_name: 'SMG Hardware Labs',
    developer_email: 'hardware@soumanager.com',
    developer_url: 'https://hardware.soumanager.com',
    category: 'hardware',
    icon_url: 'https://cdn.soumanager.com/icons/totem.png',
    banner_url: null,
    version: '1.2.0',
    pricing_type: 'subscription',
    price_cents: 9900,
    required_scopes: ['appointments:read', 'comandas:write'],
    webhook_events: ['appointment.created'],
    status: 'published',
    rating_avg: 4.85,
    install_count: 42,
    active: true,
    created_at: '2026-11-06T00:00:00Z',
    updated_at: '2026-11-06T00:00:00Z',
  };

  const sampleTenantExtension: TenantExtension = {
    id: 'inst-uuid-001',
    tenant_id: mockTenantId,
    extension_id: mockExtensionId,
    status: 'active',
    granted_scopes: ['appointments:read', 'comandas:write'],
    settings: { printer_ip: '192.168.1.100' },
    installed_at: '2026-11-06T10:00:00Z',
    uninstalled_at: null,
    created_at: '2026-11-06T10:00:00Z',
    updated_at: '2026-11-06T10:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listExtensions', () => {
    it('should_list_published_active_extensions_ordered_by_install_count', async () => {
      const mockQuery: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: [sampleExtension], error: null }),
      };

      const mockClient: any = {
        from: vi.fn().mockReturnValue(mockQuery),
      };

      const result = await marketplaceService.listExtensions({}, mockClient);

      expect(mockClient.from).toHaveBeenCalledWith('marketplace_extensions');
      expect(mockQuery.eq).toHaveBeenCalledWith('status', 'published');
      expect(mockQuery.eq).toHaveBeenCalledWith('active', true);
      expect(mockQuery.order).toHaveBeenCalledWith('install_count', { ascending: false });
      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe('totem-autoatendimento');
    });

    it('should_filter_by_category_and_search_query_when_provided', async () => {
      const mockQuery: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: [sampleExtension], error: null }),
      };

      const mockClient: any = {
        from: vi.fn().mockReturnValue(mockQuery),
      };

      const result = await marketplaceService.listExtensions(
        { category: 'hardware', search: 'Totem' },
        mockClient
      );

      expect(mockQuery.eq).toHaveBeenCalledWith('category', 'hardware');
      expect(mockQuery.or).toHaveBeenCalledWith('name.ilike.%Totem%,headline.ilike.%Totem%');
      expect(result).toHaveLength(1);
    });

    it('should_throw_error_when_database_fails', async () => {
      const mockQuery: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: null, error: new Error('DB Connection Timeout') }),
      };

      const mockClient: any = {
        from: vi.fn().mockReturnValue(mockQuery),
      };

      await expect(marketplaceService.listExtensions({}, mockClient)).rejects.toThrow('DB Connection Timeout');
    });
  });

  describe('getExtensionBySlug', () => {
    it('should_return_extension_when_found', async () => {
      const mockQuery: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: sampleExtension, error: null }),
      };

      const mockClient: any = {
        from: vi.fn().mockReturnValue(mockQuery),
      };

      const result = await marketplaceService.getExtensionBySlug('totem-autoatendimento', mockClient);

      expect(mockClient.from).toHaveBeenCalledWith('marketplace_extensions');
      expect(mockQuery.eq).toHaveBeenCalledWith('slug', 'totem-autoatendimento');
      expect(result).toEqual(sampleExtension);
    });

    it('should_return_null_when_not_found_or_empty_slug', async () => {
      const mockQuery: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      };

      const mockClient: any = {
        from: vi.fn().mockReturnValue(mockQuery),
      };

      const res1 = await marketplaceService.getExtensionBySlug('', mockClient);
      expect(res1).toBeNull();

      const res2 = await marketplaceService.getExtensionBySlug('inexistente', mockClient);
      expect(res2).toBeNull();
    });
  });

  describe('listTenantInstalledExtensions & listExtensionsForTenant', () => {
    it('should_throw_error_if_tenant_id_missing', async () => {
      await expect(marketplaceService.listTenantInstalledExtensions('')).rejects.toThrow(
        'tenantId é obrigatório'
      );
    });

    it('should_list_tenant_installed_extensions', async () => {
      const mockQuery: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [sampleTenantExtension], error: null }),
      };

      const mockClient: any = {
        from: vi.fn().mockReturnValue(mockQuery),
      };

      const result = await marketplaceService.listTenantInstalledExtensions(mockTenantId, mockClient);

      expect(mockClient.from).toHaveBeenCalledWith('tenant_extensions');
      expect(mockQuery.eq).toHaveBeenCalledWith('tenant_id', mockTenantId);
      expect(mockQuery.eq).toHaveBeenCalledWith('status', 'active');
      expect(result).toHaveLength(1);
      expect(result[0].extension_id).toBe(mockExtensionId);
    });

    it('should_merge_marketplace_catalog_with_tenant_installation_status', async () => {
      const mockClient: any = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'marketplace_extensions') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              range: vi.fn().mockResolvedValue({ data: [sampleExtension], error: null }),
            };
          }
          if (table === 'tenant_extensions') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockResolvedValue({ data: [sampleTenantExtension], error: null }),
            };
          }
          return {};
        }),
      };

      const result = await marketplaceService.listExtensionsForTenant(mockTenantId, {}, mockClient);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockExtensionId);
      expect(result[0].is_installed).toBe(true);
      expect(result[0].installation).toEqual(sampleTenantExtension);
    });
  });

  describe('installExtension', () => {
    it('should_install_via_rpc_when_available', async () => {
      const rpcResult = {
        success: true,
        tenant_id: mockTenantId,
        extension_id: mockExtensionId,
        status: 'active',
        granted_scopes: ['appointments:read', 'comandas:write'],
        installed_at: '2026-11-06T12:00:00Z',
      };

      const mockClient: any = {
        rpc: vi.fn().mockResolvedValue({ data: rpcResult, error: null }),
      };

      const result = await marketplaceService.installExtension(
        mockTenantId,
        mockExtensionId,
        { ip: '10.0.0.1' },
        mockClient
      );

      expect(mockClient.rpc).toHaveBeenCalledWith('install_marketplace_extension', {
        p_extension_id: mockExtensionId,
        p_settings: { ip: '10.0.0.1' },
      });
      expect(result.success).toBe(true);
      expect(result.status).toBe('active');
    });

    it('should_fallback_to_defensive_upsert_when_rpc_fails_or_is_unavailable', async () => {
      const mockClient: any = {
        rpc: vi.fn().mockResolvedValue({ data: null, error: new Error('RPC not found') }),
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'marketplace_extensions') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: { status: 'published', active: true, required_scopes: ['catalog:read'] },
                error: null,
              }),
            };
          }
          if (table === 'tenant_extensions') {
            return {
              upsert: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: {
                  tenant_id: mockTenantId,
                  extension_id: mockExtensionId,
                  status: 'active',
                  granted_scopes: ['catalog:read'],
                  installed_at: '2026-11-06T12:00:00Z',
                },
                error: null,
              }),
            };
          }
          return {};
        }),
      };

      const result = await marketplaceService.installExtension(
        mockTenantId,
        mockExtensionId,
        {},
        mockClient
      );

      expect(result.success).toBe(true);
      expect(result.granted_scopes).toEqual(['catalog:read']);
    });

    it('should_reject_installation_if_extension_is_not_published_or_inactive', async () => {
      const mockClient: any = {
        rpc: vi.fn().mockResolvedValue({ data: null, error: new Error('RPC not found') }),
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { status: 'draft', active: false },
            error: null,
          }),
        }),
      };

      await expect(
        marketplaceService.installExtension(mockTenantId, mockExtensionId, {}, mockClient)
      ).rejects.toThrow('Extensão indisponível para instalação');
    });
  });

  describe('uninstallExtension & updateExtensionSettings', () => {
    it('should_uninstall_extension_by_setting_status_uninstalled', async () => {
      const mockQuery: any = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      };
      mockQuery.eq.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });

      const mockClient: any = {
        from: vi.fn().mockReturnValue(mockQuery),
      };

      const success = await marketplaceService.uninstallExtension(
        mockTenantId,
        mockExtensionId,
        mockClient
      );

      expect(success).toBe(true);
      expect(mockClient.from).toHaveBeenCalledWith('tenant_extensions');
      expect(mockQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'uninstalled' })
      );
    });

    it('should_update_extension_settings_jsonb', async () => {
      const updatedSettings = { theme: 'dark', auto_print: true };
      const mockQuery: any = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      };
      mockQuery.eq.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { ...sampleTenantExtension, settings: updatedSettings },
              error: null,
            }),
          }),
        }),
      });

      const mockClient: any = {
        from: vi.fn().mockReturnValue(mockQuery),
      };

      const result = await marketplaceService.updateExtensionSettings(
        mockTenantId,
        mockExtensionId,
        updatedSettings,
        mockClient
      );

      expect(result.settings).toEqual(updatedSettings);
    });
  });

  describe('Reviews (listExtensionReviews & submitReview)', () => {
    it('should_list_reviews_for_extension', async () => {
      const sampleReview = {
        id: 'rev-01',
        extension_id: mockExtensionId,
        tenant_id: mockTenantId,
        user_id: mockUserId,
        rating: 5,
        comment: 'Excelente totem!',
        created_at: '2026-11-06T12:00:00Z',
      };

      const mockQuery: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [sampleReview], error: null }),
      };

      const mockClient: any = {
        from: vi.fn().mockReturnValue(mockQuery),
      };

      const result = await marketplaceService.listExtensionReviews(mockExtensionId, mockClient);

      expect(mockClient.from).toHaveBeenCalledWith('extension_reviews');
      expect(result).toHaveLength(1);
      expect(result[0].rating).toBe(5);
    });

    it('should_validate_rating_bounds_1_to_5_when_submitting_review', async () => {
      await expect(
        marketplaceService.submitReview(mockTenantId, mockExtensionId, mockUserId, 0)
      ).rejects.toThrow('A nota da avaliação deve ser um número inteiro entre 1 e 5.');

      await expect(
        marketplaceService.submitReview(mockTenantId, mockExtensionId, mockUserId, 6)
      ).rejects.toThrow('A nota da avaliação deve ser um número inteiro entre 1 e 5.');

      await expect(
        marketplaceService.submitReview(mockTenantId, mockExtensionId, mockUserId, 4.5)
      ).rejects.toThrow('A nota da avaliação deve ser um número inteiro entre 1 e 5.');
    });

    it('should_upsert_review_successfully_when_valid', async () => {
      const mockQuery: any = {
        upsert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'rev-99',
            extension_id: mockExtensionId,
            tenant_id: mockTenantId,
            user_id: mockUserId,
            rating: 5,
            comment: 'Muito bom!',
          },
          error: null,
        }),
      };

      const mockClient: any = {
        from: vi.fn().mockReturnValue(mockQuery),
      };

      const review = await marketplaceService.submitReview(
        mockTenantId,
        mockExtensionId,
        mockUserId,
        5,
        'Muito bom!',
        mockClient
      );

      expect(mockClient.from).toHaveBeenCalledWith('extension_reviews');
      expect(mockQuery.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: mockTenantId,
          extension_id: mockExtensionId,
          user_id: mockUserId,
          rating: 5,
          comment: 'Muito bom!',
        }),
        { onConflict: 'extension_id,tenant_id' }
      );
      expect(review.rating).toBe(5);
    });
  });
});
