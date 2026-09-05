# SMG Platform — Roadmap Oficial

> Documento de referência oficial para evolução da SMG Platform até maturidade comercial.
>
> **⚠ ROADMAP CONGELADO** — Nenhuma nova fase poderá ser criada. Nenhuma fase poderá ser reorganizada.
> Somente evoluções documentadas por ADR são permitidas a partir deste ponto.
>
> **Diretriz Oficial:** Ver seção "Diretriz Oficial" abaixo.
>
> **Última atualização:** 2026-09-02

---

## Diretriz Oficial

A arquitetura técnica da plataforma encontra-se **estabilizada**.

O objetivo agora **NÃO** é mais criar arquitetura.

O objetivo é transformar a SMG Platform em uma plataforma SaaS pronta para produção, escalável, organizada e preparada para crescimento.

A prioridade deixa de ser apenas código. A prioridade passa a ser:

- Arquitetura de produto
- Arquitetura operacional
- Governança
- Escalabilidade
- Preparação para produção

Toda alteração estrutural deverá ser **extremamente conservadora**.

Qualquer mudança arquitetural deverá ser justificada através de ADR.

**Sem ADR, nenhuma mudança estrutural poderá ser feita.**

### Papel da IA

A IA deixa de atuar apenas como desenvolvedor/tech lead.

Passe a atuar como:

- **Software Architect**
- **Product Architect**
- **Platform Architect**
- **Tech Lead**
- **Staff Engineer**
- **Analista de Negócios**

O papel é **impedir** decisões que prejudiquem a escalabilidade futura da plataforma.

Sempre que identificar:

- Duplicação
- Inconsistências
- Nomenclatura incorreta
- Arquitetura inadequada
- Fluxo confuso
- Documentação divergente

Deve **interromper a execução** e apresentar uma proposta **antes** de escrever código.

### Regra de Entrada

Antes de iniciar qualquer nova fase, executar:

1. **Auditoria documental** — Verificar inconsistências na documentação
2. **Auditoria arquitetural** — Verificar conformidade com a arquitetura congelada
3. **Auditoria de nomenclatura** — Verificar termos oficiais conforme `docs/TAXONOMY.md`
4. **Auditoria de consistência** — Verificar coerência entre código, testes e documentação

Somente depois iniciar implementações.

---

## Visão Geral

```
FASE 0 — Foundation
✅ Concluída

↓

FASE 1 — Hardening
✅ Concluída

↓

FASE 2 — Repository + Application Services
❄️ FROZEN

↓

FASE 3 — Quality Engineering
✅ Concluída

↓

FASE 4 — Event Driven
✅ Concluída (Certificada)

↓

FASE 5 — Business Architecture
✅ Concluída

↓

FASE 5.5 — SaaS Core Architecture
✅ Concluída

↓

FASE 5.6 — Platform Certification
✅ Concluída (com ressalvas documentadas)

↓

FASE 6 — Production Readiness
⬜ Não iniciada

↓

FASE 7 — Product Maturity
⬜ Não iniciada

↓

FASE 8 — Commercial Scalability
⬜ Não iniciada (White Label CANCELADO)
```

---

## Decisões Estratégicas (2026-07-24)

### D1 — Multi-Tenant é a Prioridade

**Decisão:** White Label NÃO faz parte do roadmap atual. Não iniciar novos SaaS.

**Foco absoluto:** Construir a melhor arquitetura Multi-Tenant possível.

Toda decisão futura deve considerar:
- Isolamento de tenants
- Onboarding
- Billing
- Permissões
- Segurança
- Escalabilidade
- Documentação

### D2 — Glossário Oficial

Existe uma ambiguidade na documentação. Criar documento oficial: `docs/TAXONOMY.md`

Esse documento passa a ser a fonte oficial de nomenclatura do projeto.

**Produto comercial ativo:**
- SMG Barber

**Evolução da plataforma:**
- A SMG Platform foi concebida para suportar múltiplos produtos SaaS
- Novos segmentos poderão ser desenvolvidos futuramente, mediante decisão formal do Product Owner
- Nenhuma definição de produto, domínio, módulo ou funcionalidade para futuros segmentos deve ser documentada, implementada ou planejada antes dessa decisão

**Módulos:**
- Club dos Chefes é um módulo do SMG Barber (não é um SaaS)

**Nunca utilizar apenas:** `Club`
**Sempre utilizar:** `Club dos Chefes`

### D3 — Estrutura de Domínios

```
soumanager.com
├── barber.soumanager.com        ← SMG Barber (ÚNICO DOMÍNIO ATIVO)
├── admin.soumanager.com         ← Administração
├── docs.soumanager.com          ← Documentação
└── status.soumanager.com        ← Status page
```

> **Nota:** Domínios para futuros produtos serão definidos quando houver decisão oficial do Product Owner.

**IMPORTANTE:** Não utilizar `app.soumanager.com` como domínio principal. Cada produto possui seu próprio subdomínio.

### D4 — Tenants

Cada cliente pertence ao produto.

Exemplo futuro: `sanchez.barber.soumanager.com`

Porém isso é apenas uma referência arquitetural. NÃO implementar agora. Primeiro consolidar o multi-tenant.

### D5 — Ambientes

A arquitetura oficial passa a possuir 5 ambientes:

```
Development → Preview → Demo → Staging → Production
```

| Ambiente | Descrição |
|----------|-----------|
| Development | Desenvolvimento local |
| Preview | Cada PR gera um preview |
| Demo | Demo pública para prospects |
| Staging | Validação antes de produção |
| Production | Clientes reais |

### D6 — Business Architecture

Antes da Production Readiness deverá existir uma nova etapa documental.

**Fase:** Business Architecture (Fase 5)

**Objetivo:** Documentar completamente o negócio.

**Escopo:**
- Catálogo oficial de produtos
- Catálogo oficial de módulos
- Taxonomia
- Onboarding
- Fluxo de criação de tenant
- Fluxo de assinatura
- Papéis
- Permissões
- Planos comerciais (estrutura, não preços)
- Ciclo de vida do tenant

**Nenhuma implementação. Somente documentação.**

### D7 — Responsabilidades

| Responsável | Escopo |
|-------------|--------|
| **OpenCode** | Arquitetura, código, testes, documentação técnica, ADRs, CI/CD, automações, validações |
| **Augusto (PO)** | Produtos, módulos, nomenclaturas, planos comerciais, onboarding, estratégia, domínios, infraestrutura, deploy, fornecedores, políticas, LGPD |

**Regra:** Itens comerciais nunca devem ser decididos automaticamente pelo OpenCode.

### D8 — Nova Forma de Execução

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

### D9 — Roadmap Congelado

Nenhuma nova fase poderá ser criada. Nenhuma fase poderá ser reorganizada. Somente evoluções documentadas por ADR.

---

## Fase 0 — Foundation ✅

**Objetivo:** Documentar permanentemente a base do projeto para onboarding técnico e preservação de decisões arquiteturais.

**Status:** ✅ Concluída.

### 0.1 Visão do Produto

- [x] Visão geral do SMG como SaaS multi-tenant
- [x] Definição de público-alvo (barbearias, estética, clube)
- [x] Proposta de valor
- [x] Diferenciais competitivos

### 0.2 Architecture Decision Records (ADRs)

- [x] ADR-001: Commission vs Settlement
- [x] Documentação consolidada em `docs/ARCHITECTURE_DECISIONS.md`

### 0.3 Convenções

- [x] Convenções de teste (`tests/README.md`)
- [x] Padrão AAA (Arrange/Act/Assert)
- [x] Nomenclatura `should_<resultado>_when_<condição>`
- [x] Builders e factories para dados de teste
- [x] Regras de mock (nunca mockar funções puras do domain)

### 0.4 Estrutura do Projeto

- [x] Dual directory structure documentada
- [x] Path aliases (`@/` mapeia para raiz)
- [x] Barrel exports
- [x] Co-localização de testes com código testado

### 0.5 Arquitetura

- [x] Pages → Application Services → Domain → Repositories
- [x] Repository Pattern com DI (DatabaseClient)
- [x] Domain Driven Design (domains verticais)
- [x] Shared Kernel (format, numbers, status)
- [x] Multi-tenant com RLS
- [x] Multi-app com schema routing

### 0.6 Stack

- [x] React 19 + Vite 6 + TypeScript 5.8 + Tailwind CSS v4
- [x] react-router-dom com HashRouter
- [x] State: Pure React Context (sem Redux/Zustand)
- [x] Backend: Supabase (PostgreSQL + Auth + Realtime)
- [x] AI: Google Gemini
- [x] Testes: Vitest + Playwright
- [x] Deploy: Vercel

### 0.7 Guidelines

- [x] Frozen Architecture (Fase 2 congelada)
- [x] ADR obrigatório para mudanças estruturais
- [x] Segurança: RLS, idempotência, tenant isolation
- [x] Performance: baseline documentado, N+1 audit
- [x] Observabilidade: logging estruturado, métricas, alertas
- [ ] **CI Migration Validation:** toda nova migration deve ser validada em banco vazio durante CI

---

## Fase 1 — Hardening ✅

**Objetivo:** Estabelecer base sólida de arquitetura e código.

**Status:** ✅ Concluída.

- Separação em camadas (Pages → Application Services → Domain → Repositories)
- Repository Pattern com DI (DatabaseClient)
- Domain Layer (commission, comanda, shared, chefClub)
- Shared Kernel (format, numbers, status)
- ADR-001: Commission vs Settlement
- Vitest configurado

---

## Fase 2 — Repository + Application Services ❄️ FROZEN

**Objetivo:** Consolidar Application Services e padrões de domínio.

**Status:** ❄️ Congelada. Nenhuma refatoração estrutural aceita sem ADR.

### Regras

- Não são aceitas novas refatorações estruturais
- Apenas correções de bugs e melhorias de performance
- Evolução de funcionalidades segue os padrões existentes
- Toda mudança estrutural deve ser registrada via ADR

### Entregas

- [x] Repository Pattern com DI (DatabaseClient)
- [x] Domain Layer (commission, comanda, shared, chefClub)
- [x] Application Services (checkout, appointment, commission, cashClosing, chefClub)
- [x] Shared Kernel (format, numbers, status)
- [x] ADR-001: Commission vs Settlement
- [x] Vitest configurado

---

## Fase 3 — Quality Engineering ✅

**Objetivo:** Construir confiabilidade through testes, segurança e observabilidade.

**Status:** ✅ Concluída. 631 testes automatizados, build limpo, observabilidade completa, segurança auditada, performance otimizada.

### 3.1 Domain Tests ✅

- [x] Domain Commission — 62 tests (calculate, participants, format)
- [x] Domain ChefClub — 73 tests (credits, cycle, validation)
- [x] Domain CashClosing — 33 tests (summary, cashCloseUtils pure functions)

### 3.2 Application Services Tests ✅

- [x] SERVICE_TEST_MATRIX.md — scenario checklist created
- [x] Test infrastructure: builders, factories, helpers (`tests/builders/`, `tests/factories/`, `tests/helpers/`)
- [x] Checkout scenarios: `tests/scenarios/checkout.scenario.ts`
- [x] Checkout — 45 tests (Groups A-E)
- [x] CashClosing — 38 tests (Groups A-D)
- [x] Appointment — 51 tests (Groups A-D)
- [x] Commission — 30 tests (Groups A-E)
- [x] ChefClub — 54 tests (Groups A-F)

### 3.3 Security Audit ✅

- [x] RLS policies audit — `docs/security/SECURITY_AUDIT_RLS.md` (47 tables inventoried)
- [x] RPC security review — `docs/security/SECURITY_AUDIT_RPC.md` (20+ RPCs audited)
- [x] RLS critical fixes migration — `20260723000000_security_fix_rls_critical.sql`
- [x] Idempotency validation — Well-implemented across all critical operations
- [x] Race condition analysis — Documented with `FOR UPDATE` recommendations
- [x] Multi-tenant isolation verification — Core paths verified secure

### 3.4 E2E Testing ✅

- [x] Playwright setup — `playwright.config.ts` + npm scripts
- [x] Test infrastructure — `tests/e2e/` (pages, fixtures, data, helpers)
- [x] Page Objects — 7 pages
- [x] Auth fixtures — Demo mode login
- [x] P0 Flows — 5 critical flows (10 tests)
- [x] P1 Admin CRUD — 6 tests
- [x] Smoke suite — 10 tests (tagged @smoke)
- [x] **26/26 tests passing, ~30s suite time**

### 3.5 Observability ✅

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
- [x] N+1 audit — 15 findings
- [x] Critical N+1 fixes (Admin, Checkout, Onboarding, Receipts)
- [x] Index migration — 7 new indexes
- [x] select('*') cleanup
- [x] Dashboard query consolidation
- [x] Bundle analysis — jsPDF extracted to vendor-pdf chunk
- [x] React memoization
- [x] Performance report — `docs/PERFORMANCE_REPORT.md`

---

## Fase 4 — Event Driven ✅

**Objetivo:** Construir infraestrutura de eventos completa, testada e pronta para produção.

**Status:** ✅ Concluída e Certificada. Arquitetura declarada ESTÁVEL.

**Testes:** 631 testes (22 arquivos) + E2E

**Certificação:** 4.10 — Todos os 12 itens aprovados. Marco de aceite completo.

### 4.1 Event Bus ✅

- [x] `domain/events/` — Tipos, bus interface, InMemoryEventBus, singleton appEventBus
- [x] 18 testes (publish/subscribe, unsubscribe, error handling, event log, handler count/clear, factory)

### 4.2 Event Publishing ✅

- [x] Eventos publicados em: Checkout, Appointment (create/cancel), CashClosing, ChefClub (subscription, credits)
- [x] 11 tipos de eventos de domínio
- [x] 5 serviços publicando eventos (7 call sites)

### 4.3 Event Store ✅

- [x] Separação payload/metadata com EventMetadata
- [x] Versionamento desde o primeiro dia (version=1)
- [x] EventStoreRepository interface completa
- [x] InMemoryEventStore com testes completos
- [x] Migration: event_store table com RLS, 6 indexes, append-only
- [x] 21 testes

### 4.4 Subscribers ✅

- [x] DomainSubscriber interface
- [x] SubscriberRegistry completo
- [x] 6 subscribers read-only: Analytics, Audit, Notification, Reminder, Marketing, BI
- [x] Error isolation: erros não propagam para o event bus
- [x] 20 testes

### 4.5 Outbox Pattern ✅

- [x] `domain/events/outbox/` — OutboxRepository, Dispatcher, DispatcherProvider
- [x] Status lifecycle: pending → processing → published/failed → pending (retry) → dead_letter
- [x] Retry com exponential backoff
- [x] 4 providers: Console, Webhook, Slack, Finance
- [x] InMemoryOutbox + InMemoryDispatcher
- [x] 39 testes

### 4.6 Financial Subscribers ✅

- [x] `CommissionSubscriber` — Group A (baixo risco, somente leitura)
- [x] `FinanceSubscriber` — Group B (escreve via Outbox)
- [x] `FinanceProvider` — DispatcherProvider com 6 tipos de operação
- [x] `PersistentIdempotencyStore` — tabela `processed_operations`
- [x] 63 testes

#### 4.6.1 Finance Provider ✅

- [x] DispatcherProvider que executa operações financeiras do Outbox
- [x] 6 tipos: create_transaction, create_receivable, create_commission_record, reverse_revenue, deduct_credits, close_daily_cash
- [x] OperationHandler interface injetável

#### 4.6.2 Persistent Idempotency ✅

- [x] `processed_operations` table com UNIQUE em `(tenant_id, idempotency_key)`
- [x] RLS habilitado, append-only
- [x] Migration: `20260723110000_processed_operations.sql`
- [x] 12 testes

### 4.7 Replay Engine ✅

- [x] `createReplayEngine({ eventStore, eventBus })`
- [x] ReplayOptions: 10 filtros (eventType, aggregateType, aggregateId, correlationId, tenantId, from, to, dryRun, batchSize, continueOnError, onProgress)
- [x] ReplayReport e ReplayResult
- [x] Dry-run mode
- [x] Batch processing com progress callback
- [x] Error isolation
- [x] 31 testes

#### 4.7.1 Migration Consistency Audit ✅

**Objetivo:** Garantir consistência total entre o schema do banco, as migrações e o código da aplicação.

**Status:** ✅ Concluída em 24/07/2026.

**Resultados:**

| Métrica | Valor |
|---------|-------|
| Migrations timestamped | 89 |
| Arquivos vazio | 1 (`20260421002405`) |
| Quebradas | 0 |
| Issues críticos | 0 |
| Issues médios | 4 |
| Issues baixos | 4 |
| READY FOR DEPLOY | ✅ YES |

**Issues Encontrados:**

| Severidade | Qtd | Descrição |
|------------|-----|-----------|
| 🔴 Crítico | 0 | Nenhum |
| 🟡 Médio | 4 | RLS policy churn, função legada, função redefinida, arquivo vazio |
| 🟢 Baixo | 4 | service_credit_map duplicado, índices duplicados, colunas duplicadas, notifications 3x |
| ℹ️ Info | 3 | pgcrypto OK, Outbox sem migration, Gen 4 RLS completa |

**Manifest:**
> `supabase/migrations/MANIFEST.md` — Inventário oficial de todas as 89 migrations com classificação, breaking change, rollback e dependências.

#### 4.7.2 Schema Consistency Audit ✅

**Objetivo:** Validar consistência entre banco de dados, código, testes e documentação — identificando código morto, campos órfãs, funções abandonadas e inconsistências.

**Status:** ✅ Concluída em 24/07/2026.

**Resultados:**

| Métrica | Valor |
|---------|-------|
| Issues críticos | 22 |
| Issues médios | 41 |
| Issues baixos | 16 |
| Referências inválidas | 1 (`tenants.plan`) |
| Fluxos quebrados | 0 |
| Código morto identificado | ~50+ exports (~38%) |
| Application Services com import direto Supabase | 11 arquivos |

**Relatório completo:** `docs/SCHEMA_CONSISTENCY_AUDIT.md`

**Verdict:** Banco de dados **sólido e consistente**. Problema central é a camada Application Services que contorna o Repository Pattern. Não impede deploy mas limita testabilidade.

#### 4.7.3 Resolve `tenants.plan` ✅

**Objetivo:** Resolver o issue crítico identificado na auditoria 4.7.2 — `Admin.tsx` atualiza coluna `tenants.plan` que não existe.

**Status:** ✅ Concluída em 24/07/2026.

**Resultado:** Migration `20260724000000_add_plan_to_tenants.sql` criada. Coluna `plan` adicionada com CHECK constraint (`free`, `pro`, `elite`). `TenantRecord` atualizado.

> **Alinhamento 6.0.5:** este CHECK foi **substituído** pela migration `20260806020000` — o CHECK atual é `('free', 'pro', 'premium')`. "Elite" é obsoleto.

#### 4.7.4 Infrastructure Decoupling ✅

**Objetivo:** Toda comunicação com Supabase fica exclusivamente na camada Infrastructure (Repositories). Nenhum Application Service poderá conhecer `supabase.from()`, `supabase.rpc()`, `supabase.storage` ou imports do cliente Supabase.

**Status:** ✅ Concluída. 53 `.from()` eliminados, 11 imports Supabase removidos. RPCs residuais usam `createSupabaseClient` do domain factory (padrão aceitável).

**Arquitetura alvo:**

```
React/UI → Hooks → Application Services → Repositories → Supabase
```

#### 4.7.5 Repository Standardization ⬜

**Objetivo:** Padronizar a interface e comportamento de todos os Repositories do projeto.

**Status:** ⬜ Pendente.

#### 4.7.6 Codebase Hygiene ✅

**Objetivo:** Higiene completa da codebase — dead code, dependências, análise estática e validação arquitetural.

**Status:** ✅ Concluída.

- [x] Dead code removido (7 arquivos + 8 barrels)
- [x] 631 testes passando
- [x] Build limpo
- [x] Nenhuma regressão

#### 4.7.7 Architecture Verification ✅

**Objetivo:** Criar guardrails automáticos que previnem regressões arquiteturais.

**Status:** ✅ Concluída.

- [x] `npm run architecture:check` — executa todos os guards
- [x] `npm run architecture:ci` — modo CI (fail no erro)

**Baseline:**
```json
{
  "repositoryViolations": 233,
  "forbiddenImports": 0,
  "circularImports": 0
}
```

#### 4.7.8 Architecture Freeze ✅

**Objetivo:** Congelar a arquitetura v3.0 com ADRs, convenções documentadas e baseline de guardrails.

**Status:** ✅ Concluída.

**ADRs criados:**

| ADR | Título |
|-----|--------|
| ADR-001 | Layered Architecture |
| ADR-002 | Repository Pattern |
| ADR-003 | Multi-Tenant Isolation |
| ADR-004 | Application Services |
| ADR-005 | RPC Strategy |
| ADR-006 | Event Bus |
| ADR-007 | Outbox Pattern |
| ADR-008 | Audit Strategy |
| ADR-009 | Repository Naming Conventions |
| ADR-010 | Architecture Guards |

### 4.8 Event Versioning (Upcasters) ✅

**Objetivo:** Implementar upcasters e política formal de compatibilidade retroativa.

**Status:** ✅ Concluída (4.8.1 ✅, 4.8.2 ✅, 4.8.3 ✅).

#### 4.8.1 Event Versioning Design ✅

- [x] Documento completo (`docs/design/4.8.1-event-versioning-design.md`)
- [x] Event Envelope spec
- [x] Event Metadata spec
- [x] Upcaster interface + UpcasterRegistry + chaining
- [x] Replay com upcasting
- [x] Migration strategy

#### 4.8.2 Event Versioning Infrastructure ✅

- [x] `domain/events/envelope.ts` — EventEnvelope
- [x] `domain/events/registry.ts` — EventRegistry
- [x] `domain/events/serializer.ts` — EventSerializer
- [x] `domain/events/upcaster.ts` — EventUpcaster + UpcasterRegistry
- [x] 23 testes

#### 4.8.3 Event Versioning Migration ✅

- [x] Migration: `20260724190000_add_event_versioning_columns.sql`
- [x] Todos os eventos publicados com `eventTypeVersion`
- [x] Todos os publishers atualizados

### 4.9 Chaos Testing ✅

**Objetivo:** Validar resiliência da infraestrutura de eventos com cenários reais de falha.

**Status:** ✅ Concluída. 17 testes (14 cenários + 3 cross-cutting).

### 4.10 Event Driven Certification ✅

**Objetivo:** Certificar que toda a arquitetura Event Driven está pronta para produção.

