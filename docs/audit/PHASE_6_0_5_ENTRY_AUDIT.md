# PHASE 6.0.5 — ENTRY AUDIT (Feature Flags / Suspensão / Reativação)

> **Data:** 2026-08-06
> **Autorização:** Auditoria de entrada solicitada pelo PO antes de qualquer código (Regra de Entrada).
> **Modo:** Somente leitura — nenhum arquivo de código ou migration foi alterado.
> **Baseline de referência:** `v1.4.2-billing-engine-6.0.4.4`
> **Escopo da auditoria:** documental (ROADMAP, ADRs, BUSINESS_DECISIONS, TAXONOMY, SUBSCRIPTION_MODEL, TENANT_LIFECYCLE, modelos 5.x, plans de fase), arquitetural (schema real + RPCs + código TS) e nomenclatura/consistência.

---

## Resumo executivo — respostas às 4 perguntas do PO

### 1. Quais entidades são responsáveis por quê?

| Entidade | Responsabilidade (HOJE) | Responsabilidade (6.0.5 — alvo) |
|----------|------------------------|--------------------------------|
| **`subscriptions`** | Contrato de billing: `plan`, status do contrato (`trialing/active/past_due/cancelled`), janelas de período (`trial_*`, `current_period_*`), pedido de cancelamento (`cancel_at_period_end`), `canceled_at`. **É a fonte de verdade do ciclo de cobrança.** | Mesma, **+ `suspended`** no status (suspensão = estado real do contrato) e `grace_ends_at` para a janela de tolerância. Continua sendo a única entidade que o Billing Engine escreve. |
| **`tenants`** | Estado operacional de acesso: `tenant_status` (`draft/trial/active/past_due/suspended/cancelled/archived`) + `plan` (slug). Hoje o status é **espelho** do subscription (escrito junto, na mesma RPC). | Status de **acesso ao sistema** (o que gateia a UI via `ProtectedRoute`). Deve deixar de ser "espelho cego" e passar a ser derivado por regra explícita de mapeamento (com `suspended` correto). `plan` migra para ser referência à tabela `plans` (FK), não slug solto. |
| **`feature_flags`** (não existe) | Nenhuma. Não há mecanismo de flags no schema nem no código. Único gate por "módulo" é `isAppModuleEnabled(appSlug, moduleName)` (por **app**, não por plano/tenant). | **Disponibilidade de funcionalidades por plano** (`useFeatureFlags()`, `<FeatureGuard>`, RPC `tenant_has_feature`). Direção F8: **flag não sabe o plano; o plano conhece as flags.** |
| **`plans`** (não existe) | Nada. Limites hardcoded apenas em `invite_team_member` (SQL) + tabela estática não conectada `domain/billing/limits.ts`. `tenants.plan`/`subscriptions.plan` são CHECKs `('free','pro','premium')`. | Tabela `plans` + `features` + `plan_features` (D4/P4): slug, limites, preços (mensal; anual pendente de decisão) e associação plano→flags. **Fonte única de limites.** |

### 2. Quais estados pertencem a cada entidade?

| Entidade | Estados | Observação |
|----------|---------|-----------|
| `subscriptions.status` (TEXT+CHECK) | `trialing, active, past_due, cancelled` | **Falta `suspended`** (crítico para 6.0.5). Não é enum PG — é CHECK. Sem `archived`. |
| `tenants.status` (enum `tenant_status`) | `draft, trial, active, past_due, suspended, cancelled, archived` | Enum completo; `suspended` e `archived` já existem. |
| Feature Flags | (não existem) | Derivados: `Trial`, `Plano`, `Suspensas`, `Nenhuma` — ver matriz §3. |
| `plans` | (não existe) | Slugs `free/pro/premium` (D1: `elite`→`premium` já normalizado). |

**Regra de não-duplicação:** `trial` existe como estado de *tenant* (`trial`) e de *subscription* (`trialing`) — são o mesmo conceito em duas camadas (acesso vs contrato). `past_due`/`active`/`cancelled`/`suspended` idem. Isto é aceitável **desde que o mapeamento seja explícito e 1:1** (hoje é, exceto pelo `ELSE → active` do `apply_subscription_transition`, que é um bug latente). `draft` e `archived` são exclusivos de tenant (não têm correspondente no contrato). `grace` **não é estado** — é janela derivada de datas (consenso em todos os docs, confirmado pelo PO).

### 3. Quem é a fonte da verdade de cada decisão?

| Decisão | Fonte da verdade (atual) | Fonte da verdade (6.0.5 — alvo) |
|---------|--------------------------|----------------------------------|
| **Cobrança / ciclo** | `subscriptions` (engine TS puro `domain/billing/billingEngine.ts` decide; RPC `apply_subscription_transition` persiste) | `subscriptions` — sem mudança |
| **Acesso ao sistema** | `tenants.status` (mirror 1:1 vindo da mesma RPC) | `tenants.status` — mas com mapeamento explícito no engine (sem `ELSE→active`) |
| **Funcionalidades disponíveis** | **Nenhuma** — hoje `tenants.plan` é a fonte *de facto* (`invite_team_member` SQL + `Admin.tsx` altera `tenants.plan` direto, fora do engine) | `feature_flags` (por plano) — a ser criada; enforcement unificado |
| **Limites do plano** | **Duas fontes concorrentes:** SQL hardcoded em `invite_team_member` e `domain/billing/limits.ts` (estático, não conectado) | `plans` (tabela) — fonte única |
| **Quem pode acessar a UI** | Duas gates paralelas: `profiles.status`/`staff.status` (via `get_auth_access_context`) **e** `tenants.status` (via `App.tsx:154-158`) | Definir hierarquia explícita: profile (pessoa) × tenant (organização) × plano (feature) |

