# Plano de Evolução — Fluxo Financeiro, Atendimento, Pagamentos e Auditoria

> **Produto:** SMG Barber · **Plataforma:** SMG Platform (SMG Core)
> **Etapa:** 2 — Planejamento técnico (NÃO é implementação)
> **Data:** 2026-08-29
> **Modo:** Read-only. Nenhuma correção, migration, tabela, RPC ou política RLS foi alterada.
> **Fonte primária:** `docs/audit/AUDITORIA_FLUXO_FINANCEIRO_BAIXA.md` (35 seções)
> **Branch atual:** `chore/saneamento-comandas-orfas-historicas` · HEAD `ae38faa`
> **Validação desta etapa:** todos os pontos citados foram re-verificados contra o código atual — **nenhuma divergência encontrada** entre o relatório de auditoria e o estado técnico vigente.

---

## 1. Resumo executivo

Este documento transforma a auditoria do fluxo financeiro (`AUDITORIA_FLUXO_FINANCEIRO_BAIXA.md`) em um **plano técnico de implementação** seguro, escalável e compatível com a arquitetura existente da SMG Barber.

**Contexto central confirmado:** o modelo de dados atual representa o ciclo financeiro por um **status único de comanda** (`blocked | open | paid | cancelled`) e **1 comanda → 1 pagamento**, sem timestamp de atendimento e sem trilha de auditoria no desbloqueio. O novo requisito de negócio — **pagamento antecipado** (cliente paga em 29/08 um agendamento para 31/08) — **já é parcialmente suportado na camada RPC** (a settle aceita `blocked`), porém **corrompe a semântica de domínio** em três pontos:

1. `finance_settle_comanda` aceita `open` **ou** `blocked` (20260514000001:90) e, ao baixar, marca `appointments.status='completed'` (20260514000001:105-108) — ou seja, **pagar antecipado == marcar atendimento como concluído**, antes de o serviço existir.
2. A comissão conta `blocked` na base (`application/commission.ts:242`) → pagamento antecipado geraria comissão **antes do atendimento**.
3. A tela Contas a Receber lista **somente** comandas `open` (`AccountsReceivable.tsx:410-414`) → não existe superfície de UI para a baixa antecipada; e o Checkout **recusa** cliente com comanda `blocked` (`Checkout.tsx:757-779`).

**Direção recomendada (requer decisões de negócio, seção `DECISÕES PENDENTES`):** separar conceitualmente o **ciclo operacional** (agendamento → atendimento → serviço realizado) do **ciclo financeiro** (recebível → pagamento(s) → baixa), com estados independentes e auditoria de operador em cada transição — **sem** descartar a arquitetura existente (repositories/RPC/outbox/dados atuais).

**Escopo desta etapa:** somente planejamento. Produto: este documento. **Nenhum arquivo funcional foi alterado.**

---

## 2. Estado atual

### 2.1 Ciclo hoje (evidência)

```
[Agenda] create_appointment_with_comanda (RPC 20260506214059)
   → appointment + comanda (+ itens) atômicos
   → comanda nasce 'blocked' se start_time::date > current_date (161-162)
   → comanda nasce 'open' caso contrário
[Comandas] desbloqueio client-side quando start_time <= hoje (Comandas.tsx:670-717) — SEM auditoria
[Checkout] recusa novo atendimento para cliente com comanda 'blocked' (Checkout.tsx:757-779)
[Atendimento] NÃO EXISTE timestamp próprio
[Baixa] modal read-only (AccountsReceivable.tsx) com 4 modos:
   payment        → finance_settle_comanda(_and_enqueue)   [status open|blocked]
   club_credit    → finance_zero_close_comanda             [status SOMENTE open]
   house_courtesy → finance_zero_close_comanda             [status SOMENTE open, gestão + motivo]
   administrative → finance_zero_close_comanda             [status SOMENTE open, gestão + motivo]
[Fim] comanda 'paid' · transaction 'income' (quando recebimento) · appointment 'completed'
      · comissão (D8 worker ou tela de comissões)
```

### 2.2 Contrato de status (CHECK constraints reais)

| Tabela | Status | Origem |
|---|---|---|
| `comandas` | `blocked, open, paid, cancelled` | `20260425000000_add_blocked_status_to_comandas.sql:5` |
| `appointments` | `pending, confirmed, in_progress, completed, cancelled, no_show` | `20260421000000_add_cancellation_reason_and_noshow.sql:8` |
| `transactions` | `pending, paid, ...` (status genérico de lançamento) | `20260510000000` |

**Conclusão:** o status da comanda acumula hoje **três responsabilidades semânticas**: (a) operacional (pode consumir?), (b) financeira (quitada?), (c) de agendamento (futuro/passado). Para pagamento antecipado, isso é insuficiente — ver seções 5, 7-13 e 24-25.

### 2.3 Camadas e fluxo de chamadas (respeitado)

```
Pages (React) → Application Services → Domain → Repositories → Supabase/RPC
               └─ src/lib/finance/* (orquestração de RPC com timeout/idempotência)
               └─ domain/events (event bus, event store, outbox, subscribers)
```

---

## 3. Evidências da auditoria

Todas as evidências abaixo foram **re-validadas nesta etapa** (leitura direta de código/migrations — ver seção 2.1 do relatório de auditoria para a lista completa de fontes).

| Evidência | Arquivo:linha | Revalidado |
|---|---|---|
| Botão "Adicionar serviço/produto" hardcoded `disabled`, sem `onClick` | `AccountsReceivable.tsx:1404-1411` | ✅ (leitura nesta etapa) |
| Desbloqueio client-side `blocked→open` sem auditoria | `Comandas.tsx:670-717` | ✅ |
| `finance_settle_comanda` aceita `open`/`blocked`, marca appointment `completed` | `20260514000001:90,105-108` | ✅ |
| `finance_zero_close_comanda` aceita **somente** `open` | `20260531161849:170-171`; `zeroClose.ts:62` | ✅ |
| D7: settle + outbox atômico | `20260827000000` (wrap da settle intacta) | ✅ |
| Comissão conta `blocked` na base | `application/commission.ts:242` | ✅ |
| Checkout recusa comanda `blocked` | `Checkout.tsx:757-779` | ✅ |
| Contas a Receber lista somente `open` | `AccountsReceivable.tsx:410-414` | ✅ |
| `bulk_close_comandas_admin` sem auth/tenant check no corpo | `20260420110000:44-105` | ✅ (relatório seção 17) |
| Schema drift `discount`/`subtotal`/`chef_club_*` | dump produção 6068-6077 vs. migrations | ✅ (relatório seção 32) |
| Aprovação de APP nasce `blocked` em data futura | `20260506214059:161-162` | ✅ |
| Timeout de settlement 30s + idempotência | `settlement.ts:44-60` | ✅ |

---

## 4. F1–F11 revisados (à luz do pagamento antecipado)

| # | Achado (auditoria) | Revisão com o requisito de pagamento antecipado | Classificação nova |
|---|---|---|---|
| F1 | Botão do modal read-only | Mantido como decisão de design — **D6/DP7** da tela. A evolução da tela (seção 19) independe deste botão | P2 (UX, decisão de negócio) |
| F2 | Sem timestamp de atendimento | **Torna-se P0**: pagamento antecipado exige distinguir `paid_at` de `attended_at` — sem isso, nenhum cenário C/D é representável sem corromper semântica | **P0** |
| F3 | Desbloqueio client-side sem auditoria | **Torna-se P0**: desbloqueio é evento de operador; sem trilha, a cadeia de auditoria do atendimento fica incompleta | **P0** |
| F4 | `bulk_close_comandas_admin` sem auth/tenant | Mantido P0 (segurança) — **requer correção antes** de qualquer evolução financeira | **P0** |
| F5 | Schema drift | **P0 pré-requisito**: qualquer migration nova depende da reconciliação (seção 21) | **P0** (pré-requisito) |
| F6 | Comissão conta `blocked` | **Reinterpretado como decisão de negócio** (DP1/DP9): pagamento antecipado gera comissão imediatamente (Opção A) ou só após atendimento (Opção B)? O contrato FIX-001 NÃO muda. | P1 (decisão de negócio) |
| F7 | Pagamento parcial sem saldo residual | **Torna-se P0 para Cenários D/12**: parcial antecipado + posterior exige recebível com saldo | **P0** (se aprovado) |
| F8 | RPCs legadas sem `auth.uid()` | Mantido P0 (segurança) | **P0** |
| F9 | Policy de `appointments` profiles-only | Mantido P1 (validar em ambiente real) | P1 |
| F10 | tsc/outbox pré-existentes | Mantido P3 (backlog; não bloqueia o plano) | P3 |
| F11 | `no_show` não afeta comanda | Mantido P2 (regra de negócio — comanda em no-show continua aberta) | P2 |

