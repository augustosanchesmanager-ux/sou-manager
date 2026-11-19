import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GEMINI_MODEL = 'gemini-2.5-flash';

interface AiInsightCard {
  title: string;
  alertLevel: 'info' | 'warning' | 'critical' | 'positive';
  diagnosis: string;
  recommendedAction: string;
}

interface WeeklyMetrics {
  tenant_id: string;
  reference_date: string;
  appointment_count: number;
  completed_count: number;
  no_show_count: number;
  cancelled_count: number;
  income_current: number;
  income_previous: number;
  expense_current: number;
  net_result_current: number;
  growth_pct: number;
  avg_ticket: number;
  active_staff_count: number;
  total_clients: number;
  inactive_clients_30d: number;
}

const jsonResponse = (payload: unknown, status: number) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const buildColdStartCards = (): AiInsightCard[] => [
  {
    title: 'Base em construção nesta semana',
    alertLevel: 'info',
    diagnosis:
      'Ainda não há atendimentos registrados nos últimos 7 dias para gerar um diagnóstico comparativo confiável.',
    recommendedAction:
      'Registre os próximos agendamentos e finalize as comandas pelo PDV para ativar a leitura automática de tendências.',
  },
  {
    title: 'Configure equipe e serviços ativos',
    alertLevel: 'positive',
    diagnosis:
      'Com profissionais e serviços cadastrados, o SMG passa a medir ocupação, ticket médio e recorrência automaticamente.',
    recommendedAction:
      'Revise a escala em Equipe e os valores em Serviços para garantir que o cálculo de comissão e margem comece certo.',
  },
  {
    title: 'Primeira leitura diária sem custo extra',
    alertLevel: 'info',
    diagnosis:
      'Assim que houver movimento na agenda, o diagnóstico diário será gerado e mantido em cache para todo o dia.',
    recommendedAction:
      'Volte ao Cockpit do dono após os primeiros atendimentos da semana para acompanhar recomendações personalizadas.',
  },
];

