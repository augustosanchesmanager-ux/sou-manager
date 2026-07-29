# AGENTS.md — SOU MANA.GER

> Compact instructions for OpenCode sessions. If a fact is obvious from filenames or generic to React/Vite, it is omitted.

---

## ⚠ ROADMAP CONGELADO

**A partir de 2026-07-24, o roadmap está oficialmente CONGELADO.**

- ❌ Nenhuma nova fase poderá ser criada
- ❌ Nenhuma fase poderá ser reorganizada
- ✅ Somente evoluções documentadas por ADR são permitidas
- ✅ Toda mudança arquitetural deve passar por ADR

**Decisões Estratégicas:** Ver `ROADMAP.md` (Decisões D1-D9)

---

## Diretriz Oficial (2026-07-27)

A arquitetura técnica está **estabilizada**. O objetivo agora é transformar a SMG Platform em uma plataforma SaaS pronta para produção.

### Produto Comercial Ativo

**Único produto em desenvolvimento:** SMG Barber

A SMG Platform foi concebida para suportar múltiplos produtos SaaS compartilhando a mesma infraestrutura técnica. Atualmente existe apenas um produto comercial ativo: **SMG Barber**. Novos segmentos poderão ser desenvolvidos futuramente, mediante decisão formal do Product Owner.

### Decisão Arquitetural Permanente

> A arquitetura da SMG Platform deve sempre ser construída de forma genérica, modular e multi-tenant.
>
> Entretanto, decisões de negócio, documentação funcional, regras de domínio e implementação devem considerar exclusivamente os produtos comercialmente ativos.
>
> Nenhuma funcionalidade, documentação ou arquitetura específica para novos segmentos poderá ser criada baseada em hipóteses futuras.

**Princípio:** Arquitetura pensa no futuro. Negócio pensa no presente.

### Papel da IA

A IA atua como: **Software Architect**, **Product Architect**, **Platform Architect**, **Tech Lead**, **Staff Engineer**, **Analista de Negócios**.

O papel é **impedir** decisões que prejudiquem a escalabilidade futura da plataforma.

Sempre que identificar duplicação, inconsistências, nomenclatura incorreta, arquitetura inadequada, fluxo confuso ou documentação divergente — **interromper a execução** e apresentar uma proposta **antes** de escrever código.

### Regra de Entrada

Antes de iniciar qualquer nova fase, executar:
1. Auditoria documental
2. Auditoria arquitetural
3. Auditoria de nomenclatura
4. Auditoria de consistência

---

## Glossário Oficial

**Toda nomenclatura deve seguir `docs/TAXONOMY.md`.**

- **Produtos:** SMG Barber
- **Módulos:** Club dos Chefes (módulo do SMG Barber, não SaaS)
- **Plataforma:** SMG Platform (ecossistema), SMG Core (arquitetura técnica)
- **Domínios:** `{produto}.soumanager.com` (nunca `app.soumanager.com`)

---

## Responsabilidades

| Responsável | Escopo |
|-------------|--------|
| **OpenCode** | Arquitetura, código, testes, documentação técnica, ADRs, CI/CD, automações, validações |
| **Augusto (PO)** | Produtos, módulos, nomenclaturas, planos comerciais, onboarding, estratégia, domínios, infraestrutura, deploy, fornecedores, políticas, LGPD |

**Regra:** Itens comerciais nunca devem ser decididos automaticamente pelo OpenCode.

---

## Nova Forma de Execução

Cada fase deverá possuir:
- Objetivo
- Escopo
- Critérios de Entrada
- Critérios de Saída
- Dependências
- Arquivos Alterados
- Testes
- Riscos
- Responsável
- Próxima Etapa

---

## Stack & Tooling

