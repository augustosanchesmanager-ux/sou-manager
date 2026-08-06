# SMG Platform — Roadmap Oficial

> Documento de referência oficial para evolução da SMG Platform até maturidade comercial.
>
> **⚠ ROADMAP CONGELADO** — Nenhuma nova fase poderá ser criada. Nenhuma fase poderá ser reorganizada.
> Somente evoluções documentadas por ADR são permitidas a partir deste ponto.
>
> **Diretriz Oficial:** Ver seção "Diretriz Oficial" abaixo.
>
> **Última atualização:** 2026-08-06

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

**Exemplo de mapeamento:**

| Feature | Free | Pro | Elite |
|---------|:----:|:---:|:-----:|
| Agendamento básico | ✅ | ✅ | ✅ |
| Club dos Chefes | ❌ | ✅ | ✅ |
| Relatórios avançados | ❌ | ❌ | ✅ |
| Multi-profissional | ≤2 | ≤10 | ∞ |
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
│         ├── Planos (free/pro/elite)
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

**Status:** ✅ Em andamento — Fase 6.0.4.1, 6.0.4.2 e 6.0.4.3 ENCERRADAS (baselines `v1.4.0-billing-foundation-6.0.4.2` e `v1.4.1-billing-lifecycle-6.0.4.3`).

> **⚠ BASELINE CONGELADA (decisão PO, 2026-08-06):** Antes das fases de monetização (Billing/Trial, Feature Flags, Planos), **nenhuma refatoração estrutural** será feita. Apenas correções críticas são aceitas. Mudanças arquiteturais continuam exigindo ADR.

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
- [ ] **6.0.4** Subscription/Billing Foundation — Tabela `subscriptions`, gateway adapters, cobrança recorrente
- [ ] **6.0.5** Feature Flags — Tabela `feature_flags`, middleware de verificação, enforcement de limites por plano

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
- Transição `draft → active` via RPC `complete_onboarding` — `application/onboarding.ts`
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

| # | Item | Descrição | Scope |
|---|------|-----------|-------|
| D1 | Onboarding incompleto | Sem criação de tenant no fluxo de registro. `ShopSetup.tsx` é UI sem persistência | Fase 6.0.1 |
| D2 | Tenant Lifecycle | Usa `active: boolean`, não enum de 7 estados (draft/trial/active/past_due/suspended/cancelled/archived) | Fase 6.0.3 |
| D3 | Billing sem enforcement | Sem feature flags, sem verificação de limites por plano, sem upgrade prompt | Fase 6.0.4 + 6.0.5 |
| D4 | Papéis parcialmente implementados | Apenas 2 de 6 papéis da matriz têm arquivos dedicados (owner, admin). Demais são implícitos | Fase 7 |
| D5 | Taxonomia restante | "Club" sem "dos Chefes" em nomes de arquivo e rotas (`/chefclub/`, `ChefClub*.tsx`) — aceitável como interno | N/A (intencional) |

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
| 2026-07-28 | 7.0 | Fase 5.6 CONCLUÍDA com ressalvas. Taxonomia corrigida (60 ocorrências). Dívida técnica registrada (5 itens). Fase 6 reestruturada com 6.0 SaaS Core Implementation (5 subfases). |
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
