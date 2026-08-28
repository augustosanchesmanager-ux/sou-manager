# D8 — Deploy Gate Runbook

**Status:** RUNBOOK CORRIGIDO (documental) — **execução AGUARDA autorização explícita do PO**
**Date:** 2026-08-28
**Upstream gates:** Amd-04 🟢 CERTIFIED · Deploy Plan `3a252f5` 🟢 · Production Pre-Deploy Gate 🟢 PASS
**Project (prod):** `ushsnmlbeurfvlkieiln` — alias `barber.soumanager.com`
**Branch:** `fix/checkout-staff-attribution`

---

## Regra rígida (inalterável)

> **`63742efa` NÃO é ferramenta de teste de infraestrutura.**
> Só será utilizado (leitura/verificação) **depois** que role → migrations → worker → cron estiverem comprovadamente saudáveis.
> **Nunca** usar `UPDATE`/`DELETE`/`INSERT` manual, nem qualquer alteração direta nessa entrada.

## Atomicidade da execução (princípio norteador)

> **A migration `20260827120000_d8_worker_rpc_surface.sql` é a UNIDADE ATÔMICA de provisionamento da `worker_dispatcher` RPC surface.**
>
> Ela cria, na mesma transação (`BEGIN…COMMIT`): a role `worker_dispatcher`, as RPCs do worker, os grants `EXECUTE`, a tabela `worker_heartbeat` e as policies relacionadas.

Consequências operacionais:
- **NÃO executar SQL manual de criação/grants da `worker_dispatcher` fora da migration `rpc_surface`.** Role + RPCs + grants devem ser aplicados JUNTOS pela migration.
- Um estado criado manualmente em partes diverge do estado esperado pela migration; mesmo que a migration seja idempotente, **não introduzimos esse estado intermediário desnecessário**.
- A idempotência das migrations (`CREATE OR REPLACE`, `IF NOT EXISTS`, `IF EXISTS`/policy) é uma **característica de segurança** para reaplicação/recovery controlado, **NÃO** autorização para reexecução automática ou indiscriminada. **Idempotente ≠ livre de risco operacional.** Cada reaplicação exige validação do estado remoto.

## Regras de execução

- Cada **Marco** termina em **STOP + validação** contra critérios objetivos.
- Se **qualquer critério** falhar → **🔴 BLOCKED** + executar **rollback do marco** (§Rollback) + reportar ao PO. Não avançar.
- Nenhuma etapa destrutiva sem PO.
- Não promover frontend; não alterar D7/composite RPC; não alterar migrations SQL nem código da Edge Function além do deploy previsto.

---

## Marco 0 — Snapshot / read-only final

- Confirmar commit certificado `8671710` (funcional Amd-04) e documental `292ece0`/correção em `HEAD` na branch.
- Confirmar estado Q1–Q6 (o mesmo do pre-deploy): `63742efa` `published` íntegro, fila 11 published, D8 ausente, `commission_records` 16 active.
- Registrar o estado antes da primeira escrita (para diff/rollback).

**PASS quando:** todas as leituras confirmam o snapshot esperado (sem delta vs pre-deploy).

---

## Marco 1 — Worker RPC Surface (migration única)

Aplicar **exclusivamente** a migration, como unidade átomica:

```text
supabase/migrations/20260827120000_d8_worker_rpc_surface.sql
```

> Cria, em uma única transação: `worker_dispatcher` (NOLOGIN, sem BYPASSRLS), as RPCs do worker (`claim_next_outbox_item`, `get_financial_operation_context`, `exists_commission_record`, `insert_commission_record`, `mark_outbox_item_processed`, `upsert_worker_heartbeat`, `get_worker_heartbeat`, `get_outbox_queue_health`), a tabela `worker_heartbeat`, as policies e os grants `EXECUTE` (worker_dispatcher + authenticated onde aplicável).