- **React 19** + **Vite 6** + **TypeScript 5.8** + **Tailwind CSS v4** (CSS-based config, no `tailwind.config` file).
- **Router**: `react-router-dom` with **HashRouter** (not BrowserRouter). Required for Vercel SPA deployment (`vercel.json` has a catch-all rewrite to `index.html`).
- **State**: Pure React Context — `AuthContext` → `TenantProvider` → `AppProvider` → `ThemeProvider`. No Redux/Zustand.
- **Backend**: Supabase (PostgreSQL + Auth + Realtime). Migrations live in `supabase/migrations/`.
- **AI**: Google Gemini via `@google/generative-ai`.
- **No formatter** configured.

---

## Dev Commands

```bash
npm install
npm run dev      # Vite dev server on port 3000, host 0.0.0.0
npm run build    # Production build to dist/
npm run preview  # Preview production build locally
```

---

## Environment Variables

Create `.env.local` in the repo root (do not commit it):

```env
VITE_SUPABASE_URL=<url>
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_GEMINI_API_KEY=<key>
VITE_SUPABASE_MULTI_SCHEMA_ENABLED=false   # Optional; see Multi-App Architecture
VITE_APP_HOSTNAME_MAP={"custom.domain":"barber"}  # Optional JSON hostname→appSlug map
```

`vite.config.ts` also injects `process.env.GEMINI_API_KEY` at build time from `env.GEMINI_API_KEY`.

---

## Local Demo Mode (Critical for Debugging)

If **no Supabase env vars are present** AND the browser host is `localhost`/`127.0.0.1`, the app silently boots into **local demo mode**:

- A fake session is stored in `localStorage` under `soumanager.local.demo.session`.
- A hardcoded demo user/tenant is returned (`LOCAL_DEMO_USER_ID`, `LOCAL_DEMO_TENANT_ID`).
- All Supabase reads/writes are emulated via in-memory localStorage (`soumanager.local.demo.db`).

**Forensic implication**: Auth or data bugs reported on localhost may be artifacts of demo mode, not real Supabase behavior. Always check `hasSupabaseEnv` and `isLocalDemoEnabled()` in `src/lib/supabase/client.ts` before diagnosing RLS or RPC failures.

---

## Multi-App & Multi-Tenant Architecture

The system is a **multi-tenant SaaS** with optional **multi-schema** support.

### App Slugs & Schemas

- Supported apps: `barber` (default), `auto`, `club`.
- App resolution order (see `src/middleware/resolveApp.ts`):
  1. `VITE_APP_HOSTNAME_MAP` exact match
  2. Subdomain/hostname heuristic (`barber.*`, `auto.*`, etc.)
  3. Fallback to `barber`
- Schema routing (`src/lib/supabase/schemas.ts`):
  - `SHARED_SCHEMA = 'public'` for core tables (`profiles`, `tenants`, `staff`, `audit_logs`, etc.).
  - App-specific schema (`barber`, `auto`, `club`) for domain tables (`appointments`, `clients`, `comandas`, `transactions`, etc.) **only when** `VITE_SUPABASE_MULTI_SCHEMA_ENABLED` is true. Otherwise, everything stays in `public`.

### Tenant Isolation

- Row Level Security (RLS) policies enforce `tenant_id` isolation. See migration `20260227223434_fix_all_rls_policies_use_security_definer_function.sql`.
- `AuthContext` resolves the effective `tenantId` via Supabase RPC `get_auth_access_context`.
- `TenantContext` then fetches the full tenant record and user memberships via `resolveTenantForUser()`.

**Forensic implication**: Bugs where users see cross-tenant data are almost always RLS policy regressions or missing `tenant_id` filters in frontend queries, not schema routing issues.

---

## Module Boundaries & Path Aliases

- `@/` maps to the **repo root** (`path.resolve(__dirname, '.')`), not `src/`.
- There are **dual directory structures** — some code lives at root (`components/`, `context/`, `hooks/`, `pages/`, `services/`) and some under `src/`. Check both before creating duplicates.
- Barrel file: `services/supabaseClient.ts` re-exports everything from `src/lib/supabase/`.

