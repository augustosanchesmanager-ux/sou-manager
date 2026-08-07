# PHASE 6.0.5.3 — ENTRY AUDIT (FeatureFlagService + Feature Flags Enforcement)

> **Data:** 2026-08-07
> **Autorização:** Auditoria de entrada solicitada pelo PO (2026-08-06) antes de qualquer código (Regra de Entrada), após certificação do smoke 6.0.5.2 (10/10 PASS).
> **Modo:** Somente leitura — nenhum arquivo de código ou migration foi alterado.
> **Baseline de referência:** `v1.4.3` / **6.0.5.2 CERTIFICADA** (smoke E2E 10/10 em 48.4s, 2026-08-06)
> **Branch:** `feature/phase-6.0.4-billing`
> **Fonte de autoridade:** ADR-013 §2.4/§3.1/§4 (Feature Flags = 3º contexto desacoplado; writer único `FeatureFlagService`; string literals de planos/features fora de `domain/` proibidas) + `PHASE_6_0_5_ENTRY_AUDIT.md` §8 (subfase 6.0.5.3) + `FEATURE_FLAGS_MODEL.md` §4/§5/§6 + decisões D-6.0.5-1..8 (BUSINESS_DECISIONS.md F7/F8).

---

## STATUS: ⏳ EM AUDITORIA — PLANO SUBMETIDO, AGUARDANDO APROVAÇÃO DO PO

> A auditoria de entrada está **concluída** e o plano de execução de §6 está **submetido ao PO**. Nenhuma implementação será iniciada antes da aprovação explícita (fluxo oficial: auditoria → plano → aprovação → implementação).

---

## Resumo executivo

A **6.0.5.3** implementa o **enforcement por Feature Flags** — o 3º contexto desacoplado do ADR-013 (funcionalidade), complementando Subscription (contrato) e Tenant (acesso) já cobertos. Sobre o modelo persistido pela 6.0.5.2 (`plans`/`features`/`plan_features`, migration `20260806090000`), a 6.0.5.3 adiciona:

- **Tabela runtime `feature_flags`** (override tenant×flag, escrita exclusiva superadmin) + **RPC `tenant_has_feature`** (SECURITY DEFINER, grants ADR-012);
- **`FeatureFlagService`** (`domain/billing/`) como **writer único** das flags — resolve o `FeatureSet` por tenant combinando **PlanCatalog DB-backed** + overrides + estado efetivo (suspensão derruba flags);
- **`PlanCatalog` DB-backed** (implementação trocada de static → banco, contrato preservado — acréscimo obrigatório do PO na 6.0.5.2);
- **Fim de `limits.ts`** (leitura via `plans.limits`) e **fim dos SQL hardcoded** (`invite_team_member` free=1/pro=5 → `plans.limits.max_staff`);
- **Frontend**: `useFeatureFlags()`/`can()` + `<FeatureGuard>` + `UpgradePrompt`; gate do sidebar por **app ∧ feature**;
- **RPCs críticos** com guarda `tenant_has_feature` (lista financeira a validar com o PO);
- **Upgrade/downgrade via engine**: RPC `change_tenant_plan` + evento `TenantSubscriptionUpdated`; substitui o bypass `Admin.tsx:856` (update direto de `tenants.plan` violando Single Writer);
- **Unificação do gate em `App.tsx`** com hierarquia profile→tenant→flag.

**Perímetro congelado:** enforcement de leitura e navegação. **Não** toca em `suspended`/transições de status (6.0.5.4), nem RPCs de transição de billing (6.0.5.5), nem preços/gateway (comercial do PO).

