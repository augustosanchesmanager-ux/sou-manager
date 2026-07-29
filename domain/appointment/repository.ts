/**
 * [SMG][DOMAIN][APPOINTMENT] repository
 *
 * RESPONSABILIDADE: Gerencia a entidade Appointment (tabela appointments).
 *   Operações: list, getById, update, cancel, updateStatus.
 *
 * NÃO FAZ:
 *   - Criação de agendamentos (usa RPC create_appointment_with_comanda)
 *   - Sincronização com comandas (Application Service)
 *   - Drag and drop (Application Service)
 *   - Conflitos e bloqueios (Application Service)
 *   - Exportação CSV (Application Service)
 *   - Realtime (Infrastructure)
 *
 * DEPENDÊNCIAS: DatabaseClient via DI (SupabaseRepository base)
 *
 * GARANTIAS:
 *   - Todas as operações filtram por tenant_id
 *   - Lança RepositoryError em falhas (nunca retorna { data, error })
 *   - update/cancel/updateStatus retornam void
 *   - Zero conhecimento de React, UI, navigate, toast
 */

import { SupabaseRepository } from '../shared/supabase-repository';
import { createSupabaseClient } from '../shared/supabase-client-factory';
import type { DatabaseClient } from '../shared/database-client';
import type { IRepository } from '../shared/repository';
import type { Appointment, UpdateAppointmentInput, CancelAppointmentInput, AppointmentListOptions } from './types';
import type { AppSlug } from '../shared/app';

export { RepositoryError } from '../shared/errors';

const toAppointment = (row: Record<string, unknown>): Appointment => ({
  id: row.id as string,
  tenant_id: row.tenant_id as string,
  client_id: (row.client_id as string) || null,
  client_name: (row.client_name as string) || '',
  client_phone: (row.client_phone as string) || '',
  staff_id: (row.staff_id as string) || null,
  staff_name: (row.staff_name as string) || '',
  service_id: (row.service_id as string) || null,
  service_name: (row.service_name as string) || '',
  start_time: row.start_time as string,
  end_time: row.end_time as string,
  duration: (row.duration as number) || 0,
  price: (row.price as number) || 0,
  status: (row.status as string) || 'pending',
  notes: (row.notes as string) || '',
  source: (row.source as string) || 'manual',
  hidden_from_schedule: (row.hidden_from_schedule as boolean) || false,
  cancellation_reason: (row.cancellation_reason as string) || null,
  cancellation_type: (row.cancellation_type as string) || null,
  cancelled_at: (row.cancelled_at as string) || null,
  cancelled_by_user_id: (row.cancelled_by_user_id as string) || null,
  created_at: (row.created_at as string) || '',
});

class AppointmentRepositoryImpl extends SupabaseRepository {
  private readonly defaultAppSlug: AppSlug;

  constructor(db?: DatabaseClient, appSlug: AppSlug = 'barber') {
    super('appointments', db ?? createSupabaseClient('appointments', appSlug));
    this.defaultAppSlug = appSlug;
  }

  /** DatabaseClient com schema correto (default ou override). */
  private scopeClient(appSlug?: AppSlug): DatabaseClient {
    const slug = appSlug || this.defaultAppSlug;
    return createSupabaseClient('appointments', slug);
  }

  async list(tenantId: string, options?: AppointmentListOptions, appSlug?: AppSlug): Promise<Appointment[]> {
    try {
      let query = this.scopeClient(appSlug).from('appointments')
        .select('*')
        .eq('tenant_id', tenantId);

      if (options?.staffId) {
        query = query.eq('staff_id', options.staffId);
      }
      if (options?.includeHidden === false) {
        query = query.eq('hidden_from_schedule', false);
      }
      if (options?.startTimeFrom) {
        query = query.gte('start_time', options.startTimeFrom);
      }
      if (options?.startTimeTo) {
        query = query.lte('start_time', options.startTimeTo);
      }

      return this.extractData<Record<string, unknown>[]>(await query, 'Erro ao listar agendamentos').map(toAppointment);
    } catch (err) {
      this.throwOnError(err, 'Erro ao listar agendamentos');
    }
  }

