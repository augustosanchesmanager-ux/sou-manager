# Inventário Arquitetural — SOU MANA.GER

> Fase 1.5 — Documento de mapeamento. Sem alterações de código.
> Gerado em: 2026-07-20

---

## 1. Métricas Gerais

| Métrica | Valor |
|---|---|
| Total de arquivos `.tsx` | 186 |
| Total de arquivos `.ts` | 85 |
| Total de arquivos | 271 |
| Total de linhas de código | 63.377 |
| Média de linhas por arquivo | 234 |
| Páginas (components de rota) | 67 |
| Tabelas Supabase acessadas | 38 |
| RPCs utilizadas | 9 |
| Context providers | 5 |
| Hooks compartilhados | 10 |
| Libraries compartilhadas | 29 arquivos |
| Services | 5 |
| Módulos de app | 4 (barber, estetica = ativos; club, auto = inativos) |

---

## 2. Módulos do Sistema

### 2.1 Módulos de Domínio

| Módulo | Responsabilidade | Arquivos Principais | Linhas |
|---|---|---|---|
| **Schedule** | Agendamento, calendário, drag-and-drop, bloqueios, conflitos | `Schedule.tsx`, `hooks/useScheduleBaseData.ts` | ~4.050 |
| **Checkout** | POS, comanda, itens, participantes, pagamento, settlement | `Checkout.tsx` | ~3.130 |
| **Financeiro** | Fluxo de caixa, contas a receber, recibos, despesas | `Cashflow.tsx`, `AccountsReceivable.tsx`, `Receipts.tsx`, `Expenses.tsx`, `FinancialOverview.tsx` | ~5.140 |
| **Comissão** | Cálculo de comissão por profissional, exportação CSV | `Commissions.tsx` | ~1.410 |
| **Caixa** | Fechamento diário, conferência por barbeiro, sangria/suprimento | `CashClosingPage.tsx`, `useCashClosing.ts` | ~1.910 |
| **Clientes** | CRUD, importação CSV, exclusão em cascata | `Clients.tsx` | ~1.030 |
| **Comandas** | Listagem, filtros, fechamento em lote, status | `Comandas.tsx` | ~1.680 |
| **Club dos Chefes** | Planos, assinaturas, recebimentos, créditos | `ChefClubPlans.tsx`, `ChefClubSubscriptions.tsx`, `ChefClubSubscriptionNew.tsx`, `ChefClubSubscriptionDetail.tsx`, `ChefClubReceivables.tsx` | ~3.060 |
| **Produtos/Serviços** | Catálogo, preços, categorias, promoções | `Products.tsx`, `Services.tsx`, `Categories.tsx`, `Promotions.tsx` | ~1.210 |
| **Equipe** | Staff CRUD, permissões, roles | `Team.tsx`, `AccessControl.tsx` | ~880 |
| **Financeiro/Compras** | Ordens de compra, fornecedores | `Orders.tsx`, `Suppliers.tsx` | ~910 |
| **Dashboard** | Métricas, widgets, ações rápidas | `Dashboard.tsx`, `src/modules/dashboard/*` | ~1.500 |
| **BI/Analytics** | Relatórios, insights, dashboard estratégico | `BusinessIntelligence.tsx`, `StrategicDashboard.tsx`, `hooks/useBusinessInsights.ts` | ~1.480 |
| **Kiosk** | Totem, QR code, feedback | `KioskAdmin.tsx`, `pages/kiosk/*` | ~1.890 |
| **Portal** | Portal do cliente, agendamento público | `pages/portal/*` | ~1.740 |
| **SuperAdmin** | Multi-tenant admin, tickets, auditoria | `Admin.tsx`, `SuperAdmin.tsx` | ~1.590 |

### 2.2 Módulos Infraestruturais

