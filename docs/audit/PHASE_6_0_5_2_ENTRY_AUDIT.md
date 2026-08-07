# PHASE 6.0.5.2 — ENTRY AUDIT (BillingService + Modelagem de Plans)

> **Data:** 2026-08-06
> **Autorização:** Auditoria de entrada solicitada pelo PO antes de qualquer código (Regra de Entrada).
> **Modo:** Somente leitura — nenhum arquivo de código ou migration foi alterado.
> **Baseline de referência:** `v1.4.3-effective-state-6.0.5.1` (commit `622a891`, 6.0.5.1 **CERTIFICADA** pelo PO)
> **Branch:** `feature/phase-6.0.4-billing`
> **Fonte de autoridade:** ADR-013 §2.4 (responsabilidades), §4 (proibições/grants), §6.1 (D-6.0.5-5: modelo `plans + features + plan_features`) + `PHASE_6_0_5_ENTRY_AUDIT.md` §8 (subfase 6.0.5.2, realocada via DIV-1).

---

## STATUS: 🔍 EM AUDITORIA (aguardando aprovação do PO)

> Critérios de entrada em avaliação. Nenhuma decisão de implementação é tomada nesta auditoria; o escopo proposto depende de **approval formal do PO**.

---

## Resumo executivo

A **6.0.5.2** cria o **modelo relacional de planos** (D-6.0.5-5): as tabelas `plans`, `features` e `plan_features` + seed idempotente, tornando a matriz congelada de `FEATURE_FLAGS_MODEL.md` §5 **persistida e consultável** em vez de constantes soltas no TS. Hoje o catálogo vive em `domain/authorization/featureAvailability.ts` (resolver, 20 `FeatureKey`) e os limites em `domain/billing/limits.ts` (free=1/pro=5/∞). A 6.0.5.2 **não** implementa enforcement (6.0.5.3), nem `suspended` (6.0.5.4), nem RPCs de transição (6.0.5.5).

**Perímetro congelado:** persistir o catálogo + seed idempotente + ligar `tenants.plan`/`subscriptions.plan` à tabela `plans` de forma **aditiva e sem quebra** (FK TEXT por slug, dropar CHECK). Single Writer do agregado `plans` = **BillingService** (ADR-013 §2.4).

---

## 1. Auditoria documental

| Fonte | O que diz sobre 6.0.5.2 | Consistência |
|-------|--------------------------|--------------|
| `PHASE_6_0_5_ENTRY_AUDIT.md` §8 | 6.0.5.2 = tabela `plans` (slug free/pro/premium, limites, preços mensal) + `features` (catálogo único, 20 flags) + `plan_features` (matriz F8: plano conhece flags); migration + seed idempotente; `tenants.plan`/`subscriptions.plan` passam a referenciar `plans`; fim dos slugs soltos | ✅ Alinhado ao ROADMAP (`6.0.5.2 BillingService + Modelagem de Plans (D-6.0.5-5)`) |
| ADR-013 §2.4 (tabela de writers) | `plans` → BillingService (catálogo/seed) | ⚠️ **DIV-D**: a coluna cita "6.0.5.1" — realocado para 6.0.5.2 via DIV-1 |
| ADR-013 §6.1 (D-6.0.5-5) | Modelo de dados de flags = `plans + features + plan_features` (D4/P4) | ✅ Consistente |
| `FEATURE_FLAGS_MODEL.md` §3/§5 | Catálogo (20 flags, com dependências) + matriz por plano | ✅ Consistente com `FeatureKey` |
| ADR-013 §4.x | Proibido duplicar regras banco×frontend; `limits.ts` órfão eliminado na 6.0.5.3 | ✅ 6.0.5.2 só persiste; enforcement/leitura única = 6.0.5.3 |

---

## 2. Auditoria arquitetural

### 2.1 Estado atual (fatos)

- **`tenants.plan`**: `TEXT NOT NULL DEFAULT 'free'` + CHECK (free/pro/premium) — migration `20260724000000`.
- **`subscriptions.plan`**: `TEXT` + CHECK (free/pro/premium) — migration `20260806020000` (linha 51).
- **Sem tabela `plans`/`features`/`plan_features`** no schema ativo (confirma D4).
- **Catálogo em código:** `domain/authorization/featureAvailability.ts` — 20 `FeatureKey`, matriz `PLAN_FEATURES` (free/pro/premium), resolver puro (6.0.5.1, certificado).
- **Limites estáticos:** `domain/billing/limits.ts` — `PLAN_LIMITS` free=1 / pro=5 / premium=∞.
- **Consumidores do slug:** `invite_team_member` RPC (lê `t.plan` p/ limite), `provision_new_tenant`, `complete_onboarding`, `start_trial`/`activate_subscription` (gravam `subscriptions.plan`).
- **Single Writer (ADR-013 §2.4):** `subscriptions` → BillingService; `tenants.status` → TenantLifecycleService; `plans` → **BillingService** (novo).

