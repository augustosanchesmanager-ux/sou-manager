# ADR-014: Transactional Outbox — Atomicidade entre Settlement e Evento

**Status:** Accepted  
**Date:** 2026-08-26  
**Deciders:** PO (Augusto) + OpenCode  
**Supersedes:** Gap documentado como D7 no ROADMAP.md  
**Prerequisite:** Trilha C (Durable Outbox) certificada em `cf451be`

---

## Context

### O que existe hoje

```
CheckoutApplicationService.finish()           [application/checkout.ts:660]
  │
  ├── Step 6: settleComanda()                  [application/checkout.ts:539]
  │     └── settleCheckoutComanda()            [src/lib/finance/settlement.ts:62]
  │           └── supabase.rpc('finance_settle_comanda')
  │                 ↓
  │           COMMITS: comandas, transactions, appointments,
  │                    inventory_movements, products
  │                 ↓
  │           retorna { success: true, transaction_id }
  │
  ├── Step 8: appEventBus.publish(CheckoutCompleted)
  │     ↓ (síncrono, InMemoryEventBus)
  │   FinanceSubscriber.handle()
  │     ↓
  │   outbox.enqueue() → INSERT outbox_items   [SupabaseOutbox]
  │
  └── [5s depois] Dispatch loop → FinanceProvider → commission_records
```

### O gap

`finance_settle_comanda` é uma PL/pgSQL SECURITY DEFINER que commita **5 tabelas** independentemente. O `CheckoutCompleted` é publicado **depois** do commit via JS/EventBus. Se o publish falhar (page reload, tab close, JS error, subscriber crash), o commission_record nunca é criado — apesar do pagamento ter sido registrado com sucesso.

**Trilha C** mitigou: page reload e tab close (Durable Outbox persiste items). Mas o gap de atomicidade RPC↔event persiste.

### O que o RPC faz (resumo)

`finance_settle_comanda` (110 linhas PL/pgSQL):

| Step | Operação | Tabela |
|------|----------|--------|
| 1 | Auth check (uid, tenant, role) | profiles, staff, user_tenants |
| 2 | Idempotency check | transactions |
| 3 | Advisory lock + FOR UPDATE | comandas |
| 4 | Status check (open/blocked → paid) | comandas |
| 5 | apply_inventory_sale_for_comanda | products, inventory_movements |
| 6 | UPDATE comanda → paid | comandas |
| 7 | INSERT transaction (income) | transactions |
| 8 | UPDATE appointment → completed | appointments |

**Não escreve:** outbox_items, commission_records, event_store.

### Blast radius do gap

| Efeito | Status | Impacto |
|--------|--------|---------|
| Pagamento registrado | ✅ Durável (transactions) | Fonte da verdade preservada |
| Estoque decrementado | ✅ Durável (inventory_movements) | OK |
| Comanda fechada | ✅ Durável (comandas.status=paid) | OK |
| **Commission_record** | ❌ **Volátil** | Perda silenciosa se enqueue falhar |
| **Chef Club credits** | ❌ **Volátil** | Perda se enqueue falhar (via CreditsDeducted) |

**Apenas commission_records e credits são afetados.** O financial settlement é sempre durável.

---

## Decision

### Opção A — Composite RPC (Recomendada)

Criar uma **nova RPC** `finance_settle_comanda_and_enqueue` que encapsula `finance_settle_comanda` + INSERT em `outbox_items` dentro da **mesma transação**.

```sql
-- Nova RPC (composta)
CREATE OR REPLACE FUNCTION public.finance_settle_comanda_and_enqueue(
  -- Params originais do settlement
  p_tenant_id UUID, p_comanda_id UUID, p_payment_method TEXT,
  p_paid_amount NUMERIC, p_payment_date_real TIMESTAMPTZ,
  p_source TEXT, p_notes TEXT, p_idempotency_key TEXT,
  -- Params do outbox
  p_outbox_event_id TEXT, p_outbox_event_type TEXT,
  p_outbox_payload JSONB, p_outbox_metadata JSONB,
  p_outbox_targets JSONB DEFAULT '[{"provider":"finance","config":{}}]'
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  -- 1. Chama settlement existente (stoned, não modifica)
  -- 2. INSERT outbox_items (pending) com event_id UNIQUE
  -- 3. Ambos no mesmo BEGIN/COMMIT → atômico
END;
$$;
```

