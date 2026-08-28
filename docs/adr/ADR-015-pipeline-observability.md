# ADR-015: Pipeline Financeiro — Observabilidade Crítica

**Status:** PRODUCTION CERTIFIED (2026-08-28)
**Date:** 2026-08-27
**Deciders:** PO (Augusto) + OpenCode
**Prerequisite:** D7 Transactional Outbox ativo em produção (`4798ec1`)

---

## Context

### O que existe hoje

O SaaS possui uma infraestrutura de observabilidade em `src/lib/observability/` (7 arquivos, ~1500 linhas):

| Componente | Estado | Limitação |
|------------|--------|-----------|
| `logger.ts` (316 linhas) | ATIVO | Console output é DEV-only — silenciado em produção |
| `metrics.ts` (225 linhas) | ATIVO | Tudo em memória — perdido no refresh, sem persistência |
| `alerts.ts` (399 linhas) | DEFINIDO | `alerts.check()` nunca chamado — alertas nunca disparam automaticamente |
| `instrumentation.ts` (245 linhas) | ATIVO | Só envolve Application Services — domain infrastructure é cega |
| `config.ts` (153 linhas) | ATIVO | 20 métodos instrumentados (5 Application Services) |
| `events.ts` (233 linhas) | PARCIAL | `getEventDef()` e `validateEventData()` = dead code |
| `useObservability.ts` (67 linhas) | ATIVO | `usePageView()` = dead code |
| Dashboard `Observability.tsx` (469 linhas) | ATIVO | 8 tabs, auto-refresh 5s — mas lê dados que podem não existir |

### O pipeline financeiro

```
Checkout.settleComanda()           ← 🟢 OBSERVÁVEL (instrumented)
  │
  ▼
finance_settle_comanda_and_enqueue() ← 🟢 RPC validada
  │
  ▼
outbox_items (pending)             ← 🔴 INVISÍVEL
  │
  ▼ [5s dispatch loop]
Dispatcher.processItem()           ← 🔴 INVISÍVEL
  │
  ▼
FinanceProvider.deliver()          ← 🔴 INVISÍVEL
  │
  ▼
CommissionRecordHandler.execute()  ← 🔴 INVISÍVEL
  │
  ▼
commission_records                 ← 🔴 INVISÍVEL (outcome)
```

### O gap arquitetural

A instrumentação existente (`instrumentService` em `config.ts`) envolve **Application Services** — camada de orquestração. O pipeline financeiro abaixo de `Checkout.settle` opera em **domain infrastructure** (`domain/events/outbox/`), que não possui integração com a camada de observabilidade.

Todos os sinais do pipeline usam `console.log`/`console.error` diretamente. Nenhum toca `logger`, `metrics`, ou `alerts`.

### Riscos identificados

| # | Risco | Impacto | Detecção Atual |
|---|-------|---------|----------------|
| R1 | Dispatch loop morre por exceção não tratada | Comissões deixam de ser processadas silenciosamente | ❌ NENHUMA |
| R2 | Itens acumulam em `pending` (fila cresce) | Atraso crescente na criação de commission_records | ❌ NENHUMA |
| R3 | Itens ficam presos em `processing` | Recovery roda mas sem métrica/count | ⚠️ Parcial |
| R4 | Dead letters acumulam | Eventos financeiros perdidos permanentemente | ❌ NENHUMA |
| R5 | FinanceProvider falha Handler | commission_record não criada | ⚠️ console.error only |
| R6 | FinanceProvider recebe payload inválido | Operação silenciosamente ignorada | ❌ NENHUMA |
| R7 | Idempotency store DB error | Exceção não capturada mata dispatch cycle | ❌ NENHUMA |
| R8 | Correlação de IDs inconsistente | Impossível rastrear evento de ponta a ponta | ⚠️ Parcial |

**R1 é o mais perigoso:** uma exceção em `recoverStaleProcessing()` ou `dispatchAll()` mata o `setInterval` para sempre. Não existe watchdog, heartbeat, ou mecanismo de detecção. Se isso acontecer às 03:00, comissões param de ser processadas até alguém perceber —potencialmente dias.

---

## Decision

### Arquitetura em camadas