**Novo requisito (pagamento antecipado) vira R0** na priorização (seção 33).

---

## 5. Novo requisito — pagamento antecipado

### 5.1 Regra de negócio (declarada pelo PO)

Uma comanda vinculada a um agendamento **futuro** (`blocked`) pode receber pagamento **antes** da data do atendimento. Exemplo real:

| Evento | Data |
|---|---|
| Agendamento registrado (WhatsApp) | 29/08 |
| Atendimento programado | 31/08 |
| Pagamento antecipado | 29/08 |
| Atendimento realizado | 31/08 |

### 5.2 Proibições semânticas

- `paid_at ≠ attended_at` (pagamento antecipado ≠ atendimento realizado)
- `created_at ≠ scheduled_at` (comanda/appointment criados no registro)
- `closed_at ≠ paid_at` (fechamento administrativo ≠ data do pagamento)
- `payment ≠ atendimento`

### 5.3 Capacidade do modelo atual (verificada)

| Capacidade | Suportado hoje? | Evidência |
|---|---|---|
| Criar comanda `blocked` para data futura | ✅ | 20260506214059:161-162 |
| Baixar comanda `blocked` com pagamento | ✅ (RPC) | 20260514000001:90 |
| Baixar comanda `blocked` via UI | ❌ | AccountsReceivable lista só `open`; Checkout recusa `blocked` |
| Baixar sem payment (clube/cortesia/adm) em `blocked` | ❌ | zero-close: somente `open` (20260531161849:170) |
| Representar `blocked` **e** `paid` ao mesmo tempo | ❌ | status único CHECK (seção 2.2) |
| Registrar `attended_at` separado | ❌ | F2 |
| Auditoria do desbloqueio | ❌ | F3 |
| Comissão apenas após atendimento | ❌ | F6 (comissão conta `blocked`) |

**Conclusão:** o domínio atual **não representa** o cenário antecipado de forma semanticamente correta. O atalho via RPC existe (settle aceita `blocked`), mas geraria (a) appointment `completed` prematuro, (b) comissão antes do serviço, (c) `closed_at` no dia do pagamento — corrompendo o ciclo operacional. O plano propõe separação de ciclos (seção 24) sem quebrar o que já funciona.

---

## 6. Cenários A–D (obrigatórios)

| Cenário | Fluxo | Representável hoje? | Gaps |
|---|---|---|---|
| **A — Pagamento no atendimento** | Agenda 29/08 → Atende 31/08 → Paga 31/08 → Baixa | ✅ Parcial (o appointment vira `completed` na baixa; não há momento de atendimento) | F2 |
| **B — Pagamento posterior** | Agenda 29/08 → Atende 31/08 → Não paga → Paga 02/09 → Baixa financeira | ✅ (comanda fica `open` no Contas a Receber) | F2 (atendimento não gravado no dia 31/08) |
| **C — Pagamento antecipado** | Agenda 29/08 → Paga 29/08 → Atende 31/08 | ⚠️ RPC sim / domínio não (ver 5.3) | status único, appointment premature, comissão, UI |
| **D — Antecipado parcial + posterior** | Agenda 29/08 → Paga R$30 (29/08) → Atende 31/08 → Paga R$40 (02/09) → total R$70 | ❌ | F7 (sem saldo residual/parcial) + todos os gaps de C |

**Cenário C detalhado (esperado):**

```
29/08  AGENDAMENTO REGISTRADO → comanda blocked → pagamento R$70 → PAGAMENTO REGISTRADO
31/08  ATENDIMENTO REALIZADO → comanda/atendimento concluído
paid_at = 29/08 · attended_at = 31/08 · closed em 31/08 (ou após atendimento)
```

**Cenário D detalhado (esperado):**

```
29/08  Pagamento #1 R$30 (antecipado)  → saldo R$40
31/08  Atendimento
02/09  Pagamento #2 R$40 (posterior)   → saldo R$0 → quitação
```

---

## 7. Contrato de datas

### 7.1 Banco de datas atual (revalidado)

| # | Data | Campo atual | Tabela | Quem grava | Quando grava | Mutável? | Auditoria? |
|---|---|---|---|---|---|---|---|
| 1 | Registro do agendamento | `appointments.created_at` | appointments | RPC de criação | criação | não (default) | indireta |
| 2 | Atendimento programado | `appointments.start_time`/`end_time` | appointments | UI/RPC | criação/reagendamento | **sim (alterável)** | ❌ (sem trilha de alteração) |
| 3 | Criação da comanda | `comandas.created_at` | comandas | RPC/checkout | criação | não (default) | indireta |
| 4 | Desbloqueio | — | — | **NÃO EXISTE** | — | — | **F3** |
| 5 | Atendimento realizado | — | — | **NÃO EXISTE** | — | — | **F2** |
| 6 | Conclusão do serviço | `appointments.status='completed'` (derivado) | appointments | RPC de baixa | **na baixa** | não (status) | sim (na baixa) |
| 7 | Criação do recebível | — (derivado de comanda `open`/transação) | — | — | — | — | — |
| 8 | Pagamento | `transactions.date` (lançamento) e `comandas.payment_date_real` (data real informada) | transactions/comandas | RPC de settlement | baixa | não após gravação | saldo via metadata |
| 9 | Baixa | `comandas.settled_at` (momento sistema) + `closed_at` | comandas | RPC | baixa | não | `settled_by_user_id` |
| 10 | Estorno | `financial_reversals.created_at` | financial_reversals | RPC reversão | estorno | não | `created_by_user_id` |
| 11 | Cancelamento | `comandas.cancelled_at` | comandas | UI clawback | cancelamento | não | `cancelled_by_user_id`/`cancellation_type` |

### 7.2 Datas que precisam de decisão/provimento

| Data | Existe | Preciso criar (proposta) | Derivação possível | Imutável? |
|---|---|---|---|---|
| 4 — desbloqueio | ❌ | `unlocked_at` + `unlocked_by_user_id` (F3) | — | sim |
| 5 — atendimento | ❌ | `attended_at` (F2) | derivar de `appointments.status='in_progress/completed'`? **Não** — transição é na baixa hoje | sim |
| 6 — conclusão do serviço | ⚠️ derivado | manter derivado de atendimento + baixa | — | sim |
| 7 — criação do recebível | ❌ (implícito) | se adotar recebível explícito (Cenário D) | — | sim |

**Regra de ouro (mantida da auditoria):** nenhum `created_at`/`updated_at`/`settled_at` pode ser usado como proxy de data de atendimento. A única data confiável de recebimento é `transactions.date` + `payment_date_real`; atendimento **não é representável hoje** — o plano provê `attended_at`.

---

## 8. Contrato de atendimento (proposta conceitual)

Objetivo: tornar "atendimento realizado" um **evento explícito** no domínio, distinto de "pagamento".