**Dependência crítica de deploy:** a 6.0.5.3 depende das tabelas `plans`/`features`/`plan_features` da 6.0.5.2 **no remoto** — que estão **pendentes de deploy** (janela apropriada, decisão PO 2026-08-06). A estratégia de deploy da 6.0.5.3 (migração tolerante vs. janela conjunta) é uma das aprovações solicitadas ao PO (§6/§8).

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
- **`FeatureFlagService`** (`domain/billing/featureFlagService.ts`, writer único): API `resolve(tenantId): FeatureSet` e `can(tenantId, featureKey): boolean`. **DI**: recebe `PlanCatalog` (DB-backed) + `FeatureOverrideStore` + estado do tenant. **Zero SQL no domínio** — a implementação DB-backed fica em adaptadores (`application/`), o domínio depende só da interface (preserva a pureza de `domain/`, padrão já usado por EventBus/Outbox).
- **`PlanCatalog` DB-backed**: `application/billing/planCatalogDb.ts` implementando o contrato de `domain/billing/planCatalog.ts` (`getPlan`/`getFeatures`/`hasFeature`/`getLimits`), fetch via `getSharedClient()`, valida `CATALOG_FINGERPRINT` vs BD (sync test da 6.0.5.2). Consumidores (featureAvailability, BillingService) inalterados.
- **Fim de `limits.ts`**: leitura de `plans.limits.max_staff` via `getLimits()`. `invite_team_member` passa a ler `plans.limits` (via `tenant_has_feature`/sub-query) — sem literais.
- **Frontend**: `useFeatureFlags()` (src/hooks/, lê via TenantContext + FeatureFlagService) expõe `can(key)`; `<FeatureGuard feature fallback={<UpgradePrompt/>}>`; sidebar passa a compor **app ∧ feature** (ex.: módulo financeiro visível só se `isAppModuleEnabled('barber','financial') ∧ can('finance')`).
- **`change_tenant_plan(p_tenant_id, p_plan_slug)`** — SECURITY DEFINER: gestor/superadmin; valida plano existe; atualiza `tenants.plan` (+ `subscriptions.plan` da assinatura ativa); registra `record_billing_event('plan_changed', ...)`; publica **`TenantSubscriptionUpdated`** no `appEventBus`. Substitui `Admin.tsx:856`.
- **Unificação do gate `App.tsx`**: hierarquia profile→tenant→flag composta por `AuthorizationService.getNavigationState` (estado) + `isAppModuleEnabled` (app) + `can(feature)` (plano/override).

### 2.3 Por que tabela própria `feature_flags` (e não coluna em `plans`)

- D-6.0.5-5 já fixou `plans + features + plan_features` como **matriz global do plano**. Override tenant×flag (suporte, promoção, degustação, bloqueio temporário) é **exceção por tenant** — não cabe na matriz global.
- **Suspensão não persiste rows**: é derivada do estado efetivo (`AccessLevel none`), consistente com o modelo desacoplado (feature flags ≠ acesso). Manter como derivação evita estado duplicado e dessincronizado.
- Escrita da tabela: exclusivamente superadmin/service_role (RPC dedicado ou service), coerente com `plans_write_superadmin`.

---

## 3. Auditoria de nomenclatura

**`FeatureKey` (20) é a chave única de `features`** — `feature_flags.feature_key` → FK `features(key)`. **Nunca** `AppModuleSlug` (21 módulos de rota/UI; taxonomias distintas, DIV-A da 6.0.5.2).

Novos nomes propostos (seguem convenções do repo — snake_case RPC, PascalCase service/component, camelCase hook):

| Item | Nome | Observação |
|------|------|------------|
| Tabela runtime | `feature_flags` | Sem "overrides" — prefixo da feature, singular flag |
| RPC de verificação | `tenant_has_feature` | Literal do FEATURE_FLAGS_MODEL §6 |
| RPC de troca de plano | `change_tenant_plan` | Verbo `change_*` alinhado a `cancel_subscription` |
| Service (writer único) | `FeatureFlagService` (`domain/billing/featureFlagService.ts`) | Contexto "Feature Flags" do ADR-013 |
| Implementação DB do catálogo | `planCatalogDb.ts` (`application/billing/`) | Adapter — domínio mantém a interface |
| Hook | `useFeatureFlags` (src/hooks/) | Padrão `use*.ts` existente |
| Componente | `FeatureGuard` + `UpgradePrompt` (components/) | Padrão `*Route`/`*Guard` existente |
| Evento | `TenantSubscriptionUpdated` | Padrão `*Updated` do catálogo de eventos |
| Store de overrides (interface) | `FeatureOverrideStore` | Interface no domínio, adapter `application/` |

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
| **C7** | `Admin.tsx:856` update direto `tenants.plan` | ❌ Bypass Single Writer (ADR-013 §2.4) — substituir por `change_tenant_plan` |
| **C8** | Catálogo de eventos: `TenantSubscriptionUpdated` | ❌ Não existe — criar em `domain/events/types.ts` + publicar no `change_tenant_plan` |
| **C9** | `tenant_has_feature` (RPC) | ❌ Não existe — criar com grants ADR-012 (auth.uid() + SECURITY DEFINER) |
| **C10** | Provisionamento (`provision_new_tenant` → `plan='free'`) | ✅ Consistente com matriz free; nenhuma mudança necessária |

