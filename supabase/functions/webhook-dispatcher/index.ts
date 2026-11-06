// Supabase Edge Function: webhook-dispatcher
// Responsável por consumir a fila outbox (public.webhook_deliveries), assinar os payloads
// com HMAC-SHA256 e despachar para parceiros externos com política de retry e backoff exponencial.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.1';
import { dispatchSingleWebhook } from './dispatcher.ts';
import type {
  WebhookDeliveryRecord,
  WebhookSubscriptionRecord,
} from './types.ts';

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Promise<Response>): void;
};

const BATCH_SIZE = 25;

Deno.serve(async (req: Request) => {
  // 1. Tratar preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-SMG-Tenant-Id',
      },
    });
  }

  // 2. Proteção de Acesso à Edge Function (Authorization)
  const authHeader = req.headers.get('Authorization');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const edgeJwtSecret = Deno.env.get('EDGE_JWT_SECRET') || '';

  const isAuthorized =
    (serviceRoleKey && authHeader === `Bearer ${serviceRoleKey}`) ||
    (edgeJwtSecret && authHeader === `Bearer ${edgeJwtSecret}`);

  if (!isAuthorized) {
    return new Response(
      JSON.stringify({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Chamada ao webhook-dispatcher requer autorização de serviço válida.',
        },
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({
        error: {
          code: 'MISCONFIGURED_ENVIRONMENT',
          message: 'SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados no runtime.',
        },
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const nowIso = new Date().toISOString();

  try {
    // 3. Buscar entregas pendentes elegíveis para envio (status = pending e next_retry_at <= now() ou null)
    const { data: deliveriesData, error: deliveriesError } = await adminClient
      .from('webhook_deliveries')
      .select('id, subscription_id, tenant_id, event_type, payload, status, attempts, next_retry_at, response_status, response_body, delivered_at, created_at')
      .eq('status', 'pending')
      .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso}`)
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (deliveriesError) {
      console.error('[WEBHOOK-DISPATCHER] Erro ao buscar deliveries pendentes:', deliveriesError);
      return new Response(
        JSON.stringify({
          error: {
            code: 'DATABASE_ERROR',
            message: deliveriesError.message,
          },
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const deliveries: WebhookDeliveryRecord[] = deliveriesData || [];
    if (deliveries.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          processed: 0,
          delivered: 0,
          failed: 0,
          pending_retry: 0,
          message: 'Nenhum webhook pendente para processamento.',
          timestamp: nowIso,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // 4. Buscar assinaturas correspondentes
    const subscriptionIds = [...new Set(deliveries.map((d) => d.subscription_id))];
    const { data: subsData, error: subsError } = await adminClient
      .from('webhook_subscriptions')
      .select('id, tenant_id, url, secret, events, active, created_at, updated_at')
      .in('id', subscriptionIds);

    if (subsError) {
      console.error('[WEBHOOK-DISPATCHER] Erro ao carregar assinaturas:', subsError);
      return new Response(
        JSON.stringify({
          error: {
            code: 'DATABASE_ERROR',
            message: subsError.message,
          },
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const subMap = new Map<string, WebhookSubscriptionRecord>();
    for (const sub of subsData || []) {
      subMap.set(sub.id, sub);
    }

    // 5. Processar cada entrega
    let deliveredCount = 0;
    let failedCount = 0;
    let retryCount = 0;

    for (const delivery of deliveries) {
      const sub = subMap.get(delivery.subscription_id);

      if (!sub || !sub.active) {
        // Assinatura não encontrada ou inativa -> Falha definitiva
        await adminClient
          .from('webhook_deliveries')
          .update({
            status: 'failed',
            response_body: !sub ? 'Assinatura de webhook não encontrada' : 'Assinatura de webhook inativa',
            attempts: delivery.attempts + 1,
            next_retry_at: null,
          })
          .eq('id', delivery.id);

        failedCount++;
        continue;
      }

      // Disparar webhook
      const result = await dispatchSingleWebhook(delivery, sub.url, sub.secret, {
        timeoutMs: 8000,
        maxBodyLength: 1024,
      });

      // Atualizar registro no banco
      await adminClient
        .from('webhook_deliveries')
        .update({
          status: result.status,
          attempts: result.attempts,
          next_retry_at: result.nextRetryAt,
          response_status: result.responseStatus,
          response_body: result.responseBody,
          delivered_at: result.deliveredAt,
        })
        .eq('id', delivery.id);

      if (result.status === 'delivered') {
        deliveredCount++;
      } else if (result.status === 'failed') {
        failedCount++;
      } else {
        retryCount++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: deliveries.length,
        delivered: deliveredCount,
        failed: failedCount,
        pending_retry: retryCount,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    console.error('[WEBHOOK-DISPATCHER] Erro não tratado durante processamento do lote:', err);
    return new Response(
      JSON.stringify({
        error: {
          code: 'INTERNAL_ERROR',
          message: err?.message || 'Erro inesperado no webhook-dispatcher',
        },
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