**Acoplamento crítico identificado:** `apply_subscription_transition` grava `subscriptions.status` **e** espelha `tenants.status` na mesma RPC (map `trialing→trial, active→active, past_due→past_due, cancelled→cancelled, ELSE→active`). Isso flui direto para o gate da UI. **E `pages/Admin.tsx:856` escreve `tenants.plan` direto, sem passar pelo engine** — causa divergência `tenants.plan` vs `subscriptions.plan` (duas fontes de verdade de plano).

### 4. Quais transições passam a existir com `suspended`?

Estado atual do engine: 4 ações de mutação (`activate_free`, `start_past_due`, `renew`, `finalize_cancellation`) + `none`. **Não há ação de suspensão nem reativação** — `past_due` → sempre `none` (parâmetro `graceDays` é morto).

Transições **novas** para a 6.0.5 (ver matriz completa §3 e fluxograma §4):

| Transição | Gatilho | Evento novo |
|-----------|---------|-------------|
| `active/past_due` → `suspended` (sub) + `past_due/suspended` (tenant) | grace expirado (`asOf ≥ grace_ends_at`) — engine `runCycle` | `TenantSubscriptionSuspended` (hoje morto no catálogo) |
| `suspended` → `active` (reativação) | pagamento confirmado (`markPaid`) **ou** ação manual do manager/superadmin (RPC `reactivate_subscription` — não existe) | `TenantSubscriptionReactivated` (hoje morto) |
| `suspended` → `cancelled` | pedido de cancelamento em suspenso ou decisão de retenção (a definir, ver decisão D-6.0.5-4) | `TenantSubscriptionCancelled` (já existe) |

**Não são transições de estado** (confirmado): `grace` (janela), `cancel_pending` (não existe — D-A permanece: `cancel_at_period_end` + status `active` até efetivação).

---

## 1. Auditoria documental

### 1.1 Fontes de autoridade (sem conflito interno relevante)

- **Decisões 6.0.4.x** (P1/P2/P3/P4/D1–D5, D-A, ADR-012): internamente consistentes e refletidas no schema real. **D-A** (cancelamento = `cancel_at_period_end`, acesso mantido, efetivação pelo engine) e **grace = janela de 5 dias** são as duas restrições de arquitetura que o PO reafirmou.
- **`docs/TAXONOMY.md` §8.1**: único glossário billing/lifecycle oficial; convergente com as decisões 6.0.4.x.
- **`docs/BUSINESS_DECISIONS.md`**: F1 planos Free/Pro/Premium · F3 trial 14d · F4 grace 5d · F5 nunca excluir dados · F7/F8 flags por feature, plano conhece flags · F10 `draft→trial→active`.
- **`docs/TENANT_LIFECYCLE.md`**: 7 estados + transições + acesso por status — **declarado "fonte oficial para condicionais no código"**.

### 1.2 Conflitos documentais (detalhados na §6)

Resumo das divergências que **impactam decisões da 6.0.5** (coluna "Resolução" = status após a **Subfase 0**, 2026-08-06):

| # | Tema | Doc A | Doc B | Impacto 6.0.5 | Resolução (Subfase 0) |
|---|------|-------|-------|---------------|----------------------|
| D1 | Destino pós-grace | `SUBSCRIPTION_MODEL.md:51` → `cancelled` | Todos os demais → `suspended` | **CRÍTICO** — diagrama interno do próprio doc do modelo diverge da regra aprovada (D3/F4) | ✅ Resolvido (doc) |
| D2 | Modelo de dados de flags | `plans+features+plan_features` (D4/P4, aprovado) | `plans.features TEXT[]` + `tenant_has_feature` (FEATURE_FLAGS_MODEL §6) | **ALTO** — três propostas concorrentes; precisa decisão única | ✅ Resolvido — ADR-013 §5.3 + D-6.0.5-5 (decisão registrada; docs alinhados) |
| D3 | Limite Free de profissionais | 1 (F11/BUSINESS_DECISIONS) | ≤2 (ROADMAP 5.5.4 / SAAS_CORE) | **ALTO** — enforcement não sabe o valor | ⬜ Aberto (PO — D-6.0.5-3); docs alinhados ao fato (`free=1`) |
| D4 | Semântica de cancelamento | Imediato (`TENANT_LIFECYCLE.md:104`, `SUBSCRIPTION_MODEL`) | Fim do período (D-A, entregue 6.0.4.4) | **ALTO** — doc "oficial para condicionais" ensina contrato errado | ✅ Resolvido (doc) |
| D5 | Nomes de tabelas billing | `platform_subscriptions/invoices/payments` (SAAS_CORE 5.5) | `subscriptions/invoices/payment_attempts` (entregue) | MÉDIO — consultas baseadas na 5.5 falham | ✅ Resolvido (doc) |
| D6 | Acesso em `past_due` | "com restrições" (TENANT_LIFECYCLE) | `full` (LIFECYCLE_MODEL) · read-only por módulo (SAAS_CORE) | **ALTO** — guard da suspensão indefinido | ✅ Resolvido (doc) — unificado "depende da D-6.0.5-1" |
| D7 | Acesso em `cancelled` | bloqueado (TENANT_LIFECYCLE/SAAS_CORE) | read-only (LIFECYCLE_MODEL) | MÉDIO — afeta reativação/export | ✅ Resolvido (doc) — unificado "depende da D-6.0.5-2" |
| D8 | Âncora do trial | `tenants.created_at` (TAXONOMY/F3) | `now()` em `start_trial` (plano 6.0.4 §56) | MÉDIO — **o código usa `created_at`**; conflito é só do texto do plano | ✅ Resolvido (doc) |
| D9 | Transições de `suspended` | `suspended→active` (SAAS_CORE/BUSINESS_ARCH/LIFECYCLE_MODEL/TENANT_MODEL) | **inexistente** (TENANT_LIFECYCLE) | **ALTO** — máquina de suspensão tem 3 fontes | ✅ Resolvido (doc) — ADR-013 §5 |
| D10 | Nome da flag Chef Club | `chef_club` (FEATURE_FLAGS_MODEL) | `club_dos_chefes` (SAAS_CORE) | MÉDIO — catálogo de flags precisa normalizar | ✅ Resolvido (doc) — `chef_club` único |
| D11 | Status de invoice | `pending/paid/overdue/cancelled/refunded` (SUBSCRIPTION_MODEL) | `draft/issued/paid/overdue/failed/void` (schema real) | MÉDIO — regras de dunning citam status inexistentes | ✅ Resolvido (doc) |
| D12 | `elite` residual | decisão P1/D1: `elite→premium` | ainda presente em ROADMAP/SAAS_CORE/BUSINESS_ARCH/PLATFORM_CERT | MÉDIO — seed da tabela `plans` não pode repetir `elite` | ✅ Resolvido (doc) |
| D13 | Eventos de lifecycle | `TenantSubscription*` (D2/TAXONOMY) | `TenantStatusChanged/Suspended/...` (LIFECYCLE_MODEL) · `Subscription*` sem prefixo (SUBSCRIPTION_MODEL) | MÉDIO — subscriber pode escutar nome que nunca é publicado | ✅ Resolvido (doc) — catálogo D2 |
| D14 | `cancel_at_period_end` tipo | `boolean` (SUBSCRIPTION_MODEL:22) | `timestamptz` (schema real) | MÉDIO — consumidores do modelo antigo quebram | ✅ Resolvido (doc) |
| D15 | TTL 90 dias | `LIFECYCLE_MODEL:77` (remoção automática) | F5 (nunca excluir; LGPD manual) | **ALTO** — contradiz política de retenção | ✅ Resolvido (doc) — F5 |

