# TD-001 B3.4 — Plano Tecnico: FinanceProvider

> **Status:** PLANO — NAO IMPLEMENTAR
> **Data:** 2026-08-20
> **Autor:** opencode (big-pickle)
> **Gate:** Aguardando aprovacao do PO

---

## 1. Contexto

### O que B3.3 conectou

```
Evento financeiro
  -> FinanceSubscriber (subscribeAll)
    -> DefaultFinanceStrategy (map event -> FinanceOperation[])
      -> Outbox.enqueue(operation)
        -> Dispatcher.dispatchAll()
          -> consoleProvider.deliver() (log only)
```

### O que B3.4 precisa fazer

Registrar o **FinanceProvider** como `DispatcherProvider` no dispatcher. O FinanceProvider recebe itens do Outbox, parseia a operacao, e **executa** a acao financeira correspondente.

### Problema central: duplicacao

**Todas as 6 operacoes mapeadas pela Strategy ja sao executadas sincronamente pelos Application Services ANTES do evento ser publicado:**

| Operacao | Quem ja executa | RPC existente | Evento publicado depois |
|----------|----------------|---------------|------------------------|
| `create_transaction` | `CheckoutApplicationService.settleComanda()` | `finance_settle_comanda` | `CheckoutCompleted` |
| `create_commission_record` | `CommissionSubscriber` (B1) + `closeBarberCash()` | Calculo local + `barber_closings` | `CashClosingCompleted` |
| `reverse_commission` | `reverseCommissionHandler` (B2) | `calculateCommissionReversal()` | `CheckoutReverted` |
| `reverse_revenue` | `CheckoutApplicationService.reverseCheckout()` | `finance_reverse_transaction` | `CheckoutReverted` |
| `deduct_credits` | `CheckoutApplicationService.deductChefClubCredits()` | `deduct_chef_club_credits` | `CreditsDeducted` |
| `close_daily_cash` | `closeCashRegister()` | `transactionRepository.createBulk` | `CashClosingCompleted` |

**Se o FinanceProvider simplesmente chamar esses RPCs novamente, teremos transacoes, comissoes e estornos DUPLICADOS em producao.**

---

## 2. Opcoes de Arquitetura

### Opcao A — FinanceProvider como No-Op Logger (Segura)

O FinanceProvider registra que a operacao foi recebida mas **nao executa** nenhuma acao financeira.

```
Application Service -> RPC financeiro (execucao real)
                   -> Evento publicado
                     -> FinanceSubscriber -> Outbox -> FinanceProvider -> LOG
```

| Vantagem | Desvantagem |
|----------|-------------|
| Zero risco de duplicacao | FinanceProvider nao faz nada util |
| Nao altera fluxo existente | Operacoes no Outbox sao desperdicio |
| Rollback trivial | Sem valor real para B3.4 |

### Opcao B — Deferred Execution (Arquiteturalmente correta)

Mover a execucao financeira PARA o FinanceProvider. Os Application Services publicam o evento **sem** executar o RPC financeiro.

```
Application Service -> Evento publicado (sem RPC)
  -> FinanceSubscriber -> Outbox -> FinanceProvider -> RPC financeiro (execucao real)
```

| Vantagem | Desvantagem |
|----------|-------------|
| Fonte unica de verdade financeira | Requer refatorar Application Services |
| Execucao asincrona e retryavel | Timing: transaction pode atrasar |
| Observabilidade centralizada | Risco de race conditions |
| Idempotencia via Outbox | Migrar fluxo existente e complexo |

### Opcao C — Hibrida (Recomendada para B3.4)

Manter execucao sincrona para operacoes que ja funcionam. Mover para deferred apenas operacoes que sao genuinamente novas:

| Operacao | Decisao | Motivo |
|----------|---------|--------|
| `create_transaction` | **SKIP** | Transacao ja criada por settlement |
| `create_commission_record` | **DEFERRED (novo)** | Comissao por comanda isolada nao existe |
| `reverse_commission` | **DEFERRED (existe handler)** | `reverseCommissionHandler` pronto |
| `reverse_revenue` | **SKIP** | Reversao ja criada por reversal |
| `deduct_credits` | **SKIP** | Creditos ja deduzidos por checkout |
| `close_daily_cash` | **SKIP** | Fechamento ja executado por cashClosing |

