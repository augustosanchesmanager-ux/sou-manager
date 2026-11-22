/**
 * [SMG][DOMAIN][TENANT_GOALS] repository
 *
 * RESPONSABILIDADE: Acesso a dados da tabela tenant_goals.
 *   Operações: getActiveByTenantId, saveActiveGoals.
 *
 * GARANTIAS:
 *   - Todas as operações filtram por tenant_id
 *   - Lança RepositoryError em falhas
 *   - Zero conhecimento de React, UI, navigate, toast
 */

import { SupabaseRepository } from '../shared/supabase-repository';
import { createSupabaseClient } from '../shared/supabase-client-factory';
import type { DatabaseClient } from '../shared/database-client';

export { RepositoryError } from '../shared/errors';

export interface TenantGoal {
  id: string;
  tenant_id: string;
  period: string;
  revenue_goal: number;
  appointments_goal: number;
  clients_goal: number;
  active: boolean;
}

export interface UpsertTenantGoalsInput {
  revenue_goal: number;
  appointments_goal: number;
  clients_goal: number;
}

export interface TenantGoalsRepository {
  getActiveByTenantId(tenantId: string): Promise<TenantGoal | null>;
  saveActiveGoals(tenantId: string, input: UpsertTenantGoalsInput): Promise<void>;
}

export class TenantGoalsRepositoryImpl extends SupabaseRepository implements TenantGoalsRepository {
  constructor(db: DatabaseClient = createSupabaseClient('tenant_goals', 'barber')) {
    super('tenant_goals', db);
  }

  async getActiveByTenantId(tenantId: string): Promise<TenantGoal | null> {
    if (!tenantId || !tenantId.trim()) return null;

    try {
      const { data, error } = await this.from()
        .select('id, tenant_id, period, revenue_goal, appointments_goal, clients_goal, active')
        .eq('tenant_id', tenantId)
        .eq('active', true)
        .maybeSingle();

      if (error && (error as { code?: string }).code !== 'PGRST116') {
        this.throwOnError(error, 'Erro ao carregar metas do tenant');
      }

      if (!data) return null;

      return {
        id: String(data.id),
        tenant_id: String(data.tenant_id ?? tenantId),
        period: String(data.period ?? 'monthly'),
        revenue_goal: Number(data.revenue_goal || 0),
        appointments_goal: Number(data.appointments_goal || 0),
        clients_goal: Number(data.clients_goal || 0),
        active: Boolean(data.active ?? true),
      };
    } catch (err) {
      this.throwOnError(err, 'Erro ao carregar metas do tenant');
    }
  }

  async saveActiveGoals(tenantId: string, input: UpsertTenantGoalsInput): Promise<void> {
    if (!tenantId || !tenantId.trim()) {
      throw new Error('tenantId é obrigatório para salvar metas');
    }

    try {
      const { data: existing, error: fetchError } = await this.from()
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('active', true)
        .maybeSingle();

      if (fetchError && (fetchError as { code?: string }).code !== 'PGRST116') {
        this.throwOnError(fetchError, 'Erro ao verificar metas existentes');
      }

      if (existing?.id) {
        const { error: updateError } = await this.from()
          .update({
            revenue_goal: input.revenue_goal,
            appointments_goal: input.appointments_goal,
            clients_goal: input.clients_goal,
          })
          .eq('id', existing.id)
          .eq('tenant_id', tenantId);

        if (updateError) {
          this.throwOnError(updateError, 'Erro ao atualizar metas do tenant');
        }
        return;
      }

      const { error: insertError } = await this.from().insert({
        tenant_id: tenantId,
        period: 'monthly',
        revenue_goal: input.revenue_goal,
        appointments_goal: input.appointments_goal,
        clients_goal: input.clients_goal,
        active: true,
      });

      if (insertError) {
        this.throwOnError(insertError, 'Erro ao criar metas do tenant');
      }
    } catch (err) {
      this.throwOnError(err, 'Erro ao salvar metas do tenant');
    }
  }
}

export const tenantGoalsRepository: TenantGoalsRepository = new TenantGoalsRepositoryImpl();
