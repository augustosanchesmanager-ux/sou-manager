import { type SupabaseClient } from '@supabase/supabase-js';
import { getSharedClient, supabase } from '../../../services/supabaseClient';
import { normalizeCreditBalances, type ServiceBalanceEntry } from '../../utils/chefClubCredits';

interface QueryResult<T> {
  data: T | null;
  error: any;
  client: SupabaseClient;
}

export interface ChefClubClientSummary {
  status: string;
  planName: string;
  credits: number;
}

export interface ChefClubClientCredits {
  subscriptionId: string;
  clientId: string;
  status: string;
  planName: string;
  totalCredits: number;
  availableCredits: number;
  usedCredits: number;
  serviceBalances: ServiceBalanceEntry[];
}

const runCustomerQueryWithFallback = async <T>(
  run: (client: SupabaseClient) => PromiseLike<{ data: T | null; error: any }>,
): Promise<QueryResult<T>> => {
  const primaryClient = supabase as SupabaseClient;
  const primaryResult = await run(primaryClient);

  if (!primaryResult.error) {
    return {
      ...primaryResult,
      client: primaryClient,
    };
  }

  const sharedClient = getSharedClient();
  const sharedResult = await run(sharedClient);

  if (!sharedResult.error) {
    console.warn('Fallback para schema public em consulta do Chef Club.', primaryResult.error);
  }

  return {
    ...sharedResult,
    client: sharedClient,
  };
};

export const fetchChefClubSummaryByClient = async (
  clientId: string,
  tenantId?: string | null,
): Promise<ChefClubClientSummary | null> => {
  const subscriptionResult = await runCustomerQueryWithFallback<{
    id: string;
    status: string;
    plan_id: string;
  }>((client) => {
    let query = client
      .from('customer_subscriptions')
      .select('id, status, plan_id')
      .eq('client_id', clientId)
      .eq('status', 'active');

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    return query.maybeSingle();
  });

  if (subscriptionResult.error) {
    throw subscriptionResult.error;
  }

  const subscription = subscriptionResult.data;
  if (!subscription) {
    return null;
  }

  const [planResult, creditsResult] = await Promise.all([
    subscriptionResult.client
      .from('customer_plans')
      .select('name')
      .eq('id', subscription.plan_id)
      .maybeSingle(),
    subscriptionResult.client
      .rpc('get_current_subscription_credits', {
        p_subscription_id: subscription.id,
        p_tenant_id: tenantId,
      })
      .maybeSingle(),
  ]);

  if (planResult.error) {
    console.warn('[fetchChefClubSummaryByClient] plan fetch error:', planResult.error);
  }

  if (creditsResult.error) {
    console.warn('[fetchChefClubSummaryByClient] credits fetch error:', creditsResult.error);
  }

  return {
    status: subscription.status,
    planName: planResult.data?.name || 'Plano ativo',
    credits: creditsResult.data?.available_credits || 0,
  };
};

export const fetchActiveChefClubPlanMap = async (
  tenantId: string,
): Promise<Record<string, string>> => {
  const subscriptionResult = await runCustomerQueryWithFallback<Array<{
    client_id: string;
    plan_id: string;
  }>>((client) =>
    client
      .from('customer_subscriptions')
      .select('client_id, plan_id')
      .eq('tenant_id', tenantId)
      .eq('status', 'active'),
  );

  if (subscriptionResult.error) {
    throw subscriptionResult.error;
  }

  const subscriptions = subscriptionResult.data || [];
  if (subscriptions.length === 0) {
    return {};
  }

  const planIds = Array.from(new Set(subscriptions.map((subscription) => subscription.plan_id).filter(Boolean)));

  const plansResult = await subscriptionResult.client
    .from('customer_plans')
    .select('id, name')
    .in('id', planIds);

  if (plansResult.error) {
    throw plansResult.error;
  }

  const planMap = new Map((plansResult.data || []).map((plan) => [plan.id, plan.name]));

  return subscriptions.reduce<Record<string, string>>((acc, subscription) => {
    const planName = planMap.get(subscription.plan_id);
    if (planName) {
      acc[subscription.client_id] = planName;
    }
    return acc;
  }, {});
};

