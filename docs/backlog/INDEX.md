# Backlog Oficial — SMG Barber (SSOT)

> **Fonte Única de Verdade (Single Source of Truth)** para o backlog operacional e técnico do SMG Barber.
> Leia este índice e **apenas o arquivo da frente ativa** antes de iniciar qualquer implementação.

---

## Legenda de Status

| Status | Significado |
|---|---|
| `TODO` | Item especificado e priorizado, aguardando início. |
| `IN_PROGRESS` | Em execução na branch dedicada da frente. |
| `BLOCKED` | Bloqueado por dependência técnica, decisão de produto ou autorização do PO. |
| `REVIEW` | Implementação e validação local concluídas; aguardando revisão/PR. |
| `DONE` | Mergeado/validado com evidência verificável registrada na frente. |

---

## Prioridades Atuais (Foco da Sprint)

> Tabela executiva com os itens priorizados no ciclo atual. Preencher apenas com itens reais aprovados.

| ID | Frente | Título | Prioridade | Status | Dependências |
|---|---|---|---|---|---|
| `[EXEMPLO]` `FIN-000` | [Financeiro & Comissões](./financeiro.md) | `[EXEMPLO]` Exemplo de item priorizado | `P0` | `TODO` | — |

---

## Mapa de Frentes

| Frente | Domínio | Arquivo | Responsável / Escopo |
|---|---|---|---|
| **Financeiro & Comissões** | Caixa, comandas, comissões (ADR-001) e outbox | [financeiro.md](./financeiro.md) | Fechamento de caixa, rateio, comissões D7/D8 e faturamento |
| **Agendamento & Recorrência** | Agenda, bloqueios, agendamento público e Club dos Chefes | [agendamento.md](./agendamento.md) | Slots, fuso horário `America/Sao_Paulo`, fila/recorrência |
| **Segurança, Multi-tenant & RLS** | Autenticação, isolamento `tenant_id`, RPCs e hardening | [seguranca-rls.md](./seguranca-rls.md) | Guards de rota, policies RLS, tokens e auditoria |
| **Arquivo Histórico** | Itens `DONE` há mais de 30 dias | [_ARCHIVE.md](./_ARCHIVE.md) | Histórico consolidado para manter as frentes enxutas |