**Status:** ✅ Concluída. 12/12 checklist aprovados. 9/9 Marco de Aceite aprovado.

### Architecture Freeze Gate 🧊

**Após conclusão da Fase 4.10**, a arquitetura foi declarada **ESTÁVEL**.

**Regras a partir deste ponto:**

| Regra | Descrição |
|-------|-----------|
| **ADR obrigatório** | Toda mudança estrutural significativa deve ser justificada via ADR |
| **Justificativa de negócio** | Mudanças arquiteturais requerem justificativa clara de negócio |
| **Proporção de esforço** | 30% Engenharia / 70% Produto |
| **Foco no produto** | UX, fluxos, onboarding, documentação, experiência do usuário |
| **Estabilidade preservada** | Consistência conquistada deve ser mantida |

**Padrões NÃO necessários para o estágio atual:**

| Padrão | Por quê não |
|--------|-------------|
| CQRS completo | Duplicação desnecessária de model |
| Event Sourcing completo | Complexidade sem benefício proporcional |
| Saga Orchestrator | Fluxos atuais são lineares |
| Microservices | Monolito modular já resolve |
| Kafka | Supabase Realtime + Outbox já resolve |
| Mensageria distribuída | Complexidade prematura |

> **Recomendação:** A partir daqui, investir mais no produto do que na arquitetura.

---

## Fase 5 — Business Architecture ✅

**Objetivo:** Documentar completamente o negócio antes de implementar produção.

**Status:** ✅ Concluída.

**Tipo:** Documentação (nenhuma implementação).

**Critérios de Entrada:**
- Fase 4 certificada
- Product Owner disponível para definições

**Critérios de Saída:**
- Todos os 10 itens documentados abaixo
- Documentação aprovada pelo Product Owner
- Nenhuma divergência entre documentação e código

**Escopo:**

### 5.1 Catálogo de Produtos

- [ ] SMG Barber — descrição, público-alvo, diferenciais
- [ ] Regras de nomenclatura (conforme `docs/TAXONOMY.md`)
- [ ] Evolução da plataforma (visão genérica, sem nomes de futuros produtos)

### 5.2 Catálogo de Módulos

- [ ] Club dos Chefes — descrição, regras, ciclo de vida
- [ ] Módulos futuros planejados
- [ ] Relação módulo ↔ produto

### 5.3 Taxonomia

- [ ] Termos oficiais do negócio
- [ ] Glossário consolidado
- [ ] Referência: `docs/TAXONOMY.md`

### 5.4 Onboarding

- [ ] Fluxo de criação de tenant
- [ ] Dados necessários para cadastro
- [ ] Validação de dados
- [ ] Tempo esperado de onboarding

### 5.5 Fluxo de Criação de Tenant

- [ ] Passo a passo completo
- [ ] Validações em cada etapa
- [ ] Criação automática de dados iniciais
- [ ] Convite de profissionais

### 5.6 Fluxo de Assinatura

- [ ] Planos disponíveis
- [ ] Ciclo de cobrança
- [ ] Upgrade/downgrade
- [ ] Cancelamento
- [ ] Período de trial

### 5.7 Papéis e Permissões

- [ ] Papéis do sistema (admin, manager, barber, receptionist, cashier)
- [ ] Permissões por papel
- [ ] Customização de permissões
- [ ] Herança de permissões

### 5.8 Planos Comerciais

- [ ] Estrutura de planos (não preços)
- [ ] Funcionalidades por plano
- [ ] Limites por plano
- [ ] Roadmap de planos

### 5.9 Ciclo de Vida do Tenant

- [ ] Criação → Ativação → Uso → Pagamento → Renovação
- [ ] Estados do tenant (active, suspended, cancelled)
- [ ] Migração entre estados
- [ ] Reativação

### 5.10 Estratégia de Domínios

- [ ] Estrutura de subdomínios
- [ ] Resolução de domínio
- [ ] SSL/TLS
- [ ] Redirects

**Entregáveis:**
- `docs/BUSINESS_ARCHITECTURE.md` — documento consolidado
- Atualização de `docs/TAXONOMY.md` se necessário

**Riscos:**
- Depende de decisão do Product Owner
- Pode revelar gaps no modelo de negócio

**Responsável:** Augusto (Product Owner) + OpenCode (formatação)

**Próxima Etapa:** Fase 5.5 — Tenant & Billing Architecture

---

## Fase 5.5 — SaaS Core Architecture ✅

**Objetivo:** Definir como a plataforma SaaS funciona para os próximos anos — nascimento de clientes, ciclo de vida, billing, feature flags, provisionamento, catálogo oficial, roles e módulos.

**Status:** ✅ Concluída. Todas as decisões do PO incorporadas.

**Tipo:** Documentação + Design (nenhuma implementação de código).

**Por que esta fase existe:**
> A Fase 5 documenta o **negócio** (produtos, módulos, taxonomia). A Fase 5.5 documenta **como a plataforma funciona** — os mecanismos que permitem novos clientes entrarem, serem gerenciados, evoluírem de plano, receberem suporte e escalarem a operação. Sem essa definição, a Fase 6 (Production Readiness) nasce sem fundamento.

**Critérios de Entrada:**
- Fase 5 (Business Architecture) concluída
- Definições de produto e módulos consolidadas

**Critérios de Saída:**
- Todos os 9 blocos documentados abaixo
- Documentação aprovada pelo Product Owner
- Nenhuma divergência entre documentação e código
- Matrizes de consistência validadas

**Escopo:**

### 5.5.1 Customer Onboarding (Como Nasce um Cliente)

Quando alguém compra o SMG Barber — o que acontece?

- [x] Fluxo completo de signup → primeiro acesso (8 etapas) ✅ PO
- [x] Nenhum dado operacional criado automaticamente ✅ PO
- [ ] Criação de tenant (validação de dados, slug, configurações)
- [ ] Criação de usuário admin do tenant
- [ ] Criação de vínculo user → tenant (user_tenants)
- [ ] Criação de staff inicial (admin/owner)
- [ ] Configurações iniciais do salão (horários, endereço, telefone)
- [ ] Permissões iniciais do admin
- [ ] Onboarding guiado (checklist pós-login)
- [ ] Critérios de "onboarding completo" (quando o tenant está pronto para uso)

### 5.5.2 Tenant Lifecycle (Como Funciona um Tenant)

- [x] Definição dos estados: `draft` → `trial` → `active` → `past_due` → `suspended` → `cancelled` → `archived` ✅ PO
- [ ] Transições de estado (eventos que causam cada transição)
- [ ] Duração de cada estado (trial: ? dias, grace period: ? dias)
- [ ] O que acontece com os dados em cada transição
- [ ] Schema de banco para estados do tenant (não apenas `active: boolean`)
- [ ] Impacto de cada estado no acesso do usuário
- [ ] Notificações em cada transição (email, in-app)
- [ ] Reativação (após cancelamento)
- [ ] Política de retenção de dados (arquivamento vs exclusão)

### 5.5.3 Billing Architecture (Como Funciona o Billing)

- [x] Modelo de cobrança: recorrência mensal, gateway desacoplado ✅ PO
- [ ] Gateway de pagamento (escolha futura)
- [ ] Meios de pagamento aceitos (expansão futura)
- [ ] Grace period após vencimento
- [ ] Suspensão por inadimplência
- [ ] Notificações de pagamento (lembrete, vencimento, atraso)
- [ ] Notas fiscais (NFe — integração)
- [ ] Relatórios financeiros para o tenant
- [ ] Relatórios financeiros para a plataforma
- [ ] Reembolso (política e processo)
- [ ] **Nota:** Implementação virá depois; a arquitetura nasce agora

### 5.5.4 Feature Flags (Como o Código Sabe o Que Abrir)

- [x] Sistema de feature flags (feature → plano)
- [x] Definição do catálogo completo de features (Free, Pro, Elite)
- [x] Limites configuráveis por plano (sem valores fixos na documentação) ✅ PO
- [ ] Verificação de acesso em runtime (hook, middleware, component)
- [ ] Bloqueio de funcionalidades por plano
- [ ] Upgrade prompt quando funcionalidade é bloqueada
- [ ] Auditoria de uso de funcionalidades
- [ ] Feature flags por módulo (módulo habilitado/desabilitado por plano)
- [ ] Feature flags por tenant (override manual para clientes especiais)

> **Alinhamento 6.0.5 (Subfase 0):** a matriz abaixo usava os nomes comerciais **Free/Pro/Elite**. Os planos oficiais são `free`/`pro`/`premium` (Elite **obsoleto** — CHECK `('free','pro','premium')` na migration `20260806020000`). O catálogo de flags e a matriz atualizados vivem em `docs/FEATURE_FLAGS_MODEL.md` (§3/§5). O único limite numérico implementado é `max_staff` (free=1/pro=5/premium=∞). "Verificação em runtime / bloqueio / upgrade prompt / flags por módulo/tenant" = **6.0.5.3** (modelo ADR-013 §3.1).

**Exemplo de mapeamento (referência conceitual — Fase 5.5):**

| Feature | free | pro | premium |
|---------|:----:|:---:|:-------:|
| Agendamento básico | ✅ | ✅ | ✅ |
| Club dos Chefes | ❌ | ✅ | ✅ |
| Relatórios avançados | ❌ | ❌ | ✅ |
| Multi-profissional | ≤1 | ≤5 | ∞ |
| Dashboard BI | ❌ | ❌ | ✅ |
| Agenda Online | ❌ | ✅ | ✅ |
| API pública | ❌ | ❌ | ✅ |

### 5.5.5 Provisionamento (Como a Criação Acontece)

- [x] Fluxo de onboarding: 8 etapas, sem dados operacionais automáticos ✅ PO
- [ ] Quem cria tudo? (Edge Function, RPC, Worker, Fila, Webhook)
- [ ] Transacionalidade (tudo ou nada? rollback?)
- [ ] Idempotência (o que acontece se criar duas vezes?)
- [ ] Dados iniciais obrigatórios vs opcionais
- [ ] Templates de provisionamento por plano
- [ ] Provisionamento via UI (onboarding)
- [ ] Provisionamento via API (futuro — para integrações)
- [ ] Provisionamento em lote (para revendedores)

### 5.5.6 Official Catalog (Catálogo Oficial)

Estrutura hierárquica completa:

```
SMG Platform
│
├── Produto Comercial Ativo
│     └── SMG Barber
│         ├── Módulos
│         │   ├── Agenda
│         │   ├── Clientes
│         │   ├── Serviços
│         │   ├── Comandas (PDV)
│         │   ├── Financeiro (Caixa)
│         │   ├── Comissões
│         │   ├── Club dos Chefes
│         │   ├── Relatórios
│         │   ├── BI
│         │   ├── Equipe
│         │   ├── Estoque
│         │   ├── Produtos
│         │   ├── Configurações
│         │   └── Administração
│         ├── Features (por módulo)
│         ├── Permissões (por role)
│         ├── Planos (free/pro/premium)
│         └── Dependências
│
└── Evolução da Plataforma
      └── A plataforma foi concebida para suportar múltiplos produtos.
          Novos segmentos poderão ser desenvolvidos futuramente,
          mediante decisão formal do Product Owner.
```

- [ ] Documento oficial com: Produto → Módulos → Features → Permissões → Planos → Dependências
- [ ] Usado por: comercial, onboarding, suporte, documentação, desenvolvimento
- [ ] Formato padronizado (matriz ou árvore)
- [ ] Versionamento do catálogo

### 5.5.7 Module Architecture (Arquitetura de Módulos)

Estrutura hierárquica de módulos:

```
SMG Barber
├── Agenda
│   ├── Agendamento recorrente
│   ├── Bloqueio de horário
│   ├── Confirmacao automatica
│   └── Lista de espera
├── Clientes
│   ├── Cadastro
│   ├── Historico
│   ├── Ficha completa
│   └── Importacao
├── Financeiro
│   ├── Abertura de caixa
│   ├── Movimentacoes
│   ├── Sangria/Suprimento
│   ├── Fechamento
│   └── Relatorios
├── Club dos Chefes
│   ├── Planos
│   ├── Assinaturas
│   ├── Creditos
│   └── Cobrancas
└── [ ... ]
```

- [ ] Árvore completa de módulos e sub-módulos
- [ ] Dependências entre módulos
- [ ] Módulos ativos vs futuros
- [ ] Módulos por produto
- [ ] Módulos por plano

### 5.5.8 Roles & Permissions Matrix (Matriz de Papéis e Permissões)

```
Owner → Administrador → Gerente → Recepcionista → Barbeiro → Cliente
```

- [ ] Hierarquia de papéis (quem pode fazer o quê com quem)
- [ ] Matriz oficial de permissões (55+ permissões × 7+ papéis)
- [ ] Regras de herança (owner herda de admin? admin herda de gerente?)
- [ ] Permissões por módulo
- [ ] Permissões por ação (create, read, update, delete, export, share)
- [ ] Customização de permissões (owner pode liberar/bloquear para roles abaixo)
- [ ] Auditoria de permissões (quem mudou o quê e quando)
- [ ] Papéis documentados vs papéis no código (`seller`, `cashier` — alinhar)

### 5.5.9 Data Structure Multi-Tenant

- [ ] Tabelas compartilhadas (profiles, tenants, plans, subscriptions)
- [ ] Tabelas por tenant (appointments, comandas, clients, services)
- [ ] Tabelas de billing (subscriptions, invoices, payments)
- [ ] Tabelas de controle (feature_flags, usage_limits, audit_logs)
- [ ] Índices otimizados para queries multi-tenant
- [ ] RLS policies por tabela
- [ ] Schema de tenant_id em todas as tabelas de domínio
- [ ] Estratégia de compartilhamento de storage (avatars, receipts, etc.)

**Entregáveis:**
- `docs/SAAS_CORE_ARCHITECTURE.md` — documento consolidado com todos os 9 blocos
- Matrizes de consistência (produtos × módulos × features × planos × permissões)
- Diagramas de estados (tenant lifecycle, onboarding flow, billing flow)
- Definição de feature flags
- Estrutura de dados documentada

**Riscos:**
- Decisões de billing podem impactar toda a plataforma
- Multi-tenant mal implementado pode causar vazamento de dados
- Feature flags podem adicionar complexidade significativa
- Provisionamento incorreto pode causar dados órfãos

**Responsável:** Augusto (Product Owner) + OpenCode (formatação e validação técnica)

**Próxima Etapa:** Fase 5.6 — Platform Certification

---

## Fase 5.6 — Platform Certification

**Objetivo:** Validar que toda a documentação e arquitetura estão consistentes antes de iniciar Production Readiness.

**Status:** ✅ Concluída com ressalvas documentadas.

**Tipo:** Validação/Certificação (nenhuma implementação).

**Por que esta fase existe:**
> Antes de escrever CI/CD, configurar Sentry ou fazer deploy, precisamos ter certeza de que a documentação está consistente, a taxonomia está correta, os módulos estão alinhados, os papéis estão definidos e o onboarding está completo. Uma plataforma com documentação inconsistente não pode ir para produção.

**Critérios de Entrada:**
- Fase 5 (Business Architecture) concluída
- Fase 5.5 (SaaS Core Architecture) concluída

**Critérios de Saída:**
- Todos os 9 itens de certificação aprovados
- Zero divergências entre documentação e código
- Documentação consistente em todos os pontos de vista

**Checklist de Certificação:**

| # | Item | Critério | Status |
|---|------|----------|--------|
| 1 | **Arquitetura consistente** | Arquitetura técnica (Fase 4) alinhada com arquitetura de negócio (Fase 5) e SaaS Core (Fase 5.5) | ⬜ |
| 2 | **Documentação consistente** | Todos os documentos apontam para a mesma versão, mesma nomenclatura, mesmas decisões | ⬜ |
| 3 | **Taxonomia consistente** | `docs/TAXONOMY.md` refletido em todo o código, sem termos proibidos | ⬜ |
| 4 | **Módulos consistentes** | Catálogo oficial (5.5.6) refletido no código, sem módulos órfãos | ⬜ |
| 5 | **Papéis consistentes** | Matriz de permissões (5.5.8) implementada no código, sem papéis órfãos | ⬜ |
| 6 | **Produtos consistentes** | Cada produto documentado existe no código, sem produtos fantasma | ⬜ |
| 7 | **Onboarding consistente** | Fluxo documentado (5.5.1) implementado, sem quebras | ⬜ |
| 8 | **Billing consistente** | Arquitetura de billing (5.5.3) definida, feature flags (5.5.4) implementadas | ⬜ |
| 9 | **Tenant consistente** | Lifecycle (5.5.2) implementado, estados no banco, transições funcionando | ⬜ |

**Metodologia de Validação:**

Para cada item:
1. **Levantamento** — O que a documentação diz?
2. **Verificação** — O que o código faz?
3. **Comparação** — Há divergência?
4. **Correção** — Corrigir documentação OU código
5. **Valiação** — Item aprovado?

**Entregáveis:**
- `docs/PLATFORM_CERTIFICATION.md` — documento de certificação com resultado de cada item
- Lista de divergências encontradas e correções aplicadas
- Sign-off formal

**Riscos:**
- Pode revelar divergências significativas entre documentação e código
- Pode exigir correções que atrasam Fase 6

**Responsável:** OpenCode (validação técnica) + Augusto (aprovação)

**Próxima Etapa:** Fase 6 — Production Readiness

---

## Fase 6 — Production Readiness

**Objetivo:** Preparar o sistema para operação em produção com confiabilidade, monitoramento e recuperação.

**Status:** ✅ Em andamento — Fase 6.0.4.1, 6.0.4.2, 6.0.4.3 e **6.0.4.4 ENCERRADAS** (baselines `v1.4.0-billing-foundation-6.0.4.2`, `v1.4.1-billing-lifecycle-6.0.4.3` e `v1.4.2-billing-engine-6.0.4.4`). **6.0.5 em andamento** — ADR-013 Accepted (2026-08-06), Subfase 0 concluída, **decisões D-6.0.5-1..8 aprovadas pelo PO (2026-08-06)**. **6.0.5.1 (Estado Efetivo / camada de autorização) ✅ CERTIFICADA PELO PO (2026-08-06)** — implementada + E2E flow13 PASS (8/8) + baseline `v1.4.3-effective-state-6.0.5.1`. **6.0.5.2 (BillingService + Modelagem de Plans) ✅ CERTIFICADA PELO PO (2026-08-06)** — implementação + review PO + **smoke E2E 10/10 PASS (48.4s, Supabase real)**; migration `plans/features/plan_features` idempotente + `PlanCatalog` (contrato único do PO) + `FEATURE_KEYS` 1:1 + `PLAN_CATALOG_VERSION`/`CATALOG_FINGERPRINT` + 819 testes verdes; **deploy ao remoto DEFERIDO pelo PO (janela apropriada — não empurrar junto a `20260806030000` pendente; chaves validadas — smoke real já executado)**. **6.0.5.3 (FeatureFlagService + enforcement) ✅ IMPLEMENTAÇÃO EM ANDAMENTO (PO aprovou início em 2026-08-07)** — backend + frontend implementados; **adapters DB em `domain/billing/`** (decisão PO — padrão `supabaseBillingRepository.ts`; guard intacto, violações 233 → 230); migration `20260807000000` **validada em Postgres 16 docker** (aplica 2×; cenários T1–T7 OK); unit 847/847, build OK, `architecture:ci` verde, **smoke E2E 10/10 PASS (46.7s, Supabase real)**; docs finais + commit semântico `b383222` (24 arquivos, +1928/−126) + push.** **6.0.5.4 (TenantLifecycleService + `suspended` aditivo) ✅ IMPLEMENTAÇÃO CONCLUÍDA (2026-08-07, PO aprovou a entry audit e autorizou a implementação)** — migration `20260807010000` (CHECK aditivo `suspended`, coluna `grace_ends_at` + backfill, `apply_subscription_transition` fail-fast sem `ELSE→active`, `get_due_subscriptions` ampliada, RPCs `suspend_subscription`/`reactivate_subscription` superadmin) **validada em Postgres 16 docker (aplica 2×; T1–T7 OK)**; `TenantLifecycleService` (writer único de `tenants.status` — ADR-013 §3.1) + engine `suspend` (grace expirado, `_graceDays` ativado) + `markPaid` reativa `suspended→active`; eventos `TenantSubscriptionSuspended`/`Reactivated` publicados; unit **874/874** (+27), typecheck 125 baseline, build OK, `architecture:ci` verde; **E2E flow14 (spec) escrito e typecheck OK — EXECUÇÃO ADIADA pelo PO para a janela única de deploy** (nenhuma migration aplicada ao remoto; execução junto a `06030000`/`06090000`/`07000000` no runbook); commit semântico `5454c81` (22 arquivos, +1355/−109) + push. **6.0.5.5 (Transições RPCs — `change_tenant_plan` + banner + `UpgradePrompt` + correção `Admin.tsx`) ✅ IMPLEMENTAÇÃO CONCLUÍDA (2026-08-08)** — migration `20260807020000` (RPC `change_tenant_plan` superadmin + espelho transacional `subscriptions.plan`/`tenants.plan` + `TenantPlanChanged` + grants ADR-012) **validada em Postgres 16 docker (aplica 2× idempotente; T1–T12 OK, incluindo correção do bug de referência ambígua `RETURNS TABLE` × coluna não qualificada)**; `changePlan` em `application/tenantLifecycle.ts` (publica `TenantSubscriptionUpdated`, idempotente) + `Admin.tsx` sem escrita direta (grep zero `tenants.update({plan})` — Single Writer ADR-013 §3.1) + `UpgradePrompt` + `StatusBanner` + depreciação `featureAvailability.ts`; unit **883/883** (+9), typecheck sem novos erros, build OK; **GATE Schema Freeze REEXECUTADO → `SCHEMA FREEZE = YES`** (delta real = só a RPC prevista). **E2E flow11/flow14 adiados à janela única (decisão PO). ⚠️ Descoberta: RPCs irmãs 6.0.4/6.0.5.4 compartilham o mesmo bug latente de referência ambígua — nunca executadas em Postgres real; fix recomendado no runbook (decisão PO).** **Última implementação funcional da série — schema congelado para a PCA.** **6.0.5.6 (Production Compatibility Audit — PCA) ⏳ PLANNED (2026-08-07)** — etapa oficial obrigatória da release v1.5, entre 6.0.5.5 e o deploy (ver seção 6.0.5.6). **6.0.6 (Compliance & Legal) ⏳ PLANNED (2026-08-07)** — nova fase **exclusivamente documental** aprovada pelo PO como **gate obrigatório de certificação** da release v1.5: gestão de documentos legais (Termos de Uso, Política de Privacidade, LGPD, Contrato SaaS, Consentimentos, Cookies) com versionamento (versão/hash/data/obrigatoriedade/histórico), aceite eletrônico (usuário/tenant/data/hora/IP/User-Agent/versão), reaceite obrigatório em documentos alterados, Centro Jurídico administrativo, objetivos LGPD (exportação/retenção/exclusão/consentimentos/auditoria) e proposta de modelo de dados `legal_documents`/`document_versions`/`accepted_documents` (apenas arquitetura — sem migrations); posicionada **após a conclusão da 6.0.5.x + PCA + janela única de deploy** e **antes da certificação final da Release v1.5** (ver seção 6.0.6).