```
                    OBSERVABILIDADE DO PIPELINE
                            │
            ┌───────────────┼────────────────┐
            ▼               ▼                ▼
       CAMADA 1         CAMADA 2          CAMADA 3
    Instrumentação    Health Check      Persistência
            │               │                │
            ▼               ▼                ▼
        Métricas        Loop vivo?       Histórico
        Logs estrut.    Heartbeat        Consultável
            │               │                │
            └───────────────┼────────────────┘
                            ▼
                       CAMADA 4
                       Alertas
                            │
                            ▼
                     Operador / PO
```

### CAMADA 1 — Instrumentação do Pipeline

**Objetivo:** Cada componente do pipeline emite métricas e logs estruturados via `logger` e `metrics` (existentes).

**Componentes a instrumentar:**

| Componente | Métricas | Logs |
|------------|----------|------|
| `SupabaseOutbox.enqueue()` | `outbox_enqueue_count`, `outbox_enqueue_error` | enqueue success/failure com `eventId`, `tenantId` |
| `SupabaseOutbox.claim()` | `outbox_claim_count`, `outbox_claim_race` | claim success/race com `itemId` |
| `SupabaseOutbox.markPublished()` | `outbox_publish_count` | publish success com `itemId` |
| `SupabaseOutbox.markFailed()` | `outbox_fail_count`, `outbox_retry_count` | fail/retry com `itemId`, `error`, `attempt` |
| `SupabaseOutbox.moveToDeadLetter()` | `outbox_dead_letter_count` | dead letter com `itemId`, `error`, `attempts` |
| `SupabaseOutbox.recoverStaleProcessing()` | `outbox_stale_recovery_count` | recovery com `count` |
| `InMemoryDispatcher.dispatch()` | `dispatch_cycle_count`, `dispatch_success`, `dispatch_error` | cycle result com `itemsProcessed`, `duration` |
| `InMemoryDispatcher.processItem()` | `dispatch_item_count`, `dispatch_item_success`, `dispatch_item_error` | item result com `itemId`, `provider`, `duration` |
| `FinanceProvider.deliver()` | `finance_deliver_count`, `finance_deliver_success`, `finance_deliver_error`, `finance_deliver_skip` | deliver result com `operationType`, `itemId` |
| `CommissionRecordHandler.execute()` | `commission_record_created`, `commission_record_skipped`, `commission_record_error` | result com `staffId`, `comandaId`, `value` |

**Padrão de log:** Todos os logs incluem `eventId` + `tenantId` + `comandaId` quando disponível.

### CAMADA 2 — Health Check / Watchdog

**Objetivo:** Garantir que o dispatch loop está vivo e processando.

**Mecanismo:**

```
Dispatch loop (setInterval 5s)
  │
  ├── Dispatch cycle (como hoje)
  │
  └── Health heartbeat (NOVO)
       │
       ├── Grava timestamp do último cycle bem-sucedido
       ├── Se último cycle há > 30s: dispatch_stale
       ├── Se último cycle há > 120s: dispatch_dead (alerta crítico)
       └── try/catch em TODO o ciclo (exceção não mata o loop)
```

**Implementação:**

1. **Wrap total do dispatch cycle em try/catch** — exceção loga erro mas NÃO mata o `setInterval`
2. **Heartbeat metric** — `dispatch_heartbeat` (timestamp do último cycle OK)
3. **Watchdog metric** — `dispatch_loop_health` (gauge: 1=alive, 0=stale, -1=dead)
4. **Loop resilience** — `recoverStaleProcessing()` e `dispatchAll()` envolvidos individualmente em try/catch

### CAMADA 3 — Persistência

**Objetivo:** Métricas e logs do pipeline consultáveis após refresh e historicamente.

**Estratégia:** Não substituir o logger/metrics existente. Adicionar **persistência pontual** para métricas críticas do pipeline via `outbox_items` e `commission_records` (já existentes no banco).

**Métricas consultáveis via query SQL (não via memória):**

| Métrica | Fonte | Query |
|---------|-------|-------|
| Pending depth | `outbox_items` | `SELECT COUNT(*) WHERE status='pending'` |
| Processing count | `outbox_items` | `SELECT COUNT(*) WHERE status='processing'` |
| Dead letter count | `outbox_items` | `SELECT COUNT(*) WHERE status='dead_letter'` |
| Items por tenant | `outbox_items` | `GROUP BY tenant_id` |
| Processing latency | `outbox_items` | `AVG(updated_at - created_at) WHERE status='published'` |
| Commission success rate | `commission_records` | `COUNT(*) GROUP BY created_at::date` |
| Dispatch cycle health | `outbox_items` | `MAX(updated_at)` como proxy |

