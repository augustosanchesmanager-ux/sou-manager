/**
 * [SMG][DOMAIN][APPOINTMENT] AppointmentRpcRepository (ADR-056 — Lote 3)
 *
 * RESPONSABILIDADE: Encapsula as RPCs transacionais de criação de agendamento
 * e verificação/estorno de pagamentos de comandas no cancelamento, removendo
 * acoplamento direto ao cliente Supabase em `application/appointment/lifecycle.ts`.
 *
 * GARANTIAS:
 *   - Resolução lazy do cliente Supabase para compatibilidade total com DI e testes
 *   - Zero regra de negócio / publicação de eventos
 *   - Zero conhecimento de React, UI, navigate ou toast
 */

import { createSupabaseClient } from '../shared/supabase-client-factory';
import type { DatabaseClient } from '../shared/database-client';

export interface AppointmentRpcError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

export interface AppointmentRpcResult<T = unknown> {
  data: T;
  error: AppointmentRpcError | null;
}

export interface AppointmentRpcRepository {
  createAppointmentRpc(
    rpcName: 'create_appointment_with_services' | 'create_appointment_with_comanda',
    params: Record<string, unknown>
  ): Promise<AppointmentRpcResult<unknown>>;
  checkComandaHasValidPayments(
    tenantId: string,
    comandaId: string
  ): Promise<AppointmentRpcResult<{ has_valid_payments?: boolean } | null>>;
  getComandaPaymentSummary(
    tenantId: string,
    comandaId: string
  ): Promise<AppointmentRpcResult<{ payments?: Array<{ id: string }> } | null>>;
  reverseComandaPayment(params: {
    tenantId: string;
    comandaPaymentId: string;
    motivo: string;
    refundMethod: string;
    actorId: string | null;
  }): Promise<AppointmentRpcResult<unknown>>;
}

export type AppointmentRpcClientFactory = () => DatabaseClient;

export class AppointmentRpcRepositoryImpl implements AppointmentRpcRepository {
  constructor(
    private readonly getClient: AppointmentRpcClientFactory = () =>
      createSupabaseClient('appointments', 'barber')
  ) {}

  async createAppointmentRpc(
    rpcName: 'create_appointment_with_services' | 'create_appointment_with_comanda',
    params: Record<string, unknown>
  ): Promise<AppointmentRpcResult<unknown>> {
    const res = await this.getClient().rpc(rpcName, params);
    return { data: res.data, error: res.error };
  }

  async checkComandaHasValidPayments(
    tenantId: string,
    comandaId: string
  ): Promise<AppointmentRpcResult<{ has_valid_payments?: boolean } | null>> {
    const res = await this.getClient().rpc('check_comanda_has_valid_payments', {
      p_tenant_id: tenantId,
      p_comanda_id: comandaId,
    });
    return {
      data: (res.data as { has_valid_payments?: boolean } | null) ?? null,
      error: res.error,
    };
  }

  async getComandaPaymentSummary(
    tenantId: string,
    comandaId: string
  ): Promise<AppointmentRpcResult<{ payments?: Array<{ id: string }> } | null>> {
    const res = await this.getClient().rpc('get_comanda_payment_summary', {
      p_tenant_id: tenantId,
      p_comanda_id: comandaId,
    });
    return {
      data: (res.data as { payments?: Array<{ id: string }> } | null) ?? null,
      error: res.error,
    };
  }

  async reverseComandaPayment(params: {
    tenantId: string;
    comandaPaymentId: string;
    motivo: string;
    refundMethod: string;
    actorId: string | null;
  }): Promise<AppointmentRpcResult<unknown>> {
    const res = await this.getClient().rpc('reverse_comanda_payment', {
      p_tenant_id: params.tenantId,
      p_comanda_payment_id: params.comandaPaymentId,
      p_motivo: params.motivo,
      p_refund_method: params.refundMethod,
      p_actor_id: params.actorId,
    });
    return { data: res.data, error: res.error };
  }
}

export const appointmentRpcRepository: AppointmentRpcRepository = new AppointmentRpcRepositoryImpl();
