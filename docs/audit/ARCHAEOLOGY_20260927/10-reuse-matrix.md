# Matriz de Reuso

**Data:** 2026-09-27 | **Modo:** READ-ONLY

---

## 1. Legenda

| Classificação | Significado |
|---|---|
| 🟢 **COPIAR** | Reuso direto, sem modificação significativa |
| 🟡 **ADAPTAR** | Reuso com adaptação de schema, routing ou tokens |
| 🟡 **REFERÊNCIA** | Inspiração conceitual, não código |
| 🟠 **REESCREVER** | Padrão correto mas implementação quebrada |
| 🟣 **MANTER SEPARADO** | Domínio específico, não acoplar ao SMG Barber |
| 🔴 **DESCARTAR** | Código morto, inseguro ou incompatível |
| ⭐ **GAP** | smg-core tem, sou-manager não — peça de valor isolada |

---

## 2. Matriz por Repositório

### 2.1 `sanchez-barber-iastudio`

| Ativo | Arquivo | Classificação | Justificativa |
|---|---|---|---|
| Wizard de booking | `SchedulingFlow.tsx` | 🟡 ADAPTAR | Melhor UX do repo: motion por step, validação, tratamento de conflito |
| Catálogo de serviços | `scheduling/data.ts` | 🟡 REFERÊNCIA | 8 serviços com nome/preço/duração — seed para PO validar |
| Design system dark/gold | `index.css` + 10 componentes | 🟡 REFERÊNCIA | Identidade visual validada (score 23/40) |
| Booking público | `AppointmentPortal.tsx` | 🟡 REFERÊNCIA (UI) / 🔴 DESCARTAR (lógica) | Wizard de 7 passos visualmente maduro, mas sem valor |
| Availability | `date.ts`, `SchedulingFlow.tsx` | 🔴 DESCARTAR | 100% decorativa — "tudo exceto domingo" |
| Sync site→SMG | `api/smg/sync.js` | 🔴 REESCREVER | URL errada, 7 campos errados, 2 UUIDs ausentes |
| Reschedule | `sync.js:256-264` | 🟠 REESCREVER | Flag só muda texto, não semântica |
| Google Reviews | `api/google-reviews.ts` | 🔴 DESCARTAR | 0 imports |
| 10 componentes landing | `Hero`, `Navbar`, etc. | 🟡 REFERÊNCIA (design) / 🔴 DESCARTAR (código) | 0 imports, ~600 linhas |
| `appointmentConfig.ts` | `appointmentConfig.ts` | 🔴 DESCARTAR | 8 serviços com IDs conflitantes |
| `identity` | `appointmentsStorage.ts:295` | 🔴 DESCARTAR | Variável declarada e nunca usada |
| `useGoogleReviews` | `useGoogleReviews.ts` | 🔴 DESCARTAR | 0 imports |
| `buildSiteSmgAppointmentPayload` | `smg.ts:92` | 🔴 DESCARTAR | Só no teste |
| `isSmgAppointmentConflict` | `smg.ts:116` | 🔴 DESCARTAR | Só no teste |
| `DASHBOARD` → `HistoryCard` | `Dashboard.tsx` | 🟢 COPIAR | Reaproveitável com rename |
| `getAppointmentSourceLabel` | `useUserAppointments` | 🟢 COPIAR | Reaproveitável com rename |

### 2.2 `SMG_LOUGE`

