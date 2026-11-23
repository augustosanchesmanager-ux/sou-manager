# Frente: Financeiro & Comissões

- **Domínio:** Regime de Caixa, Fechamento de Caixa, Comandas/PDV, Comissões Teóricas (ADR-001) e Outbox Financeiro (D8)
- **Stack:** React 19 · TypeScript 5.8 · Supabase (PostgreSQL + RLS + Edge Functions) · Vitest
- **Referências obrigatórias:** `docs/adr/ADR-001-Commission-vs-Settlement.md`, `AGENTS.md` (regras financeiras e D8)

---

## Índice da Frente

| ID | Título | Prioridade | Status |
|---|---|---|---|
| `[EXEMPLO]` `FIN-000` | `[EXEMPLO]` Modelo de item financeiro | `P0` | `TODO` |

---

## `[EXEMPLO]` `FIN-000` — Modelo de item financeiro

- **Status:** `TODO`
- **Prioridade:** `P0`
- **Tipo:** `Bugfix` | `Feature` | `Hardening` | `Tech Debt`
- **Dependências:** Nenhuma

### Problema / Objetivo
`[EXEMPLO]` Descrever de forma objetiva o problema observado (com evidência de arquivo/linha ou log) ou o objetivo de negócio aprovado pelo PO.

### Escopo Técnico
- `[EXEMPLO]` Arquivos/módulos impactados (preservando a separação ADR-001 entre `domain/commission/` e `application/cashClosing/`).
- `[EXEMPLO]` Restrições aplicáveis (ex.: não editar canônicos D8 sem `npm run d8:verify`).

### Critérios de Aceite
- [ ] `[EXEMPLO]` Isolamento multi-tenant (`tenant_id` / RLS) preservado.
- [ ] `[EXEMPLO]` Zero dados mockados em produção.
- [ ] `[EXEMPLO]` `npm run typecheck`, `npm run lint`, `npm run test` e `npm run build` passando.
- [ ] `[EXEMPLO]` `npm run d8:verify` passando (se tocar pipeline de outbox/comissão).

### Evidência de Validação
> Preencher antes de mover para `REVIEW` ou `DONE`.

- **Branch / PR:** —
- **Testes / Build:** —
- **Observações:** —
