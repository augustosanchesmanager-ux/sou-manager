// ============================================================
// EXECUTOR DA REGULARIZAÇÃO FINANCEIRA (H7.3) — PRODUÇÃO — Sessão autenticada real
// ============================================================
// Mecanismo oficial: finance_settle_comanda (auth.uid() com permissão de gestão)
// SEM bypass de auth, sem service_role, sem impersonação.
//
// ⚠ ALVO OBRIGATÓRIO: PRODUÇÃO (ushsnmlbeurfvlkieiln). Este script RECUSA rodar
//    contra o staging (tjcvuhynckocmvtqykxp). Ele NÃO lê .env.local (que aponta
//    para staging) — exige as variáveis de ambiente de PRODUÇÃO abaixo.
//
// COMO USAR — PRODUÇÃO (variáveis de ambiente, NÃO arquivos):
//   $env:SUPA_PRODUCTION_URL   = "https://ushsnmlbeurfvlkieiln.supabase.co"
//   $env:SUPA_PRODUCTION_ANON  = "<anon key DO PROJETO DE PRODUÇÃO>"
//   $env:REG_ADMIN_EMAIL       = "<admin do tenant OU superadmin, em PRODUÇÃO>"
//   $env:REG_ADMIN_PASSWORD    = "<senha real dessa conta em PRODUÇÃO>"
//   node scripts/ops/regularizacao/executar-baixa.mjs --dry
//   node scripts/ops/regularizacao/executar-baixa.mjs          (executa de fato)
//
// O script faz login real via Supabase Auth (signInWithPassword) e chama
// finance_settle_comanda para cada comanda NA SESSÃO DO USUÁRIO logado,
// idêntico ao que o app faz (settleCheckoutComanda). SEM impersonação/service_role.
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');

// ── Credenciais (PRODUÇÃO obrigatória — não lê .env.local de staging) ──
const PROD_URL = 'https://ushsnmlbeurfvlkieiln.supabase.co';
const URL = process.env.SUPA_PRODUCTION_URL || PROD_URL;
const ANON = process.env.SUPA_PRODUCTION_ANON;
const ADMIN_EMAIL = process.env.REG_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.REG_ADMIN_PASSWORD;

const STAGING = 'tjcvuhynckocmvtqykxp';
if (URL.includes(STAGING)) {
  console.error('ERRO: este executor é para PRODUÇÃO. Recusando operar contra o staging (' + STAGING + ').');
  process.exit(2);
}
if (URL !== PROD_URL) {
  console.error('ERRO: URL de alvo inesperada. Esperado ' + PROD_URL + ', recebido ' + URL);
  process.exit(2);
}

const isDry = process.argv.includes('--dry');
const TENANT = 'b716e290-f7f6-4449-b790-5ae9dcdadcab';

if (!ANON) {
  console.error('ERRO: defina SUPA_PRODUCTION_ANON com a anon key do projeto de PRODUÇÃO (ushsnmlbeurfvlkieiln).');
  process.exit(2);
}
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error(
    'ERRO: defina REG_ADMIN_EMAIL e REG_ADMIN_PASSWORD com as credenciais reais de ' +
    'uma conta válida em PRODUÇÃO (admin do tenant ou superadmin).'
  );
  process.exit(2);
}

// ── Ler conjunto do DRY-RUN aprovado (354) ──
const jsonPath = path.join(__dirname, 'dryrun-comandas-abertas-ate-2026-07-31.json');
let rawJson = readFileSync(jsonPath, 'utf8');
if (rawJson.charCodeAt(0) === 0xfeff) rawJson = rawJson.slice(1); // remove BOM
const rows = JSON.parse(rawJson).rows;
const EXCLUIR = new Set([
  'd2845e32-a20c-47c7-9484-7992487c744b',
  'ac5711a5-5b84-4081-b4c2-b77fd7a192be',
  '00f8d667-77ef-4f34-aa4b-c361ad457768',
]);
const aBaixar = rows
  .filter((r) => !EXCLUIR.has(r.comanda_id))
  .filter((r) => Number(r.saldo) > 0)
  .map((r) => ({
    comandaId: r.comanda_id,
    cliente: r.cliente,
    saldoAnterior: Number(r.saldo),
    statusAntes: r.status_atual,
  }));

