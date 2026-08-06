# PHASE 6.0.4.4 — Billing Engine (Execution Plan)

> **Status:** ✅ Escopo fechado pelo PO — 2026-08-06 · ✅ **ENTREGUE e CERTIFICADA (E2E real flow9 + flow12 verdes)** — 2026-08-06
> **Roadmap congelado:** 6.0.4.4 já é subfase prevista no plano mestre `PHASE_6_0_4_EXECUTION_PLAN.md` §5.3 — nenhuma fase nova/reorganizada.
> **Dependências concluídas:** 6.0.4.2 (schema+RPCs billing) ✅ · 6.0.4.3 (TenantLifecycle) ✅ · Fase 4.5/4.6 (Outbox + FinanceProvider) ✅
> **Baseline:** `v1.4.2-billing-engine-6.0.4.4` (ROADMAP.md)

---

## 1. Objetivo

Implementar o **Billing Engine** do SMG Platform: o motor de regras de faturamento/ciclo de assinatura de tenants (Lifecycle Billing), **sem cron e sem gateway** nesta fase. O engine é **TS puro** (fonte da verdade), orquestrado pelo `BillingService` (Application Service), respeitando ADR-001/004/005/006/007/012 e a nomenclatura D2.

## 2. Decisões do PO (2026-08-06) — fecham o escopo

| # | Decisão | Efeito no escopo |
|---|---------|------------------|
| D-A | **Cancelamento = `cancel_at_period_end`** | Acesso mantido até o fim do período; `TenantSubscriptionCancelled` só na efetivação. **Altera contrato existente** (RPC `cancel_subscription` e `TenantLifecycleService.cancel()` hoje cancelam imediatamente). |
| D-B | **Reativação → 6.0.5** | Engine NÃO implementa `reactivate`; `TenantSubscriptionReactivated` permanece no catálogo inativo. |
| D-C | **Invoice só p/ planos pagos, amount=0 placeholder** | `free` e `trial` nunca emitem invoice; `pro`/`premium` emitem com `amount=0`, `status=issued` (preços reais com gateway). |
| D-D | **Trial→active permanece manual** (RPC `activate_subscription`, superadmin) | Sem UI administrativa na 6.0.4. Engine apenas computa vencimento/dívida para os fluxos E2E. |

## 3. Escopo (entregáveis)

### 3.1 Alteração de contrato — cancelamento `cancel_at_period_end`

> ⚠️ MUDANÇA DE COMPORTAMENTO ENTREGUE: 6.0.4.2/.3 cancelam imediatamente. A 6.0.4.4 corrige para o modelo do PO.

- Migration `20260806050000_phase_6_0_4_4_billing_engine.sql` (**aplicada ao banco real** via procedimento da `MIGRATION_EXCEPTION_20260801.md` + `repair applied`):
  - `ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS cancel_at_period_end timestamptz;` (NULL = sem pedido de cancelamento).
  - `canceled_at` passa a significar **data da efetivação** (quando status vira `cancelled`), não data do pedido.
  - Reescreve `cancel_subscription()`: em vez de `→ cancelled`, seta `cancel_at_period_end = current_period_end` (pedido); **não altera status, não altera `tenants.status`** (acesso mantido).
  - Idempotente; REVOKE/GRANT ADR-012 reaplicados (CREATE OR REPLACE preserva grants, mas o contrato exige garantir).
- **FIX pós-aplicação** (migrations corretivas `20260806070000` + `20260806080000`, também aplicadas/registradas):
  - **`column reference "id" is ambiguous`** (bug de runtime descoberto pelos E2E): funções com `RETURNS TABLE` criam OUT params que colidem com colunas de `subscriptions`/`tenants`/`invoices` em referências não qualificadas. Corrigidas **7 RPCs** (qualificação com alias): `start_trial`, `activate_subscription`, `cancel_subscription`, `apply_subscription_transition`, `mark_invoice_paid`, `get_invoice`, `get_subscription_by_id`. Limpas: `record_payment_attempt`, `create_invoice`, `get_due_subscriptions`.
  - **`column "status" is of type tenant_status`**: `apply_subscription_transition` declarava `v_tenant_status` como `text`; corrigida para `public.tenant_status` (labels: draft/trial/active/past_due/suspended/cancelled/archived).
- `application/tenantLifecycle.ts`:
  - `cancel()` (pedido): publica **`TenantSubscriptionUpdated`** com `cancelAtPeriodEnd` no payload (NÃO `TenantSubscriptionCancelled`).
  - A efetivação (`TenantSubscriptionCancelled` + `tenants.status='cancelled'`) sai do **engine** (§3.3).
- Ajustar os 18 testes de `tenantLifecycle.test.ts` que assumem cancelamento imediato.

### 3.2 `domain/billing/` — TS puro, zero Supabase/React

| Arquivo | Conteúdo |
|---------|----------|
| `types.ts` | `BillingCycle`, `InvoiceDraft`, `PlanConfig` (`free=1, pro=5, premium=∞` da 6.0.3), `BillingTransition` |
| `billingEngine.ts` | `process(asOf, subscription, plan)` — função **pura/determinística** aplicando transições de tempo (sem I/O) |
| `limits.ts` | Validação de limites por plano reutilizando a lógica da 6.0.3 |
| `billingRepository.ts` | Interface `BillingRepository` (findDueSubscriptions, applyTransition, createInvoice, recordAttempt) + factory in-memory p/ testes |

