/**
 * [SMG][DOMAIN][TENANT] repository
 *
 * RESPONSABILIDADE: Acesso a dados da tabela tenants.
 *   Operações: getById, getBySlug, existsBySlug.
 *
 * NÃO FAZ:
 *   - Criação de tenants (usa RPC provision_new_tenant)
 *   - Ativação de tenants (usa RPC complete_onboarding)
 *   - Validações de negócio (Application Service)
 *
 * DEPENDÊNCIAS: Supabase via SupabaseRepository base
 *
 * GARANTIAS:
 *   - Lança RepositoryError em falhas
 *   - Zero conhecimento de React, UI, navigate, toast
 */

import { SupabaseRepository } from '../shared/supabase-repository';
import { createSupabaseClient } from '../shared/supabase-client-factory';
import type { DatabaseClient } from '../shared/database-client';
import type { Tenant } from './types';

export { RepositoryError } from '../shared/errors';

const toTenant = (row: Record<string, unknown>): Tenant => ({
  id: row.id as string,
  name: row.name as string,
  slug: row.slug as string,
  status: (row.status as Tenant['status']) || 'draft',
  plan: (row.plan as Tenant['plan']) || 'free',
  app_slug: (row.app_slug as string) || 'barber',
  first_appointment_at: (row.first_appointment_at as string) ?? null,
  created_at: row.created_at as string,
  updated_at: row.updated_at as string,
});

class TenantRepositoryImpl extends SupabaseRepository {
  constructor(db?: DatabaseClient) {
    super('tenants', db ?? createSupabaseClient('tenants', 'barber'));
  }

  async getById(id: string): Promise<Tenant | null> {
    try {
      const result = await this.from()
        .select('*')
        .eq('id', id)
        .single();
      const data = this.extractData(result, 'Erro ao buscar tenant');
      return data ? toTenant(data as Record<string, unknown>) : null;
    } catch (err) {
      if (err instanceof Error && 'code' in err && (err as any).code === 'PGRST116') return null;
      this.throwOnError(err, 'Erro ao buscar tenant');
    }
  }

  async getBySlug(slug: string): Promise<Tenant | null> {
    try {
      const result = await this.from()
        .select('*')
        .eq('slug', slug)
        .single();
      const data = this.extractData(result, 'Erro ao buscar tenant por slug');
      return data ? toTenant(data as Record<string, unknown>) : null;
    } catch (err) {
      if (err instanceof Error && 'code' in err && (err as any).code === 'PGRST116') return null;
      this.throwOnError(err, 'Erro ao buscar tenant por slug');
    }
  }

  async existsBySlug(slug: string): Promise<boolean> {
    try {
      const result = await this.from()
        .select('id')
        .eq('slug', slug)
        .maybeSingle();
      const data = this.extractData<{ id: string } | null>(result, 'Erro ao verificar slug');
      return data !== null;
    } catch (err) {
      this.throwOnError(err, 'Erro ao verificar slug');
    }
  }

  /**
   * Aplica transição de status de tenant. Usado exclusivamente pelo
   * TenantLifecycleService (writer único — ADR-013 §3.1).
   */
  async updateStatus(tenantId: string, status: Tenant['status']): Promise<Tenant> {
    try {
      const result = await this.from()
        .update({ status })
        .eq('id', tenantId)
        .select('*')
        .single();
      const data = this.extractData(result, 'Erro ao atualizar status do tenant');
      return toTenant(data as Record<string, unknown>);
    } catch (err) {
      this.throwOnError(err, 'Erro ao atualizar status do tenant');
    }
  }
}

export interface TenantRepository {
  getById(id: string): Promise<Tenant | null>;
  getBySlug(slug: string): Promise<Tenant | null>;
  existsBySlug(slug: string): Promise<boolean>;
  /** Transição de status — uso exclusivo do TenantLifecycleService (ADR-013 §3.1). */
  updateStatus(tenantId: string, status: Tenant['status']): Promise<Tenant>;
}

export const tenantRepository: TenantRepository = new TenantRepositoryImpl();
