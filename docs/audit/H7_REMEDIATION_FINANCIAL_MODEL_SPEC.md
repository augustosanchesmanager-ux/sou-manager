# H7-REMEDIATION — Especificação Formal do Modelo Financeiro do Fechamento

> **Status:** CONTRATO COM DECISÕES DO PO — Fase 2 concluída, aguardando Fase 3 (testes)
> **Data:** 2026-08-17 · **Escopo:** Fechamento de caixa (global + barbeiro)
> **Método:** Read-only, auditoria de código + banco de dados
> **Pré-requisito:** H7-REVIEW completo
> **Decisões do PO:** 2026-08-17 — 4 de 4 decisões formalizadas abaixo

---

## 1. Glossário de Conceitos

### 1.1 Transações financeiras

| Conceito | Definição | Exemplo |
|----------|-----------|---------|
| **Entrada** | Transaction `type='income'` registrada no sistema | Pagamento de comanda via Pix |
| **Saída** | Transaction `type='expense'` registrada no sistema | Estorno de comanda, despesa manual |
| **Estorno** | Saída criada pelo RPC `finance_reverse_transaction` — vincula original → reversal via `financial_reversals` | Devolução ao cliente |
| **Despesa manual** | Saída criada manualmente (sem RPC) | Compra de material de limpeza |
| **Suprimento** | Entrada temporária de dinheiro físico no caixa (não persistida como transaction até o fechamento) | Manager adiciona R$20 de troco |
| **Sangria** | Saída temporária de dinheiro físico do caixa (não persistida como transaction até o fechamento) | Manager retira R$35 para pagamento |

### 1.2 Pagamento

| Conceito | Definição | Efeito físico |
|----------|-----------|---------------|
| **Dinheiro** | Pagamento em espécie | Dinheiro entra fisicamente no caixa |
| **Pix** | Pagamento digital | Nenhum dinheiro físico entra no caixa |
| **Cartão (crédito/débito)** | Pagamento eletrônico | Nenhum dinheiro físico entra no caixa |
| **Outro** | Qualquer outro método | Variável |

### 1.3 Fechamento

| Conceito | Definição |
|----------|-----------|
| **Fechamento global** | Reconciliação do caixa como um todo (todos os profissionais) |
| **Fechamento barbeiro** | Reconciliação do caixa individual de um profissional |
| **Conferência física** | Ato de contar o dinheiro físico e comparar com o esperado |
| **Saldo devedor** | Quanto dinheiro deveria estar no caixa, considerando todas as movimentações |
| **Diferença** | Valor contado pelo operador menos valor esperado pelo sistema |

---

## 2. Definição Formal de Cada Campo

### 2.1 Campos computados (application layer)

| Campo | Fórmula | O que representa | Fonte |
|-------|---------|------------------|-------|
| `totalEntradas` | `Σ(filteredEntries where type='entrada').value` | Soma de todas as transactions de entrada do dia | transactions DB |
| `totalSaidas` | `Σ(filteredEntries where type='saida').value` | Soma de todas as transactions de saída do dia (estornos + despesas) | transactions DB |
| `saldoAtual` | `totalEntradas - totalSaidas` | Saldo líquido financeiro do dia | computado |
| `totalExtrasSuprimento` | `Σ(extras where type='suprimento').value` | Soma de suprimentos (dinheiro adicionado ao caixa) | extras in-memory |
| `totalExtrasSangria` | `Σ(extras where type='sangria').value` | Soma de sangrias (dinheiro removido do caixa) | extras in-memory |

### 2.2 Campos de totalização (application layer)

| Campo | Fórmula atual | Fórmula correta (proposta) | O que deveria representar |
|-------|---------------|---------------------------|--------------------------|
| `totalExpected` | `totalEntradas + totalExtrasSuprimento - totalExtrasSangria` | `saldoAtual + totalExtrasSuprimento - totalExtrasSangria` | **Saldo devedor do caixa** — quanto deveria haver de dinheiro físico |
| `totalReceived` | `totalEntradas + totalExtrasSuprimento - totalExtrasSangria` | **Não deveria existir neste nível** | Deveria ser o valor contado pelo operador, não um valor computado |

