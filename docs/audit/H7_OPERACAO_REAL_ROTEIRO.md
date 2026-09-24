# H-7 — Operação Real: Roteiro de Execução e Checklist de Evidências

> **Status:** 🟡 **P1-01 — frente de correção ENCERRADA em produção (D-HOM-32, 2026-09-24): PROD HEALTH GATE = PASS @ `5a28456`.** Janela 2026-09-23 (D-HOM-31) permanece o registro da **reprodução** (Q1–Q4 ✅, P1-01 evidenciado §10.7, Q5–Q7 não executados, `6bd5cbe4` preservada). A **frente de correção/validação ponta-a-ponta do P1-01** (aberta por D-HOM-31) foi implementada, validada em STAGING (**8/8 PASS**), mergeada (`5ad3c46` → PR #79 → **`5a28456`**) e auditada read-only em PROD (bundle/supabase/`comanda_items.staff_id`/CI OK). **Nenhuma alteração adicional em PROD.** **Retomada operacional do H-7 (fechamento de caixa + Q5–Q7) = decisão separada do PO** (não autorizada por D-HOM-32). **3 pendências independentes** (deploy-validate / migration `20260924*` / auto-deploy change-control) — frentes próprias, não abertas. `6bd5cbe4` e D-HOM-27b: **inalterados.**
> **Status anterior (janela 2026-09-02):** 🟢 JANELA EXECUÇÃO EM ANDAMENTO (2026-09-02, com Rubens/equipe). **Baseline oficial = snapshot 09-02 08:24** (`H7_BASELINE_READONLY.md` §8) — substitui o 08-16 como referência operacional. **S3-1 = FECHADO** (doc `H7_1_INVESTIGACAO_S3_READONLY_20260816.md` §8 S3-4; decisão PO 09-02: resolvido operacionalmente, fora das ações da janela). Ciclo H7-1 em execução. **H2-8 = 🟢 FECHADO (§10.6):** causa raiz (§10.5 — colunas fantasma `comandas.discount`/`comanda_items.staff_id` no publish do `reversal.ts`) **corrigida no código em `523192a`** e **cadeia completa comprovada em STAGING** (`tests/homologation/h2-8/h2-8-staging-chain.spec.ts` PASS: `CheckoutReverted` → `reverse_commission` → reversal de comissão → net 0 → idempotente). **Produção NÃO tocada; sem deploy; sem migration.**
> **Atualização 2026-08-16 (Trilha A):** incidente original resolvido por evidência — causa raiz **CONFIRMADA** como frontend de produção `718f6f9` defasado × schema vigente (`tenants.active` removido pela migration `20260728000000`). Ver `docs/audit/H7_1_TRILHA_A_REPRODUCAO.md`. A execução do ciclo H7-1 no preview `78604c6` (código novo) foi auditada e está íntegra; **nenhuma correção aplicada; operação permanece parada.**
> **Referência:** `docs/audit/HOMOLOGATION_PLAN_SANCHEZ_BARBER.md` (§8.2 — Gate H-7) · `docs/audit/SNAPSHOT_PRE_HOMOLOGACAO_SANCHEZ_BARBER_v1_5_0.md` (§4/§12) · `docs/BUSINESS_DECISIONS.md` (D-HOM-26, D-HOM-27)
> **Data do roteiro:** 2026-08-14 · **Responsável:** OpenCode + Operação (Sanchez Barber) · **PO:** Augusto

---

## 1. Decisões do PO (D-HOM-27, 2026-08-14)

| # | Decisão | Conteúdo |
|---|---------|----------|
| 1 | **Ambiente** | **Sanchez Barber real** (objetivo do H-7 é validar comportamento financeiro e operacional com dados reais). **Sem apagar, editar ou manipular dados existentes.** O atendimento/comanda do teste deve ser **identificável como homologação**. Antes e depois, capturar saldos/contagens relevantes. |
| 2 | **Escopo** | **1 ciclo completo ponta-a-ponta** (H7-1), não vários atendimentos. Se o primeiro ciclo estiver perfeito → avaliar ampliação. |
| 3 | **Agendamento** | **Sem execução espontânea.** Janela **acompanhada**, idealmente com **Rubens/equipe disponível** para confirmar operações funcionais. Dia/horário + equipe definidos pelo PO. |
| 4 | **Critério de parada** | Qualquer **divergência financeira, duplicidade, perda de crédito, comissão incorreta, alteração inesperada de saldo ou quebra de fechamento = PARAR imediatamente**. **Não tentar corrigir "na hora" no banco.** |
| 5 | **M7** | **Permanece BLOQUEADA.** Não há motivo para colocar migration redundante no banco só para fechar 10/10. H-6 = 🟢 com **9/10 correções efetivamente necessárias**; M7 = dívida P3 separada (`approve_access_request`). |
| 6 | **Limite do H-7** | **H-7 NÃO é autorização para produção/deploy.** Estado permanece: **H-6 🟢 → H-7 ⏳ → H-8 🔴**. Sem merge, tag ou deploy de produção. |

> **Registro formal:** `docs/BUSINESS_DECISIONS.md` (D-HOM-27).

---

## 2. Critério de Parada (regra obrigatória durante a execução)

> **Qualquer divergência financeira, duplicidade, perda de crédito, comissão incorreta, alteração inesperada de saldo ou quebra de fechamento = PARAR imediatamente.**

Ao disparar a parada:

1. **PARAR imediatamente** a operação (nenhuma nova ação de negócio).
2. **NÃO corrigir no banco** em momento algum (proibido pela regra do PO).
3. Capturar **evidência do estado** (prints, JSON das operações, queries read-only).
4. **Registrar achado** (P0/P1/P2) e **apresentar ao PO** com diagnóstico da causa raiz.
5. O gate fica **🔴 BLOQUEADO** até decisão do PO sobre a correção (janela própria).

---

## 3. Pré-condições de Execução (gate H-7 — §8.2)

- [x] **H-6 🟢** (D-HOM-26) — ✅ satisfeita
- [x] **H-2 🟢** (D-HOM-14) — ✅ satisfeita
- [x] **Matriz/escopo do ciclo H7-1 apresentada ao PO** — ✅ (este roteiro, D-HOM-27)
- [x] **Decisão do PO sobre ambiente** — ✅ **dados reais** do tenant Sanchez Barber (D-HOM-27)
- [x] **Janela acompanhada definida** (dia/horário) + **equipe presente (Rubens)** — ✅ **2026-09-02 — Rubens executa agora**
- [x] **Reflexo no receivable** do crédito Chef Club consumido (H3-4) conferido — ✅ (2026-08-16, `H7_1_INVESTIGACAO_S3_READONLY_20260816.md` §3)
- [x] **Investigação S3** (10 overdue + 6 pending) — ✅ **S3-1 FECHADO (2026-08-16, §8 S3-4); demais overdue = dívidas órfãs / ciclos não avançados (decisão de negócio PO)** — baseline 09-02: 7 overdue/R$1.600
- [ ] **Quadratura SQL formal H2-1..H2-8** (cancelamento/reversão) — ⏳ faz parte da execução

> O ciclo **não inicia** sem a janela acompanhada definida pelo PO (regra de agendamento).

---

## 4. Baseline Pré-Ciclo (captura read-only imediata antes da operação)

> Tenant: Sanchez Barber (`b716e290...`, `sanchez`) · Banco remoto de produção: `ushsnmlbeurfvlkieiln` · Referência instantânea de 2026-08-08: `SNAPSHOT_PRE_HOMOLOGACAO_SANCHEZ_BARBER_v1_5_0.md`. O tenant é LIVE — contagens podem variar durante a operação.

> **✅ BASELINE CAPTURADO (2026-08-16, janela ~20:25–20:35):** `docs/audit/H7_BASELINE_READONLY.md`. Read-only, zero escritas. Resumo: clients 302 · services 17 · products 18 (estoque 68) · appointments 1.447 · comandas 1.384 · transactions 736 · credits 16 (77 disponíveis ativas / 3 usadas) · cash_closings 3 `draft` (nenhum confirmado) · barber_closings 0 · participantes 377 · receivables 47 (paid 30/R$ 6.440 · overdue 10/R$ 2.340 · pending 7/R$ 1.360). **Pendente:** Fase 2 — Ciclo H7-1 (depende da janela acompanhada + equipe, decisão do PO).

Capturar (somente leitura) antes do ciclo:

| # | Domínio | Contagem/Medida esperada | Query de referência |
|---|---------|--------------------------|---------------------|
| B1 | Clientes | `clients` ≈ 293 (snapshot §3) | COUNT por tenant |
| B2 | Serviços / Produtos | 17 serviços / 18 produtos (snapshot §4) | COUNT por tenant |
| B3 | Agendamentos | `appointments` ≈ 1.361 (snapshot §5) | COUNT por tenant |
| B4 | Comandas | `comandas` ≈ 1.294 (snapshot §4) | COUNT por tenant |
| B5 | Transactions | ≈ 705 (snapshot §4) | COUNT por tenant |
| B6 | Créditos Chef Club | saldo por cliente `customer_credits` (ex.: HOMOLOG 5→4 no H3-4) | SELECT `balance`/COUNT |
| B7 | Estoque relevante | estoque dos itens a consumir | SELECT `stock` por produto |
| B8 | Fechamentos | `cash_closings` (3 `draft`, nenhum confirmado — snapshot §11) + `barber_closings` (0) | COUNT por status |
| B9 | Comissões | comissões existentes (base/percentual/status) | COUNT + SUM |
| B10 | Contas/Recebíveis | `customer_subscription_receivables` 43 (27 paid / 10 overdue / 6 pending) | COUNT por status + SUM |

**Identificação exata dos registros a criar pelo teste** (registrar antes de executar):

| Registro | Identificador planejado |
|----------|------------------------|
| Cliente (se novo) | nome com sufixo **"HOMOLOG H7"** |
| Agendamento | associado ao cliente HOMOLOG H7, com observação "HOMOLOG" |
| Comanda | comanda do ciclo H7-1, com itens/observação "HOMOLOG H7" |
| Transaction(s) | geradas pelo pagamento do ciclo (vincular à comanda H7-1) |
| Crédito Chef Club (se aplicável) | consumo de 1 crédito de cliente HOMOLOG |
| Fechamento profissional | fechamento do profissional responsável pelo atendimento |
| Fechamento de caixa | fechamento formal do caixa do dia |

> Regra: **nenhum registro existente é alterado**. Apenas dados criados pelo próprio ciclo de teste, identificáveis como homologação.

---

## 5. Execução do Ciclo H7-1 (janela acompanhada — a definir pelo PO)

Sequência obrigatória do ciclo real:

1. **Agenda** — cliente HOMOLOG H7 agenda (ou agenda já existente identificada) → chega ao salão.
2. **Atendimento** — atendimento real pelo profissional (Rubens/equipe).
3. **Comanda** — abertura e composição da comanda com os serviços/produtos consumidos.
4. **Pagamento** — checkout com a forma de pagamento definida (pix/dinheiro/crédito/Chef Club — conforme H2-2). Registrar forma, valor bruto, descontos/créditos aplicados e valor pago.
5. **Comissão** — conferir comissão do profissional responsável (percentual/base conforme ADR-001).
6. **Fechamento profissional** — fechamento do profissional (H2-4).
7. **Fechamento de caixa** — fechamento formal do caixa (H2-3).
8. **Conferência financeira** — quadratura final (ver §6).

> **Em cada etapa:** registrar timestamp, valores, prints e JSON das operações (evidência).

---

## 6. Quadratura Pós-Ciclo (conferência SQL read-only após a operação)

A quadratura é a **evidência formal** de que o ciclo fechou sem divergência:

| # | Elo | Verificação |
|---|-----|-------------|
| Q1 | **Comanda** | valor bruto → descontos/créditos → **valor efetivamente pago** (todos os campos da comanda H7-1) |
| Q2 | **Transaction** | **entrada financeira correspondente** ao valor pago (mesma comanda, mesmo valor, sem duplicidade) |
| Q3 | **Chef Club** | **crédito consumido corretamente** (se usado: 1 crédito, saldo do cliente decresceu de forma consistente; sem perda de crédito) |
| Q4 | **Comissão** | **profissional correto** (o que atendeu) + **percentual/base corretos** + **valor correto** (ADR-001) |
| Q5 | **Fechamento profissional** | valores do fechamento do profissional == comissões do ciclo |
| Q6 | **Fechamento de caixa** | valores do fechamento == transações do período |
| Q7 | **Financeiro consolidado** | caixa × comissões × comandas quadrados (§4 como baseline) |

---

## 7. Controles Complementares (parte do gate H-7)

### 7.1 Matriz H2-1..H2-8 (quadratura SQL formal — cancelamento/reversão)

Evidenciar no H-7 a quadratura SQL formal da matriz de cancelamento/reversão:

| ID | Controle | Resultado esperado |
|----|----------|--------------------|
| H2-1 | Comanda → transações (todas as formas de pagamento) | Pagamento registrado; valores conferem |
| H2-2 | Checkout com as formas de pagamento do tenant (pix, dinheiro, crédito, Chef Club) | Pagamento registrado; valores conferem |
| H2-3 | Fechamento de caixa | Soma das transações == fechamento |
| H2-4 | Fechamento por profissional | Comissões == fechamento do profissional |
| H2-5 | Comissões (ADR-001) | Base/percentual/valor corretos |
| H2-6 | Receitas/despesas | Lançamentos consistentes |
| H2-7 | Quadratura caixa × comissões × comandas | Soma confere (sem duplicidade) |
| H2-8 | Cancelamento/reversão de checkout | Reversão consistente (sem duplicidade) |

### 7.2 H3-4 — Reflexo no receivable (crédito Chef Club consumido)

- ✅ **FECHADO (2026-08-16, read-only):** receivable do ciclo H3-4 (HOMOLOG H3 TESTE, `8b1cdee8…`) **pago via Pix** R$ 160,00 em 2026-08-11, notes `HOMOLOGACAO H3 - baixa do ciclo de teste`; crédito debitado (`available 4 / used 1`); próximo ciclo `pending` (due 09-10). **Sem `42703`, sem duplicidade, sem perda de crédito.** Evidência: `docs/audit/H7_1_INVESTIGACAO_S3_READONLY_20260816.md` (§3).

### 7.3 S3 — Investigação (10 overdue + 7 pending)

- 🔴 **ACHADO S3-1 (P1) registrado (2026-08-16, read-only):** **receivable duplicado — RIOS - AMIGO**, ciclo 2026-06-15, R$ 260,00. Mesma `due_date`, `billing_cycle_start` idêntico ao receivable **já pago** (`0c1ee064…`, pago 06-06, tx `cb41ed2c`), mas `billing_cycle_end` divergente (08-14 vs 07-15) → o `ON CONFLICT (subscription_id, billing_cycle_start, billing_cycle_end)` **não disparou**; o duplicado (`d561a4c3…`, `overdue`, sem `transaction_id`) foi criado em **2026-08-06 18:45**. **S3 inflado em R$ 260,00** (sem impacto de caixa). **Sem correção — decisão de tratamento = PO.**
- Demais overdue: 2 pertencem a subs `canceled` (PIETRO, K11 — dívida órfã); várias subs `active` com `next_billing_date` parado e **1 único receivable** (LEONE, LUKAS, THIAGO, DAVI) — hipótese de ciclo de billing não avançar em subs sem pagamento registrado (validar na janela acompanhada).
- Evidência completa: `docs/audit/H7_1_INVESTIGACAO_S3_READONLY_20260816.md`.

### 7.4 Comissão com dados reais

- Validar comissão do ciclo real (profissional, base, percentual, valor) contra ADR-001 — reforço da validação funcional já executada no preview oficial (D-HOM-14).

---

## 8. Checklist de Evidências (a anexar ao registro do gate)

- [x] Baseline pré-ciclo capturada (B1..B10) com queries e saída. — ✅ baseline fresco 2026-09-23 (`h7-baseline-pre-execution-1790173523654.json`)
- [x] Registros a criar identificados (tabela da §4) confirmados. — ✅ cliente `HOMOLOG H7` original + comanda `b5368c28` identificáveis
- [x] Prints/JSON/timestamps de cada etapa do ciclo (agenda → conferência). — ✅ `h7-observe-step0..step3-*.json` + `h7-qcheck-pagamento-*.json` (conferência encerrada no P1-01, §10.7)
- [x] Comanda do ciclo (valor bruto → descontos → pago). — ✅ Q1 PASS (`b5368c28` R$145, discount 0, paid cash)
- [x] Transaction(s) correspondentes. — ✅ Q2 PASS (1× income R$145 `d39803f7`, sem duplicidade)
- [ ] Crédito Chef Club consumido (se aplicável). — não aplicável no ciclo 09-23
- [x] Comissão (profissional/base/percentual/valor). — ✅ Q4 PASS (`7bf99382` HERON R$45×50%=R$22,50 active)
- [ ] Fechamento profissional + fechamento de caixa + financeiro consolidado. — 🔴 encerrado no P1-01 (§10.7): fechamento profissional gravou divergência falsa; fechamento de caixa e consolidado NÃO executados (D-HOM-31)
- [ ] Quadratura Q1..Q7 (saída SQL). — Q1–Q4 ✅ PASS; **Q5–Q7 NÃO executados** (D-HOM-31)
- [ ] Matriz H2-1..H2-8 (cancelamento/reversão).
- [ ] Reflexo receivable H3-4.
- [ ] Investigação S3 (10 overdue + 6 pending) com conclusão.
- [ ] Nenhum registro existente alterado (conferência de integridade — opcional, conforme necessidade).

---

## 9. Critérios de Fechamento do Gate

| Veredito | Condição |
|----------|----------|
| 🟢 | Ciclo completo H7-1 executado sem erro; quadratura Q1..Q7 ok; controles H2-1..H2-8 + H3-4 + S3 + comissão concluídos; nenhuma divergência financeira |
| 🔴 | Qualquer divergência financeira/duplicidade/perda de crédito/comissão incorreta/alteração inesperada de saldo/quebra de fechamento no ciclo real → **PARAR**, registrar achado e aguardar decisão do PO |

> **O veredito do H-7 é decisão do PO.** A aprovação do H-7 **não autoriza produção/deploy** — o H-8 permanece 🔴 BLOQUEADOR e o estado continua **H-6 🟢 → H-7 ⏳ → H-8 🔴**.

---

## 10. Log de Execução da Janela — Ciclo H7-1 (2026-09-02)

> **Operador:** Rubens Sanchez (via UI, produção `smg-barber`) · **Conferência no banco:** OpenCode (read-only, Management API) · **Baseline de referência:** 09-02 08:24 (`H7_BASELINE_READONLY.md` §8).

### 10.1 Comanda do ciclo — HOMOLOG H7 (CORTE SIMPLES, cash)

| Campo | Valor | Evidência |
|-------|-------|-----------|
| Comanda `id` | `298c12e0-5450-43f3-bba7-acc0c07bd2c5` | tabela `comandas` |
| Cliente | `HOMOLOG H7` (`edbe83f1…`, criado 08-17) | tabela `clients` |
| Item | CORTE SIMPLES (`2b5e3acd`), unit R$45, qty 1 | tabela `comanda_items` |
| Participante | `ec75f3ad` → **HERON FERREIRA** (`62ddf002…`), role primary, `affects_commission=true`, payout 100% | tabela `service_execution_participants` |
| Subtotal / desconto / total | R$0 / R$0 / **R$45** | tabela `comandas` |
| Status / forma | `paid` / `cash` | tabela `comandas` |
| `financial_effect` | `true` (closed_at 11:46:14) | tabela `comandas` |
| Transaction | income **R$45** "Receita de Comanda" (`82f6cffa`) | tabela `transactions` |
| Commission_record | `7ec7d0ee`: gross R$45, **received R$45**, rate 50% → **comissão R$22,50**, `status=active` | tabela `commission_records` |

**VEREDITO (A/B/C da reconciliação):**
- **A. Persistência da operação — PASS** (comissão R$22,50 persistida corretamente).
- **B. Tela da comanda — PASS** (mostra Comissão R$22,50 e botão "Fechar Caixa do Barbeiro").
- **C. Dashboard/Detalhes de comissão — RESOLVIDO** (não é divergência; ver §10.2).

### 10.2 Reconciliação do FINDING R$40/R$20 vs R$45/R$22,50 — RESOLVIDO (não é bug)

**Sintoma (captura 2):** tela consolidada mostra "Vendas válidas R$40 / Comissão R$20 / Taxa 50% / CORTE SIMPLES / Comanda `#d1d8397c` / Cliente DIEGO NEGUINHO - HERON".

**Causa raiz (confirmada no banco):** a comanda mostrada na tela consolidada **não é a do ciclo H7**. É a comanda **`d1d8399c-c4ee-4af0-8408-dbb17431e5dd`** (09-01 20:39, cliente DIEGO NEGUINHO - HERON, forma **pix**, transaction `notes="dsc"`), que possui **desconto legítimo de R$5** (`discount=5.00` — item CORTE SIMPLES R$45 − R$5 = total recebido **R$40**). O `commission_record` correspondente (`09ba8d47`) tem `gross=45.00`, `net=45.00`, **`received_value=40.00`** → comissão **R$20** (40 × 50%). **Cálculo CORRETO por `received_value`.**

A comanda do ciclo **`298c12e0`** tem `discount=0.00`, `total=R$45`, `received_value=45.00` → comissão **R$22,50**. **Cálculo CORRETO.**

**Conclusão:** as duas superfícies leem de comandas DIFERENTES e ambas calculam comissão sobre o **valor recebido** (`received_value`). **Não há divergência na operação H7.** O R$5 é um desconto legítimo de uma comanda anterior (09-01), não um fantasma da operação.

**Observação (não bloqueante, cadastro):** na comanda `d1d8399c` o campo `commission_record.discount` não foi preenchido (=0) apesar de a comanda ter desconto R$5 (o `received_value` reflete corretamente R$40, mantendo a comissão correta). Recomendação: verificar população do `discount` em `commission_records` em correção futura (não afeta valores atuais).

**Panorama HERON (09-02):** 41 `commission_records` ativos — 10 com desconto (`received<net`), 31 sem; soma recebida R$2.080. Operação H7 em conformidade.

### 10.3 Anomalia residual — comanda `6bd5cbe4` (Penteado R$15) ⚠️

Comanda do teste do Rubens (09-02 11:43, Penteado R$15, cash) que teve o checkout **revertido** via transaction "Devolucao de Comanda" (expense R$15, `notes="teste"`, 11:45:42), porém permaneceu **inconsistente**:
- `comandas.status = paid` (não cancelada; `cancellation_type=null`, `cancelled_at=null`)
- `commission_record` `0645128f` continua `active` (R$7,50) apesar da reversão
- Participante mantido

**Classificação:** teste cancelado pelo operador, fora da operação comercial; repercussão financeira líquida zero na receita (income R$15 + expense R$15). **Porém a reversão não reverteu o `commission_record` nem o status da comanda — inconsistência de estado.** Investigação read-only da matriz H2-8 em §10.4.

### 10.4 H2-8 — Investigação read-only da reversão ↔ comissão (2026-09-02)

**Fonte de evidência válida:** trilha persistida de side-effects (`outbox_items` + `processed_operations`). **`event_store` NÃO é fonte válida** — contém **0 registros globalmente** em produção (inclusive para eventos que certamente ocorreram), portanto é um persister não populado/no-op; excluído da matriz probatória.

**Cadeia observada para `6bd5cbe4` (Penteado R$15, reversão via `finance_reverse_transaction`):**

| Etapa | Evidência | Status |
|-------|-----------|--------|
| Checkout (income R$15) | transaction `8e21de92` + comanda `paid` | ✅ |
| Comissão criada | `commission_record` `0645128f` R$7,50 (`active`) | ✅ |
| Outbox `CheckoutCompleted`→create | item `28f094aa` (`published`, 11:43:45, op `create_commission_record`/`record`) | ✅ |
| `processed_operations` create | `20f6ae3c` (`record`, 11:43:45) | ✅ |
| Devolução financeira (expense R$15) | transaction `7b566803` + `financial_reversals` `f6f9c524` (`full_refund`, `reason_note=teste`, 11:45:42) | ✅ |
| **Outbox CheckoutReverted** | **AUSENTE** — as 30 `outbox_items` do tenant são **todas `CheckoutCompleted`**; zero `CheckoutReverted` | ❌ |
| **Outbox `reverse_commission`** | **AUSENTE** | ❌ |
| **`processed_operations` `reverse_commission`** | **AUSENTE** para `6bd5cbe4` | ❌ |
| **Reversal record de comissão** | **AUSENTE** (nenhum `record_type='reversal'` para `6bd5cbe4`) | ❌ |

**Controprova (o pipeline FUNCIONA quando acionado):** em **2026-08-25** (comanda `f859260a`) existe um `processed_operations` `commission` com `idempotency_key = evt_..._12_reverse_commission` (processado 23:24:33) e o `commission_record` `5b645e00` `record_type='reversal'` R$-7,50 — ou seja, **a cadeia `CheckoutReverted → reverse_commission → ReverseCommissionHandler → reversal record` já operou corretamente** ao menos uma vez. Exatamente **1** `reversal` existe em todo o tenant.

**Conclusão H2-8 — FINDING DE CONTRATO (real, não inferido) + CAUSA RAIZ COMPROVADA EM STAGING (hipótese B):**
- A devolução financeira (RPC `finance_reverse_transaction`) executou a **perna financeira** (reversal transaction + `financial_reversals`) mas **não executou a perna de comissão** (sem `CheckoutReverted`/`reverse_commission` na trilha persistida), diferentemente do que ocorreu em 08-25.
- **Causa raiz CONFIRMADA empiricamente (12:0x–13:1x, staging `tjcvuhynckocmvtqykxp`, com o código atual HEAD):** o caminho `reverseFinancialTransaction` do código atual **não publica `CheckoutReverted`**, mesmo com todas as leituras (transactions/comandas/comanda_items/service_execution_participants) retornando dados via cliente autenticado. O `appEventBus.publish` **nunca é chamado** e **nenhuma exceção é lançada** (`[REVERSAL][EVENT-PUBLISH-FAILED]` ausente). A causa é a presença de **colunas fantasma no bloco de publish**: `.select('id, discount')` em `comandas` (coluna `discount` **não existe** no schema real) e `.select('id, unit_price, quantity, staff_id')` em `comanda_items` (coluna `staff_id` **não existe**). O código desestrutura apenas `{ data: x }` e **nunca checa `.error`**, então o erro de PostgREST (coluna inexistente) retorna silenciosamente `comandaData = null` → `if (comandaData)` é false → **todo o bloco de publish é pulado** → `CheckoutReverted` nunca dispara → `reverse_commission` nunca é enfileirado no outbox → a comissão (R$7,50) **não é revertida**, mesmo com a reversão financeira (R$15) registrada com sucesso.
   - **Provado por harness de homologação** (`tests/homologation/h2-8/h2-8-staging-reversal.spec.ts`, executado N vezes contra staging, teardown completo após cada run): reprova a cadeia de publish com as **mesmas colunas fantasma que estão no código HEAD** — que é exatamente o caminho de produção 09-02.
   - **Confirma e estende a hipótese B:** além do drift `service_execution_participants.staff_id`→`professional_id` (que existe), há um short-circuit **mais fundamental** — a coluna fantasma `comandas.discount` (linha ~142) que derruba o bloco inteiro antes mesmo do cálculo de comissão.
   - **Histórico de fixes parciais:** `d4b4bf0` (08-24) corrigiu o nome da tabela `service_execution_participants`; `4cfa854` (08-24 18:23) removeu `comanda_items.discount` mas **deixou `comanda_items.staff_id`** (ainda fantasma) e **nunca removeu `comandas.discount`** — ambos permanecem no HEAD.
- **Não resolver no banco:** `6bd5cbe4` permanece como evidência forense; reversão de comissão e status = decisão do PO **após a correção das colunas fantasma no código** (novo commit), não por UPDATE manual. A correção atualiza o `reversal.ts` para ler apenas colunas reais (`comandas` sem `discount`, `comanda_items` sem `staff_id`, `service_execution_participants.professional_id`) e checar `.error` nas leituras.

**Matriz H2-8:**

| Cenário | Resultado observado | Critério esperado | Status |
|---------|---------------------|-------------------|--------|
| Checkout gera comissão | `commission_record` criado | Comissão criada | ✅ |
| Receita original | R$15 income | Receita registrada | ✅ |
| Reversão financeira | R$15 expense + `financial_reversals` | Receita neutralizada | ✅ |
| Saldo líquido | R$0 | Sem perda financeira | ✅ |
| Comanda após reversão | `paid` | Estado coerente com reversão | ❌ |
| Comissão após reversão | `active` R$7,50 | Comissão revertida/cancelada | ❌ |
| `CheckoutReverted` → `reverse_commission` | **AUSENTE** na trilha persistida | Comissão acompanha reversão | ❌ (comprovado em 08-25 que funciona quando acionado) |
| Fechamento | — | Sem comissão inconsistente | ⚠️ não avaliado (não houve fechamento pós-reversão) |

**Resultado H2-8: 🔴 FAIL / FINDING DE CONTRATO ABERTO.** Não é perda financeira (saldo R$0), mas o pipeline de reversão não reverteu a comissão nem o status em `6bd5cbe4`.

---

### 10.5 H2-8 — Comprovação controlada em STAGING (2026-09-02) — VEREDITO FINAL

**Ambiente/Controle:** staging `https://tjcvuhynckocmvtqykxp.supabase.co` (schema real do produto), **código atual HEAD** (`src/lib/finance/reversal.ts`, sem alterações), execução controlada pelo harness `tests/homologation/h2-8/h2-8-staging-reversal.spec.ts`. **Não tocou produção.** Envolvido: tenant sintético H2-8 + staff `manager` comissionável 50% (`id == auth.uid()`) + `profiles` + cliente + serviço R$15 + comanda/item R$15 + `service_execution_participants.professional_id` (coluna real) + participante 50% + transação income `paid` R$15 source `comanda` + reversão `full_refund` R$15. Teardown completo pós-run (confirmado: 0 tenants/auth/profiles H2-8 no staging).

**Resultado do harness (Etapa A — código real):**

| Sinal | Valor | Significado |
|-------|-------|-------------|
| RPC `finance_reverse_transaction` | `success: true` (financial_reversal + reversal expense tx criados) | Perna financeira OK |
| Leituras via cliente autenticado (RLS) | 1 linha em `transactions`/`comandas`/`comanda_items`/`service_execution_participants` | RLS autorizou leitura (permissão OK) |
| `[REVERSAL][EVENT-PUBLISH-FAILED]` | `null` | Nenhuma exceção no bloco de publish |
| `appEventBus.publish` (spy) | **NÃO chamado** (`null`) | **`CheckoutReverted` NÃO publicado** |
| `CheckoutReverted`/`reverse_commission` | ausentes | Comissão **não** revertida |

**VEREDITO FINAL H2-8 — Hipótese B CONFIRMADA (bug no código atual):** o `reverseFinancialTransaction` do HEAD publica a devolução financeira mas **não publica `CheckoutReverted`**, porque o bloco de publish lê **colunas fantasma** — `comandas.discount` (inexistente) e `comanda_items.staff_id` (inexistente) — e, ao desestruturar `{ data }` sem checar `.error`, recebe `comandaData = null` e **pula silenciosamente o bloco inteiro** (nenhum throw, nenhum log de falha, nenhum publish). A comissão R$7,50 **não é revertida**, reproduzindo exatamente o sintoma de produção `6bd5cbe4` (09-02). O pipeline ficou comprovadamente íntegro em 08-25 porque, naquele commit/caminho, o bloco publicava — a divergência é do código atual.

**Ação recomendada (decisão do PO / nova autorização):** corrigir `src/lib/finance/reversal.ts` no bloco de publish para (a) remover as colunas fantasma `comandas.discount` e `comanda_items.staff_id`, (b) usar a coluna real `service_execution_participants.professional_id` no lugar de `staff_id`, e (c) checar `.error` em todas as leituras (não desestruturar `{ data }` cegamente). Revalidar em staging antes de qualquer tratamento de `6bd5cbe4` ou liberação de novas reversões.

---

### 10.6 H2-8 — FECHAMENTO FORMAL (2026-09-02): correção aplicada + cadeia completa comprovada em STAGING — 🟢 CLOSED

**Correção aplicada no código (commit `523192a`, HEAD):** `fix(reversal): remove phantom columns and add error checks in CheckoutReverted publish` implementou exatamente a ação recomendada na §10.5, no bloco de publish de `src/lib/finance/reversal.ts`:

- **removidas** as colunas fantasma: `comandas.discount` e `comanda_items.staff_id`;
- `service_execution_participants` lida pela coluna **real** `professional_id` (não `staff_id`);
- todas as leituras agora **checam `.error`** (log de erro `[reversal][H2-8] ...`) em vez de desestruturar `{ data }` cegamente — o short-circuit silencioso que suprimia `CheckoutReverted` não pode mais ocorrer sem evidência;
- o bloco agora publica `CheckoutReverted` via `appEventBus.publish(createEvent<CheckoutRevertedEvent>)` com `originalCommission`/`originalReceivedValue` derivados de leituras reais e índice `EVENT-PUBLISH-FAILED` se falhar.

**Comprovação controlada em STAGING (cadeia canônica `tests/homologation/h2-8/h2-8-staging-chain.spec.ts`, schema real `tjcvuhynckocmvtqykxp`, código HEAD):**

| Sinal | Valor | Status |
|-------|-------|--------|
| Comissão original | +R$3,75 `active` (R$15 × 50% participant × 50% staff) | ✅ |
| `finance_reverse_transaction` (full_refund) | success — perna financeira | ✅ |
| `CheckoutReverted` publicado | ✅ (`originalCommission: 3.75`, `originalReceivedValue: 15`) | ✅ |
| Outbox `reverse_commission` | enfileirado + processado | ✅ |
| Reversal de comissão | −R$3,75 `active` com `original_record_id` | ✅ |
| `financial_reversals` | 1 × R$15 | ✅ |
| Saldo líquido | R$0 | ✅ |
| Idempotência (2ª reversão, mesma chave) | `financial_reversals`=1, reversal records=1, net 0, `secondResultIdempotent=true` (guarda `already reversed — skipping` do `reverseCommissionHandler`) | ✅ |

**Controprova da integridade do pipeline:** em produção (08-25, comanda `f859260a`) o mesmo caminho `CheckoutReverted → reverse_commission → ReverseCommissionHandler` já operou corretamente (1 reversal `5b645e00` R$−7,50); o short-circuit de §10.5 era defeito do código HEAD naquele momento, agora corrigido.

**Veredito H2-8: 🟢 CLOSED (prova canônica em staging).** Causa raiz corrigida em `523192a`; cadeia financeira + de comissão comprovada ponta-a-ponta em staging com teardown completo. **Produção NÃO tocada; sem deploy; sem migration.** O tratamento de estados reais inconsistentes (`6bd5cbe4`, produção) e a liberação de novas reversões em produção permanecem **decisão do PO**, conforme D-HOM-27 (parar, não corrigir no banco).

---

### 10.7 P1-01 — Fechamento de barbeiro grava divergência falsa (cadeia `payment_method`) — 2026-09-23 — 🔴 STOP OPERACIONAL (D-HOM-31)

**Janela:** 2026-09-23, acompanhada — Rubens via UI (produção `smg-barber`), OpenCode com leitura read-only (Management/service key, sem escrita). **Baseline fresco capturado antes da operação** (regra PO): `docs/audit/h7-execution/h7-baseline-pre-execution-1790173523654.json` (14:25:20Z) — sem anomalia (0 comandas abertas, 0 tx no dia; clients 360 · 13 assinaturas ativas · 17 linhas de crédito).

**Ciclo executado até a etapa 6** (evidências `h7-observe-step0..step3-*.json`, `h7-qcheck-pagamento-*.json`):

| Etapa | Resultado |
|-------|-----------|
| 1 Agenda | Agendamento `HOMOLOG H7-1` cancelado pré-pagamento (zero efeito); ciclo refeito no cliente original **`HOMOLOG H7` `edbe83f1`** |
| 2 Atendimento | Atendimento concluído (HERON) |
| 3 Pagamento — **Q1** | ✅ PASS — comanda **`b5368c28`** R$145 (CORTE SIMPLES 45 + PRODUTO TESTE 100), discount 0, `paid` cash, `financial_effect=true` |
| 3 Pagamento — **Q2** | ✅ PASS — 1× income R$145 (`d39803f7`), fonte comanda, sem duplicidade |
| 3 — **Q3** | ✅ PASS — sem Chef Club/crédito envolvido |
| 4 Comissão — **Q4** | ✅ PASS — `7bf99382` HERON R$45 × 50% = **R$22,50** `active`; produto sem comissão = regra confirmada (59 itens de serviço com record, 0 de produto) |
| — Abertura de caixa | evento `opening` 18:06:49 (`cash_closing df4e8a0b`, draft) — via UI, caminho de escrita funcionou com JWT do Rubens |
| **6 Fechamento profissional** | 🔴 **P1-01 REPRODUZIDO** (abaixo) |

**P1-01 — comportamento observado:**

- **Guard de UI:** com "Dinheiro em mãos" = 0 o botão "Fechar Caixa do Barbeiro" fica desabilitado **sem nenhum feedback** (`BarberClosingDetailPanel.tsx:315`, `disabled={countedValue <= 0}`; input fica na aba Checklist → Conferência Física).
- Com valor > 0 digitado (R$145, justificativa `"teste"`), a gravação ocorreu — `barber_closing` **`728307e6`** (closed_at 18:58:15):
  - **`status = discrepancy`**, **`expected_cash = 0`**, **`counted_cash = 145`**, **`cash_difference = 145`**
  - `payment_methods = {"Nao informado": 45}`
  - vínculo correto: `cash_closing_id = df4e8a0b`; evento `barber_closing` auditou a divergência falsa em `metadata` (`expectedCash: 0, cashDifference: 145`)

**Causa raiz — cadeia de `payment_method` em 3 níveis (NÃO é apenas label):**

1. **Transação** grava `payment_method = 'cash'`.
2. **Comanda** desta ciclo está com `payment_method = null` → loader (`application/cashClosing/loaders.ts:165`) publica `'Nao informado'` em `paymentMethods`.
3. **Lookup no fechamento** busca `paymentMethods['Dinheiro']` (`application/cashClosing/summary.ts:321` e `src/hooks/useCashClosing.ts:494`) → **`0`**. Os testes unitários usam fixture `paymentMethod: 'Dinheiro'` (`cashClosing.test.ts`, `summary.test.ts`) e **mascaram** o mismatch.

**Agravantes:**
- `barber_closings_complete` foi para **`true`** mesmo com `status=discrepancy` → o fechamento do dia prosseguiria como "completo" com um falso R$145 de diferença embutido.
- A UI não exibe erro em caso de exceção no handler (caminho silencioso adicional).

**Impacto:** **sem perda financeira** — transação, comissão e repasse inalterados (Q1–Q4 permanecem PASS; produção 45 / comissão 22,50 / repasse 22,50 corretos). Dano = **confiabilidade da conferência de caixa e do estado de fechamento**.

**Evidências BEFORE/AFTER (read-only, nenhuma correção aplicada):**
- `docs/audit/h7-execution/h7-p1-barber-close-BEFORE-20260923T183533Z.json`
- `docs/audit/h7-execution/h7-p1-barber-close-AFTER-20260923T185913Z.json`
- script: `scripts/h7-p1-barber-close-snap.mjs`

**Decisão do PO (2026-09-23, D-HOM-31):** REGISTRAR P1 → **ENCERRAR a execução operacional do H-7 neste ponto** → **Q5–Q7 NÃO executados** → abrir **frente específica de correção/validação do P1**, a ser validada **de ponta a ponta** antes de considerar o fechamento de caixa confiável (níveis: escrita da comanda/transação, loader, lookup do fechamento, guarda de UI, flag `barber_closings_complete`). **`6bd5cbe4` permanece preservada, sem mexer nela.**

---

## 11. Estado da Janela e Próximos Passos

| Item | Status |
|------|--------|
| Persistência da comissão R$22,50 (comanda H7) | 🟢 ✅ PASS |
| Participante HERON | 🟢 ✅ PASS |
| Receita R$45 | 🟢 ✅ PASS |
| UI da comanda (comissão + Fechar Caixa do Barbeiro) | 🟢 ✅ PASS |
| S3-1 R$260 | 🟢 ✅ FECHADO (anterior) |
| FINDING R$40/R$20 (dashboard) | 🟢 ✅ RESOLVIDO — desconto R$5 legítimo (comanda 09-01, não relacionado à H7) |
| H2-8 — reversão (via `finance_reverse_transaction`) | 🟢 **✅ RESOLVIDO / FECHADO (§10.6)** — causa raiz (§10.5) corrigida em `523192a` (colunas fantasma removidas, `professional_id`, checagem de `.error`); cadeia completa comprovada em STAGING (`h2-8-staging-chain.spec.ts` PASS: `CheckoutReverted` → `reverse_commission` → reversal de comissão → net 0 → idempotente). Produção não tocada; tratamento do estado real `6bd5cbe4` segue decisão do PO |
| **Ciclo 2026-09-23 — Q1–Q4 (agenda→pagamento→comissão)** | 🟢 ✅ PASS (baseline fresco + evidências `h7-observe-step0..step3`, `h7-qcheck-pagamento`) |
| **P1-01 — fechamento profissional grava divergência falsa (§10.7)** | 🟢 **FRENTE DE CORREÇÃO ENCERRADA (D-HOM-32, 2026-09-24)** — correção mergeada e em PROD @ `5a28456` (staging 8/8 + post-deploy audit PASS); **reprodução original** permanece em §10.7 / `728307e6` como evidência histórica |
| **Q5–Q7 + fechamento de caixa do dia** | ⛔ **NÃO EXECUTADOS** — encerramento da janela por D-HOM-31 |
| `6bd5cbe4` (Penteado R$15) | 🟡 **PRESERVADA, sem tratamento** (D-HOM-27b; reafirmado D-HOM-31) |
| H-7 | 🔴 **STOP OPERACIONAL (D-HOM-31)** — operação/comissão validadas até Q4; P1-01 bloqueia confiança no fechamento de caixa; frente de correção P1 é próximo ciclo |
| H-8 | 🔴 BLOQUEADOR (inalterado) |

**Próxima etapa (D-HOM-31 → atualizada por D-HOM-32):** ~~abrir frente de correção do P1-01~~ — **frente de correção P1-01 ENCERRADA (2026-09-24, PROD `5a28456`, HEALTH GATE PASS).** **Retomada do H-7** (fechamento de caixa + Q5–Q7) e, em janela própria, D-HOM-27b (`6bd5cbe4` preservada; reversões comissionáveis) permanecem **decisões separadas do PO** — **não autorizadas por esta atualização**. **H-8 permanece 🔴 BLOQUEADOR** (escopo próprio; esta entrega não o altera). **3 pendências técnicas/governança** (deploy-validate, migration `20260924*`, auto-deploy) = frentes independentes, não iniciadas (D-HOM-32).
