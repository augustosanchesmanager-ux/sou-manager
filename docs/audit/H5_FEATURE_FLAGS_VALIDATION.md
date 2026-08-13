# H-5 — Feature Flags: Matriz por Plano + Enforcement de UI (evidência)

> **Gate:** H-5 Feature Flags (D-6.0.5.3-1..6 / D-6.0.5.5)
> **Data:** 2026-08-13
> **Ambiente:** Supabase real (project `ushsnmlbeurfvlkieiln`) — **tenant E2E isolado e identificável** (D-HOM-19); **NÃO** usou o tenant Sanchez Barber
> **Responsável:** OpenCode (Tech Lead operacional)
> **Execução:** E2E Playwright (Chromium) — `tests/e2e/homologation/h5-feature-flags.spec.ts` com `E2E_PROVISIONING=1` + inspeção de código (grep) para H5-8
> **Veredito:** 🟢 **APROVADO (D-HOM-22, PO 2026-08-13)** — 5/5 testes E2E PASS + H5-8 PASS (inspeção grep)

---

## 1. Objetivo

Validar o **modelo de feature flags por plano** (free 14 / pro 15 / premium 20) e o **enforcement de UI** do licenciamento D-6.0.5.3: flags resolvidas **exclusivamente via RPC `tenant_has_feature`** (override > matriz `plan_features` > suspensão), acesso liberado quando a feature está habilitada, bloqueio com `FeatureUnavailablePage`/`UpgradePrompt` (nunca 403) quando desabilitada — inclusive por **URL direta** — e **override por tenant via `feature_flags`** (escrita superadmin) vencendo a matriz. Critério de saída: matriz **H5-1..H5-9** com PASS/FAIL/BLOCKED e recomendação para o próximo gate.

---

## 2. Setup (seed — service role + sessões reais)

| Item | Valor |
|------|-------|
| Tenant E2E (alvo) | `e2e-h5-<runId>` — `app_slug=barber`, `plan=pro`, `status=active` |
| Tenant OPS (superadmin isolado) | `e2e-h5-ops-<runId>` — `plan=pro`, `status=active` |
| Usuários | manager (H5) + superadmin (OPS) — `createConfirmedUser` via Admin API |
| `profiles` | role `manager`/`superadmin`, `onboarding_completed=true` |
| Staff (pós-trigger, determinístico) | manager (id=userId) no tenant H5; superadmin no OPS — limpeza de linhas do trigger |
| `user_tenants` | manager primary (H5); superadmin primary (OPS) |
| `subscriptions` | 1 ativa (pro), período vigente (start −10d, end +20d) |
| `tenant_settings` | `chair_count=2` (renderização do Layout) |
| Sessões RPC | `signInAsUser` manager + superadmin (dirigem `tenant_has_feature`/`change_tenant_plan`/escrita em `feature_flags`) |

**Fontes de verdade consultadas:** migration `20260807000000_phase_6_0_5_3_feature_flags.sql` (tabela `feature_flags` + RPC `tenant_has_feature`, SECURITY DEFINER, `auth.uid()`, precedência override > matriz > suspensão) e `20260806090000_phase_6_0_5_2_plans_catalog.sql` (seed `plans`/`features`/`plan_features`: free 14 / pro 15 / premium 20). Fluxo do frontend: `useFeatureFlags` (RPC, cache por `tenant|plan|status`, bypass superadmin) → `FeatureGuard`/`FeatureRoute` → `UpgradePrompt`/`FeatureUnavailablePage`; Sidebar gateia via `MODULE_FEATURES` (`src/lib/apps/moduleRegistry.ts`) + `can(feature)`.

---

## 3. Matriz H5-1..H5-9 — Resultado

