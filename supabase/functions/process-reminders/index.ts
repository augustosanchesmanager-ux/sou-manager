import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ClaimedReminder {
  reminder_log_id: string;
  tenant_id: string;
  appointment_id: string;
  client_id: string;
  client_name: string;
  client_phone: string | null;
  service_name: string;
  start_time: string;
  reminder_type: "2h" | "24h";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const authHeader = req.headers.get("Authorization") || "";

    if (!supabaseUrl || !supabaseAnonKey || !authHeader) {
      throw new Error("Missing Supabase configuration or authorization header.");
    }

    // Cliente autenticado via token repassado pelo chamador (cron/worker)
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const body = await req.json().catch(() => ({}));
    const targetTenantId = body?.tenant_id || null;

    // 1. Invoca RPC segura com SELECT ... FOR UPDATE SKIP LOCKED
    // Todo cálculo de janela (+2h) e inserção de idempotência ocorre no banco
    const { data: reminders, error: rpcError } = await supabase.rpc("claim_due_reminders", {
      p_tenant_id: targetTenantId,
      p_limit: 50,
    });

    if (rpcError) {
      console.error("[PROCESS-REMINDERS] RPC error:", rpcError);
      throw rpcError;
    }

    const claimedList: ClaimedReminder[] = reminders || [];
    console.log(`[PROCESS-REMINDERS] Reivindicados ${claimedList.length} lembretes para envio.`);

    let sentCount = 0;
    const errors: Array<{ reminder_id: string; error: string }> = [];

    // 2. Loop de disparo das notificações (Mock estruturado de API)
    for (const reminder of claimedList) {
      try {
        console.log(`[MOCK DISPATCH][${reminder.reminder_type}] Enviando lembrete para ${reminder.client_name} (${reminder.client_phone || "Sem telefone"}):`, {
          tenantId: reminder.tenant_id,
          appointmentId: reminder.appointment_id,
          service: reminder.service_name,
          startTimeUtc: reminder.start_time,
        });

        // Simulação de gateway WhatsApp / Push / Resend
        sentCount++;
      } catch (err: any) {
        errors.push({ reminder_id: reminder.reminder_log_id, error: err?.message || "Unknown dispatch error" });
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        claimed: claimedList.length,
        dispatched: sentCount,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[PROCESS-REMINDERS] Fatal error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: error?.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
