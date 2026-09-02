# D8 — Worker Gate (Implementation: Gates B/C/D)

**Status:** IMPLEMENTED (aguarda deploy/certificação — PO)
**Date:** 2026-08-27
**Contract:** ADR-016 Amendment-03 (Core Sharing & Integrity Contract) **🟢 APPROVED**
**AUTHORIZED BY PO:** D8 Worker implementation (Gates B/C/D)
**Branch:** `fix/checkout-staff-attribution`

---

## 1. O que foi implementado

| Gate | Entregável | Arquivo |
|------|-----------|---------|
| B | Deterministic core export (esbuild→Deno self-contained) | `scripts/d8/export-core.mjs` |
| B | Integrity manifest | `supabase/functions/_shared/financial-core/core.sha256.json` |
| B | **Artefato gerado** (não editar à mão) | `supabase/functions/_shared/financial-core/index.ts` |
| B | Commands | `npm run d8:build` / `npm run d8:verify` (package.json) |
| C | Worker calculation (reuso do Core, sem I/O) | `supabase/functions/worker-dispatcher/calculate.ts` |
| C | Worker orchestrator (claim→context→calc→insert→mark→heartbeat) | `supabase/functions/worker-dispatcher/index.ts` |
| C | JWT minting `worker_dispatcher` role (Web Crypto, sem deps) | `supabase/functions/worker-dispatcher/jwt.ts` |
| C | Function config | `supabase/functions/worker-dispatcher/config.toml` |
| C | Schedule descriptor (D-5: Supabase Cron) | `supabase/migrations/20260827210000_d8_worker_schedule.sql` |
| C | Equivalence test (prova) | `tests/d8/equivalence.test.ts` |

## 2. Arquitetura (Option B — PO)

```text
domain/commission/{calculate,participants,types}.ts
shared/numbers/normalize.ts            ← SOURCE OF TRUTH (única)
        │  npm run d8:build  (esbuild 0.25.12 → Deno, self-contained)
        ▼
supabase/functions/_shared/financial-core/index.ts   ← ARTEFATO GERADO
        │  import '../_shared/financial-core/index.ts'  (dentro de supabase/functions/,
        ▼   empacotado estavelmente pelo CLI v2.95.6 — sem import externo experimental)
supabase/functions/worker-dispatcher/calculate.ts      ← cálculo puro (0 I/O)
        ▼
supabase/functions/worker-dispatcher/index.ts          ← orquestração (narrow RPCs)
        ▼
PostgreSQL (worker_dispatcher role, 6 RPCs approved)
```

## 3. Evidência (Gates B/C/D)

### 3.1 Core integrity gate (`npm run d8:verify`) — PASS
```
D8:VERIFY OK — canonical Core == worker artifact (byte-identical), API intact.
```
- Recomputa SHA-256 dos 4 fontes canônicos → confere `core.sha256.json.source`.
- Rebuild em temp dir → compara byte-a-byte com o artefato commitado.
- Verifica `consumerBlobs` (API da superfície) intacta.
- Agora `d8:verify` é **STOP obrigatório** no deploy do worker.

### 3.2 Equivalence (prova, não assertiva) — `tests/d8/equivalence.test.ts` **5/5 PASS**
- `isCommissionEligible` ≡ `receivesCommission` (matriz barber/seller/manager/receptionist, rates 0/50/0.5/null).
- `getEffectiveRate` ≡ `getEffectiveCommissionRate`.
- Worker `calculateCommissionRecordsFromContext` emite a **comissão certificada 50.00** para o fixture determinístico da comanda A (barber A solo 100%, unit_price=100, rate 0.5).
- Zero-record em opType não-comissionável / contexto vazio.
- **Isolamento por tenant**: staff só do tenant 2 → sem registro para tenant 1.

> Nota documentada: `isCommissionEligible` (puro) não faz `.trim()`, `receivesCommission` faz. Em dados reais `staff.role` é enum limpo (barber/manager/seller/...), logo equivalente para toda entrada de produção. O worker reusa o MESMO `isCommissionEligible` do caminho browser → idêntico por construção.