---

## Auth & Routing Hierarchy

Provider nesting (inner → outer):

```
ThemeProvider
  AppProvider      (resolves appSlug/schema from hostname)
    AuthProvider   (session + accessRole + profileStatus)
      TenantProvider (tenant record + memberships)
        HashRouter
```

### Route Guards

- `ProtectedRoute`: Blocks unauthenticated users and redirects `pending`/`suspended` non-superadmins to `/pending-approval`.
- `ManagerRoute`: Blocks `barber` and `receptionist` from admin/financial pages.
- `SuperAdminRoute`: Blocks non-superadmins from `/superadmin`.

**Forensic implication**: Redirect loops or infinite loading states usually stem from race conditions between `AuthContext.loading` and `TenantContext.loading`, or from `profileStatus` being stuck in `pending`.

---

## Supabase Client Patterns

- Always import from `services/supabaseClient.ts` (or `src/lib/supabase/client.ts`).
- Use `getSharedClient()` for `public` schema tables.
- Use `getSchemaClient(schema)` or `getScopedClient({ schema, tenantId })` for domain tables when multi-schema is enabled.
- `getClientForTable(tableName, tenantId)` automatically picks the correct schema based on `isDomainTable()` and `isSharedTable()`.

**Do not** instantiate a raw `createClient` in page components.

---

## Database Migrations

All schema changes must be added as timestamped SQL files in `supabase/migrations/`.

Notable historical fixes to be aware of:
- `20260227223434_fix_all_rls_policies_use_security_definer_function.sql` — central RLS fix.
- `20260226052610_fix_manager_trigger_and_backfill_staff.sql` — auto-insert manager into `staff`.
- `20260308_multitenant_hotfix.sql` — multitenancy patch.

There is **no automated migration runner** in the frontend build; migrations are applied via Supabase CLI or dashboard.

---

## Common Debugging Targets

When investigating loops, duplicate execution, or cascading failures, prioritize these files:

1. `src/lib/supabase/client.ts` — demo mode, auth subscribers, client instantiation.
2. `context/AuthContext.tsx` — session listener, `onAuthStateChange`, `fetchAccessContext`.
3. `src/context/TenantContext.tsx` — `refreshTenant` triggered by auth session changes.
4. `src/context/AppContext.tsx` — hostname resolution, `setActiveAppContext` side effects.
5. `App.tsx` — route definitions and guard composition.

Check for:
- **useEffect without cleanup** on `onAuthStateChange` subscriptions.
- **Dual `setState` in `finally` blocks** causing re-render chains.
- **Missing dependency arrays** in context providers.
- **Retry without backoff** in any service call (none are built-in; verify manually).
- **Event replay** from Supabase Realtime if enabled later.

---

## Deployment

- Platform: **Vercel**.
- Build output: `dist/`.
- `vercel.json` rewrites all paths to `index.html` (SPA behavior). HashRouter is required because of this.

---

## Forensic Checklist (Apply to Every Bug)

1. **Is this localhost?** Verify if local demo mode is active.
2. **Is `tenant_id` consistent?** Check query filters and RLS policy context.
3. **Is `profileStatus` blocking the user?** Check `AuthContext` state before blaming routes.
4. **Is there a schema mismatch?** Compare `VITE_SUPABASE_MULTI_SCHEMA_ENABLED` with the migration target environment.
5. **Is there a duplicate listener/subscription?** Search for `onAuthStateChange` and `useEffect` without cleanup.
6. **Is the root cause a side effect or a symptom?** Trace the error backward from the UI to the context to the RPC/query.

---

## Architectural Decisions

Full ADRs live in `docs/adr/`.

### ADR-001 — Commission vs Settlement

**Commission** (theoretical) and **Settlement** (cash closing payout) are intentionally separate domains.

