import { test, expect } from '@playwright/test';
import { WelcomePage } from '../pages/WelcomePage';
import { ShopSetupPage } from '../pages/ShopSetupPage';
import { OperationalSetupPage } from '../pages/OperationalSetupPage';
import { LoginPage } from '../pages/LoginPage';
import { createConfirmedUser, deleteUserByEmail } from '../helpers/supabaseAdmin';

/**
 * FLOW 7: Onboarding completo (Fase 6.0.2 — UX)
 *
 * Critérios de aceite do PO (2026-08-05), sem intervenção manual:
 *   criar conta -> confirmar e-mail -> provisionar tenant -> configurar loja
 *   -> finalizar onboarding -> Dashboard -> checklist persistente.
 *
 * Este cenário cobre a jornada inteira do NOVO tenant na UX nova:
 *   provision (Admin API, confirmado) -> Welcome (Bloco 1) -> ShopSetup
 *   (Bloco 2) -> OperationalSetup (Bloco 3) -> Dashboard com OnboardingChecklist
 *   (Bloco 4) — "Loja criada" marcado, links dos demais itens funcionais.
 *
 * Também valida que as rotas legadas /onboarding/role e
 * /onboarding/professional-setup foram removidas (fallback para /).
 *
 * Gate: E2E_PROVISIONING=1 (requer Supabase real + .env.local).
 */
const enabled = process.env.E2E_PROVISIONING === '1';

test.describe('Flow 7 — Onboarding Completo (Phase 6.0.2)', () => {
  const email = `e2e-onboarding-${Date.now()}@gmail.com`;
  const password = 'E2e-Onboarding-2026!';

  test.skip(!enabled, 'Requires E2E_PROVISIONING=1 and real Supabase in .env.local');

  test('full onboarding journey -> dashboard with checklist -> legacy routes removed', async ({ page }) => {
    test.setTimeout(180_000);

    // 1. User confirmed via Admin API (equivale a cadastrar + confirmar e-mail).
    const userId = await createConfirmedUser({
      email,
      password,
      userMetadata: {
        first_name: 'E2E',
        last_name: 'Onboarding',
        shop_name: 'E2E Onboarding Barbershop',
      },
    });
    expect(userId).toBeTruthy();

    // 2. Login -> auto-provision -> /onboarding/welcome.
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.emailInput.fill(email);
    await loginPage.passwordInput.fill(password);
    await loginPage.submitButton.click();
    await page.waitForURL(/#\/onboarding\/welcome/, { timeout: 60_000 });

    // 3. Bloco 1 — Welcome: conteúdo e navegação.
    const welcome = new WelcomePage(page);
    await expect(welcome.heading).toBeVisible({ timeout: 10_000 });
    await expect(welcome.planBadge).toBeVisible();
    await expect(page.getByText(/Vamos configurar a E2E Onboarding Barbershop/)).toBeVisible();
    await welcome.begin();

    // 4. Bloco 2 — ShopSetup: 3 passos até operacional.
    const shopSetup = new ShopSetupPage(page);
    await expect(shopSetup.shopNameInput).toBeVisible({ timeout: 15_000 });
    await expect(shopSetup.shopNameInput).toHaveValue('E2E Onboarding Barbershop');
    await shopSetup.completeStep1({ phone: '(11) 98888-7777', cnpj: '98.765.432/0001-10' });
    await expect(shopSetup.zipInput).toBeVisible({ timeout: 15_000 });
    await shopSetup.completeStep2({
      zip: '20040-020',
      street: 'Rua da Carioca',
      number: '55',
      city: 'Rio de Janeiro',
      state: 'RJ',
      chairCount: 5,
    });
    await expect(shopSetup.timezoneSelect).toBeVisible({ timeout: 15_000 });
    await shopSetup.completeStep3({ timezone: 'America/Sao_Paulo', currency: 'BRL' });

    // 5. Bloco 3 — OperationalSetup: defaults + finalizar -> /dashboard.
    await page.waitForURL(/#\/onboarding\/operational-setup/, { timeout: 20_000 });
    const operational = new OperationalSetupPage(page);
    await expect(operational.heading).toBeVisible({ timeout: 15_000 });
    await operational.finish();
    await page.waitForURL(/#\/dashboard/, { timeout: 20_000 });

    // 6. Bloco 4 — Checklist no dashboard: visível com "Loja criada" marcado.
    const checklist = page.locator('div').filter({ hasText: /Comece por aqui/ }).first();
    await expect(checklist).toBeVisible({ timeout: 15_000 });
    await expect(checklist.getByText('Loja criada')).toBeVisible();
    // A barbearia entrou em operação -> o checklist marca o primeiro item e
    // apresenta os demais passos com links de ação.
    await expect(checklist.getByText('Adicionar barbeiros')).toBeVisible();
    await expect(checklist.getByText('Cadastrar serviços')).toBeVisible();
    await expect(checklist.getByText('Adicionar clientes')).toBeVisible();
    await expect(checklist.getByText('Fazer primeiro agendamento')).toBeVisible();
    await expect(checklist.getByText(/^\d+ de 5 passos/)).toBeVisible();
    const link = checklist.getByRole('link', { name: /Começar/ }).first();
    await expect(link).toHaveAttribute('href', /\/#\/team/);

    // 7. Rotas legadas removidas -> fallback para "/" (Landing).
    await page.goto('/#/onboarding/role');
    await page.waitForURL(/#\/$/, { timeout: 10_000 });
    await page.goto('/#/onboarding/professional-setup');
    await page.waitForURL(/#\/$/, { timeout: 10_000 });
  });

  test.afterEach(async () => {
    if (!enabled) return;
    try {
      await deleteUserByEmail(email);
    } catch (err) {
      console.warn(`[flow7] cleanup failed for ${email}:`, err);
    }
  });
});
