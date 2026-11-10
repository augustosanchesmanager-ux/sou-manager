# Mapa de UX e Componentes

**Data:** 2026-09-27 | **Modo:** READ-ONLY

---

## 1. `sou-manager` — Componentes de Referência

### 1.1 Design System

| Componente | Caminho | Propósito |
|---|---|---|
| ThemeProvider | `context/ThemeProvider.tsx` | Tema claro/escuro |
| Tailwind v4 | `src/index.css` | CSS-based config |
| `@/` alias | `vite.config.ts` | Repo root |

### 1.2 Observability Components

| Componente | Caminho | Propósito |
|---|---|---|
| `logger.ts` | `src/lib/observability/` | Structured logging |
| `events.ts` | `src/lib/observability/` | Business events catalog |
| `metrics.ts` | `src/lib/observability/` | Metrics collection |
| `alerts.ts` | `src/lib/observability/` | 14 alert rules + webhooks |
| `instrumentation.ts` | `src/lib/observability/` | Declarative wrapper |
| `useObservability.ts` | `src/lib/observability/` | React hook |

### 1.3 Event Bus Components

| Componente | Caminho | Propósito |
|---|---|---|
| `EventBus` | `domain/events/bus.ts` | Interface |
| `InMemoryEventBus` | `domain/events/memory-bus.ts` | Implementation |
| `EventStoreRepository` | `domain/events/eventStore.ts` | Interface |
| `InMemoryEventStore` | `domain/events/inMemoryEventStore.ts` | Implementation |
| `SubscriberRegistry` | `domain/events/subscribers/` | Event handlers |
| `Outbox` | `domain/events/outbox/` | Queue |
| `Dispatcher` | `domain/events/outbox/dispatcher.ts` | Dispatch |
| `FinanceProvider` | `domain/events/outbox/providers/financeProvider.ts` | Financial executor |

---

## 2. `sanchez-barber-iastudio` — UX Components

### 2.1 Scheduling Flow (Melhor UX do repo)

| Componente | Arquivo | LOC | Classificação |
|---|---|---|---|
| `SchedulingFlow.tsx` | `src/components/SchedulingFlow.tsx` | 554 | 🟡 ADAPTAR |
| `StepIndicator` | `src/components/scheduling/` | — | 🟡 ADAPTAR |
| `useSchedulingState` | `src/components/scheduling/` | — | 🟡 ADAPTAR |
| `data.ts` (catálogo) | `src/components/scheduling/data.ts` | 8 serviços | 🟡 REFERÊNCIA |
| `AppointmentPortal.tsx` | `src/components/AppointmentPortal.tsx` | 694 | 🟡 REFERÊNCIA (UI) / 🔴 DESCARTAR |
| `Dashboard.tsx` | `src/components/Dashboard.tsx` | 364 | 🟡 ADAPTAR |
| `AdminDashboard.tsx` | `src/components/AdminDashboard.tsx` | 341 | 🟠 ADAPTAR COM RESSALVAS |

### 2.2 Landing Page (10 componentes, 0 imports)

| Componente | Arquivo | Classificação |
|---|---|---|
| `Hero` | `src/components/Hero.tsx` | 🟡 REFERÊNCIA (design) / 🔴 DESCARTAR |
| `Navbar` | `src/components/Navbar.tsx` | 🟡 REFERÊNCIA |
| `Footer` | `src/components/Footer.tsx` | 🟡 REFERÊNCIA |
| `Services` | `src/components/Services.tsx` | 🔴 DESCARTAR |
| `Gallery` | `src/components/Gallery.tsx` | 🔴 DESCARTAR |
| `Mission` | `src/components/Mission.tsx` | 🔴 DESCARTAR |
| `Testimonials` | `src/components/Testimonials.tsx` | 🔴 DESCARTAR |
| `Contact` | `src/components/Contact.tsx` | 🔴 DESCARTAR |
| `Club` | `src/components/Club.tsx` | 🔴 DESCARTAR |
| `FloatingWhatsApp` | `src/components/FloatingWhatsApp.tsx` | 🔴 DESCARTAR |

