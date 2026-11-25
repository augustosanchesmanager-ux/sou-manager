// @ts-nocheck
// =============================================================================
// Supabase Edge Function: ai-analyst (GTM-004 / #403 / ADR-050)
// SMG Barber Intelligence — Fase 1 (Diagnóstico Executivo de Gestão)
//
// Blindagens obrigatórias:
//   1. verify_jwt = true + validação explícita de auth.getUser() e role (owner/manager/superadmin)
//   2. Cache diário em public.ai_insights (UNIQUE(tenant_id, reference_date) — máx. 1 geração/dia)
//   3. Zero alucinação matemática: métricas calculadas via RPC get_tenant_weekly_metrics
//   4. Cold start custo zero: appointment_count === 0 retorna card estático sem chamar Gemini
//   5. Stateless + JSON Schema estrito (exatamente 3 cards) + log de tokens em public.ai_usage_logs
// =============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MODEL_NAME = 'gemini-2.5-flash';
const ALLOWED_ROLES = new Set(['owner', 'manager', 'superadmin', 'admin']);

interface AiInsightCard {
  title: string;
  alertLevel: 'info' | 'warning' | 'critical' | 'positive';
  diagnosis: string;
  recommendedAction: string;
}

const COLD_START_CARDS: AiInsightCard[] = [
  {
    title: 'Comece sua operação para destravar o diagnóstico',
    alertLevel: 'info',
    diagnosis:
      'Ainda não há agendamentos registrados nos últimos 7 dias para gerar comparativos reais de faturamento, ocupação e cancelamentos.',
    recommendedAction:
      'Cadastre os primeiros agendamentos na Agenda e finalize pelo menos uma comanda no Checkout para ativar a leitura semanal automática.',
  },
  {
    title: 'Revise o catálogo de serviços e preços',
    alertLevel: 'positive',
    diagnosis:
      'Uma grade de serviços com durações e valores atualizados permite que o diagnóstico calcule ticket médio e ociosidade com precisão.',
    recommendedAction:
      'Confira em Serviços se os tempos médios de cada atendimento refletem a rotina real da sua equipe.',
  },
  {
    title: 'Ative o agendamento online para encher a semana',
    alertLevel: 'info',
    diagnosis:
      'Barbearias que compartilham o link de agendamento online acumulam histórico operacional mais rápido e reduzem horários vagos.',
    recommendedAction:
      'Copie seu link em Configurações do Agendamento Online e envie para os clientes recorrentes no WhatsApp.',
  },
];

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function getSaoPauloDateKey(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const startedAt = Date.now();

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Token de autenticação ausente.' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !supabaseAnonKey) {
      return jsonResponse({ error: 'Configuração Supabase indisponível no runtime.' }, 503);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return jsonResponse({ error: 'Sessão inválida ou expirada.' }, 401);
    }

    const userId = userData.user.id;

    const { data: accessCtx, error: ctxErr } = await supabase.rpc('get_auth_access_context');
    if (ctxErr || !accessCtx) {
      return jsonResponse({ error: 'Não foi possível resolver contexto de acesso do usuário.' }, 403);
    }

    const resolved = Array.isArray(accessCtx) ? accessCtx[0] : accessCtx;
    const tenantId: string | null = resolved?.effective_tenant_id || resolved?.tenant_id || null;
    const role = String(resolved?.role || resolved?.access_role || '').toLowerCase();
    const isSuperAdmin = Boolean(resolved?.is_super_admin);

    if (!tenantId) {
      return jsonResponse({ error: 'Tenant não encontrado para o usuário autenticado.' }, 403);
    }

    if (!isSuperAdmin && !ALLOWED_ROLES.has(role)) {
      return jsonResponse({ error: 'Acesso restrito a gestores e proprietários.' }, 403);
    }

    const referenceDate = getSaoPauloDateKey();

    // 1. Verificar cache diário em ai_insights (máximo 1 geração/dia por tenant)
    const { data: cachedRow } = await supabase
      .from('ai_insights')
      .select('cards, created_at, cold_start')
      .eq('tenant_id', tenantId)
      .eq('reference_date', referenceDate)
      .maybeSingle();

    if (cachedRow && Array.isArray(cachedRow.cards) && cachedRow.cards.length > 0) {
      await supabase.from('ai_usage_logs').insert({
        tenant_id: tenantId,
        user_id: userId,
        feature: 'ai_analyst_weekly',
        model: MODEL_NAME,
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
        latency_ms: Date.now() - startedAt,
        cached: true,
        status: 'cache_hit',
      });

      return jsonResponse({
        generatedAt: cachedRow.created_at,
        cached: true,
        coldStart: Boolean(cachedRow.cold_start),
        cards: cachedRow.cards,
      });
    }

    // 2. Calcular métricas determinísticas no PostgreSQL (zero alucinação matemática)
    const { data: metrics, error: metricsErr } = await supabase.rpc('get_tenant_weekly_metrics', {
      p_tenant_id: tenantId,
    });

    if (metricsErr || !metrics) {
      return jsonResponse(
        { error: `Erro ao consolidar métricas semanais: ${metricsErr?.message || 'dados vazios'}` },
        500
      );
    }

    // 3. Cold Start: custo zero se não há agendamentos na janela de 7 dias
    if (Number(metrics.appointment_count || 0) === 0) {
      const nowIso = new Date().toISOString();
      await supabase.from('ai_insights').upsert(
        {
          tenant_id: tenantId,
          reference_date: referenceDate,
          model: 'static-cold-start',
          cards: COLD_START_CARDS,
          metrics_snapshot: metrics,
          cold_start: true,
          created_by: userId,
          updated_at: nowIso,
        },
        { onConflict: 'tenant_id,reference_date' }
      );

      await supabase.from('ai_usage_logs').insert({
        tenant_id: tenantId,
        user_id: userId,
        feature: 'ai_analyst_weekly',
        model: 'static-cold-start',
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
        latency_ms: Date.now() - startedAt,
        cached: false,
        status: 'cold_start',
      });

      return jsonResponse({
        generatedAt: nowIso,
        cached: false,
        coldStart: true,
        cards: COLD_START_CARDS,
      });
    }

    // 4. Invocar Google Gemini 2.5 Flash com JSON Schema estrito
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      return jsonResponse(
        { error: 'Serviço de IA temporariamente indisponível (GEMINI_API_KEY não configurada).' },
        503
      );
    }

    const systemPrompt = [
      'Você é um consultor executivo sênior de gestão para barbearias brasileiras (SMG Barber).',
      'Analise EXCLUSIVAMENTE o JSON de métricas semanais fornecido. Nunca invente números.',
      'Retorne exatamente 3 cards objetivos em português do Brasil (pt-BR), sem jargão técnico.',
      'Cada card deve ter title (curto), alertLevel (info | warning | critical | positive), diagnosis (1-2 frases citando os números exatos do JSON) e recommendedAction (ação prática imediata para o gestor).',
    ].join(' ');

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${geminiApiKey}`;
    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [
          {
            role: 'user',
            parts: [{ text: `Métricas semanais consolidadas (JSON):\n${JSON.stringify(metrics)}` }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              cards: {
                type: 'ARRAY',
                minItems: 3,
                maxItems: 3,
                items: {
                  type: 'OBJECT',
                  properties: {
                    title: { type: 'STRING' },
                    alertLevel: { type: 'STRING', enum: ['info', 'warning', 'critical', 'positive'] },
                    diagnosis: { type: 'STRING' },
                    recommendedAction: { type: 'STRING' },
                  },
                  required: ['title', 'alertLevel', 'diagnosis', 'recommendedAction'],
                },
              },
            },
            required: ['cards'],
          },
        },
      }),
    });

    if (!geminiRes.ok) {
      const errStatus = geminiRes.status === 429 ? 429 : 503;
      return jsonResponse(
        { error: `Falha ao consultar motor de IA (HTTP ${geminiRes.status}).` },
        errStatus
      );
    }

    const geminiJson = await geminiRes.json();
    const rawText = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = rawText ? JSON.parse(rawText) : null;
    const cards: AiInsightCard[] = Array.isArray(parsed?.cards) ? parsed.cards.slice(0, 3) : [];

    if (cards.length === 0) {
      return jsonResponse({ error: 'Resposta estruturada inválida do motor de IA.' }, 502);
    }

    const usage = geminiJson?.usageMetadata || {};
    const promptTokens = Number(usage.promptTokenCount || 0);
    const completionTokens = Number(usage.candidatesTokenCount || 0);
    const totalTokens = Number(usage.totalTokenCount || promptTokens + completionTokens);
    const nowIso = new Date().toISOString();

    await supabase.from('ai_insights').upsert(
      {
        tenant_id: tenantId,
        reference_date: referenceDate,
        model: MODEL_NAME,
        cards,
        metrics_snapshot: metrics,
        cold_start: false,
        created_by: userId,
        updated_at: nowIso,
      },
      { onConflict: 'tenant_id,reference_date' }
    );

    await supabase.from('ai_usage_logs').insert({
      tenant_id: tenantId,
      user_id: userId,
      feature: 'ai_analyst_weekly',
      model: MODEL_NAME,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
      latency_ms: Date.now() - startedAt,
      cached: false,
      status: 'success',
    });

    return jsonResponse({
      generatedAt: nowIso,
      cached: false,
      coldStart: false,
      cards,
    });
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Erro inesperado ao gerar diagnóstico.' },
      500
    );
  }
});
