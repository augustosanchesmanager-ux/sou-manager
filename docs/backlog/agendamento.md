# Frente: Agendamento & Recorrência

- **Domínio:** Agenda Interna, Bloqueios, Agendamento Público (`/agendar/:slug`) e Recorrência / Club dos Chefes
- **Stack:** React 19 · TypeScript 5.8 · Supabase (PostgreSQL + RLS + RPCs) · Vitest / Playwright
- **Referências obrigatórias:** `AGENTS.md`, `docs/SPEC_RPC_AGENDAMENTO_ONLINE_PUBLICO.md`

---

## Índice da Frente

| ID | Título | Prioridade | Status |
|---|---|---|---|
| `[EXEMPLO]` `AGD-000` | `[EXEMPLO]` Modelo de item de agendamento | `P0` | `TODO` |

---

## `[EXEMPLO]` `AGD-000` — Modelo de item de agendamento

- **Status:** `TODO`
- **Prioridade:** `P0`
- **Tipo:** `Bugfix` | `Feature` | `Hardening` | `Tech Debt`
- **Dependências:** Nenhuma

### Problema / Objetivo
`[EXEMPLO]` Descrever o comportamento atual vs. esperado (ex.: validação de slots, fuso horário `America/Sao_Paulo`, prevenção de fallback mock silencioso).

### Escopo Técnico
- `[EXEMPLO]` Componentes/serviços impactados (`pages/Schedule.tsx`, `src/pages/public/booking/`, etc.).
- `[EXEMPLO]` Contratos de RPC ou regras de negócio envolvidas.

### Critérios de Aceite
- [ ] `[EXEMPLO]` Isolamento multi-tenant (`tenant_id` / RLS) preservado.
- [ ] `[EXEMPLO]` Zero dados mockados ou fallback silencioso em produção.
- [ ] `[EXEMPLO]` `npm run typecheck`, `npm run lint`, `npm run test` e `npm run build` passando.

### Evidência de Validação
> Preencher antes de mover para `REVIEW` ou `DONE`.

- **Branch / PR:** —
- **Testes / Build:** —
- **Observações:** —
