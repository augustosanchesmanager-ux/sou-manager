# TD-001 B3.4-A — Contrato de Dominio: Comissao

> **Status:** DOCUMENTO DE CONTRATO — NAO IMPLEMENTAR
> **Data:** 2026-08-20
> **Gate:** B3.4-A — Respostas fechadas para as 8 perguntas

---

## Pergunta 1: Qual e exatamente a base monetaria da comissao?

### Definicao formal

A comissao e calculada sobre o **valor efetivamente recebido** (`receivedValue`), NAO sobre o preco bruto do servico.

```
grossValue     = unit_price × quantity            (preco bruto do item)
discount       = min(item_discount, grossValue)   (desconto aplicado ao item)
netValue       = max(0, grossValue - discount)    (valor liquido apos desconto)
receivedValue  = min(netValue, paidAmount)         (valor efetivamente recebido)
commissionBase = receivedValue × participantShare  (base do profissional)
commission     = commissionBase × commissionRate   (comissao final)
```

### Fonte do codigo

- **Formula principal:** `domain/commission/calculate.ts:129` — `resolveFinancialBase()`
- **Taxa do profissional:** `domain/commission/calculate.ts:222` — `calculateCommissionValue()`
- **FIX-001:** Mudanca de `unit_price` para `receivedValue` ja implementada

### Valores que resultam em comissao zero

| Cenario | `receivedValue` | `zeroReason` | Comissao |
|---------|-----------------|-------------|----------|
| Clube do Chefe (creditos) | 0 | `clube_do_chefe` | R$ 0 |
| Cortesia (unit_price = 0) | 0 | `cortesia` | R$ 0 |
| Desconto integral (desconto >= grossValue) | 0 | `desconto_integral` | R$ 0 |
| Comanda nao paga | 0 | `comanda_nao_paga` | R$ 0 |
| Estorno integral | 0 | `estorno_integral` | R$ 0 |

**Nota:** `barber_closings.commission_total` usa formula SIMPLIFICADA: `totalReceived × commissionRate` (sem considerar participants/desconto por item). Isso e uma agregacao diaria, nao um registro per-comanda.

---

## Pergunta 2: Qual estrutura tera `commission_records`?

### Schema proposto

```sql
CREATE TABLE commission_records (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Referencia ao evento
  comanda_id      UUID NOT NULL,                    -- comanda que gerou a comissao
  comanda_item_id UUID,                             -- item especifico (nullable para v1)

  -- Profissional
  staff_id        UUID NOT NULL REFERENCES staff(id),
  
  -- Valores financeiros
  gross_value     NUMERIC(12,2) NOT NULL,           -- unit_price × quantity
  discount        NUMERIC(12,2) DEFAULT 0,          -- desconto aplicado
  net_value       NUMERIC(12,2) NOT NULL,           -- gross_value - discount
  received_value  NUMERIC(12,2) NOT NULL,           -- min(net_value, paidAmount)
  commission_rate NUMERIC(5,4) NOT NULL,            -- taxa do profissional (ex: 0.5000)
  commission_value NUMERIC(12,2) NOT NULL,          -- received_value × commission_rate

  -- Participant (execucao compartilhada)
  participant_share    NUMERIC(5,4) DEFAULT 1.0,    -- proporcao do profissional (0.0 - 1.0)
  payout_type          VARCHAR(20) DEFAULT 'percentage',
  affects_commission   BOOLEAN DEFAULT TRUE,

  -- Idempotencia e trilha
  idempotency_key  VARCHAR(255) NOT NULL,           -- {eventId}_{staffId}
  event_id         VARCHAR(255),                     -- ID do evento original
  event_type       VARCHAR(50),                      -- 'CheckoutCompleted'
  
  -- Status
  status           VARCHAR(20) DEFAULT 'active',    -- active | reversed
  reversed_at      TIMESTAMPTZ,
  reversal_id      UUID,                            -- FK para financial_reversals

  -- Metadata
  source           VARCHAR(50) DEFAULT 'CheckoutApplicationService',
  created_at       TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT commission_records_tenant_staff_comanda UNIQUE (tenant_id, staff_id, comanda_id),
  CONSTRAINT commission_records_tenant_idempotency  UNIQUE (tenant_id, idempotency_key)
);

-- RLS
ALTER TABLE commission_records ENABLE ROW LEVEL SECURITY;
```

