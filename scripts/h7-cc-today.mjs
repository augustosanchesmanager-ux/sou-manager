// Inspect today's cash_closing draft + events (read-only).
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
  const { data: cc, error: e1 } = await db.from('cash_closings').select('*').eq('tenant_id', SANCHEZ).eq('business_date', '2026-09-23').maybeSingle();
  if (e1) console.log('CC_ERR:', e1.message);
  else console.log('CASH_CLOSING today:', JSON.stringify(cc, null, 2));

  const { data: ev, error: e2 } = await db.from('cash_closing_events').select('*').eq('tenant_id', SANCHEZ).order('event_time', { ascending: false }).limit(10);
  if (e2) console.log('EVENTS_ERR:', e2.message);
  else {
    console.log('EVENTS recent:', ev?.length ?? 0);
    for (const e of ev ?? []) console.log('  -', e.event_time, e.event_type, '|', e.label, '|', e.detail ?? '');
  }
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });

