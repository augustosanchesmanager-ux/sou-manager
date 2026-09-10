# G1.2 — Fechamento das Decisões de Domínio da M4 (Pagamento ≠ Atendimento ≠ Comissão)

> **Fase:** G1.2 + G1.3 · **Status:** G1.2 CONCLUÍDA / BLOQUEADA · G1.3 DELIBERAÇÃO FORMAL CONCLUÍDA / BLOQUEADA (aguardando aprovação da implementação da M4)
> **Data:** 29/08/2026 · **Responsável:** OpenCode (Tech Lead) + Augusto (PO)
> **Base normativa:** ADR-016, ADR-017, ADR-018, ADR-019, ADR-020 · G1.1 (mesma data) · Migrations M1/M2/M3 (A1, 29/08/2026) · G0/DP1..DP15 (PLANO_EVOLUCAO, 29/08/2026)
> **Regra da etapa:** SOMENTE definição, fechamento de domínio e deliberação formal. NENHUMA implementação, NENHUMA migration/RPC/RLS/backend/frontend/comissão/worker/Event Store/Outbox alterado. Único arquivo produzido: este documento.

---

## 1. Identificação

| Campo | Valor |
|---|---|
| Etapa | G1.2 — Fechamento das Decisões de Domínio da M4 |
| Produto | SMG Barber |
| Objetivo | Fechar as decisões de domínio pendentes (DP-M4-04..10) e os contratos de datas, auditoria e comissão que a implementação da M4 deverá respeitar |
| Decisões pré-aprovadas reutilizadas | DP-M4-01 (SIM), DP-M4-02 (NÃO), DP-M4-03 (SIM) — ver §5 |
| Entregas | Este documento + parecer final; sem código |
| Critério de saída | PO aprovar as decisões D1..D8 (§20) e os AC-M4-01..20 (§21) para liberar a M4 |

---

## 2. Contexto e Escopo

A G1.1 (auditoria `G1_1_REVISAO_M4_FINANCE_SETTLE.md`) identificou que pagamento e atendimento são fenômenos distintos, mas o modelo atual os acopla: `finance_settle_comanda` grava o pagamento/liquidação e, indiretamente, conduz o ciclo de vida operacional da comanda (blocked → open → paid). A cadeia de ADRs aprovadas em 29/08/2026 estabeleceu a separação conceitual:

- **ADR-017** — o pagamento antecipado **não** é prova de atendimento; um único status operacional `blocked/open/paid/cancelled` precisa ser decomposto em estado operacional e estado financeiro.
- **ADR-018** — pagamentos por comanda devem ser modelados de forma explícita e auditável (`comanda_payments`), com tipo imutável `payment_type` e reversão marcada por `reversed_at` (append-only).
- **ADR-019** — as operações financeiras têm autorização por papel e motivo obrigatório; alteração de valor/desconto após pagamento é proibida.
- **ADR-020** — `attended_at` é evento operacional independente; **não deve ser inventado** na ausência de evidência (DP15); pagamento antecipado **não** preenche `attended_at`; **D-1**: coluna `attended_at TIMESTAMPTZ NULL` + `attended_at_source` em `appointments` (aplicada em M1).

### Migrations já aplicadas (A1, G1.1)

| Migration | Conteúdo | Evidência |
|---|---|---|
| `20260829000000_attended_at.sql` (M1) | `appointments.attended_at` + `attended_at_source`; COMMENT diz "Nunca pela finance_settle_comanda" | M1:8-16 |
| `20260829010000_payment_type_enum.sql` (M2) | ENUM `public.payment_type` = `anticipado, no_atendimento, posterior, parcial, final`; imutável | M2:8-14 |
| `20260829020000_comanda_payments.sql` (M3) | Tabela `comanda_payments` (tenant, comanda, payment_type, amount, payment_method, actor_id, motivo, reversed_at, idempotency_key); RLS v2; idempotência UNIQUE parcial; append-only (sem UPDATE/DELETE) | M3:9-51 |

> **Vazio de M3:** `comanda_payments` não é escrita por nenhum RPC ainda — é o ponto de entrada da M4 (G2 validou o schema; a escrita operacional pertence à M4).

---

## 3. Cenário Canônico (referência oficial — aprovado pelo PO na G1.1)

Cenário: cliente solicita serviço pelo WhatsApp em **29/08** → agendamento criado para **31/08** → comanda entra em `blocked` (fluxo futuro, `create_appointment_with_comanda`).

| # | Opção | Fluxo | Estados resultantes |
|---|---|---|---|
| **Opção 1** | Não paga nada antes | Atendimento em 31/08 → `attended_at=31/08`; paga em 02/09 → `payment_at=02/09`, `settled_at=02/09` | appointment: completed; comanda: paid; comissão elegível (após atendimento confirmado) |
| **Opção 2** | Paga R$70 em 29/08 (**antecipado integral**) | `payment_at=29/08`; financeiro: paid; appointment **NÃO** completed; `attended_at=NULL`; **comissão NÃO gerada**; após atendimento 31/08 → `attended_at=31/08`, appointment completed, comissão elegível | financial effect no ato do pagamento; operational effect no ato do atendimento |
| **Opção 3** | **Parcial antecipado**: R$30 em 29/08 + R$40 em 02/09 | `comanda_payments`: R$30 (antedipado) + R$40 (posterior); saldo R$0; `attended_at=31/08` | **sem duplicatas** de pagamento/transaction/comissão/evento; sem "falso completed" no 29/08 |

**Regra de ouro extraída:** recuperar, para qualquer comanda, a sequência completa `quando foi marcado o pagamento` / `quando foi marcado o atendimento` / `quando foi liquidado` sem depender de um único timestamp.

---

## 4. DP-M4-04 — Contrato do `attended_at` (19 perguntas)

> Perguntas fechadas com a base normativa ADR-020 (D-1), M1 e o cenário canônico. Fórmula de resposta: **DECISÃO DO PO / RECOMENDAÇÃO TÉCNICA / CONSEQUÊNCIA TÉCNICA**.

### P1. Qual o significado de `attended_at`?
- **DECISÃO DO PO:** timestamp do atendimento efetivamente realizado (evento operacional real), não a data do pagamento nem a data prevista.
- **RECOMENDAÇÃO TÉCNICA:** adotar o significado do COMMENT D-1 (M1:12-13) sem revisão.
- **CONSEQUÊNCIA:** campo não é derivável; é gravado por ação operacional explícita.

### P2. Quem grava `attended_at`?
- **DECISÃO DO PO:** uma RPC operacional de confirmação de atendimento (a criar na M4), nunca a `finance_settle_comanda`.
- **RECOMENDAÇÃO TÉCNICA:** criar em M4 `confirm_appointment_attendance` (server-side, transacional, com CHECK de permissão e motivo opcional). Não é escrita por UPDATE direto de tabela.
- **CONSEQUÊNCIA:** isolamento operacional-financeiro mantido (ADR-017); o frontend nunca passa `attended_at` em UPDATE de comanda.

### P3. Quais são as fontes de evidência do `attended_at` (valor do `attended_at_source`)?
- **DECISÃO DO PO:** aceitar o trio definido em M1: `NULL` (fluxo real), `backfill_evidence` (prova real), `inferred_from_payment` (derivado marcado, somente com revisão humana e flag explícita).
- **RECOMENDAÇÃO TÉCNICA:** manter o enum textual com validação na RPC; em M4, a RPC de confirmação grava `source=NULL` quando confirmado operacionalmente.
- **CONSEQUÊNCIA:** nenhum attend_time "estimado" entra no sistema sem marcação e revisão.

### P4. O pagamento antecipado integral pode preencher `attended_at`?
- **DECISÃO DO PO:** NÃO (ADR-020 DP15; DP-M4-02 NÃO). Antecipado = proof of payment, não proof of attendance.
- **RECOMENDAÇÃO TÉCNICA:** `finance_settle_comanda` (e a futura RPC de pagamento antecipado) nunca atualizam `attended_at`.
- **CONSEQUÊNCIA:** comissão não é gerada antes do atendimento confirmado (DP-M4-02).

### P5. O pagamento parcial pode preencher `attended_at`?
- **DECISÃO DO PO:** NÃO, pelos mesmos fundamentos de P4.
- **RECOMENDAÇÃO TÉCNICA:** idem P4; parciais acumulam em `comanda_payments` sem efeito operacional.
- **CONSEQUÊNCIA:** saldo financeiro pode zerar antes do atendimento (Opção 3), mas appointment continua `scheduled` até a confirmação operacional.

### P6. Qual evento de app aciona a gravação de `attended_at`?
- **DECISÃO DO PO:** uma ação explícita de confirmação de atendimento (botão "Confirmar atendimento" / checkout operacional), não o pagamento.
- **RECOMENDAÇÃO TÉCNICA:** RPC `confirm_appointment_attendance` só executa quando o appointment existe e não está `cancelled`/`no_show`.
- **CONSEQUÊNCIA:** `AppointmentCompleted` (event store, hoje "prepared") passa a ser publicável após a confirmação.