- `domain/commission/` calculates theoretical commission from service execution, participant splits, `affects_commission`, and `commission_rate`.
- `application/cashClosing/` calculates effective financial payout considering discounts, advances, reversals, and operational cash rules.

**Never replace CashClosing calculations with Commission calculations** unless a business decision explicitly changes this ADR. These are two different questions with two different answers.

See: `docs/adr/ADR-001-Commission-vs-Settlement.md`

---

## Frozen Architecture

Phase 2 is officially frozen.

Before creating:
- new Repository
- new Application Service
- new layer
- new abstraction

Verify if the problem truly requires architectural change. Most problems are solved within existing patterns.

Architectural changes after Phase 2 must be justified via ADR.

Full roadmap: `ROADMAP.md` (project root)

---

## Security Audit (Fase 3.3)

### RLS Policies

- **Primary helper:** `current_tenant_id_from_auth_uid()` (SECURITY DEFINER)
- **Superadmin bypass:** `current_is_super_admin_from_auth_uid()` (SECURITY DEFINER)
- **47 tables** inventoried, 37 with RLS enabled
- **Critical fixes:** `20260723000000_security_fix_rls_critical.sql`

### Key Findings

1. **Cash closing tables** — Now have superadmin bypass (was missing)
2. **Legacy `get_current_tenant_id()`** — Replaced in role_permissions and tenants
3. **Idempotency** — Well-implemented across all critical financial operations
4. **Race conditions** — Mitigated by database constraints; `FOR UPDATE` recommended for production hardening

### RPC Security

- **20+ RPCs** audited, all core financial RPCs properly secured
- **Critical:** `approve_access_request()` and `close_order()` need auth checks (legacy)
- **See:** `docs/security/SECURITY_AUDIT_RLS.md` and `docs/security/SECURITY_AUDIT_RPC.md`

### Production Checklist

- [ ] Apply migration `20260723000000_security_fix_rls_critical.sql`
- [ ] Fix `approve_access_request()` — add auth.uid() check
- [ ] Deprecate or fix `close_order()` — legacy function
- [ ] Add `FOR UPDATE` to critical SELECT queries in RPCs

---

## E2E Testing (Fase 3.4)

### Stack

- **Playwright** with Chromium
- **Page Objects** pattern (never access selectors directly in tests)
- **Auth fixtures** for pre-authenticated pages (admin, manager, barber, cashier)

### Commands

```bash
npm run test:e2e          # Run all E2E tests
npm run test:e2e:ui       # Run with Playwright UI
npm run test:e2e:smoke    # Run smoke suite only (@smoke tag)
```

### Structure

```text
tests/e2e/
├── fixtures/      # Auth fixtures (loggedAdmin, loggedBarber1, etc.)
├── pages/         # Page Objects (7 pages)
├── data/          # Static demo data
├── flows/         # P0 critical flows (5 flows)
├── smoke/         # Smoke suite (10 tests, <3 min)
└── regression/    # P1 admin CRUD + P2 reports
```

### Test Priority

- **P0 (Critical):** Appointment → Checkout → Commission, ChefClub lifecycle, Cancel/Reverse, Multi-barber, Cash closing
- **P1 (High):** CRUD clients, professionals, services
- **P2 (Medium):** Reports, CSV, Dashboard

### Conventions

- Tag critical tests with `@smoke` for CI
- Use Page Objects for all page interactions
- Use auth fixtures for pre-authenticated state
- Use static demo data for reproducibility

### Demo Mode (Important)

The app runs in **local demo mode** when:
- Hostname is `localhost`/`127.0.0.1`
- No `VITE_SUPABASE_URL` env var

In demo mode:
- Login: `teste@soumanager.local` / `12345678`
- Role: `manager` (only role available)
- Data: 2 clients, 2 services, 1 product, 2 plans (seeded in localStorage)
- All Supabase operations are mocked in-memory

**E2E tests run against the real app with `.env.local` (Supabase configured).** The auth fixture logs in via the real Supabase auth flow.

