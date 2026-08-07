# PHASE 6.0.5.3 — ENTRY AUDIT (FeatureFlagService + Feature Flags Enforcement)

> **Data:** 2026-08-07
> **Autorização:** Auditoria de entrada solicitada pelo PO (2026-08-06) antes de qualquer código (Regra de Entrada), após certificação do smoke 6.0.5.2 (10/10 PASS).
> **Modo:** Somente documentação (decisão PO 2026-08-07) — ajustes do PO incorporados; **nenhum arquivo de código (`.ts`/`.tsx`/`.sql`) ou migration alterado; nenhum teste executado; commit restrito a documentação.**
> **Baseline de referência:** `v1.4.3` / **6.0.5.2 CERTIFICADA** (smoke E2E 10/10 em 48.4s, 2026-08-06)
> **Branch:** `feature/phase-6.0.4-billing`
> **Fonte de autoridade:** ADR-013 §2.4/§3.1/§4 (Feature Flags = 3º contexto desacoplado; writer único `FeatureFlagService`; string literals de planos/features fora de `domain/` proibidas) + `PHASE_6_0_5_ENTRY_AUDIT.md` §8 (subfase 6.0.5.3) + `FEATURE_FLAGS_MODEL.md` §4/§5/§6 + decisões D-6.0.5-1..8 e **D-6.0.5.3-1..6 (2026-08-07)** (BUSINESS_DECISIONS.md).

---

## STATUS: ✅ IMPLEMENTAÇÃO EM ANDAMENTO (PO aprovou início em 2026-08-07)

> **Estado da implementação (2026-08-07):** backend 6.0.5.3 implementado (`domain/billing/featureFlagService.ts` + `domain/billing/planCatalogDb.ts` + `domain/billing/featureOverrideStoreDb.ts`, fim de `limits.ts`) + frontend (`useFeatureFlags` + `FeatureGuard` + `FeatureUnavailablePage` + gates no sidebar/rotas). **Adapters DB em `domain/billing/`** (decisão PO 2026-08-07 — padrão `supabaseBillingRepository.ts`; o Repository Guard proíbe `.from()` em `application/`; baseline de violações reduziu 233 → 230). Migration `20260807000000_phase_6_0_5_3_feature_flags.sql` **validada em Postgres 16 docker**: aplica 2× sem duplicar; cenários T1–T7 confirmados (matriz free/pro/premium, override vence, suspensão derruba, RLS de escrita bloqueia authenticated). Unit 847/847, build OK, `architecture:ci` verde. Pendente: guarda de UI para os RPCs de receivables (pronto na migration), smoke E2E e docs finais.

> Revisão documental do PO (2026-08-07): Decisões do PO (§0), escopo delimitado (§2.4), API pública congelada do `FeatureFlagService` (§2.5), legado/depreciação (§2.6), RPCs protegidas definidas (A2), critérios de teste ampliados (§7) e critérios de saída atualizados (§8). Relatório final em §10.

---

## 0. Decisões do PO (2026-08-07)

Registro oficial em `docs/BUSINESS_DECISIONS.md` (D-6.0.5.3-1..6). Resumo aplicável a este plano:

| Código | Decisão |
|--------|---------|
| **D-6.0.5.3-1** | Escopo delimitado: **somente enforcement de Feature Flags + resolução de planos**. Fora: Billing Engine, Lifecycle, novas RPCs de transição, RLS, migrations de billing e suspensão automática |
| **D-6.0.5.3-2** | `change_tenant_plan` + `TenantSubscriptionUpdated` + correção de `Admin.tsx:856` → **realocados para 6.0.5.5** (transições RPCs) |
| **D-6.0.5.3-3** | Deploy via `MIGRATION_EXCEPTION` (`supabase db query --linked -f <migration>` + `supabase migration repair --status applied`), aplicando `06030000`, `06090000` e a migration 6.0.5.3 na janela de operação |
| **D-6.0.5.3-4** | RPCs protegidas com `tenant_has_feature`: **fechamento de caixa, comissões, receivables/expenses** (checkout fica de fora) |
| **D-6.0.5.3-5** | UI **híbrida**: esconder módulo no sidebar + página reutilizável `FeatureUnavailablePage`/`UpgradePrompt` parametrizada em rota direta; backend = camada de segurança |
| **D-6.0.5.3-6** | Leitura de flags **somente via RPC `tenant_has_feature`** (camada `FeatureFlagService` no frontend; **nenhum SELECT direto** em `feature_flags`/`plans`/`features`/`plan_features`)

---

## Resumo executivo

A **6.0.5.3** implementa o **enforcement por Feature Flags** — o 3º contexto desacoplado do ADR-013 (funcionalidade), complementando Subscription (contrato) e Tenant (acesso) já cobertos. Sobre o modelo persistido pela 6.0.5.2 (`plans`/`features`/`plan_features`, migration `20260806090000`), a 6.0.5.3 adiciona **exclusivamente** (D-6.0.5.3-1):