### P7. Pode haver atendimento sem `attended_at` preenchido?
- **DECISÃO DO PO:** nunca em fluxo real com agendamento. Em comanda sem appointment, o atendimento é subentendido pelo fluxo (ver P8).
- **RECOMENDAÇÃO TÉCNICA:** para comandas com `appointment_id`, `attended_at` é obrigatório para o estado `completed`; para comandas sem appointment, o atendimento é implícito ao checkout.
- **CONSEQUÊNCIA:** invariante "completed sem atendimento confirmado" bloqueado no ciclo com appointment.

### P8. Comanda sem `appointment_id`: como tratar o atendimento?
- **DECISÃO DO PO:** atendimento implícito (fluxo balcão/direto) — não inventar `attended_at`.
- **RECOMENDAÇÃO TÉCNICA:** manter `attended_at=NULL` e `attended_at_source=NULL`; o estado `completed` cobre o caso; comissão elegível normalmente.
- **CONSEQUÊNCIA:** regra de comissão não depende de `attended_at` para comandas sem agendamento (sem mudança de regra — ADR-016).

### P9. `attended_at` pode ser alterado (corrigido) depois de gravado?
- **DECISÃO DO PO:** DECISÃO DE NEGÓCIO PENDENTE — não existe regra formal de alteração retroativa.
- **RECOMENDAÇÃO TÉCNICA (proposta, não decidida):** permitir correção **somente** por papel gestor com motivo obrigatório, gravando a alteração em trilha de auditoria (before/after), nunca reescrevendo o valor original de forma silenciosa.
- **CONSEQUÊNCIA:** se não houver aprovação, a M4 deve bloquear a alteração pós-confirmação.

### P10. Existe autoridade final para confirmar um atendimento em disputa?
- **DECISÃO DO PO:** DECISÃO DE NEGÓCIO PENDENTE (não formalizada).
- **RECOMENDAÇÃO TÉCNICA:** por padrão, o executor (barber) que executou o serviço, e supervisor (manager/admin) como autoridade superior; documentar o operador.
- **CONSEQUÊNCIA:** a matriz DP-M4-09 define papel mínimo; a autoridade final fica condicionada à aprovação.

### P11. `attended_at` precisa ter consistência com `start_time` do agendamento?
- **DECISÃO DO PO:** sim — `attended_at` deve respeitar a janela do agendamento (com tolerância operacional).
- **RECOMENDAÇÃO TÉCNICA:** validar na RPC: `attended_at >= start_time` (ou no máximo N horas antes, se aprovado); nunca antes do `created_at` do agendamento.
- **CONSEQUÊNCIA:** evita "atendimento antedatado" e underpinning de auditoria.

### P12. O que acontece com o `attended_at` quando o appointment é cancelado?
- **DECISÃO DO PO:** se não houve atendimento, `attended_at` permanece NULL; se houve, o cancelamento fica bloqueado (fluxo de cancelamento atual cancela comandas open/blocked, mas não comandas já pagas — ver DP-M4-06).
- **RECOMENDAÇÃO TÉCNICA:** manter NULL; cancelamento não inventa atendimento.
- **CONSEQUÊNCIA:** sem attended_at em appointment cancelado.

### P13. O que acontece com o `attended_at` em no-show?
- **DECISÃO DO PO:** permanece NULL; no-show não é atendimento.
- **RECOMENDAÇÃO TÉCNICA:** `attended_at_source` não recebe valores de no-show.
- **CONSEQUÊNCIA:** DP-M4-07 baseia-se nisso.

### P14. A confirmação de atendimento pode ser feita em batch/automática?
- **DECISÃO DO PO:** DECISÃO DE NEGÓCIO PENDENTE — não há regra de auto-confirmação.
- **RECOMENDAÇÃO TÉCNICA:** a M4 **não** implementa auto-confirmação (evita desbloqueio silencioso); cada confirmação é atômica e operador-atribuída.
- **CONSEQUÊNCIA:** sem efeito colateral automático além do desbloqueio definido em §14.

### P15. A confirmação de atendimento é acoplada ao desbloqueio da comanda?
- **DECISÃO DO PO:** desbloqueio é evento derivado (ver §14); a confirmação pode ocorrer em momentos distintos.
- **RECOMENDAÇÃO TÉCNICA:** a RPC de confirmação não atualiza diretamente `comandas.status`; o desbloqueio é evento separado.
- **CONSEQUÊNCIA:** estado operacional do appointment e da comanda permanecem independentes.

### P16. Quais estados operacionais permitem confirmar atendimento?
- **DECISÃO DO PO:** appointment `scheduled` (e o modelo de estados vigente: não há `scheduled` no CHECK atual — `20260421000000_add_cancellation_reason_and_noshow.sql:7-8` —, apenas `pending/cancelled/completed/no_show`); revisar o CHECK na M4 se necessário.
- **RECOMENDAÇÃO TÉCNICA:** confirmar a partir do estado que represente "agendado"; nunca sobre `cancelled`/`no_show`.
- **CONSEQUÊNCIA:** precisa decisão de modelo de estados (dependente do CHECK do appointment).

### P17. `attended_at` entra no critério de comissão?
- **DECISÃO DO PO:** sim, indiretamente — a comissão exige atendimento confirmado (pré-condição), não pagamento isolado (ADR-016 + DP-M4-02).
- **RECOMENDAÇÃO TÉCNICA:** NÃO alterar a regra de cálculo (core compartilhado do worker); o gate de elegibilidade vive **antes** do enfileiramento (outbox) ou no emissor do evento, não dentro do `calculate`.
- **CONSEQUÊNCIA:** zero mudança de regra D8; mapeamento do worker em §15.

### P18. `attended_at` precisa de índice/constraints?
- **DECISÃO DO PO:** sim — consultas de listagem e relatório usarão o campo.
- **RECOMENDAÇÃO TÉCNICA:** índice em `appointments(tenant_id, attended_at)` (em M4, migration aditiva), sem constraint de unicidade.
- **CONSEQUÊNCIA:** performance de relatórios sem full-scan.

### P19. `attended_at` interage com o `payment_type = no_atendimento`?
- **DECISÃO DO PO:** quando o pagamento ocorre no momento do atendimento, as datas podem coincidir, mas os eventos continuam sendo gravados separadamente.
- **RECOMENDAÇÃO TÉCNICA:** `no_atendimento` é classificação de pagamento (M2); `attended_at` é evento operacional (M1). Nunca derivar um do outro.
- **CONSEQUÊNCIA:** o par `(payment_type=no_atendimento, attended_at=X)` é coerente, mas não é uma regra de igualdade.

**SÍNTESE DP-M4-04:** `attended_at` é evento operacional, gravado exclusivamente por RPC de confirmação de atendimento, com fonte de evidência explícita, independente de pagamento. Perguntas P9, P10, P14 → **DECISÃO DE NEGÓCIO PENDENTE** (proposta técnica registrada).

---

## 5. DP-M4-05 — Fonte de Verdade dos Pagamentos (18 perguntas)

> Objetivo: definir a fonte canônica de "quanto e quando foi pago por comanda", eliminando risco de duas fontes concorrentes (RISCO CRÍTICO em G1.1).

**RECOMENDAÇÃO TÉCNICA GERAL:** Fonte de verdade = **relacional formal** (visão C, confirmada na G1.1):
- `public.comanda_payments` = fonte canônica **por pagamento** (cada parcela/antecipação/baixa, com `payment_type`, `amount`, `actor_id`, `reversed_at`, `idempotency_key`).
- `public.transactions` = fonte canônica **contábil** (linhas `income`/`expense` por tenant; uso em DRE, cash closing, reversals).
- Estado financeiro derivado da comanda (`paid`, `settled_at`, `balance = net_total − paid`) = **projeção** (composable), recalculável a partir de `comanda_payments`.
- **Regra:** Onde há duas fontes (comanda × transaction), a conciliação é por `idempotency_key` e `source_id` (mesmo padrão do finance_reverse_transaction); nenhum frontend calcula saldo por consulta ad-hoc em transactions.

### Perguntas e fechamentos

