/**
 * [SMG][DOMAIN][CLIENT] repository
 *
 * RESPONSABILIDADE: Gerencia a entidade Client (tabela clients).
 *   Operações: list, getById, create, update, delete, exists, import.
 *
 * NÃO FAZ:
 *   - Orquestração de exclusão em cascata (DeleteClientService)
 *   - Queries de comandas abertas (ComandaRepository)
 *   - Queries de Club dos Chefes (fetchChefClubSummaryByClient)
 *   - Validações de negócio complexas (Application Service)
 *
 * DEPENDÊNCIAS: Supabase via SupabaseRepository base
 *
 * GARANTIAS:
 *   - Todas as operações filtram por tenant_id
 *   - Lança RepositoryError em falhas (nunca retorna { data, error })
 *   - create() retorna Client; update/delete/import retornam void; exists retorna boolean
 *   - Zero conhecimento de React, UI, navigate, toast
 */

import { SupabaseRepository } from '../shared/supabase-repository';
import { createSupabaseClient } from '../shared/supabase-client-factory';
import type { DatabaseClient } from '../shared/database-client';
import type { IRepository } from '../shared/repository';
import type { Client, CreateClientInput, UpdateClientInput } from './types';
import type { AppSlug } from '../shared/app';

export { RepositoryError } from '../shared/errors';

const toClient = (row: Record<string, unknown>): Client => ({
  id: row.id as string,
  name: row.name as string,
  email: (row.email as string) || '',
  phone: (row.phone as string) || '',
  last_visit: (row.last_visit as string) || '',
  last_service: (row.last_service as string) || '',
  total_spent: (row.total_spent as number) || 0,
  status: (row.status as string) || 'active',
  avatar: (row.avatar as string) || '',
  birthday: (row.birthday as string) || '',
});

class ClientRepositoryImpl extends SupabaseRepository {
  constructor(db?: DatabaseClient, appSlug: AppSlug = 'barber') {
    super('clients', db ?? createSupabaseClient('clients', appSlug));
  }

  async list(tenantId: string): Promise<Client[]> {
    try {
      const result = await this.from()
        .select('*')
        .eq('tenant_id', tenantId)
        .order('name');
      return this.extractData<Record<string, unknown>[]>(result, 'Erro ao listar clientes').map(toClient);
    } catch (err) {
      this.throwOnError(err, 'Erro ao listar clientes');
    }
  }

  async get(id: string, tenantId: string): Promise<Client | null> {
    try {
      const result = await this.from()
        .select('*')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .single();
      const data = this.extractData<{ data: Client | null; error: unknown } | Record<string, unknown>>(result, 'Erro ao buscar cliente');
      return data ? toClient(data as Record<string, unknown>) : null;
    } catch (err) {
      if (err instanceof Error && 'code' in err && (err as any).code === 'PGRST116') return null;
      this.throwOnError(err, 'Erro ao buscar cliente');
    }
  }

  async create(input: CreateClientInput, tenantId: string): Promise<Client> {
    try {
      const result = await this.from()
        .insert({
          name: input.name,
          email: input.email,
          phone: input.phone,
          birthday: input.birthday,
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(input.name)}&background=random`,
          tenant_id: tenantId,
        })
        .select()
        .single();
      return toClient(this.extractData(result, 'Erro ao criar cliente') as Record<string, unknown>);
    } catch (err) {
      this.throwOnError(err, 'Erro ao criar cliente');
    }
  }

  async update(id: string, input: UpdateClientInput, tenantId: string): Promise<void> {
    try {
      const result = await this.from()
        .update(input)
        .eq('id', id)
        .eq('tenant_id', tenantId);
      this.extractData(result, 'Erro ao atualizar cliente');
    } catch (err) {
      this.throwOnError(err, 'Erro ao atualizar cliente');
    }
  }

  async delete(id: string, tenantId: string): Promise<void> {
    try {
      const result = await this.from()
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenantId);
      this.extractData(result, 'Erro ao excluir cliente');
    } catch (err) {
      this.throwOnError(err, 'Erro ao excluir cliente');
    }
  }

  async exists(id: string, tenantId: string): Promise<boolean> {
    try {
      const result = await this.from()
        .select('id')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      const data = this.extractData<{ id: string } | null>(result, 'Erro ao verificar cliente');
      return data !== null;
    } catch (err) {
      this.throwOnError(err, 'Erro ao verificar cliente');
    }
  }

  async import(inputs: CreateClientInput[], tenantId: string): Promise<void> {
    try {
      const toInsert = inputs.map((c) => ({
        name: c.name,
        phone: c.phone,
        email: c.email,
        birthday: c.birthday || null,
        status: 'active',
        tenant_id: tenantId,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=random`,
      }));
      const result = await this.from().insert(toInsert);
      this.extractData(result, 'Erro ao importar clientes');
    } catch (err) {
      this.throwOnError(err, 'Erro ao importar clientes');
    }
  }

  async getByIds(ids: string[], tenantId: string): Promise<Record<string, { id: string; name: string; phone: string }>> {
    try {
      if (ids.length === 0) return {};
      const result = await this.from()
        .select('id, name, phone')
        .eq('tenant_id', tenantId)
        .in('id', ids);
      const data = this.extractData<Record<string, unknown>[]>(result, 'get clients by ids');
      const map: Record<string, { id: string; name: string; phone: string }> = {};
      for (const row of data) {
        map[row.id as string] = { id: row.id as string, name: row.name as string, phone: row.phone as string };
      }
      return map;
    } catch (err) {
      this.throwOnError(err, 'get clients by ids');
    }
  }

  async getNameMap(ids: string[], tenantId: string): Promise<Record<string, string>> {
    try {
      if (ids.length === 0) return {};
      const result = await this.from()
        .select('id, name')
        .eq('tenant_id', tenantId)
        .in('id', ids);
      const data = this.extractData<Record<string, unknown>[]>(result, 'get client name map');
      const map: Record<string, string> = {};
      for (const row of data) {
        map[row.id as string] = row.name as string;
      }
      return map;
    } catch (err) {
      this.throwOnError(err, 'get client name map');
    }
  }

  async getOneById(id: string, tenantId: string): Promise<{ id: string; name: string; phone: string } | null> {
    try {
      const result = await this.from()
        .select('id, name, phone')
        .eq('tenant_id', tenantId)
        .eq('id', id)
        .maybeSingle();
      const data = this.extractData<{ id: string; name: string; phone: string } | null>(result, 'get one client by id');
      return data;
    } catch (err) {
      this.throwOnError(err, 'get one client by id');
    }
  }
}

export interface ClientRepository extends IRepository<Client> {
  list(tenantId: string): Promise<Client[]>;
  get(id: string, tenantId: string): Promise<Client | null>;
  exists(id: string, tenantId: string): Promise<boolean>;
  create(input: CreateClientInput, tenantId: string): Promise<Client>;
  update(id: string, input: UpdateClientInput, tenantId: string): Promise<void>;
  delete(id: string, tenantId: string): Promise<void>;
  import(inputs: CreateClientInput[], tenantId: string): Promise<void>;
  getByIds(ids: string[], tenantId: string): Promise<Record<string, { id: string; name: string; phone: string }>>;
  getNameMap(ids: string[], tenantId: string): Promise<Record<string, string>>;
  getOneById(id: string, tenantId: string): Promise<{ id: string; name: string; phone: string } | null>;
}

export const clientRepository: ClientRepository = new ClientRepositoryImpl();
