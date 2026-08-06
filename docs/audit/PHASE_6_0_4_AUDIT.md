# Phase 6.0.4 — Billing (Tenant Lifecycle): Auditoria

> **Documento oficial de auditoria da Fase 6.0.4.** Subfases 6.0.4.1 a 6.0.4.5 (definição do PO).
> Produzido sob a Regra de Entrada do AGENTS.md: auditoria documental → arquitetural → nomenclatura → consistência.
> **Nenhum código foi escrito** — 6.0.4.1 é fase de auditoria/modelagem.

---

## 1. Auditoria Documental

### 1.1 Fontes oficiais

| Fonte | Status | Papel na 6.0.4 |
|-------|--------|----------------|
| `BUSINESS_DECISIONS.md` (F10–F14) | ✅ consistente | F10 obriga `draft → trial → active`; F11–F13 definem planos Free/Pro/Premium; F14 define Tenant |
| `TENANT_LIFECYCLE.md` | ✅ consistente | **Fonte oficial para condicionais no código.** `trial` existe no ENUM e no TypeScript, mas é inativo até Billing |
| `LIFECYCLE_MODEL.md` | ✅ consistente | Transições de status; idempotência |
| `PLAN_MODEL.md` | ✅ consistente | Modelo de planos |
| `SUBSCRIPTION_MODEL.md` | ✅ consistente | Modelo de assinatura de tenant |
| `TENANT_MODEL.md` | ✅ consistente | Entidade Tenant + idempotência |
| `FEATURE_FLAGS_MODEL.md` | ✅ consistente | F7/F8; prevê tabela `plans` com `features TEXT[]` (§6) |
| `TAXONOMY.md` | ⚠️ **gap** | Nenhum termo de billing de *tenant* (assinatura/fatura/plano). Só cita billing infraestrutural e Club dos Chefes como "assinatura" |

### 1.2 Conclusão documental

1. **F10 é clara:** `draft → trial → active` é obrigatória, nunca `draft → active` direto, mesmo com trial de zero dias. A transição `draft → active` atual (migration sprint1) é uma **divergência conhecida e temporária**, prevista em `TENANT_LIFECYCLE.md` ("quando Billing for ativo, onboarding passará a transicionar `draft → trial`").
   → **A 6.0.4.3 implementa exatamente essa correção** — não é bug a reportar, é a transição planejada.
2. **Gap em TAXONOMY:** faltam termos oficiais para billing de tenant. A 6.0.4 deve registrar (com PO) a terminologia: `subscription`, `invoice`, `plan` (slug), `payment_attempt`.
3. **Ambiguidade de "subscription":** `TAXONOMY.md` rotula Club dos Chefes como "sistema de assinatura e créditos". Se Billing reutilizar o mesmo nome de eventos, cria colisão semântica (ver §5.2).

---

## 2. Auditoria Arquitetural

### 2.1 Reutilizável (sem duplicação)

| Artefato | Localização | Uso na 6.0.4 |
|----------|-------------|--------------|
| `tenant_status` ENUM | migration `20260728000000_sprint1_tenant_lifecycle.sql` | Estados `trial`/`past_due`/`suspended` já existem |
| `TenantStatus` TS | `domain/tenant/types.ts:15-22` | Alinhado ao ENUM |
| `provision_new_tenant` / `complete_onboarding` RPC | sprint1 + `20260805120000_phase_6_0_2_onboarding.sql` | Base para transição `draft → trial` |
| `TenantProvisioningService` | `application/tenantProvisioning.ts` | Padrão de Application Service a espelhar |
| `processed_operations` | `20260723110000_processed_operations.sql` | Idempotência de operações financeiras (UNIQUE tenant_id+idempotency_key) |
| `event_store` + Outbox + Dispatcher + `FinanceProvider` | `domain/events/*` | Billing enfileira operações e publica eventos sem acoplar |
| RLS `current_tenant_id_from_auth_uid()` + superadmin bypass | fix RLS | Padrão obrigatório para RPCs/tabelas novas |

