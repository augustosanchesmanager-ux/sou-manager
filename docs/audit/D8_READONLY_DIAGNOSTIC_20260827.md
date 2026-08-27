# D8 — Dispatcher Server-side: Read-Only Diagnostic

> **Gate:** D8 Read-Only Diagnostic — **somente leitura**. Nenhum código, migration, banco ou produção alterado.
> **Data:** 2026-08-27 · **Branch:** `fix/checkout-staff-attribution` · **Decisão PO:** caminho B (2026-08-27)
> **Autoria:** OpenCode (Tech Lead) + validação/veredito do PO (Augusto)

---

## 1. Objetivo

Responder, com **evidência empírica do código e do banco de produção** (read-only), a pergunta central do D8:

> **Como retirar o dispatcher do browser sem quebrar RLS, isolamento multi-tenant, idempotência, retry, reversal e o contrato já certificado da Trilha C + D7?**

E reformulando a definição do problema conforme decisão do PO:

> **D8 = criar uma autoridade de processamento assíncrono server-side, multi-tenant, idempotente e observável, preservando integralmente o contrato financeiro certificado de Trilha C + D7.**

**Não é** "trocar `setInterval` por cron".

---

## 2. Contexto atual do dispatcher (confirmado no código)

Cadeia de execução atual:

```text
Browser autenticado
   ↓
useEventInfrastructure() / App.tsx:328  (setInterval ~5s)
   ↓
InMemoryDispatcher.dispatchAll() / dispatch()
   ↓
SupabaseOutbox.findNext()  (getSharedClient() — client do browser, RLS-bound)
   ↓
RLS: current_tenant_id_from_auth_uid()
   ↓
outbox_items  (SELECT + UPDATE optimistic)
   ↓
FinanceProvider  →  commission_records  →  published
```

Fatos confirmados no código (`domain/events/outbox/supabaseOutbox.ts:140-235`):

- `resolveClient()` → `getSharedClient()` (linha 142) — **client do browser**, contexto RLS do usuário autenticado.
- Loop de dispatch iniciado apenas em `App.tsx`/`useEventInfrastructure()` — **dependência de browser/sessão**.

### 2.1 O incidente que originou o D8

```text
Tenant f53427f0 (validação B34H — sem operador humano ativo)
   ↓
comanda 63742efa enfileirada (07:01, R$100, create_commission_record)
   ↓
nenhuma sessão autenticada do tenant roda o dispatcher
   ↓
findNext() bloqueado corretamente por RLS (retorna null / permission denied)
   ↓
item permanece pending (~2h30+)
```

**Conclusão:** a persistência do outbox está correta (D7/Trilha C 🟢); o problema está no **motor que consome a fila** (client-side). Risco: **Alto → Crítico para operações financeiras**.

---

## 3. Achados técnicos (confirmados empiricamente)

### 🔴 A-1. `findNext()` usa optimistic locking — NÃO `FOR UPDATE SKIP LOCKED`

A **documentação** (migration `20260826000000_create_outbox_items.sql:14` e `supabaseOutbox.ts:13`) declara:

> `FOR UPDATE SKIP LOCKED for atomic claim (Dispatcher)`

A **implementação real** (`supabaseOutbox.ts:182-235`) faz:

```text
SELECT * ... WHERE status='pending' ORDER BY created_at LIMIT 1
   ↓
UPDATE ... SET status='processing' WHERE id=? AND status='pending'   ← optimistic lock
```

- **Não existe RPC com `FOR UPDATE SKIP LOCKED` em nenhum lugar** (grep confirma: só comentários).
- O comentário no header da migration/arquivo é **intenção não implementada / documentação defasada**.
- Para 1 dispatcher funciona. Para worker **concorrente**, há janela onde dois workers SELECT o mesmo candidato antes de qualquer claim (ambos veem `pending`). O `UPDATE ... AND status='pending'` mitiga a dupla entrega (um perde → retorna `null`), mas a **serialização da leitura** não existe → **D8 deve especificar claim atômico real** (RPC com `FOR UPDATE SKIP LOCKED`), não apenas UPDATE otimista.

### 🔴 A-2. "heartbeat = loop vivo" ≠ "fila/pipeline saudável"