> **⚠️ `handle_processing_failure` e `recover_stale_processing` NÃO pertencem a este marco.** São criadas pela migration **`20260828000000_d8_worker_retry_dead_letter.sql`** (Marco 3). **Não** conceder grants a elas no Marco 1 (funções ainda não existem).

**STOP + validação (read-only):**
```sql
SELECT rolname, rolcanlogin, rolbypassrls FROM pg_roles WHERE rolname='worker_dispatcher';
-- espera: NOLOGIN (rolcanlogin=false), NOBYPASSRLS (rolbypassrls=false), sem superuser

SELECT d.objtype, pg_describe_object(d.classid, d.objid, 0) AS obj
FROM pg_roles r
JOIN pg_depend d ON d.refobjid = r.oid
WHERE r.rolname = 'worker_dispatcher' AND d.deptype = 'e';
-- espera: apenas privilégios EXECUTE de função; NENHUM privilégio direto a tabela

SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS sig, p.prosecdef,
       regexp_replace(p.proconfig::text,'[{}]','','g') AS search_path
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public'
  AND p.proname IN ('claim_next_outbox_item','get_financial_operation_context','exists_commission_record','insert_commission_record','mark_outbox_item_processed','upsert_worker_heartbeat','get_worker_heartbeat','get_outbox_queue_health');
-- espera: SECURITY DEFINER + search_path=public + assinaturas corretas

SELECT has_function_privilege('worker_dispatcher','public.claim_next_outbox_item(uuid,text)','EXECUTE') AS claim,
       has_function_privilege('worker_dispatcher','public.get_financial_operation_context(uuid,uuid)','EXECUTE') AS ctx,
       has_function_privilege('worker_dispatcher','public.insert_commission_record(uuid,uuid,uuid,uuid,numeric,numeric,numeric,numeric,numeric,numeric,numeric,text,boolean,text,text,text)','EXECUTE') AS ins,
       has_function_privilege('worker_dispatcher','public.exists_commission_record(uuid,uuid,uuid)','EXECUTE') AS exist,
       has_function_privilege('worker_dispatcher','public.mark_outbox_item_processed(uuid,uuid,text,text,int)','EXECUTE') AS mark;
-- espera: t, t, t, t, t

SELECT to_regclass('public.worker_heartbeat') IS NOT NULL AS hb_table;
SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname='handle_processing_failure') AS hpf_absent,
       EXISTS (SELECT 1 FROM pg_proc WHERE proname='recover_stale_processing') AS rsp_absent;
-- espera: hb_table=t; hpf_absent=f, rsp_absent=f  (ainda NÃO existem — migration posterior não aplicada)

SELECT * FROM public.get_outbox_queue_health();
```

**PASS quando:** role NOLOGIN + NOBYPASSRLS + sem privilégio de tabela; RPCs corretas com `SECURITY DEFINER`+`search_path=public`+assinatura verda; 5 grants-chave=t; `worker_heartbeat` existe; `get_outbox_queue_health()` responde estrutura esperada (contadores 0/estado atual); **`handle_processing_failure`/`recover_stale_processing` AUSENTES** (nenhuma migration posterior aplicada).

**Rollback Marco 1:** migration que só cria role/funções/tabela/policies/grants — não destrutivo de dados financeiros. Reverter = reexecução controlada/recovery (idempotência documentada) ou, se necessário, remoção dirigida (drop role/grants) **sempre com PO**; não remover dados.

---

## Marco 2 — Worker Schedule (descriptor)

Aplicar:

```text
supabase/migrations/20260827210000_d8_worker_schedule.sql
```

> Descriptor only — RAISE NOTICE; registra job via dashboard Cron; **no-op se `pg_cron` ausente** (o agendamento real é tratado no Marco 5).

**STOP + validação (read-only):**
- Sem erro na aplicação; nada de schedule ativo ainda.

```sql
SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='cron') AS pg_cron_schema;
-- espera: false (ausente) OU true se além do esperado; NÃO configura schedule agora
SELECT to_regclass('public.worker_heartbeat') IS NOT NULL AS hb_still;
```

