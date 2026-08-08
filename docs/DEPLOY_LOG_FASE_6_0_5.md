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

### MIGRATION 1 — `20260806090000_phase_6_0_5_2_plans_catalog.sql`

| Campo | Valor |
|-------|-------|
| Status | ⏳ |
| Início (UTC) | — |
| Fim (UTC) | — |
| Resultado | — |
| Verificação | — |

### MIGRATION 2 — `20260807000000_phase_6_0_5_3_feature_flags.sql`

| Campo | Valor |
|-------|-------|
| Status | ⏳ |
| Resultado | — |
| Verificação | — |

### MIGRATION 3 — `20260807010000_phase_6_0_5_4_tenant_lifecycle.sql`

| Campo | Valor |
|-------|-------|
| Status | ⏳ |
| Resultado | — |
| Verificação | — |

### MIGRATION 4 — `20260807020000_phase_6_0_5_5_transitions.sql`

| Campo | Valor |
|-------|-------|
| Status | ⏳ |
| Resultado | — |
| Verificação | — |

### MIGRATION 5 — `20260808000000_fix_create_invoice_record_payment_attempt_ambiguity.sql`

| Campo | Valor |
|-------|-------|
| Status | ⏳ |
| Resultado | — |
| Verificação | — |

---

## Pós-deploy validation

| Área | Resultado | Evidência |
|------|-----------|-----------|
| Migration history | ⏳ | — |
| Schema/FKs | ⏳ | — |
| RLS/policies/grants | ⏳ | — |
| RPCs | ⏳ | — |
| Feature Flags | ⏳ | — |
| Planos/limites | ⏳ | — |
| Estado dos tenants | ⏳ | — |

## Validação E2E

| Suite | Resultado |
|-------|-----------|
| Flow14 (execução real) | ⏳ |
| Flow13 (regressão 8/8) | ⏳ |
| Smoke E2E (10/10) | ⏳ |

## Resultado final da janela

**Status:** ⏳ EM ANDAMENTO
