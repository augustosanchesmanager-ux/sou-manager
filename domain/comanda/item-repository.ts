/**
 * [SMG][DOMAIN][COMANDA] item-repository
 *
 * RESPONSABILIDADE: Acesso a dados de itens de comanda (tabela comanda_items).
 */

import { SupabaseRepository } from '../shared/supabase-repository';
import { createSupabaseClient } from '../shared/supabase-client-factory';
import type { DatabaseClient } from '../shared/database-client';
import type { AppSlug } from '../shared/app';

export interface ComandaItemRow {
  id: string;
  comanda_id: string;
  service_id: string | null;
  product_name: string | null;
  quantity: number;
  unit_price: number;
  staff_id: string | null;
}

class ComandaItemRepositoryImpl extends SupabaseRepository {
  private readonly defaultAppSlug: AppSlug;

  constructor(db?: DatabaseClient, appSlug: AppSlug = 'barber') {
    super('comanda_items', db ?? createSupabaseClient('comanda_items', appSlug));
    this.defaultAppSlug = appSlug;
  }

  async list(comandaId: string, tenantId: string): Promise<ComandaItemRow[]> {
    return this.listByComandaIds([comandaId], tenantId);
  }

  async listByComandaIds(comandaIds: string[], tenantId: string, appSlug?: AppSlug): Promise<ComandaItemRow[]> {
    try {
      if (comandaIds.length === 0) return [];
      const slug = appSlug || this.defaultAppSlug;
      const result = await createSupabaseClient(this.tableName, slug).from(this.tableName)
        .select('id, comanda_id, service_id, product_name, quantity, unit_price')
        .eq('tenant_id', tenantId)
        .in('comanda_id', comandaIds);
      return this.extractData<ComandaItemRow[]>(result, 'list comanda items by comanda ids');
    } catch (err) {
      this.throwOnError(err, 'list comanda items by comanda ids');
    }
  }

  async listForCommission(comandaIds: string[], tenantId: string): Promise<Array<Record<string, unknown>>> {
    try {
      if (comandaIds.length === 0) return [];
      const result = await createSupabaseClient(this.tableName, this.defaultAppSlug).from(this.tableName)
        .select('id, comanda_id, service_id, product_name, quantity, unit_price')
        .eq('tenant_id', tenantId)
        .in('comanda_id', comandaIds);
      return this.extractData(result, 'list comanda items for commission');
    } catch (err) {
      this.throwOnError(err, 'list comanda items for commission');
    }
  }

  async backupByComandaId(comandaId: string, tenantId: string): Promise<ComandaItemRow[]> {
    try {
      const result = await createSupabaseClient(this.tableName, this.defaultAppSlug).from(this.tableName)
        .select('*')
        .eq('comanda_id', comandaId)
        .eq('tenant_id', tenantId);
      return this.extractData<ComandaItemRow[]>(result, 'backup comanda items');
    } catch (err) {
      this.throwOnError(err, 'backup comanda items');
    }
  }

  async deleteByComandaId(comandaId: string, tenantId: string): Promise<void> {
    try {
      const result = await createSupabaseClient(this.tableName, this.defaultAppSlug).from(this.tableName)
        .delete()
        .eq('comanda_id', comandaId)
        .eq('tenant_id', tenantId);
      this.extractData(result, 'delete comanda items by comanda id');
    } catch (err) {
      this.throwOnError(err, 'delete comanda items by comanda id');
    }
  }

  async insertBatch(items: Record<string, unknown>[]): Promise<Array<{ id: string }>> {
    try {
      if (items.length === 0) return [];
      const result = await createSupabaseClient(this.tableName, this.defaultAppSlug).from(this.tableName)
        .insert(items)
        .select('id');
      return this.extractData(result, 'insert comanda items batch');
    } catch (err) {
      this.throwOnError(err, 'insert comanda items batch');
    }
  }

  async countByComandaId(comandaId: string, tenantId: string): Promise<number> {
    try {
      const result = await createSupabaseClient(this.tableName, this.defaultAppSlug).from(this.tableName)
        .select('*', { count: 'exact', head: true })
        .eq('comanda_id', comandaId)
        .eq('tenant_id', tenantId);
      if (result.error) {
        this.throwOnError(result, 'count comanda items');
      }
      return (result as any).count ?? (result.data as any)?.length ?? 0;
    } catch (err) {
      this.throwOnError(err, 'count comanda items');
    }
  }
}

export interface ComandaItemRepository {
  list(comandaId: string, tenantId: string): Promise<ComandaItemRow[]>;
  listByComandaIds(comandaIds: string[], tenantId: string, appSlug?: AppSlug): Promise<ComandaItemRow[]>;
  listForCommission(comandaIds: string[], tenantId: string): Promise<Array<Record<string, unknown>>>;
  backupByComandaId(comandaId: string, tenantId: string): Promise<ComandaItemRow[]>;
  deleteByComandaId(comandaId: string, tenantId: string): Promise<void>;
  insertBatch(items: Record<string, unknown>[]): Promise<Array<{ id: string }>>;
  countByComandaId(comandaId: string, tenantId: string): Promise<number>;
}

export const comandaItemRepository = new ComandaItemRepositoryImpl();