---

## Observability (Fase 3.5) ✅

### Module Location

`src/lib/observability/` — All observability code lives here.

### Components

| File | Purpose |
|------|---------|
| `logger.ts` | Structured logging with context (tenant, user, request, correlation) |
| `events.ts` | Business events catalog (20+ predefined events) |
| `metrics.ts` | Metrics collection (counters, gauges, histograms) |
| `alerts.ts` | Alert system with 14 domain-specific rules + webhook support |
| `instrumentation.ts` | Declarative service wrapper (`withObservability`, `instrumentService`) |
| `config.ts` | Centralized instrumentation config for all Application Services |
| `useObservability.ts` | React hook for app initialization |

### Declarative Instrumentation

Services are instrumented externally via config — zero changes to service code:

```typescript
import { instrumentService } from '@/src/lib/observability';

instrumentService(checkoutApplicationService, {
  finish: {
    operation: 'Checkout.finish',
    businessEvent: 'CHECKOUT_COMPLETED',
    metric: 'checkout_duration_ms',
  },
});
```

### Dashboard

Access via `/#/observability` (ManagerRoute):
- **Overview**: Total operations, success rate, error rate, active alerts
- **Domain tabs**: Checkout, CashClosing, Appointments, Commission, ChefClub
- **Latency distribution**: min, p50, avg, p95, max per domain
- **Alerts**: Active alerts, rules table, alert history
- **Logs**: Recent structured logs with filtering

### Alert Rules (14 domain-specific)

| Category | Rule | Threshold | Severity |
|----------|------|-----------|----------|
| Global | High error rate | > 5 errors / 5 min | Critical |
| Global | High RPC latency | > 3 seconds | Warning |
| Global | High rollback rate | > 10 rollbacks / 15 min | Critical |
| Checkout | Checkout failure rate | > 3 / 5 min | Critical |
| Checkout | Checkout timeout | > 10 seconds | Warning |
| Checkout | Items sync rollback | > 1 / 15 min | Critical |
| CashClosing | Close failure | > 2 / 15 min | Critical |
| CashClosing | Close duration high | > 15 seconds | Warning |
| Appointment | Creation failure | > 3 / 5 min | Critical |
| Appointment | Create duration high | > 8 seconds | Warning |
| Commission | Load failure | > 2 / 15 min | Warning |
| ChefClub | Credit deduction failure | > 2 / 15 min | Critical |
| ChefClub | Subscription resolution failure | > 3 / 15 min | Warning |

### Webhook Support

```typescript
alerts.addWebhook({
  url: 'https://hooks.slack.com/services/...',
  method: 'POST',
  headers: { 'X-Custom': 'value' },
  transform: (notification) => ({
    text: notification.message,
    severity: notification.severity,
  }),
});
```

---

## Event Bus + Event Store + Subscribers + Outbox (Fase 4) ✅

### Architecture

Domain-only infrastructure in `domain/events/` — zero React/Supabase dependency.

### Components

| File | Purpose |
|------|---------|
| `types.ts` | Event interfaces, `EventMetadata`, `SystemEvent` union, `createEvent` factory |
| `bus.ts` | `EventBus` interface (publish, subscribe, subscribeAll, clear) |
| `memory-bus.ts` | `InMemoryEventBus` class + `createEventBus` factory |
| `app-bus.ts` | `appEventBus` singleton (same pattern as supabase import) |
| `eventStore.ts` | `EventStoreRepository` interface (append, findBy*, count, replay) |
| `inMemoryEventStore.ts` | `InMemoryEventStore` class + `createEventStore` factory |
| `index.ts` | Barrel exports |

### Event Structure (Payload vs Metadata)

Events are split into **payload** (business data) and **metadata** (cross-cutting context):

