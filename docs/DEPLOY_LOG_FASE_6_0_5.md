# Deploy Log — Janela Única de Deploy (Fase 6.0.5)

> Log de execução controlada da Janela Única. Procedimento de referência:
> `docs/DEPLOY_RUNBOOK_FASE_6_0_5.md`.
> **Regra:** qualquer falha em migration ou verificação → **ABORTAR** (sem tentar a próxima).

## Identificação da janela

- **Projeto (remote):** `ushsnmlbeurfvlkieiln` (Sanchez Barber — SMG Barber)
- **Branch:** `feature/phase-6.0.4-billing`
- **Head local/remote:** `65bd0cb`
- **Autorização PO:** 2026-08-08 — abrir Janela Única (execução conforme runbook; sem merge; sem 6.0.6)
- **PCA 6.0.5.6:** ✅ `READY` (ver `docs/audit/PRODUCTION_COMPATIBILITY_AUDIT.md`)
- **SCHEMA FREEZE:** YES (desde a PCA 6.0.5.4)
- **CLI Supabase:** v2.105.0
- **Plano do projeto:** Free (sem backup automático/PITR) → **D-6.0.5.7**: backup lógico + teste de restauração (§2.2 do runbook)

## Escopo autorizado (ordem fixa)

```text
06090000 → 07000000 → 07010000 → 07020000 → 08000000
```

`06030000` **não** entra na janela (reparada como aplicada em 2026-08-08 — D-6.0.5.6-5).

---

## Pré-flight

| Check | Resultado | Evidência |
|-------|-----------|-----------|
| Branch | OK | `feature/phase-6.0.4-billing` |
| Working tree | OK | limpo |
| CLI linked | OK | `supabase/.temp/linked-project.json` presente |
| Migration list (local × remote) | OK | exatamente 4 pendentes (`06090000`, `07000000`, `07010000`, `07020000`); `08000000` na janela; `06030000` aplicada |
| Backup (Free: lógico + teste de restauração) | ✅ executado 2026-08-08 | seção **Backup lógico** abaixo (D-6.0.5.7) |
| Snapshot estado atual | ✅ registrado abaixo | — |

### Snapshot pré-deploy (2026-08-08)

```text
tenants                               45
staff                                 42
profiles                               8
subscriptions                          1
invoices                               0
billing_events                         2
payment_attempts                       0
customer_subscriptions                15
customer_subscription_receivables     42
team_invitations                       0
role_permissions                    4901
event_store                            0
```

`supabase_migrations.schema_migrations WHERE version >= '20260806090000'` → **0 rows** (nada aplicado ainda).

---

## Backup lógico + teste de restauração (D-6.0.5.7 — plano Free)

> Requisito de recuperação no Free: **backup lógico completo + teste de restauração**,
> em substituição ao PITR indisponível. Executado **somente leitura** — nenhuma
> alteração de schema, dados, policies ou migrations.

### Artefatos gerados (2026-08-08)