**PASS quando:** aplicação sem erro; `pg_cron` ainda não configurado/registrado (fica para Marco 5); nenhuma migration posterior aplicada.

**Rollback Marco 2:** descriptor não-destrutivo (no-op); reexecução controlada se necessário, com PO.

---

## Marco 3 — Retry / Dead-Letter (Amd-04)

Aplicar:

```text
supabase/migrations/20260828000000_d8_worker_retry_dead_letter.sql
```

> Cria `handle_processing_failure` (processing→pending/backoff|dead_letter), `recover_stale_processing` (stale→pending) e amenda o predicado de `claim_next_outbox_item` para honrar `retry_next_retry_at`. Todos `CREATE OR REPLACE`, idempotentes; grants de retry adicionados aqui.

**STOP + validação (read-only):**
```sql
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS sig, p.prosecdef,
       regexp_replace(p.proconfig::text,'[{}]','','g') AS search_path
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public'
  AND p.proname IN ('handle_processing_failure','recover_stale_processing');
-- espera: 2 funções SECURITY DEFINER + search_path=public

SELECT has_function_privilege('worker_dispatcher','public.handle_processing_failure(uuid,uuid,text)','EXECUTE') AS hpf,
       has_function_privilege('worker_dispatcher','public.recover_stale_processing(uuid)','EXECUTE') AS rsp;
-- espera: t, t

-- claim predicate novo honra backoff (via pg_get_functiondef / comportamento)
SELECT pg_get_functiondef('public.claim_next_outbox_item(uuid,text)'::regprocedure);
-- espera: retry_next_retry_at IS NULL OR retry_next_retry_at <= now()

SELECT * FROM public.get_outbox_queue_health();
```

**PASS quando:** 2 funções presentes com `SECURITY DEFINER`+`search_path=public`; hpf/rsp grants=t; claim com predicado novo; health() ok; nenhuma função financeira D7 alterada; nenhuma migration além destas aplicada.

**Rollback Marco 3:** migrations **não** revertidas destrutivamente sem procedimento específico + PO. Em falha, reportar e não prosseguir.

---

## Marco 4 — Deploy da Edge Function

```bash
supabase functions deploy worker-dispatcher --project-ref ushsnmlbeurfvlkieiln
```

- `config.toml` `verify_jwt=false` (invocação interna/Cron; precedente `notification-sweep`).
- Bundle CLI v2.95.6 empacota `_shared/financial-core/index.ts` (import dentro de `supabase/functions/`).

**STOP + validação:**
```bash
supabase functions list --project-ref ushsnmlbeurfvlkieiln
# worker-dispatcher presente, cases OK
# invoke de sanidade (não auth de usuário; apenas responder sem erro de bundle):
#   GET/OPTIONS ou POST seco → sem erro de import/runtime
```

**PASS quando:** função listada e invocável (sem erro de bundle/import); sem alteração de frontend/D7.

**Rollback Marco 4:** remover/neutralizar a função (o worker ainda não é invocado — sem Cron no Marco 5 — e a role só age via RPC restrita); reversível. Nunca apagar dados.

---

## Marco 5 — `pg_cron` + schedule

> **Pré-requisito identificado no Pre-Deploy:** `pg_cron` AUSENTE no projeto. Resolver aqui, antes do agendamento.

1. Habilitar `pg_cron` no projeto (extensão/schema `cron`) — via dashboard/config do Supabase; requer aprovação PO por envolver extensão.
2. Registrar job de invocação ao worker (a cada minuto), usando a URL real do projeto e token de autorização (sem hardcodar segredo em git):
   `https://ushsnmlbeurfvlkieiln.supabase.co/functions/v1/worker-dispatcher`