| Ativo | Arquivo | Classificação | Justificativa |
|---|---|---|---|
| CommandPalette | `CommandPalette.tsx` | 🟡 ADAPTAR | Ctrl/Cmd+K, navegação por React Router |
| KpiCard | `KpiCard.tsx` | 🟢 COPIAR | Padrão de 4 cards com ícone + valor + trend |
| EventKpiCard | `EventKpiCard.tsx` | 🟢 COPIAR | Padrão de cards |
| PageHeader | `PageHeader.tsx` | 🟢 COPIAR | Componente genérico |
| EmptyState | `EmptyState.tsx` | 🟢 COPIAR | Componente genérico |
| StatusBadge | `StatusBadge.tsx` | 🟢 COPIAR | Componente genérico |
| Skeleton | `Skeleton.tsx` | 🟢 COPIAR | Componente genérico |
| OperationalAlerts | `OperationalAlerts.tsx` | 🟡 ADAPTAR | Alertas operacionais |
| ProductRanking | `ProductRanking.tsx` | 🟡 ADAPTAR | Ranking |
| PromoterRanking | `PromoterRanking.tsx` | 🟡 ADAPTAR | Ranking |
| CommissionTable | `CommissionTable.tsx` | 🟡 ADAPTAR | Tabela de comissões |
| CommissionDetailsDrawer | `CommissionDetailsDrawer.tsx` | 🟡 ADAPTAR | Drawer de comissões |
| CommissionAdjustmentModal | `CommissionAdjustmentModal.tsx` | 🟡 ADAPTAR | Modal de ajuste |
| DoorCheckinPage | `DoorCheckinPage.tsx` | 🟡 ADAPTAR | Portaria |
| AccessListPanel | `AccessListPanel.tsx` | 🟡 ADAPTAR | Lista de acesso |
| BraceletDeliveryPanel | `BraceletDeliveryPanel.tsx` | 🟡 ADAPTAR | Entrega de pulseira |
| StockPage | `StockPage.tsx` | 🟡 ADAPTAR | Estoque |
| AppLayout/Sidebar/TopBar | `src/layout/` | 🟡 ADAPTAR | Layout com motion |
| `doorStore`, `uiStore`, `dataStore`, `authStore`, `hookahStore` | `src/store/` | 🔴 DESCARTAR | Apenas self-referencing |
| `commissionStore` | `commissionStore.ts` | 🔴 DESCARTAR | 0 imports |
| `SupabaseSync` | `SupabaseSync.tsx` | 🔴 REESCREVER | Query em `public.*` sem tenant filter |
| `RoleGuard` | `RoleGuard.tsx` | 🔴 DESCARTAR | Não importado |
| `EventExecutiveDashboard` | `EventExecutiveDashboard.tsx` | 🔴 REESCREVER | Passa eventId como tenantId |
| `log_audit_action` | `013_audit_logs.sql` | 🔴 REESCREVER | GUC `app.tenant_id` nunca setado |
| Tokens `warning`, `success`, `secondary` | `index.css` | 🔴 REESCREVER | Não definidos em `@theme` |
| `BrowserRouter` | `App.tsx:1` | 🔴 REESCREVER | Incompatível com HashRouter |
| Zustand | `src/store/` | 🔴 REESCREVER | Incompatível com Context |
| `log_audit_action` | `013_audit_logs.sql` | 🔴 REESCREVER | GUC não setado |

### 2.3 `gerador_orcamentos`

| Ativo | Arquivo | Classificação | Justificativa |
|---|---|---|---|
| Pipeline PDF | `api/process.ts` | 🟡 REFERÊNCIA | Puppeteer + Handlebars |
| Padrão de catálogo | `tenant_id + ativo + partial unique` | 🟡 REFERÊNCIA | Padrão multi-tenant |
| `orcamento.hbs` | `src/templates/orcamento.hbs` | 🟡 REFERÊNCIA | Handlebars BR |
| `budgetRepository.ts` | `src/db/budgetRepository.ts` | 🔴 REESCREVER | 4 chamadas quebradas |
| `useCatalog.ts` | `src/hooks/useCatalog.ts` | 🔴 REESCREVER | 404s — endpoints não existem |
| `api/login.ts` | `api/login.ts` | 🔴 DESCARTAR | Fake — base64 de JSON |
| `api/register.ts` | `api/register.ts` | 🔴 REESCREVER | Password em plaintext |
| `index.html` | `index.html` | 🔴 REESCREVER | service_role JWT |
| `server.ts` | `server.ts` | 🔴 REESCREVER | `node server.ts` falha |
| `src/index.ts` | `src/index.ts` | 🔴 DESCARTAR | CLI nunca referenciado |
| `quote.hbs` | `src/templates/quote.hbs` | 🔴 DESCARTAR | Órfão, mojibake |
| `outputs/` PDFs | `outputs/` | 🔴 REESCREVER | PII de clientes reais |
| `xlsx@0.18.5` | `package.json` | 🔴 REESCREVER | CVEs conhecidos |
| `recharts`, `motion`, `@supabase/ssr` | `package.json` | 🔴 DESCARTAR | Dead deps |
| `GEMINI_API_KEY` | `vite.config.ts` | 🔴 DESCARTAR | Injetado sem consumidor |

### 2.4 `smg-core`