- O watchdog (`eventInfrastructure.ts`) captura erro de `dispatchAll()` → emite heartbeat → `alerts.check()`. ✅
- **Mas** `SupabaseOutbox.findNext()` **captura erros de query internamente e retorna `null`** (`supabaseOutbox.ts:194-197`).

Consequência:

```text
heartbeat = loop está executando        (loop vivo)
heartbeat ≠ pipeline financeiro saudável (fila pode estar quebrada/morta)
```

Um erro de query (tabela ausente, RLS, deadlock) aparece **idêntico a "fila vazia"** para o watchdog. O ADR-015 já entrega profundidade/health bom, mas **D8 precisa de health semântica**, não apenas health de execução.

### 🟠 A-3. Contexto de tenant não pode desaparecer no worker

No browser, o tenant vem da sessão. Num worker server-side, **quem identifica/autoriza o tenant?** — sem entregar privilégio irrestrito (ver §6).

### 🟠 A-4. `processed_operations` continua como ledger de idempotência (não como fila)

Correto. Não transformar em fila.

---

## 4. O que está BOM (não começar do zero)

- `outbox_items` persistente em PostgreSQL (Trilha C). ✅
- Outbox já tem retry + dead-letter. ✅
- Idempotência financeira (`processed_operations`, constraints únicas Tabela C/D7). ✅
- `tenant_id` explícito em cada item do outbox. ✅
- Dispatcher e Provider têm interfaces separadas (`Dispatcher`/`DispatcherProvider`). ✅
- Superfície `SECURITY DEFINER` via `current_tenant_id_from_auth_uid()` já resolve contexto sem recursão de RLS. ✅

---

## 5. Infraestrutura server-side existente (reutilizável)

### 5.1 Edge Functions (`supabase/functions/`)

| Função | Relevância p/ D8 |
|--------|------------------|
| `notification-sweep` | **PRECEDENTE DIRETO**: roda server-side e usa `createClient(SUPABASE_URL, SUPABASE_ANON_KEY)` **passando o `Authorization` (JWT do chamador)** (`index.ts:25-33`). Ou seja, **opera sob o contexto RLS do usuário autenticado** — preserva isolamento por tenant **sem** `service_role`. |
| `admin-create-user`, `invite-team-member`, `portal-auth`, `site-sanchez-appointments`, `supabase-usage-monitor` | Padrão Edge Function já estabelecido no projeto. |

### 5.2 Agendamento (cron)

- **Nenhum `pg_cron` schedule** configurado nas migrations (grep vazio).
- **Nenhum `config.toml`** com schedule no `supabase/functions/` (apenas `verify_jwt=false` em 2 delas).
- **Nenhum cron** no `vercel.json`.
- → O agendamento do worker **ainda não existe e precisará ser criado** (Supabase Cron / pg_cron / Vercel Cron).

### 5.3 Vercel

- `vercel.json` só tem rewrite SPA (`index.html`). Sem `crons` configurados.

---

## 6. A autoridade de execução do worker (decisão central do design)

O risco central: um worker server-side não pode ganhar privilégio indiscriminado.

**Padrão recomendado (candidato, a confirmar no ADR-016):** worker **Edge Function** que:

1. Recebe/opera sob um contexto que resolve `tenant_id` de forma explícita e controlada;
2. Usa **superfície `SECURITY DEFINER` mínima** (funções dedicadas, auditadas) — ex.: `claim_next_outbox_item()` com `FOR UPDATE SKIP LOCKED`, idempotente, sem expor `service_role` ao frontend;
3. Nunca usa `service_role` no frontend;
4. Preserva RLS via funções com contexto de tenant, mantendo o isolamento multi-tenant;
5. Mantém idempotência e retry/dead-letter intactos.

**Alternativas a avaliar no ADR:**
- **Supabase Edge Function + agendamento** (padrão `notification-sweep`; cron configurável);
- **pg_cron** (job SQL server-side; ganha-se transacionalidade, mas o dispatch financeiro em PLpgSQL é mais complexo e acopla lógica ao banco);
- **Worker externo** (Vercel Cron → Edge Function, ou serviço dedicado).

> **Decisão da alternativa = NÃO fazer agora.** Faz parte do ADR-016/design. O diagnóstico apenas mapeia.