3. Configurar env vars da função: `SUPABASE_JWT_SECRET`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_FUNCTION_NAME`.

**STOP + observação:**
- Confirmar `cron.job` registrado (`SELECT jobname, schedule FROM cron.job;`).
- Observar 2–3 ciclos sem intervenção.
- Health desejado: `DISPATCHER_ALIVE` (execuções periódicas sem erro), `QUEUE_QUERY_HEALTHY` (`get_outbox_queue_health()` estrutura), `LAST_SUCCESSFUL_DISPATCH` (heartbeat/health atualizado).

**PASS quando:** job agendado rolando, heartbeat update, sem erro de permissão; pipeline lendo fila sem tocar `63742efa` indevidamente.

**Rollback Marco 5:** `cron.unschedule` — imediato e não-destrutivo; retomar depois. Manter role/functions.

---

## Marco 6 — Teste operacional controlado

> Só após Marcos 1–5 comprovadamente saudáveis.

1. **Observar primeiro o worker sem tocar `63742efa`**: deixar ciclos processarem a fila atual (11 published — nenhum pendente novo); confirmar heartbeat/health estáveis e que **nenhum** item pendente novo é criado.
2. **Então verificar o `63742efa`** no fluxo **oficial**:
   `pending → processing → comissão → published`
   (somente leitura/verificação; **NÃO** `UPDATE`/`INSERT` manual; o item já está `published` — confirmar que permanece e que a comissão dele existe).
   - **exatamente uma** `commission_record` para o comanda do `63742efa`;
   - idempotência (nenhuma duplicata após ciclo repetido);
   - `event_id`/`tenant_id` corretos (tenant `f53427f0`);
   - valor/comissão (base R$100 → comissão esperada **50.00**);
   - sem duplicata.

**PASS quando:** 1 comissão íntegra; idempotência; `event_id`/`tenant_id`/valor corretos; sem duplicata; `63742efa` intocado em termos de escrita.

**Rollback Marco 6:** nenhum rollback de dados (nada escrito manualmente); se falhar, reportar e não prosseguir.

---

## Marco 7 — Validação final (Post-Deploy Gate)

| Check | Critério |
|-------|----------|
| Pipeline saudável | ALIVE / QUEUE_QUERY_HEALTHY / LAST_SUCCESSFUL_DISPATCH ✅ |
| `63742efa` | `published`, 1 comissão, íntegro |
| Fila | sem backlog anormal |
| `commission_records` | 16 active + 1 do `63742efa` (sem duplicata) |
| Observabilidade | `get_outbox_queue_health()`/`get_worker_heartbeat()` refletem |
| D7 | composite RPC intacto |
| Isolamento/privilégio | sem erro RLS/permission; nada cross-tenant |

**PASS quando:** tudo verde. → PO autoriza: ADR-016 **Production Certified**, ADR-015 **PROD CERTIFIED**, update ROADMAP/PROJECT_STATUS, commit doc, tag certificação.

---

## Rollback consolidado (por marco)

| Marco | Rollback | Destrutivo? |
|-------|----------|-------------|
| 0 | Nada a reverter (read-only) | — |
| 1 | Reexecução controlada/recovery (idempotência doc) ou remoção dirigida com PO | Role (não dados) |
| 2 | Descriptor no-op; reexecução se necessário | Não |
| 3 | Não reverter migration destrutivamente sem procedimento+PO | Não default |
| 4 | Remover/neutralizar function | Não |
| 5 | `cron.unschedule` | Não |
| 6 | Reportar; nada escrito manualmente | Não |
| 7 | — (encerramento) | — |

**Nunca:** apagar histórico financeiro; `UPDATE`/`DELETE`/`INSERT` manual em `63742efa`; reverter migration para apagar dados; executar SQL manual de criação/grants da `worker_dispatcher` fora da migration.

---

## Critérios objetivos de PASS/BLOCKED (resumo)

- **PASS** = todos os critérios do marco satisfeitos com evidência read-only; avançar.
- **BLOCKED** = qualquer critério falhou; parar; apontar achado exato + ação mínima; exigir decisão PO antes de prosseguir ou reverter.
- Estado global do deploy só fecha quando **Marco 7 PASS** + PO autorizar certificação.
