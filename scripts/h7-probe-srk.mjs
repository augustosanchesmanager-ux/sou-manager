// Probe which SUPABASE_SERVICE_ROLE_KEY candidate authenticates against PRODUCTION.
// Prints only index + ok/err — never key material.
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const PROD_URL = 'https://ushsnmlbeurfvlkieiln.supabase.co';
const SANCHEZ = 'b716e290-f7f6-4449-b790-5ae9dcdadcab';

const raw = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf-8');
const keys = [];
for (const line of raw.split(/\r?\n/)) {
  const t = line.trim();
  if (t.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
    const v = t.slice(t.indexOf('=') + 1).trim().replace(/^"(.*)"$/, '$1');
    if (v) keys.push(v);
  }
}
console.log('candidates:', keys.length);

for (let i = 0; i < keys.length; i++) {
  try {
    const client = createClient(PROD_URL, keys[i], {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await client
      .from('tenants')
      .select('id, plan')
      .eq('id', SANCHEZ)
      .limit(1)
      .maybeSingle();
    if (error) {
      console.log(`candidate[${i}]: FAIL code=${error.code ?? '?'} msg=${error.message?.slice(0, 80)}`);
    } else {
      console.log(`candidate[${i}]: OK plan=${data?.plan ?? '?'}`);
    }
  } catch (e) {
    console.log(`candidate[${i}]: THROW ${String(e).slice(0, 100)}`);
  }
}
