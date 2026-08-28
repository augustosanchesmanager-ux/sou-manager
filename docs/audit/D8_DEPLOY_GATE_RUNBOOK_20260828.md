# D8 — Deploy Gate Runbook

**Status:** RUNBOOK PREPARADO (read-only) — **execução AGUARDA autorização explícita do PO**
**Date:** 2026-08-28
**Upstream gates:** Amd-04 🟢 CERTIFIED · Deploy Plan `3a252f5` 🟢 · Production Pre-Deploy Gate 🟢 PASS
**Project (prod):** `ushsnmlbeurfvlkieiln` — alias `barber.soumanager.com`
**Branch:** `fix/checkout-staff-attribution`

---

## Regra rígida (inalterável)

> **`63742efa` NÃO é ferramenta de teste de infraestrutura.**
> Só será utilizado (leitura/verificação) **depois** que role → migrations → worker → cron estiverem comprovadamente saudáveis.
> **Nunca** usar `UPDATE`/`DELETE`/`INSERT` manual, nem qualquer alteração direta nessa entrada.

## Regra de execução

- Cada **Marco** termina em **STOP + validação** contra critérios objetivos.
- Se **qualquer critério** falhar → **🔴 BLOCKED** + executar **rollback do marco** (§Rollback) + reportar ao PO. Não avançar.
- Nenhuma etapa destrutiva sem PO.
- Não promover frontend; não alterar D7/composite RPC.

---

## Marco 0 — Snapshot / read-only final

- Confirmar commit certificado: `8671710` (funcional Amd-04) e plan `3a252f5` estão em `HEAD` na branch.
- Confirmar estado Q1–Q6 (os mesmos deste pre-deploy): `63742efa` `published` íntegro, fila 11 published, D8 ausente, `commission_records` 16 active.
- Registrar o estado antes da primeira escrita (para diff/rollback).

**PASS quando:** todas as leituras confirmam o snapshot esperado (sem delta vs pre-deploy).

---

## Marco 1 — `worker_dispatcher` + grants

Aplicar exclusivamente a criação da role e grants (sem scheduler ainda).

**Script (via migration `20260827120000_d8_worker_rpc_surface.sql` aplicada em prod, ou SQL equivalente — SEM `service_role`, SEM BYPASSRLS):**

```sql
-- role mínima (migration já a cria idempotentemente)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'worker_dispatcher') THEN
    CREATE ROLE worker_dispatcher NOLOGIN;
  END IF;
END $$;

-- grants EXECUTE apenas (8 RPCs; SEM privilégio de tabela)
GRANT EXECUTE ON FUNCTION public.claim_next_outbox_item(UUID, TEXT) TO worker_dispatcher;
GRANT EXECUTE ON FUNCTION public.get_financial_operation_context(UUID, UUID) TO worker_dispatcher;
GRANT EXECUTE ON FUNCTION public.exists_commission_record(UUID, UUID, UUID) TO worker_dispatcher;
GRANT EXECUTE ON FUNCTION public.insert_commission_record(
  UUID, UUID, UUID, UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC,
  NUMERIC, NUMERIC, TEXT, BOOLEAN, TEXT, TEXT, TEXT) TO worker_dispatcher;
GRANT EXECUTE ON FUNCTION public.mark_outbox_item_processed(UUID, UUID, TEXT, TEXT, INT) TO worker_dispatcher;
GRANT EXECUTE ON FUNCTION public.upsert_worker_heartbeat(
  TEXT, TIMESTAMPTZ, BOOLEAN, TEXT, BIGINT, BIGINT, BIGINT) TO worker_dispatcher;
GRANT EXECUTE ON FUNCTION public.get_worker_heartbeat(TEXT) TO worker_dispatcher;
GRANT EXECUTE ON FUNCTION public.handle_processing_failure(UUID, UUID, TEXT) TO worker_dispatcher;
GRANT EXECUTE ON FUNCTION public.recover_stale_processing(UUID) TO worker_dispatcher;
```