  async get(id: string, tenantId: string, appSlug?: AppSlug): Promise<Appointment | null> {
    try {
      const result = await this.scopeClient(appSlug).from('appointments')
        .select('*')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .single();
      const data = this.extractData(result, 'Erro ao buscar agendamento');
      return data ? toAppointment(data as Record<string, unknown>) : null;
    } catch (err) {
      if (err instanceof Error && 'code' in err && (err as any).code === 'PGRST116') return null;
      this.throwOnError(err, 'Erro ao buscar agendamento');
    }
  }

  async update(id: string, input: UpdateAppointmentInput, tenantId: string, appSlug?: AppSlug): Promise<void> {
    try {
      const result = await this.scopeClient(appSlug).from('appointments')
        .update(input)
        .eq('id', id)
        .eq('tenant_id', tenantId);
      this.extractData(result, 'Erro ao atualizar agendamento');
    } catch (err) {
      this.throwOnError(err, 'Erro ao atualizar agendamento');
    }
  }

  async cancel(id: string, input: CancelAppointmentInput, tenantId: string, appSlug?: AppSlug): Promise<void> {
    try {
      const result = await this.scopeClient(appSlug).from('appointments')
        .update({
          status: input.status,
          cancellation_reason: input.cancellation_reason,
          cancellation_type: input.cancellation_type,
          hidden_from_schedule: input.hidden_from_schedule,
          cancelled_at: input.cancelled_at,
          cancelled_by_user_id: input.cancelled_by_user_id,
        })
        .eq('id', id)
        .eq('tenant_id', tenantId);
      this.extractData(result, 'Erro ao cancelar agendamento');
    } catch (err) {
      this.throwOnError(err, 'Erro ao cancelar agendamento');
    }
  }

  async updateStatus(id: string, status: string, tenantId: string, appSlug?: AppSlug): Promise<void> {
    try {
      const result = await this.scopeClient(appSlug).from('appointments')
        .update({ status })
        .eq('id', id)
        .eq('tenant_id', tenantId);
      this.extractData(result, 'Erro ao atualizar status do agendamento');
    } catch (err) {
      this.throwOnError(err, 'Erro ao atualizar status do agendamento');
    }
  }

  async exists(id: string, tenantId: string, appSlug?: AppSlug): Promise<boolean> {
    try {
      const result = await this.scopeClient(appSlug).from('appointments')
        .select('id')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      const data = this.extractData<{ id: string } | null>(result, 'Erro ao verificar agendamento');
      return data !== null;
    } catch (err) {
      this.throwOnError(err, 'Erro ao verificar agendamento');
    }
  }

  async listByIds(ids: string[], tenantId: string): Promise<Array<{ id: string; start_time: string }>> {
    try {
      if (ids.length === 0) return [];
      const result = await this.scopeClient().from('appointments')
        .select('id, start_time')
        .eq('tenant_id', tenantId)
        .in('id', ids);
      return this.extractData(result, 'list appointments by ids');
    } catch (err) {
      this.throwOnError(err, 'list appointments by ids');
    }
  }

  async listForSnapshot(tenantId: string, start: string, end: string): Promise<Array<{ id: string; status: string; price: number; start_time: string; staff_id: string }>> {
    try {
      const result = await this.scopeClient().from('appointments')
        .select('id, status, price, start_time, staff_id')
        .eq('tenant_id', tenantId)
        .gte('start_time', start)
        .lte('start_time', end);
      return this.extractData(result, 'list appointments for snapshot');
    } catch (err) {
      this.throwOnError(err, 'list appointments for snapshot');
    }
  }
}

export interface AppointmentRepository extends IRepository<Appointment> {
  list(tenantId: string, options?: AppointmentListOptions, appSlug?: AppSlug): Promise<Appointment[]>;
  get(id: string, tenantId: string, appSlug?: AppSlug): Promise<Appointment | null>;
  exists(id: string, tenantId: string, appSlug?: AppSlug): Promise<boolean>;
  update(id: string, input: UpdateAppointmentInput, tenantId: string, appSlug?: AppSlug): Promise<void>;
  cancel(id: string, input: CancelAppointmentInput, tenantId: string, appSlug?: AppSlug): Promise<void>;
  updateStatus(id: string, status: string, tenantId: string, appSlug?: AppSlug): Promise<void>;
  listByIds(ids: string[], tenantId: string): Promise<Array<{ id: string; start_time: string }>>;
  listForSnapshot(tenantId: string, start: string, end: string): Promise<Array<{ id: string; status: string; price: number; start_time: string; staff_id: string }>>;
}

export const appointmentRepository: AppointmentRepository = new AppointmentRepositoryImpl();