- **Tabela runtime `feature_flags`** (override tenant×flag, escrita exclusiva superadmin) + **RPC `tenant_has_feature`** (SECURITY DEFINER, grants ADR-012, única RPC nova — enforcement);
- **`FeatureFlagService`** (`domain/billing/`) como **writer único** das flags — resolve o `FeatureSet` por tenant combinando **PlanCatalog DB-backed** + overrides + estado efetivo (suspensão derruba flags). **API pública congelada em §2.5**;
- **`PlanCatalog` DB-backed** (implementação trocada de static → banco, contrato preservado — acréscimo obrigatório do PO na 6.0.5.2);
- **Fim de `limits.ts` no runtime** (leitura via `plans.limits`) e **fim dos SQL hardcoded** (`invite_team_member` free=1/pro=5 → `plans.limits.max_staff`), **sem mudança de regra de negócio**;
- **Frontend**: `useFeatureFlags()`/`can()` + `<FeatureGuard>` + **`FeatureUnavailablePage` reutilizável** (D-6.0.5.3-5 híbrido); gate do sidebar por **app ∧ feature**; leitura de flags **somente via RPC** (D-6.0.5.3-6);
- **Guarda `tenant_has_feature` nos 4 RPCs financeiros aprovados** (fechamento de caixa, comissões, receivables, expenses — D-6.0.5.3-4);
- **Unificação do gate em `App.tsx`** com hierarquia profile→tenant→flag.

**Realocados para 6.0.5.5 (D-6.0.5.3-2):** upgrade/downgrade via engine (`change_tenant_plan` + evento `TenantSubscriptionUpdated`) e correção do bypass `Admin.tsx:856`.

**Perímetro congelado:** enforcement de leitura e navegação por flags + resolução de planos. **Não** toca em Billing Engine, TenantLifecycle/suspensão automática, novas RPCs de transição, RLS, migrations de billing (D-6.0.5.3-1), nem preços/gateway (comercial do PO).

**Deploy (D-6.0.5.3-3):** a 6.0.5.3 depende das tabelas `plans`/`features`/`plan_features` (6.0.5.2) **no remoto**. O PO aprovou o procedimento `MIGRATION_EXCEPTION` (`supabase db query --linked -f <migration>` + `supabase migration repair --status applied`), aplicando `06030000`, `06090000` e a migration 6.0.5.3 na **janela de operação** (após aprovação deste relatório e da implementação).

---

## 1. Auditoria documental

| Fonte | O que diz sobre 6.0.5.3 | Consistência |
|-------|--------------------------|--------------|
| `PHASE_6_0_5_ENTRY_AUDIT.md` §8 (linha 349) | 6.0.5.3 = FeatureFlagService: `feature_flags` runtime (tenant×flag, inclui override suspensão) + RPC `tenant_has_feature` (grants ADR-012) + `useFeatureFlags`/`can` + `<FeatureGuard>` + `moduleRegistry` no sidebar + substituir `limits.ts`/SQL hardcoded por leitura via `plans` + RPCs com `tenant_has_feature` + upgrade/downgrade via engine (RPC + evento `TenantSubscriptionUpdated`) + corrigir `Admin.tsx:856` + unificar gate `App.tsx` | ✅ Alinhado ao ROADMAP (`6.0.5.3 FeatureFlagService`) |
| ADR-013 §3.1 | Writer único das flags = `FeatureFlagService`; leitura passa pelo service; contexto desacoplado | ✅ Consistente |
| ADR-013 §4.11 | String literals de planos/features **fora de `domain/` proibidas**; catálogo no domínio; leitura via `FeatureFlagService` | ✅ 6.0.5.3 elimina literais em SQL (`invite_team_member`) e `limits.ts` |
| `FEATURE_FLAGS_MODEL.md` §4 | Enforcement: `can('finance')` no front, `<FeatureGuard feature fallback={<UpgradePrompt/>}>`, RPC valida antes de executar, sidebar respeita via moduleRegistry | ✅ Modelo alvo — §4.2/§6 precisam de atualização (DIV-2) |
| `FEATURE_FLAGS_MODEL.md` §5 | Matriz por plano (12 flags listadas) | ⚠️ **Parcial** (12 de 20 — DIV-1) |
| `FEATURE_FLAGS_MODEL.md` §6 | Exemplo histórico `plans.features TEXT[]` + rascunho `tenant_has_feature` | ⚠️ **Substituído** por D-6.0.5-5 (`plans+features+plan_features`) — DIV-2 |
| Decisões D-6.0.5-1..8 (2026-08-06) | D-6.0.5-3: Plano Free congelado — 1 profissional, sem Chef Club, sem módulos Premium; **limites controlados exclusivamente por Feature Flags, nunca pelo nome do plano** | ✅ Fim de `limits.ts` |
| `PROJECT_STATUS.md` linha 292 | "chaves Supabase inválidas a rotacionar antes de smoke real" | ❌ **DESATUALIZADO** (DIV-4) — chaves validadas e smoke real 10/10 em 2026-08-06 |