### Constraints de protecao

| Constraint | Protege contra | Tipo |
|-----------|---------------|------|
| `UNIQUE (tenant_id, staff_id, comanda_id)` | 1 profissional + 1 comanda = 1 registro | Regra de negocio |
| `UNIQUE (tenant_id, idempotency_key)` | Mesmo evento processado 2x | Idempotencia |

### Granuralidade: 1 registro por profissional por comanda

Se uma comanda tem 3 itens todos executados pelo mesmo barbeiro, **1 registro** de comissao e criado (agregado). Se a comanda tem 2 profissionais distintos, **2 registros** sao criados.

**Decisao de design:** Para v1, `commission_records` e粒状 por `(staff_id, comanda_id)`. A granuralidade por `comanda_item_id` fica para v2 quando necessario.

---

## Pergunta 3: Uma comanda pode ter mais de uma comissao?

### Resposta: SIM, mas condicional

**Cenarios:**

| Cenario | Registros de comissao | Exemplo |
|---------|----------------------|---------|
| Solo (1 barbeiro) | **1 registro** | Barbeiro A executa todos os itens |
| Shared (2+ profissionais) | **N registros** (1 por profissional) | Barbeiro A faz corte, Barbeiro B faz barba |
| Clube do Chefe | **1 registro com valor 0** | Credito cobre o servico |
| Cortesia | **1 registro com valor 0** | Servico gratuito |
| Produto | **0 registros** (produtos NAO geram comissao) | Venda de pomada |

### Dados do evento `CheckoutCompleted` vs Realidade

**Problema identificado:** O evento `CheckoutCompleted` publica apenas `staffId: req.cart[0]?.staff_id` (primeiro item do carrinho). Para shared execution, isso e insuficiente.

**Solucao para B3.4:** O `FinanceSubscriber` precisa consultar `comanda_items` + `service_execution_participants` para obter a lista completa de profissionais antes de criar `commission_records`. O evento fornece o `comandaId`, e os dados detalhados estao no banco.

**Fluxo proposto:**
```
CheckoutCompleted evento (comandaId, total)
  -> query comanda_items WHERE comanda_id = comandaId
  -> query service_execution_participants WHERE comanda_item_id IN (items)
  -> para cada profissional distinto: criar 1 commission_record
```

---

## Pergunta 4: Como `commission_records` se relaciona com `barber_closings`?

### Relacao: complementar, nao substituivel

| Aspecto | `commission_records` (novo) | `barber_closings` (existente) |
|---------|---------------------------|------------------------------|
| **Granuralidade** | Per-profissional, per-comanda | Per-profissional, per-dia |
| **Quando cria** | No CheckoutCompleted (tempo real) | No fechamento de caixa (batch) |
| **Valor** | `receivedValue × participantShare × commissionRate` | `totalReceived × commissionRate` (agregado) |
| **Persiste** | INSERT na tabela | UPSERT no `barber_closing` |
| **Idempotencia** | UNIQUE constraint | UPSERT por `(cash_closing_id, staff_id)` |

### Como coexistem

1. **`commission_records`** = fonte de verdade per-comanda. Cada comanda paga gera um registro.
2. **`barber_closings`** = agregacao diaria para o fechamento de caixa. Consolida tudo do dia.
3. **`closeBarberCash()`** continua calculando `totalCommission` via formula `totalReceived × commissionRate` e salvando em `barber_closings.commission_total`.
4. **`commission_records`** NAO substitui `barber_closings`. Sao duas views do mesmo dado.

### Consistencia

Se `commission_records` for a fonte de verdade per-comanda, o `barber_closing.commission_total` pode ser recalculado como `SUM(commission_records.commission_value) WHERE staff_id = X AND date(created_at) = Y`. Mas para v1, mantemos a formula simplificada no `barber_closings` e usamos `commission_records` para auditoria e dashboard de comissao.

---

## Pergunta 5: Como uma comissao e revertida?

### Fluxo de reversao

