import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal } from './supabaseAdmin';

/**
 * Helper to query Supabase directly from E2E tests for DB assertions.
 * Uses service_role key to bypass RLS.
 */

const env = loadEnvLocal();
const STAGING_URL = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

let client: ReturnType<typeof createClient> | null = null;

function getClient() {
  if (!client) {
    client = createClient(STAGING_URL, SERVICE_ROLE_KEY);
  }
  return client;
}

export async function getSubscriptionStatus(subscriptionId: string, tenantId: string) {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('customer_subscriptions')
    .select('status, canceled_at')
    .eq('id', subscriptionId)
    .eq('tenant_id', tenantId)
    .single();

  if (error) throw new Error(`Failed to get subscription: ${error.message}`);
  return data;
}

export async function getReceivableStatus(receivableId: string, tenantId: string) {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('customer_subscription_receivables')
    .select('status, previous_status, cancel_reason, cancel_observation, cancelled_by, cancelled_at, amount')
    .eq('id', receivableId)
    .eq('tenant_id', tenantId)
    .single();

  if (error) throw new Error(`Failed to get receivable: ${error.message}`);
  return data;
}

export async function getReceivablesBySubscription(subscriptionId: string, tenantId: string) {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('customer_subscription_receivables')
    .select('id, status, previous_status, amount')
    .eq('subscription_id', subscriptionId)
    .eq('tenant_id', tenantId);

  if (error) throw new Error(`Failed to get receivables: ${error.message}`);
  return data || [];
}

export async function getCancelAudit(receivableId: string, tenantId: string) {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('receivable_cancel_audit')
    .select('*')
    .eq('receivable_id', receivableId)
    .eq('tenant_id', tenantId);

  if (error) throw new Error(`Failed to get audit: ${error.message}`);
  return data || [];
}

export async function getCredits(clientId: string, tenantId: string) {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('customer_credits')
    .select('available_credits, used_credits')
    .eq('client_id', clientId)
    .eq('tenant_id', tenantId)
    .single();

  if (error) throw new Error(`Failed to get credits: ${error.message}`);
  return data;
}