1. **Qual fonte responde "quanto o cliente pagou nesta comanda"?** → `comanda_payments` (SOMA com `reversed_at IS NULL`).
2. **Qual fonte responde "quando pagou"?** → `comanda_payments.created_at` / `payment_date`.
3. **Qual fonte responde "como pagou" (método)?** → `comanda_payments.payment_method` (padrão do M3:17).
4. **Qual fonte responde "quem recebeu/registrou"?** → `comanda_payments.actor_id` (M3:16) + papel resolvido por `profiles`/`staff`.
5. **Qual fonte responde "pagamento foi estornado?"** → `comanda_payments.reversed_at` (append-only, M3:18/49-50) + `financial_reversals.reversal_type`.
6. **Qual fonte responde "comissão calculada?"** → `commission_records` (tabela própria), com `idempotency_key` derivada do evento.
7. **Qual fonte responde "a comissa foi estornada?"** → `financial_reversals` + eventos (`CheckoutReverted`/`CommissionCalculated`).
8. **Qual fonte responde "a comanda está quitada?"** → projeção: `SUM(payments) >= net_total` e `reversed_at` NULL.
9. **Qual fonte responde "a comanda foi liquidada (settlement)?"** → `comandas.settled_at` + `settled_by_user_id` (transacional).
10. **Qual fonte responde "atendimento ocorreu?"** → `appointments.attended_at` (M1), nunca transactions.
11. **Qual fonte responde "duplicidade de pagamento?"** → `comanda_payments` + UNIQUE `(tenant_id, idempotency_key)` (M3:29-31).
12. **Quem escreve `comanda_payments`?** → RPC transacional da M4 (pagamento antecipado/parcial/baixa), replica idempotência do padrão transactions/financial_reversals.
13. **`transactions` continua sendo gravada?** → Sim, como espelho contábil da M4 (income por comanda), mantendo compatibilidade com cash closing/reversals atuais.
14. **Há função de conciliação?** → Recomenda-se (M4) RPC read-only `reconcile_comanda_payments` (diff entre comanda_payments × transactions × commission_records) para auditoria; sem escrita.
15. **Saldo pode ser derivado de duas fontes simultaneamente?** → NÃO. Frontend usa sempre `comanda_payments` (agregada) + `comandas.net_total`; nunca soma bruta de transactions.
16. **E o `financial_effect`?** → mantém semântica atual (coordenado com ADR-001; `CheckoutCompleted.financialEffect` continua no evento).
17. **Fonte de verdade para relatórios financeiros (DRE/cash closing)?** → `transactions` (contábil), com projeção de saldo por comanda via `comanda_payments`.
18. **Há RISCO CRÍTICO de fonte concorrente hoje?** → Transacionalmente NÃO (baixas atuais escrevem transactions + comanda no mesmo fluxo); o risco só existiria se `comanda_payments` fosse alimentada por caminho paralelo sem conciliação. **Mitigação:** única RPC gravadora na M4 + idempotência + auditoria.

**SÍNTESE DP-M4-05:** Fonte de verdade relacional = `comanda_payments` (pagamentos) + `transactions` (contábil) + `commission_records` (comissão), cada qual com responsabilidade única e conciliação por idempotência/source_id. Sem duas fontes competidoras; sem RISCO CRÍTICO remanescente desde que a M4 grave por RPC única.

---

## 6. DP-M4-06 — Cancelamento (5 opções)

> Não existe política formal de reembolso em cancelamento. O fluxo atual (`application/appointment/lifecycle.ts:210-289`) cancela appointment e cancela comandas open/blocked vinculadas, **sem** tratar pagamentos já registrados.

| Opção | Descrição | Impacto |
|---|---|---|
| **A** | Cancelar somente estado operacional; pagamentos ficam intocados (sujeitos a estorno manual) | Alinha ao hoje; exige política de reembolso |
| **B** | Cancelar e reverter pagamentos automaticamente (full_refund) | EXIGE política comercial formal; alto risco |
| **C** | Cancelar com bloqueio de novos pagamentos e obrigar resolução pendente | Novo estado; decisão de negócio |
| **D** | Cancelar somente se saldo = 0 (sem pagamentos) | Restritivo |
| **E** | Manter comportamento atual + documentar risco | Zero código |

**DECISÃO DO PO (não há regra formal):** **DECISÃO DE NEGÓCIO PENDENTE** — escolher A..E exige política de reembolso/cancelamento do PO.

**RECOMENDAÇÃO TÉCNICA (proposta, condicionada ao PO):** **Opção A** + estorno manual pela matriz DP-M4-10 (continua com o comportamento atual, registrando em auditoria que pagamentos não são revertidos automaticamente). Em M4, o cancelamento deve **bloquear** a gravação de novos `comanda_payments` para comandas `cancelled` e **expor** na UI quitação pendente (se houver).

**CONSEQUÊNCIA TÉCNICA:** nenhuma mudança de código nesta etapa; a M4 herda a regra vigente até deliberação.

---

## 7. DP-M4-07 — No-show

- **DECISÃO DO PO:** DECISÃO DE NEGÓCIO PENDENTE (não há política formal de no-show — crédito, multa ou reembolso).
- **RECOMENDAÇÃO TÉCNICA:** no-show permanece estado operacional (`appointment.status = no_show`, `detect_no_show` existente); **jamais** preenche `attended_at` (P13); comanda se houver (aberta/criada) segue regras de cancelamento (DP-M4-06). Sem crédito automático.
- **CONSEQUÊNCIA TÉCNICA:** nenhuma alteração; registra-se critério de aceite AC-M4-N (no-show não influi em attended_at nem em comissão).

---

## 8. DP-M4-08 — Papéis e Operações (matriz)

> Papéis reais do sistema: `superadmin`, `owner`, `admin`, `manager`, `receptionist`, `barber` (ADR-019). Helper de gestão existente: `isManagerLikeRole` (`src/lib/finance/zeroClose.ts:67-71`) inclui owner/admin/manager/gerente/superadmin; `canRequestFinancialReversal` (Receipts.tsx:162-163) inclui superadmin/owner/admin/manager.

| Operação | Registrar antecipado | Pagamento parcial | Baixa (settlement) | Estorno |
|---|---|---|---|---|
| **superadmin** | ✅ (bypass) | ✅ (bypass) | ✅ (bypass) | ✅ (bypass) |
| **owner** | ✅ | ✅ | ✅ | ✅ |
| **admin** | ✅ | ✅ | ✅ | ✅ |
| **manager** | ✅ | ✅ | ✅ | ✅ (gestor) |
| **receptionist** | ✅ **integral apenas** (ADR-019 DP11) | ❌ | ❌ | ❌ |
| **barber** | ✅ (apenas da própria comanda / balcão) | ❌ (salvo baixa do próprio atendimento no fluxo atual de checkout) | ✅ (checkout do próprio atendimento, fluxo atual) | ❌ |

**Notas:**
- A coluna "Pagamento parcial" hoje não existe como operação (parcial antecipado é novo na M4 — DP-M4-03 SIM). A matriz acima é **proposta de diretriz** para a M4, coerente com ADR-019.
- A coluna "Baixa" reflete o fluxo atual (`Checkout.tsx` para barber com `isManagerLikeRole` para fechamento administrativo zero; `AccountsReceivable` para baixa administrativa sob `ManagerRoute`, `isManagerLikeRole`).
- A coluna "Estorno" reflete `finance_reverse_transaction` (papéis owner/admin/manager/gerente/superadmin, `20260515210804_finance_reverse_transaction_rpc.sql:58-63`).

**DECISÃO DO PO sobre parciais por receptionist:** DECISÃO DE NEGÓCIO PENDENTE (ADR-019 DP11 limita recepção a antecipado integral).

---

## 9. DP-M4-09 — Quem Confirma Atendimento (matriz)

| Papel | Confirmar atendimento | Corrigir `attended_at` | Exigir motivo |
|---|---|---|---|
| **superadmin** | ✅ | ✅ | opcional |
| **owner / admin** | ✅ | ✅ | obrigatório na correção |
| **manager** | ✅ | ✅ | obrigatório na correção |
| **receptionist** | ❌ (apenas cria agendamento; não executa serviço) | ❌ | — |
| **barber** | ✅ (executor do serviço na própria comanda) | ❌ salvo aprovação P9 | obrigatório se delegado |

**DECISÃO DO PO:** **DECISÃO DE NEGÓCIO PENDENTE** quanto a "receptionist pode confirmar atendimento por delegação?" e "autoridade final" (P10).

**RECOMENDAÇÃO TÉCNICA:** confirmador padrão = executor `barber` registrado em `service_execution_participants`; gestores podem confirmar em nome; toda confirmação/correção com motivo obrigatório (quando aplicável) e `actor_id` gravado.

---

## 10. DP-M4-10 — Estorno (protocolo de reversão financeira)

> Princípios vigentes e já provados: **append-only** (transactions e comanda_payments não sofrerem UPDATE/DELETE de valores; reversão = nova linha), `reversed_at` (M3:18), `reversal_type` (financial_reversals CHECK: `wrong_settlement, full_refund, partial_refund, duplicate_charge, administrative_cancellation, financial_review`), idempotência UNIQUE por tenant (financial_reversals:33-35; comanda_payments:29-31), motivo obrigatório (`finance_reverse_transaction` exige reason_type/reason_note).

### Cenários A–D

| Cenário | Caso | Comportamento técnico proposto | Estado resultante |
|---|---|---|---|
| **A — wrong_settlement** (baixa indevida, valor ≥ comanda) | Devolve comanda para operação | `finance_reverse_transaction` existente já faz: comanda → `open`, `financial_effect=false` (RPC:104-107) | comanda open; transactions com reversão |
| **B — full_refund** (devolução total pós-atendimento) | Cliente cancelou/pediu devolução após consumo | nova reversal `full_refund` + `reversed_at` em `comanda_payments`; sem voltar comanda para open | comanda `paid` com `reversed_at`; histórico preservado |
| **C — partial_refund** (devolução parcial) | Devolução de item/valor | reversal `partial_refund`; `comanda_payments.reversed_at` apenas na medida do valor; saldo financeiro mantém parcela restante | saldo parcial; histórico íntegro |
| **D — estorno de antecipado** (Opção 3/2 antes do atendimento) | Cliente cancela antes do atendimento | estorno da linha `comanda_payments` com `reversed_at`, **sem** preencher attended_at, **sem** gerar comissão | appointment canc./no_show; pagamento revertido; comissão zerada se existir |

