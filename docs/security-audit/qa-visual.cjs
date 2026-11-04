// QA visual: renderiza o HTML do relatório e captura screenshots (página por página via print).
// Uso: node docs/security-audit/qa-visual.cjs
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const HTML = path.join(__dirname, 'assets', 'relatorio.html');
const OUT = path.join(__dirname, 'assets');

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 920, height: 1200 }, deviceScaleFactor: 2 });
  await page.goto('file://' + HTML.replace(/\\/g, '/'), { waitUntil: 'load' });
  await page.addStyleTag({ content: `@page{size:A4;margin:0;}` });

  // Captura a página inteira (full page) - útil para ver gráficos/tabelas
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.screenshot({ path: path.join(OUT, 'qa-full.png'), fullPage: true });
  console.log('Screenshot full-page salvo.');

  // Estatísticas de texto/estrutura
  const stats = await page.evaluate(() => ({
    h1: document.querySelectorAll('h1').length,
    h2: document.querySelectorAll('h2').length,
    svg: document.querySelectorAll('svg').length,
    rows: document.querySelectorAll('table tr').length,
    issues: document.querySelectorAll('.issue-block').length,
    recos: document.querySelectorAll('.reco').length,
    height: document.body.scrollHeight,
  }));
  console.log('Estrutura:', JSON.stringify(stats, null, 2));
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
