# H-7 — Operação Real: Roteiro de Execução e Checklist de Evidências

> **Status:** 🟢 **H-7 — PASS / ENCERRADO (veredito do PO, 2026-09-25).** Ciclo H7-1 reexecutado em **PROD** em 2026-09-25 (Rubens/UI produção; OpenCode read-only): **Q1–Q7 ✅ PASS** — quadratura financeira (caixa = comanda = transação = R$20; fechamento profissional = comissão = R$10) · **ausência de duplicidade** (1× tx income `eb375af2`; comissão `b462a796` idempotente) · baseline pré/pós estável · P1-01 validado de ponta a ponta (§10.8). **Pendências não bloqueadoras (preservadas, sem correção sem autorização):** (1) abertura de caixa registrada **após** o pagamento — desvio de sequência §5, sem efeito financeiro; (2) instrumentação B5–B9 de `h7-baseline-capture.mjs` (colunas fantasma → retorna 0) — correção opcional futura. **D-HOM-27b = PENDENTE (janela própria):** `6bd5cbe4` preservada; reversões comissionáveis permanecem fechadas. **H-8 permanece 🔴 BLOQUEADOR** (sem merge, tag `v1.5` ou deploy).
> **Status anterior (janela 2026-09-23, D-HOM-31):** 🔴 **STOP OPERACIONAL — P1-01 registrado, execução ENCERRADA na janela 2026-09-23 (D-HOM-31).** Janela acompanhada 2026-09-23 (Rubens/UI produção + OpenCode read-only): baseline fresco capturado, ciclo executado até o fechamento profissional, **Q1–Q4 ✅ PASS**, **P1-01 reproduzido e evidenciado (§10.7)** — `barber_closing` grava `expected_cash=0` / `cash_difference=145` / `status=discrepancy` por cadeia `payment_method` inconsistente (transação `'cash'` → comanda `null` → lookup `'Dinheiro'`). **Q5–Q7 NÃO executados.** `6bd5cbe4` permanece **preservada, sem tratamento**. Próximo ciclo: **frente de correção/validação do P1 (ponta-a-ponta)**. Nenhuma correção aplicada durante a execução.
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
| 6 | **Limite do H-7** | **H-7 NÃO é autorização para produção/deploy.** Estado: **H-6 🟢 → H-7 🟢 (PASS/ENCERRADO, veredito do PO 2026-09-25) → H-8 🔴**. Sem merge, tag ou deploy de produção. |

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

- [x] Baseline pré-ciclo capturada (B1..B10) com queries e saída. — ✅ 2026-09-23 (`h7-baseline-pre-execution-1790173523654.json`) + **reexecução 2026-09-25** (`h7-baseline-pre-execution-1790343857149.json`, 13:44:11Z, dia limpo)
- [x] Registros a criar identificados (tabela da §4) confirmados. — ✅ cliente `HOMOLOG H7` (`edbe83f1`) + comanda do ciclo `c304cae5` (09-25) / `b5368c28` (09-23)
- [x] Prints/JSON/timestamps de cada etapa do ciclo (agenda → conferência). — ✅ 09-25: `h7-observe-step0-pre-cycle-*.json`, `h7-qcheck-pagamento-1790344248548.json`, `h7-q5q6-snap-1790344414327.json`, `h7-observe-step1-post-cycle-*.json` (09-23: `h7-observe-step0..step3-*` + `h7-qcheck-pagamento-*`, §10.7)
- [x] Comanda do ciclo (valor bruto → descontos → pago). — ✅ Q1 PASS (09-25: `c304cae5` R$20 PIGMENTAÇÃO, discount 0, paid cash; 09-23: `b5368c28` R$145)
- [x] Transaction(s) correspondentes. — ✅ Q2 PASS (09-25: 1× income R$20 `eb375af2`, sem duplicidade; 09-23: `d39803f7`)
- [x] Crédito Chef Club consumido (se aplicável). — ✅ N/A nos ciclos 09-23 e 09-25 (sem crédito; Q3 PASS por ausência)
- [x] Comissão (profissional/base/percentual/valor). — ✅ Q4 PASS (09-25: `b462a796` HERON R$20×50%=R$10 active; 09-23: `7bf99382` R$22,50)
- [x] Fechamento profissional + fechamento de caixa + financeiro consolidado. — ✅ **EXECUTADOS 2026-09-25** (§10.8): `barber_closing 43e97aed` diff 0 + `cash_closing d5efad50` confirmed diff 0
- [x] Quadratura Q1..Q7 (saída SQL). — ✅ **Q1–Q7 PASS no ciclo 2026-09-25** (§10.8); Q1–Q4 já PASS no ciclo 09-23
- [ ] Matriz H2-1..H2-8 (cancelamento/reversão). — H2-8 🟢 fechado (§10.6); elos H2-1..H2-5/H2-7 cobertos pelo ciclo 09-25 (§10.8); **operação de cancelamento/reversão fora do escopo desta janela** (D-HOM-27b/D-HOM-31 — janela própria)
- [x] Reflexo receivable H3-4. — ✅ FECHADO (2026-08-16, §7.2)
- [x] Investigação S3 (10 overdue + 6 pending) com conclusão. — ✅ concluída 2026-08-16 (§7.3); S3-1 tratado (D-HOM) — tratamentos remanescentes = decisão do PO
- [x] Nenhum registro existente alterado (conferência de integridade). — ✅ diff baseline pré (13:44) × pós (13:56) 09-25: clients 362 · services 18 · receivables 70 (3 pending/52 paid) · subs 13 · créditos 17 (46/44) · staff 5 — **estáveis**

