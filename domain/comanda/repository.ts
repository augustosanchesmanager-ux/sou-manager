/**
 * [SMG][DOMAIN][COMANDA] repository
 *
 * RESPONSABILIDADE: Gerencia a entidade Comanda (tabela comandas).
 *   Operações: list, getById, update, getByAppointment, getByClient.
 *
 * NÃO FAZ:
 *   - Checkout/fechamento (CheckoutApplicationService)
 *   - Cálculos de comissão (CommissionRepository)
 *   - Transações financeiras (TransactionRepository)
 *   - Sincronização com agendamentos (AppointmentApplicationService)
 *
 * DEPENDÊNCIAS: DatabaseClient via DI (SupabaseRepository base)
 *
 * GARANTIAS:
 *   - Todas as operações filtram por tenant_id
 *   - Lança RepositoryError em falhas (nunca retorna { data, error })
 *   - update retorna void
 *   - Zero conhecimento de React, UI, navigate, toast
 */

import { SupabaseRepository } from '../shared/supabase-repository';
import { createSupabaseClient } from '../shared/supabase-client-factory';
import type { DatabaseClient } from '../shared/database-client';
import type { IRepository } from '../shared/repository';
import type { Comanda, UpdateComandaInput, ComandaListOptions } from './types';
import type { AppSlug } from '../shared/app';

export { RepositoryError } from '../shared/errors';

/** Explicit column list for comandas — matches toComanda() mapping (13 of 29 cols). */
const COMANDA_COLUMNS = 'id, tenant_id, client_id, client_name, appointment_id, staff_id, status, total, paid_amount, payment_method, notes, created_at, closed_at';

const toComanda = (row: Record<string, unknown>): Comanda => ({
  id: row.id as string,
  tenant_id: row.tenant_id as string,
  client_id: (row.client_id as string) || null,
  client_name: (row.client_name as string) || null,
  appointment_id: (row.appointment_id as string) || null,
  staff_id: (row.staff_id as string) || null,
  status: (row.status as string) || 'open',
  total: (row.total as number) || 0,
  paid_amount: (row.paid_amount as number) || 0,
  payment_method: (row.payment_method as string) || null,
  notes: (row.notes as string) || null,
  created_at: (row.created_at as string) || '',
  closed_at: (row.closed_at as string) || null,
});

class ComandaRepositoryImpl extends SupabaseRepository {
  private readonly defaultAppSlug: AppSlug;

  constructor(db?: DatabaseClient, appSlug: AppSlug = 'barber') {
    super('comandas', db ?? createSupabaseClient('comandas', appSlug));
    this.defaultAppSlug = appSlug;
  }

  /** DatabaseClient com schema correto (default ou override). */
  private scopeClient(appSlug?: AppSlug): DatabaseClient {
    const slug = appSlug || this.defaultAppSlug;
    return createSupabaseClient(this.tableName, slug);
  }

  async list(tenantId: string, options?: ComandaListOptions, appSlug?: AppSlug): Promise<Comanda[]> {
    try {
        let query = this.scopeClient(appSlug).from(this.tableName)
        .select(COMANDA_COLUMNS)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (options?.staffId) {
        query = query.eq('staff_id', options.staffId);
      }
      if (options?.status) {
        query = query.eq('status', options.status);
      }
      if (options?.clientId) {
        query = query.eq('client_id', options.clientId);
      }
      if (options?.appointmentId) {
        query = query.eq('appointment_id', options.appointmentId);
      }
      if (options?.dateFrom) {
        query = query.gte('created_at', options.dateFrom);
      }
      if (options?.dateTo) {
        query = query.lte('created_at', options.dateTo);
      }

      return this.extractData<Record<string, unknown>[]>(await query, 'Erro ao listar comandas').map(toComanda);
    } catch (err) {
      this.throwOnError(err, 'Erro ao listar comandas');
    }
  }

