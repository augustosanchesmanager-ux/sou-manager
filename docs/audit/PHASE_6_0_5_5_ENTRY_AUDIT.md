# PHASE 6.0.5.5 — ENTRY AUDIT (Transições RPCs: `change_tenant_plan` + banner + UpgradePrompt + correção `Admin.tsx`)

> **Data:** 2026-08-07
> **Autorização:** Auditoria de entrada solicitada pelo PO (2026-08-07) antes de qualquer código (Regra de Entrada). O PO aprovou iniciar a entry audit **imediatamente** e determinou a inclusão do gate **"Schema Freeze Candidate"** (§3) — obrigatório antes do início da implementação.
> **Modo:** Somente documentação — **nenhum arquivo de código (`.ts`/`.tsx`/`.sql`) ou migration alterado; nenhum teste executado; commit restrito a documentação.**
> **Baseline de referência:** 6.0.5.4 implementada (commit `5454c81`, unit 874/874, migration `20260807010000` validada T1–T7; E2E flow14 adiado à janela única — decisão PO 2026-08-07)
> **Branch:** `feature/phase-6.0.4-billing`
> **Fonte de autoridade:** ADR-013 §3.1/§4.7 + `PHASE_6_0_5_ENTRY_AUDIT.md` (linha 351 — escopo 6.0.5.5; M7/M11/M12) + `PHASE_6_0_5_3_ENTRY_AUDIT.md` (D-6.0.5.3-2 realocação; depreciação `featureAvailability.ts`) + `RELEASE_CHECKLIST_v1.5.md` (item 6.0.5.5) + `BUSINESS_DECISIONS.md` (D-6.0.5-1..8, D-6.0.5.3-2, D-6.0.5.4-1..5) + `ROADMAP.md` (item 6.0.5.5).

---

## STATUS: ✅ APROVADA PELO PO (2026-08-07) — IMPLEMENTAÇÃO AUTORIZADA

> **Aprovação do PO (2026-08-07):** escopo D-6.0.5.5-1..5 **aprovado sem ajustes**. **D-6.0.5.5-4** (hardening M7/M11/M12 + E2E flow11) = **ADIADO para o backlog pós-v1.5** (default da entry audit, confirmado pelo PO). Implementação autorizada na sequência `migration → application (changePlan) → RPCs → Admin.tsx → UI (UpgradePrompt + StatusBanner) → depreciação featureAvailability → testes → docs`. Registro oficial: `docs/BUSINESS_DECISIONS.md` (D-6.0.5.5-1..5).
>
> **Gate "Schema Freeze Candidate" (§3) aprovado pelo PO** — veredito preliminar **`SCHEMA FREEZE = NO`** (somente a RPC `change_tenant_plan`); reexecução obrigatória no fechamento com o diff real → **`SCHEMA FREEZE = YES`** antes da PCA (6.0.5.6).

---

## 0. Decisões do PO aplicáveis

| Código | Decisão |
|--------|---------|
| **PO 2026-08-07** | Iniciar a **Entry Audit da 6.0.5.5** imediatamente, antes de qualquer código |
| **PO 2026-08-07** | Incluir o gate **"Schema Freeze Candidate"** na entry audit — responder as 7 perguntas de schema e registrar **YES** ou **NO (listar o que ainda mudará)** |
| **D-6.0.5.3-2** | `change_tenant_plan` + `TenantSubscriptionUpdated` (no path de upgrade) + correção `Admin.tsx:856` **realocados para 6.0.5.5** |
| **D-6.0.5.3-5** | UI híbrida com `FeatureUnavailablePage` reutilizável; `UpgradePrompt` como fallback do `FeatureGuard` |
| **D-6.0.5.3-6** | Leitura de flags **somente via RPC** `tenant_has_feature` |
| **D-6.0.5.4-2/3/4** | Reativação `suspended → active` (markPaid/RPC); `archived` exclusivo de tenant; fail-fast sem fallback silencioso |
| **ADR-013 §3.1** | **Single Writer**: nenhum componente escreve `tenants.plan`/`tenants.status` diretamente, exceto o Transition Executor/Service |

> Registro oficial das decisões específicas da 6.0.5.5 (D-6.0.5.5-1..5, §2.3) será feito em `docs/BUSINESS_DECISIONS.md` **após confirmação do PO** no fechamento desta entry audit.

---

## Resumo executivo