```typescript
await appEventBus.publish(createEvent<CheckoutCompletedEvent>({
  eventType: 'CheckoutCompleted',
  aggregateId: comandaId,
  aggregateType: 'comanda',
  payload: {                    // Business data
    comandaId, clientId, total, paymentStatus, ...
  },
  metadata: {                   // Cross-cutting context
    tenantId: req.tenantId,
    correlationId: idempotencyKey,
    source: 'CheckoutApplicationService',
    // version is auto-set to 1 by createEvent factory
  },
}));
```

### Event Store API

```typescript
const store = createEventStore();

// Append (append-only, throws on duplicate eventId)
await store.append(event);
await store.appendBatch(events);

// Query
await store.findByAggregate('comanda', 'comanda-1');
await store.findByCorrelation('corr-123');
await store.findByType('CheckoutCompleted');
await store.findByTenant('tenant-1');
await store.findById('evt_...');
await store.count();

// Replay (Not Implemented — prepared for future)
await store.replay(query, handler); // throws 'Not Implemented'
```

### Domain Events (11 types)

| Event | Aggregate | Published By |
|-------|-----------|-------------|
| `CheckoutCompleted` | comanda | CheckoutApplicationService |
| `CheckoutReverted` | comanda | *(prepared)* |
| `AppointmentCreated` | appointment | AppointmentApplicationService |
| `AppointmentCancelled` | appointment | AppointmentApplicationService |
| `AppointmentCompleted` | appointment | *(prepared)* |
| `CashClosingCompleted` | cash_closing | CashClosingApplicationService |
| `SubscriptionCreated` | subscription | ChefClubApplicationService |
| `SubscriptionCancelled` | subscription | ChefClubApplicationService |
| `CreditsDeducted` | subscription | ChefClubApplicationService |
| `TransactionCreated` | transaction | *(prepared)* |
| `CommissionCalculated` | commission | *(prepared)* |

### Database Schema

`event_store` table (migration `20260723100000_event_store.sql`):
- Append-only (no UPDATE/DELETE policies)
- RLS enabled (superadmin bypass + tenant isolation)
- 6 indexes for aggregate, correlation, tenant, type, time, source queries
- `payload` (JSONB) and `metadata` (JSONB) separated

### Subscribers

Read-only event handlers that react to domain events without modifying business state.

| Subscriber | Event | Purpose |
|-----------|-------|---------|
| `AnalyticsSubscriber` | `CheckoutCompleted` | Tracks checkout metrics |
| `AuditSubscriber` | `*` (all events) | Logs all events for compliance |
| `NotificationSubscriber` | `CheckoutCompleted` | Sends checkout confirmations |
| `ReminderSubscriber` | `AppointmentCreated` | Schedules appointment reminders |
| `MarketingSubscriber` | `AppointmentCreated` | Tracks client engagement |
| `BiSubscriber` | `CashClosingCompleted` | Updates BI dashboards |

**IMPORTANT**: Financial subscribers (Commission, Finance) are intentionally excluded. Validate infrastructure with safe read-only subscribers first. Migrate to financial subscribers after validation.

**IMPORTANT**: Financial subscribers (Commission, Finance) are now implemented in Phase 4.6. See below.

```typescript
import { SubscriberRegistry } from '@/domain/events';
import { analyticsSubscriber, auditSubscriber } from '@/domain/events/subscribers';

const registry = new SubscriberRegistry(appEventBus);
registry.register(analyticsSubscriber);
registry.register(auditSubscriber);
registry.initialize(); // subscribes all registered subscribers
```

### Financial Subscribers (Fase 4.6) ✅

Two financial subscribers that react to domain events and produce financial side effects.

**CommissionSubscriber** (Group A — low risk, read-only):
- Listens to `CheckoutCompleted`
- Delegates calculation to injectable `CommissionCalculator` interface
- Publishes `CommissionCalculated` event for downstream consumers
- Skips events with `financialEffect=false` or no `staffId`