### 2.2 Lacunas (o que a 6.0.4 cria)

- Sem tabela `plans` da plataforma (hoje `tenants.plan` é TEXT com CHECK). `FEATURE_FLAGS_MODEL.md §6` já prevê `plans.features TEXT[]`.
- Sem tabelas de billing: `subscriptions`, `invoices`, `billing_events`, `payment_attempts`.
- Sem `BillingProvider` (interface de gateway) — 6.0.4.5.
- Sem cron/agendamento de cobrança e trial.
- `TenantPlan` é TEXT com comentário "will become ENUM when Billing is added" (`domain/tenant/types.ts:8`).

### 2.3 Conclusão arquitetural

A 6.0.4 **não exige nova arquitetura** — espelha os padrões existentes (RPC SECURITY DEFINER + Application Service + eventos/outbox + idempotência). A única abstração nova é `BillingProvider` (6.0.4.5), exigida pelo ADR para permitir gateways futuros sem refatorar.

---

## 3. Auditoria de Banco

### 3.1 Estado atual

| Tabela | Migração | Observação |
|--------|----------|------------|
| `tenants.plan` (TEXT, CHECK `free/pro/elite`) | `20260724000000_add_plan_to_tenants.sql` | ⚠️ `elite` ≠ `premium` dos docs (ver §5.1) |
| `customer_subscriptions` / `customer_plans` (ChefClub) | `20260311_chef_club_tables.sql` | **Não colidem** com billing de tenant (são assinatura de *cliente*) |
| `processed_operations` | `20260723110000` | Reutilizável para idempotência de cobrança |
| `event_store` | `20260723100000` | Reutilizável para eventos de billing |

### 3.2 Tabelas a criar (6.0.4.2 — domain-only, sem gateway)

| Tabela | Finalidade | Chaves/RLS |
|--------|-----------|------------|
| `subscriptions` | Assinatura do tenant (plano, status, ciclo, trial_end_at) | `tenant_id` FK, RLS tenant, superadmin bypass |
| `invoices` | Faturas emitidas por ciclo | `subscription_id`, status, valor, due_date, paid_at |
| `billing_events` | Trilha de eventos de billing (fora do event_store, visão operacional) | `tenant_id`, tipo, payload JSONB |
| `payment_attempts` | Tentativas de cobrança (ainda sem gateway) | `invoice_id`, status, error, timestamps |

### 3.3 Idempotência

Seguir o padrão já validado na 6.0.3 e em `processed_operations`: chave `(tenant_id, idempotency_key)` e INSERT com UNIQUE VIOLATION tratado.

---

## 4. Auditoria de Segurança & Eventos

### 4.1 Segurança

- Toda RPC nova de billing: `SECURITY DEFINER` + `current_tenant_id_from_auth_uid()` + validação de papel (manager/admin) + superadmin bypass — mesmo padrão das 20+ RPCs auditadas.
- RLS habilitada em todas as 4 tabelas novas; políticas de INSERT/UPDATE via RPC SECURITY DEFINER apenas (padrão `user_tenants`).
- **`approve_access_request()` e `close_order()` continuam pendências herdadas** (já registradas no checklist da 6.0.3, R4) — fora do escopo da 6.0.4.

### 4.2 Colisão de eventos de domínio (achado crítico)

O catálogo do AGENTS.md já registra eventos **publicados pelo ChefClub**:
`SubscriptionCreated`, `SubscriptionCancelled`, `CreditsDeducted` (aggregate `subscription`).

Se Billing publicar `SubscriptionCreated`/`SubscriptionCancelled` com o mesmo nome, o `FinanceSubscriber` (que escuta `*` e mapeia por tipo) **não consegue distinguir assinatura de cliente (ChefClub) de assinatura de tenant (Billing)**.

**Proposta para decisão do PO:** prefixar eventos de billing, ex.:
- `TenantSubscriptionCreated` / `TenantSubscriptionCancelled`
- `InvoiceCreated` / `InvoicePaid` / `PaymentFailed`
- `TrialStarted`

(Alternativa: `BillingSubscriptionCreated`. Decisão em §7 P2.)

