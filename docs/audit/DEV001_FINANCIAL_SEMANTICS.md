# DEV-001 — Contrato Financeiro Oficial

> **Status:** CONTRATO EM REVISÃO — Aguardando aprovação do PO
> **Data:** 2026-08-18
> **Pré-requisito:** AUD-001, AUD-002, AUD-003, AUD-004 (todas concluídas)
> **Escopo:** Semântica financeira completa — preço, pagamento, comissão, fechamento, estorno, zero-close

---

## 1. Glossário de Conceitos

### 1.1 Preço

| Conceito | Campo | Fonte | Quem define |
|----------|-------|-------|-------------|
| **Preço de catálogo** | `services.price` | `public.services` | Admin (CRUD serviços) |
| **Preço do item** | `comanda_items.unit_price` | `public.comanda_items` | Frontend (Checkout) — snapshot no momento da execução |
| **Preço promocional** | `calculateItemPrice()` | `pages/Checkout.tsx` | Frontend — aplicado antes de copiar para unit_price |
| **Crédito (preço zero)** | `cart[i].price = 0` | `pages/Checkout.tsx:944` | Frontend — quando `usedCredit = true` |

### 1.2 Comanda

| Conceito | Campo | Fonte | Quem define |
|----------|-------|-------|-------------|
| **Subtotal** | `comanda.subtotal` | `public.comandas` | **NUNCA POPULADO** — coluna fantasma, sempre 0.00 |
| **Desconto** | `comanda.discount` | `public.comandas` | Frontend (Checkout) — valor absoluto |
| **Total** | `comanda.total` | `public.comandas` | Frontend (Checkout) — `max(0, Σ(unit_price × qty) - discount)` |
| **Status** | `comanda.status` | `public.comandas` | Backend (RPC) — `open`, `paid`, `cancelled`, `blocked` |
| **Efeito financeiro** | `comanda.financial_effect` | `public.comandas` | Backend — `true` para settlement normal, `false` para zero-close |

### 1.3 Pagamento

| Conceito | Campo | Fonte | Quem define |
|----------|-------|-------|-------------|
| **Valor pago** | `transactions.amount` | `public.transactions` | Backend (RPC `finance_settle_comanda`) — `p_paid_amount` |
| **Diferença** | `metadata.amount_difference` | `public.transactions` | Backend — `paid_amount - comanda_total` (audit apenas) |
| **Método** | `comandas.payment_method` | `public.comandas` | Frontend (Checkout) |
| **Data real** | `comandas.payment_date_real` | `public.comandas` | Backend (RPC) — timestamp do settlement |

### 1.4 Comissão

| Conceito | Campo | Fonte | Quem define |
|----------|-------|-------|-------------|
| **Base da comissão** | `comanda_items.unit_price` | `public.comanda_items` | Domain — `resolveCommissionBase()` |
| **Taxa do profissional** | `staff.commission_rate` | `public.staff` | Admin (CRUD profissionais) — normalizado para 0-1 |
| **Split do participante** | `participants.payout_value` | `public.service_execution_participants` | Frontend (Checkout) — percentual ou valor fixo |
| **Efeito na comissão** | `participants.affects_commission` | `public.service_execution_participants` | Frontend (Checkout) — boolean, default true |
| **Comissão teórica** | `commission_value` | Domain | Domain — `base × rate` (apenas display) |

### 1.5 Fechamento

| Conceito | Campo | Fonte | Quem define |
|----------|-------|-------|-------------|
| **Entradas** | `totalEntradas` | Application | Soma de transactions `type='income'` do dia |
| **Saídas** | `totalSaidas` | Application | Soma de transactions `type='expense'` do dia |
| **Saldo operacional** | `saldoAtual` | Application | `totalEntradas - totalSaidas` |
| **Suprimentos** | `totalExtrasSuprimento` | Application | Input do operador (cash drops) |
| **Sangrias** | `totalExtrasSangria` | Application | Input do operador (cash removals) |
| **Saldo devedor** | `totalExpected` | Application | `saldoAtual + suprimentos - sangrias` |
| **Valor contado** | `countedCash` | Input do operador | Nunca calculado — sempre input manual |
| **Diferença** | `difference` | Application | `countedCash - totalExpected` |

