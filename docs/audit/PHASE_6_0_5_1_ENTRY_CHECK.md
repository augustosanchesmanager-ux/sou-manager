# PHASE 6.0.5.1 — ENTRY CHECK (Estado Efetivo / Camada de Autorização)

> **Data:** 2026-08-06
> **Autorização:** Auditoria de entrada de implementação solicitada pelo PO antes de qualquer código (Regra de Entrada).
> **Modo:** Somente leitura — nenhum arquivo de código ou migration foi alterado.
> **Baseline de referência:** `v1.4.2-billing-engine-6.0.4.4` (commit `10e69e0`, árvore limpa)
> **Branch:** `feature/phase-6.0.4-billing`
> **Fonte de autoridade:** ADR-013 §2.4 (Estado Efetivo), §3.1 (Single Writer), §4.11 (proibido string literals fora do domínio), §5.2 (matriz congelada) + decisões D-6.0.5-1..8 (aprovadas PO 2026-08-06).

---

## STATUS: ✅ APPROVED

> Critérios de entrada **FECHADOS**: ADR-013 Accepted + D-6.0.5-1..8 aprovadas pelo PO. Não há bloqueio conceitual para iniciar a 6.0.5.1.

---

## Resumo executivo

A 6.0.5.1 implementa a **camada de autorização (Estado Efetivo)** definida no ADR-013 §2.4: a combinação dos três contextos (`Subscription State + Tenant State + Feature Availability`) que **deriva o acesso do tenant**. O alcance é **congelado ao Estado Efetivo** — proibido alterar billing, lifecycle, planos, regras comerciais ou o schema (`subscriptions.status` **sem** `'suspended'` permanece até 6.0.5.4).

**Critério principal do PO:** nenhuma decisão de acesso baseada diretamente em `tenant.status === ...`, `subscription.status === ...` ou `plan === ...` — todo acesso passa por `EffectiveAccessService.can(...)` ou equivalente.

---

## 1. Escopo congelado (SOLO Estado Efetivo)

### 1.1 Entregáveis esperados (PO)

| Entregável | Arquivo |
|-----------|---------|
| Estado Efetivo (tipos + função pura) | `domain/authorization/effectiveState.ts` |
| Disponibilidade de features por plano/status | `domain/authorization/featureAvailability.ts` |
| Política de acesso (níveis + ações) | `domain/authorization/accessPolicy.ts` |
| Orquestração (can / getAccessLevel / warning) | `application/authorization/EffectiveAccessService.ts` |
| Testes unitários completos + barrel `index.ts` | `domain/authorization/*.test.ts`, `application/authorization/*.test.ts` |

### 1.2 Fora do escopo (proibido nesta subfase)

- ❌ Alterar `domain/billing/` (engine, types, limits, repository) — é leitura, nunca escrita
- ❌ Alterar `application/tenantLifecycle.ts` / `application/billing.ts` — Single Writer preservado
- ❌ Criar/alterar status (`suspended` no CHECK = 6.0.5.4; `archived` = 6.0.5.4)
- ❌ Criar tabelas `plans`/`features`/`plan_features`/`feature_flags` (6.0.5.2/6.0.5.3 — D-6.0.5-5)
- ❌ Enforcement de escrita no domínio (read-only efetivo em RPCs = 6.0.5.3)
- ❌ Alterar `pages/Admin.tsx` (display de plano / `plan === 'premium'` = 6.0.5.3)

### 1.3 Mudança comportamental aprovada (dentro do escopo)

A D-6.0.5-2 muda o gate atual de `App.tsx:158`: **`cancelled` deixa de redirecionar para `/pending-approval`** (bloqueio) e passa a **permitir login em modo somente leitura** (consulta/exportação/relatórios; qualquer escrita bloqueada). `suspended`/`archived` continuam bloqueados (nível `none`). Esta é a aplicação da decisão aprovada pelo PO — será validada em E2E.

---

## 2. Auditoria de implementação — fatos do código

### 2.1 Decisões de acesso direto (a eliminar — critério do PO)

| Local | Padrão atual | Alvo (6.0.5.1) |
|-------|-------------|----------------|
| `App.tsx:158` | `tenant.status === 'cancelled' \|\| 'archived' \|\| 'suspended'` → `/pending-approval` | `effectiveAccess.can('system.access')` → somente `none` bloqueia |
| `App.tsx:162` | `tenant.status === 'draft'` → `/onboarding/welcome` | `effectiveAccess.can('system.onboarding')` |
| `App.tsx:154` | `profileStatus === 'pending' \|\| 'suspended'` (pessoa) | Permanente — hierarquia profile → tenant → flag (hierarquia completa = 6.0.5.3) |

