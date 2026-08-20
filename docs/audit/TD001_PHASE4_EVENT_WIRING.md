# TD-001: Phase 4 Event Infrastructure Runtime Wiring

> Dvida tecnica registrada durante FIX-001 (2026-08-20).
> **Nao e parte do FIX-001.** Escopo separado, tarefa propria.

---

## Status

**PENDENTE** -- Aguarda decisao do PO para inclusao em roadmap.

---

## Contexto

A infraestrutura de eventos da Phase 4 esta **totalmente construida e testada**, mas **desconectada do runtime da aplicacao**. Nenhum subscriber e registrado, nenhum dispatcher roda, nenhum outbox e processado em producao.

### O que existe (Phase 4 completa)

| Componente | Arquivo | Estado |
|------------|---------|--------|
| EventBus (pub/sub) | `domain/events/bus.ts`, `memory-bus.ts`, `app-bus.ts` | Pronto |
| Event Store (append-only) | `domain/events/eventStore.ts`, `inMemoryEventStore.ts` | Pronto |
| 11 tipos de eventos | `domain/events/types.ts` | Pronto |
| SubscriberRegistry | `domain/events/subscriber.ts` | Pronto |
| 6 read-only subscribers | `domain/events/subscribers/*.ts` | Pronto |
| FinanceSubscriber | `domain/events/subscribers/financeSubscriber.ts` | Pronto |
| CommissionSubscriber | `domain/events/subscribers/commissionSubscriber.ts` | Pronto |
| Outbox (retry + dead letter) | `domain/events/outbox/` | Pronto |
| Dispatcher + providers | `domain/events/outbox/dispatcher.ts`, `providers/*.ts` | Pronto |
| FinanceProvider (6 op types) | `domain/events/outbox/providers/financeProvider.ts` | Pronto |
| ReverseCommissionHandler | `domain/events/outbox/providers/reverseCommissionHandler.ts` | Pronto |
| ReplayEngine | `domain/events/replayEngine.ts` | Pronto |
| Testes | 43 arquivos, 976 testes | Passando |

### O que falta (runtime wiring)

Nenhum dos componentes acima e bootstrapado na aplicacao. Especificamente:

1. **SubscriberRegistry nunca e instanciado** em codigo de producao
2. **Nenhum subscriber e registrado** (analytics, audit, finance, commission, etc.)
3. **Nenhum dispatcher e criado ou executado** para processar itens do outbox
4. **Nenhum loop de processamento** existe (o dispatcher precisa rodar periodicamente)
5. **Nenhum shutdown/cleanup** esta implementado (para hot reload, HMR, etc.)

---

## Escopo da Tarefa

### 1. Bootstrap do EventBus

- Garantir que `appEventBus` singleton seja inicializado antes de qualquer publicacao
- Verificar se o Vite HMR causa multiplas instancias (singleton deve sobreviver ao HMR)
- Teste: publicar evento apos boot, verificar que subscribers recebem

### 2. Bootstrap dos Subscribers

- Criar arquivo de composicao (ex: `src/bootstrap/subscribers.ts`)
- Registrar todos os subscribers:
  - `analyticsSubscriber`
  - `auditSubscriber`
  - `notificationSubscriber`
  - `reminderSubscriber`
  - `marketingSubscriber`
  - `biSubscriber`
  - `financeSubscriber` (com strategy concreta -- ver item abaixo)
  - `commissionSubscriber`
- Chamar `registry.initialize()` apos registro
- Integrar no ciclo de vida da aplicacao (ex: `App.tsx` ou `main.tsx`)

### 3. FinanceStrategy Concreta

- Criar implementacao production-grade de `FinanceStrategy`
- Os 5 metodos (`mapCheckoutCompleted`, `mapCheckoutReverted`, `mapSubscriptionCancelled`, `mapCreditsDeducted`, `mapCashClosingCompleted`) precisam mapear eventos para `FinanceOperation[]` com dados reais do banco
- `mapCheckoutReverted` deve usar `originalCommission` e `originalReceivedValue` do evento (ja disponiveis no `CheckoutRevertedEvent` desde FIX-001)

### 4. Bootstrap do Outbox Dispatcher

- Criar instancia do `Dispatcher` com providers (finance, webhook, console)
- Implementar loop de processamento periodico (ex: `setInterval` a cada 5-10s)
- Ou usar Supabase Realtime para notificar quando ha itens pendentes
- Implementar graceful shutdown no `beforeunload`

### 5. Garantia de Inicializacao Unica

- Singleton pattern para `SubscriberRegistry` e `Dispatcher`
- Previna dupla inicializacao em:
  - React StrictMode (dev)
  - Vite HMR (hot module replacement)
  - Navegador com multiplas abas

### 6. Shutdown/Cleanup

- Cleanup de subscribers no unmount da aplicacao
- Cancelamento de intervals do dispatcher
- Flush de eventos pendentes antes de descarregar

### 7. Validacao de Execucao em Runtime

- Log confirmando que subscribers estao ativos
- Metricas de eventos publicados vs processados
- Alerta se dispatcher nao processou itens por >30s

### 8. E2E Test: Estorno -> CheckoutReverted -> reverse_commission

- Teste end-to-end que:
  1. Cria uma comanda paga com comissao
  2. Executa estorno financeiro
  3. Verifica que `CheckoutReverted` foi publicado
  4. Verifica que `FinanceSubscriber` criou operacao `reverse_commission`
  5. Verifica que `Dispatcher` processou a operacao
  6. Verifica que a comissao foi revertida proporcionalmente

---

## Dependencias

- FIX-001 deve estar commitado e mergeado (pre-requisito)
- FinanceStrategy concreta precisa ser implementada (nao existe em producao)
- FinanceProvider precisa de repositories injetados (TransactionRepository, CommissionRepository, etc.)

## Riscos

- **HMR double-init**: React StrictMode + Vite HMR podem causar bootstrap duplo
- **Dispatcher polling overhead**: Loop periodico consome recursos; considerar Realtime
- **Multi-tab conflicts**: Dispatcher rodando em multiplas abas pode causar race conditions no outbox
- **Supabase Realtime**: Se habilitado futuramente, pode causar event replay

## Estimativa

- 2-3 dias para bootstrap completo
- 1 dia para FinanceStrategy concreta
- 1 dia para E2E test
- Total: ~4-5 dias
