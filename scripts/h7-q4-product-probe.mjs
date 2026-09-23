// H-7 Q4 probe: does the system ever create commission records for PRODUCT items?
// Read-only, production. Also identifies staff 1021f3d1 and today's participants linkage.
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const PROD_URL = 'https://ushsnmlbeurfvlkieiln.supabase.co';
const SANCHEZ = 'b716e290-f7f6-4449-b790-5ae9dcdadcab';
const PRODUCT_STAFF = '1021f3d1-c7c2-4c55-a490-91bb05e41e46';
const SERVICE_STAFF = '62ddf002-5c05-49fa-8ff3-6d67fa82c562';
const TODAY_COMANDA = 'b5368c28-263d-438f-9eb7-1dc965410243';
const TODAY_APPOINTMENT = '37268635-3b18-4deb-80d3-7044af1937ae';

const raw = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf-8');
let key = '';
for (const line of raw.split(/\r?\n/)) {
  const t = line.trim();
  if (t.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) { key = t.slice(t.indexOf('=') + 1).trim().replace(/^"(.*)"$/, '$1'); break; }
}
const db = createClient(PROD_URL, key, { auth: { autoRefreshToken: false, persistSession: false } });

async function main() {
  // 1) staff identities
  const { data: staff, error: se } = await db.from('staff').select('id, name, role, commission_rate, status').eq('tenant_id', SANCHEZ).in('id', [PRODUCT_STAFF, SERVICE_STAFF]);
  if (se) console.log('STAFF_ERR:', se.message);
  else console.log('STAFF:', JSON.stringify(staff ?? []));

  // 2) participants table columns
  const { data: p0, error: p0e } = await db.from('service_execution_participants').select('*').eq('tenant_id', SANCHEZ).limit(1);
  if (p0e) console.log('PARTICIPANTS_ERR:', p0e.message);
  else console.log('PARTICIPANTS columns:', p0 && p0[0] ? Object.keys(p0[0]).join(', ') : '(no rows)');

  // participants linked to today's appointment (column guess handled by real columns)
  if (p0 && p0[0]) {
    const cols = Object.keys(p0[0]);
    const linkCol = cols.includes('appointment_id') ? 'appointment_id' : (cols.includes('comanda_id') ? 'comanda_id' : null);
    if (linkCol) {
      const { data: tp, error: tpe } = await db.from('service_execution_participants').select('*').eq(linkCol, TODAY_APPOINTMENT);
      if (tpe) console.log('TODAY_PART_ERR:', tpe.message);
      else {
        console.log(`TODAY_PARTICIPANTS (by ${linkCol}):`, tp?.length ?? 0);
        for (const p of tp ?? []) console.log('  -', JSON.stringify(p));
      }
    } else console.log('no link column found');
  }

  // 3) Historical: sample recent commission records → their items → any product?
  const { data: comms, error: ce } = await db
    .from('commission_records')
    .select('id, comanda_item_id, staff_id, gross_value, commission_value, created_at')
    .eq('tenant_id', SANCHEZ)
    .eq('record_type', 'commission')
    .order('created_at', { ascending: false })
    .limit(60);
  if (ce) console.log('COMMS_ERR:', ce.message);
  else {
    const itemIds = [...new Set((comms ?? []).map((c) => c.comanda_item_id).filter(Boolean))];
    const { data: items, error: ie } = await db.from('comanda_items').select('id, product_name, product_id, service_id, unit_price').in('id', itemIds);
    if (ie) console.log('ITEMS_ERR:', ie.message);
    else {
      const byId = Object.fromEntries((items ?? []).map((i) => [i.id, i]));
      let productBacked = 0, serviceBacked = 0, missing = 0;
      const productSamples = [];
      for (const c of comms ?? []) {
        const it = byId[c.comanda_item_id];
        if (!it) { missing++; continue; }
        if (it.product_id && !it.service_id) { productBacked++; if (productSamples.length < 5) productSamples.push({ comm: c.id, item: it.product_name, gross: c.gross_value, comm_val: c.commission_value }); }
        else if (it.service_id) serviceBacked++;
      }
      console.log(`COMMISSION sample(60): service_items=${serviceBacked} product_items=${productBacked} missing_join=${missing}`);
      if (productSamples.length) console.log('PRODUCT commission samples:', JSON.stringify(productSamples));
      else console.log('PRODUCT commission samples: NONE in last 60 — products historically generate NO commission records');
    }
  }

  // 4) Does staff 1021f3d1 have any historical commission records?
  const { data: ps, error: pse } = await db
    .from('commission_records')
    .select('id, comanda_id, gross_value, commission_value, created_at')
    .eq('tenant_id', SANCHEZ)
    .eq('staff_id', PRODUCT_STAFF)
    .limit(5);
  if (pse) console.log('PRODUCT_STAFF_COMMS_ERR:', pse.message);
  else console.log('PRODUCT_STAFF historical commissions:', ps?.length ?? 0, JSON.stringify(ps ?? []));
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
