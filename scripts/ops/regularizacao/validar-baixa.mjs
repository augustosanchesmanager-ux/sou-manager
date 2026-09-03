// validar-baixa.mjs — VALIDAÇÃO PÓS-EXEC (read-only) da regularização das 354 comandas.
//
// Executar APÓS a baixa (executar-baixa.mjs) para confirmar que o banco reflete a
// baixa: comandas quitadas, transactions criadas, appointments completed, 0 comissões,
// 0 alterações nas 3 exceções. Não faz NENHUMA escrita.
//
// ⚠ ALVO OBRIGATÓRIO: PRODUÇÃO (ushsnmlbeurfvlkieiln). Recusa staging. NÃO lê .env.local.
//
// USO (variáveis de ambiente de PRODUÇÃO):
//   $env:SUPA_PRODUCTION_URL   = "https://ushsnmlbeurfvlkieiln.supabase.co"
//   $env:SUPA_PRODUCTION_ANON  = "<anon key DO PROJETO DE PRODUÇÃO>"
//   $env:REG_ADMIN_EMAIL       = "<admin do tenant ou superadmin, em PRODUÇÃO>"
//   $env:REG_ADMIN_PASSWORD    = "<senha real em PRODUÇÃO>"
//   node scripts/ops/regularizacao/validar-baixa.mjs
//
// Saída: resumo JSON + `validacao-baixa.json` com a tabela por comanda.

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

const PROD_URL = 'https://ushsnmlbeurfvlkieiln.supabase.co';
const URL = process.env.SUPA_PRODUCTION_URL || PROD_URL;
const ANON = process.env.SUPA_PRODUCTION_ANON;
const ADMIN_EMAIL = process.env.REG_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.REG_ADMIN_PASSWORD;
const TENANT = 'b716e290-f7f6-4449-b790-5ae9dcdadcab';

const STAGING = 'tjcvuhynckocmvtqykxp';
if (URL.includes(STAGING)) {
  console.error('ERRO: este validador é para PRODUÇÃO. Recusando operar contra o staging (' + STAGING + ').');
  process.exit(2);
}
if (URL !== PROD_URL) {
  console.error('ERRO: URL de alvo inesperada. Esperado ' + PROD_URL + ', recebido ' + URL);
  process.exit(2);
}
if (!ANON) {
  console.error('ERRO: defina SUPA_PRODUCTION_ANON com a anon key do projeto de PRODUÇÃO (ushsnmlbeurfvlkieiln).');
  process.exit(2);
}
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('ERRO: defina REG_ADMIN_EMAIL e REG_ADMIN_PASSWORD com as credenciais reais de PRODUÇÃO.');
  process.exit(2);
}

const EXCETOES = [
  'd2845e32-a20c-47c7-9484-7992487c744b',
  '00f8d667-77ef-4f34-aa4b-c361ad457768',
  'ac5711a5-5b84-4081-b4c2-b77fd7a192be',
];

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('ERRO: defina REG_ADMIN_EMAIL e REG_ADMIN_PASSWORD.');
  process.exit(1);
}

const supabase = createClient(URL, ANON);
const { data: sess, error: loginErr } = await supabase.auth.signInWithPassword({
  email: ADMIN_EMAIL,
  password: ADMIN_PASSWORD,
});
if (loginErr || !sess?.session) {
  console.error('FALHA NO LOGIN:', loginErr?.message || 'sem sessão');
  process.exit(1);
}

// Carrega as 354 comandas do dry-run (fonte dos ids).
const jsonPath = join(__dirname, 'dryrun-comandas-abertas-ate-2026-07-31.json');
let rawJson = readFileSync(jsonPath, 'utf8');
if (rawJson.charCodeAt(0) === 0xfeff) rawJson = rawJson.slice(1);
const rows = JSON.parse(rawJson).rows;
const alvo = rows.filter((r) => r.saldo > 0); // 354
const ids = alvo.map((r) => r.comanda_id);

// 1. Status das comandas (read-only)
const { data: comandas, error: errC } = await supabase
  .from('comandas')
  .select('id,status,payment_method,source,payment_date_real')
  .in('id', ids);