  async get(id: string, tenantId: string, appSlug?: AppSlug): Promise<Comanda | null> {
    try {
      const result = await this.scopeClient(appSlug).from(this.tableName)
        .select(COMANDA_COLUMNS)
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .single();
      const data = this.extractData(result, 'Erro ao buscar comanda');
      return data ? toComanda(data as Record<string, unknown>) : null;
    } catch (err) {
      if (err instanceof Error && 'code' in err && (err as any).code === 'PGRST116') return null;
      this.throwOnError(err, 'Erro ao buscar comanda');
    }
  }

  async getByAppointment(appointmentId: string, tenantId: string, appSlug?: AppSlug): Promise<Comanda | null> {
    try {
      const result = await this.scopeClient(appSlug).from(this.tableName)
        .select(COMANDA_COLUMNS)
        .eq('appointment_id', appointmentId)
        .eq('tenant_id', tenantId)
        .eq('status', 'open')
        .single();
      const data = this.extractData(result, 'Erro ao buscar comanda por agendamento');
      return data ? toComanda(data as Record<string, unknown>) : null;
    } catch (err) {
      if (err instanceof Error && 'code' in err && (err as any).code === 'PGRST116') return null;
      this.throwOnError(err, 'Erro ao buscar comanda por agendamento');
    }
  }

  async findLatestByAppointment(appointmentId: string, tenantId: string, appSlug?: AppSlug): Promise<Comanda | null> {
    try {
      const result = await this.scopeClient(appSlug).from(this.tableName)
        .select('id, status')
        .eq('appointment_id', appointmentId)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const data = this.extractData(result, 'Erro ao buscar comanda por agendamento');
      return data ? toComanda(data as Record<string, unknown>) : null;
    } catch (err) {
      if (err instanceof Error && 'code' in err && (err as any).code === 'PGRST116') return null;
      this.throwOnError(err, 'Erro ao buscar comanda por agendamento');
    }
  }

  async getByClient(clientId: string, tenantId: string, options?: { status?: string; limit?: number }, appSlug?: AppSlug): Promise<Comanda[]> {
    try {
      let query = this.scopeClient(appSlug).from(this.tableName)
        .select(COMANDA_COLUMNS)
        .eq('client_id', clientId)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (options?.status) {
        query = query.eq('status', options.status);
      }
      if (options?.limit) {
        query = query.limit(options.limit);
      }

      return this.extractData<Record<string, unknown>[]>(await query, 'Erro ao buscar comandas do cliente').map(toComanda);
    } catch (err) {
      this.throwOnError(err, 'Erro ao buscar comandas do cliente');
    }
  }

  async update(id: string, input: UpdateComandaInput, tenantId: string, appSlug?: AppSlug): Promise<void> {
    try {
      const result = await this.scopeClient(appSlug).from(this.tableName)
        .update(input)
        .eq('id', id)
        .eq('tenant_id', tenantId);
      this.extractData(result, 'Erro ao atualizar comanda');
    } catch (err) {
      this.throwOnError(err, 'Erro ao atualizar comanda');
    }
  }

