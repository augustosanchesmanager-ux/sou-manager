// Decodifica o texto do PDF: extrai CMaps /ToUnicode e resolve hex strings <...> Tj.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PDF = path.join(__dirname, 'relatorio-auditoria-seguranca.pdf');
const buf = fs.readFileSync(PDF);
const txt = buf.toString('latin1');

// 1) Descomprime todas as streams
function decompressAll() {
  const parts = [];
  let pos = 0;
  while (true) {
    const idx = txt.indexOf('stream', pos);
    if (idx === -1) break;
    let dataStart = idx + 6;
    if (txt[dataStart] === '\r' && txt[dataStart + 1] === '\n') dataStart += 2;
    else if (txt[dataStart] === '\n') dataStart += 1;
    const end = txt.indexOf('endstream', dataStart);
    if (end === -1) break;
    const raw = Buffer.from(txt.slice(dataStart, end), 'latin1');
    try { parts.push({ raw: zlib.inflateSync(raw).toString('latin1'), start: dataStart }); }
    catch (e) { /* skip non-flate */ }
    pos = end + 9;
  }
  return parts;
}
const streams = decompressAll();
console.log('Streams:', streams.length);

// 2) Extrai CMaps ToUnicode (são streams separadas ou objetos)
// Reunimos TODAS as streams (inclui as do CMap). O CMap contém "/bfchar" e "beginbfchar" com mapeamentos <src> <dst>.
const all = streams.map((s) => s.raw).join('\n');

// 3) Constrói um mapa de glyph->unicode a partir dos bfchar/bfrange em todas as streams
const cmap = new Map();
const bfcharRe = /beginbfchar([\s\S]*?)endbfchar/g;
let m;
let cmapStreams = 0;
for (const s of streams) {
  const body = s.raw;
  if (!/bfchar|bfrange/.test(body)) continue;
  cmapStreams++;
  const re2 = /beginbfchar([\s\S]*?)endbfchar/g;
  let mm;
  while ((mm = re2.exec(body)) !== null) {
    const inner = mm[1];
    const pairs = [...inner.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)];
    for (const p of pairs) {
      cmap.set(p[1].toLowerCase(), String.fromCodePoint(parseInt(p[2], 16)));
    }
  }
  const re3 = /beginbfrange([\s\S]*?)endbfrange/g;
  let mm3;
  while ((mm3 = re3.exec(body)) !== null) {
    const inner = mm3[1];
    const tris = [...inner.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)];
    for (const t of tris) {
      const lo = parseInt(t[1], 16), hi = parseInt(t[2], 16);
      let code = parseInt(t[3], 16);
      for (let c = lo; c <= hi; c++) {
        cmap.set(c.toString(16).padStart(t[1].length, '0'), String.fromCodePoint(code++));
      }
    }
  }
}
console.log('Streams com CMap:', cmapStreams, '| glyphs mapeados:', cmap.size);

// 4) Percorre as streams de conteúdo e decodifica hex strings seguida de Tj
function decodeContent(str) {
  let out = '';
  const hexRe = /<([0-9A-Fa-f]+)>\s*Tj/g;
  let mm4;
  while ((mm4 = hexRe.exec(str)) !== null) {
    let hex = mm4[1].toLowerCase();
    // pares de hex -> bytes -> chars
    for (let i = 0; i + 3 < hex.length + 1 && i < hex.length; i += 4) {
      const code = hex.slice(i, i + 4); // pode ser 2 ou 4 dígitos
      const key = code.length >= 4 ? code : code;
      out += cmap.get(code) || cmap.get(code.slice(-4)) || '';
    }
  }
  return out;
}

let decoded = '';
for (const s of streams) {
  if (/bfchar|bfrange|CIDFontType/.test(s.raw) || s.raw.includes('ToUnicode')) continue; // pula CMaps
  decoded += decodeContent(s.raw);
}
console.log('\n--- Verificação de conteúdo decodificado ---');
const checks = ['Resumo Executivo', 'Pontos Fortes', 'bulk_close', 'get_role_permissions',
  'admin-create-user', 'service_role', 'document.write', 'Issues para o GitHub',
  'ISSUE 1', 'ISSUE 9', 'Vercel', 'Severidade', 'Recomenda'];
for (const c of checks) {
  console.log(`${decoded.includes(c) ? '[OK]' : '[FALTA]'} "${c}"  ${decoded.includes(c) ? '' : '(char=' + (c.charCodeAt(0).toString(16)) + ')'}`);
}
console.log('\nAmostra decodificada (300 chars):');
console.log(decoded.slice(0, 300));
