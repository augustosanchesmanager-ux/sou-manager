import { test, expect, type Page } from '@playwright/test';
import { createConfirmedUser, deleteUserByEmail, getAdminClient } from '../helpers/supabaseAdmin';
import { signInAsUser } from '../helpers/supabaseUser';

/**
 * GATE C — H-3-5 RBAC Validation (ManagerRoute)
 *
 * Objetivo: Exercitar o bloqueio/permissão do ManagerRoute para roles barber/receptionist vs manager/superadmin
 * em um tenant de teste ISOLADO (NUNCA no tenant real Sanchez Barber).
 *
 * Critérios de aceitação:
 * - barber → bloqueado nas áreas administrativas/financeiras (redireciona para /dashboard)
 * - receptionist → bloqueado nas áreas administrativas/financeiras (redireciona para /dashboard)
 * - manager → permitido nas áreas administrativas/financeiras
 * - superadmin → permitido nas áreas administrativas/financeiras
 *
 * Rotas testadas (protegidas por ManagerRoute + FeatureRoute chef_club):
 * - /#/chef-club-plans
 * - /#/chef-club-subscriptions
 * - /#/chef-club-receivables
 *
 * Modo: E2E_PROVISIONING=1 → tenant isolado, dados controlados, limpeza pós-execução
 */

const enabled = process.env.E2E_PROVISIONING === '1';
const PASSWORD = 'GateC-H35-2026!';
const runId = Date.now();

const emails = {
  barber: `gatec-h35-${runId}-barber@gmail.com`,
  receptionist: `gatec-h35-${runId}-receptionist@gmail.com`,
  manager: `gatec-h35-${runId}-manager@gmail.com`,
  owner: `gatec-h35-${runId}-owner@gmail.com`,
};

test.describe.configure({ mode: 'serial' });