---

## 2. Auditoria arquitetural

### 2.1 Estado atual (fatos verificados)

- **Modelo persistido (6.0.5.2, migration `20260806090000`, aplicada local)**: `plans(slug PK, name, price_cents, limits JSONB, status)` com `limits.max_staff` (free=1 / pro=5 / premium=null); `features(key PK, name, description, category, dependencies[])` — **20 keys idênticas aos `FEATURE_KEYS`**; `plan_features(plan_slug FK, feature_key FK, PK)` — free 14 / pro 15 / premium 20; FK aditiva `tenants.plan`/`subscriptions.plan` → `plans(slug)`; RLS catálogo (SELECT autenticado; escrita superadmin; grants service_role).
- **Enforcement atual: nenhum runtime.** Resolver `domain/authorization/featureAvailability.ts` (6.0.5.1) resolve via `PlanCatalog` (matriz estática tipada). `moduleRegistry.ts`/`modules.ts` gate por **app** (não por plano). `ensureAppSupportsModule` lança por app.
- **`limits.ts`**: `@deprecated`, `PLAN_LIMITS` free=1/pro=5/∞ → **eliminar** (ADR-013 §4.11 + D-6.0.5-3).
- **SQL hardcoded**: `invite_team_member` duplicado (migrations `20260806000000` e `20260806030000`) com literais `v_plan = 'free' AND v_total >= 1` / `'pro' AND v_total >= 5`.
- **`Admin.tsx:856`**: `supabase.from('tenants').update({ plan: newPlan }).eq('id', tenant_id)` — bypass do Single Writer (ADR-013 §2.4), chamador sem auth check além do RLS de `tenants`.
- **RPCs de subscription existentes**: `start_trial`, `activate_subscription`, `cancel_subscription` (migration `20260806020000` + refactors `06030000`/`06040000`/`06070000`). **Não existe RPC de troca de plano.**
- **Eventos (Fase 4)**: `appEventBus` + `event_store` (in-memory/BD), catálogo com `SubscriptionCreated`/`SubscriptionCancelled`. **`TenantSubscriptionUpdated` não existe.**
- **Gate `App.tsx`**: `ProtectedRoute` (linha 112), gate `profileStatus` pending/suspended (linha 155 → `/pending-approval`), gate módulo por app (linha 200), rotas (240–250). `AuthorizationService.getNavigationState` (6.0.5.1) já centraliza estado sem React.
- **Provisionamento**: `provision_new_tenant` insere `tenants(status='draft', plan='free')` — consistente.

### 2.2 Modelo alvo proposto (aditivo, sem quebra)

```
plans ──1:N── plan_features ──N:1── features            (catálogo global — 6.0.5.2)
                    ▲
              (matriz congelada)

feature_flags (tenant_id, feature_key, override, reason, created_by, created_at)
   PK (tenant_id, feature_key)   FK feature_key → features(key)
   ── runtime, escrita exclusiva superadmin (service_role) ──
```

- **`tenant_has_feature(p_tenant_id, p_feature)`** — SECURITY DEFINER STABLE: (1) `auth.uid()` presente (ADR-012); (2) resolve plano do tenant; (3) membership em `plan_features` (via `features.key`); (4) aplica override de `feature_flags` (se existir row, override vence); (5) deriva **override de suspensão** — tenant `suspended`/`archived` ⇒ `false` (derivado do estado efetivo, sem rows).
- **`FeatureFlagService`** (`domain/billing/featureFlagService.ts`, writer único): API `resolve(tenantId): FeatureSet` e `can(tenantId, featureKey): boolean`. **DI**: recebe `PlanCatalog` (DB-backed) + `FeatureOverrideStore` + estado do tenant. **Zero SQL no domínio** — a implementação DB-backed fica em adaptadores (`domain/`, padrão `supabaseBillingRepository.ts`), o domínio depende só da interface (preserva a pureza de `domain/`, padrão já usado por EventBus/Outbox). Adapters DB que usam `.from()` vivem em `domain/billing/` (camada permitida pelo Repository Guard); `application/` permanece apenas orquestração/casos de uso, sem acesso direto ao banco.
- **`PlanCatalog` DB-backed**: `domain/billing/planCatalogDb.ts` implementando o contrato de `domain/billing/planCatalog.ts` (`getPlan`/`getFeatures`/`hasFeature`/`getLimits`), fetch via `getSharedClient()`, valida `CATALOG_FINGERPRINT` vs BD (sync test da 6.0.5.2). Consumidores (featureAvailability, BillingService) inalterados.
- **Fim de `limits.ts`**: leitura de `plans.limits.max_staff` via `getLimits()`. `invite_team_member` passa a ler `plans.limits` (via `tenant_has_feature`/sub-query) — sem literais.
- **Frontend**: `useFeatureFlags()` (src/hooks/, lê via TenantContext + FeatureFlagService) expõe `can(key)`; `<FeatureGuard feature fallback={<UpgradePrompt/>}>`; sidebar passa a compor **app ∧ feature** (ex.: módulo financeiro visível só se `isAppModuleEnabled('barber','financial') ∧ can('finance')`).
- **Guarda `tenant_has_feature` nos RPCs protegidos (D-6.0.5.3-4)**: fechamento de caixa, comissões, receivables, expenses — via `CREATE OR REPLACE FUNCTION` na migration 6.0.5.3 (edição de RPCs existentes, **sem alterar regras de negócio**; apenas rejeita execução quando a flag do plano não está habilitada).
- **`change_tenant_plan` + `TenantSubscriptionUpdated` + correção `Admin.tsx:856`** → **REALOCADOS para 6.0.5.5** (D-6.0.5.3-2). O bypass de `Admin.tsx:856` permanece documentado nesta subfase (DIV-3), a ser eliminado na 6.0.5.5.
- **Unificação do gate `App.tsx`**: hierarquia profile→tenant→flag composta por `AuthorizationService.getNavigationState` (estado) + `isAppModuleEnabled` (app) + `can(feature)` (plano/override, via `FeatureFlagService`).