**Extensão do dashboard:** Tab "Pipeline" no `Observability.tsx` que consulta `outbox_items` e `commission_records` via Supabase.

### CAMADA 4 — Alertas

**Objetivo:** Notificar o operador quando o pipeline falha.

**Regras novas (adicionar a `alerts.ts`):**

| Regra | Métrica | Threshold | Severidade | Ação |
|-------|---------|-----------|------------|------|
| `dispatch_loop_dead` | `dispatch_loop_health` | < 0 por > 5min | **CRITICAL** | Webhook + console |
| `outbox_pending_depth_high` | `outbox_pending_depth` | > 50 por > 10min | **WARNING** | Console |
| `outbox_dead_letter_growing` | `outbox_dead_letter_count` | > 0 por > 5min | **CRITICAL** | Webhook + console |
| `outbox_stale_recovery_frequent` | `outbox_stale_recovery_count` | > 3 em 15min | **WARNING** | Console |
| `commission_record_gap` | `outbox_published_count` vs `commission_record_created_count` | diff > 0 por > 15min | **CRITICAL** | Webhook + console |
| `dispatch_cycle_failure_rate` | `dispatch_error` / `dispatch_cycle_count` | > 20% em 5min | **CRITICAL** | Webhook + console |
| `finance_provider_error_rate` | `finance_deliver_error` / `finance_deliver_count` | > 10% em 5min | **WARNING** | Console |
| `finance_provider_handler_missing` | `finance_deliver_skip` | > 0 por > 5min | **CRITICAL** | Webhook + console |

**Execução de `alerts.check()`:** Adicionar chamada periódica ao dispatch loop (a cada ciclo, após dispatch):

```
dispatch cycle
  → dispatchAll()
  → recoverStaleProcessing()
  → metrics.register pipeline depth
  → alerts.check()  ← NOVO
```

### Correlação padrão

**Reg:** Todo log/métrica do pipeline financeiro deve incluir:

```typescript
{
  eventId: string       // ID do evento domain (outbox_items.event_id)
  tenantId: string      // Multi-tenant context
  comandaId?: string    // Quando aplicável
  correlationId?: string // ID de correlação (do metadata do evento)
  operationType?: string // Tipo de operação financeira
}
```

**Onde propagar:**

| Ponto | IDs disponíveis | Ação |
|-------|----------------|------|
| `SupabaseOutbox.enqueue()` | `event.metadata.tenantId`, `event.id` | Adicionar ao log |
| `SupabaseOutbox.claim()` | `item.event_id`, `item.tenant_id` | Adicionar ao log |
| `Dispatcher.processItem()` | `item.event_id`, `item.tenant_id` | Propagar ao provider |
| `FinanceProvider.deliver()` | `item.event_id`, `item.tenant_id`, `operation.type` | Propagar ao handler |
| `CommissionRecordHandler` | `comandaId`, `staffId`, `tenantId` | Já inclui — adicionar `eventId` |

---

## Consequences

### O que muda

1. **Dispatch loop ganha resilience:** try/catch total + watchdog + heartbeat
2. **Pipeline inteiro emite métricas:** 12+ counters/gauges novos via `metrics` singleton
3. **Pipeline inteiro emite logs estruturados:** via `logger` (não mais `console.log` direto)
4. **Dashboard ganha tab "Pipeline":** consulta `outbox_items` + `commission_records` diretamente
5. **8 novas regras de alerta:** 4 CRITICAL + 4 WARNING
6. **`alerts.check()` executa:** a cada dispatch cycle (a cada 5s)
7. **Correlação padronizada:** `eventId` + `tenantId` em todo log do pipeline

### O que NÃO muda

- `logger.ts` — não sofre refatoração
- `metrics.ts` — não sofre refatoração
- `instrumentation.ts` — não sofre refatoração
- `config.ts` — não sofre refatoração
- Application Services existentes — não são re-instrumentados
- Dashboard existente — tabs atuais preservadas
- Dead code existente — não é removido nesta trilha
- `event_store` — não é alterado

