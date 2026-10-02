/**
 * [SMG][DOMAIN][COMANDA] comandaPaymentRepository
 *
 * RESPONSABILIDADE: Acesso a dados de pagamentos parciais/antecipados
 * (tabela comanda_payments — ADR-018, append-only).
 *
 * GARANTIAS:
 *   - Todas as operações filtram por tenant_id
 *   - Lança RepositoryError em falhas
 *   - Zero conhecimento de React, UI, navigate, toast
 *
 * CONSUMO: o fechamento de caixa usa a soma liquidada para calcular repasse.
 * Pagamento com `reversed_at` preenchido e estornado e NAO entra na base —
 * filtrar no repositorio evita que cada consumidor precise repetir a regra.
 */

import { SupabaseRepository } from '../shared/supabase-repository';
import { createSupabaseClient } from '../shared/supabase-client-factory';
import type { DatabaseClient } from '../shared/database-client';
import type { AppSlug } from '../shared/app';

export interface ComandaPaymentRow {
  id: string;
  comanda_id: string;
  payment_type: string;
  amount: number | string;
  payment_method: string | null;
  reversed_at: string | null;
}

class ComandaPaymentRepositoryImpl extends SupabaseRepository {
  private readonly defaultAppSlug: AppSlug;

  constructor(db?: DatabaseClient, appSlug: AppSlug = 'barber') {
    super('comanda_payments', db ?? createSupabaseClient('comanda_payments', appSlug));
    this.defaultAppSlug = appSlug;
  }

  async list(comandaId: string, tenantId: string, appSlug?: AppSlug): Promise<ComandaPaymentRow[]> {
    return this.getPaymentsByComandaIds([comandaId], tenantId, appSlug);
  }

  /**
   * Pagamentos NAO estornados das comandas informadas. Estornados sao
   * excluidos aqui para que a base liquidada nunca conte valor revertido.
   */
  async getPaymentsByComandaIds(
    comandaIds: string[],
    tenantId: string,
    appSlug?: AppSlug,
  ): Promise<ComandaPaymentRow[]> {
    try {
      if (comandaIds.length === 0) return [];
      const slug = appSlug || this.defaultAppSlug;
      const result = await createSupabaseClient(this.tableName, slug).from(this.tableName)
        .select('id, comanda_id, payment_type, amount, payment_method, reversed_at')
        .eq('tenant_id', tenantId)
        .in('comanda_id', comandaIds)
        .is('reversed_at', null);
      return this.extractData<ComandaPaymentRow[]>(result, 'list comanda payments by comanda ids');
    } catch (err) {
      this.throwOnError(err, 'list comanda payments by comanda ids');
    }
  }

  async get(_id: string, _tenantId: string): Promise<ComandaPaymentRow | null> {
    throw new Error('ComandaPaymentRepository is read-only by comanda IDs, not by payment ID');
  }

  async exists(_id: string, _tenantId: string): Promise<boolean> {
    throw new Error('ComandaPaymentRepository is read-only by comanda IDs, not by payment ID');
  }

  async upsert(): Promise<ComandaPaymentRow> {
    throw new Error('ComandaPaymentRepository is read-only; writes go through RPC (ADR-018)');
  }

  async delete(): Promise<void> {
    throw new Error('ComandaPaymentRepository is read-only; writes go through RPC (ADR-018)');
  }
}

export const comandaPaymentRepository = new ComandaPaymentRepositoryImpl();