### 2.2 Modelo alvo proposto (aditivo, sem quebra)

```
plans (slug TEXT PK, name, price_cents mensal, limits JSONB, status, created_at)
   ▲                                      
   │ FK (slug) — substitui o CHECK atual  
tenants.plan / subscriptions.plan (TEXT permanece, vira FK p/ plans.slug)
```

- **`features`** (key TEXT PK, name, description, category, dependencies[]): catálogo único = os **20 `FeatureKey`** (fonte: `featureAvailability.ts` + `FEATURE_FLAGS_MODEL.md` §3). **Não** usar `AppModuleSlug` (taxonomia distinta — ver §3).
- **`plan_features`** (plan_slug FK, feature_key FK, PK(plan_slug, feature_key)): matriz F8 — **o plano conhece as flags** (direção de associação, ADR-013 §7:77).
- **Seed idempotente** (`INSERT ... ON CONFLICT DO NOTHING`): 3 planos × 20 features, refletindo `PLAN_FEATURES` (free 14, pro 15, premium 20).
- **`plans.limits`** carrega os limites (free: max_staff=1, pro: max_staff=5, premium: ∞) — prepara a eliminação de `limits.ts` na 6.0.5.3.

### 2.3 Por que FK TEXT por slug (e não id)

- `tenants.plan`/`subscriptions.plan` já são TEXT slug com CHECK; trocar para `INT id` quebraria **todos** os consumidores (RPCs, triggers, seeds) em uma migration não-aditiva.
- FK `TEXT REFERENCES plans(slug)` mantém compatibilidade total e cumpre o objetivo de "fim dos slugs soltos" (integridade referencial).
- Sem triggers em `tenants`/`subscriptions` que interfiram (verificado — nenhum `CREATE TRIGGER` para tenant_status/plan).

---

## 3. Auditoria de nomenclatura

**Taxonomias existentes (não confundir):**

| Taxonomia | Onde | Qtde | Propósito |
|-----------|------|-----|-----------|
| `AppModuleSlug` | `domain/shared/app.ts` | 21 | Módulo de **rota/UI** por app (checkout, orders, schedule, comandas, cashflow, portal, kiosk...) |
| `FeatureKey` | `domain/authorization/featureAvailability.ts` | 20 | **Capacidade/gate de plano** (appointments, pos, cash_closing, commissions, chef_club, api, bi...) |

**Sobreposição parcial:** dashboard, products, clients, services, team, commissions, chef_club existem nas duas. **Isso é esperado**: uma feature (gate de plano) mapeia para um-ou-mais módulos. O **seed de `features` (6.0.5.2) deve usar `FeatureKey`**, nunca `AppModuleSlug`.

**Divergência de nomenclatura detectada:**

| # | Item | Fatos | Resolução proposta |
|---|------|-------|--------------------|
| **DIV-A** | Nome do catálogo | `FeatureKey` usa `cash_closing`; não existe `AppModuleSlug` correspondente (o módulo financeiro é `financial`/`cashflow`) | Aceito como taxonomias distintas — o seed usa `FeatureKey`. Documentar o mapa feature→módulo no seed/migration |
| **DIV-B** | Flags free com limite | `FEATURE_FLAGS_MODEL` §5 marca `team`/`finance` como "⚠️" no free (habilitam com limite); `PLAN_FEATURES.free` inclui ambos sem metadado de limite | Sem contradição funcional — o limite vive em `plans.limits`, não na flag. Confirmar no seed que `plan_features` carrega `team`/`finance` no free e o limite via `plans.limits` |

---

## 4. Auditoria de consistência

| # | Verificação | Resultado |
|---|-------------|-----------|
| **C1** | Catálogo `FeatureKey` (20) × matriz `FEATURE_FLAGS_MODEL` §5 × lista da entry audit §8 | ✅ Idênticos (20 flags, mesma grafia) |
| **C2** | `PLAN_FEATURES` × matriz §5 | ✅ free 14 / pro 15 / premium 20, alinhado (inclui "⚠️" como habilitado+limitado) |
| **C3** | `tenants.plan` CHECK × `subscriptions.plan` CHECK × `plans` (nova) | ✅ Todos free/pro/premium — seed cobre 100% dos valores existentes; FK aditiva não quebra dados |
| **C4** | `invite_team_member` lê `tenants.plan` | ✅ Continua válido com FK TEXT (slug legível) |
| **C5** | `limits.ts` (free=1/pro=5/∞) × `invite_team_member` (6.0.3) | ✅ Mesmos valores — a 6.0.5.2 move para `plans.limits`; `limits.ts` eliminado na 6.0.5.3 |
| **C6** | ADR-013 §2.4 coluna "plans" data (6.0.5.1) | ❌ **DIV-D** — data desatualizada após DIV-1 (corrigir ADR na fase docs) |
| **C7** | `featureAvailability.ts` continua sendo o resolver da 6.0.5.1 | ✅ 6.0.5.2 **não** altera o resolver — cria a fonte persistida; a consulta via `plans` entra na 6.0.5.3 (FeatureFlagService) |

