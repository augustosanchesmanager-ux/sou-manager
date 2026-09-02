# ADR-016 Amendment-02 — Data Contract Audit + RPC Contract (D8)

**Status:** Proposed (draft — **AGUARDA aprovação do PO** antes de qualquer implementação)
**Date:** 2026-08-27
**Deciders:** PO (Augusto) + OpenCode
**Prerequisite:** ADR-016 Amendment-01 Execution Boundary (aprovado `509d53a`); Decisão PO D-9 (origem dos dados via RPC estreita tenant-scoped)
**Emenda:** define o **contrato mínimo de dados** de `get_financial_operation_context` e a superfície de persistência do worker

---

## 1. Objetivo

Definir **exatamente** os dados que o `createCommissionRecordHandler` consome (matriz Dado × Origem × Necessário × Porquê), para projetar uma **RPC estreita tenant-scoped** (`get_financial_operation_context`) que retorne **somente o contexto necessário ao cálculo** — **sem**:
- retornar colunas genéricas/todas (superfície ampla a evitar);
- calcular comissão no banco (Regra permanece exclusivamente no Core TS);
- acesso direto do worker às tabelas;
- exposição de dados de outros tenants.

> **Decisão PO (D-9):** "A RPC pode montar o contexto; ela **não** pode calcular a comissão. O cálculo continua exclusivamente no Financial Domain Core em TypeScript."

---

## 2. Audit read-only — o que `createCommissionRecordHandler` consome

### 2.1 Fontes e campos lidos

| # | Dado | Origem | Necessário? | Por quê |
|---|------|--------|-------------|---------|
| C1 | `comanda.discount` | comandas | ✅ | `comandaDiscount` → `resolveFinancialBase` (fallback de desconto por item) |
| C2 | `comanda.paid_amount` | comandas | ✅ | `comandaPaidAmount` (campo presente) — base financeira efetiva |
| C3 | `comanda.amount_paid` | comandas | ✅ | fallback de `paid_amount` (presença de campo, nunca valor 0 sintético) |
| C4 | `comanda.total` | comandas | ✅ | fallback final de `chargePaidAmount` (coluna real) |
| C5 | `comanda.staff_id` | comandas | ✅ | fallback p/ inferência do participante primário (`normalizeCommissionParticipants`) |
| C6 | `comanda.id` | comandas | ✅ | `comandaId` (create + idempotência) |
| I1 | `comanda_items.id` | comanda_items | ✅ | item id (participantsByItem + create `comanda_item_id`) |
| I2 | `comanda_items.unit_price` | comanda_items | ✅ | base `itemValue` (preferida) |
| I3 | `comanda_items.price` | comanda_items | ✅ | fallback `itemValue` |
| I4 | `comanda_items.amount` | comanda_items | ✅ | fallback `itemValue` |
| I5 | `comanda_items.quantity` | comanda_items | ✅ | multiplicador base financeira |
| I6 | `comanda_items.discount` | comanda_items | ✅ | `itemDiscount` |
| I7 | `comanda_items.staff_id` | comanda_items | ✅ | fallback participante (normalize) |
| I8 | `comanda_items.service_id` | comanda_items | ✅ | contexto p/ normalizeCommissionParticipants |
| P1 | `service_execution_participants.comanda_item_id` | participants | ✅ | agrupar participantes por item |
| P2 | `..staff_id` / `..professional_id` | participants | ✅ | atribuição de comissão (getParticipantStaffId) |
| P3 | `..payout_type` | participants | ✅ | cálculo (fixed/percentage) |
| P4 | `..payout_value` | participants | ✅ | cálculo (share) |
| P5 | `..affects_commission` | participants | ✅ | elegibilidade do participante |
| S1 | `staff.id` | staff | ✅ | chave staff (create + idempotência) |
| S2 | `staff.role` | staff | ✅ | `receivesCommission` |
| S3 | `staff.commission_rate` | staff | ✅ | `getEffectiveCommissionRate` |
| O1 | `receivedValue` | **payload do evento** (FinanceOperation.data) | ✅ | fallback de `comandaPaidAmount` quando nenhum campo de pagamento presente |

**Não consumidos** (não incluir na RPC): nomes, avatares, telefones, endereços, timestamps de criação em massa, colunas de status internas, campos de outros módulos (receivables/billing), etc.

> **Nota:** `O1 receivedValue` **não** vem de tabela — vem do **payload da operação/evento** (`FinanceOperation.data.receivedValue`), que a RPC já recebe na `operation_metadata`. A RPC NÃO precisa re-buscar; o valor transita no contexto para o Core TS.

### 2.2 Funções de cálculo consumidas (Core TS — puro, sem I/O)

| Função | Consome | Cálculo |
|--------|---------|---------|
| `resolveFinancialBase({ item, discount, paidAmount, quantity })` | C1–C4, I2–I6 | gross/net/received |
| `calculateCommissionValue(receivedValue, participant, commissionRate)` | P3–P5, S2–S3 | comissão |
| `normalizeCommissionParticipants(...)` | C5, I7, I8, P1–P5 | dedup/inferência/atribuição |
| `receivesCommission(staff)` | S2–S3 | elegibilidade |
| `getEffectiveCommissionRate(staff)` | S2–S3 | taxa efetiva |
| `normalizePercentage(...)` | P4, S3 | normalização |

### 2.3 Idempotência (persistência)

