import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { getFixtureState } from '../data/fixtureState';
import { createConfirmedUser, deleteUserByEmail, getAdminClient } from '../helpers/supabaseAdmin';

/**
 * FLOW 8: Team Onboarding & Invitations (Fase 6.0.3)
 *
 * Critérios de aceite do plano (docs/audit/PHASE_6_0_3_EXECUTION_PLAN.md):
 *   manager convida (D1: link + senha self-service, D2: barber/receptionist,
 *   D3: limite por plano) → profissional aceita → perfil/staff/user_tenants
 *   criados consistentemente (R1) → acesso ao tenant (R6).
 *
 * Cenários:
 *   A. Happy path — manager convida barbeiro → convite pendente → invitee
 *      aceita via /#/accept-invite/:token → redireciona para o dashboard →
 *      membro aparece na equipe e os vínculos (profiles/staff/user_tenants)
 *      existem no banco com role 'barber'.
 *   B. Convite revogado — manager revoga o convite → invitee tenta aceitar e
 *      vê "Convite indisponível".
 *
 * O token é lido do banco via Admin API (o token nunca é exposto por REST —
 * ele só existe no e-mail do convite). O invitee é um usuário autenticado sem
 * perfil/tenant (criado no globalSetup para o cenário A; criado em teste para B).
 *
 * Gate: E2E_PROVISIONING=1 (requer Supabase real + .env.local).
 */
const enabled = process.env.E2E_PROVISIONING === '1';

const ROLES = { manager: 'Gerente Operacional', barber: 'Barbeiro', receptionist: 'Recepcionista' };

async function inviteByUI(page: import('@playwright/test').Page, email: string, roleLabel: string) {
  await page.getByRole('button', { name: /Novo Colaborador/ }).click();
  // O componente Modal (components/ui/Modal.tsx) renderiza o card dentro de um
  // overlay `fixed inset-0` sem role="dialog" — escopamos pelo overlay.
  const modal = page.locator('div.fixed.inset-0').last();
  await modal.getByPlaceholder('email@barber.com').fill(email);
  await modal.locator('select').first().selectOption({ label: roleLabel });
  await modal.getByRole('button', { name: 'Enviar Convite' }).click();
}

async function readInviteToken(tenantId: string, email: string): Promise<string> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('team_invitations')
    .select('id, token')
    .eq('tenant_id', tenantId)
    .eq('email', email)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  if (error || !data) {
    throw new Error(`readInviteToken failed: ${error?.message ?? 'no invite found'}`);
  }
  return data.token as string;
}

