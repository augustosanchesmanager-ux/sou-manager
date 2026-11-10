# Mapa de Funcionalidades

**Data:** 2026-09-27 | **Modo:** READ-ONLY

---

## 1. `sou-manager` (Baseline — SoT)

### 1.1 Módulos Ativos (`barber`, 21/21 habilitados)

| Módulo | Descrição | Evidência |
|---|---|---|
| `dashboard` | BI e KPIs do barber | `moduleRegistry.ts` |
| `checkout` | Finalização de comandas | `domain/commission/`, `application/cashClosing/` |
| `orders` | Comandas e itens | `comandas`, `comanda_items` |
| `products` | Catálogo de produtos | `products` table |
| `clients` | Gestão de clientes | `clients` table |
| `schedule` | Agendamento | `schedule_blocks`, `appointments` |
| `services` | Catálogo de serviços | `services` table |
| `comandas` | Gestão de comandas | `comandas` table |
| `cashflow` | Fluxo de caixa | `transactions` |
| `financial` | Financeiro | `financial_reversals` |
| `reports` | Relatórios | — |
| `settings` | Configurações do tenant | — |
| `suppliers` | Fornecedores | `suppliers` table |
| `team` | Equipe (staff) | `staff` table |
| `commissions` | Comissão teórica | `domain/commission/` |
| `chef_club` | Club dos Chefes (assinaturas) | `customer_subscriptions` |
| `feedback` | Feedback barbershop | `feedback_barber`, `feedback_shop` |
| `portal` | Portal do cliente | `portal_sessions` |
| `notifications` | Notificações | `notifications` table |
| `kiosk` | Kiosk de autoatendimento | `kiosk_devices`, `kiosk_sessions` |

### 1.2 Módulos Reservados/Bloqueados

| Slug | Módulos | Status |
|---|---|---|
| `auto` | 0/21 habilitados, 21 bloqueados | Slot reservado para SMG Auto Control |
| `club` | 0/21 habilitados | Club dos Chefes (módulo do Barber, não SaaS) |
| `estetica` | 16/21 habilitados | **Ativo mas NÃO documentado** |

### 1.3 Domínios de Backend

| Domínio | Caminho | Evidência |
|---|---|---|
| Commission vs Settlement | `domain/commission/`, `application/cashClosing/` | ADR-001 |
| Event Bus | `domain/events/` | 11 tipos, `appEventBus` singleton |
| Outbox | `domain/events/outbox/` | Status lifecycle, retry, dead-letter |
| Observability | `src/lib/observability/` | Logger, events, metrics, alerts, instrumentation |
| Security | `docs/security/` | 47 tabelas, 37 com RLS, 20+ RPCs auditadas |
| D8 Worker | `supabase/functions/worker-dispatcher/` | Production certified |

---

## 2. `sanchez-barber-iastudio`

### 2.1 Funcionalidades Presentes

| Funcionalidade | Arquivo | Estado | Classificação |
|---|---|---|---|
| Booking público (WhatsApp) | `AppointmentPortal.tsx` | ⚠️ Abandonado — só WhatsApp | 🟡 REFERÊNCIA (UI) / 🔴 DESCARTAR (lógica) |
| Booking → SMG API | `SchedulingFlow.tsx` + `smgClient.ts` | 🟡 Parcial — inalcançável do público | 🟡 ADAPTAR |
| Catálogo de serviços | `scheduling/data.ts` | 🔴 Hardcoded, 8 serviços com slugs falsos | 🟡 REFERÊNCIA → seed |
| Escolha de profissional | `scheduling/data.ts` | 🔴 "primeiro_disponivel" é placeholder | 🟡 REFERÊNCIA |
| Agenda/Disponibilidade | `date.ts`, `SchedulingFlow.tsx` | 🔴 100% decorativa — "tudo exceto domingo" | 🔴 DESCARTAR |
| Confirmação com fallback WhatsApp | `SchedulingFlow.tsx:458-474` | 🟢 Funcionando | 🟡 ADAPTAR |
| Reschedule | `sync.js:256-264` | 🟡 Implausado — flag só muda texto | 🟠 REESCREVER |
| Cancel | `sync.js:275-314` | 🟢 Funcional | 🟡 ADAPTAR |
| Sync site→SMG | `api/smg/sync.js` | 🔴 Quebrado (URL + 7 campos + 2 UUIDs) | 🟠 REESCREVER |
| Portal do cliente | `Dashboard.tsx` + `useUserAppointments` | 🟡 Funcional — depende de shadow DB sem tenant | 🟡 ADAPTAR |
| Admin | `AdminDashboard.tsx` | 🟡 Funcional — SELECT sem filtro | 🟠 ADAPTAR COM RESSALVAS |
| Google Reviews | `api/google-reviews.ts` + `useGoogleReviews.ts` | 🔴 Morto — 0 imports | 🔴 DESCARTAR |
| Landing institucional | 10 componentes | 🔴 100% inalcançável — 0 imports | 🟡 REFERÊNCIA (design) / 🔴 DESCARTAR (código) |

