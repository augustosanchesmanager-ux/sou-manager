# Frente: Go-To-Market & Produto

- **Domínio:** Onboarding Self-Serve, Billing SaaS (Stripe), Remoção de Mocks (Zero Mock), Links Públicos, Super Admin, Compliance LGPD e AI Intelligence
- **Stack:** React 19 · TypeScript 5.8 · Supabase (PG + RLS + Edge Functions) · Stripe · Google Gemini 2.5 Flash
- **Referências obrigatórias:** `docs/audit-go-to-market/SMG_AUDITORIA_COMPLETA.md`, `docs/PLAN-smg-barber-intelligence.md`, `AGENTS.md`

---

## Índice da Frente

| ID | Título | Prioridade | Issue | Status |
|---|---|---|---|---|
| `GTM-005` | **P0-03:** Remover mocks ativos (`/orders/:id`, `/event-versioning`), restringir `/observability` e fail-fast demo | `P0` | [#378](https://github.com/augustosanchesmanager-ux/sou-manager/issues/378) | `TODO` |
| `GTM-006` | **P0-04:** Corrigir links públicos quebrados, redirects e reset de senha (`HashRouter`) | `P0` | [#379](https://github.com/augustosanchesmanager-ux/sou-manager/issues/379) | `TODO` |
| `GTM-003` | Limpar resíduos de `/automations` simulada em `localStorage` ou definir backend real | `P0` | [#386](https://github.com/augustosanchesmanager-ux/sou-manager/issues/386) | `TODO` |
| `GTM-001` | **P0-05:** Eliminar split-brain de planos, conectar CTA `Upgrade`, unificar Billing Stack (ADR) e Stripe | `P0` | [#380](https://github.com/augustosanchesmanager-ux/sou-manager/issues/380) | `TODO` |
| `GTM-002` | Remover hardcodes de cliente único e métricas fabricadas no BI *(consolidada em `FIN-002`)* | `P0` | [#381](https://github.com/augustosanchesmanager-ux/sou-manager/issues/381) | `TODO` |
| `GTM-007` | **P0-08 (`+SEC-004`):** Reconstruir `/superadmin` (MVP Operacional) e remover `pages/Admin.tsx` | `P0` | [#383](https://github.com/augustosanchesmanager-ux/sou-manager/issues/383) | `TODO` |
| `GTM-008` | **P0-09:** Implementar Compliance Jurídico & LGPD Mínimo Viável (Fase 6.0.6) | `P0` | [#384](https://github.com/augustosanchesmanager-ux/sou-manager/issues/384) | `TODO` |
| `GTM-009` | **P2-05:** Super Admin Avançado (Executive MRR/Churn, `SupabaseMonitoring` real e Exports LGPD) | `P2` | [#401](https://github.com/augustosanchesmanager-ux/sou-manager/issues/401) | `TODO` |
| `GTM-004` | SMG Barber Intelligence — Fase 1 (`ai-analyst` + `ai_insights` + `ADR-050`) | `P2` | [#403](https://github.com/augustosanchesmanager-ux/sou-manager/issues/403) | `BLOCKED` |

---

## `GTM-005` — P0-03: Remover mocks ativos, restringir `/observability` e fail-fast demo

- **Status:** `TODO`
- **Prioridade:** `P0`
- **GitHub Issue:** [#378](https://github.com/augustosanchesmanager-ux/sou-manager/issues/378)
- **Sprint:** Sprint 1
- **Tipo:** `Bugfix`

### Problema / Objetivo
- `pages/OrderDetails.tsx:16-99` (`/orders/:id`) exibe pedido fictício de loja de informática (*TechLogistics Brasil*, *Intel i7*, R\$ 226.650,00).
- `pages/EventVersioningAdmin.tsx:93-170` (`/event-versioning`) é 100% mockado e está visível na Sidebar SuperAdmin.
- `pages/Observability.tsx` (`App.tsx:335`, `Sidebar.tsx:254`) está exposta a donos de barbearia exibindo `Dispatch Loop: MORTO` e métricas voláteis em memória.
- `src/lib/supabase/client.ts:2746-2748` faz fail-open para `createLocalDemoClient()` fora de `localhost` caso faltem env vars.

### Critérios de Aceite
- [ ] `/orders/:id` + `OrderDetails.tsx` removidos; `/event-versioning` removido da Sidebar e de `App.tsx`.
- [ ] `/observability` protegida por `<SuperAdminRoute>` e `superAdminOnly: true`.
- [ ] Fora de `localhost`, ausência de env vars exibe erro explícito de configuração (sem demo silencioso); em `localhost` demo, banner permanente de ambiente fictício.
- [ ] Confirmado que `MockFiscalProvider` não executa em produção.

---

## `GTM-006` — P0-04: Corrigir links públicos quebrados, redirects e reset de senha (`HashRouter`)

- **Status:** `TODO`
- **Prioridade:** `P0`
- **GitHub Issue:** [#379](https://github.com/augustosanchesmanager-ux/sou-manager/issues/379)
- **Sprint:** Sprint 1
- **Tipo:** `Bugfix`
- **Dependências:** Decisão `DEC-08` do PO sobre o link `/portal` em `Landing.tsx`

### Problema / Objetivo
- `App.tsx:272`: `/booking/:tenantSlug` redireciona literalmente para `/agendar/:tenantSlug` sem interpolar `:tenantSlug`.
- `pages/Clients.tsx:66-68`: link compartilhado gera `/#/agendamento/:slug` (404).
- `pages/Landing.tsx:376`: link `PORTAL` aponta para `/portal` (404).
- `pages/Login.tsx:63-83`: redireciona para `/select-system` (404) e omite `/#/` no `redirectTo` de reset de senha.

### Critérios de Aceite
- [ ] `/#/booking/<slug>` redireciona para `/#/agendar/<slug>` via wrapper com `useParams()`.
- [ ] Link em `Clients.tsx` abre `/#/agendar/<slug>` sem 404.
- [ ] Link `/portal` em `Landing.tsx` corrigido ou removido conforme `DEC-08`.
- [ ] `Login.tsx` sem `/select-system` e reset de senha com `/#/reset-password` validado.

---

## `GTM-003` — Central de Automações (`/automations`) sem Mock em `localStorage`

- **Status:** `TODO`
- **Prioridade:** `P0`
- **GitHub Issue:** [#386](https://github.com/augustosanchesmanager-ux/sou-manager/issues/386)
- **Sprint:** Sprint 1
- **Tipo:** `Bugfix`
- **Dependências:** Decisão do PO (limpar resíduos vs implementar backend real)

### Problema / Objetivo
A rota `/automations` já está comentada em `App.tsx:304`, porém o `lazy()` import morto em `App.tsx:22`, `pages/Automations.tsx` e `services/automationHubService.ts` (100% simulado em `localStorage`) permanecem no código.

### Critérios de Aceite
- [ ] Zero simulação de envio em `localStorage` acessível ou referenciada no roteamento de produção.

---

## `GTM-001` — P0-05: Eliminar split-brain de planos, conectar CTA `Upgrade`, Billing Stack e Stripe

- **Status:** `TODO`
- **Prioridade:** `P0`
- **GitHub Issue:** [#380](https://github.com/augustosanchesmanager-ux/sou-manager/issues/380)
- **Sprint:** Sprint 2
- **Tipo:** `Feature`
- **Dependências:** `DEC-01` (assistido vs Stripe self-serve), `DEC-02` (ADR Stack A vs Stack B) e `SEC-006`

### Problema / Objetivo
1. `components/Layout.tsx:89-114` lê e grava `user.user_metadata.plan` via `supabase.auth.updateUser()` sem pagamento nem alteração em `tenants.plan`, divergindo de `FeatureGuard`.
2. `pages/Settings.tsx:927-934`: botão `Upgrade` morto (sem `onClick`), destino de `StatusBanner.tsx` e `UpgradePrompt.tsx`.
3. `pages/Landing.tsx:871` direciona para WhatsApp, `planCatalog.ts:51-55` tem `priceCents: 0` e `stripe-webhook` não está deployada em Produção.
4. Banco possui 2 stacks desconectados: Stack A (`plans`/`subscriptions`/`invoices`) vs Stack B Fase 8 (`platform_*`).

### Critérios de Aceite
- [ ] `Layout.tsx` lê apenas `tenant.plan` e `tenant.status` reais sem mutação em `user_metadata`.
- [ ] Todos os CTAs de `Upgrade` executam fluxo real aprovado pelo PO.
- [ ] ADR publicado consolidando 1 único stack de billing no banco.
- [ ] Plano idêntico entre `Layout`, `Settings`, `FeatureGuard` e banco após reload.

---

## `GTM-002` — Remoção de Hardcodes de Cliente Único e Métricas Fabricadas no BI

- **Status:** `TODO` (consolidada com `FIN-002` em [#381](https://github.com/augustosanchesmanager-ux/sou-manager/issues/381))
- **Prioridade:** `P0`
- **Escopo:** Além de remover `"Sanchez Barber"`, `"Rubens, Heron, Lucas"` e `"augusto@sanchezbarber.com.br"`, elimina cálculos fabricados (`Math.max`, 45%/50%, 85%/15%, radar fake) e corrige fuso UTC vs BRT em `FIN-002`.

---

## `GTM-007` — P0-08 (`+SEC-004`): Reconstruir `/superadmin` (MVP Operacional) e remover `Admin.tsx`

- **Status:** `TODO`
- **Prioridade:** `P0`
- **GitHub Issue:** [#383](https://github.com/augustosanchesmanager-ux/sou-manager/issues/383)
- **Sprint:** Sprint 3
- **Tipo:** `Feature`
- **Dependências:** `SEC-006`, `GTM-001` e `DEC-03`

### Problema / Objetivo
`/superadmin` é 100% read-only (filtros e botões mortos, KPI B2C no lugar de MRR, paginação travada em `1/1`, UUIDs sem e-mail), enquanto `/admin` (`Admin.tsx`) é órfã com botões falsos, `supabase.auth.admin` no browser (403) e violações de CHECK constraint. No banco faltam RPC de extensão de trial, suspensão direta e `LIMIT` em `profileRepository`.

### Critérios de Aceite
- [ ] `/superadmin` executa mutações reais via RPCs `SECURITY DEFINER` (provisionar, estender trial, ativar, suspender, reativar, cancelar, trocar plano, aprovar perfis com nome/e-mail e responder tickets gravando `'responded'`).
- [ ] Filtros, paginação real, `LIMIT` em `profileRepository` e registro em `audit_logs` ativos.
- [ ] `pages/Admin.tsx` removido com redirect `/admin` → `/superadmin`.

---

## `GTM-008` — P0-09: Implementar Compliance Jurídico & LGPD Mínimo Viável (Fase 6.0.6)

- **Status:** `TODO`
- **Prioridade:** `P0`
- **GitHub Issue:** [#384](https://github.com/augustosanchesmanager-ux/sou-manager/issues/384)
- **Sprint:** Sprint 3
- **Tipo:** `Compliance`
- **Dependências:** `DEC-09` (textos aprovados pelo PO + migration)

### Critérios de Aceite
- [ ] Aceite explícito no cadastro/onboarding persistido com versão e timestamp no banco.
- [ ] Centro Jurídico acessível exibindo documentos vigentes e histórico de aceite do tenant.

---

## `GTM-009` — P2-05: Super Admin Avançado

- **Status:** `DONE`
- **Prioridade:** `P2`
- **GitHub Issue:** [#401](https://github.com/augustosanchesmanager-ux/sou-manager/issues/401)
- **Sprint:** Sprint 5+
- **Dependências:** `GTM-001`, `GTM-007`

### Escopo
Conectar Executive Dashboard (MRR/ARR/Churn sobre o stack único de billing), reativar `SupabaseMonitoring` sob `<SuperAdminRoute>` sem fallback mock e conectar UI de `enterprise_audit_logs`/`enterprise_data_exports`.

---

## `GTM-004` — SMG Barber Intelligence (Fase 1)

- **Status:** `DONE` (ADR-050 aceito em `2026-11-25`; migration, Edge Function `ai-analyst`, serviço e painel `/bi` implementados; aplicação remota em PROD aguarda autorização final do PO)
- **Prioridade:** `P2`
- **GitHub Issue:** [#403](https://github.com/augustosanchesmanager-ux/sou-manager/issues/403)
- **Sprint:** Sprint 5+
- **Dependências:** `ADR-050` (`Accepted` em `2026-11-25`)
- **Escopo:** Plano em `docs/PLAN-smg-barber-intelligence.md` (`ai-analyst`, `ai_insights`, `ai_usage_logs` e UI *Atelier Tech*).
