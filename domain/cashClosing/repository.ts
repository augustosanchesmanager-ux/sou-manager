/**
 * [SMG][DOMAIN][CASH_CLOSING] repository
 *
 * Acesso a dados de fechamento de caixa.
 * Tabelas: cash_closings, barber_closings, cash_closing_events
 *
 * Concentrado em: src/hooks/useCashClosing.ts
 */

import { SupabaseRepository } from '../shared/supabase-repository';
import { createSupabaseClient } from '../shared/supabase-client-factory';
import type { DatabaseClient } from '../shared/database-client';
import type { CashClosingRecord, BarberClosingRecord, CashClosingEventRecord } from './types';

class CashClosingRepositoryImpl extends SupabaseRepository {
  constructor(db?: DatabaseClient) {
    super('cash_closings', db ?? createSupabaseClient('cash_closings', 'barber'));
  }

  async list(tenantId: string): Promise<CashClosingRecord[]> {
    try {
      const result = await this.from()
        .select('*')
        .eq('tenant_id', tenantId)
        .order('business_date', { ascending: false });
      return this.extractData<CashClosingRecord[]>(result, 'list cash closings');
    } catch (error) {
      this.throwOnError(error, 'list cash closings');
    }
  }

  async get(id: string, tenantId: string): Promise<CashClosingRecord | null> {
    try {
      const result = await this.from()
        .select('*')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      return this.extractData<CashClosingRecord | null>(result, 'get cash closing');
    } catch (error) {
      this.throwOnError(error, 'get cash closing');
    }
  }

  async exists(id: string, tenantId: string): Promise<boolean> {
    try {
      const result = await this.from()
        .select('id')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      const data = this.extractData<{ id: string } | null>(result, 'check cash closing exists');
      return data !== null;
    } catch (error) {
      this.throwOnError(error, 'check cash closing exists');
    }
  }

  async getByBusinessDate(
    tenantId: string,
    businessDate: string,
    appSlug?: string,
  ): Promise<CashClosingRecord | null> {
    try {
      const result = await this.from()
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('business_date', businessDate)
        .maybeSingle();

      return this.extractData<CashClosingRecord | null>(result, 'get cash closing by business date');
    } catch (error) {
      this.throwOnError(error, 'get cash closing by business date');
    }
  }

  async upsert(
    record: Partial<CashClosingRecord> & { tenant_id: string; business_date: string },
    appSlug?: string,
  ): Promise<CashClosingRecord> {
    try {
      const result = await this.from()
        .upsert(record, { onConflict: 'tenant_id,business_date' })
        .select()
        .single();

      return this.extractData<CashClosingRecord>(result, 'upsert cash closing');
    } catch (error) {
      this.throwOnError(error, 'upsert cash closing');
    }
  }

  async updateBarberClosingsCount(
    id: string,
    tenantId: string,
    counts: { barber_closings_count: number; barber_closings_complete: boolean },
    appSlug?: string,
  ): Promise<void> {
    try {
      const result = await this.from()
        .update(counts)
        .eq('id', id)
        .eq('tenant_id', tenantId);

      this.extractData(result, 'update barber closings count');
    } catch (error) {
      this.throwOnError(error, 'update barber closings count');
    }
  }
}

class BarberClosingRepositoryImpl extends SupabaseRepository {
  constructor(db?: DatabaseClient) {
    super('barber_closings', db ?? createSupabaseClient('barber_closings', 'barber'));
  }

  async list(tenantId: string): Promise<BarberClosingRecord[]> {
    try {
      const result = await this.from()
        .select('*')
        .eq('tenant_id', tenantId);
      return this.extractData<BarberClosingRecord[]>(result, 'list barber closings');
    } catch (error) {
      this.throwOnError(error, 'list barber closings');
    }
  }

  async get(id: string, tenantId: string): Promise<BarberClosingRecord | null> {
    try {
      const result = await this.from()
        .select('*')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      return this.extractData<BarberClosingRecord | null>(result, 'get barber closing');
    } catch (error) {
      this.throwOnError(error, 'get barber closing');
    }
  }

  async exists(id: string, tenantId: string): Promise<boolean> {
    try {
      const result = await this.from()
        .select('id')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      const data = this.extractData<{ id: string } | null>(result, 'check barber closing exists');
      return data !== null;
    } catch (error) {
      this.throwOnError(error, 'check barber closing exists');
    }
  }

  async getByCashClosingId(
    cashClosingId: string,
    tenantId: string,
    appSlug?: string,
  ): Promise<BarberClosingRecord[]> {
    try {
      const result = await this.from()
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('cash_closing_id', cashClosingId)
        .order('created_at', { ascending: true });

      return this.extractData<BarberClosingRecord[]>(result, 'get barber closings by cash closing id');
    } catch (error) {
      this.throwOnError(error, 'get barber closings by cash closing id');
    }
  }

