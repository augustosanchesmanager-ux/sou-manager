/**
 * Production Smoke Test — Trilha B (F1+F2)
 *
 * Validates the staff attribution fix on barber.soumanager.com using an
 * ephemeral tenant. FK-aware teardown ensures no real data is affected.
 *
 * Usage:
 *   node tests/e2e/validation/production-smoke.mjs
 */

import { chromium } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../..');

// --- Config ---
const BASE_URL = 'https://barber.soumanager.com';
const PASSWORD = 'Smoke-Test-2026!';
const DISPATCH_WAIT_MS = 15_000;
const VERCEL_BYPASS_SECRET = process.env.VERCEL_AUTOMATION_BYPASS_SECRET || '';

// --- Load env.local ---
function loadEnvLocal() {
  const filePath = path.resolve(rootDir, '.env.local');
  const raw = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key) env[key] = value.replace(/^"(.*)"$/, '$1').replace(/^"(.*)"$/, '$1');
  }
  return env;
}

const env = loadEnvLocal();
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('FATAL: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required in .env.local');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const log = (cp, data) => console.log(`[SMOKE][${cp}] ${JSON.stringify(data)}`);

// --- Helpers ---
async function createConfirmedUser(email, userMetadata) {
  const { data, error } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true, user_metadata: userMetadata,
  });
  if (error) throw new Error(`createUser failed: ${error.message}`);
  return data.user.id;
}

async function deleteUser(email) {
  const res = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (res.error) return;
  const user = res.data.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) return;
  await admin.auth.admin.deleteUser(user.id);
}

// --- Main ---
const runId = Date.now();
const managerEmail = `smoke-trb-${runId}-mgr@gmail.com`;
const barberEmail = `smoke-trb-${runId}-bar@gmail.com`;
let tenantId = '';
let managerUserId = '';
let barberUserId = '';
let barberStaffId = '';
let clientId = '';
let serviceId = '';
let comandaId = '';

