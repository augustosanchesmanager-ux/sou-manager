/**
 * [SMG][DOMAIN][FINANCIAL] reversal-repository
 *
 * RESPONSABILIDADE: Acesso a dados de estornos financeiros (tabela financial_reversals).
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

export interface ReversalRow {
  original_transaction_id: string;
  reversal_transaction_id: string;
  reversal_type: string;
  amount: number | string;
  reason_type: string;
  created_at: string;
}

class FinancialReversalRepositoryImpl extends SupabaseRepository {
  constructor(db?: DatabaseClient, appSlug: AppSlug = 'barber') {
    super('financial_reversals', db ?? createSupabaseClient('financial_reversals', appSlug));
  }

  async list(tenantId: string): Promise<ReversalRow[]> {
    try {
      const result = await this.from()
        .select('original_transaction_id, reversal_transaction_id, reversal_type, amount, reason_type, created_at')
        .eq('tenant_id', tenantId);
      return this.extractData<ReversalRow[]>(result, 'list reversals');
    } catch (error) {
      this.throwOnError(error, 'list reversals');
    }
  }

  async get(_id: string, _tenantId: string): Promise<ReversalRow | null> {
    throw new Error('FinancialReversalRepository is read-only by transaction IDs, not by reversal ID');
  }

  async exists(_id: string, _tenantId: string): Promise<boolean> {
    throw new Error('FinancialReversalRepository is read-only by transaction IDs, not by reversal ID');
  }

  async listByTransactionIds(transactionIds: string[], tenantId: string): Promise<ReversalRow[]> {
    try {
      if (transactionIds.length === 0) return [];
      const result = await this.from()
        .select('original_transaction_id, reversal_transaction_id, reversal_type, amount, reason_type, created_at')
        .eq('tenant_id', tenantId)
        .in('reversal_transaction_id', transactionIds);
      return this.extractData<ReversalRow[]>(result, 'list reversals by transaction ids');
    } catch (error) {
      this.throwOnError(error, 'list reversals by transaction ids');
    }
  }
}

export interface FinancialReversalRepository {
  list(tenantId: string): Promise<ReversalRow[]>;
  get(id: string, tenantId: string): Promise<ReversalRow | null>;
  exists(id: string, tenantId: string): Promise<boolean>;
  listByTransactionIds(transactionIds: string[], tenantId: string): Promise<ReversalRow[]>;
}

export const financialReversalRepository = new FinancialReversalRepositoryImpl();