---

## 9. Critérios de Fechamento do Gate

| Veredito | Condição |
|----------|----------|
| 🟢 | Ciclo completo H7-1 executado sem erro; quadratura Q1..Q7 ok; controles H2-1..H2-8 + H3-4 + S3 + comissão concluídos; nenhuma divergência financeira |
| 🔴 | Qualquer divergência financeira/duplicidade/perda de crédito/comissão incorreta/alteração inesperada de saldo/quebra de fechamento no ciclo real → **PARAR**, registrar achado e aguardar decisão do PO |

> **Veredito do H-7 — decisão do PO (2026-09-25): 🟢 PASS / APROVADO / ENCERRADO.** Critério 🟢 atendido: ciclo completo H7-1 executado sem erro (§10.8), quadratura Q1..Q7 ok, nenhuma divergência financeira, **ausência de duplicidade**; controles H2-1..H2-8 + H3-4 + S3 + comissão concluídos nos gates/janelas anteriores (H2-8 fechado §10.6; S3-1 fechado). **Pendências não bloqueadoras preservadas (§11):** (1) sequência de abertura de caixa após pagamento — sem efeito financeiro, **não corrigir sem autorização específica**; (2) instrumentação B5–B9 (colunas fantasma — correção opcional futura). **A aprovação do H-7 NÃO autoriza produção/deploy** — o H-8 permanece 🔴 BLOQUEADOR: **H-6 🟢 → H-7 🟢 → H-8 🔴**. **D-HOM-27b = PENDENTE (janela própria)** — `6bd5cbe4` preservada; reversões comissionáveis fechadas.

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

### 10.8 Ciclo H7-1 reexecutado — 2026-09-25 — Q1–Q7 ✅ PASS (validação ponta-a-ponta do P1-01)

**Janela:** 2026-09-25, acompanhada — Rubens via UI (produção `smg-barber`), OpenCode somente read-only (service key PROD via ambiente; zero escrita). Início autorizado pelo PO ("Rubens iniciando agora").

**Pré-condições conferidas antes da janela:**
- Fix P1-01 mergeado: PR #79 → `5ad3c46` (rateio item-level `staff_id` + guarda de fechamento) · gate STAGING **8/8 PASS** (escrita → loader → lookup `paymentMethods` → guarda UI → `barber_closings_complete`).
- Deploy PROD: deployment `Production – smg-barber` = `7218330` → **success** (2026-09-25T12:19:14Z).
- Schema PROD: `comanda_items.staff_id` presente (`public` + `barber`), FK → `staff(id)`, RLS `tenant_isolation_comanda_items` OK. Migration `20260924000000_add_comanda_items_staff_id.sql` = formalização idempotente — **não aplicada, não necessária**.

**Baseline fresco (regra §4):** `h7-baseline-pre-execution-1790343857149.json` (13:44:11Z) — dia limpo (0 comandas pagas, 0 fechamentos, 0 comissões no dia). Baseline pós-ciclo: `h7-baseline-post-cycle-1790344580903.json` (13:56:17Z).

**Ciclo executado (timestamps UTC, 2026-09-25):**