**Proposta (requer ADR — DP8):**
- Novo campo de data/hora: **`attended_at`** em `appointments` (o serviço acontece no agendamento) — e, quando necessário por comanda, espelhado na comanda.
- Transição de `appointments.status`: `confirmed → in_progress → completed` executada **pelo operador/profissional** no momento do atendimento (não mais implicitamente pela baixa).
- A baixa deixa de ser o gatilho único de `completed`; em caso de pagamento antecipado, o appointment permanece `confirmed/in_progress` **mesmo com comanda paga**.
- Alternativa mínima (menor impacto): adicionar apenas `attended_at` preenchido no dia do atendimento pela UI/checkout, mantendo a baixa marcando `completed`. → **DP8** define qual caminho.

**Pergunta de domínio que o contrato deve responder (DP8/DP9):** qual evento oficialmente representa "atendimento realizado"? E qual torna o serviço elegível para comissão?

---

## 9. Contrato financeiro (proposta conceitual)

Separação do ciclo financeiro, reutilizando o que existe:

| Conceito | Hoje | Proposta |
|---|---|---|
| Recebível | implícito (comanda `open` + transação income) | manter implícito para cenários A/B; **avaliar criação explícita** apenas se Cenário D for aprovado (DP10) |
| Pagamento | 1 comanda → 1 transação `income` | **1 comanda → N pagamentos** (seção 10) |
| Saldo residual | ❌ (só `metadata.amount_difference`) | derivado: `saldo = total - Σ(movimentos financeiros)`, calculado em consulta (seção 12) |
| Baixa | sinônimo de pagamento único / zero-close | **quitação do recebível** (marca `paid` quando saldo = 0) — distinguir "registrar pagamento" de "encerrar recebível" (seção 13) |
| Estorno | reversão de transação | manter `financial_reversals`; em múltiplos pagamentos, estorno referencia o pagamento específico |

**Princípio:** a evolução deve nascer do **status da comanda** (operacional) + **saldo financeiro derivado** (financeiro), sem quebrar RLS/outbox/event store existentes.

---

## 10. Pagamentos múltiplos (proposta conceitual — NÃO criar tabela ainda)

Avaliação técnica: o domínio atual **não suporta** 1 comanda → N pagamentos (1 transação por baixa; qualquer nova settle numa comanda `paid` retorna erro 88/89).

**Proposta de representação (DP10 decide o modelo):**

1. **Tabela de pagamentos explícita** (ex.: `comanda_payments`) — recomendada se Cenário D for aprovado:
   - `id`, `tenant_id`, `comanda_id`, `amount numeric`, `paid_at timestamptz`, `payment_method`, `operator_id` (quem registrou), `origin` (proxy/pos), `reference` (recibo), `metadata jsonb`, timestamps, `idempotency_key` UNIQUE, RLS.
   - A transação `income` passa a ser **espelho** do pagamento (1:1 por pagamento) ou mantida como consolidação — decisão técnica a detalhar na implementação (DP4).
2. **Alternativa mínima (sem tabela nova):** múltiplas `transactions` do tipo `income` com `source_id=comanda`, e saldo = total − Σ(income). Reutiliza RLS/estorno/outbox existentes; **limita-se a** cenários sem split de pagamento complexo.

Requisitos transversais (respondidos na seção 12): atomicidade, concorrência, estorno, saldo negativo, duplicidade.

---

## 11. Pagamento antecipado (proposta conceitual)

**Necessidade de campo semântico:** sim, se quisermos diferenciar antecipado de pago-no-dia **sem depender de comparação de datas** (frágil). Proposta — **NÃO criar agora; decidir campo/enum via DP3/DP11:**

| Opção | O quê | Prós | Contras |
|---|---|---|---|
| P1 | `payment_type` enum (`advance`, `on_service`, `post_service`) no pagamento | Semântica explícita, imutável, consultas simples | Novo campo + enum |
| P2 | Derivado: `paid_at < appointment.start_time` ⇒ antecipado | Zero persistência | Frágil (horários alterados/reagendamento), mutável |
| P3 | `payment_context` (`appointment` vs `walkin` vs `prepaid`) | Reaproveita campo de context | Nomenclatura sobreposta a `source` |

**Recomendação técnica (DP3):** P1, com `payment_type` **imutável** e obrigatório em pagamentos registrados; derivável para relatórios históricos (backfill — seção 29).

**Impacto em relatórios:** antecipado precisa aparecer como receita do dia do pagamento (NÃO do atendimento); comissão por opção DP1/DP9; Contas a Receber mostra "pago antecipado" no status.

---

## 12. Pagamento parcial (proposta conceitual)

Cenário obrigatório (Cenário D): total R$100 → pago R$60 → saldo R$40 → pago R$40 → saldo R$0.

Respostas às 10 perguntas do PO:

1. **Onde calcular o saldo?** Em consulta derivada (não persistir saldo): `saldo = comanda.total - Σ(pagamentos válidos)`. Evita estado inconsistente. (Saldo negativo: rejeitado por constraint.)
2. **Entidade do recebível?** Hoje a comanda é o recebível implícito. Manter; recebível explícito somente se DP10 aprovar.
3. **Onde ficam os pagamentos?** `transactions` (alternativa mínima) ou `comanda_payments` (recomendada se D aprovado).
4. **Saldo negativo?** CHECK/validação: pagamento só gravado se `amount <= saldo atual` (com lock na comanda).
5. **Duplicado?** Idempotência por chave única (+ advisory lock, padrão existente).
6. **Atomicidade?** RPC transacional (padrão `finance_settle_comanda`), com `FOR UPDATE` na comanda.
7. **Concorrência?** `pg_advisory_xact_lock(tenant:comanda)` + `FOR UPDATE` (padrão das RPCs financeiras).
8. **Estorno?** Reversão referencia o pagamento específico (`financial_reversals.transaction_id`); saldo é recalculado automaticamente.
9. **Antecipado parcial?** Combina seções 10-11: primeiro pagamento tem `payment_type='advance'`.
10. **Contas a Receber?** Exibe `total pago / saldo / status`; somente `saldo > 0` aparece como pendente.

**Regra de negócio a decidir (DP4):** pagamento parcial pode ocorrer **antes** do atendimento? (Recomendação técnica: sim, é o próprio Cenário D.)

---

## 13. Baixa

**Distinção obrigatória (semântica):** REGISTRAR PAGAMENTO ≠ ENCERRAR RECEBÍVEL.

- Recebível R$100, antecipado R$60 → pagamento registrado, recebível `partial` (comanda continua `blocked` até atendimento; status financeiro derivado).
- Depois R$40 → recebível `paid` (baixa/quitação).

**Proposta:** manter o verbo "baixa" para **quitação completa**; introduzir "registrar pagamento" como operação atômica quando Cenário D aprovado (seção 9-10). A baixa zero (clube/cortesia/administrativa) permanece como hoje, agora **aceitando `blocked`** se negociado (atualmente só `open` — DP6).

---

## 14. Descontos

**Fluxo atual (não muda):** Checkout coleta `discountType/discountReasonType/discountReasonNote` (`Checkout.tsx:357-359,403-425`), exige auditoria quando `discountValue > 0` (release gate `checkout.ts:217-225`), grava `comanda.discount` → **coluna em schema drift (F5)**.

**Plano para descontos:**
1. **P0 — F5:** migration de reconciliação registra `discount`/`subtotal`/`chef_club_*` nas migrations locais (seção 21).
2. **P1 — auditoria persistente:** manter exigência de `reasonNote` + `responsibleStaffId` para `barber_discount`; consolidar em audit trail (seção 18).
3. **P2 — DP12:** decidir quais operadores podem alterar desconto **após** criação (hoje a edição pós-baixa não existe).
4. **Comissão:** `discount` já entra no cálculo (FIX-001, `commission.ts:353`) — preservar.

---

## 15. Comissão (F6)

### 15.1 Contrato atual (preservado, NÃO alterar)

```
commissionBase = receivedValue × participantShare
commission     = commissionBase × commissionRate
```