`ManagerRoute` (role) e `SuperAdminRoute` (role) permanecem — são gates de **papel**, não de estado de tenant.

### 2.2 Fatos do domínio (fonte das regras)

- `domain/billing/types.ts`: `SubscriptionStatus = 'trialing' \| 'active' \| 'past_due' \| 'cancelled'` (sem `'suspended'`); `TenantPlan = 'free' \| 'pro' \| 'premium'`
- `domain/tenant/types.ts`: `TenantStatus` = 7 estados (`draft/trial/active/past_due/suspended/cancelled/archived`); `Tenant` = `{ status, plan }`
- `domain/billing/limits.ts`: `PLAN_LIMITS` free=1 / pro=5 / premium=∞ — **já consistente com D-6.0.5-3** (sem ação em 6.0.5.1)
- `src/lib/apps/moduleRegistry.ts` + `domain/shared/app.ts`: gates por **app** (21 `AppModuleSlug`), não por plano
- **Não existem** tabelas `feature_flags`/`plans`/`plan_features` — flags avaliadas em código

### 2.3 Single Writer (preservado)

| Agregado | Writer oficial | Papel da 6.0.5.1 |
|----------|---------------|------------------|
| `subscriptions` | Billing Engine (`BillingService`) | somente leitura |
| `tenants.status` | `TenantLifecycleService` | somente leitura |
| Feature Flags | `FeatureFlagService` (6.0.5.2) | derivado read-only |
| **EffectiveAccessService** | — | **calcula, nunca escreve** |

---

## 3. Divergências encontradas

| # | Divergência | Resolução 6.0.5.1 |
|---|-------------|-------------------|
| **DIV-1** | `ROADMAP.md:1116` define 6.0.5.1 como "camada de autorização" mas `PHASE_6_0_5_ENTRY_AUDIT.md` §8 (linha 345) define "6.0.5.1 — Modelagem de Plans" | **Alinhar docs**: escopo do PO (2026-08-06) prevalece — 6.0.5.1 = Estado Efetivo; "Modelagem de Plans" é realocada para 6.0.5.2 (persistência, D-6.0.5-5). Nota de alinhamento nas duas fontes |
| **DIV-2** | ADR-013 §2.4/§4.11 proíbe decisão de acesso direta por `tenant.status` — `App.tsx:158/162` ainda usam | **Eliminar na 6.0.5.1**: refactor do gate via `EffectiveAccessService.can(...)` |
| **DIV-3** | `subscriptions.status` não tem `'suspended'` (CHECK) mas `tenants.status` tem — fonte de acesso hoje é o espelho do tenant | Estado efetivo deriva de `tenants.status` (fonte de acesso, ADR-013 §2.3) + `subscriptions.status` quando disponível; **não altera o CHECK** (6.0.5.4) |
| **DIV-4** | `limits.ts` free=1 já alinhado à D-6.0.5-3 | Sem ação em 6.0.5.1 (enforcement = 6.0.5.3) |
| **DIV-5** | Flags avaliadas em código (`moduleRegistry` + `PLAN_LIMITS`), sem tabela | `featureAvailability.ts` = derivado read-only com catálogo tipado em `domain/` (constantes); sem persistência |
| **DIV-6** | `pages/Admin.tsx:351,413` (`plan === 'premium'`, display) e `pages/SuperAdmin.tsx:154,165,304` (filtros) | **Não são decisões de acesso** — fora do critério; permanecem até 6.0.5.3 (enforcement) |

---

## 4. Modelo alvo (ADR-013 §2.4 + §5.2)

```
Subscription State
      +
Tenant State
      +
Feature Availability
      =
Estado Efetivo (acesso do tenant)
```

Níveis de acesso (fonte: LIFECYCLE_MODEL `ACCESS_BY_STATUS` + D-6.0.5-1/2):

| Status | Nível | Acesso |
|--------|-------|--------|
| `draft` | `onboarding` | Wizard de onboarding apenas |
| `trial` / `active` | `full` | Acesso completo (sujeito às flags do plano) |
| `past_due` | `restricted` | Read-only **com aviso** (D-6.0.5-1): login, dashboard, relatórios, exportações; sem criar clientes/comandas/agendamentos, sem movimentação financeira/estoque/cadastral |
| `suspended` | `none` | Bloqueado (flags "Suspensas") |
| `cancelled` | `readonly` | Somente leitura (D-6.0.5-2): consulta/exportação/relatórios; qualquer escrita bloqueada |
| `archived` | `none` | Bloqueado (retenção — D-6.0.5-4) |