### 1.3 Docs que **já propõem** o desacoplamento da 6.0.5 (base para o ADR-013)

1. **Separação Subscription (contrato) × Billing (cobrança)** — `PHASE_6_0_4_EXECUTION_PLAN.md:28` (D2) e `TAXONOMY.md:152–158` (Tenant Subscription ≠ Billing Event ≠ Billing Domain Event).
2. **Cancelamento não mexe em `tenants.status`** — `PHASE_6_0_4_4_EXECUTION_PLAN.md:32`; efetivação → `TenantSubscriptionCancelled` + `tenants.status='cancelled'` (linha 57).
3. **6.0.5 = Feature Flags / Suspensão / Reativação** — `PHASE_6_0_4_4_EXECUTION_PLAN.md:83,143`; "exigem status no schema + enforcement (feature_flags 6.0.5)".
4. **Flags não sabem plano; plano conhece flags (F8)** — `BUSINESS_DECISIONS.md:69–75`, `FEATURE_FLAGS_MODEL.md:32–43`.
5. **Modelo D4/P4**: `plans` + `features` + `plan_features` na 6.0.5 — `PHASE_6_0_4_AUDIT.md:161`, `PHASE_6_0_4_EXECUTION_PLAN.md:30`.
6. **Enforcement previsto** — `FEATURE_FLAGS_MODEL.md:117–154` (`useFeatureFlags`/`can()`, `<FeatureGuard>`, `tenant_has_feature`, `moduleRegistry`).

---

## 2. Auditoria arquitetural

### 2.1 Responsabilidades atuais (código real)

| Camada | O que faz hoje |
|--------|----------------|
| `domain/billing/billingEngine.ts` | Função pura `processSubscription` — **única fonte de decisão** do ciclo. 4 ações + `none`. Determinística, sem I/O. `graceDays` é parâmetro morto. |
| `application/billing.ts` (`BillingService`) | `runCycle` (read `get_due_subscriptions` → decidir → RPC `apply_subscription_transition` → publicar evento), `markPaid`, `handleFailure`, `issueInvoice`. Sem cron, sem retry, sem chamador em produção. |
| RPC `apply_subscription_transition` | Persiste `subscriptions.status` **e espelha `tenants.status`** (map `ELSE→active`). Chamado apenas por `BillingService`. |
| RPC `start_trial` / `activate_subscription` | Pares tenant+subscription (`draft→trial`, `trial→active`). Chamados via `application/tenantLifecycle.ts`. |
| RPC `cancel_subscription` | **Pedido** (D-A): só seta `cancel_at_period_end`; não mexe em status nem em `tenants.status`. |
| `application/tenantLifecycle.ts` | Orquestrador RPC + publicador de eventos (`TenantSubscriptionCreated/TrialStarted/Updated`). Não escreve linhas direto. |
| `domain/billing/limits.ts` | Tabela estática `PLAN_LIMITS` (free=1/pro=5/premium=∞) — **não conectada a nada** (só `limits.test.ts` a importa). |
| `invite_team_member` (SQL) | Enforcement real de limite de staff (lê `tenants.plan`). |
| `App.tsx` `ProtectedRoute` | Gate por `profiles.status` **e** por `tenants.status` (cancelled/archived/suspended → `/pending-approval`; draft → onboarding). |
| `pages/Admin.tsx:856` | Superadmin altera `tenants.plan` direto (fora do engine, sem evento, sem sincronizar `subscriptions.plan`). |

### 2.2 Acoplamentos a quebrar na 6.0.5

1. **`subscriptions.status ↔ tenants.status` 1:1 dentro de `apply_subscription_transition`** — flui para o gate da UI; com `ELSE→active`, uma transição de suspensão corromperia o tenant para `active`. **Precisa:** mapeamento explícito incluindo `suspended`/`archived` (ou derivação explícita) + regra de que o engine nunca escreve tenant direto.
2. **`tenants.plan` como fonte *de facto* de features/limites** (`invite_team_member` + `Admin.tsx` + UI de status). **Precisa:** tabela `plans` como fonte única + escrita de plano via engine/RPC (nunca UPDATE direto).
3. **Nenhuma camada de feature flags** — disponibilidade de funcionalidade hoje = `tenants.status` gate + `isAppModuleEnabled` (por app). **Precisa:** flags por plano + sobreposição por status (suspenso → flags Suspensas).
4. **Dois gates paralelos de acesso** (`profiles.status` e `tenants.status`) sem hierarquia definida. **Precisa:** regra de precedência explícita (ver §2.3).

