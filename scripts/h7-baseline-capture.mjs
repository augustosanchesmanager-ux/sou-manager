import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load .env.local
function loadEnvLocal() {
  const filePath = path.resolve(process.cwd(), '.env.local');
  const raw = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^"(.*)"$/, '$1');
    if (key) env[key] = value;
  }
  return env;
}

const env = loadEnvLocal();
// Use PRODUCTION Supabase (Sanchez Barber is in ushsnmlbeurfvlkieiln)
const url = 'https://ushsnmlbeurfvlkieiln.supabase.co';
const serviceRole = process.env.H7_PROD_SERVICE_ROLE_KEY;

if (!url || !serviceRole) {
  console.error('❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const admin = createClient(url, serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SANCHEZ_TENANT_ID = 'b716e290-f7f6-4449-b790-5ae9dcdadcab';

async function captureBaseline(label) {
  const timestamp = new Date().toISOString();
  console.log(`\n=== ${label} (${timestamp}) ===`);

  const results = {};

  // B1: Tenant status
  const { data: tenant } = await admin.from('tenants').select('id, name, slug, plan, status, created_at').eq('id', SANCHEZ_TENANT_ID).single();
  results.tenant = tenant;
  console.log('B1 Tenant:', JSON.stringify(tenant, null, 2));

  // B2: Staff count and roles
  const { data: staff } = await admin.from('staff').select('id, name, email, role, status, commission_rate').eq('tenant_id', SANCHEZ_TENANT_ID).eq('status', 'active');
  results.staff = staff;
  console.log('B2 Staff count:', staff?.length, '| roles:', staff?.map(s => s.role).join(', '));

  // B3: Clients count
  const { data: clients } = await admin.from('clients').select('id', { count: 'exact' }).eq('tenant_id', SANCHEZ_TENANT_ID).eq('status', 'active');
  results.clientsCount = clients?.length ?? 0;
  console.log('B3 Active clients:', results.clientsCount);

  // B4: Services count
  const { data: services } = await admin.from('services').select('id', { count: 'exact' }).eq('tenant_id', SANCHEZ_TENANT_ID).eq('active', true);
  results.servicesCount = services?.length ?? 0;
  console.log('B4 Active services:', results.servicesCount);

  // B5: Appointments (today + pending)
  const today = new Date().toISOString().split('T')[0];
  const { data: appointments } = await admin.from('appointments')
    .select('id, status, starts_at, professional_id')
    .eq('tenant_id', SANCHEZ_TENANT_ID)
    .gte('starts_at', `${today}T00:00:00`)
    .lte('starts_at', `${today}T23:59:59`);
  results.appointmentsToday = appointments?.length ?? 0;
  console.log('B5 Appointments today:', results.appointmentsToday);

  // B6: Comandas abertas
  const { data: openComandas } = await admin.from('comandas')
    .select('id, client_id, professional_id, status, total, created_at')
    .eq('tenant_id', SANCHEZ_TENANT_ID)
    .eq('status', 'open');
  results.openComandas = openComandas?.length ?? 0;
  console.log('B6 Open comandas:', results.openComandas);

  // B7: Comandas pagas (hoje)
  const { data: paidComandas } = await admin.from('comandas')
    .select('id, total, professional_id, payment_method, membership_credit_effect, created_at')
    .eq('tenant_id', SANCHEZ_TENANT_ID)
    .eq('status', 'paid')
    .gte('created_at', `${today}T00:00:00`);
  results.paidComandasToday = paidComandas?.length ?? 0;
  results.paidComandasTotal = paidComandas?.reduce((sum, c) => sum + (c.total || 0), 0) ?? 0;
  console.log('B7 Paid comandas today:', results.paidComandasToday, '| Total R$:', results.paidComandasTotal);

  // B8: Cash closings (today)
  const { data: cashClosings } = await admin.from('cash_closings')
    .select('id, total_cash, total_card, total_pix, total_other, expected_total, difference, status, closed_at')
    .eq('tenant_id', SANCHEZ_TENANT_ID)
    .gte('closed_at', `${today}T00:00:00`);
  results.cashClosingsToday = cashClosings?.length ?? 0;
  console.log('B8 Cash closings today:', results.cashClosingsToday);

  // B9: Commission lines (today)
  const { data: commissions } = await admin.from('commission_lines')
    .select('id, professional_id, service_value, commission_value, commission_rate, comanda_id, created_at')
    .eq('tenant_id', SANCHEZ_TENANT_ID)
    .gte('created_at', `${today}T00:00:00`);
  results.commissionsToday = commissions?.length ?? 0;
  results.commissionsTotal = commissions?.reduce((sum, c) => sum + (c.commission_value || 0), 0) ?? 0;
  console.log('B9 Commission lines today:', results.commissionsToday, '| Total R$:', results.commissionsTotal);

  // B10: Receivables (Club dos Chefes)
  const { data: receivables } = await admin.from('customer_subscription_receivables')
    .select('id, amount, status, due_date, paid_at, subscription_id')
    .eq('tenant_id', SANCHEZ_TENANT_ID);
  results.receivables = receivables?.length ?? 0;
  results.receivablesPending = receivables?.filter(r => r.status === 'pending').length ?? 0;
  results.receivablesPaid = receivables?.filter(r => r.status === 'paid').length ?? 0;
  console.log('B10 Receivables:', results.receivables, '| pending:', results.receivablesPending, '| paid:', results.receivablesPaid);

  // B11: Customer subscriptions (active)
  const { data: subscriptions, error: subsErr } = await admin.from('customer_subscriptions')
    .select('id, client_id, plan_id, status, cycle_start, cycle_end, next_billing_date')
    .eq('tenant_id', SANCHEZ_TENANT_ID)
    .eq('status', 'active');
  if (subsErr) {
    results.activeSubscriptionsError = subsErr.message;
    console.error('❌ B11 subscriptions query FAILED:', subsErr.message);
    process.exitCode = 1;
  }
  results.activeSubscriptions = subscriptions?.length ?? 0;
  console.log('B11 Active subscriptions:', results.activeSubscriptions);

  // B12: Customer credits (available) — real columns: available_credits / used_credits
  const { data: credits, error: creditsErr } = await admin.from('customer_credits')
    .select('id, client_id, available_credits, used_credits')
    .eq('tenant_id', SANCHEZ_TENANT_ID);
  if (creditsErr) {
    results.creditsError = creditsErr.message;
    console.error('❌ B12 credits query FAILED:', creditsErr.message);
    process.exitCode = 1;
  }
  results.credits = credits?.length ?? 0;
  results.creditsAvailableSum = credits?.reduce((sum, c) => sum + (c.available_credits || 0), 0) ?? 0;
  results.creditsUsedSum = credits?.reduce((sum, c) => sum + (c.used_credits || 0), 0) ?? 0;
  console.log('B12 Credit records:', results.credits, '| available_sum:', results.creditsAvailableSum, '| used_sum:', results.creditsUsedSum);

  // Save to file
  const outputDir = path.resolve(process.cwd(), 'docs/audit/h7-execution');
  fs.mkdirSync(outputDir, { recursive: true });
  const fileName = `h7-baseline-${label.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.json`;
  fs.writeFileSync(path.join(outputDir, fileName), JSON.stringify({ timestamp, label, tenantId: SANCHEZ_TENANT_ID, data: results }, null, 2));
  console.log(`\n✅ Baseline salvo: docs/audit/h7-execution/${fileName}`);

  return results;
}

async function main() {
  console.log('🔍 H-7 BASELINE CAPTURE — Sanchez Barber (tenant:', SANCHEZ_TENANT_ID, ')');
  await captureBaseline('PRE-EXECUTION');
}

main().catch(err => {
  console.error('❌ Erro:', err);
  process.exit(1);
});