**STOP + validação (read-only):**
```sql
SELECT rolname, rolcanlogin, rolbypassrls FROM pg_roles WHERE rolname='worker_dispatcher';
-- espera: NOLOGIN, bypassrls = false, sem superuser
SELECT grantee, privilege_type FROM information_schema.role_table_grants
WHERE grantee='worker_dispatcher' ORDER BY table_name;
-- espera: NENHUM privilégio direto a tabelas (apenas EXECUTE de funções)
SELECT has_function_privilege('worker_dispatcher','public.claim_next_outbox_item(uuid,text)','EXECUTE') AS claim,
       has_function_privilege('worker_dispatcher','public.handle_processing_failure(uuid,uuid,text)','EXECUTE') AS hpf,
       has_function_privilege('worker_dispatcher','public.recover_stale_processing(uuid)','EXECUTE') AS rsp;
-- espera: t, t, t
```

**PASS quando:** role NOLOGIN sem bypassrls; **zero** privilégio direto a tabelas; 3 grants-chave `t`.

**Rollback Marco 1:** o que somente cria role/grants — não destrutivo de dados. Reverter = revogar grants + `DROP ROLE IF EXISTS worker_dispatcher;` (só com PO; migrations não desfeitas destrutivamente sem procedimento).

---

## Marco 2 — Migrations D8 (ordem exata)

Aplicar em ordem (dependência): rpc_surface → schedule → retry_dead_letter.

1. `20260827120000_d8_worker_rpc_surface.sql` (funções + heartbeat table + health)
2. `20260827210000_d8_worker_schedule.sql` (descriptor; no-op se pg_cron ausente — ver Marco 4)
3. `20260828000000_d8_worker_retry_dead_letter.sql` (handle_processing_failure + recover_stale_processing + amenda claim)

**STOP + validação (read-only):**
```sql
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS sig, p.prosecdef,
       regexp_replace(p.proconfig::text,'[{}]','','g') AS search_path
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN ('claim_next_outbox_item','get_financial_operation_context','insert_commission_record','exists_commission_record','mark_outbox_item_processed','upsert_worker_heartbeat','get_outbox_queue_health','get_worker_heartbeat','handle_processing_failure','recover_stale_processing');
-- SECURITY DEFINER + search_path=public + assinaturas corretas
SELECT * FROM public.get_outbox_queue_health();
SELECT * FROM public.get_worker_heartbeat(NULL);
```

**PASS quando:** todas as 10 funções presentes com `SECURITY DEFINER`+`search_path=public`+assinatura correta; `get_outbox_queue_health()` e `get_worker_heartbeat()` retornam JSON esperado (contadores 0/estrutura); nenhuma função financeira D7 alterada.

**Rollback Marco 2:** migrations **não** desfeitas destrutivamente sem procedimento específico + PO. Em caso de falha, reportar ao PO antes de qualquer `DROP`.

---

## Marco 3 — Deploy da Edge Function

```bash
supabase functions deploy worker-dispatcher --project-ref ushsnmlbeurfvlkieiln
```

- `config.toml` `verify_jwt=false` (invocação interna/Cron; precedente `notification-sweep`).
- Bundle CLI v2.95.6 empacota `_shared/financial-core/index.ts` (import dentro de `supabase/functions/`).

**STOP + validação:**
```bash
supabase functions list --project-ref ushsnmlbeurfvlkieiln
# worker-dispatcher presente, status/cases OK
# invoke de sanidade (não auth de usuário, apenas responder):
#   GET/OPTIONS ou POST seco → 200 (sem credenciais obrigatórias)
```

**PASS quando:** função listada e invocável (responde sem erro de bundle/import); sem alteração de frontend/D7.

**Rollback Marco 3:** remover/apontar a função para vazio (o worker ainda não tem grants de escrita suficientes para agir; a role existe mas nada invoca sem Cron) — reversível. Manter até aprovação; nunca apagar dados.