A **6.0.5.5** é a **camada de operação** da série: fecha o ciclo funcional de Billing/Lifecycle entregando a **mudança de plano (upgrade/downgrade)** como operação oficial. Hoje **não existe** `change_tenant_plan` (nenhuma RPC), o `pages/Admin.tsx:856` escreve `tenants.plan` **diretamente** (dual source of truth — DIV do audit 6.0.5) e não há `UpgradePrompt` nem banner de estado. A 6.0.5.5:

- cria a **RPC `change_tenant_plan`** (upgrade/downgrade transacional) que grava `subscriptions.plan` **e espelha `tenants.plan`** (fim da dual source of truth — ADR-013 §3.1);
- adiciona a orquestração **`changePlan`** em `application/tenantLifecycle.ts` (mesmo padrão `startTrial`/`activate`/`cancel`) com evento **`TenantSubscriptionUpdated`** no path de plano;
- **corrige `Admin.tsx:856`** — troca o `update` direto pela chamada ao service/RPC;
- entrega **`UpgradePrompt`** (fallback do `FeatureGuard` — D-6.0.5.3-5) e **banner de estado** (consciência de `trial/past_due/suspended/cancelled` na UI);
- **deprecia a matriz estática** `featureAvailability.ts` (fora do runtime — `FEATURE_FLAGS_MODEL.md`/entry audit 6.0.5.3);
- **reexecuta o gate "Schema Freeze Candidate"** (§3) no fechamento → **SCHEMA FREEZE = YES** antes da PCA.

**Fora do escopo:** preços/gateway/dunning (comercial do PO); alterações no Billing Engine; novas RPCs de billing além de `change_tenant_plan`; execução do E2E flow14 (permanece na janela única de deploy).

---

## 1. Auditoria documental

| Fonte | O que diz sobre 6.0.5.5 | Consistência |
|-------|--------------------------|--------------|
| `RELEASE_CHECKLIST_v1.5.md` (item 6.0.5.5) | "Transições RPCs (`change_tenant_plan`, `TenantSubscriptionUpdated`, correção `Admin.tsx:856`, banner estado)" + migration planejada `20260807020000_phase_6_0_5_5_transitions.sql` | ✅ Alinhado |
| `PHASE_6_0_5_ENTRY_AUDIT.md:351` | "6.0.5.5 — Transições RPCs + E2E + Hardening": flow11 (grace→suspensão) + reativação; regressão flow9/10/12; corrigir M7/M11/M12; baseline `v1.5.0-feature-flags-6.0.5` | ⚠️ E2E/hardening: escopo a confirmar no §2.3 (D-6.0.5.5-4) |
| `PHASE_6_0_5_3_ENTRY_AUDIT.md` | `change_tenant_plan` + `TenantSubscriptionUpdated` + `Admin.tsx:856` → **6.0.5.5** (D-6.0.5.3-2); `<UpgradePrompt/>` no `FeatureGuard` (D-6.0.5.3-5); `featureAvailability.ts` "removida quando 6.0.5.5 encerrar transições" | ✅ Alinhado |
| ADR-013 §3.1 | **Single Writer**: fronteira de mutação única; `Admin.tsx:856` escrevendo `tenants.plan` viola o princípio | ✅ A correção é a aplicação do princípio |
| ADR-013 §4.7 | Transições totais e fail-fast; mapeamento explícito | ✅ `change_tenant_plan` segue o mesmo padrão |
| `ROADMAP.md` (item 6.0.5.5) | "transições RPCs" | ✅ Alinhado |
| `docs/FEATURE_FLAGS_MODEL.md` | modelo alvo com `FeatureGuard`/`UpgradePrompt`; matriz estática fora do runtime | ✅ §2.2/§4 |

**Conclusão documental:** escopo coerente entre todos os documentos. A divergência latente (M7/M11/M12 + E2E na mesma subfase) está sinalizada como **opcional/pendente de decisão PO** (§2.3/D-6.0.5.5-4).

---

## 2. Auditoria arquitetural

### 2.1 Estado atual (fatos verificados em 2026-08-07)

