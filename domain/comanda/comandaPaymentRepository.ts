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
  created_at?: string | null;
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

  /**
   * Pagamentos NAO estornados liquidados no periodo [rangeStartIso, rangeEndIso]
   * (ADR-030: Regime de Caixa por comanda_payments.created_at).
   * Pagina em blocos de 1000 para nunca truncar no teto padrao do PostgREST.
   */
  async listValidInPeriod(
    tenantId: string,
    rangeStartIso: string,
    rangeEndIso: string,
    appSlug?: AppSlug,
  ): Promise<ComandaPaymentRow[]> {
    try {
      const slug = appSlug || this.defaultAppSlug;
      const client = createSupabaseClient(this.tableName, slug);
      const PAGE_SIZE = 1000;
      const allRows: ComandaPaymentRow[] = [];

      for (let from = 0; ; from += PAGE_SIZE) {
        const result = await client.from(this.tableName)
          .select('id, comanda_id, payment_type, amount, payment_method, created_at, reversed_at')
          .eq('tenant_id', tenantId)
          .is('reversed_at', null)
          .gte('created_at', rangeStartIso)
          .lte('created_at', rangeEndIso)
          .order('created_at', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);

        const batch = this.extractData<ComandaPaymentRow[]>(result, 'list valid comanda payments in period');
        allRows.push(...batch);
        if (batch.length < PAGE_SIZE) break;
      }

      return allRows;
    } catch (err) {
      this.throwOnError(err, 'list valid comanda payments in period');
    }
  }

  async get(_id: string, _tenantId: string): Promise<ComandaPaymentRow | null> {
    throw new Error('ComandaPaymentRepository is read-only by comanda IDs, not by payment ID');
  }

  async exists(_id: string, _tenantId: string): Promise<boolean> {
    throw new Error('ComandaPaymentRepository is read-only by comanda IDs, not by payment ID');
  }

  async updateTerminalSnapshotForFinalPayment(
    tenantId: string,
    comandaId: string,
    snapshot: {
      terminal_id: string;
      fee_percentage: number;
      fee_amount: number;
      net_amount: number;
      estimated_settlement_date: string | null;
    },
  ): Promise<void> {
    try {
      const result = await this.from()
        .update(snapshot)
        .eq('tenant_id', tenantId)
        .eq('comanda_id', comandaId)
        .eq('payment_type', 'final')
        .is('reversed_at', null);
      this.extractData(result, 'update terminal snapshot on final comanda payment');
    } catch (err) {
      this.throwOnError(err, 'update terminal snapshot on final comanda payment');
    }
  }

  async upsert(): Promise<ComandaPaymentRow> {
    throw new Error('ComandaPaymentRepository is read-only; writes go through RPC (ADR-018)');
  }

  async delete(): Promise<void> {
    throw new Error('ComandaPaymentRepository is read-only; writes go through RPC (ADR-018)');
  }
}

export const comandaPaymentRepository = new ComandaPaymentRepositoryImpl();