```typescript
import { createCommissionSubscriber } from '@/domain/events/subscribers';

const commissionSub = createCommissionSubscriber(bus, {
  calculate: async ({ comandaId, tenantId, total, staffId }) => {
    // Call CommissionApplicationService or equivalent
    return { staffId, period, totalSales, totalCommission, lineCount };
  },
});
registry.register(commissionSub);
```

**FinanceSubscriber** (Group B — writes via Outbox):
- Listens to 4 event types via `subscribeAll` (`*`)
- Maps events to `FinanceOperation[]` via injectable `FinanceStrategy`
- Enqueues operations to Outbox with idempotency (`eventId_operationType`)
- Actual execution via `DispatcherProvider` (future: `FinanceProvider`)

| Event | Operations |
|-------|-----------|
| `CheckoutCompleted` | `create_transaction`, `create_commission_record` |
| `SubscriptionCancelled` | `reverse_revenue` |
| `CreditsDeducted` | `deduct_credits` |
| `CashClosingCompleted` | `close_daily_cash` |

```typescript
import { createFinanceSubscriber } from '@/domain/events/subscribers';

const financeSub = createFinanceSubscriber(outbox, {
  mapCheckoutCompleted: (event) => [
    { type: 'create_transaction', data: { amount: event.payload.total } },
    { type: 'create_commission_record', data: { staffId: event.payload.staffId } },
  ],
  mapSubscriptionCancelled: (event) => [
    { type: 'reverse_revenue', data: { subscriptionId: event.payload.subscriptionId } },
  ],
  mapCreditsDeducted: (event) => [
    { type: 'deduct_credits', data: { amount: event.payload.amount } },
  ],
  mapCashClosingCompleted: (event) => [
    { type: 'close_daily_cash', data: { closingId: event.payload.closingId } },
  ],
});
registry.register(financeSub);
```

### Outbox Pattern (Fase 4.5) ✅

Reliable event delivery via outbox queue with retry + dead letter.

**Location:** `domain/events/outbox/`

| File | Purpose |
|------|---------|
| `types.ts` | `OutboxItem`, `RetryPolicy`, `DispatchTarget`, `OutboxStatus` |
| `outboxRepository.ts` | `OutboxRepository` interface (enqueue, findNext, markProcessing/Published/Failed, query, dead letters) |
| `dispatcher.ts` | `Dispatcher` interface (dispatch, dispatchAll) + `DispatcherProvider` interface |
| `inMemoryOutbox.ts` | `InMemoryOutbox` class + `createOutbox` factory |
| `inMemoryDispatcher.ts` | `InMemoryDispatcher` class + `createDispatcher` factory |
| `providers/consoleProvider.ts` | Console logging provider |
| `providers/webhookProvider.ts` | HTTP webhook provider |
| `providers/slackProvider.ts` | Slack webhook provider |
| `index.ts` | Barrel exports |

**Status lifecycle:**
```
pending → processing → published
                      → pending (retry, nextRetryAt set)
                        → dead_letter (after maxAttempts)
```

**Retry:** Exponential backoff — `baseDelayMs × 2^(attempts-1)`. Items exceeding `maxAttempts` move to dead letter.

**Usage:**
```typescript
import { createOutbox, createDispatcher } from '@/domain/events/outbox';

const outbox = createOutbox();
const dispatcher = createDispatcher(outbox);

// Enqueue
await outbox.enqueue({
  eventId: event.id,
  eventType: event.eventType,
  tenantId: event.metadata.tenantId,
  targets: [{ provider: 'webhook', config: { url: '...' } }],
  payload: event.payload,
  metadata: event.metadata,
});

// Dispatch (single item)
await dispatcher.dispatch();

// Dispatch all pending
await dispatcher.dispatchAll();
```

### FinanceProvider (Fase 4.6) ✅

Official executor for financial operations from the Outbox. Implements `DispatcherProvider`.

**Flow:** `FinanceSubscriber → Outbox → Dispatcher → FinanceProvider → Repositories`

