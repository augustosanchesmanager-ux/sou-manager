# TD-001 B3.4 — Matriz de Execucao Financeira

> **Status:** DOCUMENTO DE ANALISE — NAO IMPLEMENTAR
> **Data:** 2026-08-20
> **Gate:** B3.4 Plano Tecnico — revisao de contratos

---

## 1. Matriz de Execucao

| # | Operacao | Executada hoje? | Executor atual | FinanceProvider | Idempotencia | Pode duplicar? | Decisao |
|---|----------|----------------|----------------|-----------------|--------------|----------------|---------|
| 1 | `create_transaction` | SIM | `CheckoutApplicationService.settleComanda()` via RPC `finance_settle_comanda` | SKIP | UNIQUE `(tenant_id, idempotency_key)` na `transactions` | NAO (constraint ativa) | **SKIP** |
| 2 | `create_commission_record` | **NAO** | Nenhuma tabela per-comanda existe | EXECUTAR (novo) | **SEM CONSTRAINT** | **SIM — SEM PROTECAO** | **BLOQUEADO** |
| 3 | `reverse_commission` | **NAO** | `reverseCommissionHandler` existe mas nao e chamado | EXECUTAR (handler existe) | **SEM TABELA** | **SIM — SEM PROTECAO** | **BLOQUEADO** |
| 4 | `reverse_revenue` | SIM | `CheckoutApplicationService.reverseCheckout()` via RPC `finance_reverse_transaction` | SKIP | UNIQUE `(tenant_id, idempotency_key)` na `financial_reversals` | NAO (constraint ativa) | **SKIP** |
| 5 | `deduct_credits` | SIM | `CheckoutApplicationService.deductChefClubCredits()` via RPC `deduct_chef_club_credits` | SKIP | **SEM idempotency key no RPC** | **SIM (risco existente)** | **SKIP** |
| 6 | `close_daily_cash` | SIM | `closeCashRegister()` via `transactionRepository.createBulk` + `barberClosingRepository.upsert` | SKIP | UNIQUE `(tenant_id, cash_closing_id, staff_id)` na `barber_closings` | NAO (upsert) | **SKIP** |

---

## 2. Detalhamento por Operacao

### 2.1 `create_transaction`

**Caminho de execucao:**
```
CheckoutApplicationService.finish()
  -> settleComanda()
    -> settleCheckoutComanda()
      -> RPC finance_settle_comanda()
        -> INSERT INTO transactions (...)
```

**Arquivos:**
- `application/checkout.ts:556` — chama `settleCheckoutComanda()`
- `src/lib/finance/settlement.ts:82` — chama RPC `finance_settle_comanda`
- `supabase/migrations/20260510000000_create_transactions_table.sql:3` — tabela

**Idempotency key:** `finance-settle-${comandaId}-${randomUUID}` (formato na camada TS)
- Cada invocacao gera UUID novo -> key diferente
- RPC `finance_settle_comanda` tem `p_idempotency_key` como parametro
- UNIQUE index: `idx_transactions_tenant_idempotency_key` (linha 37-39)

**Constraint de protecao:**
```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_tenant_idempotency_key
ON public.transactions(tenant_id, idempotency_key)
WHERE idempotency_key IS NOT NULL;
```

**Pode duplicar?** NAO — o RPC tem validacao interna (checa status da comanda antes de criar). O UNIQUE index na tabela `transactions` impede insercao duplicada com mesma key.

**Decisao:** SKIP — transacao ja criada antes do evento.

---

### 2.2 `create_commission_record`

**Caminho de execucao HOJE:** NENHUM per-comanda.

**O que existe:**
1. `CommissionSubscriber` (`domain/events/subscribers/commissionSubscriber.ts:97`) — calcula comissao e publica evento `CommissionCalculated`, mas **NAO persiste nada**
2. `closeBarberCash()` (`application/cashClosing/operations.ts:149`) — calcula comissao de TODAS as comandas do dia e faz UPSERT em `barber_closings` (aggregate per-barber, per-day)

**Tabela `barber_closings`:**
- Granularidade: **per-barber, per-day** (NAO per-comanda)
- Constraint: `UNIQUE (tenant_id, cash_closing_id, staff_id)` (linha 48)
- Campo `commission_total` e um AGGREGADO diario