**Fluxo resultante:**
```
finish()
  └── finance_settle_comanda_and_enqueue()
        ├── finance_settle_comanda()  ← RPC original, intocada
        ├── INSERT outbox_items       ← mesmo TX
        └── COMMIT                    ← ambos persistidos juntos
```

**Se a transação falhar:** RPC e outbox ambos rollbackam — sem lixo.  
**Se a transação passar:** ambos persistidos — dispatcher processa normalmente.

#### Alternativas dentro da Opção A

| Sub-opção | Descrição | Prós | Contras |
|-----------|-----------|------|---------|
| A1 | Nova RPC composta | RPC original intocada; clean separation | Nova função; 2 calls do frontend |
| A2 | Modificar RPC existente | 1 call; payload computing no SQL | Acopla settlement + outbox; RPC fica mais complexa |
| **A1 (recomendada)** | **Nova RPC, original preservada** | **Zero risk para Trilha B/C; blast radius mínimo** | **1 migration nova; refactor leve no CheckoutApplicationService** |

### Opção B — Pre-enqueue (Simpler, weaker guarantees)

Enfileirar o outbox item **antes** do RPC, como "pre-commit". Se o RPC falhar, compensar.

```
finish()
  ├── outbox.enqueue(pending)        ← INSERT outbox_items
  ├── settleComanda()                 ← RPC
  │     ├── SUCCESS → return
  │     └── FAIL → outbox.markDead() ou DELETE
  └── (skip appEventBus.publish — não necessário mais)
```

**Vantagens:** Sem nova RPC; sem modificar SQL.  
**Desvantagens:**  
- Janela de race condition: dispatcher pode pegar item pending antes do RPC completar
- Requer cleanup code (DELETE ou markDead on RPC failure)
- 2 operations fora de transação → sem garantia real de atomicidade
- Se o usuário fechar a tab entre enqueue e RPC → item pending órfão

### Opção C — Postgres Trigger (Decoupled)

Trigger na tabela `transactions` que insere em `outbox_items` automaticamente.

```sql
CREATE TRIGGER trg_outbox_on_transaction
  AFTER INSERT ON public.transactions
  FOR EACH ROW
  WHEN (NEW.source_type = 'comanda')
  EXECUTE FUNCTION fn_enqueue_checkout_outbox();
```

**Vantagens:** Completamente decoupled; atomicidade garantida pelo Postgres.  
**Desvantagens:**  
- Trigger precisa computar payload do evento (staffId, closureMode, etc.) via JOIN
- Acopla schema de transactions ao schema de outbox
- Difícil de testar (requer Postgres real)
- Trigger PL/pgSQL complexo = manutenção difícil
- Viola princípio de que outbox é infraestrutura, não domínio

---

## Recommendation

### **Opção A1 — Composite RPC**

**Justificativa:**

1. **Zero risk para Trilhas B/C certificadas.** A RPC original `finance_settle_comanda` permanece **intocada**. Nenhuma alteração em código TypeScript existente de settlement.

2. **Atomicidade real.** Uma transação PostgreSQL = rollback garantido se qualquer step falhar.

3. **Blast radius mínimo.** 1 migration nova + 1 refactor leve em `CheckoutApplicationService` (chamar nova RPC em vez da original + passar outbox payload).

4. **Compatível com Durable Outbox (Trilha C).** A INSERT em `outbox_items` usa a mesma tabela, mesmos índices, mesma idempotência (`event_id UNIQUE`).

5. **Preserva o InMemoryEventBus.** O `appEventBus.publish()` pode ser mantido como fallback para subscribers não-financeiros (Analytics, Audit, Notification). O FinanceSubscriber deixa de ser o caminho crítico para commission_records.

6. **Mantém concorrência segura.** A RPC original já usa `pg_advisory_xact_lock` + `FOR UPDATE`. A composição preserva esses locks.

### Consequências