  async getIdAndStatusByCashClosingId(
    cashClosingId: string,
    tenantId: string,
    appSlug?: string,
  ): Promise<{ id: string; status: string }[]> {
    try {
      const result = await this.from()
        .select('id, status')
        .eq('cash_closing_id', cashClosingId);

      return this.extractData<{ id: string; status: string }[]>(result, 'get barber closing ids and statuses');
    } catch (error) {
      this.throwOnError(error, 'get barber closing ids and statuses');
    }
  }

  async upsert(
    record: Partial<BarberClosingRecord> & {
      tenant_id: string;
      cash_closing_id: string;
      staff_id: string;
    },
    appSlug?: string,
  ): Promise<BarberClosingRecord> {
    try {
      const result = await this.from()
        .upsert(record, { onConflict: 'tenant_id,cash_closing_id,staff_id' })
        .select()
        .single();

      return this.extractData<BarberClosingRecord>(result, 'upsert barber closing');
    } catch (error) {
      this.throwOnError(error, 'upsert barber closing');
    }
  }
}

class CashClosingEventRepositoryImpl extends SupabaseRepository {
  constructor(db?: DatabaseClient) {
    super('cash_closing_events', db ?? createSupabaseClient('cash_closing_events', 'barber'));
  }

  async list(tenantId: string): Promise<CashClosingEventRecord[]> {
    try {
      const result = await this.from()
        .select('*')
        .eq('tenant_id', tenantId);
      return this.extractData<CashClosingEventRecord[]>(result, 'list closing events');
    } catch (error) {
      this.throwOnError(error, 'list closing events');
    }
  }

  async get(id: string, tenantId: string): Promise<CashClosingEventRecord | null> {
    try {
      const result = await this.from()
        .select('*')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      return this.extractData<CashClosingEventRecord | null>(result, 'get closing event');
    } catch (error) {
      this.throwOnError(error, 'get closing event');
    }
  }

  async exists(id: string, tenantId: string): Promise<boolean> {
    try {
      const result = await this.from()
        .select('id')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      const data = this.extractData<{ id: string } | null>(result, 'check closing event exists');
      return data !== null;
    } catch (error) {
      this.throwOnError(error, 'check closing event exists');
    }
  }

  async getByBusinessDate(
    tenantId: string,
    businessDate: string,
    appSlug?: string,
  ): Promise<CashClosingEventRecord[]> {
    try {
      const result = await this.from()
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('business_date', businessDate)
        .order('event_time', { ascending: true });

      return this.extractData<CashClosingEventRecord[]>(result, 'get closing events by business date');
    } catch (error) {
      this.throwOnError(error, 'get closing events by business date');
    }
  }

  async insert(
    event: Omit<CashClosingEventRecord, 'id' | 'created_at'>,
    appSlug?: string,
  ): Promise<CashClosingEventRecord> {
    try {
      const result = await this.from()
        .insert(event)
        .select()
        .single();

      return this.extractData<CashClosingEventRecord>(result, 'insert closing event');
    } catch (error) {
      this.throwOnError(error, 'insert closing event');
    }
  }
}

export interface CashClosingRepository {
  list(tenantId: string): Promise<CashClosingRecord[]>;
  get(id: string, tenantId: string): Promise<CashClosingRecord | null>;
  exists(id: string, tenantId: string): Promise<boolean>;
  getByBusinessDate(tenantId: string, businessDate: string, appSlug?: string): Promise<CashClosingRecord | null>;
  upsert(record: Partial<CashClosingRecord> & { tenant_id: string; business_date: string }, appSlug?: string): Promise<CashClosingRecord>;
  updateBarberClosingsCount(id: string, tenantId: string, counts: { barber_closings_count: number; barber_closings_complete: boolean }, appSlug?: string): Promise<void>;
}

export interface BarberClosingRepository {
  list(tenantId: string): Promise<BarberClosingRecord[]>;
  get(id: string, tenantId: string): Promise<BarberClosingRecord | null>;
  exists(id: string, tenantId: string): Promise<boolean>;
  getByCashClosingId(cashClosingId: string, tenantId: string, appSlug?: string): Promise<BarberClosingRecord[]>;
  getIdAndStatusByCashClosingId(cashClosingId: string, tenantId: string, appSlug?: string): Promise<{ id: string; status: string }[]>;
  upsert(record: Partial<BarberClosingRecord> & { tenant_id: string; cash_closing_id: string; staff_id: string }, appSlug?: string): Promise<BarberClosingRecord>;
}

export interface CashClosingEventRepository {
  list(tenantId: string): Promise<CashClosingEventRecord[]>;
  get(id: string, tenantId: string): Promise<CashClosingEventRecord | null>;
  exists(id: string, tenantId: string): Promise<boolean>;
  getByBusinessDate(tenantId: string, businessDate: string, appSlug?: string): Promise<CashClosingEventRecord[]>;
  insert(event: Omit<CashClosingEventRecord, 'id' | 'created_at'>, appSlug?: string): Promise<CashClosingEventRecord>;
}

export const cashClosingRepository = new CashClosingRepositoryImpl();
export const barberClosingRepository = new BarberClosingRepositoryImpl();
export const cashClosingEventRepository = new CashClosingEventRepositoryImpl();
