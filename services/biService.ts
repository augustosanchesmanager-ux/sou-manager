/**
 * [SMG][SERVICES][BI] biService
 *
 * Consultas agregadas para:
 * - hooks/useStrategicDashboard.ts
 * - pages/BusinessIntelligence.tsx
 * - pages/SupabaseMonitoring.tsx
 */

import { getClientForTable, getScopedClient, supabase } from './supabaseClient';

export interface StrategicDashboardQueryParams {
  currentStart: string;
  currentEnd: string;
  previousStart: string;
  previousEnd: string;
}

export interface StrategicDashboardRawData {
  currentTransactions: Array<{ id: string; amount: number; date: string }>;
  previousTransactions: Array<{ id: string; amount: number; date: string }>;
  currentAppointments: Array<{
    id: string;
    status: string;
    start_time: string;
    staff_id?: string | null;
    staff_name?: string | null;
  }>;
  clients: Array<{ id: string; created_at: string; last_visit?: string | null }>;
  staff: Array<{ id: string; name: string; avatar?: string | null }>;
  products: Array<{
    id: string;
    name: string;
    stock_quantity?: number | null;
    minimum_stock?: number | null;
  }>;
  clubSubscriptions: Array<{
    id: string;
    status: string;
    next_billing_date?: string | null;
    plan_id?: string | null;
  }>;
  clubPlans: Array<{ id: string; name: string; monthly_price?: number | null }>;
}

export const biService = {
  async fetchStrategicDashboardRaw(
    tenantId: string,
    params: StrategicDashboardQueryParams,
  ): Promise<StrategicDashboardRawData> {
    const barberSupabase = getScopedClient('barber');
    const { currentStart, currentEnd, previousStart, previousEnd } = params;

    const [
      currentTransactions,
      previousTransactions,
      currentAppointments,
      clientsRes,
      staffRes,
      productsRes,
      clubSubsRes,
      clubPlansRes,
    ] = await Promise.all([
      supabase
        .from('transactions')
        .select('id, amount, date')
        .eq('tenant_id', tenantId)
        .eq('type', 'income')
        .gte('date', currentStart.split('T')[0])
        .lte('date', currentEnd.split('T')[0]),
      supabase
        .from('transactions')
        .select('id, amount, date')
        .eq('tenant_id', tenantId)
        .eq('type', 'income')
        .gte('date', previousStart.split('T')[0])
        .lt('date', previousEnd.split('T')[0]),
      supabase
        .from('appointments')
        .select('id, status, start_time, staff_id, staff_name')
        .eq('tenant_id', tenantId)
        .gte('start_time', currentStart)
        .lte('start_time', currentEnd),
      supabase
        .from('clients')
        .select('id, created_at, last_visit')
        .eq('tenant_id', tenantId),
      supabase
        .from('staff')
        .select('id, name, avatar')
        .eq('tenant_id', tenantId)
        .eq('status', 'active'),
      supabase
        .from('products')
        .select('id, name, stock_quantity, minimum_stock')
        .eq('tenant_id', tenantId),
      barberSupabase
        .from('customer_subscriptions')
        .select('id, status, next_billing_date, plan_id')
        .eq('tenant_id', tenantId)
        .eq('status', 'active'),
      barberSupabase
        .from('customer_plans')
        .select('id, name, monthly_price')
        .eq('tenant_id', tenantId),
    ]);

    return {
      currentTransactions: (currentTransactions.data || []) as StrategicDashboardRawData['currentTransactions'],
      previousTransactions: (previousTransactions.data || []) as StrategicDashboardRawData['previousTransactions'],
      currentAppointments: (currentAppointments.data || []) as StrategicDashboardRawData['currentAppointments'],
      clients: (clientsRes.data || []) as StrategicDashboardRawData['clients'],
      staff: (staffRes.data || []) as StrategicDashboardRawData['staff'],
      products: (productsRes.data || []) as StrategicDashboardRawData['products'],
      clubSubscriptions: (clubSubsRes.data || []) as StrategicDashboardRawData['clubSubscriptions'],
      clubPlans: (clubPlansRes.data || []) as StrategicDashboardRawData['clubPlans'],
    };
  },

  async fetchBiAppointments(tenantId: string, fromIso: string, futureHorizonIso: string) {
    const appointmentsClient = getClientForTable('appointments', 'barber');
    const { data } = await appointmentsClient
      .from('appointments')
      .select('id, start_time, staff_id, staff_name, price, status, service_name')
      .eq('tenant_id', tenantId)
      .gte('start_time', fromIso)
      .lte('start_time', futureHorizonIso);

    return (data || []) as any[];
  },

  async fetchBiTransactions(tenantId: string, fromDate: string) {
    const transactionsClient = getClientForTable('transactions', 'barber');
    const { data } = await transactionsClient
      .from('transactions')
      .select('type, amount, category')
      .eq('tenant_id', tenantId)
      .gte('date', fromDate);

    return (data || []) as any[];
  },

  async fetchBankStatementStatuses(tenantId: string) {
    const { data } = await supabase
      .from('bank_statement_transactions')
      .select('status')
      .eq('tenant_id', tenantId);

    return (data || []) as Array<{ status?: string }>;
  },

  async fetchBiExpenses(tenantId: string) {
    const transactionsClient = getClientForTable('transactions', 'barber');
    const { data } = await transactionsClient
      .from('transactions')
      .select('category, amount')
      .eq('tenant_id', tenantId)
      .eq('type', 'expense');

    return (data || []) as Array<{ category?: string; amount?: number }>;
  },

  async fetchMonitoringSnapshotData() {
    const [usageLogsRes, alertsRes, channelsRes] = await Promise.all([
      supabase
        .from('usage_logs')
        .select('resource_type, value, limit_value, unit, created_at')
        .order('created_at', { ascending: true }),
      supabase
        .from('alerts')
        .select('id, resource_type, message, level, usage_pct, created_at, resolved_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('notification_channels')
        .select('id, channel_type, target, is_enabled, last_triggered_at')
        .order('created_at', { ascending: true }),
    ]);

    return { usageLogsRes, alertsRes, channelsRes };
  },
};
