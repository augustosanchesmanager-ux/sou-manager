# Architecture Decisions — SMG Platform

> Documento consolidado de todas as decisões arquiteturais importantes. Referência rápida para onboarding técnico e revisões.
>
> **⚠ Roadmap Congelado** — A partir de 2026-07-24, nenhuma nova fase poderá ser criada.
> Somente evoluções documentadas por ADR são permitidas.

---

## Decisões Estratégicas (2026-07-24)

| # | Decisão | Status |
|---|---------|--------|
| D1 | Multi-Tenant é a prioridade (White Label cancelado) | ✅ |
| D2 | Glossário oficial (`docs/TAXONOMY.md`) | ✅ |
| D3 | Estrutura de domínios (`{produto}.soumanager.com`) | ✅ |
| D4 | Tenants — consolidar antes de implementar | ✅ |
| D5 | 5 ambientes (Development → Preview → Demo → Staging → Production) | ✅ |
| D6 | Business Architecture — fase documental antes de produção | ✅ |
| D7 | Responsabilidades — OpenCode (técnicos) + Augusto (comerciais) | ✅ |
| D8 | Nova forma de execução — 10 campos obrigatórios por fase | ✅ |
| D9 | Roadmap congelado — somente evoluções por ADR | ✅ |

---

## Índice

| # | Decisão | Resumo | ADR |
|---|---------|--------|-----|
| 1 | Event Driven | Publicação e reação a eventos de domínio | — |
| 2 | Outbox Pattern | Delivery confiável via fila com retry | — |
| 3 | Repository Pattern | Abstração de acesso a dados | — |
| 4 | Application Services | Orquestração de lógica de negócio | — |
| 5 | Replay Engine | Reconstrução de estado e migrações | — |
| 6 | Idempotência | Prevenção de processamento duplicado | — |
| 7 | RLS | Isolamento de dados via Row Level Security | — |
| 8 | Multi-Tenant | Arquitetura multi-tenant com isolamento | — |
| 9 | Sem Redux/Zustand | State management via React Context | — |
| 10 | Sem CQRS Completo | Separação leve sem duplicação total | — |
| 11 | Commission vs Settlement | Domínios financeiros distintos | ADR-001 |
| 12 | HashRouter | Navegação via hash para SPA no Vercel | — |
| 13 | Domain Only Events | Eventos sem dependência de React/Supabase | — |
| 14 | Finance Provider | Executor de operações financeiras via Outbox | — |
| 15 | Declarative Instrumentation | Observabilidade externa aos serviços | — |

---

## 1. Event Driven

**Decisão:** Publicar e reagir a eventos de domínio via Event Bus.

**Por quê:**
- Desacoplamento entre serviços (publishers não conhecem subscribers)
- Extensibilidade (adicionar subscriber sem modificar publisher)
- Auditabilidade (event store registra tudo que aconteceu)
- Reconstrução de estado (replay engine)
- Base para operações financeiras assíncronas

**Alternativas consideradas:**
- Chamadas diretas entre serviços → acoplamento demais
- Message queue externa (RabbitMQ, Kafka) → complexidade prematura
- Polling → ineficiente e não escalável

**Resultado:** `domain/events/` — InMemoryEventBus, EventStore, 11 tipos de eventos, 6 subscribers.

---

## 2. Outbox Pattern

**Decisão:** Usar Outbox Pattern para delivery confiável de eventos.

**Por quê:**
- Garante que eventos não são perdidos mesmo com falhas
- Retry com exponential backoff
- Dead letter para eventos que não conseguem ser processados
- Idempotência nativa
- Foundation para Finance Provider

**Alternativas consideradas:**
- Publish direto → risco de perda de eventos
- Transactional outbox no banco → complexidade de implementação
- CDC (Change Data Capture) → complexidade prematura

**Resultado:** `domain/events/outbox/` — OutboxRepository, Dispatcher, 4 providers, status lifecycle completo.

---

## 3. Repository Pattern