Catálogo de flags: matriz congelada de `FEATURE_FLAGS_MODEL.md` §5 (`free/pro/premium` → flags) como **constantes tipadas em `domain/authorization/featureAvailability.ts`** (D-6.0.5-3 Free: sem Chef Club, sem Premium, 1 unidade).

---

## 5. Plano de implementação

| Etapa | Trabalho | Arquivo(s) |
|-------|----------|-----------|
| 1 | Níveis de acesso + tipos do estado efetivo | `domain/authorization/effectiveState.ts` |
| 2 | Catálogo tipado de flags + resolução por plano/status (matriz §5) | `domain/authorization/featureAvailability.ts` |
| 3 | Combinação dos 3 contextos → `EffectiveAccessState` (função pura, **fail-fast** em combinação inválida — ADR-013 §4.7, sem `ELSE`) | `domain/authorization/effectiveState.ts` |
| 4 | Política: `AccessLevel` + ações (`system.access`, `system.onboarding`, `system.read`, `system.write`, `system.export`, `system.financial`, `system.stock`, `system.cadastral`) + mensagem de aviso | `domain/authorization/accessPolicy.ts` |
| 5 | Barrel de exportação | `domain/authorization/index.ts` |
| 6 | Orquestração com DI (readers injetáveis: tenant, subscription) + `can()`/`getAccessLevel()`/`getWarning()` + singleton | `application/authorization/EffectiveAccessService.ts` |
| 7 | Refactor do gate em `App.tsx:158/162` → `EffectiveAccessService.can(...)` | `App.tsx` |
| 8 | Testes unitários (effectiveState, featureAvailability, accessPolicy, EffectiveAccessService) | `*.test.ts` |
| 9 | E2E cenários D-6.0.5 (past_due read-only com aviso; cancelled somente leitura) | `tests/e2e/flows/` |
| 10 | Docs + ROADMAP + nova baseline | — |

---

## 6. Critérios de saída (certificação — PO)

- [x] Cobertura unitária completa do Estado Efetivo (níveis, combinações válidas/inválidas, flags por plano, avisos) — 46 testes por matriz (795 total, PASS)
- [x] E2E cobrindo os cenários das D-6.0.5-1/2 (past_due read-only + aviso; cancelled somente leitura) — flow13 (8/8 PASS, Supabase real). **Aviso na UI + enforcement de escrita = 6.0.5.3 (escopo §1.2)**; aviso validado em nível unitário (`getWarnings`)
- [x] **Nenhuma** decisão de acesso baseada diretamente em `tenant.status`, `subscription.status` ou `plan` (verificação via grep em `App.tsx` e camada de autorização) — verificado 2026-08-06
- [x] Documentação + ROADMAP atualizados (DIV-1 alinhado) — changelog 8.2/8.3/8.4
- [x] Nova baseline criada (padrão `v1.4.3-effective-state-6.0.5.1`)

> **CERTIFICAÇÃO (PO, 2026-08-06): ✅ CERTIFIED.** Itens explicitamente fora do escopo da 6.0.5.1 (6.0.5.3): banner visual de estado, enforcement read-only nas operações de escrita, gating visual por Feature Flags.

---

## 7. Riscos

| Risco | Mitigação |
|-------|-----------|
| Mudança comportamental em `cancelled` (bloqueio → readonly) quebrar fluxos existentes | E2E do cenário D-6.0.5-2 + aviso explícito de estado limitado na UI |
| Combinação inválida silenciosa (`ELSE → full`) reintroduzida | Fail-fast por construção (ADR-013 §4.7) + teste unitário de combinações inválidas |
| Escopo vazar para enforcement (6.0.5.3) | Alcance congelado em §1.2; revisão em cada PR |
| Divergência documental (DIV-1) perpetuar duas decomposições | Alinhamento de `ROADMAP.md:1116` e `PHASE_6_0_5_ENTRY_AUDIT.md` §8 nesta fase |

---

## 8. Conclusão

Os critérios de entrada estão **FECHADOS** e o alcance da 6.0.5.1 está **congelado** ao Estado Efetivo. A implementação não altera billing/lifecycle/planos/schema — apenas **consome** o modelo aprovado (ADR-013 §2.4, D-6.0.5-1..8) e elimina as decisões de acesso diretas em `App.tsx`. **STATUS: ✅ APPROVED.**