| Aspecto | Impacto |
|---------|---------|
| **Trilha B (Checkout Staff Attribution)** | ✅ Nenhum impacto — `8a413a5` preservado |
| **Trilha C (Durable Outbox)** | ✅ Nenhum impacto — `cf451be` preservado; mesma tabela `outbox_items` |
| **RPC finance_settle_comanda** | ✅ Intocada — nova RPC é wrapper |
| **FinanceSubscriber** | ⚠️ Pode ser desabilitado para `CheckoutCompleted` (o composite já enfileira) |
| **Dispatch loop / FinanceProvider** | ✅ Nenhum impacto — processa `outbox_items` normalmente |
| **InMemoryEventBus** | ✅ Mantido — outros subscribers continuam funcionando |
| **Demo mode (InMemoryOutbox)** | ✅ Nenhum impacto — fluxo alternativo preservado |
| **RLS / Multi-tenant** | ✅ SECURITY DEFINER preserva isolamento |
| **Idempotência** | ✅ 3 camadas mantidas: outbox `event_id UNIQUE` + `processed_operations` + `commission_records` partial unique |

### O que muda no CheckoutApplicationService

```typescript
// ANTES (Trilha C):
async settleComanda(req, comandaId, idempotencyKey) {
  await settleCheckoutComanda({ /* ... */ });  // RPC original
}

// DEPOIS (D7):
async settleComanda(req, comandaId, idempotencyKey) {
  const outboxPayload = {
    eventId: generateEventId(),
    eventType: 'CheckoutCompleted',
    payload: { comandaId, staffId, total, ... },
    metadata: { tenantId, correlationId: idempotencyKey, source: 'CheckoutApplicationService' },
  };
  
  await settleCheckoutComandaAndEnqueue({
    /* settlement params + outboxPayload */
  });
  
  // Opcional: still publish to EventBus for non-finance subscribers
  appEventBus.publish(createEvent<CheckoutCompletedEvent>({...}));
}
```

---

## Scope

### In-scope

| Item | Arquivo | Ação |
|------|---------|------|
| Nova RPC `finance_settle_comanda_and_enqueue` | `supabase/migrations/` | CREATE FUNCTION (wrapper) |
| Refactor `settleComanda` | `application/checkout.ts` | Chamar nova RPC + passar outbox payload |
| Adaptar `settleCheckoutComanda` wrapper | `src/lib/finance/settlement.ts` | Aceitar params de outbox |
| Testes unitários da nova RPC | `tests/` | Validação SQL em docker PG16 |
| Testes da composição | `application/checkout.test.ts` | Mock nova RPC |
| Atualizar `CheckoutCompletedEvent` publisher | `application/checkout.ts` | Manter como fallback para subscribers não-financeiros |

### Fora do escopo

| Item | Razão |
|------|-------|
| Modificar `finance_settle_comanda` original | Intocada — preserva Trilha B/C |
| Modificar `SupabaseOutbox` | Durable Outbox já certificado |
| Modificar `FinanceSubscriber` | Pode ser desabilitado para `CheckoutCompleted`, mas não alterado |
| Modificar `Dispatcher` / `FinanceProvider` | Nenhum impacto |
| Event Store / ReplayEngine | Não relacionado ao gap |
| Outros eventos (CashClosing, Subscription) | Escopo futuro |

---

## Migration

```sql
-- 20260827000000_transactional_outbox_composite_rpc.sql

CREATE OR REPLACE FUNCTION public.finance_settle_comanda_and_enqueue(
  -- Settlement params (idênticos à original)
  p_tenant_id UUID,
  p_comanda_id UUID,
  p_payment_method TEXT,
  p_paid_amount NUMERIC,
  p_payment_date_real TIMESTAMPTZ DEFAULT now(),
  p_source TEXT DEFAULT 'checkout',
  p_notes TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  -- Outbox params (adicionais)
  p_outbox_event_id TEXT,
  p_outbox_event_type TEXT,
  p_outbox_payload JSONB,
  p_outbox_metadata JSONB,
  p_outbox_targets JSONB DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settlement JSONB;
  v_targets JSONB;
BEGIN
  -- 1. Call original settlement (preserves all existing logic)
  SELECT public.finance_settle_comanda(
    p_tenant_id, p_comanda_id, p_payment_method, p_paid_amount,
    p_payment_date_real, p_source, p_notes, p_idempotency_key
  ) INTO v_settlement;

  -- 2. If settlement failed, propagate error (outbox NOT written)
  IF NOT (v_settlement->>'success')::boolean THEN
    RETURN v_settlement;
  END IF;

  -- 3. If idempotent replay, skip outbox (already enqueued)
  IF (v_settlement->>'idempotent')::boolean THEN
    RETURN v_settlement;
  END IF;

  -- 4. Enqueue to outbox (same transaction)
  v_targets := COALESCE(
    p_outbox_targets,
    '[{"provider":"finance","config":{}}]'::jsonb
  );

  INSERT INTO public.outbox_items (
    event_id, event_type, tenant_id, targets,
    status, payload, metadata,
    retry, created_at, updated_at
  ) VALUES (
    p_outbox_event_id,
    p_outbox_event_type,
    p_tenant_id,
    v_targets,
    'pending',
    p_outbox_payload,
    p_outbox_metadata,
    jsonb_build_object(
      'attempts', 0,
      'maxAttempts', 5,
      'baseDelayMs', 1000
    ),
    now(),
    now()
  )
  ON CONFLICT (event_id) DO NOTHING;

  -- 5. Return settlement result (outbox was enqueued atomically)
  RETURN v_settlement;
END;
$$;

-- Access control (same as original)
REVOKE ALL ON FUNCTION public.finance_settle_comanda_and_enqueue(
  UUID, UUID, TEXT, NUMERIC, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, JSONB
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_settle_comanda_and_enqueue(
  UUID, UUID, TEXT, NUMERIC, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, JSONB
) TO authenticated;
```