- `commission_records` append-only, `received_value`, idempotência `(tenant_id, idempotency_key)` (20260820120000).
- Equivalência D8: `npm run d8:verify` (gate obrigatório) — **não tocar no worker**.

### 15.2 O que torna um pagamento elegível? (decisão de negócio)

| Opção | Comportamento | Impacto no antecipado | Impacto financeiro |
|---|---|---|---|
| **A** | Recebido → comissão imediata | 29/08 paga → comissão 29/08 (antes do serviço) | Receita reconhecida cedo; provisão sob risco de cancelamento/no-show |
| **B** | Comissão após atendimento | 29/08 paga → elegível somente 31/08 | Reconhecimento aderente à execução; mais fiel ao ADR-001 |

**Recomendação técnica (DP1/DP9): Opção B** — a comissão é provento da **execução** do serviço (ADR-001: commission = teórico derivado da execução; settlement = payout de caixa). Pagamento antecipado registra caixa, não execução. Impacto: mover o critério de elegibilidade da base de comissão (hoje `status IN ('open','paid','blocked','cancelled')`, `commission.ts:242`) para considerar **atendimento realizado** (campo `attended_at`, seção 8). **Implementação condicionada à decisão do PO** — o cálculo FIX-001 permanece idêntico.

---

## 16. Profissionais (papel técnico)

- `staff` é identidade (id = auth.users.id) com `commission_rate` (INTEGER DEFAULT 40).
- Participação por item: `service_execution_participants` com `role`/`payout_type`/`affects_*`.
- Atribuição de profissional: `comanda.staff_id` (único) ou por item/participante.

**Plano:** preservar; garantir que o contrato de atendimento (seção 8) registre **quem executou** (staff_id por item/participante) e que a auditoria de operador (seção 17) registre **quem operou** a ação — papéis distintos.

---

## 17. Operadores (papel de auditoria)

**Requisito:** toda ação relevante rastreável ao operador, distinguindo:
- **PROFISSIONAL** (executou o serviço — `staff_id`/participantes)
- **OPERADOR DA AÇÃO** (registrou pagamento/desbloqueio/cancelamento — usuário autenticado)

Levantamento das estruturas existentes para **reuso** (não criar mecanismo paralelo):

| Estrutura | Serve para | Gap |
|---|---|---|
| `comandas.settled_by_user_id` | operador da baixa | não cobre desbloqueio/edição |
| `comandas.cancelled_by_user_id` | operador do cancelamento | ok para cancelamento |
| `financial_reversals.created_by_user_id` | operador do estorno | ok |
| `transactions.user_id` | operador do lançamento | ok |
| `closure_note` (JSONB, zero-close) | operador + motivo da baixa zero | baixa por pagamento não grava closure_note rico |
| `audit_logs` | operações administrativas | policy read por tenant (20260227223434:51-53) |
| **Event Store + Outbox** (Fase 4) | trilha de eventos com `metadata.actor_id`/`correlation_id` | eventos financeiros são `CheckoutCompleted`/`CashClosingCompleted`; **falta evento de desbloqueio/atendimento** |
| `role_permissions_audit` | bootstrap de permissões | não é trilha de negócio |

**Proposta (seção 18):** trilha baseada em audit trail + eventos de domínio reutilizando Event Store, **sem** segundo mecanismo.

---

## 18. Audit trail (proposta)

**Princípio:** usar camadas existentes (colunas de auditoria + `closure_note` + Event Store/Outbox + `audit_logs`), preenchendo lacunas pontuais — não criar motor de auditoria novo.

### 18.1 Ações a cobrir

| Domínio | Ações | Estado atual | Ação proposta |
|---|---|---|---|
| Agendamento | criação | `appointments.created_at` | ok (indireta) |
| Agendamento | alteração/reagendamento/confirmação/profissional/horário | sem trilha | **novo evento de domínio** `AppointmentUpdated` (payload antes/depois) |
| Agendamento | cancelamento | `cancellation_type`/`cancel_reason` | ok |
| Comanda | criação | `created_at` | ok |
| Comanda | bloqueio | criação implícita | evento na criação |
| Comanda | **desbloqueio** | ❌ F3 | **RPC de desbloqueio + `unlocked_at`/`unlocked_by_user_id` + evento** |
| Comanda | alteração (itens/valores) | checkout com compensação | evento `CheckoutCompleted` já cobre fim; alteração pré-baixa via outbox |
| Comanda | fechamento | settle/zero-close (auditado) | ok |
| Comanda | cancelamento | auditado | ok |
| Itens | add/remove/qtd/valor/profissional/participação | checkout (sync com compensação) | coberto por evento de checkout; opcional diff antes/depois |
| Financeiro | criar recebível | implícito | se recebível explícito (seção 9) → evento |
| Financeiro | pagamento/parcial/antecipado | `transactions.metadata` | se N-pagamentos → evento `PaymentRegistered` |
| Financeiro | baixa | settle (auditada) | ok |
| Financeiro | estorno | `financial_reversals` | ok |
| Financeiro | cortesia/baixa administrativa | zero-close `closure_note` | ok |
| Desconto | criação/alterar/remover | checkout + release gate | coberto; incluir em trilha se editável pós-baixa |

### 18.2 Formato da trilha (padrão)

Cada registro deve carregar: quem (`actor_id` = `auth.uid()` + role), quando (`timestamp`), tenant, entidade, entity_id, ação, valor anterior, valor posterior, motivo (quando aplicável). Onde houver transição de estado importante (bloqueio/desbloqueio/atendimento), exige: `actor_id`, `timestamp`, entidade, estado anterior, novo estado, origem, motivo.

---

## 19. Permissões

### 19.1 Papéis reais do projeto (não inventar)

`owner | admin | manager | gerente | superadmin | 'super admin' | barber | receptionist | cashier` + `role_permissions` (novo sistema, `20260717000000`) com operações como `services.apply_discounts`.

### 19.2 Matriz de permissões por operação (estado atual + proposta)

| Operação | Hoje | Proposta |
|---|---|---|
| Editar comanda (itens/produtos/valores) | Checkout (quem tem acesso) | manter; habilitar no modal só se DP7 aprovar |
| Registrar pagamento | settle: roles de gestão (20260514000001:50-56) | manter padrão; barber/receptionist/cashier podem registrar pagamento? **DP** |
| Registrar pagamento antecipado | ❌ (UI) | e.g. recepção/gestão — **DP11** |
| Registrar pagamento parcial | ❌ | conforme DP4 |
| Baixa | gestão | manter |
| Baixa administrativa | `isManagerLikeRole` (AccountsReceivable:379; zeroClose.ts:67-71) | manter |
| Estornar | `canRequestFinancialReversal` (377-378) | manter |
| Cancelar | quem tem acesso + motivo | manter |
| Alterar desconto | recepção permitida (`apply_discounts`) | manter; definir pós-baixa (DP12) |
| Alterar data de atendimento | UI de agendamento | definir quem (DP10 alt.) |
| Desbloquear comanda | ❌ (client-side, qualquer acesso) | **RPC + role de gestão** (F3) |

---

## 20. RLS / Multi-tenant

**Vetores obrigatórios para qualquer mudança:** `tenant_id` obrigatório, RLS, SECURITY DEFINER + `auth.uid()`, autorização no backend, isolamento entre tenants.

Reauditoria dos pontos da auditoria (F4/F8/F9):

