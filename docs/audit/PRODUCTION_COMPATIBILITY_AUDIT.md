# PRODUCTION COMPATIBILITY AUDIT — Release v1.5

> **Fase:** 6.0.5.6 — Production Compatibility Audit (PCA)
> **Status:** ❌ **BLOCKED** (executada em 2026-08-08 — somente leitura)
> **Resultado:** ❌ **`BLOCKED`** — 1 incompatibilidade crítica de migration + 3 incompatibilidades de dados
> **Modo:** **Somente leitura** — nenhuma alteração de dados, migrations, correções automáticas, criação de registros ou repair migration.
> **Documento de referência:** `ROADMAP.md` (seção 6.0.5.6)

---

## Localização no fluxo da release v1.5

```
6.0.5.5
      ↓
Production Compatibility Audit (6.0.5.6)  ← este documento
      ↓
Deploy Runbook
      ↓
Janela Única de Deploy
      ↓
Smoke Pós-Deploy
      ↓
Release v1.5 Certification
```

---

## ⚠️ Gate de Release

> **Nenhuma migration de produção poderá ser aplicada sem `PRODUCTION_COMPATIBILITY_AUDIT.md = READY`.**
>
> Referência (obrigatória): *"Antes da janela única de deploy da Release v1.5 será **obrigatória** a execução da **Production Compatibility Audit** utilizando o **banco real dos tenants produtivos**."*

---

## Objetivo

Realizar auditoria **somente leitura** do ambiente produtivo **antes** da primeira aplicação das migrations SaaS da release v1.5.

A auditoria deve garantir que os dados existentes dos tenants em produção são compatíveis com:

- novo modelo de planos (`plans` / `features` / `plan_features`);
- Feature Flags (`feature_flags` / `tenant_has_feature`);
- Tenant Lifecycle (`tenant_status`, `subscriptions.status` + `suspended`);
- Billing (`invoices` / `billing_events` / `payment_attempts`);
- limites por plano (`plans.limits`);
- regras de acesso (Estado Efetivo — ADR-013 §2.4);
- novas relações de banco (FKs, CHECKs, RLS).

## Regras desta etapa

- ✅ **somente analisa e gera relatório;**
- ❌ não altera dados;
- ❌ não aplica migrations;
- ❌ não corrige inconsistências automaticamente;
- ❌ não cria registros;
- ❌ não executa repair migration.

---

## Critérios de Entrada

A auditoria só pode iniciar quando:

- [x] 6.0.5.1 concluída
- [x] 6.0.5.2 concluída
- [x] 6.0.5.3 concluída
- [x] 6.0.5.4 concluída (implementação — unit 874/874 + migration `20260807010000` validada T1–T7 em docker; E2E flow14 adiado à janela única — decisão PO 2026-08-07)
- [x] 6.0.5.5 concluída (implementação — unit 883/883 + migration `20260807020000` validada T1–T12 em docker; **SCHEMA FREEZE = YES** em 2026-08-08; E2E flow11 adiado à janela única — decisão PO)
- [x] **Hardening de RPCs irmãs concluído (2026-08-08 — D-6.0.5.5-6..8):** auditoria de estado efetivo + validação empírica PG16 (suite **S1–S16 + G1**); 2 RPCs quebradas corrigidas (`create_invoice`/`record_payment_attempt`) na migration **`20260808000000`** (aditiva, validada + idempotência 2×). A aplicação da fix ocorre na janela única (runbook §3.6, verificação §4.9) — sem alteração no banco produtivo nesta auditoria (somente leitura)
- [x] Schema final da release congelado (SCHEMA FREEZE = YES, 2026-08-08)
- [x] Runbook de deploy aprovado (`DEPLOY_RUNBOOK_FASE_6_0_5.md`)

## Critérios de Saída

- [x] `docs/audit/PRODUCTION_COMPATIBILITY_AUDIT.md` atualizado com resultado **`BLOCKED`**;
- [x] lista de incompatibilidades encontradas e tenants afetados (ver Resultado Final);
- [ ] (se `READY`) liberação formal para a Janela Única de Deploy — **pendente** (correções pré-deploy necessárias).

---

## Escopo da Auditoria (a executar no banco real dos tenants produtivos)

### 1. Tenants

- [x] tenants sem plano (**0** — OK);
- [x] planos inválidos (**0** — OK);
- [x] planos obsoletos (`elite`; **0** — todos ∈ free/pro/premium);
- [x] status inválidos (**0** — todos no enum `tenant_status`);
- [x] inconsistências de lifecycle (nenhuma — única subscription ativa íntegra).

### 2. Plans

Validar os planos `free`, `pro`, `premium` contra:

