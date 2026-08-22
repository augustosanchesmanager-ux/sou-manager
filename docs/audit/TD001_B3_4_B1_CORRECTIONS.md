# TD-001 B3.4-B.1 — Correcao do Migration Plan

> **Status:** CORRECAO DO PLANO — NAO EXECUTAR
> **Data:** 2026-08-20
> **Gate:** B3.4-B.1 — Correcoes antes de liberar B3.4-C

---

## Correcao 1: UNIQUE syntax (parcial unique index)

**Correto (ja estava correto no plano, mas formalizando):**

```sql
CREATE UNIQUE INDEX idx_commission_records_staff_comanda
  ON public.commission_records(tenant_id, staff_id, comanda_id)
  WHERE record_type = 'commission';
```

Nao e `UNIQUE (tenant_id, staff_id, comanda_id) WHERE record_type = 'commission'` inline — e um **indice unico parcial** via `CREATE UNIQUE INDEX`.

---

## Correcao 2: Protecao transacional contra reversao concorrente

### O problema

Duas transacoes concorrentes podem:
1. Ler `total_reversed = 0`
2. Validar `abs(0) + abs(100) <= 100` → OK
3. Inserir reversal de -100 cada
4. Resultado: -200 revertido em comissao de +100

A validacao `abs(total) >= original` e **aplicacao**, nao **banco**. UNIQUE de `idempotency_key` nao impede porque as keys sao diferentes.

### A solucao: RPC transacional

Seguir o padrao ja estabelecido em `finance_reverse_transaction` (migration `20260515210804`):

1. `pg_advisory_xact_lock(hashtext('commission_reversal:' || tenant_id || ':' || original_record_id))`
2. `SELECT ... FROM commission_records WHERE id = original_record_id FOR UPDATE`
3. `SELECT SUM(commission_value) FROM commission_records WHERE original_record_id = ... AND record_type = 'reversal'`
4. Validar: `abs(total_reversed + new_amount) <= original_commission_value`
5. INSERT reversal

```sql
CREATE OR REPLACE FUNCTION public.create_commission_reversal(
  p_tenant_id UUID,
  p_original_record_id UUID,
  p_commission_value NUMERIC,
  p_idempotency_key TEXT,
  p_event_id TEXT DEFAULT NULL,
  p_event_type TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_original commission_records%ROWTYPE;
  v_total_reversed NUMERIC;
  v_new_total NUMERIC;
  v_abs_new_amount NUMERIC;
  v_reversal_id UUID;
BEGIN
  -- Auth
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticacao obrigatoria'; END IF;
  IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id obrigatorio'; END IF;
  IF p_original_record_id IS NULL THEN RAISE EXCEPTION 'original_record_id obrigatorio'; END IF;
  v_abs_new_amount := ABS(COALESCE(p_commission_value, 0));
  IF v_abs_new_amount <= 0 THEN RAISE EXCEPTION 'commission_value deve ser negativo e nao zero'; END IF;

  -- Idempotency check
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_reversal_id
    FROM commission_records
    WHERE tenant_id = p_tenant_id AND idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true, 'idempotent', true,
        'reversal_id', v_reversal_id,
        'message', 'Reversao ja processada'
      );
    END IF;
  END IF;

  -- Advisory lock: serializa reversoes sobre o mesmo registro original
  PERFORM pg_advisory_xact_lock(
    hashtext('commission_reversal:' || p_tenant_id::text || ':' || p_original_record_id::text)
  );

  -- Lock the original record
  SELECT * INTO v_original
  FROM commission_records
  WHERE id = p_original_record_id AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registro original nao encontrado';
  END IF;
  IF v_original.record_type != 'commission' THEN
    RAISE EXCEPTION 'original_record_id deve apontar para um registro record_type=commission';
  END IF;

  -- Calculate total already reversed
  SELECT COALESCE(SUM(commission_value), 0) INTO v_total_reversed
  FROM commission_records
  WHERE original_record_id = p_original_record_id
    AND record_type = 'reversal';

  -- Validate: new total cannot exceed original
  v_new_total := v_total_reversed + p_commission_value;
  IF ABS(v_new_total) > ABS(v_original.commission_value) THEN
    RAISE EXCEPTION 'Reversao excede comissao original. Original: %, Ja revertido: %, Novo total: %',
      v_original.commission_value, v_total_reversed, v_new_total;
  END IF;

  -- Insert reversal
  INSERT INTO commission_records (
    tenant_id, record_type, comanda_id, comanda_item_id, staff_id,
    gross_value, discount, net_value, received_value, commission_rate, commission_value,
    participant_share, payout_type, affects_commission,
    original_record_id, idempotency_key, event_id, event_type, status
  ) VALUES (
    p_tenant_id, 'reversal', v_original.comanda_id, v_original.comanda_item_id, v_original.staff_id,
    0, 0, 0, 0, 0, p_commission_value,
    0, 'percentage', false,
    p_original_record_id, p_idempotency_key, p_event_id, p_event_type, 'active'
  ) RETURNING id INTO v_reversal_id;

  RETURN jsonb_build_object(
    'success', true, 'idempotent', false,
    'reversal_id', v_reversal_id,
    'original_record_id', p_original_record_id,
    'commission_value', p_commission_value,
    'message', 'Reversao registrada com sucesso'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_commission_reversal(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_commission_reversal(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT) TO authenticated;
NOTIFY pgrst, 'reload schema';
```

