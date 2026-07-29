# SMG Platform — Architecture v3.0 RC1

> Architecture Candidate — Frozen as of 2026-07-24
>
> **⚠ Roadmap Congelado** — Toda mudança arquitetural deve passar por ADR.
>
> **Diretriz Oficial:** Ver `ROADMAP.md` — Papel da IA expandido, 4 auditorias obrigatórias.
>
> **Glossário:** Ver `docs/TAXONOMY.md` para nomenclatura oficial.
>
> **Produto Comercial Ativo:** SMG Barber (único)
>
> **Arquitetura:** SMG Platform (multi-tenant, genérica, permanente)
>
> **Domínios:** `{produto}.soumanager.com` (nunca `app.soumanager.com`)

---

## Layered Architecture

```text
Pages (React UI)
  ↓
Hooks (state orchestration)
  ↓
Application Services (business logic)
  ↓
Repositories (persistence abstraction)
  ↓
Infrastructure (Supabase, external APIs)
  ↓
Database (PostgreSQL)
```

### Rules

1. **Each layer only imports from the layer directly below it**
2. **No skipping layers** — Pages must not import Repositories
3. **No reverse dependencies** — Infrastructure must not import Application
4. **Cross-cutting concerns** flow through dependency injection

---

## Vertical Slice Pattern

Code is organized by **feature**, not by technical layer:

```text
domain/{feature}/
  ├── types.ts          # Domain types
  ├── repository.ts     # Repository interface
  ├── labels.ts         # UI labels (if any)
  └── *.ts              # Domain rules

application/{feature}/
  └── *.ts              # Application services

infrastructure/
  └── supabase-client-factory.ts  # ONLY file touching Supabase

pages/{feature}/*.tsx   # UI components
hooks/{feature}/*.ts    # State orchestration
```

Shared code lives in `src/lib/` (utilities, clients, types).

---

## Repository Pattern

All persistence goes through Repository interfaces.

### Interface Hierarchy

```typescript
IRepository<T>           — list, get, exists
ICreatableRepository<T>  — + create
IUpdatableRepository<T>  — + update
IDeletableRepository<T>  — + delete
ICrudRepository<T>       — create + update + delete
```

### Naming

- Class: `XxxRepositoryImpl`
- Singleton: `export const xxxRepository = new XxxRepositoryImpl()`
- Interface: `IXxxRepository`

### Return Types

- `get()` → `T | null`
- `list()` → `T[]`
- `exists()` → `boolean`
- Errors: throw `RepositoryError`

---

## Application Services

Business logic in pure TypeScript. No React. No Supabase.

```typescript
class CheckoutApplicationService {
  constructor(
    private comandaRepo: IComandaRepository,
    private itemRepo: IComandaItemRepository,
  ) {}
}
```

---

## Event Bus

In-memory pub/sub for domain events.

```typescript
await appEventBus.publish(createEvent<CheckoutCompletedEvent>({...}));
```

Subscribers are registered via `SubscriberRegistry`. Errors are isolated.

### Event Structure (Payload vs Metadata)

Events split into **payload** (business data) and **metadata** (cross-cutting context):

```typescript
createEvent<CheckoutCompletedEvent>({
  eventType: 'CheckoutCompleted',
  aggregateId: comandaId,
  aggregateType: 'comanda',
  payload: { comandaId, clientId, total, ... },
  metadata: { tenantId, correlationId, source, version },
});
```

### Event Versioning

Events carry a `version` field (auto-set to 1 by `createEvent`). Future migrations can evolve event shapes without breaking existing consumers.

---

## Outbox Pattern

Reliable event delivery with retry + dead letter.

```text
pending → processing → published
                      → pending (retry)
                        → dead_letter
```

### FinanceProvider

Official executor for financial operations from the Outbox. Implements `DispatcherProvider`.

**Flow:** `FinanceSubscriber → Outbox → Dispatcher → FinanceProvider → Repositories`

6 operation types: `create_transaction`, `create_receivable`, `create_commission_record`, `reverse_revenue`, `deduct_credits`, `close_daily_cash`.

### Replay Engine

Replays events from EventStore through EventBus for state reconstruction, recovery, and debugging.

```typescript
const engine = createReplayEngine({ eventStore, eventBus });
const result = await engine.replay({ tenantId: 'tenant-1' });
```

---

## Multi-Tenant

