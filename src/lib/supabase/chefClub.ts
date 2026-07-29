import { type SupabaseClient } from '@supabase/supabase-js';
import { getSharedClient, supabase } from '../../../services/supabaseClient';
import {
  getTotalAvailableCredits,
  getTotalUsedCredits,
  normalizeCreditBalances,
  type ServiceBalanceEntry,
} from '../../utils/chefClubCredits';

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
    console.warn('Fallback para schema public em consulta do Club dos Chefes.', primaryResult.error);
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
      .from('customer_credits')
      .select('available_credits')
      .eq('subscription_id', subscription.id)
      .maybeSingle(),
  ]);

  if (planResult.error) {
    throw planResult.error;
  }

  if (creditsResult.error) {
    throw creditsResult.error;
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
      .from('customer_credits')
      .select('id, available_credits, used_credits, service_balance_map')
      .eq('subscription_id', subscription.id)
      .maybeSingle(),
  ]);

  if (planResult.error) {
    throw planResult.error;
  }

  if (creditsResult.error) {
    throw creditsResult.error;
  }

  const credits = creditsResult.data;
  const serviceBalances = normalizeCreditBalances(
    credits?.service_balance_map,
    credits?.available_credits || 0,
    credits?.used_credits || 0,
  );

  const totalCredits = serviceBalances.length > 0
    ? getTotalAvailableCredits(serviceBalances)
    : credits?.available_credits || 0;
  const usedCredits = serviceBalances.length > 0
    ? getTotalUsedCredits(serviceBalances)
    : credits?.used_credits || 0;

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

    const totalCredits = serviceBalances.length > 0
      ? getTotalAvailableCredits(serviceBalances)
      : credits?.available_credits || 0;
    const usedCredits = serviceBalances.length > 0
      ? getTotalUsedCredits(serviceBalances)
      : credits?.used_credits || 0;

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