### 2.3 UX Patterns Identificados

| Padrão | Evidência | Classificação |
|---|---|---|
| Wizard de 7 passos | `AppointmentPortal.tsx` | 🟡 REFERÊNCIA |
| Animação `motion` por step | `SchedulingFlow.tsx` | 🟡 ADAPTAR |
| Fallback WhatsApp em falha de integração | `SchedulingFlow.tsx:458-474` | 🟡 ADAPTAR |
| Tratamento de conflito `SmgSyncError.code === 'conflict'` | `SchedulingFlow.tsx` | 🟡 ADAPTAR |
| Validação de telefone (10-11 dígitos) | `SchedulingFlow.tsx` | 🟡 ADAPTAR |
| CSV export com escape correto | `AdminDashboard.tsx:30-64` | 🟡 ADAPTAR |

---

## 3. `SMG_LOUGE` — UX Components

### 3.1 Layout

| Componente | Caminho | Classificação |
|---|---|---|
| `AppLayout` | `src/layout/AppLayout.tsx` | 🟡 ADAPTAR |
| `Sidebar` | `src/layout/Sidebar.tsx` | 🟡 ADAPTAR |
| `TopBar` | `src/layout/TopBar.tsx` | 🟡 ADAPTAR |
| `MobileNav` | `src/layout/MobileNav.tsx` | 🟡 ADAPTAR |

### 3.2 UI Components

| Componente | Caminho | Classificação |
|---|---|---|
| `CommandPalette` | `src/components/layout/CommandPalette.tsx` | 🟡 ADAPTAR |
| `NotificationsPanel` | `src/components/layout/NotificationsPanel.tsx` | 🟡 ADAPTAR |
| `QuickActionsMenu` | `src/components/layout/QuickActionsMenu.tsx` | 🟡 ADAPTAR |
| `KpiCard` | `src/components/ui/KpiCard.tsx` | 🟢 COPIAR |
| `EventKpiCard` | `src/modules/dashboard/components/EventKpiCard.tsx` | 🟢 COPIAR |
| `PageHeader` | `src/components/ui/PageHeader.tsx` | 🟢 COPIAR |
| `EmptyState` | `src/components/ui/EmptyState.tsx` | 🟢 COPIAR |
| `StatusBadge` | `src/components/ui/StatusBadge.tsx` | 🟢 COPIAR |
| `Skeleton` | `src/components/ui/Skeleton.tsx` | 🟢 COPIAR |
| `CommissionStatusBadge` | `src/modules/commissions/components/CommissionStatusBadge.tsx` | 🟢 COPIAR |

### 3.3 Dashboard Components

| Componente | Caminho | Classificação |
|---|---|---|
| `OperationalAlerts` | `src/modules/dashboard/components/OperationalAlerts.tsx` | 🟡 ADAPTAR |
| `ProductRanking` | `src/modules/dashboard/components/ProductRanking.tsx` | 🟡 ADAPTAR |
| `PromoterRanking` | `src/modules/dashboard/components/PromoterRanking.tsx` | 🟡 ADAPTAR |
| `EventExecutiveDashboard` | `src/modules/dashboard/pages/EventExecutiveDashboard.tsx` | 🔴 REESCREVER |
| `DashboardPage` | `src/pages/DashboardPage.tsx` | 🟡 ADAPTAR |

### 3.4 Commission Components

| Componente | Caminho | Classificação |
|---|---|---|
| `CommissionSummaryCards` | `src/modules/commissions/components/CommissionSummaryCards.tsx` | 🟡 ADAPTAR |
| `CommissionTable` | `src/modules/commissions/components/CommissionTable.tsx` | 🟡 ADAPTAR |
| `CommissionDetailsDrawer` | `src/modules/commissions/components/CommissionDetailsDrawer.tsx` | 🟡 ADAPTAR |
| `CommissionAdjustmentModal` | `src/modules/commissions/components/CommissionAdjustmentModal.tsx` | 🟡 ADAPTAR |
| `PromoterCommissionsPage` | `src/modules/commissions/pages/PromoterCommissionsPage.tsx` | 🟡 ADAPTAR |

