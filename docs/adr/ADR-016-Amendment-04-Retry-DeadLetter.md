# ADR-016 Amendment-04 — Worker Retry/Requeue & Dead-Letter Contract (D8)

**Status:** PRODUCTION CERTIFIED (2026-08-28)
**Date:** 2026-08-27
**Deciders:** PO (Augusto) + OpenCode
**Prerequisite:** Amendment-01 ✅, Amendment-02 ✅, Amendment-03 ✅ (Workers B/C/D implementados, commit `f3a0038`), Gate A 🟢, Equivalence 5/5 🟢
**PO decision (2026-08-27):** retry/requeue **primeiro**, deploy **depois**. Não ampliar o escopo para outras dívidas.
**Theme:** Fechar o lifecycle `failed → retry/backoff → pending` e `failed → dead_letter` server-side, com as mesmas garantias do D8.

---

## 1. Problema (gap confirmado)

O Worker D8 já resolve **autoridade de execução** + **claim atômico** + **processamento server-side**, mas um item que falha fica **preso em `failed`** — não há caminho server-side de recuperação:

```text
pending → claim → processing
                        ├── success → published ✅
                        └── failure → failed 🔴  ← preso (sem retry/dead-letter)
```

Além disso, a predica de claim atual (`retry_next_retry_at IS NULL`) **nunca reclaimaria** um item que fosse re-agendado para retry (com `retry_next_retry_at` no futuro) — backoff não seria honrado.

**Decisão PO:** não deployar com o lifecycle financeiro incompleto. **Amendment-04 cirúrgico** — foco exclusivo em `failed → retry/backoff → pending` e `failed → dead_letter` após limite.

---

## 2. Comportamento alvo (espelha o certificado `SupabaseOutbox.markFailed`)

A semântica já está **certificada** no domínio (`domain/events/outbox/supabaseOutbox.ts`). O RPC server-side **espelha exatamente** (1 fonte de behavior, sem duplicar lógica financeira — apenas transição de estado da fila):

```text
failed (processing)
  ↓
attempts = retry_attempts + 1
  ↓
attempts >= retry_max_attempts (default 5) ?
  ├── SIM → dead_letter (completed_at=now)                    🔴 determinístico
  └── NÃO → pending, retry_attempts=attempts,
            retry_next_retry_at = now + base_delay_ms * 2^(attempts-1)   ← backoff exponencial
            processing_started_at=null, claimed_by=null       └→ reclaimável após o atraso
```

- `retry_attempts` default `0`, `retry_max_attempts` default `5`, `retry_base_delay_ms` default `1000` (schema real `outbox_items`).
- Backoff no `markFailed`: `delayMs = retry_base_delay_ms * 2^(attempts - 1)`.

---

## 3. Superfície RPC (novas/alteradas — estreitas, SECURITY DEFINER)

### 3.1 `handle_processing_failure(p_item_id UUID, p_tenant_id UUID, p_error TEXT) → JSONB` — NOVO
Substitui o `mark_outbox_item_processed('failed')` do worker no caminho de falha.
- **Valida** `tenant_id` (isolamento) + `status='processing'` (só o worker que reclamou pode falhar) — `RAISE` se violar.
- Lê `retry_attempts/max_attempts/base_delay_ms` na linha, computa backoff e faz a transição `processing → pending` (retry) **ou** `processing → dead_letter` (limite), de forma **atômica** (single UPDATE condicionado a `status='processing'` p/ concorrência segura).
- Retorna `{ status, attempts, retry_next_retry_at, dead_letter: bool }`.
- **Nunca** toca no cálculo financeiro — só lifecycle da fila.

### 3.2 `claim_next_outbox_item(...)` — AMENDA a predica (Alteração ao Gate A)
Predica passa de:
```sql
status='pending' AND retry_next_retry_at IS NULL
```
para:
```sql
status='pending' AND (retry_next_retry_at IS NULL OR retry_next_retry_at <= now())
```
Mantém `FOR UPDATE SKIP LOCKED`, `ORDER BY created_at`, tenant-opcional, `processing_started_at/claimed_by`. Isso **honra o backoff**: itens re-agendados voltam a ser "claimable" só após o atraso expirar. (Atualização cirúrgica do RPC do Gate A — sem mudar Data Contract, assinatura ou grants.)

### 3.3 `recover_stale_processing(p_tenant_id UUID DEFAULT NULL) → INTEGER` — NOVO
Espelha `SupabaseOutbox.recoverStaleProcessing` (> 5min em `processing` → `pending`, `processing_started_at=null`, `claimed_by=null`, `retry_next_retry_at=null`, **sem** incrementar tentativas). Retorna nº recuperado. O worker chama no início de cada ciclo (watchdog de itens órfãos/claims abortados). `tenant_id` opcional para varredura por tenant.

