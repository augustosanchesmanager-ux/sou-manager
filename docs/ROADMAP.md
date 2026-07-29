# SMG Platform — Roadmap Arquitetural

> **⚠ Roadmap Congelado** — A partir de 2026-07-24, nenhuma nova fase poderá ser criada.
>
> **Glossário:** Ver `docs/TAXONOMY.md` para nomenclatura oficial.

## Status Geral

| Fase | Status |
|------|--------|
| Fase 1 — Hardening | ✅ Concluída |
| Fase 2 — Repository + Application Services | ❄️ FROZEN |
| Fase 3 — Qualidade | ✅ Concluída |
| Fase 4 — Event Driven | ✅ Concluída e Certificada |
| Fase 5 — Business Architecture | ⬜ Não iniciada (Documentação) |
| Fase 6 — Production Readiness | ⬜ Não iniciada |

---

## Fase 2 (Frozen)

**Objetivo:** Concluir a separação em camadas, Repository Pattern, Domain e Application Services.

**Status:** ✅ Encerrada.

A partir deste ponto:

- Não são aceitas novas refatorações estruturais.
- Apenas correções de bugs e melhorias de performance.
- Evolução de funcionalidades segue os padrões existentes.
- Toda mudança estrutural deve ser registrada via ADR.

### Entregas da Fase 2

- [x] Repository Pattern com DI (DatabaseClient)
- [x] Domain Layer (commission, comanda, shared)
- [x] Application Services (checkout, appointment, commission, cashClosing)
- [x] Shared Kernel (format, numbers, status)
- [x] ADR-001: Commission vs Settlement
- [x] 50 unit tests for domain/commission (now 62 with format)
- [x] Vitest configured

---

## Fase 3 — Qualidade ✅

**Objetivo:** Construir confiabilidade through testes, segurança e observabilidade.

**Status:** ✅ Concluída. 412 testes automatizados, build limpo, observabilidade completa, segurança auditada, performance otimizada.

**Ordem oficial:**

### 3.1 Domain Tests ✅
- [x] Domain Commission — 62 tests (calculate, participants, format)
- [x] Domain ChefClub — 73 tests (credits, cycle, validation)
- [x] Domain CashClosing — 33 tests (summary, cashCloseUtils pure functions)

### 3.2 Application Services Tests ✅
- [x] `SERVICE_TEST_MATRIX.md` — scenario checklist created
- [x] Test infrastructure: builders, factories, helpers (`tests/builders/`, `tests/factories/`, `tests/helpers/`)
- [x] Checkout scenarios: `tests/scenarios/checkout.scenario.ts`
- [x] Checkout (`validateFinishRequest`, `prepareComandaData`, `finish`) — 45 tests (Groups A-E)
- [x] CashClosing (`operations`, `loaders`, `summary`) — 38 tests (Groups A-D)
- [x] Appointment (`lifecycle`, `movement`) — 51 tests (Groups A-D)
- [x] Commission (`loadCommissionLines`, `groupByProfessional`, `summarize`, `exportToCsv`) — 30 tests (Groups A-E)
- [x] ChefClub (`credits`, `subscriptions`, `receivables`, `operations`, `loaders`) — 54 tests (Groups A-F)
- **Total: 386 tests across 13 files, all passing**

### 3.3 Security ✅
- [x] RLS policies audit — `docs/security/SECURITY_AUDIT_RLS.md` (47 tables inventoried)
- [x] RPC security review — `docs/security/SECURITY_AUDIT_RPC.md` (20+ RPCs audited)
- [x] RLS critical fixes migration — `20260723000000_security_fix_rls_critical.sql`
- [x] Idempotency validation — Well-implemented across all critical operations
- [x] Race condition analysis — Documented with `FOR UPDATE` recommendations
- [x] Multi-tenant isolation verification — Core paths verified secure