**Transições do engine (`process`):**

| Estado atual | Condição | Transição | Eventos emitidos |
|---|---|---|---|
| `trialing` | `trial_ends_at <= asOf` e plano `free` | → `active` (novo período) | `TenantTrialEnded` + `TenantSubscriptionUpdated` |
| `trialing` | `trial_ends_at <= asOf` e plano `pro/premium` | → `past_due` (início do grace de 5d, D3) | `TenantTrialEnded` + `TenantSubscriptionUpdated` |
| `active` | `cancel_at_period_end` setado e `<= asOf` | → `cancelled` (efetivação) + `tenants.status='cancelled'` | `TenantSubscriptionCancelled` |
| `active` | `current_period_end <= asOf` e sem cancelamento | → renovação (+30d) | `TenantSubscriptionRenewed` + (se pago) `InvoiceCreated` |
| `past_due` | sem gateway | permanece `past_due` (grace). Sem status `suspended` no schema → suspensão é 6.0.5 | — (registra pendência em `billing_events`) |

**Regras de faturamento (D-C):** invoice emitida somente em renovação de plano pago; `amount=0`, `status=issued`, `due_date` = fim do novo período; `idempotency_key = 'cycle_{subscription_id}_{period_start}'` — protegida por `UNIQUE(tenant_id, idempotency_key)` já no schema.

### 3.3 `application/billing.ts` — BillingService

- `issueInvoice(subscriptionId, period)` → cria invoice (D-C) + publica `InvoiceCreated`.
- `markPaid(invoiceId)` → invoice `paid` + `PaymentSucceeded` + `past_due → active` (resolve dívida) + `TenantSubscriptionUpdated`.
- `handleFailure(invoiceId, reason)` → `payment_attempts` `failed` + `PaymentFailed` (registro; sem retry automático — sem gateway).
- `runCycle(asOf)` → varre subscriptions vencidas via `BillingRepository.findDueSubscriptions`, aplica `billingEngine.process`, persiste transições e publica eventos. **Acionamento manual (sem cron):** via RPC superadmin `run_billing_cycle(tenant_id)` **chamando o engine TS**? Não — ver §4. O ciclo roda no Application Service (teste/integração), sem RPC no banco.

### 3.4 Eventos — catálogo D2 já existente (sem novos tipos)

Usados na 6.0.4.4: `TenantSubscriptionUpdated`, `TenantSubscriptionRenewed`, `TenantSubscriptionCancelled`, `TenantTrialEnded`, `InvoiceCreated`, `InvoicePaid`, `PaymentSucceeded`, `PaymentFailed`. Inativos (6.0.5): `TenantSubscriptionSuspended`, `TenantSubscriptionReactivated`, `TenantSubscriptionExpired`, `TenantTrialEnding`, `InvoiceOverdue`, `InvoiceCancelled`, `PaymentRefunded`. Sem novas entradas no catálogo.

### 3.5 FinanceProvider (Fase 4.6)

- Adicionar handlers aditivos ao `createFinanceProvider`: `create_transaction` / `create_commission_record` já existem; mapear `InvoicePaid`/`PaymentSucceeded` → operações financeiras existentes (se aplicável, alinhado à Fase 4.6).
- Teste de regressão: FinanceSubscriber NÃO confunde `TenantSubscription*`/`Invoice*` com eventos ChefClub (`Subscription*`) — nomes distintos garantidos (R2 do plano mestre).

## 4. Fora do escopo (6.0.5+/futuro, documentado)

- ❌ Cron automático (trial-end, grace-expiry, suspensão, arquivamento) — sem `pg_cron`/schedules no repo.
- ❌ Gateway (cobrança real, webhook, refund, dunning 3×3d).
- ❌ Suspensão real (`suspended`) e reativação — exigem status no schema + enforcement (feature_flags 6.0.5).
- ❌ UI administrativa de billing — decisão D-D; avaliada junto ao SuperAdmin/Billing Operations futuro.
- ❌ Renovação automática por relógio — o `runCycle` é disparado manualmente (teste/integração), não por cron.

## 5. Fluxos E2E

| Flow | Descrição | Mecanismo | Status |
|------|-----------|-----------|--------|
| flow9 | onboarding → `draft` → trial → `active` (ativação manual RPC) | Playwright (UI real) | ✅ **PASSOU** (34.8s) — exige fix de `start_trial` (id ambíguo) |
| flow10 | trial expira → `past_due` (grace) | **Teste de integração do engine** (seed `trial_ends_at` no passado + `process`) | ✅ 6.0.4.4 (coberto em `billingEngine.test.ts`) |
| flow11 | grace expira → suspensão | ❌ Inviável (schema sem `suspended`) | 📌 6.0.5 |
| flow12 | cancelamento → `cancel_at_period_end` → acesso mantido → efetivação | RPC `cancel_subscription` (UI/superadmin) + integração do engine | ✅ **PASSOU** (27.9s) — seed sem `user_tenants` manual (trigger `sync_profile_to_user_tenants`) |
| flow13 | reativação | ❌ Fora do escopo (D-B) | 📌 6.0.5 |