---

## Validation Criteria

| Gate | Critério | Responsável |
|------|----------|-------------|
| [MIGRATION] | Nova RPC composta criada + validada em PG16 docker | OpenCode |
| [CODE] | CheckoutApplicationService chama nova RPC + mantém EventBus fallback | OpenCode |
| [UNIT] | Testes da composição (mock RPC + validação outbox) | OpenCode |
| [E2E/CHAOS] | Cenário: RPC succeeds + outbox enqueue = atomic; RPC fails = no outbox | OpenCode |
| [AUDITORIA] | Verificar: Trilha B intacta, Trilha C intacta, 0 erros novos | OpenCode |
| [CERTIFICAÇÃO] | PO aprova baseline + tag | PO |

---

## Recovery Strategy

| Falha | Comportamento Atual | Comportamento com D7 |
|-------|--------------------|--------------------|
| RPC fails | Checkout fails, user retries → idempotent | Idêntico (composite retorna erro) |
| RPC succeeds + EventBus fails | ❌ Commission lost | ✅ Outbox item já persistido (atomic) |
| RPC succeeds + outbox enqueue fails | ❌ Commission lost | ✅ Impossível — mesmo TX |
| Page reload após RPC | ⚠️ Commission lost (Trilha C mitiga parcialmente) | ✅ Outbox item persisto com RPC |
| Tab close após RPC | ⚠️ Commission lost (Trilha C mitiga parcialmente) | ✅ Outbox item persisto com RPC |
| Dispatcher fails | Retry via stale recovery (Trilha C) | Idêntico |

---

## Risks

| Risco | Severidade | Mitigação |
|-------|-----------|-----------|
| Nova RPC introduce bug de regressão | Baixa | RPC original intocada; nova RPC é wrapper puro; testes em docker PG16 |
| CheckoutApplicationService fica mais complexo | Baixa | Refactor leve (passar outbox payload ao wrapper) |
| Outbox metadata computation precisa de dados que não estão no finish() | Baixa | Todos os dados (staffId, total, closureMode) já estão em `req` e `comandaId` |
| `ON CONFLICT DO NOTHING` pode mascarar falha real | Baixa | Idempotência already é o padrão do sistema (3 camadas) |
| Concorrência: 2 checkouts simultâneos para mesma comanda | Baixa | `pg_advisory_xact_lock` + `FOR UPDATE` na RPC original preservados |

---

## Status

✅ **Accepted** — PO approved A1 (2026-08-26)  
✅ **Design Validated** — `docs/adr/D7_DESIGN_VALIDATION.md` (10/10 questions answered)

**Próximos passos:**
1. Criar migration `20260827000000_transactional_outbox_composite_rpc.sql`
2. Validar em Postgres 16 docker
3. Refatorar `CheckoutApplicationService.settleComanda()`
4. Adaptar `settleCheckoutComanda` wrapper
5. Testes unitários
6. E2E/chaos (cenário atômico)
7. Auditoria final (Trilha B/C intactas)
8. Certificação
