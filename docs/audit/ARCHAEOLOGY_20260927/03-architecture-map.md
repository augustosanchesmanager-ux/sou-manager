# Mapa de Arquitetura

**Data:** 2026-09-27 | **Modo:** READ-ONLY

---

## 1. `sou-manager` — Arquitetura de Referência (SoT)

### 1.1 Provider Nesting

```
ThemeProvider
  AppProvider      (resolves appSlug/schema from hostname)
    AuthProvider   (session + accessRole + profileStatus)
      TenantProvider (tenant record + memberships)
        HashRouter
```

### 1.2 Route Guards

| Guarde | Bloqueia | Redireciona |
|---|---|---|
| `ProtectedRoute` | Unauthenticated, pending/suspended non-superadmins | `/pending-approval` |
| `ManagerRoute` | `barber` e `receptionist` de páginas admin/financial | — |
| `SuperAdminRoute` | Non-superadmins de `/superadmin` | — |

### 1.3 Multi-Tenancy

- **Schema routing:** `src/lib/supabase/schemas.ts` — `SHARED_SCHEMA = 'public'`, app-specific schema (`barber`, `auto`, `club`, `estetica`) quando `VITE_SUPABASE_MULTI_SCHEMA_ENABLED`
- **RLS:** `current_tenant_id_from_auth_uid()` (SECURITY DEFINER) + `current_is_super_admin_from_auth_uid()`
- **Tenant isolation:** 47 tabelas inventariadas, 37 com RLS
- **AuthContext:** resolve `tenantId` via RPC `get_auth_access_context`
- **TenantContext:** fetch full tenant record + memberships via `resolveTenantForUser()`

### 1.4 Stack

| Camada | Tecnologia |
|---|---|
| React | 19 |
| Vite | 6 |
| TypeScript | 5.8 |
| Tailwind | v4 (CSS-based, sem `tailwind.config`) |
| Router | `react-router-dom` + `HashRouter` |
| State | Pure React Context (AuthContext → TenantProvider → AppProvider → ThemeProvider) |
| Backend | Supabase (PostgreSQL + Auth + Realtime) |
| AI | Google Gemini via `@google/generative-ai` |
| Deploy | Vercel (`vercel.json` catch-all rewrite) |
| Observability | `src/lib/observability/` (logger, events, metrics, alerts, instrumentation) |
| Event Bus | `domain/events/` (11 tipos, InMemoryEventBus, appEventBus) |
| Outbox | `domain/events/outbox/` (InMemoryOutbox, InMemoryDispatcher, providers) |
| D8 Worker | Edge Function + pg_cron + pg_net + Kong |

### 1.5 Path Aliases

- `@/` → repo root (`path.resolve(__dirname, '.')`)
- Dual directory structures: código em root (`components/`, `context/`, `hooks/`, `pages/`, `services/`) e em `src/`
- Barrel: `services/supabaseClient.ts` re-exporta de `src/lib/supabase/`

---

## 2. `sanchez-barber-iastudio` — Arquitetura

### 2.1 Stack

| Camada | Tecnologia |
|---|---|
| React | 19 |
| Vite | 6 |
| TypeScript | 5.8 |
| Tailwind | v4 |
| Router | `BrowserRouter` (⚠️ incompatível com HashRouter do SoT) |
| Backend | 3 Vercel Functions (Node, sem framework) |
| DB | Supabase próprio (shadow) |
| Auth | Supabase Auth |

### 2.2 Problemas Arquiteturais

| # | Problema | Evidência |
|---|---|---|
| 1 | `BrowserRouter` + `vercel.json` rewrite `"/.*" → "/"` | Fragilidade em subpath |
| 2 | Shadow DB sem `tenant_id` | `schema.sql` — 196 linhas, zero menção |
| 3 | RLS permissiva (`OR` de 3 condições) | `schema.sql:169-177` |
| 4 | `service_role` + guest opcional no sync | `sync.js:326-355` |
| 5 | Dois catálogos divergentes | `data.ts` vs `appointmentConfig.ts` |
| 6 | Availability 100% hardcoded | `date.ts:68-83` |
| 7 | `tsconfig.json` sem `strict: true` | `tsconfig.json` |
| 8 | `src/test` excluído do typecheck | `tsconfig.json:26-28` |

### 2.3 Integração Site→SMG (O Problema Central)

```
Site envia: POST /appointments + {customer_name, customer_email, customer_phone, service, barber, appointment_at, status, site_appointment_id, external_id}
SMG espera: POST /site-sanchez-appointments + {client_name, phone, service_id (UUID), professional_id (UUID), scheduled_at, status, site_appointment_id, external_id, notes}
```

Resultado: **404** (path errado) ou **400 Validation failed** (campos errados + UUIDs ausentes).

---

## 3. `SMG_LOUGE` — Arquitetura

### 3.1 Stack

