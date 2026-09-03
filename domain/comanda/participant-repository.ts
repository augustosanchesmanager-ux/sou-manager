/**
 * [SMG][DOMAIN][COMANDA] participant-repository
 *
 * RESPONSABILIDADE: Acesso a dados de participantes de execução de serviço (tabela service_execution_participants).
 *
 * GARANTIAS:
 *   - Todas as operações filtram por tenant_id
 *   - Lança RepositoryError em falhas
 *   - Zero conhecimento de React, UI, navigate, toast
 */

import { SupabaseRepository } from '../shared/supabase-repository';
import { createSupabaseClient } from '../shared/supabase-client-factory';
import type { DatabaseClient } from '../shared/database-client';
import type { AppSlug } from '../shared/app';

export interface ParticipantRow {
  id: string;
  comanda_item_id: string;
  staff_id: string | null;
  professional_id?: string | null;
  role: string;
  payout_type: string;
  payout_value: number;
  affects_commission: boolean;
}

export class ServiceExecutionParticipantRepositoryImpl extends SupabaseRepository {
  constructor(db?: DatabaseClient, appSlug: AppSlug = 'barber') {
    super('service_execution_participants', db ?? createSupabaseClient('service_execution_participants', appSlug));
  }

  async listByComandaItemIds(comandaItemIds: string[], tenantId: string): Promise<ParticipantRow[]> {
    try {
      if (comandaItemIds.length === 0) return [];
      // Contrato canônico = staff_id: schema de PRODUÇÃO não possui coluna professional_id
      // (provado por B3.4-H.1 e pelo worker D8 — ver migrations 20260827120000). Seleciona staff_id.
      const result = await this.from()
        .select('id, comanda_item_id, staff_id, role, payout_type, payout_value, affects_commission')
        .eq('tenant_id', tenantId)
        .in('comanda_item_id', comandaItemIds);
      const rows = this.extractData<Array<Record<string, unknown>>>(result, 'list participants by comanda item ids');
      // Expõe professional_id de forma tolerante (derivado de staff_id) para quem ainda o consome.
      return (rows || []).map((row) => {
        const staffId = (row.staff_id as string | null) ?? null;
        return {
          ...row,
          staff_id: staffId,
          professional_id: staffId,
        } as unknown as ParticipantRow;
      });
    } catch (error) {
      this.throwOnError(error, 'list participants by comanda item ids');
    }
  }

  async insertBatch(participants: Record<string, unknown>[]): Promise<void> {
    try {
      if (participants.length === 0) return;
      const result = await this.from().insert(participants);
      this.extractData(result, 'insert participants batch');
    } catch (error) {
      this.throwOnError(error, 'insert participants batch');
    }
  }
}

export interface ServiceExecutionParticipantRepository {
  listByComandaItemIds(comandaItemIds: string[], tenantId: string): Promise<ParticipantRow[]>;
  insertBatch(participants: Record<string, unknown>[]): Promise<void>;
}

export const serviceExecutionParticipantRepository = new ServiceExecutionParticipantRepositoryImpl();
