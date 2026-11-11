/**
 * [SMG][DOMAIN][CLIENT] repository
 *
 * RESPONSABILIDADE: Gerencia a entidade Client (tabela clients).
 *   Operações: list, getById, create, update, delete, exists, importViaJob.
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
 *   - create() retorna Client; update/delete retornam void; exists retorna boolean;
 *     importViaJob() chama o RPC transacional import_clients_batch (nunca INSERT direto)
 *   - Zero conhecimento de React, UI, navigate, toast
 */

import { SupabaseRepository } from '../shared/supabase-repository';
import { createSupabaseClient } from '../shared/supabase-client-factory';
import type { DatabaseClient } from '../shared/database-client';
import type { IRepository } from '../shared/repository';
import type { Client, ClientImportRow, CreateClientInput, ImportJobResult, UpdateClientInput } from './types';
import type { AppSlug } from '../shared/app';
import { findClientByCanonicalPhone, getCanonicalBrPhone } from '../../src/lib/utils/phone';

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
  notes: (row.notes as string) || '',
  preferred_frequency: (row.preferred_frequency as Client['preferred_frequency']) || null,
  preferred_weekday: typeof row.preferred_weekday === 'number' ? row.preferred_weekday : null,
  preferred_time: (row.preferred_time as string) || null,
  preferred_staff_id: (row.preferred_staff_id as string) || null,
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

  async listWithEffectiveLastVisit(tenantId: string): Promise<Client[]> {
    const clients = await this.list(tenantId);
    try {
      const [comandasRes, appointmentsRes] = await Promise.all([
        this.db
          .from('comandas')
          .select('client_id, created_at, closed_at')
          .eq('tenant_id', tenantId)
          .in('status', ['paid', 'closed']),
        this.db
          .from('appointments')
          .select('client_id, start_time')
          .eq('tenant_id', tenantId)
          .in('status', ['completed', 'confirmed', 'attended', 'paid']),
      ]);

      const latestVisitMap = new Map<string, number>();

      if (comandasRes?.data) {
        for (const cmd of comandasRes.data as any[]) {
          if (!cmd.client_id) continue;
          const d = cmd.closed_at || cmd.created_at;
          if (!d) continue;
          const ts = new Date(d).getTime();
          if (!isNaN(ts)) {
            const cur = latestVisitMap.get(cmd.client_id) || 0;
            if (ts > cur) latestVisitMap.set(cmd.client_id, ts);
          }
        }
      }

      if (appointmentsRes?.data) {
        for (const apt of appointmentsRes.data as any[]) {
          if (!apt.client_id || !apt.start_time) continue;
          const ts = new Date(apt.start_time).getTime();
          if (!isNaN(ts)) {
            const cur = latestVisitMap.get(apt.client_id) || 0;
            if (ts > cur) latestVisitMap.set(apt.client_id, ts);
          }
        }
      }

      return clients.map((c) => {
        const latestTs = latestVisitMap.get(c.id);
        if (!latestTs) return c;
        const clientTs = c.last_visit ? new Date(c.last_visit).getTime() : 0;
        if (latestTs > clientTs) {
          return {
            ...c,
            last_visit: new Date(latestTs).toISOString(),
          };
        }
        return c;
      });
    } catch {
      return clients;
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

  async findByCanonicalPhone(phone: string, tenantId: string): Promise<Client | null> {
    const canonical = getCanonicalBrPhone(phone);
    if (!canonical) return null;

    const tail = canonical.slice(-4);
    const result = await this.from()
      .select('*')
      .eq('tenant_id', tenantId)
      .ilike('phone', `%${tail}%`);

    const rows = this.extractData<Record<string, unknown>[]>(result, 'Erro ao buscar cliente por telefone');
    const matched = findClientByCanonicalPhone(
      rows.map((row) => ({
        ...toClient(row),
        is_shared_phone: Boolean(row.is_shared_phone),
      })),
      canonical,
    );
    return matched ?? null;
  }

  async create(input: CreateClientInput, tenantId: string): Promise<Client> {
    const canonicalPhone = getCanonicalBrPhone(input.phone);

    try {
      const payload: Record<string, unknown> = {
        name: input.name,
        email: input.email ?? '',
        phone: canonicalPhone ?? input.phone,
        birthday: input.birthday || null,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(input.name)}&background=random`,
        tenant_id: tenantId,
      };
      if (input.notes !== undefined) payload.notes = input.notes;
      if (input.preferred_frequency !== undefined) payload.preferred_frequency = input.preferred_frequency;
      if (input.preferred_weekday !== undefined) payload.preferred_weekday = input.preferred_weekday;
      if (input.preferred_time !== undefined) payload.preferred_time = input.preferred_time;
      if (input.preferred_staff_id !== undefined) payload.preferred_staff_id = input.preferred_staff_id;

      const result = await this.from()
        .insert(payload)
        .select()
        .single();
      return toClient(this.extractData(result, 'Erro ao criar cliente') as Record<string, unknown>);
    } catch (err) {
      if (canonicalPhone && (err as { code?: string })?.code === '23505') {
        const existingAfterConflict = await this.findByCanonicalPhone(canonicalPhone, tenantId);
        if (existingAfterConflict) {
          return existingAfterConflict;
        }
      }
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

  async importViaJob(jobId: string, rows: ClientImportRow[]): Promise<ImportJobResult> {
    try {
      if (rows.length === 0) return { jobId, totalRows: 0, importedRows: 0, skippedRows: 0 };
      const result = await this.db.rpc('import_clients_batch', {
        p_job_id: jobId,
        p_rows: rows,
      });
      const data = this.extractData<ImportJobResult>(result, 'Erro ao importar clientes via job');
      return { jobId, totalRows: data.totalRows, importedRows: data.importedRows, skippedRows: data.skippedRows };
    } catch (err) {
      this.throwOnError(err, 'Erro ao importar clientes via job');
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
  listWithEffectiveLastVisit(tenantId: string): Promise<Client[]>;
  get(id: string, tenantId: string): Promise<Client | null>;
  exists(id: string, tenantId: string): Promise<boolean>;
  findByCanonicalPhone(phone: string, tenantId: string): Promise<Client | null>;
  create(input: CreateClientInput, tenantId: string): Promise<Client>;
  update(id: string, input: UpdateClientInput, tenantId: string): Promise<void>;
  delete(id: string, tenantId: string): Promise<void>;
  importViaJob(jobId: string, rows: ClientImportRow[]): Promise<ImportJobResult>;
  getByIds(ids: string[], tenantId: string): Promise<Record<string, { id: string; name: string; phone: string }>>;
  getNameMap(ids: string[], tenantId: string): Promise<Record<string, string>>;
  getOneById(id: string, tenantId: string): Promise<{ id: string; name: string; phone: string } | null>;
}

export const clientRepository: ClientRepository = new ClientRepositoryImpl();
