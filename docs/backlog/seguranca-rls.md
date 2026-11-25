# Frente: Segurança, Multi-tenant & RLS

- **Domínio:** Autenticação, Sessão, Isolamento Multi-tenant, Políticas RLS, Grants, RPCs Protegidas e Guards de Rota
- **Stack:** React 19 · TypeScript 5.8 · Supabase Auth · PostgreSQL RLS · Vitest
- **Referências obrigatórias:** `docs/security/SECURITY_AUDIT_RLS.md`, `docs/security/SECURITY_AUDIT_RPC.md`, `AGENTS.md`

---

## Índice da Frente

| ID | Título | Prioridade | Issue | Status |
|---|---|---|---|---|
| `SEC-001` | **F-01:** Loop de `401` em `rpc/get_auth_access_context` (trava de sessão + circuit breaker) | `P0` | — | `REVIEW` |
| `SEC-002` | **F-03:** Drift de schema exposto (`Accept-Profile` / `Content-Profile`) | `P0` | — | `REVIEW` |
| `SEC-006` | **P0-01:** Hardening final de RLS, Grants e reconciliação de Produção | `P0` | [#376](https://github.com/augustosanchesmanager-ux/sou-manager/issues/376) | `TODO` |
| `SEC-007` | **P0-02:** Blindar guards (`ManagerRoute` allow-list), `CommandPalette` e filtro `tenant_id` | `P0` | [#377](https://github.com/augustosanchesmanager-ux/sou-manager/issues/377) | `TODO` |
| `SEC-003` | **E-7:** Memoizar `refreshAccessContext` em `AuthContext.tsx` *(consolidada em `UXQ-004`)* | `P1` | [#392](https://github.com/augustosanchesmanager-ux/sou-manager/issues/392) | `TODO` |
| `SEC-004` | Remover `auth.admin` do browser e consolidar `/admin` em `/superadmin` *(consolidada em `GTM-007`)* | `P0` | [#383](https://github.com/augustosanchesmanager-ux/sou-manager/issues/383) | `TODO` |
| `SEC-005` | Gate de deploy pré-atribuição (`ADR-049` em `deploy-production.yml`) | `P1` | [#395](https://github.com/augustosanchesmanager-ux/sou-manager/issues/395) | `BLOCKED` |

---

## `SEC-001` — F-01: Loop de `401` em `rpc/get_auth_access_context`

- **Status:** `REVIEW`
- **Prioridade:** `P0`
- **Tipo:** `Bugfix`
- **Dependências:** Aprovação do PO no `deploy-production.yml` para publicar em produção

### Escopo & Evidência
- Implementado no PR #369 (`097c900` na `main`) — registro em `docs/audit/F01_AUTH_401_LOOP_20261122.md`.
- Aguardando promoção controlada em produção para mover para `DONE`.

---

## `SEC-002` — F-03: Drift de schema exposto (`Accept-Profile` / `Content-Profile`)

- **Status:** `REVIEW`
- **Prioridade:** `P0`
- **Tipo:** `Hardening`
- **Dependências:** Camada B (Dashboard Supabase em produção sob decisão do PO)

### Escopo & Evidência
- Camada A mergeada (`c34af60` na `main`) — registro em `docs/audit/F03_SCHEMA_EXPOSED_DRIFT_20261124.md`.
- Pendência Camada B no Dashboard de Produção (`ushsnmlbeurfvlkieiln`): posicionar `public` como primeiro schema em *Exposed schemas*.

---

## `SEC-006` — P0-01: Hardening final de RLS, Grants e reconciliação de Produção

- **Status:** `TODO`
- **Prioridade:** `P0`
- **GitHub Issue:** [#376](https://github.com/augustosanchesmanager-ux/sou-manager/issues/376)
- **Sprint:** Sprint 1
- **Tipo:** `Security`
- **Dependências:** Aprovação explícita do PO para aplicar migration em Produção (`DEC-10`) + checagem do alias Vercel

### Problema / Objetivo
Inspeção read-only ao vivo em Produção (`ushsnmlbeurfvlkieiln`) na Sprint 0 confirmou brechas ativas:
1. `platform_subscriptions` e `platform_invoices` (`20261106030000:109-123,175-189`) permitem `INSERT`/`UPDATE` por usuário comum do próprio tenant (`tenant_id = current_effective_tenant_id()`) para `{public}`.
2. `access_requests` possui policy `"superadmin full access access_requests"` checando `profiles.role = 'superadmin'` case-sensitive em vez de `current_is_super_admin_from_auth_uid()`.
3. `anon` e `authenticated` possuem `GRANT ALL` amplo (`DELETE, INSERT, SELECT, UPDATE, TRUNCATE`) em `platform_invoices`, `platform_subscriptions`, `subscriptions`, `invoices`, `plans`, `access_requests` e `feature_flags`.
4. **Drift de deploy:** 234 migrations locais vs 210 aplicadas em Produção (`latest = 20261120025214`, faltam 5 migrations até `20261121162000`) e apenas 8 de 16 Edge Functions deployadas (`stripe-webhook` ausente em Produção).

### Critérios de Aceite
- [ ] Query em `pg_policies` em Produção retorna 0 policies permissivas indevidas em tabelas de domínio/billing.
- [ ] Usuário comum recebe `42501` ao tentar `INSERT`/`UPDATE` em `platform_subscriptions` e `platform_invoices`.
- [ ] `access_requests` padronizada com `current_is_super_admin_from_auth_uid()` e `GRANT`s reduzidos ao menor privilégio.
- [ ] Delta de migrations e Edge Functions em Produção auditado e reconciliado com aprovação do PO.

---

## `SEC-007` — P0-02: Blindar guards (`ManagerRoute` allow-list), `CommandPalette` e filtro `tenant_id`

- **Status:** `TODO`
- **Prioridade:** `P0`
- **GitHub Issue:** [#377](https://github.com/augustosanchesmanager-ux/sou-manager/issues/377)
- **Sprint:** Sprint 1
- **Tipo:** `Security`
- **Dependências:** Nenhuma

### Problema / Objetivo
1. `App.tsx:188-194`: `ManagerRoute` usa deny-list (`barber` / `receptionist`), deixando `accessRole === 'unknown'` atravessar.
2. `App.tsx:308-329`: ordem `FeatureRoute > ManagerRoute` exibe tela de "Faça upgrade" para barbeiro em vez de bloquear acesso.
3. Queries sem `.eq('tenant_id', tenantId)` expostas sob bypass RLS de Super Admin: `domain/client/repository.ts:483-512`, `domain/accountsPayable/repository.ts:69-164`, `services/scheduleBlocksApi.ts:253-265` e `src/modules/commissions/barberStatementService.ts:155-260`.
4. `components/CommandPalette.tsx:48-238` exibe rotas gerenciais/SuperAdmin/features sem filtrar por `accessRole` ou `useFeatureFlags()`.

### Critérios de Aceite
- [ ] `ManagerRoute` valida via allow-list explícita (`manager` | `superadmin`).
- [ ] Ordem padronizada `ManagerRoute > FeatureRoute`.
- [ ] Todos os métodos dos 4 arquivos citados exigem e aplicam `.eq('tenant_id', tenantId)`.
- [ ] `CommandPalette` oculta rotas não autorizadas para o perfil/plano atual.
- [ ] `npm run smg:verify` verde.

---

## `SEC-003` — E-7: Memoizar `refreshAccessContext` em `AuthContext.tsx`

- **Status:** `TODO` (consolidada com `UXQ-004` em [#392](https://github.com/augustosanchesmanager-ux/sou-manager/issues/392))
- **Prioridade:** `P1`
- **Escopo:** Envolver `refreshAccessContext` em `useCallback` junto à memoização completa dos providers em `UXQ-004`.

---

## `SEC-004` — Remover `auth.admin` do browser e consolidar `/admin` em `/superadmin`

- **Status:** `TODO` (elevada para `P0` e consolidada com `GTM-007` em [#383](https://github.com/augustosanchesmanager-ux/sou-manager/issues/383))
- **Prioridade:** `P0`
- **Escopo:** Embora `App.tsx:293` já use `SuperAdminRoute`, `pages/Admin.tsx` ainda chama `supabase.auth.admin.getUserById()` no browser, possui botões falsos e viola CHECK constraints — será removida após migrar mutações válidas para `/superadmin` em `GTM-007`.

---

## `SEC-005` — Gate de deploy pré-atribuição (`ADR-049`)

- **Status:** `DONE` (implementado em `.github/workflows/deploy-production.yml` com job `pre-validate` bloqueando `promote`; validado ao vivo em Produção no run `#45519577522`, 4/4 SUCCESS)
- **Prioridade:** `P1`
- **GitHub Issue:** [#395](https://github.com/augustosanchesmanager-ux/sou-manager/issues/395)
- **Dependências:** `ADR-049` (`Accepted` em `2026-11-17`) + autorização do PO.
- **Escopo:** Executar health check e E2E smoke contra a URL candidata antes de `vercel promote` em `.github/workflows/deploy-production.yml`.
