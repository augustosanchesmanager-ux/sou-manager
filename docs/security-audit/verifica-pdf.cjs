// Verificação rigorosa do PDF: conta páginas e extrai texto para confirmar conteúdo real.
// Uso: node docs/security-audit/verifica-pdf.cjs
const fs = require('fs');
const path = require('path');
const PDF = path.join(__dirname, 'relatorio-auditoria-seguranca.pdf');

const buf = fs.readFileSync(PDF);
console.log('Tamanho (bytes):', buf.length);

// /Count — número de páginas
const txt = buf.toString('latin1');
const counts = [...txt.matchAll(/\/Count\s+(\d+)/g)].map((m) => parseInt(m[1], 10));
console.log('Marcas /Count (páginas):', counts.join(', '));

// Verifica presença de conteúdo-chave (strings de texto aparecem no PDF como literais)
const checks = [
  ['Resumo Executivo', 'resumo executivo'],
  ['Pontos Fortes', 'pontos fortes'],
  ['bulk_close_comandas_admin', 'achado cr�tico'],
  ['get_role_permissions', 'achado RPC'],
  ['admin-create-user', 'achado escalacao'],
  ['service_role', 'chave service role'],
  ['document.write', 'achado XSS'],
  ['Issues para o GitHub', 'secao issues'],
  ['ISSUE 1', 'issue 1'],
  ['ISSUE 9', 'issue 9'],
  ['Vercel', 'vercel'],
];
for (const [label, key] of checks) {
  const found = txt.includes(label);
  console.log(`${found ? '[OK]' : '[FALTA]'} "${label}" ${found ? '' : '(nao encontrado no PDF)'}`);
}

// O PDF é texto puro? (streams comprimidas escondem o texto em FlateDecode)
const hasFlate = txt.includes('FlateDecode');
console.log('Usa FlateDecode (texto comprimido):', hasFlate);
console.log('Total de páginas estimado:', counts.length ? Math.max(...counts) : 'desconhecido');