### 2.3 Por que tabela própria `feature_flags` (e não coluna em `plans`)

- D-6.0.5-5 já fixou `plans + features + plan_features` como **matriz global do plano**. Override tenant×flag (suporte, promoção, degustação, bloqueio temporário) é **exceção por tenant** — não cabe na matriz global.
- **Suspensão não persiste rows**: é derivada do estado efetivo (`AccessLevel none`), consistente com o modelo desacoplado (feature flags ≠ acesso). Manter como derivação evita estado duplicado e dessincronizado.
- Escrita da tabela: exclusivamente superadmin/service_role (RPC dedicado ou service), coerente com `plans_write_superadmin`.

### 2.4 Escopo delimitado da subfase (D-6.0.5.3-1)

**DENTRO do escopo (enforcement de Feature Flags + resolução de planos):**

| Bloco | O que faz | Não faz |
|-------|-----------|---------|
| Migration 6.0.5.3 | Tabela `feature_flags` + RLS + grants + RPC `tenant_has_feature` (única RPC nova) + guarda em 4 RPCs existentes (cash_closing, commissions, receivables, expenses) + `invite_team_member` lendo `plans.limits` | Não cria RPCs de billing/transição; não altera Billing Engine; não mexe em `subscriptions.status` |
| `FeatureFlagService` | Writer único das flags; API congelada (§2.5); resolve FeatureSet por tenant | Não decide acesso (quem sabe é AccessPolicy/EffectiveAccess); não conhece React/SQL |
| `PlanCatalog` DB-backed | Resolução de planos via BD (contrato 6.0.5.2 preservado) | Não valida cobrança/preços |
| Frontend | `useFeatureFlags`/`can`, `<FeatureGuard>`, `FeatureUnavailablePage` (híbrido), sidebar app∧feature, gate `App.tsx` | Não bloqueia escrita (backend é a camada de segurança) |
| `limits.ts`/SQL hardcoded | Leitura de limites via `plans.limits`; remoção de `limits.ts` do runtime | Sem mudança dos valores (free=1/pro=5/∞) |

**FORA do escopo (proibido nesta subfase):** Billing Engine, TenantLifecycle/suspensão automática, novas RPCs de transição (`change_tenant_plan`, `apply_subscription_transition`, evento `TenantSubscriptionUpdated`), correção `Admin.tsx:856`, RLS hardening, migrations de billing, guarda de checkout, preços/gateway.

### 2.5 API pública congelada — `FeatureFlagService` (pré-implementação)

