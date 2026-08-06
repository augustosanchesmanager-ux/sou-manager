/**
 * [SMG][DOMAIN][USER_TENANT] repository
 *
 * RESPONSABILIDADE: Gerencia o vínculo usuário↔tenant (tabela user_tenants).
 *
 * GARANTIAS:
 *   - Lança RepositoryError em falhas (nunca retorna { data, error })
 *   - Zero conhecimento de React, UI, navigate, toast
 */

import { SupabaseRepository } from '../shared/supabase-repository';
import { createSupabaseClient } from '../shared/supabase-client-factory';
import type { DatabaseClient } from '../shared/database-client';
import type { AddUserTenantInput, UserTenant } from './types';

export { RepositoryError } from '../shared/errors';

const toUserTenant = (row: Record<string, unknown>): UserTenant => ({
  id: row.id as string,
  userId: row.user_id as string,
  tenantId: row.tenant_id as string,
  role: row.role as string,
  isPrimary: Boolean(row.is_primary),
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string,
});

export interface UserTenantRepository {
  listByUser(userId: string): Promise<UserTenant[]>;
  listByTenant(tenantId: string): Promise<UserTenant[]>;
  add(input: AddUserTenantInput): Promise<UserTenant>;
}

class UserTenantRepositoryImpl extends SupabaseRepository implements UserTenantRepository {
  constructor(db?: DatabaseClient) {
    super('user_tenants', db ?? createSupabaseClient('user_tenants', 'barber'));
  }

  async listByUser(userId: string): Promise<UserTenant[]> {
    try {
      const result = await this.from()
        .select('*')
        .eq('user_id', userId);
      const data = this.extractData<Record<string, unknown>[] | null>(result, 'Erro ao listar vínculos');
      return (data ?? []).map(toUserTenant);
    } catch (err) {
      this.throwOnError(err, 'Erro ao listar vínculos');
    }
  }

  async listByTenant(tenantId: string): Promise<UserTenant[]> {
    try {
      const result = await this.from()
        .select('*')
        .eq('tenant_id', tenantId);
      const data = this.extractData<Record<string, unknown>[] | null>(result, 'Erro ao listar vínculos');
      return (data ?? []).map(toUserTenant);
    } catch (err) {
      this.throwOnError(err, 'Erro ao listar vínculos');
    }
  }

  async add(input: AddUserTenantInput): Promise<UserTenant> {
    try {
      const result = await this.from()
        .insert({
          user_id: input.userId,
          tenant_id: input.tenantId,
          role: input.role,
          is_primary: input.isPrimary ?? false,
        })
        .select()
        .single();
      const data = this.extractData<Record<string, unknown>>(result, 'Erro ao criar vínculo');
      return toUserTenant(data);
    } catch (err) {
      this.throwOnError(err, 'Erro ao criar vínculo');
    }
  }
}

export const userTenantRepository: UserTenantRepository = new UserTenantRepositoryImpl();
