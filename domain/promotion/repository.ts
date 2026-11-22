/**
 * [SMG][DOMAIN][PROMOTION] repository
 *
 * RESPONSABILIDADE: Acesso a dados de promoções (tabela promotions).
 */

import { SupabaseRepository } from '../shared/supabase-repository';
import { createSupabaseClient } from '../shared/supabase-client-factory';
import type { DatabaseClient } from '../shared/database-client';
import type { IRepository } from '../shared/repository';
import type { AppSlug } from '../shared/app';

export interface PromotionRecord {
  id: string;
  tenant_id?: string;
  title: string;
  target_type: 'service' | 'product' | 'all';
  target_id: string | null;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  start_date: string;
  end_date: string;
  active: boolean;
  created_at: string;
}

class PromotionRepositoryImpl extends SupabaseRepository {
  private readonly hasCustomDb: boolean;

  constructor(db?: DatabaseClient, appSlug: AppSlug = 'barber') {
    super('promotions', db ?? createSupabaseClient('promotions', appSlug));
    this.hasCustomDb = Boolean(db);
  }

  async list(tenantId: string): Promise<PromotionRecord[]> {
    try {
      const result = await this.from()
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      return this.extractData<PromotionRecord[]>(result, 'list promotions') ?? [];
    } catch (err) {
      this.throwOnError(err, 'list promotions');
    }
  }

  async listActive(tenantId: string, appSlug?: AppSlug): Promise<PromotionRecord[]> {
    try {
      const query = !this.hasCustomDb && appSlug
        ? createSupabaseClient('promotions', appSlug).from(this.tableName)
        : this.from();
      const result = await query
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('active', true);
      return this.extractData<PromotionRecord[]>(result, 'list active promotions') ?? [];
    } catch (err) {
      this.throwOnError(err, 'list active promotions');
    }
  }

  async create(tenantId: string, payload: Record<string, unknown>): Promise<void> {
    try {
      const result = await this.from().insert([{ ...payload, tenant_id: tenantId }]);
      this.extractData(result, 'create promotion');
    } catch (err) {
      this.throwOnError(err, 'create promotion');
    }
  }

  async setActive(id: string, tenantId: string, active: boolean): Promise<void> {
    try {
      const result = await this.from()
        .update({ active })
        .eq('id', id)
        .eq('tenant_id', tenantId);
      this.extractData(result, 'toggle promotion active');
    } catch (err) {
      this.throwOnError(err, 'toggle promotion active');
    }
  }

  async remove(id: string, tenantId: string): Promise<void> {
    try {
      const result = await this.from()
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenantId);
      this.extractData(result, 'delete promotion');
    } catch (err) {
      this.throwOnError(err, 'delete promotion');
    }
  }
}

export interface PromotionRepository extends IRepository<PromotionRecord> {
  list(tenantId: string): Promise<PromotionRecord[]>;
  listActive(tenantId: string, appSlug?: AppSlug): Promise<PromotionRecord[]>;
  create(tenantId: string, payload: Record<string, unknown>): Promise<void>;
  setActive(id: string, tenantId: string, active: boolean): Promise<void>;
  remove(id: string, tenantId: string): Promise<void>;
}

export const promotionRepository = new PromotionRepositoryImpl();