### 2.3 Responsabilidades que devem migrar para a 6.0.5

| Responsabilidade | De | Para |
|------------------|----|------|
| Suspensão real (`suspended`) | **Não existe** (engine retorna `none` para `past_due`) | Engine: ação `suspend` (grace expirado) + reativação (`reactivate`) |
| `grace_ends_at` | **Não existe no schema** (só constante `GRACE_PERIOD_DAYS=5` morta) | Coluna em `subscriptions` (gravada na transição para `past_due`) + seleção em `get_due_subscriptions` |
| Status `suspended` no contrato | **Não representável** (CHECK não aceita) | Adicionar `'suspended'` (+ avaliar `'archived'`) ao CHECK de `subscriptions.status` |
| Fonte de limites | SQL hardcoded + `limits.ts` estática | Tabela `plans` (D4/P4) + `plan_features` |
| Disponibilidade de features | Nenhuma / derivada de plan-tenant | Flags + middleware `tenant_has_feature` + hooks/guards |
| Mudança de plano | `Admin.tsx` UPDATE direto | RPC de upgrade/downgrade via engine (sincroniza `subscriptions.plan` + emite evento) |
| Gate de acesso | `tenants.status` (espelho) | `tenants.status` (estado real de acesso) com hierarquia: pessoa (`profiles.status`) → organização (`tenants.status`) → feature (`flags`) |

### 2.4 Estado do Billing Engine (fatos para a 6.0.5)

- 8 eventos publicados: `TenantSubscriptionCreated`, `TenantTrialStarted`, `TenantSubscriptionUpdated`, `TenantSubscriptionCancelled`, `TenantSubscriptionRenewed`, `InvoiceCreated`, `InvoicePaid`, `PaymentSucceeded`, `PaymentFailed`.
- 7 eventos **mortos no catálogo** (sem publisher): `TenantSubscriptionSuspended`, `TenantSubscriptionReactivated`, `TenantSubscriptionExpired`, `TenantTrialEnding`, `InvoiceOverdue`, `InvoiceCancelled`, `PaymentRefunded`. **A 6.0.5 ativa `Suspended` e `Reactivated`.**
- `runCycle` não tem cron nem chamador em produção (engine manual/integração). Sem retry: erro de RPC aborta o ciclo (estado transacional parcial). Idempotência: re-run é no-op + invoice tem UNIQUE key.
- `FinanceSubscriber`/`FinanceProvider` **ignoram deliberadamente eventos de tenant billing** (regressões R2 explicitam) — reforça que 6.0.5 não deve acoplá-los sem ADR.
- `limits.ts` correto mas órfão; `domain/tenant/tenantPlan.ts` **não existe** (o modelo é `domain/tenant/types.ts` + teste).

---

## 3. Matriz de estados (proposta para validação do PO)

Legenda flags: **Trial** (flag de trial) · **Plano** (flags do plano ativo) · **Suspensas** (todas off, acesso restrito) · **Nenhuma**.

### 3.1 Combinações permitidas

| Subscription | Tenant | Feature Flags | Permitido? | Nota |
|--------------|--------|---------------|------------|------|
| (sem sub) | `draft` | — (não aplicável) | ✅ | Pré-F10; onboarding |
| `trialing` | `trial` | Trial | ✅ | F10 |
| `active` | `active` | Plano | ✅ | Inclui plano `free` (trial→active automático) |
| `past_due` | `past_due` | Plano (com restrições — ver D-6.0.5-1) | ✅ | Grace: `past_due` + `asOf < grace_ends_at` |
| `suspended` | `suspended` | Suspensas | ✅ | Grace expirado — **NOVO na 6.0.5** |
| `cancelled` | `cancelled` | Nenhuma (ou read-only — ver D-6.0.5-2) | ✅ | Efetivação do cancelamento |
| (sem sub) | `archived` | Nenhuma | ✅ | Terminal (D-6.0.5-4) |

### 3.2 Combinações inválidas

| Subscription | Tenant | Motivo |
|--------------|--------|--------|
| `trialing` | `active` | Trial não pode conceder acesso de plano pago |
| `active` | `trial` | Plano pago ativo com tenant em trial (divergência) |
| `past_due` | `active` | Inadimplente não pode ter acesso pleno |
| `suspended` | `active` | **Risco real hoje**: `apply_subscription_transition` com `ELSE→active` mapearia `suspended`→`active` |
| `suspended` | `past_due` | Estado de contrato vs acesso fora de sincronia |
| `cancelled` | `active` / `past_due` | Contrato encerrado com acesso ativo |
| `trialing` | `cancelled` / `archived` | Contrato ativo com organização encerrada |
| (qualquer) | `draft` | Draft só antes do F10 |

**Consequência arquitetural:** o mapeamento subscription→tenant deve ser uma **função total e injetora restrita a estas combinações** — a 6.0.5 substitui o `CASE ELSE→active` por um mapeamento explícito com fail-fast em combinação desconhecida.

---

## 4. Fluxograma de transições

