/**
 * [SMG][DOMAIN][SERVICE] repository
 *
 * RESPONSABILIDADE: Acesso a dados de serviços (tabela services).
 */

import { SupabaseRepository } from '../shared/supabase-repository';
import { createSupabaseClient } from '../shared/supabase-client-factory';
import type { DatabaseClient } from '../shared/database-client';
import type { IRepository } from '../shared/repository';
import type { AppSlug } from '../shared/app';

export interface ServiceRecord {
  id: string;
  name: string;
}

class ServiceRepositoryImpl extends SupabaseRepository {
  constructor(db?: DatabaseClient, appSlug: AppSlug = 'barber') {
    super('services', db ?? createSupabaseClient('services', appSlug));
  }

  async list(tenantId: string): Promise<ServiceRecord[]> {
    try {
      const result = await this.from()
        .select('id, name')
        .eq('tenant_id', tenantId);
      return this.extractData<ServiceRecord[]>(result, 'list services');
    } catch (err) {
      this.throwOnError(err, 'list services');
    }
  }

  async get(id: string, tenantId: string): Promise<ServiceRecord | null> {
    try {
      const result = await this.from()
        .select('id, name')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      return this.extractData<ServiceRecord | null>(result, 'get service');
    } catch (err) {
      this.throwOnError(err, 'get service');
    }
  }

  async exists(id: string, tenantId: string): Promise<boolean> {
    try {
      const result = await this.from()
        .select('id')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      const data = this.extractData<{ id: string } | null>(result, 'check service exists');
      return data !== null;
    } catch (err) {
      this.throwOnError(err, 'check service exists');
    }
  }

  async listActive(tenantId: string): Promise<ServiceRecord[]> {
    try {
      const result = await this.from()
        .select('id, name, active')
        .eq('tenant_id', tenantId)
        .neq('active', false)
        .order('name', { ascending: true });
      return this.extractData<ServiceRecord[]>(result, 'list active services');
    } catch (err) {
      this.throwOnError(err, 'list active services');
    }
  }

  async getPrice(id: string): Promise<number | null> {
    try {
      const result = await this.from()
        .select('price')
        .eq('id', id)
        .maybeSingle();
      const data = this.extractData<{ price: number | string } | null>(result, 'get service price');
      return data?.price ? Number(data.price) : null;
    } catch (err) {
      this.throwOnError(err, 'get service price');
    }
  }

  async createMany(
    tenantId: string,
    rows: Array<{ name: string; category: string; price: number; duration: number }>,
  ): Promise<void> {
    if (rows.length === 0) return;
    try {
      const result = await this.from().insert(
        rows.map((row) => ({
          tenant_id: tenantId,
          name: row.name,
          category: row.category,
          price: row.price,
          duration: row.duration,
          active: true,
        })),
      );
      this.extractData(result, 'create services');
    } catch (err) {
      this.throwOnError(err, 'create services');
    }
  }

  async listFull(tenantId: string): Promise<any[]> {
    try {
      const result = await this.from()
        .select('*')
        .eq('tenant_id', tenantId)
        .order('name');
      return this.extractData<any[]>(result, 'list full services');
    } catch (err) {
      this.throwOnError(err, 'list full services');
    }
  }

  async create(payload: Record<string, unknown>): Promise<void> {
    try {
      const result = await this.from().insert(payload);
      this.extractData(result, 'create service');
    } catch (err) {
      this.throwOnError(err, 'create service');
    }
  }

  async createAndReturn(payload: Record<string, unknown>): Promise<Record<string, any>> {
    try {
      const result = await this.from()
        .insert([payload])
        .select('*')
        .single();
      return this.extractData<Record<string, any>>(result, 'create service');
    } catch (err) {
      this.throwOnError(err, 'create service');
    }
  }

  async update(id: string, tenantId: string, payload: Record<string, unknown>): Promise<void> {
    try {
      const result = await this.from()
        .update(payload)
        .eq('id', id)
        .eq('tenant_id', tenantId);
      this.extractData(result, 'update service');
    } catch (err) {
      this.throwOnError(err, 'update service');
    }
  }

  async setActive(id: string, tenantId: string, active: boolean): Promise<void> {
    try {
      const result = await this.from()
        .update({ active })
        .eq('id', id)
        .eq('tenant_id', tenantId);
      this.extractData(result, 'toggle service active');
    } catch (err) {
      this.throwOnError(err, 'toggle service active');
    }
  }

  async remove(id: string, tenantId: string): Promise<{ error: { code?: string; message: string } | null }> {
    const result = await this.from()
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);
    return { error: result.error as { code?: string; message: string } | null };
  }
}

export interface ServiceRepository extends IRepository<ServiceRecord> {
  list(tenantId: string): Promise<ServiceRecord[]>;
  get(id: string, tenantId: string): Promise<ServiceRecord | null>;
  exists(id: string, tenantId: string): Promise<boolean>;
  listActive(tenantId: string): Promise<ServiceRecord[]>;
  getPrice(id: string): Promise<number | null>;
  createMany(
    tenantId: string,
    rows: Array<{ name: string; category: string; price: number; duration: number }>,
  ): Promise<void>;
  listFull(tenantId: string): Promise<any[]>;
  create(payload: Record<string, unknown>): Promise<void>;
  createAndReturn(payload: Record<string, unknown>): Promise<Record<string, any>>;
  update(id: string, tenantId: string, payload: Record<string, unknown>): Promise<void>;
  setActive(id: string, tenantId: string, active: boolean): Promise<void>;
  remove(id: string, tenantId: string): Promise<{ error: { code?: string; message: string } | null }>;
}

export const serviceRepository = new ServiceRepositoryImpl();