console.log(`Conjunto a baixar: ${aBaixar.length} comandas | tenant ${TENANT}`);
if (isDry) {
  const soma = aBaixar.reduce((s, r) => s + r.saldoAnterior, 0);
  console.log(`[DRY] Total R$ ${soma.toFixed(2)}. Nenhuma escrita será feita.`);
  console.log(`[DRY] Este modo apenas autentica e VALIDA a sessão (auth.uid resolvido).`);
}

// ── Login real ──
const supabase = createClient(URL, ANON);
const { data: sess, error: loginErr } = await supabase.auth.signInWithPassword({
  email: ADMIN_EMAIL,
  password: ADMIN_PASSWORD,
});
if (loginErr || !sess?.session) {
  console.error('FALHA NO LOGIN (auth real):', loginErr?.message || 'sem sessão');
  console.error('  status:', loginErr?.status ?? '?', '| code:', loginErr?.code ?? '?', '| name:', loginErr?.name ?? '?');
  console.error('  detalhe completo:', JSON.stringify(loginErr));
  process.exit(1);
}
const uid = sess.session.user.id;
console.log(`Autenticado: ${sess.session.user.email} (uid=${uid})`);

// ── Checar permissão de gestão (leitura, se RLS permitir) — informativo ──
try {
  const { data: me } = await supabase
    .from('staff')
    .select('role')
    .eq('id', uid)
    .eq('tenant_id', TENANT)
    .maybeSingle();
  console.log(`Role no tenant: ${me?.role ?? '(não resolvida por RLS)'}`);
} catch { /* informativo */ }

if (isDry) {
  console.log('[DRY] Sessão autenticada OK. Nenhuma RPC executada.');
  process.exit(0);
}

// ── Executar baixas (uma por comanda, na sessão autenticada) ──
const results = [];
let erros = 0;
for (const c of aBaixar) {
  const { data, error } = await supabase.rpc('finance_settle_comanda', {
    p_tenant_id: TENANT,
    p_comanda_id: c.comandaId,
    p_payment_method: 'regularizacao',
    p_paid_amount: c.saldoAnterior,
    p_payment_date_real: c.data_comanda, // created_at histórico
    p_source: 'regularizacao',
    p_notes: 'regularizacao financeira ate 31/07/2026',
    p_idempotency_key: `regularizacao-set-${c.comandaId.toLowerCase()}`,
  });
  if (error) {
    erros++;
    results.push({ comandaId: c.comandaId, cliente: c.cliente, ok: false, erro: error.message });
  } else {
    results.push({
      comandaId: c.comandaId,
      cliente: c.cliente,
      ok: data?.success === true,
      idempotent: Boolean(data?.idempotent),
      transaction_id: data?.transaction_id || null,
    });
  }
}

// ── Relatório resumido ──
const okCount = results.filter((r) => r.ok).length;
console.log(`\nProcessadas: ${results.length} | OK: ${okCount} | Erros: ${erros}`);
const outCsv = path.join(ROOT, 'scripts/ops/regularizacao/resultado-baixa.csv');
const header = 'comanda_id,cliente,saldo_anterior,valor_baixado,saldo_final,status_final';
const lines = aBaixar.map((c) => {
  const r = results.find((x) => x.comandaId === c.comandaId);
  const ok = r?.ok ? 'paid' : 'open';
  const baixado = r?.ok ? c.saldoAnterior : 0;
  const saldoFinal = r?.ok ? 0 : c.saldoAnterior;
  return `${c.comandaId},${(c.cliente||'').replace(/,/g,' ')},${c.saldoAnterior},${baixado},${saldoFinal},${ok}`;
});
import { writeFileSync } from 'node:fs';
writeFileSync(outCsv, [header, ...lines].join('\n'), 'utf8');
console.log(`Relatório CSV: ${outCsv}`);
if (erros > 0) {
  console.log('\nErros:');
  results.filter((r) => !r.ok).forEach((r) => console.log(`  ${r.comandaId} -> ${r.erro}`));
}