**Nao existe:**
- Nenhuma tabela `commission_records` per-comanda
- Nenhuma constraint de unicidade por comanda
- Nenhum idempotency key para comissao individual

**Pode duplicar?** **SIM — SEM PROTECAO ALGUMA.** Se o FinanceProvider criar um registro de comissao per-comanda e o mesmo evento for processado 2 vezes, teremos 2 registros de comissao para a mesma comanda.

**Decisao:** **BLOQUEADO** — requer:
1. Tabela `commission_records` com schema aprovado
2. Constraint `UNIQUE (tenant_id, comanda_id)` OU `UNIQUE (tenant_id, idempotency_key)`
3. Definicao da fonte oficial do valor da comissao
4. Aprovacao do PO sobre modelo de dados

---

### 2.3 `reverse_commission`

**Caminho de execucao HOJE:** NENHUM ativo.

**O que existe:**
- `reverseCommissionHandler.ts` (`domain/events/outbox/providers/reverseCommissionHandler.ts:65`) — handler implementado com `calculateCommissionReversal()`
- Interface `ReverseCommissionRepository` definida (linha 41) mas **sem implementacao concreta**
- Handler **nao e registrado** em nenhum dispatcher

**Tabela alvo:** `financial_reversals`
- Constraint: `UNIQUE (tenant_id, idempotency_key) WHERE idempotency_key IS NOT NULL`
- `reversal_type` tem CHECK constraint com 6 valores (linha 13-21): `wrong_settlement`, `full_refund`, `partial_refund`, `duplicate_charge`, `administrative_cancellation`, `financial_review`
- **`commission_adjustment` NAO esta na lista** — precisaria de ALTER TABLE

**Pode duplicar?** **SIM — SEM PROTECAO.** Nao ha implementation de repository, nao ha insert na tabela, nao ha constraint aplicavel.

**Decisao:** **BLOQUEADO** — requer:
1. Implementacao de `ReverseCommissionRepository`
2. Decisao sobre `reversal_type` para commission (adicionar ao CHECK ou usar tabela separada)
3. Validacao de atomicidade (reversal + commission record na mesma transacao?)

---

### 2.4 `reverse_revenue`

**Caminho de execucao:**
```
CheckoutApplicationService.reverseCheckout()
  -> reverseFinancialTransaction()
    -> RPC finance_reverse_transaction()
      -> INSERT INTO financial_reversals (...)
      -> INSERT INTO transactions (type='expense', ...)
```

**Arquivos:**
- `src/lib/finance/reversal.ts:91` — chama RPC `finance_reverse_transaction`
- `supabase/migrations/20260515210114_financial_reversals_schema.sql:6` — tabela

**Idempotency key:** `finance-reversal-${originalTransactionId}-${randomUUID}`
- UNIQUE index: `idx_financial_reversals_tenant_idempotency` (linha 33-35)

**Constraint de protecao:**
```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_financial_reversals_tenant_idempotency
ON public.financial_reversals(tenant_id, idempotency_key)
WHERE idempotency_key IS NOT NULL;
```

**Pode duplicar?** NAO — RPC tem validacao interna (checa `available = original.amount - SUM(reversals)`). UNIQUE index impede insercao duplicada.

**Decisao:** SKIP — reversao ja criada antes do evento.

---

### 2.5 `deduct_credits`

**Caminho de execucao:**
```
CheckoutApplicationService.deductChefClubCredits()
  -> RPC deduct_chef_club_credits({
       p_subscription_id,
       p_service_id,
       p_amount: 1,
       p_reference: `Comanda #${comandaId} - ${name}`
     })
