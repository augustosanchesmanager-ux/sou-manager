// Inspeciona o texto descomprimido do PDF para entender a codificação real.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PDF = path.join(__dirname, 'relatorio-auditoria-seguranca.pdf');
const buf = fs.readFileSync(PDF);
const txt = buf.toString('latin1');

const re = /stream\r?\n/g;
let pos = 0;
let decompressed = '';
let count = 0;
let idx;
const len = buf.length;
while ((idx = txt.indexOf('stream', pos)) !== -1) {
  let dataStart = idx + 6;
  if (txt[dataStart] === '\r' && txt[dataStart + 1] === '\n') dataStart += 2;
  else if (txt[dataStart] === '\n') dataStart += 1;
  const end = txt.indexOf('endstream', dataStart);
  if (end === -1) break;
  const raw = Buffer.from(txt.slice(dataStart, end), 'latin1');
  try { decompressed += zlib.inflateSync(raw).toString('latin1'); count++; }
  catch (e) { /* skip */ }
  pos = end + 9;
}

console.log('Streams:', count);
// Procura padrões de texto comum (operadores Tj / TJ e cadeias hex <...>)
const tj = (decompressed.match(/\(/g) || []).length;
const hex = (decompressed.match(/</g) || []).length;
const tjOps = (decompressed.match(/Tj\b/g) || []).length;
const tjOps2 = (decompressed.match(/TJ\b/g) || []).length;
console.log('Qtd "(" (strings PDF):', tj);
console.log('Qtd "Tj":', tjOps, '| Qtd "TJ":', tjOps2);
console.log('Qtd "<" (hex strings):', hex);

// Mostra alguns trechos com operadores de texto
const idxTj = decompressed.indexOf('Tj');
console.log('\n--- Amostra ao redor do primeiro Tj ---');
console.log(JSON.stringify(decompressed.slice(Math.max(0, idxTj - 200), idxTj + 10)));

// Procura por sequências decodificáveis de texto latino (ex.: "Secur")
const plain = decompressed.replace(/\(([^()]*)\)/g, '<$1>');
console.log('\n--- Linhas com "Secur" ou "ABDC" (escape) ---');
const lines = decompressed.split('\n');
lines.slice(0, 0);
