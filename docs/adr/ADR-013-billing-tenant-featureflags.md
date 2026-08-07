# ADR-013 — Billing, Tenant Lifecycle e Feature Flags: Três Contextos Desacoplados (Modelo de Domínio 6.0.5)

**Status:** Accepted — aprovado pelo PO em 2026-08-06 com os acréscimos de **Estado Efetivo** (§2.4), **Single Writer Principle** (§3.1) e **proibição de string literals** (§4.11/§7). **Decisões de negócio D-6.0.5-1..8 aprovadas pelo PO em 2026-08-06** (ver §6) — etapa de definição funcional da 6.0.5 encerrada. **6.0.5.1 ✅ (2026-08-06, baseline `v1.4.3`), 6.0.5.2 ✅ (2026-08-06), 6.0.5.3 ✅ (2026-08-07, commit `b383222`), 6.0.5.4 ✅ IMPLEMENTADA (2026-08-07)** — §3.1 aplicado (desvio eliminado), invariante §4.7 implementada (`ELSE RAISE EXCEPTION`), `suspended` aditivo + `grace_ends_at` + RPCs `suspend_subscription`/`reactivate_subscription` (migration `20260807010000` validada T1–T7 em Postgres 16 docker; unit 874/874; E2E flow14 adiado à janela única — decisão PO).
**Date:** 2026-08-06
**Author:** Augusto (PO) + SMG Engineering
**Baseado em:** `docs/audit/PHASE_6_0_5_ENTRY_AUDIT.md` (auditoria de entrada, 2026-08-06)
**Baseline de referência:** `v1.4.2-billing-engine-6.0.4.4`
**Requisito de entrada da 6.0.5:** este ADR aprovado ANTES de qualquer linha de código da fase.

---

## 1. Objetivo

Desacoplar **Billing (Subscription)**, **Tenant Lifecycle** e **Feature Flags** como três contextos independentes, definindo:

- qual componente é responsável por cada estado;
- qual é a fonte de verdade de cada decisão;
- quais transições são válidas (e quais são proibidas);
- os invariantes permanentes que as fases futuras (6.0.5, 6.1, ...) não podem violar.

O problema da 6.0.5 deixou de ser implementação e passou a ser **modelo de domínio**. Este ADR congela a arquitetura para transformar as próximas fases em implementação, não em redefinição do domínio.

## 2. Arquitetura oficial — três contextos

### 2.1 Subscription (Contrato Comercial / Faturamento)

Estados do contrato (`subscriptions.status` — hoje `TEXT + CHECK`; **a 6.0.5 adiciona `'suspended'`** ao CHECK):

```
trialing → active → past_due → suspended → cancelled
```

- `trialing` (tenants usa `trial` — ver §2.2): trial em andamento.
- `active`: contrato em dia (plano pago ou free pós-trial).
- `past_due`: contrato com vencimento expirado, dentro da janela de grace (D3/F4).
- `suspended`: **NOVO na 6.0.5** — grace expirado sem pagamento.
- `cancelled`: contrato efetivamente encerrado (após `cancel_at_period_end` atingido).

**Decisão de nomenclatura (congelada):** `trialing` e `trial` são **conceitos diferentes em camadas diferentes**:

```
trialing  ←  estado do CONTRATO (subscriptions.status)
trial     ←  estado de ACESSO (tenants.status)
```

São enums distintos, com semânticas distintas (faturamento vs acesso), que **coincidem por regra de mapeamento**, não por acaso. Nenhum código pode tratá-los como o mesmo valor. O mapeamento 1:1 explícito (§3) e o fail-fast (§4.7) garantem consistência sem renomear colunas (renomear seria mudança de contrato sem ganho).

### 2.2 Tenant (Acesso ao Sistema)

Estados do acesso (`tenants.status` — enum `tenant_status` completo, já no banco):

```
draft → trial → active → past_due → suspended → cancelled → archived
```

- `draft`: pré-F10 (onboarding não concluído).
- `trial`: F10 (trial ativo).
- `active`: acesso pleno.
- `past_due`: acesso de inadimplência (grace) — **read-only com aviso** (D-6.0.5-1).
- `suspended`: acesso suspenso — **bloqueado** (D-6.0.5-2).
- `cancelled`: organização encerrada — **somente leitura** (D-6.0.5-2).
- `archived`: estado terminal de retenção (F5 — nunca excluir dados; transição via ação manual do superadmin — D-6.0.5-4).

**Congelado:** o enum de 7 valores é o contrato permanente. `grace` NÃO é estado. `cancel_pending` NÃO existe.