export const fetchChefClubCreditsByClient = async (
  clientId: string,
  tenantId?: string | null,
): Promise<ChefClubClientCredits | null> => {
  const subscriptionResult = await runCustomerQueryWithFallback<{
    id: string;
    client_id: string;
    status: string;
    plan_id: string;
  }>((client) => {
    let query = client
      .from('customer_subscriptions')
      .select('id, client_id, status, plan_id')
      .eq('client_id', clientId)
      .eq('status', 'active');

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    return query.maybeSingle();
  });

  if (subscriptionResult.error) {
    throw subscriptionResult.error;
  }

  const subscription = subscriptionResult.data;
  if (!subscription) {
    return null;
  }

  const [planResult, creditsResult] = await Promise.all([
    subscriptionResult.client
      .from('customer_plans')
      .select('id, name')
      .eq('id', subscription.plan_id)
      .maybeSingle(),
    subscriptionResult.client
      .rpc('get_current_subscription_credits', {
        p_subscription_id: subscription.id,
        p_tenant_id: tenantId,
      })
      .maybeSingle(),
  ]);

  if (planResult.error) {
    console.warn('[fetchChefClubCreditsByClient] plan fetch error:', planResult.error);
  }

  if (creditsResult.error) {
    console.warn('[fetchChefClubCreditsByClient] credits fetch error:', creditsResult.error);
  }

  const credits = creditsResult.data;
  const serviceBalances = normalizeCreditBalances(
    credits?.service_balance_map,
    credits?.available_credits || 0,
    credits?.used_credits || 0,
  );

  const totalCredits = credits?.available_credits || 0;
  const usedCredits = credits?.used_credits || 0;

  return {
    subscriptionId: subscription.id,
    clientId: subscription.client_id,
    status: subscription.status,
    planName: planResult.data?.name || 'Plano ativo',
    totalCredits,
    availableCredits: totalCredits,
    usedCredits,
    serviceBalances,
  };
};

export const fetchChefClubCreditsByClients = async (
  clientIds: string[],
  tenantId?: string | null,
): Promise<Map<string, ChefClubClientCredits>> => {
  const resultMap = new Map<string, ChefClubClientCredits>();

  if (clientIds.length === 0) {
    return resultMap;
  }

  const subscriptionResult = await runCustomerQueryWithFallback<Array<{
    id: string;
    client_id: string;
    status: string;
    plan_id: string;
  }>>((client) => {
    let query = client
      .from('customer_subscriptions')
      .select('id, client_id, status, plan_id')
      .eq('status', 'active')
      .in('client_id', clientIds);

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    return query;
  });

  if (subscriptionResult.error) {
    throw subscriptionResult.error;
  }

  const subscriptions = subscriptionResult.data || [];
  if (subscriptions.length === 0) {
    return resultMap;
  }

  const subscriptionIds = subscriptions.map((s) => s.id);
  const planIds = [...new Set(subscriptions.map((s) => s.plan_id).filter(Boolean))];

  const [plansResult, creditsResult] = await Promise.all([
    subscriptionResult.client
      .from('customer_plans')
      .select('id, name')
      .in('id', planIds),
    subscriptionResult.client
      .from('customer_credits')
      .select('id, subscription_id, available_credits, used_credits, service_balance_map')
      .in('subscription_id', subscriptionIds),
  ]);

  if (plansResult.error) {
    throw plansResult.error;
  }

  if (creditsResult.error) {
    throw creditsResult.error;
  }

  const planMap = new Map((plansResult.data || []).map((p) => [p.id, p.name]));
  const creditsMap = new Map((creditsResult.data || []).map((c) => [c.subscription_id, c]));

  for (const subscription of subscriptions) {
    const planName = planMap.get(subscription.plan_id) || 'Plano ativo';
    const credits = creditsMap.get(subscription.id);

    const serviceBalances = normalizeCreditBalances(
      credits?.service_balance_map,
      credits?.available_credits || 0,
      credits?.used_credits || 0,
    );

    const totalCredits = credits?.available_credits || 0;
    const usedCredits = credits?.used_credits || 0;

    resultMap.set(subscription.client_id, {
      subscriptionId: subscription.id,
      clientId: subscription.client_id,
      status: subscription.status,
      planName,
      totalCredits,
      availableCredits: totalCredits,
      usedCredits,
      serviceBalances,
    });
  }

  return resultMap;
};

