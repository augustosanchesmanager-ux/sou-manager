# TD-001 B3.1 — Contrato Financeiro Completo

> **Gate:** B3.1 — Auditoria read-only do contrato financeiro
> **Data:** 2026-08-20
> **Escopo:** Mapeamento completo de todos os valores financeiros que fluem pelo sistema
> **Status:** SOMENTE LEITURA — nenhuma alteração de código

---

## 1. Visão Geral do Fluxo Financeiro

```
Preço catálogo
    │
    ▼
Promoção (fix/%) ──► item.price
    │
    ▼
Crédito Clube? ──► price = 0 (se aplicado)
    │
    ▼
Edição manual? ──► price overwritten
    │
    ▼
subtotal = Σ(price × qty)
    │
    ▼
total = max(0, subtotal − descontoManual)
    │
    ├─► paid & total > 0  ──► RPC finance_settle_comanda ──► transactions.amount = total
    │                                                        category = 'Receita de Comanda'
    │
    ├─► paid & total ≤ 0  ──► bulk_close_* RPC (sem transaction)
    │
    └─► pending           ──► comanda aberta, sem transaction
```

---

## 2. Valores por Camada

### 2.1 Preço do Item (Checkout.tsx)

| Campo | Tipo | Origem | Observação |
|-------|------|--------|-----------|
| `item.price` | number | catálogo (`services.price` ou `products.sale_price`) | Editável pelo usuário |
| `item.sale_price` | number | catálogo | Fallback se `price` não existe |
| `item.unit_price` | number | persistido no `comanda_items` | Pós-promo, pós-crédito |
| `item.quantity` | number | sempre 1 no checkout | |
| `item.usedCredit` | boolean | true se crédito do Clube aplicado | |
| `item.service_id` | UUID | FK para `services` | |
| `item.staff_id` | UUID | profissional que executou | |

**Resolução de preço:**
```
basePrice = item.price ?? item.sale_price ?? 0
→ aplicar promoção (fixed ou percentage)
→ se usedCredit: price = 0
→ edição manual sobrescreve qualquer valor
```

### 2.2 Totais da Comanda

| Campo | Cálculo | Fonte |
|-------|---------|-------|
| `subtotal` | `Σ(item.price × item.quantity)` | Checkout.tsx |
| `discountValue` | `parseFloat(discount) \|\| 0` | Campo manual (R$, valor absoluto) |
| `total` | `max(0, subtotal − discountValue)` | Checkout.tsx |
| `paidAmount` | `= total` (quando paid) | FinishRequest |

### 2.3 Persistência no Banco

| Tabela | Campo | Tipo | Valor |
|--------|-------|------|-------|
| `comandas` | `total` | NUMERIC | `req.total` (LÍQUIDO) |
| `comandas` | `discount` | NUMERIC | `req.discountValue` |
| `comandas` | `payment_method` | TEXT | `'pix'`/`'credit'`/etc |
| `comandas` | `status` | TEXT | `'paid'` (quando fechado) |
| `comandas` | `financial_effect` | BOOLEAN | `true` se transação criada |
| `comandas` | `membership_credit_effect` | BOOLEAN | `true` se créditos consumidos |
| `comanda_items` | `unit_price` | NUMERIC | preço pós-tudo do item |
| `comanda_items` | `quantity` | INTEGER | quantidade |

---

## 3. Três Mecanismos de Desconto

| # | Mecanismo | Onde aplicado | Efeito no `total` | Rastreabilidade |
|---|-----------|---------------|-------------------|----------------|
| 1 | **Promoção** | `item.price` ao adicionar | Reduz preço unitário | Sem registro separado |
| 2 | **Crédito Clube** | `item.price = 0` | Zera preço unitário | `usedCredit: true` + `membership_credit_effect` |
| 3 | **Desconto manual** | `subtotal − discount` | Reduz total geral | `discountAuditDraft` (quando `barber_discount`) |

**Lacuna:** O desconto manual gera `discountAuditDraft.commissionImpact: 'pending_review'` mas **não recalcula comissão automaticamente**. A comissão é calculada sobre o valor líquido recebido, então o efeito é indireto.

