# ADR-016 Amendment-01 — Execution Boundary Design (D8)

**Status:** Proposed (draft — **AGUARDA aprovação do PO** antes de qualquer implementação)
**Date:** 2026-08-27
**Deciders:** PO (Augusto) + OpenCode
**Supersedes/Emenda:** ADR-016 D-2 (autoridade de execução)
**Prerequisite:** ADR-016 (aprovado conceitualmente; implementação bloqueada até este design fechar)

---

## 1. Objetivo

Resolver a **Execution Boundary** do D8 — responder **como** o worker server-side executa o processamento financeiro certificado (`create_commission_record`, `reverse_commission`) **sem**:
- duplicar/reimplementar a regra financeira (nem em Deno, nem em PL/pgSQL);
- usar `service_role` como substituto de RLS;
- ampliar a superfície de privilégio além do estritamente necessário;
- preservando isolamento por `tenant_id`, idempotência, retry, dead-letter e reversal.

> **Decisão do PO (E2, superfície mínima):** o worker reutiliza a **MESMA regra financeira** via um **módulo runtime-neutral**; `service_role`, se necessário, fica restrito às operações indispensáveis e **não** substitui isolamento de tenant; se isso não puder ser seguro → **PARAR D8** e reconsiderar a autoridade.

---

## 2. Premissa que motivou a emenda (fato técnico)

- `finance_settle_comanda` **NÃO cria** `commission_records` (verificado no SQL).
- O outbox `create_commission_record` é a **fonte real** da comissão, executada por `createCommissionRecordHandler` (334 linhas): resolve `comanda → comanda_items → service_execution_participants → staff`, calcula com `resolveFinancialBase` + `calculateCommissionValue`, com idempotência `existsByStaffComanda` + índice único parcial.
- Esse handler está **acoplado aos repositórios do frontend** (`getSharedClient()`, RLS) e vive em `domain/` + `src/lib/` — **não é portável diretamente para Edge Function (Deno)**.

**Conclusão:** a premissa original do ADR-016 ("FinanceProvider continua em TS na Edge Function") é **falsa**; a autoridade de execução precisa de fronteira explícita.

---

## 3. Arquitetura do Execution Boundary

```text
┌──────────────────────────────┐
│  Edge Function Worker (Deno) │   dispatcher server-side
│  - claim atômico no banco     │   - heartbeat/health server-side
│  - agendamento (cron)         │
└─────────────┬────────────────┘
              │  item: event_id + tenant_id + operationType + payload
              ▼
┌──────────────────────────────┐
│  Financial Domain Core       │   runtime-neutral (TS puro, sem I/O)
│  resolveFinancialBase        │
│  calculateCommissionValue    │
│  idempotency semantics       │
│  (participants normalize)    │
└─────────────┬────────────────┘
              │  trabalha sobre dados resolvidos
              ▼
┌──────────────────────────────┐
│  Persistence Adapters (worker)│   mínimos, por item
│  - resolve comanda/items/pax  │   tenant_id EXPLÍCITO
│  - create commission_record   │   via narrow RPC, sem acesso genérico
└─────────────┬────────────────┘
              │
              ▼
┌──────────────────────────────┐
│  commission_records          │   idempotência · isolamento · reversal
└──────────────────────────────┘
```

### 3.1 Camada 1 — Dispatcher server-side (Edge Function worker)
- **Claim atômico** via RPC `claim_next_outbox_item()` (`FOR UPDATE SKIP LOCKED`) — **D-1** (novo, a criar).
- Orquestra: claim → resolve dados → calcula comissão (Core) → persiste via adapters → `markPublished`/`markFailed`.
- **Agendamento:** o worker DEVE ser acionado explicitamente em produção e DEVE expor como detecta que parou (health semântica — ver §6).

### 3.2 Camada 2 — Financial Domain Core (runtime-neutral)
**A regra financeira vira uma unidade compartilhável/runtime-neutral**, separada dos repositórios:
- `resolveFinancialBase`, `calculateCommissionValue`, `normalizeCommissionParticipants`, `receivesCommission`, `getEffectiveCommissionRate`, `normalizePercentage` — puros, sem I/O.
- Já são em grande parte funções puras; o refactor é **extrair/garantir** que não dependam de `getSharedClient()`.
- **NENHUMA lógica financeira reescrita**; exatamente as mesmas funções usadas hoje.