---

## 7. Checklist de respostas do diagnóstico (questões do PO)

| # | Pergunta | Resposta de diagnóstico (indicativa — confirmação no ADR) |
|---|----------|-----------------------------------------------------------|
| 1 | Qual mecanismo server-side? | Edge Function com agendamento (precedente `notification-sweep`) vs pg_cron vs worker externo — **a decidir no ADR-016** |
| 2 | Como o worker obtém autoridade? | Contexto de tenant resolvido explicitamente; superfície `SECURITY DEFINER` mínima; **sem `service_role` no frontend** |
| 3 | Como identifica o tenant? | `tenant_id` explícito em cada item; contexto via função dedicada |
| 4 | Como RLS é preservado? | Worker opera sob contexto de tenant (padrão JWT-pass-through ou SECURITY DEFINER restrito) |
| 5 | Como o claim é serializado? | **RPC `FOR UPDATE SKIP LOCKED`** (a implementar — hoje é optimistic UPDATE, achado A-1) |
| 6 | Como evitar 2 workers no mesmo evento? | Claim atômico + idempotência existente |
| 7 | Retry sem browser? | Loop server-side com retry + dead-letter (já existe; mover para o worker) |
| 8 | Reversal continua? | Contrato D7/Trilha B preservado; worker não altera regra de reversal |
| 9 | Observabilidade do worker? | Health semântica (achado A-2): worker alive + queue healthy + oldest pending age + last successful processing |
| 10 | Rollback? | Feature flag ativa/desativa worker; reverter para client-side se necessário |
| 11 | Drenar itens existentes (ex.: `63742efa`)? | Após D8, reprocessamento via mecanismo oficial idempotente — **não** bypass/manual |
| 12 | Certificar sem tocar contrato D7? | Worker delega para as mesmas funções/RPC fechado de FinanceProvider; contrato intacto |

---

## 8. Health semântica necessária no D8

O watchdog do ADR-015 entrega health de **execução**. O D8 deve adicionar health de **fila/pipeline**:

```text
worker heartbeat          (erro de query NÃO pode parecer fila vazia → achado A-2)
queue depth               (pending / processing / published / dead_letter)
oldest pending age        (alerta por idade do item mais antigo — pegaria 63742efa)
processing age            (stale recovery)
dead letters
dispatch success/error
last successful processing
```

---

## 9. O que NÃO foi feito (respeitado)

- ✅ Nenhum código alterado.
- ✅ Nenhuma migration criada.
- ✅ Nenhuma alteração em banco/produção.
- ✅ Nenhuma credencial obtida/compartilhada.
- ✅ Nenhum bypass de RLS/auth.
- ✅ Nenhum `INSERT/UPDATE` manual para drenar `63742efa` (permanece como evidência histórica; reprocessamento legado posterior ao D8, pelo mecanismo oficial idempotente).

---

## 10. Veredito / Estado

```text
D8 Read-Only Diagnostic  →  🟡 EM ANDAMENTO (diagnóstico técnico concluído com evidência)
      ↓
ADR-016 / Design         →  PRÓXIMO (autoridade de execução + escolha do mecanismo)
      ↓
PO aceita                →  pendente
      ↓
Implementação            →  pendente
```

**Estado geral:**

```text
D7 Transactional Outbox        🟢 FECHADO / PRODUÇÃO
ADR-015 Observabilidade        🟠 IMPLEMENTADO / DEPLOYADO / CHAOS VALIDADO — NÃO certificado (bloqueado por D8)
D8 Dispatcher server-side      🟠 NOVA TRILHA / Diagnóstico read-only em andamento
```

---

## 11. Ações futuras (fora do escopo deste gate read-only)

1. Concluir escolha do mecanismo server-side (ADR-016) — Edge Function / pg_cron / worker.
2. Definir autoridade/claim atômico (`FOR UPDATE SKIP LOCKED`).
3. Implementar health semântica.
4. Procedimento oficial de reprocessamento/drenagem de itens legados (incl. `63742efa`).
5. Feature flag para ativar/desativar o worker com rollback.
6. Eventual remoção progressiva do dispatcher client-side e generalização do worker.

---

*Documento read-only. Nenhuma alteração em código, migration, banco ou produção.*