### 2.3 Campos de validação (application layer)

| Campo | Fórmula atual | Fórmula correta (proposta) | O que deveria representar |
|-------|---------------|---------------------------|--------------------------|
| `validation.totalExpected` | `totalEntradas + sup - sang` | `saldoAtual + sup - sang` | Saldo devedor |
| `validation.totalReceived` | `totalEntradas + sup - sang` | **Valor contado pelo operador** | Conferência física |
| `validation.difference` | `totalReceived - totalExpected` (SEMPRE 0) | `countedCash - expectedBalance` | Diferença real |
| `validation.isValid` | `abs(difference) <= 0.01` (SEMPRE true) | `abs(difference) <= 0.01` | Se conferência bateu |

---

## 3. Mapeamento: Campo → Quem → Onde

### 3.1 Fechamento global (`cash_closings`)

| Coluna no DB | Quem calcula | Onde é informado | Fonte da verdade |
|-------------|-------------|------------------|-----------------|
| `expected_income` | `totals.totalEntradas` | `operations.ts:100` | Computado |
| `expected_expense` | `totals.totalSaidas` | `operations.ts:101` | Computado |
| `expected_balance` | `totals.totalExpected` | `operations.ts:102` | Computado (fórmula errada) |
| `total_counted` | `totals.totalReceived` | `operations.ts:103` | **Computado — deveria ser input do operador** |
| `total_difference` | `totalReceived - totalExpected` | `operations.ts:106` | **SEMPRE 0 — deveria ser contado - esperado** |
| `total_sangrias` | `totals.totalExtrasSangria` | `operations.ts:104` | Computado |
| `total_suprimentos` | `totals.totalExtrasSuprimento` | `operations.ts:105` | Computado |

### 3.2 Fechamento barbeiro (`barber_closings`)

| Coluna no DB | Quem calcula | Onde é informado | Fonte da verdade |
|-------------|-------------|------------------|-----------------|
| `total_produced` | `barberDetail.totalProduced` | `operations.ts:182` | Computado |
| `total_received` | `barberDetail.totalReceived` | `operations.ts:183` | Computado |
| `counted_cash` | **`conference.countedCash`** | `operations.ts:186` | **Input do operador** |
| `expected_cash` | `barberDetail.paymentMethods['Dinheiro']` | `operations.ts:187` | Computado |
| `cash_difference` | `countedCash - expectedCash` | `operations.ts:188` | **Contado - Esperado** |
| `commission_total` | `barberDetail.commission` | `operations.ts:184` | Computado |
| `repasse_total` | `barberDetail.repasse` | `operations.ts:185` | Computado |

---

## 4. Onde o Valor Contado pelo Operador Nasce

### 4.1 Fechamento barbeiro (FUNCIONAL)

```
UI: BarberClosingDetailPanel.tsx
  ├── Input: <input type="number" value={countedCash} onChange={...}> (linha 238)
  ├── State local: countedCash (useState, linha 35)
  ├── Ao clicar "Fechar Caixa do Barbeiro":
  │     onCloseBarberCash(barber.staffId, { countedCash: countedValue, justification })
  │       ↓
  │     Hook: useCashClosing.ts → closeBarberCash (linha 481)
  │       countedCash: conference.countedCash
  │       expectedCash: barberDetail.paymentMethods['Dinheiro'] || 0
  │         ↓
  │     Service: operations.ts → closeBarberCash (linha 149)
  │       counted_cash: countedCash     → barber_closings.counted_cash
  │       expected_cash: expectedCash   → barber_closings.expected_cash
  │       cash_difference: diff         → barber_closings.cash_difference
  └── Resultado: O valor do operador é persistido e validado ✅
```

### 4.2 Fechamento global (MORTO)