> **⚠ BASELINE CONGELADA (decisão PO, 2026-08-06):** Antes das fases de monetização (Billing/Trial, Feature Flags, Planos), **nenhuma refatoração estrutural** será feita. Apenas correções críticas são aceitas. Mudanças arquiteturais continuam exigindo ADR.

**✅ JANELA ÚNICA DE DEPLOY EXECUTADA COM SUCESSO (2026-08-08):** backup lógico (D-6.0.5.7 — plano Free, sem PITR) + restore test em Docker PG 17.6 validado; **6 migrations aplicadas** no remoto real `ushsnmlbeurfvlkieiln` (`06090000`, `07000000`, `07010000`, `07020000`, `08000000`, `20260808110000` REVOKE anon D-6.0.5.8); pós-deploy 7/7 verdes; E2E Flow14 1/1 + Flow13 8/8 + Smoke 10/10. **Sem merge, sem deploy frontend, sem baseline.** Próximo gate: **Homologação Sanchez Barber (gate formal D-HOM — `docs/audit/HOMOLOGATION_PLAN_SANCHEZ_BARBER.md`; 6.0.6 só abre com 🟢/🟡 aprovado pelo PO) → Fase 6.0.6 Compliance & Legal → certificação v1.5**. Log: `docs/DEPLOY_LOG_FASE_6_0_5.md`.

**Critérios de Entrada:**
- Fase 5 (Business Architecture) concluída
- Fase 5.5 (SaaS Core Architecture) concluída
- Fase 5.6 (Platform Certification) aprovada
- Contas de infraestrutura criadas (Supabase, Vercel, Sentry)

### 6.0 SaaS Core Implementation

**Objetivo:** Implementar o núcleo SaaS antes de infraestrutura de produção.

**Justificativa:** Primeiro implementamos o núcleo do SaaS. Depois garantimos qualidade, infraestrutura e produção. Essa sequência reduz retrabalho e torna os testes e a observabilidade mais próximos do comportamento real da plataforma.

- [x] **6.0.1** Tenant Creation — Criação de tenant no fluxo de registro/onboarding ✅ APROVADA PELO PO + CERTIFICADA (E2E real, 2026-08-05)
- [x] **6.0.2** Onboarding Completo — Checklist inicial, configuração da loja, configurações obrigatórias e wizard final (escopo redefinido pelo PO em 2026-08-05) ✅ APROVADA PELO PO + CERTIFICADA (E2E real, 2026-08-05)
- [x] **6.0.3** Team Onboarding & Invitations — Convites de profissionais, aceite, credenciais, vínculo ao tenant, perfil e permissões iniciais (decisão PO 2026-08-05 — ver seção 6.0.3) ✅ APROVADA PELO PO + CERTIFICADA (E2E real, 2026-08-06)
- [x] **6.0.4** Subscription/Billing Foundation — Tabelas `subscriptions`/`invoices`/`billing_events`/`payment_attempts`, Billing Engine (`apply_subscription_transition`/`runCycle`), `cancel_at_period_end` (D-A) ✅ CERTIFICADA (baseline `v1.4.2-billing-engine-6.0.4.4`)
- [x] **6.0.5.1** Estado Efetivo / camada de autorização — ADR-013 §2.4: `domain/authorization/*` (AccessPolicy, FeatureAvailability resolver, EffectiveState VO) + `application/authorization/*` (EffectiveAccessService, AuthorizationService); eliminação dos gates diretos `App.tsx:158/162`; D-6.0.5-2 `cancelled` = somente leitura; testes por matriz + **E2E flow13 8/8 PASS** (baseline `v1.4.3-effective-state-6.0.5.1`) ✅ **CERTIFICADA PELO PO (2026-08-06)**
- [x] **6.0.5.2** BillingService + **Modelagem de Plans** (D-6.0.5-5) — migration `20260806090000_phase_6_0_5_2_plans_catalog.sql` (`plans`/`features`/`plan_features`, seed idempotente, FK TEXT `tenants.plan`/`subscriptions.plan` → `plans(slug)`, drop CHECKs, RLS) + contrato único **`PlanCatalog`** (`domain/billing/planCatalog.ts` — `getPlan`/`getFeatures`/`hasFeature`/`getLimits`) + `FEATURE_KEYS` (`domain/billing/featureKey.ts`, 20, 1:1 BD) + `PLAN_CATALOG_VERSION`/`CATALOG_FINGERPRINT` (checksum determinístico, acréscimo do review) + resolver 6.0.5.1 passa a resolver via catálogo (zero SQL) + `limits.ts` marcado legacy ✅ **IMPLEMENTAÇÃO CONCLUÍDA + REVIEW PO (2026-08-06)** — **819 testes verdes (+24)**, typecheck sem novos erros (125 baseline), migration validada em Postgres local 2× (idempotente) + teste de cobertura total (igualdade bidirecional 100% BD↔TS). **Deploy ao remoto DEFERIDO pelo PO** (janela apropriada)
- [ ] **6.0.5** Billing/Tenant/Feature Flags — Arquitetura congelada pelo **ADR-013** (3 contextos desacoplados + Estado Efetivo): ~~6.0.5.1 camada de autorização~~ (✅ concluída), ~~6.0.5.2 BillingService + Modelagem de Plans~~ (✅ concluída — aplicada na janela), ~~6.0.5.3 FeatureFlagService~~ (✅ implementada + commit `b383222` + smoke 10/10 — aplicada na janela), ~~6.0.5.4 TenantLifecycleService + `suspended` aditivo~~ (✅ implementada — unit 874/874, migration T1–T7 OK, **flow14 E2E PASS 1/1 na janela única**), ~~6.0.5.5 transições RPCs (`change_tenant_plan` + banner + `UpgradePrompt` + correção `Admin.tsx:856` + depreciação `featureAvailability.ts`)~~ (✅ implementada — unit 883/883, migration `20260807020000` T1–T12 OK em docker, **SCHEMA FREEZE = YES**; **+ hardening de RPCs irmãs `20260808000000` ✅ concluído** — S1–S16 + G1 PASS), ~~6.0.5.6 Production Compatibility Audit (PCA)~~ (✅ **EXECUTADA 2026-08-08 → `READY`** — BLOCKED inicial (migration `06030000` pulada + 3 limites) → correções PO D-6.0.5.6-5/6 (repair applied + upgrade pro) → re-auditoria OK; **gate pré-deploy liberado**; ver seção 6.0.5.6), **✅ JANELA ÚNICA DE DEPLOY EXECUTADA (2026-08-08)** — 6 migrations aplicadas (`06090000`, `07000000`, `07010000`, `07020000`, `08000000`, `20260808110000` REVOKE anon D-6.0.5.8), pós-deploy 7/7, E2E Flow14 1/1 + Flow13 8/8 + Smoke 10/10 — aguarda homologação Sanchez Barber (ver `docs/DEPLOY_LOG_FASE_6_0_5.md`)
- [ ] **6.0.6** Compliance & Legal — **gate obrigatório de certificação** da release v1.5 (decisão PO 2026-08-07): gestão de documentos legais versionados, aceite eletrônico, reaceite obrigatório, Centro Jurídico, objetivos LGPD e modelo de dados proposto (arquitetura) — **exclusivamente documental nesta etapa** (ver seção 6.0.6)

#### 6.0.5.5 — Transições RPCs (`change_tenant_plan` + banner + `UpgradePrompt` + correção `Admin.tsx`) ✅ IMPLEMENTADA (2026-08-08)

> **Entry audit submetida em 2026-08-07 (decisão do PO) — última implementação funcional da série 6.0.5.**
> Documento: `docs/audit/PHASE_6_0_5_5_ENTRY_AUDIT.md` (§12 fechamento).

**Objetivo:** fechar o ciclo operacional de Billing/Lifecycle entregando a **mudança de plano (upgrade/downgrade)** como operação oficial, eliminando a **dual source of truth** (`tenants.plan` × `subscriptions.plan`) e aplicando o **Single Writer** (ADR-013 §3.1) ao plano do tenant.

**Escopo entregue (D-6.0.5.5-2):**
- RPC `change_tenant_plan` (upgrade/downgrade transacional; grava `subscriptions.plan` + espelho `tenants.plan`; grants ADR-012) — migration `20260807020000_phase_6_0_5_5_transitions.sql` **validada em Postgres 16 docker (T1–T12 + idempotência 2×)**;
- `application/tenantLifecycle.ts`: método `changePlan` + evento `TenantSubscriptionUpdated` (idempotente);
- correção `pages/Admin.tsx` (remoção da escrita direta de `tenants.plan` — grep zero);
- `components/billing/UpgradePrompt.tsx` (fallback do `FeatureGuard` — D-6.0.5.3-5) + `components/billing/StatusBanner.tsx` (banner de estado);
- depreciação de `domain/authorization/featureAvailability.ts` (fora do runtime) + `getUpgradeTarget`/`isDowngrade` em `planCatalog.ts`.

**GATE — SCHEMA FREEZE CANDIDATE (novo, solicitado pelo PO 2026-08-07):** responder se a 6.0.5.5 introduz novas tabelas/colunas/FKs/policies/RPCs/funções ou altera contratos existentes e registrar **`SCHEMA FREEZE = YES`** ou **`NO` (listar o delta)**.
- **Veredito preliminar (§3 da entry audit): `SCHEMA FREEZE = NO`** — o schema ainda mudará em **1 objeto**: nova RPC `change_tenant_plan`.
- **Fechamento (2026-08-08, §12.3): gate reexecutado com o diff real → `SCHEMA FREEZE = YES`** — delta = exatamente a RPC prevista; registrado no `RELEASE_CHECKLIST_v1.5.md`. **Pré-requisito da PCA (6.0.5.6) atendido.**

**Critério de entrada:** ~~aprovação do PO da entry audit (D-6.0.5.5-1..5) + confirmação do hardening opcional M7/M11/M12 + E2E flow11 (D-6.0.5.5-4).~~ → ✅ **Aprovado (2026-08-07)**: hardening M7/M11/M12 + E2E flow11 **adiados ao backlog pós-v1.5**; E2E flow11/flow14 permanecem na janela única de deploy.

> **⚠️ Hardening de RPCs irmãs (decisão PO 2026-08-08, D-6.0.5.5-6..8) — ✅ CONCLUÍDO (§12.7):** auditoria de estado efetivo + validação empírica (PG16 docker, suite **S1–S16 + G1**) confirmou que a `20260806070000` já corrigiu 7 RPCs irmãs, mas **2 permaneciam quebradas**: `create_invoice` e `record_payment_attempt` (declaradas "limpas" incorretamente). Fix **aditivo** na migration **`20260808000000_fix_create_invoice_record_payment_attempt_ambiguity.sql`** (`ON CONFLICT DO NOTHING` + `RETURNING a.id`; grants ADR-012 reafirmados; sem mudança de regra/contrato/escopo — D-6.0.5.5-7). Validada **S1–S16 + G1 PASS** + idempotência 2×. Aplicação na janela única (runbook §3.6, verificação §4.9).

#### 6.0.5.6 — Production Compatibility Audit (PCA) ✅ READY

> **Registrada em 2026-08-07 (decisão do PO) como etapa oficial da release v1.5.**
> **Executada em 2026-08-08 (somente leitura) → inicialmente `BLOCKED`; re-auditoria parcial pós-correções (PO D-6.0.5.6-5/6) → `READY`.**
> Documento de execução/resultado: `docs/audit/PRODUCTION_COMPATIBILITY_AUDIT.md`.

**Localização no fluxo da release v1.5:**

```
6.0.5.5
      ↓
Production Compatibility Audit (6.0.5.6)
      ↓
Deploy Runbook
      ↓
Janela Única de Deploy
      ↓
Smoke Pós-Deploy
      ↓
Fase 6.0.6 — Compliance & Legal (gate obrigatório de certificação)
      ↓
Release v1.5 Certification
```

**Objetivo:** Realizar auditoria **somente leitura** do ambiente produtivo **antes** da primeira aplicação das migrations SaaS da release v1.5. A auditoria deve garantir que os dados existentes dos tenants em produção são compatíveis com:

- novo modelo de planos;
- Feature Flags;
- Tenant Lifecycle;
- Billing;
- limites por plano;
- regras de acesso;
- novas relações de banco.

**Regras desta etapa:**

- não altera dados;
- não aplica migrations;
- não corrige inconsistências automaticamente;
- não cria registros;
- não executa repair migration;
- somente analisa e gera relatório.

**Critérios de entrada** (a auditoria só pode iniciar quando):

- [x] 6.0.5.1 concluída
- [x] 6.0.5.2 concluída
- [x] 6.0.5.3 concluída
- [x] 6.0.5.4 concluída (implementação + unit 874/874 + migration T1–T7; E2E flow14 pendente da janela única — decisão PO 2026-08-07)
- [x] 6.0.5.5 concluída (implementação + unit 883/883 + migration `20260807020000` T1–T12 OK em docker + **SCHEMA FREEZE = YES**; E2E flow11 adiado — decisão PO 2026-08-07; **hardening de RPCs irmãs `20260808000000` ✅ — S1–S16 + G1 PASS**) 
- [x] Schema final da release congelado (SCHEMA FREEZE = YES)
- [x] Runbook de deploy aprovado (`DEPLOY_RUNBOOK_FASE_6_0_5.md`)

**Critério de saída:** criar `docs/audit/PRODUCTION_COMPATIBILITY_AUDIT.md` com resultado obrigatório **`READY`** ou **`BLOCKED`**.

**Resultado da execução (2026-08-08):** ✅ **`READY`** — auditoria somente leitura do banco real (project ref `ushsnmlbeurfvlkieiln`) concluída; veredito inicial **`BLOCKED`** com 1 incompatibilidade crítica de migration + 3 de dados; **correções aprovadas pelo PO (D-6.0.5.6-5/6) e executadas**: (1) `supabase migration repair --status applied 20260806030000` (migration pulada no remoto, `cancel_subscription` 5 colunas incompatível com as 11 já aplicadas — a autorização que ela adiciona já estava no remoto via `06070000`); (2) upgrade `free → pro` dos 3 tenants acima do limite (Barbearia Principal 4/5, Loja Demo Varejo 3/5, SMG Estética 2/5). **Re-auditoria parcial confirmou 0 incompatibilidades → `READY` → janela única de deploy liberada** (pendentes: `06090000`, `07000000`, `07010000`, `07020000`, `08000000`). Demais seções (tenants, plans, subscriptions, billing, chef club, segurança, integridade) **compatíveis**. Detalhes: `docs/audit/PRODUCTION_COMPATIBILITY_AUDIT.md`.

> ⚠️ **Gate de release:** nenhuma migration de produção poderá ser aplicada sem `PRODUCTION_COMPATIBILITY_AUDIT.md = READY` — **✅ status atual: READY (2026-08-08)**.

**Escopo futuro da auditoria (a validar no banco real dos tenants produtivos):**

- **Tenants:** tenants sem plano · planos inválidos · planos obsoletos (`elite`) · status inválidos · inconsistências de lifecycle;
- **Plans:** validar `free` / `pro` / `premium` contra `plans` / `features` / `plan_features`;
- **Subscriptions:** subscriptions órfãs · inexistentes · planos incompatíveis · estados inválidos;
- **Billing:** `invoices` · `billing_events` · `payment_attempts`;
- **Feature Flags:** feature keys existentes · overrides · inconsistências entre banco e catálogo;
- **Limites:** Plano atual → Limite permitido → Uso real → Possível incompatibilidade (ex.: Sanchez Barber, plano Pro, 4 profissionais, limite 5 → **OK**);
- **Chef Club:** utilização atual · compatibilidade com plano · possíveis conflitos após Feature Flags;
- **Segurança:** RLS · policies · grants · RPC permissions · anon access;
- **Integridade:** FK · índices críticos · dados órfãos.

> **Referência (obrigatória):** Antes da janela única de deploy da Release v1.5 será **obrigatória** a execução da **Production Compatibility Audit** utilizando o **banco real dos tenants produtivos**.

---

#### 6.0.6 — Compliance & Legal ⏳ PLANNED

> **Registrada em 2026-08-07 (decisão do PO) como fase oficial e gate obrigatório de certificação da Release v1.5.**
> Documento de planejamento/entrada: `docs/audit/PHASE_6_0_6_ENTRY_AUDIT.md`.
> **Modo da fase:** **EXCLUSIVAMENTE DOCUMENTAL** — nenhum código, SQL, migration, tabela, RPC, API ou componente React é criado nesta etapa.

**Posição na Release v1.5:**

```
Fase 6.0.5.x (concluída)
      ↓
Production Compatibility Audit (6.0.5.6)
      ↓
Deploy Runbook → Janela Única de Deploy → Smoke Pós-Deploy
      ↓
Fase 6.0.6 — Compliance & Legal  ⬅ GATE OBRIGATÓRIO DE CERTIFICAÇÃO
      ↓
Release v1.5 Certification
```

**Objetivo:** preparar juridicamente a plataforma para operação comercial como SaaS, garantindo que o produto possua, documente e audite os documentos legais exigidos.

**Critérios de entrada** (a fase só pode iniciar quando):
- [ ] Arquitetura 6.0.5 concluída (6.0.5.1–6.0.5.6)
- [ ] Production Compatibility Audit concluída (`PRODUCTION_COMPATIBILITY_AUDIT.md = READY`)
- [ ] Schema final da release congelado
- [ ] Deploy da janela única aprovado e executado
- [ ] Release candidata pronta

**Escopo da fase (objetivos registrados):**

1. **Gestão de documentos legais** — documentos versionados: Termos de Uso, Política de Privacidade, LGPD, Contrato SaaS, Consentimentos, Cookies (caso existam).
2. **Versionamento** — todo documento possui: versão, hash, data de publicação, obrigatório/opcional e histórico. **Nunca substituir documentos antigos.**
3. **Aceite eletrônico** — registro de: usuário, tenant, data, hora, IP, User-Agent e versão aceita. **Nunca apagar histórico.**
4. **Reaceite obrigatório** — quando um documento obrigatório mudar: nova versão → login → reaceite obrigatório → acesso liberado.
5. **Centro Jurídico** — módulo administrativo com: histórico de aceites, documentos vigentes, versões anteriores, download, auditoria e situação do tenant.
6. **LGPD** — exportação de dados, retenção, exclusão, consentimentos e auditoria.
7. **Modelo de dados (proposta arquitetural)** — a implementação deverá prever entidades como `legal_documents`, `document_versions` e `accepted_documents`. **Apenas como arquitetura — nenhuma migration nesta fase documental.**
8. **Fluxo oficial** — o aceite jurídico integra o fluxo de criação:

```
Cadastro
    ↓
Provisionamento
    ↓
Onboarding
    ↓
Aceite Jurídico
    ↓
Criação do Tenant
    ↓
Dashboard
```

**Critérios de saída:**
- [ ] Documentação completa da fase
- [ ] Auditoria aprovada
- [ ] Roadmap atualizado
- [ ] Checklist atualizado
- [ ] Fase pronta para implementação futura

**Gate da Release v1.5:** a Release v1.5 somente poderá ser considerada concluída quando **todos** os itens abaixo estiverem atendidos:

- [ ] Todos os documentos jurídicos existirem (Termos, Privacidade, LGPD, Contrato SaaS, Consentimentos, Cookies)
- [ ] Aceite eletrônico implementado
- [ ] Versionamento funcionando
- [ ] Auditoria de aceite funcionando
- [ ] Centro Jurídico disponível
- [ ] Checklist de compliance aprovado

---

#### 6.0.1 Tenant Creation ✅ APROVADA PELO PO (2026-08-01)

**Certificação oficial:**

```
STATUS:
Phase 6.0.1 — COMPLETED

Certification:
APPROVED BY PO

Build:
PASS

Tests:
PASS

Architecture:
APPROVED

Ready for:
Phase 6.0.2 — Onboarding Completo
```

**Pendências registradas pelo PO (resolução em 2026-08-05):**
- ✅ Aplicar a Migration #91 (`20260801000000_phase_6_0_1_provisioning.sql`) em ambiente real — aplicada; regras RPC validadas + fix `20260805000000_fix_provision_new_tenant_auth_check.sql`
- ✅ E2E real do fluxo: Register → Email → Provision → Onboarding → Dashboard → Logout → Login → Dashboard — suite determinística via Admin API; 28 testes (27 passed / 1 gated), 2 execuções consecutivas verdes (~52s)
- ✅ Consertar o runner de Smoke (`test:e2e:smoke`) — `globalSetup` + fixtures reais
- 🟢 Baixa — 127 erros TS pré-existentes (futura fase "TypeScript Strict Cleanup") — permanece

#### 6.0.2 Onboarding Completo ✅ APROVADA PELO PO (2026-08-05)

**Objetivo:** Completar o onboarding do tenant recém-criado, indo da criação de conta até o dashboard operacional.

**Escopo (definido pelo PO):**
- [x] Checklist inicial do onboarding (etapas obrigatórias)
- [x] Configuração da loja (unidade, horários, dados de contato)
- [x] Configurações obrigatórias (serviços, profissionais básicos, métodos de pagamento)
- [x] Wizard final do onboarding (progresso, persistência por etapa, retomada)
- [x] E2E do fluxo completo de onboarding

**Certificação oficial (2026-08-05):**

```
STATUS:
Phase 6.0.2 — COMPLETED

Certification:
APPROVED BY PO

Build:
PASS

Tests:
PASS (unit 644/644, E2E 29/29 incluindo flow6/flow6a/flow7 gated)

Migration #93:
APPLIED (db real, via db query + migration repair — estratégia MIGRATION_EXCEPTION_20260801.md)

Architecture:
APPROVED

Ready for:
Phase 6.0.3 — Team Onboarding & Invitations
```

**Critérios de Saída:**
- Tenant criado chega ao dashboard com configuração mínima válida
- Onboarding retomável e consistente com `tenants.status`
- E2E verde para o fluxo de onboarding completo

