# H-7 — Operação Real: Roteiro de Execução e Checklist de Evidências

> **Status:** ⏳ ROTEIRO PRONTO — **EXECUÇÃO CONDICIONADA** (janela acompanhada com dia/horário + equipe presente, definidos pelo PO). Nenhuma operação real foi iniciada.
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

- [ ] **H-6 🟢** (D-HOM-26) — ✅ satisfeita
- [ ] **H-2 🟢** (D-HOM-14) — ✅ satisfeita
- [ ] **Matriz/escopo do ciclo H7-1 apresentada ao PO** — ✅ (este roteiro, D-HOM-27)
- [ ] **Decisão do PO sobre ambiente** — ✅ **dados reais** do tenant Sanchez Barber (D-HOM-27)
- [ ] **Janela acompanhada definida** (dia/horário) + **equipe presente (Rubens)** — ⏳ **pendente — decisão do PO**
- [ ] **Reflexo no receivable** do crédito Chef Club consumido (H3-4) conferido — ⏳ faz parte da execução
- [ ] **Investigação S3** (10 overdue + 6 pending) — ⏳ faz parte da execução
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

- [ ] Baseline pré-ciclo capturada (B1..B10) com queries e saída.
- [ ] Registros a criar identificados (tabela da §4) confirmados.
- [ ] Prints/JSON/timestamps de cada etapa do ciclo (agenda → conferência).
- [ ] Comanda do ciclo (valor bruto → descontos → pago).
- [ ] Transaction(s) correspondentes.
- [ ] Crédito Chef Club consumido (se aplicável).
- [ ] Comissão (profissional/base/percentual/valor).
- [ ] Fechamento profissional + fechamento de caixa + financeiro consolidado.
- [ ] Quadratura Q1..Q7 (saída SQL).
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