**Requisitos adicionais (recomendações técnicas fechadas):**
1. Estorno NUNCA apaga o pagamento original (append-only).
2. Estorno identifica **qual** `comanda_payments` está revertendo (ADR-018 DP10).
3. Estorno de antecipado antes do atendimento NÃO retorna comanda para `open` se a comanda em questão ainda está `blocked` (permanece blocked até evento de desbloqueio — §14) e NÃO inventa `attended_at`.
4. O mesmo `idempotency_key` não pode ser reutilizado para estornar dois pagamentos distintos (padrão já existente: `financial_reversals` valida "chave já utilizada em outra reversão", RPC:74-76).
5. Motivo (`reason_type` + `reason_note`) obrigatório em todos os cenários.

**DECISÃO DO PO:** procedimento aprovado nos princípios; políticas de **reembolso efetivo** (dinheiro, crédito, forma de devolução) permanecem **DECISÃO DE NEGÓCIO PENDENTE**.

---

## 11. Contrato de Datas

| Campo | Significado | Quem grava | Quando | Pode alterar? | Auditoria |
|---|---|---|---|---|---|
| `appointments.created_at` | Criação do agendamento | RPC create_appointment | no registro | não | timestamps de tabelas |
| `appointments.start_time` / `scheduled_at` | Data prevista do atendimento | RPC create/update_appointment | agendamento/reagenda | sim (reagendamento com motivo, ADR-019 DP14) | `cancelled_at`/reagendamento logado |
| `appointments.attended_at` | Atendimento efetivo | RPC confirm_appointment_attendance (M4) | confirmação operacional | só com motivo e papel gestor (P9 pendente) | before/after na trilha; `attended_at_source` |
| `comanda_payments.created_at` / `payment_date` | Momento do pagamento | RPC de pagamento (M4) | pagamento/antecipação/parcial | não (append-only) | `actor_id`, `payment_type`, `idempotency_key` |
| `paid_at` (comandas, projeção) | Marcado como pago | projeção do saldo | quando saldo zera | — | recalculável |
| `settled_at` / `settled_by_user_id` | Liquidação da comanda | `finance_settle_comanda` | quitação | não após estorno (revertido por reversal) | `settled_by_user_id` + reversal |
| `reversed_at` | Quando o pagamento foi estornado | RPC de estorno | estorno | não (uma vez gravado, histórico) | `financial_reversals.*` + idempotência |
| `cancelled_at` / `cancelled_by_user_id` | Cancelamento | `cancelAppointment` | cancelamento/no-show | não | `cancelled_by_user_id` + event store |

**Invariante de datas:** **nenhum campo deste contrato representa outro.** `paid_at ≠ attended_at`; `settled_at` não grava atendimento; `created_at` não é data operacional.

---

## 12. Contrato de Auditoria (PROFISSIONAL vs OPERADOR)

> Distinção obrigatória: **PROFISSIONAL** = quem executou o serviço (staff/participante); **OPERADOR** = quem executou a ação no sistema (auth user).
> Ex.: barber A confirma atendimento do serviço executado por barber B → `actor_id = A` (operador), participante executante `staff_id = B` (profissional).

Campos normativos para toda gravação transacional de operações financeiras/operacionais (padrão já demonstrado em `financial_reversals`/`transactions`/`comanda_payments`):

| Campo | Obrigatório? | Fonte |
|---|---|---|
| `actor_id` (UUID auth.users) | ✅ | session (`auth.uid()`) |
| `actor_role` (papel efetivo) | ✅ | `profiles.role`/`staff.role` resolvido no momento |
| `action` (verbo do domínio) | ✅ | constante da operação |
| `entity` / `entity_id` | ✅ | comanda/appointment/payment/reversal |
| `timestamp` | ✅ | `now()` no servidor (nunca do cliente) |
| `before` / `after` (snapshot) | ✅ para mutações críticas | JSONB na reversão/estorno |
| `reason` | ✅ quando a operação exigir (baixa administrativa, estorno, correção) | campo motivo |
| `correlation_id` / `idempotency_key` | ✅ idempotência; 💡 correlation em eventos | evento/metadata |

**Nota de compatibilidade:** campos que NÃO existem no schema atual → a M4 deve adicioná-los (ou lançar mão de `metadata`/`event_store`), **depois** de aprovado pelo PO; nesta G1.2 apenas registra-se o contrato.

---

## 13. Auto-desbloqueio de Comandas — Definição Conceitual

**Situação atual (não corrigir nesta etapa):** `pages/Comandas.tsx:670-717` desbloqueia comandas `blocked` com `appointment.start_time <= hoje` via UPDATE direto client-side (`update({ status: 'open' })`), sem trilha de auditoria, sem actor, sem RPC.

**Definição conceitual fechada:**

| Aspecto | Decisão/Recomendação |
|---|---|
| **O que é desbloqueio?** | Transição `blocked → open`, liberando a comanda para operação de baixa, disparada por **evento de tempo** (agendamento vencido) e/ou **evento operacional** (atendimento confirmado). |
| **Automático?** | DECISÃO DE NEGÓCIO PENDENTE quanto à auto-confirmação de atendimento; **desbloqueio por tempo pode ser automático**, mas **nunca silencioso** (auditoria + evento). |
| **Server-side ou client-side?** | Recomendação técnica: **server-side**, via RPC programável (job/cron ou chamada transacional), nunca UPDATE direto de frontend. |
| **Operador** | RPC com `actor_id` (system por padrão) ou operador autenticado quando disparado por ação. |
| **Timestamp** | `unlocked_at` (novo, M4) ou derivação por evento `AppointmentStarted`/`blocked_expired` — decidir na M4 após aprovação. |
| **Evitar desbloqueio silencioso** | Publicar evento de domínio (ex.: `ComandaUnlocked`) + linha de auditoria. |

**Escopo:** se o PO julgar que o desbloqueio exige fase própria (RPC + job + eventos), ele entra como **item independente da M4** (escopo separado, aprovado à parte).

---

## 14. Comissão — Formalização da Dependência

> **Regra inalterada (ADR-016 / D8 STOP conditions):** o cálculo de comissão continua no Financial Domain Core compartilhado (browser handler ↔ worker `calculate.ts`). **Nenhuma mudança de regra**.

**Decisões de dependência (fechadas nesta G1.2):**

1. **PAGAMENTO não é suficiente para gerar comissão.** O `payment_type` do pagamento não decide elegibilidade.
2. **ATENDIMENTO CONFIRMADO é pré-condição** para comissão em comandas com agendamento (DP-M4-02 NÃO — antecipado não gera comissão). Para comandas sem agendamento, o atendimento é implícito ao checkout (P8).
3. **Onde fica o gate (sem tocar no Core):** no **emissor do evento** e/ou no **enfileiramento do outbox** (`FinanceSubscriber` mapping de `CheckoutCompleted` → `create_commission_record`). O worker continua consumindo apenas o que já está enfileirado — **o worker NÃO é o gate**.
4. **`receivedValue` atual:** o worker usa `comanda.total` por ausência de colunas `paid_amount` (`calculate.ts:152-153`, "field presence"). Com `comanda_payments` na M4, o contexto do outbox pode continuar passando `receivedValue` explícito — **sem alterar a matemática**, apenas melhorando a fidelidade do input (decisão da M4, não do worker).
5. **Mapeamento de usos do worker (levantado):** `supabase/functions/worker-dispatcher/index.ts:117` chama `calculateCommissionRecordsFromContext`; `get_financial_operation_context` monta contexto mínimo; idempotência `INSERT ... ON CONFLICT` em `exists_commission_record`/`insert_commission_record` (index.ts:124-153). **Nada disso muda.**

**CONSEQUÊNCIA:|** a M4 pode introduzir a pré-condição no caminho do outbox sem tocar no core compartilhado — garantindo `npm run d8:verify` estável.

---

## 15. Matriz Final de Domínio

| Evento | Data | Entidade | Estado operacional | Estado financeiro | Actor | Evento (Event Store) |
|---|---|---|---|---|---|---|
| **Agendamento** | `start_time`/`created_at` | appointment | scheduled/pending | sem efeito | receptionist/barber | `AppointmentCreated` |
| **Pagamento antecipado** | `comanda_payments.created_at` | comanda (+appointment) | blocked | paid parcial/integral (projeção) | receptionist/barber/gestor | `(novo) PaymentRegistered`/triggers |
| **Desbloqueio** | evento de tempo (`start_time` ≤ hoje) ou confirmação | comanda | blocked → open | sem efeito | system/operador | `(novo) ComandaUnlocked` |
| **Atendimento** | `appointments.attended_at` | appointment | completed | sem efeito | barber/gestor | `AppointmentCompleted` |
| **Pagamento posterior** | `comanda_payments.created_at` | comanda | open/paid | saldo zera | barber/caixa/gestor | `TransactionCreated`/PaymentRegistered |
| **Baixa (settlement)** | `settled_at` | comanda | open → paid | liquidado | barber/manager/admin | `CheckoutCompleted` |
| **Estorno** | `reversed_at`/reversal | comanda/payment | paid | revertido | gestor/superadmin | `CheckoutReverted`/PaymentRefunded |
| **Cancelamento** | `cancelled_at` | appointment+comanda(s) | cancelled | intocado até estorno | receptionist/gestor | `AppointmentCancelled` |
| **No-show** | `detect_no_show`/`cancelled_at` | appointment | no_show | sem efeito | system | `AppointmentCancelled` (no_show) |