### 3.3 Camada 3 — Persistence Adapters (espelho do handler, por-item)
- Providenciam os dados de **um item específico** com **`tenant_id` explícito**:
  - `resolveComanda(comandaId, tenantId)`
  - `resolveComandaItems(comandaId, tenantId)`
  - `resolveParticipants(itemIds, tenantId)`
  - `resolveStaffForCommission(tenantId)`
  - `createCommissionRecord(record, tenantId)`
  - `existsByStaffComanda(staffId, comandaId, tenantId)`
- No **browser**, os adapters apontam para os repositórios atuais (RLS). No **worker**, apontam para a **narrow worker API/RPC** (superfície mínima, §4).

### 3.4 Camada 4 — Persistência (commission_records)
- Backed por idempotência (índice parcial + `existsByStaffComanda`), isolamento por `tenant_id`, reversal intacto.

---

## 4. DB / RPC surface (superfície mínima)

O worker **não** tem acesso genérico às tabelas financeiras. Superfície a criar/auditar (RPCs `SECURITY DEFINER`, grants mínimos ADR-012, east-scoped):

| RPC | Finalidade | Tenant | Notes |
|-----|-----------|--------|-------|
| `claim_next_outbox_item()` | Claim atômico `FOR UPDATE SKIP LOCKED` | por item (não depender de sessão) | **novo** (D-1) |
| `get_outbox_item_for_worker(p_item_id)` | Retorna dados do item resolvidos | valida `tenant_id` | **novo**, escopado |
| `get_commission_sources(p_comanda_id, p_tenant_id)` | Comanda + items + participants + staff p/ cálculo | `p_tenant_id` explícito | **novo** (unifica leituras do handler) |
| `insert_commission_record(...)` | Cria o record com idempotência | `p_tenant_id` explícito | **novo** ou reuso |
| `mark_outbox_item_processed/published/failed(p_item_id)` | Atualiza status | `p_item_id` escopado | **novo** para o worker |

**Princípio:** cada RPC recebe/valida `tenant_id` explicitamente; nenhuma leitura genérica. **Nenhum RPC de leitura ampla** (ex.: "listar todas as comandas").

### 4.1 Por que RPC e não acesso direto do worker
O worker (Deno) com `service_role` teria acesso genérico às tabelas — **inaceitável** (superfície privilegiada ampla). Com RPCs `SECURITY DEFINER` escopados, o worker só executa operações específicas, cada uma validando `tenant_id`. Assim:
- **service_role, se usado, só invoca os RPCs** (nunca lê/escreve tabelas diretamente);
- o isolamento acontece **na camada RPC** (validada e auditável), não por RLS (que `service_role` bypassaria).

### 4.2 Crítica (a validar no design detalhado)
- Os dados sensíveis resolvidos (comada/participants/staff) transitam pelo worker para o cálculo. **Alternativa mais fechada:** o **cálculo também vira RPC** (`calculate_and_insert_commission`) — eliminando o trânsito de dados sensíveis pelo worker. **Trade-off:** reimplementa o cálculo em plpgsql (duplicação que o PO proibiu). **Decisão do PO orientou E2** → manter cálculo no Core TS e transitar dados via RPC escopado. **A confirmar no fechamento do design.**

---

## 5. Modelo de privilégio / tenant isolation

- **Worker usa credencial de serviço restrita** (ex.: role `worker_dispatcher` SEM `bypassrls` no nível de tabela financeira; acesso via RPCs escopados).
- **`tenant_id` validado em cada RPC** — o worker envia o `tenant_id` do item e o RPC confere.
- **Sem RLS no worker** (worker não é "usuário"); o isolamento é na camada de aplicação/RPC (camada explicitamente auditada).
- **Fallback:** se não for possível garantir isolamento sem privilégio excessivo → **PARAR D8, não aceitar**.

