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
draft ──────────────► active ────────► past_due
  │                                      │
  │                                      ├──► active (pagou)
  │                                      │
  │                                      └──► suspended
  │                                             │
  │                                             └──► cancelled
  │                                                    │
  │                                                    └──► archived
  │
  └──► cancelled

[ ] trial ─ future state when Billing is implemented (draft → trial → active)
```

### Detalhamento

| De | Para | Trigger | Quem decide |
|----|------|---------|-------------|
| `draft` | `active` | Usuário completa onboarding (ShopSetup) | `CompleteOnboardingService` |
| `draft` | `cancelled` | Usuário cancela antes de completar onboarding | Usuário |
| `draft` | `archived` | Onboarding não completado em X dias | Cron job futuro |
| `active` | `past_due` | Pagamento falha | Billing |
| `active` | `cancelled` | Usuário cancela assinatura | Usuário |
| `active` | `archived` | Inatividade prolongada | Cron job futuro |
| `past_due` | `active` | Pagamento confirmado | Billing |
| `past_due` | `suspended` | Inadimplência prolongada | Billing |
| `suspended` | `cancelled` | Suspensão prolongada | Cron job futuro |
| `cancelled` | `archived` | Após período de retenção | Cron job futuro |
| Qualquer | `archived` | Superadmin decide | SuperAdmin |

> **Nota:** `trial` está definido no ENUM e no tipo TypeScript, mas não é usado enquanto Billing não for implementado. Quando Billing for ativo, onboarding passará a transicionar `draft → trial`, e pagamento `trial → active`. Atualmente onboarding vai direto de `draft → active`.

---

## Regras de Acesso

### No código (ProtectedRoute)

```typescript
// draft → onboarding
if (tenant.status === 'draft') return <Navigate to="/onboarding/shop-setup" />;

// suspended, cancelled, archived → bloqueado
if (['suspended', 'cancelled', 'archived'].includes(tenant.status)) return <Navigate to="/pending-approval" />;

// active, past_due → liberado
```

### Resumo

| Status | Usuário comum | Manager | SuperAdmin |
|--------|---------------|---------|------------|
| `draft` | Redirecionado para onboarding | — | Total |
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
- **RPC**: `complete_onboarding()` — transição `draft → active` (futuramente `draft → trial` com Billing)
