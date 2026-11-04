// Verifica o PDF: conta páginas e rasteriza cada página em PNG.
// Uso: node docs/security-audit/verificar.cjs
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const PDF = path.join(__dirname, 'relatorio-auditoria-seguranca.pdf');
const OUT = path.join(__dirname, 'assets');

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1000, height: 1400 }, deviceScaleFactor: 2 });

  // Conta páginas lendo o /Count do PDF
  const buf = fs.readFileSync(PDF);
  const txt = buf.toString('latin1');
  const counts = [...txt.matchAll(/\/Count\s+(\d+)/g)].map((m) => parseInt(m[1], 10));
  const pageCount = counts.length ? Math.max(...counts) : 'desconhecido';
  console.log('Tamanho (bytes):', buf.length);
  console.log('Marcas /Count:', counts.join(', ') || 'não encontradas');
  console.log('Páginas estimadas:', pageCount);

  // Abre o PDF no Chromium e tira screenshot das páginas
  await page.goto('file://' + PDF.replace(/\\/g, '/'), { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  // Tenta rasterizar via plugin pdf do chromium
  const n = typeof pageCount === 'number' ? pageCount : 1;
  for (let i = 1; i <= Math.min(n, 8); i++) {
    try {
      const frame = page.frames().find((f) => f.url().includes('.pdf'));
      // não é trivial navegar por páginas; tira screenshot do doc todo
      await page.screenshot({ path: path.join(OUT, `pagina-${i}.png`) });
      console.log('Screenshot página', i, 'OK');
      break; // uma screenshot do doc inteiro basta para inspecionar
    } catch (e) {
      console.log('erro screenshot', i, e.message);
    }
  }
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
