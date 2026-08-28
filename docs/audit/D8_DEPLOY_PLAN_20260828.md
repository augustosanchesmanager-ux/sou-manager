# D8 — Production Deploy Plan & Pre-Deploy Gate (READ-ONLY)

**Status:** PLAN PRODUZIDO (read-only) — **AGUARDA decisão do PO** para executar qualquer etapa de produção.
**Date:** 2026-08-28
**Certification basis:** ADR-016 Amendment-04 🟢 CERTIFIED (`a76bb9f` + `8671710`); Gates B/C/D 🟢; Gate A 🟢
**Branch:** `fix/checkout-staff-attribution` (14 ahead / 0 behind `main`)
**Project (prod):** `ushsnmlbeurfvlkieiln` — barber.soumanager.com
**HARD STOP:** *Não executar deploy pelo fato de o Amendment-04 estar certificado.* A certificação prova código+contrato; **não** prova a infraestrutura de produção (role/grants/RPCs/schedule/Edge Function). `63742efa` é o teste operacional real e **não** deve ser "resolvido" manualmente.

---

## Decisão de gate

| | |
|---|---|
| ✅ Verificado localmente (read-only) | Abaixo, seção "Pre-Deploy read-only — já confirmado" |
| ⏳ Exige verificação read-only em PROD | Abaixo, seção "Verificações read-only em prod (na janela de deploy, com PO)" |
| 🔴 Deploy em si | **BLOQUEADO → decisão do PO** |

---

## 1. Pre-deploy read-only

### Já confirmado (local)
- Linhagem: `097c687 → a76bb9f → 8671710` linear, 14 ahead / 0 behind `main`. ✅
- `npm run d8:verify` → `canonical Core == worker artifact (byte-identical), API intact.` ✅
- `npm run build` → PASS (10.33s). ✅
- Suite: **1152 pass / 5 pre-existing**; typecheck 67 baseline, zero novos. ✅
- Migration **não aplicada** em produção (nenhum deploy/migration executado nesta sessão). ✅
- Código worker: **sem `service_role`**, **sem acesso direto a tabelas** (só `rpc`), RPCs limitados às 8 autorizadas. ✅
- Migration ordering dependency-safe (outbox → D7 composite → rpc_surface → schedule → retry_dead_letter). ✅

### A confirmar read-only em produção (com PO; sem alterar nada)
- Estado atual de `outbox_items` — especialmente o item `63742efa` (tenant `f53427f0`, R$100, status atual, `event_id`, `targets`).
- Confirmação de que NENHUMA das 3 migrations D8 existe ainda em prod (tabelas/funções ausentes).
- Deployment atual do frontend (Vercel `smg-barber`): qual alias/release está ativo.
- Presença de `pg_cron` (schema `cron`) no projeto — decide se o schedule é via migration ou dashboard Cron.

> **Nota:** esta máquina não possui credencial (service key / DB string) para consulta read-only ao banco prod. Nenhum acesso a prod será tentado sem credencial de leitura apropriada + aprovação do PO.

---

## 2. Preparar autoridade no Supabase (SUPABASE_CORE / role + grants)

Ordem exata (aplicar em `public` via migration já existente `20260827120000_d8_worker_rpc_surface.sql`):
1. `CREATE ROLE worker_dispatcher NOLOGIN;` (idempotente; sem `BYPASSRLS`, sem `LOGIN`).
2. A migration já concede **somente** `EXECUTE` das RPCs a `worker_dispatcher` (nunca SELECT/INSERT/UPDATE direto a tabelas).
3. Confirmação pós-migration:
   - `has_function_privilege('worker_dispatcher', '<rpc>', 'EXECUTE')` = t para as 8 RPCs URLs.
   - **worker NÃO** possui `USAGE`/`SELECT`/`INSERT` em `outbox_items`, `commission_records`, `comandas`, `comanda_items`, `service_execution_participants`, `staff`, `worker_heartbeat`.
   - `service_role` **ausente** do código do worker (já verificado localmente).
4. **Grants** conferidos: `cluster` role `worker_dispatcher` com `NOLOGIN`; nenhuma role `BYSUPERUSER`/`BYPASSRLS`.

---

## 3. Aplicar migrations em produção (requer PO + janela)

Ordem (idempotente, transaction-safe):
1. `20260827120000_d8_worker_rpc_surface.sql` — cria role + 6 RPCs + `worker_heartbeat` (+ RLS) + `get_outbox_queue_health` + `get_worker_heartbeat`.
2. `20260827210000_d8_worker_schedule.sql` — schedule descriptor (no-op se `pg_cron` ausente).
3. `20260828000000_d8_worker_retry_dead_letter.sql` — `handle_processing_failure` + `recover_stale_processing` + amenda `claim`.

Pós-migration (verificação read-only):
- Funções existentes com `SECURITY DEFINER` + `SET search_path=public`.
- Grants corretos (sem grant PUBLIC extra).
- Testes read-only: chamar `get_outbox_queue_health()` e `get_worker_heartbeat()` retornam estrutura esperada (0 itens processados ainda).

> **Reversão de migration:** NÃO reverter destrutivamente. Se necessário, documentar procedimento específico (abaixo, §8).

---

## 4. Deploy da Edge Function

```bash
supabase functions deploy worker-dispatcher --project-ref ushsnmlbeurfvlkieiln
```
- `config.toml` (`verify_jwt=false`) segue o precedente `admin-create-user`/`notification-sweep` (invocado internamente por Cron, não por usuário).
- Validar: bundle OK, função responde a um invoke `OPTIONS`/`health`, sem erros de import (`_shared/financial-core/index.ts` empacotado pelo CLI 2.95.6).
- **Não** promover frontend; **não** alterar D7/composite RPC.