### 1.6 Estorno

| Conceito | Campo | Fonte | Quem define |
|----------|-------|-------|-------------|
| **Saldo reversível** | `available_amount` | Domain | `original.amount - Σ(reversals anteriores)` |
| **Transação de estorno** | `transactions` (type='expense') | Backend (RPC) | Categoria: `Devolucao de Comanda` ou `Estorno de Comanda` |
| **Registro de estorno** | `financial_reversals` | Backend (RPC) | Tabela append-only com audit trail |

### 1.7 Zero-Close

| Origem | Efeito Financeiro | Cria Transaction | Deduz Créditos | Método Pagamento |
|--------|------------------|-----------------|----------------|-----------------|
| `club_credit` | `false` | Não | Sim | `'Clube do Chefe'` |
| `house_courtesy` | `false` | Não | Não | `'Cortesia'` |
| `administrative_adjustment` | `false` | Não | Não | `'Baixa administrativa'` |

---

## 2. Cadeia de Valor Completa

### 2.1 Fluxo Normal

```
services.price (catálogo)
    ↓ copiado como unit_price (com aplicação de promoção)
comanda_items.unit_price × quantity
    ↓ somado
subtotal_implicito = Σ(item.unit_price × item.quantity)  [NÃO persistido]
    ↓ desconto subtraído
comanda.total = max(0, subtotal_implicito - comanda.discount)
    ↓ settlement via RPC
transactions.amount = comanda.total  [sem validação server-side]
    ↓ comissão calculada
commission_base = unit_price (BRUTO, ignora desconto)
commission_value = commission_base × staff.commission_rate
```

### 2.2 Fluxo de Créditos (Chef Club)

```
usedCredit = true
    ↓
cart[i].price = 0
    ↓
comanda_items.unit_price = 0
    ↓
comanda.total = 0
    ↓
closeZeroAmount() → bulk_close_comandas_with_credits
    ↓
comanda.status = 'paid', financial_effect = false
    ↓
NENHUMA transaction criada
    ↓
commission_base = 0 → commission_value = R$ 0
```

### 2.3 Fluxo de Estorno

```
transaction original (type='income', amount=X)
    ↓
finance_reverse_transaction RPC
    ↓
available_amount = X - Σ(reversals anteriores)
    ↓
nova transaction (type='expense', amount=reversal_amount)
    ↓
comanda pode ser reaberta (se wrong_settlement e amount >= original)
    ↓
NENHUMA ajuste de comissão
```

---

## 3. Discrepâncias Identificadas

### 3.1 `subtotal` é coluna fantasma
- `comandas.subtotal` existe mas nunca é escrito — sempre 0.00
- **Impacto:** Nenhum atual, mas confunde desenvolvedores

### 3.2 Sem validação: `paidAmount` vs `comanda.total`
- `finance_settle_comanda` aceita `p_paid_amount` sem verificar se `== comanda.total`
- `amount_difference` é gravado em metadata mas NÃO enforceado
- **Impacto:** Bug no frontend poderia enviar qualquer valor

### 3.3 Comissão ignora desconto
- Comissão é calculada sobre `unit_price` (bruto), não sobre valor líquido após desconto
- **Impacto:** Barbeiro recebe comissão sobre R$45 quando cliente pagou R$40
- **Nota:** Pode ser intencional (barbeiro não deveria perder por desconto do gestor)

### 3.4 Créditos → comissão R$0
- Quando `usedCredit = true`, `price = 0` → `unit_price = 0` → comissão = R$0
- **Impacto:** Barbeiro trabalha grátis (commission-wise) quando cliente usa crédito do plano

### 3.5 `affects_revenue` é coluna morta
- Existe em `service_execution_participants` mas nunca é lida em cálculos financeiros
- Apenas `affects_commission` é usado

### 3.6 Dois algoritmos de comissão
- `domain/commission/calculate.ts` = comissão teórica (dashboard)
- `application/cashClosing/summary.ts` = settlement (fechamento de caixa)
- Fórmulas diferentes, bases diferentes (ADR-001 documenta isso intencionalmente)

