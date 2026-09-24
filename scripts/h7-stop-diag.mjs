// H-7 stop-diagnostic: did the failed "Fechar Caixa do Barbeiro" leave partial state?
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const PROD_URL = 'https://ushsnmlbeurfvlkieiln.supabase.co';
const SANCHEZ = 'b716e290-f7f6-4449-b790-5ae9dcdadcab';
const raw = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf-8');
let key = '';
for (const line of raw.split(/\r?\n/)) {
  const t = line.trim();
  if (t.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) { key = t.slice(t.indexOf('=') + 1).trim().replace(/^"(.*)"$/, '$1'); break; }
}
const db = createClient(PROD_URL, key, { auth: { autoRefreshToken: false, persistSession: false } });

async function main() {
  const ts = new Date().toISOString();
  console.log(`=== H-7 STOP-DIAG ${ts} ===`);

  for (const table of ['barber_closings', 'cash_closings']) {
    const { data, error } = await db.from(table).select('*').eq('tenant_id', SANCHEZ).order('created_at', { ascending: false }).limit(5);
    if (error) console.log(`${table}: ERR ${error.message}`);
    else {
      console.log(`${table}: ${data?.length ?? 0} recent`);
      for (const r of data ?? []) {
        const pick = {};
        for (const k of ['id', 'status', 'total', 'expected_total', 'difference', 'created_at', 'closed_at', 'professional_id', 'staff_id', 'period_start', 'period_end']) {
          if (k in r) pick[k] = r[k];
        }
        console.log('  -', JSON.stringify(pick));
      }
    }
  }

  // transactions today still just the 1 income?
  const { data: txs } = await db.from('transactions').select('id, type, amount, created_at').eq('tenant_id', SANCHEZ).gte('created_at', '2026-09-23T00:00:00');
  console.log('TX today:', JSON.stringify(txs ?? []));

  // commission records today
  const { data: comms } = await db.from('commission_records').select('id, staff_id, commission_value, status, created_at').eq('tenant_id', SANCHEZ).gte('created_at', '2026-09-23T00:00:00');
  console.log('COMMISSIONS today:', JSON.stringify(comms ?? []));

  // outbox recent (did any event fail enqueue?)
  const { data: outbox, error: oe } = await db.from('outbox_items').select('id, event_type, status, attempts, last_error, created_at').order('created_at', { ascending: false }).limit(5);
  if (oe) console.log('OUTBOX_ERR:', oe.message);
  else console.log('OUTBOX recent:', JSON.stringify(outbox ?? []));
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
