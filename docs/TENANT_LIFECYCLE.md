# Tenant Lifecycle

> Estado e transições permitidas do **tenant (contexto de ACESSO)**. **Fonte oficial para condicionais no código.**
>
> **Alinhado ao ADR-013 (2026-08-06, Subfase 0).** Este documento descreve apenas o contexto **Tenant**. O contexto **Subscription** (contrato comercial) vive em `SUBSCRIPTION_MODEL.md`; o contexto **Feature Flags** em `FEATURE_FLAGS_MODEL.md`; e o **Estado Efetivo** (acesso resultante da combinação dos três) no ADR-013 §2.4.

---

## Estados

| Estado | Descrição | Acesso |
|--------|-----------|--------|
| `draft` | Tenant recém-criado, aguardando onboarding | Nenhum — redirecionado para `/onboarding/shop-setup` |
| `trial` | Onboarding concluído, período de avaliação | Total — funcionalidades liberadas |
| `active` | Plano pago ativo | Total — funcionalidades liberadas |
| `past_due` | Pagamento atrasado (janela de grace de 5 dias) | **Read-only com aviso** (D-6.0.5-1) — login, dashboard, relatórios e exportações; sem criação de clientes/comandas/agendamentos, movimentação financeira, estoque ou alterações cadastrais |
| `suspended` | Suspenso por inadimplência (grace expirado) **[6.0.5]** | **Nenhum** (D-6.0.5-2) — hoje "Nenhum, `/pending-approval`" |
| `cancelled` | Assinatura efetivamente cancelada | **Somente leitura** (D-6.0.5-2) — login, consulta, exportação e relatórios; qualquer escrita bloqueada |
| `archived` | Arquivado (terminal, F5 — dados preservados) | Nenhum — redirecionado para `/pending-approval` |

> `grace` **não é estado** (janela temporal, ADR-013 §4.3). `cancel_pending` **não existe** (D-A, ADR-013 §4.2).

---

## Transições Permitidas

Diagrama da máquina completa (tenant). Transições marcadas **[engine]** são decididas pelo Billing Engine e **persistidas pelo TenantLifecycleService** (Single Writer — ADR-013 §3.1). Pedido de cancelamento **não muda estado** (D-A).

```
draft ──────────────► trial ───────────► active ────────► past_due
  │                    │                    │               │
  │                    │                    │               ├──► active (pagou, markPaid)
  │                    │                    │               │
  │                    │                    │               └──► suspended [engine, 6.0.5]
  │                    │                    │                      │
  │                    │                    │                      ├──► active (reativação) [engine, 6.0.5]
  │                    │                    │                      │
  │                    │                    │                      └──► cancelled (retenção — D-6.0.5-4)
  │                    │                    │                             │
  │                    │                    │                             └──► archived
  │                    │                    │
  │                    ├──► cancelled       └──► cancelled
  │                    │  [engine: cancel_at_period_end atingido]
  │                    │
  └──► cancelled (ação administrativa)
```

### Detalhamento

| De | Para | Trigger | Quem decide |
|----|------|---------|-------------|
| `draft` | `trial` | Usuário completa onboarding — `complete_onboarding()` invoca `start_trial()` (F10) | `CompleteOnboardingService` + `TenantLifecycleService` |
| `draft` | `cancelled` | Ação administrativa (sem RPC de cancelamento pré-onboarding) | SuperAdmin |
| `draft` | `archived` | Onboarding não completado em X dias | Cron futuro (sujeito a F5) — ação manual (D-6.0.5-4) |
| `trial` | `active` | `activate_subscription()` (manual, D-D; sem gateway na 6.0.4) | `TenantLifecycleService` |
| `trial` | `past_due` | Trial expira com plano pago e sem pagamento (engine) | **Billing Engine** |
| `trial` | `cancelled` | **`cancel_at_period_end` atingido** (engine) — pedido de cancelamento durante o trial não muda estado (D-A) | **Billing Engine** |
| `active` | `past_due` | Vencimento sem pagamento (engine) | **Billing Engine** |
| `active` | `cancelled` | **`cancel_at_period_end` atingido** (engine) — pedido do usuário não muda estado (D-A) | **Billing Engine** |
| `active` | `archived` | Inatividade prolongada | Cron futuro (sujeito a F5) — ação manual (D-6.0.5-4) |
| `past_due` | `active` | `markPaid` (pagamento confirmado) | **Billing Engine** |
| `past_due` | `suspended` | Grace expirado (`asOf ≥ grace_ends_at`) **[6.0.5]** | **Billing Engine** |
| `suspended` | `active` | Reativação: `markPaid` ou ação do manager/superadmin **[6.0.5]** | **Billing Engine** |
| `suspended` | `cancelled` | Decisão de retenção **[6.0.5]** | SuperAdmin — ação manual (D-6.0.5-4) |
| `cancelled` | `archived` | Retenção administrativa | SuperAdmin — ação manual (D-6.0.5-4; F5: nunca excluir) |
| Qualquer | `archived` | Superadmin decide | SuperAdmin |