---

## 5. Ativar agendamento (Supabase Cron)

- Se `pg_cron` presente: registrar job com credencial dedicada. O descriptor (`20260827210000`) usa `<PROJECT_REF>` e `%s` placeholder — **preencher no momento do deploy** com a URL `https://ushsnmlbeurfvlkieiln.supabase.co/functions/v1/worker-dispatcher` e o token/autorização correta (sem hardcodar segredo em git; gerenciar via dashboard/secrets).
- Se `pg_cron` ausente: registrar via **Supabase Dashboard → Cron** (invocação a cada minuto).
- Variáveis de ambiente da função: `SUPABASE_JWT_SECRET` (para `mintWorkerJwt` → role `worker_dispatcher`), `SUPABASE_URL`, `SUPABASE_ANON_KEY` (gateway); `SUPABASE_FUNCTION_NAME`.
- Implementar **lookup de secret no runtime** (o worker lê `SUPABASE_JWT_SECRET`). Confirmação via health:
  - `DISPATCHER_ALIVE` = mensagem de execução periódica sem erro;
  - `QUEUE_QUERY_HEALTHY` = `get_outbox_queue_health()` retorna estrutura correta;
  - `LAST_SUCCESSFUL_DISPATCH` = timestamp em `worker_heartbeat`/health atualizado após ciclo.

---

## 6. Teste operacional controlado (fluxo oficial)

> Diagrama-alvo: `pending → processing → comissão → published` (via worker, sem intervenção manual).

1. **Observar primeiro o worker SEM tocar em `63742efa`** — deixar ciclos rodarem; confirmar heartbeat vivo e queue health.
2. **Então verificar o `63742efa`** no fluxo oficial.
3. Confirmações no `63742efa`:
   - **exatamente uma** `commission_record` criada;
   - idempotência respeitada (nenhuma duplicata, mesmo após ciclo repetido);
   - `event_id` / `tenant_id` corretos (tenant `f53427f0`);
   - valor/comissão corretos (R$100 base → comissão conforme regra — esperada **50.00** por validação de equivalência);
   - ausência de duplicata (única `commission_record` com aquele `comanda_id`/`staff_id`/`event_id`).

---

## 7. Chaos operacional (controlado, read-mostly)

- Falha controlada: simular RPC falho / commit de um item mau para o worker.
- Verificar **retry/backoff** (`pending` + `retry_next_retry_at` futuro após falha).
- Verificar **reclaim de stale** (`recover_stale_processing` devolve `processing` órfão → `pending`).
- Verificar **dead-letter** no limite (`handle_processing_failure` promove a `dead_letter` após `maxAttempts`).
- Verificar que o **próximo ciclo continua** (worker não morre; heartbeat segue; itens publicados/retry normais seguem fluindo).
- **Não** executar chaos contra `63742efa`.

---

## 8. Rollback (definido ANTES da ativação)

Ordem de reversão (não-destrutiva):
1. **Desativar schedule** (remover/desligar o cron job) — interrompe novas execuções do worker.
2. **Retirar execução do worker** (remover/adequar a função de produção ou revogar grants das RPCs ao `worker_dispatcher`) — sem apagar função se desnecessário.
3. **Restaurar caminho client-side via feature flag** (o dispatcher original do app volta a processar) — garantindo continuidade do pipeline.
4. **NÃO** apagar histórico financeiro; **NÃO** fazer UPDATE manual em `63742efa`.
5. Migrations **não** são "desfeitas" destrutivamente sem procedimento específico e aprovação. Reverter apenas por `DROP ... IF EXISTS`/amenda explícita documentada, se absolutamente necessário e aprovado pelo PO.

---

## 9. Post-Deploy Gate

| Check | Critério |
|-------|----------|
| Pipeline saudável | `DISPATCHER_ALIVE`, `QUEUE_QUERY_HEALTHY`, `LAST_SUCCESSFUL_DISPATCH` OK |
| `63742efa` drenado | transitou `pending → processing → published` |
| 1 comissão | uma única `commission_record` p/ o item |
| Net correto | valor/comissão conferem com a regra (50.00 esperado) |
| Observabilidade | `get_outbox_queue_health()` / `get_worker_heartbeat()` refletem corretamente |
| D7 intacto | composite RPC / pipeline financeiro original sem alteração |
| Isolamento/privilégio | nenhum erro RLS/permission; nada cross-tenant |

---

## 10. Somente então (encerramento)

1. ADR-016 → **Production Certified**
2. ADR-015 → **PROD CERTIFIED**
3. Atualizar `ROADMAP.md` / `PROJECT_STATUS.md`
4. Commit de documentação
5. Tag de certificação (ex.: `vX.Y.Z-d8-production`)

---

## ⚠️ HARD STOP (inalterável)

- Não executar deploy apenas por certificação do código. A infra de produção precisa ser **montada e comprovada**.
- `63742efa` é o **teste operacional real**, reservado pós-deploy; **não** resolver manualmente em nenhuma hipótese.
- Nenhuma migration em prod, nenhum deploy, nenhum schedule, nenhuma tag de certificação sem **aprovação explícita do PO**.

---

## Próxima ação (depende do PO)

Após sua autorização e disponibilização de credencial de leitura apropriada, executar a **fase 1 em modo read-only sobre prod** (estado de `outbox_items`/`63742efa`, ausência das migrations, deploy atual do frontend, presença de `pg_cron`) → trazer o resultado → só então decidir execução do deploy (fases 2–5) → teste operacional (6) → chaos (7) → post-deploy gate (9) → certificação (10).
