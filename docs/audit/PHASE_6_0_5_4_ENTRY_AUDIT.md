# PHASE 6.0.5.4 — ENTRY AUDIT (TenantLifecycleService + `suspended` aditivo)

> **Data:** 2026-08-07
> **Autorização:** Auditoria de entrada solicitada pelo PO (2026-08-07 — "aprovar início da 6.0.5.4") antes de qualquer código (Regra de Entrada). O PO aprovou iniciar a entry audit **imediatamente**, sem aguardar a janela de deploy.
> **Modo:** Somente documentação — **nenhum arquivo de código (`.ts`/`.tsx`/`.sql`) ou migration alterado; nenhum teste executado; commit restrito a documentação.**
> **Baseline de referência:** `v1.4.3` / **6.0.5.3 implementada** (commit `b383222`, smoke E2E 10/10 em 46.7s, 2026-08-07; deploy ao remoto aguardando janela única — runbook `DEPLOY_RUNBOOK_FASE_6_0_5.md`)
> **Branch:** `feature/phase-6.0.4-billing`
> **Fonte de autoridade:** ADR-013 §2.3/§3.1/§4.3/§5 + `PHASE_6_0_5_ENTRY_AUDIT.md` §8 (linha 350 — escopo congelado da 6.0.5.4) + `LIFECYCLE_MODEL.md` §3.3/§3.5/§4 + `SUBSCRIPTION_MODEL.md` + `TENANT_LIFECYCLE.md` + `BUSINESS_DECISIONS.md` (D-6.0.5-1..8) + `ROADMAP.md` (item 6.0.5.4).

---

## STATUS: ✅ APROVADA PELO PO (2026-08-07) — IMPLEMENTAÇÃO AUTORIZADA

> **Aprovação do PO (2026-08-07):** as decisões **D-6.0.5.4-1..5 foram aprovadas sem ajustes** e a implementação foi autorizada na sequência `migration → domain → application → RPCs → eventos → testes unitários → E2E flow14 → docs → baseline`. Governança reforçada: (1) contrato de acesso intocado (Subscription + Tenant + Feature Availability = Effective State); (2) novo status só existe quando banco + domínio + testes + documentação o conhecem; (3) `runCycle` nunca reativa automaticamente. Registro oficial: `docs/BUSINESS_DECISIONS.md` (D-6.0.5.4-1..5).

---

## 0. Decisões do PO (2026-08-07) aplicáveis

| Código | Decisão |
|--------|---------|
| **PO 2026-08-07** | Iniciar a **Entry Audit da 6.0.5.4 imediatamente** (sem aguardar o deploy) |
| **PO 2026-08-07** | Janela única de deploy: **incluir a migration da 6.0.5.4** na janela operacional (junto a `06030000`/`06090000`/`07000000`); avaliar 6.0.5.5 no fechamento |
| **PO 2026-08-07** | Criar `docs/RELEASE_CHECKLIST_v1.5.md` (checklist vivo de certificação) — criado neste mesmo turno |
| **D-6.0.5-1** | Acesso em `past_due` = **read-only com aviso** (grace 5 dias) |
| **D-6.0.5-2** | Acesso em `cancelled` = **somente leitura**; `suspended` = **aditivo no CHECK** de `subscriptions.status` |
| **D-6.0.5-4** | Política de suspensão/retenção: **manual pelo superadmin, sem TTL**, nenhuma exclusão automática (F5) |
| **D-6.0.5-7** | `archived` **não** entra no `subscriptions.status` (estado exclusivo de Tenant) |
| **D-6.0.5-8** | Gatilho do `runCycle` = Edge Function agendada (só agenda/fornece `asOf`) |

> Registro oficial: `docs/BUSINESS_DECISIONS.md`. Novas decisões específicas da 6.0.5.4 (D-6.0.5.4-1..n) serão registradas **após aprovação** desta entry audit.

---

## Resumo executivo

A **6.0.5.4** implementa a **máquina real de suspensão/reativação** (`past_due → suspended → active/cancelled`) sobre o ciclo de contrato do Billing Engine (6.0.4.4) e o Estado Efetivo (6.0.5.1). Hoje o `subscriptions.status` **não possui `suspended`** (CHECK), o `apply_subscription_transition` tem o **bug latente `ELSE → active`** (corromperia um tenant suspenso para `active`), o engine retorna `none` para `past_due` (suspensão inexistente) e os eventos `TenantSubscriptionSuspended`/`Reactivated` existem **mortos** no catálogo. A 6.0.5.4 é a **correção dessa lacuna central** do ADR-013.