const RESPONSE_SCHEMA = {
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
          alertLevel: {
            type: 'STRING',
            enum: ['info', 'warning', 'critical', 'positive'],
          },
          diagnosis: { type: 'STRING' },
          recommendedAction: { type: 'STRING' },
        },
        required: ['title', 'alertLevel', 'diagnosis', 'recommendedAction'],
      },
    },
  },
  required: ['cards'],
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed. Only POST is accepted.' }, 405);
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Missing or invalid authorization header' }, 401);
    }

    const token = authHeader.slice('Bearer '.length).trim();
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    if (!supabaseUrl || !anonKey) {
      console.error('[ai-analyst] SUPABASE_URL ou SUPABASE_ANON_KEY ausentes.');
      return jsonResponse({ error: 'Internal configuration error' }, 500);
    }

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return jsonResponse({ error: 'Unauthorized: invalid or expired token' }, 401);
    }

    // 1. Autorização tenant-scoped e verificação de role (apenas owner/manager/superadmin)
    const { data: accessRows, error: accessError } = await supabase.rpc('get_auth_access_context');
    if (accessError || !accessRows || accessRows.length === 0) {
      console.error('[ai-analyst] Falha ao resolver contexto de acesso:', accessError?.message);
      return jsonResponse({ error: 'Forbidden: access context unavailable' }, 403);
    }

    const access = accessRows[0] as {
      tenant_id: string | null;
      access_role: string;
      is_super_admin: boolean;
    };

    const isAllowedRole = access.access_role === 'manager' || access.is_super_admin;
    if (!isAllowedRole || !access.tenant_id) {
      return jsonResponse({ error: 'Forbidden: restricted to owner or manager' }, 403);
    }

    const tenantId = access.tenant_id;
    const todayIso = new Date().toISOString().slice(0, 10);

    // 2. Cache diário em ai_insights (máximo 1 geração/dia por tenant)
    const { data: cachedInsight, error: cacheError } = await supabase
      .from('ai_insights')
      .select('cards, created_at, reference_date')
      .eq('tenant_id', tenantId)
      .eq('reference_date', todayIso)
      .maybeSingle();

    if (!cacheError && cachedInsight?.cards) {
      return jsonResponse(
        {
          generatedAt: cachedInsight.created_at,
          referenceDate: cachedInsight.reference_date,
          cached: true,
          coldStart: false,
          cards: cachedInsight.cards,
        },
        200,
      );
    }

    // 3. Coleta determinística de métricas via PostgreSQL RPC
    const { data: metricsRaw, error: metricsError } = await supabase.rpc('get_tenant_weekly_metrics', {
      p_tenant_id: tenantId,
    });

    if (metricsError || !metricsRaw) {
      console.error('[ai-analyst] Falha na RPC get_tenant_weekly_metrics:', metricsError?.message);
      return jsonResponse({ error: 'Failed to load tenant metrics' }, 500);
    }

    const metrics = metricsRaw as WeeklyMetrics;

    // 4. Bypass de Cold Start (custo zero quando não há agendamentos na semana)
    if (!metrics.appointment_count || metrics.appointment_count === 0) {
      return jsonResponse(
        {
          generatedAt: new Date().toISOString(),
          referenceDate: metrics.reference_date || todayIso,
          cached: false,
          coldStart: true,
          cards: buildColdStartCards(),
        },
        200,
      );
    }

    // 5. Chamada ao Gemini 2.5 Flash com JSON Schema estrito (stateless)
    const geminiApiKey = (Deno.env.get('GEMINI_API_KEY') || '').trim();
    if (!geminiApiKey || geminiApiKey === 'PLACEHOLDER_API_KEY') {
      console.error('[ai-analyst] GEMINI_API_KEY não configurada no ambiente da Edge Function.');
      return jsonResponse({ error: 'Gemini API is not configured on server' }, 503);
    }

    const systemInstruction = [
      'Você é o Consultor de Negócios de Barbearia do SMG Barber Intelligence.',
      'Sua função é analisar métricas consolidadas de uma barbearia nos últimos 7 dias e entregar exatamente 3 cards práticos e diretos em Português do Brasil.',
      'REGRA INVIOLÁVEL: Use estritamente os números fornecidos no JSON. Nunca invente, estime ou recalcule valores financeiros ou contagens.',
      'Seja objetivo, acionável e voltado para aumentar faturamento, ocupação ou retenção de clientes.',
    ].join(' ');

    const userPrompt = `Métricas consolidadas da semana (JSON determinístico do PostgreSQL):\n${JSON.stringify(metrics)}\n\nGere exatamente 3 cards de diagnóstico executivo.`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiApiKey}`;
    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 900,
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errorDetails = await geminiResponse.text();
      console.error('[ai-analyst] Falha na API Gemini:', geminiResponse.status, errorDetails);
      if (geminiResponse.status === 429) {
        return jsonResponse({ error: 'QUOTA_EXCEEDED', message: 'Cota temporariamente excedida.' }, 429);
      }
      return jsonResponse({ error: 'GEMINI_UPSTREAM_ERROR', status: geminiResponse.status }, 502);
    }

    const geminiData = await geminiResponse.json();
    const rawJsonText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const parsed = JSON.parse(rawJsonText) as { cards?: AiInsightCard[] };

    if (!Array.isArray(parsed?.cards) || parsed.cards.length !== 3) {
      console.error('[ai-analyst] Resposta do Gemini fora do contrato esperado:', rawJsonText);
      return jsonResponse({ error: 'Invalid AI response contract' }, 502);
    }

    const usageMeta = geminiData?.usageMetadata ?? {};
    const promptTokens = Number(usageMeta.promptTokenCount ?? 0);
    const completionTokens = Number(usageMeta.candidatesTokenCount ?? 0);
    const totalTokens = Number(usageMeta.totalTokenCount ?? promptTokens + completionTokens);

    // 6. Persistência idempotente em ai_insights (UNIQUE tenant_id, reference_date)
    const referenceDate = metrics.reference_date || todayIso;
    const { data: persisted, error: persistError } = await supabase
      .from('ai_insights')
      .upsert(
        {
          tenant_id: tenantId,
          reference_date: referenceDate,
          model: GEMINI_MODEL,
          cards: parsed.cards,
          metrics_snapshot: metrics,
          created_by: user.id,
        },
        { onConflict: 'tenant_id,reference_date', ignoreDuplicates: true },
      )
      .select('created_at, reference_date, cards')
      .maybeSingle();

    if (persistError) {
      console.warn('[ai-analyst] Aviso ao persistir ai_insights:', persistError.message);
    }

    await supabase.from('ai_usage_logs').insert({
      tenant_id: tenantId,
      user_id: user.id,
      feature: 'strategic_diagnosis',
      model: GEMINI_MODEL,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
      cached: false,
    });

    return jsonResponse(
      {
        generatedAt: persisted?.created_at ?? new Date().toISOString(),
        referenceDate: persisted?.reference_date ?? referenceDate,
        cached: false,
        coldStart: false,
        cards: persisted?.cards ?? parsed.cards,
      },
      200,
    );
  } catch (err: unknown) {
    const error = err as Error;
    console.error('[ai-analyst] Erro não tratado:', error?.message);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});