| # | Componente | Estado verificado |
|---|------------|-------------------|
| F1 | `pages/Admin.tsx:856` | `supabase.from('tenants').update({ plan: newPlan }).eq('id', shop.tenant_id)` — escreve `tenants.plan` **diretamente**, sem passar pelo Billing/`subscriptions` (DIV da dual source of truth) |
| F2 | `change_tenant_plan` | **Não existe** — nenhuma RPC, nenhuma referência em migrations ou código TS |
| F3 | `application/tenantLifecycle.ts` | Orquestrador de lifecycle (6.0.4.3): `startTrial`/`activate`/`cancel`/`getStatus`; RPCs finas (`start_trial`, `activate_subscription`, `cancel_subscription`, `get_subscription`); eventos centralizados aqui. **Sem `changePlan`** |
| F4 | `application/billing.ts` | `BillingService.runCycle` + `markPaid` (6.0.4.4/6.0.5.4) — não trata mudança de plano |
| F5 | Schema (`20260806020000:30-51`) | `tenants.plan text` CHECK `('free','pro','premium')`; `subscriptions.plan text NOT NULL DEFAULT 'free'` CHECK idem |
| F6 | `apply_subscription_transition` | Espelha `tenants.status` (map explícito fail-fast, 6.0.5.4). **Não** espelha `tenants.plan` |
| F7 | `domain/authorization/featureAvailability.ts` | Matriz estática `PLAN_FEATURES` — ainda no runtime (a deprecar na 6.0.5.5) |
| F8 | 6.0.5.3 (frontend) | `FeatureGuard`/`FeatureUnavailablePage`/`useFeatureFlags` existentes |
| F9 | `UpgradePrompt` | **Não existe** (a criar como fallback do `FeatureGuard` — D-6.0.5.3-5) |
| F10 | Banner de estado | **Não existe** (a criar: `trial/past_due/suspended/cancelled`) |
| F11 | RPCs de billing existentes | `start_trial`, `activate_subscription`, `cancel_subscription`, `get_subscription`, `apply_subscription_transition`, `get_due_subscriptions`, `suspend_subscription`, `reactivate_subscription` — grants ADR-012 (REVOKE PUBLIC + GRANT authenticated + SECURITY DEFINER + restrição superadmin quando aplicável) |
| F12 | Evento `TenantSubscriptionUpdated` | Já tipado e publicado em `activate`/`cancel` — **falta no path de mudança de plano** |

### 2.2 Modelo alvo proposto (aditivo, sem quebra)

| Camada | Mudança proposta | Contrato preservado |
|--------|------------------|---------------------|
| **Migration `20260807020000_phase_6_0_5_5_transitions.sql`** *(planejada)* | Nova RPC **`change_tenant_plan(p_subscription_id uuid, p_plan text)`** (SECURITY DEFINER, superadmin): atualiza `subscriptions.plan` **e espelha `tenants.plan`** no mesmo UPDATE transacional; valida `p_plan` contra o CHECK; grants ADR-012. **Sem novas tabelas/colunas/FKs/policies** | Assinaturas das RPCs existentes **intocadas**; CHECK de `plan` inalterado |
| **`application/tenantLifecycle.ts`** | Novo método **`changePlan(tenantId, plan, reason?)`**: valida plano/tenant → chama RPC `change_tenant_plan` → publica **`TenantSubscriptionUpdated`** (payload existente) | Padrão `startTrial`/`activate`/`cancel` (evento após sucesso transacional) |
| **`pages/Admin.tsx:856`** | Substituir `supabase.from('tenants').update({plan})` por chamada ao service/RPC (`change_tenant_plan`) — **fim da dual source of truth** (ADR-013 §3.1) | UX do seletor de plano mantida |
| **`components/billing/UpgradePrompt.tsx`** *(NOVO)* | Fallback do `FeatureGuard` (D-6.0.5.3-5): explica a feature bloqueada + CTA de upgrade (direciona ao Admin/banner) | Reutilizado pelo `FeatureGuard` |
| **`components/billing/StatusBanner.tsx`** *(NOVO)* | Banner global por `tenants.status`: `trial` (informativo), `past_due` (read-only + aviso — D-6.0.5-1), `suspended` (bloqueado + CTA reativação), `cancelled` (somente leitura — D-6.0.5-2) | Não altera guardas (Estado Efetivo 6.0.5.1 continua autoridade) |
| **`domain/authorization/featureAvailability.ts`** | **Deprecação** — matriz estática sai do runtime (consumo exclusivo do `FeatureFlagService`/RPC `tenant_has_feature`, D-6.0.5.3-6) | `@deprecated` + remoção de importações; testes de compatibilidade mantidos |

### 2.3 Escopo delimitado — D-6.0.5.5-1..5 (propostas a confirmar)

