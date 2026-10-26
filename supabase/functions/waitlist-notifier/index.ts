import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface WaitlistCandidate {
  waitlist_id: string;
  client_name: string;
  client_phone: string | null;
  service_name: string;
  slot_start: string;
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

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const payload = await req.json().catch(() => ({}));
    const { appointment_id, tenant_id } = payload;

    if (!appointment_id || !tenant_id) {
      return new Response(JSON.stringify({ ok: false, error: "Missing appointment_id or tenant_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Invoca a RPC de processamento seguro de cancelamento com validação pós-debounce
    const { data: matchedCandidates, error: matchError } = await supabase.rpc(
      "process_waitlist_cancellation",
      {
        p_tenant_id: tenant_id,
        p_appointment_id: appointment_id,
      }
    );

    if (matchError) {
      console.error("[WAITLIST-NOTIFIER] Error querying waitlist match:", matchError);
      throw matchError;
    }

    const candidates: WaitlistCandidate[] = matchedCandidates || [];
    console.log(`[WAITLIST-NOTIFIER] Encontrados ${candidates.length} candidatos elegíveis na fila.`);

    // 2. Dispara notificação FCFS (First Come, First Served)
    for (const candidate of candidates) {
      console.log(`[WAITLIST-DISPATCH] Notificando cliente da fila ${candidate.client_name}:`, {
        waitlistId: candidate.waitlist_id,
        phone: candidate.client_phone,
        vagaHorario: candidate.slot_start,
        servico: candidate.service_name,
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        appointment_id,
        candidates_notified: candidates.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[WAITLIST-NOTIFIER] Fatal error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: error?.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
