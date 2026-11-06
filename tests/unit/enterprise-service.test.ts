import { describe, it, expect, vi, beforeEach } from 'vitest';
import { enterpriseService } from '../../services/enterpriseService';
import type {
  EnterpriseAuditLog,
  EnterpriseDataExport,
  RecordAuditLogInput,
  RequestExportInput,
} from '../../src/types/enterprise';

describe('EnterpriseService — Unit Tests (Subphase 8.10)', () => {
  const mockTenantId = 'tenant-uuid-enterprise-01';
  const mockLogId = 'log-uuid-abc-123';
  const mockExportId = 'export-uuid-def-456';
  const mockUserId = 'user-uuid-999';

  const sampleAuditLog: EnterpriseAuditLog = {
    id: mockLogId,
    tenant_id: mockTenantId,
    actor_id: mockUserId,
    actor_email: 'gestor@barbearia.com',
    actor_role: 'owner',
    action: 'staff.permission_changed',
    category: 'security',
    severity: 'warning',
    resource_type: 'staff',
    resource_id: 'staff-uuid-111',
    details: { changes: { role: 'manager' } },
    ip_address: '189.40.20.10',
    user_agent: 'Mozilla/5.0 Chrome',
    created_at: '2026-11-06T04:00:00Z',
  };

  const sampleExport: EnterpriseDataExport = {
    id: mockExportId,
    tenant_id: mockTenantId,
    requested_by: mockUserId,
    export_type: 'customers_lgpd',
    status: 'pending',
    record_count: 0,
    file_url: null,
    file_checksum_sha256: null,
    expires_at: '2026-11-13T04:00:00Z',
    created_at: '2026-11-06T04:00:00Z',
    completed_at: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listAuditLogs', () => {
    it('should_return_paginated_logs_when_valid_tenant', async () => {
      // Arrange
      const mockQueryBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: [sampleAuditLog],
          error: null,
          count: 1,
        }),
      };

      const mockClient: any = {
        from: vi.fn().mockReturnValue(mockQueryBuilder),
      };

      // Act
      const result = await enterpriseService.listAuditLogs(
        mockTenantId,
        {},
        1,
        20,
        mockClient
      );

      // Assert
      expect(mockClient.from).toHaveBeenCalledWith('enterprise_audit_logs');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('tenant_id', mockTenantId);
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('should_apply_category_and_severity_filters_when_provided', async () => {
      // Arrange
      const mockQueryBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: [sampleAuditLog],
          error: null,
          count: 1,
        }),
      };

      const mockClient: any = {
        from: vi.fn().mockReturnValue(mockQueryBuilder),
      };

      // Act
      await enterpriseService.listAuditLogs(
        mockTenantId,
        { category: 'security', severity: 'warning' },
        1,
        10,
        mockClient
      );

      // Assert
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('tenant_id', mockTenantId);
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('category', 'security');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('severity', 'warning');
    });

    it('should_apply_date_range_and_action_filters_when_provided', async () => {
      // Arrange
      const mockQueryBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: [sampleAuditLog],
          error: null,
          count: 1,
        }),
      };

      const mockClient: any = {
        from: vi.fn().mockReturnValue(mockQueryBuilder),
      };

      // Act
      await enterpriseService.listAuditLogs(
        mockTenantId,
        {
          action: 'permission',
          resource_type: 'staff',
          from_date: '2026-11-01T00:00:00Z',
          to_date: '2026-11-06T23:59:59Z',
        },
        1,
        20,
        mockClient
      );

      // Assert
      expect(mockQueryBuilder.ilike).toHaveBeenCalledWith('action', '%permission%');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('resource_type', 'staff');
      expect(mockQueryBuilder.gte).toHaveBeenCalledWith('created_at', '2026-11-01T00:00:00Z');
      expect(mockQueryBuilder.lte).toHaveBeenCalledWith('created_at', '2026-11-06T23:59:59Z');
    });

    it('should_apply_search_term_filter_when_provided', async () => {
      // Arrange
      const mockQueryBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: [sampleAuditLog],
          error: null,
          count: 1,
        }),
      };

      const mockClient: any = {
        from: vi.fn().mockReturnValue(mockQueryBuilder),
      };

      // Act
      await enterpriseService.listAuditLogs(
        mockTenantId,
        { search: 'gestor' },
        1,
        20,
        mockClient
      );

      // Assert
      expect(mockQueryBuilder.or).toHaveBeenCalledWith(
        'action.ilike.%gestor%,resource_type.ilike.%gestor%,actor_email.ilike.%gestor%'
      );
    });

    it('should_throw_error_when_tenant_id_is_empty', async () => {
      // Act & Assert
      await expect(
        enterpriseService.listAuditLogs('')
      ).rejects.toThrow('Tenant ID é obrigatório para consultar logs de auditoria.');
    });

    it('should_throw_error_when_supabase_query_fails', async () => {
      // Arrange
      const mockQueryBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: null,
          error: new Error('Database connection error'),
          count: null,
        }),
      };

      const mockClient: any = {
        from: vi.fn().mockReturnValue(mockQueryBuilder),
      };

      // Act & Assert
      await expect(
        enterpriseService.listAuditLogs(mockTenantId, {}, 1, 20, mockClient)
      ).rejects.toThrow('Database connection error');
    });
  });

  describe('recordAuditEvent', () => {
    it('should_record_event_via_rpc_when_valid_input', async () => {
      // Arrange
      const mockClient: any = {
        rpc: vi.fn().mockResolvedValue({
          data: mockLogId,
          error: null,
        }),
      };

      const input: RecordAuditLogInput = {
        tenant_id: mockTenantId,
        action: 'financial.settlement_closed',
        category: 'financial',
        severity: 'info',
        resource_type: 'cash_closing',
        resource_id: 'closing-uuid-777',
        details: { total_amount: 150000 },
        actor_email: 'caixa@barbearia.com',
        actor_role: 'manager',
      };

      // Act
      const result = await enterpriseService.recordAuditEvent(input, mockClient);

      // Assert
      expect(mockClient.rpc).toHaveBeenCalledWith('record_enterprise_audit_event', {
        p_tenant_id: mockTenantId,
        p_action: 'financial.settlement_closed',
        p_category: 'financial',
        p_severity: 'info',
        p_resource_type: 'cash_closing',
        p_resource_id: 'closing-uuid-777',
        p_details: { total_amount: 150000 },
        p_actor_email: 'caixa@barbearia.com',
        p_actor_role: 'manager',
        p_ip_address: null,
        p_user_agent: null,
      });
      expect(result).toBe(mockLogId);
    });

    it('should_use_default_severity_and_resource_type_when_omitted', async () => {
      // Arrange
      const mockClient: any = {
        rpc: vi.fn().mockResolvedValue({
          data: mockLogId,
          error: null,
        }),
      };

      const input: RecordAuditLogInput = {
        action: 'system.healthcheck',
        category: 'system',
      };

      // Act
      await enterpriseService.recordAuditEvent(input, mockClient);

      // Assert
      expect(mockClient.rpc).toHaveBeenCalledWith(
        'record_enterprise_audit_event',
        expect.objectContaining({
          p_severity: 'info',
          p_resource_type: 'system',
          p_details: {},
        })
      );
    });

    it('should_throw_error_when_action_is_empty', async () => {
      // Act & Assert
      await expect(
        enterpriseService.recordAuditEvent({
          action: '',
          category: 'security',
        })
      ).rejects.toThrow('Ação (action) é obrigatória para registrar log de auditoria.');
    });

    it('should_throw_error_when_category_is_invalid', async () => {
      // Act & Assert
      await expect(
        enterpriseService.recordAuditEvent({
          action: 'test.action',
          category: 'invalid_category' as any,
        })
      ).rejects.toThrow('Categoria inválida: invalid_category');
    });

    it('should_throw_error_when_severity_is_invalid', async () => {
      // Act & Assert
      await expect(
        enterpriseService.recordAuditEvent({
          action: 'test.action',
          category: 'security',
          severity: 'ultra_critical' as any,
        })
      ).rejects.toThrow('Severidade inválida: ultra_critical');
    });

    it('should_throw_error_when_rpc_fails', async () => {
      // Arrange
      const mockClient: any = {
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: new Error('RPC permission denied'),
        }),
      };

      // Act & Assert
      await expect(
        enterpriseService.recordAuditEvent(
          { action: 'auth.login', category: 'security' },
          mockClient
        )
      ).rejects.toThrow('RPC permission denied');
    });
  });

  describe('requestDataExport', () => {
    it('should_request_export_via_rpc_when_valid_input', async () => {
      // Arrange
      const expectedRpcResult = {
        success: true,
        export_id: mockExportId,
        status: 'pending',
        export_type: 'customers_lgpd',
        expires_at: '2026-11-13T04:00:00Z',
      };

      const mockClient: any = {
        rpc: vi.fn().mockResolvedValue({
          data: expectedRpcResult,
          error: null,
        }),
      };

      const input: RequestExportInput = {
        tenant_id: mockTenantId,
        export_type: 'customers_lgpd',
        expires_days: 7,
      };

      // Act
      const result = await enterpriseService.requestDataExport(input, mockClient);

      // Assert
      expect(mockClient.rpc).toHaveBeenCalledWith('request_enterprise_data_export', {
        p_tenant_id: mockTenantId,
        p_export_type: 'customers_lgpd',
        p_expires_days: 7,
      });
      expect(result.success).toBe(true);
      expect(result.export_id).toBe(mockExportId);
    });

    it('should_clamp_expires_days_to_default_when_outside_range', async () => {
      // Arrange
      const mockClient: any = {
        rpc: vi.fn().mockResolvedValue({
          data: { success: true },
          error: null,
        }),
      };

      // Act
      await enterpriseService.requestDataExport(
        { export_type: 'full_backup', expires_days: 50 },
        mockClient
      );

      // Assert
      expect(mockClient.rpc).toHaveBeenCalledWith(
        'request_enterprise_data_export',
        expect.objectContaining({
          p_expires_days: 7,
        })
      );
    });

    it('should_throw_error_when_export_type_is_invalid', async () => {
      // Act & Assert
      await expect(
        enterpriseService.requestDataExport({
          export_type: 'unknown_type' as any,
        })
      ).rejects.toThrow('Tipo de exportação inválido: unknown_type');
    });

    it('should_throw_error_when_rpc_fails', async () => {
      // Arrange
      const mockClient: any = {
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: new Error('RPC export failure'),
        }),
      };

      // Act & Assert
      await expect(
        enterpriseService.requestDataExport(
          { export_type: 'customers_lgpd' },
          mockClient
        )
      ).rejects.toThrow('RPC export failure');
    });
  });

  describe('listDataExports', () => {
    it('should_return_exports_for_tenant', async () => {
      // Arrange
      const mockQueryBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [sampleExport],
          error: null,
        }),
      };

      const mockClient: any = {
        from: vi.fn().mockReturnValue(mockQueryBuilder),
      };

      // Act
      const result = await enterpriseService.listDataExports(mockTenantId, mockClient);

      // Assert
      expect(mockClient.from).toHaveBeenCalledWith('enterprise_data_exports');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('tenant_id', mockTenantId);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockExportId);
    });

    it('should_throw_error_when_tenant_id_is_empty', async () => {
      // Act & Assert
      await expect(enterpriseService.listDataExports('')).rejects.toThrow(
        'Tenant ID é obrigatório para listar exportações de dados.'
      );
    });

    it('should_throw_error_when_query_fails', async () => {
      // Arrange
      const mockQueryBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: null,
          error: new Error('Query error'),
        }),
      };

      const mockClient: any = {
        from: vi.fn().mockReturnValue(mockQueryBuilder),
      };

      // Act & Assert
      await expect(
        enterpriseService.listDataExports(mockTenantId, mockClient)
      ).rejects.toThrow('Query error');
    });
  });

  describe('getExportById', () => {
    it('should_return_export_when_found', async () => {
      // Arrange
      const mockQueryBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: sampleExport,
          error: null,
        }),
      };

      const mockClient: any = {
        from: vi.fn().mockReturnValue(mockQueryBuilder),
      };

      // Act
      const result = await enterpriseService.getExportById(
        mockExportId,
        mockTenantId,
        mockClient
      );

      // Assert
      expect(mockClient.from).toHaveBeenCalledWith('enterprise_data_exports');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', mockExportId);
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('tenant_id', mockTenantId);
      expect(result).toEqual(sampleExport);
    });

    it('should_return_null_when_export_id_is_empty', async () => {
      // Act
      const result = await enterpriseService.getExportById('');

      // Assert
      expect(result).toBeNull();
    });

    it('should_throw_error_when_query_fails', async () => {
      // Arrange
      const mockQueryBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: new Error('Export not found query failure'),
        }),
      };

      const mockClient: any = {
        from: vi.fn().mockReturnValue(mockQueryBuilder),
      };

      // Act & Assert
      await expect(
        enterpriseService.getExportById(mockExportId, undefined, mockClient)
      ).rejects.toThrow('Export not found query failure');
    });
  });

  describe('updateExportStatus', () => {
    it('should_update_status_and_metadata_when_valid', async () => {
      // Arrange
      const updatedExport: EnterpriseDataExport = {
        ...sampleExport,
        status: 'completed',
        record_count: 350,
        file_url: 'https://storage.smg.com/exports/customers_lgpd_01.csv',
        file_checksum_sha256: 'a1b2c3d4e5f6',
        completed_at: '2026-11-06T04:30:00Z',
      };

      const mockQueryBuilder: any = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: updatedExport,
          error: null,
        }),
      };

      const mockClient: any = {
        from: vi.fn().mockReturnValue(mockQueryBuilder),
      };

      // Act
      const result = await enterpriseService.updateExportStatus(
        mockExportId,
        'completed',
        {
          recordCount: 350,
          fileUrl: 'https://storage.smg.com/exports/customers_lgpd_01.csv',
          checksumSha256: 'a1b2c3d4e5f6',
          completedAt: '2026-11-06T04:30:00Z',
        },
        mockClient
      );

      // Assert
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed',
          record_count: 350,
          file_url: 'https://storage.smg.com/exports/customers_lgpd_01.csv',
          file_checksum_sha256: 'a1b2c3d4e5f6',
          completed_at: '2026-11-06T04:30:00Z',
        })
      );
      expect(result.status).toBe('completed');
      expect(result.record_count).toBe(350);
    });

    it('should_throw_error_when_export_id_is_empty', async () => {
      // Act & Assert
      await expect(
        enterpriseService.updateExportStatus('', 'completed')
      ).rejects.toThrow('Export ID é obrigatório para atualizar status.');
    });

    it('should_throw_error_when_update_fails', async () => {
      // Arrange
      const mockQueryBuilder: any = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: new Error('Update error'),
        }),
      };

      const mockClient: any = {
        from: vi.fn().mockReturnValue(mockQueryBuilder),
      };

      // Act & Assert
      await expect(
        enterpriseService.updateExportStatus(mockExportId, 'failed', undefined, mockClient)
      ).rejects.toThrow('Update error');
    });
  });
});
