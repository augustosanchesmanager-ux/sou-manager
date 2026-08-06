# Phase 6.0.4 — Billing (Tenant Lifecycle): Execution Plan

> **Documento de planejamento oficial da Fase 6.0.4.** Subfases 6.0.4.1 a 6.0.4.5 (definição do PO).
> Auditoria completa em `PHASE_6_0_4_AUDIT.md`.
> **Decisões D1–D4 aprovadas pelo PO em 2026-08-06.** Implementação autorizada após confirmação final deste plano.

---

## 1. Objetivo

Implementar o ciclo de vida de billing do tenant: normalização do slug de plano para `premium`, transição `draft → trial → active` (F10), modelagem de assinatura/faturas, engine de billing e interface `BillingProvider` para gateways futuros — **sem gateway de pagamento nesta fase**.

## 2. Escopo e subfases (definição do PO)

| Subfase | Nome | Entregável | Código? |
|---------|------|-----------|---------|
| **6.0.4.1** | Modelagem | Auditoria + modelo de dados aprovado | ❌ (AUDIT + este documento) |
| **6.0.4.2** | Banco | Tabelas `subscriptions`, `invoices`, `billing_events`, `payment_attempts` + RPCs + normalização `elite→premium` | ✅ SQL |
| **6.0.4.3** | Lifecycle Billing | `draft → trial → active` (F10), trial 14 dias, grace 5 dias, cancelamento | ✅ SQL + TS |
| **6.0.4.4** | Billing Engine | Domínio `domain/billing/` + `application/billing/` + eventos/outbox | ✅ TS |
| **6.0.4.5** | BillingProvider | Interface de gateway (sem implementação real) | ✅ TS |

## 3. Decisões do PO (aprovadas 2026-08-06)

| # | Decisão | Valor aprovado |
|---|---------|----------------|
| **D1** | Normalizar plano `elite` → `premium` | ✅ **Aprovado.** Migration de dados **idempotente**, atualizar constraints, tipos, código, frontend, testes e documentação. `premium` passa a ser o **único slug oficial** antes do Billing completo |
| **D2** | Nomes de eventos de billing | ✅ **Aprovado.** Prefixo `TenantSubscription*` + separação Subscription (estado do contrato) vs Billing (cobrança). Catálogo completo no §5.4 |
| **D3** | Duração do trial | ✅ **Aprovado: 14 dias** (F3). Inicia no **provisionamento do tenant**; 5 dias de **grace period** antes da suspensão. Consistente com `SUBSCRIPTION_MODEL.md` |
| **D4** | Tabela `plans` | ✅ **Aprovado: manter `tenants.plan` como slug TEXT** na 6.0.4. Tabela `plans` + `features` + `plan_features` só na 6.0.5. Billing opera apenas com slugs `free`, `pro`, `premium` |
| **D5** | Transição `draft → active` atual | Corrigir para `draft → trial` (F10) — sem gateway, `trial → active` via RPC manual/automático |

> **Nota (F3 vs D3):** `BUSINESS_DECISIONS.md` F3 diz "trial contado a partir do `complete_onboarding()`"; o PO aprovou em D3 "inicia no provisionamento do tenant". A resposta do PO é a decisão vigente. **Ação:** atualizar o texto de F3 em `BUSINESS_DECISIONS.md` e `PLAN_MODEL.md` para "contado a partir do provisionamento do tenant" — evitar ambiguidade. (Incluído na 6.0.4.3, item docs.)

## 4. Auditoria — resultado consolidado

Ver `PHASE_6_0_4_AUDIT.md`. Destaques:
- **Nenhum bloqueio arquitetural.** Tudo reutiliza padrões existentes (RPC SECURITY DEFINER, Outbox, idempotência, `tenant_status`).
- **Divergência planejada:** `complete_onboarding` hoje seta `status='active'` (sprint1); `TENANT_LIFECYCLE.md` e `LIFECYCLE_MODEL.md` confirmam que com Billing passa a `draft → trial`. **Não é bug — é o objeto da 6.0.4.3.**
- **Colisão semântica de eventos:** `SubscriptionCreated`/`SubscriptionCancelled` já pertencem ao ChefClub — Billing usa prefixo `TenantSubscription*` (D2).
- **Modelo de subscription:** `SUBSCRIPTION_MODEL.md` define status `trialing`/`active`/`past_due`/`cancelled` e **1 tenant = 1 subscription ativa** (UNIQUE parcial em `tenant_id WHERE status IN ('trialing','active','past_due')`).

## 5. Escopo de Implementação

### 5.1 Banco — 6.0.4.2 (migration `2026080X_phase_6_0_4_billing.sql`)