test.describe('Gate C — H-3-5 RBAC: ManagerRoute blocking/allowing', () => {
  test.skip(!enabled, 'Requires E2E_PROVISIONING=1 and real Supabase in .env.local');

  let tenantId = '';
  let opsTenantId = '';
  let barberUserId = '';
  let receptionistUserId = '';
  let managerUserId = '';
  let ownerUserId = '';
  let chefClubFeatureEnabled = false;

  // Sessões reais (auth.uid() <> null) para navegação autenticada
  let barberSession: Awaited<ReturnType<typeof signInAsUser>> | null = null;
  let receptionistSession: Awaited<ReturnType<typeof signInAsUser>> | null = null;
  let managerSession: Awaited<ReturnType<typeof signInAsUser>> | null = null;
  let ownerSession: Awaited<ReturnType<typeof signInAsUser>> | null = null;

  const admin = getAdminClient();

  async function loginAs(page: Page, email: string): Promise<void> {
    await page.goto('/#/login');
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/#\/dashboard/, { timeout: 30_000 });
  }

  // Helper para testar acesso a uma rota
  async function testRouteAccess(
    page: Page,
    role: string,
    route: string,
    expectedAllowed: boolean,
    expectedContent?: string
  ): Promise<{ allowed: boolean; finalUrl: string; contentFound: boolean }> {
    await page.goto(route);
    await page.waitForLoadState('networkidle');

    // Aguardar possível redirect client-side (ManagerRoute usa <Navigate>)
    await page.waitForTimeout(1500);

    const finalUrl = page.url();
    const isDashboard = finalUrl.includes('/#/dashboard');
    const isPendingApproval = finalUrl.includes('/#/pending-approval');
    const allowed = !isDashboard && !isPendingApproval;

    let contentFound = false;
    if (allowed && expectedContent) {
      try {
        await expect(page.locator('body')).toContainText(expectedContent, { timeout: 10_000 });
        contentFound = true;
      } catch {
        contentFound = false;
      }
    }

    console.log(`[Gate C] ${role} → ${route} | allowed=${allowed} | url=${finalUrl} | content=${contentFound}`);
    return { allowed, finalUrl, contentFound };
  }

  test.beforeAll(async () => {
    console.log('[Gate C] Iniciando provisionamento do tenant de teste...');

    // 1. Criar 4 usuários confirmados via Admin API
    console.log('[Gate C] Criando usuários...');
    barberUserId = await createConfirmedUser({
      email: emails.barber,
      password: PASSWORD,
      userMetadata: { first_name: 'GateC', last_name: 'Barber' },
    });
    receptionistUserId = await createConfirmedUser({
      email: emails.receptionist,
      password: PASSWORD,
      userMetadata: { first_name: 'GateC', last_name: 'Receptionist' },
    });
    managerUserId = await createConfirmedUser({
      email: emails.manager,
      password: PASSWORD,
      userMetadata: { first_name: 'GateC', last_name: 'Manager' },
    });
    ownerUserId = await createConfirmedUser({
      email: emails.owner,
      password: PASSWORD,
      userMetadata: { first_name: 'GateC', last_name: 'Owner' },
    });
    console.log('[Gate C] Usuários criados:', { barberUserId, receptionistUserId, managerUserId, ownerUserId });

    // 2. Criar tenant de teste (plano pro para habilitar chef_club)
    const tenantSlug = `gatec-h35-${runId}`;
    const { data: tenant, error: tenantError } = await admin
      .from('tenants')
      .insert({
        name: `GateC H35 Test ${runId}`,
        slug: tenantSlug,
        app_slug: 'barber',
        plan: 'pro',
        status: 'active',
      })
      .select('id')
      .single();
    if (tenantError || !tenant) {
      throw new Error(`tenant insert failed: ${tenantError?.message ?? 'no tenant returned'}`);
    }
    tenantId = tenant.id as string;
    console.log('[Gate C] Tenant criado:', tenantId);

    // 3. Inserir profiles com roles
    const { error: profilesError } = await admin.from('profiles').insert([
      { id: barberUserId, tenant_id: tenantId, full_name: 'GateC Barber', role: 'barber', status: 'active', onboarding_completed: true },
      { id: receptionistUserId, tenant_id: tenantId, full_name: 'GateC Receptionist', role: 'receptionist', status: 'active', onboarding_completed: true },
      { id: managerUserId, tenant_id: tenantId, full_name: 'GateC Manager', role: 'manager', status: 'active', onboarding_completed: true },
      { id: ownerUserId, tenant_id: tenantId, full_name: 'GateC Owner', role: 'superadmin', status: 'active', onboarding_completed: true },
    ]);
    if (profilesError) throw new Error(`profiles insert failed: ${profilesError.message}`);

    // Limpar triggers automáticos
    await admin.from('staff').delete().eq('tenant_id', tenantId);
    await admin.from('user_tenants').delete().eq('tenant_id', tenantId);

    // 4. Inserir user_tenants
    const { error: membershipsError } = await admin.from('user_tenants').insert([
      { user_id: barberUserId, tenant_id: tenantId, role: 'barber', is_primary: false },
      { user_id: receptionistUserId, tenant_id: tenantId, role: 'receptionist', is_primary: false },
      { user_id: managerUserId, tenant_id: tenantId, role: 'manager', is_primary: true },
      { user_id: ownerUserId, tenant_id: tenantId, role: 'superadmin', is_primary: true },
    ]);
    if (membershipsError) throw new Error(`user_tenants insert failed: ${membershipsError.message}`);

    // 5. Inserir staff
    const { error: staffError } = await admin.from('staff').insert([
      { id: barberUserId, name: 'GateC Barber', email: emails.barber, phone: '', role: 'barber', avatar: '', commission_rate: 40, status: 'active', tenant_id: tenantId },
      { id: receptionistUserId, name: 'GateC Receptionist', email: emails.receptionist, phone: '', role: 'receptionist', avatar: '', commission_rate: 0, status: 'active', tenant_id: tenantId },
      { id: managerUserId, name: 'GateC Manager', email: emails.manager, phone: '', role: 'manager', avatar: '', commission_rate: 0, status: 'active', tenant_id: tenantId },
      { id: ownerUserId, name: 'GateC Owner', email: emails.owner, phone: '', role: 'owner', avatar: '', commission_rate: 0, status: 'active', tenant_id: tenantId },
    ]);
    if (staffError) throw new Error(`staff insert failed: ${staffError.message}`);

    // 6. Verificar feature chef_club habilitada no plano pro
    const { data: pf, error: pfError } = await admin
      .from('plan_features')
      .select('feature_key')
      .eq('plan_slug', 'pro')
      .eq('feature_key', 'chef_club')
      .single();
    if (pfError && pfError.code !== 'PGRST116') throw new Error(`plan_features check failed: ${pfError.message}`);
    chefClubFeatureEnabled = !!pf;
    console.log('[Gate C] chef_club feature enabled for pro plan:', chefClubFeatureEnabled);

    // 7. Dados mínimos de domínio
    await admin.from('tenant_settings').upsert({ tenant_id: tenantId, chair_count: 2 }, { onConflict: 'tenant_id' });
    await admin.from('clients').insert([
      { tenant_id: tenantId, name: 'GateC Client 1', phone: '11999990001', email: 'client1@gatec.com', status: 'active' },
      { tenant_id: tenantId, name: 'GateC Client 2', phone: '11999990002', email: 'client2@gatec.com', status: 'active' },
    ]);
    await admin.from('services').insert([
      { tenant_id: tenantId, name: 'Corte GateC', category: 'Cabelo', price: 65, duration: 45, active: true },
    ]);

    console.log('[Gate C] Provisionamento completo. Tenant:', tenantId);

    // 8. Criar sessões autenticadas para cada role
    barberSession = await signInAsUser(emails.barber, PASSWORD);
    receptionistSession = await signInAsUser(emails.receptionist, PASSWORD);
    managerSession = await signInAsUser(emails.manager, PASSWORD);
    ownerSession = await signInAsUser(emails.owner, PASSWORD);
    console.log('[Gate C] Sessões criadas para todos os roles');
  });

  test.afterAll(async () => {
    console.log('[Gate C] Iniciando limpeza...');
    try {
      // Deletar usuários auth (cascata para profiles, user_tenants, staff)
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(email);
      }
      // Limpar dados de domínio do tenant
      await admin.from('clients').delete().eq('tenant_id', tenantId);
      await admin.from('services').delete().eq('tenant_id', tenantId);
      await admin.from('tenant_settings').delete().eq('tenant_id', tenantId);
      // Limpar tenant
      await admin.from('tenants').delete().eq('id', tenantId);
      console.log('[Gate C] Limpeza completa');
    } catch (err) {
      console.warn('[Gate C] Limpeza falhou (tenant deixado para operador):', err);
    }
  });

  // ─── TESTES ─────────────────────────────────────────────────────────────

  test('H35-1: barber deve ser BLOQUEADO nas rotas Chef Club (ManagerRoute)', async ({ page }) => {
    await loginAs(page, emails.barber);

    const routes = [
      { path: '/#/chef-club-plans', label: 'Planos' },
      { path: '/#/chef-club-subscriptions', label: 'Assinaturas' },
      { path: '/#/chef-club-receivables', label: 'Recebimentos' },
    ];

    for (const route of routes) {
      const result = await testRouteAccess(page, 'barber', route.path, false);
      expect(result.allowed).toBe(false);
      expect(result.finalUrl).toContain('/#/dashboard');
    }
  });

  test('H35-2: receptionist deve ser BLOQUEADO nas rotas Chef Club (ManagerRoute)', async ({ page }) => {
    await loginAs(page, emails.receptionist);

    const routes = [
      { path: '/#/chef-club-plans', label: 'Planos' },
      { path: '/#/chef-club-subscriptions', label: 'Assinaturas' },
      { path: '/#/chef-club-receivables', label: 'Recebimentos' },
    ];

    for (const route of routes) {
      const result = await testRouteAccess(page, 'receptionist', route.path, false);
      expect(result.allowed).toBe(false);
      expect(result.finalUrl).toContain('/#/dashboard');
    }
  });

  test('H35-3: manager deve ter ACESSO nas rotas Chef Club', async ({ page }) => {
    await loginAs(page, emails.manager);

    const routes = [
      { path: '/#/chef-club-plans', label: 'Planos', expected: 'Club dos Chefes' },
      { path: '/#/chef-club-subscriptions', label: 'Assinaturas', expected: 'Club dos Chefes' },
      { path: '/#/chef-club-receivables', label: 'Recebimentos', expected: 'Recebimentos' },
    ];

    for (const route of routes) {
      const result = await testRouteAccess(page, 'manager', route.path, true, route.expected);
      expect(result.allowed).toBe(true);
      expect(result.contentFound).toBe(true);
    }
  });

  test('H35-4: owner (superadmin no profiles) deve ter ACESSO nas rotas Chef Club', async ({ page }) => {
    await loginAs(page, emails.owner);

    const routes = [
      { path: '/#/chef-club-plans', label: 'Planos', expected: 'Club dos Chefes' },
      { path: '/#/chef-club-subscriptions', label: 'Assinaturas', expected: 'Club dos Chefes' },
      { path: '/#/chef-club-receivables', label: 'Recebimentos', expected: 'Recebimentos' },
    ];

    for (const route of routes) {
      const result = await testRouteAccess(page, 'owner', route.path, true, route.expected);
      expect(result.allowed).toBe(true);
      expect(result.contentFound).toBe(true);
    }
  });

  test('H35-5: Verificação da feature flag chef_club ativa no tenant de teste', async () => {
    expect(chefClubFeatureEnabled).toBe(true);
    const { data } = await admin
      .from('tenants')
      .select('plan, status')
      .eq('id', tenantId)
      .single();
    expect(data?.plan).toBe('pro');
    expect(data?.status).toBe('active');
  });
});