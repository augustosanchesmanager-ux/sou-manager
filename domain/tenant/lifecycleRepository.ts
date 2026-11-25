/**
 * [SMG][DOMAIN][TENANT] TenantLifecycleRepository (ADR-056)
 *
 * RESPONSABILIDADE: Encapsula todas as RPCs transacionais de provisionamento,
 * onboarding e ciclo de vida da assinatura do tenant, removendo acoplamento
 * direto ao cliente Supabase na camada `application/`.
 *
 * GARANTIAS:
 *   - Zero regra de negócio / publicação de eventos (responsabilidade de `application/`)
 *   - Resolução lazy do cliente Supabase para compatibilidade total com DI e mocks de teste
 *   - Zero conhecimento de React, UI, navigate ou toast
 */

import { createSupabaseClient } from '../shared/supabase-client-factory';

export type TenantPlanSlug = 'free' | 'pro' | 'premium';
export type TenantSubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'cancelled';

export interface ProvisionTenantRpcParams {
  userId: string;
  tenantName: string;
  firstName: string;
  lastName: string;
  appSlug: string;
}

export interface ProvisionTenantRpcRow {
  tenant_id: string;
  slug: string;
  already_exists: boolean;
}

export interface CompleteOnboardingRpcParams {
  tenantId: string;
  chairCount?: number | null;
  businessHours?: Record<string, { open: string; close: string } | null> | null;
  phone?: string | null;
  cnpj?: string | null;
  addressStreet?: string | null;
  addressNumber?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  addressZip?: string | null;
}

export interface TenantSubscriptionRpcRow {
  id: string;
  tenant_id: string;
  plan: TenantPlanSlug;
  status: TenantSubscriptionStatus;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: string | null;
  canceled_at: string | null;
  created_at: string | null;
}

export interface TenantLifecycleRepository {
  provisionNewTenant(params: ProvisionTenantRpcParams): Promise<ProvisionTenantRpcRow>;
  saveOnboardingStep(tenantId: string, step: 'company' | 'operational', data: Record<string, unknown>): Promise<void>;
  completeOnboarding(params: CompleteOnboardingRpcParams): Promise<void>;
  startTrial(tenantId: string, plan?: TenantPlanSlug): Promise<TenantSubscriptionRpcRow>;
  activateSubscription(tenantId: string): Promise<TenantSubscriptionRpcRow>;
  cancelSubscription(tenantId: string): Promise<TenantSubscriptionRpcRow>;
  getSubscription(): Promise<TenantSubscriptionRpcRow | null>;
  changeTenantPlan(tenantId: string, plan: TenantPlanSlug, reason?: string): Promise<TenantSubscriptionRpcRow>;
}

export type TenantRpcClientFactory = (table?: string) => ReturnType<typeof createSupabaseClient>;

export class TenantLifecycleRepositoryImpl implements TenantLifecycleRepository {
  constructor(
    private readonly getClient: TenantRpcClientFactory = (table = 'tenants') =>
      createSupabaseClient(table, 'barber')
  ) {}

  async provisionNewTenant(params: ProvisionTenantRpcParams): Promise<ProvisionTenantRpcRow> {
    const { data, error } = await this.getClient('tenants')
      .rpc('provision_new_tenant', {
        p_user_id: params.userId,
        p_tenant_name: params.tenantName,
        p_first_name: params.firstName,
        p_last_name: params.lastName,
        p_app_slug: params.appSlug,
      })
      .single();

    if (error) {
      throw new Error(`Erro ao criar tenant: ${error.message}`);
    }

    const row = data as ProvisionTenantRpcRow | null;
    if (!row?.tenant_id) {
      throw new Error('RPC provision_new_tenant retornou resultado inválido');
    }

    return row;
  }

  async saveOnboardingStep(
    tenantId: string,
    step: 'company' | 'operational',
    data: Record<string, unknown>
  ): Promise<void> {
    const { error } = await this.getClient('tenants').rpc('save_onboarding_step', {
      p_tenant_id: tenantId,
      p_step: step,
      p_data: data,
    });

    if (error) {
      const label = step === 'company' ? 'dados da empresa' : 'configurações operacionais';
      throw new Error(`Erro ao salvar ${label}: ${error.message}`);
    }
  }

  async completeOnboarding(params: CompleteOnboardingRpcParams): Promise<void> {
    const { error } = await this.getClient('tenants').rpc('complete_onboarding', {
      p_tenant_id: params.tenantId,
      p_chair_count: params.chairCount ?? null,
      p_business_hours: params.businessHours ?? null,
      p_phone: params.phone ?? null,
      p_cnpj: params.cnpj ?? null,
      p_address_street: params.addressStreet ?? null,
      p_address_number: params.addressNumber ?? null,
      p_address_city: params.addressCity ?? null,
      p_address_state: params.addressState ?? null,
      p_address_zip: params.addressZip ?? null,
    });

    if (error) {
      throw new Error(`Erro ao finalizar onboarding: ${error.message}`);
    }
  }

  async startTrial(tenantId: string, plan?: TenantPlanSlug): Promise<TenantSubscriptionRpcRow> {
    const { data, error } = await this.getClient('subscriptions')
      .rpc('start_trial', { p_tenant_id: tenantId, p_plan: plan ?? null })
      .single();

    if (error) {
      throw new Error(`Erro ao iniciar trial: ${error.message}`);
    }
    if (!data) {
      throw new Error('RPC start_trial retornou resultado inválido');
    }

    return data as TenantSubscriptionRpcRow;
  }

  async activateSubscription(tenantId: string): Promise<TenantSubscriptionRpcRow> {
    const { data, error } = await this.getClient('subscriptions')
      .rpc('activate_subscription', { p_tenant_id: tenantId })
      .single();

    if (error) {
      throw new Error(`Erro ao ativar assinatura: ${error.message}`);
    }
    if (!data) {
      throw new Error('RPC activate_subscription retornou resultado inválido');
    }

    return data as TenantSubscriptionRpcRow;
  }

  async cancelSubscription(tenantId: string): Promise<TenantSubscriptionRpcRow> {
    const { data, error } = await this.getClient('subscriptions')
      .rpc('cancel_subscription', { p_tenant_id: tenantId })
      .single();

    if (error) {
      throw new Error(`Erro ao cancelar assinatura: ${error.message}`);
    }
    if (!data) {
      throw new Error('RPC cancel_subscription retornou resultado inválido');
    }

    return data as TenantSubscriptionRpcRow;
  }

  async getSubscription(): Promise<TenantSubscriptionRpcRow | null> {
    const { data, error } = await this.getClient('subscriptions').rpc('get_subscription').single();

    if (error) {
      throw new Error(`Erro ao consultar assinatura: ${error.message}`);
    }

    return data ? (data as TenantSubscriptionRpcRow) : null;
  }

  async changeTenantPlan(
    tenantId: string,
    plan: TenantPlanSlug,
    reason?: string
  ): Promise<TenantSubscriptionRpcRow> {
    const { data, error } = await this.getClient('subscriptions')
      .rpc('change_tenant_plan', {
        p_tenant_id: tenantId,
        p_plan: plan,
        p_reason: reason ?? null,
      })
      .single();

    if (error) {
      throw new Error(`Erro ao alterar plano: ${error.message}`);
    }
    if (!data) {
      throw new Error('RPC change_tenant_plan retornou resultado inválido');
    }

    return data as TenantSubscriptionRpcRow;
  }
}

export const tenantLifecycleRepository: TenantLifecycleRepository = new TenantLifecycleRepositoryImpl();