- [ ] **Normalização D1 (idempotente):** `UPDATE tenants SET plan='premium' WHERE plan='elite'`; novo `CHECK (plan IN ('free','pro','premium'))`; atualizar comentários da coluna. Sem condicionais de feature usando `elite` hoje → baixo risco.
- [ ] Tabela `subscriptions` (alinhada a `SUBSCRIPTION_MODEL.md`):
  - `id`, `tenant_id` FK UNIQUE, `plan` TEXT (slug free/pro/premium), `status` ENUM/CHECK (`trialing`/`active`/`past_due`/`cancelled`)
  - `trial_started_at` (= provisionamento), `trial_ends_at` (+14d), `current_period_start`, `current_period_end`, `canceled_at`, `created_at`, `updated_at`
  - **UNIQUE parcial:** 1 subscription ativa por tenant (`tenant_id` WHERE status IN trialing/active/past_due)
  - RLS tenant + superadmin bypass; escritas só via RPC SECURITY DEFINER
- [ ] Tabela `invoices`: `id`, `subscription_id`, `tenant_id`, `status` (`draft`/`issued`/`paid`/`overdue`/`failed`/`void`), `amount`, `due_date`, `paid_at`, `billing_period_start/end`, `idempotency_key`. UNIQUE `(tenant_id, idempotency_key)`.
- [ ] Tabela `billing_events`: `id`, `tenant_id`, `event_type`, `payload` JSONB, `created_at` (trilha operacional; publicação oficial no `event_store`).
- [ ] Tabela `payment_attempts`: `id`, `invoice_id`, `tenant_id`, `status` (`pending`/`success`/`failed`), `provider` (null nesta fase), `error`, `attempted_at`. Append-only.
- [ ] RPC `start_trial(tenant_id)` SECURITY DEFINER: cria `subscription` (`trialing`, `trial_started_at=now()`, `trial_ends_at=+14d`) → `tenants.status='trial'` → emite `TenantTrialStarted`. Idempotente.
- [ ] RPC `activate_subscription(tenant_id)` SECURITY DEFINER: `trialing → active` (sem gateway, uso manual/superadmin).
- [ ] RPC `cancel_subscription(tenant_id)` SECURITY DEFINER: `trialing/active/past_due → cancelled` → `tenants.status='cancelled'`.

### 5.2 Lifecycle Billing — 6.0.4.3

- [ ] `complete_onboarding`: transição `draft → trial` (invoca `start_trial`), mantendo F10. **Nunca** `draft → active` direto.
- [ ] `TenantLifecycleService` (TS): `startTrial`, `activate`, `cancel`, `getStatus` — espelhando `tenantProvisioning.ts`.
- [ ] Janela de trial: 14 dias do provisionamento; 5 dias de grace (`past_due`) antes de `suspended` — lógica documentada; execução automática via cron fica registrada como futuro (sem gateway).
- [ ] Docs: atualizar `TENANT_LIFECYCLE.md` (transições implementadas), `LIFECYCLE_MODEL.md` se necessário, **texto F3 em `BUSINESS_DECISIONS.md`** e `PLAN_MODEL.md` (início do trial = provisionamento), `TAXONOMY.md` (termos billing).

### 5.3 Billing Engine — 6.0.4.4

- [ ] `domain/billing/` — `types.ts`, `BillingRepository` (find subscription, create invoice, record attempt).
- [ ] `application/billing.ts` — `BillingService` (startTrial, issueInvoice, markPaid, handleFailure, cancel).
- [ ] `domain/billing/billingEngine.ts` — cálculo de ciclo/faturamento (sem gateway): emissão por `current_period_end`, `due_date`, retry.
- [ ] `domain/billing/limits.ts` — validação de limites por plano (1/5/∞) reutilizando a lógica da 6.0.3 (`free=1, pro=5, premium=∞`).
- [ ] `FinanceProvider`: mapear `InvoicePaid`/`PaymentSucceeded` → operações financeiras existentes (se aplicável, alinhado à Fase 4.6).

### 5.4 Catálogo de eventos (D2 — aprovado)

**Subscription (estado do contrato):**

| Evento | Dispara em |
|--------|-----------|
| `TenantSubscriptionCreated` | Provisionamento |
| `TenantSubscriptionUpdated` | Mudança de plano/periodo |
| `TenantSubscriptionRenewed` | Renovação de ciclo |
| `TenantSubscriptionCancelled` | Cancelamento |
| `TenantSubscriptionSuspended` | Suspensão |
| `TenantSubscriptionReactivated` | Reativação |
| `TenantSubscriptionExpired` | Trial/ciclo expirado |

**Trial:**

| Evento | Dispara em |
|--------|-----------|
| `TenantTrialStarted` | `start_trial` |
| `TenantTrialEnding` | Próximo do fim (futuro, cron) |
| `TenantTrialEnded` | Fim do trial |

**Invoice (billing process):**

