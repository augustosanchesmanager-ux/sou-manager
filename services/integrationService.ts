import { supabase as defaultSupabase } from './supabaseClient';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  IntegrationProvider,
  TenantIntegration,
  IntegrationSyncLog,
  ConfigureIntegrationInput,
  RecordSyncLogInput,
  IntegrationCategory,
} from '../src/types/integrations';

export const integrationService = {
  /**
   * Lista os provedores nativos homologados, com filtro opcional por categoria.
   */
  async listProviders(
    category?: IntegrationCategory | string,
    client: SupabaseClient = defaultSupabase
  ): Promise<IntegrationProvider[]> {
    let query = client
      .from('integration_providers')
      .select('*')
      .eq('active', true);

    if (category) {
      query = query.eq('category', category);
    }

    query = query.order('name', { ascending: true });

    const { data, error } = await query;
    if (error) {
      console.error('[IntegrationService] Erro ao listar provedores de integração:', error);
      throw error;
    }

    return (data || []) as IntegrationProvider[];
  },

  /**
   * Busca um provedor pelo slug identificador.
   */
  async getProviderBySlug(
    slug: string,
    client: SupabaseClient = defaultSupabase
  ): Promise<IntegrationProvider | null> {
    if (!slug || slug.trim() === '') {
      return null;
    }

    const { data, error } = await client
      .from('integration_providers')
      .select('*')
      .eq('slug', slug.trim())
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error(`[IntegrationService] Erro ao buscar provedor slug "${slug}":`, error);
      throw error;
    }

    return data as IntegrationProvider;
  },

  /**
   * Lista os conectores ativos/configurados para um tenant específico.
   */
  async listTenantIntegrations(
    tenantId: string,
    client: SupabaseClient = defaultSupabase
  ): Promise<TenantIntegration[]> {
    if (!tenantId) {
      throw new Error('tenantId é obrigatório para listar integrações do tenant.');
    }

    const { data, error } = await client
      .from('tenant_integrations')
      .select(`
        id,
        tenant_id,
        provider_id,
        status,
        settings,
        last_synced_at,
        last_error_message,
        created_at,
        updated_at,
        provider:integration_providers (*)
      `)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`[IntegrationService] Erro ao carregar integrações do tenant ${tenantId}:`, error);
      throw error;
    }

    const integrations = (data || []).map((item: any) => ({
      ...item,
      provider: Array.isArray(item.provider)
        ? (item.provider[0] as IntegrationProvider) || null
        : (item.provider as IntegrationProvider) || null,
    }));

    return integrations as TenantIntegration[];
  },

  /**
   * Configura ou atualiza um conector para a barbearia.
   */
  async configureTenantIntegration(
    input: ConfigureIntegrationInput,
    client: SupabaseClient = defaultSupabase
  ): Promise<TenantIntegration> {
    if (!input.tenantId || !input.providerId) {
      throw new Error('tenantId e providerId são obrigatórios para configurar integração.');
    }

    const { data, error } = await client
      .from('tenant_integrations')
      .upsert(
        {
          tenant_id: input.tenantId,
          provider_id: input.providerId,
          status: 'active',
          encrypted_credentials: input.credentials || {},
          settings: input.settings || {},
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id,provider_id' }
      )
      .select(`
        id,
        tenant_id,
        provider_id,
        status,
        settings,
        last_synced_at,
        last_error_message,
        created_at,
        updated_at
      `)
      .single();

    if (error) {
      console.error('[IntegrationService] Erro ao salvar conector de integração:', error);
      throw error;
    }

    return data as TenantIntegration;
  },

  /**
   * Desativa um conector para o tenant.
   */
  async disableTenantIntegration(
    tenantId: string,
    integrationId: string,
    client: SupabaseClient = defaultSupabase
  ): Promise<boolean> {
    if (!tenantId || !integrationId) {
      throw new Error('tenantId e integrationId são obrigatórios.');
    }

    const { error } = await client
      .from('tenant_integrations')
      .update({
        status: 'disabled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', integrationId)
      .eq('tenant_id', tenantId);

    if (error) {
      console.error(`[IntegrationService] Erro ao desativar integração ${integrationId}:`, error);
      throw error;
    }

    return true;
  },

  /**
   * Registra um evento de auditoria de sincronização via RPC canônica `record_integration_sync_event`
   * com fallback defensivo para insert direto.
   */
  async recordSyncLog(
    input: RecordSyncLogInput,
    client: SupabaseClient = defaultSupabase
  ): Promise<{ success: boolean; log_id: string }> {
    if (!input.tenantId || !input.integrationId || !input.eventType) {
      throw new Error('tenantId, integrationId e eventType são obrigatórios.');
    }

    // 1. Tentar execução via RPC canônica
    const { data: rpcData, error: rpcError } = await client.rpc(
      'record_integration_sync_event',
      {
        p_integration_id: input.integrationId,
        p_event_type: input.eventType,
        p_direction: input.direction,
        p_status: input.status,
        p_external_ref_id: input.externalRefId || null,
        p_duration_ms: input.durationMs || 0,
        p_details: input.details || {},
        p_error_message: input.errorMessage || null,
      }
    );

    if (!rpcError && rpcData) {
      return rpcData as { success: boolean; log_id: string };
    }

    // 2. Fallback defensivo: Inserção direta no log e atualização da integração
    const { data: logData, error: logError } = await client
      .from('integration_sync_logs')
      .insert({
        tenant_id: input.tenantId,
        integration_id: input.integrationId,
        event_type: input.eventType,
        direction: input.direction,
        status: input.status,
        external_ref_id: input.externalRefId || null,
        duration_ms: input.durationMs || 0,
        details: input.details || {},
        error_message: input.errorMessage || null,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (logError) {
      console.error('[IntegrationService] Erro ao registrar log de sincronização:', logError);
      throw logError;
    }

    // Atualizar integração
    await client
      .from('tenant_integrations')
      .update({
        last_synced_at: new Date().toISOString(),
        last_error_message: input.status === 'failed' ? input.errorMessage : null,
        status: input.status === 'failed' ? 'error' : 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.integrationId)
      .eq('tenant_id', input.tenantId);

    return {
      success: true,
      log_id: logData.id,
    };
  },

  /**
   * Consulta o histórico de logs de sincronização para auditoria do tenant.
   */
  async listSyncLogs(
    tenantId: string,
    integrationId?: string,
    limit: number = 50,
    client: SupabaseClient = defaultSupabase
  ): Promise<IntegrationSyncLog[]> {
    if (!tenantId) {
      throw new Error('tenantId é obrigatório para consultar logs de sincronização.');
    }

    let query = client
      .from('integration_sync_logs')
      .select('*')
      .eq('tenant_id', tenantId);

    if (integrationId) {
      query = query.eq('integration_id', integrationId);
    }

    query = query
      .order('created_at', { ascending: false })
      .limit(limit);

    const { data, error } = await query;
    if (error) {
      console.error(`[IntegrationService] Erro ao listar logs de sincronização para tenant ${tenantId}:`, error);
      throw error;
    }

    return (data || []) as IntegrationSyncLog[];
  },
};