Escopo congelado (fonte: `PHASE_6_0_5_ENTRY_AUDIT.md:350`):
- `subscriptions.status` **+ `suspended`** (aditivo no CHECK; D-6.0.5-2/7);
- coluna **`grace_ends_at`** em `subscriptions` (gravada na transição para `past_due`; limpa ao sair de `past_due`);
- **BillingEngine**: nova ação **`suspend`** (grace expirado) — o parâmetro `_graceDays` morto passa a ser usado; **reativação** NÃO é ação de ciclo (via `markPaid`/RPC);
- corrigir **`apply_subscription_transition`**: map explícito inclui `suspended`, **`ELSE → RAISE`** (fail-fast, fim do `ELSE → active`);
- **`get_due_subscriptions`**: retorna `grace_ends_at` e passa a incluir candidatas à suspensão;
- **`TenantLifecycleService`** (`domain/tenant/`) como **writer único lógico de `tenants.status`** (ADR-013 §3.1) — valida transições (matriz ADR-013 §5.2) e orquestra a aplicação;
- ativar eventos **`TenantSubscriptionSuspended`**/**`TenantSubscriptionReactivated`** (já tipados);
- **RPCs `suspend_subscription`/`reactivate_subscription`** (ação manual do superadmin — D-6.0.5-4);
- **`markPaid`**: tratar `suspended` → reativa para `active` (publica `Reactivated`).

**Fora do escopo (D-6.0.5.3-2 / ADR-013):** upgrade/downgrade via engine (`change_tenant_plan` + `TenantSubscriptionUpdated` + `Admin.tsx:856`) → **6.0.5.5**; preços/gateway/dunning (comercial do PO); TTL/exclusão automática (F5 — proibido); banner de estado na UI (6.0.5.5).

**Frontend:** **sem mudanças obrigatórias** — o Estado Efetivo (6.0.5.1) já derruba o acesso para `suspended` (nível `none`), e a camada de flags (6.0.5.3) já derruba flags para `suspended`/`archived`. A 6.0.5.4 garante que o estado `suspended` chegue corretamente ao `tenants.status`. E2E de ciclo (flow14) valida o fluxo ponta a ponta.

---

## 1. Auditoria documental

| Fonte | O que diz sobre 6.0.5.4 | Consistência |
|-------|--------------------------|--------------|
| `PHASE_6_0_5_ENTRY_AUDIT.md` §8 (linha 350) | Escopo congelado: CHECK + `suspended`; coluna `grace_ends_at`; engine `suspend`/`reactivate`; corrigir `apply_subscription_transition` (map explícito, fail-fast, sem `ELSE→active`); `get_due_subscriptions` inclui candidatas à suspensão; ativar `TenantSubscriptionSuspended`/`Reactivated`; RPCs `suspend_subscription`/`reactivate_subscription`; flag override Suspensas | ✅ Alinhado ao `ROADMAP.md` (6.0.5.4 TenantLifecycleService + `suspended` aditivo) |
| ADR-013 §2.3 | Estado efetivo combina Subscription + Tenant + Feature; `suspended` → `none` (bloqueado) | ✅ Consistente |
| ADR-013 §3.1 | **Single Writer**: Transition Executor é a única fronteira de mutação de estado; na 6.0.5 ganha suporte a `suspended`/`archived` e RPCs de suspensão/reativação/upgrade | ✅ 6.0.5.4 = divisão de responsabilidade do executor (TenantLifecycleService) |
| ADR-013 §4.3 | `grace` **não é status** — janela temporal derivada de datas | ✅ `grace_ends_at` como coluna de janela, não status |
| ADR-013 §5 | Máquina congelada: `suspended → active` (reativação) e `suspended → cancelled` (retenção manual, D-6.0.5-4); **não existe `cancelled → active`** | ✅ Consistente |
| `LIFECYCLE_MODEL.md` §3.3/§3.5 | `past_due → suspended` (grace expirado, engine `runCycle` **[6.0.5.4]**); `suspended → active` (`markPaid`/`reactivate` **[6.0.5.4]**); nota: CHECK aditivo na 6.0.5.4 | ✅ Consistente |
| `LIFECYCLE_MODEL.md` §4.1 | Interface `TenantLifecycleService` (`completeOnboarding`/`transitionTo`/`getValidTransitions`/`canAccess`) + `VALID_TRANSITIONS` com `suspended: ['active','cancelled']` | ✅ Consistente — API de referência para §2.5 |
| `SUBSCRIPTION_MODEL.md` | `suspended` marcado "NOVO na 6.0.5.4 (CHECK do schema adicionado na fase)"; transições + evento `TenantSubscriptionSuspended` **[6.0.5]**; `grace_ends_at` (coluna 6.0.5.4) = fim do período + 5d | ✅ Consistente |
| `TENANT_LIFECYCLE.md` | `suspended` = "Nenhum" (D-6.0.5-2); transições `past_due→suspended` (engine) e `suspended→active` (markPaid/manager) **[6.0.5]** | ✅ Consistente |
| `BUSINESS_DECISIONS.md` | D-6.0.5-1/2/4/7/8 (resumo em §0) | ✅ Consistente |
| `ROADMAP.md` (item 6.0.5.4) | "TenantLifecycleService + `suspended` aditivo" | ✅ Consistente |

**Conclusão documental:** todos os documentos de arquitetura convergem para o mesmo modelo (suspensão = estado de contrato real; grace = janela; reativação = `suspended → active`). **Nenhuma divergência documental bloqueante.** A doc viva já marca `[6.0.5.4]` nos pontos de implementação — resta implementar.

---

## 2. Auditoria arquitetural

### 2.1 Estado atual (fatos verificados em 2026-08-07)

| # | Componente | Estado verificado |
|---|------------|-------------------|
| F1 | `subscriptions.status` CHECK (`20260806020000:52`) | `status IN ('trialing','active','past_due','cancelled')` — **sem `suspended`**, sem `archived`; CHECK, não enum PG |
| F2 | `tenants.status` enum `tenant_status` (`20260728000000:22`) | 7 labels: `draft/trial/active/past_due/suspended/cancelled/archived` — `suspended` já existe |
| F3 | `apply_subscription_transition` (`20260806080000`) | `v_tenant_status public.tenant_status`; CASE `trialing→trial`, `active→active`, `past_due→past_due`, `cancelled→cancelled`, **`ELSE→'active'`** (linha ~78) — **bug latente confirmado** (map incompleto + fallback perigoso) |
| F4 | `BillingEngine.processSubscription` (`domain/billing/billingEngine.ts`) | 4 ações + `none`; `past_due` → `{type:'none'}` (linhas 108-110); **sem** case `suspended` (cai em `default → none`); `_graceDays` é parâmetro **morto** (linha 55) |
| F5 | `domain/billing/types.ts` | `SubscriptionStatus = 'trialing'\|'active'\|'past_due'\|'cancelled'` (linha 22); `GRACE_PERIOD_DAYS=5`; `BillingSubscription` **sem** `graceEndsAt`; `BillingAction` **sem** `suspend` |
| F6 | Eventos (`domain/events/types.ts:309-325`) | `TenantSubscriptionSuspendedEvent` e `TenantSubscriptionReactivatedEvent` **já existem** (aggregateType `tenant_subscription`, payload `{subscriptionId, tenantId}`) — hoje **mortos** |
| F7 | `domain/tenant/` | `types.ts` (TenantStatus 7 estados), `repository.ts` (`getById`/`getBySlug`/`existsBySlug` — **sem `updateStatus`**), `tenantPlan.test.ts`. **Sem TenantLifecycleService** |
| F8 | `application/billing.ts` `markPaid` | Resolve `past_due → active` via `applyTransition({status:'active'})` + publica `TenantSubscriptionUpdated` (linhas 168-192); **não trata `suspended`** |
| F9 | `get_due_subscriptions` (`20260806050000:494`) | STABLE SECURITY DEFINER; `status <> 'cancelled'` e (`trial_ends_at`/`current_period_end`/`cancel_at_period_end` ≤ `asOf`); **não retorna `grace_ends_at`**; grants ADR-012 (authenticated) |
| F10 | `BillingService.runCycle(asOf)` | Varre due subscriptions → engine decide → RPC `apply_subscription_transition` → publica eventos. Sem cron/retry/chamador (D-6.0.5-8) |
| F11 | Feature Flags 6.0.5.3 (`tenant_has_feature`) | Já derruba flags para tenant `suspended`/`archived` (override Suspensas) — **suspensão real só depende do estado chegar certo em `tenants.status`** |
| F12 | Estado Efetivo 6.0.5.1 | `suspended → none` (bloqueado) já mapeado e testado por matriz |

### 2.2 Modelo alvo proposto (aditivo, sem quebra)

| Camada | Mudança proposta | Contrato preservado |
|--------|------------------|---------------------|
| **Migration `20260807010000_phase_6_0_5_4_tenant_lifecycle.sql`** *(proposta)* | ① `ALTER TABLE subscriptions DROP CONSTRAINT subscriptions_status_check` + novo CHECK com `('trialing','active','past_due','suspended','cancelled')` (aditivo — D-6.0.5-2; **sem `archived`** — D-6.0.5-7); ② `ADD COLUMN IF NOT EXISTS grace_ends_at timestamptz NULL`; ③ `apply_subscription_transition` reescrita (parâmetro `p_grace_ends_at`; CASE explícito incl. `WHEN 'suspended' THEN 'suspended'`; **`ELSE RAISE EXCEPTION`** — fail-fast); ④ `get_due_subscriptions` devolve `grace_ends_at` e inclui `status='past_due' AND grace_ends_at <= p_as_of` nas candidatas; ⑤ RPCs **`suspend_subscription(uuid)`** / **`reactivate_subscription(uuid)`** (SECURITY DEFINER, superadmin, grants ADR-012) | Assinaturas das RPCs existentes preservadas (`p_grace_ends_at` com DEFAULT); aditivo + correção de bug latente (já sinalizado no ADR-013 §4.6) |
| **`domain/billing/types.ts`** | `SubscriptionStatus += 'suspended'`; `BillingSubscription += graceEndsAt: string \| null`; `BillingAction += { type: 'suspend' }` | Tipos consumidos preservados (aditivo) |
| **`domain/billing/billingEngine.ts`** | case `past_due`: grace expirado (`graceEndsAt ≤ asOf`, fallback determinístico `currentPeriodEnd + graceDays`) → `{type:'suspend'}`, senão `none`; case `suspended` → `none` (reativação não é ação de ciclo); `_graceDays` deixa de ser morto | Função pura e determinística mantida; `runCycle(asOf)` intacto |
| **`domain/tenant/tenantLifecycleService.ts`** *(NOVO)* | Writer único lógico de `tenants.status` (ADR-013 §3.1): `transitionTo(tenantId, to, reason)` valida contra `VALID_TRANSITIONS` e aplica; `getValidTransitions(status)`; `canAccess(status)`. Depende de `TenantRepository.updateStatus` | Interface já especificada em `LIFECYCLE_MODEL.md §4` (API congelada §2.5) |
| **`domain/tenant/repository.ts`** | + `updateStatus(tenantId, status)` | Métodos existentes preservados |
| **`application/billing.ts` `markPaid`** | Resolver **`suspended → active`** além de `past_due → active`; publicar `TenantSubscriptionReactivated` quando origem `suspended` (e `TenantSubscriptionUpdated` para `past_due`, como hoje) | Comportamento atual preservado para `past_due` |
| **`application/billing.ts` `runCycle`** | Ação `suspend` do engine → `applyTransition({subscriptionId, status:'suspended', graceEndsAt:null})` + publicar `TenantSubscriptionSuspended` | Fluxo determinístico preservado |
| **Eventos** | `TenantSubscriptionSuspended`/`Reactivated` passam de mortos → publicados (payloads já tipados, sem mudança) | Catálogo D2 intacto |
| **Frontend** | **Nenhuma mudança obrigatória** (Estado Efetivo + flags já cobrem `suspended`) | — |

### 2.3 Por que o `TenantLifecycleService` (Single Writer — ADR-013 §3.1)

Hoje a RPC `apply_subscription_transition` é o **Transition Executor** e escreve `tenants.status` por espelhamento direto. Com `suspended` no jogo, o espelho vira **ponto único de corrupção** se ficar solto (o `ELSE → active` é a prova). A 6.0.5.4 divide a responsabilidade:

- **`apply_subscription_transition`** vira a **persistência fina** (map explícito e completo, fail-fast, sem regra de negócio);
- **`TenantLifecycleService`** (TS, `domain/tenant/`) é o **writer único lógico**: valida a transição (matriz congelada ADR-013 §5.2), aplica via repositório/RPC e publica os eventos de lifecycle. Nenhum outro componente escreve `tenants.status` (guard a reforçar na implementação);
- RPCs manuais (`suspend_subscription`/`reactivate_subscription`) são ações administrativas do superadmin (D-6.0.5-4) que **delegam** à mesma lógica validada — nunca transições livres.

Isso respeita o invariante do ADR-013: "nenhum componente escreve diretamente no estado de outro contexto, exceto o Transition Executor".

### 2.4 Escopo delimitado da subfase (D-6.0.5.4-1..n — a registrar)

| Código (proposto) | Delimitação |
|-------------------|-------------|
| **D-6.0.5.4-1** | Escopo: **máquina de suspensão/reativação do contrato** (CHECK aditivo, `grace_ends_at`, engine `suspend`, `apply_subscription_transition` fail-fast, `get_due_subscriptions`, `TenantLifecycleService`, RPCs manuais, eventos, `markPaid`). **Fora:** upgrade/downgrade (`change_tenant_plan`, `TenantSubscriptionUpdated`, `Admin.tsx:856` → 6.0.5.5); banner de estado (6.0.5.5); gateway/preços/dunning (PO) |
| **D-6.0.5.4-2** | Reativação de `suspended` = `markPaid` (pagamento confirmado) **ou** RPC manual `reactivate_subscription` (superadmin/manager). **Nunca** via `runCycle` (ciclo não reativa) |
| **D-6.0.5.4-3** | `archived` **não** entra no CHECK (D-6.0.5-7). Transição `suspended/cancelled → archived` permanece exclusiva de `tenants.status` (ação administrativa) |
| **D-6.0.5.4-4** | Fail-fast: qualquer status desconhecido em `apply_subscription_transition` → `RAISE EXCEPTION` (nunca fallback silencioso) |
| **D-6.0.5.4-5** | `grace_ends_at` persistido na transição para `past_due` (engine grava `current_period_end + GRACE_PERIOD_DAYS`) e limpo ao sair de `past_due`/`suspended` |

> Confirmação explícita do PO necessária no fechamento desta entry audit (registro em `BUSINESS_DECISIONS.md`).

### 2.5 API pública congelada — `TenantLifecycleService` (pré-implementação)

```typescript
/** [SMG][DOMAIN][TENANT] tenantLifecycleService — writer único de tenants.status (ADR-013 §3.1) */
export interface TenantLifecycleService {
  /** Valida contra a matriz congelada (ADR-013 §5.2) e aplica a transição de tenant. */
  transitionTo(tenantId: string, to: TenantStatus, reason: string): Promise<void>;
  /** Transições válidas a partir de um status (matriz congelada). */
  getValidTransitions(status: TenantStatus): TenantStatus[];
  /** Nível de acesso esperado para o status (espelho do Estado Efetivo — D-6.0.5-1/2). */
  canAccess(status: TenantStatus): boolean;
}

