/**
 * [SMG][DOMAIN][CHEF_CLUB] ChefClubRpcRepository (ADR-056 — Lote 2)
 *
 * RESPONSABILIDADE: Encapsula todas as RPCs transacionais do Club dos Chefes
 * (créditos, assinaturas e recebíveis), removendo o acoplamento direto ao
 * cliente Supabase na camada `application/chefClub/*`.
 *
 * GARANTIAS:
 *   - Retorna `{ data, error }` tipado ou dados limpos, preservando o contrato
 *     de erro específico (`ChefClubError`) na camada de aplicação.
 *   - Resolução lazy do cliente Supabase para compatibilidade total com DI e testes.
 *   - Zero conhecimento de React, UI, navigate ou toast.
 */

import { createSupabaseClient } from '../shared/supabase-client-factory';
import type { DatabaseClient } from '../shared/database-client';

export interface RpcError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

export interface RpcCallResult<T = unknown> {
  data: T;
  error: RpcError | null;
}

export interface ChefClubRpcRepository {
  deductCredits(params: {
    subscriptionId: string;
    serviceId: string;
    amount: number;
    reference: string;
  }): Promise<RpcCallResult<unknown>>;
  createSubscription(params: {
    tenantId: string;
    clientId: string;
    planId: string;
    billingDay: number;
    replaceExisting?: boolean;
  }): Promise<RpcCallResult<string>>;
  cancelSubscriptionWithReceivables(params: {
    subscriptionId: string;
    tenantId: string;
    cancelReceivables: boolean;
    cancelReason?: string | null;
    cancelObservation?: string | null;
  }): Promise<RpcCallResult<{ subscription_cancelled: boolean; receivables_cancelled: number }>>;
  generateReceivables(tenantId: string): Promise<RpcCallResult<unknown>>;
  payReceivable(params: {
    receivableId: string;
    paymentMethod: string;
    paidAtIso: string;
    notes: string | null;
  }): Promise<RpcCallResult<unknown>>;
  refreshReceivableStatuses(tenantId: string): Promise<RpcCallResult<unknown>>;
  cancelReceivables(params: {
    subscriptionId: string;
    tenantId: string;
    cancelReason: string;
    cancelObservation?: string | null;
  }): Promise<RpcCallResult<number>>;
  cancelSingleReceivable(params: {
    receivableId: string;
    tenantId: string;
    cancelReason: string;
    cancelObservation?: string | null;
    cancelSubscription: boolean;
  }): Promise<
    RpcCallResult<{
      receivable_cancelled?: boolean;
      subscription_cancelled?: boolean;
      subscription_id?: string;
      receivables_cancelled?: number;
    }>
  >;
}

export type ChefClubRpcClientFactory = () => DatabaseClient;

export class ChefClubRpcRepositoryImpl implements ChefClubRpcRepository {
  constructor(
    private readonly getClient: ChefClubRpcClientFactory = () =>
      createSupabaseClient('customer_subscriptions', 'barber')
  ) {}

  async deductCredits(params: {
    subscriptionId: string;
    serviceId: string;
    amount: number;
    reference: string;
  }): Promise<RpcCallResult<unknown>> {
    const res = await this.getClient().rpc('deduct_chef_club_credits', {
      p_subscription_id: params.subscriptionId,
      p_service_id: params.serviceId,
      p_amount: params.amount,
      p_reference: params.reference,
    });
    return { data: res.data, error: res.error };
  }

  async createSubscription(params: {
    tenantId: string;
    clientId: string;
    planId: string;
    billingDay: number;
    replaceExisting?: boolean;
  }): Promise<RpcCallResult<string>> {
    const res = await this.getClient().rpc('create_chef_club_subscription', {
      p_tenant_id: params.tenantId,
      p_client_id: params.clientId,
      p_plan_id: params.planId,
      p_billing_day: params.billingDay,
      p_replace_existing: params.replaceExisting || false,
    });
    return { data: res.data as string, error: res.error };
  }

  async cancelSubscriptionWithReceivables(params: {
    subscriptionId: string;
    tenantId: string;
    cancelReceivables: boolean;
    cancelReason?: string | null;
    cancelObservation?: string | null;
  }): Promise<RpcCallResult<{ subscription_cancelled: boolean; receivables_cancelled: number }>> {
    const res = await this.getClient().rpc('cancel_subscription_with_receivables', {
      p_subscription_id: params.subscriptionId,
      p_tenant_id: params.tenantId,
      p_cancel_receivables: params.cancelReceivables,
      p_cancel_reason: params.cancelReason ?? null,
      p_cancel_observation: params.cancelObservation ?? null,
    });
    return {
      data: res.data as { subscription_cancelled: boolean; receivables_cancelled: number },
      error: res.error,
    };
  }

  async generateReceivables(tenantId: string): Promise<RpcCallResult<unknown>> {
    const res = await this.getClient().rpc('generate_club_receivables', {
      p_tenant_id: tenantId,
    });
    return { data: res.data, error: res.error };
  }

  async payReceivable(params: {
    receivableId: string;
    paymentMethod: string;
    paidAtIso: string;
    notes: string | null;
  }): Promise<RpcCallResult<unknown>> {
    const res = await this.getClient().rpc('pay_club_receivable', {
      p_receivable_id: params.receivableId,
      p_payment_method: params.paymentMethod,
      p_paid_at: params.paidAtIso,
      p_notes: params.notes,
    });
    return { data: res.data, error: res.error };
  }

  async refreshReceivableStatuses(tenantId: string): Promise<RpcCallResult<unknown>> {
    const res = await this.getClient().rpc('refresh_club_receivable_statuses', {
      p_tenant_id: tenantId,
    });
    return { data: res.data, error: res.error };
  }

  async cancelReceivables(params: {
    subscriptionId: string;
    tenantId: string;
    cancelReason: string;
    cancelObservation?: string | null;
  }): Promise<RpcCallResult<number>> {
    const res = await this.getClient().rpc('cancel_club_receivables', {
      p_subscription_id: params.subscriptionId,
      p_tenant_id: params.tenantId,
      p_cancel_reason: params.cancelReason,
      p_cancel_observation: params.cancelObservation ?? null,
    });
    return { data: Number(res.data ?? 0), error: res.error };
  }

  async cancelSingleReceivable(params: {
    receivableId: string;
    tenantId: string;
    cancelReason: string;
    cancelObservation?: string | null;
    cancelSubscription: boolean;
  }): Promise<
    RpcCallResult<{
      receivable_cancelled?: boolean;
      subscription_cancelled?: boolean;
      subscription_id?: string;
      receivables_cancelled?: number;
    }>
  > {
    const res = await this.getClient().rpc('cancel_single_club_receivable', {
      p_receivable_id: params.receivableId,
      p_tenant_id: params.tenantId,
      p_cancel_reason: params.cancelReason,
      p_cancel_observation: params.cancelObservation ?? null,
      p_cancel_subscription: params.cancelSubscription,
    });
    return {
      data: (res.data || {}) as {
        receivable_cancelled?: boolean;
        subscription_cancelled?: boolean;
        subscription_id?: string;
        receivables_cancelled?: number;
      },
      error: res.error,
    };
  }
}

export const chefClubRpcRepository: ChefClubRpcRepository = new ChefClubRpcRepositoryImpl();