---

## 4. Transação Financeira

### 4.1 Quando criada

Apenas quando `paymentStatus === 'paid'` E `total > 0` E `!isLegacyClubSettlement` E `!shouldSettleZeroWithAudit`.

### 4.2 Schema da tabela `transactions`

| Coluna | Tipo | Valor |
|--------|------|-------|
| `id` | UUID | `gen_random_uuid()` |
| `tenant_id` | UUID | tenant atual |
| `user_id` | UUID | quem fechou |
| `type` | TEXT | `'income'` (sempre para settlement) |
| `category` | TEXT | `'Receita de Comanda'` (**hardcoded no RPC**) |
| `amount` | NUMERIC | `p_paid_amount` (= `req.total`) |
| `payment_method` | TEXT | `'pix'`/`'credit'`/etc |
| `date` | TIMESTAMPTZ | `p_payment_date_real` |
| `status` | TEXT | `'paid'` |
| `source_type` | TEXT | `'comanda'` |
| `source_id` | UUID | `comanda_id` |
| `idempotency_key` | TEXT | `finance-settle-{comandaId}-{uuid}` |
| `metadata` | JSONB | `{ comanda_total, paid_amount, amount_difference, ... }` |

**Forensic:** O frontend envia `incomeCategory` ('Venda de Balcao', 'Fechamento de Comanda', etc) mas o RPC **ignora** e usa `'Receita de Comanda'` hardcoded.

### 4.3 `amount_difference`

```
amount_difference = p_paid_amount − comanda.total
```
Captura sobre/sub-pagamento. Sempre armazenado no `metadata`.

---

## 5. Comissão

### 5.1 Fórmula (domain/commission/calculate.ts)

```
grossValue     = resolveCommissionBase(item).value × quantity
discount       = min(comanda.discount, grossValue)
netValue       = max(0, grossValue − discount)
receivedValue  = min(netValue, paidAmount)
commissionBase = receivedValue × participantShare
commission     = commissionBase × commissionRate
```

### 5.2 Regras de Elegibilidade

| Profissional | Elegível? | Rate padrão |
|-------------|-----------|-------------|
| `barber` | ✅ | 50% |
| `seller` | ✅ | 50% |
| `manager` | ✅ (se `commission_rate > 0`) | definido no staff |
| `receptionist` | ❌ | 0% |

### 5.3 Participant Split

| `payout_type` | Fórmula |
|---------------|---------|
| `percentage` | `receivedValue × normalizePercentage(payout_value) × commissionRate` |
| `fixed` | `min(payout_value, receivedValue) × commissionRate` |

### 5.4 Comissão Zero — Detecção

| Razão | Condição |
|-------|----------|
| `clube_do_chefe` | `unit_price = 0` AND `membership_credit_effect = true` |
| `cortesia` | `unit_price = 0` AND `!membership_credit_effect` |
| `desconto_integral` | `discount ≥ grossValue` AND `grossValue > 0` |
| `comanda_nao_paga` | `grossValue > 0` AND `paidAmount = 0` |
| `outro` | fallback |

### 5.5 Importante: ADR-001

**Comissão ≠ Settlement.** A comissão é teórica (calculada na execução do serviço). O settlement é o fechamento de caixa. São domínios separados com algoritmos diferentes.

---

## 6. Estorno / Reversão

### 6.1 Tipos de Reversão

| Tipo | Descrição |
|------|-----------|
| `wrong_settlement` | Fechamento errado |
| `full_refund` | Reembolso total |
| `partial_refund` | Reembolso parcial |
| `duplicate_charge` | Cobrança duplicada |
| `administrative_cancellation` | Cancelamento administrativo |
| `financial_review` | Revisão financeira |

### 6.2 Fórmula de Reversão de Comissão

```
proportion       = reversedAmount / originalReceivedValue
commissionReversal = originalCommission × min(proportion, 1.0)
```

### 6.3 RPC `finance_reverse_transaction`