**Diretório de backup:** `C:\Users\admsm\AppData\Local\Temp\opencode\backups\sou-manager\20260808_20260808-093350\`
**Cópia de custódia (fora do projeto):** `C:\Users\admsm\Backups\SMG_BARBER\20260808_20260808-093350\`

| Arquivo | Tamanho | Linhas | SHA-256 |
|---------|---------|--------|---------|
| `20260808_roles.sql` | 297 B | 7 | `25873CEC56A2CC6514E204F420231777F85C03DA818CAA7090CDCDFA89776ECD` |
| `20260808_schema.sql` | 578 189 B | 9 871 | `6887FAD57DBD60A1797560C3EB9979DC3FD7AFBF7E8FF4C1A633F2F7BDC630C4` |
| `20260808_data.sql` (completo, inclui auth/storage como referência) | 15 586 127 B | 21 392 | `F4DFE2159D68A846B55900BFDEC4F16398E216D738F3EB1CE8B153129B314E1F` |
| `20260808_data_app.sql` (aplicação: 109 tabelas, exclui auth.*/storage.*) | 15 460 042 B | 20 719 | `C38220B32577CF68A3164590DC6D7B7513BE9BC2D6BC70F529084ACD70B3B042` |

**Escopo:** Postgres 17.6. Schema dump cobre os schemas de aplicação (`public` 59, `control` 30,
`platform` 14, `club` 3, `varejo` 3 = 109 tabelas). Data dump completo cobre 138 tabelas
(inclui `auth` 22 e `storage` 7 — infra gerenciada pelo Supabase, mantida no `data.sql`
como referência, sem schema restaurável em Postgres puro).

**Integridade:** `data_app` inicia com `SET session_replication_role = replica;` (neutraliza
FKs circulares de `comanda_items`/`customer_plan_credit_usages`), 109 COPY todos terminados
com `\.`, fecha com `RESET ALL;` (arquivo não truncado).

### Teste de restauração (container local)

- **Imagem:** `public.ecr.aws/supabase/postgres:17.6.1.106` (mesma versão do remoto 17.6)
- **Container:** `smg-restore-test` (porta 55432), temporário
- **Sequência:** `roles.sql` (OK) → `schema.sql` (OK, exit=0) → `data_app.sql` (OK)

**Contagens pós-restauração vs. snapshot remoto (100% idênticas):**

```text
tenants                               45   ✅
staff                                 42   ✅
profiles                               8   ✅
subscriptions                          1   ✅
invoices                               0   ✅
billing_events                         2   ✅
payment_attempts                       0   ✅
customer_subscriptions                15   ✅
customer_subscription_receivables     42   ✅
team_invitations                       0   ✅
role_permissions                    4901   ✅
event_store                            0   ✅
```

**Conclusão do teste:** backup restaurável com sucesso em Postgres local 17.6, sem erros
(`ON_ERROR_STOP=1`), com contagens iguais ao snapshot pré-deploy. ✅

## Execução (preencher a cada etapa)

> Janela aberta em 2026-08-08 após aprovação explícita do PO (backup D-6.0.5.7 validado).
> Regra: **qualquer falha → ABORTAR** (execução pausada em verificação §4.9 — ver
> seção **Desvio de hardening detectado** abaixo).

### MIGRATION 1 — `20260806090000_phase_6_0_5_2_plans_catalog.sql`

| Campo | Valor |
|-------|-------|
| Status | ✅ aplicada |
| Início (UTC) | 2026-08-08 12:44:49 |
| Fim (UTC) | 2026-08-08 12:44:53 |
| Resultado | `db query --linked -f` exit=0; repair `[20260806090000] => applied` |
| Verificação | `plans`(3: free/pro/premium), `features`(20), `plan_features`(49) criadas |

### MIGRATION 2 — `20260807000000_phase_6_0_5_3_feature_flags.sql`

| Campo | Valor |
|-------|-------|
| Status | ✅ aplicada |
| Resultado | `db query --linked -f` exit=0; repair `[20260807000000] => applied` |
| Verificação | `feature_flags` criada; RPC `tenant_has_feature(uuid,text)` presente; histórico ok |

### MIGRATION 3 — `20260807010000_phase_6_0_5_4_tenant_lifecycle.sql`

| Campo | Valor |
|-------|-------|
| Status | ✅ aplicada |
| Resultado | `db query --linked -f` exit=0; repair `[20260807010000] => applied` |
| Verificação | RPCs `suspend_subscription(uuid)`/`reactivate_subscription(uuid)` presentes; `apply_subscription_transition(uuid,text,timestamptz,timestamptz,timestamptz,boolean,timestamptz)` (7 args, com `p_grace_ends_at`) |

### MIGRATION 4 — `20260807020000_phase_6_0_5_5_transitions.sql`

| Campo | Valor |
|-------|-------|
| Status | ✅ aplicada |
| Resultado | `db query --linked -f` exit=0; repair `[20260807020000] => applied` |
| Verificação | RPC `change_tenant_plan(uuid,text,text)` presente |

### MIGRATION 5 — `20260808000000_fix_create_invoice_record_payment_attempt_ambiguity.sql`

| Campo | Valor |
|-------|-------|
| Status | ✅ aplicada |
| Resultado | `db query --linked -f` exit=0; repair `[20260808000000] => applied` |
| Verificação | `create_invoice` → `ON CONFLICT DO NOTHING` = true; `record_payment_attempt` → `RETURNING a.id` = true |

### Migration history (pós-janela)

`supabase_migrations.schema_migrations >= '20260806090000'` → **5 rows**; `migration list --linked`
→ **zero pendentes** (`06030000`, `06090000`, `07000000`, `07010000`, `07020000`, `08000000` aplicadas).

---

## Pós-deploy validation

| Área | Resultado | Evidência |
|------|-----------|-----------|
| Migration history | ✅ | 6 versões aplicadas (`06030000` + as 5 da janela); zero pendentes |
| Schema/FKs | ✅ | `tenants_plan_fkey` + `subscriptions_plan_fkey` presentes; CHECK `subscriptions_status_check` aceita `suspended`; coluna `grace_ends_at` (timestamptz) presente; backfill `past_due` sem grace = 0 |
| RLS/policies/grants | ✅ resolvido | RLS ativo em `plans`/`features`/`plan_features`/`feature_flags`; `feature_flags` com 1 policy (superadmin ALL); `start_trial` sem `anon`; **fix D-6.0.5.8 aplicado: `anon_restantes = 0`** (exceções públicas preservadas) |
| RPCs | ✅ | 11 do contrato 6.0.4.3 presentes; `tenant_has_feature`/`generate_club_receivables`/`refresh_club_receivable_statuses`/`pay_club_receivable`/`suspend_subscription`/`reactivate_subscription`/`change_tenant_plan(uuid,text,text)` presentes; `apply_subscription_transition` com fail-fast (`RAISE EXCEPTION`); corpos `create_invoice`/`record_payment_attempt` desambiguados |
| Feature Flags | ✅ | Matriz `plan_features` = free 14 / pro 15 / premium 20 |
| Planos/limites | ✅ | 3 plans; RLS catálogo; FKs aditivas |
| Estado dos tenants | ✅ | Contagens pós-deploy iguais ao snapshot pré-deploy: tenants 45, staff 42, profiles 8, subscriptions 1, customer_subscriptions 15, receivables 42, role_permissions 4901, feature_flags 0 (nova, vazia — esperado) |

> **Migrations aplicadas na janela: 6** — as 5 originais (`06090000`→`08000000`) **+**
> `20260808110000_revoke_anon_rpc_execute.sql` (fix hardening D-6.0.5.8, aprovado pelo PO
> durante a janela).

### Desvio de hardening detectado (verificação §4.9 — execução PAUSADA)

**Fato:** verificação §4.9 do runbook detectou `anon` com `EXECUTE` em `create_invoice` e
`record_payment_attempt` — runbook: **"`anon` ou `PUBLIC` presentes → falha de hardening → abortar."**

**Análise:**
- O levantamento completo (`aclexplode(pg_proc.proacl)`) mostrou **~60 RPCs** com `EXECUTE`
  para `anon` no remoto, incluindo RPCs de billing (`create_invoice`, `record_payment_attempt`,
  `mark_invoice_paid`, `change_tenant_plan`, `suspend_subscription`, `reactivate_subscription`,
  `tenant_has_feature`, `apply_subscription_transition`, financeiras, etc.).
- **Pré-existente** — documentado em `docs/security/SECURITY_AUDIT_RPC.md` (linhas 166–181):
  o Supabase **auto-concede `EXECUTE` a `anon`** em funções novas; RPCs históricas (pré-hardening)
  permanecem anon-executáveis. Item pendente da auditoria da **Fase 6.0.4.2** (checklist):
  "Aplicar `REVOKE EXECUTE FROM anon` + `GRANT EXECUTE TO authenticated` onde não há justificativa de público."
- **Não foi introduzido pela janela:** nenhuma das 5 migrations concede a `anon`; a `08000000`
  removeu `PUBLIC` das duas RPCs (estado melhorado). O grant direto a `anon` é da criação
  original das funções.
- **Mitigação funcional:** as RPCs são `SECURITY DEFINER` e rejeitam chamada sem sessão na
  primeira linha (`create_invoice`: `IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'`).
  Chamador `anon` (sem JWT) → `auth.uid()` = null → rejeitado. Risco prático baixo, porém o
  padrão ADR-012 exige `REVOKE FROM anon` (defense-in-depth).
