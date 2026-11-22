/**
 * [SMG][SERVICES][CHEF_CLUB] chefClubWidgetService
 *
 * Consultas para os widgets de ChefClub:
 * - components/club/ChefClubSummaryWidget.tsx
 * - components/dashboard/ClubReceivablesWidget.tsx
 *
 * Respeita a fronteira de arquitetura: components/ não importam domain/<domínio>/repository
 * nem src/lib/supabase diretamente.
 */

import { getScopedClient, getSharedClient } from './supabaseClient';

export interface ChefClubSummaryRawData {
  subscriptions: Array<{ id: string; status: string; plan_id?: string | null }>;
  credits: Array<{ available_credits?: number | null; used_credits?: number | null }>;
  plans: Array<{ id: string; name: string }>;
  paidReceivables: Array<{ amount?: number | null; paid_at?: string | null }>;
}

export interface ClubReceivablesRawData {
  subscriptions: Array<{ id: string; client_id?: string | null; plan_id?: string | null; status: string }>;
  plans: Array<{ id: string; name: string; monthly_price?: number | null }>;
  receivables: Array<{
    id: string;
    customer_id?: string | null;
    subscription_id?: string | null;
    plan_id?: string | null;
    amount?: number | null;
    due_date?: string | null;
    status: string;
  }>;
  clients: Array<{ id: string; name?: string | null; phone?: string | null }>;
}

export const chefClubWidgetService = {
  async fetchSummaryData(tenantId: string): Promise<ChefClubSummaryRawData> {
    const barberSupabase = getScopedClient('barber');

    const [subsRes, creditsRes, plansRes, receivablesRes] = await Promise.all([
      barberSupabase
        .from('customer_subscriptions')
        .select('id, status, plan_id')
        .eq('tenant_id', tenantId)
        .eq('status', 'active'),
      barberSupabase
        .from('customer_credits')
        .select('available_credits, used_credits')
        .eq('tenant_id', tenantId),
      barberSupabase
        .from('customer_plans')
        .select('id, name')
        .eq('tenant_id', tenantId),
      barberSupabase
        .from('customer_subscription_receivables')
        .select('amount, paid_at')
        .eq('tenant_id', tenantId)
        .eq('status', 'paid'),
    ]);

    return {
      subscriptions: (subsRes.data || []) as ChefClubSummaryRawData['subscriptions'],
      credits: (creditsRes.data || []) as ChefClubSummaryRawData['credits'],
      plans: (plansRes.data || []) as ChefClubSummaryRawData['plans'],
      paidReceivables: (receivablesRes.data || []) as ChefClubSummaryRawData['paidReceivables'],
    };
  },

  async fetchReceivablesData(tenantId: string): Promise<ClubReceivablesRawData> {
    const barberSupabase = getScopedClient('barber');
    const sharedSupabase = getSharedClient();

    const [subsRes, plansRes, receivablesRes, clientsRes] = await Promise.all([
      barberSupabase
        .from('customer_subscriptions')
        .select('id, client_id, plan_id, status')
        .eq('tenant_id', tenantId),
      barberSupabase
        .from('customer_plans')
        .select('id, name, monthly_price')
        .eq('tenant_id', tenantId),
      barberSupabase
        .from('customer_subscription_receivables')
        .select('id, customer_id, subscription_id, plan_id, amount, due_date, status')
        .eq('tenant_id', tenantId)
        .in('status', ['pending', 'overdue'])
        .order('due_date', { ascending: true }),
      sharedSupabase
        .from('clients')
        .select('id, name, phone')
        .eq('tenant_id', tenantId),
    ]);

    return {
      subscriptions: (subsRes.data || []) as ClubReceivablesRawData['subscriptions'],
      plans: (plansRes.data || []) as ClubReceivablesRawData['plans'],
      receivables: (receivablesRes.data || []) as ClubReceivablesRawData['receivables'],
      clients: (clientsRes.data || []) as ClubReceivablesRawData['clients'],
    };
  },
};