| Módulo | Responsabilidade | Arquivos |
|---|---|---|
| **Auth** | Sessão, login, registro, roles | `context/AuthContext.tsx`, `Login.tsx`, `Register.tsx` |
| **Tenant** | Resolução de tenant, multi-tenancy | `src/context/TenantContext.tsx`, `src/lib/supabase/tenant.ts` |
| **App** | Resolução de app slug/schema | `src/context/AppContext.tsx`, `src/modules/*` |
| **Permissões** | RBAC, definições por role | `src/lib/permissions/*` |
| **Offline** | IndexedDB, fila de sync | `src/lib/offline/*`, `OfflineSync.tsx` |
| **Supabase Client** | Cliente, demo mode, schema routing | `src/lib/supabase/client.ts` (2.314 linhas) |

---

## 3. Fluxos Críticos

### 3.1 Fluxo Principal: Agendamento → Checkout → Financeiro → Comissão → Caixa

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌─────────────┐
│   SCHEDULE   │────▶│  CHECKOUT   │────▶│  FINANCEIRO  │────▶│  COMISSÃO    │────▶│    CAIXA    │
│              │     │             │     │              │     │              │     │             │
│ appointments │     │ comandas    │     │ transactions │     │ comanda_items│     │ cash_closings│
│ comandas     │     │ comanda_ite │     │ financial_re │     │ comanda_item │     │ barber_clos │
│ services     │     │ participants│     │ versals      │     │ participants │     │ cash_closing │
│ staff        │     │ products    │     │              │     │ staff        │     │ _events     │
│ clients      │     │ promotions  │     │              │     │              │     │             │
│              │     │ chef_club   │     │              │     │              │     │             │
└─────────────┘     └─────────────┘     └──────────────┘     └──────────────┘     └─────────────┘
     RPC:                RPC:                Direto:              Direto:              Direto:
  create_appoint    finance_settle       .from('trans-     .from('comanda_     .from('cash_clos
  _with_comanda     _comanda             actions')          items')             ings')
  create_appoint                        .from('financi                         .from('barber_clos
  _with_services                        al_reversals')                         ings')
```

### 3.2 Fluxo de Cancelamento

```
Schedule/Appointment Cancel
    │
    ├─▶ appointments.update({ status: 'cancelled' })
    ├─▶ comandas.update({ status: 'cancelled' })  ← [SYNC][COMANDA] (Fase 1)
    │
    └─▶ (se já pagou) finance_reverse_transaction RPC
```

### 3.3 Fluxo de Exclusão de Cliente

```
Client Delete (Clients.tsx)
    │
    ├─▶ comanda_items.delete() (por comanda_id)
    ├─▶ Promise.allSettled([
    │       appointments.delete(),
    │       portal_sessions.delete(),
    │       feedback_barber.delete(),
    │       feedback_shop.delete(),
    │       kiosk_sessions.delete(),
    │       customer_credits.delete(),
    │       customer_subscriptions.delete(),
    │       customer_vouchers.delete(),
    │       comandas.delete()
    │   ])                                    ← [SMG][CLIENT] (Fase 1)
    │
    └─▶ clients.delete()
```

### 3.4 Fluxo de Fechamento de Caixa

```
Cash Closing (useCashClosing.ts)
    │
    ├─▶ transactions.insert(extras)           ← Sangrias/Suprimentos
    ├─▶ cash_closings.upsert(...)             ← [SMG][CASH][CLOSE] (Fase 1)
    │
    └─▶ Por barbeiro:
        ├─▶ barber_closings.upsert(...)
        ├─▶ cash_closing_events.insert(...)   ← [SMG][CASH][EVENT] (Fase 1)
        └─▶ cash_closings.update(counts)      ← [SMG][CASH][BARBER_CLOSE] (Fase 1)
```

---

## 4. Duplicações de Regras de Negócio

### 4.1 CRÍTICO: Cálculo de Comissão/Payout (5 cópias)

| Função | Arquivo | Linha |
|---|---|---|
| `normalizePercentageValue` | `Checkout.tsx` | 184 |
| `normalizePercentage` | `Commissions.tsx` | 168 |
| `normalizeParticipantPercentage` | `Comandas.tsx` | 907 |
| `normalizeParticipantPercentage` | `Schedule.tsx` | 1768 |

**Algoritmo idêntico**: `value > 1 ? value / 100 : value`

| Função | Arquivo | Linha |
|---|---|---|
| `calculateParticipantPayout` | `Checkout.tsx` | 1206 |
| `getParticipantBaseValue` | `Commissions.tsx` | 211 |
| `getParticipantSharedValue` | `Comandas.tsx` | 913 |
| `getParticipantSharedValue` | `Schedule.tsx` | 1774 |

**Risco**: `src/types/executionParticipants.ts` usa `payout_value / 100` (divisão direta), enquanto as 4 cópias usam `> 1 ? / 100`. **Inconsistência semântica potencial.**

| Função | Arquivo |
|---|---|
| `formatPayoutValue` | `Checkout.tsx` |
| `formatSavedPayout` | `Commissions.tsx` |
| `formatParticipantPayout` | `Comandas.tsx`, `Schedule.tsx` |
| `getParticipantStaffId` | `Checkout.tsx`, `Comandas.tsx`, `Schedule.tsx`, `Commissions.tsx` |
| `isSharedExecution` / `isSharedServiceItem` | `Checkout.tsx`, `Comandas.tsx`, `Schedule.tsx` |
| `formatExportMoney` / variants | `Comandas.tsx`, `Schedule.tsx`, `Commissions.tsx` |

**Total: ~15 funções duplicadas em 4+ arquivos.**

### 4.2 ALTO: Labels e Cores de Status (8+ cópias)

| Entidade | Arquivo | Tipo |
|---|---|---|
| Comanda status | `Comandas.tsx` | labels + colors |
| Appointment status | `Schedule.tsx`, `AppointmentDetailModal.tsx` | labels + colors |
| Order status | `Orders.tsx` | labels + colors |
| Subscription status | `ChefClubSubscriptions.tsx` | labels |
| Receivable status | `ChefClubReceivables.tsx` | labels |
| Ticket status | `SuperAdmin.tsx` | labels |
| Commission status | `Commissions.tsx` | labels |

### 4.3 ALTO: Client Lookup (16+ cópias)

`.from('clients').select(...)` em 16+ arquivos. Sem hook ou service centralizado.

### 4.4 ALTO: Staff Lookup (15+ cópias)

`.from('staff').select(...)` em 15+ arquivos. Sem hook ou service centralizado.

### 4.5 ALTO: formatCurrency (12+ definições + 87+ inline)

3 implementações diferentes:
- `Intl.NumberFormat` (9 arquivos)
- `.toLocaleString()` (1 arquivo)
- `R$` + `.toFixed(2)` (2 arquivos)
- Inline `toLocaleString('pt-BR', ...)` 87+ vezes

### 4.6 ALTO: Toast State (31 cópias)

`const [toast, setToast] = useState<...>` em 31 arquivos. Dois formatos diferentes de tipo.

### 4.7 MODERADO: Date Period Functions (3 cópias)

| Função | Arquivo | Períodos |
|---|---|---|
| `getPeriodDates` | `useStrategicDashboard.ts` | today/week/month |
| `getPeriodDates` | `useBusinessInsights.ts` | today/7d/30d/90d |
| `periodStart` | `SuperAdmin.tsx` | 24h/7d/30d/90d |

### 4.8 MODERADO: Reversal Logic (3 cópias)

Padrão de reversal (type/amount/reason/refund-method/state-management) implementado independentemente em:
- `AccountsReceivable.tsx`
- `Cashflow.tsx`
- `Receipts.tsx`

---

## 5. Acoplamento ao Supabase

### 5.1 Pages com queries diretas ao Supabase

| Page | Tabelas acessadas | RPCs |
|---|---|---|
| `Schedule.tsx` | 11 tabelas | 2 RPCs |
| `Checkout.tsx` | 12 tabelas | 1 RPC |
| `AccountsReceivable.tsx` | 9 tabelas | 1 RPC |
| `Comandas.tsx` | 4 tabelas | 2 RPCs |
| `Commissions.tsx` | 5 tabelas | 0 |
| `Cashflow.tsx` | 2 tabelas | 0 |
| `Receipts.tsx` | 2 tabelas | 0 |
| `Clients.tsx` | 3 tabelas | 0 |
| `Admin.tsx` | 7 tabelas | 0 |
| `SuperAdmin.tsx` | 8 tabelas | 0 |
| `Settings.tsx` | 1 tabela | 0 |
| `Orders.tsx` | 3 tabelas | 1 RPC |
| `BusinessIntelligence.tsx` | 4 tabelas | 0 |
| `KioskAdmin.tsx` | 7 tabelas | 0 |
| `PortalSchedule.tsx` | 5 tabelas | 0 |
| `ChefClubReceivables.tsx` | 3 tabelas | 2 RPCs |
| `ChefClubSubscriptionNew.tsx` | 3 tabelas | 1 RPC |

### 5.2 Hooks com queries diretas ao Supabase

| Hook | Tabelas acessadas |
|---|---|
| `useCashClosing.ts` | 6+ tabelas (comandas, comanda_items, transactions, staff, appointments, financial_reversals) |
| `useBusinessInsights.ts` | 4+ tabelas |
| `useStrategicDashboard.ts` | 5+ tabelas |
| `useScheduleBaseData.ts` | 4 tabelas |
| `useMembershipOverview.ts` | 4 tabelas |

### 5.3 Padrão atual

```
Page → supabase.from('table') → Dados diretos
```

### 5.4 Padrão alvo (Fase 2)

```
Page → Service → Repository → supabase.from('table')
```

---

## 6. Complexidade por Arquivo

### 6.1 CRÍTICO (> 1.500 linhas) — 5 arquivos, 12.141 linhas

| Arquivo | Linhas | Responsabilidade Principal |
|---|---|---|
| `pages/Schedule.tsx` | 3.880 | Calendário + agendamento + bloqueios + export CSV |
| `pages/Checkout.tsx` | 3.134 | POS + comanda + settlement + chef club + participants |
| `pages/AccountsReceivable.tsx` | 2.313 | Contas a receber + reversals + settlements |
| `src/lib/supabase/client.ts` | 2.314 | Cliente Supabase + DEMO MODE COMPLETO |
| `pages/Comandas.tsx` | 1.677 | Listagem + filtros + fechamento em lote |

### 6.2 ALTO (1.001–1.500 linhas) — 4 arquivos, 4.701 linhas

| Arquivo | Linhas | Responsabilidade Principal |
|---|---|---|
| `pages/Commissions.tsx` | 1.414 | Cálculo de comissão + export CSV |
| `pages/Receipts.tsx` | 1.237 | Recibos + reversals |
| `pages/Admin.tsx` | 1.144 | Super-admin + tickets + Realtime |
| `src/hooks/useCashClosing.ts` | 1.139 | Orquestração de fechamento de caixa |

### 6.3 MÉDIO (601–1.000 linhas) — 9 arquivos, 6.514 linhas

| Arquivo | Linhas |
|---|---|
| `pages/Clients.tsx` | 960 |
| `pages/Cashflow.tsx` | 946 |
| `pages/Settings.tsx` | 810 |
| `pages/SupabaseMonitoring.tsx` | 699 |
| `components/Sidebar.tsx` | 693 |
| `pages/BusinessIntelligence.tsx` | 688 |
| `components/financial/cashCloseUtils.ts` | 684 |
| `pages/KioskAdmin.tsx` | 611 |
| `pages/ChefClubPlans.tsx` | 604 |

### 6.4 Resumo de Complexidade

| Tier | Arquivos | Linhas | % do Total |
|---|---|---|---|
| CRITICAL (> 1.500) | 5 | 12.141 | 19,2% |
| HIGH (1.001–1.500) | 4 | 4.701 | 7,4% |
| MEDIUM (601–1.000) | 9 | 6.514 | 10,3% |
| Normal (≤ 600) | 253 | 40.021 | 63,1% |

**18 arquivos (6,6% do codebase) = 23.356 linhas (36,9% do código).**

---

## 7. Estrutura de Diretórios Atual vs Proposta

### 7.1 Atual

```
src/
├── context/          (5 providers)
├── hooks/            (8 hooks)
├── lib/
│   ├── supabase/     (client, schemas, tenant, errors, chefClub)
│   ├── finance/      (settlement, reversal, zeroClose, discountAudit)
│   ├── permissions/  (definitions, presets, service, types, usePermissions)
│   ├── staff/        (roles)
│   ├── offline/      (offlineDb, offlineCache, offlineQueue, offlineTypes)
│   ├── apps/         (catalog, modules, moduleRegistry, businessLabels, publicUrl)
│   ├── utils/        (phone, chefClubCredits)
│   ├── vouchers/     (index)
│   ├── audit-adjustments/ (index, types)
│   └── catalog/      (display)
├── modules/          (barber, club, auto, estetica, dashboard)
├── services/         (notificationsService)
├── types/            (executionParticipants)
└── utils/            (chefClubCredits)
pages/                (67 pages - monolitos)
components/           (sidebar, modals, charts, financial)
context/              (AuthContext, ThemeContext, LoadingContext)
hooks/                (useStrategicDashboard, useScheduleBaseData)
services/             (supabaseClient, portalApi, scheduleBlocksApi, geminiService)
```

### 7.2 Proposta para Fase 2

```
src/
├── domain/                          # NOVO — Regras de negócio puras
│   ├── appointment/
│   │   ├── Appointment.ts           # Tipo + validação
│   │   ├── statusTransitions.ts     # Transições de status
│   │   └── conflictDetection.ts     # Detecção de conflitos
│   ├── checkout/
│   │   ├── Comanda.ts               # Tipo + validação
│   │   ├── ComandaItem.ts           # Tipo + validação
│   │   └── checkoutRules.ts         # Regras de fechamento
│   ├── finance/
│   │   ├── Transaction.ts           # Tipo + validação
│   │   ├── settlement.ts            # Regras de settlement
│   │   └── reversal.ts              # Regras de reversal
│   ├── commission/
│   │   ├── Commission.ts            # Tipo + validação
│   │   ├── payoutCalculation.ts     # normalizePercentage, getBaseValue, format
│   │   └── sharedExecution.ts       # isSharedExecution, getStaffId
│   ├── client/
│   │   ├── Client.ts                # Tipo + validação
│   │   └── clientRules.ts           # Regras de negócio
│   ├── staff/
│   │   ├── Staff.ts                 # Tipo + validação
│   │   └── roles.ts                 # (migrar de src/lib/staff/)
│   └── cashClosing/
│       ├── CashClosing.ts           # Tipo + validação
│       └── closingRules.ts          # Regras de fechamento
│
├── application/                     # NOVO — Casos de uso / orquestração
│   ├── schedule/
│   │   ├── createAppointment.ts
│   │   ├── cancelAppointment.ts
│   │   └── rescheduleAppointment.ts
│   ├── checkout/
│   │   ├── finishCheckout.ts        # Pipeline substituindo handleFinish
│   │   └── syncComandaItems.ts
│   ├── finance/
│   │   ├── settleComanda.ts
│   │   ├── reverseTransaction.ts
│   │   └── closeCashRegister.ts
│   └── client/
│       ├── deleteClient.ts
│       └── importClients.ts
│
├── repositories/                     # NOVO — Acesso a dados
│   ├── SupabaseRepository.ts        # Base genérica
│   ├── ClientRepository.ts
│   ├── StaffRepository.ts
│   ├── AppointmentRepository.ts
│   ├── ComandaRepository.ts
│   ├── TransactionRepository.ts
│   └── CashClosingRepository.ts

├── services/                         # EXISTENTE — Migrar para application/
│   ├── notificationsService.ts
│   └── portalApi.ts

├── hooks/                            # REESTRUTURAR — FINOS, sem regras de negócio
│   ├── useToast.ts                   # NOVO — Substitui 31 cópias
│   ├── useAsyncGuard.ts              # NOVO — Substitui padrões de lock
│   ├── useClients.ts                 # NOVO — Chama LoadClients, não contém regra
│   ├── useActiveStaff.ts             # NOVO — Chama LoadStaff, não contém regra
│   ├── useStatusFilter.ts            # NOVO — Substitui 5+ padrões
│   ├── useCashClosing.ts             # MANTER (refatorar para usar application)
│   ├── useBusinessInsights.ts        # MANTER
│   └── ...

├── shared/                           # NOVO — Subdividido para evitar monolito
│   ├── format/
│   │   ├── currency.ts               # formatCurrency, parseCurrency
│   │   ├── currencyBrl.ts            # toBRL, fromBRL
│   │   └── index.ts
│   ├── status/
│   │   ├── labels.ts                 # statusLabels, labelFor
│   │   ├── colors.ts                 # statusBadgeClass, statusBadgeBgColor
│   │   ├── normalize.ts              # normalizePercentage, normalizePayoutValue
│   │   └── index.ts
│   ├── dates/
│   │   ├── dateRange.ts              # getDateRange
│   │   └── index.ts
│   ├── numbers/
│   │   ├── clamp.ts                  # clamp
│   │   └── index.ts
│   └── strings/
│       ├── capitalize.ts             # capitalize
│       └── index.ts
│
├── context/                          # MANTER
│   ├── AuthContext.tsx
│   ├── TenantContext.tsx
│   └── AppContext.tsx
│
├── modules/                          # MANTER
│   └── ...
│
└── lib/                              # MANTER (migrar domínio para src/domain/)
    ├── supabase/                     # MANTER
    ├── offline/                      # MANTER
    └── ...
```

---

## 8. Roadmap Revisado (após feedback)

### 8.1 Estrutura de Hooks

**Regra**: Hooks são FINOS — apenas conectam UI à camada de aplicação. Nunca contêm regras de negócio.

```
repositories/
    ClientRepository.ts       # Acesso a dados
application/
    LoadClients.ts            # Regra de negócio
hooks/
    useClients.ts             # Apenas chama LoadClients()
```

### 8.2 Estrutura de shared/ subdividida

Evita que `shared/` vire um monolito (projeto já tem 63k+ linhas):

```
shared/
├── format/
│   ├── currency.ts           # formatCurrency, parseCurrency
│   ├── currencyBrl.ts        # toBRL, fromBRL
│   └── index.ts
├── status/
│   ├── labels.ts             # statusLabels, labelFor
│   ├── colors.ts             # statusBadgeClass, statusBadgeBgColor
│   ├── normalize.ts          # normalizePercentage, normalizePayoutValue
│   └── index.ts
├── dates/
│   ├── dateRange.ts          # getDateRange
│   └── index.ts
├── numbers/
│   ├── clamp.ts              # clamp
│   ├── index.ts
└── strings/
    ├── capitalize.ts         # capitalize
    └── index.ts
```

### 8.3 Ordem Revisada

| Fase | Módulo | Descrição |
|---|---|---|
| **2.1** | **Standardization** | `formatCurrency`, `normalizePercentage`, `calculatePayout`, `statusLabels`, `statusColors`, `dateRange`, `useToast`, `useAsyncGuard`, `clamp`, `capitalize` |
| **2.2** | **Commission** | `domain/commission/` — funções puras: `normalizePercentage`, `calculatePayout`, `sharedExecution`, `formatPayout` |
| **2.3** | **Finance/Reversal** | 3 cópias da lógica de reversal, bem delimitado |
| **2.4** | **Client/Staff hooks** | Hooks finos + repositories |
| **2.5** | **Repositories** | Repository pattern completo |
| **2.6** | **Checkout** | Extrair pipeline `handleFinish` → `FinishCheckoutUseCase` → repositories |
| **2.7** | **Schedule** | Extrair hooks primeiro, depois components, depois application, depois repository |
| **3** | **Advanced** | RPCs atômicos, Event Bus, CQRS (se necessário), Cache, Offline melhorado, Demo Mode separado, Testes automatizados |

### 8.4 Detalhes por Fase

#### Fase 2.1 — Standardization

Criar utilitários compartilhados que eliminam centenas de duplicações:

| # | Arquivo | Funções | Substitui |
|---|---|---|---|
| 1 | `shared/format/currency.ts` | `formatCurrency`, `parseCurrency`, `toBRL`, `fromBRL` | 12+ definições + 87 inline |
| 2 | `shared/status/normalize.ts` | `normalizePercentage`, `normalizePayoutValue` | 4 cópias |
| 3 | `shared/status/labels.ts` | `statusLabels`, `statusFilterOptions`, `labelFor` | 8+ cópias |
| 4 | `shared/status/colors.ts` | `statusBadgeClass`, `statusBadgeBgColor`, `statusDotColor` | 5+ cópias |
| 5 | `shared/dates/dateRange.ts` | `getDateRange` | 3+ cópias |
| 6 | `shared/numbers/clamp.ts` | `clamp` | 2+ cópias |
| 7 | `shared/strings/capitalize.ts` | `capitalize` | 3+ cópias |
| 8 | `hooks/useToast.ts` | `useToast` | 31 arquivos |
| 9 | `hooks/useAsyncGuard.ts` | `useAsyncGuard` | Padrões de lock |

#### Fase 2.2 — Commission

Criar `domain/commission/` com funções puras (sem dependência de Supabase):

| # | Arquivo | Funções |
|---|---|---|
| 1 | `domain/commission/normalizePercentage.ts` | `normalizePercentage`, `normalizePayoutValue` |
| 2 | `domain/commission/calculatePayout.ts` | `calculateParticipantPayout`, `calculateGrossValue` |
| 3 | `domain/commission/sharedExecution.ts` | `sharedExecution`, `computePayout`, `distributeSharedParticipants` |
| 4 | `domain/commission/formatPayout.ts` | `formatPayoutSummary`, `formatPayoutRow` |
| 5 | `domain/commission/types.ts` | `CalculationMode`, `PayoutSummary`, `PayoutRow` |

#### Fase 2.6 — Checkout

Extrair pipeline `handleFinish` para application service:

```
handleFinish()
  → FinishCheckoutUseCase.execute()
      → ComandaRepository.settle()
      → ParticipantRepository.createMany()
      → ComplementaryItemRepository.updateParticipant()
      → TransactionRepository.create()
      → AuditLogRepository.create()
```

#### Fase 2.7 — Schedule

Extrair hooks primeiro (reduz ~1.000 linhas), depois components, depois application, depois repository:

```
Schedule.tsx (3.880 linhas)
  → hooks/useScheduleDrag.ts
  → hooks/useScheduleEdit.ts
  → hooks/useScheduleDelete.ts
  → hooks/useScheduleExport.ts
  → hooks/useScheduleBlocks.ts
  → components/ScheduleGrid.tsx
  → components/ScheduleToolbar.tsx
  → application/ScheduleAppService.ts
  → repositories/AppointmentRepository.ts
```

---

## 9. Riscos Arquiteturais Residuais

| # | Risco | Impacto | Mitigação |
|---|---|---|---|
| 1 | `client.ts` (2.314 linhas) contém emulator de demo completo | Qualquer mudança no schema deve ser espelhada | Extrair demo mode para arquivo separado |
| 2 | Schedule.tsx (3.880 linhas) é o maior monolito | Manutenção difícil, debugging lento | Dividir em sub-componentes + hooks |
| 3 | Checkout.handleFinish (~700 linhas) | Pipeline multi-etapa frágil | Substituir por RPC atômico |
| 4 | 15+ funções de commission duplicadas | Bug fix em uma cópia não propaga | Extrair para `src/domain/commission/` |
| 5 | Sem Repository pattern | Pages acopladas diretamente ao Supabase | Criar repositories na Fase 2 |
| 6 | Sem event architecture | Checkout hardcodes updates em finance/comissão | Criar eventos na Fase 3+ |