| Item | Classificação | Situação |
|---|---|---|
| `transactions`, `comandas`, `comanda_items`, `cash_closings`, `commission_records`, `event_store`, `processed_operations` | ✅ **Seguro** | padrão `current_is_super_admin_from_auth_uid() OR tenant_id = current_tenant_id_from_auth_uid()` |
| `bulk_close_comandas_admin` (F4) | 🚨 **Requer correção** | SECURITY DEFINER + grant authenticated **sem auth/tenant check no corpo** |
| `approve_access_request()`/`close_order()` (F8) | 🚨 **Requer correção** | sem `auth.uid()` (auditoria Fase 3.3) |
| Policy de `appointments` (F9) | ⚠️ **Requer validação** | helper profiles-only (`get_current_tenant_id`) — validar em ambiente real |
| Novas tabelas de pagamento (se aprovadas) | 📋 **Requer redesign** | nascer com RLS correta desde a criação (padrão das RPCs `finance_*`) |

**Nenhuma correção nesta etapa.**

---

## 21. Schema drift (F5)

Tabela de reconciliação (não criar migration; somente planejar):

| Estrutura | Existe remoto | Existe local | Migration origem | Risco | Ação recomendada |
|---|---|---|---|---|---|
| `comandas.discount numeric(10,2)` | ✅ (dump 6071) | ❌ | — | Alto (rebuild local, D8 valida posição 27) | Migration de reconciliação (P0) |
| `comandas.subtotal numeric` | ✅ (dump 6068) | ❌ | — | Alto | idem |
| `comandas.chef_club_original_total` | ✅ (dump 6075) | ❌ | — | Médio | idem |
| `comandas.chef_club_savings_total` | ✅ (dump 6076) | ❌ | — | Médio | idem |
| `comandas.chef_club_summary` | ✅ (dump 6077) | ❌ | — | Médio | idem |
| 9 colunas financeiras (payment_method…closure_note) | ✅ remoto | ✅ **a posteriori** | `20260602030500` (align, declara drift) | — | já reconciliado; preservar COMMENTs |
| Demais divergências | a conferir | — | — | — | rodar `supabase db diff` antes da Fase 0 |

**Pré-requisito:** rodar diff real remoto × local (via Supabase CLI) antes de redigir a migration de reconciliação. **Migration com `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` idempotente**, sem backfill de valores.

---

## 22. Arquitetura (fluxos respeitados)

O plano respeita a cadeia existente e **proíbe**:
- Regra financeira diretamente em componente React;
- Acesso direto ao Supabase da UI quando existe camada adequada (repositories/RPC);
- Duplicação de regras (comissão só em `domain/commission/*`; settlement só nas RPCs `finance_*`).

Fluxo proposto para novos fluxos (pagamentos múltiplos/antecipado):

```
Pages (form + estado UX)
  → src/lib/finance/* (orquestração com timeout + idempotência — padrão settlement.ts)
  → RPC financeira SECURITY DEFINER (papel de banco: lock + validação + gravação atômica)
  → Outbox (evento financeiro atômico, padrão D7 20260827000000)
  → Event Store (trilha) + subscribers read-only
```

---

## 23. Event Bus / Outbox / Event Store

Reuso (sem segundo mecanismo):

| Mecanismo | Uso no plano |
|---|---|
| `appEventBus` + `createEvent` | novos eventos de domínio: `AppointmentUpdated`, `ComandaUnlocked`, `AttendanceCompleted`, `PaymentRegistered` (se N-pagamentos) |
| Event Store (`event_store`, Fase 4) | trilha imutável com `metadata.actor_id`/`correlation_id` |
| Outbox (`outbox_items` + D7/D8) | efeitos financeiros atômicos (comissão etc.) — worker D8 produção certificada |
| `processed_operations` | idempotência de operações |
| Replay Engine | auditoria/reconstrução |

**Cadeia por evento (formato a seguir):**

```
EVENTO → entidade (id) → payload (negócio) → actor_id → tenant_id → timestamp → efeitos derivados
```

Exemplo — `PaymentRegistered` (se aprovado): entidade `comanda`, payload `{amount, method, type, saldoAnterior, saldoNovo}`, actor = operador, tenant, timestamp = RPC, efeitos = recibo (transação espelho) + outbox (comissão, conforme DP1).

**Regra:** não criar segundo mecanismo de auditoria/eventos sem justificativa forte (não há, dado o reuso acima).

---

## 24. Modelo conceitual proposto (SEM implementar)

```
CICLO OPERACIONAL                          CICLO FINANCEIRO
━━━━━━━━━━━━━━━━━━━                        ━━━━━━━━━━━━━━━━━━━━
AGENDAMENTO ──────────────┐                RECEBÍVEL (implícito = comanda)
   ↓                      │                   ↓
ATENDIMENTO (evento,      │                PAGAMENTO #1 (antecipado, parcial)
   attended_at)           │                   ↓
   ↓                      │                PAGAMENTO #2 (no atendimento / posterior)
SERVIÇO REALIZADO         │                   ↓
   ↓                      │                SALDO = total − Σ pagamentos
ATENDIMENTO CONCLUÍDO     │                   ↓
   ↓                      │                BAIXA (quitação, saldo = 0)
COMANDA ──────────────────┴──► estado       ↓
   operacional: blocked/open/paid/cancelled ESTORNO (qdo aplicável)
   + financeiro derivado: pendente/parcial/pago

PARALELO (auditoria):
OPERADOR → AUDIT EVENT → ENTIDADE → ANTES/DEPOIS (+ motivo)
```

O modelo deve permitir: antecipado, parcial, no atendimento, posterior, múltiplos pagamentos, atendimento separado de pagamento, auditoria de operador — **combinando** (a) estados existentes da comanda (operacional) e (b) saldo/pagamentos derivados (financeiro). **Não requer** nova tabela para cenários A/B; **requer** decisão para C/D (seções 9-12).

---

## 25. Máquina de estados (proposta conceitual)

Estados compatíveis com o domínio real (não inventar; usar os existentes + transições derivadas):

```
AGENDAMENTO (appointments.status)
scheduled/confirmed → in_progress → completed
      └──────────────→ cancelled / no_show

ATENDIMENTO (novo: derivado de attended_at + status)
confirmado → em atendimento → realizado (attended_at preenchido)
      └─────→ não realizado (no_show/cancelado)

COMANDA (comandas.status — operacional)
blocked → open → paid
blocked ────────→ paid   (CENÁRIO C: pagamento antecipado, atendimento PENDENTE)
   ↓        ↓
(cancelada direto de blocked/open/paid → cancelled)   [commit ae38faa]

FINANCEIRO (derivado)
pendente → parcial → pago → (reversão) → revertido
```

Transições críticas (detalhe exigido na implementação):

| Transição | Origem→Destino | Quem executa | Evento | Persistência | Auditoria | Impacto financeiro |
|---|---|---|---|---|---|---|
| Desbloqueio | blocked→open | gestão (RPC) — **DP** | `ComandaUnlocked` | `comandas.status` | RPC + colunas + evento | habilita baixa via UI |
| Pagamento antecipado | blocked→paid (financeiro: parcial) | autorizado (**DP11**) | `PaymentRegistered` | pagamento + transaction | operador + valor | saldo, comissão por DP1 |
| Atendimento | confirmed→in_progress→completed | profissional (**DP8**) | `AttendanceCompleted` | `attended_at` + status | operador | elegibilidade de comissão (DP9) |
| Baixa/quitação | saldo 0 ⇒ paid | gestão | `CheckoutCompleted`/baixa | settle RPC | padrão atual | comissão por DP1 |
| Estorno | paid→revertido | gestão (377-378) | reversão outbox | `financial_reversals` | atual | reverte comissão (D8) |
| Cancelamento | *→cancelled | com acesso + motivo | — | atual | atual | nenhuma baixa |

---

## 26. Matriz de impacto

