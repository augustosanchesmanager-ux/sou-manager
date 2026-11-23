# Frente: Segurança, Multi-tenant & RLS

- **Domínio:** Autenticação, Sessão, Isolamento Multi-tenant, Políticas RLS, RPCs Protegidas e Guards de Rota
- **Stack:** React 19 · TypeScript 5.8 · Supabase Auth · PostgreSQL RLS · Vitest
- **Referências obrigatórias:** `docs/security/SECURITY_AUDIT_RLS.md`, `docs/security/SECURITY_AUDIT_RPC.md`, `AGENTS.md`

---

## Índice da Frente

| ID | Título | Prioridade | Status |
|---|---|---|---|
| `SEC-001` | **F-01:** Loop de `401` em `rpc/get_auth_access_context` (trava de sessão + circuit breaker) | `P0` | `REVIEW` |
| `SEC-002` | **F-03:** Drift de schema exposto no `.env.local` (`Accept-Profile` / `404 PGRST202`) | `P0` | `TODO` |
| `SEC-003` | **E-7:** Memoizar `refreshAccessContext` em `AuthContext.tsx` | `P1` | `TODO` |
| `SEC-004` | Proteger `/admin` com `SuperAdminRoute` e remover `supabase.auth.admin` do browser | `P1` | `TODO` |
| `SEC-005` | Gate de deploy pré-atribuição (`ADR-049` em `deploy-production.yml`) | `P1` | `BLOCKED` |

---

## `SEC-001` — F-01: Loop de `401` em `rpc/get_auth_access_context`

- **Status:** `REVIEW`
- **Prioridade:** `P0`
- **Tipo:** `Bugfix`
- **Dependências:** Aprovação do PO no `deploy-production.yml` para publicar em produção

### Problema / Objetivo
`POST /rest/v1/rpc/get_auth_access_context` entrava em loop de `401` porque `AuthContext` chamava a RPC sem validar expiração do token, amplificava falhas em fallbacks (`profiles`, `staff`, `get_my_pending_invite_token`) e duplicava a carga fria (`getSession` + `INITIAL_SESSION`).