### Escopo cirúrgico

```
ARQUIVOS A MODIFICAR:
  domain/events/outbox/inMemoryDispatcher.ts   — instrumentar dispatch cycle + watchdog
  domain/events/outbox/supabaseOutbox.ts        — instrumentar enqueue/claim/publish/fail/dead_letter
  domain/events/outbox/providers/financeProvider.ts — instrumentar deliver
  domain/events/outbox/providers/createCommissionRecordHandler.ts — padronizar correlação
  src/bootstrap/eventInfrastructure.ts          — try/catch + watchdog + alerts.check()
  src/lib/observability/alerts.ts               — 8 novas regras
  pages/Observability.tsx                       — tab "Pipeline" (consultas SQL)

ARQUIVOS NÃO ALTERADOS:
  logger.ts, metrics.ts, instrumentation.ts, config.ts, useObservability.ts
  application/*.ts (todos)
  domain/events/types.ts, bus.ts, memory-bus.ts, app-bus.ts
  domain/events/outbox/types.ts, outboxRepository.ts, dispatcher.ts
  domain/events/outbox/inMemoryOutbox.ts
  domain/events/subscribers/*.ts (todos)
```

### Critérios de sucesso

| Critério | Medida |
|----------|--------|
| Dispatch loop不死 | Exceção em qualquer parte do loop não mata `setInterval` |
| Heartbeat visível | `dispatch_heartbeat` metric atualizada a cada 5s |
| Pending depth rastreável | Query SQL返回pending count |
| Dead letter detectável | Alerta dispara quando dead letter > 0 |
| Correlação completa | Todo log inclui `eventId` + `tenantId` |
| Alertas funcionam | `alerts.check()` executa e dispara quando threshold excedido |
| Dashboard pipeline | Tab mostra métricas em tempo real |
| Zero regressão | Todos os testes existentes continuam passando |

### Riscos

| Risco | Mitigação |
|-------|-----------|
| Performance do dispatch loop degradada | Métricas são incrementos em memória — custo ~0 |
| Dashboard SQL queries lentas | Usar índices existentes em `outbox_items` (6 indexes) |
| `alerts.check()` a cada 5s consome CPU | Avaliar se 30s é suficiente — threshold dos alertas é em minutos |
| Muitos logs em produção | Usar `logger.business` que é DEV-only console — zero overhead em prod |

---

## Implementation Plan

### Fase 1 — Dispatch Loop Resilience (prioridade máxima)

**Objetivo:** O loop não pode morrer.

- Wrap `recoverStaleProcessing()` em try/catch
- Wrap `dispatchAll()` em try/catch
- Adicionar `dispatch_heartbeat` metric
- Adicionar `dispatch_loop_health` gauge
- Log de exceções via `logger.error`

### Fase 2 — Pipeline Instrumentation

**Objetivo:** Cada componente emite métricas e logs.

- `SupabaseOutbox`: enqueue, claim, publish, fail, dead_letter, stale recovery
- `InMemoryDispatcher`: cycle start/end, items processed, errors
- `FinanceProvider`: deliver success/failure/skip
- `CommissionRecordHandler`: create/skip/error

### Fase 3 — Correlação + Alerts

**Objetivo:** Logs correlacionados + alertas funcionando.

- Padronizar `eventId` + `tenantId` em todos os logs
- Adicionar 8 regras de alerta
- Executar `alerts.check()` no dispatch cycle
- Configurar webhook para alertas CRITICAL

### Fase 4 — Dashboard Pipeline

**Objetivo:** Visibilidade visual do pipeline.

- Tab "Pipeline" no `Observability.tsx`
- Consultas SQL diretas a `outbox_items` e `commission_records`
- Métricas: pending depth, processing count, dead letters, latency, success rate

---

## References

- ADR-007: Outbox Pattern (`docs/adr/ADR-007-outbox-pattern.md`)
- ADR-014: Transactional Outbox (`docs/adr/ADR-014-transactional-outbox.md`)
- Diagnostic: `src/lib/observability/` (7 files, ~1500 lines)
- Production pipeline: `4798ec1` / `dpl_41LFj5ar96Vqf6JASAtLMQHJZNbe`
