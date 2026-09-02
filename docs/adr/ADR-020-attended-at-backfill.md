# ADR-020: Estratégia de `attended_at` — Atendimento Realizado e Política de Backfill

**Status:** Accepted (2026-08-29)
**Date:** 2026-08-29
**Deciders:** PO (Augusto) + OpenCode
**G0:** ETAPA 2.1 — DP8 (evento operacional independente), DP15 (não inventar attended_at)
**References:** Plano seções 7-8, 29, 37.1; ADR-017 (ciclo operacional × financeiro); ADR-019 (autorização)

---

## Context

"Quando o atendimento efetivamente ocorreu?" não tem resposta no banco hoje. O que existe:

- `appointments.start_time` → quando estava **agendado** (`scheduled_at`).
- `comandas.paid_at` → quando houve **pagamento** (hoje acoplado ao `completed` via settle).
- `appointments.status='completed'` → preenchido pela `finance_settle_comanda` no ato do pagamento — **não é prova de atendimento**.

Decisões do G0:

- **DP8:** atendimento é **ação/evento operacional independente** — jamais `pagamento → completed`. Direção do PO: formalizar mecanismo `attended_at` (opção a) ou transições de status (opção b).
- **DP15 (com cuidado):** **não inventar `attended_at`**. NULL sem evidência confiável; **derivação controlada e explicitamente marcada** somente com prova de que o atendimento ocorreu. **Pagamento antecipado NÃO é prova de atendimento.** `scheduled_at ≠ paid_at ≠ attended_at`.

## Problem

1. Não existe coluna/evento canônico de atendimento realizado.
2. Histórico (pré-evolução) não tem evidência confiável de atendimento — qualquer backfill automático inventaria dados.
3. Comissão (ADR-017 D-4) e relatórios dependem dessa data como elegibilidade.

## Decision

### D-1. Nova coluna `attended_at` (timestamptz, nullable) — mecanismo oficial

- Adicionada em `appointments` (e, se necessário, espelhada em `comandas` via FK — decidir no G1/schema design).
- Preenchida **somente por RPC de evento operacional** autorizada (ADR-019 D-1: barber/gestão), nunca pela settle.
- Imutável após preenchimento (sem UPDATE).
- Dispara eventos (`AttendanceCompleted` — extensão do event bus, plano seção 23) e define a elegibilidade de comissão (ADR-017 D-4).

### D-2. `settle` deixa de preencher `attended_at`/`completed`

- A `finance_settle_comanda` deixa de marcar `appointments.status='completed'`.
- O evento de atendimento (D-1) é quem encerra o ciclo operacional.
- Isso corrige o estado-ato: pagamento antecipado **não** vira atendimento.

### D-3. Política de backfill (DP15) — 3 classes

| Classe | Evidência | Valor de `attended_at` | Marcador |
|---|---|---|---|
| Atendimento comprovado | Data real de atendimento registrada (log, agenda, relatório de caixa que comprove execução) | backfill manual dirigido com a data real | `attended_at_source='backfill_evidence'` |
| Pagamento com appointment passado (sem prova explícita) | `paid_at` existe e `start_time` passado — **evidência circunstancial, não prova** | **NULL** preferido | se preenchido: `attended_at_source='inferred_from_payment'` (flag explícito) |
| Sem qualquer evidência | nada | **NULL** | — |

Regras:
- **Padrão = NULL.** Quando não houver prova, permanece NULL.
- Derivação **nunca** automática em massa; ocorre com marcador explícito (`attended_at_source`) e revisão humana.
- Pagamento antecipado **nunca** é tratado como atendimento (DP15).
- O marcador `attended_at_source` é obrigatório sempre que o valor não vier do fluxo operacional em tempo real.

### D-4. Relatórios e comissão respeitam `attended_at` + `attended_at_source`

- Elegibilidade de comissão (ADR-017 D-4) usa `attended_at` real; registros inferidos ficam classificados (flag) e **não geram comissão retroativamente** sem aprovação (decisão de auditoria — alinhado a ADR-001/Audit).

## Alternatives Considered

### Alternative 1: Derivar `attended_at = paid_at` no backfill geral
**Rejected (PO, DP15).** Pagamento ≠ atendimento; inventaria data para comissão e relatório. Exatamente a corrupção que esta evolução elimina.

### Alternative 2: Manter `status='completed'` da settle como atendimento
**Rejected.** O estado-ato atual é o problema (ADR-017) — marcar completed no pagamento é o que se corrige.

### Alternative 3: Transição de status completa `confirmed→in_progress→completed` (DP8 opção b)
**Not rejected, adiado para F2.** Se o PO quiser rastreio de início/fim de atendimento, a transição complementa `attended_at` (que permanece como timestamp canônico). Decisão de mecanismo adicional na F2, sem alterar D-1.

## Consequences

- **Positive:** `attended_at` é a única fonte canônica de "quando o atendimento ocorreu".
- **Positive:** backfill honesto (`NULL` quando sem prova) preserva a integridade do histórico.
- **Positive:** comissão/relatórios param de ser contaminados por pagamento antecipado.
- **Negative:** histórico antigo permanece com `attended_at = NULL` — relatórios retroativos ficam limitados.
- **Negative:** exige migration aditiva + RPC de evento + extensão de eventos (F2).
- **Mitigation:** marcador `attended_at_source`, política documentada (DP15) e checklist de auditoria.

## References

- ADR-017 (ciclo operacional × financeiro) — D-3/D-4
- ADR-019 (autorização) — quem preenche `attended_at`
- Plano seções 7-8, 29 (backfill), 37.1; DP8/DP15
- `docs/audit/PLANO_EVOLUCAO_FINANCEIRA_ATENDIMENTO_AUDITORIA.md`