### 3.5 Door/Portaria Components

| Componente | Caminho | Classificação |
|---|---|---|
| `DoorCheckinPage` | `src/modules/door/pages/DoorCheckinPage.tsx` | 🟡 ADAPTAR |
| `AccessListPanel` | `src/modules/door/pages/AccessListPanel.tsx` | 🟡 ADAPTAR |
| `BraceletDeliveryPanel` | `src/modules/door/pages/BraceletDeliveryPanel.tsx` | 🟡 ADAPTAR |
| `useDoorCheckin` | `src/hooks/useDoorCheckin.ts` | 🟡 ADAPTAR |
| `doorService` | `src/services/doorService.ts` | 🟡 ADAPTAR |

### 3.6 Stock Components

| Componente | Caminho | Classificação |
|---|---|---|
| `StockPage` | `src/modules/stock/pages/StockPage.tsx` | 🟡 ADAPTAR |
| `useStock` | `src/hooks/useStock.ts` | 🟡 ADAPTAR |
| `stockService` | `src/services/stockService.ts` | 🟡 ADAPTAR |

### 3.7 Dead Stores (Zustand)

| Store | Evidência | Classificação |
|---|---|---|
| `doorStore` | Apenas self-referencing, `alert()` | 🔴 DESCARTAR |
| `uiStore` | Apenas self-referencing | 🔴 DESCARTAR |
| `dataStore` | Apenas self-referencing | 🔴 DESCARTAR |
| `authStore` | Apenas self-referencing | 🔴 DESCARTAR |
| `hookahStore` | Apenas self-referencing | 🔴 DESCARTAR |
| `commissionStore` | 0 imports | 🔴 DESCARTAR |

### 3.8 Token Gaps

| Token | Uso | Status |
|---|---|---|
| `warning` | `KpiCard.toneClasses` | ❌ Não definido em `@theme` |
| `success` | `KpiCard.toneClasses` | ❌ Não definido em `@theme` |
| `secondary` | Vários | ❌ Não definido em `@theme` |

---

## 4. `SMG_AUTOCONTROL` — UX Components

### 4.1 Componentes Aproveitáveis

| Componente | Arquivo | Classificação |
|---|---|---|
| Badge de placa mono | `Vehicles.tsx:89-91` | 🟢 COPIAR |
| Grade de 4 KPIs | `Dashboard.tsx:38-63` | 🟡 ADAPTAR |
| Funil de OS em 4 cards | `ServiceOrders.tsx:30-67` | 🟡 ADAPTAR |
| 3 cards financeiros | `Financial.tsx:44-74` | 🟡 ADAPTAR |
| Avatar por iniciais | `Clients.tsx:67-69` | 🟡 REFERÊNCIA |
| Seletor de idioma | `TopBar.tsx:19-23` | 🟡 REFERÊNCIA |
| "Dica de Cadastro" | `NewClient.tsx:136-144` | 🟡 REFERÊNCIA |
| Menu de 6 abas | `Settings.tsx:16-23` | 🟡 REFERÊNCIA |
| Badge contador pendente | `Sidebar.tsx:50-52` | 🟡 REFERÊNCIA |

### 4.2 Componentes a Descartar

| Componente | Evidência | Classificação |
|---|---|---|
| `Login.tsx` | `navigate('/dashboard')` fixo | 🔴 DESCARTAR |
| `Sidebar.tsx`/`TopBar.tsx`/`DashboardLayout.tsx` | Conflita com sidebar module-driven | 🔴 DESCARTAR |
| "SSL 256-bit" | Claim falso | 🔴 DESCARTAR |
| "Ricardo Silva / Gerente" | Nome de terceiro hardcoded | 🔴 DESCARTAR |
| "Esqueceu a senha?" | Botão sem handler | 🔴 DESCARTAR |
| "Comece seu teste grátis" | Botão sem handler | 🔴 DESCARTAR |
| "Sair" | Botão sem handler | 🔴 DESCARTAR |