| Ativo | Arquivo | Classificação | Justificativa |
|---|---|---|---|
| `platform_security_events` | `SMG_API` | ⭐ GAP | smg-core tem, sou-manager não |
| `smg_client_apps` | `SMG_ADMIN` | ⭐ GAP | Registry client→app→tenant→schema |
| `app_health_checks` | `SMG_ADMIN` | ⭐ GAP | Fleet monitoring |
| `app_incidents` | `SMG_ADMIN` | ⭐ GAP | Incident tracking |
| `count_active_super_admins()` | `SMG_ADMIN` | ⭐ GAP | Last-admin protection |
| `control.set_updated_at()` | `SMG_ADMIN` | ⭐ GAP | Trigger helper |
| `admin_profiles.status` | `SMG_ADMIN` | ⭐ GAP | Lifecycle vs RBAC |
| RLS + SECURITY DEFINER + `SET search_path` | `SMG_ADMIN` | ⭐ GAP | Hardening pattern |
| `platform_roles` + `platform_permissions` | `SMG_API` | 🔴 DESCARTAR | RBAC morto |
| `platform_plans` | `SMG_API` | 🔴 DESCARTAR | Zero código |
| `platform_feature_flags` | `SMG_API` | 🔴 DESCARTAR | Zero código |
| `platform_integrations` | `SMG_API` | 🔴 DESCARTAR | Zero código |
| `platform_jobs` | `SMG_API` | 🔴 DESCARTAR | Zero código |
| 4 rotas quebradas | `/audit-logs`, etc. | 🔴 REESCREVER | 401 — sem sessão NestJS |
| 4 páginas órfãs | TenantsListPage, etc. | 🔴 DESCARTAR | Não no router |
| `apiClient` (axios) | `api-client.ts` | 🔴 DESCARTAR | Sessão nunca escrita |
| `control-schema-draft.sql` | `SMG_ADMIN` | 🔴 DESCARTAR | Billing draft nunca migrado |
| Tailwind v3 + Vite 5 + React 18 | `SMG_ADMIN` | 🔴 REESCREVER | Divergente de SoT |
| `VITE_USE_MOCK_DATA=true` | `.env.example` | 🔴 REESCREVER | README diz `false` |

### 2.5 `SMG_AUTOCONTROL`

| Ativo | Arquivo | Classificação | Justificativa |
|---|---|---|---|
| Badge de placa mono | `Vehicles.tsx:89-91` | 🟢 COPIAR | `font-mono` + fundo escuro |
| Grade de 4 KPIs | `Dashboard.tsx:38-63` | 🟡 ADAPTAR | Padrão de 4 cards |
| Funil de OS em 4 cards | `ServiceOrders.tsx:30-67` | 🟡 ADAPTAR | Pendente/Execução/Concluídas/Faturamento |
| 3 cards financeiros | `Financial.tsx:44-74` | 🟡 ADAPTAR | Saldo/Entradas/Saídas |
| Domínio automotivo | `types/index.ts` | 🟡 REFERÊNCIA | OS, vehicles, PF/PJ, "aguardando peça" |
| `types/index.ts` | `types/index.ts` | 🟡 REFERÊNCIA | 7 interfaces como semente |
| `Sidebar`/`TopBar`/`DashboardLayout` | `src/components/` | 🔴 DESCARTAR | Conflita com sidebar module-driven |
| `Login.tsx` | `Login.tsx` | 🔴 DESCARTAR | `navigate('/dashboard')` fixo |
| "SSL 256-bit" | `Login.tsx:72-75` | 🔴 DESCARTAR | Claim falso |
| "Ricardo Silva" | `Sidebar.tsx:63-64` | 🔴 DESCARTAR | Nome de terceiro hardcoded |
| `express`/`dotenv`/`tsx` | `package.json` | 🔴 DESCARTAR | 6 deps mortas de 15 |
| `metadata.json` | `metadata.json` | 🔴 DESCARTAR | Artefato AI Studio |
| `README.md` | `README.md` | 🔴 DESCARTAR | 100% boilerplate |
| Tokens `#00236f` | `index.css` | 🟣 MANTER SEPARADO | Palete por appSlug |
| `BrowserRouter` | `App.tsx` | 🔴 REESCREVER | Incompatível com HashRouter |
| `company_id` | `types/index.ts` | 🔴 REESCREVER | → `tenant_id` |

### 2.6 `SMG_LADINGPAGE`

