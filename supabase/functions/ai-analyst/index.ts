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
const COPILOT_DAILY_LIMIT = 20;
const VALID_COPILOT_ACTIONS = new Set(['campaign', 'paid_traffic', 'goals', 'free_chat']);

const ACTION_INSTRUCTIONS: Record<string, string> = {
  campaign:
    'Monte uma campanha prática de WhatsApp/automação para recuperar clientes inativos ou preencher horários ociosos usando os dados reais da barbearia. Inclua oferta clara, público-alvo, passos de execução e uma mensagem pronta para enviar no WhatsApp.',
  paid_traffic:
    'Monte um plano de tráfego pago local (Instagram/Facebook Ads ou Google) para barbearia focado nos horários de menor movimento e serviços de maior margem. Inclua segmentação de raio/público, oferta, passos de execução e um texto/roteiro pronto de anúncio.',
  goals:
    'Sugira metas semanais e mensais realistas de faturamento, ticket médio, recorrência (Clube) e desempenho por barbeiro com base nos números reais fornecidos. Inclua passos práticos de acompanhamento com a equipe e uma mensagem curta de alinhamento para enviar no grupo da equipe.',
  free_chat:
    'Responda diretamente à pergunta do gestor com foco empresarial prático para barbearias modernas (automação, tráfego pago, recorrência e margem). Sempre baseie a resposta nos dados reais fornecidos e entregue passos acionáveis.',
};

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

    let requestBody: Record<string, unknown> = {};
    try {
      const rawBody = await req.text();
      if (rawBody && rawBody.trim()) {
        const parsedBody = JSON.parse(rawBody);
        if (parsedBody && typeof parsedBody === 'object') {
          requestBody = parsedBody as Record<string, unknown>;
        }
      }
    } catch {
      requestBody = {};
    }

    const mode = requestBody.mode === 'strategy_copilot' ? 'strategy_copilot' : 'daily_diagnosis';

    // =========================================================================
    // FASE 2 (ADR-057): Copiloto Estratégico Interativo (botões de ação + chat)
    // =========================================================================
    if (mode === 'strategy_copilot') {
      const actionTypeRaw = String(requestBody.actionType || 'free_chat');
      const actionType = VALID_COPILOT_ACTIONS.has(actionTypeRaw) ? actionTypeRaw : 'free_chat';
      const userPrompt = String(requestBody.prompt || '').trim().slice(0, 1000);

      if (actionType === 'free_chat' && userPrompt.length === 0) {
        return jsonResponse({ error: 'Digite uma pergunta ou escolha uma ação estratégica.' }, 400);
      }

      // Rate limit diário server-side por tenant via ai_usage_logs
      const dayStartIso = `${referenceDate}T00:00:00-03:00`;
      const { count: usedToday } = await supabase
        .from('ai_usage_logs')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('feature', 'ai_strategy_copilot')
        .eq('status', 'success')
        .gte('created_at', dayStartIso);

      const usedCount = Number(usedToday || 0);
      if (usedCount >= COPILOT_DAILY_LIMIT) {
        return jsonResponse(
          { error: `Limite diário de ${COPILOT_DAILY_LIMIT} consultas do Copiloto IA atingido hoje. Volte amanhã!` },
          429
        );
      }

      const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
      if (!geminiApiKey) {
        return jsonResponse(
          { error: 'Serviço de IA temporariamente indisponível (GEMINI_API_KEY não configurada).' },
          503
        );
      }

      // Métricas determinísticas do PostgreSQL (zero alucinação matemática)
      const { data: metrics } = await supabase.rpc('get_tenant_weekly_metrics', {
        p_tenant_id: tenantId,
      });

      const biContext =
        requestBody.biContext && typeof requestBody.biContext === 'object'
          ? requestBody.biContext
          : null;

      const historyRaw = Array.isArray(requestBody.history) ? requestBody.history.slice(-6) : [];
      const historyLines = historyRaw
        .filter((h: unknown) => h && typeof h === 'object')
        .map((h: Record<string, unknown>) => {
          const speaker = h.role === 'assistant' ? 'Copiloto' : 'Gestor';
          return `${speaker}: ${String(h.content || '').slice(0, 400)}`;
        })
        .join('\n');

      const copilotSystemPrompt = [
        'Você é o Copiloto Estratégico do SMG Barber, especialista experiente na gestão de barbearias brasileiras modernas que atuam com automação de WhatsApp, tráfego pago local (Meta/Google Ads), Club de assinaturas e alta recorrência.',
        'Use EXCLUSIVAMENTE os números reais fornecidos nos JSONs de contexto (nunca invente valores ou percentuais que não estejam nos dados).',
        'Fale em português do Brasil (pt-BR), direto ao ponto, como um consultor prático que ajuda o dono da barbearia a executar hoje mesmo.',
        'Retorne JSON estrito com: headline (título curto), summary (diagnóstico direto de 2-3 frases citando os dados reais), steps (3 a 5 passos práticos com step e detail), readyMessage (mensagem pronta de WhatsApp ou roteiro de anúncio copiável) e kpiToTrack (como medir o resultado em 7 dias).',
      ].join(' ');

      const userParts = [
        `Objetivo (${actionType}): ${ACTION_INSTRUCTIONS[actionType]}`,
        userPrompt ? `Pergunta/Contexto adicional do gestor: ${userPrompt}` : '',
        historyLines ? `Histórico recente da conversa:\n${historyLines}` : '',
        `Métricas semanais oficiais (PostgreSQL):\n${JSON.stringify(metrics || {})}`,
        biContext ? `Resumo adicional do painel BI:\n${JSON.stringify(biContext).slice(0, 2000)}` : '',
      ]
        .filter(Boolean)
        .join('\n\n');

      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${geminiApiKey}`;
      const geminiRes = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: copilotSystemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userParts }] }],
          generationConfig: {
            temperature: 0.35,
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                headline: { type: 'STRING' },
                summary: { type: 'STRING' },
                steps: {
                  type: 'ARRAY',
                  minItems: 3,
                  maxItems: 5,
                  items: {
                    type: 'OBJECT',
                    properties: {
                      step: { type: 'STRING' },
                      detail: { type: 'STRING' },
                    },
                    required: ['step', 'detail'],
                  },
                },
                readyMessage: { type: 'STRING' },
                kpiToTrack: { type: 'STRING' },
              },
              required: ['headline', 'summary', 'steps', 'readyMessage', 'kpiToTrack'],
            },
          },
        }),
      });

      if (!geminiRes.ok) {
        const errStatus = geminiRes.status === 429 ? 429 : 503;
        return jsonResponse(
          { error: `Falha ao consultar Copiloto IA (HTTP ${geminiRes.status}).` },
          errStatus
        );
      }

      const geminiJson = await geminiRes.json();
      const rawText = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text;
      const plan = rawText ? JSON.parse(rawText) : null;

      if (!plan || !plan.headline || !Array.isArray(plan.steps)) {
        return jsonResponse({ error: 'Resposta estruturada inválida do Copiloto IA.' }, 502);
      }

      const usage = geminiJson?.usageMetadata || {};
      const promptTokens = Number(usage.promptTokenCount || 0);
      const completionTokens = Number(usage.candidatesTokenCount || 0);
      const totalTokens = Number(usage.totalTokenCount || promptTokens + completionTokens);

      await supabase.from('ai_usage_logs').insert({
        tenant_id: tenantId,
        user_id: userId,
        feature: 'ai_strategy_copilot',
        model: MODEL_NAME,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
        latency_ms: Date.now() - startedAt,
        cached: false,
        status: 'success',
      });

      return jsonResponse({
        generatedAt: new Date().toISOString(),
        actionType,
        remainingToday: Math.max(0, COPILOT_DAILY_LIMIT - (usedCount + 1)),
        plan,
      });
    }

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
