// H-7 P1 evidence: snapshot before/after "Fechar Caixa do Barbeiro" click.
// Read-only. Run: node scripts/h7-p1-barber-close-snap.mjs
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.H7_PROD_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('missing env'); process.exit(1); }

const db = createClient(url, key);
const TENANT = 'b716e290-f7f6-4449-b790-5ae9dcdadcab';
const today = new Date().toISOString().slice(0, 10);

const out = { capturedAt: new Date().toISOString(), businessDate: today };

async function q(label, query) {
  const { data, error, count } = await query;
  if (error) { out[label] = { error: error.message }; return; }
  out[label] = { count: count ?? (data?.length ?? null), rows: data };
}

await q('barberClosingsToday', db.from('barber_closings')
  .select('*')
  .eq('tenant_id', TENANT).eq('business_date', today).order('created_at'));

await q('cashClosingEventsToday', db.from('cash_closing_events')
  .select('*')
  .eq('tenant_id', TENANT).eq('business_date', today).order('created_at'));

await q('cashClosingsToday', db.from('cash_closings')
  .select('*')
  .eq('tenant_id', TENANT).eq('business_date', today).order('created_at'));

await q('txToday', db.from('transactions')
  .select('*')
  .eq('tenant_id', TENANT)
  .gte('created_at', today + 'T00:00:00Z').order('created_at'));

await q('commissionsToday', db.from('commission_records')
  .select('*')
  .eq('tenant_id', TENANT)
  .gte('created_at', today + 'T00:00:00Z').order('created_at'));

console.log(JSON.stringify(out, null, 2));