try {
  log('setup-start', { runId });

  // 1. Create auth users
  managerUserId = await createConfirmedUser(managerEmail, { first_name: 'SMOKE', last_name: 'Manager' });
  barberUserId = await createConfirmedUser(barberEmail, { first_name: 'AAA', last_name: 'SMOKE Barbeiro' });
  log('users-created', { managerUserId, barberUserId });

  // 2. Create tenant
  const { data: tenant, error: te } = await admin.from('tenants')
    .insert({ name: `Smoke TRB ${runId}`, slug: `smoke-trb-${runId}`, app_slug: 'barber', plan: 'pro', status: 'active' })
    .select('id').single();
  if (te || !tenant) throw new Error(`tenant insert: ${te?.message}`);
  tenantId = tenant.id;
  log('tenant-created', { tenantId });

  // 3. Profiles (triggers auto-create staff)
  const { error: pe } = await admin.from('profiles').insert([
    { id: managerUserId, tenant_id: tenantId, full_name: 'SMOKE Manager', role: 'manager', status: 'active', onboarding_completed: true },
    { id: barberUserId, tenant_id: tenantId, full_name: 'AAA SMOKE Barbeiro', role: 'barber', status: 'active', onboarding_completed: true },
  ]);
  if (pe) throw new Error(`profiles: ${pe.message}`);

  // 4. Clear trigger-created rows
  await admin.from('staff').delete().eq('tenant_id', tenantId);
  await admin.from('user_tenants').delete().eq('tenant_id', tenantId);

  // 5. Memberships
  const { error: me } = await admin.from('user_tenants').insert([
    { user_id: managerUserId, tenant_id: tenantId, role: 'manager', is_primary: true },
    { user_id: barberUserId, tenant_id: tenantId, role: 'barber', is_primary: false },
  ]);
  if (me) throw new Error(`user_tenants: ${me.message}`);

  // 6. Staff
  const { data: staffRows, error: se } = await admin.from('staff').insert([
    { id: managerUserId, name: 'ZZZ SMOKE Manager', email: managerEmail, phone: '', role: 'manager', avatar: '', commission_rate: 0, status: 'active', tenant_id: tenantId },
    { id: barberUserId, name: 'AAA SMOKE Barbeiro', email: barberEmail, phone: '', role: 'barber', avatar: '', commission_rate: 40, status: 'active', tenant_id: tenantId },
  ]).select('id, name');
  if (se || !staffRows) throw new Error(`staff: ${se?.message}`);
  barberStaffId = staffRows.find(s => s.name === 'AAA SMOKE Barbeiro').id;

  // 7. Settings
  await admin.from('tenant_settings').upsert({ tenant_id: tenantId, chair_count: 1 }, { onConflict: 'tenant_id' });

  // 8. Client
  const { data: clientRow, error: ce } = await admin.from('clients')
    .insert({ tenant_id: tenantId, name: 'Smoke Cliente', phone: '11000009999', email: `smoke-${runId}@val.com`, status: 'active' })
    .select('id').single();
  if (ce || !clientRow) throw new Error(`clients: ${ce?.message}`);
  clientId = clientRow.id;

  // 9. Service
  const { data: serviceRow, error: sve } = await admin.from('services')
    .insert({ tenant_id: tenantId, name: 'Smoke Corte', category: 'Smoke', price: 80, duration: 30, active: true })
    .select('id').single();
  if (sve || !serviceRow) throw new Error(`services: ${sve?.message}`);
  serviceId = serviceRow.id;

  log('seed-complete', { tenantId, barberStaffId, clientId, serviceId });

  // --- UI Flow ---
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();

  // Vercel bypass header
  if (VERCEL_BYPASS_SECRET) {
    await ctx.route(`${BASE_URL}/**`, async route => {
      await route.continue({
        headers: { ...route.request().headers(), 'x-vercel-protection-bypass': VERCEL_BYPASS_SECRET },
      });
    });
  }

  const page = await ctx.newPage();

  // Capture ALL console logs for debugging
  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push({ type: msg.type(), text });
    // Also log filtered ones in real-time
    if (text.includes('FINANCE') || text.includes('OUTBOX') || text.includes('COMMISSION') || text.includes('DISPATCH') || text.includes('CHECKOUT') || text.includes('SUBSCRIBER') || text.includes('ERROR') || text.includes('error'))
      log('CONSOLE', { type: msg.type(), text });
  });

  // Login
  await page.goto(`${BASE_URL}/#/login`);
  await page.locator('input[type="email"]').fill(managerEmail);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/#\/dashboard/, { timeout: 40_000 });
  log('login', { ok: true });

  // Checkout
  await page.goto(`${BASE_URL}/#/checkout?mode=comanda`);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(2_000);

  // Select client
  const clientBtn = page.getByRole('button', { name: /Buscar/ }).first();
  await clientBtn.waitFor({ state: 'visible', timeout: 20_000 });
  await clientBtn.click();
  const clientSearch = page.locator('input[placeholder="Buscar cliente..."]');
  await clientSearch.waitFor({ state: 'visible', timeout: 15_000 });
  await clientSearch.fill('Smoke Cliente');
  await page.waitForTimeout(1_500);
  await page.getByText('Smoke Cliente', { exact: false }).first().click();
  await page.waitForTimeout(500);
  log('client-selected', { ok: true });

  // Add service (WITHOUT touching staff select = F2 validation)
  const addSvcBtn = page.getByRole('button', { name: /\+\s*Servi/ }).first();
  await addSvcBtn.waitFor({ state: 'visible', timeout: 30_000 });
  // F2: verify button is enabled (loading guard works)
  const svcBtnEnabled = await addSvcBtn.isEnabled();
  log('f2-button-enabled', { enabled: svcBtnEnabled });
  await addSvcBtn.click();

  const svcSearch = page.locator('input[placeholder*="Buscar"]').last();
  await svcSearch.waitFor({ state: 'visible', timeout: 15_000 });
  await svcSearch.fill('Smoke Corte');
  await page.waitForTimeout(1_500);
  await page.getByText('Smoke Corte', { exact: false }).first().click();
  await page.waitForTimeout(800);

  // F1: check default staff select
  const staffSelects = page.locator('select').filter({ has: page.locator('option', { hasText: 'Nenhum' }) });
  const defaultLabel = await staffSelects.first().locator('option[selected], option:checked').first().textContent().catch(() => null);
  log('f1-default-staff', { selectedLabel: defaultLabel });

  // Finish checkout
  const fecharAgora = page.getByRole('button', { name: /Fechar agora/ }).first();
  if (await fecharAgora.isVisible().catch(() => false)) await fecharAgora.click().catch(() => {});
  const dinheiro = page.getByRole('button', { name: /^Dinheiro$/ }).first();
  if (await dinheiro.isVisible().catch(() => false)) await dinheiro.click().catch(() => {});

  const finishBtn = page.getByRole('button', { name: /Confirmar e fechar|Concluir venda|Abrir e fechar agora/ }).first();
  await finishBtn.waitFor({ state: 'visible', timeout: 15_000 });
  await finishBtn.click();

  await page.waitForURL(u => !u.hash.includes('/checkout'), { timeout: 45_000 }).catch(async () => {
    await page.getByText(/sucesso|registrada|finalizada/i).first().waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
  });
  log('checkout-done', { url: page.url() });

  // Dump ALL console logs captured during checkout
  log('all-console-logs', consoleLogs.map(l => l.text).slice(-30));

  // --- DB Validation (must happen BEFORE commission polling) ---
  // Comanda
  const { data: comandas, error: ce2 } = await admin.from('comandas')
    .select('id, status, total, staff_id, payment_method')
    .eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(5);
  if (ce2) throw new Error(`comandas: ${ce2.message}`);
  if (!comandas?.length) throw new Error('NO COMANDA CREATED');
  const comanda = comandas[0];
  comandaId = comanda.id;

  // Keep browser open while polling for commission record.
  // InMemoryOutbox dispatch loop runs in the browser (setInterval 5s).
  // Browser MUST stay open for dispatch to fire.
  let commission = null;

  // Check immediately (dispatch may have already fired)
  {
    const { data: rows } = await admin.from('commission_records')
      .select('*').eq('tenant_id', tenantId).eq('comanda_id', comandaId).eq('record_type', 'commission');
    if (rows?.length === 1) commission = rows[0];
    log('commission-immediate', commission);
  }

  // Poll for up to 90s
  const commDeadline = Date.now() + 90_000;
  while (Date.now() < commDeadline && !commission) {
    await page.waitForTimeout(5_000);
    const { data: rows } = await admin.from('commission_records')
      .select('*').eq('tenant_id', tenantId).eq('comanda_id', comandaId).eq('record_type', 'commission');
    if (rows?.length === 1) {
      commission = rows[0];
      log('commission-found', { afterMs: Date.now() - (commDeadline - 90_000) });
    }
    // Also check outbox status
    const { data: outbox } = await admin.from('event_store')
      .select('event_type, payload').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(3);
    log('event-store-latest', outbox?.map(e => e.event_type));
  }
  log('commission-final', commission);

  await ctx.close();
  await browser.close();
  log('comanda', { id: comanda.id, status: comanda.status, total: comanda.total, staff_id: comanda.staff_id });

  // Items
  const { data: items, error: ie } = await admin.from('comanda_items')
    .select('id, staff_id, product_name, unit_price').eq('comanda_id', comandaId);
  if (ie) throw new Error(`items: ${ie.message}`);
  const item = items?.[0];
  log('item', { staff_id: item?.staff_id, name: item?.product_name });

  // Participants
  const { data: parts, error: pe2 } = await admin.from('service_execution_participants')
    .select('id, staff_id, role, payout_value, affects_commission').eq('comanda_item_id', item?.id);
  if (pe2) throw new Error(`participants: ${pe2.message}`);
  const participant = parts?.[0];
  log('participant', { staff_id: participant?.staff_id, role: participant?.role, payout: participant?.payout_value, affects: participant?.affects_commission });

  log('commission', commission);

  // --- Assertions ---
  const results = { PASS: [], FAIL: [] };
  const check = (name, ok, detail) => {
    if (ok) results.PASS.push(name);
    else results.FAIL.push({ name, detail });
  };

  check('comanda.status=paid', comanda.status === 'paid', comanda.status);
  check('comanda.total=80', comanda.total === 80, comanda.total);
  check('comanda.staff_id=barber', comanda.staff_id === barberStaffId, `${comanda.staff_id} != ${barberStaffId}`);
  check('item.staff_id=barber', item?.staff_id === barberStaffId, `${item?.staff_id} != ${barberStaffId}`);
  check('participant.staff_id=barber', participant?.staff_id === barberStaffId, participant?.staff_id);
  check('participant.role=primary', participant?.role === 'primary', participant?.role);
  check('participant.payout=100', Number(participant?.payout_value) === 100, participant?.payout_value);
  check('participant.affects=true', participant?.affects_commission === true, participant?.affects_commission);
  check('commission.staff_id=barber', commission?.staff_id === barberStaffId, commission?.staff_id);
  check('commission.value=32', Number(commission?.commission_value) === 32, commission?.commission_value);
  check('commission.rate=0.4', Number(commission?.commission_rate) === 0.4, commission?.commission_rate);
  check('f2-button-enabled', svcBtnEnabled === true, svcBtnEnabled);
  check('f1-default-staff=AAA', defaultLabel?.includes('AAA'), defaultLabel);

  log('RESULTS', results);

  // --- Teardown ---
  log('teardown-start', { tenantId });
  const tearSteps = [
    ['notifications', () => admin.from('notifications').delete().eq('tenant_id', tenantId)],
    ['commission_records', () => admin.from('commission_records').delete().eq('tenant_id', tenantId)],
    ['processed_operations', () => admin.from('processed_operations').delete().eq('tenant_id', tenantId)],
    ['event_store', () => admin.from('event_store').delete().eq('metadata->>tenantId', tenantId)],
    ['sep', async () => {
      const { data: cs } = await admin.from('comandas').select('id').eq('tenant_id', tenantId);
      const ids = (cs || []).map(c => c.id);
      if (!ids.length) return { error: null };
      const { data: is } = await admin.from('comanda_items').select('id').in('comanda_id', ids);
      const iids = (is || []).map(i => i.id);
      if (!iids.length) return { error: null };
      return admin.from('service_execution_participants').delete().in('comanda_item_id', iids);
    }],
    ['comanda_items', async () => {
      const { data: cs } = await admin.from('comandas').select('id').eq('tenant_id', tenantId);
      const ids = (cs || []).map(c => c.id);
      if (!ids.length) return { error: null };
      return admin.from('comanda_items').delete().in('comanda_id', ids);
    }],
    ['comandas', () => admin.from('comandas').delete().eq('tenant_id', tenantId)],
    ['transactions', () => admin.from('transactions').delete().eq('tenant_id', tenantId)],
    ['clients', () => admin.from('clients').delete().eq('tenant_id', tenantId)],
    ['services', () => admin.from('services').delete().eq('tenant_id', tenantId)],
    ['tenant_settings', () => admin.from('tenant_settings').delete().eq('tenant_id', tenantId)],
    ['staff', () => admin.from('staff').delete().eq('tenant_id', tenantId)],
    ['user_tenants', () => admin.from('user_tenants').delete().eq('tenant_id', tenantId)],
    ['profiles', () => admin.from('profiles').delete().eq('tenant_id', tenantId)],
    ['tenants', () => admin.from('tenants').delete().eq('id', tenantId)],
  ];
  for (const [name, fn] of tearSteps) {
    const res = await fn();
    if (res?.error) log('teardown-warn', { step: name, error: res.error.message });
  }
  await deleteUser(managerEmail);
  await deleteUser(barberEmail);
  log('teardown-done', {});

  // Final report
  console.log('\n========================================');
  console.log('SMOKE PRODUCAO — FINAL REPORT');
  console.log('========================================');
  console.log(`Tenant efemero: ${tenantId}`);
  console.log(`Manager user:   ${managerEmail}`);
  console.log(`Barber user:    ${barberEmail}`);
  console.log(`PASS: ${results.PASS.length}`);
  console.log(`FAIL: ${results.FAIL.length}`);
  if (results.FAIL.length > 0) {
    console.log('FAILURES:', JSON.stringify(results.FAIL, null, 2));
  }
  console.log('Dados reais afetados: NAO');
  console.log('Migration executada: NAO');
  console.log('Codigo alterado: NAO');
  console.log('========================================');
  console.log(results.FAIL.length === 0 ? 'SMOKE PRODUCAO — PASS' : 'SMOKE PRODUCAO — FAIL');

  process.exit(results.FAIL.length === 0 ? 0 : 1);
} catch (err) {
  console.error('SMOKE FATAL:', err.message);
  process.exit(1);
}