### 3.7 Estornos não ajustam comissão
- Quando transação é estornada, dashboard de comissão ainda mostra comissão original
- Não existe mecanismo para "reverter" uma comissão

### 3.8 `paid_value` não existe como coluna no DB
- Definido apenas como propriedade opcional em `domain/comanda/types.ts:18`
- Comentário: `NOT a comandas column. Use total or transactions for effective paid amount.`

---

## 4. Regras de Negócio

### 4.1 Comissão
1. Base = `unit_price × quantity × payout_share` (por item)
2. Taxa = `staff.commission_rate` (normalizado para 0-1)
3. Comissão = `base × taxa`
4. Se `affects_commission = false` → comissão = 0
5. Se item veio de crédito → `unit_price = 0` → comissão = 0
6. Desconto NÃO reduz base de comissão

### 4.2 Fechamento Global
1. `totalExpected = saldoAtual + suprimentos - sangrias`
2. `countedCash` = input do operador (nunca calculado)
3. `difference = countedCash - totalExpected`
4. `isValid = abs(difference) <= 0.01`
5. Estornos REDUZEM `totalExpected` (PO decision 2026-08-17)

### 4.3 Fechamento Barbeiro
1. `expectedCash = paymentMethods['Dinheiro']` (apenas dinheiro físico)
2. `countedCash` = input do operador
3. `cashDifference = countedCash - expectedCash`

### 4.4 Estorno
1. Apenas transações `type='income'` podem ser estornadas
2. `available_amount = original.amount - Σ(reversals)`
3. Novo estorno não pode exceder `available_amount`
4. Se `wrong_settlement` e `amount >= original` → comanda é reaberta

---

## 5. Fonte da Verdade por Conceito

| Conceito | Fonte da Verdade | Setado por | Notas |
|----------|-----------------|------------|-------|
| Preço de catálogo | `services.price` | Admin (CRUD) | Imutável durante checkout |
| Snapshot do preço | `comanda_items.unit_price` | Frontend (Checkout) | Pode diferir do catálogo |
| Total da comanda | `comandas.total` | Frontend (Checkout) | `max(0, Σ(items) - discount)` |
| Desconto | `comandas.discount` | Frontend (Checkout) | Valor absoluto |
| Valor pago | `transactions.amount` | Backend (RPC) | Sem validação vs total |
| Base de comissão | `comanda_items.unit_price` | Domain | Bruto, ignora desconto |
| Saldo devedor | `cash_closings.expected_balance` | Application | `saldoAtual + sup - sang` |
| Valor contado | `cash_closings.total_counted` | Input do operador | Nunca é calculado |
| Créditos | `customer_credits.available_credits` | Backend (RPC) | Decrementado por deduction |

---

## 6. Pendências para Decisão do PO

| # | Pergunta | Contexto | Impacto |
|---|----------|----------|---------|
| 1 | Desconto deve reduzir base de comissão? | Atualmente comissão é sobre bruto | Se sim, muda cálculo de comissão |
| 2 | Créditos devem gerar comissão? | Atualmente comissão = R$0 para créditos | Se sim, precisa definir base |
| 3 | Estorno deve ajustar comissão? | Atualmente comissão não é ajustada | Se sim, precisa de novo fluxo |
| 4 | `affects_revenue` deve ser ativado? | Coluna existe mas nunca é lida | Se sim, precisa de implementação |
| 5 | Deve haver validação server-side de `paidAmount == comanda.total`? | Atualmente aceita qualquer valor | Se sim, muda RPC |

---

## 7. Diagrama de Decisões

```
                    ┌─────────────────┐
                    │   DEV-001       │
                    │ Este documento  │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  PO decide      │
                    │ 6 pendências    │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ↓              ↓              ↓
        ┌─────────┐   ┌─────────┐   ┌─────────┐
        │FIX-001  │   │FIX-003  │   │FIX-004  │
        │Comissão │   │Validação│   │Créditos │
        └─────────┘   └─────────┘   └─────────┘
```