| Camada | Tecnologia |
|---|---|
| React | 19 |
| Vite | 6 |
| TypeScript | 5.8 |
| Tailwind | v4 (`@theme` CSS-based) |
| Router | `BrowserRouter` (⚠️ incompatível) |
| State | Zustand (⚠️ incompatível com Context do SoT) |
| Animations | `motion` (Framer Motion successor) |
| DB | Supabase com dois schemas |

### 3.2 Split-Brain Schema

```
lounge.* (27 tabelas reais) ← serviços, hooks, RPCs falam aqui
public.* (legacy, 8 tabelas) ← RLS DESABILITADO, SupabaseSync assina aqui
```

**Problema:** `SupabaseSync.tsx` lê `public.sessions`, `public.orders`, assina `schema: 'public', table: 'reservations'/'sessions'/'orders'` — tudo sem tenant filter. `database/schema.sql` explicitamente desabilita RLS nessas tabelas.

### 3.3 Problemas Arquiteturais

| # | Problema | Evidência |
|---|---|---|
| 1 | `public.*` RLS desabilitado + realtime | `schema.sql` |
| 2 | `SupabaseSync` sem tenant filter | `SupabaseSync.tsx` |
| 3 | 54 `.from(...)` sem schema prefix | `src/services/**` |
| 4 | `log_audit_action` usa `current_setting('app.tenant_id')` sem `set_config` | `013_audit_logs.sql` |
| 5 | Mock super_admin sem gating de localhost | `AuthContext` |
| 6 | `BrowserRouter` vs `HashRouter` | `App.tsx:1` |
| 7 | Zustand vs React Context | Incompatível |
| 8 | Tokens `warning`, `success`, `secondary` não definidos em `@theme` | `index.css` |
| 9 | `RoleGuard` não importado | `App.tsx` |
| 10 | 0 testes, 0 ESLint | `package.json` |

---

## 4. `gerador_orcamentos` — Arquitetura

### 4.1 Stack

| Camada | Tecnologia |
|---|---|
| React | 19 |
| Vite | 6 |
| TypeScript | 5.8 (strict) |
| Tailwind | v4 |
| Router | `BrowserRouter` |
| PDF | Puppeteer + Chromium serverless + Handlebars |
| Excel | SheetJS `xlsx@0.18.5` (CVEs conhecidos) |
| DB | Supabase |
| Auth | **NENHUMA** |
| Backend | Vercel Serverless + Express (dev) |

### 4.2 Três APIs Divergentes

```
api/budgets.ts, api/customers-v2.ts, api/products-v2.ts, api/services-v2.ts  ← Vercel (produção)
server.ts:189-385                                                           ← Express (dev)
src/db/*Repository.ts                                                       ← Supabase client-side
```

### 4.3 Problemas Arquiteturais

| # | Problema | Evidência |
|---|---|---|
| 1 | `service_role` JWT no bundle | `index.html` |
| 2 | RLS `USING(true)` em `budgets` | `009_budgets.sql` |
| 3 | RLS desabilitado em `customers` | `011_customers.sql` |
| 4 | `password` em plaintext | `api/register.ts:43` |
| 5 | `x-tenant-id` confiado sem validação | `api/*.ts` |
| 6 | Login fake (base64 JSON) | `api/login.ts` |
| 7 | `budgets.status` coluna não existe em migrations | `api/budgets.ts:106` |
| 8 | `budget_items` tabela não existe em migrations | `api/budgets.ts:143` |
| 9 | `node server.ts` falha (`.ts` sem tsx) | `package.json:scripts` |
| 10 | `src/index.ts` (CLI) nunca referenciado | `package.json` |

---

## 5. `smg-core` — Arquitetura

### 5.1 Dois Apps, Dois Bancos

```
SMG_API (NestJS + Prisma) → PostgreSQL schema `platform` (14 tabelas, ZERO RLS)
SMG_ADMIN (React + Vite)  → Supabase schema `control` (8 tabelas, RLS ok)
```

### 5.2 Problemas Arquiteturais

| # | Problema | Evidência |
|---|---|---|
| 1 | Zero RLS no schema `platform` | `migration.sql` — apenas CREATE SCHEMA/TABLE |
| 2 | RBAC morto (login só `isPlatformAdmin`, guard bypass) | `auth.service.ts:64`, `permissions.guard.ts:39` |
| 3 | Escalão de privilégio viewer→super_admin | `is_admin()` inclui viewer, policy `FOR ALL` |
| 4 | `x-tenant-id` confiado sem validação | `tenant-context.middleware.ts:12-16` |
| 5 | 4 rotas quebradas (401) | `/audit-logs`, `/api-logs`, `/error-logs`, `/system-health` |
| 6 | 4 páginas órfãs | TenantsListPage, UsersListPage não no router |
| 7 | Split-brain Auth (Supabase login + NestJS API) | `login-page.tsx` usa Supabase, `apiClient` lê `authSession` nunca escrito |
| 8 | Billing draft não aplicado | `control-schema-draft.sql` tem `smg_invoices`, `billing_events` — não em migrations |
| 9 | 0 CI, 1 e2e test (health) | `.github/` inexistente |
| 10 | Tailwind v3 + Vite 5 + React 18 vs SoT v4/6/19 | `tailwind.config.js` |