**Nota:** O escopo anterior ("Provisioning Engine — criação automática da estrutura inicial") foi incorporado ao onboarding conforme decisão do PO em 2026-08-05.

---

#### 6.0.3 Team Onboarding & Invitations ✅ APROVADA PELO PO (2026-08-06)

> **Decisão do PO (2026-08-05):** A fase foi **renomeada de "Tenant Lifecycle" para "Team Onboarding & Invitations"**. O Tenant Lifecycle já foi amplamente implementado e está em uso desde a Sprint 1 / Fase 6.0.1 — ver evidência abaixo — portanto reabri-lo seria retrabalho. A 6.0.3 foca no onboarding da equipe: convites, aceite, credenciais, vínculo ao tenant, perfil e permissões iniciais.

**Objetivo:** Onboarding de profissionais convidados, da criação do convite até o acesso operacional ao tenant.

**Já implementado (não é escopo — evidência):**
- Enum `tenant_status` (7 estados) — `supabase/migrations/20260728000000_sprint1_tenant_lifecycle.sql`
- Coluna `tenants.status` substituindo `active` (booleano) — mesma migration
- Transição `draft → trial` via RPC `complete_onboarding` — `application/onboarding.ts` (F10: `draft → trial → active` é obrigatório — **nunca** `draft → active`; `trial → active` via `activate_subscription`/engine)
- Verificação de `tenant.status` em `ProtectedRoute` (bloqueia `cancelled`/`archived`/`suspended`; redireciona `draft` para onboarding) — `App.tsx:157-162`
- Tipos de domínio `TenantStatus`/`Tenant` — `domain/tenant/types.ts`

**Escopo (definido pelo PO):**
- [x] Convite de profissionais (convite por email do gestor/owner)
- [x] Aceite de convite (fluxo do convidado)
- [x] Criação de credenciais (criação de conta do profissional)
- [x] Associação ao `tenant` (`staff` + `user_tenants`)
- [x] Conclusão do perfil do profissional
- [x] Permissões iniciais (papel baseado em `role_permissions`)
- [x] E2E do fluxo completo de convite → acesso

**Critérios de Saída:**
- Profissional convidado consegue aceitar, criar conta e acessar o tenant
- Papel/permissões iniciais atribuídos automaticamente
- E2E verde para o fluxo de convite → acesso

**Dependência do ROADMAP:** remoção do item de "Tenant Lifecycle" da 6.0.3 (decisão PO). Gaps residuais de lifecycle (ex.: transições de billing via 6.0.4) migram para `PLATFORM_CERTIFICATION.md` como pendências, não como fase própria.

**Certificação oficial (2026-08-06):**

```
STATUS:
Phase 6.0.3 — COMPLETED

Certification:
APPROVED BY PO

Build:
PASS

Tests:
PASS (unit 659/659; E2E real 30/30 + 1 gated E2E_SIGNUP_UI)

Edge Function invite-team-member:
DEPLOYED (SMTP validado, APP_URL + allowlist configurados)

Migrations:
APPLIED (20260806000000 team_invitations + 20260806010000 fix accept_invite)

Architecture:
APPROVED

Ready for:
Phase 6.0.4 — Subscription/Billing Foundation
```

**Correção de bug (encontrada pelo E2E real):** `accept_invite` falhava com `column reference "tenant_id" is ambiguous` (42702 — OUT params do `RETURNS TABLE` colidiam com colunas na SELECT e no conflict target). Corrigido na migration `20260806010000_fix_accept_invite_tenant_id_ambiguity.sql` (SELECT qualificada com alias + `DELETE`+`INSERT` no lugar de `ON CONFLICT` em `user_tenants`). O bug só foi exposto por E2E ponta a ponta contra Supabase real, aceitando um convite de verdade.

### 6.1 CI/CD

- [ ] GitHub Actions workflow configurado
- [ ] Branch protection no main
- [ ] CI: typecheck + lint + test + build + guards
- [ ] Deploy preview automático para PRs
- [ ] Deploy staging automático para branch homologação
- [ ] Deploy produção manual (após aprovação)

### 6.2 Observabilidade

- [ ] Sentry configurado para captura de erros
- [ ] Correlation IDs em todas as operações
- [ ] Error boundary global no React
- [ ] Health check endpoint

### 6.3 Ambientes

- [ ] Development (local)
- [ ] Preview (PR)
- [ ] Demo (prospects)
- [ ] Staging (validação)
- [ ] Production (clientes)

### 6.4 Hardening

- [ ] ESLint + Prettier configurados
- [ ] `.env.example` documentado
- [ ] `supabase/config.toml` criado
- [ ] Migrations verificadas em banco limpo
- [ ] Documentação de migrations

### 6.5 E2E Críticos

- [ ] Agendamento → Check-in → Comanda → Checkout → Fechamento
- [ ] Checkout → Comissão → Fechamento
- [ ] Club dos Chefes: Criar → Utilizar → Cancelar

### 6.6 Deploy de Produção

- [ ] Contas criadas (Supabase, Vercel, Sentry)
- [ ] Ambiente staging funcionando
- [ ] Smoke tests em staging
- [ ] Deploy produção controlado
- [ ] Rollback testado
- [ ] Monitoramento pós-deploy

### 6.7 Release Notes

- [ ] Script `npm run release` configurado
- [ ] Formato: Novidades, Correções, Breaking Changes, Migrations, Impacto Operacional, Rollback, Issues Conhecidas
- [ ] Integração com git tags

### 6.8 Documentação Operacional

- [ ] Estratégia de ambientes
- [ ] Processo de aprovação de deploy
- [ ] Gestão de segredos e variáveis de ambiente
- [ ] Procedimentos operacionais (backup, rollback, incidentes)

### 6.9 Health Checks

- [ ] Health check endpoint (`/health`)
- [ ] Readiness probe
- [ ] Liveness probe
- [ ] Dependency checks (database, external services)

### 6.10 Backup

- [ ] Backup automático do banco de dados
- [ ] Backup dos arquivos de configuração
- [ ] Teste de restauração periódico

### 6.11 Disaster Recovery

- [ ] Plano de disaster recovery documentado
- [ ] Procedimentos de recuperação testados
- [ ] Contatos de emergência definidos

### 6.12 Deploy Validation

- [ ] Pipeline de deploy configurado
- [ ] Deploy em staging testado
- [ ] Rollback testado
- [ ] Monitoramento pós-deploy

### 6.13 Production Certification ⬜

**Objetivo:** Certificar que o sistema está pronto para produção.

**Checklist de Certificação:**

| # | Item | Critério |
|---|------|----------|
| 1 | Observabilidade | Logs, métricas, alertas funcionando |
| 2 | Dashboards | Todos os dashboards configurados e acessíveis |
| 3 | Métricas | Métricas-chave sendo coletadas |
| 4 | Logs | Logs persistidos e buscáveis |
| 5 | Alertas | Alertas disparam corretamente |
| 6 | Health Checks | Endpoints funcionando |
| 7 | Backup | Backups executados e restauração testada |
| 8 | Disaster Recovery | Plano documentado e testado |
| 9 | Deploy | Pipeline funcional e rollback testado |
| 10 | Segurança | Auditoria de segurança completa |
| 11 | Performance | Baseline estabelecido e monitorado |
| 12 | Documentação | Toda documentação atualizada |

**Entregáveis:**
- Relatório de certificação
- Evidências de cada item
- Sign-off formal

**Critérios de Aceite:**
- 100% dos itens aprovados
- Zero issues críticos
- Equipe treinada e pronta

**Riscos:**
- Pode revelar gaps em integrações
- Variáveis de ambiente podem estar incompletas

**Responsável:** OpenCode (técnicos) + Augusto (aprovações)

**Próxima Etapa:** Fase 7 — Product Maturity

---

## Fase 7 — Product Maturity

**Objetivo:** Elevar a qualidade do produto SaaS sem alterar arquitetura.

**Status:** ⬜ Não iniciada.

**Restrição:** Esta fase NÃO altera arquitetura. Foca na qualidade do produto.

### 7.1 UX Review

**Objetivo:** Revisar e melhorar a experiência do usuário.

- [ ] Auditoria de UX completa
- [ ] Identificação de pontos de atrito
- [ ] Propostas de melhoria
- [ ] Implementação de melhorias críticas
- [ ] Testes de usabilidade

**Entregáveis:**
- Relatório de auditoria UX
- Lista de melhorias priorizadas
- Implementação das melhorias críticas

**Critérios de Aceite:**
- NPS > 8
- Tempo de tarefa principal < benchmark
- Zero erros de usabilidade em testes

### 7.2 Business Rules Audit

**Objetivo:** Validar todas as regras de negócio implementadas.

- [ ] Inventário de regras de negócio
- [ ] Validação de cada regra
- [ ] Identificação de regras não implementadas
- [ ] Correção de inconsistências

**Entregáveis:**
- Inventário de regras
- Relatório de validação
- Correções aplicadas

**Critérios de Aceite:**
- 100% das regras validadas
- Zero inconsistências
- Regras documentadas

### 7.3 Functional Consistency Audit

**Objetivo:** Garantir consistência funcional em todo o sistema.

- [ ] Fluxos principais testados
- [ ] Consistência de dados verificada
- [ ] Validações de entrada verificadas
- [ ] Mensagens de erro consistentes

**Entregáveis:**
- Relatório de consistência
- Lista de inconsistências
- Correções aplicadas

**Critérios de Aceite:**
- Zero inconsistências funcionais
- Mensagens de erro claras e consistentes
- Validações funcionando corretamente

### 7.4 UI Standardization

**Objetivo:** Padronizar a interface do usuário.

- [ ] Design system documentado
- [ ] Componentes padronizados
- [ ] Cores, tipografia, espaçamento consistentes
- [ ] Responsividade verificada

**Entregáveis:**
- Design system documentado
- Componentes padronizados
- Guia de estilo

**Critérios de Aceite:**
- UI consistente em todas as páginas
- Design system seguido
- Responsividade funciona em todos os breakpoints

### 7.5 Internal Documentation

**Objetivo:** Documentar todo o sistema para a equipe interna.

- [ ] Arquitetura documentada
- [ ] Padrões de código documentados
- [ ] Processos documentados
- [ ] Guia de desenvolvimento

**Entregáveis:**
- Documentação de arquitetura
- Guia de desenvolvimento
- Documentação de processos

**Critérios de Aceite:**
- Novo desenvolvedor consegue contribuir em < 1 semana
- Documentação atualizada
- Guia claro e completo

### 7.6 Training Documentation

**Objetivo:** Criar material de treinamento para usuários.

- [ ] Manual do usuário
- [ ] Guia de inicialização
- [ ] Tutoriais por role
- [ ] FAQ

**Entregáveis:**
- Manual do usuário completo
- Guia de início rápido
- Tutoriais por role

**Critérios de Aceite:**
- Usuário consegue usar o sistema sem suporte
- Material claro e acessível
- Tutoriais testados com usuários reais

### 7.7 SMG Academy

**Objetivo:** Criar plataforma de aprendizado para usuários.

- [ ] Estrutura do curso definida
- [ ] Módulos por role
- [ ] Exercícios práticos
- [ ] Certificação de conclusão

**Entregáveis:**
- Plataforma de aprendizado
- Cursos por role
- Sistema de certificação

**Critérios de Aceite:**
- Usuários completam o curso
- Taxa de conclusão > 80%
- Feedback positivo dos alunos

### 7.8 Help Center

**Objetivo:** Criar central de ajuda para usuários.

- [ ] Base de conhecimento
- [ ] Artigos de solução de problemas
- [ ] Chat de suporte
- [ ] Sistema de tickets

**Entregáveis:**
- Help center funcional
- Base de conhecimento completa
- Sistema de suporte

**Critérios de Aceite:**
- Usuários encontram respostas sem suporte humano
- Tempo de resolução < 24h
- Satisfação do suporte > 90%

### 7.9 Business Flow Certification ⬜

**Objetivo:** Validar que todos os fluxos principais funcionam do início ao fim, como um usuário real operaria.

**Fluxos para Validação:**

| # | Fluxo | Etapas |
|---|-------|--------|
| 1 | **Agenda** | Novo Cliente → Agendamento → Confirmação → Check-in → Comanda |
| 2 | **Financeiro** | Comanda → Produtos/Serviços → Checkout → Financeiro → Comissão |
| 3 | **Caixa** | Abertura → Movimentações → Sangria/Suprimento → Fechamento → Relatórios |
| 4 | **Comissão** | Serviço Executado → Cálculo → Rateio → Relatório → Exportação |
| 5 | **Club dos Chefes** | Plano → Assinatura → Cobrança → Créditos → Uso → Cancelamento |

**Entregáveis:**
- Relatório de cada fluxo validado
- Lista de issues encontrados
- Evidências (prints, logs, traces)
- Certificação assinada

**Critérios de Aceite:**
- 100% dos fluxos validados ponta a ponta
- Zero quebras de continuidade
- Dados consistentes em todas as transições

### 7.10 Product Certification ⬜

**Objetivo:** Certificar que o produto está pronto para comercialização.

**Checklist de Certificação:**

| # | Item | Critério |
|---|------|----------|
| 1 | UX Review | NPS > 8, zero erros de usabilidade |
| 2 | Business Rules | 100% validadas, zero inconsistências |
| 3 | Functional Consistency | Zero inconsistências funcionais |
| 4 | UI Standardization | UI consistente em todas as páginas |
| 5 | Internal Documentation | Novo dev contribui em < 1 semana |
| 6 | Training Documentation | Material completo e testado |
| 7 | SMG Academy | Plataforma funcional |
| 8 | Help Center | Base de conhecimento completa |
| 9 | Business Flow | Todos os fluxos validados ponta a ponta |
| 10 | Suporte | Processo de suporte definido |

**Entregáveis:**
- Relatório de certificação
- Evidências de cada item
- Sign-off formal

**Critérios de Aceite:**
- 100% dos itens aprovados
- Zero issues críticos
- Equipe de suporte treinada

**Responsável:** Augusto (PO) + OpenCode (validação técnica)

**Próxima Etapa:** Fase 8 — Commercial Scalability

---

## Fase 8 — Commercial Scalability

**Objetivo:** Expandir capacidade comercial e escalar o produto.

**Status:** ⬜ Não iniciada.

**Restrição:** Esta fase é estrutural. Apenas estruturar o roadmap, não implementar.

### 8.1 ~~White Label~~ — CANCELADO

> **⚠ White Label NÃO faz parte do roadmap atual.**
> Decisão: Multi-Tenant é a prioridade absoluta.
> Referência: Decisão Estratégica D1 (2026-07-24)

### 8.2 Public API

**Objetivo:** Expor funcionalidades via API pública.

- [ ] API REST documentada
- [ ] Autenticação via API keys
- [ ] Rate limiting
- [ ] Documentação Swagger/OpenAPI
- [ ] SDKs para linguagens populares

### 8.3 Webhooks Públicos

**Objetivo:** Permitir que clientes configurem webhooks.

- [ ] Sistema de webhooks configurável
- [ ] Validação de assinatura
- [ ] Retry com exponential backoff
- [ ] Log de entregas

### 8.4 Marketplace

**Objetivo:** Criar marketplace de integrações e complementos.

- [ ] Arquitetura de marketplace
- [ ] Sistema de review e aprovação
- [ ] Billing de marketplace
- [ ] Discovery e busca

### 8.5 Integrações

**Objetivo:** Criar integrações com sistemas populares.

- [ ] Integração com sistemas de pagamento
- [ ] Integração com sistemas de contabilidade
- [ ] Integração com sistemas de CRM
- [ ] Integração com sistemas de marketing

### 8.6 Billing (Plataforma)

**Objetivo:** Implementar sistema de billing para a plataforma SMG (não para o tenant).

- [ ] Planos de preço definidos
- [ ] Sistema de assinatura da plataforma
- [ ] Faturamento automático
- [ ] Gestão de inadimplência

### 8.7 Multi Idioma

**Objetivo:** Suportar múltiplos idiomas.

- [ ] Sistema de internacionalização (i18n)
- [ ] Traduções para idiomas alvo
- [ ] Interface de tradução
- [ ] Testes de tradução

### 8.8 Multi Moeda

**Objetivo:** Suportar múltiplas moedas.

- [ ] Sistema de moedas
- [ ] Conversão automática
- [ ] Formatação por locale
- [ ] Histórico de câmbio

### 8.9 Internacionalização

**Objetivo:** Adaptar o produto para diferentes mercados.

- [ ] Localização de conteúdo
- [ ] Adaptação cultural
- [ ] Conformidade regional
- [ ] Suporte a fuso horário

### 8.10 Enterprise Features

**Objetivo:** Implementar funcionalidades para clientes enterprise.

- [ ] SSO (Single Sign-On)
- [ ] SCIM provisioning
- [ ] Audit logs avançados
- [ ] SLA dedicado
- [ ] Suporte prioritário
- [ ] Customização avançada

### 8.11 SaaS Certification ⬜

**Objetivo:** Certificar que o sistema está pronto para ser vendido em escala.

**Checklist de Certificação:**

| # | Item | Critério |
|---|------|----------|
| 1 | Arquitetura | Arquitetura enterprise consolidada, Fase 2 frozen |
| 2 | UX | NPS > 8, zero erros de usabilidade |
| 3 | Segurança | RLS, idempotência, auditoria completa |
| 4 | Performance | Baseline estabelecido, p95 < 2s |
| 5 | Treinamento | SMG Academy funcional, material completo |
| 6 | Onboarding | Novo usuário opera em < 30 min |
| 7 | Billing | Sistema de assinatura funcional |
| 8 | Documentação | Técnica e de usuário completa |
| 9 | Monitoramento | Logs, métricas, alertas funcionando |
| 10 | Suporte | Processo definido, SLA cumprido |
| 11 | LGPD | Conformidade com proteção de dados |
| 12 | Backups | Backup automatizado, restauração testada |
| 13 | SLA | Uptime > 99.9%, suporte < 24h |
| 14 | Integrações | API pública, webhooks, integrações core |
| 15 | Multi-tenant | Validação em 3+ barbearias com perfis distintos |

**Entregáveis:**
- Relatório de certificação SaaS
- Evidências de cada item
- Sign-off formal

**Critérios de Aceite:**
- 100% dos itens aprovados
- Zero issues críticos
- Produto validado em múltiplos clientes

---

## Referências

- `docs/adr/` — Architecture Decision Records
- `docs/ARCHITECTURE_DECISIONS.md` — Decisões arquiteturais consolidadas
- `docs/PROJECT_MATURITY.md` — Avaliação de maturidade
- `docs/RELEASE_PROCESS.md` — Processo de release
- `docs/TAXONOMY.md` — Glossário oficial
- `docs/BUSINESS_ARCHITECTURE.md` — Arquitetura de negócio (Fase 5)
- `docs/SAAS_CORE_ARCHITECTURE.md` — Arquitetura SaaS Core (Fase 5.5)
- `docs/PLATFORM_CERTIFICATION.md` — Certificação da plataforma (Fase 5.6)
- `PROJECT_STATUS.md` — Status visual do projeto
- `supabase/migrations/MANIFEST.md` — Inventário de migrations
- `docs/security/` — Auditorias de segurança
- `docs/testing/` — Matrizes de teste
- `docs/training/` — Material de treinamento
- `AGENTS.md` — Instruções para sessões de código
- `tests/README.md` — Convenções de teste

---

## Dívida Técnica Registrada

Itens identificados na Fase 5.6 (Platform Certification), documentados para implementação na Fase 6.0.

> **Situação atual (2026-08-06):** D1, D2 e D3 (parcial) foram resolvidos nas Fases 6.0.1–6.0.4. Registro histórico preservado.

| # | Item | Descrição | Scope | Situação |
|---|------|-----------|-------|----------|
| D1 | Onboarding incompleto | Sem criação de tenant no fluxo de registro. `ShopSetup.tsx` é UI sem persistência | Fase 6.0.1 | ✅ Resolvido 6.0.1/6.0.2 |
| D2 | Tenant Lifecycle | Usa `active: boolean`, não enum de 7 estados (draft/trial/active/past_due/suspended/cancelled/archived) | Fase 6.0.3 | ✅ Resolvido 6.0.3 (`tenants.status` enum) |
| D3 | Billing sem enforcement | Sem feature flags, sem verificação de limites por plano, sem upgrade prompt | Fase 6.0.4 + 6.0.5 | ⚠️ Parcial (engine 6.0.4, `max_staff` 6.0.3); flags/persistência = 6.0.5.3 (ADR-013 §3.1) |
| D4 | Papéis parcialmente implementados | Apenas 2 de 6 papéis da matriz têm arquivos dedicados (owner, admin). Demais são implícitos | Fase 7 | ⬜ |
| D5 | Taxonomia restante | "Club" sem "dos Chefes" em nomes de arquivo e rotas (`/chefclub/`, `ChefClub*.tsx`) — aceitável como interno | N/A (intencional) | ✅ Mantido |
| D6 | Runtime Integration / Bootstrap da Fase 4 (Event Driven) | Fase 4 implementada em código/testes e certificada 4.10, porém Event Store (`event_store` 0 rows), Subscribers, Outbox, Dispatcher, FinanceProvider (`processed_operations` 0 rows) e ReplayEngine **não inicializados/integrados ao runtime** (zero bootstrap em `index.tsx`/`App.tsx`; única infra inicializada = Observability via `useObservability()`). Não é causa raiz do incidente de Comissões (Trilha A) e a idempotência financeira do H7-1 permanece validada (caminho síncrono `finance_settle_comanda`). Solução não escolhida; sem ADR de implementação | Classificação (2026-08-16) | ⬜ Registrada — gate B-4; decisão arquitetural pendente (B-5) |
| D7 | Transactional Outbox (atomicidade RPC + enqueue) | **RESOLVIDA (2026-08-26).** Composite RPC `finance_settle_comanda_and_enqueue` executa settlement + INSERT `outbox_items` na mesma transação PostgreSQL. Gap de atomicidade entre RPC e enqueue eliminado. ADR-014 Accepted. **Baseline:** `4e1959a` — tag `v1.6.0-transactional-outbox-d7-certified`. Trilha C (`cf451be`) preservada intacta. FinanceSubscriber desativado para `CheckoutCompleted` (strategy retorna `[]`). | Certificação D7 (2026-08-26) | ✅ Resolvida — D7 certificada (4e1959a); ADR-014 Accepted |
| D8 | Dependência client-side do dispatcher da fila outbox | O loop de dispatch do outbox (`setInterval` @ 5s em `useEventInfrastructure()`/`App.tsx`) roda **no browser** de um usuário com sessão autenticada do tenant. Sem uma sessão ativa do tenant, `findNext()` (via RLS `current_tenant_id_from_auth_uid`) **bloqueia corretamente** a reclamação de itens pendentes → a fila só drena enquanto houver um browser autenticado daquele tenant aberto. **Evidência (Post-Deploy ADR-015, 2026-08-27):** 1 comissão real pendente (`comanda 63742efa`, R$100, tenant `f53427f0-…`) enfileirada 07:01 e **não drenada** por inexistência de sessão do tenant (tenant de validação B34H, sem operador humano ativo). O watchdog provou **não morrer** em exceções (2/2 chaos PASS + produção observada), mas **não resolve "existe alguém rodando o loop?"**. **Não é regressão** D7 nem falha do watchdog ADR-015 — é **limitação estrutural do modelo client-side** comprovada em produção. **Decisão do PO (2026-08-27): caminho B — formalizar como PRÓXIMA TRILHA** (dispatcher server-side/worker/cron), não resolver por bypass operacional. | Próxima trilha (D8) | 🟠 PRÓXIMA TRILHA — decisão PO (caminho B); diagnóstico read-only primeiro |


