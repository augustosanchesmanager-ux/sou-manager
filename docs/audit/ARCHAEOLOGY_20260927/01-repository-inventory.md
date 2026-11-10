# Inventário de Repositórios

**Data:** 2026-09-27 | **Modo:** READ-ONLY

---

## 1. Baseline Local — `sou-manager`

| Campo | Valor | Evidência |
|---|---|---|
| Branch ativa | `fix/e2e-helper-env-precedence` | `git branch` |
| HEAD | `c40d342` (2026-09-27) | `git log` |
| Árvore | Dirty (114 files) | `git status` |
| Migrations | 163 arquivos SQL | `supabase/migrations/` |
| Tags | Até `v2.1.0` | `git tag` |
| Roadmap | Congelado desde 2026-07-24 | `AGENTS.md` |
| Stack | React 19 + Vite 6 + TS 5.8 + Tailwind v4 | `package.json` |
| Router | `HashRouter` | `src/` |
| Auth | Supabase Auth + `get_auth_access_context` RPC | `context/AuthContext.tsx` |
| Multi-schema | `APP_SLUGS = ['barber','auto','club','estetica']` | `domain/shared/app.ts` |
| RLS | 47 tabelas inventariadas, 37 com RLS | `docs/security/SECURITY_AUDIT_RLS.md` |
| D8 Worker | Production certified (`v2.0.0-d8-production-certified`) | ADR-015/016 |
| Observability | `src/lib/observability/` completo | 5 componentes |
| Event Bus | `domain/events/` com 11 tipos, Outbox, Subscribers | Fase 4 |

### 1.1 App Slugs e Módulos

| Slug | Módulos Habilitados | Status | Evidência |
|---|---|---|---|
| `barber` | 21/21 | ✅ Produto ativo | `moduleRegistry.ts:5-27` |
| `auto` | 0/21 (todos bloqueados) | 🟡 Slot reservado | `moduleRegistry.ts:28` |
| `club` | 0/21 (parcial) | 🟣 Club dos Chefes (módulo, não SaaS) | `moduleRegistry.ts:29` |
| `estetica` | 16/21 | 🟡 **Ativo, NÃO documentado** | `moduleRegistry.ts:30-47` |

> ⚠️ **Divergência documental:** `AGENTS.md` declara "Supported apps: barber (default), auto, club" — mas o código tem 4 slugs com `estetica` habilitando 16 módulos. Isso viola a diretriz "Toda nomenclatura deve seguir `docs/TAXONOMY.md`".

### 1.2 Tabelas Principais (SoT)

**Core Public:** `apps, audit_logs, financial_reversals, notifications, otp_requests, portal_sessions, profiles, service_execution_participants, staff, support_tickets, tenant_addons, tenants, ticket_messages, user_tenants`

**Domain:** `appointments, clients, comanda_items, comandas, customer_credits, customer_plans, customer_subscription_receivables, customer_subscriptions, customer_vouchers, feedback_barber, feedback_shop, kiosk_devices, kiosk_sessions, products, promotions, purchase_orders, schedule_blocks, services, suppliers, transactions`

---

## 2. `augustosanchesmanager-ux/sanchez-barber-iastudio`

| Campo | Valor |
|---|---|
| HEAD | `6228e6cf` (2026-05-30) |
| Commits | 12 |
| Stack | React 19 + Vite 6 + TS 5.8 + Tailwind v4 + `BrowserRouter` |
| Backend | 3 Vercel Functions (`api/smg/sync.js`, `api/smg/appointments.js`, `api/google-reviews.ts`) |
| DB | Supabase próprio (shadow, mono-tenant) |
| `tenant_id` | ❌ **Inexistente em qualquer tabela** |
| RLS | Habilitada mas permissiva (`OR` de 3 condições) |
| Recência | 120 dias sem commit |
| Permalinks | `https://github.com/augustosanchesmanager-ux/sanchez-barber-iastudio/blob/6228e6cf/` |

### Arquivos-chave

| Caminho | Propósito |
|---|---|
| `api/smg/sync.js` | Outbound site→SMG (370 linhas, endpoint errado) |
| `api/smg/appointments.js` | Inbound SMG→site (91 linhas) |
| `supabase/schema.sql` | Shadow DB (3 tabelas, sem tenant_id) |
| `src/pages/LandingPage.tsx` | = `AppointmentPortal` (WhatsApp-only) |
| `src/components/SchedulingFlow.tsx` | Único componente com wiring SMG (atrás de ProtectedRoute) |
| `src/components/AppointmentPortal.tsx` | Wizard 7-passos, só abre WhatsApp |
| `src/components/scheduling/data.ts` | Catálogo hardcoded (8 serviços) |
| `src/lib/integrations/smg.ts` | 2 funções mortas (`buildSiteSmgAppointmentPayload`, `isSmgAppointmentConflict`) |
| `src/test/smgIntegration.test.ts` | Teste codifica contrato errado |
| `src/test/appRoutes.test.tsx` | E2E consagra WhatsApp-only |