| Evento | Dispara em |
|--------|-----------|
| `InvoiceCreated` | Emissão de fatura |
| `InvoicePaid` | Pagamento confirmado |
| `InvoiceOverdue` | Vencimento |
| `InvoiceCancelled` | Cancelamento |

**Payment:**

| Evento | Dispara em |
|--------|-----------|
| `PaymentSucceeded` | Tentativa ok |
| `PaymentFailed` | Tentativa falha |
| `PaymentRefunded` | Estorno |

### 5.5 BillingProvider — 6.0.4.5

- [ ] `domain/billing/provider.ts` — interface `BillingProvider` (charge, refund, webhook) + `BillingProviderRegistry`.
- [ ] `ManualBillingProvider` (no-op/log) como default — zero dependência de gateway.
- [ ] `payment_attempts.provider` populado quando um gateway real for registrado (futuro).

### 5.6 Testes

- [ ] Unit `application/billing.test.ts`: startTrial (draft→trial, idempotência), activate, cancel, emissão de invoice, idempotency key.
- [ ] Unit `domain/billing/billingEngine.test.ts`: período, due_date, retry, limites 1/5/∞.
- [ ] Unit: normalização `elite→premium` (migration + `TenantPlan`).
- [ ] E2E flow9 (tenant lifecycle): onboarding → `draft` → conclui setup → `trial` → ativa → `active`; cancelamento → `cancelled`.
- [ ] Regressão: `FinanceSubscriber` não confunde `TenantSubscription*` com eventos ChefClub.

## 6. Riscos e Mitigações

| # | Risco | Impacto | Mitigação |
|---|-------|---------|-----------|
| R1 | Renomear `elite→premium` quebra algo | Baixo | Migration idempotente; sem condicionais de feature usando `elite`; verificar frontend/admin antes do deploy |
| R2 | Colisão de eventos com ChefClub | Alto — FinanceSubscriber confuso | Prefixo `TenantSubscription*` (D2); teste de regressão |
| R3 | Transição `draft→trial` quebra onboarding atual | Alto | `start_trial` idempotente; `trial` libera acesso total (LIFECYCLE_MODEL) — mesma UX que `active` hoje |
| R4 | Trial sem cron vira `trial` infinito | Médio | Sem gateway, ativação via RPC manual/superadmin; cron registrado como futuro |
| R5 | F3 (BUSINESS_DECISIONS) conflita com D3 | Médio — ambiguidade | Atualizar texto F3 para "início no provisionamento" (§5.2 docs) |
| R6 | `tenants.plan` já usado no frontend/admin com valor `elite` | Médio | Buscar `elite` em páginas/Admin antes do deploy; migrar dados antes de trocar o CHECK |

## 7. Critérios de Saída

- [ ] `elite` não existe mais em código, DB ou docs — `premium` é o único slug oficial
- [ ] Tenant novo completa onboarding → `trial` (nunca `draft → active` direto)
- [ ] `trialing → active` e `→ cancelled` via RPC; 1 subscription ativa por tenant
- [ ] 4 tabelas de billing com RLS + RPCs SECURITY DEFINER + idempotência
- [ ] `BillingProvider` interface + `ManualBillingProvider` default (sem gateway)
- [ ] 17 eventos aprovados (D2) publicados sem colidir com ChefClub
- [ ] Unit + E2E flow9 verdes; build pass; tsc sem novos erros
- [ ] Docs atualizados: `TENANT_LIFECYCLE.md`, `BUSINESS_DECISIONS.md` (F3), `PLAN_MODEL.md`, `TAXONOMY.md`, `ROADMAP.md`, `PROJECT_STATUS.md`

## 8. Dependências

- ✅ D1–D4 aprovados pelo PO (2026-08-06)
- Fase 6.0.2 onboarding (`save_onboarding_step`) — concluída
- Fase 4.5/4.6 (Outbox, FinanceProvider) — concluída
- Supabase: nenhuma exigência externa (sem gateway nesta fase)

## 9. Arquivos Alvo

- Migração: `supabase/migrations/2026080X_phase_6_0_4_billing.sql`
- `domain/billing/*` (types, repository, billingEngine, provider, limits)
- `application/billing.ts`
- `domain/tenant/types.ts` (`TenantPlan` → premium)
- `domain/events/types.ts` (+ 17 eventos D2)
- `supabase/migrations/..._fix_complete_onboarding_trial.sql` (6.0.4.3)
- `tests/e2e/flows/flow9-tenant-billing.spec.ts`

## 10. Próxima Etapa

Após confirmação final deste plano: executar 6.0.4.2 (banco) → 6.0.4.3 (lifecycle) → 6.0.4.4 (engine) → 6.0.4.5 (provider), com testes e atualização de ROADMAP/PROJECT_STATUS.