```
(tenant sem sub) ──[F10]──> draft
                               │ complete_onboarding → RPC start_trial
                               ▼
                    trial (tenant) ◄─→ trialing (sub)        eventos: TenantSubscriptionCreated + TenantTrialStarted
                               │ RPC activate_subscription (manager/superadmin, D-D)
                               ▼
                    active (tenant) ◄─→ active (sub)          evento: TenantSubscriptionUpdated
                               │
               ┌───────────────┼─────────────────────────────┐
               │ trial_ends_at expira ── plano pago          │ trial_ends_at expira ── plano free
               ▼ engine: start_past_due                      ▼ engine: activate_free
    past_due (tenant) ◄─→ past_due (sub)          active (sub) [renova 30d]  evento: TenantTrialEnded + Updated
               │  eventos: TenantTrialEnded + Updated
               │
               │  pedido de cancelamento (RPC cancel_subscription → cancel_at_period_end; NÃO mexe em status)
               │  eventos: TenantSubscriptionUpdated (cancelAtPeriodEnd)
               │
               ├── grace expirado (asOf ≥ grace_ends_at)  →  engine: suspend  [6.0.5]
               │       ▼
               │  suspended (tenant) ◄─→ suspended (sub)      evento: TenantSubscriptionSuspended  [NOVO]
               │       │
               │       ├── pagamento confirmado (markPaid) ou RPC reactivate  [6.0.5]
               │       │       ▼
               │       │  active ◄─→ active                    evento: TenantSubscriptionReactivated  [NOVO]
               │       └── pedido/dec. de retenção (D-6.0.5-4)
               │               ▼
               │          cancelled ◄─→ cancelled              evento: TenantSubscriptionCancelled
               │
               └── cancel_at_period_end atingido  →  engine: finalize_cancellation
                       ▼
          cancelled (tenant) ◄─→ cancelled (sub)               evento: TenantSubscriptionCancelled
                       │
                       ▼  D-6.0.5-4 (admin / retenção; F5: nunca excluir)
              archived (tenant, sem sub ativa)
```

**RPCs envolvidas (existentes):** `complete_onboarding` → `start_trial` → `activate_subscription` → `cancel_subscription` (pedido) → `apply_subscription_transition` (todas as efetivações via engine).
**RPCs novas (6.0.5):** `suspend_subscription`/`reactivate_subscription` (internas ao engine, grants ADR-012) + upgrade/downgrade de plano.
**Feature Flags afetadas:** trial→flags **Trial**; active→flags **Plano**; suspended→flags **Suspensas**; cancelled/archived→**Nenhuma**.

---

## 5. Matriz de responsabilidade

| Transição | Dispara | Persiste | Publica evento | Altera flags | Altera `tenant.status` | Altera `sub.status` |
|-----------|---------|----------|----------------|--------------|------------------------|---------------------|
| `draft→trial` | `complete_onboarding` | RPC `start_trial` | `TenantLifecycleService` (Created+TrialStarted) | — | ✅ (RPC) | ✅ (INSERT `trialing`) |
| `trial→active` (manual) | Manager/superadmin (`activate_subscription`) | RPC `activate_subscription` | `TenantLifecycleService` (Updated) | — | ✅ | ✅ |
| `trialing→active` (free, trial expirou) | **Engine** `runCycle` | RPC `apply_subscription_transition` | `BillingService` (TrialEnded+Updated) | — | ✅ (map) | ✅ |
| `trialing→past_due` (pago, trial expirou) | **Engine** `runCycle` | RPC `apply_subscription_transition` | `BillingService` (TrialEnded+Updated) | — | ✅ (map) | ✅ |
| `active` renovação | **Engine** `runCycle` | RPC `apply_subscription_transition` | `BillingService` (Renewed + InvoiceCreated se pago) | — | ✅ (map) | ✅ |
| `past_due→active` (pagou) | `BillingService.markPaid` | RPC `apply_subscription_transition` | `BillingService` (Updated + InvoicePaid + PaymentSucceeded) | — | ✅ (map) | ✅ |
| Pedido de cancelamento | Manager/superadmin (`cancel_subscription`) | RPC `cancel_subscription` | `TenantLifecycleService` (Updated c/ cancelAtPeriodEnd) | — | ❌ (D-A) | ❌ (só coluna) |
| `active/past_due→cancelled` (efetivação) | **Engine** `runCycle` | RPC `apply_subscription_transition` | `BillingService` (Cancelled) | — | ✅ (map) | ✅ |
| **`→suspended` (grace expirado)** | **Engine** `runCycle` **[6.0.5]** | RPC `apply_subscription_transition` (+branch) | `BillingService` (Suspended) **[6.0.5]** | ✅ → Suspensas | ✅ (map corrigido) | ✅ |
| **`suspended→active` (reativação)** | `markPaid` ou RPC manager **[6.0.5]** | RPC `reactivate_subscription`/`apply...` | `BillingService` (Reactivated) **[6.0.5]** | ✅ → Plano | ✅ | ✅ |
| **`suspended→cancelled`** | Engine / decisão retenção **[6.0.5]** | RPC `apply_subscription_transition` | `BillingService` (Cancelled) | ✅ → Nenhuma | ✅ | ✅ |
| **`cancelled→archived`** | Admin/RPC **[6.0.5]** | RPC | — | ✅ → Nenhuma | ✅ | (sub encerrada) |
| **Mudança de plano** | Manager/superadmin **[6.0.5]** | RPC de upgrade via engine | `TenantSubscriptionUpdated` **[6.0.5]** | ✅ → flags do novo plano | ❌ | ✅ (`plan`) |

> Legenda: **map** = mapeamento do `apply_subscription_transition`; a coluna "Altera flags" é **nova responsabilidade da 6.0.5** (hoje nenhum código altera flags, porque não existem).

---

## 6. Lista de inconsistências encontradas

> **Status da Subfase 0 (2026-08-06, ADR-013 Accepted):** os conflitos **documentais** abaixo foram resolvidos por alinhamento exclusivo de docs (sem código). Itens que dependem de decisão do PO (**D-6.0.5-x**) ou de implementação (**6.0.5.x**) permanecem abertos e são indicados na coluna "Resolução".

### Críticas (bloqueiam a modelagem da 6.0.5)

