/**
 * [SMG][DOMAIN][TRANSACTION] repository
 *
 * Acesso a dados de transações financeiras.
 */

import { SupabaseRepository } from '../shared/supabase-repository';
import { createSupabaseClient } from '../shared/supabase-client-factory';
import type { DatabaseClient } from '../shared/database-client';
import type { IRepository } from '../shared/repository';
import type { Transaction, CreateTransactionInput, UpdateTransactionInput, TransactionListOptions } from './types';

export class TransactionRepository extends SupabaseRepository {
  constructor(db?: DatabaseClient) {
    super('transactions', db ?? createSupabaseClient('transactions', 'barber'));
  }

  async list(
    tenantId: string,
    options?: TransactionListOptions,
    appSlug?: string,
  ): Promise<Transaction[]> {
    try {
      let query = this.from()
        .select('*')
        .eq('tenant_id', tenantId)
        .order('date', { ascending: false });

      if (options?.type) {
        query = query.eq('type', options.type);
      }
      if (options?.status) {
        query = query.eq('status', options.status);
      }
      if (options?.category) {
        query = query.eq('category', options.category);
      }
      if (options?.dateFrom) {
        query = query.gte('date', options.dateFrom);
      }
      if (options?.dateTo) {
        query = query.lte('date', options.dateTo);
      }
      if (options?.sourceType) {
        query = query.eq('source_type', options.sourceType);
      }
      if (options?.sourceId) {
        query = query.eq('source_id', options.sourceId);
      }
      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const result = await query;
      return this.extractData<Transaction[]>(result, 'list transactions');
    } catch (error) {
      this.throwOnError(error, 'list transactions');
    }
  }

  async get(id: string, tenantId: string, appSlug?: string): Promise<Transaction | null> {
    try {
      const result = await this.from()
        .select('*')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      return this.extractData<Transaction | null>(result, 'get transaction');
    } catch (error) {
      this.throwOnError(error, 'get transaction');
    }
  }

  async create(
    input: CreateTransactionInput,
    tenantId: string,
    appSlug?: string,
  ): Promise<Transaction> {
    try {
      const result = await this.from()
        .insert({
          tenant_id: tenantId,
          type: input.type,
          category: input.category,
          amount: input.amount,
          description: input.description,
          payment_method: input.payment_method ?? null,
          date: input.date,
          status: input.status ?? 'paid',
          source_type: input.source_type ?? null,
          source_id: input.source_id ?? null,
        })
        .select()
        .single();

      return this.extractData<Transaction>(result, 'create transaction');
    } catch (error) {
      this.throwOnError(error, 'create transaction');
    }
  }

  async update(
    id: string,
    input: UpdateTransactionInput,
    tenantId: string,
    appSlug?: string,
  ): Promise<void> {
    try {
      const fields: Record<string, unknown> = {};
      if (input.type !== undefined) fields.type = input.type;
      if (input.category !== undefined) fields.category = input.category;
      if (input.amount !== undefined) fields.amount = input.amount;
      if (input.description !== undefined) fields.description = input.description;
      if (input.payment_method !== undefined) fields.payment_method = input.payment_method;
      if (input.date !== undefined) fields.date = input.date;
      if (input.status !== undefined) fields.status = input.status;
      if (input.source_type !== undefined) fields.source_type = input.source_type;
      if (input.source_id !== undefined) fields.source_id = input.source_id;

      if (Object.keys(fields).length === 0) return;

      const result = await this.from()
        .update(fields)
        .eq('id', id)
        .eq('tenant_id', tenantId);

      this.extractData(result, 'update transaction');
    } catch (error) {
      this.throwOnError(error, 'update transaction');
    }
  }

  async delete(id: string, tenantId: string, appSlug?: string): Promise<void> {
    try {
      const result = await this.from()
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenantId);

      this.extractData(result, 'delete transaction');
    } catch (error) {
      this.throwOnError(error, 'delete transaction');
    }
  }

  async createBulk(
    records: Array<CreateTransactionInput & { user_id?: string }>,
    tenantId: string,
    appSlug?: string,
  ): Promise<void> {
    try {
      if (records.length === 0) return;

      const rows = records.map(input => ({
        tenant_id: tenantId,
        type: input.type,
        category: input.category,
        amount: input.amount,
        description: input.description,
        payment_method: input.payment_method ?? null,
        date: input.date,
        status: input.status ?? 'completed',
        source_type: input.source_type ?? null,
        source_id: input.source_id ?? null,
        user_id: input.user_id ?? null,
      }));

      const result = await this.from().insert(rows);
      this.extractData(result, 'bulk create transactions');
    } catch (error) {
      this.throwOnError(error, 'bulk create transactions');
    }
  }

  async exists(id: string, tenantId: string, appSlug?: string): Promise<boolean> {
    try {
      const result = await this.from()
        .select('id')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      const data = this.extractData<{ id: string } | null>(result, 'check transaction exists');
      return data !== null;
    } catch (error) {
      this.throwOnError(error, 'check transaction exists');
    }
  }
}

export interface TransactionRepository extends IRepository<Transaction> {
  list(tenantId: string, options?: TransactionListOptions, appSlug?: string): Promise<Transaction[]>;
  get(id: string, tenantId: string, appSlug?: string): Promise<Transaction | null>;
  exists(id: string, tenantId: string, appSlug?: string): Promise<boolean>;
  create(input: CreateTransactionInput, tenantId: string, appSlug?: string): Promise<Transaction>;
  update(id: string, input: UpdateTransactionInput, tenantId: string, appSlug?: string): Promise<void>;
  delete(id: string, tenantId: string, appSlug?: string): Promise<void>;
  createBulk(records: Array<CreateTransactionInput & { user_id?: string }>, tenantId: string, appSlug?: string): Promise<void>;
}

export const transactionRepository = new TransactionRepository();
