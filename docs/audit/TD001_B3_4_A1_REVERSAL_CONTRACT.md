# TD-001 B3.4-A.1 — Contrato de Reversao de Comissao

> **Status:** DOCUMENTO DE CONTRATO — NAO IMPLEMENTAR
> **Data:** 2026-08-20
> **Gate:** B3.4-A.1 — Reversao formalizada + Shared Execution

---

## Parte 1: Contrato de Reversao

### 1. Identificacao do registro original

O registro original e identificado por:

```sql
WHERE tenant_id = $tenantId
  AND staff_id = $staffId
  AND comanda_id = $comandaId
  AND record_type = 'commission'
  AND status = 'active'
```

**Chave natural:** `(tenant_id, staff_id, comanda_id)` + `record_type = 'commission'`

O `id` do registro original e armazenado no campo `original_record_id` do registro de reversao.

### 2. Armazenamento do registro de reversao

**Mesma tabela `commission_records`**, com diferencas:

| Campo | Commission (original) | Reversal |
|-------|----------------------|----------|
| `record_type` | `'commission'` | `'reversal'` |
| `commission_value` | positivo (+20) | negativo (-20) |
| `original_record_id` | `NULL` | UUID do original |
| `idempotency_key` | `{eventId}_{staffId}` | `{eventId}_{staffId}_reversal` |
| `status` | `active` | `active` |

**Nao criamos tabela separada.** A mesma tabela armazena ambos, com `record_type` como discriminador.

### 3. Strategia: `record_type` como coluna

```sql
CREATE TYPE commission_record_type AS ENUM ('commission', 'reversal');
```

O `record_type` e a coluna que distingue originals de reversoes.

### 4. Preservacao de `UNIQUE(tenant_id, staff_id, comanda_id)`

**Solucao: indice unico parcial (partial unique index)**

```sql
CREATE UNIQUE INDEX idx_commission_records_original
ON commission_records(tenant_id, staff_id, comanda_id)
WHERE record_type = 'commission';
```

Esse indice garante:
- 1 registro original por profissional/comanda
- Reversoes NAO batem nesse indice (filter `WHERE record_type = 'commission'`)

### 5. Impedir duas reversoes da mesma comissao

**Para reversoes, usamos idempotency_key:**

```sql
CREATE UNIQUE INDEX idx_commission_records_idempotency
ON commission_records(tenant_id, idempotency_key);
```

Se o mesmo evento de reversao for processado 2x:
1. Primeiro INSERT: sucesso
2. Segundo INSERT: UNIQUE violation em `idempotency_key` → skip

**Para reversoes parciais multiplas:** Cada reversao parcial e um evento diferente com `eventId` diferente → `idempotency_key` diferente → permite multiplos registros de reversao para o mesmo original.

### 6. Funcionamento de `original_record_id`

```sql
-- Registro original
INSERT INTO commission_records (id, tenant_id, staff_id, comanda_id, record_type, commission_value, ...)
VALUES ('uuid-original', 't-1', 's-1', 'c-1', 'commission', 20.00, ...);

-- Reversao (parcial: -8 de 20)
INSERT INTO commission_records (id, tenant_id, staff_id, comanda_id, record_type, commission_value, original_record_id, ...)
VALUES ('uuid-reversal-1', 't-1', 's-1', 'c-1', 'reversal', -8.00, 'uuid-original', ...);

-- Segunda reversao parcial: -5 adicionais
INSERT INTO commission_records (id, tenant_id, staff_id, comanda_id, record_type, commission_value, original_record_id, ...)
VALUES ('uuid-reversal-2', 't-1', 's-1', 'c-1', 'reversal', -5.00, 'uuid-original', ...);
```

**Resultado:**
```
commission:   +20.00
reversal-1:    -8.00
reversal-2:    -5.00
liquido:       +7.00
```

### 7. Funcionamento de `idempotency_key` para reversal

```typescript
const reversalIdempotencyKey = `${eventId}_${staffId}_reversal`;
```

**Exemplo:**
- Evento `CheckoutReverted` com `eventId = "evt_789"`
- Barbeiro Heron (`staffId = "staff-456"`)
- `idempotencyKey = "evt_789_staff-456_reversal"`

Se o mesmo evento de reversao for reprocessado:
- UNIQUE violation em `idempotency_key` → skip (idempotente)

### 8. Interpretacao por `barber_closings`

`barber_closings.commission_total` pode ser calculado como:

