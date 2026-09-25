// H-7 Q1-Q4 deep check for today's cycle comanda — read-only.
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
function fail(s, e) { console.error(`❌ ${s}: ${e.message}`); process.exit(1); }

async function main() {
  const timestamp = new Date().toISOString();
  console.log(`=== H-7 Q-CHECK ${timestamp} ===`);

  // Today's cycle comanda (paid)
  const { data: comandas, error: ce } = await db
    .from('comandas')
    .select('*')
    .eq('tenant_id', SANCHEZ)
    .eq('status', 'paid')
    .eq('client_id', 'edbe83f1-44ee-4c77-b96f-7b5a4103464a')
    .gte('created_at', '2026-09-25T00:00:00')
    .order('created_at', { ascending: false });
  if (ce) fail('comandas', ce);
  console.log('COMANDAS today paid:', comandas?.length ?? 0);
  const comanda = comandas?.[0];
  if (!comanda) { console.log('no comanda yet'); return; }
  console.log('COMANDA:', JSON.stringify({
    id: comanda.id, client_id: comanda.client_id, staff_id: comanda.staff_id,
    total: comanda.total, subtotal: comanda.subtotal, discount: comanda.discount,
    payment_method: comanda.payment_method, financial_effect: comanda.financial_effect,
    closed_at: comanda.closed_at, appointment_id: comanda.appointment_id,
    chef_club_savings_total: comanda.chef_club_savings_total,
    membership_credit_effect: comanda.membership_credit_effect,
  }));

  // Items
  const { data: items, error: ie } = await db
    .from('comanda_items')
    .select('*')
    .eq('comanda_id', comanda.id);
  if (ie) console.log('ITEMS_ERR:', ie.message);
  else {
    console.log('ITEMS:', items?.length ?? 0);
    for (const it of items ?? []) console.log('  -', JSON.stringify(it));
  }

  // Participants
  const { data: parts, error: pe } = await db
    .from('service_execution_participants')
    .select('*')
    .eq('comanda_id', comanda.id);
  if (pe) console.log('PARTICIPANTS_ERR:', pe.message);
  else {
    console.log('PARTICIPANTS:', parts?.length ?? 0);
    for (const p of parts ?? []) console.log('  -', JSON.stringify(p));
  }

  // Transactions today
  const { data: txs, error: te } = await db
    .from('transactions')
    .select('*')
    .eq('tenant_id', SANCHEZ)
    .gte('created_at', '2026-09-25T00:00:00')
    .order('created_at', { ascending: true });
  if (te) fail('transactions', te);
  console.log('TRANSACTIONS today:', txs?.length ?? 0);
  for (const t of txs ?? []) {
    console.log('  -', JSON.stringify({
      id: t.id, type: t.type, amount: t.amount, payment_method: t.payment_method ?? t.method,
      source_type: t.source_type, source_id: t.source_id, notes: t.notes, created_at: t.created_at,
    }));
  }

  // Commission records for this comanda
  const { data: comms, error: cmerr } = await db
    .from('commission_records')
    .select('*')
    .eq('tenant_id', SANCHEZ)
    .eq('comanda_id', comanda.id);
  if (cmerr) console.log('COMMISSIONS_ERR:', cmerr.message);
  else {
    console.log('COMMISSION_RECORDS:', comms?.length ?? 0);
    for (const c of comms ?? []) console.log('  -', JSON.stringify(c));
  }

  // Expected quadrature print
  const txIncome = (txs ?? []).filter((t) => t.type === 'income').reduce((s, t) => s + (t.amount ?? 0), 0);
  const txExpense = (txs ?? []).filter((t) => t.type === 'expense').reduce((s, t) => s + (t.amount ?? 0), 0);
  console.log('Q1 comanda.total =', comanda.total, '| Q2 income_sum =', txIncome, '| expense_sum =', txExpense, '| net =', txIncome - txExpense);

  const dir = path.resolve(process.cwd(), 'docs/audit/h7-execution');
  fs.writeFileSync(path.join(dir, `h7-qcheck-pagamento-${Date.now()}.json`), JSON.stringify({
    timestamp, comanda, items, participants: parts, transactions: txs, commissions: comms,
    sums: { comandaTotal: comanda.total, txIncome, txExpense, net: txIncome - txExpense },
  }, null, 2));
  console.log('✅ qcheck saved');
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