### Escopo Técnico
- `context/AuthContext.tsx` + `context/AuthContext.test.ts` (implementado no PR #369, commit `097c900` na `main`).

### Critérios de Aceite
- [x] Trava de sessão (`isSessionUsableForAccessContext`) e classificador `401` vs `403` (`classifyAuthFailure`).
- [x] Single-flight por token + circuit breaker sem amplificação de fallbacks.
- [x] `npm run typecheck`, `npm run test` (2.872 passed), `npm run build` e `npm run architecture:ci` verdes.
- [ ] Deploy controlado em produção via `deploy-production.yml`.

### Evidência de Validação
- **Branch / PR:** `main` · PR #369 (`097c900`) — registro em `docs/audit/F01_AUTH_401_LOOP_20261122.md`
- **Testes / Build:** `typecheck` OK · `vitest` 206 files / 2.872 passed · `build` OK · CI pós-merge run `45076558247` e `Deploy Validation` run `45076636274` com `success`
- **Observações:** Aguardando promoção em produção para mover para `DONE`.

---

## `SEC-002` — F-03: Drift de schema exposto no `.env.local` (`Accept-Profile`)

- **Status:** `TODO`
- **Prioridade:** `P0`
- **Tipo:** `Hardening`
- **Dependências:** Nenhuma

### Problema / Objetivo
Conforme registrado em `docs/audit/F01_AUTH_401_LOOP_20261122.md` (§6 GAP #3), `.env.local` aponta para projeto cujo schema default é `api`, fazendo `.rpc()` sem `Accept-Profile` retornar `404 PGRST202`.

### Escopo Técnico
- Alinhar schema exposto do ambiente / configuração do cliente Supabase (`src/lib/supabase/client.ts` / `.env.local` / documentação de ambientes).

### Critérios de Aceite
- [ ] Chamadas `.rpc()` no ambiente local/staging resolvem o schema esperado sem `404 PGRST202`.
- [ ] Isolamento multi-tenant (`tenant_id` / RLS) preservado.
- [ ] `npm run typecheck`, `npm run lint`, `npm run test` e `npm run build` passando.

### Evidência de Validação
- **Branch / PR:** —
- **Testes / Build / Prova RLS:** —
- **Observações:** —

---

## `SEC-003` — E-7: Memoizar `refreshAccessContext` em `AuthContext.tsx`

- **Status:** `TODO`
- **Prioridade:** `P1`
- **Tipo:** `Bugfix`
- **Dependências:** `SEC-001`

### Problema / Objetivo
`refreshAccessContext` não é memoizado e é dependência de `useEffect` em `pages/AcceptInvite.tsx:53`, podendo causar re-execuções desnecessárias do efeito.

### Escopo Técnico
- `context/AuthContext.tsx` (envolver `refreshAccessContext` em `useCallback` com dependências estáveis) e verificação de `pages/AcceptInvite.tsx`.

### Critérios de Aceite
- [ ] Identidade referencial de `refreshAccessContext` estabilizada entre renders.
- [ ] Fluxo de aceite de convite validado sem regressão em `npm run test`.
- [ ] `npm run typecheck`, `npm run lint`, `npm run test` e `npm run build` passando.

### Evidência de Validação
- **Branch / PR:** —
- **Testes / Build / Prova RLS:** —
- **Observações:** —

---

## `SEC-004` — Proteger `/admin` com `SuperAdminRoute` e remover `auth.admin` do browser

- **Status:** `TODO`
- **Prioridade:** `P1`
- **Tipo:** `Security`
- **Dependências:** Nenhuma

### Problema / Objetivo
Auditoria Go-To-Market (`docs/audit-go-to-market/SMG_AUDITORIA_COMPLETA.md`) identificou que a rota `/admin` está protegida apenas por `ManagerRoute` (`App.tsx:293`) em vez de `SuperAdminRoute`, e `pages/Admin.tsx:126` tenta chamar `supabase.auth.admin.getUserById` no client.

### Escopo Técnico
- `App.tsx` (troca de guard para `SuperAdminRoute`) e `pages/Admin.tsx` (remoção de chamada `auth.admin` client-side, substituindo por RPC/Edge Function segura se necessário).
- Revisão de queries sem filtro explícito de `tenant_id` citadas na auditoria (ex.: `pages/Support.tsx:76`).

### Critérios de Aceite
- [ ] Usuários `owner`/`manager` comuns não acessam `/admin`.
- [ ] Zero chamadas `supabase.auth.admin` no código de browser.
- [ ] `npm run typecheck`, `npm run lint`, `npm run test` e `npm run build` passando.

### Evidência de Validação
- **Branch / PR:** —
- **Testes / Build / Prova RLS:** —
- **Observações:** —

---

## `SEC-005` — Gate de deploy pré-atribuição (`ADR-049`)

- **Status:** `BLOCKED`
- **Prioridade:** `P1`
- **Tipo:** `Hardening`
- **Dependências:** Autorização explícita do PO para alteração de CI (`AGENTS.md` §5)

### Problema / Objetivo
O gate atual é pós-atribuição (move o alias no `promote` e roda `post-validate` depois). O plano cirúrgico em `docs/audit/2026-11-17-deploy-gate-implementation-plan.md` implementa a validação antes do `vercel promote`.

### Escopo Técnico
- `.github/workflows/deploy-production.yml` conforme `ADR-049`.

### Critérios de Aceite
- [ ] Health check e E2E smoke rodam contra a URL do deployment candidato antes de `vercel promote`.
- [ ] Aprovação explícita do PO registrada em Authorization Record.

### Evidência de Validação
- **Branch / PR:** —
- **Testes / Build / Prova RLS:** —
- **Observações:** Bloqueado aguardando autorização do PO para mexer em workflow de CI.