```sql
-- Opcao A: Formula atual (simplificada, mantida para v1)
commission_total = totalReceived * commissionRate

-- Opcao B: Fonte de verdade via commission_records (futuro)
commission_total = (
  SELECT COALESCE(SUM(commission_value), 0)
  FROM commission_records
  WHERE tenant_id = $tenantId
    AND staff_id = $barberId
    AND created_at >= $dayStart AND created_at < $dayEnd
);
```

**Para v1:** Mantemos a formula simplificada em `barber_closings`. `commission_records` e a fonte de verdade per-comanda para auditoria e dashboard.

### 9. Cancelamento parcial

```
Comanda #123 — Heron
Servico: corte R$ 100
Desconto: R$ 0
Pago: R$ 100
receivedValue: R$ 100
commissionRate: 50%
commission_value: R$ 50

Cancelamento parcial: R$ 30 do servico
reversedAmount: R$ 30
originalCommission: R$ 50
originalReceivedValue: R$ 100
proportion: 30/100 = 0.30
reversalAmount: 50 * 0.30 = R$ 15
```

**Registro de reversao:**
```
record_type: 'reversal'
commission_value: -15.00
original_record_id: UUID do original
```

**Saldo liquido:** R$ 50 - R$ 15 = R$ 35

### 10. Comissao ja revertida

**Cenarios:**

| Cenario | Comportamento |
|---------|--------------|
| Reversao integral, segundo evento de reversao | UNIQUE violation em `idempotency_key` → skip |
| Reversao parcial, segunda reversao parcial | Sucesso (idempotency_key diferente, cada evento gera registro novo) |
| Reversao integral + tentativa de reversao parcial | Permitido — idempotency_key diferente, mas handler valida antes |
| Verificacao antes de reverter | Query: `SUM(commission_value) WHERE record_type = 'reversal' AND original_record_id = $id` |

**Regra de negocio:** Se `abs(total_reversals) >= original_commission`, nao permitir nova reversao (reversao ja foi integral). O handler deve validar antes de inserir.

```typescript
const existingReversals = await db.query(
  `SELECT COALESCE(SUM(commission_value), 0) as total
   FROM commission_records
   WHERE original_record_id = $1 AND record_type = 'reversal'`,
  [originalRecordId]
);
const totalReversed = Math.abs(Number(existingReversals.total));
if (totalReversed >= originalCommission) {
  return { success: true, skipped: true, reason: 'already_fully_reversed' };
}
```

---

## Parte 2: Contrato de Shared Execution

### Regra formal

> O FinanceSubscriber NAO pode usar `CheckoutCompleted.staffId` como fonte definitiva da comissao. O campo `staffId` e apenas o primeiro item do carrinho e nao representa shared execution.

### Chain de resolucao

```
CheckoutCompleted
  -> comandaId (do evento)
  -> query comanda_items WHERE comanda_id = comandaId
  -> query service_execution_participants WHERE comanda_item_id IN (item_ids)
  -> deduplicar profissionais (staff_id dos participants OU staff_id do item)
  -> para cada profissional distinto: 1 commission_record
```

### Deduplicacao por profissional

Se 2 itens da mesma comanda sao executados pelo mesmo profissional, os resultados sao **agregados** em 1 registro:

```typescript
const byStaff = new Map<string, StaffCommissionData[]>();
results.forEach(r => {
  const list = byStaff.get(r.staffId) || [];
  list.push(r);
  byStaff.set(r.staffId, list);
});

return Array.from(byStaff.entries()).map(([staffId, items]) => ({
  staffId,
  comandaId,
  grossValue: items.reduce((s, i) => s + i.grossValue, 0),
  receivedValue: items.reduce((s, i) => s + i.receivedValue, 0),
  commissionValue: items.reduce((s, i) => s + i.commissionValue, 0),
  itemCount: items.length,
}));
```

### Cenarios formais

**Cenario 1 — Solo (1 barbeiro, 2 itens):**
```
Comanda #123
  Item 1: corte (staff: Heron)    -> receivedValue: R$ 80
  Item 2: barba (staff: Heron)    -> receivedValue: R$ 40
  Deduplicacao: 1 profissional (Heron)
  commission_records: 1 registro
    staff_id: Heron
    gross_value: R$ 120 (80+40)
    received_value: R$ 120
    commission_value: R$ 60 (120 * 50%)
```

