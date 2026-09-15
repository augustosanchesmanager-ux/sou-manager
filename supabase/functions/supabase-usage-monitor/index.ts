import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
// F2.2: cadeia auth→authz→payload (fonte canônica testada em tests/security/f2_2_usage_monitor_auth.test.ts)
import { isSuperAdminUser, validateMetricsPayload, type UsageMetric } from '../_shared/usage-monitor-auth.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const buildAlertMessage = (resourceType: string, usagePct: number) => {
    if (usagePct >= 90) {
        return `${resourceType} ultrapassou 90% do limite e exige acao imediata.`;
    }
    return `${resourceType} atingiu ${usagePct.toFixed(0)}% do limite e entrou em monitoramento preventivo.`;
};

const json = (payload: unknown, status: number) =>
    new Response(JSON.stringify(payload), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

/**
 * F2.2 (SEC-AUTHZ-USAGE-MONITOR) — Ingestão de métricas de uso do Supabase.
 *
 * Correção da auditoria ISSUE 4 (ver docs/security-audit/gerar-relatorio.cjs):
 * a versão original era uma edge function pública sem autenticação que usava
 * service_role para gravar em usage_logs/alerts, contornando a RLS.
 *
 * Cadeia de segurança exigida pelo PO no gate de CLASSIFY (2026-09-14):
 *   request → autenticação → autorização → validação do payload → operação service_role
 *
 *   1. AUTENTICAÇÃO: exige `Authorization: Bearer <JWT>` válido, verificado via
 *      GoTrue (`auth.getUser`) — padrão aprovado na F2.1 (admin-create-user).
 *   2. AUTORIZAÇÃO: somente superadmin pode operar, espelhando
 *      `public.is_super_admin()` (as policies de usage_logs/alerts são
 *      `USING (public.is_super_admin())`). Função pura testada em
 *      tests/security/f2_2_usage_monitor_auth.test.ts.
 *   3. VALIDAÇÃO DO PAYLOAD: `validateMetricsPayload` rejeita resource_type
 *      desconhecido, números não finitos/negativos, unit vazia, metadata não
 *      objeto e lotes acima de MAX_METRICS_PER_BATCH.
 *   4. OPERAÇÃO: service_role é criado SOMENTE após 1-3. RLS das tabelas
 *      preservada; nenhum grant/policy alterado.
 *
 * GET não é aceito: o GET original gravava dados mock via service_role (mesmo
 * risco da auditoria). O comportamento de escrita mock foi removido.
 * A função permanece não deployada até o ciclo de validação (sem deploy).
 */
Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    // F2.2: somente POST ingere métricas. GET/mock foi removido (eram escrita sem auth).
    if (req.method !== 'POST') {
        return json({ error: 'Method not allowed. Only POST is accepted.' }, 405);
    }

    try {
        // 1) Autenticação — header Authorization obrigatório
        const authHeader = req.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return json({ error: 'Missing or invalid authorization header' }, 401);
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
        if (!supabaseUrl || !anonKey) {
            throw new Error('Missing Supabase URL/anon key credentials.');
        }

        // 2) Autorização — verifica o JWT via GoTrue e exige superadmin
        // (compatível com chaves de assinatura assimétricas, ex.: ES256 — padrão F2.1)
        const supabaseClient = createClient(supabaseUrl, anonKey, {
            auth: { persistSession: false },
        });
        const token = authHeader.slice('Bearer '.length).trim();
        const { data, error } = await supabaseClient.auth.getUser(token);
        if (error || !data?.user) {
            return json({ error: 'Unauthorized: invalid token' }, 401);
        }
        if (!isSuperAdminUser(data.user)) {
            return json({ error: 'Forbidden: superadmin required' }, 403);
        }

        // 3) Validação rigorosa do payload ANTES de qualquer uso de service_role
        const body = await req.json().catch(() => ({}));
        const result = validateMetricsPayload(body);
        if (!result.ok) {
            return json({ error: `Invalid payload: ${result.error}` }, 400);
        }
        const metrics: UsageMetric[] = result.metrics;

        // 4) Operação service_role — somente após 1-3 (permanece não deployada)
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
        if (!serviceRoleKey) {
            throw new Error('Missing Supabase service credentials.');
        }
        const supabase = createClient(supabaseUrl, serviceRoleKey);
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

        const alertRows = metrics.flatMap((metric) => {
            const usagePct = metric.limit_value === 0 ? 0 : (metric.value / metric.limit_value) * 100;
            if (usagePct < 70) return [];
            return [
                {
                    resource_type: metric.resource_type,
                    message: buildAlertMessage(metric.resource_type, usagePct),
                    level: usagePct >= 90 ? 'critical' : 'warning',
                    current_value: metric.value,
                    limit_value: metric.limit_value,
                    usage_pct: Number(usagePct.toFixed(2)),
                    created_at: now,
                },
            ];
        });

        if (alertRows.length) {
            const { error: insertAlertError } = await supabase.from('alerts').insert(alertRows);
            if (insertAlertError) throw insertAlertError;
        }

        return json(
            {
                ok: true,
                collected_at: now,
                metrics_collected: usageRows.length,
                alerts_created: alertRows.length,
                note: 'Use POST autenticado com { "metrics": [...] } para registrar dados reais do provedor.',
            },
            200,
        );
    } catch (error) {
        console.error('usage-monitor error:', error);
        return json(
            {
                ok: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            },
            500,
        );
    }
});