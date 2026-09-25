// H-7 cycle observer — read-only snapshot of HOMOLOG H7 client records.
// Run before/after each cycle step; prints compact JSON + saves evidence file.
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const PROD_URL = 'https://ushsnmlbeurfvlkieiln.supabase.co';
const SANCHEZ = 'b716e290-f7f6-4449-b790-5ae9dcdadcab';
const LABEL = process.argv[2] ?? 'observation';

const raw = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf-8');
let key = '';
for (const line of raw.split(/\r?\n/)) {
  const t = line.trim();
  if (t.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) { key = t.slice(t.indexOf('=') + 1).trim().replace(/^"(.*)"$/, '$1'); break; }
}
if (!key) { console.error('no service key'); process.exit(1); }
const db = createClient(PROD_URL, key, { auth: { autoRefreshToken: false, persistSession: false } });

function fail(step, error) {
  console.error(`❌ ${step}: ${error.message}`);
  process.exit(1);
}

async function main() {
  const timestamp = new Date().toISOString();
  console.log(`\n=== H-7 OBSERVE [${LABEL}] ${timestamp} ===`);

  const { data: clients, error: ce } = await db
    .from('clients')
    .select('id, name, status, created_at')
    .eq('tenant_id', SANCHEZ)
    .ilike('name', '%HOMOLOG H7%');
  if (ce) fail('clients', ce);
  console.log('CLIENTS:', JSON.stringify(clients ?? []));
  if (!clients?.length) { console.log('No HOMOLOG H7 client found.'); return; }

  const out = { timestamp, label: LABEL, clients };

  for (const c of clients) {
    const { data: appts, error: ae } = await db
      .from('appointments')
      .select('id, status, start_time, date, time, notes, created_at, attended_at, cancellation_reason')
      .eq('tenant_id', SANCHEZ)
      .eq('client_id', c.id)
      .order('created_at', { ascending: false })
      .limit(10);
    if (ae) fail('appointments', ae);
    out[`appointments_${c.id}`] = appts;
    console.log(`APPOINTMENTS[${c.name}]: ${appts?.length ?? 0}`);
    for (const a of appts ?? []) {
      console.log(`  - created=${a.created_at} start_time=${a.start_time ?? a.date ?? '-'} status=${a.status} obs=${a.notes ?? ''}`);
    }

    const { data: comandas, error: me } = await db
      .from('comandas')
      .select('id, status, total, discount, payment_method, created_at, closed_at, cancelled_at')
      .eq('tenant_id', SANCHEZ)
      .eq('client_id', c.id)
      .order('created_at', { ascending: false })
      .limit(10);
    if (me) fail('comandas', me);
    out[`comandas_${c.id}`] = comandas;
    console.log(`COMANDAS[${c.name}]: ${comandas?.length ?? 0}`);
    for (const m of comandas ?? []) {
      console.log(`  - ${m.created_at} ${m.status} total=${m.total} pay=${m.payment_method ?? '-'} closed=${m.closed_at ?? '-'}`);
    }
  }

  // Day-level activity (context, not client-scoped)
  const today = '2026-09-25';
  const { data: dayAppts, error: dae } = await db
    .from('appointments')
    .select('id, client_id, status, start_time, date, created_at')
    .eq('tenant_id', SANCHEZ)
    .gte('created_at', `${today}T00:00:00`)
    .order('created_at', { ascending: true })
    .limit(50);
  if (dae) fail('day appointments', dae);
  out.dayAppointments = dayAppts;
  console.log(`APPOINTMENTS today (all clients): ${dayAppts?.length ?? 0}`);

  const { data: dayTx, error: dte } = await db
    .from('transactions')
    .select('id, type, amount, created_at, notes')
    .eq('tenant_id', SANCHEZ)
    .gte('created_at', `${today}T00:00:00`)
    .order('created_at', { ascending: true });
  if (dte) fail('day transactions', dte);
  out.dayTransactions = dayTx;
  console.log(`TRANSACTIONS today: ${dayTx?.length ?? 0}`);

  const dir = path.resolve(process.cwd(), 'docs/audit/h7-execution');
  fs.mkdirSync(dir, { recursive: true });
  const file = `h7-observe-${LABEL.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}.json`;
  fs.writeFileSync(path.join(dir, file), JSON.stringify(out, null, 2));
  console.log(`✅ saved: docs/audit/h7-execution/${file}`);
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
