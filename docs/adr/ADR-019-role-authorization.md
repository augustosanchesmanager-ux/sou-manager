# ADR-019: Autorização por Papel — Menor Privilégio em Operações Financeiras e Operacionais

**Status:** Accepted (2026-08-29)
**Date:** 2026-08-29
**Deciders:** PO (Augusto) + OpenCode
**G0:** ETAPA 2.1 — DP11 (menor privilégio), DP12, DP13, DP14
**References:** Plano seções 16-19, 37.4; ADR-012 (RPC EXECUTE grants); ADR-018 (contrato de pagamento)

---

## Context

As operações novas da evolução financeira (pagamento antecipado, atendimento, baixa, desconto, auditoria) precisam de regras de autorização explícitas por papel. Sem isso, o princípio de menor privilégio é violado — e pagamento antecipado poderia virar "poderes financeiros gerais".

Papéis existentes no domínio: `superadmin`, `owner`, `admin`, `manager`, `receptionist`, `barber`.

Aprovações do G0 que moldam este ADR:

- **DP11 = Aprovado com regra:** recepção pode registrar **pagamento antecipado integral** de comanda elegível vinculada a agendamento futuro — **nada além disso**.
- **DP12 = Sim:** recepção mantém desconto (`apply_discounts`); alteração de valor/desconto **pós-registro de pagamento PROIBIDA** nesta evolução.
- **DP13 = Sim:** baixa administrativa continua restrita a `isManagerLikeRole`.
- **DP14 = Sim:** motivo obrigatório nas ações atuais **+ reagendamento**.

## Problem

1. A permissão "recepção registra antecipação" pode vazar para escopos não desejados (alterar valor, estornar, baixa administrativa, reatribuir profissional, encerrar atendimento).
2. Operações financeiras e operacionais exigem separação clara de **quem executa** (`actor_id`) vs **a quem o serviço pertence** (`professional_id`).
3. Não há matriz central de "papel × operação" para as novas transições.

## Decision

### D-1. Matriz de autorização por operação (papel × operação)

| Operação | superadmin | owner/admin | manager | receptionist | barber |
|---|---|---|---|---|---|
| Registrar pagamento antecipado integral (comanda elegível, agendamento futuro) | sim | sim | sim | **sim — escopo estrito (D-2)** | não |
| Registrar pagamento no atendimento / posterior | sim | sim | sim | conforme permissão atual de baixa | não |
| Registrar pagamento parcial (Cenário D) | sim | sim | sim | **não** | não |
| Estornar pagamento | sim | sim | sim (conforme atual) | **não** | não |
| Modificar pagamento já registrado | **proibido sempre** (imutabilidade ADR-018 D-1) | | | | |
| Alterar valor/desconto pós-registro de pagamento | **proibido nesta evolução** (DP12) | | | | |
| Aplicar desconto (antes do pagamento) | sim | sim | sim | sim (`apply_discounts` mantido) | não |
| Baixa administrativa | sim | sim | sim (`isManagerLikeRole`) | não | não |
| Registrar atendimento realizado (evento operacional — F2/ADR-020) | sim | sim | sim | **não** | sim (o próprio) |
| Desbloquear comanda (F3) | sim | sim | sim | sim, com motivo (DP14) | não |
| Reagendar atendimento | sim | sim | sim | sim, com motivo obrigatório (DP14) | não |
| Reatribuir profissional | sim | sim | sim | não | não |

### D-2. A regra estrita da recepção (DP11 — menor privilégio)

"Recepção registra antecipação integral" significa **exatamente**:

> Recepção pode registrar pagamento antecipado integral de uma comanda elegível vinculada a agendamento futuro.

Autorizado **somente** quando TODAS as condições:
1. Comanda do tipo elegível (serviços sem bloqueio específico — definir na API).
2. Vinculada a appointment futuro (`start_time > now()`).
3. Pagamento **integral** (`net_total`); valor exato, sem desconto discricionário extra no ato (desconto já registrado é respeitado).

**Não autoriza automaticamente**: alterar valor; alterar desconto; estornar; modificar pagamento registrado; baixa administrativa; reatribuir profissional; encerrar atendimento.

### D-3. `actor_id` (operador) ≠ `professional_id` (executor)

- `actor_id`: quem executou a ação no sistema (auditoria — quem/quando/quê).
- `professional_id`: profissional dono do serviço (comissão, execução).
- Ambas persistidas nos registros relevantes (`comanda_payments.actor_id`, `service_execution_participants.professional_id`, etc.). **Nunca inferir uma da outra.**

### D-4. Exigência de motivo (DP14)

Motivo obrigatório em: desconto barber (reasonNote), cortesia/adm (motivo), cancelamento, **reagendamento** (novo), desbloqueio de comanda, estorno (já exige). Registrado no audit trail (ADR-008 + plano seção 18).

### D-5. Enforço

- No frontend: esconder/desabilitar ações por papel (UX — F8).
- **Autoridade real no backend/RPC/RLS** (F1/F2/F3/F5): cada RPC valida papel/escopo via função de permissão; RLS filtra por `tenant_id` + ambiente. Frontend é only UX, nunca segurança.
- Alinhado ao padrão ADR-012 (RPC EXECUTE grants — menor privilégio por default).

## Alternatives Considered

### Alternative 1: Conceder à recepção "todas as operações financeiras de baixa"
**Rejected (PO, DP11).** Vazaria para estorno/baixa administrativa/edição — violação do menor privilégio.

### Alternative 2: Coluna booleana `can_advance_payment` por perfil
**Rejected.** Matriz por operação (D-1) é mais explícita e auditável; booleano único não captura o escopo estrito da D-2.

### Alternative 3: Liberar barber para registrar pagamentos
**Rejected.** Barber executa serviço, não recebe/baixa; papel de atendimento (D-1).

## Consequences

- **Positive:** menor privilégio explícito; recepção ganha apenas a operação antecipada integral, sem poderes gerais.
- **Positive:** separação `actor_id` × `professional_id` torna auditoria confiável.
- **Positive:** motivo obrigatório padroniza a trilha de auditoria.
- **Negative:** matriz precisa ser mantida em um só lugar (docs) e espelhada em RPC/RLS/UX → risco de drift.
- **Mitigation:** matriz central neste ADR; checklist F7 (RLS) e F8 (UX) a conferem; teste de autorização por papel na matriz de testes (F9).

## References

- ADR-012 (RPC EXECUTE grants)
- ADR-008 (audit strategy — motivo/trilha)
- ADR-018 (contrato de pagamento) — quem insere `comanda_payments`
- Plano seções 16-19, 37.4; DP11-DP14
- `docs/audit/PLANO_EVOLUCAO_FINANCEIRA_ATENDIMENTO_AUDITORIA.md`