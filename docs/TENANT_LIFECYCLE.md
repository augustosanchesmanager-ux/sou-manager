# Tenant Lifecycle

> Estado e transições permitidas do tenant. **Fonte oficial para condicionais no código.**

---

## Estados

| Estado | Descrição | Acesso |
|--------|-----------|--------|
| `draft` | Tenant recém-criado, aguardando onboarding | Nenhum — redirecionado para `/onboarding/shop-setup` |
| `trial` | Onboarding concluído, período de avaliação | Total — funcionalidades liberadas |
| `active` | Plano pago ativo | Total — funcionalidades liberadas |
| `past_due` | Pagamento atrasado | Total com restrições — lembretes de pagamento |
| `suspended` | Suspenso por inadimplência | Nenhum — redirecionado para `/pending-approval` |
| `cancelled` | Assinatura cancelada pelo usuário | Nenhum — redirecionado para `/pending-approval` |
| `archived` | Arquivado (inativo há muito tempo) | Nenhum — redirecionado para `/pending-approval` |

---

## Transições Permitidas

```
draft ──────────────► trial ───────────► active ────────► past_due
  │                    │                    │               │
  │                    │                    │               ├──► active (pagou)
  │                    │                    │               │
  │                    │                    │               └──► suspended
  │                    │                    │                      │
  │                    │                    │                      └──► cancelled
  │                    │                    │                             │
  │                    │                    │                             └──► archived
  │                    │                    │
  │                    ├──► cancelled       └──► cancelled
  │                    │
  └──► cancelled
```

### Detalhamento

| De | Para | Trigger | Quem decide |
|----|------|---------|-------------|
| `draft` | `trial` | Usuário completa onboarding (ShopSetup) — `complete_onboarding()` invoca `start_trial()` | `CompleteOnboardingService` + `TenantLifecycleService` |
| `draft` | `cancelled` | Usuário cancela antes de completar onboarding | Usuário |
| `draft` | `archived` | Onboarding não completado em X dias | Cron job futuro |
| `trial` | `active` | Pagamento confirmado / ativação manual — `activate_subscription()` | Billing (sem gateway na 6.0.4) |
| `trial` | `cancelled` | Usuário cancela durante o trial — `cancel_subscription()` | Usuário |
| `trial` | `past_due` | Pagamento falha ao fim do trial | Billing |
| `active` | `past_due` | Pagamento falha | Billing |
| `active` | `cancelled` | Usuário cancela assinatura | Usuário |
| `active` | `archived` | Inatividade prolongada | Cron job futuro |
| `past_due` | `active` | Pagamento confirmado | Billing |
| `past_due` | `suspended` | Inadimplência prolongada (grace 5 dias) | Billing |
| `suspended` | `cancelled` | Suspensão prolongada | Cron job futuro |
| `cancelled` | `archived` | Após período de retenção | Cron job futuro |
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

### Resumo

| Status | Usuário comum | Manager | SuperAdmin |
|--------|---------------|---------|------------|
| `draft` | Redirecionado para onboarding | — | Total |
| `trial` | Total | Total | Total |
| `active` | Total | Total | Total |
| `past_due` | Com restrições | Com restrições | Total |
| `suspended` | Bloqueado | Bloqueado | Total |
| `cancelled` | Bloqueado | Bloqueado | Total |
| `archived` | Bloqueado | Bloqueado | Total |

---

## Implementação

- **ENUM type**: `tenant_status` (PostgreSQL)
- **Coluna**: `tenants.status` (replaces `active` BOOLEAN)
- **Migração**: `20260728000000_sprint1_tenant_lifecycle.sql`
- **Domain**: `domain/tenant/types.ts` — `TenantStatus`
- **Guard**: `App.tsx` → `ProtectedRoute` — redireciona baseado em `tenant.status`
- **RPC**: `provision_new_tenant()` — cria tenant com status `draft`
- **RPC**: `complete_onboarding()` — transição `draft → trial` (invoca `start_trial()`); guard via `current_is_tenant_manager_from_auth_uid` (6.0.4.3)
- **RPC**: `start_trial()` — cria subscription `trialing` e transiciona `draft → trial` (idempotente; trial 14 dias do provisionamento)
- **RPC**: `activate_subscription()` — transição `trial → active`
- **RPC**: `cancel_subscription()` — transição `trialing/active/past_due → cancelled`
- **RPC**: `get_subscription()` — leitura da assinatura do tenant do chamador
- **Service**: `application/tenantLifecycle.ts` — `TenantLifecycleService` (startTrial/activate/cancel/getStatus) centraliza a emissão dos eventos de billing
- **Eventos**: `TenantSubscriptionCreated`, `TenantTrialStarted`, `TenantSubscriptionUpdated`, `TenantSubscriptionCancelled` (catálogo `domain/events/types.ts`)