| Ativo | Arquivo | Classificação | Justificativa |
|---|---|---|---|
| PainPoints | `PainPoints.tsx` | 🟢 COPIAR | 5 dores validadas |
| Differentiators | `Differentiators.tsx` | 🟢 COPIAR | Tabela 4 eixos |
| Design tokens | `index.css:4-55` | 🟢 COPIAR | 6 tokens + 6 classes |
| Features | `Features.tsx` | 🟡 ADAPTAR | Reordenar para priorizar comissões |
| Tese de origem | `Testimonial.tsx:28-30` | 🟡 ADAPTAR | Copy excelente, seção errada |
| Ecosystem | `Ecosystem.tsx` | 🟡 ADAPTAR | Corrigir nomenclatura |
| Catálogo de produtos (git) | `OLD_App.tsx:570-693` | 🟡 ADAPTAR | Smart Booking, Split de Pagamento |
| System prompt do chatbot | `OLD_App.tsx:66-79` | 🟡 ADAPTAR | Voz da marca |
| Hero | `Hero.tsx` | 🔴 REFERÊNCIA | Genérico demais para Barber |
| Promise | `Promise.tsx` | 🔴 REFERÊNCIA | Decorativo |
| Technology | `Technology.tsx` | 🔴 REFERÊNCIA | Claims amplos |
| ProductExperience | `ProductExperience.tsx` | 🔴 REFERÊNCIA | Mockups falsos |
| FinalCTA | `FinalCTA.tsx` | 🔴 REESCREVER | CTA quebrado + WhatsApp fake |
| Footer | `Footer.tsx` | 🔴 REESCREVER | Dados placeholder |
| Barra de métricas | `OLD_App.tsx:695-715` | ⚫ DESCARTAR | Números não verificáveis |
| Formulário de contato | `OLD_App.tsx:790-893` | ⚫ DESCARTAR (código) / 🟡 REFERÊNCIA (UX) | Nunca teve backend |
| Chatbot IA | `OLD_App.tsx:37-190` | ⚫ DESCARTAR | Exporia chave |
| `metadata.json` | `metadata.json` | ⚫ DESCARTAR | Artefato AI Studio |
| `.env.example` | `.env.example` | ⚫ DESCARTAR | AI Studio/Cloud Run |
| `GEMINI_API_KEY` | `vite.config.ts:11` | ⚫ DESCARTAR | Injeta segredo |
| CSS morto | `index.css:57-62, 84-89` | ⚫ DESCARTAR | `.tech-lines`, `.glow-line-vertical` |
| Keywords meta | `index.html:13` | ⚫ DESCARTAR | Segmentos inexistentes |
| `#ecossistema` | `Ecosystem.tsx:32` | 🟣 MANTER SEPARADO | Seção órfã da navegação |

---

## 3. Resumo Quantitativo

| Classificação | Quantidade | % |
|---|---|---|
| 🟢 COPIAR | ~15 | 12% |
| 🟡 ADAPTAR | ~30 | 24% |
| 🟡 REFERÊNCIA | ~25 | 20% |
| 🟠 REESCREVER | ~15 | 12% |
| 🟣 MANTER SEPARADO | ~10 | 8% |
| 🔴 DESCARTAR | ~30 | 24% |

**→ ~36% do inventário é reaproveitável (COPIAR + ADAPTAR). ~20% é referência. ~24% é descartável.**

---

## 4. Ativos Mais Valiosos (Top 10)

| # | Ativo | Origem | Classificação | Valor |
|---|---|---|---|---|
| 1 | `site-sanchez-appointments` Edge Function | sou-manager | ⭐ SoT | Production-grade, advisory lock, idempotência |
| 2 | `platform_security_events` | smg-core | ⭐ GAP | smg-core tem, sou-manager não |
| 3 | `smg_client_apps` registry | smg-core | ⭐ GAP | Fleet monitoring cross-tenant |
| 4 | PainPoints copy | LADINGPAGE | 🟢 COPIAR | 5 dores validadas |
| 5 | Differentiators table | LADINGPAGE | 🟢 COPIAR | 4 eixos persuasivos |
| 6 | Design tokens | LADINGPAGE | 🟢 COPIAR | Brand kit reutilizável |
| 7 | Booking wizard UX | sanchez | 🟡 ADAPTAR | Melhor UX do ecossistema |
| 8 | CommandPalette | LOUGE | 🟡 ADAPTAR | Ctrl/Cmd+K |
| 9 | DoorCheckin/Stock | LOUGE | 🟡 ADAPTAR | Módulos operacionais |
| 10 | Domínio automotivo | AUTOCONTROL | 🟡 REFERÊNCIA | OS, vehicles, PF/PJ |
