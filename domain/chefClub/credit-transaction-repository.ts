/**
 * [SMG][DOMAIN][CHEF_CLUB] credit-transaction-repository
 *
 * RESPONSABILIDADE: Acesso a dados de transações de créditos do Clube (tabela customer_credit_transactions).
 *
 * GARANTIAS:
 *   - Todas as operações filtram por tenant_id
 *   - Lança RepositoryError em falhas
 *   - Zero conhecimento de React, UI, navigate, toast
 */

import { SupabaseRepository } from '../shared/supabase-repository';
import { createSupabaseClient } from '../shared/supabase-client-factory';
import type { DatabaseClient } from '../shared/database-client';
import type { IRepository } from '../shared/repository';
import type { AppSlug } from '../shared/app';

export interface CreditTransactionRow {
  id: string;
  created_at: string;
  service_name: string;
  credits_used: number;
  appointment_id?: string;
  notes?: string;
}

class ChefClubCreditTransactionRepositoryImpl extends SupabaseRepository {
  constructor(db?: DatabaseClient, appSlug: AppSlug = 'barber') {
    super('customer_credit_transactions', db ?? createSupabaseClient('customer_credit_transactions', appSlug));
  }

  async list(tenantId: string): Promise<CreditTransactionRow[]> {
    try {
      const result = await this.from()
        .select('id, created_at, service_name, credits_used, appointment_id, notes')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      return this.extractData<CreditTransactionRow[]>(result, 'list credit transactions');
    } catch (error) {
      this.throwOnError(error, 'list credit transactions');
    }
  }

  async get(id: string, tenantId: string): Promise<CreditTransactionRow | null> {
    try {
      const result = await this.from()
        .select('id, created_at, service_name, credits_used, appointment_id, notes')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      return this.extractData<CreditTransactionRow | null>(result, 'get credit transaction');
    } catch (error) {
      this.throwOnError(error, 'get credit transaction');
    }
  }

  async exists(id: string, tenantId: string): Promise<boolean> {
    try {
      const result = await this.from()
        .select('id')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      const data = this.extractData<{ id: string } | null>(result, 'check credit transaction exists');
      return data !== null;
    } catch (error) {
      this.throwOnError(error, 'check credit transaction exists');
    }
  }

  async listBySubscription(subscriptionId: string, tenantId: string): Promise<CreditTransactionRow[]> {
    try {
      const result = await this.from()
        .select('id, created_at, service_name, credits_used, appointment_id, notes')
        .eq('tenant_id', tenantId)
        .eq('subscription_id', subscriptionId)
        .order('created_at', { ascending: false });
      return this.extractData<CreditTransactionRow[]>(result, 'list credit transactions by subscription');
    } catch (error) {
      this.throwOnError(error, 'list credit transactions by subscription');
    }
  }
}

export interface ChefClubCreditTransactionRepository extends IRepository<CreditTransactionRow> {
  list(tenantId: string): Promise<CreditTransactionRow[]>;
  get(id: string, tenantId: string): Promise<CreditTransactionRow | null>;
  exists(id: string, tenantId: string): Promise<boolean>;
  listBySubscription(subscriptionId: string, tenantId: string): Promise<CreditTransactionRow[]>;
}

export const chefClubCreditTransactionRepository = new ChefClubCreditTransactionRepositoryImpl();