| Etapa | Resultado | Evidência |
|-------|-----------|-----------|
| 1 Agenda | Agendamento `HOMOLOG H7` (`f7be48a5`) criado 13:46:47 (start 10:00) → `completed` | `h7-observe-step0-pre-cycle-1790344105188.json`, `h7-observe-step1-post-cycle-1790344509945.json` |
| 2 Atendimento | Concluído — profissional **HERON FERREIRA** (`62ddf002`, `commission_rate=50` no baseline) | idem |
| 3 Comanda/Pagamento — **Q1** | ✅ PASS — comanda **`c304cae5`** PIGMENTAÇÃO R$20, discount 0, `paid` cash, `financial_effect=true`, closed 13:47:07; item `8862e397` com **`staff_id` populado** (`62ddf002`) | `h7-qcheck-pagamento-1790344248548.json` |
| — **Q2** | ✅ PASS — 1× income R$20 (`eb375af2`), `source_type=comanda`, `source_id`= comanda, 13:47:09, sem duplicidade | idem |
| — **Q3** | ✅ PASS (N/A) — sem Chef Club/crédito no ciclo (`chef_club_savings_total=0`, `paid_with_plan_credit=false`) | idem |
| 4 Comissão — **Q4** | ✅ PASS — `b462a796` gross/net/received R$20 × **50%** = **R$10** `active` (rate = `commission_rate` do profissional; `participant_share=1`; idempotency key presente) | idem |
| Abertura de caixa | evento `opening` 13:47:31 (`cash_closing d5efad50`) — ⚠️ registrada **APÓS** o pagamento (13:47:09): desvio de sequência vs §5 (sem efeito financeiro; observação de processo) | `h7-q5q6-snap-1790344414327.json` |
| 6 Fechamento profissional — **Q5** | ✅ PASS — `barber_closing` **`43e97aed`**: `status=closed`, produced/received R$20, commission/repasse R$10, **`expected_cash=20` / `counted_cash=20` / `cash_difference=0`**, `payment_methods={"Dinheiro":20}`, checklist 4/4, closed 13:48:19; evento auditou "Fechamento - HERON FERREIRA \| Produção R$20 \| Comissão R$10" | idem |
| 7 Fechamento de caixa — **Q6** | ✅ PASS — `cash_closing d5efad50` **`confirmed`**: expected_income 20 / expected_balance 20 / total_counted 20 / **total_difference 0**; `barber_closings_count=1`, `barber_closings_complete=true`; confirmado 13:48:44 (evento "Caixa fechado. Total: R$ 20.00") | idem |
| 8 Quadratura — **Q7** | ✅ PASS — caixa R$20 == comanda paga do dia R$20 == tx income R$20; comissão R$10 == fechamento profissional R$10 == `financial_summary.comissaoTotal` R$10; baseline pré/pós: agregados de domínio estáveis | baselines pré/pós + snaps |

**Validação do P1-01 (foco da retomada) — comparação direta com o STOP de 09-23:**

| Sinal | 2026-09-23 (`728307e6`) | 2026-09-25 (`43e97aed`) |
|-------|--------------------------|--------------------------|
| `expected_cash` | `0` (lookup `'Dinheiro'` = 0) | **`20`** ✓ |
| `cash_difference` | `145` (falso) | **`0`** ✓ |
| `status` | `discrepancy` | **`closed`** ✓ |
| `payment_methods` | `{"Nao informado": 45}` | **`{"Dinheiro": 20}`** ✓ |
| `barber_closings_complete` | `true` mesmo em discrepancy (incoerente) | **`true` coerente com estado sem divergência** ✓ |

**P1-01 validado de ponta a ponta em produção:** transação `cash` → comanda `payment_method=cash` → loader/lookup → guarda de UI → gravação → flag `barber_closings_complete`. Rateio item-level (`comanda_items.staff_id`) populado corretamente.

**Integridade (nenhum registro existente alterado):** diff baseline pré (13:44) × pós (13:56): clients 362 · services 18 · receivables 70 (3 pending / 52 paid) · assinaturas ativas 13 · créditos 17 (46/44) · staff 5 — **estáveis**. Criados apenas registros novos do ciclo (1 agendamento, 1 comanda, 1 transaction, 1 commission_record, 1 barber_closing, 1 cash_closing, 3 eventos de caixa). Comanda real pré-existente `62873e3c` (R$80, aberta 00:16, cliente real) — **intocada, fora do ciclo**.