---

## 3. `augustosanchesmanager-ux/SMG_LOUGE`

| Campo | Valor |
|---|---|
| HEAD | `5f86533` (2026-06-04) |
| Commits | 10 |
| Stack | React 19 + Vite 6 + TS 5.8 + Tailwind v4 + `BrowserRouter` + Zustand |
| DB | Supabase com **dois schemas**: `lounge.*` (real) + `public.*` (legado) |
| RLS | Gaps: `public.*` com RLS desabilitado, `lounge.*` com políticas incompletas |
| Recência | ~4 meses |
| Permalinks | `https://github.com/augustosanchesmanager-ux/SMG_LOUGE/blob/5f86533/` |

### Módulos

| Módulo | Arquivos-chave | Estado |
|---|---|---|
| Events/Spaces/Reservations | `GuestBookingPage`, `ReservationFunnelPage`, `ReservationDetailPage`, `ReservationsListPage` | Ativo |
| Promoter/Comissões | `PromoterCommissionsPage`, `commissionService`, `useCommissions`, `CommissionTable`, `CommissionDetailsDrawer`, `CommissionAdjustmentModal` | Parcial |
| Portaria/Door | `DoorCheckinPage`, `AccessListPanel`, `BraceletDeliveryPanel`, `doorService`, `useDoorCheckin` | Ativo |
| Stock | `StockPage`, `stockService`, `useStock` | Ativo |
| Dashboard Executivo | `EventExecutiveDashboard`, `executiveDashboardService`, `useExecutiveDashboard` | **Quebrado** (passa eventId como tenantId) |
| Auth | `AuthContext`, `ProtectedRoute`, `RoleGuard`, `authService` | Mock super_admin sem gating |
| Stores | `reservationStore`, `sessionStore`, `consumptionStore`, `commissionStore` | `commissionStore`, `doorStore`, `uiStore`, `dataStore`, `authStore`, `hookahStore` = DEAD |

### Schema split

- **`lounge.*`**: 27 tabelas reais (events, spaces, promoters, reservations, payments, bracelets, access_lists, stock, orders, financial_closings, promoter_commissions, audit_logs)
- **`public.*`**: Legacy (events, lounges, promoters, reservations, sessions, orders) — RLS desabilitado, publicado em `supabase_realtime`

---

## 4. `augustosanchesmanager-ux/gerador_orcamentos`

| Campo | Valor |
|---|---|
| HEAD | `10ad103` (2026-05-18) |
| Commits | 58 |
| Stack | React 19 + Vite 6 + TS 5.8 (strict) + Tailwind v4 + Puppeteer + Handlebars |
| DB | Supabase |
| RLS | `budgets` = `USING(true) WITH CHECK(true)`; `customers` = RLS desabilitado |
| Auth | **NENHUMA** — mock client-side, `x-tenant-id` confiado |
| Deploy | `https://geradororcamentos1.vercel.app` |
| Recência | ~4 meses |
| Permalinks | `https://github.com/augustosanchesmanager-ux/gerador_orcamentos/blob/10ad103/` |

### Arquitetura de 3 APIs divergentes

```
api/budgets.ts, api/customers-v2.ts, api/products-v2.ts, api/services-v2.ts  ← Vercel (produção)
server.ts:189-385                                                           ← Express (dev)
src/db/*Repository.ts                                                       ← Supabase client-side
```

### Segurança

- `index.html` contém `service_role` JWT no bundle
- `api/register.ts:43` armazena `password` em **plaintext**
- `extractTenantId` lê header `x-tenant-id` do cliente
- Login é fake (base64 de JSON, não JWT)
- 8 PDFs reais de clientes no `outputs/`

---

## 5. `augustosanchesmanager-ux/smg-core`

| Campo | Valor |
|---|---|
| HEAD | `df85ea6` (2026-04-30) |
| Commits | 8 |
| Stack | **Dois apps**: `SMG_API` (NestJS 11 + Prisma 6 + PostgreSQL) + `SMG_ADMIN` (React 18 + Vite 5 + Tailwind v3 + Supabase) |
| DB | **Dois bancos**: Prisma schema `platform` (14 tabelas, ZERO RLS) + Supabase schema `control` (8 tabelas, RLS ok) |
| Auth | JWT próprio + bcrypt (API) vs Supabase Auth (Admin) |
| RBAC | **MORTO** — login só aceita `isPlatformAdmin`, guard faz bypass |
| Recência | ~5 meses |
| Permalinks | `https://github.com/augustosanchesmanager-ux/smg-core/blob/df85ea6/` |

