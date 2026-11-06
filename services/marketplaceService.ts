import { supabase as defaultSupabase } from './supabaseClient';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  MarketplaceExtension,
  TenantExtension,
  ExtensionReview,
  ExtensionWithInstallation,
  ListExtensionsOptions,
  InstallExtensionResult,
} from '../src/types/marketplace';

export const marketplaceService = {
  /**
   * Lista o catálogo de extensões disponíveis, com filtros opcionais por categoria, busca textual e paginação.
   * Por padrão, retorna apenas extensões publicadas e ativas.
   */
  async listExtensions(
    options: ListExtensionsOptions = {},
    client: SupabaseClient = defaultSupabase
  ): Promise<MarketplaceExtension[]> {
    const status = options.status || 'published';
    const includeInactive = options.includeInactive ?? false;
    const limit = options.limit || 50;
    const offset = options.offset || 0;

    let query = client
      .from('marketplace_extensions')
      .select('*')
      .eq('status', status);

    if (!includeInactive) {
      query = query.eq('active', true);
    }

    if (options.category) {
      query = query.eq('category', options.category);
    }

    if (options.search && options.search.trim() !== '') {
      const term = `%${options.search.trim()}%`;
      query = query.or(`name.ilike.${term},headline.ilike.${term}`);
    }

    query = query
      .order('install_count', { ascending: false })
      .order('rating_avg', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error } = await query;
    if (error) {
      console.error('[MarketplaceService] Erro ao listar extensões:', error);
      throw error;
    }

    return (data || []) as MarketplaceExtension[];
  },

  /**
   * Busca os detalhes completos de uma extensão pelo seu slug identificador.
   */
  async getExtensionBySlug(
    slug: string,
    client: SupabaseClient = defaultSupabase
  ): Promise<MarketplaceExtension | null> {
    if (!slug || slug.trim() === '') {
      return null;
    }

    const { data, error } = await client
      .from('marketplace_extensions')
      .select('*')
      .eq('slug', slug.trim())
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Não encontrada
      }
      console.error(`[MarketplaceService] Erro ao buscar extensão slug "${slug}":`, error);
      throw error;
    }

    return data as MarketplaceExtension;
  },

  /**
   * Lista as extensões instaladas pelo tenant informado, incluindo metadados da extensão.
   */
  async listTenantInstalledExtensions(
    tenantId: string,
    client: SupabaseClient = defaultSupabase
  ): Promise<TenantExtension[]> {
    if (!tenantId) {
      throw new Error('tenantId é obrigatório para listar extensões instaladas.');
    }

    const { data, error } = await client
      .from('tenant_extensions')
      .select(`
        *,
        extension:marketplace_extensions (*)
      `)
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .order('installed_at', { ascending: false });

    if (error) {
      console.error(`[MarketplaceService] Erro ao carregar instalações do tenant ${tenantId}:`, error);
      throw error;
    }

    return (data || []) as TenantExtension[];
  },

  /**
   * Lista o catálogo de extensões mesclado com o status de instalação para um tenant específico.
   */
  async listExtensionsForTenant(
    tenantId: string,
    options: ListExtensionsOptions = {},
    client: SupabaseClient = defaultSupabase
  ): Promise<ExtensionWithInstallation[]> {
    const [extensions, installed] = await Promise.all([
      this.listExtensions(options, client),
      this.listTenantInstalledExtensions(tenantId, client),
    ]);

    const installedMap = new Map<string, TenantExtension>();
    for (const inst of installed) {
      installedMap.set(inst.extension_id, inst);
    }

    return extensions.map((ext) => {
      const installation = installedMap.get(ext.id) || null;
      return {
        ...ext,
        is_installed: Boolean(installation && installation.status === 'active'),
        installation,
      };
    });
  },

  /**
   * Instala uma extensão para o tenant via RPC canônica `install_marketplace_extension`.
   * Se a RPC não estiver disponível (ex: modo mock ou ambiente local de teste), utiliza upsert defensivo.
   */
  async installExtension(
    tenantId: string,
    extensionId: string,
    settings: Record<string, unknown> = {},
    client: SupabaseClient = defaultSupabase
  ): Promise<InstallExtensionResult> {
    if (!tenantId) throw new Error('tenantId é obrigatório para instalar extensão.');
    if (!extensionId) throw new Error('extensionId é obrigatório para instalar extensão.');

    // 1. Tentar execução via RPC canônica
    const { data: rpcData, error: rpcError } = await client.rpc(
      'install_marketplace_extension',
      {
        p_extension_id: extensionId,
        p_settings: settings,
      }
    );

    if (!rpcError && rpcData) {
      return rpcData as InstallExtensionResult;
    }

    // 2. Fallback defensivo com verificação prévia da extensão
    const { data: ext, error: extError } = await client
      .from('marketplace_extensions')
      .select('status, active, required_scopes')
      .eq('id', extensionId)
      .single();

    if (extError || !ext) {
      throw new Error('Extensão não encontrada no catálogo.');
    }

    if (ext.status !== 'published' || !ext.active) {
      throw new Error(`Extensão indisponível para instalação (status: ${ext.status}).`);
    }

    const { data: installData, error: installError } = await client
      .from('tenant_extensions')
      .upsert(
        {
          tenant_id: tenantId,
          extension_id: extensionId,
          status: 'active',
          granted_scopes: ext.required_scopes || [],
          settings,
          installed_at: new Date().toISOString(),
          uninstalled_at: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id,extension_id' }
      )
      .select()
      .single();

    if (installError) {
      console.error(`[MarketplaceService] Erro ao instalar extensão ${extensionId}:`, installError);
      throw installError;
    }

    return {
      success: true,
      tenant_id: installData.tenant_id,
      extension_id: installData.extension_id,
      status: installData.status,
      granted_scopes: installData.granted_scopes,
      installed_at: installData.installed_at,
    };
  },

  /**
   * Desinstala uma extensão para o tenant, marcando status como 'uninstalled'.
   */
  async uninstallExtension(
    tenantId: string,
    extensionId: string,
    client: SupabaseClient = defaultSupabase
  ): Promise<boolean> {
    if (!tenantId || !extensionId) {
      throw new Error('tenantId e extensionId são obrigatórios para desinstalar extensão.');
    }

    const { error } = await client
      .from('tenant_extensions')
      .update({
        status: 'uninstalled',
        uninstalled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('extension_id', extensionId);

    if (error) {
      console.error(`[MarketplaceService] Erro ao desinstalar extensão ${extensionId}:`, error);
      throw error;
    }

    return true;
  },

  /**
   * Atualiza as configurações customizadas (`settings` JSONB) de uma extensão instalada.
   */
  async updateExtensionSettings(
    tenantId: string,
    extensionId: string,
    newSettings: Record<string, unknown>,
    client: SupabaseClient = defaultSupabase
  ): Promise<TenantExtension> {
    if (!tenantId || !extensionId) {
      throw new Error('tenantId e extensionId são obrigatórios.');
    }

    const { data, error } = await client
      .from('tenant_extensions')
      .update({
        settings: newSettings,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('extension_id', extensionId)
      .select()
      .single();

    if (error) {
      console.error(`[MarketplaceService] Erro ao atualizar configurações da extensão ${extensionId}:`, error);
      throw error;
    }

    return data as TenantExtension;
  },

  /**
   * Lista as avaliações registradas para uma extensão.
   */
  async listExtensionReviews(
    extensionId: string,
    client: SupabaseClient = defaultSupabase
  ): Promise<ExtensionReview[]> {
    if (!extensionId) {
      return [];
    }

    const { data, error } = await client
      .from('extension_reviews')
      .select('*')
      .eq('extension_id', extensionId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`[MarketplaceService] Erro ao listar avaliações da extensão ${extensionId}:`, error);
      throw error;
    }

    return (data || []) as ExtensionReview[];
  },

  /**
   * Cria ou atualiza a avaliação de um tenant para uma extensão (nota de 1 a 5).
   */
  async submitReview(
    tenantId: string,
    extensionId: string,
    userId: string,
    rating: number,
    comment?: string,
    client: SupabaseClient = defaultSupabase
  ): Promise<ExtensionReview> {
    if (!tenantId || !extensionId || !userId) {
      throw new Error('tenantId, extensionId e userId são obrigatórios.');
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new Error('A nota da avaliação deve ser um número inteiro entre 1 e 5.');
    }

    const { data, error } = await client
      .from('extension_reviews')
      .upsert(
        {
          tenant_id: tenantId,
          extension_id: extensionId,
          user_id: userId,
          rating,
          comment: comment ? comment.trim() : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'extension_id,tenant_id' }
      )
      .select()
      .single();

    if (error) {
      console.error(`[MarketplaceService] Erro ao registrar avaliação para extensão ${extensionId}:`, error);
      throw error;
    }

    return data as ExtensionReview;
  },
};
