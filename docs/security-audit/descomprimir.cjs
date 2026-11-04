// Descomprime streams FlateDecode do PDF e verifica conteúdo textual real.
// Uso: node docs/security-audit/descomprimir.cjs
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PDF = path.join(__dirname, 'relatorio-auditoria-seguranca.pdf');
const buf = fs.readFileSync(PDF);
const txt = buf.toString('latin1');

// Localiza stream ... endstream e descomprime
const re = /stream\r?\n/g;
let pos = 0;
let decompressed = '';
let count = 0;
let idx;
const len = buf.length;
while ((idx = txt.indexOf('stream', pos)) !== -1) {
  // acha início dos dados após "stream\r\n"
  let dataStart = idx + 6;
  if (txt[dataStart] === '\r' && txt[dataStart + 1] === '\n') dataStart += 2;
  else if (txt[dataStart] === '\n') dataStart += 1;
  const end = txt.indexOf('endstream', dataStart);
  if (end === -1) break;
  const raw = Buffer.from(txt.slice(dataStart, end), 'latin1');
  try {
    decompressed += zlib.inflateSync(raw).toString('latin1');
    count++;
  } catch (e) { /* stream não flate */ }
  pos = end + 9;
}

console.log('Streams descomprimidas:', count);
const checks = ['Resumo Executivo', 'Pontos Fortes', 'bulk_close_comandas_admin',
  'get_role_permissions', 'admin-create-user', 'service_role', 'document.write',
  'Issues para o GitHub', 'ISSUE 1', 'ISSUE 9', 'Vercel', 'relatorio', 'RPC', 'Severidade'];
for (const c of checks) {
  console.log(`${decompressed.includes(c) ? '[OK]' : '[FALTA]'} "${c}"`);
}
console.log('Tamanho do texto descomprimido:', decompressed.length);
