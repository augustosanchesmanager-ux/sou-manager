/**
 * [SMG][DOMAIN][RECEIVABLE] repository
 *
 * Acesso a dados de recebimentos de assinatura do Clube.
 * Tabela: customer_subscription_receivables
 */

import { SupabaseRepository } from '../shared/supabase-repository';
import { createSupabaseClient, createSharedSupabaseClient } from '../shared/supabase-client-factory';
import type { DatabaseClient } from '../shared/database-client';
import type { IRepository } from '../shared/repository';
import type { CustomerSubscriptionReceivable, ReceivableListOptions } from './types';
import type { ReceivableStatus } from './types';

export class ReceivableRepository extends SupabaseRepository {
  private readonly sharedDb: DatabaseClient;

  constructor(db?: DatabaseClient) {
    super('customer_subscription_receivables', db ?? createSupabaseClient('customer_subscription_receivables', 'barber'));
    this.sharedDb = db ?? createSharedSupabaseClient();
  }

  async list(
    tenantId: string,
    options?: ReceivableListOptions,
    appSlug?: string,
  ): Promise<CustomerSubscriptionReceivable[]> {
    try {
      let query = this.from()
        .select('id, tenant_id, customer_id, subscription_id, plan_id, billing_cycle_start, billing_cycle_end, due_date, amount, status, payment_method, paid_at, transaction_id, notes, created_at')
        .eq('tenant_id', tenantId)
        .order('due_date', { ascending: true })
        .order('created_at', { ascending: true });

      if (options?.status) {
        query = query.eq('status', options.status);
      }
      if (options?.statuses && options.statuses.length > 0) {
        query = query.in('status', options.statuses);
      }
      if (options?.customerId) {
        query = query.eq('customer_id', options.customerId);
      }
      if (options?.subscriptionId) {
        query = query.eq('subscription_id', options.subscriptionId);
      }
      if (options?.dateFrom) {
        query = query.gte('due_date', options.dateFrom);
      }
      if (options?.dateTo) {
        query = query.lte('due_date', options.dateTo);
      }
      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const result = await query;
      return this.extractData<CustomerSubscriptionReceivable[]>(result, 'list receivables');
    } catch (error) {
      this.throwOnError(error, 'list receivables');
    }
  }

  async get(id: string, tenantId: string, appSlug?: string): Promise<CustomerSubscriptionReceivable | null> {
    try {
      const result = await this.from()
        .select('*')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      return this.extractData<CustomerSubscriptionReceivable | null>(result, 'get receivable');
    } catch (error) {
      this.throwOnError(error, 'get receivable');
    }
  }

  async exists(id: string, tenantId: string, appSlug?: string): Promise<boolean> {
    try {
      const result = await this.from()
        .select('id')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      const data = this.extractData<{ id: string } | null>(result, 'check receivable exists');
      return data !== null;
    } catch (error) {
      this.throwOnError(error, 'check receivable exists');
    }
  }

  async getPendingOrOverdue(tenantId: string, appSlug?: string): Promise<CustomerSubscriptionReceivable[]> {
    return this.list(tenantId, { statuses: ['pending', 'overdue'] }, appSlug);
  }

  async generateAndListPending(tenantId: string): Promise<CustomerSubscriptionReceivable[]> {
    try {
      await this.sharedDb.rpc('generate_club_receivables', { p_tenant_id: tenantId });
      return this.list(tenantId, { statuses: ['pending', 'overdue'] });
    } catch (error) {
      this.throwOnError(error, 'generate and list pending receivables');
    }
  }

  async getBySubscription(
    subscriptionId: string,
    tenantId: string,
    options?: { status?: ReceivableStatus; dateFrom?: string; dateTo?: string; limit?: number },
    appSlug?: string,
  ): Promise<CustomerSubscriptionReceivable[]> {
    return this.list(tenantId, {
      subscriptionId,
      status: options?.status,
      dateFrom: options?.dateFrom,
      dateTo: options?.dateTo,
      limit: options?.limit,
    }, appSlug);
  }
}

export interface ReceivableRepository extends IRepository<CustomerSubscriptionReceivable> {
  list(tenantId: string, options?: ReceivableListOptions, appSlug?: string): Promise<CustomerSubscriptionReceivable[]>;
  get(id: string, tenantId: string, appSlug?: string): Promise<CustomerSubscriptionReceivable | null>;
  exists(id: string, tenantId: string, appSlug?: string): Promise<boolean>;
  getPendingOrOverdue(tenantId: string, appSlug?: string): Promise<CustomerSubscriptionReceivable[]>;
  generateAndListPending(tenantId: string): Promise<CustomerSubscriptionReceivable[]>;
  getBySubscription(subscriptionId: string, tenantId: string, options?: { status?: ReceivableStatus; dateFrom?: string; dateTo?: string; limit?: number }, appSlug?: string): Promise<CustomerSubscriptionReceivable[]>;
}

export const receivableRepository = new ReceivableRepository();