- Cria `financial_reversals` row (cumulativo)
- Cria transaction de estorno (`type: 'expense'`, `category: 'Estorno de Comanda'`)
- Idempotente via `idempotency_key` UNIQUE
- Valida `available = original.amount − SUM(reversals)` (não pode estornar mais que o original)

### 6.4 Publicação de Evento

Após reversão bem-sucedida, publica `CheckoutReverted` com:
```ts
{
  comandaId, clientId, staffId,
  originalTotal, reversedAmount,
  reversalType,
  originalCommission,       // do item original
  originalReceivedValue,    // do item original
  commissionReversal,       // calculado
}
```

---

## 7. Fechamento de Caixa (Cash Closing)

### 7.1 Cálculo Diário

```
totalEntradas = Σ transactions(type='income')
totalSaidas   = Σ transactions(type='expense')
saldoAtual    = totalEntradas − totalSaidas
totalExpected = saldoAtual + suprimentos − sangrias
difference    = countedCash − totalExpected
```

### 7.2 Operações no Fechamento

| Operação | Efeito |
|----------|--------|
| `closeCashRegister` | Confirma closing, cria transactions de sangria/suprimento |
| `closeBarberCash` | Fecha por barbeiro, calcula comissão/repasse |

### 7.3 Dados por Barbeiro

| Campo | Descrição |
|-------|-----------|
| `produced` | Total produzido |
| `received` | Total recebido |
| `commission` | Comissão calculada |
| `repasse` | Valor a repassar |
| `discounts` | Descontos aplicados |
| `advances` | Adiantamentos |
| `balance` | Saldo |

---

## 8. Pagamento Parcial / Split

**Não existe split de pagamento.** Uma comanda = um settlement = uma transaction = um `payment_method`.

| Cenário | Comportamento |
|---------|---------------|
| PIX + Dinheiro | ❌ Não suportado — escolher um método |
| Pagamento parcial | Via `paymentStatus: 'pending'` — comanda fica aberta |
| Sub-pagamento | `amount_difference < 0` no metadata |
| Super-pagamento | `amount_difference > 0` no metadata |
| Crédito Clube + dinheiro | Crédito zera itens, resto é pago normalmente |

---

## 9. Idempotência — Inventário Completo

| # | Camada | Mecanismo | Key | Enforcement |
|---|--------|-----------|-----|-------------|
| 1 | UI | `generateIdempotencyKey(prefix)` | `{prefix}-{uuid}` | React ref, reutilizada em retry |
| 2 | Comanda insert | `insertWithIdempotency` | session key | DB UNIQUE → SELECT on conflict |
| 3 | Settlement | RPC `finance_settle_comanda` | `finance-settle-{comandaId}-{key}` | UNIQUE + advisory lock + FOR UPDATE |
| 4 | Reversal | RPC `finance_reverse_transaction` | `finance-reversal-{txId}-{uuid}` | UNIQUE em `financial_reversals` |
| 5 | Receivable UI | `createSettlementKey(entry.id)` | per-entry prefixed uuid | RPC level |
| 6 | Event-driven | `FinanceSubscriber` | `{eventId}_{operationType}` | Outbox enqueue |
| 7 | Outbox executor | `FinanceProvider.deliver` | same | `IdempotencyStore.has()` |
| 8 | Persistent store | `processed_operations` table | same | UNIQUE `(tenant_id, idempotency_key)` |
| 9 | Outbox delivery | Retry lifecycle | exponential backoff | dead letter after maxAttempts |
| 10 | Event Store | append-only | event id | throws on duplicate |
| 11 | Correlation | `metadata.correlationId` | inherits key | traces retries |
| 12 | Billing | `cycle_{subId}_{period}` | UNIQUE tenant+key | no duplicate invoices |
| 13 | Appointments | RPC `p_idempotency_key` | `schedule-appt-*` | regenerated after success |
| 14 | UI concurrency | `finishLockRef` + status guard | — | double-click lock |

---

## 10. Tabelas Financeiras no Banco