### 2.3 Feature Flags (Funcionalidades e Limites)

Não é uma máquina de estados — é um **contexto derivado**:

```
plans (free | pro | premium)
   └── feature set (recursos habilitados por plano)
        └── limites por plano
             └── override por status do tenant (suspenso → "Suspensas")
```

- **Direção da associação (F8):** a flag não conhece o plano; **o plano conhece as flags** (`plan_features`).
- **Override de suspensão:** quando `tenants.status = 'suspended'`, todas as flags efetivas vão para "Suspensas" (acesso restrito), independentemente do plano.
- **Fontes derivadas apenas** — nenhum código decide funcionalidade por `tenants.plan` solto.

### 2.4 Estado Efetivo (acesso derivado)

Os três contextos (§2.1–2.3) são **estados persistidos**. Existe um terceiro conceito, **não persistido**, que o Billing Engine calcula em conjunto com as Feature Flags:

```
Subscription State
      +
Tenant State
      +
Feature Availability
      =
Estado Efetivo (acesso do tenant)
```

> **O acesso efetivo do tenant não é determinado exclusivamente pelo `subscription.status` nem pelo `tenant.status`, mas pela avaliação das regras do Billing Engine combinadas às Feature Flags.**

**Consequência operacional:** é proibido decidir acesso no código com `if (tenant.status === "active")` (ou qualquer variante). Toda decisão de acesso passa pela **camada de autorização** (autorização = estado efetivo), que consulta os três contextos. Isso impede que daqui a seis meses alguém leia só `tenant.status` e perca as regras combinadas (ex.: trial expirando sem pagamento, suspensão por grace, flags de plano restringindo um módulo).

## 3. Fonte de verdade

| Decisão | Fonte de verdade | Escrito por |
|---------|------------------|-------------|
| Faturamento / ciclo / vencimento | `subscriptions` | **Billing Engine** (via Transition Executor) |
| Acesso ao sistema | `tenants.status` | **TenantLifecycleService** (writer único, §3.1; reage às decisões do engine) |
| Funcionalidades disponíveis | Feature Flags (plano × status) | Camada de flags 6.0.5 (derivada, read-only) |
| Limites do plano | Tabela `plans` (6.0.5.2) | Migrations/seed; leitura por RPCs de enforcement |
| Pedido de cancelamento | `subscriptions.cancel_at_period_end` | RPC `cancel_subscription` (via Lifecycle Service) |

**Invariante central:** nenhum componente escreve diretamente no estado de outro contexto, exceto o **Transition Executor** — a única fronteira de mutação de estado. O Transition Executor hoje é a RPC `apply_subscription_transition` (e as RPCs par `start_trial`/`activate_subscription`, orquestradas pelo Lifecycle Service); na 6.0.5 ganha suporte a `suspended`/`archived` e RPCs de suspensão/reativação/upgrade, sempre sob o contrato de grants do ADR-012.

### 3.1 Single Writer Principle

Cada agregado possui **apenas um componente autorizado a alterar seu estado**. Dois writers para o mesmo dado é a causa raiz de grande parte dos bugs das fases 6.0.1–6.0.4 e é proibido por construção.

| Agregado | Writer oficial |
|----------|----------------|
| `subscriptions` | **Billing Engine** (`BillingService`) |
| `tenants.status` | **TenantLifecycleService** |
| Feature Flags | **FeatureFlagService** (novo, 6.0.5) |
| `plans` | **BillingService** (catálogo/seed, 6.0.5.2) |

Qualquer alteração direta fora desses serviços constitui **violação arquitetural** (mesmo que funcione).

**Mecânica de implementação:**
- O **Billing Engine decide** toda transição (é a única fonte de decisão do ciclo). Ele persiste `subscriptions` (writer único do contrato).
- O lado de **`tenants.status`** é persistido exclusivamente pelo **TenantLifecycleService**, reagindo às decisões/efeitos do engine.
- O **Transition Executor** (`apply_subscription_transition`) é a única função física de mutação, porém **pertence a dois writers lógicos**: a persistência de `subscriptions` (emitida pelo Billing Engine) e a persistência de `tenants.status` (emitida pelo TenantLifecycleService).
- **Desvio conhecido — ELIMINADO na 6.0.5.4 (2026-08-07):** na 6.0.4.x a chamada única ao `apply_subscription_transition` gravava contrato e tenant juntos, sem distinguir o writer. A 6.0.5.4 dividiu essa responsabilidade: o **Transition Executor** persiste o contrato (escrita emitida pelo Billing Engine) e o **TenantLifecycleService** (`domain/tenant/tenantLifecycleService.ts`) é o **writer único de `tenants.status`** (ADR-013 §3.1), preservando a atomicidade via fronteira de transição.

