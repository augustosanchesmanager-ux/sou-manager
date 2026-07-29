/**
 * [SMG][DOMAIN][TENANT_SETTINGS] repository
 *
 * RESPONSABILIDADE: Acesso a dados da tabela tenant_settings.
 *   Operações: getByTenantId, upsert.
 *
 * NÃO FAZ:
 *   - Criação do tenant (Application Service)
 *   - Ativação do tenant (usa RPC complete_onboarding)
 *   - Validações de negócio (Application Service)
 *
 * DEPENDÊNCIAS: Supabase via SupabaseRepository base
 *
 * GARANTIAS:
 *   - Todas as operações filtram por tenant_id
 *   - Lança RepositoryError em falhas
 *   - Zero conhecimento de React, UI, navigate, toast
 */

import { SupabaseRepository } from '../shared/supabase-repository';
import { createSupabaseClient } from '../shared/supabase-client-factory';
import type { DatabaseClient } from '../shared/database-client';
import type { TenantSettings, CreateTenantSettingsInput } from './types';

export { RepositoryError } from '../shared/errors';

const toTenantSettings = (row: Record<string, unknown>): TenantSettings => ({
  id: row.id as string,
  tenant_id: row.tenant_id as string,
  chair_count: (row.chair_count as number) ?? null,
  business_hours: (row.business_hours as TenantSettings['business_hours']) ?? null,
  phone: (row.phone as string) ?? null,
  cnpj: (row.cnpj as string) ?? null,
  address_street: (row.address_street as string) ?? null,
  address_number: (row.address_number as string) ?? null,
  address_city: (row.address_city as string) ?? null,
  address_state: (row.address_state as string) ?? null,
  address_zip: (row.address_zip as string) ?? null,
  created_at: row.created_at as string,
  updated_at: row.updated_at as string,
});

class TenantSettingsRepositoryImpl extends SupabaseRepository {
  constructor(db?: DatabaseClient) {
    super('tenant_settings', db ?? createSupabaseClient('tenant_settings', 'barber'));
  }

  async getByTenantId(tenantId: string): Promise<TenantSettings | null> {
    try {
      const result = await this.from()
        .select('*')
        .eq('tenant_id', tenantId)
        .single();
      const data = this.extractData(result, 'Erro ao buscar configurações do tenant');
      return data ? toTenantSettings(data as Record<string, unknown>) : null;
    } catch (err) {
      if (err instanceof Error && 'code' in err && (err as any).code === 'PGRST116') return null;
      this.throwOnError(err, 'Erro ao buscar configurações do tenant');
    }
  }

  async upsert(input: CreateTenantSettingsInput): Promise<TenantSettings> {
    try {
      const result = await this.from()
        .upsert({
          tenant_id: input.tenant_id,
          chair_count: input.chair_count ?? null,
          business_hours: input.business_hours ?? null,
          phone: input.phone ?? null,
          cnpj: input.cnpj ?? null,
          address_street: input.address_street ?? null,
          address_number: input.address_number ?? null,
          address_city: input.address_city ?? null,
          address_state: input.address_state ?? null,
          address_zip: input.address_zip ?? null,
        }, { onConflict: 'tenant_id' })
        .select()
        .single();
      const data = this.extractData(result, 'Erro ao salvar configurações do tenant');
      return toTenantSettings(data as Record<string, unknown>);
    } catch (err) {
      this.throwOnError(err, 'Erro ao salvar configurações do tenant');
    }
  }
}

export interface TenantSettingsRepository {
  getByTenantId(tenantId: string): Promise<TenantSettings | null>;
  upsert(input: CreateTenantSettingsInput): Promise<TenantSettings>;
}

export const tenantSettingsRepository: TenantSettingsRepository = new TenantSettingsRepositoryImpl();