if (errC) { console.error('Erro lendo comandas:', errC.message); process.exit(1); }
const porId = new Map(comandas.map((c) => [c.id, c]));

// 2. Transactions de regularização criadas (source_type='comanda', idempotency 'regularizacao-set-*')
const { data: tx, error: errT } = await supabase
  .from('transactions')
  .select('id,source_type,transaction_type,idempotency_key,amount')
  .in('idempotency_key', ids.map((id) => `regularizacao-set-${id.toLowerCase()}`));
if (errT) { console.error('Erro lendo transactions:', errT.message); process.exit(1); }
const txPorKey = new Map(tx.map((t) => [t.idempotency_key, t]));

// 3. Appointments linked → completed
const { data: appts, error: errA } = await supabase
  .from('appointments')
  .select('id,comanda_id,status')
  .in('comanda_id', ids);
if (errA) { console.error('Erro lendo appointments:', errA.message); process.exit(1); }
const apptPorComanda = new Map();
for (const a of appts) apptPorComanda.set(a.comanda_id, a.status);

// 4. Comissões criadas nas 354 (deve ser 0)
const { data: comm, error: errM } = await supabase
  .from('commission_records')
  .select('id')
  .in('comanda_id', ids);
if (errM) { console.error('Erro lendo commission_records:', errM.message); process.exit(1); }

// 5. Exceções inalteradas (devem continuar com status original, NÃO 'paid')
const { data: excecoes, error: errE } = await supabase
  .from('comandas')
  .select('id,status,total')
  .in('id', EXCETOES);
if (errE) { console.error('Erro lendo exceções:', errE.message); process.exit(1); }
const excAlteradas = excecoes.filter((e) => e.status === 'paid');

// ── Consolidação ──
const reporte = alvo.map((r) => {
  const c = porId.get(r.comanda_id);
  const key = `regularizacao-set-${r.comanda_id.toLowerCase()}`;
  const t = txPorKey.get(key);
  return {
    comanda_id: r.comanda_id,
    cliente: r.cliente,
    saldo_anterior: r.saldo,
    status_final: c?.status ?? '?',
    quitada: c?.status === 'paid',
    transaction_criada: Boolean(t),
    transaction_type: t?.transaction_type ?? null,
    transaction_amount: t?.amount ?? null,
    appointment_status: apptPorComanda.get(r.comanda_id) ?? '(sem appointment)',
    appointment_completed: apptPorComanda.get(r.comanda_id) === 'completed',
  };
});

const quitadas = reporte.filter((x) => x.quitada).length;
const comTx = reporte.filter((x) => x.transaction_criada).length;
const apptsComp = reporte.filter((x) => x.appointment_completed).length;

const resumo = {
  tenant: TENANT,
  total_alvo: alvo.length,
  comandas_quitadas_paid: quitadas,
  comandas_nao_quitadas: alvo.length - quitadas,
  transactions_regularizacao_criadas: comTx,
  appointments_completed: apptsComp,
  comissoes_criadas_nas_354: comm?.length ?? 0,
  excecoes_que_ficaram_paid: excAlteradas.length,
  excecoes_estado: excecoes.map((e) => ({ id: e.id, status: e.status, total: e.total })),
  integridade_ok:
    quitadas === alvo.length &&
    comTx === alvo.length &&
    comm?.length === 0 &&
    excAlteradas.length === 0,
};

console.log('\n===== VALIDAÇÃO PÓS-EXEC =====');
console.log(JSON.stringify(resumo, null, 2));
writeFileSync(join(__dirname, 'validacao-baixa.json'), JSON.stringify({ resumo, reporte }, null, 2), 'utf8');
console.log(`\nDetalhe por comanda: scripts/ops/regularizacao/validacao-baixa.json`);
if (resumo.integridade_ok) {
  console.log('\n✅ INTEGRIDADE OK: 354 quitadas, 354 tx criadas, 0 comissões, exceções intactas.');
} else {
  console.log('\n⚠️ INTEGRIDADE DIVERGENTE — revisar antes de encerrar.');
}