### 5.3 Peças de Valor Isoladas

| Peça | Descrição | SoT tem? |
|---|---|---|
| `control.smg_client_apps` | Mapeamento cliente→produto→app→tenant→schema→supabase_project_ref | ❌ Não tem registry equivalente |
| `control.app_health_checks` | Health check cross-tenant | ❌ Não tem |
| `control.app_incidents` | Incidentes | ❌ Não tem |
| `platform_security_events` | Login failed/succeeded, token events | ❌ Não tem tabela de security events |
| `count_active_super_admins()` | Proteção contra lock-out | ❌ Não tem |

---

## 6. `SMG_AUTOCONTROL` — Arquitetura

### 6.1 Stack

| Camada | Tecnologia |
|---|---|
| React | 19 |
| Vite | 6 |
| TypeScript | 5.8 (**sem `strict`**) |
| Tailwind | v4 |
| Router | `BrowserRouter` |
| State | **NENHUM** (zero `useState`, `useEffect`, Context) |
| DB | **NENHUM** |
| Backend | **NENHUM** |

### 6.2 Problemas Arquiteturais

| # | Problema | Evidência |
|---|---|---|
| 1 | Zero backend, zero DB, zero auth | Nenhum arquivo fora de `src/` |
| 2 | `company_id` vs `tenant_id` | `types/index.ts` |
| 3 | `OSStatus` (5 valores) não cobre "Aguardando Peça" | `types/index.ts:38` vs UI |
| 4 | `types/index.ts` órfão (0 imports) | Grep verificado |
| 5 | `BrowserRouter` sem `vercel.json` | Deep-links 404 em Vercel |
| 6 | 6 dependências mortas (40%) | `express`, `dotenv`, `tsx`, `@google/genai`, `autoprefixer`, `@types/node` |
| 7 | Imports no fim do arquivo (3 arquivos) | `NewOS.tsx:179`, `NewVehicle.tsx:153`, `Vehicles.tsx:119` |
| 8 | Sem testes, sem ESLint, sem CI | `package.json` |
| 9 | `tsconfig` sem `strict` | `tsconfig.json` |
| 10 | Dados mock congelados em 2023 | `ServiceOrders.tsx:7`, `Financial.tsx:17`, `Vehicles.tsx:6` |

---

## 7. `SMG_LADINGPAGE` — Arquitetura

### 7.1 Stack

| Camada | Tecnologia |
|---|---|
| React | 19 |
| Vite | 8 |
| TypeScript | 5.8 |
| Tailwind | v4 |
| Router | **NENHUM** — roteamento manual por `pathname` |
| Backend | **NENHUM** |
| DB | **NENHUM** |
| Analytics | **NENHUM** |

### 7.2 Problemas Arquiteturais

| # | Problema | Evidência |
|---|---|---|
| 1 | Sem `vercel.json` → `/acesso` provavelmente 404 | `Test-Path vercel.json` → False |
| 2 | Sem router → deep-links frágeis | `App.tsx:162-180` |
| 3 | Zero forms, zero fetch | Grep verificado |
| 4 | `GEMINI_API_KEY` injetado no bundle sem consumidor | `vite.config.ts:11` |
| 5 | Tokens CSS não usados no código | `index.css` define, componentes usam hex literais |
| 6 | CSS morto (`.tech-lines`, `.glow-line-vertical`) | `index.css:57-62, 84-89` |
| 7 | 7 âncoras quebradas | Grep exaustivo |
| 8 | Produção divergente | `soumanager.com` serve app diferente |
| 9 | Sem analytics/tracking | Grep verificado |
| 10 | Sem SEO estruturado (JSON-LD, og:image) | `index.html` |

---

## 8. Mapa de Dependências Cruzadas

| Dependência | SoT | sanchez | LOUGE | gerador | smg-core | AUTOCONTROL | LADINGPAGE |
|---|---|---|---|---|---|---|---|
| `@supabase/supabase-js` | ✅ | ✅ | ✅ | ✅ | ✅ (admin) | ❌ | ❌ |
| `react-router-dom` | ✅ | ✅ | ✅ | ✅ | ✅ (admin) | ✅ | ❌ |
| `@google/genai` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ (dead dep) | ❌ (dead dep) |
| `motion` | ❌ | ✅ | ✅ | ❌ (dead) | ❌ | ✅ | ❌ |
| `Zustand` | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `Tailwind v4` | ✅ | ✅ | ✅ | ✅ | ❌ (v3) | ✅ | ✅ |
| `HashRouter` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `Prisma` | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `Puppeteer` | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| `Handlebars` | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