  async delete(id: string, tenantId: string, appSlug?: AppSlug): Promise<void> {
    try {
      const result = await this.scopeClient(appSlug).from(this.tableName)
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenantId);
      this.extractData(result, 'Erro ao excluir comanda');
    } catch (err) {
      this.throwOnError(err, 'Erro ao excluir comanda');
    }
  }

  async listOpenByAppointmentIds(appointmentIds: string[], tenantId: string, appSlug?: AppSlug): Promise<Record<string, string>> {
    try {
      if (appointmentIds.length === 0) return {};

      const result = await this.scopeClient(appSlug).from(this.tableName)
        .select('id, appointment_id')
        .eq('tenant_id', tenantId)
        .eq('status', 'open')
        .in('appointment_id', appointmentIds);

      const data = this.extractData<Record<string, unknown>[]>(result, 'Erro ao listar comandas abertas');
      const map: Record<string, string> = {};
      (data || []).forEach((row: any) => {
        if (row.appointment_id) {
          map[row.appointment_id] = row.id;
        }
      });
      return map;
    } catch (err) {
      this.throwOnError(err, 'Erro ao listar comandas abertas');
    }
  }

  async exists(id: string, tenantId: string, appSlug?: AppSlug): Promise<boolean> {
    try {
      const result = await this.scopeClient(appSlug).from(this.tableName)
        .select('id')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      const data = this.extractData<{ id: string } | null>(result, 'Erro ao verificar comanda');
      return data !== null;
    } catch (err) {
      this.throwOnError(err, 'Erro ao verificar comanda');
    }
  }

  async getStatus(id: string, tenantId: string, appSlug?: AppSlug): Promise<string | null> {
    try {
      const result = await this.scopeClient(appSlug).from(this.tableName)
        .select('status')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      const data = this.extractData<{ status: string } | null>(result, 'get comanda status');
      return data?.status || null;
    } catch (err) {
      this.throwOnError(err, 'get comanda status');
    }
  }

  async listForCommission(tenantId: string, options?: { statuses?: string[]; excludeHidden?: boolean }): Promise<Array<Record<string, unknown>>> {
    try {
      let query = this.scopeClient().from(this.tableName)
        .select('id, client_id, appointment_id, staff_id, status, total, discount, payment_method, closure_mode, financial_effect, membership_credit_effect, created_at, closed_at, hidden_from_financial')
        .eq('tenant_id', tenantId);

      if (options?.statuses && options.statuses.length > 0) {
        query = query.in('status', options.statuses);
      }
      if (options?.excludeHidden) {
        query = query.or('hidden_from_financial.is.null,hidden_from_financial.eq.false');
      }

      return this.extractData(await query, 'list comandas for commission');
    } catch (err) {
      this.throwOnError(err, 'list comandas for commission');
    }
  }

  async insertWithIdempotency(data: Record<string, unknown>, idempotencyKey: string, tenantId: string): Promise<string> {
    try {
      const { data: newC, error: insertError } = await this.scopeClient().from(this.tableName)
        .insert({ ...data, idempotency_key: idempotencyKey })
        .select()
        .single();

      if (insertError) {
        if (insertError.code === '23505') {
          const { data: duplicatedComanda } = await this.scopeClient().from(this.tableName)
            .select('id')
            .eq('tenant_id', tenantId)
            .eq('idempotency_key', idempotencyKey)
            .limit(1)
            .maybeSingle();

          if (!duplicatedComanda) throw insertError;
          return duplicatedComanda.id;
        }
        throw insertError;
      }

      return newC.id;
    } catch (err) {
      this.throwOnError(err, 'insert comanda with idempotency');
    }
  }
}

export interface ComandaRepository extends IRepository<Comanda> {
  list(tenantId: string, options?: ComandaListOptions, appSlug?: AppSlug): Promise<Comanda[]>;
  get(id: string, tenantId: string, appSlug?: AppSlug): Promise<Comanda | null>;
  exists(id: string, tenantId: string, appSlug?: AppSlug): Promise<boolean>;
  getByAppointment(appointmentId: string, tenantId: string, appSlug?: AppSlug): Promise<Comanda | null>;
  findLatestByAppointment(appointmentId: string, tenantId: string, appSlug?: AppSlug): Promise<Comanda | null>;
  getByClient(clientId: string, tenantId: string, options?: { status?: string; limit?: number }, appSlug?: AppSlug): Promise<Comanda[]>;
  listOpenByAppointmentIds(appointmentIds: string[], tenantId: string, appSlug?: AppSlug): Promise<Record<string, string>>;
  update(id: string, input: UpdateComandaInput, tenantId: string, appSlug?: AppSlug): Promise<void>;
  delete(id: string, tenantId: string, appSlug?: AppSlug): Promise<void>;
  getStatus(id: string, tenantId: string, appSlug?: AppSlug): Promise<string | null>;
  listForCommission(tenantId: string, options?: { statuses?: string[]; excludeHidden?: boolean }): Promise<Array<Record<string, unknown>>>;
  insertWithIdempotency(data: Record<string, unknown>, idempotencyKey: string, tenantId: string): Promise<string>;
}

export const comandaRepository: ComandaRepository = new ComandaRepositoryImpl();
