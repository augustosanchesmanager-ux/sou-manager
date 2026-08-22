/**
 * [SMG][DOMAIN][COMMISSION] commissionRecordRepository
 *
 * Repository for commission_records table.
 * Append-only: only insert and select operations.
 * Reversals are handled via the RPC create_commission_reversal.
 */

import { SupabaseRepository } from '../shared/supabase-repository';
import { createSupabaseClient } from '../shared/supabase-client-factory';
import type { DatabaseClient } from '../shared/database-client';
import type {
  CommissionRecord,
  CreateCommissionRecordInput,
  CommissionReversalResult,
  CommissionRecordListOptions,
} from './commissionRecordTypes';

export class CommissionRecordRepository extends SupabaseRepository {
  constructor(db?: DatabaseClient) {
    super('commission_records', db ?? createSupabaseClient('commission_records', 'barber'));
  }

  /**
   * Create a new commission record (append-only).
   * Throws RepositoryError on failure (including UNIQUE violations).
   */
  async create(input: CreateCommissionRecordInput, tenantId: string): Promise<CommissionRecord> {
    try {
      const result = await this.from()
        .insert({
          tenant_id: tenantId,
          record_type: 'commission',
          comanda_id: input.comanda_id,
          comanda_item_id: input.comanda_item_id ?? null,
          staff_id: input.staff_id,
          gross_value: input.gross_value,
          discount: input.discount ?? 0,
          net_value: input.net_value,
          received_value: input.received_value,
          commission_rate: input.commission_rate,
          commission_value: input.commission_value,
          participant_share: input.participant_share ?? 1.0,
          payout_type: input.payout_type ?? 'percentage',
          affects_commission: input.affects_commission ?? true,
          original_record_id: null,
          idempotency_key: input.idempotency_key,
          event_id: input.event_id ?? null,
          event_type: input.event_type ?? null,
          status: 'active',
        })
        .select()
        .single();

      return this.extractData<CommissionRecord>(result, 'create commission_record');
    } catch (error) {
      this.throwOnError(error, 'create commission_record');
    }
  }

  /**
   * List commission records with optional filters.
   */
  async list(
    tenantId: string,
    options?: CommissionRecordListOptions,
  ): Promise<CommissionRecord[]> {
    try {
      let query = this.from()
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (options?.comanda_id) {
        query = query.eq('comanda_id', options.comanda_id);
      }
      if (options?.staff_id) {
        query = query.eq('staff_id', options.staff_id);
      }
      if (options?.record_type) {
        query = query.eq('record_type', options.record_type);
      }
      if (options?.dateFrom) {
        query = query.gte('created_at', options.dateFrom);
      }
      if (options?.dateTo) {
        query = query.lte('created_at', options.dateTo);
      }

      const result = await query;
      return this.extractData<CommissionRecord[]>(result, 'list commission_records');
    } catch (error) {
      this.throwOnError(error, 'list commission_records');
    }
  }

  /**
   * Get a single commission record by ID.
   */
  async get(id: string, tenantId: string): Promise<CommissionRecord | null> {
    try {
      const result = await this.from()
        .select('*')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .single();

      const data = result.data as CommissionRecord | null;
      if (result.error?.code === 'PGRST116') return null;
      if (result.error) {
        this.throwOnError(result.error, 'get commission_record');
      }
      return data;
    } catch (error) {
      this.throwOnError(error, 'get commission_record');
    }
  }

  /**
   * Check if a commission record exists for a given staff+comanda.
   */
  async existsByStaffComanda(
    staffId: string,
    comandaId: string,
    tenantId: string,
  ): Promise<boolean> {
    try {
      const result = await this.from()
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('staff_id', staffId)
        .eq('comanda_id', comandaId)
        .eq('record_type', 'commission')
        .limit(1);

      const data = this.extractData<Array<{ id: string }>>(result, 'existsByStaffComanda commission_record');
      return data.length > 0;
    } catch (error) {
      this.throwOnError(error, 'existsByStaffComanda commission_record');
    }
  }

  /**
   * Calculate net commission for a staff member on a given day.
   * Net = SUM(commission_value) for all records (commissions + reversals).
   */
  async calculateDailyNet(
    staffId: string,
    date: string,
    tenantId: string,
  ): Promise<number> {
    try {
      const startOfDay = `${date}T00:00:00`;
      const endOfDay = `${date}T23:59:59`;

      const result = await this.from()
        .select('commission_value')
        .eq('tenant_id', tenantId)
        .eq('staff_id', staffId)
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay);

      const data = this.extractData<Array<{ commission_value: number }>>(
        result,
        'calculateDailyNet commission_records',
      );

      return data.reduce((sum, r) => sum + Number(r.commission_value), 0);
    } catch (error) {
      this.throwOnError(error, 'calculateDailyNet commission_records');
    }
  }

  /**
   * Create a commission reversal via the RPC.
   * The RPC handles advisory lock, FOR UPDATE, validation, and insert.
   */
  async createReversal(params: {
    tenantId: string;
    originalRecordId: string;
    commissionValue: number;
    idempotencyKey: string;
    eventId?: string;
    eventType?: string;
  }): Promise<CommissionReversalResult> {
    try {
      const result = await this.db.rpc('create_commission_reversal', {
        p_tenant_id: params.tenantId,
        p_original_record_id: params.originalRecordId,
        p_commission_value: params.commissionValue,
        p_idempotency_key: params.idempotencyKey,
        p_event_id: params.eventId ?? null,
        p_event_type: params.eventType ?? null,
      });

      const data = result.data as CommissionReversalResult | null;
      if (result.error) {
        const err = result.error as { message?: string; code?: string };
        return {
          success: false,
          error: err?.message || 'Erro desconhecido ao criar reversao',
        };
      }
      return data ?? { success: false, error: 'Resposta vazia do servidor' };
    } catch (error) {
      const err = error as { message?: string };
      return {
        success: false,
        error: err?.message || 'Erro desconhecido ao criar reversao',
      };
    }
  }
}

export const commissionRecordRepository = new CommissionRecordRepository();