**Decisão:** Usar Repository Pattern com DI (DatabaseClient) para acesso a dados.

**Por quê:**
- Testabilidade (mock de repositories)
- Abstração do Supabase (facilidade de trocar backend)
- Separação de responsabilidades (domain não conhece infraestrutura)
- Padrão estabelecido e understandável

**Alternativas consideradas:**
- Acesso direto ao Supabase em services → acoplamento
- Active Record → mistura de domain com persistência
- Data Mapper completo → complexidade demais

**Resultado:** 9+ repositories com DatabaseClient injetado, `supabase-client-factory.ts` como único ponto de acesso.

---

## 4. Application Services

**Decisão:** Usar Application Services para orquestrar lógica de negócio.

**Por quê:**
- Separação entre UI e domain
- Orquestração de múltiplos repositories
- Transações e compensações centralizadas
- Padrão DDD recomendado

**Alternativas consideradas:**
- Lógica nos componentes React → difícil de testar
- Lógica nos repositories → repository fica complexo
- Use cases puros → difícil de gerenciar dependências

**Resultado:** CheckoutApplicationService, AppointmentApplicationService, CashClosingApplicationService, CommissionApplicationService, ChefClubApplicationService.

---

## 5. Replay Engine

**Decisão:** Implementar Replay Engine para reconstrução de estado.

**Por quê:**
- Migrações de dados via eventos
- Debugging de cenários complexos
- Reconstrução de estado após falhas
- Base para Event Versioning futuro

**Alternativas consideradas:**
- Re-excutar queries → não reproduz side effects
- CDC reverso → complexidade extrema
- Não implementar → perda de capacidade importante

**Resultado:** `domain/events/replayEngine.ts` — 10 filtros, dry-run, batch processing, progress callback, 31 testes.

---

## 6. Idempotência

**Decisão:** Implementar idempotência em todas as operações financeiras.

**Por quê:**
- Prevenção de processamento duplicado
- Retry seguro de operações
- Concorrência segura (INSERT → UNIQUE VIOLATION)
- Compliance financeiro

**Alternativas consideradas:**
- Controle de concorrência via locks → performance
- Versionamento de dados → complexidade
- Não implementar → risco financeiro

**Resultado:** `PersistentIdempotencyStore` com UNIQUE em `(tenant_id, idempotency_key)`, `InMemoryIdempotencyStore` para testes.

---

## 7. RLS (Row Level Security)

**Decisão:** Usar RLS do PostgreSQL para isolamento de dados.

**Por quê:**
- Isolamento no nível do banco (não depende da aplicação)
- Proteção contra SQL injection
- Superadmin bypass para administração
- Padrão Supabase recomendado

**Alternativas consideradas:**
- Filtro manual em queries → risco de esquecimento
- Views por tenant → complexidade de manutenção
- Schema separation → complexidade de migração

**Resultado:** 47 tabelas com RLS, `current_tenant_id_from_auth_uid()` como helper principal, superadmin bypass.

---

## 8. Multi-Tenant

**Decisão:** Arquitetura multi-tenant com isolamento via RLS.

**Por quê:**
- Modelo SaaS padrão
- Economia de infraestrutura
- Isolamento garantido pelo banco
- Escalabilidade horizontal

**Alternativas consideradas:**
- Database per tenant → custo alto
- Schema per tenant → complexidade de migração
- Shared database sem RLS → risco de vazamento

**Resultado:** Shared database, RLS por tenant_id, schema routing opcional (barber/auto/club).

---

## 9. Sem Redux/Zustand

**Decisão:** Usar React Context puro para state management.

**Por quê:**
- Complexidade do app não justifica lib externa
- Context já resolve provider nesting
- Menos dependências = menos manutenção
- Performance aceitável para o escopo atual

**Alternativas consideradas:**
- Redux → boilerplate excessivo para o tamanho do app
- Zustand → bom mas desnecessário
- Jotai/Recoil → atomic state não se encaixa no modelo