```

**Arquivo:**
- `application/checkout.ts:631` — chama RPC

**Idempotency:** **NENHUMA.**
- RPC `deduct_chef_club_credits` NAO tem parametro `p_idempotency_key`
- Nao ha UNIQUE index que previna deducao duplicada por comanda
- O campo `reference` e somente descritivo, nao usado para deduplicacao

**Pode duplicar?** **SIM — RISCO REAL.** Se o mesmo CheckoutCompleted for processado 2 vezes com creditos, os creditos serao deduzidos 2 vezes. Esse risco JA EXISTE hoje no fluxo sincrono.

**Observacao:** Esse e um risco PRE-EXISTENTE, nao introduzido pelo B3.4. O FinanceProvider SKIP apenas reflete que a deducao ja aconteceu.

**Decisao:** SKIP (risco pre-existente, nao e escopo do B3.4 resolver).

---

### 2.6 `close_daily_cash`

**Caminho de execucao:**
```
closeCashRegister()
  -> transactionRepository.createBulk() (sangria/suprimento)
  -> cashClosingRepository.confirmClosing()
  -> barberClosingRepository.upsert() (per-barber)
  -> EventBus.publish(CashClosingCompleted)
```

**Arquivo:**
- `application/cashClosing/operations.ts:66` — `closeCashRegister()`

**Idempotency:** UPSERT pattern.
- `barber_closings`: `UNIQUE (tenant_id, cash_closing_id, staff_id)` — impede duplicacao per-barber
- `cash_closings`: status update (nao insert) — idempotente por design

**Pode duplicar?** NAO — upsert + status update sao idempotentes.

**Decisao:** SKIP — fechamento ja executado antes do evento.

---

## 3. Resposta a Pergunta Critica

> **Se o mesmo `CheckoutCompleted` for processado 2 vezes, exatamente o que impede a criacao de 2 registros de comissao?**

### Resposta: HOJE, NADA impede.

**Por que:**
1. Nao existe tabela `commission_records` per-comanda
2. `CommissionSubscriber` calcula e publica evento, mas **nao persiste**
3. `closeBarberCash()` agrega comissoes por-barber-per-day, nao por-comanda
4. Nao ha constraint de unicidade por comanda para comissao

### O que SERIA necessario para impedir:

**Opcao 1 — Constraint UNIQUE por comanda:**
```sql
CREATE TABLE commission_records (
  ...
  UNIQUE (tenant_id, comanda_id)  -- 1 comanda = 1 comissao
);
```
Se o mesmo evento processar 2x, o segundo INSERT seria rejeitado por UNIQUE violation.

**Opcao 2 — Idempotency key por evento:**
```sql
CREATE TABLE commission_records (
  ...
  idempotency_key TEXT,
  UNIQUE (tenant_id, idempotency_key)
);
```
O idempotency key seria `${eventId}_create_commission_record` (ja gerado pelo FinanceSubscriber).

**Opcao 3 — Ambas (defensiva):**
```sql
UNIQUE (tenant_id, comanda_id),        -- protecao por negocio
UNIQUE (tenant_id, idempotency_key)    -- protecao por evento
```

### Recomendacao: Opcao 3 (ambas)

- `UNIQUE (tenant_id, comanda_id)` — garante regra de negocio: 1 comanda = 1 comissao
- `UNIQUE (tenant_id, idempotency_key)` — garante idempotencia por evento: mesmo evento = mesma operacao

---

## 4. Gaps Identificados

| Gap | Operacao | Severidade | Resolucao |
|-----|----------|-----------|-----------|
| G1 | `create_commission_record` | **Critica** | Tabela `commission_records` + constraints |
| G2 | `reverse_commission` | **Alta** | Repository implementation + `reversal_type` para commission |
| G3 | `deduct_credits` | **Media** | Risco pre-existente — fora do escopo B3.4 |
| G4 | `create_commission_record` | **Alta** | Definir fonte oficial do valor da comissao |
| G5 | `create_commission_record` | **Alta** | Definir se `closeBarberCash` consolida ou substitui |

---

## 5. Gate de Seguranca

**B3.4 continua BLOQUEADO** ate que:

1. Schema `commission_records` seja aprovado com constraints corretas
2. Fonte oficial do valor da comissao seja definida (receivedValue vs total vs outro)
3. Relacao entre `commission_records` e `barber_closings` seja definida
4. `reverse_commission` tenha repository implementado com `reversal_type` aprovado
5. Testes de idempotencia sejam especificados

**Nenhuma dessas questoes e tecnica — todas sao de contrato de dominio.**