**Cenario 2 — Shared (2 barbeiros):**
```
Comanda #124
  Item 1: corte (staff: Heron)    -> receivedValue: R$ 80
  Item 2: barba (staff: Rubens)   -> receivedValue: R$ 40
  Deduplicacao: 2 profissionais
  commission_records: 2 registros
    Registro 1: Heron  — commission_value: R$ 40 (80 * 50%)
    Registro 2: Rubens — commission_value: R$ 0 (commission_rate = 0)
```

**Cenario 3 — Shared com participants:**
```
Comanda #125
  Item 1: corte
    Participant 1: Heron (primary, payout=70%, affects_commission=true)
    Participant 2: Rubens (assistant, payout=30%, affects_commission=true)
  receivedValue: R$ 100

  commission_records: 2 registros
    Registro 1: Heron  — participantShare: 0.7 — commission: R$ 100 * 0.7 * 50% = R$ 35
    Registro 2: Rubens — participantShare: 0.3 — commission: R$ 100 * 0.3 * 50% = R$ 15
```

**Cenario 4 — Replay idempotente:**
```
Mesmo CheckoutCompleted processado 2x
  -> 2a tentativa: UNIQUE violation em idempotency_key
  -> skip, nao cria registros duplicados
  -> resultado: 2 commission_records (mesmos 2 registros originais)
```

**Cenario 5 — Clube do Chefe (comissao zero):**
```
Comanda #126
  Item 1: corte (unit_price: 0, usedCredit: true)
  CheckoutCompleted.hasClubCredit = true
  -> FinancialSubscriber DETECTA: usedCredit = true OU unit_price = 0
  -> SKIP create_commission_record
  -> commission_records: 0 registros
```

---

## Schema final de `commission_records` (atualizado)

```sql
CREATE TYPE commission_record_type AS ENUM ('commission', 'reversal');

CREATE TABLE commission_records (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Tipo do registro
  record_type       commission_record_type NOT NULL DEFAULT 'commission',

  -- Referencia ao evento
  comanda_id        UUID NOT NULL,
  comanda_item_id   UUID,

  -- Profissional
  staff_id          UUID NOT NULL REFERENCES staff(id),

  -- Valores financeiros
  gross_value       NUMERIC(12,2) NOT NULL,
  discount          NUMERIC(12,2) DEFAULT 0,
  net_value         NUMERIC(12,2) NOT NULL,
  received_value    NUMERIC(12,2) NOT NULL,
  commission_rate   NUMERIC(5,4) NOT NULL,
  commission_value  NUMERIC(12,2) NOT NULL,

  -- Participant
  participant_share    NUMERIC(5,4) DEFAULT 1.0,
  payout_type          VARCHAR(20) DEFAULT 'percentage',
  affects_commission   BOOLEAN DEFAULT TRUE,

  -- Reversao
  original_record_id   UUID REFERENCES commission_records(id),

  -- Idempotencia
  idempotency_key   VARCHAR(255) NOT NULL,
  event_id          VARCHAR(255),
  event_type        VARCHAR(50),

  -- Status
  status            VARCHAR(20) DEFAULT 'active',
  created_at        TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT commission_records_tenant_idempotency UNIQUE (tenant_id, idempotency_key)
);

-- Partial unique: 1 comissao original por profissional/comanda
CREATE UNIQUE INDEX idx_commission_records_original
ON commission_records(tenant_id, staff_id, comanda_id)
WHERE record_type = 'commission';

-- Idempotencia global (commissions + reversals)
CREATE UNIQUE INDEX idx_commission_records_idempotency
ON commission_records(tenant_id, idempotency_key);

-- RLS
ALTER TABLE commission_records ENABLE ROW LEVEL SECURITY;
```

### Indice para queries de reversao

```sql
CREATE INDEX idx_commission_records_original_lookup
ON commission_records(tenant_id, original_record_id)
WHERE record_type = 'reversal';
```

---

## Resumo de protecoes

| Constraint | Protege contra | Aplicado a |
|-----------|---------------|------------|
| `UNIQUE (tenant_id, staff_id, comanda_id) WHERE record_type = 'commission'` | 2 comissao original por profissional/comanda | Commissions |
| `UNIQUE (tenant_id, idempotency_key)` | Replay do mesmo evento | Commissions + Reversals |
| `CHECK (commission_value > 0)` (implicito via INSERT) | Valor negativo em commission original | Commissions |
| `CHECK (commission_value < 0)` (implicito via INSERT) | Valor positivo em reversal | Reversals |
| `original_record_id FK` | Reversao sem referencia | Reversals |
| Handler validation: `abs(total_reversals) >= original_commission` | Reversao alem do integral | Reversals |