| Código (proposto) | Delimitação |
|-------------------|-------------|
| **D-6.0.5.5-1** | **Gate "Schema Freeze Candidate"** obrigatório (PO 2026-08-07) — §3; reexecutado no fechamento |
| **D-6.0.5.5-2** | Escopo: **transições de plano** (`change_tenant_plan` upgrade/downgrade + `TenantSubscriptionUpdated` + correção `Admin.tsx:856`) + banner de estado + `UpgradePrompt` + depreciação `featureAvailability.ts`. **Fora:** preços/gateway/dunning (PO); Billing Engine; novas RPCs de billing |
| **D-6.0.5.5-3** | `tenants.plan` deixa de ser escrito por UI → **derivado/espelho de `subscriptions.plan`** (single writer, ADR-013 §3.1); UI passa a ler o Estado Efetivo |
| **D-6.0.5.5-4** | Hardening opcionais do audit 6.0.5 (`M7` guard legado `save_onboarding_step`; `M11` trigger drift; `M12` audit triggers em billing) + E2E flow11: **ADIADO para o backlog pós-v1.5 (aprovado pelo PO 2026-08-07 — default confirmado)** |
| **D-6.0.5.5-5** | **Sem novas tabelas, colunas, FKs ou policies** — somente a RPC `change_tenant_plan` (fecha o schema; verifica §3) |

> **Confirmação explícita do PO necessária no fechamento desta entry audit** (registro em `BUSINESS_DECISIONS.md`).

### 2.4 API pública congelada — `changePlan` (pré-implementação)

```typescript
/** [SMG][APPLICATION][TENANT_LIFECYCLE] changePlan — upgrade/downgrade (6.0.5.5) */
export type TenantPlan = 'free' | 'pro' | 'premium';

/** Troca o plano da assinatura do tenant via RPC change_tenant_plan e publica TenantSubscriptionUpdated. */
changePlan(tenantId: string, plan: TenantPlan, reason?: string): Promise<TenantSubscriptionView>;
```

**Regra de ouro:** nenhum componente (frontend, RPC, página) escreve `tenants.plan` diretamente — a **única** fronteira é a RPC `change_tenant_plan` (persistência fina) orquestrada pelo `changePlan` do `application/tenantLifecycle.ts` (evento centralizado).

---

## 3. GATE — SCHEMA FREEZE CANDIDATE (novo — solicitado pelo PO 2026-08-07)

> **Objetivo:** responder com precisão o que a 6.0.5.5 altera no schema, preparando a **PCA (6.0.5.6)** e o critério de entrada da **6.0.6** ("schema congelado"). Respostas verificadas nesta auditoria (pré-implementação).

| # | Pergunta | Resposta (verificada) |
|---|----------|-----------------------|
| Q1 | A 6.0.5.5 introduz **novas tabelas**? | **NÃO** — nenhuma tabela nova planejada (sem log de transições/auditoria, salvo decisão PO D-6.0.5.5-4) |
| Q2 | A 6.0.5.5 introduz **novas colunas**? | **NÃO** — nenhuma coluna nova planejada |
| Q3 | A 6.0.5.5 introduz **novas FKs**? | **NÃO** |
| Q4 | A 6.0.5.5 introduz **novas policies**? | **NÃO** — mudança via RPC; RLS intocado; grants ADR-012 |
| Q5 | A 6.0.5.5 introduz **novas RPCs**? | **SIM** — `change_tenant_plan` (upgrade/downgrade) |
| Q6 | A 6.0.5.5 introduz **novas funções públicas**? | **SIM** — a mesma RPC (nenhuma função auxiliar pública extra) |
| Q7 | A 6.0.5.5 **altera contratos existentes**? | **SIM (semântica, sem schema)** — `tenants.plan` deixa de ser editável via UI e passa a **espelho de `subscriptions.plan`** (single writer); assinaturas de RPCs existentes **intocadas**; CHECK de `plan` inalterado |

### Veredito preliminar

> ### **SCHEMA FREEZE = NO** — o schema ainda mudará em **1 objeto**:
>
> 1. **Nova RPC `change_tenant_plan`** (upgrade/downgrade transacional) — objeto de schema aditivo.
>
> **Nada mais muda:** sem tabelas, colunas, FKs, policies ou alteração de assinaturas de RPCs existentes. A mudança semântica de `tenants.plan` (Q7) é de **comportamento/contrato de escrita**, não de schema.

