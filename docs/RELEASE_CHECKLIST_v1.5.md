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
- [ ] **6.0.5.6** **Production Compatibility Audit (PCA)** — ❌ **BLOCKED** (executada 2026-08-08, somente leitura); **gate obrigatório pré-deploy** — `docs/audit/PRODUCTION_COMPATIBILITY_AUDIT.md` = **READY** para liberar a janela única. **Bloqueio crítico:** migration `20260806030000` pulada no remoto → `CREATE OR REPLACE cancel_subscription` (5 colunas) incompatível com a função atual de 11 colunas (`06050000`/`06070000` já aplicadas) → erro garantido; **recomendado `supabase migration repair --status applied 20260806030000` (decisão do PO)**. **Dados:** 3 tenants excedem `max_staff=1` do plano `free` (Barbearia Principal produtivo com 4 staff, Loja Demo Varejo com 3, SMG Estética com 2) — decisão de negócio do PO. Demais seções compatíveis.
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
| `20260806030000_fix_auth_staff_id_to_profiles.sql` | 6.0.4.3 | ⏳ **PENDENTE — PULADA no remoto** | **BLOCKER da PCA 6.0.5.6:** `CREATE OR REPLACE cancel_subscription` (5 colunas) incompatível com a função atual de 11 colunas já aplicada (`06050000`/`06070000`). Autorização que adiciona **já está no remoto** via `06070000`. Correção recomendada: `migration repair --status applied` (decisão do PO) |
| `20260806040000_fix_complete_onboarding_trial.sql` | 6.0.4 | ✅ Aplicada | — |
| `20260806050000_phase_6_0_4_4_billing_engine.sql` | 6.0.4.4 | ✅ Aplicada | `apply_subscription_transition`, `get_due_subscriptions` |
| `20260806070000_fix_rpc_ambiguous_column_references.sql` | 6.0.4.4 | ✅ Aplicada | — |
| `20260806080000_fix_apply_subscription_transition_tenant_status_enum.sql` | 6.0.4.4 | ✅ Aplicada | Corrigido pela migration `20260807010000` (6.0.5.4): fail-fast implementado, sem fallback `ELSE → active` |
| `20260806090000_phase_6_0_5_2_plans_catalog.sql` | 6.0.5.2 | ⏳ **Pendente** | `plans`/`features`/`plan_features` + FK aditiva |
| `20260807000000_phase_6_0_5_3_feature_flags.sql` | 6.0.5.3 | ⏳ **Pendente** | `feature_flags` + `tenant_has_feature` + guarda RPCs |
| `20260807010000_phase_6_0_5_4_tenant_lifecycle.sql` | 6.0.5.4 | ⏳ **Pendente** | `suspended` no CHECK + `grace_ends_at` + divisão do Transition Executor — **criada + validada em docker T1–T7** |
| `20260807020000_phase_6_0_5_5_transitions.sql` | 6.0.5.5 | ⏳ **Pendente (criada)** | `change_tenant_plan` (espelho `tenants.plan`, grants ADR-012) — **criada + validada em docker T1–T12 + idempotência 2×** |
| `20260808000000_fix_create_invoice_record_payment_attempt_ambiguity.sql` | Hardening 6.0.5.5 | ⏳ **Pendente (criada)** | Fix aditivo das RPCs irmãs `create_invoice`/`record_payment_attempt` (ON CONFLICT DO NOTHING + `RETURNING a.id`) — **criada + validada em docker S1–S16 + G1 PASS + idempotência 2×** |