---

## 3. Decisao Recomendada: Opcao C (Hibrida)

### 3.1 Operacoes que o FinanceProvider EXECUTA

#### `create_commission_record` — NOVO

**O que nao existe hoje:** Nao ha uma operacao isolada que, dado um `CheckoutCompleted`, calcule e registre a comissao do profissional. Hoje isso acontece:
- Em `closeBarberCash()` — calcula comissao de TODAS as comandas do dia
- No `CommissionSubscriber` (B1) — apenas calcula e publica `CommissionCalculated`, nao persiste

**O que B3.4 faz:** Cria o registro de comissao para UMA comanda especifica, imediatamente apos o checkout.

**Handler flow:**
1. Verificar se staff tem `commission_rate > 0`
2. Calcular: `commissionValue = receivedValue x (commissionRate / 100)`
3. Persistir em nova tabela `commission_records`
4. Retornar success

**Tabela necessaria:** `commission_records` (nao existe — precisa migration)

**Schema proposto:**
```sql
CREATE TABLE IF NOT EXISTS commission_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  comanda_id UUID NOT NULL,
  staff_id UUID NOT NULL REFERENCES staff(id),
  client_id UUID,
  received_value NUMERIC NOT NULL,
  commission_rate NUMERIC NOT NULL,
  commission_value NUMERIC NOT NULL,
  payment_method TEXT,
  has_club_credit BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending',
  source_event TEXT,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key)
);
```

#### `reverse_commission` — EXISTENTE

**Handler ja existe:** `reverseCommissionHandler.ts` (FIX-001 G2).

**O que falta:** Implementacao de `ReverseCommissionRepository` que insere em `financial_reversals` com `reversal_type = 'commission_adjustment'`.

### 3.2 Operacoes que o FinanceProvider NAO executa (SKIP)

Cada operacao skip segue o mesmo padrao:

```typescript
execute: async (data, context) => {
  console.log(`[FINANCE_PROVIDER] SKIP ${op} — already executed (${context.sourceEvent})`);
  return { success: true };
}
```

Retorno `{ success: true }` para que o item do Outbox seja marcado como `published`, nao `failed`.

---

## 4. Mapa Completo de Operacoes

| # | OperationType | Strategy mapeia | FinanceProvider executa | RPC/Repository | Risco |
|---|--------------|-----------------|------------------------|----------------|-------|
| 1 | `create_transaction` | sim | SKIP (log) | — | Baixo |
| 2 | `create_commission_record` | sim | **NOVO** | Nova tabela `commission_records` | **Alto** |
| 3 | `reverse_commission` | sim | EXISTENTE | `financial_reversals` | Medio |
| 4 | `reverse_revenue` | sim | SKIP (log) | — | Baixo |
| 5 | `deduct_credits` | sim | SKIP (log) | — | Baixo |
| 6 | `close_daily_cash` | sim | SKIP (log) | — | Baixo |

---

## 5. Contratos dos Handlers

### 5.1 `create_commission_record` (NOVO — Requer Migration)

**Entrada (FinanceOperation.data):**
```typescript
{
  tenantId: string;
  comandaId: string;
  clientId: string;
  staffId: string;
  receivedValue: number;      // FIX-001: effectively received
  paymentMethod: string;
  hasClubCredit: boolean;
}
```

**Execucao:**
1. Buscar `commission_rate` do staff na tabela `staff`
2. Se `commission_rate = 0` ou staff nao encontrado -> skip
3. Calcular: `commissionValue = receivedValue x (commissionRate / 100)`
4. Persistir com `ON CONFLICT (tenant_id, idempotency_key) DO NOTHING`
5. Retornar `{ success: true }`

### 5.2 `reverse_commission` (EXISTENTE)

**Entrada:**
```typescript
{
  tenantId: string;
  comandaId: string;
  originalCommission: number;
  reversedAmount: number;
  originalReceivedValue: number;
  commissionReversal: number;  // pre-calculado pela Strategy
}
```

**Execucao:** Delega para `reverseCommissionHandler` -> persiste em `financial_reversals`.

