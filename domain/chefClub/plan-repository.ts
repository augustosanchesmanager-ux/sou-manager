/**
 * [SMG][DOMAIN][CHEF_CLUB] plan-repository
 *
 * RESPONSABILIDADE: Acesso a dados de planos do Clube (tabela customer_plans).
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

export interface PlanRow {
  id: string;
  name: string;
  monthly_price: number | string;
  service_credit_map: unknown;
  service_credits: unknown;
  description: string | null;
  priority_booking: boolean;
  product_discount: number | string;
  active: boolean;
}

const PLAN_COLUMNS = 'id, name, monthly_price, service_credit_map, service_credits, description, priority_booking, product_discount, active';

class ChefClubPlanRepositoryImpl extends SupabaseRepository {
  constructor(db?: DatabaseClient, appSlug: AppSlug = 'barber') {
    super('customer_plans', db ?? createSupabaseClient('customer_plans', appSlug));
  }

  async listActive(tenantId: string): Promise<PlanRow[]> {
    try {
      const result = await this.from()
        .select(PLAN_COLUMNS)
        .eq('tenant_id', tenantId)
        .eq('active', true)
        .order('name');
      return this.extractData<PlanRow[]>(result, 'list active plans');
    } catch (error) {
      this.throwOnError(error, 'list active plans');
    }
  }

  async listAll(tenantId: string): Promise<PlanRow[]> {
    try {
      const result = await this.from()
        .select(PLAN_COLUMNS)
        .eq('tenant_id', tenantId)
        .order('name');
      return this.extractData<PlanRow[]>(result, 'list all plans');
    } catch (error) {
      this.throwOnError(error, 'list all plans');
    }
  }

  async get(id: string, tenantId: string): Promise<PlanRow | null> {
    try {
      const result = await this.from()
        .select(PLAN_COLUMNS)
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      return this.extractData<PlanRow | null>(result, 'get plan by id');
    } catch (error) {
      this.throwOnError(error, 'get plan by id');
    }
  }

  async getByIds(ids: string[], tenantId: string): Promise<PlanRow[]> {
    try {
      if (ids.length === 0) return [];
      const result = await this.from()
        .select('id, name, monthly_price')
        .eq('tenant_id', tenantId)
        .in('id', ids);
      return this.extractData<PlanRow[]>(result, 'get plans by ids');
    } catch (error) {
      this.throwOnError(error, 'get plans by ids');
    }
  }

  async listByPrice(tenantId: string, ascending: boolean = true): Promise<PlanRow[]> {
    try {
      const result = await this.from()
        .select(PLAN_COLUMNS)
        .eq('tenant_id', tenantId)
        .order('monthly_price', { ascending });
      return this.extractData<PlanRow[]>(result, 'list plans by price');
    } catch (error) {
      this.throwOnError(error, 'list plans by price');
    }
  }

  async save(tenantId: string, data: Record<string, unknown>, editingPlanId?: string): Promise<void> {
    try {
      const payload = { ...data, tenant_id: tenantId };
      const result = editingPlanId
        ? await this.from().update(payload).eq('id', editingPlanId)
        : await this.from().insert(payload);
      this.extractData(result, 'save plan');
    } catch (error) {
      this.throwOnError(error, 'save plan');
    }
  }

  async delete(id: string, tenantId: string): Promise<void> {
    try {
      const result = await this.from()
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenantId);
      this.extractData(result, 'delete plan');
    } catch (error) {
      this.throwOnError(error, 'delete plan');
    }
  }

  async toggleStatus(id: string, active: boolean): Promise<void> {
    try {
      const result = await this.from()
        .update({ active })
        .eq('id', id);
      this.extractData(result, 'toggle plan status');
    } catch (error) {
      this.throwOnError(error, 'toggle plan status');
    }
  }

  async list(tenantId: string): Promise<PlanRow[]> {
    return this.listAll(tenantId);
  }

  async exists(id: string, tenantId: string): Promise<boolean> {
    try {
      const result = await this.from()
        .select('id')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      const data = this.extractData<{ id: string } | null>(result, 'check plan exists');
      return data !== null;
    } catch (error) {
      this.throwOnError(error, 'check plan exists');
    }
  }
}

export interface ChefClubPlanRepository extends IRepository<PlanRow> {
  list(tenantId: string): Promise<PlanRow[]>;
  get(id: string, tenantId: string): Promise<PlanRow | null>;
  exists(id: string, tenantId: string): Promise<boolean>;
  listActive(tenantId: string): Promise<PlanRow[]>;
  listAll(tenantId: string): Promise<PlanRow[]>;
  getByIds(ids: string[], tenantId: string): Promise<PlanRow[]>;
  listByPrice(tenantId: string, ascending?: boolean): Promise<PlanRow[]>;
  save(tenantId: string, data: Record<string, unknown>, editingPlanId?: string): Promise<void>;
  delete(id: string, tenantId: string): Promise<void>;
  toggleStatus(id: string, active: boolean): Promise<void>;
}

export const chefClubPlanRepository = new ChefClubPlanRepositoryImpl();