## 4. Regras permanentes (invariantes)

1. **`cancel_at_period_end` é pedido de cancelamento** (D-A). O status permanece o mesmo e o acesso é mantido até o fim do período; apenas o Billing Engine efetiva para `cancelled`.
2. **Não existe status `cancel_pending`.** Introduzir exigiria ADR substituindo explicitamente a D-A.
3. **Grace não é status.** É janela temporal derivada de datas (`current_period_end` + 5 dias → `grace_ends_at`, coluna nova na 6.0.5.4). `tenants.status` nunca recebe `grace`.
4. **Billing nunca altera permissões diretamente.** Nenhum evento/transição de billing modifica `role_permissions`, RLS ou perfis.
5. **UI nunca altera `tenants.plan` (nem `subscriptions.plan`) diretamente.** Mudança de plano só via RPC de upgrade/downgrade do engine (corrige o anti-padrão atual `pages/Admin.tsx:856` na 6.0.5.3).
6. **Somente o Billing Engine / Lifecycle Service executa transições.** Nenhuma RPC nova de mutação sem passar pela fronteira do Transition Executor.
7. **Transições são totais e com fail-fast.** O mapeamento subscription→tenant deve cobrir todos os estados e **falhar** em combinação desconhecida — proibido o `ELSE → active` atual (`apply_subscription_transition`).
8. **Todo status novo = mudança em três lugares ao mesmo tempo:** CHECK do `subscriptions.status` (migration), máquina de estados do Billing Engine (`billingEngine.ts`) e mapa do Transition Executor. Nenhum dos três pode mudar isolado.
9. **Todo RPC novo segue ADR-012** (`REVOKE FROM PUBLIC/anon` + `GRANT TO authenticated`), com exceções públicas listadas e justificadas.
10. **Combinações de estado válidas:** somente as da matriz do §5.2. Qualquer outra é inválida por construção.
11. **Proibido usar string literals de planos ou features fora da camada de domínio.** `if (plan === "premium")` ou `if (feature === "chef_club")` esparsos pelo código são proibidos — sempre passar pela abstração de Feature Flags / catálogo de `plans` (constantes tipadas em `domain/`).

## 5. Fluxo de estados

### 5.1 Transições (máquina completa)

```
(tenant sem sub) ──F10──> draft
                             │  complete_onboarding → RPC start_trial        [Lifecycle Service]
                             ▼
                        trial ──trialing── (sub)
                             │  RPC activate_subscription (manager/superadmin) [Lifecycle Service]
                             ▼
                        active ──active── (sub)
                             │  trial expirado (free) → activate_free        [Billing Engine]
                             │  trial expirado (pago) → start_past_due       [Billing Engine]
                             ├──────────────────────────────────────────────┤
                             ▼                                               ▼
                        past_due ──past_due── (sub)              active (free) [renova]
                             │
                             │  pedido: RPC cancel_subscription (só coluna, D-A)  [Lifecycle Service]
                             │  pagou → markPaid → active                     [Billing Engine]
                             │  grace expirado (asOf ≥ grace_ends_at) → suspend [Billing Engine] 6.0.5
                             ▼
                        suspended ──suspended── (sub)            [NOVO 6.0.5]
                             │  reativação: markPaid / RPC reactivate → active  [Billing Engine] 6.0.5
                             │  decisão de retenção (D-6.0.5-4) → cancelled
                             ▼
                        cancelled ──cancelled── (sub)
                             │  cancel_at_period_end atingido → finalize_cancellation [Billing Engine]
                             │  retenção manual (D-6.0.5-4) → archived
                             ▼
                        archived (tenant; contrato encerrado)
```

### 5.2 Matriz de combinações válidas (congelada)

| Subscription | Tenant | Feature Flags | Permitido |
|--------------|--------|---------------|-----------|
| — | `draft` | — | ✅ pré-F10 |
| `trialing` | `trial` | Trial | ✅ |
| `active` | `active` | Plano | ✅ |
| `past_due` | `past_due` | Plano (restrito — read-only com aviso, D-6.0.5-1) | ✅ |
| `suspended` | `suspended` | Suspensas | ✅ (6.0.5) |
| `cancelled` | `cancelled` | Somente leitura (D-6.0.5-2) | ✅ |
| — | `archived` | Nenhuma | ✅ |