---

## 16. Invariantes

> Invariantes 1-12 (núcleo) — todas avaliadas e fechadas nesta G1.2, sem necessidade de mudança de schema nesta etapa.

1. **Payment ≠ Attendance.** Um pagamento registrado não cria `attended_at`.
2. **Paid ≠ Completed.** Comanda `paid` (financeira) não implica appointment `completed` (operacional) e vice-versa.
3. **`attended_at` nunca é escrito por settlement.** Só pela RPC de confirmação (M1 COMMENT).
4. **`completed` sem pagamento completo é possível** (Opção 1 — atendido em 31/08, paga em 02/09).
5. **Pagamento (integral/parcial) pode ocorrer antes do atendimento** (Opção 2/3).
6. **Parcial antecipado é agregável** — saldo = `net_total − Σ payments válidos`; sem duplicatas (idempotência).
7. **Comissão nunca nasce apenas de pagamento antecipado** (DP-M4-02 NÃO; gate no outbox).
8. **Toda operação financeira é atribuível a um operador** (`actor_id`, `payment_type`).
9. **Toda confirmação de atendimento é atribuível a um operador** (`actor_id` da RPC).
10. **Estorno não apaga histórico** — append-only + `reversed_at` + `financial_reversals`.
11. **Reagendamento/cancelamento não altera data de pagamento gravada** — datas imutáveis após registro.
12. **`created_at` não é data operacional** — nunca usado como attended_at/paid_at substituto.

**Invariantes adicionais descobertos nesta revisão:**
13. **`payment_type` imutável após registro** (M2:11-13; decisão imutabilidade do enum).
14. **Saldo derivado tem fonte única** (DP-M4-05) — nenhuma segunda fonte competidora.
15. **Desbloqueio nunca é silencioso** (auditoria + evento; §13).
16. **Motivo é obrigatório** para baixa administrativa, estorno e correção de attended_at (ADR-019 DP14).
17. **Checkout recusa comanda `blocked`** (Checkout.tsx:770 — regra vigente preservada).

---

## 17. Riscos e Pontos de Atenção

| # | Risco | Severidade | Mitigação |
|---|---|---|---|
| R1 | `attended_at` inventado (selo de pagamento) reaparece em outra camada | Crítico | RPC única; `attended_at_source`; inv. 1/5/12 |
| R2 | Duas fontes de verdade de pagamento (comanda_payments × transactions) divergirem | Crítico | RPC única gravadora; conciliação read-only; inv. 14 |
| R3 | Comissão gerada antes do atendimento confirmado (antecipado) | Alto | Gate no outbox, não no core; DP-M4-02; AC-M4-14 |
| R4 | Desbloqueio silencioso client-side continua no sistema (atual) | Médio (conhecido, não corrigir na G1.2) | Escopo separado da M4 (§13); AC-M4-15 |
| R5 | Cancelamento/no-show com pagamento antecipado sem diretriz de reembolso | Alto | DECISÃO DE NEGÓCIO PENDENTE; AC-M4-16 |
| R6 | Correção retroativa de `attended_at` sem trilha | Médio | before/after + papel gestor + motivo; P9 |
| R7 | Quebra de regra D8 (comissão) durante a M4 | Crítico | Core compartilhado intocado; `npm run d8:verify` obrigatório; AC-M4-17/18 |
| R8 | Parcial antecipado gerar duplicata de evento/transaction | Alto | Idempotência por `(tenant_id, idempotency_key)`; opção 3 "sem duplicatas" |
| R9 | Alteração de valor/desconto pós-pagamento (ADR-019 DP12) | Crítico | Bloqueio no schema/RPC; AC-M4-19 |

---

## 18. Decisões Pendentes (aguardando PO)

| ID | Decisão | Impacto quando pendente |
|---|---|---|
| D1 | Política de cancelamento/reembolso (DP-M4-06 opção A..E) | Bloqueia auto-reversão; estorno manual continua |
| D2 | Política de no-show (crédito/multa/reembolso) | Bloqueia tratamento financeiro automatizado |
| D3 | Correção retroativa de `attended_at` (P9) | M4 pode bloquear correção pós-confirmação |
| D4 | Autoridade final de confirmação de atendimento (P10) | Matriz DP-M4-09 sem "autoridade em disputa" |
| D5 | Auto-confirmação/auto-desbloqueio (P14, §13) | Desbloqueio fica como item separado da M4 |
| D6 | Parcial antecipado por receptionist (DP-M4-08) | Matriz papéis com restrição provisória (ADR-019 DP11) |
| D7 | Alteração retroativa de datas (reagendamento vs pagamento) | Invariante 11 já cobre; detalhamento na M4 |
| D8 | Forma de reembolso efetivo (dinheiro/crédito) | Estorno financeiro sim; reembolso segue política |

---

## 19. Contrato Técnico da M4 (resumo para implementação — a ser aprovado)

> Este contrato é **proposta** registrada nesta G1.2; implementação ocorre apenas após aprovação do PO (roadmap congelado, D9).

| Item | Escopo proposto |
|---|---|
| RPC de pagamento | `register_comanda_payment(tenant, comanda, tipo, valor, método, motivo, idempotency_key)` — grava `comanda_payments`, atualiza projeção, grava `transactions` (income) no mesmo fluxo; valida `blocked`/`open`/`cancelled` e ADR-019 DP12 |
| RPC de confirmação de atendimento | `confirm_appointment_attendance(tenant, appointment, actor, source, motivo)` — grava `attended_at` (M1) + `attended_at_source`; publica `AppointmentCompleted`; habilita gate de comissão |
| RPC de estorno | estender o padrão existente (`finance_reverse_transaction`) para marcar `comanda_payments.reversed_at` + `financial_reversals` com `reversal_type` por cenário A-D; nunca volta comanda `blocked`→`open` indevidamente |
| Gate de comissão | no `FinanceSubscriber`/emissor: `create_commission_record` somente quando atendimento confirmado (ou sem agendamento); core intocado |
| Auditoria | aplicar contrato §12 em toda RPC nova; `actor_id` obrigatório |
| Desbloqueio | RPC server-side programável (item separado, §13) |
| Conciliação | RPC read-only `reconcile_comanda_payments` (diff 3 fontes) |
| Migrations (previsão M4) | índice `appointments(tenant_id, attended_at)`; `unlocked_at` (se aprovado); CHECKs/constraints de datas; campos de auditoria faltantes — **todas aditivas** |

---

## 20. Critérios de Aceite da M4 (AC-M4-01..20)

> Critérios a validar na M4 — cada M4 phase passará por estes AC antes de encerrar.

| AC | Critério |
|---|---|
| AC-M4-01 | Antecipado pode ser registrado em comanda `blocked` (DP-M4-01) |
| AC-M4-02 | Antecipado NÃO marca appointment como `completed` |
| AC-M4-03 | Antecipado NÃO preenche `attended_at` |
| AC-M4-04 | Antecipado NÃO gera comissão (DP-M4-02) — teste E2E do cenário Opção 2 |
| AC-M4-05 | Atendimento confirmado sem pagamento completo mantém appointment `completed` e comanda com saldo (Opção 1) |
| AC-M4-06 | `attended_at` é gravado apenas pela RPC de confirmação (nunca por settle) — teste RPC negativo |
| AC-M4-07 | Confirmação de atendimento registra `actor_id` (operador) distinto do profissional |
| AC-M4-08 | Registro de pagamento registra `actor_id` + `payment_type` imutável |
| AC-M4-09 | Parciais antecipados (R$30+R$40) acumulam sem duplicata de transaction/evento (Opção 3) |
| AC-M4-10 | Saldo é calculável exclusivamente por `comanda_payments` + `net_total` (fonte única) |
| AC-M4-11 | Estorno preserva linhas originais (append-only) e identifica pagamento reverte |
| AC-M4-12 | Nenhuma RPC financeira aceita `idempotency_key` duplicada para operações distintas |
| AC-M4-13 | RLS v2 protege todas as novas tabelas; superadmin bypass + tenant isolation |
| AC-M4-14 | Multi-tenant: operação em tenant A não afeta tenant B (teste cross-tenant) |
| AC-M4-15 | Checkout ainda funciona para comandas `open` sem agendamento (sem regressão) |
| AC-M4-16 | Outbox processa `create_commission_record` após atendimento confirmado (fluxo atômico) |
| AC-M4-17 | `npm run d8:verify` passa sem divergência (core compartilhado intocado) |
| AC-M4-18 | Worker continua processando sem mudança de regra (equivalência mantida) |
| AC-M4-19 | Alteração de valor/desconto após pagamento é bloqueada (ADR-019 DP12) |
| AC-M4-20 | Toda operação crítica grava trilha de auditoria com `actor_id`, `timestamp`, `reason` e correlação |

---

## 21. Validação da Etapa (arquivos alterados)

