// Probe real columns: appointments, comandas, transactions (read-only).
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

for (const table of ['appointments', 'comandas', 'transactions']) {
  const { data, error } = await db.from(table).select('*').eq('tenant_id', SANCHEZ).limit(1);
  if (error) console.log(`${table}: ERROR ${error.message}`);
  else console.log(`${table}: ${data && data[0] ? Object.keys(data[0]).join(', ') : '(no rows)'}`);
}