| ID | Cenário | Critério de aceite | Resultado |
|----|---------|--------------------|-----------|
| H5-1 | Tenant `free` — matriz de flags free | Flags = matriz free (14) | ✅ **PASS** (SQL) |
| H5-2 | Tenant `pro` — matriz pro | Flags = matriz pro (15) | ✅ **PASS** (SQL) |
| H5-3 | Tenant `premium` — matriz premium | Flags = matriz premium (20) | ✅ **PASS** (SQL) |
| H5-4 | Feature habilitada — acesso à rota/UI | Acesso liberado | ✅ **PASS** |
| H5-5 | Feature desabilitada — `FeatureUnavailablePage` | Página de indisponibilidade exibida | ✅ **PASS** |
| H5-6 | Upgrade prompt exibido quando aplicável | `UpgradePrompt` visível | ✅ **PASS** |
| H5-7 | Acesso direto à rota de feature desabilitada | Bloqueio mesmo com URL direta | ✅ **PASS** |
| H5-8 | Frontend NÃO consulta `feature_flags` diretamente | Zero acesso direto; uso exclusivo da RPC | ✅ **PASS** (grep) |
| H5-9 | Override por tenant via `feature_flags` (superadmin) vence a matriz | Override aplicado | ✅ **PASS** |

**Suite E2E:** `5/5 PASS` (54.5s) — H5-1/2/3, H5-4, H5-5/6, H5-7, H5-9. **H5-8:** inspeção (grep), ver §5.

---

## 4. Detalhes por cenário (referência de evidência)

- **H5-1/2/3 (matriz por plano):** leitura de `plan_features` (service role) comparada ao espelho congelado da spec — **free = 14** (appointments, pos, clients, services, products, team, dashboard, finance, cash_closing, commissions, receivables, expenses, vouchers, promotions), **pro = 15** (+chef_club), **premium = 20** (+bi, api, whatsapp, marketplace, multi_unit). Spot-checks de fronteira (Regra 2 — plano conhece as flags): `chef_club` ausente no free e presente em pro/premium; `bi` ausente no free/pro e presente no premium. Coincide com `FEATURE_FLAGS_MODEL §5` e com o espelho TS (`domain/billing/planCatalog.ts` + testes `planCatalog.test.ts`/`planCatalogMigrationSync.test.ts`).
- **H5-4 (habilitada):** tenant `pro` + `tenant_has_feature('chef_club') = true` → login manager → `/chef-club-plans` renderiza conteúdo (`Novo plano` visível), sem "não está disponível no plano atual".
- **H5-5/6 (desabilitada):** downgrade `pro→free` via RPC oficial `change_tenant_plan` (escritor transacional único; espelha `tenants.plan`/`subscriptions.plan` + `TenantPlanChanged`) → `tenant_has_feature('chef_club') = false` → `/chef-club-plans` exibe **`FeatureUnavailablePage`** ("não está disponível no plano atual"), **nunca 403**; **`UpgradePrompt`** com CTA "Faça upgrade do plano", botão **"Ver Meu Plano"** e **"Voltar ao Início"** (D-6.0.5.5-2).
- **H5-7 (URL direta):** tenant `free`, `tenant_has_feature('bi') = false` → `page.goto('/#/bi')` **bloqueado** pelo `FeatureRoute` → `UpgradePrompt` visível; a página real (`Visão do Negócio`) **não** renderiza.
- **H5-9 (override vence a matriz):** cenário A — upgrade `free→premium` (`chef_club` passa a `true` pela matriz) + `setOverride('chef_club', false)` (superadmin em `feature_flags`) → `tenant_has_feature('chef_club') = false` e `bi` permanece `true` (matriz preservada para as demais flags); recarga plena → `/chef-club-plans` bloqueado. Cenário B — downgrade `premium→free` (`chef_club` volta a `false` pela matriz) + `setOverride('chef_club', true)` → `tenant_has_feature('chef_club') = true`; `page.reload()` (recarga plena, cache novo) → `/chef-club-plans` renderiza (`Novo plano` visível, sem banner de indisponibilidade). **Override vence a matriz nos dois sentidos.**

---

## 5. H5-8 — inspeção grep (zero leitura direta no frontend)

O frontend **não consulta `feature_flags`/`plans`/`features`/`plan_features` diretamente**. Decisões de acesso em runtime usam **somente** a RPC `tenant_has_feature`:

- `src/hooks/useFeatureFlags.ts` — resolução via RPC, cache `tenant|plan|status`, bypass superadmin (cliente autenticado; **sem SELECT direto** em `feature_flags`).
- `FeatureGuard`/`FeatureRoute`/`UpgradePrompt`/Sidebar — gateiam módulos via `can(feature)` (RPC); mapa `MODULE_FEATURES` (`src/lib/apps/moduleRegistry.ts`) traduz módulo de UI → `FeatureKey`.
- **Únicos acessos diretos ao catálogo** (exceções documentadas e esperadas):
  - `domain/billing/featureOverrideStoreDb.ts` — adapter privilegiado para `feature_flags` (escrita superadmin, DI/teste), **sem consumidor de runtime**;
  - `domain/billing/planCatalogDb.ts` — leitura do catálogo `plans`/`features`/`plan_features` para espelho de matriz (D-6.0.5.3-6 permite leitura do catálogo; **decisão de acesso continua via RPC**), também **sem consumidor de runtime** (importado apenas por `*.test.ts` e barrel `domain/billing/index.ts`).
- **D-6.0.5.3-6 confirmado:** `feature_flags` **sem policy SELECT para autenticados**; escrita exclusivamente por superadmin (policy `feature_flags_superadmin_all`, guard `current_is_super_admin_from_auth_uid` = `profiles.role` `superadmin`/`super admin`).

---

## 6. Pontos de atenção registrados na implementação da spec (sem alteração de produto)

1. **Seletores por heading geram falso positivo:** `UpgradePrompt` renderiza o **título da feature como `<h1>`** (ex.: "Club dos Chefes", "Business Intelligence"). A spec usa **marcadores exclusivos** da página real ("Novo plano" no ChefClubPlans; "Visão do Negócio" no BI) em vez de headings genéricos.
2. **Cache de flags por sessão de página:** `page.goto` entre hashes é **navegação SPA sem recarga**; o cache `tenant|plan|status` do `useFeatureFlags` fica obsoleto quando o override muda sem o plano mudar. Em H5-9 o `page.reload()` força recarga plena → resolução correta no boot. Comportamento de cache do produto confirmado como by-design (sessão curta, invalidado por reload/login).

---

## 7. Artefatos

| Artefato | Tipo |
|----------|------|
| `tests/e2e/homologation/h5-feature-flags.spec.ts` | Spec E2E (versionado no repo) |
| `test-results/h5-4-feature-enabled-<runId>.png` | Screenshot `chef_club` habilitado (pro) |
| `test-results/h5-5-6-upgrade-prompt-<runId>.png` | Screenshot `FeatureUnavailablePage` + `UpgradePrompt` (free) |
| `test-results/h5-7-direct-url-blocked-<runId>.png` | Screenshot URL direta `/bi` bloqueada (free) |
| `test-results/h5-9-override-<runId>.png` | Screenshot override `true` liberando `chef_club` no free |
| `supabase/migrations/20260807000000_phase_6_0_5_3_feature_flags.sql` | Tabela `feature_flags` + RPC `tenant_has_feature` (fonte de verdade) |
| `supabase/migrations/20260806090000_phase_6_0_5_2_plans_catalog.sql` | Seed da matriz (fonte de verdade) |

---

## 8. Conclusão

**Gate H-5 = 🟢 APROVADO (D-HOM-22, PO 2026-08-13).**

- Matriz H5-1..H5-9 **5/5 testes E2E PASS + H5-8 PASS por inspeção grep** — veredito formal do PO proferido (D-HOM-22).
- Matriz free 14 / pro 15 / premium 20 **coerente** com o seed SQL e com o espelho TS (testes `planCatalog*` verdes).
- Enforcement de UI confirmado: feature habilitada libera; desabilitada → `FeatureUnavailablePage`/`UpgradePrompt` (**nunca 403**), inclusive por **URL direta**; **override por tenant vence a matriz nos dois sentidos** (premium+false bloqueia; free+true libera).
- **H5-8 PASS:** zero leitura direta de `feature_flags` no frontend em runtime; decisão de acesso exclusiva via RPC `tenant_has_feature`.
- Execução em **tenant E2E isolado** (dados de teste), teardown completo (feature_flags, billing_events, subscriptions, staff, user_tenants, tenant_settings, tenants, usuários) — nenhuma mutação no tenant Sanchez Barber.
- **Sem alteração de código de produção, sem migration, sem merge/tag/deploy.**
- **H-3 permanece 🟡** (H3-1..H3-4, H3-6 ✅; H3-5 🟡 c/ ressalva) e **H-8 permanece 🔴 BLOQUEADOR** (produção `718f6f9` + topologia Vercel) — o PASS do H-5 não altera esses status.
- **Próximo gate:** H-6 — Segurança (execução em separado, conforme decisão do PO).