| Item | Status |
|---|---|
| Arquivo criado | `docs/audit/G1_2_DECISOES_DOMINIO_M4.md` (este) — ÚNICO |
| Migrations | NENHUMA criada/altera |
| RPCs | NENHUM criado/altera |
| RLS / tabelas | NENHUM criado/altera |
| Frontend / application / domain | NENHUM alterado |
| Dados (produção) | NENHUM alterado |
| Deploy / merge / commit funcional | NÃO executado |
| `git status --short` + `git diff --check` | verificado — limpo, apenas este arquivo novo |
| Regra de comissão (ADR-016) | intocada |

---

## 22. Aprovação e Emissão

- **Status desta etapa:** ✅ G1.2 CONCLUÍDA — **BLOQUEADA** (aguarda decisões do PO em D1..D8, §18).
- Implementação da M4 **não iniciará** sem aprovação explícita do PO sobre as decisões de negócio pendentes e o contrato técnico (§19).
- Critérios de aceite (AC-M4-01..20) serão o gate da implementação futura.

---
---

# G1.3 — DELIBERAÇÃO FORMAL DO PO

> **Fase:** G1.3 · **Status:** ✅ CONCLUÍDA — **BLOQUEADA** (deliberação registrada; implementação da M4 aguarda nova autorização explícita do PO)
> **Data:** 29/08/2026 · **Responsável:** Augusto (PO) — deliberação formal · OpenCode — registro técnico
> **Regra da etapa:** DELIBERAÇÃO E DOCUMENTAÇÃO. NENHUMA implementação, NENHUMA migration/RPC/RLS/tabela/frontend/application/comissão/worker/Event Store/Outbox alterado. NENHUM dado alterado. Único documento de entrega: este.

---

## 1. Decisões Aprovadas (D0–D5, D8 técnica, D9–D13)

| ID | Decisão formal do PO | Termos aprovados |
|---|---|---|
| **D0** | **Separação dos ciclos (operacional × financeiro)** | Ciclo operacional (agendamento → atendimento → confirmação) e ciclo financeiro (pagamento → baixa → estorno) são **independentes**. Nenhum evento financeiro é prova de evento operacional, e vice-versa. |
| **D1** | **Pagamento antecipado em comanda `blocked`** | **PERMITIDO** — clientes podem pagar antes da data do agendamento. Antecipado: (a) NÃO preenche `attended_at`; (b) NÃO marca appointment como `completed`; (c) NÃO gera comissão. |
| **D2** | **Pagamento parcial (antecipado e/ou posterior)** | **PERMITIDO e FORMAL** — parciais acumulam sobre a mesma comanda (ex.: R$30 em 29/08 + R$40 em 02/09 = R$70; saldo R$0). **Sem duplicata** de transaction/evento (idempotência por `idempotency_key`). |
| **D3** | **`attended_at` somente por confirmação operacional** | O campo é gravado **exclusivamente** pela RPC de confirmação de atendimento. NUNCA por: `finance_settle_comanda`, pagamento, desbloqueio ou passagem da data. A M4 deve **corrigir `finance_settle_comanda`** (hoje marca appointment `completed`, migration `20260514000001:105-108`). |
| **D4** | **Comissão: atendimento confirmado é pré-condição** | Pagamento **não basta** para gerar comissão. Elegibilidade em comandas com agendamento: **atendimento confirmado** (`attended_at`). Comandas **sem agendamento**: atendimento implícito ao checkout (regra atual preservada). **Gate no emissor do evento/outbox** (`FinanceSubscriber`), **nunca no worker** — core ADR-016 e `npm run d8:verify` intocados. |
| **D5** | **Operador auditável (contrato de auditoria)** | `actor_id`, `actor_role`, `action`, `entity`/`entity_id`, `timestamp` (**server-side**, inalterável), `before`/`after`, `reason` (obrigatório onde exigido), `correlation_id`. DISTINÇÃO OBRIGATÓRIA: **PROFISSIONAL** (executor) ≠ **OPERADOR** (quem operou o sistema). |
| **D8 (técnica)** | **Estorno: técnica aprovada (append-only)** | Aprovação do **protocolo técnico** (cenários A–D da §10 da G1.2). NUNCA apaga o pagamento original; identifica o `comanda_payments` revertido; `reversed_at` + `financial_reversals.reversal_type`; idempotência e motivo obrigatório. **Reembolso efetivo → P8.** |
| **D9** | **Papéis reais e permissões** | Usar nomes reais: `superadmin`, `owner`, `admin`, `manager`, `receptionist`, `barber`. **Recepção**: registra antecipado **integral**; parcial pela recepção **condicionado (P7)**. **Barbeiro**: NÃO ganha autoridade financeira automática por ser executor (a coluna "Estorno" da matriz §8 da G1.2 permanece restrita a gestão/superadmin). **BAIXA ≠ REGISTRAR PAGAMENTO ≠ ESTORNO** — permissões não devem ser colapsadas. |
| **D10** | **Quem confirma atendimento** | **Executor** (barber/profissional registrado nos participantes) e **gestão** (owner/admin/manager) confirmam; **recepção NÃO confirma execução**. Correção retroativa de `attended_at`: **política pendente (P4)** — recomendação registrada: apenas gestão/owner/admin/superadmin + motivo obrigatório + `before`/`after` + operador. **AUTO-CONFIRMAÇÃO: NÃO** (nem pagamento, nem passagem do horário, nem desbloqueio). |
| **D11** | **Modelo relacional formal (fonte de verdade)** | `comanda_payments` = fonte canônica **por pagamento**; `transactions` = fonte **contábil**; `commission_records` = fonte **de comissão**. **Saldo = `net_total` − Σ pagamentos válidos** (derivado, recalculável). Nenhuma `metadata` é fonte de verdade. Idempotência + conciliação + ausência de duplicidade. **Uma única operação gravadora** (RPC da M4) — sem caminho paralelo. RPC read-only de reconciliação pode ser **especificada**, NÃO criada nesta etapa. |
| **D12** | **Contrato de datas (imutabilidade)** | `created_at`, `start_time`/`scheduled_at`, `attended_at`, `payment_date`, `paid_at` (projeção), `settled_at`, `reversed_at`, `cancelled_at` — conforme §11 da G1.2. **REGRA ABSOLUTA DE NÃO-SUBSTITUIÇÃO**: nenhum campo representa outro (`created_at ≠ attended_at ≠ paid_at ≠ settled_at`). **Reagendamento NÃO altera data histórica do pagamento.** |
| **D13** | **Desbloqueio de comandas** | **FORA desta etapa** (escopo técnico separado). **DESBLOQUEIO ≠ ATENDIMENTO ≠ PAGAMENTO ≠ BAIXA.** NUNCA silencioso (quem/quando/motivo/comanda/estado anterior/posterior + evento). O desbloqueio client-side atual (`pages/Comandas.tsx:670-717`) permanece como está até fase própria; não é corrigido, não é usado como fonte de atendimento. |

---

## 2. Decisões Parcialmente Aprovadas (D6, D7)

| ID | Decisão | Aprovado (técnico) | Pendente (comercial) |
|---|---|---|---|
| **D6** | **Cancelamento** | Regras técnicas aprovadas: pagamento/transaction registrados **NÃO são apagados**; cancelamento **NÃO cria** `attended_at`; cancelamento **NÃO gera** comissão; comanda `cancelled` **NÃO aceita novo pagamento**; estorno é sempre **explícito** (nunca automático no cancelamento). | **P1 — política de cancelamento/reembolso** (quem tem direito, prazos, forma). |
| **D7** | **No-show** | Regras técnicas aprovadas: no-show **NÃO cria** `attended_at`; no-show **NÃO gera** comissão; **sem crédito automático**. | **P2/P3 — política de no-show** (crédito, multa, reembolso). |

---

## 3. Decisões Pendentes (P1–P8)

| ID | Pendência | Status | Impacto na M4 | Recomendação registrada |
|---|---|---|---|---|
| **P1** | Política de cancelamento/reembolso (D6 comercial) | ABERTA | Bloqueia auto-reversão; estorno manual permanece | Opção A da G1.2 + estorno explícito |
| **P2** | Política de no-show (crédito/multa/reembolso) | ABERTA | Bloqueia tratamento financeiro automatizado de no-show | Sem crédito automático até deliberação |
| **P3** | Política de crédito (uso de créditos em no-show/estorno) | ABERTA | Bloqueia integração crédito × estorno | Não implementar na M4 |
| **P4** | Correção retroativa de `attended_at` (quem/quando/motivo) | ABERTA | M4 pode bloquear correção pós-confirmação | Gestão/owner/admin/superadmin + motivo + before/after |
| **P5** | Autoridade final de confirmação (disputa executor × gestão) | ABERTA | Define precedência na matriz §9 da G1.2 | Gestor prevalece com motivo registrado |
| **P6** | Auto-desbloqueio/auto-confirmação operacional (D13) | ABERTA | Desbloqueio fica como item separado da M4 | RPC server-side, nunca silencioso |
| **P7** | Parcial antecipado por `receptionist` (D9) | ABERTA | Restrição provisória: recepção = antecipado **integral** | Liberar parcial só com política comercial |
| **P8** | Forma de reembolso efetivo (dinheiro/crédito/TED) | ABERTA | Estorno financeiro SIM; reembolso segue política | Próxima deliberação dedicada |