| # | Achado | Evidência | Impacto | Resolução |
|---|--------|-----------|---------|-----------|
| C1 | Destino pós-grace diverge dentro do próprio `SUBSCRIPTION_MODEL` (diagrama → `cancelled`; regra → `suspended`) | `SUBSCRIPTION_MODEL.md:51` vs `:119` vs F4/D3 | Tenant inadimplente seria encerrado em vez de suspenso (perda de receita recuperável) | ✅ **Resolvido (doc)** — `SUBSCRIPTION_MODEL.md` alinhado: diagrama e regra agora convergem para `suspended` |
| C2 | `subscriptions.status` CHECK **não aceita `suspended`** → suspensão sem estado de contrato representável | `20260806020000` (`CHECK status IN ('trialing','active','past_due','cancelled')`) | Núcleo da 6.0.5 sem suporte de schema | ⬜ **Aberto (código)** — CHECK aditivo na **6.0.5.4** (registrado no ADR-013) |
| C3 | `apply_subscription_transition` mapeia desconhecido para `ELSE→active` (e não tem branch `suspended`/`archived`) | `20260806080000:63-83` | Qualquer status novo corrompe `tenants.status` para `active` — risco de invasão de acesso | ⬜ **Aberto (código)** — correção fail-fast na **6.0.5.4** (ADR-013 §3/§4.6) |
| C4 | Três propostas concorrentes de modelo de dados para flags | D4/P4 (`plans+features+plan_features`) vs `FEATURE_FLAGS_MODEL` §6 (`plans.features TEXT[]`) vs `ROADMAP:1112` (`feature_flags` table) | Sem decisão única, retrabalho na fase seguinte | ✅ **Resolvido (decisão registrada)** — ADR-013 §5.3 + D-6.0.5-5: modelo D4/P4 (`plans+features+plan_features`); docs alinhados |
| C5 | `tenants.plan` editado direto em `pages/Admin.tsx:856` (fora do engine) | `pages/Admin.tsx:856` | Divergência `tenants.plan` × `subscriptions.plan`; plano muda sem evento/outbox | ⬜ **Aberto (código)** — corrigir na **6.0.5.3** (anti-pattern P5 do ADR-013 §4.11) |
| C6 | `TENANT_LIFECYCLE.md` ("fonte oficial para condicionais") documenta cancelamento **imediato** — contrato já alterado pela D-A | `TENANT_LIFECYCLE.md:34,47,104` vs `PHASE_6_0_4_4_EXECUTION_PLAN.md:18,31-32` | Implementador da 6.0.5 seguirá contrato errado (D-A é restrição de arquitetura) | ✅ **Resolvido (doc)** — `TENANT_LIFECYCLE.md` alinhado à D-A (pedido → `cancel_at_period_end`; efetivação via engine) |

### Altas

| # | Achado | Evidência | Resolução |
|---|--------|-----------|-----------|
| H1 | Limite Free de profissionais: 1 vs ≤2 | `BUSINESS_DECISIONS.md:91` (F11) vs `ROADMAP.md:892`/`SAAS_CORE_ARCHITECTURE.md:314` | ⬜ **Aberto (PO)** — D-6.0.5-3. Docs alinhados ao fato real (`free=1`, `domain/billing/limits.ts`) |
| H2 | Nível de acesso em `past_due` indefinido (3 versões) | `TENANT_LIFECYCLE.md:15,86` vs `LIFECYCLE_MODEL.md:124` vs `SAAS_CORE_ARCHITECTURE.md:134` | ✅ **Resolvido (doc)** — unificado em "depende da D-6.0.5-1" nos 3 docs |
| H3 | Máquina de suspensão/reativação tem 3 fontes conflitantes | `SAAS_CORE_ARCHITECTURE.md:122-123`/`LIFECYCLE_MODEL.md:29`/`TENANT_MODEL.md:75-76` vs `TENANT_LIFECYCLE.md:23-56` (sem `suspended→active`) | ✅ **Resolvido (doc)** — todas as máquinas alinhadas ao ADR-013 §5 (inclui `suspended→active`; cancelamento=pedido) |
| H4 | Sem `grace_ends_at` no schema → impossível selecionar candidatos à suspensão | schema audit §1/§3 | ⬜ **Aberto (código)** — coluna na **6.0.5.4** |
| H5 | TTL 90 dias (remoção automática) contradiz F5 (nunca excluir) | `LIFECYCLE_MODEL.md:77` vs `BUSINESS_DECISIONS.md:55-58` | ✅ **Resolvido (doc)** — `LIFECYCLE_MODEL.md` corrigido para F5 (dados preservados) |
| H6 | Sem camada de feature flags nem enforcement (confirmado no código) | `PLATFORM_CERTIFICATION.md:163-164` (8.3/8.4 ❌) — gap esperado da 6.0.5 | ⬜ **Aberto (código)** — **6.0.5.1/6.0.5.2/6.0.5.3** |
| H7 | `limits.ts` órfão (não conectado) + enforcement só hardcoded no SQL | `domain/billing/limits.ts` vs `invite_team_member` | ⬜ **Aberto (código)** — **6.0.5.3** |
| H8 | Dois gates paralelos de acesso sem hierarquia (profile × tenant) | `App.tsx:154-158` | ⬜ **Aberto (código)** — unificar gate na **6.0.5.3** (Estado Efetivo) |

### Médias

