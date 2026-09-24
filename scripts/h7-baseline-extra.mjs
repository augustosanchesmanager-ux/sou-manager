// H-7 baseline conference extras — read-only against PRODUCTION.
// Explains credits/subscriptions deltas + checks if salon operated today.
// Prints aggregates only.
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const PROD_URL = 'https://ushsnmlbeurfvlkieiln.supabase.co';
const SANCHEZ = 'b716e290-f7f6-4449-b790-5ae9dcdadcab';

const raw = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf-8');
let serviceKey = '';
for (const line of raw.split(/\r?\n/)) {
  const t = line.trim();
  if (t.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
    serviceKey = t.slice(t.indexOf('=') + 1).trim().replace(/^"(.*)"$/, '$1');
    break; // first candidate — verified working in h7-probe-srk
  }
}
if (!serviceKey) { console.error('no service key'); process.exit(1); }

const db = createClient(PROD_URL, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function countByStatus(table) {
  const { data, error } = await db.from(table).select('status').eq('tenant_id', SANCHEZ);
  if (error) return { error: error.message };
  const by = {};
  for (const r of data ?? []) by[r.status ?? 'null'] = (by[r.status ?? 'null'] ?? 0) + 1;
  return { total: (data ?? []).length, by };
}

async function main() {
  const subs = await countByStatus('customer_subscriptions');
  console.log('SUBSCRIPTIONS:', JSON.stringify(subs));

  const { data: credits, error: ce } = await db
    .from('customer_credits')
    .select('id, client_id, credits_available, credits_used, created_at, updated_at')
    .eq('tenant_id', SANCHEZ);
  if (ce) console.log('CREDITS_ERROR:', ce.message);
  else {
    const avail = (credits ?? []).reduce((s, c) => s + (c.credits_available ?? 0), 0);
    const used = (credits ?? []).reduce((s, c) => s + (c.credits_used ?? 0), 0);
    console.log('CREDITS rows:', credits?.length ?? 0, 'sum_available:', avail, 'sum_used:', used);
    // most recent credit activity
    const recent = [...(credits ?? [])].sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at))).slice(0, 3);
    console.log('CREDITS most_recent_updated_at:', recent.map((c) => c.updated_at).join(', ') || '(none)');
  }

  // Was there ANY financial activity today / yesterday?
  for (const day of ['2026-09-23', '2026-09-22']) {
    const { data: txs, error: te } = await db
      .from('transactions')
      .select('id, type, amount, created_at')
      .eq('tenant_id', SANCHEZ)
      .gte('created_at', `${day}T00:00:00`)
      .lt('created_at', `${day}T23:59:59`)
      .order('created_at', { ascending: false })
      .limit(10);
    if (te) console.log(`TX ${day}: ERROR ${te.message}`);
    else console.log(`TX ${day}: count_shown=${txs?.length ?? 0} sum=${(txs ?? []).reduce((s, t) => s + (t.amount ?? 0), 0)}`);
  }

  // Any subscription ever canceled recently?
  const { data: recentSubs } = await db
    .from('customer_subscriptions')
    .select('status, created_at, updated_at, canceled_at')
    .eq('tenant_id', SANCHEZ)
    .order('updated_at', { ascending: false })
    .limit(5);
  console.log('SUBS most_recent:', JSON.stringify(recentSubs ?? []));
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