### 3.3 Regression
| Checagem | Resultado |
|----------|-----------|
| `npm run build` | ✅ PASS (12.76s) |
| Unit tests | ✅ **1152 passed / 5 pre-existing** (baseline 1147 + 5 D8; zero regressão; as 5 falhas são `src/bootstrap/eventInfrastructure.test.ts`, não relacionadas) |
| `npm run typecheck` | ✅ **zero novos erros** de arquivos D8 (67 pré-existentes em `domain/`/`application/`/`tests/`; `supabase/` excluído do tsconfig) |
| Gate A (SQL surface) | ✅ preservado (migração não tocada) |

## 4. Credencial & segurança (contract PO)

- Worker autentica como **`worker_dispatcher`** (role dedicada mínima, NOLOGIN, sem BYPASSRLS, sem privilégio em tabelas) — via JWT HS256 mintado em `jwt.ts` a partir de `SUPABASE_JWT_SECRET` (Web Crypto, zero deps).
- **`service_role` NÃO** está no caminho de dados do worker (apenas `anon`+bearer com role p/ Kong; RPCs `SECURITY DEFINER` validam tenant).
- RPCs `SECURITY DEFINER` + `search_path=public`, cada um valida `p_tenant_id`/`p_item_id`.
- **RPC nunca calcula comissão** — cálculo exclusivo no Core TS (integridade garantida).
- Cálculo do worker: **0 I/O**, apenas `calculateCommissionRecordsFromContext` puro.

## 5. Ciclo do worker (por execução agendada)

1. `claim_next_outbox_item()` (FOR UPDATE SKIP LOCKED; sem tenant → mais antigo pendente).
2. `get_financial_operation_context(item, tenant)` → monta contexto mínimo (nunca calcula).
3. `calculateCommissionRecordsFromContext(context)` → registros a persistir (puro).
4. `exists_commission_record` + `insert_commission_record` (idempotente).
5. `mark_outbox_item_processed('published' | 'failed')`.
6. `upsert_worker_heartbeat(...)` (liveness server-side).

## 6. STOP conditions do D8 (mantidas)

- 🔴 cálculo duplicado em Deno / PL/pgSQL;
- 🔴 cópia manual divergente no `_shared` (integridade detecta);
- 🔴 import externo dependente de bundler experimental;
- 🔴 `service_role` acessando tabelas diretamente;
- 🔴 alteração da regra financeira certificada sem nova certificação D7;
- 🔴 `d8:verify` falhando → STOP deploy.

## 7. ☑️ FOLLOW-UP (requer decisão PO — escopo além do Gate A aprovado)

**Retry / requeue / dead-letter server-side.** A superfície aprovada no Gate A (`mark_outbox_item_processed`) registra `failed` + `retry_attempts` + `retry_last_error`, mas **não** existe RPC de *requeue* (`failed`→`pending` com `retry_next_retry_at` backoff) nem promoção server-side a `dead_letter` após `maxAttempts`. O lifecycle de retry/dead-letter completo vive no `SupabaseOutbox` (domain, client-side), que não roda para o tenant headless B34H.

- **Impacto:** item que falha fica em `failed` (não re-claimable com a superfície atual; `claim_next_outbox_item` só pega `status='pending' AND retry_next_retry_at IS NULL`).
- **Proposta (não executada — sem widen):** nova migração com `reclaim_failed_outbox_items()` (reset `failed`→`pending` com backoff + promoção a `dead_letter` após `maxAttempts`), reutilizando o `get_outbox_queue_health().stale_processing` como sinal de watchdog. Requer **aprovação do PO** (estende o Data Contract RPC).
- Item legado `63742efa` só é drenado após: (1) deploy do worker, (2) fixture desse item (ou requeue) para `pending`.

## 8. Deploy pendente (não autorizado — PO)

- `supabase functions deploy worker-dispatcher` (CLI v2.95.6, bundle local Docker, `d8:verify` antes).
- Aplicar migração `20260827210000_d8_worker_schedule.sql` (registrar Cron no dashboard — sem hardcode de secret).
- Criar role `worker_dispatcher` no projeto + grants (Gate A migration).
- Definir JWT secret + revalidate.
- Teste de produção/certificação + `63742efa` drain + ADR-015 PROD CERTIFIED (todos exigem PO).

## 9. Reproduzir Gates B/C/D

```powershell
npm run d8:build      # regenera _shared/financial-core/index.ts + manifest
npm run d8:verify     # integrity gate (STOP se divergência)
npx vitest run tests/d8/equivalence.test.ts   # 5/5 PASS
```