| # | Achado | Resolução |
|---|--------|-----------|
| M1 | Nomes de tabelas billing divergem da doc 5.5 (`platform_*` vs reais) | ✅ **Resolvido (doc)** — `SAAS_CORE_ARCHITECTURE.md` corrigido para `subscriptions`/`invoices`/`billing_events`/`payment_attempts` |
| M2 | Status de invoice: enum antigo vs CHECK real | ✅ **Resolvido (doc)** — `SUBSCRIPTION_MODEL.md` documenta o CHECK real (`draft/issued/paid/overdue/failed/void`) |
| M3 | Catálogo de flags: `chef_club` vs `club_dos_chefes`; mapa feature↔flag da 5.5.4 incompleto ("Agenda Online"/"Relatórios avançados" sem flag) | ✅ **Resolvido (doc)** — catálogo único em `FEATURE_FLAGS_MODEL.md` (`chef_club`); `SAAS_CORE`/`ROADMAP` delegados ao modelo |
| M4 | Eventos de lifecycle: prefixos divergentes em docs legados | ✅ **Resolvido (doc)** — catálogo D2 (`TenantSubscription*`) nos docs; legados marcados obsoletos |
| M5 | `cancel_at_period_end` boolean (doc) vs timestamptz (schema) | ✅ **Resolvido (doc)** — `SUBSCRIPTION_MODEL.md` documenta `timestamptz` |
| M6 | Âncora do trial: doc do plano diz `now()`, código usa `created_at` (código correto; alinhar doc) | ✅ **Resolvido (doc)** — todos os docs alinhados a `tenants.created_at + 14d` |
| M7 | `get_due_subscriptions`/`get_subscription()` divergem do padrão by-id; `save_onboarding_step` usa guard legado `role='manager'` | ⬜ **Aberto (código)** — **6.0.5.5** |
| M8 | Subscriptions criada no provisionamento vs no `start_trial` (evento `TenantSubscriptionCreated` em momento ambíguo) | ⬜ **Aberto (código)** — **6.0.5.x** (definir momento único) |
| M9 | ADR-011/ROADMAP citam `draft→active` já corrigido p/ `draft→trial` | ✅ **Resolvido (doc)** — ROADMAP corrigido; ADR-011 é registro histórico (não alterado) |
| M10 | Colisão de numeração ADR-001 (dois arquivos) + README do `docs/adr/` incompleto | ⬜ **Aberto (infra docs)** — renomear ADR-001 conflitante (fora da Subfase 0) |
| M11 | Trigger `sync_profile_to_user_tenants` existe só no banco vivo (drift de migration) | ⬜ **Aberto (código)** — **6.0.5.5** |
| M12 | Tabelas de billing sem triggers de audit (audit attach pré-data as tabelas) | ⬜ **Aberto (código)** — **6.0.5.5** |
| M13 | `ROADMAP:1111` checkbox 6.0.4 `[ ]` + escopo cita "cobrança recorrente/gateway" inexistente (invoice amount=0) | ✅ **Resolvido (doc)** — ROADMAP marca 6.0.4 certificada e escopo real (engine, sem gateway) |

### Baixas

| # | Achado | Resolução |
|---|--------|-----------|
| B1 | `elite`/`enterprise` residuais em docs oficiais pós-D1 | ✅ **Resolvido (doc)** — todos os docs alinhados a `free/pro/premium` |
| B2 | Cadência anual sem decisão registrada (planos `price_yearly_cents` já modelados) | ⬜ **Aberto (PO)** — D-6.0.5-6 |
| B3 | Dunning 3×3d documentado sem base em runtime | ✅ **Resolvido (doc)** — `SUBSCRIPTION_MODEL.md` marca dunning como não implementado/obsoleto |
| B4 | Auditoria 6.0.4 declarou modelos "consistente" sem detectar C1/H5/M9 | ✅ **Resolvido** — corrigido pela própria Entry Audit 6.0.5 + Subfase 0 |

---

## 7. Veredito dos critérios de entrada

| Critério do PO | Situação | Ação |
|----------------|----------|------|
| Sem conflito entre decisões anteriores (6.0.4.x) | ✅ **Decisões 6.0.4.x consistentes entre si e com o schema.** Os conflitos são **documentais** (docs 5.x e MODEL docs legados) e textuais internos (C1) — não de decisão. | Alinhar docs em pré-requisito de doc (subfase 0), **não** como fase de código |
| Sem mudança de contrato nas RPCs certificadas | ⚠️ **Nenhuma assinatura muda.** Contudo: (a) `subscriptions.status` CHECK ganha `'suspended'` (aditivo); (b) `apply_subscription_transition` muda o corpo (map) para corrigir `ELSE→active` e incluir `suspended` — **aditivo + correção de bug latente**, chamada só pelo engine; (c) novas RPCs internas (`reactivate_subscription`, upgrade). **RPCs de frontend intocadas.** | Registrar em ADR-013 que a mudança é aditiva e que RPCs públicas preservam contrato |
| Desacoplamento Billing × Tenant × Flags completamente definido | ❌ **Não definido.** Precisa de ADR-013 (responsabilidades §2.1, estados §3, fontes §2.3, mapeamento explícito) + decisões D-6.0.5-x antes de código | ADR-013 como **entregável de entrada da 6.0.5** |

**Conclusão: os critérios NÃO estão totalmente fechados** — a modelagem de suspensão, plans e flags exige o ADR-013 e 4 decisões do PO antes de qualquer linha de código (exatamente a diretriz do PO: resolver no plano e nos ADRs antes de codificar).

### Decisões requeridas do PO (D-6.0.5)

| # | Decisão | Opções | Recomendação técnica |
|---|---------|--------|----------------------|
| D-6.0.5-1 | Acesso em `past_due` durante grace | (a) full (status quo) · (b) read-only · (c) leitura total + escrita de comandas ❌ | (b) read-only com aviso — alinha com suspensão progressiva |
| D-6.0.5-2 | Acesso em `cancelled` | (a) bloqueado (status quo) · (b) read-only p/ export/retenção | (b) read-only facilita reativação e LGPD (F5) |
| D-6.0.5-3 | Limite Free de profissionais | 1 · 2 · configurável | 1 (F11 é decisão mais recente do PO) — **confirmar** |
| D-6.0.5-4 | Saída de `suspended`/`cancelled` por retenção | (a) retenção 30d→cancelled · (b) manual superadmin · (c) sem TTL (F5) | (b) sem TTL — F5 nunca exclui; `archived` via ação manual |
| D-6.0.5-5 | Modelo de dados de flags | (a) `plans+features+plan_features` (D4/P4) · (b) `plans.features TEXT[]` · (c) `feature_flags` table | (a) — é o aprovado em D4/P4 |
| D-6.0.5-6 | Cadência anual | mensal · mensal+anual | mensal agora; anual aditivo futuro (sem coluna removida) |
| D-6.0.5-7 | `archived` no `subscriptions.status` | sim (contrato terminal) · não (só tenant) | não — `archived` é estado de tenant; contrato já está `cancelled` |
| D-6.0.5-8 | Cron do `runCycle` | supabase cron · Edge Function · manual | Edge Function agendada (padrão Supabase) — **decisão de infra (PO)** |

