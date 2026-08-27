/**
 * [SMG][D8] worker-dispatcher — server-side outbox dispatcher (Edge Function).
 *
 * ADR-016 (Amendment-01 Execution Boundary / Amendment-02 Data Contract /
 * Amendment-03 Core Sharing) + PO decision D-5 (Supabase Cron -> Edge Function).
 *
 * Job per scheduled cycle:
 *   1. claim_next_outbox_item()              -> atomically claims the oldest pending
 *                                                item (FOR UPDATE SKIP LOCKED). Exactly
 *                                                one worker ever claims a given item.
 *   2. get_financial_operation_context()     -> mounts MINIMAL context for the tenant.
 *                                                NEVER calculates commission here.
 *   3. calculateCommissionRecordsFromContext -> runs the certified rule in the pure
 *                                                Financial Domain Core (single source,
 *                                                integrity-gated _shared artifact).
 *   4. exists_commission_record() + insert   -> idempotent persistence.
 *   5. mark_outbox_item_processed()          -> published | failed.
 *   6. upsert_worker_heartbeat()             -> declarative server-side liveness.
 *
 * Non-goals (STOP conditions of D8): NO generic table access, NO service_role on
 * the data path, NO commission math in Deno except the shared Core, NO SQL rule.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { mintWorkerJwt } from './jwt.ts';
import { calculateCommissionRecordsFromContext } from './calculate.ts';

// const WORKER_ID = `d8-${Deno.env.get('SUPABASE_FUNCTION_NAME') || 'worker-dispatcher'}`;
const WORKER_ID = 'worker-dispatcher';
const MAX_TARGETS_PER_CYCLE = 25;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

export interface CycleReport {
  ok: boolean;
  claimed: number;
  processed: number;
  failed: number;
  skipped: number;
  error?: string;
}

async function withWorkerClient(url: string, jwt: string) {
  // apikey = anon key (Kong gateway); Authorization bearer carries the
  // worker_dispatcher role that PostgREST switches to. NOT service_role.
  return createClient(url, Deno.env.get('SUPABASE_ANON_KEY') || '', {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
}

async function runCycle(url: string, jwt: string, maxTargets: number): Promise<CycleReport> {
  const supabase = await withWorkerClient(url, jwt);
  const report: CycleReport = { ok: true, claimed: 0, processed: 0, failed: 0, skipped: 0 };

  for (let i = 0; i < maxTargets; i++) {
    // ── 1. claim ────────────────────────────────────────────────
    const { data: claimed, error: claimErr } = await supabase.rpc(
      'claim_next_outbox_item',
      { p_tenant_id: null, p_claimed_by: WORKER_ID },
    );
    if (claimErr) throw new Error(`claim failed: ${claimErr.message}`);
    if (!claimed) break; // queue drained

    report.claimed++;
    const item = claimed as {
      id: string;
      tenant_id: string;
      event_id?: string;
      payload?: Record<string, unknown>;
    };

    try {
      // ── 2. context ─────────────────────────────────────────────
      const { data: context, error: ctxErr } = await supabase.rpc(
        'get_financial_operation_context',
        { p_item_id: item.id, p_tenant_id: item.tenant_id },
      );
      if (ctxErr) throw new Error(`context failed: ${ctxErr.message}`);

      // ── 3. calculate (pure Core, no I/O) ───────────────────────
      const { records, sourceStaffIds } = calculateCommissionRecordsFromContext(
        context as never,
      );

      // ── 4. idempotent persistence ──────────────────────────────
      for (const rec of records) {
        if (rec.commissionValue <= 0) continue;
        const { data: exists, error: existsErr } = await supabase.rpc(
          'exists_commission_record',
          { p_staff_id: rec.staffId, p_comanda_id: rec.comandaId, p_tenant_id: rec.tenantId },
        );
        if (existsErr) throw new Error(`idempotency check failed: ${existsErr.message}`);
        if (exists) { report.skipped++; continue; }

        const { error: insertErr } = await supabase.rpc('insert_commission_record', {
          p_tenant_id: rec.tenantId,
          p_comanda_id: rec.comandaId,
          p_comanda_item_id: rec.comandaItemId,
          p_staff_id: rec.staffId,
          p_gross_value: rec.grossValue,
          p_discount: rec.discount,
          p_net_value: rec.netValue,
          p_received_value: rec.receivedValue,
          p_commission_rate: rec.commissionRate,
          p_commission_value: rec.commissionValue,
          p_participant_share: rec.participantShare,
          p_payout_type: rec.payoutType,
          p_affects_commission: rec.affectsCommission,
          p_idempotency_key: rec.idempotencyKey,
          p_event_id: rec.eventId,
          p_event_type: rec.eventType,
        });
        if (insertErr) {
          // unique_violation is signalled as {idempotent:true} on success, so a
          // hard RPC error here is a retryable push failure.
          throw new Error(`insert failed: ${insertErr.message}`);
        }
        report.processed++;
      }

      // ── 5. mark processed ──────────────────────────────────────
      const { error: markErr } = await supabase.rpc('mark_outbox_item_processed', {
        p_item_id: item.id,
        p_tenant_id: item.tenant_id,
        p_status: 'published',
        p_error: null,
        p_attempts: null,
      });
      if (markErr) throw new Error(`mark failed: ${markErr.message}`);

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      void sourceStaffIds;
    } catch (cycleError) {
      // A cycle failure on this item -> mark failed (retry lifecycle owned by
      // the outbox SQL surface + scheduled requeue, NOT a manual bypass).
      report.failed++;
      const msg = cycleError instanceof Error ? cycleError.message : String(cycleError);
      report.error = msg;
      try {
        await supabase.rpc('mark_outbox_item_processed', {
          p_item_id: item.id,
          p_tenant_id: item.tenant_id,
          p_status: 'failed',
          p_error: msg.slice(0, 500),
          p_attempts: 1,
        });
      } catch (markFailErr) {
        report.error += `; mark-failed: ${markFailErr instanceof Error ? markFailErr.message : ''}`;
      }
    }
  }

  return report;
}

async function reportHeartbeat(url: string, jwt: string, report: CycleReport) {
  const supabase = await withWorkerClient(url, jwt);
  await supabase.rpc('upsert_worker_heartbeat', {
    p_worker_id: WORKER_ID,
    p_last_scheduled_at: new Date().toISOString(),
    p_cycle_ok: report.ok,
    p_last_error: report.error || null,
    p_delta_processed: report.processed,
    p_delta_failed: report.failed,
    p_delta_dead: 0,
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const jwtSecret = Deno.env.get('SUPABASE_JWT_SECRET') || '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  if (!jwtSecret || !supabaseUrl) {
    return new Response(
      JSON.stringify({ ok: false, error: 'SUPABASE_JWT_SECRET/SUPABASE_URL missing (scheduled invoke only; not user-facing).' }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  try {
    const jwt = await mintWorkerJwt(jwtSecret, { role: 'worker_dispatcher' });
    const report = await runCycle(supabaseUrl, jwt, MAX_TARGETS_PER_CYCLE);
    await reportHeartbeat(supabaseUrl, jwt, report);

    return new Response(JSON.stringify({ ok: report.ok, ...report }), {
      status: report.ok ? 200 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