### 2.2 Funcionalidades Ausentes

- Multi-tenancy (zero `tenant_id`)
- Idempotência no site
- Rate limiting / CAPTCHA
- Retry / dead-letter para sync falho
- Availability real (consulta a SMG)
- Catálogo único (dois catálogos divergentes: `data.ts` vs `appointmentConfig.ts`)

---

## 3. `SMG_LOUGE`

### 3.1 Módulos Presentes

| Módulo | Arquivos | Estado | Classificação |
|---|---|---|---|
| Events/Spaces | `EventExecutiveDashboard`, `ProductRanking`, `PromoterRanking` | Ativo | 🟡 ADAPTAR |
| Reservations | `GuestBookingPage`, `ReservationFunnelPage`, `ReservationDetailPage`, `ReservationsListPage` | Ativo | 🟡 ADAPTAR |
| Promoter/Comissões | `PromoterCommissionsPage`, `CommissionTable`, `CommissionDetailsDrawer`, `CommissionAdjustmentModal` | Parcial — RPCs com bugs de GUC | 🟠 REESCREVER |
| Portaria/Door | `DoorCheckinPage`, `AccessListPanel`, `BraceletDeliveryPanel` | Ativo | 🟡 ADAPTAR |
| Stock | `StockPage`, `useStock` | Ativo — hardcoded fallback tenant | 🟡 ADAPTAR |
| Dashboard Executivo | `EventExecutiveDashboard`, `useExecutiveDashboard` | **Quebrado** — passa eventId como tenantId | 🔴 REESCREVER |
| Auth/Tenancy | `AuthContext`, `ProtectedRoute`, `RoleGuard` | Mock super_admin sem gating | 🔴 REESCREVER |
| Realtime | `SupabaseSync.tsx` | Assina `public.*` sem tenant filter | 🔴 REESCREVER |

### 3.2 Dead Code

| Item | Evidência |
|---|---|
| `doorStore`, `uiStore`, `dataStore`, `authStore`, `hookahStore` | Apenas self-referencing, 0 imports externos |
| `commissionStore` | 0 imports |
| `RoleGuard` | Não importado em App.tsx |
| `SupabaseSync` | Query em `public.sessions`, `public.orders` (legado) |

### 3.3 Funcionalidades Ausentes

- Tenant isolation no realtime
- GUC `app.tenant_id` configurado (causa falha em `log_audit_action`)
- Testes (0 arquivos)
- ESLint/Prettier

---

## 4. `gerador_orcamentos`

### 4.1 Funcionalidades Presentes

| Funcionalidade | Arquivo | Estado | Classificação |
|---|---|---|---|
| Orçamento (CRUD) | `api/budgets.ts`, `src/db/budgetRepository.ts` | ⚠️ 4 chamadas quebradas (`createBudget`, `deleteBudget`, `updateBudget` não existem) | 🔴 REESCREVER |
| PDF generation | `api/process.ts`, `src/services/generatePdf.ts` | 🟢 Funcional — Puppeteer + Handlebars | 🟡 REFERÊNCIA |
| Catálogo (clientes/produtos/serviços) | `api/customers-v2.ts`, `api/products-v2.ts`, `api/services-v2.ts` | ⚠️ `useCatalog.ts` 404s — não existem endpoints dinâmicos | 🔴 REESCREVER |
| Login | `api/login.ts`, `src/pages/Login.tsx` | 🔴 Fake — base64 de JSON | 🔴 DESCARTAR |
| Excel import | `api/process.ts` | 🟢 Funcional | 🟡 REFERÊNCIA |
| Template Handlebars | `src/templates/orcamento.hbs` | 🟢 Funcional | 🟡 REFERÊNCIA |
| Assinatura no PDF | `orcamento.hbs` tem `assinatura_base64` | 🔴 Dead — `api/process.ts` só carrega logo | 🔴 DESCARTAR |