- [x] `plans` — **não existem** no remoto; criadas pela pendente `06090000` (esperado);
- [x] `features` — idem;
- [x] `plan_features` — idem;
- [x] `FEATURE_KEYS` / `PlanCatalog` (paridade banco ↔ TS) — catálogo TS já certificado; seed congelado na `06090000`.

### 3. Subscriptions

- [x] subscriptions órfãs (**0** — OK);
- [x] subscriptions inexistentes (**44** tenants sem subscription — provisionadas sob demanda via `start_trial`; não-bloqueante);
- [x] planos incompatíveis (**0** — 1 subscription, plan `free` válido);
- [x] estados inválidos (CHECK sem `suspended` até 6.0.5.4 — 1 subscription `active`; OK).

### 4. Billing

- [x] `invoices` (**0** — OK);
- [x] `billing_events` (**2** — OK);
- [x] `payment_attempts` (**0** — OK); nenhum órfão.

### 5. Feature Flags

- [x] feature keys existentes (`feature_flags` **não existe** — criada pela pendente `07000000`);
- [x] overrides (vazio);
- [x] inconsistências entre banco e catálogo (nenhuma — tabela ainda não criada).

### 6. Limites

Validar para cada tenant: **Plano atual → Limite permitido → Uso real → Possível incompatibilidade**.

| Tenant | Plano | Uso (profissionais) | Limite (`plans.limits.max_staff`) | Resultado |
|--------|-------|---------------------|-----------------------------------|-----------|
| **Barbearia Principal** (produtivo) | free | 4 | 1 | ❌ **Excede** (decisão PO) |
| Loja Demo Varejo | free | 3 | 1 | ❌ Excede |
| SMG Estética Demo | free | 2 | 1 | ❌ Excede |
| Demais (E2E) | free/pro | ≤ limite | free=1 / pro=5 | ✅ OK |

### 7. Chef Club

- [x] utilização atual (**15** assinaturas, **42** receivables);
- [x] compatibilidade com plano (OK — nenhuma em tenant `free` ativo indevido);
- [x] possíveis conflitos após Feature Flags (nenhum — guarda `receivables` só bloqueia novos acessos).

### 8. Segurança

- [x] RLS — 16 funções auditadas; `current_is_tenant_manager_from_auth_uid`/`current_is_super_admin_from_auth_uid`/`current_tenant_id_from_auth_uid` presentes;
- [x] policies — tabelas billing/subscriptions/role_permissions/team_invitations presentes;
- [x] grants — ADR-012 aplicáveis;
- [x] RPC permissions — assinaturas comparadas uma a uma (ver Resultado Final);
- [x] anon access — REVOKEs da `06030000` reaplicáveis;
- [x] **RPC runtime smoke:** `create_invoice`/`record_payment_attempt` **já corrigidas** (migration `08000000` pendente); `cancel_subscription` **incompatível** (bloqueio crítico acima).

### 9. Integridade

- [x] FK — `subscriptions.tenant_id` íntegra; FKs aditivas `tenants_plan_fkey`/`subscriptions_plan_fkey` válidas;
- [x] índices críticos — presentes (PKs, FKs, idempotency);
- [x] dados órfãos — **0** em invoices/payment_attempts/subscriptions.

---

## Resultado Final

| Campo | Valor |
|-------|-------|
| Data da execução | 2026-08-08 |
| Auditor responsável | OpenCode (Tech Lead operacional) |
| Ambiente auditado | Supabase produtivo — project ref `ushsnmlbeurfvlkieiln` (Sanchez Barber) |
| **Resultado** | ❌ **BLOCKED** |
| Incompatibilidades críticas | 1 (migration `20260806030000` vs schema real) + 3 (limites por plano) |
| Ação subsequente | Correções pré-deploy (ver abaixo) + nova PCA parcial após correção |

---

## 🔴 Veredito: BLOCKED

### BLOQUEIO CRÍTICO — MIGRATION `20260806030000` IMPOSSÍVEL DE APLICAR NO REMOTO

**Causa raiz:** a migration `20260806030000_fix_auth_staff_id_to_profiles.sql` foi **pulada** no remoto (irregularidade topológica já conhecida), enquanto as migrations **subsequentes** `20260806050000` (6.0.4.4 billing engine) e `20260806070000` (fix ambiguidade de coluna) **já foram aplicadas**.

