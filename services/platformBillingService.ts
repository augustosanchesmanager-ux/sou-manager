import { supabase as defaultSupabase } from './supabaseClient';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  PlatformPlan,
  PlatformSubscription,
  PlatformInvoice,
  SaaSExecutiveMetrics,
  CreateOrUpdateSubscriptionInput,
  CreatePlatformInvoiceInput,
  SettleInvoiceResult,
  PlatformInvoiceStatus,
  PlatformPaymentMethod,
} from '../src/types/platformBilling';

export const platformBillingService = {
  /**
   * Lista os planos comerciais da plataforma SMG disponíveis.
   */
  async listPlans(
    activeOnly = true,
    client: SupabaseClient = defaultSupabase
  ): Promise<PlatformPlan[]> {
    let query = client.from('platform_plans').select('*');

    if (activeOnly) {
      query = query.eq('active', true);
    }

    query = query.order('price_cents', { ascending: true });

    const { data, error } = await query;
    if (error) {
      console.error('[PlatformBillingService] Erro ao listar planos da plataforma:', error);
      throw error;
    }

    return (data || []) as PlatformPlan[];
  },

  /**
   * Busca um plano comercial da plataforma pelo slug único.
   */
  async getPlanBySlug(
    slug: string,
    client: SupabaseClient = defaultSupabase
  ): Promise<PlatformPlan | null> {
    if (!slug || slug.trim() === '') {
      return null;
    }

    const { data, error } = await client
      .from('platform_plans')
      .select('*')
      .eq('slug', slug.trim())
      .maybeSingle();

    if (error) {
      console.error('[PlatformBillingService] Erro ao buscar plano por slug:', error);
      throw error;
    }

    return data as PlatformPlan | null;
  },

  /**
   * Obtém a assinatura vigente de um tenant (barbearia).
   */
  async getTenantSubscription(
    tenantId: string,
    client: SupabaseClient = defaultSupabase
  ): Promise<PlatformSubscription | null> {
    if (!tenantId || tenantId.trim() === '') {
      throw new Error('Tenant ID é obrigatório para consultar assinatura.');
    }

    const { data, error } = await client
      .from('platform_subscriptions')
      .select(`
        *,
        plan:platform_plans (*)
      `)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) {
      console.error('[PlatformBillingService] Erro ao buscar assinatura do tenant:', error);
      throw error;
    }

    if (!data) {
      return null;
    }

    const rawData = data as Record<string, unknown>;
    const plan = Array.isArray(rawData.plan) ? rawData.plan[0] : rawData.plan;

    return {
      ...rawData,
      plan: plan || null,
    } as unknown as PlatformSubscription;
  },

  /**
   * Cria ou atualiza a assinatura de uma barbearia contratante.
   */
  async createOrUpdateSubscription(
    input: CreateOrUpdateSubscriptionInput,
    client: SupabaseClient = defaultSupabase
  ): Promise<PlatformSubscription> {
    if (!input.tenantId || input.tenantId.trim() === '') {
      throw new Error('Tenant ID é obrigatório para registrar assinatura.');
    }
    if (!input.planId || input.planId.trim() === '') {
      throw new Error('Plan ID é obrigatório para registrar assinatura.');
    }

    const days = input.currentPeriodDays && input.currentPeriodDays > 0 ? input.currentPeriodDays : 30;
    const now = new Date();
    const periodEnd = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const payload: Record<string, unknown> = {
      tenant_id: input.tenantId,
      plan_id: input.planId,
      status: input.status || 'active',
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      cancel_at_period_end: false,
      updated_at: now.toISOString(),
    };

    if (input.trialDays && input.trialDays > 0) {
      const trialEnd = new Date(now.getTime() + input.trialDays * 24 * 60 * 60 * 1000);
      payload.trial_ends_at = trialEnd.toISOString();
      if (!input.status) {
        payload.status = 'trialing';
      }
    }

    const { data, error } = await client
      .from('platform_subscriptions')
      .upsert(payload, { onConflict: 'tenant_id' })
      .select(`
        *,
        plan:platform_plans (*)
      `)
      .single();

    if (error) {
      console.error('[PlatformBillingService] Erro ao criar/atualizar assinatura:', error);
      throw error;
    }

    const rawData = data as Record<string, unknown>;
    const plan = Array.isArray(rawData.plan) ? rawData.plan[0] : rawData.plan;

    return {
      ...rawData,
      plan: plan || null,
    } as unknown as PlatformSubscription;
  },

  /**
   * Cancela a assinatura de um tenant imediatamente ou ao final do período vigente.
   */
  async cancelSubscription(
    tenantId: string,
    immediately = false,
    client: SupabaseClient = defaultSupabase
  ): Promise<PlatformSubscription> {
    if (!tenantId || tenantId.trim() === '') {
      throw new Error('Tenant ID é obrigatório para cancelar assinatura.');
    }

    const now = new Date().toISOString();
    const updates: Record<string, unknown> = {
      updated_at: now,
    };

    if (immediately) {
      updates.status = 'canceled';
      updates.canceled_at = now;
      updates.cancel_at_period_end = false;
    } else {
      updates.cancel_at_period_end = true;
    }

    const { data, error } = await client
      .from('platform_subscriptions')
      .update(updates)
      .eq('tenant_id', tenantId)
      .select(`
        *,
        plan:platform_plans (*)
      `)
      .single();

    if (error) {
      console.error('[PlatformBillingService] Erro ao cancelar assinatura:', error);
      throw error;
    }

    const rawData = data as Record<string, unknown>;
    const plan = Array.isArray(rawData.plan) ? rawData.plan[0] : rawData.plan;

    return {
      ...rawData,
      plan: plan || null,
    } as unknown as PlatformSubscription;
  },

  /**
   * Lista as faturas da plataforma emitidas para uma barbearia.
   */
  async listTenantInvoices(
    tenantId: string,
    status?: PlatformInvoiceStatus,
    limit = 50,
    client: SupabaseClient = defaultSupabase
  ): Promise<PlatformInvoice[]> {
    if (!tenantId || tenantId.trim() === '') {
      throw new Error('Tenant ID é obrigatório para listar faturas.');
    }

    let query = client
      .from('platform_invoices')
      .select('*')
      .eq('tenant_id', tenantId);

    if (status) {
      query = query.eq('status', status);
    }

    query = query
      .order('due_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    const { data, error } = await query;
    if (error) {
      console.error('[PlatformBillingService] Erro ao listar faturas do tenant:', error);
      throw error;
    }

    return (data || []) as PlatformInvoice[];
  },

  /**
   * Cria uma nova fatura corporativa da plataforma para uma barbearia.
   */
  async createInvoice(
    input: CreatePlatformInvoiceInput,
    client: SupabaseClient = defaultSupabase
  ): Promise<PlatformInvoice> {
    if (!input.subscriptionId) {
      throw new Error('Subscription ID é obrigatório para criar fatura.');
    }
    if (!input.tenantId) {
      throw new Error('Tenant ID é obrigatório para criar fatura.');
    }
    if (typeof input.amountCents !== 'number' || input.amountCents < 0) {
      throw new Error('Valor da fatura deve ser maior ou igual a zero.');
    }
    if (!input.dueDate) {
      throw new Error('Data de vencimento é obrigatória.');
    }

    const invoiceNumber = input.invoiceNumber || `INV-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const { data, error } = await client
      .from('platform_invoices')
      .insert({
        subscription_id: input.subscriptionId,
        tenant_id: input.tenantId,
        invoice_number: invoiceNumber,
        amount_cents: input.amountCents,
        status: 'pending',
        due_date: input.dueDate,
        payment_method: input.paymentMethod || null,
        payment_link: input.paymentLink || null,
        pdf_url: input.pdfUrl || null,
      })
      .select('*')
      .single();

    if (error) {
      console.error('[PlatformBillingService] Erro ao criar fatura:', error);
      throw error;
    }

    return data as PlatformInvoice;
  },

  /**
   * Liquida uma fatura da plataforma através da RPC segura e idempotente `settle_platform_invoice`.
   */
  async settleInvoice(
    invoiceId: string,
    paymentMethod: PlatformPaymentMethod = 'pix',
    client: SupabaseClient = defaultSupabase
  ): Promise<SettleInvoiceResult> {
    if (!invoiceId || invoiceId.trim() === '') {
      throw new Error('Invoice ID é obrigatório para liquidar fatura.');
    }

    const { data, error } = await client.rpc('settle_platform_invoice', {
      p_invoice_id: invoiceId,
      p_payment_method: paymentMethod,
    });

    if (error) {
      console.error('[PlatformBillingService] Erro ao liquidar fatura via RPC:', error);
      throw error;
    }

    return data as SettleInvoiceResult;
  },

  /**
   * Consulta as métricas executivas de SaaS consolidadas (MRR, ARR, assinantes, churn) via RPC `get_saas_executive_metrics`.
   * Restrito ao papel Super-Admin.
   */
  async getSaaSExecutiveMetrics(
    client: SupabaseClient = defaultSupabase
  ): Promise<SaaSExecutiveMetrics> {
    const { data, error } = await client.rpc('get_saas_executive_metrics');

    if (error) {
      console.error('[PlatformBillingService] Erro ao obter métricas de SaaS via RPC:', error);
      throw error;
    }

    return data as SaaSExecutiveMetrics;
  },
};