---

## 6. Health semântica (worker, corrige A-2)

O worker DEVE expor (separando "worker vivo" de "pipeline saudável"):

```text
DISPATCHER_ALIVE            (o worker está executando / agendado)
LAST_SCHEDULED_AT           (quando o agendamento disparou)
QUEUE_QUERY_HEALTHY         (claim/consulta OK — erro de query ≠ fila vazia)
QUEUE_DEPTH                 (pending / processing / published / dead_letter)
STALE_ITEMS                 (processing > limiar)
DEAD_LETTERS
LAST_SUCCESSFUL_DISPATCH
LAST_DISPATCH_ERROR
OLDEST_PENDING_AGE          (alerta — pegaria 63742efa)
```

- **A-2 corrigido:** erro na consulta/claim do worker NÃO é silenciado como "fila vazia" — alimenta `LAST_DISPATCH_ERROR` + alerta.
- Persistida/consultável (ex.: heartbeat em tabela ou métrica emissível por RPC), para observabilidade independente de session.

---

## 7. O que a implementação (futura) fará — esboço

1. **Refactor de portabilidade (Camada 2):** extrair/garantir Financial Domain Core runtime-neutral (funções puras já existentes; separar adapters).
2. **RPCs (Camada 4):** criar `claim_next_outbox_item` (D-1) + RPCs escopados de leitura/escrita com validação de `tenant_id`.
3. **Edge Function worker (Camada 1):** orquestra claim → resolve → calcula (Core) → persiste (adapters→RPC) → status; heartbeat/health; agendamento.
4. **Adaptadores de persistência:** browser → repos atuais (RLS); worker → RPCs escopados.
5. **Health semântica** + observabilidade (reuso ADR-015 metrics/alerts).
6. **Testes:** concorrência (claim atômico), idempotência, retry/dead-letter, chaos (worker failure/recovery).

---

## 8. Riscos e stop-conditions

| Risco | Ação |
|-------|------|
| Cálculo em plpgsql duplica regra | 🔴 **STOP** — viola decisão PO (regra não duplicada) |
| `service_role` com acesso genérico a tabelas financeiras | 🔴 **STOP** — exigir superfície RPC mínima |
| Isolamento de tenant não garantido na camada RPC | 🔴 **STOP D8** — reconsiderar autoridade (sem grande superfície) |
| Drift entre Core browser/worker | 🟠 Mitigado: MESMA função compartilhada (1 fonte da regra) |

---

## 9. Estado

```text
D8 Read-Only Diagnostic        🟢
ADR-016 (conceitual)           🟡 aprovado conceitualmente; implementação bloqueada
Execution Boundary Design      🟡 ESTE DOCUMENTO — AGUARDA APROVAÇÃO DO PO
   ├── runtime-neutral core     ⬜ a detalhar
   ├── repository/adapters      ⬜ a detalhar
   ├── DB/RPC surface           ⬜ a detalhar
   ├── tenant isolation         ⬜ a detalhar
   └── privilege model          ⬜ a detalhar
ADR-016 Amendment (D-2)        ⬜ assinar após aprovação
Implementação D8               ⬜ bloqueada até fechar o desenho
```

**Nenhum código, migration, banco ou produção alterado.** Somente documento de design.

---

## 10. Decisões pendentes do PO para fechar o design

1. **Trânsito de dados:** resolver comanda/participants/staff via RPC e calcular no Core TS (E2, recomendado) **vs** empurrar o cálculo também para RPC (duplica regra — contra a decisão).
2. **Credencial do worker:** role dedicada `worker_dispatcher` (sem acesso direto a tabelas; só RPCs escopados) — confirmar.
3. **Agendamento:** pg_cron invocando Edge Function via `pg_net`/HTTP **vs** Vercel Cron → Edge Function **vs** Supabase Cron (sem impacto de corretude; claim serializado).
4. **Health persistida:** tabela `worker_heartbeat`/métrica consultável — confirmar abordagem.
5. Aprovar o **ADR-016 Amendment** (D-2 emendado + este design) → desbloqueia implementação.