### Prova de correcao: 2 reversoes simultaneas

```
Transaction A                          Transaction B
    |                                       |
    |-- pg_advisory_xact_lock(H1) --------->| (BLOCKED, aguardando A)
    |-- SELECT ... FOR UPDATE (ok) -------->|
    |-- SUM = 0 --------------------------->|
    |-- valida: 0 + 100 <= 100 OK --------->|
    |-- INSERT -100 ----------------------->|
    |-- COMMIT (libera lock) -------------->|
    |                                       |-- pg_advisory_xact_lock(H1) (adquire)
    |                                       |-- SELECT ... FOR UPDATE (ok)
    |                                       |-- SUM = -100 (ve o dado de A)
    |                                       |-- valida: -100 + (-100) = -200 > 100
    |                                       |-- RAISE EXCEPTION 'Reversao excede'
    |                                       |--ROLLBACK
```

**Resultado:**
- Transaction A: -100 (sucesso)
- Transaction B: REJEITADA
- Total revertido: -100 (correto)

---

## Correcao 3: Append-only (decisao formal)

### Decisao: APPEND-ONLY

O registro original **NUNCA** e atualizado. Reversoes sao registros NOVOS com `record_type = 'reversal'`.

**Nao existe `status = 'reversed'` no registro original.** O estado financeiro e derivado do conjundo de movimentos:

```
commission_records:
  (+) 100 commission (record_type='commission')
  (-)  50 reversal   (record_type='reversal')
  = liquido: 50
```

### Atualizacao do contrato B3.4-A.1

O B3.4-A.1 definiu:

> atualiza `status = 'reversed'` + cria registro com valor negativo

**CORRECAO:** Remover o UPDATE. O contrato agora e:

> Cria registro novo com `record_type = 'reversal'` e `commission_value` negativo. O registro original permanece inalterado.

### Por que append-only e melhor para comissao

1. **Auditoria financeira:** Nunca ha duvida sobre o que aconteceu. O registro original preserva o valor exato.
2. **Concorrencia:** INSERTs sao mais seguros que UPDATEs + INSERTs (menos locks, menos deadlocks).
3. **Consistencia:** O estado e sempre derivado, nunca mutado. Impossivel corromper o original.
4. **Padrao:** Alinhado com `event_store` (append-only) e `financial_reversals` (append-only).

---

## Correcao 4: Schema atualizado (append-only)

```sql
-- Sem UPDATE/DELETE policies — append-only por design
-- O unico UPDATE permitido e pelo proprio RPC (SECURITY DEFINER)
-- via pg_advisory_xact_lock para serializacao
```

RLS policies:
```sql
-- SELECT: tenant isolation
-- INSERT: authenticated users (via RPC ou direto)
-- SEM UPDATE policy (append-only)
-- SEM DELETE policy (append-only)
```

