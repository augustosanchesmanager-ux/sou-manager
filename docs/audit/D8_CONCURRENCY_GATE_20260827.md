# D8 — Concurrency / Isolation / Idempotency Gate (DB Surface)

**Status:** PASS (evidência reproduzível)
**Date:** 2026-08-27
**Criterion:** ADR-016 Amendment-01/02 + Gate PO (concorrência real)
**Scope:** `supabase/migrations/20260827120000_d8_worker_rpc_surface.sql` (Gate A)
**Harness:** `tests/d8/harness/` (Docker `postgres:15`, tenant de teste isolado, IDs determinísticos — **não** usa `63742efa` nem tenant de produção)

---

## 1. Resultado do gate

| Gate | Resultado exigido | Resultado | Evidência |
|------|-------------------|-----------|-----------|
| Migration | ✅ aplicada | ✅ aplicada limpa (PG15) | setup.ps1 |
| 6 RPCs | ✅ existentes | ✅ 6/6 existentes | `claim_next_outbox_item`, `get_financial_operation_context`, `exists_commission_record`, `insert_commission_record`, `mark_outbox_item_processed`, `upsert_worker_heartbeat` |
| Claim concorrente 2× | **2 itens distintos** | ✅ worker-1→B, worker-2→A | concurrency2.ps1 |
| Claim concorrente 20× | **sem double-claim** | ✅ 2 efetivos, 18 NULL, A+B distintos | concurrency20.ps1 |
| `tenant_id` isolation | PASS | ✅ mismatch rejeitado ("tenant mismatch") | get_financial_operation_context(..., tenant_errado) |
| Data Contract | **somente campos aprovados** | ✅ apenas C1-C6/I1-I8/P1-P5/S1-S3 + metadata | amostra abaixo |
| Idempotência | **1 comissão efetiva** | ✅ insert#1 idempotent=false; insert#2 idempotent=true(skip); count=1 | abaixo |
| Repeated processing | **sem duplicata** | ✅ exists_before=f → exists_after=t, count=1 | abaixo |
| Build | PASS | ✅ `vite build` ok (14.04s) | — |
| Unit tests | PASS (baseline) | ✅ 1147 passed / 5 pre-existing | rodado |
| D7 regression | PASS | ✅ outbox_items/commission_records intactos (não modificados) | migration não toca D7 |

---

## 2. Claim atômico (evidência)

`claim_next_outbox_item()` usa `FOR UPDATE SKIP LOCKED`. 20 conexões psql **independentes**:

```
Effective claims: 2  |  NULL results: 18
  -> worker-0 claimed evt_test_B_0002
  -> worker-1 claimed evt_test_A_0001
PASS: 20 concurrent workers -> 2 effective distinct claims (A+B), 18 NULL, NO double-claim
```

Estado persistente final:
```
evt_test_A_0001 | processing | worker-1 | started=t
evt_test_B_0002 | processing | worker-0 | started=t
```

## 3. Isolamento por tenant (evidência)

```
SELECT get_financial_operation_context(item A, tenant 2222...) 
  → ERROR: tenant mismatch: item belongs to tenant 1111..., requested 2222...
SELECT get_financial_operation_context(item A, tenant 1111...)
  → { "event_id": "evt_test_A_0001", ... }   (ok)
```

## 4. Data Contract — contexto retornado (somente campos aprovados)

```json
{
  "event_id": "evt_test_A_0001",
  "tenant_id": "11111111-...",
  "operation_type": "create_commission_record",
  "idempotency_key": "evt_test_A_0001_create_commission_record",
  "source_event": "CheckoutCompleted",
  "receivedValue": 100,
  "comandaId": "cccccccc-...-00a",
  "comanda": { "id": "...", "total": 100.00, "discount": 0, "staff_id": "..." },
  "comanda_items": [ { "id": "...", "quantity": 1, "staff_id": "...", "service_id": null, "unit_price": 100.00 } ],
  "participants": [ { "comanda_item_id": "...", "staff_id": "...", "payout_type": "percentage", "payout_value": 100.00, "affects_commission": true } ],
  "staff": [ { "id": "...", "role": "barber", "commission_rate": 0.5000 } ]
}
```

**Nenhum** campo de nome/avatar/telefone/status/timestamp em massa/interno foi retornado. Sem `SELECT *`.

## 5. Idempotência (evidência)

```
exists_before = f
insert #1 → {"success": true, "idempotent": false}
insert #2 (mesmo idempotency key) → {"success": true, "idempotent": true, "skipped": true}
exists_after = t
count(commission_records, comanda A) = 1
```

Campos validados (Staff/Comanda/Event/Valor/Taxa/Tenant):
```
staff_id | comanda_id | event_id | commission_value | commission_rate | tenant_id | record_type | idempotency_key
aaaa...001 | cccc...00a | evt_test_A_0001 | 50.00 | 0.5000 | 1111... | commission | evt_test_A_0001_create_commission_record
```

---

## 6. Notas de segurança (contract PO)

- Worker usa role dedicada `worker_dispatcher` (NOLOGIN, sem BYPASSRLS, **sem** privilégio em tabelas). Só `EXECUTE` nos 6 RPCs.
- RPCs `SECURITY DEFINER` + `search_path=public`, cada um valida `p_tenant_id`/`p_item_id`.
- **RPC nunca calcula comissão** — cálculo fica no Financial Domain Core TS (1 fonte da regra).
- `service_role` fora do caminho normal do worker.
- Rollback: feature flag para retornar ao dispatcher client-side.

## 7. Reproduzir

```powershell
cd tests/d8/harness
.\setup.ps1            # sobe postgres:15, aplica stub + migration
.\seed.ps1             # seed determinístico isolado
.\concurrency2.ps1     # 2 workers → itens distintos
.\concurrency20.ps1    # 20 workers → sem double-claim
```

> Harness usa **tenant de teste** `11111111-...`/`22222222-...` e IDs determinísticos. **Não** toca produção.
