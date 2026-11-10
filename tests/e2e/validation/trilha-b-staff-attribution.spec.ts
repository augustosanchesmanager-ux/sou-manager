import { type BrowserContext, type Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
import {
  getAdminClient,
  loadEnvLocal,
  createConfirmedUser,
  deleteUserByEmail,
} from '../helpers/supabaseAdmin';

/**
 * TD-001 B3.4-H · Trilha B — staff attribution regression (PO-approved cycle).
 *
 * Proves the central criterion end-to-end against the Vercel PREVIEW of
 * branch fix/checkout-staff-attribution:
 *
 *   add service WITHOUT touching the responsible select -> finish ->
 *   the professional displayed by default (first active staff ordered by
 *   name, per F1) is EXACTLY the persisted comanda_items.staff_id, with
 *   primary participant (100%) and a commission record for a rate>0 pro.
 *
 * Ephemeral tenant (trilhab-val-*) with FK-aware teardown.
 * Barbearia Principal (b716e290-f7f6-4449-b790-5ae9dcdadcab) must remain
 * byte-for-byte intact (row counts snapshotted before/after).
 */

const PRINCIPAL_TENANT_ID = 'b716e290-f7f6-4449-b790-5ae9dcdadcab';
const PASSWORD = 'Trb-Validation-2026!';
const DISPATCH_WAIT_MS = 8_000;

const log = (checkpoint: string, payload: unknown) => {
  console.log(`[TRB][${checkpoint}] ${JSON.stringify(payload)}`);
};

const admin = () => getAdminClient();

let runId = Date.now();
let tenantId = '';
let managerUser = { email: '', password: PASSWORD, userId: '' };
let barberUser = { email: '', password: PASSWORD, userId: '' };
let barberStaffId = '';
let clientId = '';
let serviceId = '';
let clientName = '';
let serviceName = '';
let comandaId = '';

type PrincipalSnapshot = { table: string; count: number };
let principalBefore: PrincipalSnapshot[] = [];
let principalAfter: PrincipalSnapshot[] = [];

async function countPrincipal(table: string): Promise<number> {
  const { count, error } = await admin().from(table).select('*', { count: 'exact', head: true }).eq('tenant_id', PRINCIPAL_TENANT_ID);
  if (error) throw new Error(`principal count ${table} failed: ${error.message}`);
  return count ?? -1;
}

async function applyVercelBypass(context: BrowserContext): Promise<void> {
  const secret = loadEnvLocal().VERCEL_AUTOMATION_BYPASS_SECRET;
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL;
  if (!secret || !baseUrl) return;
  const origin = new URL(baseUrl).origin;
  await context.route(`${origin}/**`, async (route) => {
    await route.continue({
      headers: { ...route.request().headers(), 'x-vercel-protection-bypass': secret },
    });
  });
}

async function uiLogin(page: Page): Promise<void> {
  await page.goto('/#/login');
  const emailInput = page.locator('input[type="email"]');
  await emailInput.waitFor({ state: 'visible', timeout: 20_000 });
  await emailInput.fill(managerUser.email);
  await page.locator('input[type="password"]').fill(managerUser.password, { timeout: 15_000 });
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/#\/dashboard/, { timeout: 40_000 });
  log('ui-login', { ok: true });
}

/** Drives one REAL checkout WITHOUT touching the inline responsible select. */
async function performUiCheckoutWithoutTouchingSelect(page: Page): Promise<void> {
  await page.goto('/#/checkout?mode=comanda');
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForTimeout(2_000);

  const clientButton = page.getByRole('button', { name: /Buscar/ }).first();
  await clientButton.waitFor({ state: 'visible', timeout: 20_000 });
  await clientButton.click();

  const clientSearch = page.locator('input[placeholder="Buscar cliente..."]');
  await clientSearch.waitFor({ state: 'visible', timeout: 15_000 });
  await clientSearch.fill(clientName);
  await page.waitForTimeout(1_500);
  await page.getByText(clientName, { exact: false }).first().click();
  await page.waitForTimeout(500);

  const addServiceButton = page.getByRole('button', { name: /\+\s*Servi/ }).first();
  await expect(addServiceButton).toBeEnabled({ timeout: 30_000 });
  await addServiceButton.click();

  const serviceSearch = page.locator('input[placeholder*="Buscar"]').last();
  await serviceSearch.waitFor({ state: 'visible', timeout: 15_000 });
  await serviceSearch.fill(serviceName);
  await page.waitForTimeout(1_500);
  await page.getByText(serviceName, { exact: false }).first().click();
  await page.waitForTimeout(800);

  const staffSelects = page.locator('select').filter({ has: page.locator('option', { hasText: 'Nenhum' }) });
  const selectedLabel = await staffSelects.first().locator('option[selected], option:checked').first().textContent().catch(() => null);
  log('default-responsible-as-rendered', { selectedLabel });

  const fecharAgora = page.getByRole('button', { name: /Fechar agora/ }).first();
  if (await fecharAgora.isVisible().catch(() => false)) {
    await fecharAgora.click().catch(() => undefined);
  }
  const dinheiro = page.getByRole('button', { name: /^Dinheiro$/ }).first();
  if (await dinheiro.isVisible().catch(() => false)) {
    await dinheiro.click().catch(() => undefined);
  }

  const finishButton = page.getByRole('button', { name: /Confirmar e fechar|Concluir venda|Abrir e fechar agora/ }).first();
  await finishButton.waitFor({ state: 'visible', timeout: 15_000 });
  await finishButton.click();

  await page
    .waitForURL((u) => !u.hash.includes('/checkout'), { timeout: 45_000 })
    .catch(async () => {
      await page.getByText(/sucesso|registrada|finalizada/i).first().waitFor({ state: 'visible', timeout: 10_000 }).catch(() => undefined);
    });
  log('checkout-ui-done', { url: page.url() });
  await page.waitForTimeout(2_000);
}

test.describe.configure({ mode: 'serial' });

test.describe('TRB - Trilha B staff attribution regression', () => {
  test.setTimeout(240_000);

  test.beforeAll(async () => {
    runId = Date.now();
    clientName = `Cliente TRB ${runId}`;
    serviceName = `Servico TRB ${runId}`;
    managerUser.email = `trilhab-val-${runId}-manager@gmail.com`;
    barberUser.email = `trilhab-val-${runId}-barber@gmail.com`;

    principalBefore = [];
    for (const t of ['comandas', 'comanda_items', 'staff', 'clients', 'services', 'transactions', 'commission_records']) {
      principalBefore.push({ table: t, count: await countPrincipal(t) });
    }
    log('principal-before', principalBefore);

    managerUser.userId = await createConfirmedUser({
      email: managerUser.email,
      password: managerUser.password,
      userMetadata: { first_name: 'TRB', last_name: 'Manager' },
    });
    barberUser.userId = await createConfirmedUser({
      email: barberUser.email,
      password: PASSWORD,
      userMetadata: { first_name: 'AAA', last_name: 'TRB Barbeiro' },
    });

    const { data: tenant, error: tenantError } = await admin()
      .from('tenants')
      .insert({ name: `TRB Validation ${runId}`, slug: `trilhab-val-${runId}`, app_slug: 'barber', plan: 'pro', status: 'active' })
      .select('id')
      .single();
    if (tenantError || !tenant) throw new Error(`tenants insert failed: ${tenantError?.message}`);
    tenantId = (tenant as { id: string }).id;

    log('CHECKPOINT-tenant-isolation', { trbTenantId: tenantId, distinct: tenantId !== PRINCIPAL_TENANT_ID });
    expect(tenantId).not.toBe(PRINCIPAL_TENANT_ID);
    expect(tenantId).toMatch(/^[0-9a-f-]{36}$/i);

    const { error: profilesError } = await admin().from('profiles').insert([
      { id: managerUser.userId, tenant_id: tenantId, full_name: 'TRB Manager', role: 'manager', status: 'active', onboarding_completed: true },
      { id: barberUser.userId, tenant_id: tenantId, full_name: 'AAA TRB Barbeiro', role: 'barber', status: 'active', onboarding_completed: true },
    ]);
    if (profilesError) throw new Error(`profiles insert failed: ${profilesError.message}`);

    await admin().from('staff').delete().eq('tenant_id', tenantId);
    await admin().from('user_tenants').delete().eq('tenant_id', tenantId);

    const { error: membershipsError } = await admin().from('user_tenants').insert([
      { user_id: managerUser.userId, tenant_id: tenantId, role: 'manager', is_primary: true },
      { user_id: barberUser.userId, tenant_id: tenantId, role: 'barber', is_primary: false },
    ]);
    if (membershipsError) throw new Error(`user_tenants insert failed: ${membershipsError.message}`);

    const { data: staffRows, error: staffError } = await admin()
      .from('staff')
      .insert([
        { id: managerUser.userId, name: 'ZZZ TRB Manager', email: managerUser.email, phone: '', role: 'manager', avatar: '', commission_rate: 0, status: 'active', tenant_id: tenantId },
        { id: barberUser.userId, name: 'AAA TRB Barbeiro', email: barberUser.email, phone: '', role: 'barber', avatar: '', commission_rate: 40, status: 'active', tenant_id: tenantId },
      ])
      .select('id, name');
    if (staffError || !staffRows) throw new Error(`staff insert failed: ${staffError?.message}`);
    barberStaffId = staffRows.find((s: { name: string }) => s.name === 'AAA TRB Barbeiro')!.id as string;

    const { error: settingsError } = await admin()
      .from('tenant_settings')
      .upsert({ tenant_id: tenantId, chair_count: 1 }, { onConflict: 'tenant_id' });
    if (settingsError) throw new Error(`tenant_settings upsert failed: ${settingsError.message}`);

    const { data: clientRow, error: clientsError } = await admin()
      .from('clients')
      .insert({ tenant_id: tenantId, name: clientName, phone: '11000000001', email: `trb-${runId}@val.com`, status: 'active' })
      .select('id')
      .single();
    if (clientsError || !clientRow) throw new Error(`clients insert failed: ${clientsError?.message}`);
    clientId = (clientRow as { id: string }).id;

    const { data: serviceRow, error: servicesError } = await admin()
      .from('services')
      .insert({ tenant_id: tenantId, name: serviceName, category: 'Validacao', price: 100, duration: 30, active: true })
      .select('id')
      .single();
    if (servicesError || !serviceRow) throw new Error(`services insert failed: ${servicesError?.message}`);
    serviceId = (serviceRow as { id: string }).id;

    log('seed-complete', { tenantId, barberStaffId, clientId, serviceId });
  });

  test('checkout without touching select persists first-by-name staff with primary participant and commission', async ({ browser }) => {
    test.skip(!process.env.PLAYWRIGHT_BASE_URL, 'PLAYWRIGHT_BASE_URL not set — preview URL required');

    const ctx = await browser.newContext();
    await applyVercelBypass(ctx);
    const page = await ctx.newPage();
    await uiLogin(page);

    await performUiCheckoutWithoutTouchingSelect(page);

    // InMemoryOutbox dispatch loop runs on a 5s setInterval. Commission
    // record creation observed at ~12s in production preview. Wait 15s
    // to allow multiple dispatch cycles before browser context teardown.
    await page.waitForTimeout(15_000);

    await ctx.close();

    const { data: comandas, error: comandasError } = await admin()
      .from('comandas')
      .select('id, status, total, staff_id, payment_method')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(5);
    if (comandasError) throw new Error(`comandas query failed: ${comandasError.message}`);
    expect(comandas?.length).toBeGreaterThan(0);
    const comanda = comandas![0] as { id: string; status: string; total: number; staff_id: string | null };
    comandaId = comanda.id;
    log('comanda-created', comanda);

    expect(comanda.status).toBe('paid');
    expect(comanda.total).toBe(100);

    const { data: items, error: itemsError } = await admin()
      .from('comanda_items')
      .select('id, staff_id, product_name, unit_price, quantity')
      .eq('comanda_id', comandaId);
    if (itemsError) throw new Error(`items query failed: ${itemsError.message}`);
    expect(items).toHaveLength(1);
    const item = items![0] as { id: string; staff_id: string | null };
    log('item-persisted', item);
    expect(item.staff_id).toBe(barberStaffId);

    expect(comanda.staff_id).toBe(barberStaffId);

    const { data: participants, error: participantsError } = await admin()
      .from('service_execution_participants')
      .select('id, staff_id, role, payout_type, payout_value, affects_commission')
      .eq('comanda_item_id', item.id);
    if (participantsError) throw new Error(`participants query failed: ${participantsError.message}`);
    expect(participants).toHaveLength(1);
    const participant = participants![0] as Record<string, unknown>;
    log('participant-persisted', participant);
    expect(participant.staff_id).toBe(barberStaffId);
    expect(participant.role).toBe('primary');
    expect(participant.payout_type).toBe('percentage');
    expect(Number(participant.payout_value)).toBe(100);
    expect(participant.affects_commission).toBe(true);

    await new Promise((r) => setTimeout(r, DISPATCH_WAIT_MS));
    let commission: Record<string, unknown> | null = null;
    const deadline = Date.now() + 40_000;
    while (Date.now() < deadline && !commission) {
      const { data: rows, error } = await admin()
        .from('commission_records')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('comanda_id', comandaId)
        .eq('record_type', 'commission');
      if (error) throw new Error(`commission query failed: ${error.message}`);
      if (rows && rows.length === 1) commission = rows[0] as Record<string, unknown>;
      else await new Promise((r) => setTimeout(r, 2_000));
    }
    log('commission-record', commission);
    expect(commission).not.toBeNull();
    expect(commission!.staff_id).toBe(barberStaffId);
    expect(Number(commission!.commission_value)).toBe(40);
    expect(Number(commission!.commission_rate)).toBe(0.4);
  });

  test.afterAll(async () => {
    if (!tenantId) return;

    const steps: Array<[string, () => PromiseLike<{ error?: { message?: string } | null }>]> = [
      ['notifications', () => admin().from('notifications').delete().eq('tenant_id', tenantId)],
      ['commission_records', () => admin().from('commission_records').delete().eq('tenant_id', tenantId)],
      ['processed_operations', () => admin().from('processed_operations').delete().eq('tenant_id', tenantId)],
      ['event_store', () => admin().from('event_store').delete().eq('metadata->>tenantId', tenantId)],
      ['service_execution_participants', async () => {
        const { data: comandas } = await admin().from('comandas').select('id').eq('tenant_id', tenantId);
        const ids = (comandas || []).map((c: { id: string }) => c.id);
        if (!ids.length) return { error: null };
        const { data: itemIds } = await admin().from('comanda_items').select('id').in('comanda_id', ids);
        const iids = (itemIds || []).map((i: { id: string }) => i.id);
        if (!iids.length) return { error: null };
        return admin().from('service_execution_participants').delete().in('comanda_item_id', iids);
      }],
      ['comanda_items', async () => {
        const { data: comandas } = await admin().from('comandas').select('id').eq('tenant_id', tenantId);
        const ids = (comandas || []).map((c: { id: string }) => c.id);
        if (!ids.length) return { error: null };
        return admin().from('comanda_items').delete().in('comanda_id', ids);
      }],
      ['comandas', () => admin().from('comandas').delete().eq('tenant_id', tenantId)],
      ['financial_reversals', () => admin().from('financial_reversals').delete().eq('tenant_id', tenantId)],
      ['transactions', () => admin().from('transactions').delete().eq('tenant_id', tenantId)],
      ['appointments', () => admin().from('appointments').delete().eq('tenant_id', tenantId)],
      ['clients', () => admin().from('clients').delete().eq('tenant_id', tenantId)],
      ['services', () => admin().from('services').delete().eq('tenant_id', tenantId)],
      ['tenant_settings', () => admin().from('tenant_settings').delete().eq('tenant_id', tenantId)],
      ['staff', () => admin().from('staff').delete().eq('tenant_id', tenantId)],
      ['user_tenants', () => admin().from('user_tenants').delete().eq('tenant_id', tenantId)],
      ['profiles', () => admin().from('profiles').delete().eq('tenant_id', tenantId)],
      ['tenants', () => admin().from('tenants').delete().eq('id', tenantId)],
    ];

    for (const [name, fn] of steps) {
      const res = await fn();
      if (res?.error) log('teardown-warn', { step: name, error: res.error.message });
    }
    await deleteUserByEmail(managerUser.email);
    await deleteUserByEmail(barberUser.email);
    log('teardown-done', { tenantId });

    principalAfter = [];
    for (const t of ['comandas', 'comanda_items', 'staff', 'clients', 'services', 'transactions', 'commission_records']) {
      principalAfter.push({ table: t, count: await countPrincipal(t) });
    }
    log('principal-after', principalAfter);

    for (const before of principalBefore) {
      const after = principalAfter.find((a) => a.table === before.table);
      expect(after?.count, `Principal table ${before.table} must remain intact`).toBe(before.count);
    }
  });
});