### `comandas`
- `total` (NUMERIC), `discount` (NUMERIC), `payment_method` (TEXT), `status` (TEXT)
- `financial_effect` (BOOLEAN), `membership_credit_effect` (BOOLEAN)
- `closed_at`, `settled_at`, `payment_date_real` (TIMESTAMPTZ)
- `closure_mode` ('standard'|'legacy_membership'), `closure_note` (TEXT)
- `idempotency_key` (TEXT, UNIQUE parcial)
- `cancellation_type`, `cancelled_at`, `hidden_from_financial`

### `comanda_items`
- `unit_price` (NUMERIC NOT NULL), `quantity` (INTEGER)
- `service_id` (UUID FK), `product_id` (UUID FK)

### `transactions`
- `type` ('income'|'expense'), `category` (TEXT), `amount` (NUMERIC)
- `payment_method`, `source_type` ('comanda'|'cash_closing'), `source_id`
- `idempotency_key` (UNIQUE parcial), `metadata` (JSONB)

### `cash_closings`
- `business_date` (DATE, UNIQUE por tenant), `status` ('draft'|'confirmed'|'adjusted')
- `expected_income`, `expected_expense`, `expected_balance`
- `total_counted`, `total_difference`

### `barber_closings`
- Por barbeiro: `produced`, `received`, `commission_total`, `repasse`
- `discounts`, `advances`, `balance`

### `customer_subscriptions`
- `plan_price` (NUMERIC), `status` ('active'|'cancelled')

### `customer_subscription_receivables`
- `amount` (NUMERIC), `status` ('paid'|'overdue'|'pending')
- `transaction_id` (UUID FK → transactions)
- `billing_cycle_start`, `billing_cycle_end` (DATE)

### `customer_credits`
- `service_balance_map` (JSONB): `{ service_id: { available, used } }`

### `financial_reversals`
- `original_transaction_id`, `reversal_transaction_id`
- `reversal_type`, `amount`, `idempotency_key` (UNIQUE)

### `processed_operations`
- `idempotency_key` (UNIQUE por tenant), `status`
- Append-only (sem UPDATE/DELETE policies)

---

## 11. Gaps e Lacunas Identificados

| # | Gap | Impacto | Severidade |
|---|-----|---------|-----------|
| G1 | `incomeCategory` do frontend é ignorado pelo RPC | `category` sempre `'Receita de Comanda'` | Baixa (cosmético) |
| G2 | `discountAuditDraft.commissionImpact` hardcoded `'pending_review'` | Sem recálculo automático de comissão com desconto | Média |
| G3 | `CheckoutCompleted.staffId` = primeiro item apenas | Multi-profissional perde detail no evento | Média |
| G4 | `CheckoutCompleted` não inclui `grossSubtotal` nem `discount` | Subscribers não têm acesso ao bruto | Baixa |
| G5 | `membership_credit_effect` default conflitante entre migrations | Pode causar `true` indevido em comandas antigas | Baixa |
| G6 | Sem split de pagamento | PIX + Dinheiro não representável | Funcionalidade futura |
| G7 | `close_order` RPC grava `updated_at` mas migration não adiciona coluna | Schema drift | Baixa |

---

## 12. Conclusão para B3

O contrato financeiro está **completo e funcional**. Os12 pontos de idempotência cobrem todos os caminhos críticos. A comissão é calculada sobre o valor efetivamente recebido (FIX-001). O estorno é cumulativo e idempotente.

**Para o B3 (FinanceSubscriber + FinanceProvider), o contrato acima é o GUIA.** Qualquer handler financeiro deve:

1. Respeitar os tipos de transaction já existentes (`'income'`, `'expense'`)
2. Usar as categorias já definidas (`'Receita de Comanda'`, `'Estorno de Comanda'`, etc)
3. Gerar `idempotency_key` para toda operação
4. Não duplicar operações já cobertas pelo fluxo direto (settlement já cria transaction)
5. Respeitar ADR-001: comissão ≠ settlement

**Nenhuma alteração de código necessária. Documento é read-only.**