---

## Marco 4 — `pg_cron` + schedule

> **Pré-requisito identificado no Pre-Deploy:** `pg_cron` AUSENTE no projeto. Resolver aqui, antes do agendamento.

1. Habilitar `pg_cron` no projeto (extensão/schema `cron`) — via dashboard/config do Supabase (não é migration ad-hoc; requer aprovação PO por envolver extensão).
2. Registrar job de invocação ao worker a cada minuto, usando a URL real do projeto e token de autorização (sem hardcodar segredo em git — via dashboard Cron / secrets):
   `https://ushsnmlbeurfvlkieiln.supabase.co/functions/v1/worker-dispatcher`
3. Configurar env vars da função: `SUPABASE_JWT_SECRET`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_FUNCTION_NAME`.

**STOP + observação:**
- Confirmar `cron.job` registrado (`SELECT jobname, schedule FROM cron.job;`).
- Observar 2–3 ciclos sem intervenção.
- Health desejado:
  - `DISPATCHER_ALIVE` = execuções periódicas sem erro;
  - `QUEUE_QUERY_HEALTHY` = `get_outbox_queue_health()` estrutura correta;
  - `LAST_SUCCESSFUL_DISPATCH` = `worker_heartbeat`/health atualizado.

**PASS quando:** job agendado rolando, heartbeat update, sem erro de permissão; pipeline lendo fila sem tocar `63742efa` indevidamente.

**Rollback Marco 4:** desativar o `cron` job (`cron.unschedule`) — imediato e não-destrutivo; retomar depois. Manter role/functions.

---

## Marco 5 — Teste operacional controlado

> Só após Marcos 1–4 comprovadamente saudáveis.

1. **Observar primeiro o worker sem tocar `63742efa`**: deixar ciclos processarem a fila atual (11 published — nenhum pendente novo); confirmar heartbeat/health estáveis e que **nenhum** item pendente novo é criado.
2. **Então verificar o `63742efa`** no fluxo **oficial**:
   `pending → processing → comissão → published`
   (somente leitura/verificação; **NÃO** fazer `UPDATE`/`INSERT` manual; o item já está `published` — confirmar que permanece e que a comissão dele existe).
   - **exatamente uma** `commission_record` para o comanda do `63742efa`;
   - idempotência (nenhuma duplicata após ciclo repetido);
   - `event_id`/`tenant_id` corretos (tenant `f53427f0`);
   - valor/comissão (base R$100 → comissão esperada **50.00**);
   - sem duplicata.

**PASS quando:** 1 comissão íntegra; idempotência; `event_id`/`tenant_id`/valor corretos; sem duplicata; `63742efa` intocado em termos de escrita.

**Rollback Marco 5:** nenhum rollback de dados necessário (nada escrito manualmente); se a validação falhar, reportar e não prosseguir.

---

## Marco 6 — Validação final (Post-Deploy Gate)

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
| 1 | Revogar grants + `DROP ROLE` (com PO) | Sim (role) — não dados |
| 2 | Não desfazer migration destrutivamente sem procedimento+PO | Não default |
| 3 | Remover/neutralizar function | Não |
| 4 | `cron.unschedule` | Não |
| 5 | Reportar; nada escrito manualmente | Não |
| 6 | — (encerramento) | — |

**Nunca:** apagar histórico financeiro; `UPDATE`/`DELETE`/`INSERT` manual em `63742efa`; reverter migration para apagar dados.

---

## Critérios objetivos de PASS/BLOCKED (resumo)

- **PASS** = todos os critérios do marco satisfeitos com evidência read-only; avançar.
- **BLOCKED** = qualquer critério falhou; parar; apontar achado exato + ação mínima; exigir decisão PO antes de prosseguir ou reverter.
- Estado global do deploy só fecha quando **Marco 6 PASS** + PO autorizar certificação.