```
UI: PhysicalConference.tsx
  ├── Input: <input type="number" value={countedCash} onChange={...}> (linha 62)
  ├── State local: countedCash (useState, linha 19)
  ├── Diferença visual: cashDifference = countedValue - totalExpected (linha 26)
  ├── Justificativa: textarea (linha 100)
  │
  ├── MAS: Não há callback para o parent
  ├── NÃO há prop onChange para countedCash
  ├── O valor NUNCA sai do componente
  │
  ├── Hook: useCashClosing.ts → handleCloseCash (linha 448)
  │   passes: totals: { totalExpected, totalReceived, ... }
  │   NÃO passes: countedCash (não existe neste nível)
  │     ↓
  │   Service: operations.ts → closeCashRegister (linha 66)
  │     total_counted: totals.totalReceived  ← COMPUTADO, não do operador
  │     total_difference: 0                  ← SEMPRE 0
  └── Resultado: O valor do operador é perdido ❌
```

---

## 5. Semântica por Cenário

### 5.1 Cenário: Pagamento em Dinheiro

| Evento | Entrada | Saída | Saldo físico esperado |
|--------|---------|-------|----------------------|
| Comanda R$50 (dinheiro) | +R$50 | — | R$50 |
| Sangria R$20 | — | — (extras) | R$30 (R$50 - R$20) |
| Suprimento R$10 | — | — (extras) | R$40 (R$30 + R$10) |

**Fórmula correta:** `expected = saldoAtual + suprimentos - sangrias = 50 + 10 - 20 = 40` ✅
**Fórmula atual:** `expected = entradas + suprimentos - sangrias = 50 + 10 - 20 = 40` ✅ (sem saidas, idêntica)

### 5.2 Cenário: Estorno de Venda (H7)

| Evento | Entrada | Saída | Saldo físico esperado |
|--------|---------|-------|----------------------|
| Comanda R$35 (outro) | +R$35 | — | — (não é dinheiro) |
| Estorno R$35 (devolução) | — | R$35 | — (dinheiro devolvido) |
| Comanda R$45 (Pix) | +R$45 | — | — (não é dinheiro) |

**Saldo financeiro:** `entradas - saidas = 80 - 35 = 45`
**Saldo físico esperado (caixa):** `saldoAtual + sup - sang = 45 + 0 - 0 = 45`

**Fórmula correta:** `expected = 45` ✅
**Fórmula atual:** `expected = 80 + 0 - 0 = 80` ❌ (ignora o estorno)

### 5.3 Cenário: Pagamento Pix (fechamento barbeiro)

| Evento | Efeito físico no caixa |
|--------|----------------------|
| Comanda R$45 (Pix) | Nenhum dinheiro entra |
| ExpectedCash barbeiro | `paymentMethods['Dinheiro'] = 0` |
| CountedCash | Operador conta R$0 |

**Diferença:** `0 - 0 = 0` ✅

### 5.4 Cenário: Dinheiro + Pix (fechamento barbeiro)

| Evento | Efeito físico no caixa |
|--------|----------------------|
| Comanda R$30 (dinheiro) | +R$30 físico |
| Comanda R$50 (Pix) | Nenhum físico |
| Comanda R$20 (dinheiro) | +R$20 físico |
| ExpectedCash barbeiro | `paymentMethods['Dinheiro'] = 50` |
| CountedCash | Operador conta R$50 |

**Diferença:** `50 - 50 = 0` ✅

### 5.5 Cenário: Despesa manual

| Evento | Entrada | Saída | Saldo esperado |
|--------|---------|-------|----------------|
| Comanda R$100 (dinheiro) | +R$100 | — | R$100 |
| Despesa material R$35 | — | R$35 | R$65 |

**Fórmula correta:** `expected = saldoAtual + sup - sang = 65 + 0 - 0 = 65` ✅
**Fórmula atual:** `expected = 100 + 0 - 0 = 100` ❌ (ignora a despesa)

---

## 6. Definição Formal dos Três Conceitos Financeiros

### 6.1 Receita Bruta

```
receitaBruta = totalEntradas
```

**O que é:** Soma de todas as transactions `type='income'` do dia.
**Inclui:** Pagamentos em dinheiro, Pix, cartão, outros.
**Não inclui:** Saídas, estornos, despesas.
**Uso:** Exibição no dashboard ("Entradas do dia").
**NÃO é** o saldo devedor do caixa.

### 6.2 Movimentação Financeira

```
movimentacao = totalEntradas - totalSaidas
             = saldoAtual
```