### 3.4 End-to-End ✅
- [x] Playwright setup — `playwright.config.ts` + npm scripts
- [x] Test infrastructure — `tests/e2e/` (pages, fixtures, data, helpers)
- [x] Page Objects — 7 pages (Login, Schedule, Checkout, CashClosing, Commissions, ChefClub, Clients)
- [x] Auth fixtures — Demo mode login (teste@soumanager.local / 12345678)
- [x] Test data — Matches actual demo mode seed data
- [x] P0 Flows — 5 critical flows (10 tests)
- [x] P1 Admin CRUD — 6 tests
- [x] Smoke suite — 10 tests (tagged @smoke)
- [x] **26/26 tests passing, ~30s suite time, 2 consecutive green runs**

### 3.5 Observabilidade ✅
- [x] Structured logger — `src/lib/observability/logger.ts`
- [x] Business events catalog — `src/lib/observability/events.ts`
- [x] Metrics collector — `src/lib/observability/metrics.ts`
- [x] Alert system — `src/lib/observability/alerts.ts`
- [x] Service instrumentation — `src/lib/observability/instrumentation.ts`
- [x] App initialization hook — `src/lib/observability/useObservability.ts`
- [x] Declarative config — `src/lib/observability/config.ts`
- [x] Dashboard page — `pages/Observability.tsx`
- [x] 14 alert rules (global + domain-specific)
- [x] Webhook notification support

### 3.6 Performance ✅
- [x] Performance baseline documented — `docs/PERFORMANCE_BASELINE.md`
- [x] N+1 audit — 15 findings (1 critical, 3 high, 7 medium, 3 low)
- [x] Fix Admin.tsx N+1 — bulk fetch staff counts + revenue (was 3N queries)
- [x] Fix Checkout credit deduction N+1 — Promise.allSettled (was sequential RPCs)
- [x] Fix OnboardingChecklist — 4 sequential → Promise.all
- [x] Fix loadSubscriptionWithDetails — sequential → parallel plan + credits
- [x] Fix Receipts.tsx — 2 sequential queries → 1 combined query with .or()
- [x] Index migration — 7 new indexes (P0: comandas×2, P1: comandas+plans+subscriptions, P2: products+promotions)
- [x] select('*') cleanup — comanda (13 cols), commission (14+12+8 cols), chefClub (9+11+8+7 cols)
- [x] Dashboard query consolidation — 15 → 10+1 queries
- [x] Bundle analysis — jsPDF extracted to vendor-pdf chunk (CashClosingPage 504→82 kB)
- [x] React memoization — Comandas (15 useMemo), Schedule (8 useMemo), Checkout (8 useMemo)
- [x] Performance report — `docs/PERFORMANCE_REPORT.md`

---

## ✅ Fase 3 — Quality Engineering (CONCLUÍDA)

Todas as sub-fases foram concluídas:
- 3.1 Domain Tests ✅
- 3.2 Application Tests ✅
- 3.3 Security Audit ✅
- 3.4 E2E Testing ✅
- 3.5 Observability ✅
- 3.6 Performance ✅

**Indicadores finais**: 484 testes automatizados, build limpo, observabilidade completa, segurança auditada, performance otimizada.

---

## Fase 4 — Event Driven

**Status:** 🔄 Em andamento.

### 4.1 Event Bus ✅
- `domain/events/` — Tipos, bus interface, InMemoryEventBus, singleton appEventBus
- 18 testes (publish/subscribe, unsubscribe, error handling, event log, handler count/clear, factory)

### 4.2 System Events ✅
- Eventos publicados em: Checkout, Appointment (create/cancel), CashClosing, ChefClub (subscription, credits)
- Tipos: 11 eventos de domínio (CheckoutCompleted/Reverted, AppointmentCreated/Cancelled/Completed, CashClosingCompleted, SubscriptionCreated/Cancelled, CreditsDeducted, TransactionCreated, CommissionCalculated)

### 4.3 Event Store ✅
- Separacao payload/metadata com EventMetadata (tenantId, userId, correlationId, causationId, version, source)
- Versionamento desde o primeiro dia (version=1)
- EventStoreRepository interface: append, appendBatch, findByAggregate, findByCorrelation, findByType, findByTenant, findById, count, replay (Not Implemented)
- InMemoryEventStore com testes completos
- Migration: event_store table com RLS, 6 indexes, append-only (no UPDATE/DELETE)
- 21 novos testes de Event Store (425 total)