// ============================================================
// Phase 3A: RPC-based functions for Club Club integration
// These call backend RPCs directly - frontend only displays
// ============================================================

import { type ChefClubPlanStatus, type ChefClubCreditPreview, type ChefClubCreditUsage } from '../../types/membership';

export const fetchChefClubPlanStatus = async (
  tenantId: string,
  clientId: string
): Promise<ChefClubPlanStatus | null> => {
  try {
    const { data, error } = await supabase.rpc('get_customer_plan_status', {
      p_tenant_id: tenantId,
      p_client_id: clientId,
    });

    if (error) {
      console.warn('[fetchChefClubPlanStatus] RPC error:', error);
      return null;
    }

    if (!data || !data.has_active_subscription) {
      return null;
    }

    return data as ChefClubPlanStatus;
  } catch (err) {
    console.warn('[fetchChefClubPlanStatus] Exception:', err);
    return null;
  }
};

export const fetchChefClubCreditPreview = async (
  tenantId: string,
  clientId: string,
  serviceId: string,
  checkoutDate?: string
): Promise<ChefClubCreditPreview | null> => {
  try {
    const { data, error } = await supabase.rpc('preview_plan_credit_for_service', {
      p_tenant_id: tenantId,
      p_client_id: clientId,
      p_service_id: serviceId,
      p_checkout_date: checkoutDate || new Date().toISOString(),
    });

    if (error) {
      console.warn('[fetchChefClubCreditPreview] RPC error:', error);
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    return data[0] as ChefClubCreditPreview;
  } catch (err) {
    console.warn('[fetchChefClubCreditPreview] Exception:', err);
    return null;
  }
};

export const fetchChefClubCreditUsageHistory = async (
  tenantId: string,
  clientId?: string,
  subscriptionId?: string,
  limit: number = 50
): Promise<ChefClubCreditUsage[]> => {
  try {
    const { data, error } = await supabase.rpc('get_credit_usage_history', {
      p_tenant_id: tenantId,
      p_client_id: clientId || null,
      p_subscription_id: subscriptionId || null,
      p_limit: limit,
    });

    if (error) {
      console.warn('[fetchChefClubCreditUsageHistory] RPC error:', error);
      return [];
    }

    return (data || []) as ChefClubCreditUsage[];
  } catch (err) {
    console.warn('[fetchChefClubCreditUsageHistory] Exception:', err);
    return [];
  }
};

export const determineChefClubItemState = (
  item: { service_id?: string; paid_with_plan_credit?: boolean },
  creditPreview: ChefClubCreditPreview | null,
  hasSubscription: boolean
): {
  state: 'none' | 'eligible' | 'credits_exhausted' | 'service_not_in_plan' | 'subscription_expired' | 'paid_with_credit';
  reason: string | null;
  availableCredits: number;
} => {
  if (item.paid_with_plan_credit) {
    return { state: 'paid_with_credit', reason: 'Pago com crédito do Clube', availableCredits: 0 };
  }

  if (!hasSubscription) {
    return { state: 'none', reason: null, availableCredits: 0 };
  }

  if (!creditPreview) {
    return { state: 'none', reason: 'Preview indisponivel', availableCredits: 0 };
  }

  if (!creditPreview.eligible) {
    return { state: creditPreview.reason.includes('esgotados') ? 'credits_exhausted' : creditPreview.reason.includes('fora do plano') ? 'service_not_in_plan' : 'subscription_expired', reason: creditPreview.reason, availableCredits: 0 };
  }

  return {
    state: 'eligible',
    reason: null,
    availableCredits: creditPreview.available_credits,
  };
};