- `existsByStaffComanda(staffId, comandaId, tenantId)` — checa `commission_records` filtrando `tenant_id`, `comanda_id`, `staff_id`, `record_type='commission'`. → **é uma leitura na `commission_records`**, deve fazer parte da superfície de escrita/oráculo (RPC escopada), não do worker direto.

---

## 3. Contrato da RPC `get_financial_operation_context`

### 3.1 Assinatura

```sql
CREATE OR REPLACE FUNCTION public.get_financial_operation_context(
  p_item_id   UUID,    -- outbox item id
  p_tenant_id UUID     -- tenant para validar isolamento
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
-- VALIDA: item existe, pertence ao tenant, é 'processing' (claim já feito),
--         operationType é suportado (create_commission_record | reverse_commission).
-- MONTA: contexto financeiro MÍNIMO (só campos da matriz §2).
-- NÃO calcula comissão. NÃO retorna colunas genéricas.
$$;
```

### 3.2 Payload de retorno (JSONB) — contexto mínimo

```jsonc
{
  "event_id": "...",
  "tenant_id": "...",
  "operation_type": "create_commission_record",
  "comanda": {
    "id": "...", "discount": 0, "paid_amount": null,
    "amount_paid": 0, "total": 100, "staff_id": "..."
  },
  "comanda_items": [
    { "id": "...", "service_id": "...", "staff_id": "...",
      "unit_price": 50, "price": null, "amount": null,
      "quantity": 1, "discount": 0 }
  ],
  "participants": [
    { "comanda_item_id": "...", "staff_id": "...", "professional_id": null,
      "payout_type": "percentage", "payout_value": 100, "affects_commission": true }
  ],
  "staff": [
    { "id": "...", "role": "barber", "commission_rate": 50 }
  ],
  "operation_metadata": { "idempotency_key": "...", "source_event": "..." }
}
```

### 3.3 Regras da RPC (importante)

- **Valida `p_tenant_id` === `item.tenant_id`** → rejeita se divergente (isolamento).
- **Só retorna dados daquele evento** → nada de outros tenants (filtro por `tenant_id` em todas as leituras).
- **Não calcula comissão** → retorna só o contexto; o Core TS calcula.
- **`SECURITY DEFINER` + `search_path = public`** → coíbe injections; grants mínimos (ADR-012).
- **Nenhum acesso direto do worker** → o worker só chama esta RPC (e as de status/escrita).

### 3.4 Superfície de persistência do worker (RPCs escopadas)

| RPC | Finalidade | Valida tenant | Cálculo? |
|-----|-----------|---------------|----------|
| `claim_next_outbox_item()` | Claim atômico `FOR UPDATE SKIP LOCKED` | por item | não |
| `get_financial_operation_context(...)` | Contexto mínimo do evento | sim | **não** (Core TS calcula) |
| `exists_commission_record(...)` | Idempotência | sim | não |
| `insert_commission_record(...)` | Create o record | sim | não |
| `mark_outbox_item_processed(p_item_id, status, error)` | published/failed/dead_letter | por item | não |

> Cálculo de comissão **nunca** ocorre em SQL. Apenas leitura/escrita de contexto.

---

## 4. Isolamento / privilégio (fecha o design)

- **Worker** usa role `worker_dispatcher` (privilégio mínimo): **sem** acesso direto a tabelas; só `EXECUTE` nas RPCs acima.
- **`service_role` fora do caminho normal**; se necessário, somente para invocar a superfície RPC explicitamente autorizada.
- **Isolamento por `tenant_id`** validado em cada RPC (não por RLS, que `service_role` bypassaria).
- **Health persistida** em `worker_heartbeat` (tabela consultável, independente de sessão).
- **Rollback:** feature flag → retorno temporário ao dispatcher client-side.

---

## 5. Riscos / Stop-conditions (reafirmados)

| Risco | Ação |
|-------|------|
| RPC calcula comissão | 🔴 **STOP** — viola D-9 |
| RPC retorna colunas genéricas/`select *` | 🔴 **STOP** — superfície ampla |
| Worker acessa tabelas diretamente | 🔴 **STOP** — só RPCs |
| `tenant_id` não validado | 🔴 **STOP D8** — isolamento violado |
| Duplicação de regra (SQL/Deno) | 🔴 **STOP** — 1 fonte no Core TS |

---

## 6. Estado

```text
D8 Diagnostic              🟢 7acaadd
ADR-016 Design             🟢 330f4e4 (conceitual)
Execution Boundary        🟢 509d53a (Amendment-01)
PO Approval de boundary   🟢
Data Contract Audit        🟡 ESTE DOCUMENTO — AGUARDA APROVAÇÃO DO PO
ADR-016 Amendment-02       ⬜ assinar após aprovação
Implementação D8           🔴 BLOQUEADA até aprovação deste Amendment-02
```

**Nenhum código, migration, banco ou produção alterado.** Somente auditoria read-only + contrato de RPC.

---

## 7. Decisões pendentes do PO

1. **Aprovar o contrato mínimo de dados** (§2 matriz + §3 payload) — ou ajustar campos.
2. **Confirmar a superfície de persistência** (§3.4 — 5 RPCs escopadas).
3. **Aprovar o ADR-016 Amendment-02** → desbloqueia a implementação do D8.
4. Confirmar que o **cálculo permanece exclusivamente no Core TS** (RPC só monta contexto).