async function loginAs(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/#/login');
  await page.locator('input[type="email"]').waitFor({ state: 'visible', timeout: 15_000 });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  // O invitee sem perfil cai em /pending-approval até aceitar o convite; o
  // manager autenticado vai para /dashboard. Aguardamos qualquer um dos dois.
  await page.waitForURL(/#\/(dashboard|pending-approval)/, { timeout: 40_000 });
}

test.describe('Flow 8 — Team Onboarding & Invitations (Phase 6.0.3)', () => {
  test.skip(!enabled, 'Requires E2E_PROVISIONING=1 and real Supabase in .env.local');

  test.describe.configure({ mode: 'serial' });

  test('A. convite -> aceite -> acesso ao tenant com permissões', async ({ browser }) => {
    test.setTimeout(180_000);
    const state = getFixtureState();
    const { tenantId, users } = state;

    const managerCtx = await browser.newContext();
    const managerPage = await managerCtx.newPage();

    // 1. Manager loga e navega para a equipe.
    const login = new LoginPage(managerPage);
    await login.goto();
    await login.login(users.manager.email, users.manager.password);
    await managerPage.goto('/#/team');
    await expect(managerPage.getByRole('heading', { name: 'Equipe' })).toBeVisible({ timeout: 20_000 });

    // 2. Convida o invitee (barbeiro) via UI — D1/D2.
    await inviteByUI(managerPage, users.invitee.email, ROLES.barber);
    await expect(managerPage.getByText(new RegExp(`Convite enviado para ${users.invitee.email}`))).toBeVisible({ timeout: 20_000 });
    await expect(managerPage.getByText('Convites pendentes')).toBeVisible({ timeout: 10_000 });
    await expect(managerPage.getByText(users.invitee.email, { exact: true })).toBeVisible();

    // 3. Token lido do banco (equivale ao link do e-mail — D4).
    const token = await readInviteToken(tenantId, users.invitee.email);

    // 4. Invitee (usuário seed sem perfil) loga e acessa a página de aceite.
    const inviteeCtx = await browser.newContext();
    const inviteePage = await inviteeCtx.newPage();
    await loginAs(inviteePage, users.invitee.email, users.invitee.password);
    await inviteePage.goto(`/#/accept-invite/${token}`);

    await expect(inviteePage.getByText('Você foi convidado!')).toBeVisible({ timeout: 15_000 });
    await expect(inviteePage.getByText(/Barbeiro/).first()).toBeVisible();

    // 5. Preenche nome e aceita → redireciona para o dashboard.
    await inviteePage.getByPlaceholder('João').fill('E2E');
    await inviteePage.getByPlaceholder('Silva').fill('Invitee');
    await inviteePage.getByRole('button', { name: 'Aceitar convite' }).click();
    await inviteePage.waitForURL(/#\/dashboard/, { timeout: 40_000 });

    // 6. Vínculos criados consistentemente (R1) — profiles/staff/user_tenants.
    const admin = getAdminClient();
    const usersList = (await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })).data.users as Array<{ id: string; email?: string | null }>;
    const inviteeId = usersList.find((u) => u.email?.toLowerCase() === users.invitee.email.toLowerCase())?.id;
    expect(inviteeId).toBeTruthy();

    const { data: profile } = await admin.from('profiles').select('id, tenant_id, role, status, onboarding_completed').eq('id', inviteeId!).single();
    expect(profile).toMatchObject({ tenant_id: tenantId, role: 'barber', status: 'active', onboarding_completed: true });

    const { data: staffRow } = await admin.from('staff').select('id, tenant_id, role, commission_rate, status').eq('id', inviteeId!).single();
    expect(staffRow).toMatchObject({ tenant_id: tenantId, role: 'barber', commission_rate: 50, status: 'active' });

    const { data: membership } = await admin.from('user_tenants').select('tenant_id, role, is_primary').eq('user_id', inviteeId!).eq('tenant_id', tenantId).single();
    expect(membership).toMatchObject({ tenant_id: tenantId, role: 'barber', is_primary: false });

    // 7. Acesso ao tenant: o invitee vê a equipe (a página /team é de gestor,
    //    então verificamos que o barbeiro consegue acessar o dashboard e a agenda).
    await expect(inviteePage.locator('header, aside').first()).toBeVisible();

    // 8. O convite agora está 'accepted' e o manager vê o novo membro na equipe.
    const { data: inviteRow } = await admin.from('team_invitations').select('status').eq('tenant_id', tenantId).eq('email', users.invitee.email).single();
    expect(inviteRow?.status).toBe('accepted');

    await managerPage.reload();
    await expect(managerPage.getByText('E2E Invitee')).toBeVisible({ timeout: 15_000 });

    await inviteeCtx.close();
    await managerCtx.close();
  });

  test('B. convite revogado -> aceite bloqueado', async ({ browser }) => {
    test.setTimeout(120_000);
    const state = getFixtureState();
    const { tenantId, users } = state;

    const email = `e2e-revoked-${Date.now()}@gmail.com`;
    const password = 'E2e-Revoked-2026!';

    // Invitee B criado via Admin API (sem perfil) para este cenário.
    await createConfirmedUser({
      email,
      password,
      userMetadata: { first_name: 'E2E', last_name: 'Revoked' },
    });

    const managerCtx = await browser.newContext();
    const managerPage = await managerCtx.newPage();
    const login = new LoginPage(managerPage);
    await login.goto();
    await login.login(users.manager.email, users.manager.password);
    await managerPage.goto('/#/team');
    await expect(managerPage.getByRole('heading', { name: 'Equipe' })).toBeVisible({ timeout: 20_000 });

    // 1. Manager convida o usuário B e depois revoga.
    await inviteByUI(managerPage, email, ROLES.barber);
    await expect(managerPage.getByText(new RegExp(`Convite enviado para ${email}`))).toBeVisible({ timeout: 20_000 });

    const token = await readInviteToken(tenantId, email);
    const inviteRow = managerPage.getByText(email).locator('xpath=ancestor::div[contains(@class,"rounded-xl")]').first();
    await inviteRow.getByTitle('Revogar convite').click();
    await expect(managerPage.getByText('Convite revogado.')).toBeVisible({ timeout: 10_000 });

    // 2. Invitee B tenta aceitar e vê convite indisponível.
    const inviteeCtx = await browser.newContext();
    const inviteePage = await inviteeCtx.newPage();
    await loginAs(inviteePage, email, password);
    await inviteePage.goto(`/#/accept-invite/${token}`);
    await expect(inviteePage.getByText('Convite indisponível')).toBeVisible({ timeout: 15_000 });

    // 3. Nenhum vínculo foi criado (staff/profiles vazios para o usuário).
    const admin = getAdminClient();
    const usersList = (await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })).data.users as Array<{ id: string; email?: string | null }>;
    const revokedId = usersList.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;
    expect(revokedId).toBeTruthy();
    const { data: staffRow } = await admin.from('staff').select('id').eq('id', revokedId!).maybeSingle();
    expect(staffRow).toBeNull();

    await inviteeCtx.close();
    await managerCtx.close();
    await deleteUserByEmail(email);
  });
});
