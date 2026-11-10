# Mapa de Integrações

**Data:** 2026-09-27 | **Modo:** READ-ONLY

---

## 1. `sou-manager` — Integrações Produção

### 1.1 Supabase

| Integração | Evidência | Status |
|---|---|---|
| Auth | `AuthContext` + `get_auth_access_context` RPC | ✅ Ativo |
| Realtime | `supabase.realtime` | ✅ Ativo |
| Storage | `supabase.storage` | ✅ Ativo |
| Edge Functions | `supabase/functions/` | ✅ Ativo |
| pg_cron | `supabase/functions/worker-dispatcher/` | ✅ Production certified |

### 1.2 Edge Functions

| Função | Propósito | Status |
|---|---|---|
| `site-sanchez-appointments` | Booking site→SMG | ✅ Production-grade |
| `worker-dispatcher` | Dispatcher automático de outbox | ✅ Production certified |

### 1.3 D8 Worker Dispatcher

```
pg_cron → pg_net → Kong → Edge Function → RPCs (PostgREST, worker_dispatcher role) → heartbeat
```

| Componente | Propósito |
|---|---|
| `claim_next_outbox_item()` | Claim atômico (`FOR UPDATE SKIP LOCKED`) |
| `get_financial_operation_context()` | Contexto mínimo de tenant |
| `calculateCommissionRecordsFromContext` | Regra certified |
| `mark_outbox_item_processed('published')` | Terminal de sucesso |
| `handle_processing_failure()` | `pending(backoff)` \| `dead_letter` |
| `recover_stale_processing()` | Watchdog para orphaned `processing` |
| `upsert_worker_heartbeat()` | Liveness server-side |

### 1.4 Event Bus + Outbox

| Componente | Propósito |
|---|---|
| `appEventBus` | Singleton do EventBus |
| 11 tipos de eventos | CheckoutCompleted, AppointmentCreated, etc. |
| `InMemoryEventStore` | Append-only |
| `InMemoryOutbox` | Fila com retry + dead-letter |
| `DispatcherProvider` | Interface para providers |
| `ConsoleProvider`, `WebhookProvider`, `SlackProvider` | Providers de entrega |
| `FinanceProvider` | Executor de operações financeiras |

### 1.5 Observability

| Componente | Propósito |
|---|---|
| `logger.ts` | Structured logging |
| `events.ts` | Business events catalog (20+) |
| `metrics.ts` | Counters, gauges, histograms |
| `alerts.ts` | 14 regras + webhook |
| `instrumentation.ts` | Declarative service wrapper |
| Dashboard `/#/observability` | ManagerRoute |

---

## 2. `sanchez-barber-iastudio` — Integrações Quebradas

### 2.1 Site → SMG (INOPERANTE)

| Aspecto | Site envia | SMG espera | Veredito |
|---|---|---|---|
| Endpoint | `POST /appointments` | `POST /site-sanchez-appointments` | ❌ **404** |
| `client_name` | ❌ Ausente | ✅ Obrigatório | ❌ |
| `phone` | ❌ Ausente | ✅ Obrigatório | ❌ |
| `service_id` (UUID) | ❌ `service` (texto) | ✅ UUID obrigatório | ❌ |
| `professional_id` (UUID) | ❌ `barber` (texto) | ✅ UUID obrigatório | ❌ |
| `scheduled_at` | ❌ `appointment_at` | ✅ ISO futuro | ❌ |
| `notes` | ❌ Nunca enviado | ✅ Opcional | ⚠️ |
| `status` | ✅ | ✅ | ✅ |
| `site_appointment_id` | ✅ | ✅ | ✅ |
| `external_id` | ✅ | ✅ | ✅ |
| `customer_email` | ⚠️ Enviado | ❌ Não aceito | ⚠️ |

### 2.2 SMG → Site (Funcional mas sem tenant)

`api/smg/appointments.js` recebe via `x-smg-secret`, faz upsert por `external_id`. Mas: `source_system: 'smg'` hardcoded, sem `tenant_id`, match de `user_id` por email global sem scoping.

### 2.3 Google Reviews

`api/google-reviews.ts` — proxy Google Places. `useGoogleReviews.ts` **nunca é importado**. Dead code.

### 2.4 Mapeamento slug→UUID (NUNCA IMPLEMENTADO)

Documentado em README e `.env.example`, **zero referências em código**:
- `SMG_SERVICE_ID_MAP`
- `SMG_PROFESSIONAL_ID_MAP`

### 2.5 Teste que Codifica o Bug

`src/test/smgIntegration.test.ts:18-42` — o teste afirma "builds the outbound appointment payload expected by SMG" mas assertion usa `customer_name`, `service` (string), `barber` (string) — **contrato errado como correto**. `npm run test:run` passa verde.

---

## 3. `SMG_LOUGE` — Integrações com Gaps

### 3.1 Supabase Realtime

| Componente | Problema |
|---|---|
| `SupabaseSync.tsx` | Query em `public.sessions`, `public.orders` — legado |
| `doorService.ts` | `.from('reservations')` sem schema prefix |
| `commissionService.ts` | `.from('promoter_commission_items')` sem schema prefix |
| `stockService.ts` | `.from('stock_movements')` sem schema prefix |