### Compromisso de fechamento

- Este gate será **reexecutado no fechamento da 6.0.5.5** (mesmas 7 perguntas sobre o diff real da migration).
- **`SCHEMA FREEZE = YES`** será registrado aqui e no `RELEASE_CHECKLIST_v1.5.md` **antes** de liberar a **PCA (6.0.5.6)**.
- Se a 6.0.5.5 resultar em **mais objetos** que o previsto (D-6.0.5.5-4 aprovado com M11/M12), o veredito final listará exatamente o delta antes da PCA.

---

## 4. Auditoria de nomenclatura

| Termo | Regra (TAXONOMY / ADR-013) | Uso proposto |
|-------|----------------------------|--------------|
| `change_tenant_plan` | Padrão RPC `snake_case` + verbo `change_` (par com `suspend_subscription`/`reactivate_subscription`) | Nome da nova RPC de upgrade/downgrade |
| `changePlan` | Padrão camelCase de Application Service (`startTrial`/`activate`/`cancel`) | Método em `application/tenantLifecycle.ts` |
| `UpgradePrompt` | PascalCase de componente (padrão `FeatureUnavailablePage`) | Componente fallback do `FeatureGuard` |
| `StatusBanner` | PascalCase de componente | Banner global de estado do tenant |
| `free/pro/premium` | Planos oficiais (TAXONOMY; `Elite` obsoleto) | Literais mantidos (CHECK inalterado) |

**Conclusão:** sem duplicação; nomes seguem os padrões já congelados.

---

## 5. Auditoria de consistência

| Ponto | Verificação |
|-------|-------------|
| `tenants.plan` × `subscriptions.plan` | **Unificação**: `change_tenant_plan` grava nos dois no mesmo UPDATE transacional → fim da dual source of truth (DIV do audit 6.0.5) |
| Single Writer (ADR-013 §3.1) | `Admin.tsx:856` (escrita direta) **eliminada**; única fronteira = RPC `change_tenant_plan` via `changePlan` |
| Estado Efetivo (6.0.5.1) | Banner é **cosmético/informativo** — a autoridade de acesso continua no Estado Efetivo; banner não derruba/libera acesso |
| Feature Flags (6.0.5.3) | `UpgradePrompt` integra o `FeatureGuard` (D-6.0.5.3-5); leitura de flags só via RPC `tenant_has_feature` (D-6.0.5.3-6) |
| Evento `TenantSubscriptionUpdated` | Payload já tipado; publicado também no path de mudança de plano (não criar evento novo) |
| Grants ADR-012 | Nova RPC segue REVOKE PUBLIC + GRANT authenticated + restrição superadmin dentro da função |
| Matriz estática `featureAvailability.ts` | Deprecada (não deletada nesta subfase) para não quebrar testes de compatibilidade; remoção total posta em decisão do fechamento |

---

## 6. Divergências encontradas

| # | Divergência | Severidade | Tratamento |
|---|-------------|-----------|------------|
| DIV-1 | `Admin.tsx:856` escreve `tenants.plan` direto — dual source of truth (`tenants.plan` × `subscriptions.plan`) | **Alta** | Corrigida na 6.0.5.5 (D-6.0.5.5-3): `change_tenant_plan` + espelho |
| DIV-2 | `change_tenant_plan` não existe (realocada pela D-6.0.5.3-2) | Média | Criada na migration `20260807020000` (planejada) |
| DIV-3 | Matriz estática `featureAvailability.ts` ainda no runtime | Média | Deprecação (fora do runtime) — D-6.0.5.5-2 |
| DIV-4 | `UpgradePrompt` e banner de estado inexistentes | Média | Criados (D-6.0.5.3-5) |
| DIV-5 | `TenantSubscriptionUpdated` não publicado no path de mudança de plano | Média | Publicado pelo `changePlan` (D-6.0.5.5-2) |
| DIV-6 | M7 (guard legado `save_onboarding_step`) / M11 (trigger drift) / M12 (audit triggers) abertos | Baixa/Média | **Opcional** — decisão PO no fechamento (D-6.0.5.5-4) |

---

## 7. Escopo proposto (a confirmar — D-6.0.5.5-1..5)

