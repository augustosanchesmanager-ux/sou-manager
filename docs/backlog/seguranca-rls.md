# Frente: Segurança, Multi-tenant & RLS

- **Domínio:** Autenticação, Sessão, Isolamento Multi-tenant, Políticas RLS, RPCs Protegidas e Guards de Rota
- **Stack:** React 19 · TypeScript 5.8 · Supabase Auth · PostgreSQL RLS · Vitest
- **Referências obrigatórias:** `docs/security/SECURITY_AUDIT_RLS.md`, `docs/security/SECURITY_AUDIT_RPC.md`, `AGENTS.md`

---

## Índice da Frente

| ID | Título | Prioridade | Status |
|---|---|---|---|
| `[EXEMPLO]` `SEC-000` | `[EXEMPLO]` Modelo de item de segurança/RLS | `P0` | `TODO` |

---

## `[EXEMPLO]` `SEC-000` — Modelo de item de segurança/RLS

- **Status:** `TODO`
- **Prioridade:** `P0`
- **Tipo:** `Security` | `Hardening` | `Bugfix`
- **Dependências:** Nenhuma

### Problema / Objetivo
`[EXEMPLO]` Descrever o risco de segurança, exposição de rota, falha de sessão ou gap de RLS identificado.

### Escopo Técnico
- `[EXEMPLO]` Guards de rota (`ProtectedRoute`, `ManagerRoute`, `SuperAdminRoute`), queries ou migrations envolvidas.
- `[EXEMPLO]` Lembrar: aplicação de migration em produção exige aprovação explícita do PO.

### Critérios de Aceite
- [ ] `[EXEMPLO]` Isolamento por `tenant_id` e políticas RLS validados sem afrouxamento.
- [ ] `[EXEMPLO]` Zero uso de `service_role` ou APIs `auth.admin` no browser.
- [ ] `[EXEMPLO]` `npm run typecheck`, `npm run lint`, `npm run test` e `npm run build` passando.

### Evidência de Validação
> Preencher antes de mover para `REVIEW` ou `DONE`.

- **Branch / PR:** —
- **Testes / Build / Prova RLS:** —
- **Observações:** —
