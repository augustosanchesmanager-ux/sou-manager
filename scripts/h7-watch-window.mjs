// H-7 window activity watcher — READ-ONLY polling of today's activity (Sanchez Barber PROD).
// Exits early when any operation activity is detected; otherwise after MAX_POLLS.
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const PROD_URL = 'https://ushsnmlbeurfvlkieiln.supabase.co';
const SANCHEZ = 'b716e290-f7f6-4449-b790-5ae9dcdadcab';
const MAX_POLLS = 18; // × 30s = 9 min max
const INTERVAL_MS = 30_000;

const raw = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf-8');
let key = '';
for (const line of raw.split(/\r?\n/)) {
  const t = line.trim();
  if (t.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) { key = t.slice(t.indexOf('=') + 1).trim().replace(/^"(.*)"$/, '$1'); break; }
}
if (!key) { console.error('no service key'); process.exit(1); }
const db = createClient(PROD_URL, key, { auth: { autoRefreshToken: false, persistSession: false } });

const today = new Date().toISOString().slice(0, 10);
const since = today + 'T00:00:00';

async function snapshot() {
  const [appts, comandas, cash, tx, barber] = await Promise.all([
    db.from('appointments').select('id, status, created_at, start_time').eq('tenant_id', SANCHEZ).gte('created_at', since).limit(20),
    db.from('comandas').select('id, status, total, payment_method, created_at, closed_at').eq('tenant_id', SANCHEZ).gte('created_at', since).limit(20),
    db.from('cash_closings').select('id, status, created_at').eq('tenant_id', SANCHEZ).gte('created_at', since).limit(20),
    db.from('transactions').select('id, type, amount, source_id, payment_method, created_at').eq('tenant_id', SANCHEZ).gte('created_at', since).limit(20),
    db.from('barber_closings').select('id, status, expected_cash, counted_cash, cash_difference, payment_methods, created_at').eq('tenant_id', SANCHEZ).gte('created_at', since).limit(20),
  ]);
  for (const [name, r] of Object.entries({ appts, comandas, cash, tx, barber })) {
    if (r.error) { console.error(`ERR ${name}: ${r.error.message}`); process.exit(2); }
  }
  return {
    appointments: appts.data ?? [],
    comandas: comandas.data ?? [],
    cash_closings: cash.data ?? [],
    transactions: tx.data ?? [],
    barber_closings: barber.data ?? [],
  };
}

async function main() {
  console.log(`H7 WATCHER start (${new Date().toISOString()}) — today=${today}`);
  for (let i = 1; i <= MAX_POLLS; i++) {
    const s = await snapshot();
    const activity = s.appointments.length + s.comandas.length + s.cash_closings.length + s.transactions.length + s.barber_closings.length;
    console.log(`[poll ${i}/${MAX_POLLS} ${new Date().toISOString().slice(11, 19)}] appts=${s.appointments.length} comandas=${s.comandas.length} cash=${s.cash_closings.length} tx=${s.transactions.length} barber_close=${s.barber_closings.length}`);
    if (activity > 0) {
      console.log('=== ACTIVITY DETECTED ===');
      console.log(JSON.stringify(s, null, 2));
      return;
    }
    if (i < MAX_POLLS) await new Promise(r => setTimeout(r, INTERVAL_MS));
  }
  console.log('NO_ACTIVITY after max polls — window idle (Rubens ainda não iniciou ou sem registros hoje).');
}
main().catch(e => { console.error('watcher error:', e.message); process.exit(1); });