**Entrega da 6.0.5.5:**
1. Migration `20260807020000_phase_6_0_5_5_transitions.sql`: RPC `change_tenant_plan` (upgrade/downgrade, espelho `tenants.plan`, grants ADR-012) — **único objeto de schema novo**;
2. `application/tenantLifecycle.ts`: método `changePlan` (valida → RPC → publica `TenantSubscriptionUpdated`);
3. `pages/Admin.tsx:856`: remoção da escrita direta de `tenants.plan` → chamada ao service/RPC;
4. `components/billing/UpgradePrompt.tsx` (novo) + integração no `FeatureGuard`;
5. `components/billing/StatusBanner.tsx` (novo) — banner global de estado do tenant (D-6.0.5-1/2);
6. Deprecação de `domain/authorization/featureAvailability.ts` (fora do runtime);
7. Testes unitários (service `changePlan`, RPC, Admin) + migration (validação docker T1–Tn, idempotência 2×);
8. **Gate Schema Freeze reexecutado** (§3) → **SCHEMA FREEZE = YES** registrado;
9. Docs finais (ROADMAP/PROJECT_STATUS/ADRs/audits/changelog/RELEASE_CHECKLIST_v1.5.md).

**Fora (adiado/opcional):** M7/M11/M12 + E2E flow11 (decisão PO D-6.0.5.5-4); execução E2E flow14 (janela única de deploy); preços/gateway/dunning (PO).

---

## 8. Critérios de teste

**Unitários (esperado ≥ 874 + novos):**
- Service `changePlan`: plano válido → RPC chamada + `TenantSubscriptionUpdated` publicado; plano inválido → erro; tenant inexistente → erro; idempotência (mesmo plano = no-op ou erro controlado);
- RPC (validação docker): upgrade `free→pro`, downgrade `pro→free`, `pro→premium`, downgrade `premium→pro`; plano inválido rejeitado; espelho `tenants.plan` gravado no mesmo UPDATE; **negativo para `authenticated` comum (superadmin obrigatório)**; grants ADR-012 presentes;
- Admin.tsx (regressão de contrato): escrita direta removida — nenhuma chamada `from('tenants').update({plan})` remanescente (grep);
- Migration: **idempotente** (aplica 2× sem erro).

**E2E (Supabase real):**
- **flow11** (grace→suspensão) + flow de reativação — **se aprovado pelo PO (D-6.0.5.5-4)**;
- Regressão P0/P1: flow9 (billing), flow10, flow12, flow13 (estado efetivo), smoke 10/10.

---

## 9. Critérios de saída (certificação)

- [ ] Aprovação explícita do PO da entry audit (D-6.0.5.5-1..5 registradas em `BUSINESS_DECISIONS.md`)
- [ ] Migration `20260807020000` validada em Postgres 16 docker (T1–Tn, idempotência 2×)
- [ ] Suíte unitária verde (≥ 874) · typecheck sem novos erros · build OK · `architecture:ci` verde
- [ ] `Admin.tsx:856` corrigida (sem escrita direta de `tenants.plan`; grep sem `tenants.update({plan})`)
- [ ] `changePlan` publica `TenantSubscriptionUpdated` no path de mudança de plano
- [ ] `UpgradePrompt` + banner de estado integrados
- [ ] `featureAvailability.ts` fora do runtime (deprecada)
- [ ] **Gate Schema Freeze reexecutado → `SCHEMA FREEZE = YES`** registrado na §3 e no `RELEASE_CHECKLIST_v1.5.md` (pré-requisito da PCA)
- [ ] Docs atualizadas (ROADMAP + status + changelog, PROJECT_STATUS, RELEASE_CHECKLIST_v1.5.md)
- [ ] Commit semântico + push da branch (sem merge — merge só no fechamento da fase)

---

## 10. Riscos

| Risco | Prob./Impacto | Mitigação |
|-------|---------------|-----------|
| R1 — Regressão de escrita de plano (Admin.tsx) | Média/Alta | Grep de `tenants.update({plan})` + teste de regressão; RPC com espelho transacional |
| R2 — `tenants.plan` divergindo de `subscriptions.plan` em dados legados | Média/Média | Migration com consistência verificada na PCA; `change_tenant_plan` como única via daqui em diante |
| R3 — UpgradePrompt/banner exibindo estado errado | Média/Média | Banner lê o Estado Efetivo (6.0.5.1); nunca derruba acesso por conta própria |
| R4 — Deprecação de `featureAvailability.ts` quebrando imports | Média/Média | Deprecação (não deleção) nesta subfase; testes de compatibilidade mantidos |
| R5 — Escopo de hardening M7/M11/M12 inflando a subfase | Baixa/Média | Decisão explícita do PO (D-6.0.5.5-4) — default: adiar para o backlog |
| R6 — Schema Freeze reavaliado e mostrar objetos extras | Baixa/Média | Gate §3 reexecutado com o diff real antes da PCA; veredito final registrado |