---

## 4. Cenário Oficial do PO (teste conceitual de aceitação)

| Cenário | Linha do tempo | Estado financeiro | Estado operacional | Comissão |
|---|---|---|---|---|
| **A — sem antecipado** | agendado 31/08 · `created_at` 29/08 · atendimento 31/08 (`attended_at`) · pagamento 02/09 (`payment_date`) · `settled_at` 02/09 | pago em 02/09 | appointment `completed` | **elegível** (atendimento confirmado) |
| **B — antecipado integral** | pagamento integral 29/08 sobre comanda `blocked` · atendimento ainda em 31/08 | comanda paga (29/08) | appointment **NÃO `completed`** até 31/08 · `attended_at` **NULL** | **NÃO elegível pelo pagamento**; torna-se elegível **somente após** confirmação do atendimento (31/08) |
| **C — parcial (antecipado + posterior)** | R$30 em 29/08 + R$40 em 02/09 · total R$70 · saldo R$0 | quitada em 02/09 | `completed` após atendimento | elegível após atendimento confirmado; **nenhuma comissão pelo antecipado** |

---

## 5. Invariantes Obrigatórios (I01–I25)

> Consolidação dos invariantes da G1.2 (§16) com os contratos aprovados na G1.3. Todos são **invariantes de domínio validáveis em testes da M4**.

| ID | Invariante |
|---|---|
| I01 | **Payment ≠ Attendance.** Um pagamento registrado não cria `attended_at`. |
| I02 | **Paid ≠ Completed.** Comanda `paid` não implica appointment `completed` (e vice-versa). |
| I03 | **`attended_at` nunca é escrito por settlement** — apenas pela RPC de confirmação (M1 COMMENT). |
| I04 | **`completed` sem pagamento completo é possível** (atendido antes de pagar). |
| I05 | **Pagamento pode ocorrer antes do atendimento** (antecipado em `blocked` — D1). |
| I06 | **Parcial antecipado é agregável** — saldo = `net_total − Σ payments válidos`; sem duplicatas. |
| I07 | **Comissão nunca nasce apenas de pagamento antecipado** (D4; gate no outbox). |
| I08 | **Toda operação financeira é atribuível a um operador** (`actor_id`, `payment_type`). |
| I09 | **Toda confirmação de atendimento é atribuível a um operador** (`actor_id` da RPC). |
| I10 | **Estorno não apaga histórico** — append-only + `reversed_at` + `financial_reversals`. |
| I11 | **Reagendamento/cancelamento não altera data de pagamento gravada** (D12). |
| I12 | **`created_at` não é data operacional** — nunca substitui `attended_at`/`paid_at`. |
| I13 | **`payment_type` imutável após registro** (M2). |
| I14 | **Saldo derivado tem fonte única** (`comanda_payments` + `net_total`; D11). |
| I15 | **Desbloqueio nunca é silencioso** (auditoria + evento; D13). |
| I16 | **Motivo é obrigatório** para baixa administrativa, estorno e correção de `attended_at`. |
| I17 | **Checkout recusa comanda `blocked`** (Checkout.tsx:770 — regra preservada). |
| I18 | **Estorno de antecipado não converte comanda automaticamente para `open`** (D8/cenário D). |
| I19 | **Estorno de antecipado não preenche `attended_at`** (D3/D8/cenário D). |
| I20 | **Estorno de antecipado não gera comissão** (D4/D8/cenário D). |
| I21 | **Comanda `cancelled` não aceita novo pagamento** (D6 técnico). |
| I22 | **Recepção não confirma execução de serviço** (D10). |
| I23 | **Auto-confirmação é proibida** — nem pagamento, nem passagem do horário, nem desbloqueio confirmam atendimento (D10/D13). |
| I24 | **Uma única operação gravadora por caminho financeiro** — sem segunda fonte concorrente (D11). |
| I25 | **Bloqueado/parcial/quitado são estados derivados** — nenhum CHECK/ENUM de status é alterado para representar combinações financeiras (contrato de estados). |

---

## 6. Contrato Técnico da Futura M4 (20 itens)

> Contrato **aprovado em deliberação** para a implementação futura. A M4 só inicia após nova autorização explícita do PO.

| # | Item do contrato M4 |
|---|---|
| 1 | **Corrigir `finance_settle_comanda`**: nunca marcar appointment `completed` pelo pagamento (migration `20260514000001:105-108`); nunca criar `attended_at` (D3). |
| 2 | **RPC `register_comanda_payment`**: grava `comanda_payments` + projeção + `transactions` (income) no mesmo fluxo; valida estados `blocked`/`open`/`cancelled`; aplica matriz de papéis D9 (recepção: antecipado integral; P7 pendente define parcial). |
| 3 | **RPC `confirm_appointment_attendance`**: grava `attended_at` (M1) + `attended_at_source`; publica `AppointmentCompleted`; habilita gate de comissão (D3/D10). |
| 4 | **Estender `finance_reverse_transaction`** para marcar `comanda_payments.reversed_at` + `financial_reversals.reversal_type` por cenário A–D; nunca volta comanda `blocked`→`open` indevidamente (D8). |
| 5 | **Gate de comissão no emissor/outbox** (`FinanceSubscriber`): `create_commission_record` somente quando atendimento confirmado (ou comanda sem agendamento); **core compartilhado intocado** (D4). |
| 6 | **Auditoria**: aplicar contrato da §7 (abaixo) em toda RPC nova; `actor_id` obrigatório; `timestamp` server-side (D5). |
| 7 | **Saldo relacional**: projeção exclusiva por `comanda_payments` (`net_total − Σ válidos`); nenhum frontend soma `transactions` ad-hoc (D11). |
| 8 | **Idempotência preservada**: UNIQUE `(tenant_id, idempotency_key)` em toda gravação nova — padrão `financial_reversals`/M3 (D11). |
| 9 | **Advisory lock + `FOR UPDATE`** nas RPCs críticas (padrão já usado; recomendação de hardening). |
| 10 | **SECURITY DEFINER + tenant isolation + RLS v2**: superadmin bypass + isolamento por `current_tenant_id_from_auth_uid()` em toda tabela/reversão nova. |
| 11 | **Outbox intacto (D8 worker)**: nenhuma mudança em `worker-dispatcher/{calculate,index}.ts`; `npm run d8:verify` obrigatório (STOP em divergência). |
| 12 | **Conciliação**: RPC **read-only** `reconcile_comanda_payments` (diff `comanda_payments` × `transactions` × `commission_records`) — somente se aprovada na M4 (D11). |
| 13 | **Datas**: migrations **aditivas** — índice `appointments(tenant_id, attended_at)`, `unlocked_at` (se aprovado), CHECKs de datas, campos de auditoria faltantes (D12). |
| 14 | **Eventos de domínio**: publicar `PaymentRegistered` (novo) e `AppointmentCompleted` na confirmação; `ComandaUnlocked` no escopo separado do desbloqueio (D13). |
| 15 | **Cancelamento**: bloqueio de novos `comanda_payments` para comandas `cancelled` — conforme D6 técnico; estorno sempre explícito. |
| 16 | **No-show**: nenhum efeito financeiro automático — conforme D7 técnico (P2/P3 abertas). |
| 17 | **Checkout sem regressão**: comandas `open` sem agendamento seguem fluxo atual (AC-M4-15). |
| 18 | **Alteração pós-registro bloqueada**: valores/desconto somente antes da baixa (ADR-019 DP12, AC-M4-19). |
| 19 | **Documentação**: ADR novo quando a M4 iniciar (contrato técnico formal); auditoria documental/arquitetural/nomenclatura/consistência antes de implementar (AGENTS.md). |
| 20 | **Gate de entrega**: cada fase da M4 passa pelos **AC-M4-01..25** (§9) antes de encerrar. |

---

## 7. Contratos Normativos (auditoria · datas · financeiro · atendimento · comissão · estados)

### 7.1 Contrato de Auditoria (D5 — PROFISSIONAL vs OPERADOR)

| Campo | Obrigatório? | Fonte |
|---|---|---|
| `actor_id` (UUID auth.users) | ✅ | `auth.uid()` |
| `actor_role` (papel efetivo) | ✅ | `profiles.role`/`staff.role` resolvido no momento |
| `action` (verbo do domínio) | ✅ | constante da operação |
| `entity` / `entity_id` | ✅ | comanda/appointment/payment/reversal |
| `timestamp` | ✅ | `now()` **no servidor** (nunca do cliente) |
| `before` / `after` (snapshot) | ✅ para mutações críticas | JSONB na reversão/estorno/correção |
| `reason` | ✅ (baixa administrativa, estorno, correção, reagendamento) | campo motivo |
| `correlation_id` / `idempotency_key` | ✅ idempotência · 💡 correlação em eventos | evento/metadata |

**Regra:** PROFISSIONAL = quem executou o serviço (`staff_id`/participante). OPERADOR = quem executou a ação (`actor_id`). Ex.: barber A confirma serviço executado por barber B → `actor_id = A`, `staff_id = B`.