**O que é:** Balanço líquido de todas as transações (entradas menos saídas).
**Inclui:** Entradas, saídas, estornos, despesas.
**Não inclui:** Suprimentos e sangrias (que são movimentações físicas, não transacionais).
**Uso:** Indicador financeiro ("Saldo operacional do dia").
**NÃO é** o saldo devedor do caixa físico.

### 6.3 Saldo Devedor do Caixa (Saldo Físico Esperado)

```
saldoDevedor = saldoAtual + totalExtrasSuprimento - totalExtrasSangria
```

**O que é:** Quanto dinheiro deveria estar fisicamente no caixa.
**Inclui:** Movimentação financeira + ajustes físicos (suprimentos/sangrias).
**Não inclui:** Pagamentos Pix/cartão (que não afetam o caixa físico).
**Uso:** Comparação com a contagem física do operador.
**É** o valor que o operador deveria encontrar ao contar o dinheiro.

---

## 7. Gap Analysis: Modelo Ideal vs Implementação Atual

### 7.1 Fechamento global

| Aspecto | Modelo ideal | Implementação atual | Gap |
|---------|-------------|---------------------|-----|
| `expected_balance` | `saldoAtual + sup - sang` | `entradas + sup - sang` | 🔴 Ignora saídas/estornos |
| `total_counted` | Input do operador | `totalReceived` (computado = `totalExpected`) | 🔴 Feature morta |
| `total_difference` | `counted - expected` | `totalReceived - totalExpected` (= 0 sempre) | 🔴 Validação circular |
| `validation.isValid` | Baseado na contagem real | Baseado em `totalReceived === totalExpected` (sempre true) | 🔴 No-op |
| Input "Valor Contado" | Salvo no DB | State local isolado, nunca persistido | 🔴 Input morto |

### 7.2 Fechamento barbeiro

| Aspecto | Modelo ideal | Implementação atual | Gap |
|---------|-------------|---------------------|-----|
| `expected_cash` | `paymentMethods['Dinheiro']` | `paymentMethods['Dinheiro']` | ✅ Correto |
| `counted_cash` | Input do operador | Input do operador | ✅ Funcional |
| `cash_difference` | `counted - expected` | `counted - expected` | ✅ Correto |
| `status` | `discrepancy` se diff > 0.01 | `discrepancy` se diff > 0.01 | ✅ Correto |

### 7.3 Testes

| Aspecto | Modelo ideal | Implementação atual | Gap |
|---------|-------------|---------------------|-----|
| `totalExpected` com estornos | Teste que estorno REDUZ esperado | `reversalEntries` sempre `[]` nos testes | 🔴 Não testado |
| `totalReceived` = valor do operador | Teste que `totalReceived` é input | `totalReceived` sempre igual a `totalExpected` | 🔴 Não testado |
| `difference` não-zero | Teste de divergência real | Impossível com fórmula atual | 🔴 Não testado |
| Ciclo completo | E2E open→conference→close | Apenas smoke de page load | 🔴 Não testado |

---

## 8. Plano de Remediação

### Fase 1: Contrato ✅

- [x] H7-REVIEW: Auditoria read-only completa
- [x] Especificação formal do modelo financeiro (este documento)

### Fase 2: Modelo ✅

- [x] Decisões do PO formalizadas (4/4)
- [x] Especificação técnica com 6 requisitos (RT-01 a RT-06)
- [x] Mapeamento de impacto por arquivo/linha

### Fase 3: Testes (PRÓXIMO GATE)

- [ ] Teste RT-01: `totalExpected = saldoAtual + sup - sang` (cenários com estorno)
- [ ] Teste RT-01: `totalExpected` com `reversalEntries` não-vazios
- [ ] Teste RT-02: `TotalsData` sem `totalReceived` (ou com `countedCash`)
- [ ] Teste RT-03: `PhysicalConference` emite `countedCash` via callback
- [ ] Teste RT-04: `total_difference = countedCash - totalExpected` (não sempre 0)
- [ ] Teste RT-05: `validation.isValid = false` quando counted diverge
- [ ] Teste RT-06: `CashClosingCompleted` event com `countedBalance` real
- [ ] Teste cenário H7 completo (R$35 estorno + R$45 Pix → expected R$45)
- [ ] Teste cenário: counted R$44 → difference R$-1 → isValid false
- [ ] Teste cenário: counted R$46 → difference R$+1 → isValid false