### 4.4 Subscribers ✅
- DomainSubscriber interface: name, description, eventType, handle(event)
- SubscriberRegistry: register, unregister, initialize, deactivate, clear, count, names, has
- AuditSubscriber com subscribeAll (recebe todos os eventos)
- 6 subscribers read-only: Analytics, Audit, Notification, Reminder, Marketing, BI
- Error isolation: erros em subscribers nao propagam para o event bus
- 20 novos testes (445 total)

### 4.5 Outbox Pattern ✅
- `domain/events/outbox/` — OutboxRepository, Dispatcher, DispatcherProvider interfaces
- Status lifecycle: `pending → processing → published/failed → pending (retry) → dead_letter`
- Retry com exponential backoff (baseDelayMs × 2^attempts)
- 3 providers: Console, Webhook, Slack
- InMemoryOutbox + InMemoryDispatcher com testes completos
- 39 novos testes (484 total)

### 4.6 Financial Subscribers ✅
- `CommissionSubscriber` — Group A (baixo risco): escuta `CheckoutCompleted`, calcula comissão teórica, publica `CommissionCalculated`
- `FinanceSubscriber` — Group B: escuta 4 eventos, enfileira operações financeiras no Outbox
  - `CheckoutCompleted` → create_transaction, create_commission_record
  - `SubscriptionCancelled` → reverse_revenue
  - `CreditsDeducted` → deduct_credits
  - `CashClosingCompleted` → close_daily_cash
- `FinanceProvider` — DispatcherProvider que executa operações financeiras do Outbox
  - 6 tipos de operação: create_transaction, create_receivable, create_commission_record, reverse_revenue, deduct_credits, close_daily_cash
  - `PersistentIdempotencyStore` — tabela `processed_operations` com UNIQUE em `(tenant_id, idempotency_key)`
  - `InMemoryIdempotencyStore` para testes
  - OperationHandler interface injetável — cada tipo de operação tem seu handler
- Interfaces injetáveis: `CommissionCalculator`, `FinanceStrategy`, `OperationHandler`
- Migration: `20260723110000_processed_operations.sql` — RLS, 4 indexes, append-only
- 63 novos testes (559 total)

### 4.7 Replay Engine ✅

**Objetivo:** Replay de eventos para reconstrução de estado e migrações.

- `domain/events/replayEngine.ts` — `createReplayEngine({ eventStore, eventBus })`
- `ReplayOptions`: eventType, aggregateType, aggregateId, correlationId, tenantId, from, to, dryRun, batchSize, continueOnError, onProgress
- `ReplayReport`: total, replayed, skipped, failed, durationMs, throughput, errors[]
- `ReplayResult`: status (completed | partial | dry_run | no_events), report, events
- Dry-run mode: simulates replay sem publicar eventos
- Batch processing com progress callback para replays longos
- Error isolation: `continueOnError` controla se falhas param o replay
- Sorting: eventos ordenados por occurredAt ASC
- Filtering: suporta filtros combinados (eventType + tenantId + time range)
- 31 novos testes (590 total)

### 4.8 Versionamento (futuro)

**Objetivo:** Upcasters e política formal de compatibilidade retroativa.

```typescript
interface EventUpcaster {
  fromVersion: number;
  toVersion: number;
  canHandle(event: DomainEvent): boolean;
  upcast(event: DomainEvent): DomainEvent;
}

UpcasterRegistry — registry de upcasters por tipo de evento
```

### 4.9 Chaos Testing (futuro)

**Objetivo:** Validar resiliência da infraestrutura de eventos com cenários reais de falha.

- Webhook timeout (30s)
- Webhook retorna 500
- RPC falha
- Timeout Supabase
- Retry infinito
- Evento duplicado
- Evento fora de ordem
- Replay interrompido
- Subscriber lança exception

---

## Referências

- `docs/adr/` — Architecture Decision Records
- `AGENTS.md` — Instruções para sessões de código
