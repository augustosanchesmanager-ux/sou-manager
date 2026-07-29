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
}

export interface ServiceRepository extends IRepository<ServiceRecord> {
  list(tenantId: string): Promise<ServiceRecord[]>;
  get(id: string, tenantId: string): Promise<ServiceRecord | null>;
  exists(id: string, tenantId: string): Promise<boolean>;
  listActive(tenantId: string): Promise<ServiceRecord[]>;
  getPrice(id: string): Promise<number | null>;
}

export const serviceRepository = new ServiceRepositoryImpl();
