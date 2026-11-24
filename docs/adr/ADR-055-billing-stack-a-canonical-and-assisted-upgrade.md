# ADR-055: Stack A como Fonte Única de Billing e Fluxo de Upgrade Assistido

- **Status:** Accepted
- **Date:** 2026-11-24
- **Deciders:** Augusto (PO), Antigravity
- **Scope:** Issue `#380` (`P0-05 | GTM-001`) — Unificação de Billing, eliminação de split-brain de plano e fluxo comercial assistido (`DEC-01` + `DEC-02`)

---

## Contexto

O repositório acumulou dois conjuntos desconectados de tabelas de faturamento e uma terceira leitura divergente na interface:

1. **Stack A (Domínio / Fase 6):** `public.plans`, `public.features`, `public.plan_features`, `public.subscriptions`, `public.invoices`, `public.billing_events`, `public.payment_attempts` e `public.tenants.plan` / `tenants.status`, integrados ao `PlanCatalogDb`, `FeatureFlagService` (`tenant_has_feature`) e `FeatureGuard`.
2. **Stack B (Fase 8 / SuperAdmin):** `public.platform_plans`, `public.platform_subscriptions` e `public.platform_invoices`, criados para o painel administrativo (`services/platformBillingService.ts`), sem sincronização automática com `tenants.plan` ou `plan_features`.
3. **Split-brain na UI:** `components/Layout.tsx` lia e gravava `user.user_metadata.plan` via `supabase.auth.updateUser()` sem cobrança nem atualização de `tenants.plan`, enquanto `pages/Settings.tsx` exibia `user.user_metadata.plan` com um botão `Upgrade` sem ação.

Além disso, a auditoria das RPCs do Stack A (`20260806020000`, `20260806050000`, `20260806070000`) mostrou que `activate_subscription` e `mark_invoice_paid` ainda permitiam execução por gestores do próprio tenant (`owner`, `manager`, `admin`) e não executavam transição atômica completa de fatura + assinatura + tenant.

---

## Decisão

Por deliberação explícita do PO em 2026-11-24 (`DEC-01` e `DEC-02`):

1. **Stack A como Fonte Única de Verdade (`DEC-02`, Opção 1):**
   - `public.plans`, `public.features`, `public.plan_features`, `public.subscriptions`, `public.invoices`, `public.billing_events`, `public.payment_attempts` e `public.tenants.{plan,status}` constituem a única fonte autoritativa de planos, limites, assinaturas e faturas da plataforma.
2. **Porte integral do endurecimento de RLS, `GRANT`s e auditoria (`#376` / PR `#407`):**
   - Revogar `ALL` de `PUBLIC`, `anon` e `authenticated` nas tabelas do Stack A, concedendo apenas `SELECT` mínimo (e `TO authenticated` nas policies operacionais).
   - Restringir `activate_subscription`, `mark_invoice_paid` e `record_billing_event` exclusivamente a `public.current_is_super_admin_from_auth_uid()`, eliminando auto-aprovação ou auto-liquidação por usuários comuns de tenant.
3. **Operação atômica via RPC para fluxo assistido (`DEC-01`):**
   - Criar a RPC `SECURITY DEFINER` idempotente `public.activate_assisted_plan_upgrade(...)` restrita a SuperAdmin, executando em transação única (`FOR UPDATE`): validação do plano em `public.plans` → liquidação ou emissão/quitação idempotente em `public.invoices` → ativação/atualização de `public.subscriptions` → espelhamento de `public.tenants.{plan,status}` → trilha auditável em `public.billing_events`.
   - Na UI (`Layout.tsx`, `Settings.tsx`, `StatusBanner.tsx`, `UpgradePrompt.tsx`): exibir apenas `tenant.plan` / `tenant.status` reais, eliminar qualquer escrita em `user_metadata.plan` e direcionar todos os CTAs de `Upgrade` ao canal comercial assistido oficial.
4. **Deprecação em fases das tabelas `platform_*` (sem `DROP` imediato):**
   - **Fase 1 (imediata):** manter `platform_plans`, `platform_subscriptions` e `platform_invoices` preservadas (com RLS endurecida pelo PR `#407` e marcadas via `COMMENT ON TABLE` como `@deprecated ADR-055`) e marcar `services/platformBillingService.ts` como legado em transição para o Stack A. **Nenhum `DROP TABLE` é executado nesta fase.**
   - **Fase 2 (futura):** após janela de observação e reconciliação de eventuais registros legados em produção, abrir migration específica aprovada pelo PO para remoção definitiva.

---

## Consequências

- **Positivas:**
  - Eliminação completa do split-brain entre `Layout`, `Settings`, `FeatureGuard` e banco de dados.
  - Ativação manual no fluxo assistido passa a ser atômica, idempotente, auditável e exclusiva de SuperAdmin.
  - Zero risco de perda de dados históricos nas tabelas `platform_*` durante a transição.
- **Negativas / Trade-offs:**
  - Tabelas `platform_*` permanecem no schema durante a Fase 1 até conclusão da janela de observação.
  - Alteração de plano para clientes em produção depende de atendimento assistido + execução da RPC administrativa até a futura ativação de checkout self-serve.