---

## 5. Divergências encontradas

| # | Divergência | Resolução proposta 6.0.5.3 |
|---|-------------|---------------------------|
| **DIV-1** | `FEATURE_FLAGS_MODEL.md` §5 lista matriz **parcial** (12 de 20 flags) vs seed canônico 14/15/20 | Atualizar §5 para a matriz completa (ou anotar "ilustrativa — fonte canônica = seed `plan_features`") |
| **DIV-2** | `FEATURE_FLAGS_MODEL.md` §6 propõe `plans.features TEXT[]` (histórico) — **substituído** por D-6.0.5-5 | Reescrever §6 com o `tenant_has_feature` real (leitura via `plan_features`) quando a RPC for criada |
| **DIV-3** | `Admin.tsx:856` bypass Single Writer | Nova RPC `change_tenant_plan` (auth check + evento) substitui o update direto |
| **DIV-4** | `PROJECT_STATUS.md:292` ("chaves inválidas a rotacionar") — **desatualizado** | Auditoria de prontidão (2026-08-06) provou chaves válidas (REST/admin 200) + smoke real 10/10; corrigir na atualização de docs desta subfase |
| **DIV-5** | `invite_team_member` duplicado em 2 migrations com literais | Reescrever leitura de limite via `plans.limits` (uma fonte) |

---

## 6. Escopo proposto (para aprovação do PO)

| # | Entregável | Detalhe | Depende de |
|---|-----------|---------|-----------|
| 1 | Migration `20260807000000_phase_6_0_5_3_feature_flags.sql` | Tabela `feature_flags` (runtime) + RLS (superadmin write; leitura via RPC) + RPC `tenant_has_feature` (SECURITY DEFINER STABLE, auth.uid(), override + suspensão derivada) + RPC `change_tenant_plan` (gestor/superadmin, atualiza `tenants.plan`/`subscriptions.plan` ativa, `record_billing_event`, retorna) + grants | Deploy de `20260806090000` no remoto (ou migração tolerante — ver aprovação A1) |
| 2 | `FeatureFlagService` (`domain/billing/`) | Writer único: `resolve(tenantId): FeatureSet` + `can(tenantId, key)`; DI (PlanCatalog + FeatureOverrideStore + estado); zero SQL | — |
| 3 | `PlanCatalog` DB-backed (`application/billing/planCatalogDb.ts`) | Implementa contrato 6.0.5.2 via `getSharedClient()`; valida `CATALOG_FINGERPRINT`; swap preserva consumidores | Deploy de `20260806090000` |
| 4 | Fim de `limits.ts` | Leitura via `getLimits()`; remover `PLAN_LIMITS`; `invite_team_member` via `plans.limits` | — |
| 5 | Frontend: `useFeatureFlags` + `<FeatureGuard>` + `UpgradePrompt` | Hook (src/hooks/), guards (components/); lê via TenantContext + FeatureFlagService | — |
| 6 | Sidebar/moduleRegistry | Gate composto app ∧ feature (financeiro, chef_club, bi, api, whatsapp, marketplace) | — |
| 7 | RPCs com `tenant_has_feature` | Guarda nos RPCs financeiros críticos — **lista a validar com o PO (A2)** | — |
| 8 | `change_tenant_plan` + `TenantSubscriptionUpdated` | RPC novo + evento no catálogo + subscriber preparado (audit) + corrigir `Admin.tsx:856` | — |
| 9 | Unificação gate `App.tsx` | Hierarquia profile→tenant→flag via `AuthorizationService` + `can()` | — |
| 10 | Docs + ROADMAP + PROJECT_STATUS + changelog | FEATURE_FLAGS_MODEL §4.2/§5/§6, ADR-013 nota, entry audit, DIV-4 corrigido | — |

**Fora do escopo (proibido nesta subfase):**
- ❌ `suspended`/`archived` transições e `TenantLifecycleService` (6.0.5.4)
- ❌ RPCs de transição billing / `apply_subscription_transition` (6.0.5.5)
- ❌ Alterar `subscriptions.status`/Billing Engine (cadência, invoices, gateway)
- ❌ Preços comerciais, `price_cents`, gateway de pagamento (decisão PO)
- ❌ Multi-schema (flags são tabelas `public`/shared)
- ❌ RLS hardening do backlog (2 policies) — janela de infra separada
- ❌ Housekeeping de usuários órfãos E2E — janela separada