---

## 5. Auditoria de Nomenclatura & Consistência

### 5.1 ⚠️ Divergência crítica: `elite` vs `premium`

| Onde | Valor |
|------|-------|
| Docs PO (F11–F13 `BUSINESS_DECISIONS.md`) | Free / **Pro / Premium** |
| Matriz `FEATURE_FLAGS_MODEL.md §5` | free / pro / **premium** |
| Migration `20260724000000` (CHECK) | free / pro / **elite** |
| `domain/tenant/types.ts:26` (`TenantPlan`) | free / pro / **elite** |
| Migration 6.0.3 (limite por plano) | Free=1, **Pro=5, Elite**=ilimitado |

**Impacto:** como a 6.0.4 cria `subscriptions` referenciando o slug do plano, é o momento natural para normalizar. Renomear `elite → premium` exige:
- migration de dados (`UPDATE tenants SET plan='premium' WHERE plan='elite'` + CHECK novo)
- atualizar `domain/tenant/types.ts`
- nenhuma lógica usa `elite` em condicionais de feature (flags ainda não aplicadas) → **baixo risco**.

**Decisão necessária do PO** (§7 P1).

### 5.2 Terminologia billing

- **Tabelas:** `subscriptions` (tenant) vs `customer_subscriptions` (ChefClub) — OK, sem colisão física; colisão é apenas no nome de **eventos** (ver §4.2).
- **`TAXONOMY.md`**: incluir termos de billing após decisão do PO.

### 5.3 Consistência de estados

- `TenantStatus` TS = ENUM `tenant_status` ✅
- `draft → active` atual (sprint1) vs F10 — **divergência planejada**, corrigida na 6.0.4.3 ✅ documentado

---

## 6. Respostas às perguntas do PO (critérios de entrada)

| Pergunta | Resposta |
|----------|----------|
| O que existe hoje? | `tenants.plan` TEXT (free/pro/elite) + `tenant_status` ENUM com `trial` inativo + idempotência/eventos prontos |
| O que a 6.0.4 cria? | 4 tabelas domain-only + lifecycle `draft→trial→active` + Billing Engine + `BillingProvider` |
| Sem gateway é viável? | Sim — `payment_attempts` guarda tentativas e `BillingProvider` abstrai o gateway (6.0.4.5) |
| Eventos/segurança prontos? | Sim — Outbox/FinanceProvider/event_store prontos; RPCs seguem padrão seguro existente |
| Riscos de nomenclatura? | `elite` vs `premium` (P1) e colisão de eventos `Subscription*` (P2) |

---

## 7. Decisões do PO (aprovadas 2026-08-06)

| # | Decisão | Valor aprovado |
|---|---------|----------------|
| **P1** | Normalizar plano `elite` → `premium` | ✅ **Aprovado.** Migration idempotente + constraints + tipos + código + frontend + testes + docs. `premium` = único slug oficial |
| **P2** | Nomes de eventos de billing | ✅ **Aprovado.** Prefixo `TenantSubscription*` + separação Subscription vs Billing. Catálogo de 17 eventos em `PHASE_6_0_4_EXECUTION_PLAN.md §5.4` |
| **P3** | Duração padrão do trial | ✅ **Aprovado: 14 dias** (F3). Início no **provisionamento do tenant**; 5 dias de grace antes da suspensão |
| **P4** | Tabela `plans` | ✅ **Aprovado: manter slug TEXT** na 6.0.4; tabela `plans` + `features` + `plan_features` na 6.0.5 |

> **Nota F3/D3:** F3 dizia "trial contado a partir do `complete_onboarding()`"; a decisão do PO é "início no provisionamento". Ajustar texto de F3 em `BUSINESS_DECISIONS.md` e `PLAN_MODEL.md`.

---

## 8. Conclusão

Nenhum bloqueio arquitetural. A 6.0.4 é implementável 100% com padrões existentes. Decisões P1–P4 aprovadas; execução conforme `PHASE_6_0_4_EXECUTION_PLAN.md`.