```
1. CheckoutReverted evento (ou acao manual)
  -> finance_reverse_transaction (ja existe, gera financial_reversal)
  -> finance_reverse_commission (novo, gera commission_record reversal)

2. Para cada commission_record ativo da comanda:
  -> calculateCommissionReversal(originalCommission, reversedAmount, originalReceivedValue)
  -> proportion = reversedAmount / originalReceivedValue
  -> reversalAmount = originalCommission × proportion

3. Criar registro em commission_records:
  -> status = 'reversed'
  -> reversed_at = NOW()
  -> reversal_id = financial_reversal.id

4. OU: criar um novo commission_record com commission_value negativo
  -> status = 'active'
  -> commission_value = -reversalAmount
  -> reversal_id = financial_reversal.id
```

### Fonte do codigo

- **Formula de reversao:** `domain/commission/calculate.ts:101` — `calculateCommissionReversal()`
- **Handler existente:** `domain/events/outbox/providers/reverseCommissionHandler.ts:65` — `calculateCommissionReversal()` (calcula mas NAO persiste)

### Decisao de design

**Para v1:** Usar abordagem **mark-and-reversal** — atualizar `commission_records.status = 'reversed'` e criar registro novo com valor negativo. Isso preserva a auditoria e permite calcular o saldo liquido.

```sql
-- Reversao parcial: atualizar existente + criar novo com valor negativo
UPDATE commission_records SET status = 'reversed', reversed_at = NOW(), reversal_id = $reversalId
WHERE tenant_id = $tenantId AND comanda_id = $comandaId AND staff_id = $staffId AND status = 'active';

INSERT INTO commission_records (..., commission_value = -$reversalAmount, status = 'active', reversal_id = $reversalId);
```

---

## Pergunta 6: Como o sistema distingue uma nova comissao de um replay do mesmo evento?

### Mecanismo: idempotency_key

```typescript
// No FinanceSubscriber, ao criar commission_record:
const idempotencyKey = `${eventId}_${staffId}`;
```

**Exemplo:**
- Evento `CheckoutCompleted` com `eventId = "evt_123"`
- Barbeiro A (`staffId = "staff-456"`)
- `idempotencyKey = "evt_123_staff-456"`

**Se o mesmo evento for processado 2x:**
1. Primeiro INSERT: sucesso (UNIQUE constraint criada)
2. Segundo INSERT: UNIQUE violation em `(tenant_id, idempotency_key)`
3. Operacao tratada como idempotente → nada acontece

### Codigo proposto no handler

```typescript
async function handleCheckoutCompleted(event, context) {
  // 1. Buscar itens + participants da comanda
  const items = await context.db.query('comanda_items', { comanda_id: event.payload.comandaId });
  const participants = await context.db.query('service_execution_participants', { comanda_item_id: items.map(i => i.id) });

  // 2. Deduplicar profissionais
  const staffIds = [...new Set(participants.map(p => p.staff_id || items.find(i => i.id === p.comanda_item_id)?.staff_id).filter(Boolean))];

  // 3. Para cada profissional, criar commission_record
  for (const staffId of staffIds) {
    const idempotencyKey = `${event.id}_${staffId}`;
    try {
      await context.db.insert('commission_records', {
        tenant_id: event.metadata.tenantId,
        comanda_id: event.payload.comandaId,
        staff_id: staffId,
        // ... valores calculados
        idempotency_key: idempotencyKey,
        event_id: event.id,
        event_type: event.eventType,
      });
    } catch (err) {
      if (err.code === '23505') { // UNIQUE violation
        // Idempotente: ja existe, nada fazer
        continue;
      }
      throw err;
    }
  }
}
```

---

## Pergunta 7: O que acontece quando a comissa ja existe?

### Cenarios

| Cenario | Comportamento | Codigo |
|---------|--------------|--------|
| **Mesmo evento, mesmo profissional** | UNIQUE violation → skip (idempotente) | `err.code === '23505'` |
| **Evento diferente, mesma comanda, mesmo profissional** | UNIQUE violation → **ERRO de integracao** | Requer investigacao |
| **Evento diferente, mesma comanda, profissional diferente** | Sucesso (constraint diferente) | Novo registro criado |

### Risco: evento diferente, mesma comanda, mesmo profissional

Isso so aconteceria se:
- Dois eventos `CheckoutCompleted` fossem publicados para a mesma comanda com `eventId` diferente
- O primeiro ja criou `commission_record` para `staff-456`
- O segundo tenta criar outro para `staff-456` com `idempotencyKey` diferente