---

## 7. Aprovações solicitadas ao PO

| # | Decisão | Opções |
|---|---------|--------|
| **A1** | Estratégia de deploy da migration 6.0.5.3 | **(a)** Migração tolerante (cria `feature_flags` sem FK `feature_key` se `features` não existir — degrada até a 06090000 chegar); **(b)** janela conjunta obrigatória (`06090000` + `06030000` + `06030000` segurança + 6.0.5.3 juntas); **(c)** outra |
| **A2** | Lista de RPCs que recebem guarda `tenant_has_feature` | Proposta inicial: fechamento de caixa, comissões, receivables, expenses, checkout. PO confirma/ajusta |
| **A3** | Comportamento de UI quando flag desabilitada | (a) Esconder módulo (sidebar/rotas); (b) mostrar com `UpgradePrompt` em rota; (c) híbrido (esconder menu, prompt em rota direta) |
| **A4** | Grants/leitura de `feature_flags` | (a) Só via RPC `tenant_has_feature` (sem SELECT direto); (b) SELECT do próprio tenant autenticado |

---

## 8. Critérios de saída propostos (certificação)

- [ ] Migration 6.0.5.3 escrita e validada (aplica 2× em Postgres 16 local, sem duplicar)
- [ ] `tenant_has_feature` correto nos cenários: membro da matriz, não-membro, override enable/disable, tenant suspenso/arquivado (false), auth ausente (rejeita)
- [ ] `FeatureFlagService` com testes (resolver por plano + overrides + suspensão); `PlanCatalog` DB-backed com fingerprint validado contra o seed
- [ ] `limits.ts` eliminado; **zero literais de plano/feature fora de `domain/`** (verificação grep)
- [ ] Sidebar respeita app ∧ feature; `<FeatureGuard>` com `UpgradePrompt` funcional
- [ ] `Admin.tsx:856` usa `change_tenant_plan` (nenhum `supabase.from('tenants').update` de plano)
- [ ] Guarda `tenant_has_feature` nos RPCs financeiros aprovados (A2)
- [ ] `TenantSubscriptionUpdated` publicado no `change_tenant_plan`; event store compatível (Fase 4)
- [ ] Suíte unitária verde + typecheck (baseline 125) + build OK + E2E smoke sem regressão
- [ ] Docs + ROADMAP + PROJECT_STATUS + changelog atualizados; commit semântico + push (política automática)
- [ ] **Deploy ao remoto**: janela aprovada (A1)

---

## 9. Riscos

| Risco | Mitigação |
|-------|-----------|
| `plans`/`features`/`plan_features` não aplicados no remoto (deploy deferido da 6.0.5.2) | Migração tolerante (A1-a) ou janela conjunta (A1-b); `tenant_has_feature` só ativa após a 06090000 |
| Mudança visual (flags escondem módulos) surpreender usuário | Revisão da matriz/lista de flags com PO (A3); fallback `UpgradePrompt` em rota |
| Bypass `Admin.tsx:856` trocado por RPC com auth errada | RPC SECURITY DEFINER + `current_is_tenant_manager_from_auth_uid`/superadmin + teste E2E superadmin |
| Override desabilitar flag essencial e travar o tenant | Escrita de `feature_flags` só superadmin + `record_billing_event`/auditoria de mudanças |
| `TenantSubscriptionUpdated` novo no catálogo quebrar EventStore | Evento aditivo no union; teste de event store/bus (Fase 4) |
| Latência por página (query de flags a cada render) | `useFeatureFlags` com cache no TenantContext (uma resolução por sessão/mudança de plano) |
| `invite_team_member` regressão após troca do literal | Teste unitário/E2E de convite em free (limite 1) e pro (5) |

---

## 10. Conclusão

A auditoria de entrada da **6.0.5.3** está **concluída** (documental, arquitetural, nomenclatura e consistência). O modelo alvo é **aditivo e sem quebra** sobre a 6.0.5.2: `feature_flags` runtime + `tenant_has_feature` + `FeatureFlagService` (writer único) + `PlanCatalog` DB-backed + fim de `limits.ts`/SQL hardcoded + `change_tenant_plan`/`TenantSubscriptionUpdated` + unificação do gate em `App.tsx`. Divergências DIV-1..5 documentadas. A implementação **só começa após a aprovação explícita do PO** (incluindo A1–A4).