### Fase 4: Implementação

- [ ] RT-01: Corrigir `totalExpected` em `calculateTotals` e `computeDaySummary`
- [ ] RT-02: Remover/renomear `totalReceived` de `TotalsData`
- [ ] RT-03: Fazer wiring do input "Valor Contado" → hook → service → DB
- [ ] RT-04: Corrigir `total_difference` para usar `countedCash - totalExpected`
- [ ] RT-05: Mover `validation` para o hook (calcular com `countedCash`)
- [ ] RT-06: Atualizar domain event com dados reais
- [ ] Decidir fate de `26c43e5` (reverter parcialmente ou reescrever)

### Fase 5: E2E

- [ ] E2E: fechamento global com countedCash informado
- [ ] E2E: fechamento barbeiro com countedCash informado
- [ ] E2E: divergência detectada e justificada
- [ ] E2E: fechamento com estorno no dia

### Fase 6: Deploy + H-7 Reexecução

- [ ] Deploy corrigido
- [ ] Reexecutar H-7 completo
- [ ] Validar `total_difference` reflete divergência real
- [ ] Validar estornos afetam `expected_balance`
- [ ] Validar input "Valor Contado" persiste no DB

---

## 9. Decisões Formais do PO (2026-08-17)

### Decisão 1: Estornos reduzem `expected_balance`?

**Resposta: SIM.**

> Se entrou R$35 e depois houve um estorno legítimo de R$35, o caixa não deve esperar R$35 referentes àquela venda.

**Fórmula oficial:**
```
expected_balance = entradas - saídas + suprimentos - sangrias
                 = saldoAtual + suprimentos - sangrias
```

**Cenário H7 validado:**
```
Entradas       R$80
Estorno        R$35
Suprimentos    R$0
Sangrias       R$0
───────────────────
Esperado       R$45  ✅
```

### Decisão 2: `total_counted` deve representar quê?

**Resposta: O valor efetivamente informado pelo operador.**

> Não pode ser um valor calculado pelo próprio sistema.

**Modelo:**
```
expected_balance = sistema calcula
total_counted    = operador informa
difference       = counted - expected
```

### Decisão 3: Input global "Valor Contado" deve ser funcional?

**Resposta: SIM.**

> Se existe no fluxo de fechamento, ele precisa alimentar o modelo persistido. Caso contrário, é melhor remover o componente do que manter uma falsa aparência de controle financeiro.

### Decisão 4: Validação deve comparar valores independentes?

**Resposta: SIM.**

> Isso é talvez o ponto mais importante da H7-REVIEW.

**Modelo circular (ATUAL — errado):**
```
totalExpected → calculado
totalReceived → calculado
difference    → comparação entre dois valores calculados (SEMPRE 0)
```

**Modelo correto (DECIDIDO):**
```
         ┌──────────────┐
         │   SISTEMA    │
         │  calcula     │
         │  expected    │
         └──────┬───────┘
                │
                ▼
          expected = 45
                │
                ▼
         ┌──────────────┐
         │  OPERADOR    │
         │ informa      │
         │ counted      │
         └──────┬───────┘
                │
                ▼
           counted = 45  (ou 44, ou 46)
                │
                ▼
      difference = counted - expected
```

### Decisões 5-7: Deferred

| # | Pergunta | Decisão |
|---|----------|---------|
| 5 | `26c43e5`: reverter ou reescrever? | **Deferred** — decidir após testes (Fase 3) |
| 6 | Criar ADR? | **SIM** — após modelo formalizado |
| 7 | Treinamento em validação? | **SIM** — marcar fechamento financeiro como "em validação" |

---

## 10. Especificação Técnica (Requisitos de Implementação)

> **Status:** ESPECIFICAÇÃO AGUARDANDO TESTES — não implementar até Fase 3

### 10.1 Requisito RT-01: `totalExpected` = Saldo Devedor

**O que:** `totalExpected` deve representar o saldo devedor do caixa, não a receita bruta.