## 6. Arquivos alvo

- `supabase/migrations/20260806050000_phase_6_0_4_4_billing_engine.sql` (nova, aplicada)
- `supabase/migrations/20260806070000_fix_rpc_ambiguous_column_references.sql` (corretiva: 7 RPCs com OUT params qualificados)
- `supabase/migrations/20260806080000_fix_apply_subscription_transition_tenant_status_enum.sql` (corretiva: `v_tenant_status` tipado `tenant_status`)
- `domain/billing/types.ts`, `billingEngine.ts`, `limits.ts`, `billingRepository.ts`, `index.ts` (novos)
- `domain/billing/billingEngine.test.ts`, `limits.test.ts`, `billingRepository.test.ts` (novos)
- `application/billing.ts`, `application/billing.test.ts` (novos)
- `application/tenantLifecycle.ts` + `tenantLifecycle.test.ts` (alterados — cancelamento)
- `domain/events/subscribers/financeSubscriber.ts` + teste de regressão (aditivo)
- `domain/events/outbox/providers/financeProvider.ts` (handlers aditivos)
- Docs: `TENANT_LIFECYCLE.md`, `SUBSCRIPTION_MODEL.md` (re-alinhar nomenclatura D2 + cancel_at_period_end), `BUSINESS_DECISIONS.md` (F6 stale), `TAXONOMY.md`, `PHASE_6_0_4_EXECUTION_PLAN.md` (§5.3 checkboxes), `ROADMAP.md`, `PROJECT_STATUS.md`

## 7. Testes

- Unit engine: transições da tabela §3.2 (todas as células), idempotência de emissão (idempotency_key), renovação, efetivação de cancelamento.
- Unit limits: 1/5/∞.
- Unit `application/billing.test.ts`: issueInvoice (free/trial NÃO emite; pago emite amount 0), markPaid (past_due→active), handleFailure (registro), runCycle (batch determinístico).
- Regressão `tenantLifecycle.test.ts`: cancel = pedido (status mantido, `cancelAtPeriodEnd` setado, evento `Updated`).
- Regressão FinanceSubscriber: `TenantSubscription*`/`Invoice*` não colidem com ChefClub.
- Suíte completa `npm test` verde; `npm run build` pass; typecheck sem novos erros.

## 8. Riscos e mitigações

| # | Risco | Impacto | Mitigação |
|---|-------|---------|-----------|
| R-B1 | Alterar `cancel_subscription` quebra contrato já entregue (6.0.4.2/.3) | Alto | Migration idempotente; ajuste dos 18 testes; comportamento documentado como mudança deliberada (D-A) |
| R-B2 | Duplicação de regras entre engine TS e qualquer SQL futuro | Alto | Engine TS é única fonte da verdade; SEM RPC de ciclo no banco (evita dual-source) |
| R-B3 | Colisão de eventos com ChefClub | Alto | Prefixo `TenantSubscription*`/`Invoice*` (D2); teste de regressão |
| R-B4 | Trial vira `past_due` e fica órfão (sem cron, sem gateway) | Médio | `runCycle` manual determinístico cobre os flows; suspensão é 6.0.5; documentado |
| R-B5 | Invoice amount 0 confunde leitura de dados | Médio | Placeholder explícito (D-C); docs marcam amount real como futuro/gateway |
| R-B6 | Docs divergentes (SUBSCRIPTION_MODEL, F6 stale, artefato `n`) | Baixo | Re-alinhamento na entrega (§6 docs) |

## 9. Critérios de saída

- [x] `cancel_at_period_end` no schema; `cancel_subscription` não cancela imediatamente (acesso mantido até o fim do período)
- [x] Engine TS puro cobre todas as transições da tabela §3.2; teste por transição
- [x] Invoice somente para planos pagos em renovação, `amount=0`, idempotente
- [x] `runCycle` determinístico; suspensão/reativação/cron/gateway explicitamente fora do escopo
- [x] FinanceSubscriber/Provider estendidos aditivamente; regressão ChefClub verde
- [x] Suíte completa (749/749) + build + typecheck (sem novos erros) verdes; docs re-alinhados (incl. F6 stale)
- [x] **E2E real: flow9 + flow12 verdes** (validam onboarding→trial→active e cancelamento→efetivação no banco real)
- [x] Planos mestre/ROADMAP/PROJECT_STATUS atualizados; commit + baseline `v1.4.2-billing-engine-6.0.4.4`

## 10. Próxima etapa

✅ **ENTREGUE (2026-08-06).** Executado na ordem: 3.1 (migration cancel_at_period_end) → 3.2 (domain/billing) → 3.3 (BillingService) → 3.5 (FinanceProvider) → **E2E flow9/flow12 (verdes)** → docs/status → commit + baseline `v1.4.2-billing-engine-6.0.4.4`. Próxima subfase do plano mestre: **6.0.5 (Feature Flags / Suspensão / Reativação)**.