// VALID_TRANSITIONS (congelado em LIFECYCLE_MODEL.md §4.1 / ADR-013 §5.2):
//   draft: ['trial','cancelled'] · trial: ['active','past_due','cancelled']
//   active: ['past_due','cancelled'] · past_due: ['active','suspended','cancelled']
//   suspended: ['active','cancelled'] · cancelled: ['archived'] · archived: []
```

**Regra de ouro:** fora desta API, nenhum componente (frontend, `application/*`, RPC) escreve `tenants.status` diretamente — a única exceção é a RPC fina `apply_subscription_transition`, exclusivamente como persistência delegada.

### 2.6 Legado / Depreciação

| Item | Destino |
|------|---------|
| `GRACE_PERIOD_DAYS` como constante **morta** (nunca lida no runtime) | Passa a ser usada pelo engine (fallback determinístico de `graceEndsAt`) |
| `_graceDays` parâmetro morto do `processSubscription` | Ativado (calcula/valida `graceEndsAt`) |
| `ELSE → 'active'` em `apply_subscription_transition` | **Removido** → `RAISE EXCEPTION` (fail-fast) |
| `TenantSubscriptionSuspended` / `TenantSubscriptionReactivated` (mortos no catálogo) | **Ativados** (publicados por `runCycle`/`markPaid`/RPCs manuais) |
| `subscriptions.status` sem `suspended` | CHECK aditivo (migration 6.0.5.4) |
| `tenants.status` espelho "cego" | Continua espelho, mas **derivado por map explícito completo** + validação do service |

---

## 3. Auditoria de nomenclatura

| Termo | Regra (TAXONOMY / ADR-013) | Uso proposto |
|-------|----------------------------|--------------|
| `suspended` | Estado de contrato e de tenant (1:1 mapeado) | Mesmo literal nos dois domínios; enum `tenant_status` já o possui; CHECK de `subscriptions` ganha o mesmo literal |
| `grace_ends_at` | `grace` = janela temporal, **nunca** status (ADR-013 §4.3) | Coluna `timestamptz` em `subscriptions`; nome consistente com o modelo (`grace_ends_at`, `trial_ends_at`, `current_period_end`) |
| `TenantSubscriptionSuspended` / `TenantSubscriptionReactivated` | Catálogo D2 (já tipado) | Mantidos; payload `{subscriptionId, tenantId}` intacto |
| `suspend_subscription` / `reactivate_subscription` | Padrão RPC `snake_case` + sufixo `_subscription` (par com `cancel_subscription`) | Aditivo ao conjunto de RPCs de billing |
| `transitionTo` / `getValidTransitions` / `canAccess` | Interface já especificada em `LIFECYCLE_MODEL.md §4` | Mantidos na API do `TenantLifecycleService` |
| `grace_period_expired` | Gatilho documental (LIFECYCLE_MODEL §3.3) | Implementado como **condição no engine** (`asOf ≥ graceEndsAt`), não como evento/flag separada |

**Conclusão:** sem duplicação de nomenclatura; os termos já estão congelados nos documentos e no schema existente (`tenants.status`).

---

## 4. Auditoria de consistência

| Ponto | Verificação |
|-------|-------------|
| Mapeamento 1:1 `subscriptions.status ↔ tenants.status` | Após 6.0.5.4: `trialing→trial`, `active→active`, `past_due→past_due`, `suspended→suspended`, `cancelled→cancelled`; **desconhecido → erro**. `archived`/`draft` permanecem exclusivos de tenant (D-6.0.5-7) |
| Estado Efetivo (6.0.5.1) × novo estado | `suspended → none` já mapeado (F12) — a 6.0.5.4 não altera a camada de autorização; só garante que o estado chegue correto |
| Feature Flags (6.0.5.3) × suspensão | `tenant_has_feature` já derruba flags para `suspended`/`archived` (F11) — a 6.0.5.4 fecha o fluxo de origem (o estado agora **consegue** ser gravado corretamente) |
| Eventos × catálogo D2 | Publicação de `TenantSubscriptionSuspended`/`Reactivated` sem criar eventos novos (types já existem) |
| Grants ADR-012 | Novas RPCs (`suspend_subscription`/`reactivate_subscription`) seguem `REVOKE PUBLIC` + `GRANT authenticated` (e restrição superadmin dentro da função) |
| `markPaid` | Reativação `suspended → active` com o mesmo padrão já usado para `past_due` (idempotência por invoice/attempt) |
| `runCycle` | Suspensão determinística (`asOf` injetável); D-6.0.5-8 (Edge Function só agenda) preservado |

---

## 5. Divergências encontradas

| # | Divergência | Severidade | Tratamento |
|---|-------------|-----------|------------|
| DIV-1 | `apply_subscription_transition` mapeia desconhecido para `ELSE → active` e não tem branch `suspended` (C3 da 6.0.5) | **Crítica** (corrompe tenant suspenso para `active` — risco de invasão de acesso) | Corrigida na 6.0.5.4 (fail-fast, §2.2) |
| DIV-2 | `subscriptions.status` CHECK não aceita `suspended` (C2 da 6.0.5) | **Alta** (núcleo da máquina sem suporte de schema) | CHECK aditivo na migration 6.0.5.4 |
| DIV-3 | `grace_ends_at` não existe no schema (só constante morta `GRACE_PERIOD_DAYS`) | Média | Coluna adicionada na migration; engine passa a usar o parâmetro morto |
| DIV-4 | `get_due_subscriptions` não retorna `grace_ends_at` nem filtra grace expirado | Média | RPC ampliada (retorno + condição), assinatura com parâmetro novo com DEFAULT |
| DIV-5 | RPCs manuais de transição (`suspend_subscription`/`reactivate_subscription`) estão no escopo congelado (6.0.5, linha 350) mas **ainda não existem** | Média | Criadas na migration 6.0.5.4; `change_tenant_plan`/upgrade permanecem em 6.0.5.5 (D-6.0.5.3-2) |
| DIV-6 | `markPaid` só resolve `past_due`, não `suspended` | Média | Estendido na 6.0.5.4 (§2.2) |

---

## 6. Escopo proposto (aprovado com ajustes — D-6.0.5.4-1..5)

**Entrega da 6.0.5.4:**
1. Migration `20260807010000_phase_6_0_5_4_tenant_lifecycle.sql`: CHECK aditivo `suspended`; coluna `grace_ends_at`; `apply_subscription_transition` reescrita (map explícito + `ELSE RAISE` + `p_grace_ends_at`); `get_due_subscriptions` ampliada; RPCs `suspend_subscription`/`reactivate_subscription` (superadmin, grants ADR-012);
2. `domain/billing/types.ts`: `'suspended'` + `graceEndsAt` + ação `suspend`;
3. `domain/billing/billingEngine.ts`: ação `suspend` (grace expirado) + case `suspended` → `none`; `_graceDays` ativado;
4. `domain/tenant/tenantLifecycleService.ts` + `repository.updateStatus`: writer único de `tenants.status`;
5. `application/billing.ts`: `runCycle` aplica `suspend` e publica `TenantSubscriptionSuspended`; `markPaid` reativa `suspended → active` e publica `TenantSubscriptionReactivated`;
6. Testes unitários (engine, service, markPaid, types) + E2E **flow14** (`past_due → suspended → active`);
7. Atualização de docs (ROADMAP/PROJECT_STATUS/ADRs/audits/changelog) + RELEASE_CHECKLIST_v1.5.md marcada.

**Fora (adiado 6.0.5.5):** `change_tenant_plan`, `TenantSubscriptionUpdated` no upgrade, correção `Admin.tsx:856`, banner de estado, dunning/cron.

---

## 7. Critérios de teste

**Unitários (esperado ≥ 847 + novos):**
- Engine: `past_due` grace não expirado → `none`; grace expirado (`asOf ≥ graceEndsAt`) → `suspend`; `suspended` → `none`; fallback determinístico sem `graceEndsAt` (`currentPeriodEnd + 5d`); determinismo de `runCycle(asOf)`;
- Service: `getValidTransitions`/`canAccess` por matriz completa (7 estados); `transitionTo` aceita transições válidas e rejeita inválidas (e.g. `cancelled → active`, `active → trial`);
- `markPaid`: `suspended → active` publica `TenantSubscriptionReactivated`; `past_due → active` mantém `TenantSubscriptionUpdated`;
- Eventos: payloads `{subscriptionId, tenantId}` sem quebra de contrato.

**Migration (validação Postgres 16 docker, aplica 2×):**
- T1: CHECK aditivo aceita `suspended` e rejeita `archived`/`expired`;
- T2: `grace_ends_at` gravada na transição para `past_due` e limpa ao sair;
- T3: `apply_subscription_transition('suspended')` grava `tenants.status='suspended'` (map correto);
- T4: status desconhecido → `RAISE EXCEPTION` (fail-fast, sem `ELSE→active`);
- T5: `get_due_subscriptions` retorna `grace_ends_at` e inclui candidatas com grace expirado;
- T6: `suspend_subscription`/`reactivate_subscription` só para superadmin (negativo para authenticated comum); grants ADR-012 presentes;
- T7: migração **idempotente** (aplica 2× sem erro).

**E2E (Supabase real):**
- **flow14** `@smoke`: ciclo `past_due → suspended` (grace expirado via `asOf`/RPC) → acesso bloqueado (`none`) → `reactivate`/`markPaid` → `active` + acesso restaurado; flags "Suspensas" durante o período suspenso.

---

## 8. Critérios de saída (certificação — atualizados pelo PO)

- [ ] Aprovação explícita do PO da entry audit (D-6.0.5.4-1..5 registradas em `BUSINESS_DECISIONS.md`)
- [ ] Migration validada em Postgres 16 docker (T1–T7, idempotência 2×)
- [ ] Suíte unitária verde (≥ 847 + novos) · typecheck sem novos erros (baseline 125) · build OK · `architecture:ci` verde
- [ ] **E2E flow14 PASS** (Supabase real) + smoke 10/10 regressivo
- [ ] `TenantLifecycleService` = único writer de `tenants.status` (guard reforçado; grep sem escrita fora)
- [ ] Eventos `TenantSubscriptionSuspended`/`Reactivated` publicados (não mais mortos)
- [ ] Docs atualizadas: ROADMAP (Status + item 6.0.5.4 + changelog), PROJECT_STATUS, ADR-013 (§3.1/§4.6 marcados), RELEASE_CHECKLIST_v1.5.md, runbook (migration da 6.0.5.4 incluída na janela)
- [ ] Commit semântico + push da branch (sem merge — merge só no fechamento da fase)
- [ ] Migration da 6.0.5.4 agendada na **janela única** de deploy (D-6.0.5.3-3 + PO 2026-08-07)

---

## 9. Riscos

| Risco | Prob./Impacto | Mitigação |
|-------|---------------|-----------|
| R1 — Reativação errônea de `cancelled` (fora da máquina congelada) | Média/Alta | `VALID_TRANSITIONS` rejeita `cancelled → active`; `markPaid` só reativa `past_due`/`suspended`, nunca `cancelled` |
| R2 — Regressão no `apply_subscription_transition` (RPC certificada) | Média/Alta | Mudança aditiva (parâmetro com DEFAULT) + map completo; validação T3/T4; contratos de grants intocados |
| R3 — Suspensão automática bloqueando tenant de forma incorreta (falso positivo) | Média/Alta | `grace_ends_at` explícito (nunca implícito); fallback determinístico; E2E flow14 valida ciclo real |
| R4 — Escrita dupla em `tenants.status` (service × RPC) | Média/Média | ADR-013 §3.1: RPC vira persistência delegada; guard "escrita de tenant fora do service/RPC proibida" |
| R5 — Janela única de deploy acumula 4+ migrations | Baixa/Média | Runbook atualizado com ordem e verificações; smoke pós-deploy obrigatório |
| R6 — `grace_ends_at` NULL em linhas `past_due` legadas (dado pré-existente) | Baixa/Média | Backfill na migration (linhas `past_due` → `current_period_end + 5d`); engine com fallback determinístico |

---

## 10. Relatório final (para aprovação do PO)

A **6.0.5.4** é a peça que fecha o **ciclo determinístico `past_due → suspended → active/cancelled`** previsto no ADR-013 e congelado na `PHASE_6_0_5_ENTRY_AUDIT.md` (linha 350). Corrige dois defeitos latentes conhecidos (CHECK sem `suspended` e `ELSE → active`) e ativa os eventos já tipados, com o `TenantLifecycleService` assumindo o papel de **writer único de `tenants.status`** (ADR-013 §3.1). Documentação 100% alinhada (sem divergências bloqueantes); frontend sem mudanças obrigatórias (Estado Efetivo + flags já cobrem `suspended`).

**Pendências antes de implementar:**
1. Aprovação desta entry audit pelo PO (com confirmação de D-6.0.5.4-1..5);
2. Confirmação de que as RPCs manuais (`suspend_subscription`/`reactivate_subscription`) permanecem na 6.0.5.4 (escopo congelado) e o upgrade (`change_tenant_plan`) segue na 6.0.5.5 (D-6.0.5.3-2);
3. Após a implementação: atualizar o runbook para incluir a migration 6.0.5.4 na janela única.