### 4.3 Design Tokens (Conflito de Marca)

| Token | Valor | Problema |
|---|---|---|
| `--color-primary` | `#00236f` (azul-marinho automotive) | 🔴 MANTER SEPARADO — não usar no SMG Barber |
| `--color-primary-container` | `#1e3a8a` | 🔴 MANTER SEPARADO |
| `--color-secondary` | `#006d30` | 🔴 MANTER SEPARADO |
| `--font-sans` | "Inter" | 🔴 MANTER SEPARADO |
| `--font-headline` | "Manrope" | 🔴 MANTER SEPARADO |

---

## 5. `SMG_LADINGPAGE` — UX Components

### 5.1 Seções e Componentes

| Componente | Arquivo | Classificação |
|---|---|---|
| `Navbar` | `Navbar.tsx` | 🟡 REFERÊNCIA |
| `Hero` | `Hero.tsx` | 🔴 REFERÊNCIA |
| `PainPoints` | `PainPoints.tsx` | 🟢 COPIAR |
| `Promise` | `Promise.tsx` | 🔴 REFERÊNCIA |
| `Features` | `Features.tsx` | 🟡 ADAPTAR |
| `Ecosystem` | `Ecosystem.tsx` | 🟡 ADAPTAR |
| `Differentiators` | `Differentiators.tsx` | 🟢 COPIAR |
| `Testimonial` | `Testimonial.tsx` | 🟡 ADAPTAR |
| `ProductExperience` | `ProductExperience.tsx` | 🔴 REFERÊNCIA |
| `Technology` | `Technology.tsx` | 🔴 REFERÊNCIA |
| `FinalCTA` | `FinalCTA.tsx` | 🔴 REESCREVER |
| `Footer` | `Footer.tsx` | 🔴 REESCREVER |

### 5.2 Design Tokens

| Token | Valor | Uso |
|---|---|---|
| `--color-smg-cyan` | `#00D2FF` | `@theme` |
| `--color-smg-blue` | `#0181C6` | `@theme` |
| `--color-smg-deep` | `#035196` | `@theme` |
| `--color-smg-dark` | `#003A60` | `@theme` |
| `--color-smg-base` | `#03355C` | `@theme` |
| `--color-smg-bg` | `#02060F` | `@theme` |
| `--font-sans` | "Montserrat" | `@theme` |

**Problema:** Componentes repetem hex literais (~150 lugares) em vez de usar tokens.

### 5.3 CSS Utilitárias

| Classe | Propósito | Status |
|---|---|---|
| `.glass-card` | Card glass | ✅ Usada |
| `.tech-card` | Card tecnologia | ✅ Usada |
| `.text-gradient` | Texto gradiente | ✅ Usada |
| `.glow-blue` | Glow azul | ✅ Usada |
| `.stars-bg` | Background estrelas | ✅ Usada |
| `.curved-lines` | Linhas curvas | ✅ Usada |
| `.tech-lines` | — | ❌ CSS morto |
| `.glow-line-vertical` | — | ❌ CSS morto |

---

## 6. Matriz de Reuso UX Consolidada

| Classificação | Quantidade | Exemplos |
|---|---|---|
| 🟢 COPIAR | ~12 | KpiCard, PageHeader, EmptyState, StatusBadge, Skeleton, PainPoints, Differentiators, badge placa |
| 🟡 ADAPTAR | ~25 | SchedulingFlow, Dashboard, CommandPalette, DoorCheckin, Stock, 4 KPIs, funil OS, 3 cards financeiros |
| 🟡 REFERÊNCIA | ~20 | Landing components, Hero, Promise, Technology, ProductExperience, avatar, seletor idioma |
| 🟠 REESCREVER | ~5 | Sync, availability, reschedule, executive dashboard, FinalCTA |
| 🟣 MANTER SEPARADO | ~8 | Tokens AUTOCONTROL, sidebar AUTOCONTROL, LOUGE promoter/hookah/KDS |
| 🔴 DESCARTAR | ~25 | 10 landing components, dead stores, Login AUTOCONTROL, SSL claim, etc. |