### 7.2 Contrato de Datas (D12 — REGRA ABSOLUTA DE NÃO-SUBSTITUIÇÃO)

`created_at` ≠ `attended_at` ≠ `paid_at` ≠ `settled_at` ≠ `payment_date`. Nenhum campo representa outro. Reagendamento não altera data histórica do pagamento. `scheduled_at ≠ paid_at ≠ attended_at` (DP15).

### 7.3 Contrato Financeiro (D11 — fonte de verdade)

| Aspecto | Regra |
|---|---|
| Fonte canônica por pagamento | `comanda_payments` (cada parcela/antecipação/baixa, `payment_type`, `amount`, `actor_id`, `reversed_at`, `idempotency_key`) |
| Fonte contábil | `transactions` (income/expense; DRE, cash closing, reversals) |
| Fonte de comissão | `commission_records` |
| Saldo | `net_total − Σ comanda_payments válidos` (projeção recalculável) |
| Não-substituição | `metadata` **nunca** é fonte de verdade |
| Gravação | **uma única operação gravadora** (RPC da M4) + idempotência + conciliação |

### 7.4 Contrato de Atendimento (D3/D10)

- Atendimento = **ação/evento operacional independente** — jamais `pagamento → completed` (DP8).
- Confirmação por: **executor** (barber/profissional) e **gestão** (owner/admin/manager).
- Recepção: **não confirma** execução.
- Correção retroativa: **P4 pendente** (recomendação: gestão/owner/admin/superadmin + motivo + `before`/`after` + operador).
- **Auto-confirmação: NÃO** (pagamento, passagem do horário e desbloqueio NÃO confirmam).

### 7.5 Contrato de Comissão (D4 — cálculo inalterado, gate no outbox)

- **Cálculo:** inalterado (Financial Domain Core compartilhado; ADR-016; worker nunca é o gate).
- **Pré-condição (M4):** atendimento confirmado para comandas com agendamento; sem agendamento → regra atual preservada (atendimento implícito ao checkout, P8).
- **Gate:** emissor do evento / enfileiramento do outbox (`FinanceSubscriber` → `create_commission_record`).
- **Demonstração (teste conceitual oficial):**

| Demo | Situação | Comissão |
|---|---|---|
| 1 | Comanda `blocked` + antecipado integral + sem confirmação | **NÃO** gerada |
| 2 | Comanda `blocked` + antecipado + atendimento confirmado (31/08) | gerada **após confirmação** |
| 3 | Comanda `open` sem agendamento + baixa normal (checkout) | gerada (regra atual) |
| 4 | Comanda com agendamento + `attended_at` + pagamento posterior | gerada |
| 5 | Estorno de antecipado (cenário D) | **NUNCA** gerada; comissão existente é revertida |
| 6 | Cancelamento/no-show com antecipado | **NUNCA** gerada (D6/D7) |

### 7.6 Contrato de Estados (I25)

- **Estado operacional** (`appointments.status`, `comandas.status`) × **estado financeiro derivado** (saldo/`paid_at`/projeção).
- Combinações semanticamente válidas (sem alterar CHECK/ENUM): `blocked + partially_paid` · `blocked + paid` (D1) · `completed + paid` · `cancelled + paid` (aguarda estorno) · `no_show + paid` · `open + balance`.
- **NÃO alterar** CHECKs/ENUMs: `comandas` (`blocked, open, paid, cancelled` — `20260425000000:5`), `appointments` (`pending, confirmed, in_progress, completed, cancelled, no_show` — `20260421000000:8`), `transactions`, `payment_type` (M2).
- Estados financeiros derivados **nunca** são gravados como status da comanda.

---

## 8. Limites da M4 (FORA DE ESCOPO — 14 itens)

> Nenhum item abaixo pode entrar na M4 sem deliberação própria do PO.

1. Política de cancelamento/reembolso (P1)
2. Política de no-show — crédito/multa/reembolso (P2/P3)
3. Correção retroativa de `attended_at` (P4)
4. Autoridade final de confirmação (P5)
5. Desbloqueio automático/auto-desbloqueio (P6/D13 — escopo técnico separado)
6. Parcial antecipado por recepção (P7)
7. Reembolso efetivo (dinheiro/crédito/TED) (P8)
8. Backfill de `attended_at` — derivação controlada+flag é decisão de auditoria própria (DP15)
9. Mudança de cálculo de comissão ou alteração no core ADR-016
10. Migração destrutiva ou alteração de CHECKs/ENUMs de status existentes
11. Redesign de Contas a Receber/Pagar
12. Reestruturação de Event Store/Outbox/Worker
13. Extensão de permissões além da matriz §8 da G1.2
14. Qualquer alteração em dados históricos de produção

---

## 9. Critérios de Aceite da M4 (AC-M4-01..25)

> AC-M4-01..20 foram definidos na G1.2 (§20); a G1.3 confirma e acrescenta AC-M4-21..25. **Gate de toda fase da M4.**

| AC | Critério |
|---|---|
| AC-M4-01 | Antecipado pode ser registrado em comanda `blocked` (D1) |
| AC-M4-02 | Antecipado NÃO marca appointment como `completed` (D1) |
| AC-M4-03 | Antecipado NÃO preenche `attended_at` (D1/D3) |
| AC-M4-04 | Antecipado NÃO gera comissão (D4) — teste E2E do cenário Opção 2 |
| AC-M4-05 | Atendimento confirmado sem pagamento completo mantém appointment `completed` e comanda com saldo |
| AC-M4-06 | `attended_at` é gravado apenas pela RPC de confirmação (nunca por settle) — teste RPC negativo |
| AC-M4-07 | Confirmação de atendimento registra `actor_id` (operador) distinto do profissional |
| AC-M4-08 | Registro de pagamento registra `actor_id` + `payment_type` imutável |
| AC-M4-09 | Parciais antecipados (R$30+R$40) acumulam sem duplicata de transaction/evento (D2) |
| AC-M4-10 | Saldo é calculável exclusivamente por `comanda_payments` + `net_total` (D11) |
| AC-M4-11 | Estorno preserva linhas originais (append-only) e identifica o pagamento revertido (D8) |
| AC-M4-12 | Nenhuma RPC financeira aceita `idempotency_key` duplicada para operações distintas |
| AC-M4-13 | RLS v2 protege todas as novas tabelas; superadmin bypass + tenant isolation |
| AC-M4-14 | Multi-tenant: operação em tenant A não afeta tenant B (teste cross-tenant) |
| AC-M4-15 | Checkout ainda funciona para comandas `open` sem agendamento (sem regressão) |
| AC-M4-16 | Outbox processa `create_commission_record` após atendimento confirmado (fluxo atômico) |
| AC-M4-17 | `npm run d8:verify` passa sem divergência (core compartilhado intocado) |
| AC-M4-18 | Worker continua processando sem mudança de regra (equivalência mantida) |
| AC-M4-19 | Alteração de valor/desconto após pagamento é bloqueada (ADR-019 DP12) |
| AC-M4-20 | Toda operação crítica grava trilha de auditoria com `actor_id`, `timestamp`, `reason` e correlação |
| AC-M4-21 | Contrato de datas: nenhum campo representa outro — regra absoluta de não-substituição validada em teste de integração (D12) |
| AC-M4-22 | `blocked + paid` coexiste sem alteração de CHECK/ENUM de status (D1/I25) |
| AC-M4-23 | Estorno cenário D: não preenche `attended_at`, não gera comissão, não converte comanda automaticamente para `open` (D8) |
| AC-M4-24 | Nenhum item dos Limites da M4 (§8) foi implementado nesta fase |
| AC-M4-25 | P1–P8 permanecem registradas com status/impacto/recomendação; nenhuma vira comportamento sem deliberação |

---

## 10. Validação da Etapa (G1.3)

| Item | Status |
|---|---|
| Arquivo alterado | `docs/audit/G1_2_DECISOES_DOMINIO_M4.md` (este) — ÚNICO |
| Migrations | NENHUMA criada/alterada |
| RPCs | NENHUM criado/alterado |
| RLS / tabelas | NENHUM criado/alterado |
| Frontend / application / domain / worker | NENHUM alterado |
| Comissão (regra/core ADR-016) | intocada |
| Event Store / Outbox | intocados |
| Dados (produção) | NENHUM alterado |
| Deploy / merge / commit funcional | NÃO executado |
| `git status --short` + `git diff --check` | verificado — limpo, apenas este arquivo novo |
| Divergências código × deliberação | documentadas na §1 (D3: `finance_settle_comanda` corrigir na M4) e §8 (desbloqueio client-side mantido) — nenhuma corrigida |

---

## 11. Aprovação e Emissão

- **Status desta etapa:** ✅ G1.3 CONCLUÍDA — **BLOQUEADA**.
- A deliberação formal do PO está registrada neste documento (decisões D0–D13, pendências P1–P8, invariantes I01–I25, contratos normativos, limites e AC-M4-01..25).
- **Implementação da M4 NÃO iniciará** sem **nova autorização explícita do PO** (roadmap congelado, AGENTS.md).
- Próxima etapa: M4 — somente após deliberação das pendências P1–P8 e autorização formal.