/**
 * [SMG][DOMAIN][CHEF_CLUB] credit-repository
 *
 * RESPONSABILIDADE: Acesso a dados de créditos do Clube (tabela customer_credits).
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

export interface CreditRow {
  id: string;
  tenant_id: string;
  subscription_id: string;
  available_credits: number | string;
  used_credits: number | string;
  service_balance_map: unknown;
  period_start: string | null;
  period_end: string | null;
}

const CREDIT_COLUMNS = 'id, tenant_id, subscription_id, available_credits, used_credits, service_balance_map, period_start, period_end';

class ChefClubCreditRepositoryImpl extends SupabaseRepository {
  constructor(db?: DatabaseClient, appSlug: AppSlug = 'barber') {
    super('customer_credits', db ?? createSupabaseClient('customer_credits', appSlug));
  }

  async getBySubscription(subscriptionId: string, tenantId: string): Promise<CreditRow[]> {
    try {
      const result = await this.from()
        .select(CREDIT_COLUMNS)
        .eq('tenant_id', tenantId)
        .eq('subscription_id', subscriptionId);
      return this.extractData<CreditRow[]>(result, 'get credits by subscription');
    } catch (error) {
      this.throwOnError(error, 'get credits by subscription');
    }
  }

  async getActiveBySubscription(subscriptionId: string, tenantId: string): Promise<CreditRow | null> {
    try {
      const result = await this.from()
        .select(CREDIT_COLUMNS)
        .eq('tenant_id', tenantId)
        .eq('subscription_id', subscriptionId)
        .maybeSingle();
      return this.extractData<CreditRow | null>(result, 'get active credits by subscription');
    } catch (error) {
      this.throwOnError(error, 'get active credits by subscription');
    }
  }

  async listAll(tenantId: string): Promise<CreditRow[]> {
    try {
      const result = await this.from()
        .select(CREDIT_COLUMNS)
        .eq('tenant_id', tenantId);
      return this.extractData<CreditRow[]>(result, 'list all credits');
    } catch (error) {
      this.throwOnError(error, 'list all credits');
    }
  }

  async updateBalance(subscriptionId: string, tenantId: string, data: Record<string, unknown>): Promise<void> {
    try {
      const result = await this.from()
        .update(data)
        .eq('tenant_id', tenantId)
        .eq('subscription_id', subscriptionId);
      this.extractData(result, 'update credit balance');
    } catch (error) {
      this.throwOnError(error, 'update credit balance');
    }
  }

  async getForCycleValidation(subscriptionId: string, tenantId: string): Promise<Pick<CreditRow, 'available_credits' | 'used_credits' | 'service_balance_map' | 'period_end'> | null> {
    try {
      const result = await this.from()
        .select('available_credits, used_credits, service_balance_map, period_end')
        .eq('subscription_id', subscriptionId)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      return this.extractData(result, 'get credits for cycle validation');
    } catch (error) {
      this.throwOnError(error, 'get credits for cycle validation');
    }
  }

  async list(tenantId: string): Promise<CreditRow[]> {
    return this.listAll(tenantId);
  }

  async get(id: string, tenantId: string): Promise<CreditRow | null> {
    try {
      const result = await this.from()
        .select(CREDIT_COLUMNS)
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      return this.extractData<CreditRow | null>(result, 'get credit by id');
    } catch (error) {
      this.throwOnError(error, 'get credit by id');
    }
  }

  async exists(id: string, tenantId: string): Promise<boolean> {
    try {
      const result = await this.from()
        .select('id')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      const data = this.extractData<{ id: string } | null>(result, 'check credit exists');
      return data !== null;
    } catch (error) {
      this.throwOnError(error, 'check credit exists');
    }
  }
}

export interface ChefClubCreditRepository extends IRepository<CreditRow> {
  list(tenantId: string): Promise<CreditRow[]>;
  get(id: string, tenantId: string): Promise<CreditRow | null>;
  exists(id: string, tenantId: string): Promise<boolean>;
  listAll(tenantId: string): Promise<CreditRow[]>;
  getBySubscription(subscriptionId: string, tenantId: string): Promise<CreditRow[]>;
  getActiveBySubscription(subscriptionId: string, tenantId: string): Promise<CreditRow | null>;
  updateBalance(subscriptionId: string, tenantId: string, data: Record<string, unknown>): Promise<void>;
  getForCycleValidation(subscriptionId: string, tenantId: string): Promise<Pick<CreditRow, 'available_credits' | 'used_credits' | 'service_balance_map' | 'period_end'> | null>;
}

export const chefClubCreditRepository = new ChefClubCreditRepositoryImpl();