**Resultado:** AuthContext → TenantProvider → AppProvider → ThemeProvider.

---

## 10. Sem CQRS Completo

**Decisão:** Separação leve entre leitura e escrita, sem CQRS completo.

**Por quê:**
- CQRS completo duplica model
- A maioria dos queries são simples
- Read models podem ser otimizados via queries
- Complexidade não justificada pelo benefício

**Alternativas consideradas:**
- CQRS completo → duplicação de model
- Query objects → overhead para queries simples
- Materialized views → boa opção futura

**Resultado:** Repositories leem e escrevem, queries otimizadas via Supabase, views para dashboards.

---

## 11. Commission vs Settlement

**Decisão:** Manter Commission (teórica) e Settlement (pagamento efetivo) como domínios distintos.

**Por quê:**
- São perguntas diferentes com respostas diferentes
- Commission = quanto deveria ganhar
- Settlement = quanto realmente pagou
- Regras de negócio distintas

**Alternativas consideradas:**
- Unificar em um cálculo → perde semântica
- Usar apenas Settlement → perde rastreabilidade
- Usar apenas Commission → não reflete realidade

**Resultado:** `domain/commission/` (teórico) vs `application/cashClosing/` (efetivo). ADR-001 documentado.

---

## 12. HashRouter

**Decisão:** Usar HashRouter em vez de BrowserRouter.

**Por quê:**
- Compatível com Vercel SPA (catch-all rewrite)
- Sem necessidade de configuração no servidor
- Funciona em qualquer hospedagem estática
- URL mais longa mas funcional

**Alternativas consideradas:**
- BrowserRouter → requer configuração no servidor
- MemoryRouter → sem URLs compartilháveis
- HashRouter é o padrão para SPAs estáticas

**Resultado:** `react-router-dom` com HashRouter, `vercel.json` com catch-all.

---

## 13. Domain Only Events

**Decisão:** Eventos viverem apenas no domain, sem dependência de React ou Supabase.

**Por quê:**
- Domain deve ser puro (sem infraestrutura)
- Testabilidade (testes de eventos não precisam de mocks)
- Reutilizabilidade (eventos podem ser usados em qualquer contexto)
- Preparação para event sourcing futuro

**Alternativas consideradas:**
- Eventos no application → acoplamento
- Eventos no infra → domain não pode usar
- Eventos misturados → confusão

**Resultado:** `domain/events/` — zero imports de React ou Supabase.

---

## 14. Finance Provider

**Decisão:** Criar Finance Provider como executor de operações financeiras via Outbox.

**Por quê:**
- Separação entre decisão (subscriber) e execução (provider)
- Retry e dead letter automáticos
- Idempotência nativa
- Auditabilidade completa

**Alternativas consideradas:**
- Execução direta no subscriber → sem retry
- Transactional outbox manual → complexidade
- Filas externas → dependência de infraestrutura

**Resultado:** `domain/events/outbox/providers/financeProvider.ts` — 6 tipos de operação, handler injetável.

---

## 15. Declarative Instrumentation

**Decisão:** Instrumentação declarativa de serviços (externa ao código do serviço).

**Por quê:**
- Serviços não precisam ser modificados
- Config centralizada
- Fácil de adicionar/remover instrumentação
- Separação de concerns

**Alternativas consideradas:**
- Decorators → não suportados nativamente em TS
- Middleware → acoplamento
- Modificação direta dos serviços → violação de SRP

**Resultado:** `src/lib/observability/config.ts` — `instrumentService()` wrapping métodos externamente.

---

## Referências

- `docs/adr/ADR-001-Commission-vs-Settlement.md` — ADR oficial
- `ROADMAP.md` — Roadmap do projeto
- `AGENTS.md` — Instruções para sessões de código
- `tests/README.md` — Convenções de teste

---

## Mudanças

| Data | Versão | Alteração |
|------|--------|-----------|
| 2026-07-23 | 1.0 | Criação do documento consolidado |