### 3.4 Worker — integração
- Caminho de falha: `handle_processing_failure(...)` (não mais `mark_outbox_item_processed('failed')`).
- Início de ciclo: `recover_stale_processing()`.
- `mark_outbox_item_processed` mantém papel de `published` (sucesso). `failed` continua como estado válido histórico do schema, mas o worker **não o produz mais** — usa `handle_processing_failure`.

---

## 4. Garantias preservadas (STOP conditions do D8, todas intactas)

| Garantia | Como |
|----------|------|
| `tenant_id` explícito | cada RPC valida isolamento (RAISE em mismatch) |
| `SECURITY DEFINER` | todos os RPCs, `search_path=public` |
| RPCs estreitas | sem `SELECT *`, sem acesso a tabelas do worker direto |
| Sem `service_role` | continua via role `worker_dispatcher` (JWT mintado) |
| Idempotência financeira | **cálculo D7/comissão INTOCADO**; worker continua com `exists`+`insert` idempotentes |
| Retry limitado | `retry_max_attempts` (default 5) |
| Dead-letter determinístico | `attempts >= max` → `dead_letter` + `completed_at` |
| Observabilidade de transição | `retry_last_error`, `retry_attempts`, `retry_next_retry_at`; `get_outbox_queue_health()` já expõe `failed/dead_letter/stale_processing` |
| Zero mudança no cálculo D7 | nenhum arquivo de `domain/commission/` ou D7 tocado |
| Concorrência segura | `FOR UPDATE SKIP LOCKED` + UPDATE condicionado a `status='processing'` |

---

## 5. Lifecycle final (target)

```text
pending → claim → processing
                        ├── success → published
                        └── failure → handle_processing_failure
                                          ├── retry (backoff) → pending → novo claim
                                          └── dead_letter (após maxAttempts)
processing órfão (>5min) → recover_stale_processing → pending
```

---

## 6. Testes (pós-aprovação — Gate do Amendment-04)

Reuso do harness determinístico (Docker `postgres:15`, tenant de teste, **não** `63742efa`):
1. **Retry:** `handle_processing_failure` numa item com tentativas sobrando → status `pending`, `retry_attempts` incrementado, `retry_next_retry_at` > agora (backoff correto).
2. **Reclaim após backoff:** item retry com `retry_next_retry_at` futuro → `claim_next_outbox_item` retorna NULL; após expirar (ou registrar manualmente) → claimável.
3. **Dead-letter:** falhas contínuas até `retry_max_attempts` → `dead_letter`, `completed_at` setado, **nunca** volta a `pending`.
4. **`recover_stale_processing`:** item `processing` antigo (>5min) → `pending`, sem incremente de tentativas; item recente → intocado.
5. **Concorrência:** 2 workers + falha → só 1 transiciona (UPDATE condicionado a `processing`).
6. **Isolamento:** falha com tenant errado → `RAISE` (mismatch).
7. **Observabilidade:** `get_outbox_queue_health()` reflete `failed/dead_letter/stale_processing` corretos.
8. **Regression:** suite completa (baseline 1152/5) + build + `d8:verify` PASS.

---

## 7. Reproduzir (pós-aprovação)

```powershell
npm run d8:build         # regenera artefato (se o worker mudar)
npm run d8:verify        # integrity gate
npx vitest run tests/d8/equivalence.test.ts
# + novos testes do Amendment-04 no harness (retry/dead-letter/reclaim/stale)
```

---

## 8. Estado

```text
D8 Worker Gates B/C/D        🟢 IMPLEMENTADOS (f3a0038)
Retry/requeue                 🟢 IMPLEMENTADO + CERTIFICADO (8671710)
Dead-letter server-side       🟢 IMPLEMENTADO + CERTIFICADO (8671710)
Amendment-04 (este)           🟢 PRODUCTION CERTIFIED (2026-08-28)
Deploy produção               🟢 COMPLETO (ushsnmlbeurfvlkieiln)
63742efa                      🟢 OPERATIONAL — commission 40% = R$40 (confirmed by PO)
ADR-015 PROD CERTIFIED        🟢 CERTIFIED (2026-08-28)
```

---

## 9. Decisões do PO (todas aprovadas)

1. ✅ **Aprovada** a superfície: `handle_processing_failure` (novo), `recover_stale_processing` (novo), **amenda** da predica de `claim_next_outbox_item` (§3).
2. ✅ **Aprovada** a semântica espelhando o certificado `SupabaseOutbox.markFailed` (backoff `base*2^(attempts-1)`, `maxAttempts=5`) — 1 fonte de behavior.
3. ✅ **Aprovado** que o worker **não** produz mais `failed` via `mark_outbox_item_processed` (usa `handle_processing_failure`).
4. ✅ **Confirmado** `retry_max_attempts=5` / `retry_base_delay_ms=1000` como defaults (sem alterar schema).