> **Regra do PO (F10/D5):** `draft → trial → active` é **obrigatório**. **Nunca**
> `draft → active` direto, mesmo com trial de zero dias — mantém o fluxo consistente.
> O trial dura 14 dias contados do **provisionamento** do tenant (`tenants.created_at`),
> não do onboarding (D3).

---

## Regras de Acesso

### No código (ProtectedRoute)

```typescript
// draft → onboarding
if (tenant.status === 'draft') return <Navigate to="/onboarding/shop-setup" />;

// suspended, cancelled, archived → bloqueado
if (['suspended', 'cancelled', 'archived'].includes(tenant.status)) return <Navigate to="/pending-approval" />;

// trial, active, past_due → liberado
```

> ⚠️ **Estado Efetivo (ADR-013 §2.4):** o snippet acima reflete a implementação atual (gate por `tenant.status`). A partir da 6.0.5, toda decisão de acesso passa pela **camada de autorização** (estado efetivo = Subscription + Tenant + Feature Flags), e é **proibido** decidir acesso apenas com `if (tenant.status === 'active')` (ou variantes). O `tenant.status` deixa de ser o espelho do contrato e passa a ser escrito **apenas pelo TenantLifecycleService** (Single Writer — ADR-013 §3.1).

### Resumo

| Status | Usuário comum | Manager | SuperAdmin |
|--------|---------------|---------|------------|
| `draft` | Redirecionado para onboarding | — | Total |
| `trial` | Total | Total | Total |
| `active` | Total | Total | Total |
| `past_due` | Read-only com aviso (D-6.0.5-1) | Read-only com aviso | Total |
| `suspended` | Bloqueado | Bloqueado | Total |
| `cancelled` | Somente leitura (D-6.0.5-2) | Somente leitura | Total |
| `archived` | Bloqueado | Bloqueado | Total |

---

## Implementação

- **ENUM type**: `tenant_status` (PostgreSQL) — 7 valores: `draft, trial, active, past_due, suspended, cancelled, archived`
- **Coluna**: `tenants.status` (replaces `active` BOOLEAN)
- **Migração**: `20260728000000_sprint1_tenant_lifecycle.sql`
- **Domain**: `domain/tenant/types.ts` — `TenantStatus`
- **Guard**: `App.tsx` → `ProtectedRoute` — redireciona baseado em `tenant.status` (6.0.5: passa para a camada de autorização — Estado Efetivo)
- **RPC**: `provision_new_tenant()` — cria tenant com status `draft`
- **RPC**: `complete_onboarding()` — transição `draft → trial` (invoca `start_trial()`); guard via `current_is_tenant_manager_from_auth_uid` (6.0.4.3)
- **RPC**: `start_trial()` — cria subscription `trialing` e transiciona `draft → trial` (idempotente; trial 14 dias do provisionamento)
- **RPC**: `activate_subscription()` — transição `trial → active`
- **RPC**: `cancel_subscription()` — **pedido** (D-A): grava `cancel_at_period_end`; **não altera** `tenants.status` nem `subscriptions.status`. Efetivação via engine (`runCycle`)
- **RPC**: `get_subscription()` — leitura da assinatura do tenant do chamador
- **Service**: `application/tenantLifecycle.ts` — `TenantLifecycleService` (startTrial/activate/cancel/getStatus) centraliza a emissão dos eventos de billing
- **Writer de `tenants.status` (Single Writer — ADR-013 §3.1):** exclusivamente `TenantLifecycleService` (hoje via `start_trial`/`activate_subscription`/`apply_subscription_transition`; na 6.0.5.4 a responsabilidade é dividida para garantir writer único — o `apply_subscription_transition` deixa de gravar o espelho de tenant)
- **Eventos**: `TenantSubscriptionCreated`, `TenantTrialStarted`, `TenantSubscriptionUpdated`, `TenantSubscriptionCancelled`, `TenantSubscriptionSuspended`/`Reactivated` **[6.0.5]** (catálogo `domain/events/types.ts`)

---

## Referências

- **Arquitetura oficial (congelada):** `docs/adr/ADR-013-billing-tenant-featureflags.md` (Accepted, 2026-08-06)
- **Contrato comercial:** `docs/SUBSCRIPTION_MODEL.md`
- **Funcionalidades/limites:** `docs/FEATURE_FLAGS_MODEL.md`