| Alteração | Frontend | Backend | RPC | DB | RLS | Comissão | Auditoria | Testes |
|---|---|---|---|---|---|---|---|---|
| Data de atendimento (`attended_at`, F2) | dias/checkout | domain | opcional | migration (coluna) | n/a | elegibilidade (DP9) | evento + operador | unit+integração |
| Pagamento antecipado (C) | Contas a Receber/Checkout | service | nova RPC ou extensão extendente | se D: tabela pagamentos | padrão v2 | por DP1 | evento + closure_note | e2e Cenário C |
| Pagamento parcial (D) | Contas a Receber (saldo) | service | nova RPC assess | se D: tabela | padrão | derivada do recebido | evento | e2e Cenário D |
| Múltiplos pagamentos | UI recibo/saldo | service | RPC pagamento N | tabela (se aprovado) | nova policy | por pagamento | evento por pagamento | unit concorrência |
| Baixa (quitação) | botão/modos | — | ajuste settle para `open`/`blocked` | n/a | n/a | — | já auditado | regressão |
| Desconto (F5) | — | — | — | migration reconciliação | n/a | preservada (FIX-001) | gate atual | build/d8:verify |
| Profissional (participantes) | Checkout | — | — | n/a | n/a | preservada | já em closure_note | regression |
| Desbloqueio (F3) | Comandas.tsx → RPC | service | **nova RPC** | colunas unlock | padrão | — | RPC + colunas + evento | e2e desbloqueio |
| Audit trail (17/18) | Reports | domain/events | eventos novos | event_store (existente) | padrão | — | nativo | unit eventos |

---

## 27. Migrations necessárias (planejamento — NENHUMA executada)

| # | Objetivo | Tabelas | Colunas/constraints | Risco | Depende de |
|---|---|---|---|---|---|
| M1 | **Reconciliação de schema (F5)** | `comandas` | `ADD COLUMN IF NOT EXISTS discount, subtotal, chef_club_*` + COMMENTs | baixo (idempotente) | diff real do Supabase |
| M2 | **Timestamp de atendimento (F2)** | `appointments` (+ espelho em `comandas`?) | `attended_at timestamptz NULL` | médio | DP8 (modelo) |
| M3 | **Desbloqueio auditado (F3)** | `comandas` | `unlocked_at timestamptz NULL`, `unlocked_by_user_id uuid NULL` | médio | DP (quem pode) |
| M4 | **Serviço pagamentos N (se DP10 aprovar)** | nova tabela `comanda_payments` | colunas seção 10 + RLS + idempotência UNIQUE | alto | DP4/DP10/DP11 |
| M5 | **Cancelamento de agendamento** → comanda | (já existe no branch ae38faa) | — | — | — |
| M6 | **Política de appointments (F9)** | `appointments` policy | migrar para helper novo | médio | validação ambiente real |

Cada migration futura seguirá: objetivo, tabelas, colunas, índices, constraints, enums, FKs, RLS, rollback, compatibilidade, risco. **Nenhuma agora.**

---

## 28. RPCs necessárias (planejamento — NENHUMA executada)

| # | RPC | Objetivo | Padrão de segurança | Depende de |
|---|---|---|---|---|
| R1 | (corrigir) `bulk_close_comandas_admin` — F4 | adicionar auth.uid + tenant + role check no corpo | SECURITY DEFINER + auth.uid + advisory + FOR UPDATE | P0 segurança |
| R2 | (corrigir) `approve_access_request`/`close_order` — F8 | `auth.uid()` + `FOR UPDATE` | Fase 3.3 checklist | P0 |
| R3 | `finance_desbloquear_comanda` (nome a definir) — F3 | transição blocked→open com auditoria + regra de data | padrão finance_* | M3 + DP |
| R4 | `finance_register_payment` (se D aprovado) — F7 | registrar pagamento N com saldo e idempotência | padrão finance_* + advisory lock | M4, DP4/10 |
| R5 | (se necessário) extensão da settle para origem antecipada | habilitar UI do Cenário C | internar settle intacta | DP1/DP6/DP10 |
| R6 | marcação de atendimento (nome a definir) — F2 | gravar `attended_at` + transição status | padrão | M2 + DP8 |

Todas com: `auth.uid()` obrigatório, validação de tenant, advisory lock quando mutação concorrente, `FOR UPDATE`, idempotência, grant somente a `authenticated`.

---

## 29. Backfill

Cenário-alvo: `attended_at` (e demais colunas novas) para dados históricos.

| Classe de dado | É possível inferir? | Estratégia |
|---|---|---|
| Comandas `paid` com transação income e sem appointment | ❌ (não há gateway de atendimento) | **deixar NULL** (mais seguro) |
| Comandas `paid` com appointment `start_time` passado | ⚠️ parcial (service provavelmente prestado, mas sem prova) | **deixar NULL OU derivado opcional** com flag `derived=true` — decisão DP15 |
| Comandas `blocked` com appointment futuro | ❌ (atendimento ainda não ocorreu) | **NULL** |
| Pagamento antecipado (payment_type) | ✅ derivável: `paid_at < appointment.start_time` | backfill com origem derivada e marcação explícita |
| Desbloqueio (unlocked_at/by) | ❌ | **NULL** (sem prova de quem/quando) |

**Regra:** não preencher dados históricos automaticamente sem estratégia; classificar por `seguro / parcial / impossível / NULL`. Decisão de política (DP15) é do negócio.

---

## 30. Compatibilidade

O plano **preserva** (sem breaking change):

- Dados e comandas existentes (migrations aditivas/idempotentes).
- Pagamentos existentes (transações `income` continuam sendo o registro financeiro válido).
- Comissão existente (`commission_records`, FIX-001, D8 equivalentes).
- Relatórios atuais (derivados de comandas/transactions — nenhuma remoção).
- Event Store / Outbox / Dispatcher (eventos novos são aditivos).
- RLS multi-tenant (padrão v2 mantido; novas tabelas/policies nascem corretas).
- UI atual continua funcionando (mudanças são aditivas; modal read-only preservado até DP7).

**Estratégia de migração para mudanças de status:** nenhum status existente é removido; `blocked` mantém significado operacional; o financeiro vira **derivado** (não altera o CHECK).

---

## 31. Testes futuros

| Camada | Cobertura |
|---|---|
| **Unitários** | saldo (∇ = total − Σ pagamentos), parcial, antecipado, múltiplos, comissão (FIX-001 — inalterado), transições de estado, idempotência, datas (contrato seção 7) |
| **Integração** | RPCs novas/corrigidas (auth, tenant, advisory lock, FOR UPDATE, idempotência), RLS (novas tabelas/policies), settlement, pagamento, estorno, outbox atômico (padrão D7), concorrência |
| **E2E** | Cenário A (pagamento no atendimento), B (posterior), C (antecipado), D (antecipado parcial + posterior) — reposuando `tests/e2e` existente (page objects + fixtures) |
| **Auditoria** | operador, timestamp, antes/depois, motivo obrigatório |
| **Concorrência** | 2 pagamentos simultâneos, 2 baixas, pagamento + estorno (harness estilo `tests/d8/harness`) |

---

## 32. Gates de implementação (critérios)

| Gate | Critério de saída |
|---|---|
| G0 — Decisões de domínio | Etapa 2.1 encerrada: 15 DPs respondidas pelo PO + ADRs das decisões aprovadas registradas |
| G1 — Schema design | Migrations prospectivas revisadas (`supabase db diff` limpo) |
| G2 — RPC/backend | RPCs com auth/tenant/idempotência; `npm run d8:verify` verde |
| G3 — RLS/permissões | Novas policies auditadas; F4/F8 corrigidos |
| G4 — Unit tests | Suite nova verde |
| G5 — Integration tests | RPC/RLS/concorrência verde |
| G6 — E2E | Cenários A–D verdes |
| G7 — Build | `npm run build` ok |
| G8 — Preview | Deploy de preview validado |
| G9 — Smoke | Smoke suite P0 (<3min) verde |
| G10 — Produção | Aprovação do PO + deploy controlado |

**Nenhum gate executado nesta etapa.**

---

## 33. Priorização (reclassificada)