**Protecao adicional:** A constraint `UNIQUE (tenant_id, staff_id, comanda_id)` impede isso, mesmo que o `idempotency_key` seja diferente.

**Hierarquia de protecao:**
1. `UNIQUE (tenant_id, staff_id, comanda_id)` — 1 profissional = 1 comissao por comanda
2. `UNIQUE (tenant_id, idempotency_key)` — mesmo evento = mesma operacao

**Se ambas falharem:** O handler deve tratar `23505` como idempotente e logar para auditoria.

---

## Pergunta 8: Como descontos, Clube do Chefe e cancelamentos afetam a comissao?

### Descontos

```
grossValue = unit_price × quantity = R$ 100
discount   = R$ 20 (desconto aplicado)
netValue   = R$ 80
paidAmount = R$ 80
receivedValue = min(80, 80) = R$ 80
commission = R$ 80 × 50% = R$ 40
```

**Desconto integral (100%):**
```
grossValue = R$ 100
discount   = R$ 100
netValue   = R$ 0
receivedValue = R$ 0
commission = R$ 0
zeroReason = 'desconto_integral'
```

### Clube do Chefe (creditos)

```
unit_price = 0 (servico coberto por credito)
grossValue = R$ 0
receivedValue = R$ 0
commission = R$ 0
zeroReason = 'clube_do_chefe'
```

**Importante:** O CheckoutApplicationService CHAMA `deductChefClubCredits()` ANTES de publicar o evento. O evento `CheckoutCompleted` tem `hasClubCredit: true`. O FinanceSubscriber pode usar esse campo para pular `create_commission_record` quando `hasClubCredit = true` E `receivedValue = 0`.

### Cancelamentos / Reversoes

**Cancelamento parcial:**
```
originalReceivedValue = R$ 80
originalCommission = R$ 40
reversedAmount = R$ 30 (reversao parcial)
proportion = 30 / 80 = 0.375
reversalAmount = 40 × 0.375 = R$ 15
commission liquida = R$ 40 - R$ 15 = R$ 25
```

**Cancelamento integral:**
```
proportion = 80 / 80 = 1.0
reversalAmount = R$ 40
commission liquida = R$ 0
```

**Estorno via `reverse_revenue`:**
- O FinanceSubscriber pula `create_commission_record` porque a transacao ja foi revertida
- A reversao de comissao e tratada por `reverse_commission` (handler existente mas nao persistido)

---

## Resumo das Decisoes de Contrato

| Decisao | Escolha | Justificativa |
|---------|---------|---------------|
| Base monetaria | `receivedValue` (FIX-001) | Valor efetivamente recebido, nao bruto |
| Granuralidade | 1 registro por `(staff_id, comanda_id)` | Simplicidade + protecao dupla |
| Multi-profissional | 1 comanda = N registros (1 por profissional) | Suporta shared execution |
| Idempotencia | Dubla: `UNIQUE (staff_id, comanda_id)` + `UNIQUE (idempotency_key)` | Regra de negocio + protecao por evento |
| Relacao com barber_closings | Complementar, nao substituivel | barber_closings = agregacao diaria |
| Reversao | Mark-and-reversal (status + registro negativo) | Preserva auditoria |
| Replay | UNIQUE violation → skip idempotente | Idempotencia por constrangimento |
| Desconto | Reduce receivedValue antes de calcular | Ja implementado em FIX-001 |
| Clube do Chefe | Skip create_commission_record quando `receivedValue = 0` | Sem comissao sem receita |
| Cancelamento | `calculateCommissionReversal()` com proporcao | Ja implementado, falta persistir |

---

## Gaps Restantes para B3.4-B

| Gap | Status | Proximo passo |
|-----|--------|---------------|
| Schema `commission_records` | **Proposto neste documento** | PO aprova schema |
| `commission_records` → `barber_closings` | **Complementar** | Definir se recalcula ou mantem formula |
| `reverse_commission` repository | **Handler existe, falta persistir** | Implementar repository + INSERT |
| `reversal_type` para commission | **Necessario ALTER TABLE** | Decidir: nova tabela ou adicionar ao CHECK |
| RPC `deduct_chef_club_credits` idempotencia | **Fora do escopo B3.4** | Registrar como divida tecnica |
