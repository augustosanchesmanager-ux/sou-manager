// Discover real column names for customer_credits / customer_subscriptions (read-only).
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

const { data, error } = await db.from('customer_credits').select('*').eq('tenant_id', SANCHEZ).limit(2);
if (error) console.log('CREDITS_ERR:', error.message);
else {
  console.log('CREDITS rows:', data?.length ?? 0);
  console.log('CREDITS columns:', data && data[0] ? Object.keys(data[0]).join(', ') : '(no rows)');
  for (const r of data ?? []) {
    const pick = {};
    for (const k of Object.keys(r)) {
      if (/credit|balance|used|available/i.test(k)) pick[k] = r[k];
    }
    console.log('CREDITS sample_agg:', JSON.stringify(pick));
  }
}

const { data: subs, error: se } = await db.from('customer_subscriptions').select('*').eq('tenant_id', SANCHEZ).eq('status', 'active').limit(1);
if (se) console.log('SUBS_ERR:', se.message);
else console.log('SUBS columns:', subs && subs[0] ? Object.keys(subs[0]).join(', ') : '(no rows)');
