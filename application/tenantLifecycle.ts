/**
 * [SMG][APPLICATION][TENANT_LIFECYCLE] TenantLifecycleService
 *
 * RESPONSABILIDADE: Orquestra o ciclo de vida da assinatura do tenant
 * (Lifecycle Billing 6.0.4.3), espelhando TenantProvisioningService.
 *   - O Application Service É o responsável pelas decisões de negócio
 *   - As RPCs fazem apenas o trabalho transacional
 *     (start_trial / activate_subscription / cancel_subscription / get_subscription)
 *   - A emissão dos eventos de domínio de billing (TenantSubscription* /
 *     TenantTrial*) é centralizada EXCLUSIVAMENTE aqui — RPCs e controllers
 *     apenas orquestram, preservando a arquitetura orientada a eventos
 *
 * FLUXO:
 *   startTrial : valida → RPC start_trial (draft→trial, cria sub trialing)
 *                → publica TenantSubscriptionCreated + TenantTrialStarted
 *   activate   : valida → RPC activate_subscription (trialing→active)
 *                → publica TenantSubscriptionUpdated
 *   cancel     : valida → RPC cancel_subscription (pedido: cancel_at_period_end)
 *                → publica TenantSubscriptionUpdated (acesso mantido)
 *                → efetivação (cancelled) via BillingService.runCycle (6.0.4.4)
 *   getStatus  : RPC get_subscription (leitura do tenant resolvido do chamador)
 *
 * NÃO FAZ:
 *   - Transições diretas em tenants/subscriptions (são transacionais nas RPCs)
 *   - Cobrança/renovação (Billing Engine 6.0.4.4)
 *   - Renderização de UI
 *
 * GARANTIAS:
 *   - start_trial é idempotente (RPC devolve a subscription existente)
 *   - Transição draft → trial é OBRIGATÓRIA (F10) — nunca draft → active
 *   - Eventos publicados apenas após sucesso transacional da RPC
 */

import { createSupabaseClient } from '../domain/shared/supabase-client-factory';
import { appEventBus } from '../domain/events/app-bus';
import { createEvent } from '../domain/events/types';
import type {
  TenantSubscriptionCreatedEvent,
  TenantSubscriptionUpdatedEvent,
  TenantTrialStartedEvent,
} from '../domain/events/types';

// ─── RPC Client (subscriptions é tabela compartilhada — public) ──────
function getRpcClient() {
  return createSupabaseClient('subscriptions', 'barber');
}

// ─── Types ──────────────────────────────────────────────────────────

export type TenantPlan = 'free' | 'pro' | 'premium';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'cancelled';

export interface TenantSubscriptionView {
  id: string;
  tenantId: string;
  plan: TenantPlan;
  status: SubscriptionStatus;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: string | null;
  canceledAt: string | null;
  createdAt: string | null;
}

interface SubscriptionRow {
  id: string;
  tenant_id: string;
  plan: TenantPlan;
  status: SubscriptionStatus;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: string | null;
  canceled_at: string | null;
  created_at: string | null;
}

const VALID_PLANS: TenantPlan[] = ['free', 'pro', 'premium'];

// ─── Validation (Regra de Negócio) ──────────────────────────────────

function validateTenantId(tenantId: string): void {
  if (!tenantId || tenantId.trim() === '') {
    throw new Error('tenantId é obrigatório');
  }
}

function validatePlan(plan?: TenantPlan): void {
  if (plan && !VALID_PLANS.includes(plan)) {
    throw new Error(`Plano inválido. Permitidos: ${VALID_PLANS.join(', ')}`);
  }
}

// ─── Mapper ─────────────────────────────────────────────────────────

function toSubscriptionView(row: SubscriptionRow): TenantSubscriptionView {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    plan: row.plan,
    status: row.status,
    trialStartedAt: row.trial_started_at ?? null,
    trialEndsAt: row.trial_ends_at ?? null,
    currentPeriodStart: row.current_period_start ?? null,
    currentPeriodEnd: row.current_period_end ?? null,
    cancelAtPeriodEnd: row.cancel_at_period_end ?? null,
    canceledAt: row.canceled_at ?? null,
    createdAt: row.created_at ?? null,
  };
}

// ─── Service (Orquestrador) ─────────────────────────────────────────

export class TenantLifecycleServiceImpl {
  constructor(
    private readonly getClient: () => ReturnType<typeof createSupabaseClient> = getRpcClient,
  ) {}

  /**
   * Inicia o trial (draft → trial). Idempotente: se a subscription já
   * existir, devolve a existente. Publica TenantSubscriptionCreated +
   * TenantTrialStarted após sucesso transacional.
   */
  async startTrial(tenantId: string, plan?: TenantPlan): Promise<TenantSubscriptionView> {
    validateTenantId(tenantId);
    validatePlan(plan);

    const { data, error } = await this.getClient()
      .rpc('start_trial', { p_tenant_id: tenantId, p_plan: plan ?? null })
      .single();

    if (error) {
      throw new Error(`Erro ao iniciar trial: ${error.message}`);
    }
    if (!data) {
      throw new Error('RPC start_trial retornou resultado inválido');
    }

    const view = toSubscriptionView(data as SubscriptionRow);

    await appEventBus.publish(createEvent<TenantSubscriptionCreatedEvent>({
      eventType: 'TenantSubscriptionCreated',
      aggregateId: view.id,
      aggregateType: 'tenant_subscription',
      payload: {
        subscriptionId: view.id,
        tenantId: view.tenantId,
        plan: view.plan,
        status: view.status,
        trialStartedAt: view.trialStartedAt,
        trialEndsAt: view.trialEndsAt,
      },
      metadata: {
        tenantId: view.tenantId,
        source: 'TenantLifecycleService',
      },
    }));

    await appEventBus.publish(createEvent<TenantTrialStartedEvent>({
      eventType: 'TenantTrialStarted',
      aggregateId: view.id,
      aggregateType: 'tenant_subscription',
      payload: {
        subscriptionId: view.id,
        tenantId: view.tenantId,
        trialStartedAt: view.trialStartedAt ?? new Date(0).toISOString(),
        trialEndsAt: view.trialEndsAt ?? new Date(0).toISOString(),
      },
      metadata: {
        tenantId: view.tenantId,
        source: 'TenantLifecycleService',
      },
    }));

    return view;
  }

  /**
   * Ativa a assinatura (trialing → active; tenants trial → active).
   * Publica TenantSubscriptionUpdated após sucesso transacional.
   */
  async activate(tenantId: string): Promise<TenantSubscriptionView> {
    validateTenantId(tenantId);

    const { data, error } = await this.getClient()
      .rpc('activate_subscription', { p_tenant_id: tenantId })
      .single();

    if (error) {
      throw new Error(`Erro ao ativar assinatura: ${error.message}`);
    }
    if (!data) {
      throw new Error('RPC activate_subscription retornou resultado inválido');
    }

    const view = toSubscriptionView(data as SubscriptionRow);

    await appEventBus.publish(createEvent<TenantSubscriptionUpdatedEvent>({
      eventType: 'TenantSubscriptionUpdated',
      aggregateId: view.id,
      aggregateType: 'tenant_subscription',
      payload: {
        subscriptionId: view.id,
        tenantId: view.tenantId,
        plan: view.plan,
        status: view.status,
      },
      metadata: {
        tenantId: view.tenantId,
        source: 'TenantLifecycleService',
      },
    }));

    return view;
  }

  /**
   * Cancela a assinatura (D-A, cancel_at_period_end).
   *
   * PEDIDO de cancelamento: marca encerramento no fim do período contratado
   * (cancel_at_period_end = current_period_end). Acesso MANTIDO até lá.
   * Publica TenantSubscriptionUpdated com cancelAtPeriodEnd no payload.
   *
   * A EFETIVAÇÃO (status -> cancelled + evento TenantSubscriptionCancelled)
   * acontece no BillingService.runCycle(asOf) quando cancel_at_period_end é
   * alcançado — fora deste serviço (6.0.4.4).
   */
  async cancel(tenantId: string, reason?: string): Promise<TenantSubscriptionView> {
    void reason;
    validateTenantId(tenantId);

    const { data, error } = await this.getClient()
      .rpc('cancel_subscription', { p_tenant_id: tenantId })
      .single();

    if (error) {
      throw new Error(`Erro ao cancelar assinatura: ${error.message}`);
    }
    if (!data) {
      throw new Error('RPC cancel_subscription retornou resultado inválido');
    }

    const view = toSubscriptionView(data as SubscriptionRow);

    await appEventBus.publish(createEvent<TenantSubscriptionUpdatedEvent>({
      eventType: 'TenantSubscriptionUpdated',
      aggregateId: view.id,
      aggregateType: 'tenant_subscription',
      payload: {
        subscriptionId: view.id,
        tenantId: view.tenantId,
        plan: view.plan,
        status: view.status,
        cancelAtPeriodEnd: view.cancelAtPeriodEnd,
      },
      metadata: {
        tenantId: view.tenantId,
        source: 'TenantLifecycleService',
      },
    }));

    return view;
  }

  /** Leitura da assinatura do tenant do chamador (get_subscription). */
  async getStatus(): Promise<TenantSubscriptionView | null> {
    const { data, error } = await this.getClient()
      .rpc('get_subscription')
      .single();

    if (error) {
      throw new Error(`Erro ao consultar assinatura: ${error.message}`);
    }

    return data ? toSubscriptionView(data as SubscriptionRow) : null;
  }
}

export const tenantLifecycleService = new TenantLifecycleServiceImpl();
