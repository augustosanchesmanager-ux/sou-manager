import { type SupabaseClient } from '@supabase/supabase-js';
import { getSharedClient, supabase } from '../../../services/supabaseClient';

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

const runCustomerQueryWithFallback = async <T>(
  run: (client: SupabaseClient) => Promise<{ data: T | null; error: any }>,
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