---

## 11. Relatório final (para aprovação do PO)

A **6.0.5.5** fecha o **ciclo funcional de Billing/Lifecycle** com a operação de mudança de plano, eliminando a **dual source of truth** (`tenants.plan` × `subscriptions.plan`) e aplicando o **Single Writer** (ADR-013 §3.1) ao plano do tenant. Entrega também o `UpgradePrompt` e o banner de estado (camada de operação/UX) e **congela o schema** da release v1.5 — a entrada da PCA (6.0.5.6) e da 6.0.6 dependem exatamente desse congelamento.

**Ponto crítico desta entry audit — o gate "Schema Freeze Candidate" (PO 2026-08-07):**
- **Veredito preliminar: `SCHEMA FREEZE = NO`** — o schema ainda mudará em **1 objeto** (nova RPC `change_tenant_plan`).
- No **fechamento** da 6.0.5.5, o gate é **reexecutado** e deve produzir **`SCHEMA FREEZE = YES`**, registrado antes de liberar a PCA.

**Aguardando:** ~~confirmação do PO sobre o escopo (D-6.0.5.5-1..5) e sobre a inclusão/adiamento do hardening M7/M11/M12 + E2E flow11 (D-6.0.5.5-4).~~ → **✅ APROVADO (2026-08-07):** escopo D-6.0.5.5-1..5 aprovado; hardening M7/M11/M12 + E2E flow11 **adiados para o backlog pós-v1.5**. Implementação autorizada.

---

## 12. Fechamento da implementação (2026-08-08)

### 12.1 Entrega real (diff verificado)

| Item | Entregue | Evidência |
|------|----------|-----------|
| Migration `20260807020000_phase_6_0_5_5_transitions.sql` | ✅ RPC `change_tenant_plan(uuid, text, text)` SECURITY DEFINER superadmin + espelho transacional `subscriptions.plan`/`tenants.plan` + `TenantPlanChanged` via `record_billing_event` + grants ADR-012 | Validação docker (abaixo) |
| `application/tenantLifecycle.ts` | ✅ `changePlan(tenantId, plan, reason?)` (valida → RPC → publica `TenantSubscriptionUpdated`); idempotência (mesmo plano = no-op); mapeamento `past_due/suspended` preservado | `tenantLifecycle.test.ts` |
| `pages/Admin.tsx` | ✅ Escrita direta de `tenants.plan` **removida** → `changePlan` | Grep: zero `from('tenants').update({plan})` |
| `components/billing/UpgradePrompt.tsx` | ✅ Novo fallback do `FeatureGuard` (D-6.0.5.3-5) | Integrado + página `FeatureUnavailablePage` |
| `components/billing/StatusBanner.tsx` | ✅ Novo banner global de estado (trial/past_due/suspended/cancelled) | Integrado no `Layout` |
| `domain/authorization/featureAvailability.ts` | ✅ Deprecada (fora do runtime; consumida só por testes de compatibilidade) | `@deprecated` + imports ajustados |
| `domain/billing/planCatalog.ts` | ✅ `getUpgradeTarget`/`isDowngrade` (apoio ao `UpgradePrompt`) | Unit tests |

### 12.2 Validação em Postgres (docker) — migration idempotente + T1–T12

A migration foi validada em **Postgres 16 (docker)** em banco isolado reproduzindo fielmente os pré-requisitos das migrations de dependência (`tenants`/`subscriptions` com CHECK aditivo `suspended` + `grace_ends_at`/`billing_events`/`record_billing_event`/`current_is_super_admin_from_auth_uid`/`auth.uid()` via GUC):

