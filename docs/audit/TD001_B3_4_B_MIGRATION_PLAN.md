# TD-001 B3.4-B — Plano Tecnico: Migration `commission_records`

> **Status:** DOCUMENTO DE PLANO — NAO EXECUTAR
> **Data:** 2026-08-20
> **Gate:** B3.4-B — Plano tecnico para aprovacao antes de migration

---

## 1. Schema Completo

```sql
CREATE TYPE public.commission_record_type AS ENUM ('commission', 'reversal');

CREATE TABLE IF NOT EXISTS public.commission_records (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  record_type       public.commission_record_type NOT NULL DEFAULT 'commission',
  comanda_id        UUID NOT NULL,
  comanda_item_id   UUID,
  staff_id          UUID NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT,
  gross_value       NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount          NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_value         NUMERIC(12,2) NOT NULL DEFAULT 0,
  received_value    NUMERIC(12,2) NOT NULL DEFAULT 0,
  commission_rate   NUMERIC(5,4) NOT NULL DEFAULT 0,
  commission_value  NUMERIC(12,2) NOT NULL DEFAULT 0,
  participant_share    NUMERIC(5,4) NOT NULL DEFAULT 1.0,
  payout_type          VARCHAR(20) NOT NULL DEFAULT 'percentage',
  affects_commission   BOOLEAN NOT NULL DEFAULT TRUE,
  original_record_id   UUID REFERENCES public.commission_records(id) ON DELETE RESTRICT,
  idempotency_key   VARCHAR(255) NOT NULL,
  event_id          VARCHAR(255),
  event_type        VARCHAR(50),
  status            VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## 2. Constraints e Indices

### Partial Unique — 1 comissao original por profissional/comanda

```sql
CREATE UNIQUE INDEX idx_commission_records_staff_comanda
  ON public.commission_records(tenant_id, staff_id, comanda_id)
  WHERE record_type = 'commission';
```

### Idempotency — replay do mesmo evento

```sql
CREATE UNIQUE INDEX idx_commission_records_idempotency
  ON public.commission_records(tenant_id, idempotency_key);
```

### Foreign Keys

| Coluna | Referencia | ON DELETE |
|--------|-----------|-----------|
| `tenant_id` | `tenants(id)` | CASCADE |
| `staff_id` | `staff(id)` | RESTRICT |
| `original_record_id` | `commission_records(id)` | RESTRICT |

### Indices de Consulta

```sql
CREATE INDEX idx_commission_records_comanda
  ON public.commission_records(tenant_id, comanda_id);

CREATE INDEX idx_commission_records_staff
  ON public.commission_records(tenant_id, staff_id, created_at DESC);

CREATE INDEX idx_commission_records_original_lookup
  ON public.commission_records(tenant_id, original_record_id)
  WHERE record_type = 'reversal';

CREATE INDEX idx_commission_records_created
  ON public.commission_records(tenant_id, created_at DESC);

CREATE INDEX idx_commission_records_event
  ON public.commission_records(tenant_id, event_id)
  WHERE event_id IS NOT NULL;
```

## 3. Regras de `record_type`

| Valor | Significado | Campos esperados |
|-------|-------------|-----------------|
| `'commission'` | Comissao original | `commission_value > 0`, `original_record_id IS NULL` |
| `'reversal'` | Reversao de comissao | `commission_value < 0`, `original_record_id IS NOT NULL` |

ENUM `commission_record_type` garante os dois valores validos. Valores financeiros enforced pelo handler.

## 4. Regras de `status`

| Valor | Significado | Transicoes |
|-------|-------------|------------|
| `'active'` | Registro valido e vigente | Estado inicial |
| `'reversed'` | Registro revertido (futuro) | active → reversed |

Para v1: `status` sempre `'active'`. Reversoes sao registros NOVOS, nao updates.

## 5. RLS e Tenant Isolation

```sql
ALTER TABLE public.commission_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY commission_records_superadmin_all
  ON public.commission_records FOR ALL
  USING (current_is_super_admin_from_auth_uid())
  WITH CHECK (current_is_super_admin_from_auth_uid());

CREATE POLICY commission_records_tenant_isolation
  ON public.commission_records FOR ALL
  USING (tenant_id = current_tenant_id_from_auth_uid())
  WITH CHECK (tenant_id = current_tenant_id_from_auth_uid());
```

Padrao identico ao `barber_closings`.

## 6. Rollback Strategy

**Rollback de migration (antes de producao):**
```sql
DROP TABLE IF EXISTS public.commission_records;
DROP TYPE IF EXISTS public.commission_record_type;
```

**Rollback de producao:** Nao remover a tabela. Desativar policies + log de auditoria. Re-ativacao via nova migration.

## 7. Impacto em `barber_closings`

NENHUM impacto direto. `barber_closings.commission_total` continua sendo calculado pela formula simplificada (`totalReceived * commissionRate`). A migration nao altera dados existentes.

## 8. Concurrencia

PostgreSQL aplica UNIQUE constraints atomicamente durante INSERT. Nao ha janela para duplicacao:

1. Request A: INSERT → sucesso
2. Request B (simultaneo): INSERT → `23505` UNIQUE VIOLATION → skip

Nao ha risco de deadlock — UNIQUE violations falham imediatamente sem reter locks.