---

## Correcao 5: Prova matematica de protecao

### Cenario: Comissao R$100, duas reversoes simultaneas de R$100

**Transaction A:**
1. `pg_advisory_xact_lock(H1)` → sucesso
2. `SELECT ... FOR UPDATE` → lock no original
3. `SELECT SUM(commission_value) WHERE record_type='reversal'` → 0
4. Valida: `abs(0 + (-100)) = 100 <= 100` → OK
5. INSERT reversal (-100) → sucesso
6. COMMIT → libera lock

**Transaction B (concorrente):**
1. `pg_advisory_xact_lock(H1)` → BLOCKED ate A committar
2. Apos A committar: adquire lock
3. `SELECT ... FOR UPDATE` → lock no original
4. `SELECT SUM(commission_value) WHERE record_type='reversal'` → -100 (ve o dado de A)
5. Valida: `abs(-100 + (-100)) = 200 > 100` → **REJEITADO**
6. RAISE EXCEPTION → ROLLBACK

**Resultado final:**
```
commission:  +100
reversal A:  -100
reversal B:  REJEITADO
liquido:       0 (correto)
```

### Cenario: Comissao R$100, 3 reversoes simultaneas de R$40

**Transaction A:**
1. Lock → SUM=0 → valida: 40<=100 OK → INSERT -40 → COMMIT

**Transaction B:**
2. Lock (pos-A) → SUM=-40 → valida: 80<=100 OK → INSERT -40 → COMMIT

**Transaction C:**
3. Lock (pos-B) → SUM=-80 → valida: 120>100 → **REJEITADO**

**Resultado:**
```
commission:  +100
reversal A:   -40
reversal B:   -40
reversal C:  REJEITADO
liquido:      +20 (correto)
```

---

## Correcao 6: 8 testes de aceitacao (mantidos + concorrencia)

Os 8 testes originais sao mantidos. Adicionado:

### Teste 9: Concorrencia real

```typescript
it('should_prevent_two_concurrent_reversals_from_exceeding_original', async () => {
  // Setup: commission de R$100
  // Execute: 2 reversoes simultaneas de R$100 via Promise.all
  // Assert: 1 sucesso + 1 erro 'Reversao excede comissao original'
  // Assert: total revertido = R$100 (nao R$200)
});
```

### Teste 10: Shared execution replay preserva valores

```typescript
it('should_preserve_individual_values_on_replay', async () => {
  // Setup: 1 comanda, 2 profissionais (A=R$30, B=R$20)
  // Execute: replay do CheckoutCompleted
  // Assert: A=R$30, B=R$20 (mesmos valores, nao zerados)
});
```

---

## Correcao 7: Rollback revisado

### Antes de dados em producao:
```sql
DROP TABLE IF EXISTS public.commission_records;
DROP TYPE IF EXISTS public.commission_record_type;
```

### Depois de dados em producao:
**NAO executar DROP TABLE.** Em vez disso:
1. Remover policies (bloqueia acesso via RLS)
2. Log de auditoria em `audit_logs`
3. Mantem dados para consulta historica
4. Re-ativacao via nova migration com policies

---

## Correcao 8: barber_closings — NENHUM impacto

`barber_closings.commission_total` continua sendo calculado pela formula simplificada. A migration nao altera dados existentes nem o comportamento do fechamento de caixa.

---

## Resumo das correcoes

| # | Correcao | Status |
|---|---------|--------|
| 1 | UNIQUE syntax → CREATE UNIQUE INDEX | ✅ Formalizado |
| 2 | Protecao transacional → RPC com advisory lock | ✅ Padrao existente |
| 3 | Append-only (sem UPDATE no original) | ✅ Decisao formal |
| 4 | Atualizar B3.4-A.1 (remover UPDATE) | ✅ Corrigido |
| 5 | Prova matematica de concorrencia | ✅ Demonstrada |
| 6 | 8 testes + 2 novos (concorrencia + replay) | ✅ Mantidos |
| 7 | Rollback revisado (pre/post dados) | ✅ Revisado |
| 8 | barber_closings consistente | ✅ Sem impacto |