**Proibidas (por construção):** `trialing/active/past_due` × `draft|archived`; `active` × `trial|past_due|suspended|cancelled`; `past_due` × `active`; `suspended` × `active|past_due`; `cancelled` × `active|past_due|trial|draft`.

### 5.3 Responsabilidade por transição

| Transição | Pertence a | Evento |
|-----------|-----------|--------|
| `draft→trial` | Lifecycle Service (`start_trial`) | `TenantSubscriptionCreated` + `TenantTrialStarted` |
| `trial→active` (manual) | Lifecycle Service (`activate_subscription`) | `TenantSubscriptionUpdated` |
| `trialing→active/past_due` (trial expirou) | **Billing Engine** | `TenantTrialEnded` + `TenantSubscriptionUpdated` |
| `active` renovação | **Billing Engine** | `TenantSubscriptionRenewed` (+ `InvoiceCreated` se pago) |
| `past_due→active` (pagou) | **Billing Engine** (`markPaid`) | `TenantSubscriptionUpdated` + `InvoicePaid` + `PaymentSucceeded` |
| pedido de cancelamento | Lifecycle Service (`cancel_subscription`) | `TenantSubscriptionUpdated` (com `cancelAtPeriodEnd`) |
| `→cancelled` (efetivação) | **Billing Engine** | `TenantSubscriptionCancelled` |
| `→suspended` (grace expirado) | **Billing Engine** (6.0.5) | `TenantSubscriptionSuspended` |
| `suspended→active` | **Billing Engine** (6.0.5) | `TenantSubscriptionReactivated` |
| `suspended/cancelled→archived` | Ação administrativa manual (superadmin — D-6.0.5-4; sem TTL) | — |

**Flags afetadas:** trial→Trial · active→Plano · past_due→Plano (read-only, D-6.0.5-1) · suspended→Suspensas · cancelled→Somente leitura (D-6.0.5-2) · archived→Nenhuma. A alteração efetiva das flags é responsabilidade da camada de flags da 6.0.5 (derivada), nunca do Billing Engine.

## 6. Questões de negócio — decisões do PO (aprovadas 2026-08-06)

**✅ Todas as decisões D-6.0.5-1..8 foram aprovadas pelo PO em 2026-08-06.** Com elas, a etapa de definição funcional da 6.0.5 está encerrada e a implementação (6.0.5.1+) não tem bloqueio conceitual.

| # | Questão | Decisão (PO) |
|---|---------|--------------|
| D-6.0.5-1 | Acesso durante `past_due` (grace) | **(b) Read-only com aviso** — login, dashboard, relatórios e exportações permitidos; **sem** criação de clientes/comandas/agendamentos, movimentação financeira, estoque ou alterações cadastrais relevantes. Interface deve sinalizar acesso limitado por inadimplência |
| D-6.0.5-2 | Acesso durante `cancelled` | **(b) Somente leitura (exportação/retenção)** — login, consulta, exportação e relatórios permitidos; **qualquer escrita bloqueada**. `cancelled` = modo consulta permanente até eventual reativação por novo fluxo comercial (futuro). Nenhuma escrita após cancelamento |
| D-6.0.5-3 | Limite do plano Free (profissionais) | **1 profissional** (confirma F11) |
| D-6.0.5-4 | Política de suspensão/retenção | **(b) Manual pelo superadmin, sem TTL** — nenhuma exclusão automática (F5). `archived` é sempre ação administrativa manual |
| D-6.0.5-5 | Modelo de dados de flags | **(a) `plans + features + plan_features`** (D4/P4) |
| D-6.0.5-6 | Cadência de cobrança | **Mensal agora**; anual fica para evolução futura aditiva (sem contaminar a implementação atual) |
| D-6.0.5-7 | `archived` no `subscriptions.status` | **Não** — `archived` é estado exclusivo do Tenant; `subscriptions.status` nunca recebe `archived` (terminal do contrato é `cancelled`) |
| D-6.0.5-8 | Gatilho do `runCycle` (cron) | **Edge Function agendada** — ver §6.1 |

### 6.1 Regras complementares congeladas (PO, 2026-08-06)

**Plano Free (congelado):** 1 profissional · 1 unidade · sem Chef Club · sem módulos Premium. Limites controlados **exclusivamente pelas Feature Flags** — nenhuma regra pode depender do nome do plano.

**`runCycle` determinístico:**
```
Scheduler
    ↓
Edge Function   (apenas agenda a execução — fornece asOf e dispara; NUNCA contém regras de negócio)
    ↓
Billing Engine  (regras de negócio)
    ↓
Eventos
```
A Edge Function fornece o horário (`asOf`) e dispara a execução do Billing Engine. Ela nunca contém regras de negócio.