### 4.2 Funcionalidades Ausentes/Bugadas

- `budgets.status` — coluna não existe em migrations mas é inserida
- `budget_items` — tabela não existe em migrations mas é inserida
- `users`/`user_profiles` — referenciadas mas não criadas
- Desconto (descontos) — NÃO existe
- Aprovação — apenas status enum, sem workflow
- WhatsApp integration — NÃO existe
- Tenant isolation — header confiado, qualquer usuário recebe tenant `...0001`

---

## 5. `smg-core`

### 5.1 `SMG_API` (NestJS) — Funcionalidades

| Funcionalidade | Evidência | Estado |
|---|---|---|
| Auth (JWT + bcrypt) | `auth.service.ts` — só `isPlatformAdmin` | 🔴 RBAC morto |
| Platform Tenants | `PlatformTenant` model | ⚠️ Zero RLS |
| Platform Users | `PlatformUser` model | ⚠️ IsPlatformAdmin bypass |
| Platform Roles/Permissions | `platform_roles`, `platform_permissions` | 🔴 Nunca consultados em runtime |
| Plans | `PlatformPlan` + seed 'starter' | ❌ Zero código |
| Feature Flags | `PlatformFeatureFlag` | ❌ Zero código |
| Integrations | `PlatformIntegration` | ❌ Zero código |
| Jobs | `PlatformJob` | ❌ Zero código |
| API Logs | `platform_api_logs` + RequestLoggingMiddleware | ✅ Funcional mas inacessível |
| Error Logs | `platform_error_logs` + HttpExceptionFilter | ✅ Funcional mas inacessível |
| Audit Logs | `platform_audit_logs` | ✅ Funcional |
| Security Events | `platform_security_events` | ✅ **Bom desenho** |

### 5.2 `SMG_ADMIN` (React) — Funcionalidades

| Rota | Página | Estado |
|---|---|---|
| `/` | LoginPage (Supabase Auth) | ✅ Funcional |
| `/dashboard` | DashboardPage | ✅ Funcional |
| `/clients` | ClientsPage | ✅ Funcional |
| `/products` | ProductsPage | ✅ Funcional |
| `/subscriptions` | SubscriptionsPage | ⚠️ Stub (14 linhas) |
| `/finance` | FinancePage | ⚠️ Stub |
| `/monitoring` | MonitoringPage | ✅ Funcional |
| `/system-health` | SystemHealthPage | 🔴 Quebrada (401 — sem sessão NestJS) |
| `/audit-logs` | AuditLogsPage | 🔴 Quebrada (401) |
| `/api-logs` | ApiLogsPage | 🔴 Quebrada (401) |
| `/error-logs` | ErrorLogsPage | 🔴 Quebrada (401) |
| `/projects` | ProjectsPage | ⚠️ Stub |
| `/support` | SupportPage | ⚠️ Stub |
| `/team` | TeamPage | ⚠️ Stub |
| `/settings` | SettingsPage | ⚠️ Stub |
| `/tenants` | TenantsListPage | ❌ Órfã (não no router) |
| `/users` | UsersListPage | ❌ Órfã (não no router) |

---

## 6. `SMG_AUTOCONTROL`

### 6.1 Funcionalidades Presentes (todas hardcoded)

| Funcionalidade | Arquivo | Estado | Classificação |
|---|---|---|---|
| Login | `Login.tsx` | 🔴 `navigate('/dashboard')` fixo, sem auth | 🔴 DESCARTAR |
| Dashboard (4 KPIs) | `Dashboard.tsx` | 🟡 Consts estáticas | 🟡 ADAPTAR |
| Clientes (listagem + busca) | `Clients.tsx` | 🟡 Consts estáticos | 🟡 ADAPTAR |
| Novo Cliente (PF/PJ) | `NewClient.tsx` | 🟡 Formulário válido | 🟡 ADAPTAR |
| Veículos | `Vehicles.tsx`, `NewVehicle.tsx` | 🟡 Entidade 100% nova | 🟡 REFERÊNCIA |
| Ordens de Serviço | `ServiceOrders.tsx`, `NewOS.tsx` | 🟡 Melhor artefato do repo | 🟡 REFERÊNCIA |
| Financeiro | `Financial.tsx` | 🟡 3 cards | 🟡 ADAPTAR |
| Configurações | `Settings.tsx` | 🟡 "Dados da Oficina" | 🟡 REFERÊNCIA |
| Sidebar/TopBar/Layout | `Sidebar.tsx`, `TopBar.tsx`, `DashboardLayout.tsx` | 🔴 Conflita com sidebar module-driven | 🔴 DESCARTAR |
| Tipos | `types/index.ts` | ❌ Órfão (0 imports) | 🟡 REFERÊNCIA |

