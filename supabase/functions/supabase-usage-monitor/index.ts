import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

type UsageMetricPayload = {
  resource_type: string;
  value: number;
  limit_value: number;
  unit: string;
  metadata?: Record<string, unknown>;
};

const mockMetrics: UsageMetricPayload[] = [
  { resource_type: 'database_size', value: 382, limit_value: 500, unit: 'MB' },
  { resource_type: 'requests', value: 38500, limit_value: 50000, unit: 'req' },
  { resource_type: 'cpu', value: 63, limit_value: 100, unit: '%' },
  { resource_type: 'bandwidth', value: 1.38, limit_value: 2, unit: 'GB' },
  { resource_type: 'auth_users', value: 4320, limit_value: 50000, unit: 'users' },
  { resource_type: 'storage', value: 0.82, limit_value: 1, unit: 'GB' },
];

const buildAlertMessage = (resourceType: string, usagePct: number) => {
  if (usagePct >= 90) {
    return `${resourceType} ultrapassou 90% do limite e exige acao imediata.`;
  }

  return `${resourceType} atingiu ${usagePct.toFixed(0)}% do limite e entrou em monitoramento preventivo.`;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing Supabase service credentials.');
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    let metrics: UsageMetricPayload[] = [];

    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      metrics = Array.isArray(body?.metrics) && body.metrics.length ? body.metrics : mockMetrics;
    } else {
      metrics = mockMetrics;
    }

    const now = new Date().toISOString();

    const usageRows = metrics.map((metric) => ({
      resource_type: metric.resource_type,
      value: metric.value,
      limit_value: metric.limit_value,
      unit: metric.unit,
      metadata: metric.metadata ?? {},
      created_at: now,
      source: 'edge-function',
    }));

    const { error: insertUsageError } = await supabase.from('usage_logs').insert(usageRows);
    if (insertUsageError) throw insertUsageError;

    const alertRows = metrics
      .map((metric) => {
        const usagePct = metric.limit_value === 0 ? 0 : (metric.value / metric.limit_value) * 100;
        if (usagePct < 70) return null;

        return {
          resource_type: metric.resource_type,
          message: buildAlertMessage(metric.resource_type, usagePct),
          level: usagePct >= 90 ? 'critical' : 'warning',
          current_value: metric.value,
          limit_value: metric.limit_value,
          usage_pct: Number(usagePct.toFixed(2)),
          created_at: now,
        };
      })
      .filter(Boolean);

    if (alertRows.length) {
      const { error: insertAlertError } = await supabase.from('alerts').insert(alertRows);
      if (insertAlertError) throw insertAlertError;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        collected_at: now,
        metrics_collected: usageRows.length,
        alerts_created: alertRows.length,
        note: 'Use POST com { "metrics": [...] } para registrar dados reais do provedor.',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    );
  }
});