**54 chamadas `.from(...)` sem schema prefix** — dependem de `lounge` estar nos schemas expostos.

### 3.2 RPCs com Bugs

| RPC | Problema |
|---|---|
| `get_event_dashboard_snapshot` | `p_tenant_id` como parâmetro (cross-tenant read risk) |
| `compute_event_promoter_commissions` | Mesmo problema |
| `approve_promoter_commission` | Sem auth check, sem tenant check |
| `mark_promoter_commission_paid` | Sem auth check, sem tenant check |
| `log_audit_action` | `current_setting('app.tenant_id')` — erro se GUC não setado |

### 3.3 Auth/Tenancy

- `AuthContext` duplica sessão em `localStorage` (`smg_auth_supabase_session`)
- Mock `super_admin` sem gating de localhost
- `RoleGuard` não importado em App.tsx

---

## 4. `gerador_orcamentos` — Integrações Inseguras

### 4.1 Auth

| Componente | Problema |
|---|---|
| `api/login.ts` | Fake — base64 de JSON, não JWT |
| `extractTenantId` | Lê `x-tenant-id` do cliente |
| `api/register.ts:43` | `password` em plaintext |
| `index.html` | `service_role` JWT no bundle |

### 4.2 API Layer

| Problema | Evidência |
|---|---|
| Três APIs divergentes | `api/*.ts`, `server.ts`, `src/db/*Repository.ts` |
| `useCatalog.ts` 404s | Não existem endpoints dinâmicos |
| `budgetRepo.createBudget` não existe | `BudgetsList.tsx:114` |
| `budgetRepo.deleteBudget` não existe | `BudgetsList.tsx:126` |
| `budgetRepo.updateBudget` não existe | `BudgetEdit.tsx:51` |
| `createBudgetRecord` nunca chamado | `budgetRepository.ts` |
| `src/index.ts` (CLI) nunca referenciado | `package.json` |
| `node server.ts` falha | `.ts` sem tsx |

### 4.3 PDF Pipeline

| Componente | Evidência |
|---|---|
| `api/process.ts` | Puppeteer + @sparticuz/chromium |
| `src/services/generatePdf.ts` | Puppeteer local (dev) |
| `src/templates/orcamento.hbs` | Handlebars BR (CR Engenharia) |
| `src/templates/quote.hbs` | Órfão, mojibake, nunca carregado |
| `public/assinatura.png .png` | 999KB, orfão |

---

## 5. `smg-core` — Integrações Divididas

### 5.1 Split-Brain Auth

```
Login → Supabase Auth (browser)
Admin pages → NestJS API (axios) → mas sessão NestJS nunca é criada
```

**Resultado:** 4 rotas (`/audit-logs`, `/api-logs`, `/error-logs`, `/system-health`) enviam requisições sem Authorization → 401 → interceptor tenta refresh (sem sessão) → clearSession.

### 5.2 API Client Legado

`SMG_ADMIN/src/services/http/api-client.ts` — lê `soumanager.localStorage.authSession` que nunca é escrito. Dead code.

### 5.3 Peças de Valor

| Peça | Descrição | SoT tem? |
|---|---|---|
| `control.smg_client_apps` | Registry client→app→tenant→schema | ❌ |
| `control.app_health_checks` | Fleet health monitoring | ❌ |
| `control.app_incidents` | Incident tracking | ❌ |
| `platform_security_events` | Security event log | ❌ |
| `count_active_super_admins()` | Last-admin protection | ❌ |

---

## 6. `SMG_AUTOCONTROL` — Sem Integrações

**Zero** integrações. Sem fetch, axios, createClient, supabase, localStorage, useState, useEffect, process.env.

O `Login.tsx` faz apenas `navigate('/dashboard')` — sem auth, sem chamada de rede.

---

## 7. `SMG_LADINGPAGE` — Sem Integrações

**Zero** integrações. Sem fetch, forms, analytics, tracking, backend.

O roteamento é manual por `pathname` — sem `react-router-dom`.

---

## 8. Matriz de Integrações

| Integração | SoT | sanchez | LOUGE | gerador | smg-core | AUTOCONTROL | LADINGPAGE |
|---|---|---|---|---|---|---|---|
| Supabase Auth | ✅ | ✅ | ✅ | ❌ (fake) | ✅ (admin) | ❌ | ❌ |
| Supabase Realtime | ✅ | ❌ | ⚠️ (split-brain) | ❌ | ❌ | ❌ | ❌ |
| Edge Functions | ✅ | ⚠️ (quebrada) | ❌ | ❌ | ❌ | ❌ | ❌ |
| pg_cron | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Event Bus | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Outbox | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Observability | ✅ | ❌ | ❌ | ❌ | ⚠️ (inacessível) | ❌ | ❌ |
| Google Reviews | ❌ | ⚠️ (dead) | ❌ | ❌ | ❌ | ❌ | ❌ |
| WhatsApp | ❌ | ⚠️ (fallback) | ❌ | ❌ | ❌ | ❌ | ❌ (fake number) |
| PDF Generation | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Analytics | ❌ | ⚠️ (GTM hardcoded) | ❌ | ❌ | ❌ | ❌ | ❌ |