| Prioridade | Item | Problema | Dependências | Risco | Esforço |
|---|---|---|---|---|---|
| **P0** | F4/F8 — segurança RPC | autenticação/autorização ausente | — | alto | médio |
| **P0** | F5 — reconciliação de schema | drift migrations/remoto | diff real | médio | baixo |
| **P0** | F2/F3 — atendimento + desbloqueio auditado | base do cenário antecipado | DP8, DP (quem desbloqueia) | alto | alto |
| **P0** | R0 — pagamento antecipado (C) | requisito do PO | F2/F3/F5, DP1/DP11 | alto | alto |
| **P1** | F7/D — pagamento parcial/múltiplos | Cenário D | DP4/DP10, R0 | alto | alto |
| **P1** | F9 — política appointments | gap RLS | ambiente real | médio | baixo |
| **P1** | F6 — elegibilidade comissão | decisão negócio (A/B) | DP1/DP9 | médio | médio |
| **P2** | F1 — modal baixa UX | decisão design (DP6/DP7) | — | baixo | baixo |
| **P2** | F11 — no-show × comanda | regra negócio | — | baixo | baixo |
| **P3** | F10 — tsc/outbox | backlog manutenção | — | baixo | médio |

---

## 34. Ordem recomendada de implementação (justificada)

A ordem segue **dependências** (decisão de domínio → schema → segurança → contrato → modelo → auditoria → pago → UI):

```
G0   DECISÕES DE DOMÍNIO (Etapa 2.1 — 15 DPs respondidas pelo PO; ADRs registradas)
F0   Reconciliação de schema (F5) — pré-requisito de qualquer migration
F1   Segurança RPC (F4/F8) — base para expor novos fluxos
F2   Contrato de datas e atendimento (F2) — attended_at + transições
F3   Desbloqueio auditado (F3) — auditoria de operador
F4   Comissão (F6) — elegibilidade conforme DP1/DP9 (recomendação B; FIX-001 inalterado)
F5   Pagamentos múltiplos + antecipado (R0/C, F7/D) — pressupõe DP4=Sim; depende de DP10
F6   Audit trail (17/18) — eventos novos + operador em cada transição
F7   Permissões/RLS (19/20) — novas operações + F9
F8   UX Contas a Receber (seção 19 do briefing; F1/DP7)
F9   Testes completos (31) — cenários A-D + concorrência
F10  Deploy controlado (32 Gates)
```

Regras da ordem (revisadas):

1. **Nenhuma fase avança sem o gate da fase anterior.** Em especial, o **G0 precede F0**: não se cria schema/migration para uma regra de negócio que ainda não foi aprovada.
2. A F4 (comissão) apenas ajusta **elegibilidade** se DP1/DP9 concluírem pela Opção B; o contrato FIX-001, `commission_records` e o worker D8 permanecem intactos.
3. A F5 pressupõe **DP4 = Sim** (pagamento parcial antes do atendimento aceito pelo PO) e depende de **DP10** (modelo de pagamentos: tabela dedicada vs implícito). Se DP10 for o modelo mínimo, o Cenário C (pagamento único antecipado) usa a settle existente (já aceita `blocked` — `20260514000001:90`), corrigindo apenas a semântica de appointment/comissão.

---

## 35. Riscos

| Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|
| Pagamento antecipado gera comissão antes do atendimento (se Opção A) | alta se A | financeiro | DP1: recomendar B (execução como elegibilidade) |
| `attended_at` não pode ser preenchido retroativamente | média | auditoria | backfill NULL + política explícita (DP15) |
| Múltiplos pagamentos quebram RLS/estorno existentes | média | integridade | tabelas novas com RLS padrão desde o início; testes concorrência |
| Reagendamento muda `start_time` e corrompe derivação de antecipado | média | semântica | `payment_type` persistido (P1, seção 11) |
| Drift não totalmente mapeado | média | rebuild local | `supabase db diff` na Fase 0 |
| Corrupção semântica ao usar `settled_at` como atendimento | alta se ignorado | relatórios | contrato de datas (seção 7) aplicado em código e docs |
| `bulk_close_comandas_admin` exposto (F4) persiste durante evolução | alta | segurança | FASE 1 primeira (P0) |
| Overengineering (tabela de pagamentos sem necessidade) | média | manutenção | adotar tabela SÓ se D aprovado; A/B sem tabela |

---

## 36. Decisões que precisam de aprovação

As decisões abaixo **não podem** ser tomadas unilateralmente pelo agente. Ver `DECISÕES PENDENTES` no final.

- Modelo de atendimento (coluna única vs transição de status completa) — DP8
- Continuidade do modal read-only (DP6/DP7)
- Modelo de pagamentos (N pagamentos → tabela; se e quando) — DP4/DP10
- Elegibilidade de comissão (Opção A vs B) — DP1/DP9
- Permissões das novas operações (DP11/DP12/DP13)
- Política de backfill de `attended_at` (DP15)

---

## 37. Etapa 2.1 — Decisão de Domínio (G0)

> Adicionada a pedido do PO (29/08/2026). Etapa de **contrato de domínio** que precede a F0.
> **Nenhum schema/migration/RPC será criado para regra de negócio ainda não aprovada.**

### Fluxo de referência

```
AGENDAMENTO
    ↓
ATENDIMENTO
    ↓
RECEBÍVEL
    ↓
PAGAMENTO(S)
    ↓
QUITAÇÃO
    ↓
COMISSÃO
```

### 37.1 Contrato de datas

| Evento | Campo proposto | Estado atual | Observação |
|---|---|---|---|
| agendamento | `scheduled_at` | `start_time` (appointments) | existe |
| atendimento realizado | `attended_at` | inexistente | **novo** — ação operacional independente (DP8) |
| recebimento | `payment_at` | `paid_at` (comanda) | hoje atrelado à settle |
| quitação | `settled_at` | `paid_at` | separar se múltiplos pagamentos (DP10) |
| estorno | `reversed_at` | `reversed_at` (reversal) | existe |
| cancelamento | `cancelled_at` | `cancelled_at` | existe |

### 37.2 Contrato financeiro

| Campo | Definição |
|---|---|
| `total` | valor bruto do serviço/produto |
| `discount` | desconto aplicado |
| `net_total` | `total − discount` (a pagar) |
| `paid` | Σ pagamentos recebidos |
| `balance` | `net_total − paid` (≥ 0) |

**Princípio aprovado (DP2):** financeiro é **derivado**, não novo status.

### 37.3 Contrato de pagamento

| Tipo | Definição | Cenário |
|---|---|---|
| `antecipado` | antes do atendimento | C / R0 |
| `no_atendimento` | na data do atendimento | A (atual) |
| `posterior` | após o atendimento | B (atual) |
| `parcial` | sinal antes + saldo depois | D (DP4 = Sim) |

### 37.4 Contrato de pessoas

| Campo | Papel |
|---|---|
| `professional_id` | profissional que executa o serviço (elegibilidade/divisão de comissão) |
| `actor_id` | operador que registrou a ação (auditoria) |

**Profissional ≠ operador.**

### 37.5 Contrato de auditoria

```
quem · fez o quê · quando · em qual entidade · valor anterior · valor posterior · motivo (quando exigido)
```

---

# DECISÕES PENDENTES

> Todas as decisões abaixo requerem resposta explícita do **PO/negócio**. Para cada uma: opções, recomendação técnica, impacto e risco. O agente **não escolhe** por conta própria.
>
> **✅ G0 ENCERRADO em 29/08/2026** — as 15 DPs foram respondidas e aprovadas pelo PO (ver marcação ✅ em cada bloco). Detalhes técnicos detalhados seguem nos **ADRs** produzidos na sequência.

### DP1 — Pagamento antecipado gera comissão imediatamente?
- **Opção A:** recebido → comissão imediata (29/08).
- **Opção B:** comissão após atendimento (31/08).
- **Recomendação técnica:** B (comissão é provento da execução; ADR-001).
- **Impacto:** reconhecimento de receita, provisão sob cancelamento/no-show.
- **Risco:** A gera provisão excessiva; B atrasa payout em cenários pós-serviço.
- **✅ Decisão do PO (29/08/2026):** **B** — comissão somente após o atendimento realizado. Formalizar em ADR antes da F4.