---

## 5. Divergências encontradas

| # | Divergência | Resolução 6.0.5.2 |
|---|-------------|-------------------|
| **DIV-D** | ADR-013 §2.4 diz `plans` (catálogo/seed) em **6.0.5.1** — realocado para 6.0.5.2 (DIV-1) | Corrigir a citação no ADR nesta subfase (nota de alinhamento documental) |
| **DIV-A** | Taxonomias `FeatureKey` (20) × `AppModuleSlug` (21) convivem | Seed usa `FeatureKey`; mapa feature→módulo documentado na migration (sem duplicar catálogo) |
| **DIV-B** | Flags free `team`/`finance` = "habilitado com limite" | Limite em `plans.limits`, flag em `plan_features` — sem metadado de limite na feature |

---

## 6. Escopo proposto (para aprovação do PO)

| Entregável | Detalhe |
|-----------|---------|
| Migration `plans/features/plan_features` + seed idempotente | Padrão timestamped (`supabase/migrations/`), `ON CONFLICT DO NOTHING`, sem migration runner |
| FK aditiva `tenants.plan`/`subscriptions.plan` → `plans(slug)` | Dropar CHECKs; nada de troca para `INT id` (não-aditivo) |
| `plans.limits` (max_staff etc.) | Fonte persistida p/ 6.0.5.3 (substitui `limits.ts`) |
| Alinhamento ADR-013 §2.4 | Citação 6.0.5.1 → 6.0.5.2 (DIV-D) |
| Testes | Migração idempotente (re-run), seed = matriz §5, FKs válidas |
| Docs + ROADMAP + changelog | Sem nova baseline (só no fim da 6.0.5.5 — `v1.5.0-feature-flags-6.0.5`) |

**Fora do escopo (proibido nesta subfase):**
- ❌ Enforcement / leitura via `plans` no frontend (6.0.5.3 — FeatureFlagService + `tenant_has_feature` + substituir `limits.ts`)
- ❌ Alterar `subscriptions.status` / `suspended` (6.0.5.4)
- ❌ RPCs de transição / `apply_subscription_transition` (6.0.5.5)
- ❌ Alterar `featureAvailability.ts` (resolver da 6.0.5.1 permanece)
- ❌ `plans` como `INT id` (quebraria consumidores — viola o princípio aditivo)

---

## 7. Critérios de saída propostos (certificação)

- [ ] Migration aplicada: tabelas `plans`/`features`/`plan_features` + seed idempotente (re-run não duplica)
- [ ] Seed espelha exatamente `PLAN_FEATURES` (free 14 / pro 15 / premium 20) e `limits.ts`
- [ ] `tenants.plan`/`subscriptions.plan` com FK → `plans(slug)`; CHECKs removidos; zero quebra em RPCs existentes
- [ ] Regressão: suíte unitária (795) + smoke E2E (flow1-5, flow13) verdes
- [ ] ADR-013 §2.4 corrigido (DIV-D); docs + ROADMAP atualizados

---

## 8. Riscos

| Risco | Mitigação |
|-------|-----------|
| Mudança de schema quebrar RPCs de billing (leitura de `plan` slug) | FK TEXT por slug (aditivo) + smoke de billing (flow9/flow12) |
| Seed divergir da matriz congelada | Teste que compara seed ↔ `PLAN_FEATURES` (fonte única) |
| Escopo vazar para enforcement (6.0.5.3) | Perímetro congelado em §6; revisão por PR |
| Confusão FeatureKey × AppModuleSlug no seed | Seed usa exclusivamente `FeatureKey` (DIV-A) |

---

## 9. Conclusão

Os critérios de entrada da 6.0.5.2 estão **avaliados**: o modelo `plans + features + plan_features` é aditivo, não quebra consumidores e persiste a matriz já congelada e certificada (6.0.5.1). **Nenhum bloqueio conceitual** identificado além da confirmação formal do escopo em §6 e da correção de **DIV-D**. **STATUS: 🔍 EM AUDITORIA — aguardando decisão do PO.**