> **Registro da dívida D6 (2026-08-16, gate B-4 da Trilha B):** evidência em `docs/audit/H7_1_TRILHA_B_DOCUMENTAL.md` (matriz D1–D7) e `docs/audit/H7_1_TRILHA_B_CLASSIFICACAO_DIVIDA.md` (classificação formal). **Somente documentação — nenhum código, banco, migration, componente inicializado, merge, tag ou deploy.**
>
> **Registro da dívida D8 (2026-08-27, Post-Deploy + Chaos gate do ADR-015):** dependência client-side do dispatcher outbox — ver tabela acima. **Decisão do PO (caminho B):** (1) **não certificar ADR-015 em produção** — a certificação fica **bloqueada pelo D8**; (2) **não** obter/compartilhar senha, **não** criar bypass operacional/RLS, **não** `INSERT/UPDATE` manual para drenar `63742efa` (item permanece como evidência histórica da causa-raiz, para reprocessamento legado via mecanismo oficial e idempotente após o D8); (3) **formalizar D8 como nova trilha** — primeiro **D8 Read-Only Diagnostic** sobre o dispatcher atual, contexto auth/RLS e opções reais de execução server-side (Edge Function / pg_cron / worker); **nenhum código antes do diagnóstico e do ADR**. **Somente documentação + commit do harness chaos — nenhum código de produção alterado.**

---

## Riscos Identificados

| # | Risco | Impacto | Mitigação |
|---|-------|---------|-----------|
| 1 | **Dependência da Sanchez Barber** | Único cliente em desenvolvimento — regras podem estar moldadas para um único caso | Validar em pelo menos 2 barbearias com perfis distintos antes da comercialização |
| 2 | **Multi-tenant mal implementado** | Vazamento de dados entre tenants | Fase 5.5 define arquitetura antes de implementar |
| 3 | **Billing indeciso** | Bloqueia Fase 6 e 7 | Fase 5.5 define modelo antes de production readiness |
| 4 | **Documentação desatualizada** | Inconsistências entre código e docs | 4 auditorias obrigatórias antes de cada fase |
| 5 | **Nomenclatura inconsistente** | "Club" vs "Club dos Chefes" em 71+ lugares | Corrigido em Fase 5.6 (60 ocorrências UI/docs). Nomes técnicos internos mantidos intencionalmente |

---

## Mudanças

