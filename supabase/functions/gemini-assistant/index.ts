import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonResponse = (payload: unknown, status: number) =>
    new Response(JSON.stringify(payload), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    if (req.method !== 'POST') {
        return jsonResponse({ error: 'Method not allowed. Only POST is accepted.' }, 405);
    }

    try {
        // 1. Autenticação — exige Bearer JWT do usuário ativo
        const authHeader = req.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return jsonResponse({ error: 'Missing or invalid authorization header' }, 401);
        }

        const token = authHeader.slice('Bearer '.length).trim();
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

        if (!supabaseUrl || !anonKey) {
            console.error('[gemini-assistant] SUPABASE_URL ou SUPABASE_ANON_KEY ausentes.');
            return jsonResponse({ error: 'Internal configuration error' }, 500);
        }

        const supabaseClient = createClient(supabaseUrl, anonKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        const { data: { user: caller }, error: authError } = await supabaseClient.auth.getUser(token);
        if (authError || !caller) {
            return jsonResponse({ error: 'Unauthorized: invalid or expired token' }, 401);
        }

        // 2. Chave de API do Gemini — mantida como secret seguro exclusivamente no servidor
        const geminiApiKey = (
            Deno.env.get('GEMINI_API_KEY') ||
            Deno.env.get('VITE_GEMINI_API_KEY') ||
            ''
        ).trim();

        if (!geminiApiKey || geminiApiKey === 'PLACEHOLDER_API_KEY') {
            console.error('[gemini-assistant] GEMINI_API_KEY não configurada no ambiente da Edge Function.');
            return jsonResponse({ error: 'Gemini API is not configured on server' }, 503);
        }

        const body = await req.json().catch(() => ({}));
        const mode = body.mode || 'support';

        let prompt = '';

        if (mode === 'insights') {
            const metrics = body.metrics || {};
            const m = {
                revenue: metrics.revenue || 0,
                growth: metrics.growth || 0,
                avgTicket: metrics.avgTicket || 0,
                retention: metrics.retentionRate || 'N/A',
                noShow: metrics.noShowRate || 0,
                top: metrics.topService || 'Geral',
            };
            prompt = `Analise estes dados de barbearia (Faturamento R$ ${m.revenue}, Crescimento ${m.growth}%, Ticket R$ ${m.avgTicket}, Retenção ${m.retention}%, No-Show ${m.noShow}%, Top: ${m.top}) e dê um conselho estratégico curto em Português do Brasil.`;
        } else {
            const userQuestion = String(body.userQuestion || '').trim();
            if (!userQuestion) {
                return jsonResponse({ error: 'Missing required field: userQuestion' }, 400);
            }

            const isEsteticaApp = body.appSlug === 'estetica';
            const productName = isEsteticaApp ? 'SMG | Sou.Manager | Estética' : 'SMG | Sou.Manager | Barber';
            const operationName = isEsteticaApp ? 'clínicas, studios e profissionais de estética' : 'barbearias e centros de estética';
            const professionalName = isEsteticaApp ? 'Profissional' : 'Barbeiro/Profissional';
            const scheduleName = isEsteticaApp ? 'Agenda de atendimentos' : 'Agendamentos e Agenda';
            const checkoutName = isEsteticaApp ? 'Finalização de atendimento' : 'Checkout, PDV e Pagamentos';

            const knowledgeBase = `
Você é o assistente virtual oficial do ${productName}, um sistema de gestão completo para ${operationName}.
Base de Conhecimento do Sistema:
1. Cadastro de Clientes: Na aba Clientes (+ Novo Cliente para adicionar nome, telefone e e-mail).
2. ${scheduleName}: Na aba Agenda, clique em qualquer horário vazio para criar um atendimento. ${professionalName}s visualizam a própria agenda conforme perfil.
3. Equipe e Profissionais: Na aba Profissionais/Equipe para cadastrar equipe, especialidades e comissões.
4. ${checkoutName}: ${isEsteticaApp ? 'Finalize o atendimento registrando o pagamento.' : 'O Checkout/PDV registra vendas rápidas e pagamentos em dinheiro, cartão e PIX.'}
5. Serviços e Produtos: Cadastro de serviços e controle de estoque de produtos e insumos.
6. Financeiro: Fechamento de caixa, fluxo de recebimentos e relatórios de comissões.
7. Perfis de Acesso: Super Admin (acesso total), Gerente/Admin (gestão completa da unidade), Barbeiro/Profissional (agenda e comandas próprias), Recepcionista (agenda e caixa).
`;
            prompt = `${knowledgeBase}\n\nPergunta do usuário: "${userQuestion}"\n\nResponda de forma concisa, amigável, prestativa e estritamente profissional em Português do Brasil.`;
        }

        // 3. Chamada direta à REST API do Google Gemini no backend
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;

        const geminiResponse = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [{ text: prompt }]
                    }
                ],
                generationConfig: {
                    temperature: 0.4,
                    maxOutputTokens: 600,
                }
            })
        });

        if (!geminiResponse.ok) {
            const errorDetails = await geminiResponse.text();
            console.error('[gemini-assistant] Falha na API Gemini:', geminiResponse.status, errorDetails);
            if (geminiResponse.status === 429) {
                return jsonResponse({ error: 'QUOTA_EXCEEDED', message: 'Cota de uso excedida.' }, 429);
            }
            return jsonResponse({ error: 'GEMINI_UPSTREAM_ERROR', status: geminiResponse.status }, 502);
        }

        const data = await geminiResponse.json();
        const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

        return jsonResponse({ text: responseText }, 200);
    } catch (err: unknown) {
        const error = err as Error;
        console.error('[gemini-assistant] Erro não tratado:', error?.message);
        return jsonResponse({ error: 'Internal server error', message: error?.message }, 500);
    }
});