**Repositorio necessario:** Implementacao de `ReverseCommissionRepository` usando `financial_reversals` table.

### 5.3 Operacoes SKIP (log only)

```typescript
execute: async (data, context) => ({
  success: true  // Already executed upstream
})
```

---

## 6. Idempotencia

### Camada 1: FinanceProvider (In-Memory)
`InMemoryIdempotencyStore` — ja existe. Para dev/test.

### Camada 2: FinanceProvider (Persistent) — Producao
Tabela `processed_operations` ja existe (`20260723110000_processed_operations.sql`):
```sql
UNIQUE (tenant_id, idempotency_key)
```

### Camada 3: RPCs com Idpropria
| RPC | Mecanismo |
|-----|-----------|
| `finance_settle_comanda` | UNIQUE index na `transactions` |
| `finance_reverse_transaction` | UNIQUE index na `financial_reversals` |
| `deduct_chef_club_credits` | Nenhum (risco) |

### Fluxo combinado
```
Outbox item
  -> FinanceProvider: processed_operations check
    -> Handler executa
      -> RPC: idempotencia propria
        -> Sucesso -> processed_operations mark
```

---

## 7. Tratamento de Erro

### Erro no Handler
Handler retorna `{ success: false, error }` -> Dispatcher marca item como `failed`.

### Retry (ja implementado no Outbox)
- `baseDelayMs`: 5000
- Backoff exponencial: `baseDelay x 2^(attempts-1)`
- `maxAttempts`: 5
- Apos 5 falhas -> `dead_letter`

### Erros que NAO devem ser retentados
| Erro | Acao |
|------|------|
| `Missing required field` | `success: false` -> dead letter |
| `Invalid data` | `success: false` -> dead letter |
| `Staff not found` | `success: true` (skip, no commission) |

### Erros que DEVEM ser retentados
| Erro | Acao |
|------|------|
| `Connection timeout` | Retry com backoff |
| `Supabase 503` | Retry com backoff |
| `Lock conflict` | Retry apos delay |

---

## 8. Atomicidade

### Operacao unica (SKIP handlers)
Atomicidade trivial — somente log.

### `create_commission_record`
Operacao unica: INSERT com UNIQUE constraint. Se duplicado, `ON CONFLICT DO NOTHING`.

### `reverse_commission`
Operacao unica: INSERT em `financial_reversals` com UNIQUE constraint.

### Multi-operacao (futuro)
Se B3.4 evoluir para Opcao B (deferred execution completa), precisara de transaction wrapping:
```sql
BEGIN;
  INSERT INTO transactions (...);
  INSERT INTO commission_records (...);
COMMIT;
```

---

## 9. Observabilidade

### Logs estruturados por operacao
```typescript
[FINANCE_PROVIDER] Executing ${operationType} for ${sourceEvent} (${eventId})
[FINANCE_PROVIDER] SKIP ${operationType} — already executed
[FINANCE_PROVIDER] SUCCESS ${operationType} (${idempotencyKey})
[FINANCE_PROVIDER] FAILED ${operationType}: ${error}
```

### Metricas (futuro — Fase 3.5 observability)
- `finance_provider_executions_total` (counter por operationType)
- `finance_provider_duration_ms` (histogram)
- `finance_provider_errors_total` (counter por operationType + error type)
- `outbox_dead_letter_total` (gauge)

---

## 10. Protecao contra Execucao Duplicada

| Camada | Mecanismo | Protege contra |
|--------|-----------|----------------|
| Outbox `findNext()` | `status = 'pending' AND (nextRetryAt IS NULL OR nextRetryAt <= now())` | Dispatch duplicado simultaneo |
| FinanceProvider | `processed_operations` UNIQUE index | Re-execucao apos restart |
| RPCs | UNIQUE indexes em tabelas alvo | Insercao duplicada |
| `ON CONFLICT DO NOTHING` | Database constraint | Race condition |

---

## 11. Testes de Integracao

### Testes unitarios (por handler)
1. `create_commission_record` — happy path (staff com commission_rate > 0)
2. `create_commission_record` — staff sem commission_rate (skip)
3. `create_commission_record` — idempotencia (re-execute same key)
4. `create_commission_record` — dados invalidos (reject)
5. `reverse_commission` — happy path (proportional)
6. `reverse_commission` — full refund (100%)
7. `reverse_commission` — zero reversal (skip)
8. SKIP handlers — always return success