- [ ] Validar cada migration em Postgres 16 docker (aplica 2× sem duplicar) **antes** da janela.
- [ ] Aplicar via `MIGRATION_EXCEPTION` (`db query --linked -f` + `migration repair --status applied`) na janela única.
- [ ] `supabase migration list --linked` 100% coerente após a janela.

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
- [ ] **Pós-janela de deploy** — smoke **10/10 PASS** (runbook §5)
- [ ] **6.0.5.4** — smoke 10/10 (execução na janela única — decisão PO 2026-08-07)
- [ ] **6.0.5.5** — smoke 10/10
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
- [x] flow13 — Access-level navigation (Estado Efetivo, 8/8 PASS — 6.0.5.1)
- [ ] **flow14** — Suspensão/reativação (`past_due → suspended → active`) — spec escrito (`flow14-tenant-suspend-reactivate.spec.ts`) + typecheck OK; **execução adiada à janela única de deploy** (decisão PO 2026-08-07)
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

---

## 10. Deploy (janela única — aprovada em princípio)

> **Gate obrigatório (PO 2026-08-07):** antes de qualquer item abaixo, `docs/audit/PRODUCTION_COMPATIBILITY_AUDIT.md` deve estar **`READY`** — a **Production Compatibility Audit (6.0.5.6)** é executada contra o **banco real dos tenants produtivos**, imediatamente antes da janela única de deploy.
>
> **Pré-requisito da PCA — Schema Freeze (PO 2026-08-07):** o gate **"Schema Freeze Candidate"** (6.0.5.5) deve estar com veredito final **`SCHEMA FREEZE = YES`** (ver `PHASE_6_0_5_5_ENTRY_AUDIT.md` §12.3) antes de liberar a PCA. **✅ `SCHEMA FREEZE = YES` (2026-08-08)** — delta real = somente a RPC `change_tenant_plan` (prevista na entrada).

- [x] **Schema Freeze = YES** registrado no fechamento da 6.0.5.5 (gate §12.3 reexecutado com o diff real — 2026-08-08)
- [ ] **Production Compatibility Audit** (`PRODUCTION_COMPATIBILITY_AUDIT.md = READY`)
- [x] Runbook versionado: `docs/DEPLOY_RUNBOOK_FASE_6_0_5.md` (commit `f7f3620`)
- [ ] **Aprovação explícita do PO** para abrir a janela
- [ ] Pré-flight (backup/PITR, `migration list`, dados de plano)
- [ ] Aplicar `06030000` → `06090000` → `07000000` → `07010000` → `07020000` (6.0.5.5) — ver runbook §3.5
- [ ] Verificações pós-deploy (histórico, RLS, RPCs, matriz `tenant_has_feature`)
- [ ] Smoke 10/10 pós-deploy
- [ ] Deploy do frontend (Vercel) — se fizer parte da mesma liberação
- [ ] Rollback definido e testado conceitualmente (DB ordem reversa + Vercel juntos)

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

> **Critérios de entrada da 6.0.6:** arquitetura 6.0.5 concluída · PCA READY · schema congelado · deploy aprovado · release candidata pronta.
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

- [ ] Todas as subfases 6.0.5.1–6.0.5.5 concluídas
- [ ] **Gate "Schema Freeze Candidate" (6.0.5.5)** — veredito final **`SCHEMA FREEZE = YES`** registrado (pré-requisito da PCA)
- [ ] **Production Compatibility Audit** executada contra o banco real dos tenants produtivos — `PRODUCTION_COMPATIBILITY_AUDIT.md = READY`
- [ ] **Fase 6.0.6 Compliance & Legal** — gate de certificação atendido (ver §11)
- [ ] Todas as migrations da versão aplicadas no remoto (janela única)
- [ ] Todos os critérios de saída de cada entry audit marcados
- [ ] Suíte unitária verde + typecheck sem novos erros + build OK + `architecture:ci` verde
- [ ] Smoke E2E 10/10 (pós-janela) + flows P0/P1 verdes
- [ ] Baseline `v1.5.0-feature-flags-6.0.5` criada (commit + tag anotada + push)
- [ ] ROADMAP / PROJECT_STATUS / changelog atualizados
- [ ] **Aprovação explícita do PO** para certificação da versão