## 7. Anti-patterns proibidos

- ❌ **Atualizar `tenants.plan` (ou `subscriptions.plan`) diretamente pela UI** — toda mudança de plano passa por RPC de upgrade/downgrade do engine. Proibido o padrão atual `pages/Admin.tsx:856`.
- ❌ **Criar RPCs que alterem estado sem passar pelo Lifecycle Service / Transition Executor** — nenhuma mutação de `subscriptions.status`/`tenants.status` fora da fronteira de transição.
- ❌ **Introduzir novos status sem atualizar a State Machine** — invariante §4.8: CHECK + `billingEngine.ts` + mapa do Transition Executor juntos, ou nada.
- ❌ **Misturar estado financeiro com estado de acesso** — `subscriptions.status` nunca é lido para gate de UI; `tenants.status` nunca decide cobrança. (Precedente: ADR-001 Commission vs Settlement.)
- ❌ **Duplicar regras entre banco e frontend** — limites e flags leem de fonte única (`plans`/`plan_features`); nenhuma constante de limite solta no TS (`limits.ts` órfão da 6.0.4.4 deve ser eliminado na 6.0.5.3).
- ❌ **Mapeamento com fallback silencioso** — proibido `ELSE → active`; combinação desconhecida falha (invariante §4.7).
- ❌ **Bypass de flag para desbloquear funcionalidade** — feature só é liberada por flag; nenhum `if (plan === 'premium')` esparso fora da camada de flags.
- ❌ **String literals de planos/features fora da camada de domínio** — `plan === "premium"`, `feature === "chef_club"` etc. só existem como constantes tipadas em `domain/`; fora disso, consultar a abstração de Feature Flags.

## 8. Alternativas consideradas

1. **Status único unificado** (uma coluna com todos os estados financeiros+acesso): **Rejeitada** — mistura responsabilidades, o exato anti-pattern §7; os dois contextos evoluem em ritmos diferentes (contrato vs acesso) e a D-A já provou isso (cancelamento muda coluna sem mudar acesso).
2. **Manter `tenants.plan` como fonte de limites** (status quo): **Rejeitada** — dois pontos de escrita, divergência `tenants.plan`×`subscriptions.plan` já observada, sem trilha de eventos.
3. **Flags como tabela única `feature_flags` sem relação com plans** (ROADMAP:1112 literal): **Deferida** — o modelo relacional `plans+features+plan_features` (D4/P4) dá origem à consulta de flags por tenant; a tabela runtime fica restrita ao override por status/tenant.

## 9. Consequências

- **Positivo:** fronteira de mutação única e auditável; `ELSE→active` eliminado; divergência de planos eliminada; flags derivadas sem duplicação; fases futuras passam a ser implementação.
- **Positivo:** precedente de separação de domínio reforçado (ADR-001: comissão ≠ settlement; ADR-013: billing ≠ acesso ≠ funcionalidade).
- **Negativo:** exige alinhamento documental (docs 5.x, `SUBSCRIPTION_MODEL`, `TENANT_LIFECYCLE`, `LIFECYCLE_MODEL`, `ROADMAP` resíduos) — subfase 0 da 6.0.5, sem código.
- **Negativo:** mudança aditiva no `subscriptions.status` CHECK (novo valor `'suspended'`) e no corpo do `apply_subscription_transition` (map) — RPCs públicas mantêm assinatura e contrato; apenas o engine consome a mudança.
- **Negativo:** pendência `Admin.tsx` persiste até 6.0.5.3 (enforcement), quando o bypass é removido.

## 10. Referências

- Auditoria de entrada: `docs/audit/PHASE_6_0_5_ENTRY_AUDIT.md` (inconsistências C1–C6, H1–H8, decisões D-6.0.5)
- Decisões 6.0.4.x: `docs/audit/PHASE_6_0_4_EXECUTION_PLAN.md` (D1–D5, D-A), `docs/audit/PHASE_6_0_4_4_EXECUTION_PLAN.md`
- Grants RPC: `docs/adr/ADR-012-rpc-execute-grants.md`
- Precedente de separação de domínio: `docs/adr/ADR-001-Commission-vs-Settlement.md`
- Glossário: `docs/TAXONOMY.md` §8.1
- Estados do tenant: `supabase/migrations/20260728000000_sprint1_tenant_lifecycle.sql`; contrato: `20260806020000_phase_6_0_4_billing.sql`, `20260806050000_phase_6_0_4_4_billing_engine.sql`, `20260806080000_fix_apply_subscription_transition_tenant_status_enum.sql`
