# RELEASE CHECKLIST — v1.5.0 (Feature Flags / Billing / Tenant Lifecycle)

> **Fase:** 6.0.5 — Billing / Tenant Lifecycle / Feature Flags
> **Status:** 🔄 EM ANDAMENTO — checklist vivo de certificação da versão.
> **Criado:** 2026-08-07 (decisão do PO) — consolida o aceite final da v1.5.0.
>
> **Como usar:** este documento acompanha a fase até o fechamento definitivo.
> A cada subfase concluída, marcar os itens correspondentes. No encerramento da
> 6.0.5, **tudo deve estar marcado** — este arquivo vira o documento de aceite
> da versão (`v1.5.0-feature-flags-6.0.5`).
>
> **Fonte da verdade:** ROADMAP.md (status/changelog 8.x), docs/audit/*ENTRY_AUDIT*,
> docs/adr/*, git tags/commits. Em caso de divergência, o ROADMAP prevalece e o
> checklist deve ser corrigido.

---

## 1. Fases da Versão

### 1.1 Fase 6.0.4 (base certificada — precedente da v1.5.0)

- [x] **6.0.4.1** Onboarding base — certificada (parte de `v1.4.0`)
- [x] **6.0.4.2** Billing Foundation — baseline `v1.4.0-billing-foundation-6.0.4.2`
- [x] **6.0.4.3** Billing Lifecycle — baseline `v1.4.1-billing-lifecycle-6.0.4.3`
- [x] **6.0.4.4** Billing Engine (`apply_subscription_transition`/`runCycle`, D-A) — baseline `v1.4.2-billing-engine-6.0.4.4`

### 1.2 Fase 6.0.5 (versão-alvo)

- [x] **6.0.5.0** Subfase 0 — Alinhamento documental + ADR-013 Accepted + D-6.0.5-1..8 aprovadas (2026-08-06)
- [x] **6.0.5.1** Estado Efetivo / camada de autorização — baseline `v1.4.3-effective-state-6.0.5.1` (✅ certificada PO)
- [x] **6.0.5.2** BillingService + Modelagem de Plans (PlanCatalog + `plans/features/plan_features`) — ✅ implementada + review PO (deploy pendente)
- [x] **6.0.5.3** FeatureFlagService + enforcement — ✅ implementada (commit `b383222`), smoke 10/10, aguardando janela de deploy
- [x] **6.0.5.4** TenantLifecycleService + `suspended` aditivo — ✅ implementada (unit 874/874, migration `20260807010000` validada T1–T7; flow14 E2E adiado à janela única — decisão PO)
- [x] **6.0.5.5** Transições RPCs (`change_tenant_plan` upgrade/downgrade, `TenantSubscriptionUpdated`, correção `Admin.tsx` escrita direta, banner estado, `UpgradePrompt`, depreciação `featureAvailability.ts`) — ✅ **IMPLEMENTADA (2026-08-08)**: unit 883/883, migration `20260807020000` validada em docker T1–T12 + idempotência 2×, **SCHEMA FREEZE = YES** (§12.3 entry audit); E2E flow11 adiado à janela única (decisão PO)
- [x] **Hardening RPCs irmãs (2026-08-08, decisão PO D-6.0.5.5-6..8)** — ✅ **CONCLUÍDO**: auditoria de estado efetivo + validação empírica PG16 (suite S1–S16 + G1) revelou **2 RPCs quebradas** (`create_invoice`/`record_payment_attempt` — declaradas "limpas" incorretamente na `06070000`); fix aditivo **`20260808000000`** validado **S1–S16 + G1 PASS** + idempotência 2×; sem mudança de regra/contrato/escopo (D-6.0.5.5-7)
- [x] **6.0.5.6** **Production Compatibility Audit (PCA)** — ✅ **`READY`** (executada 2026-08-08; inicialmente `BLOCKED` → correções PO D-6.0.5.6-5/6: `migration repair --status applied 20260806030000` + upgrade `free→pro` dos 3 tenants; re-auditoria OK) — **gate pré-deploy LIBERADO** — `docs/audit/PRODUCTION_COMPATIBILITY_AUDIT.md` = **READY**
- [ ] **6.0.6** **Compliance & Legal** — ⏳ **PLANNED** (2026-08-07, decisão PO); **gate obrigatório de certificação da release v1.5** — `docs/audit/PHASE_6_0_6_ENTRY_AUDIT.md`; fase **exclusivamente documental** nesta etapa

---

## 2. Migrations

### 2.1 Todas as migrations da versão (por ordem de aplicação)

> Aplicação ao remoto planejada como **janela única** — ver `docs/DEPLOY_RUNBOOK_FASE_6_0_5.md`.

| Migration | Subfase | Estado no remoto | Observação |
|---|---|---|---|
| `20260806000000_phase_6_0_3_team_invitations_and_role_normalization.sql` | 6.0.3 | ✅ Aplicada | — |
| `20260806010000_fix_accept_invite_tenant_id_ambiguity.sql` | 6.0.3 | ✅ Aplicada | — |
| `20260806020000_phase_6_0_4_billing.sql` | 6.0.4 | ✅ Aplicada | CHECK `subscriptions.status` sem `suspended` |
| `20260806030000_fix_auth_staff_id_to_profiles.sql` | 6.0.4.3 | ✅ **Aplicada (repair 2026-08-08 — PO D-6.0.5.6-5)** | Foi **pulada** no remoto; `cancel_subscription` (5 colunas) era incompatível com as 11 colunas já aplicadas. Corrigida via `supabase migration repair --status applied` (a autorização já existia via `06070000`). **Não executada no remoto** |
| `20260806040000_fix_complete_onboarding_trial.sql` | 6.0.4 | ✅ Aplicada | — |
| `20260806050000_phase_6_0_4_4_billing_engine.sql` | 6.0.4.4 | ✅ Aplicada | `apply_subscription_transition`, `get_due_subscriptions` |
| `20260806070000_fix_rpc_ambiguous_column_references.sql` | 6.0.4.4 | ✅ Aplicada | — |
| `20260806080000_fix_apply_subscription_transition_tenant_status_enum.sql` | 6.0.4.4 | ✅ Aplicada | Corrigido pela migration `20260807010000` (6.0.5.4): fail-fast implementado, sem fallback `ELSE → active` |
| `20260806090000_phase_6_0_5_2_plans_catalog.sql` | 6.0.5.2 | ✅ **Aplicada (janela 2026-08-08)** | `plans`/`features`/`plan_features` + FK aditiva |
| `20260807000000_phase_6_0_5_3_feature_flags.sql` | 6.0.5.3 | ✅ **Aplicada (janela 2026-08-08)** | `feature_flags` + `tenant_has_feature` + guarda RPCs |
| `20260807010000_phase_6_0_5_4_tenant_lifecycle.sql` | 6.0.5.4 | ✅ **Aplicada (janela 2026-08-08)** | `suspended` no CHECK + `grace_ends_at` + divisão do Transition Executor — **validada em docker T1–T7** |
| `20260807020000_phase_6_0_5_5_transitions.sql` | 6.0.5.5 | ✅ **Aplicada (janela 2026-08-08)** | `change_tenant_plan` (espelho `tenants.plan`, grants ADR-012) — **validada em docker T1–T12 + idempotência 2×** |
| `20260808000000_fix_create_invoice_record_payment_attempt_ambiguity.sql` | Hardening 6.0.5.5 | ✅ **Aplicada (janela 2026-08-08)** | Fix aditivo das RPCs irmãs `create_invoice`/`record_payment_attempt` (ON CONFLICT DO NOTHING + `RETURNING a.id`) — **validada em docker S1–S16 + G1 PASS + idempotência 2×** |
| `20260808110000_revoke_anon_rpc_execute.sql` | Hardening (PO D-6.0.5.8) | ✅ **Aplicada (janela 2026-08-08)** | 55× `REVOKE EXECUTE FROM anon` (débito 6.0.4.2); exceções públicas: `get_invite_by_token`, `kiosk_get_staff` |

- [x] Validar cada migration em Postgres docker (aplica 2× sem duplicar) **antes** da janela.
- [x] Aplicar via `MIGRATION_EXCEPTION` (`db query --linked -f` + `migration repair --status applied`) na janela única.
- [x] `supabase migration list --linked` 100% coerente após a janela.

---

## 3. ADRs da Versão

- [x] **ADR-012** — RPC Execute Grants (`REVOKE FROM PUBLIC/anon` + `GRANT TO authenticated`) — vigente
- [x] **ADR-013** — Billing, Tenant Lifecycle e Feature Flags: Três Contextos Desacoplados + Estado Efetivo + Single Writer (Accepted 2026-08-06)
- [ ] Revisar se 6.0.5.4/6.0.5.5 exigem novo ADR (preferência: NÃO — resolver dentro do ADR-013 §3.1/§4.7)

---

## 4. Entry Audits

- [x] `PHASE_6_0_5_ENTRY_AUDIT.md` — auditoria de entrada da 6.0.5 (base do ADR-013)
- [x] `PHASE_6_0_5_2_ENTRY_AUDIT.md` — ✅ APROVADA/IMPLEMENTADA
- [x] `PHASE_6_0_5_3_ENTRY_AUDIT.md` — ✅ APROVADA + implementação concluída (critério "deploy" pendente)
- [x] `PHASE_6_0_5_4_ENTRY_AUDIT.md` — ✅ APROVADA + implementação concluída (E2E flow14 adiado à janela única)
- [ ] `PHASE_6_0_5_5_ENTRY_AUDIT.md` — planejada

---

## 5. Smoke E2E (Supabase real)

- [x] **6.0.5.2** — smoke **10/10 PASS** (48.4s, 2026-08-06)
- [x] **6.0.5.3** — smoke **10/10 PASS** (46.7s, 2026-08-07)
- [x] **Pós-janela de deploy** — smoke **10/10 PASS** (42.0s, 2026-08-08 — runbook §5)
- [x] **6.0.5.4 / 6.0.5.5** — smoke 10/10 (executado na janela única, 2026-08-08)
- [ ] **Smoke final de certificação** (baseline) — 10/10

---

## 6. E2E Flows (Suíte completa)

> P0 (críticos) · P1 (CRUD admin) · P2 (relatórios). Tag `@smoke` nos críticos para CI.

- [x] flow1 — Appointment → Checkout → Commission (P0)
- [x] flow2 — ChefClub lifecycle (P0)
- [x] flow3 — Cancel/Reverse (P0)
- [x] flow4 — Multi-barber (P0)
- [x] flow5 — Cash closing + export (P0)
- [x] flow6 / flow6a — Tenant provisioning / signup UI (P1)
- [x] flow7 — Onboarding completo (P1)
- [x] flow8 — Team invitations (P1)
- [x] flow9 — Tenant lifecycle billing (P1)
- [x] flow12 — Cancel at period end (P1)
- [x] flow13 — Access-level navigation (Estado Efetivo, 8/8 PASS — 6.0.5.1; reexecutado 8/8 na janela, 2026-08-08)
- [x] **flow14** — Suspensão/reativação (`past_due → suspended → active`) — **1/1 PASS** (16.4s, 2026-08-08, janela única, `E2E_PROVISIONING=1`)
- [ ] **flow15** — Feature flags por plano (UI híbrida) — 6.0.5.3 (cobertura complementar)

---

## 7. Testes Unitários

- [x] 6.0.5.1 → 795 verdes (46 por matriz de estados)
- [x] 6.0.5.2 → 819 verdes (+24)
- [x] 6.0.5.3 → **847/847 verdes** (40 test files)
- [x] 6.0.5.4 → **874/874 verdes** (+27)
- [ ] 6.0.5.5 → suíte completa verde
- [x] Typecheck — baseline **125 erros** (sem novos em cada subfase)
- [x] Build — OK em todas as subfases (6.0.5.3: 10.80s)
- [x] `architecture:ci` — verde (repositoryViolations 233 → 230 na 6.0.5.3; 230 na 6.0.5.4)

---

## 8. Baselines

| Baseline | Subfase | Commit/Tag | Status |
|---|---|---|---|
| `v1.4.0-billing-foundation-6.0.4.2` | 6.0.4.2 | tag criada | ✅ |
| `v1.4.1-billing-lifecycle-6.0.4.3` | 6.0.4.3 | tag criada | ✅ |
| `v1.4.2-billing-engine-6.0.4.4` | 6.0.4.4 | tag criada | ✅ |
| `v1.4.3-effective-state-6.0.5.1` | 6.0.5.1 | tag criada | ✅ |
| `v1.5.0-feature-flags-6.0.5` | 6.0.5 (fechamento) | ❌ a criar | ⏳ |

> Baseline final exige: commit semântico + tag anotada + push da branch + push da
> tag + ROADMAP atualizado + PROJECT_STATUS atualizado + docs da fase atualizadas.

---

## 9. Commits de Certificação (histórico da versão)

- [x] `622a891` — test(billing): 6.0.5.1 E2E flow13 + certify
- [x] `4138881` — docs(billing): 6.0.5.2 entry audit
- [x] `95de518` — feat(billing): 6.0.5.2 plans catalog (PlanCatalog + FEATURE_KEYS + fingerprint)
- [x] `993978c` — docs(billing): 6.0.5.3 entry audit (aguardando PO)
- [x] `54284fb` — docs(billing): 6.0.5.3 PO adjustments (D-6.0.5.3-1..6)
- [x] `b383222` — feat(billing): 6.0.5.3 feature flags enforcement (implementação)
- [x] `f7f3620` — docs(billing): 6.0.5 deploy runbook (janela única)
- [x] `ff9f301` — docs(billing): 6.0.5.4 entry audit (4 auditorias + API congelada)
- [x] `5454c81` — feat(billing): 6.0.5.4 TenantLifecycleService + suspended (implementação; flow14 E2E adiado à janela única)
- [x] `6ca3788` — feat(billing): 6.0.5.5 plan transitions (`change_tenant_plan` + `changePlan` + `Admin.tsx` single writer + `UpgradePrompt` + `StatusBanner`; migration `20260807020000` T1–T12 OK; SCHEMA FREEZE = YES)
- [x] `65bd0cb` — docs(billing): 6.0.5.6 Production Compatibility Audit READY (PCA)
- [x] `fafeb98` — docs(billing): janela de deploy — backup lógico D-6.0.5.7 + runbook §2.2 + deploy log (pré-exec)
- [x] `0ca60a2` — fix(billing): hardening janela — migration `20260808110000` REVOKE anon (D-6.0.5.8) + deploy log + decisões

---

## 10. Deploy (janela única — ✅ EXECUTADA 2026-08-08)

> **Gate obrigatório (PO 2026-08-07):** antes de qualquer item abaixo, `docs/audit/PRODUCTION_COMPATIBILITY_AUDIT.md` deve estar **`READY`** — a **Production Compatibility Audit (6.0.5.6)** é executada contra o **banco real dos tenants produtivos**, imediatamente antes da janela única de deploy.
>
> **Pré-requisito da PCA — Schema Freeze (PO 2026-08-07):** o gate **"Schema Freeze Candidate"** (6.0.5.5) deve estar com veredito final **`SCHEMA FREEZE = YES`** (ver `PHASE_6_0_5_5_ENTRY_AUDIT.md` §12.3) antes de liberar a PCA. **✅ `SCHEMA FREEZE = YES` (2026-08-08)** — delta real = somente a RPC `change_tenant_plan` (prevista na entrada).
>
> **Resultado da janela:** 6 migrations aplicadas (`06090000`, `07000000`, `07010000`, `07020000`, `08000000`, `20260808110000`), pós-deploy 7/7 verdes, Flow14 1/1, Flow13 8/8, Smoke 10/10. Detalhes em `docs/DEPLOY_LOG_FASE_6_0_5.md`.

- [x] **Schema Freeze = YES** registrado no fechamento da 6.0.5.5 (gate §12.3 reexecutado com o diff real — 2026-08-08)
- [x] **Production Compatibility Audit** (`PRODUCTION_COMPATIBILITY_AUDIT.md = READY`)
- [x] Runbook versionado: `docs/DEPLOY_RUNBOOK_FASE_6_0_5.md` (commit `f7f3620`)
- [x] **Aprovação explícita do PO** para abrir a janela
- [x] Pré-flight (backup lógico D-6.0.5.7 + restore test, `migration list`, dados de plano)
- [x] Aplicar `06090000` → `07000000` → `07010000` → `07020000` (6.0.5.5) + `08000000` (hardening) + `20260808110000` (fix anon D-6.0.5.8) — ver runbook §3.2–§3.6. **`06030000` já reparada como aplicada (2026-08-08, D-6.0.5.6-5) — não aplicar**
- [x] Verificações pós-deploy (histórico, RLS, RPCs, matriz `tenant_has_feature`) — 7/7
- [x] Smoke 10/10 pós-deploy
- [ ] Deploy do frontend (Vercel) — se fizer parte da mesma liberação
- [ ] Rollback definido e testado conceitualmente (DB ordem reversa + Vercel juntos)

---

## 10.1 Homologação Sanchez Barber — gate formal da v1.5 (D-HOM, 2026-08-08)

> **Gate formal de homologação** posicionado **após a janela única de deploy (executada)** e **antes da Fase 6.0.6**. Regra do PO: **6.0.6 não começa enquanto a homologação não estiver `HOMOLOGADO` ou `HOMOLOGADO COM RESSALVAS`, formalmente aprovada pelo PO.**
> Plano completo: `docs/audit/HOMOLOGATION_PLAN_SANCHEZ_BARBER.md` (gates H-1 a H-8, evidência por teste, vereditos 🟢/🟡/🔴).
> **Atualização 2026-08-08 (D-HOM-9):** adicionado o **gate H-8 — Infraestrutura Vercel / Deployment Topology**. Auditoria read-only executada → `docs/audit/VERCEL_DEPLOYMENT_TOPOLOGY_AUDIT.md` (oficial: `smg-barber`/`barber.soumanager.com`; legado: `sou-manager`; produção `718f6f9` defasada).
> **Atualização 2026-08-08 (D-HOM-10):** decisão do PO — **homologação NÃO encerrada; H-8 formalizado como BLOQUEADOR**. Produção atende frontend `718f6f9` (sem 6.0.1–6.0.5 e sem fix `68acda4`) → **bloco de Hardening da Homologação / Vercel (§8.1 do plano)** pré-requisito: origem oficial única, destino do legado (PO), ETAPA B auth/tenant, preview oficial `68acda4`, re-teste de Comissões, testes H-1..H-7, registro de achados e fechamento dos gates. **Proibido até nova ordem do PO:** merge `main`, deploy v1.5, abertura 6.0.6, alterações remotas na Vercel.
> **Atualização 2026-08-08 (Pré-homologação autorizada):** **baseline do snapshot** registrado em `docs/audit/SNAPSHOT_PRE_HOMOLOGACAO_SANCHEZ_BARBER_v1_5_0.md` (contagens read-only do tenant `sanchez`; achados S1–S8) + **especificação de execução dos gates H-1..H-7** (§8.2 do plano — pré-condição/procedimento/resultado/evidência/severidade/critério). Critério H3-6 corrigido para **16 assinaturas**. **ETAPA B segue ADIADA** (sem conta de homologação — 5 staff sem usuário de app; só o superadmin existe).
> **Atualização 2026-08-08 (D-HOM-12):** **conta de homologação no tenant Sanchez Barber CRIADA, VALIDADA e ETAPA B EXECUTADA** (`homolog.sanchez@barber.soumanager.com`, id `189053ab-…`, manager/active, membership primária, staff via trigger). Login GoTrue 200 + RLS + `get_auth_access_context` OK; login UI local OK (`/#/dashboard`), 0 erros de console/HTTP, Comissões com dados reais. **Achado EB-1 (P3, cosmético):** header "Minha Barbearia"/"PLANO FREE" (Layout.tsx usa `user_metadata`, não `tenants`). Procedimento + pitfalls: `docs/audit/HOMOLOG_ACCOUNT_PROVISIONING.md`.
> **Atualização 2026-08-09 (D-HOM-13):** **EB-2 (P1) CORRIGIDO — 42703 `column comandas.client_name does not exist`.** 3 colunas-fantasma (`client_name`, `paid_amount`, `notes`) removidas de `COMANDA_COLUMNS`/`toComanda` (`domain/comanda/repository.ts`); tipo `Comanda` ajustado + `UpdateComandaInput` sem `paid_amount`/`notes`; fallbacks preservados nos consumidores; regression guard `domain/comanda/repository.test.ts` (5 testes). Unit **888/888**, typecheck 125 baseline (sem novos), build OK, architecture sem novos erros. **Sem migration.** Validação CashClosingPage no preview oficial pendente (gate H-2).
> **Atualização 2026-08-13 (H-3 — Chef Club, em execução):** **H3-4 (reflexos financeiros — créditos) em validação via SQL** no banco real — consumo de créditos do Clube (RPC `bulk_close_comandas_with_credits`) validado contra o cenário do erro `42703` histórico: exatamente 1 crédito consumido (5→4), comanda fechada com `membership_credit_effect=true` e `payment_method="Club dos Chefes"` **sem `42703`**; cenário negativo `P0001 Insufficient credits for this service` **sem `42703`**; **idempotência OK** (2ª execução sem efeito). **2 bugs de runtime corrigidos na RPC** (precedência do cast `::jsonb` → `22P02 Token "consumed" is invalid`; `jsonb_set create_missing=false` → `by_service` vazio). Evidência: `docs/audit/H3_CHEF_CLUB_CREDITS_VALIDATION.md`. Unit **897/897**, build OK, architecture sem regressões.
> **Atualização 2026-08-13 (D-HOM-20, H-4 APROVADO pelo PO):** **H-4 — Billing/Tenant Lifecycle — 🟢 APROVADO.** Matriz **H4-1..H4-9: 9/9 PASS** em **tenant E2E isolado** (Supabase real `ushsnmlbeurfvlkieiln`, dados de teste — **NÃO** o tenant Sanchez Barber), via `tests/e2e/homologation/h4-billing-lifecycle.spec.ts` (`E2E_PROVISIONING=1`): active acesso pleno; past_due aviso (+ escrita DB não bloqueada by design/grace — gap de enforcement na UI registrado); suspended bloqueado `/pending-approval` + evento; reativação + evento; cancelamento `cancel_at_period_end` + efetivação; `change_tenant_plan` espelho `tenants.plan`/`subscriptions.plan` + invoice idempotente + payment attempt; limites `max_staff` (pro=5/free=1); feature indisponível → `UpgradePrompt` (nunca 403); `runCycle` grace expirado → suspensão + fail-fast. **Falha inicial do H4-8b = corrida de login no teste E2E** (ausência de `waitForURL(/#/dashboard)` após `loginAs`), causa raiz documentada, correção no spec, reexecução 9/9 PASS (1.0m) — **não é defeito funcional do produto.** **H-3 permanece 🟡** e **H-8 permanece 🔴 BLOQUEADOR** (o PASS do H-4 não libera produção). Evidência: `docs/audit/H4_BILLING_LIFECYCLE_VALIDATION.md`.
> **Atualização 2026-08-13 (D-HOM-22, H-5 APROVADO pelo PO):** **H-5 — Feature Flags — 🟢 APROVADO.** O PO declara o gate **H-5 🟢 VALIDADO/APROVADO**, com evidências em **tenant E2E isolado** (sem utilização do tenant real Sanchez Barber). **Confirmados:** habilitação/desabilitação por feature · comportamento por plano (free 14/pro 15/premium 20) · bloqueio de acesso direto · `FeatureUnavailablePage`/`UpgradePrompt` · **ausência de `403` indevido** · isolamento e override por tenant · **uso exclusivo da RPC `tenant_has_feature` em runtime** · **5/5 cenários E2E + validação estrutural H5-8**. **Não iniciar H-6 na mesma execução.** **H-3 permanece 🟡** (ressalva H3-5) e **H-8 permanece 🔴 BLOQUEADOR**. **Sem merge, tag ou deploy de produção.** Registro: `docs/BUSINESS_DECISIONS.md` (D-HOM-22).

- [ ] **Aprovação formal do plano de homologação pelo PO** (D-HOM-6)
- [ ] H-1 Integridade operacional (login/permissões, tenant, equipe, clientes, agenda, serviços/produtos, dados históricos preservados)
- [x] **H-2 Fluxo financeiro P0 — 🟢 APROVADO (D-HOM-14, 2026-08-09):** Cash Closing + Comissões validados funcionalmente no preview oficial com a conta de homologação (dados reais), sem `comandas.client_name`, console limpo; **EB-2 encerrado**; evidência SQL formal da quadratura registrada no H-7
- [ ] H-3 Chef Club (adesão, benefícios, regras de plano, reflexos financeiros, permissões) — **🟡 em conclusão (2026-08-13): H3-1 adesão ✅ · H3-2 benefício no checkout ✅ (E2E real) · H3-3 regras de plano ✅ (E2E real) · H3-4 consumo de créditos ✅ (sem `42703`, idempotência OK, 2 bugs corrigidos na RPC `bulk_close_comandas_with_credits`) · H3-6 assinaturas preservadas ✅ (16 baseline + 1 ativa de teste) · H3-5 permissões 🟡 c/ ressalva** (bloqueio por role `barber`/`receptionist` garantido pelo `ManagerRoute` mas não exercitado via E2E — tenant real só tem manager/superadmin). **Status geral: 🟡 até resolução formal da ressalva H3-5** (evidências: `docs/audit/H3_CHEF_CLUB_*.md`)**
- [x] **H-4 Billing/Lifecycle — 🟢 APROVADO (D-HOM-20, 2026-08-13):** matriz H4-1..H4-9 **9/9 PASS** em tenant E2E isolado (Supabase real, NÃO o tenant Sanchez Barber) — active/past_due/suspended/reativação/cancelamento/transição `change_tenant_plan`/limites `max_staff`/feature indisponível (`UpgradePrompt`)/`runCycle` fail-fast; invoice idempotente + payment attempt. Falha inicial do H4-8b = corrida de login no teste E2E (corrigida no spec; reexecução 9/9) — **não é defeito funcional**. Evidência: `docs/audit/H4_BILLING_LIFECYCLE_VALIDATION.md`
- [x] **H-5 Feature Flags — 🟢 APROVADO (D-HOM-22, 2026-08-13):** matriz H5-1..H5-9 **5/5 E2E PASS + H5-8 grep PASS** em tenant E2E isolado (Supabase real, NÃO o tenant Sanchez Barber) — free 14/pro 15/premium 20 (coincide com seed + espelho TS) · habilitada libera rota · desabilitada → `FeatureUnavailablePage` + `UpgradePrompt` (nunca 403) · URL direta bloqueada · zero leitura direta de `feature_flags` em runtime (RPC exclusiva) · override por tenant vence a matriz (2 sentidos). **Veredito formal do PO: 🟢 APROVADO (D-HOM-22).** Evidência: `docs/audit/H5_FEATURE_FLAGS_VALIDATION.md`
- [x] **H-6 Segurança — 🟢 APROVADO COM RESSALVA (D-HOM-26, 2026-08-14):** auditoria adversarial **read-only** (regra PO) em **tenants E2E isolados** (A/B/OPS — NÃO o tenant Sanchez Barber para mutações) via `tests/e2e/homologation/h6-security.spec.ts` (`E2E_PROVISIONING=1`) — **8/8 testes, 39 controles PASS, 9 achados**: F6-A/F6-B anon lê `tenants`/`profiles` (dados reais) · F6-2 `close_order` escreve cross-tenant (comanda + estoque) · F6-3/F6-4 info disclosure cross-tenant via RPC · F6-5/F6-6 `plan_change_requests`/`ticket_messages` sem tenant_id (F6-6 expõe conteúdo real de suporte) · F6-7 `kiosk_addons` leitura+escrita cross-tenant · F6-8 usuário suspenso mantém leitura REST. **Todos os 9 achados remediados em 10 migrations** (`20260813120000`..`20260813120500` P2+F6-1; `20260813130000`..`20260813130300` P0/P1 — F6-A least-privilege anon, F6-B TO authenticated, F6-2 desativação, F6-6 JOIN support_tickets), commit por item + push. **Aplicação incremental no banco remoto de produção EXECUTADA e VALIDADA** (M1–M6 + M8–M10; tracking reconciliado via `migration repair`); **reauditoria final P1–P7 7/7 PASS (34.8s) + Sanchez F1–F14 14/14 PASS (45.3s); P0/P1 zero**. **Ressalva (9/10): M7 `120500` formalmente bloqueada** (efeito já existente no banco desde `20260728`; não corrige o vetor real) → **dívida P3 separada** (`approve_access_request` guard `auth.uid()`/superadmin, item próprio). Evidência: `docs/audit/H6_SECURITY_AUDIT.md` (§9) + `docs/audit/H6_5_PRODUCTION_SAFETY_GATE.md` (§12)
- [ ] H-7 Operação real (ciclo completo acompanhado: agendamento → atendimento → comanda → pagamento → comissão → fechamentos → conferência) — **⏳ AUTORIZADO A ABRIR (D-HOM-26) — ROTEIRO PRONTO (D-HOM-27, 2026-08-14):** ambiente = **dados reais do tenant Sanchez Barber** (sem manipular dados existentes; registros identificáveis como homologação; saldos antes/depois) · escopo = **1 ciclo completo H7-1** · agendamento = **janela acompanhada** (Rubens/equipe; dia/horário definidos pelo PO — sem execução espontânea) · **critério de parada = qualquer divergência financeira/duplicidade/perda de crédito/comissão incorreta/queixa de fechamento → PARAR imediatamente, sem corrigir no banco** · **M7 mantida BLOQUEADA** (9/10; dívida P3 separada) · **H-7 NÃO autoriza produção/deploy** (estado: H-6 🟢 → H-7 ⏳ → H-8 🔴). Roteiro + checklist de evidências: `docs/audit/H7_OPERACAO_REAL_ROTEIRO.md`. **Fase 1 (baseline read-only) ✅ 2026-08-16** — `docs/audit/H7_BASELINE_READONLY.md` (clients 302, services 17, products 18/estoque 68, appointments 1.447, comandas 1.384, transactions 736, credits 16 (77 disp/3 usadas), cash_closings 3 draft, barber_closings 0, participantes 377, receivables 47: paid 30/R$ 6.440 · overdue 10/R$ 2.340 · pending 7/R$ 1.360). **Execução do CICLO H7-1 CONDICIONADA à janela acompanhada definida pelo PO**
- [ ] **H-8 Infraestrutura Vercel / Deployment Topology** (origem oficial única do frontend, domínio/branch/env/Supabase vinculados, sem double-deploy; **deploy de produção da release v1.5 planejado** — produção atual `718f6f9` defasada) — auditoria read-only ✅ em `docs/audit/VERCEL_DEPLOYMENT_TOPOLOGY_AUDIT.md`; **double-deploy ELIMINADO (D-HOM-11: git link do `sou-manager` desconectado)**; **🔴 BLOQUEADOR ativo (D-HOM-10) — aguarda bloco de Hardening (§8.1) + decisões do PO**
- [ ] **Bloco de Hardening da Homologação / Vercel (D-HOM-10/11/12/13):** origem oficial única ✅ · destino do legado `sou-manager` — git link desconectado ✅ (destino final = PO) · **ETAPA B auth/tenant ✅ EXECUTADA (conta `homolog.sanchez@…` criada/validada + login UI OK, 0 erros, Comissões com dados reais; achado EB-1 P3 registrado)** · preview oficial `68acda4` ✅ · **EB-2 (P1) CORRIGIDO ✅ (D-HOM-13: colunas-fantasma `client_name`/`paid_amount`/`notes` removidas de `COMANDA_COLUMNS`; regression guard; unit 888/888; sem migration)** · re-teste de Comissões · testes H-1..H-7 · registro de achados P0/P1/P2 · fechamento H-1…H-8
- [ ] **Veredito final** 🟢 HOMOLOGADO / 🟡 HOMOLOGADO COM RESSALVAS / 🔴 BLOQUEADO — aprovado pelo PO
- [ ] Atualizar docs da release (log de homologação, RELEASE_CHECKLIST, PROJECT_STATUS, ROADMAP) + commit semântico + push

---

## 11. Fase 6.0.6 — Compliance & Legal (gate obrigatório de certificação)

> **Registrada em 2026-08-07 (decisão do PO).** Posição na release: **após** 6.0.5.x (incluindo PCA 6.0.5.6) + janela única de deploy, e **antes** da certificação final da v1.5. Fase **exclusivamente documental nesta etapa** — `docs/audit/PHASE_6_0_6_ENTRY_AUDIT.md`.
> **Gate da release:** a v1.5 somente poderá ser considerada concluída quando **todos** os itens abaixo estiverem atendidos.

- [ ] Todos os documentos jurídicos existirem (Termos de Uso, Política de Privacidade, LGPD, Contrato SaaS, Consentimentos, Cookies)
- [ ] Aceite eletrônico implementado (usuário, tenant, data/hora, IP, User-Agent, versão aceita — histórico imutável)
- [ ] Versionamento funcionando (versão, hash, data de publicação, obrigatório/opcional, histórico)
- [ ] Auditoria de aceite funcionando
- [ ] Centro Jurídico disponível (histórico de aceites, documentos vigentes, versões anteriores, download, auditoria, situação do tenant)
- [ ] Checklist de compliance aprovado
- [ ] Reaceite obrigatório funcionando (documento alterado → nova versão → login → reaceite → acesso)

> **Critérios de entrada da 6.0.6:** arquitetura 6.0.5 concluída · PCA READY · schema congelado · deploy aprovado · **homologação Sanchez Barber aprovada (D-HOM)** · release candidata pronta.
> **Modelo de dados (proposta arquitetural — nenhuma migration):** `legal_documents` · `document_versions` · `accepted_documents`.

---

## 12. Pendências de Qualidade / Segurança (backlog documentado)

- [ ] `approve_access_request()` — adicionar `auth.uid()` (legado, Security Audit 3.3)
- [ ] `close_order()` — deprecar/fixar (legado)
- [ ] `FOR UPDATE` em SELECTs críticos de RPCs (hardening produção)
- [ ] Backlog: anon lê perfis superadmin via REST; `public_select_tenants` kiosk legacy (achados pré-existentes, não-regressão)

---

## 13. Aceite Final da Versão

> Tudo abaixo deve estar marcado antes de declarar a v1.5.0 certificada.

- [x] Todas as subfases 6.0.5.1–6.0.5.5 concluídas
- [x] **Gate "Schema Freeze Candidate" (6.0.5.5)** — veredito final **`SCHEMA FREEZE = YES`** registrado (pré-requisito da PCA)
- [x] **Production Compatibility Audit** executada contra o banco real dos tenants produtivos — `PRODUCTION_COMPATIBILITY_AUDIT.md = READY`
- [ ] **Homologação Sanchez Barber** — gate formal aprovado pelo PO (🟢/🟡 — ver §10.1)
- [ ] **Fase 6.0.6 Compliance & Legal** — gate de certificação atendido (ver §11)
- [x] Todas as migrations da versão aplicadas no remoto (janela única) — 6 aplicadas + `06030000` reparada
- [ ] Todos os critérios de saída de cada entry audit marcados
- [ ] Suíte unitária verde + typecheck sem novos erros + build OK + `architecture:ci` verde
- [x] Smoke E2E 10/10 (pós-janela) + flows P0/P1 verdes — flow14 1/1 + flow13 8/8 + smoke 10/10
- [ ] Baseline `v1.5.0-feature-flags-6.0.5` criada (commit + tag anotada + push)
- [ ] ROADMAP / PROJECT_STATUS / changelog atualizados
- [ ] **Aprovação explícita do PO** para certificação da versão
