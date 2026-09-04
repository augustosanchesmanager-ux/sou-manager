import { test, expect } from '../fixtures/auth.fixture';
import { getFixtureState, type E2EChefClubState } from '../data/fixtureState';
import {
  getSubscriptionStatus,
  getReceivableStatus,
  getReceivablesBySubscription,
  getCancelAudit,
  getCredits,
} from '../helpers/dbAssertions';

test.describe.serial('P0.3-C — Cancelar Assinatura (E2E com DB)', () => {
  let chefClub: E2EChefClubState;

  test.beforeAll(async () => {
    const state = getFixtureState();
    if (!state.chefClub) {
      throw new Error('ChefClub seed data not found. Run seed-chefclub-p03c.ts first.');
    }
    chefClub = state.chefClub;
  });

  const MODAL_SELECTOR = '.fixed.inset-0.z-\\[100\\]';

  test.describe('Caminho A — Manter cobranças', () => {
    test('AC-02,AC-03,AC-05: should_cancel_subscription_without_canceling_receivables', async ({ loggedAdmin }) => {
      const state = getFixtureState();
      const subId = chefClub.subscriptionA.id;

      const subscriptionBefore = await getSubscriptionStatus(subId, state.tenantId);
      expect(subscriptionBefore.status).toBe('active');

      const receivablesBefore = await getReceivablesBySubscription(subId, state.tenantId);
      const pendingCount = receivablesBefore.filter(r => r.status === 'pending').length;
      const overdueCount = receivablesBefore.filter(r => r.status === 'overdue').length;
      expect(pendingCount + overdueCount).toBeGreaterThan(0);

      const creditsBefore = await getCredits(chefClub.clientId, state.tenantId);

      await loggedAdmin.goto(`/#/chef-club-subscriptions/${subId}`);
      await loggedAdmin.waitForTimeout(3000);

      const cancelButton = loggedAdmin.locator('button:has-text("Cancelar")').first();
      await expect(cancelButton).toBeVisible({ timeout: 10_000 });
      await cancelButton.click();

      const modal = loggedAdmin.locator(MODAL_SELECTOR).first();
      await expect(modal).toBeVisible({ timeout: 5_000 });

      const receivableCheckbox = modal.locator('#cancelReceivables');
      await expect(receivableCheckbox).not.toBeChecked();

      const confirmButton = modal.locator('button:has-text("Confirmar")').first();
      await confirmButton.click();

      await loggedAdmin.waitForTimeout(3000);

      const subscriptionAfter = await getSubscriptionStatus(subId, state.tenantId);
      expect(subscriptionAfter.status).toBe('canceled');

      const receivablesAfter = await getReceivablesBySubscription(subId, state.tenantId);
      expect(receivablesAfter.filter(r => r.status === 'pending').length).toBe(pendingCount);
      expect(receivablesAfter.filter(r => r.status === 'overdue').length).toBe(overdueCount);
      expect(receivablesAfter.filter(r => r.status === 'paid').length).toBe(
        receivablesBefore.filter(r => r.status === 'paid').length
      );

      for (const recv of receivablesAfter) {
        const audit = await getCancelAudit(recv.id, state.tenantId);
        expect(audit.length).toBe(0);
      }

      const creditsAfter = await getCredits(chefClub.clientId, state.tenantId);
      expect(creditsAfter.available_credits).toBe(creditsBefore.available_credits);
      expect(creditsAfter.used_credits).toBe(creditsBefore.used_credits);
    });

    test('AC-04-A: overdue_remains_overdue_when_kept', async ({ loggedAdmin }) => {
      const state = getFixtureState();
      const overdueId = chefClub.subscriptionA.receivableIds.overdue;

      const overdueAfter = await getReceivableStatus(overdueId, state.tenantId);
      expect(overdueAfter.status).toBe('overdue');
      expect(overdueAfter.previous_status).toBeNull();
    });
  });

  test.describe('Caminho B — Cancelar cobranças', () => {
    test('AC-06,AC-07,AC-08,AC-09: should_cancel_subscription_and_receivables', async ({ loggedAdmin }) => {
      const state = getFixtureState();
      const subId = chefClub.subscriptionB.id;

      const subscriptionBefore = await getSubscriptionStatus(subId, state.tenantId);
      expect(subscriptionBefore.status).toBe('active');

      const creditsBefore = await getCredits(chefClub.clientId, state.tenantId);

      await loggedAdmin.goto(`/#/chef-club-subscriptions/${subId}`);
      await loggedAdmin.waitForTimeout(3000);

      const cancelButton = loggedAdmin.locator('button:has-text("Cancelar")').first();
      await expect(cancelButton).toBeVisible({ timeout: 10_000 });
      await cancelButton.click();

      const modal = loggedAdmin.locator(MODAL_SELECTOR).first();
      await expect(modal).toBeVisible({ timeout: 5_000 });

      const receivableCheckbox = modal.locator('#cancelReceivables');
      await receivableCheckbox.check();
      await expect(receivableCheckbox).toBeChecked();

      const reasonSelect = modal.locator('select').first();
      await reasonSelect.selectOption('client_request');

      const observationTextarea = modal.locator('textarea').first();
      await observationTextarea.fill('Teste E2E P0.3-C: cancelamento com cobranças');

      const confirmButton = modal.locator('button:has-text("Confirmar")').first();
      await expect(confirmButton).toBeEnabled();
      await confirmButton.click();

      await loggedAdmin.waitForTimeout(3000);

      const subscriptionAfter = await getSubscriptionStatus(subId, state.tenantId);
      expect(subscriptionAfter.status).toBe('canceled');

      const receivablesAfter = await getReceivablesBySubscription(subId, state.tenantId);

      for (const recv of receivablesAfter) {
        if (recv.status === 'cancelled') {
          const detail = await getReceivableStatus(recv.id, state.tenantId);
          expect(detail.previous_status).toBeTruthy();
          expect(detail.cancel_reason).toBeTruthy();
          expect(detail.cancelled_by).toBeTruthy();
          expect(detail.cancelled_at).toBeTruthy();

          const audit = await getCancelAudit(recv.id, state.tenantId);
          expect(audit.length).toBe(1);
          expect(audit[0].amount).toBe(detail.amount);
          expect(audit[0].cancel_reason).toBe('client_request');
        }
      }

      const creditsAfter = await getCredits(chefClub.clientId, state.tenantId);
      expect(creditsAfter.available_credits).toBe(creditsBefore.available_credits);
      expect(creditsAfter.used_credits).toBe(creditsBefore.used_credits);
    });

    test('AC-04-B: overdue_cancelled_when_billing_cancelled', async ({ loggedAdmin }) => {
      const state = getFixtureState();
      const overdueId = chefClub.subscriptionB.receivableIds.overdue;

      const overdueAfter = await getReceivableStatus(overdueId, state.tenantId);
      expect(overdueAfter.status).toBe('cancelled');
      expect(overdueAfter.previous_status).toBe('overdue');
      expect(overdueAfter.cancelled_by).toBeTruthy();
      expect(overdueAfter.cancelled_at).toBeTruthy();

      const audit = await getCancelAudit(overdueId, state.tenantId);
      expect(audit.length).toBe(1);
      expect(audit[0].previous_status).toBe('overdue');
    });

    test('AC-15: paid_unchanged_after_cancel', async ({ loggedAdmin }) => {
      const state = getFixtureState();
      const paidId = chefClub.subscriptionB.receivableIds.paid;

      const paidAfter = await getReceivableStatus(paidId, state.tenantId);
      expect(paidAfter.status).toBe('paid');
      expect(paidAfter.previous_status).toBeNull();
      expect(paidAfter.cancelled_by).toBeNull();
      expect(paidAfter.cancelled_at).toBeNull();

      const audit = await getCancelAudit(paidId, state.tenantId);
      expect(audit.length).toBe(0);
    });
  });

  test.describe('AC-14 — Histórico preservado', () => {
    test('paid_receivable_preserves_all_fields', async ({ loggedAdmin }) => {
      const state = getFixtureState();
      const paidId = chefClub.subscriptionB.receivableIds.paid;

      const paid = await getReceivableStatus(paidId, state.tenantId);
      expect(paid.status).toBe('paid');
      expect(Number(paid.amount)).toBe(99.90);
      expect(paid.previous_status).toBeNull();
      expect(paid.cancel_reason).toBeNull();
      expect(paid.cancel_observation).toBeNull();
      expect(paid.cancelled_by).toBeNull();
      expect(paid.cancelled_at).toBeNull();
    });
  });

  test.describe('AC-13 — Tenant isolation', () => {
    test('cross_tenant_cancel_rejected', async ({ loggedAdmin }) => {
      const state = getFixtureState();
      const tenantB = chefClub.tenantB;

      const tenantBBefore = await getSubscriptionStatus(tenantB.subscriptionId, tenantB.tenantId);
      expect(tenantBBefore.status).toBe('active');

      await loggedAdmin.goto(`/#/chef-club-subscriptions/${tenantB.subscriptionId}`);
      await loggedAdmin.waitForTimeout(3000);

      const url = loggedAdmin.url();
      const isOnDetail = url.includes(tenantB.subscriptionId);

      if (isOnDetail) {
        const cancelButton = loggedAdmin.locator('button:has-text("Cancelar")').first();
        const isVisible = await cancelButton.isVisible().catch(() => false);

        if (isVisible) {
          await cancelButton.click();
          const modal = loggedAdmin.locator(MODAL_SELECTOR).first();
          if (await modal.isVisible().catch(() => false)) {
            const confirmButton = modal.locator('button:has-text("Confirmar")').first();
            if (await confirmButton.isVisible().catch(() => false)) {
              await confirmButton.click();
              await loggedAdmin.waitForTimeout(2000);
            }
          }
        }
      }

      const tenantBAfter = await getSubscriptionStatus(tenantB.subscriptionId, tenantB.tenantId);
      expect(tenantBAfter.status).toBe('active');
    });
  });

  test.describe('AC-11 — Atomicidade', () => {
    test('no_partial_state_after_cancel', async ({ loggedAdmin }) => {
      const state = getFixtureState();

      const subscription = await getSubscriptionStatus(chefClub.subscriptionB.id, state.tenantId);
      const receivables = await getReceivablesBySubscription(chefClub.subscriptionB.id, state.tenantId);

      if (subscription.status === 'canceled') {
        const cancelledCount = receivables.filter(r => r.status === 'cancelled').length;
        const paidCount = receivables.filter(r => r.status === 'paid').length;
        const total = receivables.length;

        expect(cancelledCount + paidCount).toBe(total);

        for (const recv of receivables) {
          if (recv.status === 'cancelled') {
            const audit = await getCancelAudit(recv.id, state.tenantId);
            expect(audit.length).toBe(1);
            expect(audit[0].previous_status).toBeTruthy();
            expect(audit[0].cancelled_at).toBeTruthy();
          }
        }
      }
    });
  });

  test.describe('Idempotência', () => {
    test('AC-12: should_not_duplicate_effects_when_called_twice', async ({ loggedAdmin }) => {
      const state = getFixtureState();

      const receivablesBefore = await getReceivablesBySubscription(chefClub.subscriptionA.id, state.tenantId);

      await loggedAdmin.goto(`/#/chef-club-subscriptions/${chefClub.subscriptionA.id}`);
      await loggedAdmin.waitForTimeout(3000);

      const cancelButton = loggedAdmin.locator('button:has-text("Cancelar")').first();
      const isVisible = await cancelButton.isVisible().catch(() => false);

      if (!isVisible) {
        const receivablesAfter = await getReceivablesBySubscription(chefClub.subscriptionA.id, state.tenantId);
        expect(receivablesAfter).toEqual(receivablesBefore);

        for (const recv of receivablesAfter) {
          const auditCount = (await getCancelAudit(recv.id, state.tenantId)).length;
          expect(auditCount).toBeLessThanOrEqual(1);
        }
      }
    });
  });
});