### Testes de integracao (Outbox -> Dispatcher -> FinanceProvider)
1. CheckoutCompleted event -> FinanceSubscriber enqueues -> FinanceProvider executes -> item published
2. FinanceProvider com handler que falha -> item marcado failed -> retry
3. FinanceProvider com handler duplicado -> idempotencia detecta -> skip
4. FinanceProvider com operacao desconhecida -> retorna erro

### Testes E2E (futuro)
1. Checkout real -> transacao criada -> comissao registrada no `commission_records`
2. Reversao real -> comissao revertida no `financial_reversals`
3. Dead letter inspection -> operacao investigada

---

## 12. Estrategia de Rollback

### Rollback do B3.4 (se necessario)
1. Remover `financeProvider` do `dispatcher.registerProvider()` no `eventInfrastructure.ts`
2. Operacoes voltam a ser processadas pelo `consoleProvider`
3. Nenhum dado financeiro afetado (handlers sao novos)
4. `commission_records` table pode ser dropada se nao ha dados

### Rollback de dados (se operacao causou dano)
1. `commission_records`: DELETE por `idempotency_key` (afeta somente registros novos)
2. `financial_reversals`: reversao ja tem `finance_reverse_transaction` com validacao cumulativa
3. NENHUM rollback automatico — sempre manual e auditado

---

## 13. Criterios de Producao

### Pre-requisitos
- [ ] Migration `commission_records` aplicada
- [ ] `processed_operations` table confirmada
- [ ] `create_commission_record` handler implementado e testado
- [ ] `reverse_commission` handler implementado com repository
- [ ] SKIP handlers implementados e testados
- [ ] FinanceProvider registrado no dispatcher
- [ ] Testes unitarios passando (100% coverage nos handlers)
- [ ] Testes de integracao passando
- [ ] Build limpo, typecheck limpo
- [ ] Auditoria read-only aprovada

### Validacao em homologacao
- [ ] Checkout gera `CheckoutCompleted` -> FinanceProvider loga SKIP para `create_transaction`
- [ ] Checkout gera `CheckoutCompleted` -> FinanceProvider executa `create_commission_record`
- [ ] Reversao gera `CheckoutReverted` -> FinanceProvider executa `reverse_commission`
- [ ] Nenhuma transacao duplicada em `transactions`
- [ ] Nenhum estorno duplicado em `financial_reversals`

### Deploy
- [ ] Merge para main
- [ ] Vercel auto-deploy
- [ ] Smoke test em producao
- [ ] Monitorar logs por 24h

---

## 14. Riscos e Mitigacoes

| Risco | Severidade | Mitigacao |
|-------|-----------|-----------|
| `create_commission_record` causa comissao duplicada com `closeBarberCash` | **Alto** | Comission records com status `pending`, `closeBarberCash` confirma/ajusta |
| `reverse_commission` causa reversal duplicado | Medio | `processed_operations` idempotency check |
| `commission_records` migration falha | Medio | Migration e reversivel, testar em staging primeiro |
| SKIP handlers retornam success mas operacao nao foi executada | Baixo | Documentado: operacao ja executada upstream |
| Race condition entre FinanceProvider e Application Service | Baixo | UNIQUE constraints no banco |

---

## 15. Escopo do B3.4 (Resumo)

### INCLUIR
- [ ] FinanceProvider registrado no dispatcher (eventInfrastructure.ts)
- [ ] Handler `create_commission_record` com repository
- [ ] Handler `reverse_commission` com repository existente
- [ ] 4 SKIP handlers (log only)
- [ ] Migration `commission_records`
- [ ] Testes unitarios por handler
- [ ] Testes de integracao (outbox -> dispatcher -> provider)
- [ ] Auditoria read-only

### NAO INCLUIR
- Opcao B (deferred execution completa)
- Refatorar Application Services
- Alterar fluxo de settlement
- Alterar fluxo de reversal
- Alterar fluxo de credit deduction
- Deploy sem aprovacao explicita