---

## 8. Plano de implementação proposto (subfases)

> **Pré-requisito (subfase 0 — sem código):** ADR-013 (modelo 6.0.5: responsabilidades/estados/mapeamento/grants) + decisões D-6.0.5 + alinhamento documental (C1, C6, D3, D4, D6, H2, H3, M1–M6, B1 — atualizar `SUBSCRIPTION_MODEL`, `TENANT_LIFECYCLE`, `LIFECYCLE_MODEL`, `SAAS_CORE`, `ROADMAP`).

> **✅ Subfase 0 concluída (2026-08-06):** ADR-013 **Accepted** (`36935fa`). Alinhamento documental entregue — ver status de resolução na **§6**. Docs atualizados: `SUBSCRIPTION_MODEL.md`, `TENANT_LIFECYCLE.md`, `LIFECYCLE_MODEL.md`, `SAAS_CORE_ARCHITECTURE.md`, `BUSINESS_ARCHITECTURE.md`, `PLATFORM_CERTIFICATION.md`, `FEATURE_FLAGS_MODEL.md`, `ROADMAP.md`. **Zero código alterado.** Decisões D-6.0.5-1..8 permanecem **abertas** (PO) e bloqueiam a implementação.

| Subfase | Escopo | Entregas-chave |
|---------|--------|----------------|
| **6.0.5.1 — Modelagem de Plans** | Tabela `plans` (slug free/pro/premium, limites, preços mensal) + `features` (catálogo único: `appointments, pos, clients, services, products, team, dashboard, finance, cash_closing, commissions, receivables, expenses, chef_club, vouchers, promotions, api, whatsapp, marketplace, multi_unit, bi` — resolver M3) + `plan_features` (matriz F8: plano conhece flags) | Migration + seed idempotente; `tenants.plan`/`subscriptions.plan` passam a referenciar `plans` (CHECK/fk); fim dos slugs soltos |
| **6.0.5.2 — Feature Flags** | `feature_flags` runtime (tenant×flag, inclui override suspensão) + RPC `tenant_has_feature` (grants ADR-012) + `useFeatureFlags()`/`can()` + `<FeatureGuard>` + `moduleRegistry` no sidebar | Flags consultáveis por tenant/plano/status; sem enforcement ainda |
| **6.0.5.3 — Enforcement** | Substituir `limits.ts` estático e SQL hardcoded por leitura de `plans`; RPCs com `tenant_has_feature`; upgrade/downgrade de plano via engine (RPC + evento `TenantSubscriptionUpdated`); corrigir `Admin.tsx:856` (UPDATE direto → RPC); unificar gate `App.tsx` com hierarquia profile→tenant→flag | Enforcement único e rastreável; sem divergência `tenants.plan`×`subscriptions.plan` |
| **6.0.5.4 — Suspensão/Reativação** | `subscriptions.status` + `'suspended'`; coluna `grace_ends_at`; engine: ação `suspend` (grace expirado) + `reactivate`; corrigir `apply_subscription_transition` (map explícito, fail-fast, sem `ELSE→active`); `get_due_subscriptions` inclui candidatos à suspensão; ativar eventos `TenantSubscriptionSuspended`/`Reactivated`; RPCs `suspend_subscription`/`reactivate_subscription`; flag override Suspensas | Ciclo completo `past_due→suspended→active/cancelled` determinístico; D-A preservado |
| **6.0.5.5 — E2E + Hardening** | E2E flow11 (grace→suspensão) + flow de reativação; suíte de regressão (flow9/flow10/flow12); corrigir achados M7/M11/M12 (guard legado, trigger drift, audit triggers em billing); docs finais + baseline `v1.5.0-feature-flags-6.0.5` | Fase certificada (padrão das anteriores) |

**Ordem de execução:** 0 (ADR/decisões/docs) → 6.0.5.1 → 6.0.5.2 → 6.0.5.3 → 6.0.5.4 → 6.0.5.5. **6.0.5.4 depende de 6.0.5.2** (override de flags na suspensão).

---

## 9. Anexo — Fatos de schema confirmados (referência)

- `tenants`: `status tenant_status NOT NULL` (`draft,trial,active,past_due,suspended,cancelled,archived`), `plan TEXT CHECK (free,pro,premium)`. **Sem** `trial_ends_at`/`grace_ends_at`/`current_period_end`/`cancel_at_period_end` (só em `subscriptions`).
- `subscriptions`: `status TEXT CHECK (trialing,active,past_due,cancelled)`, `trial_started_at/trial_ends_at/current_period_start/current_period_end/canceled_at/cancel_at_period_end(timestamptz)`. Partial unique index: 1 ativa por tenant.
- `invoices`: CHECK `(draft,issued,paid,overdue,failed,void)`; `payment_attempts`: CHECK `(pending,success,failed)`; `billing_events`: append-only.
- RPCs (todas SECURITY DEFINER; SELECT-only RLS nas tabelas de billing): `start_trial`, `activate_subscription`, `cancel_subscription`, `apply_subscription_transition`, `create_invoice`, `mark_invoice_paid`, `get_invoice`, `get_subscription`, `get_subscription_by_id`, `get_due_subscriptions`, `record_payment_attempt`, `record_billing_event`, `complete_onboarding`, `provision_new_tenant`, `save_onboarding_step`, `generate_unique_slug`.
- Auth helpers: `current_tenant_id_from_auth_uid`, `current_is_super_admin_from_auth_uid`, `current_is_tenant_manager_from_auth_uid`, `get_auth_access_context`.
- `invite_team_member` lê `tenants.plan` p/ limite (free=1/pro=5/∞).
- Sem tabela `plans`/`feature_flags`/`limits` no schema ativo (confirma D4).