| File | Purpose |
|------|---------|
| `providers/financeProvider.ts` | `createFinanceProvider` factory, `OperationHandler` interface, `InMemoryIdempotencyStore` |

**6 Operation Types:**

| Operation | Handler Target | Source Event |
|-----------|---------------|-------------|
| `create_transaction` | TransactionRepository | CheckoutCompleted |
| `create_receivable` | ReceivableRepository | SubscriptionCreated |
| `create_commission_record` | CommissionRepository | CheckoutCompleted |
| `reverse_revenue` | TransactionRepository | SubscriptionCancelled |
| `deduct_credits` | ChefClubRepository | CreditsDeducted |
| `close_daily_cash` | CashClosingRepository | CashClosingCompleted |

**Idempotency:** Uses `idempotencyKey` from operation payload. In-memory for testing; persistent DB table for production.

**Persistent Store** (`processed_operations` table):
- UNIQUE index on `(tenant_id, idempotency_key)` — O(1) dedup via INSERT → UNIQUE VIOLATION
- Append-only: no UPDATE/DELETE policies
- RLS enabled (superadmin bypass + tenant isolation)
- Migration: `20260723110000_processed_operations.sql`

```typescript
import { createFinanceProvider, createPersistentIdempotencyStore } from '@/domain/events/outbox';

const persistentStore = createPersistentIdempotencyStore({ db: supabaseClient });
const provider = createFinanceProvider({
  handlers: {
    create_transaction: {
      execute: async (data, context) => {
        // Create transaction via TransactionRepository
        return { success: true };
      },
    },
  },
  idempotencyStore: persistentStore,
});

dispatcher.registerProvider(provider);
```

### Replay Engine (Fase 4.7) ✅

Replays events from the EventStore through the EventBus for state reconstruction, recovery, and debugging.

**Flow:** `EventStore → ReplayEngine → EventBus → Subscribers`

| File | Purpose |
|------|---------|
| `replayEngine.ts` | `createReplayEngine({ eventStore, eventBus })` factory |
| `replayEngine.test.ts` | 31 tests (basic, dry-run, filtering, batching, error handling, edge cases) |

**ReplayOptions:**

| Option | Type | Description |
|--------|------|-------------|
| `eventType` | `string` | Filter by event type |
| `aggregateType` | `string` | Filter by aggregate type |
| `aggregateId` | `string` | Filter by aggregate ID |
| `correlationId` | `string` | Filter by correlation ID |
| `tenantId` | `string` | Filter by tenant ID |
| `from` | `string` | ISO date — start of time range |
| `to` | `string` | ISO date — end of time range |
| `dryRun` | `boolean` | Simulate replay without publishing |
| `batchSize` | `number` | Events per batch (default: 100) |
| `continueOnError` | `boolean` | Continue after error (default: true) |
| `onProgress` | `function` | Progress callback for long replays |

**ReplayResult:**

| Field | Type | Description |
|-------|------|-------------|
| `status` | `'completed' \| 'partial' \| 'dry_run' \| 'no_events'` | Overall status |
| `report` | `ReplayReport` | Metrics (total, replayed, skipped, failed, durationMs, throughput, errors) |
| `events` | `StoredEvent[]` | Events replayed (empty in dry-run) |

**Usage:**
```typescript
import { createReplayEngine } from '@/domain/events';

const engine = createReplayEngine({ eventStore, eventBus });

// Full replay
const result = await engine.replay({ tenantId: 'tenant-1' });

// Dry-run (simulate)
const dry = await engine.replay({ eventType: 'CheckoutCompleted', dryRun: true });

// Filtered replay with progress
const filtered = await engine.replay({
  eventType: 'CheckoutCompleted',
  from: '2026-07-01',
  to: '2026-07-31',
  batchSize: 50,
  onProgress: (p) => console.log(`${p.percentComplete}% (${p.processed}/${p.total})`),
});
```