**Limitações de instrumentação registradas (sem impacto na validade dos Q):**
- `scripts/h7-baseline-capture.mjs` B5–B9 usam colunas/tabela inexistentes em PROD (`starts_at`, `professional_id`, `total_cash…`, `commission_lines`) → retornam 0 silenciosamente. **Q1–Q7 apoiados nos probes de colunas reais** (`h7-observe-cycle`, `h7-qcheck-pagamento`, `h7-p1-barber-close-snap`), não nos B5–B9.
- `h7-qcheck-pagamento` (`service_execution_participants.comanda_id` inexistente) — participante validado via `commission_record.participant_share=1` + `comanda_items.staff_id`.

**Escopo NÃO executado nesta janela (mantido por decisão):** operações de cancelamento/reversão (H2-8 já fechado em §10.6 via staging; liberação de reversões em produção e tratamento de `6bd5cbe4` permanecem D-HOM-27b/D-HOM-31 — **janela própria**).

**Evidências (2026-09-25):** `docs/audit/h7-execution/h7-baseline-pre-execution-1790343857149.json` · `h7-observe-step0-pre-cycle-1790344105188.json` · `h7-qcheck-pagamento-1790344248548.json` · `h7-q5q6-snap-1790344414327.json` · `h7-observe-step1-post-cycle-1790344509945.json` · `h7-baseline-post-cycle-1790344580903.json`.

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
| **P1-01 — fechamento profissional grava divergência falsa (§10.7)** | 🟢 ✅ **VALIDADO DE PONTA A PONTA (2026-09-25, §10.8)** — fix `5ad3c46` em produção (`7218330`): `expected_cash=20` (era 0), `cash_difference=0` (era 145), `status=closed` (era `discrepancy`), `payment_methods={"Dinheiro":20}` (era `{"Nao informado":45}`); registro de 09-23 (`728307e6`) preservado como evidência forense |
| **Ciclo 2026-09-25 — reexecução Q1–Q7 (§10.8)** | 🟢 ✅ **PASS** — comanda `c304cae5` R$20 cash · tx `eb375af2` única · comissão `b462a796` HERON R$10 (50%) · `barber_closing 43e97aed` diff 0 · `cash_closing d5efad50` confirmed diff 0 · integridade pré/pós estável · evidências `h7-execution/*` 09-25 |
| **Q5–Q7 + fechamento de caixa do dia** | 🟢 ✅ **EXECUTADOS E PASS (2026-09-25)** — encerrado o bloqueio D-HOM-31 (pré-condição: P1-01 validado) |
| `6bd5cbe4` (Penteado R$15) | 🟡 **PRESERVADA, sem tratamento** (D-HOM-27b; reafirmado D-HOM-31) — tratamento = janela própria |
| Reversões comissionáveis em produção | 🟡 **FECHADAS** — reabrem somente em janela própria acompanhada (D-HOM-27b) |
| H-7 | 🟢 **PASS / ENCERRADO — veredito do PO (2026-09-25):** ciclo H7-1 completo, Q1–Q7 ✅ PASS (§10.8), quadratura financeira ok, **ausência de duplicidade**; **pendências não bloqueadoras:** (1) abertura de caixa após pagamento — não corrigir sem autorização específica; (2) instrumentação B5–B9 (correção opcional); **D-HOM-27b = PENDENTE (janela própria)** — matriz H2 de cancelamento/reversão, `6bd5cbe4` e reversões comissionáveis |
| H-8 | 🔴 BLOQUEADOR (inalterado) |

**Próxima etapa:** (1) ~~veredito do gate H-7~~ → **H-7 ENCERRADO — 🟢 PASS / APROVADO (veredito do PO, 2026-09-25)**; (2) **pendências não bloqueadoras do H-7:** sequência de abertura de caixa (registrada; sem efeito financeiro — correção exige autorização específica do PO) e instrumentação B5–B9 de `h7-baseline-capture.mjs` (correção opcional futura); (3) em **janela própria** (D-HOM-27b/D-HOM-31 — **PENDENTE**): tratamento de `6bd5cbe4` (**preservada até lá**) e liberação de reversões comissionáveis em produção. **H-8 permanece 🔴 BLOQUEADOR; sem merge, tag ou deploy. H-8 e D-HOM-27b NÃO são iniciados por esta decisão.**