| Data | Versão | Alteração |
|------|--------|-----------|
| 2026-09-05 | 8.44 | **P0.4-A8 — Idempotência de criação de recorrência 🟢 PRODUCTION CERTIFIED (2026-09-05).** PR #25 merged (`feature/p0-4-a7-idempotency` → `main`, commit `a67110c`). Migration `20260905150000_p0_4_a8_recurring_idempotency.sql` applied em produção (`ushsnmlbeurfvlkieiln`) — 5/5 checks PASS: coluna `idempotency_key` NOT NULL, UNIQUE index `(tenant_id, idempotency_key)`, RPC `create_recurring_bill` existe, `authenticated` SELECT granted, 17 registros intactos. Três camadas: (1) UI submit guard — botão desabilitado durante chamada assíncrona, texto "Criando..."; (2) Frontend key — UUID gerado no modal open, passado service→repository→RPC; (3) Backend RPC — `create_recurring_bill` com `UNIQUE(tenant_id, idempotency_key)`. E2E: 18/18 PASS. |
| 2026-09-02 | 8.43 | **STAGING GATE FASE 6 — PROMOÇÃO/​VERSIONAMENTO CONCLUÍDO (2026-09-02).** Merge autorizado pelo PO (`chore/seguranca-bulk-close-comandas-admin` → `main`): **merge `2ce5a7f`** (`--no-ff`, ort, sem conflitos; 79 arquivos, +12040/−12). Validação pós-merge em `main`: **build PASS (17.25s, EXIT 0)**; **typecheck 65 = 65 pré-existentes, **zero novos erros** introduzidos pelo merge (conjunto idêntico ao tip da branch). **Baseline: tag anotada `v2.1.0-staging-gate-approved`** no commit pós-merge `2ce5a7f` (decisão do PO: certificar o **estado promovido em main**). Push: `main` (`d4de4f8..2ce5a7f`) + tag `v2.1.0-staging-gate-approved`. Migrations corretivas `20260831120000`/`20260901120000`/`20260901150000`/`20260901160100` **NÃO aplicadas em produção** (decisão própria separada — autorização independente do PO). Próximo gate formal: Homologação Sanchez Barber (D-HOM) → Fase 6.0.6 Compliance & Legal → certificação Release v1.5. |
| 2026-09-02 | 8.42 | **H2-8 (reversão de comissão) 🟢 FECHADO — causa raiz corrigida + cadeia completa comprovada em STAGING (2026-09-02).** Fechamento formal do achado de contrato da matriz H2-8 (`docs/audit/H7_OPERACAO_REAL_ROTEIRO.md` §10.4/§10.5). **Causa raiz** comprovada em staging: o bloco de publish de `reverseFinancialTransaction` (HEAD) lia **colunas fantasma** (`comandas.discount`, `comanda_items.staff_id`) e desestruturava `{ data }` **sem checar `.error`** → `comandaData=null` → `appEventBus.publish(CheckoutReverted)` **nunca disparava** → `reverse_commission` nunca enfileirava no outbox → comissão não revertida (sintoma real da comanda `6bd5cbe4`, R$7,50 ativa após reversão; SEM perda financeira — net R$0). **Correção aplicada em `523192a`** (`fix(reversal): remove phantom columns and add error checks in CheckoutReverted publish`): remove colunas fantasma, lê `service_execution_participants.professional_id` (coluna real), checa `.error` em todas as leituras. **Comprovação canônica em STAGING** (`tests/homologation/h2-8/h2-8-staging-chain.spec.ts`, schema real `tjcvuhynckocmvtqykxp`, código HEAD): comissão +R$3,75 → `finance_reverse_transaction` → `CheckoutReverted` publicado (`originalCommission 3.75`/`originalReceivedValue 15`) → outbox `reverse_commission` → reversal de comissão −R$3,75 `active` (`original_record_id`) → `financial_reversals`=1 (R$15) → **net R$0** → **idempotente** (2ª reversão mesma chave: financial_reversals=1, reversal records=1, net 0, `already reversed — skipping`). **Produção NÃO tocada; sem deploy; sem migration.** Tratamento do estado real `6bd5cbe4` e liberação de novas reversões em produção = decisão do PO (D-HOM-27). Arquivos H2-8: `h2-8-staging-chain.spec.ts` (canônico, commit `0a699bb`), `h2-8-staging-commission-creation.spec.ts`, `h2-8-staging-reversal.spec.ts`. Branch: `chore/seguranca-bulk-close-comandas-admin`. |
| 2026-09-02 | 8.41 | **STAGING GATE FASE 6 — 🟢 APROVADO / ENCERRADO pelo PO (2026-09-02).** Decisão formal: *"SIM — as evidências são suficientes para prosseguir."* Aprovação registrada em `docs/audit/STAGING_GATE_RELATORIO_CONSOLIDADO.md` §13 (commit `3e8fce9`). Escopo declarado pelo PO: **0 autoria de aplicação em produção** — autoriza o avanço ao fluxo de **promoção/versionamento**; pendências operacionais (migrations corretivas `20260831120000`/`20260901120000`/`20260901150000`/`20260901160100` em produção, RPCs legadas `approve_access_request`/`close_order`, saneamento do gap histórico de migrations) permanecem **decisões próprias separadas**. Cadeia completa do gate: F1.1/F3.1 (12+13 cenários E2E) → FASE 1 (read-only) → FASE 2 (provisionamento) → FASE 3 (homologação P4/P5/P7) → ADR-021 (20/20) → GATE 1/2 (15/15) → FASE 4 (aprovada) → FASE 5 (teardown 22/22 = 0) → FASE 6 (consolidado). Produção INTOCADA durante todo o ciclo; staging restaurado ao estado pré-homologação. Branch: `chore/seguranca-bulk-close-comandas-admin`. Próximo fluxo: promoção/versionamento (merge/deploy exigem aprovação explícita do PO). |
| 2026-08-31 | 8.40 | **F1.1/F3.1 — `bulk_close_comandas_admin` (CRÍTICO — autorização/isolamento multi-tenant) — CODE FIX COMPLETE / HOMOLOGATION BLOCKED 🟡 (NÃO encerrado).** Correção de código implementada, revisada linha a linha e publicada na branch `chore/seguranca-bulk-close-comandas-admin` — commit `983c5bc` `fix(security): harden bulk close comanda authorization` (já pushado). **Migration corretiva:** `20260831120000_seguranca_fix_bulk_close_comandas_admin.sql` — `CREATE OR REPLACE FUNCTION public.bulk_close_comandas_admin(UUID[], UUID DEFAULT NULL, TEXT DEFAULT NULL, DATE DEFAULT NULL)` com guardas: `auth.uid()` obrigatório; resolução tenant/superadmin/role(`profiles`→`staff`)/membership(`user_tenants`); `p_tenant_id NULL` rejeitado p/ não-superadmin; papel gerencial OU membership autorizada; rejeita tenant diferente do requisitante; **validação de pertencimento de ID (fail-closed p/ lote misto A+B)**; UPDATE `comandas`/`appointments` com filtro de tenant; `REVOKE` anon/`service_role` + `GRANT EXECUTE TO authenticated`; `NOTIFY pgrst`. **Migration histórica `20260420110000` NÃO alterada.** **E2E de regressão:** `tests/e2e/homologation/h6-5-bulk-close-comandas-admin.spec.ts` — **12 cenários** (SEC-1..SEC-12). **Validações estáticas:** build PASS · `tsc --noEmit` 0 erros no fix · `git diff --check` PASS · `playwright --list` 12 descobertos. **Reconciliação read-only do staging CONCLUÍDA** (26 migrations locais pendentes: H6/commission/outbox/D8/M4-P1..P8/segurança; 4 órfãs remotas `20260420/28/0501/0502`, causa-raiz `8a4d3c8`/`2edd78d`; sequência segura por timestamp; **nenhum STOP**). **🟡 BLOQUEADO (homologação):** migration `20260831120000` **NÃO aplicada** em staging (exige reconciliação aprovada PO + REPAIR por versão) · E2E real **NÃO executado** (sem `.env.local`) · produção **INTOCADA**. **F1.1/F3.1 NÃO encerrado** — fechamento só após: reconciliação aprovada → migration em staging → E2E real 12/12 → verificação dados (`status='paid'`, appointment `completed`, sem `transaction`) → aprovação PO → aplicação controlada → reteste pós-migration. |
| 2026-08-28 | 8.39 | **D8 — Dispatcher Server-side: PRODUCTION CERTIFIED 🟢.** Deploy completo e validado em produção (`ushsnmlbeurfvlkieiln`). **Marco 0–7 PASS.** (M0) Snapshot read-only: branch `fix/checkout-staff-attribution`, commit `3c925cc`, env=PROD, `63742efa` published intact, 11 published functions, D8 absent, 16 active commissions, pg_cron absent, worker_dispatcher absent. (M1) Migration `20260827120000_d8_worker_rpc_surface.sql` applied via SQL Editor — V1–V6 PASS: role `worker_dispatcher` NOLOGIN/NOBYPASSRLS, 8 RPCs SECURITY DEFINER+search_path=public, grants worker_dispatcher+t, heartbeat table, health() ok. (M2) Migration `20260827210000_d8_worker_schedule.sql` applied (no-op, pg_cron absent). (M3) Migration `20260828000000_d8_worker_retry_dead_letter.sql` applied — V10–V14 PASS: `handle_processing_failure`/`recover_stale_processing` created, claim backoff predicate confirmed, queue healthy, `63742efa` intact. (M4) Edge Function `worker-dispatcher` deployed (129.7kB, ACTIVE, 401 expected auth required). (M5) pg_cron enabled (v1.6.4), job registered (jobid=1, `* * * * *`). (M6) Operational test: `63742efa` commission calculated correctly (40% = R$40, confirmed by PO as correct rate for staff `79fb490b`), 1 commission record, no duplicates, idempotent. (M7) **CERTIFICATION**: ADR-016 PRODUCTION CERTIFIED, ADR-015 PROD CERTIFIED. **`63742efa` intact, never resolved manually — preserved as real operational evidence.** Trilha C + D7 financial contract preserved. D8 dispatcher server-side fully operational in production. Branch: `fix/checkout-staff-attribution`. |
| 2026-08-28 | 8.38 | **D8 — Dispatcher Server-side: ADR-016 Amendment-04 (Retry/Requeue & Dead-Letter) IMPLEMENTADO + TESTADO 🟢.** PO aprovou (`097c687`, "implementação autorizada") para fechar o gap: item `failed` sem caminho server-side de recuperação. **Migration** `20260828000000_d8_worker_retry_dead_letter.sql`: (1) **NOVO** `handle_processing_failure(item, tenant, error)` — transição atômica `processing → pending(backoff) | dead_letter`, espelhando o certificado `SupabaseOutbox.markFailed` (1 fonte): `attempts=retry_attempts+1`; `>=max(5)` → `dead_letter` (determinístico); senão `pending` com `retry_next_retry_at=now+base_delay_ms*2^(attempts-1)`; (2) **NOVO** `recover_stale_processing(tenant)` — `processing`>5min → `pending` sem increment (watchdog, espelha `recoverStaleProcessing`); (3) **Amenda** `claim_next_outbox_item` predica `(retry_next_retry_at IS NULL OR <= now())` p/ honrar backoff (Gate A não reclaimaria itens retried). **Worker** (`index.ts`): usa `handle_processing_failure` (não mais `mark('failed')`) + `recover_stale_processing` no ciclo + `dead` no heartbeat. **Test gate (Docker postgres:15, fixtures determinísticas — NÃO `63742efa`):** migration aplica ✅; **7/7 tests PASS** (T1 retry→pending+backoff, T2 reclaim após backoff, T3 dead-letter aos 5 + não reclaimável, T4 stale→pending sem increment + reclaimável, T5 tenant mismatch RAISE sem mutação, T6 concorrência só 1 transição, T7 observabilidade); grants hpf/rsp/claim=t ✅. **Regression:** build PASS (10.33s), typecheck 67 pré-existentes zero novos, suite **1152/5 = baseline** (mesmas 5 falhas `eventInfrastructure.test.ts` ambiente), `d8:verify` OK. **STOP conditions todas preservadas** (D7 intacto, sem 2ª regra, sem acesso direto do Worker, sem cross-tenant, idempotência, sem alterar retry semântico). **`63742efa` NÃO tocado** (reservado pós-deploy). **Deploy/certificação/`63742efa`/ADR-015 PROD 🔴 BLOQUEADO (PO).** Branch: `fix/checkout-staff-attribution`. |
| 2026-08-27 | 8.37 | **D8 — Dispatcher Server-side: Worker IMPLEMENTADO (Gates B/C/D).** ✔️ PO aprovou `Amendment-01` (Execution Boundary) ✅, `Amendment-02` (Data Contract) ✅, e **`Amendment-03` (Core Sharing & Integrity Contract) ✅ (PO: "D8 Implementation AUTHORIZED")**. Gate A (DB/RPC surface) já provado (`docs/audit/D8_CONCURRENCY_GATE_20260827.md`, commit `b135fd3`+): 6 RPCs, claim 2×/20× sem double-claim, isolamento tenant, idempotência (1 comissão efetiva), build+test baseline. **Gates B/C/D agora implementados:** (1) **Gate B — Core Sharing (Option B PO):** `scripts/d8/export-core.mjs` gera artefato **self-contained** `supabase/functions/_shared/financial-core/index.ts` (esbuild 0.25.12→Deno) a partir de `domain/commission/*` + `shared/numbers/normalize.ts` (fonte única), com manifest `core.sha256.json` + `npm run d8:verify` (integrity/equivalence gate — STOP se divergir). (2) **Gate C — Worker:** `worker-dispatcher/index.ts` (claim→context→calculate→idempotência→insert→mark→heartbeat), `calculate.ts` (reuso do Core, 0 I/O), `jwt.ts` (JWT HS256 role `worker_dispatcher`, Web Crypto sem deps), `config.toml`, schedule migration (D-5 cron). (3) **Equivalence prova:** `tests/d8/equivalence.test.ts` 5/5 PASS (isCommissionEligible≡receivesCommission, getEffectiveRate≡getEffectiveCommissionRate, comissão certificada 50.00, isolamento tenant). **Evidência gates:** build PASS (12.76s), unit **1152 passed / 5 pre-existing** (baseline 1147 + 5 D8, zero regressão), typecheck zero novos erros D8, `d8:verify` OK. **Segurança:** worker_dispatcher (mínimo privilégio, sem service_role, sem acesso direto a tabelas); RPC nunca calcula comissão. **Follow-up (exige PO):** RPC de requeue/retry/dead-letter server-side não está no Gate A (sem widen) — ver `docs/audit/D8_WORKER_GATE_20260827.md`. **Deploy/certificação/produção/`63742efa`/ADR-015 PROD ainda NÃO autorizados (PO).** Branch: `fix/checkout-staff-attribution`. |
| 2026-08-27 | 8.35 | **ADR-015 — Pipeline Financeiro: Observabilidade Crítica ✅ CERTIFICATED (2026-08-27).** Resolve o gap de observabilidade identificado no pipeline `Outbox → Dispatcher → FinanceProvider → Commission` — invisível para a infraestrutura de observabilidade existente. **Architecture em 4 camadas:** (1) Instrumentação — hooks em `SupabaseOutbox` (enqueue/claim/publish/fail/dead_letter/stale), `InMemoryDispatcher` (item delivered/error/provider missing), `FinanceProvider` (delivered/error/skipped/handler missing); (2) Watchdog — try/catch total em `recoverStaleProcessing` + `dispatchAll` no loop, `dispatch_heartbeat` gauge + `dispatch_items_processed` + `dispatch_cycle_duration_ms`; (3) Persistência — gauges de profundidade (`outbox_pending_depth`, `outbox_processing_count`, `outbox_dead_letter_count`) consultáveis via `outbox_items`; (4) Alertas — 8 novas regras (CRITICAL: `outbox_dead_letter_growing`, `dispatch_cycle_failure_rate`, `finance_provider_handler_missing`; WARNING: pending depth, stale recovery, item errors) + `alerts.check()` executado a cada 5s no dispatch cycle. **Correlação:** `eventId` + `tenantId` propagados em todos os logs do pipeline. **Dashboard:** tab "Pipeline" em `Observability.tsx` (health VIVO/INSTÁVEL/MORTO, queue depth, finance metrics, logs). **Escopo cirúrgico:** 7 arquivos (+729/-17). **Preservados:** zero mudança em `logger.ts`/`metrics.ts`/`instrumentation.ts`/`config.ts`, Application Services, D7 composite RPC, Trilha C, idempotência, retry, reversal. **Build PASS.** **Testes:** 1145/1145 unit PASS (5 pre-existing failures, sem regressão). **Auditoria Final:** 14/14 PASS. **Chaos/Watchdog validado:** exceção em dispatchAll não mata o loop, heartbeat continua, alerta gerado, próximo ciclo processa. **Baseline:** `7a6c451` — tag `v1.7.0-adr015-pipeline-observability`. **Produção (Post-Deploy + Chaos, 2026-08-27):** deploy `dpl_ELCWrDqvcXZCyLtu1m8EcFrBD6NS` ✅ · observabilidade/watchdog/chaos/D7/reversal/correlação 🟢 · chaos controlado 2/2 PASS commitado (`6fff7f0`) · **🔴 GATE ABERTO: 1 comissão real pendente** (`comanda 63742efa`, tenant `f53427f0`, R$100) não drenada pelo dispatcher client-side por ausência de sessão autenticada do tenant (tenant de validação B34H, sem operador). Achado comprova limitação estrutural do modelo client-side → **D8**. **Decisão PO (caminho B): PRÓXIMA TRILHA = D8 (dispatcher server-side); ADR-015 NÃO certificado em produção, certificação bloqueada pelo D8.** Em D8: diagnóstico read-only primeiro, sem bypass/credencial/solução improvisada para o item legado. Branch: `fix/checkout-staff-attribution`. |
| 2026-08-27 | 8.36 | **D8 — Dispatcher Server-side: Read-Only Diagnostic CONCLUÍDO + ADR-016 aberto (2026-08-27).** Decisão PO caminho B. **Diagnóstico read-only** (`docs/audit/D8_READONLY_DIAGNOSTIC_20260827.md`, commit `7acaadd`) — zero código/migration/produção. **Achados bloqueadores:** (A-1) `findNext()` usa optimistic locking (SELECT + UPDATE `AND status='pending'`), **NÃO** `FOR UPDATE SKIP LOCKED` como documentado — sem RPC de claim atômico; (A-2) erro de query → `null` (heartbeat = loop vivo ≠ pipeline saudável). **Precedente reutilizável:** Edge Function `notification-sweep` opera sob JWT pass-through (contexto RLS, sem `service_role`). **ADR-016 (Proposed)** define: autoridade = **Edge Function worker + claim atômico no banco (`FOR UPDATE SKIP LOCKED`)**, health semântico (DISPATCHER_ALIVE/QUEUE_QUERY_HEALTHY/QUEUE_DEPTH/STALE/DEAD_LETTERS/LAST_SUCCESSFUL/LAST_ERROR/OLDEST_PENDING_AGE), isolamento por `tenant_id`, menor privilégio, rollback via feature flag, reprocessamento legado idempotente. **Decisão de processo:** ADR-016 → aprovação PO → implementação → testes concorrência/chaos → auditoria → produção → **só então ADR-015 PROD CERTIFIED** (continua bloqueado). Branch: `fix/checkout-staff-attribution`. |
| 2026-08-27 | 8.34 | **D7 — Transactional Outbox 🟢 PRODUCTION CERTIFIED (2026-08-27).** Deploy `dpl_41LFj5ar96Vqf6JASAtLMQHJZNbe` — commit `4798ec1` — alias `barber.soumanager.com`. **Migration PROD:** `outbox_items` table (Trilha C, 137 lines) + composite RPC (D7, 152 lines) — both applied, 14/14 checks PASS. **Smoke 10/10 PASS.** **E2E 32/32 PASS (0 failed).** **B34H financial 5/5 phases PASS:** checkout→settlement→outbox→dispatcher→commission_records pipeline validated end-to-end in production. Reversal audited (nets zero). Idempotency (7 constraints). Concurrency (advisory lock). No regression. Tag `v1.6.0-d7-production-certified` on `4798ec1`. **PO decision: D7 ATIVA EM PRODUÇÃO.** Branch: `fix/checkout-staff-attribution`. |
| 2026-08-26 | 8.33 | **D7 — Transactional Outbox ✅ CERTIFICATED (2026-08-26).** Baseline `4e1959a` — tag `v1.6.0-transactional-outbox-d7-certified`. Gap de atomicidade entre `finance_setle_comanda` RPC e `outbox.enqueue()` **resolvido** via composite RPC `finance_settle_comanda_and_enqueue` (single PG transaction). **Composite RPC:** `settleCheckoutComandaAndEnqueue` em `settlement.ts` (+80 lines) — envelope PL/pgSQL que encapsula `finance_settle_comanda()` + INSERT `outbox_items` no mesmo XA. Se qualquer passo falhar, ambos rollbackam atomically. **FinanceSubscriber:** `CommissionOnlyFinanceStrategy.mapCheckoutCompleted` retorna `[]` — desativado para CheckoutCompleted, evita double-enqueue. **Segurança:** SECURITY DEFINER, REVOKE ALL, GRANT EXECUTE TO authenticated. **Idempotência:** 7 constraints únicas across 4 tables (settlement, outbox, commission_records, processed_operations). **Concorrência:** `pg_advisory_xact_lock` (herdado de `finance_setle_comanda`) + `FOR UPDATE` on comanda row. **E2E + Chaos:** 10/10 criteria PASS. **Auditoria Final:** 14/14 items PASS. **Migração:** `20260827000000_transactional_outbox_composite_rpc.sql` (152 lines). **Arquivos modificados:** `settlement.ts`, `checkout.ts`, `commissionOnlyFinanceStrategy.ts`, 3 test files. **Preservados:** Trilha C intacta (`cf451be` zero diff), RPC original intacta, 16 protected files zero diff. **Produção:** CERTIFICADA PRODUCTION (entry 8.34). Branch: `fix/checkout-staff-attribution`. |
| 2026-08-26 | 8.32 | **Trilha C — Durable Outbox backed by Supabase ✅ CERTIFICATED (2026-08-26).** Baseline `cf451be` — tag `v1.5.0-durable-outbox-trilha-c-certified`. 3 critical risks mitigated: (1) commission_records lost after page reload; (2) commission_records lost after tab/browser close; (3) silent enqueue failure in FinanceSubscriber. **Scope:** `SupabaseOutbox` class (456 lines) with `FOR UPDATE SKIP LOCKED`, stale recovery (`processing_started_at > 5min → reset to pending`), atomic claim (`claimedBy`), idempotent enqueue (`event_id UNIQUE`). **Migration:** `20260826000000_create_outbox_items.sql` (106 lines) — append-only, RLS enabled, 6 indexes. **Bug caught by chaos tests:** `recoverStaleProcessing()` used `.gt()` (matched recent items) instead of `.lt()` (correct: match stale items) — one-line production bug fix. **15 chaos tests across 9 scenarios** (all PASS) — mock Supabase client fully rewritten with array/single semantics, `lt` operator, count opts. **Known gap NOT resolved:** Atomicity between `finance_settle_comanda` RPC and `outbox.enqueue()` — RPC commits independently before event is published. Durable Outbox ≠ Transactional Outbox. Requires separate ADR. **Production deploy:** BLOCKED (PO decision). **Migration in production:** NOT applied. Key files: `domain/events/outbox/supabaseOutbox.ts`, `domain/events/outbox/supabaseOutbox.chaos.test.ts`, `supabase/migrations/20260826000000_create_outbox_items.sql`. Do NOT modify without new trilha/gate. Branch: `fix/checkout-staff-attribution`. |
| 2026-08-26 | 8.31 | **Trilha B — PRODUCTION CERTIFICATION ✅ PASS (certificada end-to-end, 2026-08-26).** Deploy limpo `dpl_F7kJ3gmnf5YaSEBwpjoTW7KLz6Gv` via worktree `smg-clean-deploy` (HEAD=`8a413a5`, status limpo, zero uncommitted). Bundle produção: `Checkout-D81AQv2l.js` (76 KB) + `index-0Ci9o-J7.js` (234 KB) com FinanceSubscriber, FinanceProvider, CommissionRecordHandler, initializeEventInfrastructure presentes. **Smoke produção 13/13 PASS:** F1 deterministic staff ✅ · F2 loading guard ✅ · comanda.staff_id ✅ · item.staff_id ✅ · participant (primary, 100%, affects=true) ✅ · commission_record (staff=barber, value=32, rate=0.4) ✅ · teardown ✅ · dados reais intocados ✅. **Lição de processo registrada:** primeiro deploy (`dpl_FgFRz5hy43fvFWZxJvSpLksLxfmX`) executado de worktree sujo (opencode worktree com uncommitted deletions) → Vite tree-shaked FinanceSubscriber do bundle → commission_record FAIL. Causa raiz identificada (worktree contaminado, não defeito F1/F2) e corrigida com redeploy limpo. **Lições:** (1) `working tree CLEAN` = hard gate obrigatório antes de qualquer deploy de produção; (2) `HEAD == commit certificado` deve ser verificado antes do build; (3) validação automatizada de artefato deve impedir deploy quando working tree dirty ou HEAD diverge. **Nenhuma alteração de código.** Commit `8a413a5` preservado como baseline certificada. |
| 2026-08-26 | 8.30 | **Trilha B — Checkout Staff Attribution ✅ PASS (encerrada, 2026-08-26).** Correção mínima do bug `TD-001 B3.4-H` onde `staff_id` era perdido no checkout direto (comanda `58ddb28e` persistiu `staff_id=NULL` e zero participants). **F1:** query de staff em `pages/Checkout.tsx:508` adiciona `.order('name')` → `staff[0]` do default passa a ser determinístico (antes: ordem arbitrária do Postgres). **F2:** botões "+ Serviço" / "+ Produto" recebem `disabled={loading}` → elimina janela onde item entra no carrinho com `staff_id` vazio antes do carregamento. **Validação E2E completa:** staff_id persistido ✅ · participant primário 100% ✅ · `affects_commission=true` ✅ · commission_records value=40/rate=0.4 ✅ · pipeline assíncrono validado (~12s, InMemoryOutbox → Dispatcher → FinanceProvider) ✅ · idempotência (processed_operations) ✅ · Principal intacto (7 tabelas) ✅ · teardown FK-aware ✅. **Escopo:** 1 arquivo SUT (`pages/Checkout.tsx`), +3/-1, commit `8a413a5`. **Zero alterações:** SQL/RPC/migration/RLS/financeiro. **Produção:** CERTIFICADA (entry 8.31). Branch: `fix/checkout-staff-attribution` (merged to main). |
| 2026-08-16 | 8.29 | **Homologação Sanchez Barber — H-7 investigação S3 (recebíveis) read-only executada: 🔴 achado S3-1 (P1) duplicidade RIOS + ✅ H3-4 reflexo receivable FECHADO (2026-08-16).** Pré-requisito D-HOM-26#3 executado **somente leitura** (`supabase db query --linked`, zero escritas), regra D-HOM-27 §4 respeitada (duplicidade = PARAR, sem corrigir no banco). **✅ H3-4 reflexo receivable FECHADO:** cliente HOMOLOG H3 TESTE — receivable `8b1cdee8…` R$ 160,00 **pago via Pix** (2026-08-11, notes `HOMOLOGACAO H3 - baixa do ciclo de teste`), crédito debitado (`available 4 / used 1`), próximo ciclo `pending` (due 09-10); **sem `42703`, sem duplicidade, sem perda de crédito**. **🔴 S3-1 (P1): receivable duplicado — RIOS - AMIGO, ciclo 2026-06-15, R$ 260,00:** `d561a4c3…` (`overdue`, criado **2026-08-06 18:45**) duplica `0c1ee064…` (**já pago** 06-06, tx `cb41ed2c`) — mesmo `billing_cycle_start` (06-15) mas `billing_cycle_end` divergente (08-14 vs 07-15) → o `ON CONFLICT (subscription_id, billing_cycle_start, billing_cycle_end)` da função `ensure_club_receivable_for_cycle` **não disparou** → 2ª linha inserida. **S3 inflado em R$ 260,00** (sem impacto de caixa — duplicado sem `transaction_id`). Quadratura S3 confere com baseline B10 (30 paid/10 overdue/7 pending = R$ 10.140). Demais overdue: 2 de subs `canceled` (PIETRO, K11 = dívida órfã) + subs `active` com `next_billing_date` parado/1 único receivable (LEONE, LUKAS, THIAGO, DAVI — hipótese billing não avançar, validar na janela acompanhada). **Decisão de tratamento do S3-1 = PO** (registrado, nada corrigido). **Fase 2 (Ciclo H7-1) NÃO executada** — depende da janela acompanhada (dia/horário + equipe). Estado: H-6 🟢 (9/10) → **H-7 ⏳ (baseline + S3 parcial; achado S3-1 a decidir)** → H-8 🔴. Evidência: `docs/audit/H7_1_INVESTIGACAO_S3_READONLY_20260816.md`. Registros: `PROJECT_STATUS.md`, `docs/audit/H7_OPERACAO_REAL_ROTEIRO.md` (§7.2/§7.3), `docs/audit/H7_BASELINE_READONLY.md`, `docs/audit/HOMOLOGATION_PLAN_SANCHEZ_BARBER.md` (H3-4/H7-1), `docs/RELEASE_CHECKLIST_v1.5.md`. |
| 2026-08-16 | 8.28 | **Homologação Sanchez Barber — H-10 fotografia de estado pós-release (gate read-only, 2026-08-16).** Reconhecimento documental após o H-9 para decisão de roadmap — **zero código/migration/deploy/merge**. Respostas: **(1) H-6 🟢 (9/10)** sem pendência técnica bloqueadora — 9 migrations aplicadas/validadas no remoto, M7 formalmente dispensada (dívida P3 separada `approve_access_request`), restam decisões de negócio (produto-bug kiosk, política suspensão); **(2)** das 10 migrations, 9 são correções de segurança já aplicadas e 1 (M7) é redundante — risco de aplicação 🟢, rollbacks existem; **(3) H-8 pós-H-9 = 1 pendência operacional real** (deploy do frontend da release v1.5 na Vercel) + veredito formal — o 42703 do incidente foi resolvido; **(4) Fase 4 (D6, Trilha B) → BACKLOG**, condicionada à decisão arquitetural B-5 + ADR, confirmada como não-causa-raiz (D-HOM-28); **(5) próximo marco = decisão A/B do PO** (A: fechar H-7 ciclo acompanhado + deploy v1.5 + 6.0.6 + baseline v1.5.0 · B: manter hotfix e postergar). **Achado falso descartado:** alegada migration `20260720000001_commission_schema_fix.sql` com `t.active` — arquivo inexistente, zero `t.active` em migrations. Produção: `barber.soumanager.com` → `dpl_X88oDRwznSVaaRYiLaEspB8VLDts` (hotfix). Evidência: `docs/audit/H10_FOTOGRAFIA_POS_RELEASE_20260816.md`. Registros: `PROJECT_STATUS.md`. |
| 2026-08-16 | 8.27 | **Homologação Sanchez Barber — H-9 RELEASE do fix SuperAdmin executado (autorização operacional do PO, 2026-08-16).** Merge fast-forward `feature/phase-6.0.4-billing → main` (`718f6f9..c44ca6d`, merge-base = ancestral, zero conflitos), deploy de produção Vercel `dpl_91Hxq6R29DLTqk18aSkPD8Jo8iBz` (Ready, 16s) servindo `barber.soumanager.com`, e **smoke pós-deploy 10/10 PASS (49.8s) contra a produção** — login real + TenantContext + Comissões + resolução de tenant + sem erros críticos de console. Validação estática do bundle de produção: `tenant.ts` com `app_slug, plan, status, created_at`; `SuperAdmin-DUqljjxV.js` sem `tenants.active` e com `slug, status, created_at`. Incidente `tenants.active` (42703, última ocorrência runtime da Trilha A em `/superadmin`) **DECLARADO ENCERRADO**. Sem migration, sem mudança de banco, sem Fase 4/Event Store/Outbox, sem replay. Evidência completa: `docs/audit/H9_RELEASE_FIX_SUPERADMIN_20260816.md`. Registros: `PROJECT_STATUS.md`. |
| 2026-08-16 | 8.26 | **Homologação Sanchez Barber — H-8.1 correção pontual do achado SuperAdmin (aprovado PO, 2026-08-16).** Eliminado o último uso runtime da coluna inexistente `tenants.active`: `pages/SuperAdmin.tsx:107` consultava `select('id, name, slug, active, created_at')` (mesmo padrão 42703 do incidente original da Trilha A, só que na página administrativa `/superadmin`) e o tipo `TenantRow` declarava `active: boolean`, enquanto o código já consumia `tenant.status` (linhas 154/165/304). Correção restrita a 2 linhas: `TenantRow.status: string` + `select('id, name, slug, status, created_at')`; lógica de mapeamento existente preservada. **Sem migration, sem alteração de banco/schema, sem alteração de Fase 4/Event Driven, sem merge/tag/deploy.** Validação: busca global — zero usos runtime de `tenants.active` restantes (portal/kiosk já usavam `id,name,slug`; `.codex-*` são snapshots fora do build); typecheck sem erros novos no arquivo (baseline pré-existente preservado); unit 897/897; build OK (chunk `SuperAdmin-*.js` gerado). Registros: `PROJECT_STATUS.md`. |
| 2026-08-16 | 8.25 | **Trilha B — classificação formal da dívida arquitetural (gate B-4, somente documentação).** Achado da Trilha B classificado como **Dívida arquitetural — Runtime Integration / Bootstrap da Fase 4 (Event Driven)**: Fase 4 implementada em código/testes e certificada 4.10 (631 testes), porém Event Store (`event_store` 0 rows), Subscribers, Outbox, Dispatcher, FinanceProvider (`processed_operations` 0 rows) e ReplayEngine **não inicializados/integrados ao runtime de produção** (zero bootstrap em `index.tsx`/`App.tsx`; única infra inicializada = Observability via `useObservability()` em `App.tsx:326`). **Confirmado:** não é causa raiz do incidente de Comissões (Trilha A — produção `718f6f9` + `tenants.active`); idempotência financeira do H7-1 permanece validada (caminho síncrono `finance_settle_comanda`, sem duplicidade). **Nenhuma solução técnica escolhida; nenhum ADR de implementação criado** (decisão arquitetural B-5 pendente, sem pré-julgar solução). Divergências D1–D7 e conclusão do B-3 preservadas. D6 registrada na seção "Dívida Técnica Registrada". **Restrições respeitadas:** nenhum código/banco/migration alterado, nenhum componente inicializado, sem merge/tag/deploy. Registros: `docs/audit/H7_1_TRILHA_B_DOCUMENTAL.md` (B-3), `docs/audit/H7_1_TRILHA_B_CLASSIFICACAO_DIVIDA.md` (B-4), `PROJECT_STATUS.md`. |
| 2026-08-16 | 8.24 | **Homologação Sanchez Barber — H-7 Fase 1 (baseline read-only) ✅ (2026-08-16).** Janela H-7 aberta conforme D-HOM-27 — **somente baseline read-only do tenant Sanchez Barber, zero escritas** (`supabase db query --linked`, login role via pooler; metodologia igual ao snapshot). Evidência: `docs/audit/H7_BASELINE_READONLY.md`. Baseline B1–B10 (08-16) × snapshot (08-08): clients **302** (Δ+9) · services **17** (0) · products **18** (0) · appointments **1.447** (Δ+86) · comandas **1.384** (Δ+90) · transactions **736** (Δ+31) · customer_credits **16** (14 ativas/2 canceladas; **77 disponíveis / 3 usadas**) · produtos ativos **18 / estoque 68** · cash_closings **3 `draft`** (nenhum confirmado: 05-11, 05-12, 08-06) · barber_closings **0** · participantes **377** (RUBENS 174, HERON 174, LUCAS 21, Conta Homologacao 6) · receivables **47** (**paid 30/R$ 6.440 · overdue 10/R$ 2.340 · pending 7/R$ 1.360** — S3: +1 pending vs snapshot; 10 overdue confirmado). **Fase 2 (Ciclo H7-1) NÃO executada** — depende da janela acompanhada (dia/horário + equipe, decisão do PO). Estado: H-6 🟢 (9/10) → **H-7 ⏳ (baseline pronto)** → H-8 🔴. Registros: `docs/audit/H7_BASELINE_READONLY.md`, `docs/audit/H7_OPERACAO_REAL_ROTEIRO.md` (§4), `docs/audit/HOMOLOGATION_PLAN_SANCHEZ_BARBER.md` (H7-1), `PROJECT_STATUS.md`. |
| 2026-08-14 | 8.23 | **Homologação Sanchez Barber — H-7 roteiro pronto (D-HOM-27, 2026-08-14): decisões do PO para a operação real.** PO definiu: (1) **Ambiente: dados reais do tenant Sanchez Barber** (sem apagar/editar/manipular dados existentes; registros do teste identificáveis como homologação; saldos/contagens antes e depois); (2) **Escopo: 1 ciclo completo ponta-a-ponta (H7-1)** — ampliar só se o primeiro ciclo estiver perfeito; (3) **Agendamento: janela acompanhada** (Rubens/equipe; dia/horário definidos pelo PO — sem execução espontânea); (4) **Critério de parada: qualquer divergência financeira, duplicidade, perda de crédito, comissão incorreta, alteração inesperada de saldo ou quebra de fechamento = PARAR imediatamente — sem corrigir no banco** (registrar achado e apresentar ao PO); (5) **M7 permanece BLOQUEADA** (nenhuma migration redundante; H-6 = 🟢 9/10 correções efetivamente necessárias; M7 = dívida P3 separada `approve_access_request`); (6) **H-7 NÃO autoriza produção/deploy** — estado permanece **H-6 🟢 → H-7 ⏳ → H-8 🔴**; sem merge, tag ou deploy. **Executado (documentação, sem operação real):** roteiro detalhado + checklist de evidências em `docs/audit/H7_OPERACAO_REAL_ROTEIRO.md` (baseline pré-ciclo B1..B10 — clientes/serviços/agendamentos/comandas/transactions/créditos Chef Club/estoque/fechamentos/comissões/recebíveis; execução do ciclo H7-1; quadratura pós-ciclo Q1..Q7 — comanda→transaction→Chef Club→comissão→fechamentos→consolidado; controles H2-1..H2-8 + H3-4 + S3 (10 overdue + 6 pending) + comissão com dados reais; critérios de fechamento 🟢/🔴). **Pendente: definição da janela acompanhada (dia/horário + equipe) antes de qualquer execução do H-7.** Registros: `docs/BUSINESS_DECISIONS.md` (D-HOM-27), `docs/audit/H7_OPERACAO_REAL_ROTEIRO.md`, `docs/audit/HOMOLOGATION_PLAN_SANCHEZ_BARBER.md` (D-HOM-27), `docs/RELEASE_CHECKLIST_v1.5.md`. Status: H-1 🟢 · H-2 🟢 · H-3 🟡 · H-4 🟢 · H-5 🟢 · H-6 🟢 (9/10, M7 bloqueada) · H-7 ⏳ (roteiro pronto, aguardando janela acompanhada) · H-8 🔴. |
| 2026-08-14 | 8.22 | **Homologação Sanchez Barber — H-6 🟢 APROVADO COM RESSALVA (D-HOM-26, 2026-08-14) + H-7 autorizado a abrir.** Veredito formal do PO: o gate **H-6 é declarado 🟢 APROVADO COM RESSALVA (9/10)** — todas as remediações P0/P1/P2/F6-1 aplicadas e validadas no banco remoto de produção `ushsnmlbeurfvlkieiln` via aplicação incremental (item a item, D-HOM-24/25): **M1–M6** (`20260813120000`..`20260813120400`) + **M8–M10** (`20260813130100`..`20260813130300`); tracking reconciliado via `supabase migration repair --linked --status applied` (INSERT canônico `version,name,statements`; M7 `120500` não registrada); **reauditoria final P1–P7 7/7 PASS (34.8s) + Sanchez F1–F14 14/14 PASS (45.3s); P0/P1 zero**; canário Sanchez verde em todas as etapas. **Ressalva (1/10): M7 formalmente BLOQUEADA** — o efeito (revoke anon/PUBLIC em `approve_access_request`) já existia no banco desde o backup `20260728`; a migration não corrige o vetor real (guarda `auth.uid()`/superadmin) → **dívida P3 separada** (item próprio, correção + teste dedicados em etapa posterior). **H-7 — Operação real AUTORIZADO A SER ABERTO** com pré-requisitos de execução: (1) apresentar ao PO a matriz/escopo do gate H-7 (ciclo H7-1: agenda → atendimento → comanda → pagamento → comissão → fechamento profissional → fechamento caixa → conferência financeira) **antes de qualquer execução**; (2) decisão do PO sobre ambiente (dados reais do tenant Sanchez Barber × isolado com conferência SQL); (3) reflexo no receivable do crédito Chef Club consumido (H3-4) + investigação S3 (10 overdue + 6 pending); (4) evidência da quadratura SQL formal da matriz H2-1..H2-8 (cancelamento/reversão) no H-7; (5) agendamento com a equipe. **H-3 permanece 🟡** (H3-5 c/ ressalva) e **H-8 permanece 🔴 BLOQUEADOR** (produção `718f6f9` + topologia Vercel) — o PASS do H-6 não libera produção. **Sem merge, tag ou deploy de produção.** Registros: `docs/audit/H6_5_PRODUCTION_SAFETY_GATE.md` (§12), `docs/audit/HOMOLOGATION_PLAN_SANCHEZ_BARBER.md` (D-HOM-26), `docs/BUSINESS_DECISIONS.md` (D-HOM-26), `docs/RELEASE_CHECKLIST_v1.5.md`, `docs/security/SECURITY_AUDIT_RPC.md` (dívida P3 `approve_access_request`). Status: H-1 🟢 · H-2 🟢 · H-3 🟡 · H-4 🟢 · H-5 🟢 · **H-6 🟢 (9/10, M7 bloqueada)** · H-7 ⏳ (autorizado a abrir) · H-8 🔴. |
| 2026-08-13 | 8.19 | **Homologação Sanchez Barber — H-6 Segurança 🔴 BLOQUEADO (veredito preliminar OpenCode, 2026-08-13; formal do PO pendente, D-HOM-23).** Auditoria adversarial **read-only** (regra PO) em **tenants E2E isolados** (A/B/OPS — NÃO o tenant Sanchez Barber para mutações) via `tests/e2e/homologation/h6-security.spec.ts` (`E2E_PROVISIONING=1`) — **8/8 testes executados, 39 controles PASS, 9 achados**: **F6-A/F6-B (P1)** anon lê `tenants`/`profiles` — dados reais de produção (Sanchez Barber `b716e290`; policy `public_select_tenants` USING(true) e `Superadmins can view all profiles` sem `TO authenticated` nunca revogadas) · **F6-2 (P1)** `close_order` **escreve cross-tenant** (comanda `open→paid` + estoque 5→4; SECURITY DEFINER legado sem guarda, fora da revoke anon) · **F6-6 (P1)** `ticket_messages` expõe **conteúdo real de suporte** entre tenants (SELECT USING(true), sem tenant_id) · **F6-3/F6-4 (P2)** info disclosure cross-tenant via RPC `tenant_has_feature`/`get_role_permissions` · **F6-5 (P2)** `plan_change_requests` cross-tenant (sem tenant_id) · **F6-7 (P2)** `kiosk_addons` leitura + escrita cross-tenant (upsert persistido) · **F6-8 (P2)** usuário suspenso mantém leitura REST (RLS não checa status). RLS **moderno correto** (clients/comandas/products/subscriptions/feature_flags/role_permissions); falhas concentradas em **policies/RPCs legadas**. **Sem fix automático, sem migration, sem merge/tag/deploy; H-7 não iniciado.** **Decisão requerida do PO:** veredito formal + aprovação da janela de remediação. Evidência: `docs/audit/H6_SECURITY_AUDIT.md`. Status: H-1 🟢 · H-2 🟢 · H-3 🟡 · H-4 🟢 · H-5 🟢 · **H-6 🔴 (preliminar)** · H-7 ⏳ · H-8 🔴. |
| 2026-08-13 | 8.21 | **Homologação Sanchez Barber — H-6 remediação COMPLETA (D-HOM-25): P0/P1 (F6-A, F6-B, F6-2, F6-6) aprovados e executados — 10/10 itens remediados em 10 migrations.** PO aprovou os 4 P0/P1: **F6-A least-privilege** (kiosk/portal são fluxos anônimos por design) e **F6-2 desativação** (sem call site; app usa `finance_settle_comanda`). **4 migrations novas** (`20260813130000`..`20260813130300`, commit por item + push): `130000` F6-A `DROP public_select_tenants`/`public_select_services` + policies anon scoped por `tenants.status` (`active`/`trial`) + **column grants mínimos** (`tenants(id,name,slug,status)`; `services(id,tenant_id,name,price,duration,active,category)`, guarda `IF EXISTS` p/ `duration_minutes`/`is_active`) + `REVOKE` anon/PUBLIC · `130100` F6-B policy `profiles` `TO authenticated USING (current_is_super_admin_from_auth_uid())` + revoke anon/PUBLIC · `130200` F6-2 `REVOKE EXECUTE` `close_order(uuid)` a anon/authenticated/PUBLIC + grant service_role · `130300` F6-6 `ticket_messages` SELECT/INSERT TO authenticated via JOIN `support_tickets` (tenant/usuario/superadmin) + drop `Users can insert tickets` + revoke anon/PUBLIC. **§9.3 corrigida:** das 5 policies irmãs do root cause de F6-A, 4 já foram dropadas pelo DO-loop de `20260308_multitenant_hotfix.sql` — só sobreviviam `public_select_tenants` e `public_select_services` (tratadas). **Produto-bug registrado** (fora da remediação, decisão de produto pendente): booking anon do kiosk provavelmente já bloqueado em produção e mismatch `duration_minutes`/`is_active` vs colunas reais de `services`. **Pendente de aprovação explícita do PO:** aplicação remota das 10 migrations + re-execução da suite E2E H6 (reauditoria) + liberação do H-7. Evidência: `docs/audit/H6_SECURITY_AUDIT.md` (§9.2/§9.3/§9.5). Status: H-1 🟢 · H-2 🟢 · H-3 🟡 · H-4 🟢 · H-5 🟢 · **H-6 🔴 (formal) — remediado, aguardando aplicação remota + reauditoria** · H-7 ⏳ (bloqueado) · H-8 🔴. |
| 2026-08-13 | 8.20 | **Homologação Sanchez Barber — H-6 remediação aprovada (D-HOM-24) — P2 (F6-3/4/5/7/8) + F6-1/P3 EXECUTADOS; H-6 🔴 FORMAL; H-7 bloqueado.** PO: veredito formal **🔴 BLOQUEADO**, janela de remediação **item a item** (**lote NÃO autorizado**). **6 migrations de correção criadas** (commit por item + push): `20260813120000` `tenant_has_feature` fail-closed (ownership + superadmin) · `20260813120100` `get_role_permissions` guarda no padrão `upsert_role_permissions` · `20260813120200` `plan_change_requests` SELECT/INSERT → superadmin · `20260813120300` `kiosk_addons` tenant-scope + revoke anon/PUBLIC · `20260813120400` `current_tenant_id_from_auth_uid()` exige `status='active'` (suspenso → RLS fail-closed) · `20260813120500` `approve_access_request` revoke anon/PUBLIC + grant authenticated (dívida P3 para guarda). Build OK. **Aplicação no banco remoto + re-execução E2E H6 pendem de aprovação explícita do PO.** P0/P1 (F6-A, F6-B, F6-2, F6-6): **proposta detalhada por item em `H6_SECURITY_AUDIT.md` §9.2 aguardando aprovação individual**. Escopo em aberto: policies irmãs `TO public` (F6-A §9.3) + bloqueio REST por `tenants.status` (§9.4). Evidência: `docs/audit/H6_SECURITY_AUDIT.md` (§9). Status: H-1 🟢 · H-2 🟢 · H-3 🟡 · H-4 🟢 · H-5 🟢 · **H-6 🔴 (formal) — remediação P2 em curso** · H-7 ⏳ (bloqueado) · H-8 🔴. |
| 2026-08-13 | 8.19 | **Homologação Sanchez Barber — H-5 Feature Flags 🟢 APROVADO pelo PO (D-HOM-22, 2026-08-13).** O PO declara o gate **H-5 🟢 VALIDADO/APROVADO**, com evidências em **tenant E2E isolado** (Supabase real `ushsnmlbeurfvlkieiln`, dados de teste — **NÃO** o tenant Sanchez Barber, D-HOM-19) via `tests/e2e/homologation/h5-feature-flags.spec.ts` (`E2E_PROVISIONING=1`) + inspeção grep — **5/5 testes E2E PASS + H5-8 PASS**: matriz free 14/pro 15/premium 20 (coincide com seed + espelho TS `planCatalog*`)/feature habilitada → rota liberada/desabilitada → `FeatureUnavailablePage` + `UpgradePrompt` (CTA "Ver Meu Plano"/"Voltar ao Início", **nunca 403**)/URL direta `/bi` bloqueada/**zero leitura direta de `feature_flags` em runtime** (decisão exclusiva via RPC `tenant_has_feature` — `useFeatureFlags`; adapters DI/teste `featureOverrideStoreDb`/`planCatalogDb` sem consumidor runtime; D-6.0.5.3-6 confirmado)/**override por tenant vence a matriz nos 2 sentidos**. **Sem alteração de código de produção/migration.** **Não iniciar H-6 na mesma execução.** **H-3 permanece 🟡** (H3-5 c/ ressalva) e **H-8 permanece 🔴 BLOQUEADOR** — o PASS do H-5 não altera esses status. Evidência: `docs/audit/H5_FEATURE_FLAGS_VALIDATION.md`. Status: H-1 🟢 · H-2 🟢 · H-3 🟡 · H-4 🟢 · **H-5 🟢** · H-6..H-7 ⏳ · H-8 🔴. **Próximo gate: H-6 — Segurança** (execução em separado). |
| 2026-08-13 | 8.19 | **Homologação Sanchez Barber — H-5 Feature Flags ✅ VALIDADO (D-HOM-21, 2026-08-13).** Matriz **H5-1..H5-9: 5/5 testes E2E PASS + H5-8 PASS (inspeção grep)** em **tenant E2E isolado** (Supabase real `ushsnmlbeurfvlkieiln`, dados de teste — **NÃO** o tenant Sanchez Barber, D-HOM-19) via `tests/e2e/homologation/h5-feature-flags.spec.ts` (`E2E_PROVISIONING=1`): matriz free 14/pro 15/premium 20 (coincide com seed + espelho TS `planCatalog*`)/feature habilitada → rota liberada/desabilitada → `FeatureUnavailablePage` + `UpgradePrompt` (CTA "Ver Meu Plano"/"Voltar ao Início", **nunca 403**)/URL direta `/bi` bloqueada/**zero leitura direta de `feature_flags` em runtime** (decisão exclusiva via RPC `tenant_has_feature` — `useFeatureFlags`; adapters DI/teste `featureOverrideStoreDb`/`planCatalogDb` sem consumidor runtime; D-6.0.5.3-6 confirmado)/**override por tenant vence a matriz nos 2 sentidos**. Pontos de atenção da spec (sem alteração de produto): seletores por heading geram falso positivo (`UpgradePrompt` renderiza o título da feature como `<h1>`) e cache de flags por sessão de página (`page.reload()` para override). **Sem alteração de código de produção/migration.** **H-3 permanece 🟡** (H3-5 c/ ressalva) e **H-8 permanece 🔴 BLOQUEADOR** — o PASS do H-5 não altera esses status. **Veredito formal do PO proferido em D-HOM-22 (APROVADO).** Evidência: `docs/audit/H5_FEATURE_FLAGS_VALIDATION.md`. Status: H-1 🟢 · H-2 🟢 · H-3 🟡 · H-4 🟢 · **H-5 ✅ VALIDADO** · H-6..H-7 ⏳ · H-8 🔴. **Próximo gate: H-6 — Segurança.** |
| 2026-08-13 | 8.19 | **Homologação Sanchez Barber — H-4 Billing/Lifecycle 🟢 APROVADO pelo PO (D-HOM-20, 2026-08-13).** Matriz **H4-1..H4-9: 9/9 PASS** em **tenant E2E isolado** (Supabase real `ushsnmlbeurfvlkieiln`, dados de teste — **NÃO** o tenant Sanchez Barber, autorizado D-HOM-19) via `tests/e2e/homologation/h4-billing-lifecycle.spec.ts` (`E2E_PROVISIONING=1`): active/past_due (aviso + escrita DB não bloqueada by design/grace — gap de enforcement na UI registrado)/suspended (`/pending-approval` + evento)/reativação + evento/cancelamento `cancel_at_period_end`/transição `change_tenant_plan` (espelho `tenants.plan`+`subscriptions.plan`) + invoice idempotente + payment attempt/limites `max_staff` (pro=5/free=1)/feature indisponível → `UpgradePrompt` (nunca 403)/`runCycle` grace expirado → suspensão + fail-fast. **Falha inicial do H4-8b = corrida de login no teste E2E** (raiz documentada; correção no spec; reexecução 9/9 PASS ~1.0m) — **não é defeito funcional**. **H-3 permanece 🟡** (H3-1..H3-4, H3-6 ✅; H3-5 🟡 c/ ressalva) e **H-8 permanece 🔴 BLOQUEADOR** — o PASS do H-4 não libera produção. Sem alteração de código de produção/migration. Evidência: `docs/audit/H4_BILLING_LIFECYCLE_VALIDATION.md`. Status: H-1 🟢 · H-2 🟢 · H-3 🟡 · **H-4 🟢** · H-5..H-7 ⏳ · H-8 🔴. **Próximo gate: H-5 — Feature Flags.** |
| 2026-08-13 | 8.18 | **Homologação Sanchez Barber — H-3 Chef Club em execução (H3-4 reflexos financeiros — consumo de créditos).** Validação da RPC `bulk_close_comandas_with_credits` no banco real `ushsnmlbeurfvlkieiln` reproduzindo o cenário do erro `42703` histórico do checkout com créditos do Clube: **consumo de exatamente 1 crédito** (5→4; CORTE SIMPLES 4→3), comanda `482d5bc3...` fechada com `status=paid`, `membership_credit_effect=true`, `payment_method="Club dos Chefes"`, **sem `42703`**; cenário negativo `P0001 Insufficient credits for this service` **sem `42703`**; **idempotência OK** (2ª execução → `updated_count=0`, sem duplicidade). **2 bugs de runtime corrigidos na RPC** em `supabase/migrations/bulk_close_comandas_with_credits.sql` e reaplicados no banco: (1) precedência do cast `::jsonb` na concatenação (`22P02 Token "consumed" is invalid`) → parênteses; (2) `jsonb_set` com `create_missing=false` → `by_service` vazio → `true`. Unit **897/897**, build OK, `architecture:ci` sem regressões. Evidência: `docs/audit/H3_CHEF_CLUB_CREDITS_VALIDATION.md`. Status: H-1 🟢 · H-2 🟢 · **H-3 em execução (H3-4 validado; H3-1/H3-2/H3-3/H3-5/H3-6 pendentes)** · H-4..H-7 ⏳ · H-8 🔴 BLOQUEADOR. |
| 2026-08-08 | 8.17 | **Gate formal de homologação da Sanchez Barber criado (decisão PO 2026-08-08, D-HOM-1..8) — somente documentação.** A homologação torna-se **gate formal da release v1.5**, posicionado **após a janela única de deploy** e **antes da 6.0.6**: 7 gates (H-1 Integridade operacional, H-2 Fluxo financeiro P0, H-3 Chef Club, H-4 Billing/Lifecycle, H-5 Feature Flags, H-6 Segurança, H-7 Operação real com ciclo completo acompanhado) + vereditos oficiais 🟢 HOMOLOGADO / 🟡 HOMOLOGADO COM RESSALVAS / 🔴 BLOQUEADO + evidência obrigatória por teste. **Regra da release: 6.0.6 não começa sem homologação formalmente aprovada pelo PO.** Plano **exclusivamente documental** em `docs/audit/HOMOLOGATION_PLAN_SANCHEZ_BARBER.md`; registros em `BUSINESS_DECISIONS.md` (D-HOM) e `RELEASE_CHECKLIST_v1.5.md` (§10.1 + §13). **Nenhuma execução de teste / alteração de código / banco até aprovação formal do PO.** |
| 2026-08-08 | 8.16 | **JANELA ÚNICA DE DEPLOY ✅ EXECUTADA COM SUCESSO (2026-08-08).** Sequência completa contra o remoto real `ushsnmlbeurfvlkieiln` (Sanchez Barber). **(1) Backup lógico (D-6.0.5.7 — plano Free, sem PITR/backup automático):** `supabase db dump --linked` nas 3 variações (`--role-only` → `roles.sql`; schema → `schema.sql` 109 tabelas; `--data-only --use-copy` → `data.sql` 138 tabelas) + `data_app.sql` (109 tabelas, exclui `auth.*`/`storage.*`), hashes SHA-256 registrados, cópia de custódia em `C:\Users\admsm\Backups\SMG_BARBER\20260808_20260808-093350\`. **Restore test validado em Docker** `public.ecr.aws/supabase/postgres:17.6.1.106` (PG 17.6 = mesma versão do remoto; container `smg-restore-test`): `roles → schema → data_app` OK com `ON_ERROR_STOP=1` e contagens **100% idênticas** (45/42/8/1/2/15/42/4901). **(2) 6 migrations aplicadas** via `MIGRATION_EXCEPTION` (`supabase db query --linked -f` + `migration repair --status applied`) na ordem `06090000` (plans 3/features 20/plan_features 49) → `07000000` (`feature_flags` + `tenant_has_feature`) → `07010000` (`suspend`/`reactivate` + fail-fast + `grace_ends_at`) → `07020000` (`change_tenant_plan`) → `08000000` (fix RPCs irmãs) → `20260808110000` (**fix hardening D-6.0.5.8 — 55× `REVOKE EXECUTE FROM anon`**; débito pré-existente da 6.0.4.2, não introduzido pela janela; exceções públicas `get_invite_by_token`/`kiosk_get_staff` preservadas). **(3) Pós-deploy 7/7 verdes:** histórico zero pendentes; FKs; RLS das 4 tabelas de catálogo + `feature_flags` (1 policy superadmin); grants pós-fix `anon_restantes=0`; 11 RPCs de contrato; matriz free=14/pro=15/premium=20; contagens idênticas ao snapshot pré-deploy. **(4) E2E:** Flow14 1/1 PASS (16.4s — `past_due → suspended → active` com `E2E_PROVISIONING=1`), Flow13 8/8 PASS, Smoke 10/10 PASS (42.0s). **Sem merge, sem deploy frontend (Vercel), sem baseline.** Log completo: `docs/DEPLOY_LOG_FASE_6_0_5.md`. Próximo gate: homologação Sanchez Barber → 6.0.6 → certificação v1.5. |
| 2026-08-08 | 8.13 | **6.0.5.5 — Transições RPCs IMPLEMENTAÇÃO CONCLUÍDA (2026-08-08).** Migration `20260807020000_phase_6_0_5_5_transitions.sql`: RPC **`change_tenant_plan(p_tenant_id uuid, p_plan text, p_reason text DEFAULT NULL)`** SECURITY DEFINER superadmin (grants ADR-012) — upgrade/downgrade transacional gravando `subscriptions.plan` **e espelho `tenants.plan`** (Single Writer ADR-013 §3.1) + `TenantPlanChanged` via `record_billing_event`; **validada em Postgres 16 docker: aplica 2× (idempotente) + cenários T1–T12 OK** (grants; upgrade `free→pro`/`pro→premium`; downgrade `pro→free`/`premium→pro`; espelho `tenants.plan` no mesmo UPDATE; evento com `previous_plan`/`new_plan`/`reason`; plano inválido; idempotência same-plan; não-superadmin; sem subscription; tenant inexistente; sem sessão; ordem fail-fast). **Bug real encontrado e corrigido na validação:** `RETURNS TABLE` (OUT `id`/`status`...) × referência de coluna não qualificada → `column reference "id" is ambiguous` (reproduzido em PG15 e PG16); todas as referências qualificadas com alias. Application: `changePlan(tenantId, plan, reason?)` em `application/tenantLifecycle.ts` (valida → RPC → publica `TenantSubscriptionUpdated`; idempotente; mapeamento `past_due/suspended` preservado) + 9 testes. `pages/Admin.tsx`: escrita direta de `tenants.plan` **removida** (grep zero `from('tenants').update({plan})`). UI: `components/billing/UpgradePrompt.tsx` (fallback do `FeatureGuard`, D-6.0.5.3-5) + `components/billing/StatusBanner.tsx` (banner global trial/past_due/suspended/cancelled, no `Layout`). `featureAvailability.ts` **deprecada** (fora do runtime); `planCatalog.ts` + `getUpgradeTarget`/`isDowngrade`. **Unit 883/883 (+9)**, typecheck sem novos erros (baseline 125), build OK. **GATE Schema Freeze REEXECUTADO → `SCHEMA FREEZE = YES`** (delta real = somente a RPC prevista; Q1–Q7 na §12.3 da entry audit; registrado no `RELEASE_CHECKLIST_v1.5.md`) — pré-requisito da PCA (6.0.5.6) atendido. **⚠️ Descoberta (fora do escopo):** RPCs irmãs das migrations `20260806020000`/`20260806050000`/`20260807010000` usam o mesmo padrão de referência ambígua e **nunca foram executadas em Postgres real** (banco local sem `subscriptions`) → fix aditivo recomendado no runbook/janela única (requer decisão PO). E2E flow11/flow14 permanecem adiados à janela única (decisão PO). Nenhuma migration aplicada ao remoto. |
| 2026-08-08 | 8.15 | **6.0.5.6 — Production Compatibility Audit (PCA) EXECUTADA → ✅ `READY` (2026-08-08).** Auditoria do banco real dos tenants produtivos (project ref `ushsnmlbeurfvlkieiln` — Sanchez Barber) executada via consultas individuais no runner Management API (Supabase CLI v2.105.0; runner não aceita meta-comandos psql e retorna apenas o último result set de arquivos multi-statement). **Veredito inicial ❌ `BLOCKED`** — 1 incompatibilidade crítica de migration + 3 excedências de limite. **Bloqueio crítico:** migration `20260806030000` **pulada no remoto** — `cancel_subscription` atual com **11 colunas** (`cancel_at_period_end`, definida por `06050000`/`06070000` **já aplicadas**) × `CREATE OR REPLACE` de **5 colunas** da pendente → PostgreSQL rejeita (`cannot change return type of existing function`) → erro garantido na janela única; a `06030000` também regrediria a semântica do BillingEngine 6.0.4.4 (pedido → efetivo); a autorização que ela adiciona **já estava no remoto** via `06070000`. **Correções aprovadas pelo PO (D-6.0.5.6-5/6) e executadas:** (1) `supabase migration repair --status applied 20260806030000` — confirmado em `migration list` como aplicada; (2) upgrade `free → pro` dos 3 tenants acima do limite via UPDATE direto em `tenants.plan` (o RPC `change_tenant_plan` ainda não está aplicado no remoto): Barbearia Principal (4 staff), Loja Demo Varejo (3), SMG Estética (2). **Re-auditoria parcial → `limit_check = OK` em 100% dos 45 tenants + topologia de migrations OK → `READY` → janela única de deploy LIBERADA** (pendentes: `06090000`, `07000000`, `07010000`, `07020000`, `08000000`). **Compatível:** 45 tenants, 0 sem plano, 0 planos inválidos, status todos no enum; 1 subscription (E2E Flow9) — 0 órfãs; `plans`/`features`/`plan_features` ausentes (esperado — criados pela `06090000`); invoices 0 / billing_events 2 / payment_attempts 0; 15 assinaturas Chef Club + 42 receivables; 16 RPCs auditadas compatíveis; FKs íntegras; RLS/RPC grants aderentes à ADR-012. Veredito detalhado: `docs/audit/PRODUCTION_COMPATIBILITY_AUDIT.md`. **Gate: PCA = `READY` (2026-08-08).** |
| 2026-08-08 | 8.14 | **Hardening de RPCs irmãs (decisão PO 2026-08-08, D-6.0.5.5-6..8) — ✅ CONCLUÍDO.** Auditoria de estado efetivo (matriz por "última definição") + **validação empírica em Postgres 16 docker** (suite **S1–S16 + G1** executando as 13 RPCs do ciclo de billing em caminho de sucesso + autorização fail-fast + grants ADR-012) → confirmou que a `20260806070000` já corrigiu 7 RPCs irmãs, mas **2 permaneciam quebradas**: **`create_invoice`** (`ON CONFLICT (tenant_id, idempotency_key)` → `column reference "tenant_id" is ambiguous` — OUT param) e **`record_payment_attempt`** (`RETURNING id` → `column reference "id" is ambiguous` — OUT param), ambas declaradas "limpas" incorretamente. **Fix aditivo na migration `20260808000000_fix_create_invoice_record_payment_attempt_ambiguity.sql`:** `create_invoice` → `ON CONFLICT DO NOTHING` (qualificação de alias não é aceita no conflict target; unique de negócio = idempotência preservada); `record_payment_attempt` → alias `a` no INSERT + `RETURNING a.id`. Grants ADR-012 reafirmados. **Sem alteração de regra/contrato/escopo** (D-6.0.5.5-7). **Validação pós-fix: suite completa S1–S16 + G1 TODOS PASS** + idempotência 2× (D-6.0.5.5-8). Runbook atualizado (§3.6 MIGRATION 6 + §4.9 verificação + §6.4 rollback); aplicação na janela única de deploy. |
| 2026-08-07 | 8.12 | **6.0.5.5 — Transições RPCs entry audit submetida (somente documentação, decisão PO 2026-08-07).** Última implementação funcional da série 6.0.5. Escopo registrado (D-6.0.5.5-2 proposto): RPC `change_tenant_plan` upgrade/downgrade transacional (grava `subscriptions.plan` + espelho `tenants.plan`, grants ADR-012; migration planejada `20260807020000_phase_6_0_5_5_transitions.sql`); `changePlan` em `application/tenantLifecycle.ts` + evento `TenantSubscriptionUpdated`; correção `pages/Admin.tsx:856` (fim da escrita direta de `tenants.plan` — dual source of truth, Single Writer ADR-013 §3.1); `UpgradePrompt` (fallback do `FeatureGuard`, D-6.0.5.3-5) + banner de estado; depreciação de `featureAvailability.ts`. **Gate "Schema Freeze Candidate" incluído a pedido do PO — veredito preliminar `SCHEMA FREEZE = NO`: somente a RPC `change_tenant_plan` como novo objeto de schema (sem tabelas/colunas/FKs/policies; assinaturas existentes intocadas); gate reexecutado no fechamento → `SCHEMA FREEZE = YES` antes da PCA.** Hardening opcional M7/M11/M12 + E2E flow11 (D-6.0.5.5-4) aguardando decisão do PO. Criado `docs/audit/PHASE_6_0_5_5_ENTRY_AUDIT.md`. **Nenhum código, migration, tabela, SQL, RPC, API ou componente React foi alterado — somente documentação.** |
| 2026-08-07 | 8.11 | **6.0.6 — Compliance & Legal registrada como fase oficial (gate obrigatório de certificação da release v1.5, decisão PO 2026-08-07).** Nova fase **exclusivamente documental** posicionada **após a conclusão da 6.0.5.x** (incluindo PCA 6.0.5.6 + janela única de deploy) e **antes da certificação final da Release v1.5**. Escopo registrado: (1) gestão de documentos legais (Termos de Uso, Política de Privacidade, LGPD, Contrato SaaS, Consentimentos, Cookies); (2) versionamento (versão/hash/data de publicação/obrigatoriedade/histórico — nunca substituir antigos); (3) aceite eletrônico (usuário/tenant/data/hora/IP/User-Agent/versão — nunca apagar histórico); (4) reaceite obrigatório em documento alterado (nova versão → login → reaceite → acesso); (5) Centro Jurídico administrativo (histórico de aceites, documentos vigentes, versões anteriores, download, auditoria, situação do tenant); (6) objetivos LGPD (exportação, retenção, exclusão, consentimentos, auditoria); (7) modelo de dados proposto `legal_documents`/`document_versions`/`accepted_documents` — **apenas arquitetura, nenhuma migration**; (8) fluxo oficial com Aceite Jurídico entre Onboarding e Criação do Tenant; (9) **gate da release: v1.5 só concluída com documentos jurídicos existentes + aceite eletrônico + versionamento + auditoria de aceite + Centro Jurídico + checklist de compliance aprovado**. Critérios de entrada (arquitetura 6.0.5 concluída, PCA READY, schema congelado, deploy aprovado, release candidata pronta) e de saída (documentação completa, auditoria aprovada, roadmap/checklist atualizados, pronta para implementação futura) registrados. Criado `docs/audit/PHASE_6_0_6_ENTRY_AUDIT.md` e atualizados `PROJECT_STATUS.md`, `RELEASE_CHECKLIST_v1.5.md` e `BUSINESS_DECISIONS.md` (D-6.0.6). **Nenhum código, migration, tabela, SQL, RPC, API ou componente React foi alterado — somente documentação.** |
| 2026-08-07 | 8.10 | **6.0.5.4 — TenantLifecycleService + `suspended` aditivo IMPLEMENTAÇÃO CONCLUÍDA.** Migration `20260807010000_phase_6_0_5_4_tenant_lifecycle.sql`: CHECK aditivo `suspended` (sem `archived` — D-6.0.5-7); coluna `grace_ends_at` + backfill de `past_due` legadas (R6/D-6.0.5.4-5); `apply_subscription_transition` reescrita com map explícito completo + **`ELSE RAISE EXCEPTION`** (fim do bug latente `ELSE→active`, DIV-1) + `p_grace_ends_at`; `get_due_subscriptions` devolve `grace_ends_at` e inclui candidatas com grace expirado; RPCs **`suspend_subscription`/`reactivate_subscription`** (superadmin, D-6.0.5-4, grants ADR-012). **Migration validada em Postgres 16 docker: aplica 2× (idempotente) + cenários T1–T7 OK** (CHECK aceita `suspended`/rejeita `archived`/`expired`; grace gravada/limpa; espelho `tenants.status='suspended'`; fail-fast; `get_due_subscriptions` com grace; guarda superadmin negativa + positiva com eventos; grants). Domain: `SubscriptionStatus += 'suspended'`, `BillingSubscription += graceEndsAt`, ação `suspend` no engine (`_graceDays` ativado; `suspended → none`, reativação não é ação de ciclo) + **`TenantLifecycleService`** (`domain/tenant/` — writer único de `tenants.status`, ADR-013 §3.1, matriz congelada §5.2) + `TenantRepository.updateStatus`. Application: `runCycle` aplica `suspend` + publica `TenantSubscriptionSuspended`; `markPaid` reativa `suspended→active` + publica `TenantSubscriptionReactivated`. **Unit 874/874 (+27)**, typecheck 125 baseline, build OK, `architecture:ci` verde. **E2E flow14 (spec `flow14-tenant-suspend-reactivate.spec.ts`) escrito + typecheck OK; EXECUÇÃO ADIADA pelo PO para a janela única de deploy** — nenhuma migration aplicada ao remoto; flow14 rodará no runbook junto a `06030000`/`06090000`/`07000000` + smoke pós-deploy. |
| 2026-08-07 | 8.9 | **6.0.5.6 — Production Compatibility Audit (PCA) registrada como etapa oficial da release v1.5 (somente documentação, decisão PO 2026-08-07).** Nova subfase 6.0.5.6 (status ⏳ PLANNED) posicionada entre 6.0.5.5 e o Deploy Runbook na janela única de deploy. Objetivo: auditoria **somente leitura** do banco real dos tenants produtivos antes da primeira aplicação das migrations SaaS (novo modelo de planos, Feature Flags, Tenant Lifecycle, Billing, limites, regras de acesso, novas relações). Regras: não altera dados, não aplica migrations, não corrige automaticamente, não cria registros, não executa repair — apenas analisa e gera relatório. Critérios de entrada: 6.0.5.1–6.0.5.3 ✅, 6.0.5.4/6.0.5.5 ⬜, schema final congelado ⬜, runbook aprovado ⬜. Critério de saída: `docs/audit/PRODUCTION_COMPATIBILITY_AUDIT.md` = **READY** ou **BLOCKED**; **gate de release: nenhuma migration de produção sem PCA = READY**. Escopo futuro registrado (Tenants, Plans, Subscriptions, Billing, Feature Flags, Limites, Chef Club, Segurança, Integridade — ex.: Sanchez Barber Pro 4/5 → OK). Também criados `docs/RELEASE_CHECKLIST_v1.5.md` (checklist vivo, com gate PCA) e atualização de `PROJECT_STATUS.md`/`BUSINESS_DECISIONS.md` (D-6.0.5.6). **Nenhum código, migration, teste ou query de banco foi executado.** |
| 2026-08-07 | 8.8 | **6.0.5.3 — Implementação em andamento (PO aprovou início em 2026-08-07).** Backend: `domain/billing/featureFlagService.ts` (writer único, API congelada §2.5) + `domain/billing/planCatalogDb.ts` (PlanCatalog DB-backed com `CATALOG_FINGERPRINT`) + `domain/billing/featureOverrideStoreDb.ts` (overrides de `feature_flags`) + fim de `limits.ts`. **Decisão PO (2026-08-07): adapters DB em `domain/billing/`** (padrão `supabaseBillingRepository.ts`) — Repository Guard intacto, **violações 233 → 230** (redução de dívida, sem exceção no guard); entry audit atualizada (localização corrigida). Frontend: `useFeatureFlags` (src/hooks/, leitura via RPC `tenant_has_feature`) + `FeatureGuard` + `FeatureUnavailablePage` (components/billing/) + gates no `App.tsx`/`Sidebar.tsx`/`moduleRegistry.ts` (app ∧ feature). Migration `20260807000000_phase_6_0_5_3_feature_flags.sql` **validada em Postgres 16 docker** — aplica 2× sem duplicar; cenários funcionais T1–T7 OK (matriz free/pro/premium, override vence, suspensão derruba, RLS de escrita bloqueia authenticated); bug de sintaxe corrigido na validação (COMMENT com `\|\|` → string única). Unit 847/847, build OK, `architecture:ci` verde. Pendente: smoke E2E, docs finais, commit semântico + push. |
| 2026-08-07 | 8.7 | **6.0.5.3 — Ajustes do PO incorporados à entry audit (somente documentação, decisão PO).** Revisão documental solicitada pelo PO (2026-08-07): escopo **delimitado** (D-6.0.5.3-1 — somente enforcement de Feature Flags + resolução de planos; fora: Billing Engine, Lifecycle, novas RPCs de transição, RLS, migrations de billing, suspensão automática); `change_tenant_plan` + `TenantSubscriptionUpdated` + correção `Admin.tsx:856` **realocados para 6.0.5.5** (D-6.0.5.3-2); **deploy via `MIGRATION_EXCEPTION`** (`db query --linked` + `migration repair`, aplicando `06030000`/`06090000`/6.0.5.3 na janela de operação — D-6.0.5.3-3); RPCs protegidas = **cash_closing, commissions, receivables, expenses** (checkout fora — D-6.0.5.3-4); UI **híbrida** com `FeatureUnavailablePage` reutilizável (D-6.0.5.3-5); leitura de flags **somente via RPC `tenant_has_feature`** (D-6.0.5.3-6). **API pública do `FeatureFlagService` congelada** (entry audit §2.5) + **legado/depreciação** (§2.6) + **testes ampliados** (matriz Free/Pro/Premium, upgrade/downgrade, consistência documental × código — §7) + **critérios de saída atualizados** (zero decisões diretas por plano, uso exclusivo do service, `limits.ts` fora do runtime, matriz sincronizada, smoke verde — §8). Decisões D-6.0.5.3-1..6 registradas em `BUSINESS_DECISIONS.md`; `FEATURE_FLAGS_MODEL.md` §4/§5/§6 alinhados. **Nenhum código/migration/teste alterado — commit restrito a documentação. Relatório final aguardando aprovação do PO.** |
| 2026-08-07 | 8.6 | **6.0.5.2 CERTIFICADA PELO PO (2026-08-06) — smoke E2E 10/10 PASS (48.4s, Supabase real) + entry audit 6.0.5.3 submetida.** Smoke `core.spec.ts` (@smoke) rodou com chaves reais validadas (anon==publishable e service role válidas — auditoria de prontidão derrubou o diagnóstico "chaves inválidas"); teardown limpo (tenant removido, 4 users desta run deletados); 6 usuários `e2e-suite-*` órfãos são de runs de 05/08 (acúmulo pré-existente → housekeeping em janela separada). Achados de segurança pré-existentes registrados como **backlog** (não são regressões da 6.0.5.2 e NÃO serão corrigidos nesta etapa): (1) anon lê perfis superadmin via REST (`Superadmins can view all profiles` sem `TO authenticated`; confirmado `role:"superadmin"` sem auth); (2) `public_select_tenants` (kiosk legacy, `USING (true)`) — anon lê todos os tenants. **Entry audit `PHASE_6_0_5_3_ENTRY_AUDIT.md` submetida ao PO (2026-08-07)** — FeatureFlagService + `feature_flags` runtime + `tenant_has_feature` + `PlanCatalog` DB-backed + fim de `limits.ts`/SQL hardcoded + `change_tenant_plan`/`TenantSubscriptionUpdated` + correção `Admin.tsx:856` + unificação do gate `App.tsx`; 4 aprovações solicitadas (A1 deploy, A2 lista de RPCs, A3 comportamento UI, A4 grants). **Sem código 6.0.5.3 até aprovação do PO.** |
| 2026-08-06 | 8.5 | **6.0.5.2 — BillingService + Modelagem de Plans (D-6.0.5-5) IMPLEMENTAÇÃO CONCLUÍDA + REVIEW PO.** Migration `20260806090000_phase_6_0_5_2_plans_catalog.sql`: tabelas `plans`/`features`/`plan_features` + seed idempotente (`ON CONFLICT DO NOTHING`) espelhando `PLAN_FEATURES` (free 14 / pro 15 / premium 20) e `limits.ts` (free=1/pro=5/premium=∞); FK TEXT `tenants.plan`/`subscriptions.plan` → `plans(slug)` (drop dos CHECKs; "fim dos slugs soltos"); RLS leitura authenticated + escrita superadmin; grants service_role. Contrato único **`PlanCatalog`** (`domain/billing/planCatalog.ts` — `getPlan`/`getFeatures`/`hasFeature`/`getLimits`, acréscimo obrigatório do PO) + **`FEATURE_KEYS`** (`domain/billing/featureKey.ts`, 20, 1:1 BD) + resolver 6.0.5.1 passa a resolver via catálogo (zero SQL, API preservada) + `limits.ts` marcado `@deprecated` legacy. **Acréscimos do review:** teste de cobertura total (igualdade bidirecional 100% BD↔TS, features e matriz) + `PLAN_CATALOG_VERSION = 1` + `CATALOG_FINGERPRINT` (`computeCatalogFingerprint` determinístico) comparado ao seed da migration. **819 testes verdes (+24)**, typecheck sem novos erros (125 baseline), build OK, migration validada em Postgres 16 docker (aplica 2× sem duplicar; FK rejeita `elite`). **Deploy ao remoto DEFERIDO pelo PO** — janela apropriada, evitando empurrar a migration de segurança pendente `20260806030000`. Entry audit `PHASE_6_0_5_2_ENTRY_AUDIT.md` → ✅ APROVADA/IMPLEMENTADA. Sem nova baseline (próxima `v1.5.0-feature-flags-6.0.5`). |
| 2026-08-06 | 8.4 | **6.0.5.1 CERTIFICADA PELO PO (2026-08-06) — baseline `v1.4.3-effective-state-6.0.5.1` CONGELADA.** Critérios de saída atendidos: zero decisões de acesso diretas em `App.tsx`; `EffectiveAccessService` como ponto único de autorização; matriz de estados validada por testes unitários (46, 795 total) e por E2E flow13 (8 cenários, Supabase real); baseline criada. **Itens explicitamente fora do escopo (6.0.5.3):** banner de estado (`past_due`/`cancelled`), enforcement read-only nas operações de escrita, gating visual por Feature Flags. A 6.0.5.2 (BillingService + Modelagem de Plans) é aberta com a `v1.4.3` como baseline de referência. |
| 2026-08-06 | 8.3 | **6.0.5.1 — E2E da matriz de navegação por Estado Efetivo (flow13).** `tests/e2e/flows/flow13-access-level-navigation.spec.ts` (8 cenários, E2E_PROVISIONING=1, Supabase real): trial/active → `/dashboard`; `past_due` (D-6.0.5-1) → login permitido, sem redirect; `cancelled` (D-6.0.5-2) → login permitido, sem redirect; suspended/archived → `/pending-approval`; draft → `/onboarding/welcome`; free → app carrega. Verificação grep: zero decisões diretas por `tenant.status` em `App.tsx` (toda decisão centralizada em `domain/authorization/accessPolicy.ts`; `tenant.status === 'active'` em `SuperAdmin.tsx:154/304` = KPI/display, DIV-6). Aviso na UI + enforcement de escrita permanecem na 6.0.5.3 (Entry Check §1.2). |
| 2026-08-06 | 8.2 | **6.0.5.1 — Estado Efetivo / camada de autorização (baseline `v1.4.3-effective-state-6.0.5.1`).** ADR-013 §2.4 implementado: `domain/authorization/*` (AccessPolicy com níveis `onboarding/full/restricted/readonly/none` + 8 ações `system.*`, FeatureAvailability resolver não-catálogo, EffectiveState VO) + `application/authorization/*` (EffectiveAccessService com DI, AuthorizationService `getNavigationState`/`resolveRoute`). Refactor `App.tsx:158/162` — fim das decisões de acesso diretas por `tenant.status`; D-6.0.5-2 `cancelled` passa a permitir login somente leitura (não redireciona mais). 46 testes por matriz (795 no total). DIV-1 alinhado: Modelagem de Plans realocada para 6.0.5.2. |
| 2026-08-06 | 8.0 | **Subfase 0 — 6.0.5 (Alinhamento Documental).** ADR-013 Accepted (3 contextos desacoplados + Estado Efetivo + Single Writer). 6.0.4 marcada como certificada (baseline `v1.4.2-billing-engine-6.0.4.4`). Escopo da 6.0.5 atualizado (6.0.5.1–6.0.5.5). Planos `free/pro/premium` (Elite obsoleto; CHECK `20260806020000`). Correção `draft → trial` (F10 — nunca `draft → active`). Dívida técnica D1/D2/D3 marcada como resolvida/parcial. Sem alteração de código. |
| 2026-08-06 | 8.1 | **Decisões D-6.0.5-1..8 aprovadas pelo PO** — encerra a etapa de definição funcional da 6.0.5. `past_due` = read-only com aviso; `cancelled` = somente leitura; Free = 1 profissional; retenção manual sem TTL; flags = `plans+features+plan_features`; cadência mensal; `archived` só no Tenant; `runCycle` via Edge Function (determinística). Registro em `BUSINESS_DECISIONS.md` e ADR-013 §6/§6.1. Sem alteração de código. |
| 2026-07-28 | 6.2 | Fase 5.5 CONCLUÍDA. 5 definições finais incorporadas: Grace Period, Retenção de Dados, Gateway (adapters), Notificações (camada própria), Auditoria (eventos existentes). Architecture Freeze v1.0 recomendado após Fase 5.6. |
| 2026-07-28 | 6.1 | Decisões do PO incorporadas: onboarding (8 etapas), lifecycle (7 estados), billing (mensal, gateway desacoplado), planos (Free/Pro/Elite, limites configuráveis), hierarquia de papéis. Pendências reduzidas de 15 para 5 críticas. |
| 2026-07-27 | 6.0 | Decisão do PO: Foco absoluto no SMG Barber. Produtos futuros classificados como "Evolução da Plataforma" (sem nomes, sem domínios, sem módulos). Arquitetura multi-tenant preservada. |
| 2026-07-25 | 5.0 | Fase 5.5 renomeada para "SaaS Core Architecture" (9 blocos), Fase 5.6 "Platform Certification" adicionada |
| 2026-07-25 | 4.0 | Diretriz Oficial atualizada: papel da IA expandido, 4 auditorias obrigatórias, Fase 5.5 (Tenant & Billing) adicionada |
| 2026-07-24 | 3.1 | 4.7.8 concluída — Architecture Freeze (ADRs, baseline, ARCHITECTURE.md) |
| 2026-07-24 | 3.0 | 4.7.7 concluída — Architecture Verification (guardrails, madge, dependency-cruiser) |
| 2026-07-24 | 2.9 | 4.7.6 concluída — Codebase Hygiene (dead code, barrels, circular imports, duplicate types) |
| 2026-07-24 | 2.8 | Adicionado 4.7.3-4.7.6 (Architecture Consolidation), 4.8 requer pré-requisitos |
| 2026-07-24 | 2.7 | 4.7.2 concluída — Schema Consistency Audit completa (7 blocos, 134 issues) |
| 2026-07-24 | 2.6 | 4.7.1 concluída, 4.7.2 renomeada para Schema Consistency Audit, marco de aceite atualizado |
| 2026-07-23 | 2.5 | Architecture Freeze Gate, RELEASE_PROCESS.md, Referências atualizadas |
| 2026-07-23 | 2.4 | Marco de aceite da Fase 4, Manifest de migrations, Migration Health Score |
| 2026-07-23 | 2.3 | Fluxo de deploy completo em 4.7.1, CI Migration Validation em Guidelines |
| 2026-07-23 | 2.2 | Renomeado 4.7.1 para Migration Consistency Audit, adicionado 6.11 Business Flow Certification |
| 2026-07-23 | 2.1 | Adição de Fase 0, ARCHITECTURE_DECISIONS.md, 7.11 SaaS Certification, PROJECT_STATUS.md, riscos |
| 2026-07-23 | 2.0 | Reestruturação completa do roadmap |
| 2026-07-23 | 1.0 | Roadmap inicial (Fases 1-4) |