> Contrato congelado pelo PO antes da implementação (ajuste #2). Implementação não altera esta API.

```typescript
// domain/billing/featureFlagService.ts

/** Resolução de flags efetivas de um tenant (plano + override + estado). */
export interface FeatureResolution {
  tenantId: string;
  planSlug: TenantPlan;               // plano base (fonte: PlanCatalog)
  enabledFeatures: FeatureSet;        // flags efetivas (FeatureKey[])
  overridden: FeatureKey[];           // flags com override ativo (diagnóstico)
  derivedFrom: 'active' | 'suspended'; // suspensão derruba flags (sem rows)
}

/** Store de overrides (interface no domínio; adapter em application/). */
export interface FeatureOverrideStore {
  getOverrides(tenantId: string): Promise<FeatureOverride[]>;
  // setOverride/setOverrides: somente superadmin/service (escrita via adapter)
}

export interface FeatureFlagService {
  resolve(tenantId: string): Promise<FeatureResolution>;
  can(tenantId: string, featureKey: FeatureKey): Promise<boolean>;
  getLimits(planSlug: TenantPlan): Promise<PlanLimits>; // via PlanCatalog.getLimits
}
```

**Dependências (DI, construtor):**
- `PlanCatalog` (implementação DB-backed em `domain/billing/planCatalogDb.ts` — contrato 6.0.5.2);
- `FeatureOverrideStore` (adapter `domain/billing/featureOverrideStoreDb.ts` — leitura de `feature_flags`);
- estado do tenant (`tenantStatus`) fornecido pelo chamador/TenantContext — **sem query de status dentro do service** (flag ≠ acesso; derivação de suspensão é coordenada pela composição, não pelo domínio).

**Pontos de extensão (documentados, não implementados nesta subfase):** cache de resolução por sessão (JWT claims/Redis), inclusão de flags em `get_auth_access_context`, Edge Function de sincronização — todos atrás da interface, sem mudança de consumidores (D-6.0.5.3-6).

**Regras da API:**
- `can()` **nunca lança por feature desconhecida** — retorna `false` (fail-closed).
- `resolve()` consolida: plano → matriz `plan_features` → override explícito (se houver row) → suspensão (`false` se `suspended`/`archived`).
- Nenhum consumidor acessa `feature_flags`/`plans`/`features`/`plan_features` diretamente (D-6.0.5.3-6).

### 2.6 Legado / Depreciação (lista e destino)

| Componente | Estado hoje | Ação na 6.0.5.3 | Permanecerá |
|-----------|-------------|------------------|-------------|
| `domain/billing/limits.ts` (`PLAN_LIMITS`) | `@deprecated` | **Removido do runtime** (leitura via `plans.limits`); constante eliminada | — |
| `invite_team_member` literais (`v_plan = 'free' AND v_total >= 1` / `'pro' AND v_total >= 5` — 2 cópias) | SQL hardcoded | **Substituído por leitura de `plans.limits.max_staff`** (mesmo comportamento) | — |
| `featureAvailability.ts` (matriz `PLAN_FEATURES` estática) | Resolver 6.0.5.1 | Mantém API; passa a consumir `FeatureFlagService`/PlanCatalog DB-backed (matriz tipada vira fallback para testes) | `@deprecated` na matriz estática, removida quando 6.0.5.5 encerrar transições |
| `moduleRegistry.ts`/`modules.ts` (`isAppModuleEnabled`) | Gate por app | Mantém (app); **compõe** com `can(feature)` no sidebar/gate | — |
| `pages/Admin.tsx:856` (update direto `tenants.plan`) | Bypass Single Writer | **Inalterado nesta subfase** — correção realocada para 6.0.5.5 (D-6.0.5.3-2); documentado como DIV-3 | até 6.0.5.5 |
| `can('feature')`/`FeatureGuard` inexistentes | — | Criados (novos) | — |
| RPCs protegidos (4) sem guarda | Executam sem verificação de flag | Ganham guarda `tenant_has_feature` | — |

---

## 3. Auditoria de nomenclatura

**`FeatureKey` (20) é a chave única de `features`** — `feature_flags.feature_key` → FK `features(key)`. **Nunca** `AppModuleSlug` (21 módulos de rota/UI; taxonomias distintas, DIV-A da 6.0.5.2).

Novos nomes propostos (seguem convenções do repo — snake_case RPC, PascalCase service/component, camelCase hook):

| Item | Nome | Observação |
|------|------|------------|
| Tabela runtime | `feature_flags` | Sem "overrides" — prefixo da feature, singular flag |
| RPC de verificação | `tenant_has_feature` | Literal do FEATURE_FLAGS_MODEL §6; **única RPC nova** desta subfase |
| Service (writer único) | `FeatureFlagService` (`domain/billing/featureFlagService.ts`) | Contexto "Feature Flags" do ADR-013 |
| Implementação DB do catálogo | `planCatalogDb.ts` (`domain/billing/`) | Adapter — domínio mantém a interface; `domain/` é camada permitida pelo Repository Guard (padrão `supabaseBillingRepository.ts`) |
| Hook | `useFeatureFlags` (src/hooks/) | Padrão `use*.ts` existente |
| Componentes | `FeatureGuard` + `FeatureUnavailablePage` (components/) | Híbrido (D-6.0.5.3-5); `FeatureUnavailablePage` parametrizada e reutilizável |
| Store de overrides (interface) | `FeatureOverrideStore` | Interface no domínio, adapter `domain/billing/featureOverrideStoreDb.ts` |
| ~~RPC de troca de plano~~ | ~~`change_tenant_plan`~~ | **Realocada para 6.0.5.5** (D-6.0.5.3-2) |
| ~~Evento~~ | ~~`TenantSubscriptionUpdated`~~ | **Realocado para 6.0.5.5** (D-6.0.5.3-2) |

---

## 4. Auditoria de consistência

| # | Verificação | Resultado |
|---|-------------|-----------|
| **C1** | `features` (20, seed 6.0.5.2) × `FEATURE_KEYS` (20, `featureKey.ts`) × FEATURE_FLAGS_MODEL §3 | ✅ Idênticos (1:1, grafia e dependências) |
| **C2** | `plan_features` seed (free 14/pro 15/premium 20) × `PLAN_FEATURES` | ✅ Teste de sincronismo 6.0.5.2 garante |
| **C3** | Matriz FEATURE_FLAGS_MODEL §5 × seed | ⚠️ §5 lista 12 de 20 flags (parcial/ilustrativa — **DIV-1**) |
| **C4** | `invite_team_member` (free≥1/pro≥5) × `plans.limits.max_staff` | ✅ Mesmos valores; 6.0.5.3 troca literal por leitura via `plans` |
| **C5** | `limits.ts` (free=1/pro=5/∞) × `plans.limits` | ✅ Idênticos; `limits.ts` eliminado na 6.0.5.3 |
| **C6** | Gate `App.tsx` hoje = app (moduleRegistry) + estado (profileStatus/tenant) | ✅ Sem plano; 6.0.5.3 adiciona flags na hierarquia |
| **C7** | `Admin.tsx:856` update direto `tenants.plan` | ❌ Bypass Single Writer (ADR-013 §2.4) — **correção realocada para 6.0.5.5** (D-6.0.5.3-2); DIV-3 registrado |
| **C8** | Catálogo de eventos: `TenantSubscriptionUpdated` | ➖ Fora do escopo — realocado para 6.0.5.5 (D-6.0.5.3-2); nada a criar nesta subfase |
| **C9** | `tenant_has_feature` (RPC) | ❌ Não existe — criar com grants ADR-012 (auth.uid() + SECURITY DEFINER) na migration 6.0.5.3 |
| **C10** | Provisionamento (`provision_new_tenant` → `plan='free'`) | ✅ Consistente com matriz free; nenhuma mudança necessária |

---

## 5. Divergências encontradas

| # | Divergência | Resolução proposta 6.0.5.3 |
|---|-------------|---------------------------|
| **DIV-1** | `FEATURE_FLAGS_MODEL.md` §5 lista matriz **parcial** (12 de 20 flags) vs seed canônico 14/15/20 | Atualizar §5 para a matriz completa (ou anotar "ilustrativa — fonte canônica = seed `plan_features`") |
| **DIV-2** | `FEATURE_FLAGS_MODEL.md` §6 propõe `plans.features TEXT[]` (histórico) — **substituído** por D-6.0.5-5 | Reescrever §6 com o `tenant_has_feature` real (leitura via `plan_features`) quando a RPC for criada |
| **DIV-3** | `Admin.tsx:856` bypass Single Writer | Correção via `change_tenant_plan` **realocada para 6.0.5.5** (D-6.0.5.3-2); bypass documentado e inalterado nesta subfase |
| **DIV-4** | `PROJECT_STATUS.md:292` ("chaves inválidas a rotacionar") — **desatualizado** | Auditoria de prontidão (2026-08-06) provou chaves válidas (REST/admin 200) + smoke real 10/10; corrigir na atualização de docs desta subfase |
| **DIV-5** | `invite_team_member` duplicado em 2 migrations com literais | Reescrever leitura de limite via `plans.limits` (uma fonte) |

---

## 6. Escopo proposto (aprovado com ajustes — D-6.0.5.3-1)

| # | Entregável | Detalhe |
|---|-----------|---------|
| 1 | Migration `20260807000000_phase_6_0_5_3_feature_flags.sql` | Tabela `feature_flags` (runtime) + RLS (escrita superadmin; leitura **somente via RPC** — D-6.0.5.3-6) + RPC `tenant_has_feature` (SECURITY DEFINER STABLE, auth.uid(), override + suspensão derivada) + guarda nos 4 RPCs protegidos (cash_closing, commissions, receivables, expenses) + `invite_team_member` via `plans.limits` + grants. **Sem RPCs de billing/transição** |
| 2 | `FeatureFlagService` (`domain/billing/featureFlagService.ts`) | Writer único; **API congelada §2.5** (`resolve`/`can`/`getLimits`); DI (PlanCatalog + FeatureOverrideStore + estado); zero SQL |
| 3 | `PlanCatalog` DB-backed (`domain/billing/planCatalogDb.ts`) | Implementa contrato 6.0.5.2 via `getSharedClient()`; valida `CATALOG_FINGERPRINT`; swap preserva consumidores |
| 4 | Fim de `limits.ts` no runtime | Leitura via `getLimits()`/`plans.limits`; `PLAN_LIMITS` eliminada; sem mudança de valores |
| 5 | Frontend: `useFeatureFlags` + `<FeatureGuard>` + `FeatureUnavailablePage` | Hook (src/hooks/), guards (components/); híbrido (D-6.0.5.3-5); leitura só via RPC (D-6.0.5.3-6) |
| 6 | Sidebar/moduleRegistry | Gate composto app ∧ feature (financeiro, chef_club, bi, api, whatsapp, marketplace) |
| 7 | Guarda `tenant_has_feature` nos 4 RPCs | Fechamento de caixa, comissões, receivables, expenses (D-6.0.5.3-4) |
| 8 | Unificação gate `App.tsx` | Hierarquia profile→tenant→flag via `AuthorizationService` + `can()` |
| 9 | Docs + ROADMAP + PROJECT_STATUS + changelog | FEATURE_FLAGS_MODEL §4.2/§5/§6 alinhados, BUSINESS_DECISIONS (D-6.0.5.3-1..6), entry audit, DIV-4 corrigido |

**Fora do escopo (proibido nesta subfase — D-6.0.5.3-1):**
- ❌ Billing Engine (cadência, invoices, payments) e alteração de `subscriptions.status`
- ❌ TenantLifecycle / suspensão automática / transições `suspended`/`archived` (6.0.5.4)
- ❌ Novas RPCs de transição: `change_tenant_plan`, `apply_subscription_transition`, evento `TenantSubscriptionUpdated` (6.0.5.5)
- ❌ Correção `Admin.tsx:856` (realocada para 6.0.5.5 — DIV-3)
- ❌ RLS hardening do backlog (2 policies) — janela de infra separada
- ❌ Guarda de checkout (não aprovada — D-6.0.5.3-4)
- ❌ Preços comerciais, `price_cents`, gateway de pagamento (decisão PO)
- ❌ Multi-schema (flags são tabelas `public`/shared)
- ❌ Housekeeping de usuários órfãos E2E — janela separada

---

## 7. Critérios de teste (ampliados — ajuste do PO)

Regressão completa da matriz de planos e Feature Flags, cobrindo:

| # | Cenário | Cobertura |
|---|---------|-----------|
| T1 | Resolução por plano | `resolve`/`can` para **free** (14), **pro** (15), **premium** (20) — flags habilitadas = matriz `plan_features` |
| T2 | Não-membro | Flag não incluída no plano → `can` = `false` (ex.: `bi` no free; `chef_club` no free; `api` no pro) |
| T3 | Override enable/disable | `feature_flags` row override habilita flag fora da matriz e desabilita flag da matriz (override vence) |
| T4 | Suspensão | Tenant `suspended`/`archived` → todas as flags `false` (derivação, sem rows) |
| T5 | Auth ausente | `tenant_has_feature` sem `auth.uid()` → rejeita (ADR-012) |
| T6 | **Upgrade/downgrade** | Troca de `tenants.plan` (ex.: free→pro→premium→free) → resolução reflete a matriz do plano novo (teste via estado do tenant; `change_tenant_plan` é 6.0.5.5) |
| T7 | **Consistência documental × código** | `features` BD × `FEATURE_KEYS` × FEATURE_FLAGS_MODEL §3 idênticos; `plan_features` BD × `PLAN_FEATURES` × matriz §5 (após atualização) — teste de sincronismo estendido |
| T8 | Limites | `getLimits()` = `plans.limits` (free=1/pro=5/premium=∞) × comportamento `invite_team_member` (free limite 1, pro limite 5) |
| T9 | UI híbrida | Sidebar esconde módulo com flag desabilitada; rota direta → `FeatureUnavailablePage` (nunca 403/404 genérico) |
| T10 | RPCs protegidos | Guarda `tenant_has_feature` nos 4 RPCs: execução permitida com flag, rejeitada sem flag (mesma regra de negócio preservada) |

**Integração/regressão:** suíte unitária completa verde, typecheck (baseline 125), build OK, smoke E2E verde.

---

## 8. Critérios de saída (certificação — atualizados pelo PO)

- [x] Migration 6.0.5.3 escrita e validada (aplica 2× em Postgres 16 local, sem duplicar)
- [x] **Ausência de decisões diretas por plano** no frontend/rotas (verificação grep: nenhum `plan === 'free'|'pro'|'premium'` fora de `domain/` + RPCs) — restam apenas referências estéticas (badges de plano em Admin/Sidebar e tabs de marketing em Login), nenhuma decisão de capacidade
- [x] **Uso exclusivo do `FeatureFlagService` para decisões de capacidade** (nenhum consumidor lê `feature_flags`/`plans`/`features`/`plan_features` — D-6.0.5.3-6)
- [x] **`limits.ts` fora do runtime** (leitura via `plans.limits`; `PLAN_LIMITS` eliminada; valores preservados free=1/pro=5/∞)
- [x] **Matriz documental sincronizada com o código** (T7 — `features`/`plan_features` BD × TS × FEATURE_FLAGS_MODEL) — garantido por `planCatalogMigrationSync.test.ts` (7 testes verdes: BD↔TS bidirecional)
- [x] `tenant_has_feature` correto nos cenários T1–T7 (validado em Postgres 16); guarda nos RPCs aprovados (D-6.0.5.3-4) na migration
- [x] `FeatureFlagService` com testes T1–T6; `PlanCatalog` DB-backed com `CATALOG_FINGERPRINT` validado contra o seed
- [x] Sidebar respeita app ∧ feature; `FeatureUnavailablePage` reutilizável (T9)
- [x] `Admin.tsx:856` **inalterado e documentado** (DIV-3) — correção na 6.0.5.5
- [x] Suíte unitária verde + typecheck (baseline 125) + build OK + **smoke E2E permanece verde** — unit 847/847 ✓, build OK ✓, typecheck baseline ✓, **smoke E2E 10/10 PASS (46.7s, Supabase real, 2026-08-07)** ✓
- [x] Docs + ROADMAP + PROJECT_STATUS + changelog + BUSINESS_DECISIONS (D-6.0.5.3) atualizados; commit semântico + push (política automática) — docs atualizados; commit/push nesta entrega
- [ ] **Deploy ao remoto** (janela de operação, D-6.0.5.3-3): `supabase db query --linked -f` + `supabase migration repair --status applied` para `06030000`, `06090000` e a migration 6.0.5.3

---

## 9. Riscos

| Risco | Mitigação |
|-------|-----------|
| `plans`/`features`/`plan_features` não aplicados no remoto (deploy 6.0.5.2 deferido) | Procedimento aprovado (D-6.0.5.3-3): `db query --linked` + `migration repair` na janela de operação; `tenant_has_feature` só ativa após a `06090000` |
| Mudança visual (flags escondem módulos) surpreender usuário | Híbrido aprovado (D-6.0.5.3-5); `FeatureUnavailablePage` reutilizável com convite de upgrade |
| Guarda em RPC existente quebrar fluxo (fechamento de caixa etc.) | Guarda aditiva (rejeita só quando flag ausente); regras de negócio preservadas; T10 + smoke E2E |
| Override desabilitar flag essencial e travar o tenant | Escrita de `feature_flags` só superadmin + auditoria; `tenant_has_feature` nunca lança (fail-closed `false`) |
| Regressão de `invite_team_member` ao trocar literal por `plans.limits` | Mesmos valores; T8 (free limite 1 / pro limite 5) |
| Latência por página (query de flags a cada render) | `useFeatureFlags` com cache no TenantContext (uma resolução por sessão/mudança de plano); otimizações futuras atrás da abstração (D-6.0.5.3-6) |
| `featureAvailability.ts` (matriz estática) divergir do DB | Vira fallback de testes/`@deprecated`; PlanCatalog DB-backed é a fonte de runtime; T7 garante sincronismo |

---

## 10. Relatório final (para aprovação do PO)

A auditoria de entrada da **6.0.5.3** está **concluída** e **revisada** com os ajustes do PO (2026-08-07):

1. **Escopo delimitado** (D-6.0.5.3-1): somente enforcement de Feature Flags + resolução de planos. Billing Engine, Lifecycle, novas RPCs de transição, RLS, migrations de billing e suspensão automática **fora**.
2. **API pública do `FeatureFlagService` congelada** (§2.5): `resolve`/`can`/`getLimits` + dependências DI + pontos de extensão — antes da implementação.
3. **Legado/depreciação** (§2.6): `limits.ts` (removido do runtime), `invite_team_member` literais (substituídos), `featureAvailability` matriz estática (`@deprecated`), `Admin.tsx:856` (inalterado, correção 6.0.5.5).
4. **Testes ampliados** (§7): regressão completa da matriz Free/Pro/Premium + upgrade/downgrade + consistência documental × código (T1–T10).
5. **Critérios de saída atualizados** (§8): zero decisões diretas por plano, uso exclusivo do `FeatureFlagService`, `limits.ts` fora do runtime, matriz documental sincronizada, smoke E2E verde.
6. **Decisões do PO registradas**: D-6.0.5.3-1..6 em `BUSINESS_DECISIONS.md`; deploy via `MIGRATION_EXCEPTION` (D-6.0.5.3-3); RPCs protegidos = cash_closing, commissions, receivables, expenses (D-6.0.5.3-4); UI híbrida (D-6.0.5.3-5); leitura só via RPC (D-6.0.5.3-6).

Divergências DIV-1..5 documentadas (DIV-3 realocada para 6.0.5.5). **A implementação só começa após a aprovação explícita deste relatório pelo PO.**