- **Idempotência:** aplicada 2× sem erro (CREATE FUNCTION + REVOKE + GRANT estáveis).
- **T1** grants ADR-012: PUBLIC sem EXECUTE; `authenticated` com EXECUTE.
- **T2–T5** upgrade `free→pro`, downgrade `pro→free`, upgrade `pro→premium`, downgrade `premium→pro` — `subscriptions.plan` **e** espelho `tenants.plan` atualizados no mesmo UPDATE transacional + `billing_events` `TenantPlanChanged` com `previous_plan`/`new_plan`/`reason`.
- **T6** plano inválido (`ultra`) → `Invalid plan`.
- **T7** idempotência: mesmo plano = no-op (sem novo evento, planos inalterados).
- **T8** não-superadmin → `Insufficient permissions`.
- **T9** tenant sem subscription → `No subscription found`.
- **T10** tenant inexistente → `Tenant not found`.
- **T11** sem sessão → `Authentication required`.
- **T12** ordem fail-fast: tenant inexistente é validado antes da permissão.

### 12.3 Gate "Schema Freeze Candidate" — REEXECUÇÃO (fechamento) → **SCHEMA FREEZE = YES**

As mesmas 7 perguntas (§3) reexecutadas sobre o **diff real** da migration:

| # | Pergunta | Resposta (diff real) |
|---|----------|----------------------|
| Q1 | Novas tabelas? | **NÃO** |
| Q2 | Novas colunas? | **NÃO** |
| Q3 | Novas FKs? | **NÃO** |
| Q4 | Novas policies? | **NÃO** |
| Q5 | Novas RPCs? | **SIM** — `change_tenant_plan` (único objeto de schema novo, previsto) |
| Q6 | Novas funções públicas? | **SIM** — a mesma RPC (nenhuma função auxiliar pública extra) |
| Q7 | Contratos existentes alterados? | **NÃO (schema)** — apenas semântica de escrita de `tenants.plan` (espelho), já prevista na Q7 da entrada |

> ### **SCHEMA FREEZE = YES** ✅ (2026-08-08)
>
> Delta real = **exatamente** o previsto (1 RPC). Nenhuma tabela/coluna/FK/policy adicional. Registrado também no `RELEASE_CHECKLIST_v1.5.md`. **Pré-requisito da PCA (6.0.5.6) atendido.**

### 12.4 Suíte

- Unit **883/883** (874 baseline + 9 novos `changePlan`); typecheck **sem novos erros** (baseline 125 preservado); `npm run build` OK.
- **E2E flow11/flow14: NÃO executados** — adiados para a janela única de deploy (D-6.0.5.5-4 / decisão PO). Nenhuma migration aplicada ao remoto.

### 12.5 ⚠️ DESCOBERTA IMPORTANTE — bug latente nas RPCs 6.0.4/6.0.5.4 (fora do escopo desta subfase)

Durante a validação docker, a RPC `change_tenant_plan` falhou no **primeiro** uso com `column reference "id" is ambiguous` — o `RETURNS TABLE(...)` (OUT params `id`, `status`, etc.) conflita com referências de coluna **não qualificadas** (`WHERE id = ...`). Corrigido nesta migration (todas as referências qualificadas com alias). Verificado empiricamente que o erro ocorre tanto em **PG15** quanto em **PG16** (não é específico de versão).

**As RPCs irmãs das migrations `20260806020000`/`20260806050000`/`20260807010000` usam o MESMO padrão** (ex.: `start_trial` linha 261 `WHERE id = p_tenant_id` com OUT `id`; `activate_subscription` linhas 366/388/392; `cancel_subscription`; `apply_subscription_transition`; `mark_invoice_paid`; `get_invoice`; `get_subscription_by_id`; `record_payment_attempt`). **Estas RPCs nunca foram executadas contra um Postgres real** (o banco local não possui nem a tabela `subscriptions`) → **provavelmente falham no primeiro uso em runtime**.

> **Recomendação (fora do escopo 6.0.5.5):** incluir no runbook/janela única um **fix aditivo** qualificando as referências nas RPCs irmãs, ou um teste de execução por RPC antes do deploy. Requer decisão do PO (alteração de migrations certificadas). Impacta a **PCA (6.0.5.6)** e o **runbook de deploy**.

### 12.6 Docs atualizadas

`ROADMAP.md` · `PROJECT_STATUS.md` · `RELEASE_CHECKLIST_v1.5.md` (SCHEMA FREEZE = YES) · `BUSINESS_DECISIONS.md` (confirmação D-6.0.5.5-1..5) · `DEPLOY_RUNBOOK_FASE_6_0_5.md` (migration 5 pendente `20260807020000`) · `PRODUCTION_COMPATIBILITY_AUDIT.md` (inventário de RPCs + veredito do gate). Commit semântico + push da branch (sem merge — merge só no fechamento da fase).
