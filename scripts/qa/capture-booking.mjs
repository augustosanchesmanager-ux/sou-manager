/* eslint-disable no-console */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = '.omo/evidence/booking-public-ui';
mkdirSync(OUT, { recursive: true });

const BASE = 'http://localhost:3000/#/agendar/domze';

const run = async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));

  const advance = page.getByRole('button', { name: /avan(ç|c)ar|confirmar agendamento/i });

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/01-services.png`, fullPage: true });

  const serviceRows = page.locator('main button[aria-pressed]');
  await serviceRows.nth(0).click();
  await page.waitForTimeout(150);
  await serviceRows.nth(1).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/02-services-selected.png`, fullPage: true });

  await advance.click({ timeout: 5000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/03-staff.png`, fullPage: true });

  await page.getByRole('button', { name: /qualquer profissional/i }).click();
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/03b-staff-selected.png`, fullPage: true });
  await advance.click({ timeout: 5000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/04-datetime.png`, fullPage: true });

  const datePills = page.locator('button[data-date]:not([disabled])');
  await datePills.nth(1).click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/05-datetime-selected.png`, fullPage: true });

  const slot = page.locator('main button').filter({ hasText: /^\d{2}:\d{2}$/ }).first();
  await slot.click({ timeout: 5000 });
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/06-slot-selected.png`, fullPage: true });

  await advance.click({ timeout: 5000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/07-client-form.png`, fullPage: true });

  await page.locator('#client-name').fill('João da Silva');
  await page.locator('#client-phone').fill('11987654321');
  await page.locator('#client-notes').fill('Prefere máquina 2.');
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/08-client-form-filled.png`, fullPage: true });

  await advance.click({ timeout: 5000 });
  await page.getByRole('heading', { name: 'Agendamento Confirmado!' }).waitFor({ timeout: 10000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/09-success-voucher.png`, fullPage: true });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/10-success-desktop.png`, fullPage: true });

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/11-services-desktop.png`, fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:3000/#/agendar/naoexiste', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/12-not-found.png`, fullPage: true });

  console.log('CONSOLE_ERRORS:', JSON.stringify(errors, null, 2));
  await browser.close();
};

run().catch((e) => {
  console.error('CAPTURE_FAILED', e);
  process.exit(1);
});
