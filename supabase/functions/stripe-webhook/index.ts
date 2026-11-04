import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  verifyStripeSignature,
  handleWebhookEvent,
  type WebhookEventPayload,
  type WebhookDatabaseClient,
} from "./contract.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "stripe-signature, content-type, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")?.trim() || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  if (!webhookSecret || !supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Webhook not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 1. Ler corpo bruto como texto antes de qualquer parsing
  let rawBody = "";
  try {
    rawBody = await req.text();
  } catch {
    return new Response(JSON.stringify({ error: "Failed to read request body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 2. Verificar assinatura criptográfica
  const signatureHeader = req.headers.get("stripe-signature") || "";
  const verification = await verifyStripeSignature(rawBody, signatureHeader, webhookSecret);
  if (!verification.valid) {
    return new Response(JSON.stringify({ error: "Invalid signature", reason: verification.reason }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 3. Parse do evento validado
  let event: WebhookEventPayload;
  try {
    event = JSON.parse(rawBody) as WebhookEventPayload;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 4. Adaptador de banco Supabase com service_role
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const dbClient: WebhookDatabaseClient = {
    recordWebhookEvent: async (params) => {
      const { data, error } = await supabaseAdmin.rpc("record_webhook_event", {
        p_gateway: params.gateway,
        p_event_id: params.eventId,
        p_event_type: params.eventType,
        p_payload: params.payload,
      });

      if (error) {
        throw error;
      }
      return data as { recorded: boolean; duplicate: boolean; status?: string };
    },
    enqueueOutboxItem: async (params) => {
      await supabaseAdmin.from("outbox_items").insert({
        tenant_id: params.tenantId,
        event_id: params.eventId,
        event_type: params.eventType,
        payload: params.payload,
        status: "pending",
        retry_attempts: 0,
        retry_max_attempts: 5,
        retry_base_delay_ms: 1000,
      });
    },
  };

  const result = await handleWebhookEvent(event, dbClient);

  return new Response(JSON.stringify(result.body), {
    status: result.statusCode,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