**Fórmula:**
```typescript
totalExpected = saldoAtual + totalExtrasSuprimento - totalExtrasSangria
              = (totalEntradas - totalSaidas) + totalExtrasSuprimento - totalExtrasSangria
```

**Impacto:**
| Arquivo | Linha | Mudança |
|---------|-------|---------|
| `application/cashClosing/summary.ts` | 54 (`calculateTotals`) | `totalExpected = saldoAtual + totalExtrasSuprimento - totalExtrasSangria` |
| `application/cashClosing/summary.ts` | 96 (`computeDaySummary`) | `totalExpected = saldoAtual + totalExtrasSuprimento - totalExtrasSangria` |

**Cenários de teste:**
- Entradas R$80, Saídas R$35 (estorno) → `totalExpected = 45`
- Entradas R$100, Saídas R$35 (despesa), Suprimento R$20, Sangria R$10 → `totalExpected = 75`
- Entradas R$50, Saídas R$0, Sangria R$20 → `totalExpected = 30`
- Entradas R$0, Saídas R0, Suprimento R$10 → `totalExpected = 10`

### 10.2 Requisito RT-02: `totalReceived` removido ou renomeado

**O que:** `totalReceived` em `TotalsData` não deve existir como valor computado. O valor contado pelo operador é um input, não um cálculo.

**Opções (decidir na Fase 3):**
- **Opção A:** Remover `totalReceived` de `TotalsData`, adicionar `countedCash` como parâmetro separado
- **Opção B:** Renomear `totalReceived` para `countedCash` e torná-lo um parâmetro de input

**Impacto:**
| Arquivo | Linha | Mudança |
|---------|-------|---------|
| `application/cashClosing/types.ts` | 122 (`TotalsData`) | Remover ou renomear `totalReceived` |
| `application/cashClosing/summary.ts` | 55, 97 | Remover cálculo de `totalReceived` |
| `src/hooks/useCashClosing.ts` | 379 | Remover extração de `totalReceived` |
| `src/hooks/useCashClosing.ts` | 415-424 (`handleSaveConference`) | Passar `countedCash` como input |
| `src/hooks/useCashClosing.ts` | 458-466 (`handleCloseCash`) | Passar `countedCash` como input |

### 10.3 Requisito RT-03: Input "Valor Contado" funcional

**O que:** O componente `PhysicalConference.tsx` deve emitir o valor contado para o parent.

**Impacto:**
| Arquivo | Linha | Mudança |
|---------|-------|---------|
| `components/financial/closing/PhysicalConference.tsx` | 6-11 | Adicionar prop `onCountedCashChange: (value: number) => void` |
| `components/financial/closing/PhysicalConference.tsx` | 19, 25 | Chamar `onCountedCashChange(countedValue)` no onChange |
| `pages/CashClosingPage.tsx` | 504-509 | Passar handler `onCountedCashChange` |
| `src/hooks/useCashClosing.ts` | — | Adicionar state `countedCash` e expor via callback |

**Fluxo:**
```
PhysicalConference (input) → onCountedCashChange → CashClosingPage → useCashClosing
  → countedCash state → handleSaveConference / handleCloseCash → operations.ts → DB
```

### 10.4 Requisito RT-04: `difference` = counted - expected

**O que:** `total_difference` no DB deve ser `countedCash - totalExpected`, não `totalReceived - totalExpected`.

**Impacto:**
| Arquivo | Linha | Mudança |
|---------|-------|---------|
| `application/cashClosing/operations.ts` | 106 (`closeCashRegister`) | `total_difference: countedCash - totals.totalExpected` |
| `application/cashClosing/operations.ts` | 254 (`saveDraftConference`) | `total_difference: countedCash - totals.totalExpected` |
| `application/cashClosing/summary.ts` | 103 (`computeDaySummary`) | Remover `validation` daqui (agora é no hook) |
| `src/hooks/useCashClosing.ts` | — | Calcular `validation = validate(totalExpected, countedCash)` |

### 10.5 Requisito RT-05: Validação real

**O que:** `validation.isValid` deve ser `false` quando `countedCash` diverge de `totalExpected`.

**Modelo:**
```typescript
// No hook (não mais em computeDaySummary)
const validation = validateCashClose(totalExpected, countedCash);
// difference = countedCash - totalExpected
// isValid = abs(difference) <= 0.01
```

