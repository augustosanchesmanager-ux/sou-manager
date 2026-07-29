/**
 * [SMG][DOMAIN][CHEF_CLUB] subscription-repository
 *
 * RESPONSABILIDADE: Acesso a dados de assinaturas do Clube (tabela customer_subscriptions).
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

export interface SubscriptionRow {
  id: string;
  tenant_id: string;
  client_id: string;
  plan_id: string;
  status: string;
  started_at: string | null;
  cycle_start: string | null;
  cycle_end: string | null;
  next_billing_date: string | null;
  canceled_at: string | null;
  created_at: string | null;
  service_balance_map: unknown;
}

const SUB_COLUMNS = 'id, tenant_id, client_id, plan_id, status, started_at, cycle_start, cycle_end, next_billing_date, canceled_at, created_at';

class ChefClubSubscriptionRepositoryImpl extends SupabaseRepository {
  private readonly sharedDb: DatabaseClient;

  constructor(db?: DatabaseClient, appSlug: AppSlug = 'barber') {
    super('customer_subscriptions', db ?? createSupabaseClient('customer_subscriptions', appSlug));
    this.sharedDb = db ?? createSupabaseClient('customer_subscriptions', appSlug);
  }

  async list(
    tenantId: string,
    options?: { status?: string; limit?: number },
  ): Promise<SubscriptionRow[]> {
    try {
      let query = this.from()
        .select(SUB_COLUMNS)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (options?.status && options.status !== 'all') {
        query = query.eq('status', options.status);
      }
      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const result = await query;
      return this.extractData<SubscriptionRow[]>(result, 'list subscriptions');
    } catch (error) {
      this.throwOnError(error, 'list subscriptions');
    }
  }

  async get(id: string, tenantId: string): Promise<SubscriptionRow | null> {
    try {
      const result = await this.from()
        .select(SUB_COLUMNS)
        .eq('tenant_id', tenantId)
        .eq('id', id)
        .maybeSingle();
      return this.extractData<SubscriptionRow | null>(result, 'get subscription by id');
    } catch (error) {
      this.throwOnError(error, 'get subscription by id');
    }
  }

  async getActiveByClient(clientId: string, tenantId: string): Promise<SubscriptionRow | null> {
    try {
      const result = await this.from()
        .select(SUB_COLUMNS)
        .eq('tenant_id', tenantId)
        .eq('client_id', clientId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return this.extractData<SubscriptionRow | null>(result, 'get active subscription by client');
    } catch (error) {
      this.throwOnError(error, 'get active subscription by client');
    }
  }

  async updateStatus(id: string, tenantId: string, data: Record<string, unknown>): Promise<void> {
    try {
      const result = await this.from()
        .update(data)
        .eq('tenant_id', tenantId)
        .eq('id', id);
      this.extractData(result, 'update subscription status');
    } catch (error) {
      this.throwOnError(error, 'update subscription status');
    }
  }

  async updatePlan(id: string, tenantId: string, planId: string): Promise<void> {
    try {
      const result = await this.from()
        .update({ plan_id: planId })
        .eq('tenant_id', tenantId)
        .eq('id', id);
      this.extractData(result, 'update subscription plan');
    } catch (error) {
      this.throwOnError(error, 'update subscription plan');
    }
  }

  async updateBillingDate(id: string, tenantId: string, data: Record<string, unknown>): Promise<void> {
    try {
      const result = await this.from()
        .update(data)
        .eq('tenant_id', tenantId)
        .eq('id', id);
      this.extractData(result, 'update subscription billing date');
    } catch (error) {
      this.throwOnError(error, 'update subscription billing date');
    }
  }

  async exists(id: string, tenantId: string): Promise<boolean> {
    try {
      const result = await this.from()
        .select('id')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      const data = this.extractData<{ id: string } | null>(result, 'check subscription exists');
      return data !== null;
    } catch (error) {
      this.throwOnError(error, 'check subscription exists');
    }
  }
}

export interface ChefClubSubscriptionRepository extends IRepository<SubscriptionRow> {
  list(tenantId: string, options?: { status?: string; limit?: number }): Promise<SubscriptionRow[]>;
  get(id: string, tenantId: string): Promise<SubscriptionRow | null>;
  exists(id: string, tenantId: string): Promise<boolean>;
  getActiveByClient(clientId: string, tenantId: string): Promise<SubscriptionRow | null>;
  updateStatus(id: string, tenantId: string, data: Record<string, unknown>): Promise<void>;
  updatePlan(id: string, tenantId: string, planId: string): Promise<void>;
  updateBillingDate(id: string, tenantId: string, data: Record<string, unknown>): Promise<void>;
}

export const chefClubSubscriptionRepository = new ChefClubSubscriptionRepositoryImpl();