- RLS on all domain tables
- `tenant_id` on every tenant-scoped table
- `current_tenant_id_from_auth_uid()` for RLS (SECURITY DEFINER)
- Superadmin bypass via `current_is_super_admin_from_auth_uid()` (SECURITY DEFINER)
- 47 tables inventoried, 37 with RLS enabled

### Schema Routing

- `SHARED_SCHEMA = 'public'` for core tables (`profiles`, `tenants`, `staff`, `audit_logs`)
- App-specific schema (`barber`, `auto`, `club`) for domain tables (when multi-schema enabled)
- `getClientForTable(tableName, tenantId)` auto-selects correct schema

---

## Security (Fase 3.3)

### RLS Policies

- **Primary helper:** `current_tenant_id_from_auth_uid()` (SECURITY DEFINER)
- **Superadmin bypass:** `current_is_super_admin_from_auth_uid()` (SECURITY DEFINER)
- **Critical fixes:** Migration `20260723000000_security_fix_rls_critical.sql`

### RPC Security

- 20+ RPCs audited, all core financial RPCs properly secured
- `approve_access_request()` and `close_order()` need auth checks (legacy)

---

## Observability (Fase 3.5)

Module: `src/lib/observability/`

| Component | Purpose |
|-----------|---------|
| `logger.ts` | Structured logging with context |
| `events.ts` | Business events catalog (20+ events) |
| `metrics.ts` | Counters, gauges, histograms |
| `alerts.ts` | 14 domain-specific alert rules + webhook support |
| `instrumentation.ts` | Declarative service wrapper |

Services instrumented externally via config — zero changes to service code:

```typescript
instrumentService(checkoutApplicationService, {
  finish: { operation: 'Checkout.finish', businessEvent: 'CHECKOUT_COMPLETED' },
});
```

---

## RPC Strategy

RPCs bypass Repositories when no dedicated Repository exists.

```typescript
const client = createSupabaseClient();
const result = await client.rpc('get_auth_access_context', {...});
```

---

## Business Architecture (Fase 5)

Documented in `docs/BUSINESS_ARCHITECTURE.md`. Defines:

- Produto comercial ativo: SMG Barber
- Módulos: Club dos Chefes (recorrência), Financeiro, Relatórios
- Fluxos principais: Agendamento, Comanda, Checkout, Comissão, Fechamento diário
- Matriz de permissões: 6 papéis × 7 módulos

---

## SaaS Core Architecture (Fase 5.5)

Documented in `docs/SAAS_CORE_ARCHITECTURE.md`. Defines:

- **Onboarding:** 8 steps (cadastro → validação → criação tenant → unidade → owner → configurações → primeiro acesso → configuração inicial)
- **Tenant Lifecycle:** 7 states: `draft → trial → active → past_due → suspended → cancelled → archived`
- **Billing:** Monthly recurring, gateway-agnostic, adapters for future provider swap
- **Plans:** Free (trial), Pro (recomendado), Elite (premium) — sem preços, limites configuráveis
- **Feature Flags:** Per-feature and per-limit gating
- **Roles:** Owner → Admin → Gerente → Recepcionista → Barbeiro → Caixa

---

## Forbidden

| Rule | Enforcement |
|------|-------------|
| Component → Repository | `guard-imports.mjs` |
| Component → Supabase | `guard-imports.mjs` |
| Domain → React | `guard-imports.mjs` |
| Domain → UI | `guard-imports.mjs` |
| `.from()` outside domain | `guard-repository.mjs` |
| Circular imports | `guard-circular.mjs` |

---

## Testing

- **631 unit tests** (vitest)
- **26 E2E tests** (Playwright)
- Architecture guards prevent regressions

---

## ADRs

Full decision records in `docs/adr/`:

| ADR | Title |
|-----|-------|
| ADR-001 | Layered Architecture |
| ADR-001 | Commission vs Settlement |
| ADR-002 | Repository Pattern |
| ADR-003 | Multi-Tenant Isolation |
| ADR-004 | Application Services |
| ADR-005 | RPC Strategy |
| ADR-006 | Event Bus |
| ADR-007 | Outbox Pattern |
| ADR-008 | Audit Strategy |
| ADR-009 | Repository Naming Conventions |
| ADR-010 | Architecture Guards |

---

## Frozen

This architecture is frozen. Changes require:

1. ADR justification
2. Business rationale
3. Architecture guard updates
4. Baseline adjustment