**Impacto:**
| Arquivo | Linha | Mudança |
|---------|-------|---------|
| `src/hooks/useCashClosing.ts` | 103 (removido de `computeDaySummary`) | Calcular validation no hook |
| `src/hooks/useCashClosing.ts` | 362-371 | `validation` agora depende de `countedCash` |
| `components/financial/closing/PhysicalConference.tsx` | 35-42 | Badge "Conferido/Divergencia" usa validation real |

### 10.6 Requisito RT-06: Evento `CashClosingCompleted` com dados reais

**O que:** O domain event deve publicar `countedBalance` real (input do operador), não o computado.

**Impacto:**
| Arquivo | Linha | Mudança |
|---------|-------|---------|
| `application/cashClosing/operations.ts` | 135 (`closeCashRegister`) | `countedBalance: countedCash` |
| `application/cashClosing/operations.ts` | 136 | `difference: countedCash - totals.totalExpected` |
| `application/cashClosing/operations.ts` | 138 | `hasDiscrepancy: abs(countedCash - totalExpected) > 0.01` |

---

## 11. Mapa de Impacto por Arquivo

| Arquivo | Requisitos afetados | Linhas específicas |
|---------|--------------------|--------------------|
| `application/cashClosing/summary.ts` | RT-01, RT-02 | 54, 55, 96, 97, 103 |
| `application/cashClosing/types.ts` | RT-02 | 122 (`TotalsData.totalReceived`) |
| `application/cashClosing/operations.ts` | RT-04, RT-06 | 103, 106, 135-138, 253-254 |
| `src/hooks/useCashClosing.ts` | RT-02, RT-03, RT-04, RT-05 | 379, 415-424, 458-466 |
| `components/financial/closing/PhysicalConference.tsx` | RT-03 | 6-11, 19, 25, 68 |
| `pages/CashClosingPage.tsx` | RT-03 | 504-509 |
| `application/cashClosing/cashClosing.test.ts` | Todos | Todos os testes com `makeTotals` |
| `application/cashClosing/summary.test.ts` | RT-01, RT-02 | Testes de `computeDaySummary` |

---

## 12. Estado do H-7

```
H-7
 ├── Fluxo operacional ............... ✅
 ├── Agendamento .................... ✅
 ├── Atendimento .................... ✅
 ├── Comanda ........................ ✅
 ├── Pagamento Pix R$45 ............. ✅
 ├── Comissão Heron R$22,50 ......... ✅
 ├── Fechamento profissional ........ ✅
 │
 ├── R$35 ........................... ✅ ESTORNO LEGÍTIMO
 │
 ├── BUG-01 original ................ ❌ Falso positivo
 ├── Patch 26c43e5 .................. 🔴 Regressão identificada
 │
 ├── H7-REVIEW ...................... ✅ Auditoria completa
 ├── H7-REMEDIATION ................. 🔴 Em andamento
 │    ├── Contrato .................. ✅ Este documento
 │    ├── Decisões PO ............... ✅ 4/4 formalizadas
 │    ├── Especificação técnica ...... ✅ 6 requisitos (RT-01 a RT-06)
 │    ├── Testes .................... ⏳ Fase 3 (PRÓXIMA)
 │    ├── Implementação ............. ⏳ Fase 4
 │    ├── E2E ....................... ⏳ Fase 5
 │    └── Deploy + H-7 reexecução ... ⏳ Fase 6
 │
 ├── Fechamento barbeiro ............ ✅ Funcional
 ├── Fechamento global .............. 🔴 5 gaps identificados
 └── Próximo gate ................... 🔴 Fase 3: testes ANTES de código
```

### Gate de Progresso

```
H7-REVIEW                  ✅
       │
       ▼
Financial Model Spec       ✅
       │
       ▼
Decisões do PO             ✅ ← CONCLUÍDO
       │
       ▼
Testes do modelo           ⏳ ← PRÓXIMO GATE
       │
       ▼
Implementação              ⏳
       │
       △
E2E financeiro             ⏳
       │
       △
Deploy                     ⏳
       │
       △
H-7 reexecução             ⏳
```
