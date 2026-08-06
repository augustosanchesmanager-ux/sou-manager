/**
 * [SMG][DOMAIN][STAFF] repository
 *
 * RESPONSABILIDADE: Gerencia a entidade Staff (tabela staff).
 *   Operações: list, getById, update, delete, exists.
 *
 * NÃO FAZ:
 *   - Criação de usuários via Edge Function (admin-create-user)
 *   - Orquestração de exclusão em cascata
 *   - Validações de negócio complexas (Application Service)
 *
 * DEPENDÊNCIAS: Supabase via SupabaseRepository base
 *
 * GARANTIAS:
 *   - Todas as operações filtram por tenant_id
 *   - Lança RepositoryError em falhas (nunca retorna { data, error })
 *   - update retorna void; delete retorna void; exists retorna boolean
 *   - Zero conhecimento de React, UI, navigate, toast
 */

import { SupabaseRepository } from '../shared/supabase-repository';
import { createSupabaseClient } from '../shared/supabase-client-factory';
import type { DatabaseClient } from '../shared/database-client';
import type { IRepository } from '../shared/repository';
import type { StaffMember, UpdateStaffInput } from './types';
import type { AppSlug } from '../shared/app';

export { RepositoryError } from '../shared/errors';

const toStaffMember = (row: Record<string, unknown>): StaffMember => ({
  id: row.id as string,
  name: row.name as string,
  email: (row.email as string) || '',
  phone: (row.phone as string) || '',
  role: (row.role as string) || 'barber',
  avatar: (row.avatar as string) || '',
  commission_rate: (row.commission_rate as number) || 0,
  status: (row.status as string) || 'active',
});

class StaffRepositoryImpl extends SupabaseRepository {
  constructor(db?: DatabaseClient, appSlug: AppSlug = 'barber') {
    super('staff', db ?? createSupabaseClient('staff', appSlug));
  }

  async list(tenantId: string): Promise<StaffMember[]> {
    try {
      const result = await this.from()
        .select('*')
        .eq('tenant_id', tenantId)
        .order('name');
      return this.extractData<Record<string, unknown>[]>(result, 'Erro ao listar equipe').map(toStaffMember);
    } catch (err) {
      this.throwOnError(err, 'Erro ao listar equipe');
    }
  }

  async get(id: string, tenantId: string): Promise<StaffMember | null> {
    try {
      const result = await this.from()
        .select('*')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .single();
      const data = this.extractData(result, 'Erro ao buscar membro da equipe');
      return data ? toStaffMember(data as Record<string, unknown>) : null;
    } catch (err) {
      if (err instanceof Error && 'code' in err && (err as any).code === 'PGRST116') return null;
      this.throwOnError(err, 'Erro ao buscar membro da equipe');
    }
  }

  async update(id: string, input: UpdateStaffInput, tenantId: string): Promise<void> {
    try {
      const result = await this.from()
        .update(input)
        .eq('id', id)
        .eq('tenant_id', tenantId);
      this.extractData(result, 'Erro ao atualizar membro da equipe');
    } catch (err) {
      this.throwOnError(err, 'Erro ao atualizar membro da equipe');
    }
  }

  async delete(id: string, tenantId: string): Promise<void> {
    try {
      const result = await this.from()
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenantId);
      this.extractData(result, 'Erro ao excluir membro da equipe');
    } catch (err) {
      this.throwOnError(err, 'Erro ao excluir membro da equipe');
    }
  }

  async exists(id: string, tenantId: string): Promise<boolean> {
    try {
      const result = await this.from()
        .select('id')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      const data = this.extractData<{ id: string } | null>(result, 'Erro ao verificar membro da equipe');
      return data !== null;
    } catch (err) {
      this.throwOnError(err, 'Erro ao verificar membro da equipe');
    }
  }

  async listForCommission(tenantId: string): Promise<Array<{ id: string; name: string; role?: string; avatar?: string; commission_rate?: number | null }>> {
    try {
      const result = await this.from()
        .select('id, name, role, avatar, commission_rate')
        .eq('tenant_id', tenantId);
      return this.extractData(result, 'list staff for commission');
    } catch (err) {
      this.throwOnError(err, 'list staff for commission');
    }
  }

  async create(input: CreateStaffInput, tenantId: string): Promise<StaffMember> {
    try {
      const result = await this.from()
        .insert({
          id: input.id,
          name: input.name,
          email: input.email || '',
          phone: input.phone || '',
          role: input.role || 'barber',
          avatar: input.avatar || '',
          commission_rate: input.commission_rate ?? (input.role === 'barber' ? 50 : 0),
          status: input.status || 'active',
          tenant_id: tenantId,
        })
        .select()
        .single();
      const data = this.extractData<Record<string, unknown>>(result, 'Erro ao criar membro da equipe');
      return toStaffMember(data);
    } catch (err) {
      this.throwOnError(err, 'Erro ao criar membro da equipe');
    }
  }
}

export interface CreateStaffInput {
  id?: string;
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  avatar?: string;
  commission_rate?: number;
  status?: string;
}

export interface StaffRepository extends IRepository<StaffMember> {
  list(tenantId: string): Promise<StaffMember[]>;
  get(id: string, tenantId: string): Promise<StaffMember | null>;
  exists(id: string, tenantId: string): Promise<boolean>;
  update(id: string, input: UpdateStaffInput, tenantId: string): Promise<void>;
  delete(id: string, tenantId: string): Promise<void>;
  listForCommission(tenantId: string): Promise<Array<{ id: string; name: string; role?: string; avatar?: string; commission_rate?: number | null }>>;
  create(input: CreateStaffInput, tenantId: string): Promise<StaffMember>;
}

export const staffRepository: StaffRepository = new StaffRepositoryImpl();
