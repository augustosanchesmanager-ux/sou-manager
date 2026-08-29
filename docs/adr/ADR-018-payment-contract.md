# ADR-018: Contrato de Pagamento — `payment_type` + Tabela `comanda_payments`

**Status:** Accepted (2026-08-29)
**Date:** 2026-08-29
**Deciders:** PO (Augusto) + OpenCode
**G0:** ETAPA 2.1 — DP3 (P1), DP4 (Sim), DP10 (tabela dedicada)
**References:** Plano seções 9-12, 28, 37.3; ADR-017 (ciclo operacional × financeiro)

---

## Context

O sistema registra recebimento de comandas em `transactions` (income), sem distinção de **quando** o pagamento ocorreu em relação ao atendimento. Três decisões do G0 impõem um contrato explícito de pagamento:

- **DP3 = P1:** o tipo de pagamento NÃO pode ser derivado por comparação de datas (reagendamento corromperia); precisa ser um **enum explícito e imutável**.
- **DP4 = Sim:** pagamento parcial antes do atendimento (Cenário D — sinal/antecipação parcial) é aceito.
- **DP10 = Sim:** o modelo de pagamentos múltiplos será **explícito** — tabela dedicada.

## Problem

1. Sem `payment_type`, "antecipado vs no_atendimento vs posterior" é inferido pela data do pagamento vs `start_time` do appointment — frágil sob reagendamento.
2. Sem modelo explícito, Cenário D (sinal + saldo) exige fragmentar a semântica em múltiplas `transactions` soltas, sem ordem nem vínculo ao saldo.
3. Estorno/reversão de um pagamento parcial precisa identificar **qual** pagamento foi estornado.

## Decision

### D-1. Novo enum imutável `payment_type`

Criado como tipo enumerado no banco (aditivo, sem quebrar nada existente):

```text
anticipado       → antes do atendimento (Cenário C/R0)
no_atendimento   → na data do atendimento (Cenário A — comportamento atual)
posterior        → após o atendimento (Cenário B — atual)
parcial          → sinal/parcela antes do atendimento com saldo posterior (Cenário D)
final            → quitação do saldo (geralmente posterior)
```

Regras:
- Valor **imutável** após registro (nenhum UPDATE em `payment_type`).
- Inserido apenas por RPC autorizada (ver ADR-019 e plano de RPCs); define "quando o pagamento ocorreu" de forma **persistente e confiável**.
- O valor **não é derivado por datas**; é informado/validado na origem (regra de negócio: pagamento antes de `attended_at` ⇒ `anticipado`; depois ⇒ `posterior`; a validação acontece na RPC/transação, mas o valor gravado é canônico).

### D-2. Nova tabela `comanda_payments` (explícita, semente do modelo de pagamentos)

Estrutura conceitual (migration aprovada no G1 — NENHUMA executada nesta etapa):

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | uuid PK | gerado pela API |
| `tenant_id` | uuid FK tenants | isolamento multi-tenant (RLS) |
| `comanda_id` | uuid FK comandas | dona do recebível |
| `payment_type` | `payment_type` enum | D-1 |
| `amount` | numeric(10,2) | valor do pagamento (> 0) |
| `payment_method` | texto | herda enum existente de métodos |
| `actor_id` | uuid FK profiles | operador que registrou (auditoria) |
| `motivo` / `note` | text null | quando exigido (DP14) |
| `reversed_at` | timestamptz null | estorno — vínculo de reversão |
| `created_at` | timestamptz | |

Regras de RLS: **padrão v2 da casa** (superadmin bypass + `tenant_id` via `current_tenant_id_from_auth_uid()`), append-only exceto `reversed_at` (marcação de estorno, nunca DELETE).

### D-3. Saldo derivado a partir da tabela (integra com ADR-017)

```text
paid    = Σ amount de comanda_payments (não estornados) + legado em transactions
balance = net_total − paid
```

- Ingestão de **legado**: pagamentos históricos permanecem em `transactions`; `comanda_payments` passa a ser a fonte **para pagamentos novos** (a partir da F5).
- `balance` é derivado (função/view), nunca coluna nova em `comandas`.

### D-4. Idempotência e concorrência

- Cada inserção usa `idempotency_key` (padrão D7/Outbox) para impedir duplicidade sob retry.
- A quitação (`balance → 0`) e o estorno de um pagamento parcial seguem o fluxo idempotente existente; concorrência de 2 pagamentos simultâneos é coberta na matriz de testes (F9).

## Alternatives Considered

### Alternative 1: Manter implícito (múltiplas `transactions` income)
**Rejected (DP10 = Sim).** Sem entidade, Cenário D fica frágil: sem ordem, sem vínculo de estorno a um pagamento específico e sem integridade referencial do saldo.

### Alternative 2: Coluna `payment_type` apensa em `comandas`
**Rejected.** Só cabe pagamento único; Cenário D (parcial+final) exige múltiplos registros. `comanda_payments` é o modelo correto.

### Alternative 3: `payment_type` derivado por datas no frontend
**Rejected (DP3 = P1).** Reagendamento mudaria `start_time` e reclassificaria pagamentos históricos — viola imutabilidade de auditoria.

## Consequences

- **Positive:** pagamento antecipado, parcial e estorno parcial são representáveis e auditáveis.
- **Positive:** imutabilidade do `payment_type` preserva o histórico mesmo sob reagendamento.
- **Positive:** integração natural com o fluxo D7/Outbox (idempotência).
- **Negative:** nova tabela + enum exigem migration e RLS novas (F5/F7 — nada executado nesta etapa).
- **Negative:** alimentação em duas fontes (legado `transactions` + novo `comanda_payments`) exige definição clara de leitura para relatórios.
- **Mitigation:** view/função única de saldo; compatibilidade garantida na F5 (seção 30 do plano).

## References

- Plano seções 9-12 (pagamentos), 28 (RPCs), 37.3 (contrato de pagamento)
- ADR-017 (ciclo operacional × financeiro) — D-2 financeiro derivado
- ADR-019 (autorização por papel) — quem insere `comanda_payments`
- `docs/audit/PLANO_EVOLUCAO_FINANCEIRA_ATENDIMENTO_AUDITORIA.md` — DP3/DP4/DP10