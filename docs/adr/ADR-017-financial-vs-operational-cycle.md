# ADR-017: Ciclo Operacional × Ciclo Financeiro — Pagamento Antecipado e Atendimento Independente

**Status:** Accepted (2026-08-29)
**Date:** 2026-08-29
**Deciders:** PO (Augusto) + OpenCode
**G0:** ETAPA 2.1 — Decisão de Domínio encerrada em 29/08/2026 (15 DPs respondidas)
**References:** `PLANO_EVOLUCAO_FINANCEIRA_ATENDIMENTO_AUDITORIA.md` (seções 5-13, 24-25, 37); `AUDITORIA_FLUXO_FINANCEIRO_BAIXA.md` (F2/F3/F6/F9); migrations `20260514000001`, `20260506214059`, `20260531161849`

---

## Context

A comanda (`comandas`) usa um **status único** para o ciclo de vida completo: `blocked`, `open`, `paid`, `cancelled`. Pagamento e atendimento estão acoplados na `finance_settle_comanda`:

- `finance_settle_comanda` (migration `20260514000001:90`) aceita status `open` **OU `blocked`**, porém marca o appointment como `completed` **no ato do pagamento** (linhas 105-108).
- Pagamento antecipado hoje, na prática: `pagar → appointment/comanda = completed` — ou seja, **pagar antecipado falsifica o atendimento realizado**.
- `finance_zero_close_comanda` (`20260531161849:170-171`) aceita **somente `open`**.
- Uma comanda criada com data futura nasce `blocked` (`20260506214059:161-162`).
- A permissão atual não distingue "quando o atendimento ocorreu" de "quando o dinheiro foi recebido".

O PO formalizou como requisito de negócio (R0): **pagamento antecipado** — a comanda vinculada a agendamento futuro pode receber pagamento **antes** do atendimento (ex.: registrado 29/08, previsto 31/08, pago 29/08, atendido 31/08). `paid_at ≠ attended_at`.

## Problem

1. O status único impede que uma comanda esteja financeiramente paga com o atendimento ainda bloqueado — sem corromper a semântica operacional.
2. A RPC atual aproveita essa brecha e marca `completed` no ato do pagamento → dados de relatório, comissão e auditoria divergem da realidade.
3. Não existe representação explícita de "quando o atendimento efetivamente ocorreu" (`attended_at`).

## Decision

**O ciclo operacional e o ciclo financeiro são domínios separados e conceitualmente desacoplados.**

### D-1. Status da comanda = ciclo operacional

`blocked | open | paid | cancelled` deixa de significar estado financeiro. Representa **atendimento** (agendado, em aberto, concluído, cancelado). A comanda permanece `blocked` (ou `open`) enquanto o atendimento não for realizado, **mesmo que esteja financeiramente quitada**.

### D-2. Financeiro é derivado — não um novo status

O comportamento financeiro é **derivado** dos dados, sem novo CHECK constraint e sem quebrar o modelo atual:

```text
net_total = total − discount
paid      = Σ pagamentos recebidos (transactions income / comanda_payments)
balance   = net_total − paid   (≥ 0)
```

- `balance = 0` → "financeiramente paga" (derivado), independe do status operacional.
- `balance > 0` → "pendente" (aparece em Contas a Receber, DP5).

### D-3. Atendimento é uma ação/evento operacional independente (DP8)

- **`pagamento → completed` é proibido** no domínio.
- O evento oficial de "atendimento realizado" é um **evento operacional autônomo** — mecanismo (a) `attended_at` preenchido por operador ou (b) transição de status tocada pelo operador — formalizado na F2 (ver ADR-020).
- A `finance_settle_comanda` deixa de marcar `completed` no pagamento (a corrigir na F3/F5, mediante plano de RPCs).

### D-4. Comissão elegível após atendimento (DP1/DP9)

- Pagamento antecipado **não gera comissão** no ato do recebimento.
- A elegibilidade de comissão passa a ser o **evento de atendimento** (DP8) — Opção B aprovada.
- O contrato FIX-001, `commission_records` e o worker D8 **permanecem inalterados** (a sobreposição atual de `blocked` na base de comissão — `application/commission.ts:242` — é corrigida como ajuste de elegibilidade na F4, não como novo mecanismo).

### D-5. "Dar baixa" = quitação financeira (DP6)

- "Registrar pagamento" ≠ "encerrar recebível" ≠ "encerrar ciclo operacional".
- Baixa registra o recebimento e move `balance → 0`; o ciclo operacional só encerra com o **evento de atendimento**.

### D-6. Contas a Receber segue o saldo (DP5)

- Antecipado integral com saldo 0 → exibido como "pago (antecipado)".
- Saldo > 0 → pendência normal, independente do status operacional da comanda.

## Alternatives Considered

### Alternative 1: Novo status `paid_advance` no enum existente
**Rejected.** Exigiria novo CHECK em `comandas` (compatibilidade quebrada), duplicaria derivação por status e continuaria acoplando os dois ciclos.

### Alternative 2: Pagamento antecipado via `finance_settle_comanda` atual (aproveitar `blocked` aceito)
**Rejected.** É exatamente o comportamento que corrompe o domínio: marca `completed` sem atendimento. Serve apenas como evidência do problema (estado-ato no §Problem).

### Alternative 3: Manter acoplado, documentar o "custo de antecipação"
**Rejected pelo PO (R0).** Pagamento antecipado é requisito formal de negócio; não pode ser negado nem exigir que o atendimento seja marcado como concluído.

## Consequences

- **Positive:** o modelo responde corretamente "quando aconteceu cada coisa" (`scheduled_at ≠ paid_at ≠ attended_at`).
- **Positive:** suporta cenários A/B/C/D sem breaking change no status da comanda.
- **Positive:** comissão nunca é provisão sobre cancelamento/no-show/reagendamento (DP1).
- **Positive:** relatórios e Contas a Receber passam a refletir a realidade.
- **Negative:** exige corrigir a semântica da `finance_settle_comanda` (F3/F5) com aprovação de migration/RPC.
- **Negative:** a transição operacional requer evento/coluna nova (`attended_at` — ver ADR-020).
- **Mitigation:** ADR-017/018/020 em conjunto; plano de RPCs e migrations revisado no G1.

## References

- `docs/audit/PLANO_EVOLUCAO_FINANCEIRA_ATENDIMENTO_AUDITORIA.md` — decisões 15 DPs (G0)
- `docs/audit/AUDITORIA_FLUXO_FINANCEIRO_BAIXA.md` — achados F2/F3/F6/F9
- Migrations: `20260514000001` (settle), `20260506214059` (criação blocked), `20260531161849` (zero-close)
- `src/lib/finance/settlement.ts`, `src/lib/finance/zeroClose.ts`, `application/commission.ts`