# Frente: Financeiro & Comissões

- **Domínio:** Regime de Caixa, Fechamento de Caixa, Comandas/PDV, Comissões Teóricas (ADR-001), BI/Fuso Horário, Persistência Financeira, Feature Flags, Outbox D8 e Fiscal
- **Stack:** React 19 · TypeScript 5.8 · Supabase (PostgreSQL + RLS + Edge Functions) · Vitest
- **Referências obrigatórias:** `docs/adr/ADR-001-Commission-vs-Settlement.md`, `AGENTS.md` (regras financeiras e D8)

---

## Índice da Frente

| ID | Título | Prioridade | Issue | Status |
|---|---|---|---|---|
| `FIN-001` | **F-02:** Guard de sessão e circuit breaker no polling do outbox | `P0` | — | `REVIEW` |
| `FIN-002` | **P0-06 (`+GTM-002`):** Sanear métricas fabricadas em `/bi`, hardcodes e fuso `UTC` vs `BRT` / `closed_at` | `P0` | [#381](https://github.com/augustosanchesmanager-ux/sou-manager/issues/381) | `TODO` |
| `FIN-005` | **P0-07:** Migrar `/categories` e políticas de taxa (`cardFeeRepository`) de `localStorage` para Supabase | `P0` | [#382](https://github.com/augustosanchesmanager-ux/sou-manager/issues/382) | `TODO` |
| `FIN-006` | **P1-01:** Consolidar `useFeatureFlags` (20 RPCs → 1 RPC Batch) e higiene de cache | `P1` | [#387](https://github.com/augustosanchesmanager-ux/sou-manager/issues/387) | `TODO` |
| `FIN-003` | Corrigir timeouts em `fiscalService.test.ts` e `stockRepository.test.ts` + definir escopo NFS-e | `P1` | [#396](https://github.com/augustosanchesmanager-ux/sou-manager/issues/396) | `TODO` |
| `FIN-004` | Alinhar Staging e `config.toml` da exportação Excel (`import-export`) | `P2` | [#402](https://github.com/augustosanchesmanager-ux/sou-manager/issues/402) | `TODO` |

---

## `FIN-001` — F-02: Guard de sessão e circuit breaker no polling do outbox

- **Status:** `REVIEW`
- **Prioridade:** `P0`
- **Tipo:** `Bugfix`
- **Escopo & Evidência:** PR #374 mergeado (`b87e0cb`); registro em `docs/audit/F02_OUTBOX_AUTH_GUARD_20261123.md`. Aguardando deploy controlado em produção.

---

## `FIN-002` — P0-06 (`+GTM-002`): Sanear `/bi`, hardcodes e fuso `UTC` vs `BRT` / `closed_at`

- **Status:** `TODO`
- **Prioridade:** `P0`
- **GitHub Issue:** [#381](https://github.com/augustosanchesmanager-ux/sou-manager/issues/381)
- **Sprint:** Sprint 2
- **Tipo:** `Bugfix`
- **Dependências:** Nenhuma (alinhar se `/bi` e `/strategic-dashboard` já unificam aqui ou em `UXQ-001`)

### Problema / Objetivo
1. `src/modules/bi/biCockpitService.ts:200-398` e `pages/BusinessIntelligence.tsx:232-285` aplicam `Math.max(incomeFromTx, comandasGross, apptsGross)` e inventam comissão fixa de `45%`/`50%`, taxa `2,5%`, split `85%/15%` e radar `85 + (count % 15)`.
2. `BiExecutiveCockpit.tsx:338` e `StaffProfitabilityTable.tsx:50` vazam strings hardcoded de cliente único (`"Sanchez Barber"`, `"Rubens, Heron, Lucas"`, `"augusto@sanchezbarber.com.br"`).
3. 16+ ocorrências de `toISOString().split('T')[0]` (UTC) e mistura com fuso local em `useCashClosing.ts:174-178` causam virada errada do dia após 21h BRT.
4. `dailySummaryService.ts:85-86,197-202` filtra comandas por `created_at` em vez de `closed_at` e usa fórmula simplista; `useStrategicDashboard.ts:159` divide ocupação sempre por `30` dias.

### Critérios de Aceite
- [ ] Zero fórmulas fabricadas ou strings hardcoded de cliente único em `/bi` e componentes de BI.
- [ ] 100% dos filtros de data operacional usam `shared/dates/timezone.ts` (`America/Sao_Paulo`).
- [ ] `dailySummaryService` filtra comandas por `closed_at` e usa cálculo canônico; `useStrategicDashboard` divide pelos dias reais do período.
- [ ] Testes unitários cobrindo fronteira `22:30` BRT.

---

## `FIN-005` — P0-07: Migrar `/categories` e políticas de taxa (`cardFeeRepository`) para Supabase

- **Status:** `TODO`
- **Prioridade:** `P0`
- **GitHub Issue:** [#382](https://github.com/augustosanchesmanager-ux/sou-manager/issues/382)
- **Sprint:** Sprint 2
- **Tipo:** `Bugfix`
- **Dependências:** Aprovação do PO para migration e RLS por `tenant_id`

### Problema / Objetivo
`pages/Categories.tsx:16-38` e `domain/paymentTerminal/cardFeeRepository.ts` (também lido por `barberStatementService.ts:251`) salvam dados exclusivamente em `localStorage`, causando perda de cadastro ao trocar de dispositivo/navegador.

### Critérios de Aceite
- [ ] Categorias e políticas de split de taxa persistidas no Supabase com RLS estrita por `tenant_id`.
- [ ] Dados sincronizados entre dispositivos/navegadores da mesma conta.
- [ ] Testes unitários e de isolamento cross-tenant verdes.

---

## `FIN-006` — P1-01: Consolidar `useFeatureFlags` (20 RPCs → 1 RPC Batch) e higiene de cache

- **Status:** `TODO`
- **Prioridade:** `P1`
- **GitHub Issue:** [#387](https://github.com/augustosanchesmanager-ux/sou-manager/issues/387)
- **Sprint:** Sprint 4
- **Tipo:** `Performance`
- **Dependências:** Aprovação do PO para RPC `get_tenant_feature_flags`

### Critérios de Aceite
- [ ] Boot autenticado executa 1 única RPC em vez de 20 paralelas.
- [ ] `signOut()` limpa `resolutionCache` e erros transitórios não ficam cacheados.

---

## `FIN-003` — Estabilizar testes de Fiscal/Estoque e definir escopo NFS-e

- **Status:** `TODO`
- **Prioridade:** `P1`
- **GitHub Issue:** [#396](https://github.com/augustosanchesmanager-ux/sou-manager/issues/396)
- **Sprint:** Sprint 4
- **Dependências:** Decisão do PO sobre emissão fiscal pós-GTM

### Critérios de Aceite
- [ ] `domain/fiscal/fiscalService.test.ts` e `domain/stock/stockRepository.test.ts` passando sem timeouts.
- [ ] Zero provider mock exposto como funcionalidade ativa em produção.

---

## `FIN-004` — Alinhar Staging e `config.toml` da Exportação Excel (`import-export`)

- **Status:** `TODO`
- **Prioridade:** `P2`
- **GitHub Issue:** [#402](https://github.com/augustosanchesmanager-ux/sou-manager/issues/402)
- **Sprint:** Sprint 5+

### Critérios de Aceite
- [ ] Seção `[functions.import-export]` documentada em `supabase/config.toml`.
- [ ] Staging sincronizado com Produção (`20261113094500_storage_exports_bucket.sql` + `import-export`).