### Apps

| App | Tecnologia | DB | Status |
|---|---|---|---|
| `SMG_API` | NestJS 11 + Fastify + Prisma 6 | PostgreSQL schema `platform` | Legado órfão |
| `SMG_ADMIN` | React 18 + Vite 5 + TanStack Query | Supabase schema `control` | Split-brain |

### Tabelas sem código

`platform_plans`, `platform_feature_flags`, `platform_integrations`, `platform_jobs` — existem no schema mas não têm módulo, serviço, controller ou seed.

### Billing draft

`smg_invoices` e `billing_events` existem apenas em `control-schema-draft.sql` — nunca migrados.

---

## 6. `augustosanchesmanager-ux/SMG_AUTOCONTROL`

| Campo | Valor |
|---|---|
| HEAD | `e101157` (2026-03-18) |
| Commits | 2 |
| Stack | React 19 + Vite 6 + TS 5.8 + Tailwind v4 + `BrowserRouter` |
| DB | **NENHUM** |
| Backend | **NENHUM** |
| Auth | **NENHUM** — `navigate('/dashboard')` fixo |
| Estado | Zero `useState`, zero `useEffect`, zero Context |
| Recência | 193 dias |
| Permalinks | `https://github.com/augustosanchesmanager-ux/SMG_AUTOCONTROL/blob/e101157/` |

### 7 Interfaces (arquivo órfão `src/types/index.ts`)

`Company`, `Profile`, `Client`, `Vehicle`, `OSStatus`, `ServiceOrder`, `CashEntry`

> `types/index.ts` é importado por **NENHUM** outro arquivo. 100% órfão.

### Regras de negócio implícitas (valor principal)

R1-R11: OS como agregado central, 6 estados incluindo "Aguardando Peça", decomposição em itens + mão de obra, PF/PJ/Premium, veículo por placa.

---

## 7. `augustosanchesmanager-ux/SMG_LADINGPAGE`

| Campo | Valor |
|---|---|
| HEAD | `fb041ad` (2026-04-24) |
| Commits | 3 |
| Stack | React 19 + Vite 8 + TS 5.8 + Tailwind v4 (3 deps runtime) |
| Router | **NENHUM** — roteamento manual por `pathname` |
| Backend | **NENHUM** — zero fetch, zero forms |
| Deploy | **NÃO DEPLOYADO** — `soumanager.com` serve app diferente |
| Recência | 156 dias |
| Permalinks | `https://github.com/augustosanchesmanager-ux/SMG_LADINGPAGE/blob/fb041ad/` |

### 12 Seções

Navbar, Hero, PainPoints, Promise, Features, Ecosystem, Differentiators, Testimonial, ProductExperience, Technology, FinalCTA, Footer

### Âncoras quebradas

| Âncora | Referências | Alvo |
|---|---|---|
| `#contato` | 5 (Hero, Navbar×2, FinalCTA, Footer) | ❌ **NENHUM** |
| `#solucoes` | 2 (Navbar, Footer) | ❌ **NENHUM** |
| `#diferenciais` | 1 | ✅ `Differentiators.tsx:28` |
| `#ecossistema` | 1 | ✅ `Ecosystem.tsx:32` |
| `#produto` | 1 | ✅ `ProductExperience.tsx:12` |

---

## 8. Resumo Comparativo de Stack

| Item | sou-manager | sanchez | LOUGE | gerador | smg-core | AUTOCONTROL | LADINGPAGE |
|---|---|---|---|---|---|---|---|
| React | 19 | 19 | 19 | 19 | 18 (admin) | 19 | 19 |
| Vite | 6 | 6 | 6 | 6 | 5 (admin) | 6 | 8 |
| TS | 5.8 | 5.8 | 5.8 | 5.8 | 5.6 | 5.8 | 5.8 |
| Tailwind | v4 | v4 | v4 | v4 | v3 | v4 | v4 |
| Router | HashRouter | BrowserRouter | BrowserRouter | BrowserRouter | BrowserRouter | BrowserRouter | Manual |
| DB | Supabase | Supabase | Supabase | Supabase | Prisma+Supabase | — | — |
| Auth | Supabase + RPC | Supabase | Supabase | Fake | JWT+bcrypt+Supabase | — | — |
| RLS | ✅ 37/47 | ⚠️ Permissiva | ⚠️ Gaps | ❌ `USING(true)` | ❌ Zero | — | — |
| Testes | vitest+playwright | vitest | 0 | 7 | 1 e2e | 0 | 0 |
| CI | — | — | 0 | GitHub Actions | 0 | 0 | 0 |
