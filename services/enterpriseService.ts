import { supabase as defaultSupabase } from './supabaseClient';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  EnterpriseAuditLog,
  EnterpriseDataExport,
  RecordAuditLogInput,
  RequestExportInput,
  RequestExportResult,
  AuditLogFilters,
  PaginatedAuditLogsResult,
  ExportStatus,
} from '../src/types/enterprise';

export const enterpriseService = {
  /**
   * Lista logs de auditoria corporativa com suporte a filtros e paginação.
   */
  async listAuditLogs(
    tenantId: string,
    filters: AuditLogFilters = {},
    page = 1,
    pageSize = 20,
    client: SupabaseClient = defaultSupabase
  ): Promise<PaginatedAuditLogsResult> {
    if (!tenantId || tenantId.trim() === '') {
      throw new Error('Tenant ID é obrigatório para consultar logs de auditoria.');
    }

    const currentPage = Math.max(1, page);
    const limit = Math.max(1, Math.min(100, pageSize));
    const offset = (currentPage - 1) * limit;

    let query = client
      .from('enterprise_audit_logs')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId.trim());

    if (filters.category) {
      query = query.eq('category', filters.category);
    }

    if (filters.severity) {
      query = query.eq('severity', filters.severity);
    }

    if (filters.action && filters.action.trim() !== '') {
      query = query.ilike('action', `%${filters.action.trim()}%`);
    }

    if (filters.resource_type && filters.resource_type.trim() !== '') {
      query = query.eq('resource_type', filters.resource_type.trim());
    }

    if (filters.from_date) {
      query = query.gte('created_at', filters.from_date);
    }

    if (filters.to_date) {
      query = query.lte('created_at', filters.to_date);
    }

    if (filters.search && filters.search.trim() !== '') {
      const term = filters.search.trim();
      query = query.or(
        `action.ilike.%${term}%,resource_type.ilike.%${term}%,actor_email.ilike.%${term}%`
      );
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('[EnterpriseService] Erro ao listar logs de auditoria:', error);
      throw error;
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    return {
      data: (data || []) as EnterpriseAuditLog[],
      total,
      page: currentPage,
      pageSize: limit,
      totalPages: totalPages === 0 && total === 0 ? 0 : Math.max(1, totalPages),
    };
  },

  /**
   * Registra um evento de auditoria corporativa via RPC segura (SECURITY DEFINER).
   */
  async recordAuditEvent(
    input: RecordAuditLogInput,
    client: SupabaseClient = defaultSupabase
  ): Promise<string> {
    if (!input.action || input.action.trim() === '') {
      throw new Error('Ação (action) é obrigatória para registrar log de auditoria.');
    }
    if (!input.category) {
      throw new Error('Categoria (category) é obrigatória para registrar log de auditoria.');
    }

    const validCategories = ['security', 'financial', 'compliance_lgpd', 'operational', 'system'];
    if (!validCategories.includes(input.category)) {
      throw new Error(
        `Categoria inválida: ${input.category}. Categorias permitidas: ${validCategories.join(', ')}`
      );
    }

    const validSeverities = ['info', 'warning', 'critical'];
    if (input.severity && !validSeverities.includes(input.severity)) {
      throw new Error(
        `Severidade inválida: ${input.severity}. Severidades permitidas: ${validSeverities.join(', ')}`
      );
    }

    const { data, error } = await client.rpc('record_enterprise_audit_event', {
      p_tenant_id: input.tenant_id || null,
      p_action: input.action.trim(),
      p_category: input.category,
      p_severity: input.severity || 'info',
      p_resource_type: input.resource_type || 'system',
      p_resource_id: input.resource_id || null,
      p_details: input.details || {},
      p_actor_email: input.actor_email || null,
      p_actor_role: input.actor_role || null,
      p_ip_address: input.ip_address || null,
      p_user_agent: input.user_agent || null,
    });

    if (error) {
      console.error('[EnterpriseService] Erro ao registrar evento de auditoria:', error);
      throw error;
    }

    return data as string;
  },

  /**
   * Solicita exportação de dados corporativos / portabilidade LGPD com auto-auditoria via RPC.
   */
  async requestDataExport(
    input: RequestExportInput,
    client: SupabaseClient = defaultSupabase
  ): Promise<RequestExportResult> {
    if (!input.export_type) {
      throw new Error('Tipo de exportação (export_type) é obrigatório.');
    }

    const validTypes = ['customers_lgpd', 'financial_ledger', 'appointments_history', 'full_backup'];
    if (!validTypes.includes(input.export_type)) {
      throw new Error(
        `Tipo de exportação inválido: ${input.export_type}. Tipos permitidos: ${validTypes.join(', ')}`
      );
    }

    let days = input.expires_days ?? 7;
    if (days < 1 || days > 30) {
      days = 7;
    }

    const { data, error } = await client.rpc('request_enterprise_data_export', {
      p_tenant_id: input.tenant_id || null,
      p_export_type: input.export_type,
      p_expires_days: days,
    });

    if (error) {
      console.error('[EnterpriseService] Erro ao solicitar exportação de dados:', error);
      throw error;
    }

    return data as RequestExportResult;
  },

  /**
   * Lista as solicitações de exportação de dados de um tenant.
   */
  async listDataExports(
    tenantId: string,
    client: SupabaseClient = defaultSupabase
  ): Promise<EnterpriseDataExport[]> {
    if (!tenantId || tenantId.trim() === '') {
      throw new Error('Tenant ID é obrigatório para listar exportações de dados.');
    }

    const { data, error } = await client
      .from('enterprise_data_exports')
      .select('*')
      .eq('tenant_id', tenantId.trim())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[EnterpriseService] Erro ao listar exportações de dados:', error);
      throw error;
    }

    return (data || []) as EnterpriseDataExport[];
  },

  /**
   * Busca detalhes de uma exportação de dados específica.
   */
  async getExportById(
    exportId: string,
    tenantId?: string,
    client: SupabaseClient = defaultSupabase
  ): Promise<EnterpriseDataExport | null> {
    if (!exportId || exportId.trim() === '') {
      return null;
    }

    let query = client
      .from('enterprise_data_exports')
      .select('*')
      .eq('id', exportId.trim());

    if (tenantId && tenantId.trim() !== '') {
      query = query.eq('tenant_id', tenantId.trim());
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error('[EnterpriseService] Erro ao buscar exportação por ID:', error);
      throw error;
    }

    return data as EnterpriseDataExport | null;
  },

  /**
   * Atualiza o status e metadados de uma exportação de dados (uso do worker/job de exportação).
   */
  async updateExportStatus(
    exportId: string,
    status: ExportStatus,
    metadata?: {
      recordCount?: number;
      fileUrl?: string;
      checksumSha256?: string;
      completedAt?: string;
    },
    client: SupabaseClient = defaultSupabase
  ): Promise<EnterpriseDataExport> {
    if (!exportId || exportId.trim() === '') {
      throw new Error('Export ID é obrigatório para atualizar status.');
    }

    const payload: Record<string, unknown> = {
      status,
    };

    if (metadata?.recordCount !== undefined) {
      payload.record_count = metadata.recordCount;
    }
    if (metadata?.fileUrl !== undefined) {
      payload.file_url = metadata.fileUrl;
    }
    if (metadata?.checksumSha256 !== undefined) {
      payload.file_checksum_sha256 = metadata.checksumSha256;
    }
    if (metadata?.completedAt !== undefined) {
      payload.completed_at = metadata.completedAt;
    } else if (status === 'completed' || status === 'failed') {
      payload.completed_at = new Date().toISOString();
    }

    const { data, error } = await client
      .from('enterprise_data_exports')
      .update(payload)
      .eq('id', exportId.trim())
      .select('*')
      .single();

    if (error) {
      console.error('[EnterpriseService] Erro ao atualizar status da exportação:', error);
      throw error;
    }

    return data as EnterpriseDataExport;
  },
};