### DP2 — Pagamento antecipado pode deixar a comanda financeiramente paga com atendimento ainda bloqueado?
- **Opções:** (a) sim, distinguindo operacional × financeiro; (b) não — comanda só fica paga após atendimento.
- **Recomendação técnica:** sim, com status financeiro **derivado** (saldo) e comanda mantendo `blocked` no ciclo operacional.
- **Impacto:** status único atual precisa de desdobramento conceitual (não de novo CHECK).
- **Risco:** baixo se financeiro for derivado; confusão de status se mantido em `paid`.
- **✅ Decisão do PO (29/08/2026):** **SIM** — comanda pode estar financeiramente paga com atendimento ainda bloqueado; financeiro será **derivado** (`balance = net_total − paid`), comanda permanece `blocked` no ciclo operacional.

### DP3 — Como representar o tipo de pagamento (antecipado/na data/posterior)?
- **Opções:** P1 campo `payment_type` enum explícito e imutável (recomendado); P2 derivado por datas (frágil); P3 reutilizar `payment_context`.
- **Impacto:** relatórios, refis, backfill.
- **✅ Decisão do PO (29/08/2026):** **P1** — `payment_type` enum explícito e imutável.

### DP4 — Pagamento parcial pode ocorrer antes do atendimento?
- **Recomendação técnica:** sim (é o Cenário D), com saldo derivado e idempotência.
- **Risco:** se não, o Cenário D é invalidado.
- **✅ Decisão do PO (29/08/2026):** **SIM** — sinal/antecipação parcial aceita (Cenário D habilitado); implica decidir o modelo de pagamentos (DP10).

### DP5 — Pagamento antecipado deve aparecer em Contas a Receber?
- **Recomendação técnica:** sim, como pendência apenas se saldo > 0; antecipado integral como "pago (antecipado)".
- **Risco:** hoje Contas a Receber só lista `open`.
- **✅ Decisão do PO (29/08/2026):** **SIM** — aparece enquanto houver saldo; antecipado integral como "pago (antecipado)".

### DP6 — "Dar baixa" deve significar apenas quitação financeira?
- **Recomendação técnica:** sim (separar "registrar pagamento" de "encerrar recebível", seção 13).
- **✅ Decisão do PO (29/08/2026):** **SIM** — baixa é financeira (quitação); **não** encerra o ciclo operacional.

### DP7 — O modal de baixa continuará read-only?
- **Opção A:** manter conferência read-only (recomendada para P2; menor risco).
- **Opção B:** permitir edição para autorizados (maior alcance; exige permissões + auditoria extra).
- **Recomendação técnica:** manter A nesta evolução; B apenas se PO demandar edição in-loco.
- **✅ Decisão do PO (29/08/2026):** **A** — modal permanece read-only nesta evolução.

### DP7.2 — Usuários autorizados poderão editar a comanda dentro do modal?
- Proporcional à DP7; se B, definir roles e trilha de antes/depois.
- **✅ Decisão do PO (29/08/2026):** sem efeito — consequente a DP7 = A (modal read-only).

### DP8 — Qual evento representa oficialmente "atendimento realizado"?
- **Opções:** (a) novo `attended_at` preenchido pelo operador; (b) transição `confirmed→in_progress→completed` tocada pelo operador; (c) manter baixa como gatilho (sem mudança).
- **Recomendação técnica:** (a) — mínima, aditiva, imutável; (b) se quiserem rastreio de início/fim.
- **✅ Direção do PO (29/08/2026):** atendimento é **ação/evento operacional independente** — jamais `pagamento → completed`. Formalizar mecanismo (a) ou (b) na Etapa 2.1 (ADR, antes da F2).

### DP9 — Qual evento torna o serviço elegível para comissão?
- **Opções:** pagamento recebido (A) vs atendimento realizado (B).
- **Recomendação técnica:** B, alinhado a DP1/ADR-001. **FIX-001 não muda.**
- **✅ Alinhado à DP1 (29/08/2026):** com DP1=B, a elegibilidade de comissão passa a ser o **evento de atendimento** (DP8); contrato FIX-001 e `commission_records` permanecem intactos na F4.

### DP10 — Adotar recebível/pagamentos múltiplos explícitos (tabela nova)?
- **Opções:** manter implícito (múltiplas `transactions` income) vs tabela `comanda_payments`.
- **Recomendação técnica:** tabela dedicada **somente se** Cenário D for oficial; caso contrário, implícito.
- **Risco:** tabela sem necessidade = overengineering; sem tabela com Cenário D = frágil.
- **✅ Decisão do PO (29/08/2026):** **tabela `comanda_payments` dedicada** (modelo de pagamentos explícito).

### DP11 — Quais operadores podem registrar pagamento antecipado?
- **Recomendação técnica:** papeis que hoje podem baixar (gestão) + recepção para valor integral antecipado (a definir).
- **✅ Decisão do PO (29/08/2026):** **gestão + recepção**, com regra de **menor privilégio** — permissão estritamente específica (ver nota).

### DP12 — Quais operadores podem alterar desconto (e pós-baixa)?
- Hoje: recepção liberada (`apply_discounts`); alteração pós-baixa não existe. Definir se alteração pós-registro de pagamento será permitida.
  - **Nota DP11 (menor privilégio):** "recepção registra antecipação integral" **não** confere poderes financeiros gerais. Permissão restrita a comanda elegível vinculada a agendamento futuro. **Não** autoriza: alterar valor, alterar desconto, estornar, modificar pagamento registrado, baixa administrativa, reatribuir profissional, encerrar atendimento.
- **✅ Decisão do PO (29/08/2026):** **recepção mantém desconto**; alteração **pós-registro de pagamento proibida** nesta evolução (valores/desconto só antes da baixa, no fluxo do Checkout).

### DP13 — Quais operadores podem realizar baixa administrativa?
- Hoje: `isManagerLikeRole` (gestão). Manter recomendado.
- **✅ Decisão do PO (29/08/2026):** **manter `isManagerLikeRole`** — baixa administrativa continua restrita à gestão.

### DP14 — Quais ações exigem motivo obrigatório?
- Hoje: barber_discount (reasonNote), cortesia/adm (motivo), cancelamento (motivo/nota). Proposta: incluir reagendamento, alteração de valores pós-registro, estorno (já exige reason).
- **✅ Decisão do PO (29/08/2026):** **motivo obrigatório nas ações atuais + reagendamento** (estorno já exige); alteração pós-registro não existe nesta evolução (DP12: proibida).

### DP15 — Qual política histórica será usada para backfill de `attended_at`?
- **Opções:** NULL total (seguro); derivar quando appointment passado (com flag); derivar sempre.
- **Recomendação técnica:** NULL para registros sem prova; derivado com flag para `paid` com appointment passado (classificado); decisão de auditoria.
- **⚠️ Decisão do PO (29/08/2026) — com cuidado:** **não inventar `attended_at`**. NULL sem evidência confiável; **derivação controlada e explicitamente marcada** somente com prova de que o atendimento ocorreu. **Pagamento antecipado NÃO é prova de atendimento.** `scheduled_at ≠ paid_at ≠ attended_at`.

---

## Validação final desta etapa

| Checagem | Resultado |
|---|---|
| Arquivos funcionais alterados | **NENHUM** |
| Migrations criadas | **NENHUMA** |
| RPCs alteradas | **NENHUMA** |
| RLS alterado | **NÃO** |
| Dados alterados | **NÃO** |
| Deploy realizado | **NÃO** |
| Arquivo produzido | `docs/audit/PLANO_EVOLUCAO_FINANCEIRA_ATENDIMENTO_AUDITORIA.md` (este) |