### 6.2 Regras de Negócio Implícitas (valor principal)

| # | Regra | Evidência |
|---|---|---|
| R1 | OS é o agregado central (não comanda) | `/os` route |
| R2 | 6 estados de OS incluindo "Aguardando Peça" | `NewOS.tsx:150-154` |
| R3 | "Aguardando Peça" bloqueia OS por estoque | `Dashboard.tsx:26` |
| R4 | OS é itemizada (Descrição × Qtd × Unitário) | `NewOS.tsx:79-121` |
| R5 | Mão de obra é componente separado | `NewOS.tsx:129-132` |
| R6 | Fórmula: Σ(itens) + mão de obra | `NewOS.tsx:124-137` |
| R7 | Financeiro distingue entradas/saídas | `types/index.ts:52-59` |
| R8 | Pagamento de OS gera receita | `Financial.tsx:17` |
| R9 | Cliente tem PF/PJ/Premium | `Clients.tsx:8-11` |
| R10 | Veículo por placa, chassi/renavam opcionais | `NewVehicle.tsx:141-146` |
| R11 | Roles: admin | mechanic | receptionist | `types/index.ts:12` |

### 6.3 Módulos Ausentes

Agendamento, Frota própria, Gestão de mecânicos, Estoque, Comissões, Clube/fidelidade, Relatórios, Impressão de OS, Notificações, Multi-tenant.

---

## 7. `SMG_LADINGPAGE`

### 7.1 Seções e Conteúdo

| # | Seção | Arquivo | Estado | Classificação |
|---|---|---|---|---|
| 1 | Navbar | `Navbar.tsx` | 🔴 2 links quebrados | 🟡 REFERÊNCIA |
| 2 | Hero | `Hero.tsx` | 🟡 Genérico ("O cérebro do seu negócio") | 🔴 REFERÊNCIA |
| 3 | Hero CTA | `Hero.tsx:36-49` | 🔴 CTA quebrado (#contato) | 🔴 REESCREVER |
| 4 | PainPoints | `PainPoints.tsx` | 🟢 **Ativo forte** | 🟢 COPIAR |
| 5 | Promise | `Promise.tsx` | 🟡 Frágil | 🔴 REFERÊNCIA |
| 6 | Features | `Features.tsx` | 🟢 **Ativo forte** (16 itens) | 🟡 ADAPTAR |
| 7 | Ecosystem | `Ecosystem.tsx` | 🔴 Nomenclatura divergente ("Pop Lounge") | 🟡 ADAPTAR |
| 8 | Differentiators | `Differentiators.tsx` | 🟢 **Ativo differentiation** | 🟢 COPIAR |
| 9 | Testimonial | `Testimonial.tsx` | 🔴 Fundador falando de si | 🟡 ADAPTAR |
| 10 | ProductExperience | `ProductExperience.tsx` | 🟡 Placeholder (mockups falsos) | 🔴 REFERÊNCIA |
| 11 | Technology | `Technology.tsx` | 🟡 Claims amplos | 🔴 REFERÊNCIA |
| 12 | FinalCTA | `FinalCTA.tsx` | 🔴 CTA quebrado + WhatsApp fake | 🔴 REESCREVER |
| 13 | Footer | `Footer.tsx` | 🔴 Dados placeholder | 🔴 REESCREVER |

### 7.2 Conteúdo Perdido no Refactor (git `1e52bc3`)

| Ativo | Evidência | Status |
|---|---|---|
| Formulário de contato funcional | `OLD_App.tsx:790-893` | ❌ Removido |
| Chatbot IA (Gemini) | `OLD_App.tsx:37-190` | ❌ Removido |
| Barra de métricas (500+/R$12M/99.9%/24-7) | `OLD_App.tsx:695-715` | ❌ Removido |
| Seção "Sobre" (`id="sobre"`) | `OLD_App.tsx:717` | ❌ Removido |
| Catálogo de produtos com modais | `OLD_App.tsx:570-693` | ❌ Removido |
| Copy de venda do Barber | `OLD_App.tsx:605-610` | ⚠️ Comprimido |