| Item | Remoto (aplicado) | Pendente `06030000` | Consequência |
|------|--------------------|----------------------|--------------|
| `cancel_subscription(uuid)` | `RETURNS TABLE(...11 colunas, incl. `cancel_at_period_end`)` — definida por `06050000`+`06070000` | `CREATE OR REPLACE` com **5 colunas** (`id, tenant_id, plan, status, canceled_at`) | ❌ **PostgreSQL rejeita:** `cannot change return type of existing function` |
| Semântica de cancelamento | **Pedido** (seta `cancel_at_period_end`, mantém acesso — BillingEngine 6.0.4.4) | **Efetivo** (seta `status='cancelled'` + `tenants.status='cancelled'`) | ❌ **Regressão funcional** do BillingEngine aprovado em 6.0.4.4 |
| Autorização (objetivo da `06030000`) | **Já presente** via `06070000` — usa `current_is_tenant_manager_from_auth_uid()` | `current_is_tenant_manager_from_auth_uid()` | ✅ Redundante no remoto — o fix de autorização já foi absorvido pelas subsequentes |

**Por que falha na ordem do remoto:** o Supabase CLI aplica pendentes em ordem de timestamp. No remoto, `06050000`/`06070000` (timestamps posteriores) já rodaram, então a `06030000` (timestamp anterior, pulada) seria executada **depois** delas — invertendo a ordem do ambiente local onde foi validada. O `CREATE OR REPLACE` com retorno diferente é um erro garantido.

**Opções de correção (decisão do PO — fora do escopo da PCA, somente leitura):**
1. `supabase migration repair --status applied 20260806030000` — marca como aplicada **sem executar** (seguro: as policies/RPCs que ela criaria já existem no remoto, e a autorização já está no lugar via `06070000`). **Requer aprovação explícita do PO** (operação no histórico de migrations do banco remoto).
2. Nova migration corretiva que faça `DROP FUNCTION` prévio + recrie `cancel_subscription` com a assinatura correta (manter semântica de pedido). Mais código, mesmo resultado.
3. Manter `06030000` no histórico local sem aplicá-la no remoto (desvio documentado no runbook).

> ⚠️ **Não executar** `supabase db push`/`migration up` na janela única antes desta correção — a primeira migration pendente (`06030000`) abortaria o batch com erro garantido.

### INCOMPATIBILIDADES DE DADOS — LIMITES POR PLANO (§6)

Após a migration `20260806090000` (plans catalog), `plans.limits.max_staff` passa a ser a fonte de verdade para limites. Três tenants **já excedem** o limite do plano atual:

| Tenant | Plano atual | Staff ativos | Limite (`max_staff`) | Veredito |
|--------|-------------|--------------|----------------------|----------|
| **Barbearia Principal** (produtivo real) | `free` | **4** | 1 | ❌ **Excede** |
| Loja Demo Varejo | `free` | **3** | 1 | ❌ Excede |
| SMG Estética Demo | `free` | **2** | 1 | ❌ Excede |

> **Impacto:** nenhuma migração pendente quebra por isso (o limite é lido em `invite_team_member` na `07000000`, que bloqueia **novos** convites, não staff existente). Porém, o tenant produtivo real ficaria "acima do plano" após o upgrade de regra — **decisão de negócio do PO** (upgrade para `pro` antes/depois da janela, ou manutenção de situação legada).

### ACHADOS SEM IMPACTO (compatíveis)

- §1 Tenants: 45 tenants, **0** sem plano, **0** planos inválidos, todos os status no enum `tenant_status` (draft/trial/active/past_due/suspended/cancelled/archived).
- §2 Plans: `plans`/`features`/`plan_features` **não existem** no remoto → criadas limpas pela `06090000` (esperado). FKs aditivas `tenants_plan_fkey`/`subscriptions_plan_fkey` válidas (todos os `plan` atuais ∈ free/pro/premium).
- §3 Subscriptions: 1 subscription ativa (E2E Flow9), **0** órfãs, **0** duplicadas ativas; 44 tenants sem subscription (não-bloqueante — `start_trial` provisiona sob demanda).
- §4 Billing: invoices 0, billing_events 2, payment_attempts 0, **0** órfãos.
- §7 Chef Club: 15 assinaturas, 42 receivables — **0** inconsistentes.
- §8 Segurança: todas as 16 funções auditadas presentes com assinaturas compatíveis; `current_is_tenant_manager_from_auth_uid`/`current_is_super_admin_from_auth_uid`/`current_tenant_id_from_auth_uid` presentes; grants ADR-012 aplicáveis.
- §9 Integridade: FKs existentes íntegras (`subscriptions.tenant_id`, `invoices`, `payment_attempts`); nenhum dado órfão.

---

## Ação subsequente (proposta)

1. **PO decide** a correção topológica da `06030000` (opção 1 — `migration repair` — é a mais limpa e alinhada ao fato de a autorização já estar no remoto).
2. **PO decide** o plano do tenant produtivo (Barbearia Principal): upgrade para `pro` ou aceite da situação legada.
3. Executar correções + nova PCA parcial (reverificação somente da `06030000` e do limite do tenant produtivo) → `READY` → Janela Única de Deploy.

> *Enquanto `BLOCKED`, nenhuma migration de produção pode ser aplicada.*
