# Frente: UX, Layout & Qualidade Técnica

- **Domínio:** Unificação de Telas Redundantes, Confirmações Destrutivas, Stacking/`z-index`, Estabilização de Contexts, Decomposição de Monólitos, Tipagem/Lint e Limpeza de Código Morto
- **Stack:** React 19 · TypeScript 5.8 · Vite 6 · Tailwind v4 · Biome · Vitest
- **Referências obrigatórias:** `AGENTS.md`, `docs/adr/ADR-001-Commission-vs-Settlement.md`, `docs/adr/ADR-024-ci-workflow-regularization.md`

---

## Índice da Frente

| ID | Título | Prioridade | Issue | Status |
|---|---|---|---|---|
| `UXQ-001` | **P1-03:** Unificar telas redundantes (BI/Estratégico, Fornecedores, Maquininhas, Financeiro, Portal) | `P1` | [#389](https://github.com/augustosanchesmanager-ux/sou-manager/issues/389) | `TODO` |
| `UXQ-002` | **P1-04:** UX segura (confirmação destrutiva, fim de `alert()`/`confirm()` e `catch {}` silenciosos) | `P1` | [#390](https://github.com/augustosanchesmanager-ux/sou-manager/issues/390) | `TODO` |
| `UXQ-003` | **P1-05:** Corrigir Layout (Sidebar dupla, escala única de `z-index`, Header e `Modal` aninhado) | `P1` | [#391](https://github.com/augustosanchesmanager-ux/sou-manager/issues/391) | `TODO` |
| `UXQ-004` | **P1-06 (`+SEC-003`):** Memoizar Contexts, alinhar `pendingRegistration` e isolar `ErrorBoundary`/`Suspense` | `P1` | [#392](https://github.com/augustosanchesmanager-ux/sou-manager/issues/392) | `TODO` |
| `UXQ-005` | **P1-07:** Corrigir bugs pontuais (`Operations.tsx`, `Reports` co-execução e rótulos ADR-001/030) | `P1` | [#393](https://github.com/augustosanchesmanager-ux/sou-manager/issues/393) | `TODO` |
| `UXQ-006` | **P1-08:** Fechar ponto cego de Lint (`biome` na raiz) e reconciliar workflow de CI (`ADR-024`) | `P1` | [#394](https://github.com/augustosanchesmanager-ux/sou-manager/issues/394) | `TODO` |
| `UXQ-007` | **P2-01:** Decomposição incremental dos 4 super-monólitos (`Schedule`, `Checkout`, `Receivable`, `Comandas`) | `P2` | [#397](https://github.com/augustosanchesmanager-ux/sou-manager/issues/397) | `TODO` |
| `UXQ-008` | **P2-02:** Migrar 11 `application/` services diretos no Supabase para Repository Pattern (via ADR) | `P2` | [#398](https://github.com/augustosanchesmanager-ux/sou-manager/issues/398) | `TODO` |
| `UXQ-009` | **P2-03:** Eliminação progressiva dos 560 `any` e consolidação de utilitários (`timezone`, `currency`) | `P2` | [#399](https://github.com/augustosanchesmanager-ux/sou-manager/issues/399) | `TODO` |
| `UXQ-010` | **P2-04:** Limpeza de código morto (~38% exports, páginas órfãs) e condicionais `estetica` na UI | `P2` | [#400](https://github.com/augustosanchesmanager-ux/sou-manager/issues/400) | `TODO` |

---

## `UXQ-001` — P1-03: Unificar telas redundantes

- **Status:** `TODO` | **Prioridade:** `P1` | **Issue:** [#389](https://github.com/augustosanchesmanager-ux/sou-manager/issues/389) | **Sprint:** Sprint 4
- **Dependências:** `DEC-04`, `DEC-05`, `FIN-002`, `FIN-005`
- **Escopo:** Unificar `/bi` + `/strategic-dashboard`; unificar Fornecedores (`Suppliers.tsx`, `Orders.tsx:524`, `SuppliersModal.tsx:31`) sobre `supplyRepository`; consolidar `/payment-terminals` vs `/settings:901`; enxugar `CashLedger.tsx` + `/receipts`; descontinuar Portal Legado (`/c/:slug*`, `/portal-admin`) em favor de `/agendar/:slug`.

## `UXQ-002` — P1-04: UX segura (confirmação destrutiva, fim de `alert()`/`confirm()` e `catch {}`)

- **Status:** `TODO` | **Prioridade:** `P1` | **Issue:** [#390](https://github.com/augustosanchesmanager-ux/sou-manager/issues/390) | **Sprint:** Sprint 4
- **Escopo:** Adicionar confirmação em `Expenses`, `Suppliers`, `Services`, `Team`, `Categories`; substituir 22 `alert()`/`confirm()` nativos; eliminar os 56 `catch {}` silenciosos críticos (incluindo toast falso de sucesso em `Team.tsx:629`).

## `UXQ-003` — P1-05: Layout, Sidebar dupla, `z-index` e `Modal` aninhado

- **Status:** `TODO` | **Prioridade:** `P1` | **Issue:** [#391](https://github.com/augustosanchesmanager-ux/sou-manager/issues/391) | **Sprint:** Sprint 4
- **Escopo:** Remover `<Sidebar>` duplicada de `PortalAdmin.tsx:106` e `KioskAdmin.tsx:287`; corrigir stacking context do `<header>` em `Layout.tsx:149`; portalar `CommandPalette` e `AuditDrawer` com `Esc`; adicionar ref-count de scroll-lock e `useId()` em `Modal.tsx`; resolver colisão `Toast` vs `SupportWidget`/`MobileBottomNav`.

## `UXQ-004` — P1-06 (`+SEC-003`): Memoizar Contexts, `pendingRegistration` e `<ErrorBoundary>` por rota

- **Status:** `TODO` | **Prioridade:** `P1` | **Issue:** [#392](https://github.com/augustosanchesmanager-ux/sou-manager/issues/392) | **Sprint:** Sprint 4
- **Escopo:** Memoizar `AuthContext` (incluindo `refreshAccessContext` de `SEC-003`), `TenantContext` (corrigir stale `refreshTenant`), `LoadingContext` e `ThemeContext`; mover `PortalAuthProvider` para rota-pai; alinhar `pendingRegistration` (`App.tsx` vs `AuthContext`); adicionar `<ErrorBoundary>` + `<Suspense>` no nível do `<Outlet />` em `Layout.tsx`.

## `UXQ-005` — P1-07: Bugs pontuais (`Operations.tsx`, `Reports` co-execução e rótulos ADR-001/030)

- **Status:** `TODO` | **Prioridade:** `P1` | **Issue:** [#393](https://github.com/augustosanchesmanager-ux/sou-manager/issues/393) | **Sprint:** Sprint 4
- **Dependências:** `DEC-06`
- **Escopo:** Corrigir filtro `'Barber'|'Manager'` PascalCase, estoque fixo `<= 5` e soma de comandas abertas em `Operations.tsx:90-135` (ou consolidar tela); considerar `service_execution_participants` em `Reports`; padronizar rótulos entre `Sidebar` e `CommandPalette` para `/commissions`, `/cash-closing` e `/payroll`.

## `UXQ-006` — P1-08: Fechar ponto cego de Lint e reconciliar CI (`ADR-024`)

- **Status:** `DONE` | **Prioridade:** `P1` | **Issue:** [#394](https://github.com/augustosanchesmanager-ux/sou-manager/issues/394) | **Sprint:** Sprint 4
- **Dependências:** Aprovação PO + ADR (mudança de CI — `ADR-024` aceito em `2026-11-25`)
- **Escopo:** Expandir `biome check` de `src/` para `pages/`, `components/`, `services/`, `hooks/`, `context/`, `domain/` e `application/` (`lint:root` + `lint:changed` incremental no CI); formalizar `ADR-024`.

## `UXQ-007` — P2-01: Decomposição incremental dos 4 super-monólitos

- **Status:** `TODO` | **Prioridade:** `P2` | **Issue:** [#397](https://github.com/augustosanchesmanager-ux/sou-manager/issues/397) | **Sprint:** Sprint 5+
- **Dependências:** `AGD-002` + testes E2E de regressão
- **Escopo:** Fatiar `Schedule.tsx` (6.065L), `Checkout.tsx` (3.341L), `AccountsReceivable.tsx` (2.591L) e `Comandas.tsx` (2.158L) — 1 tela por PR.

## `UXQ-008` — P2-02: Migrar 11 `application/` services diretos no Supabase para Repository Pattern

- **Status:** `TODO` | **Prioridade:** `P2` | **Issue:** [#398](https://github.com/augustosanchesmanager-ux/sou-manager/issues/398) | **Sprint:** Sprint 5+
- **Dependências:** ADR obrigatório (`ROADMAP.md:556`)

## `UXQ-009` — P2-03: Eliminar 560 `any` e consolidar utilitários

- **Status:** `TODO` | **Prioridade:** `P2` | **Issue:** [#399](https://github.com/augustosanchesmanager-ux/sou-manager/issues/399) | **Sprint:** Sprint 5+
- **Dependências:** `UXQ-006`
- **Escopo:** Tipar módulos financeiros/BI primeiro (`useBusinessInsights` 40, `reportsDataService` 27, `salesReportService` 25, `biCockpitService` 19, etc.); consolidar `shared/dates/timezone.ts`, `shared/format/currency.ts` e `StatusBadge`.

## `UXQ-010` — P2-04: Limpeza de código morto e condicionais `estetica` na UI

- **Status:** `TODO` | **Prioridade:** `P2` | **Issue:** [#400](https://github.com/augustosanchesmanager-ux/sou-manager/issues/400) | **Sprint:** Sprint 5+
- **Dependências:** Aprovação PO sobre UI `estetica`
- **Escopo:** Remover páginas/componentes/mocks órfãos (`Financial.tsx`, `ClientAccount.tsx`, `ProfessionalSetup.tsx`, `RoleSelection.tsx`, `RegisterSuccess.tsx`, `components/OnboardingChecklist.tsx`, `components/common/ExportActionsDropdown.tsx`, `components/dashboard/AppointmentTimeline.tsx`, `components/charts/MetricCard.tsx`, `components/financial/mockData.ts`, `components/superadmin/mockData.ts`, `featureAvailability.ts`, barrels legados `chefClub` e ~38% exports mortos) e limpar `EsteticaBlockedRoute`/`isEsteticaApp` da UI.