- **Exceções legítimas (intencionalmente públicas):** `get_invite_by_token` e `kiosk_get_staff`
  (GRANT `TO anon, authenticated` explícito nas migrations 20260806000000).

**Decisão:** aguardando aprovação explícita do PO (fix de hardening é alteração fora do runbook).

### Resolução (D-6.0.5.8 — PO aprovou o fix em 2026-08-08)

- **Fix aplicado:** `REVOKE EXECUTE ON FUNCTION ... FROM anon` em **55 RPCs** (transação
  atômica), preservando `get_invite_by_token` e `kiosk_get_staff` (públicas por design).
- **Registrado como migration** `20260808110000_revoke_anon_rpc_execute.sql` (idempotente)
  + `migration repair --status applied 20260808110000` → histórico alinhado repo/remoto.
- **Re-validação §4.9:** `create_invoice` e `record_payment_attempt` → apenas
  `authenticated`/`service_role`/`postgres` (sem `anon`, sem `PUBLIC`). ✅
- **Universo total:** `anon_restantes = 0` (excluídas as 2 exceções públicas). ✅

## Validação E2E

| Suite | Resultado |
|-------|-----------|
| Flow14 (execução real) | ✅ 1/1 passed (16.4s) — `past_due → suspended → active` contra o remoto (E2E_PROVISIONING=1) |
| Flow13 (regressão 8/8) | ✅ 8/8 passed (38.6s) — navegação por estado efetivo + resolução de features em free |
| Smoke E2E (10/10) | ✅ 10/10 passed (42.0s) — referência pré-deploy ~46.7s |

## Resultado final da janela

**Status:** ✅ **EXECUTADA COM SUCESSO** (2026-08-08)

- **6 migrations aplicadas:** `06090000` → `07000000` → `07010000` → `07020000` → `08000000` → `20260808110000` (fix hardening D-6.0.5.8); `06030000` reparada pré-janela (D-6.0.5.6-5). **Zero pendentes no histórico remoto.**
- **Pós-deploy validation:** 7/7 áreas verdes (histórico, schema/FKs, RLS/policies/grants após fix D-6.0.5.8, RPCs, feature flags, planos/limites, tenants).
- **Dados preservados:** contagens idênticas ao snapshot pré-deploy.
- **E2E:** Flow14 ✅, Flow13 8/8 ✅, Smoke 10/10 ✅.
- **Backup D-6.0.5.7:** válido e restaurável (evidência acima); container de teste local pode ser removido.
- **Sem merge; sem deploy de frontend; sem baseline.** Próximos gates: homologação Sanchez Barber → 6.0.6 → certificação final → v1.5.0.
