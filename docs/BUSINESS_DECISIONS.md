# Business Decisions — SMG Barber

> **Fase:** 6.0.0 — SaaS Domain Consolidation
> **Propósito:** Registro oficial das decisões do **PO (Augusto)** que afetam o produto.
> **Regra:** Decisões comerciais só podem ser alteradas pelo PO. Mudanças arquiteturais seguem `docs/adr/`.
>
> | Item | Código | Decisão | Data |
> |------|--------|---------|------|
> | Produto | F0 | SMG Barber é o único produto comercial ativo | 2026-07-27 |
> | Planos | F1 | Planos: **Free / Pro / Premium** | 2026-07-28 |
> | Enterprise | F2 | **Não existe nesta fase** | 2026-07-28 |
> | Trial | F3 | **14 dias** | 2026-07-28 |
> | Grace Period | F4 | **5 dias** após past_due | 2026-07-28 |
> | Dados | F5 | **Nunca excluir dados automaticamente** | 2026-07-28 |
> | Billing | F6 | Evolução futura — apenas domínio agora | 2026-07-28 |
> | Feature Flags | F7 | **Uma feature = uma flag** (nomes simples) | 2026-07-28 |
> | Feature Flags | F8 | **Flags não sabem plano; plano conhece flags** | 2026-07-28 |
> | Onboarding | F9 | Cadastro → Email verify → Shop Setup → Checklist → Dashboard | 2026-07-28 |
> | Lifecycle | F10 | **`draft → trial → active` sempre** (mesmo trial zero) | 2026-07-28 |
> | Escopo Free | F11 | Agenda, 100 clientes, 1 profissional, financeiro básico, dashboard simples | 2026-07-28 |
> | Escopo Pro | F12 | Tudo que a barbearia precisa (plano que deve vender) | 2026-07-28 |
> | Escopo Premium | F13 | Tudo liberado (BI, API, WhatsApp, marketplace, multi-unidade) | 2026-07-28 |
> | Tenant Model | F14 | Tenant = empresa; TenantSettings = configurações operacionais (separados) | 2026-07-28 |

---

## F0 — Produto

> SMG Barber é o único produto comercial ativo da SMG Platform.

## F1 — Planos

> Três planos: **Free**, **Pro**, **Premium**.
> Nomes definitivos nesta fase.

## F2 — Enterprise

> Plano "Enterprise" **não existe** nesta fase. Implica contrato, vendedor, SLA e multiempresa — não é o estágio atual.

## F3 — Trial

> Trial de **14 dias** para planos pagos, contado a partir do **provisionamento do tenant** (início do trial registrado via `start_trial()`; NÃO a partir do `complete_onboarding()`).
> `complete_onboarding()` apenas efetua a transição `draft → trial` — nunca altera diretamente para `active` (ver F10).
> Ao fim do trial, seguem **5 dias de grace period** (F4) antes da suspensão.

## F4 — Grace Period

> **5 dias** de carência após `past_due` antes de suspender:
> ```
> vence → past_due → 5 dias → suspended
> ```

## F5 — Política de Retenção de Dados

> **Nunca excluir dados de tenants automaticamente.**
> - `cancelled` → `archived` após meses (período de retenção)
> - `archived` preserva dados; apenas remove de listagens ativas
> - Exclusão manual somente mediante solicitação explícita (LGPD)

## F6 — Billing

> Billing é evolução futura. Nesta fase: apenas modelagem de domínio (sem gateway, sem cobrança real).

## F7 — Nomenclatura de Feature Flags

> **Uma feature = uma flag.** Nomes simples: `appointments`, `finance`, `dashboard`, `bi`, `whatsapp`, `api`, `marketplace`.
> Proibido: `featureFinancePremiumPlus`, `agendaGold`, etc.

## F8 — Relação Flags × Planos

> **Flags não sabem plano. Plano conhece flags.**
> ```
> Pro → flags: finance=true, dashboard=true, api=false
> ```
> A associação é unidirecional: plano → flags.

## F9 — Fluxo de Onboarding

> ```
> Cadastro → Verificação de e-mail → Shop Setup → Checklist → Dashboard
> ```
> Checklist: horário, profissional, primeiro serviço, primeira categoria.
> Verificação de e-mail estrutura o fluxo para exigência futura.

## F10 — Transição Obrigatória

> `draft → trial → active` é **obrigatória**. Nunca `draft → active` direto, mesmo com trial de zero dias — mantém consistência do fluxo.

## F11 — Escopo Free

> Conhecer o sistema, não gerar receita. Agenda, clientes (até 100), 1 profissional, financeiro básico, dashboard simples. Sem BI, sem automações, sem API.

## F12 — Escopo Pro

> Plano que deve vender. Todos os módulos core, financeiro completo, Club dos Chefes, até 5 profissionais, clientes ilimitados.

## F13 — Escopo Premium

> Tudo liberado: BI, API, WhatsApp, marketplace, multi-unidade, profissionais ilimitados, relatórios customizados.

## F14 — Modelo Tenant

> `Tenant` = apenas a empresa (id, name, slug, app_slug, plan, status).
> `TenantSettings` = configurações operacionais (business_hours, timezone, currency, chair_count, endereço, telefone, CNPJ).

---

## Escopo Funcional por Plano

| Funcionalidade | Free | Pro | Premium |
|---------------|------|-----|---------|
| Agenda | ✅ | ✅ | ✅ |
| Clientes | ✅ (100) | ✅ (∞) | ✅ (∞) |
| PDV | ✅ | ✅ | ✅ |
| Equipe | ⚠️ (1) | ✅ (5) | ✅ (∞) |
| Financeiro | ⚠️ (básico) | ✅ | ✅ |
| Dashboard | ✅ | ✅ | ✅ |
| Club dos Chefes | ❌ | ✅ | ✅ |
| BI | ❌ | ❌ | ✅ |
| API | ❌ | ❌ | ✅ |
| WhatsApp | ❌ | ❌ | ✅ |
| Marketplace | ❌ | ❌ | ✅ |
| Multi-unidade | ❌ | ❌ | ✅ |

---

## Decisões 6.0.5 (D-6.0.5) — aprovadas em 2026-08-06

> Fase 6.0.5 — Billing/Tenant/Feature Flags. Registro oficial das decisões do PO para a arquitetura do **ADR-013**. Detalhamento em `docs/adr/ADR-013-billing-tenant-featureflags.md` §6.

| Código | Tema | Decisão |
|--------|------|---------|
| D-6.0.5-1 | Acesso em `past_due` (grace) | **Read-only com aviso** — login, dashboard, relatórios e exportações; sem criação de clientes/comandas/agendamentos, movimentação financeira, estoque ou alterações cadastrais relevantes |
| D-6.0.5-2 | Acesso em `cancelled` | **Somente leitura (exportação/retenção)** — modo consulta permanente; qualquer escrita bloqueada |
| D-6.0.5-3 | Limite Free de profissionais | **1 profissional** (confirma F11) |
| D-6.0.5-4 | Política de suspensão/retenção | **Manual pelo superadmin, sem TTL** — nenhuma exclusão automática (F5); `archived` é ação administrativa |
| D-6.0.5-5 | Modelo de dados de flags | **`plans + features + plan_features`** (D4/P4) |
| D-6.0.5-6 | Cadência de cobrança | **Mensal agora**; anual aditivo futuro |
| D-6.0.5-7 | `archived` no `subscriptions.status` | **Não** — `archived` é estado exclusivo do Tenant |
| D-6.0.5-8 | Gatilho do `runCycle` | **Edge Function agendada** (só agenda/fornece `asOf`; nunca contém regras de negócio) |

**Regras complementares congeladas (plano Free):** 1 profissional · 1 unidade · sem Chef Club · sem módulos Premium. Limites controlados **exclusivamente pelas Feature Flags** — nenhuma regra depende do nome do plano.

## Decisões 6.0.5.3 (D-6.0.5.3) — aprovadas em 2026-08-07

> Subfase 6.0.5.3 — FeatureFlagService + Enforcement. Aprovações do PO registradas na entrada (respostas à entry audit `PHASE_6_0_5_3_ENTRY_AUDIT.md`).

| Código | Tema | Decisão |
|--------|------|---------|
| D-6.0.5.3-1 | Escopo da subfase | **Somente enforcement de Feature Flags + resolução de planos.** Fora do escopo: Billing Engine, Lifecycle, novas RPCs de transição, RLS, migrations de billing e suspensão automática |
| D-6.0.5.3-2 | Upgrade/downgrade + bypass Admin | `change_tenant_plan` + evento `TenantSubscriptionUpdated` + correção do bypass `Admin.tsx:856` **realocados para 6.0.5.5** (transições RPCs) |
| D-6.0.5.3-3 | Deploy da migration 6.0.5.3 | Procedimento `MIGRATION_EXCEPTION` (mesmo da 6.0.4.3): `supabase db query --linked -f <migration>` + `supabase migration repair --status applied <timestamp>` — aplica `06030000`, `06090000` e a migration 6.0.5.3 na janela de operação |
| D-6.0.5.3-4 | RPCs protegidas com `tenant_has_feature` | **Fechamento de caixa, comissões, receivables/expenses.** Checkout NÃO entra nesta subfase |
| D-6.0.5.3-5 | Comportamento de UI com feature desabilitada | **Híbrido**: esconder módulo no sidebar + página reutilizável `FeatureUnavailablePage`/`UpgradePrompt` parametrizada em rota direta (nunca 403/404 genérico); backend continua a camada de segurança via `tenant_has_feature` |
| D-6.0.5.3-6 | Leitura de Feature Flags no frontend | **Somente via RPC `tenant_has_feature`** consumida pela camada `FeatureFlagService`. Nenhum SELECT direto em `feature_flags`/`plans`/`features`/`plan_features` para decisão de acesso. Otimizações futuras (cache, JWT claims, Edge Functions) ficam atrás da abstração |

---

## Decisões 6.0.5.4 (D-6.0.5.4) — aprovadas em 2026-08-07

> Subfase 6.0.5.4 — TenantLifecycleService + `suspended` aditivo. Aprovações do PO (2026-08-07) respondendo à entry audit `PHASE_6_0_5_4_ENTRY_AUDIT.md` — **5/5 aprovadas sem ajustes**; autorizada a implementação na sequência `migration → domain → application → RPCs → eventos → testes unitários → E2E flow14 → docs → baseline`.
>
> **✅ IMPLEMENTAÇÃO CONCLUÍDA (2026-08-07):** migration `20260807010000` validada em Postgres 16 docker (T1–T7, idempotência 2×); `TenantLifecycleService` como writer único de `tenants.status` (ADR-013 §3.1); engine `suspend` + `markPaid` reativa `suspended→active`; eventos `TenantSubscriptionSuspended`/`Reactivated` publicados; unit **874/874**. **E2E flow14 (spec) escrito + typecheck OK — execução adiada para a janela única de deploy (decisão PO 2026-08-07); nenhuma migration aplicada ao remoto.**

| Código | Tema | Decisão |
|--------|------|---------|
| D-6.0.5.4-1 | Escopo da subfase | **Somente a máquina de suspensão/reativação do contrato** (CHECK aditivo `suspended`, coluna `grace_ends_at`, engine `suspend`, fix fail-fast do `apply_subscription_transition`, `get_due_subscriptions`, `TenantLifecycleService`, RPCs manuais, eventos, `markPaid`). **Fora:** upgrade/downgrade (`change_tenant_plan`, `Admin.tsx:856` → 6.0.5.5), banner de estado (6.0.5.5), gateway/preços/dunning (PO) |
| D-6.0.5.4-2 | Reativação de `suspended` | **Somente** via `markPaid` (pagamento confirmado) **ou** RPC manual autorizada `reactivate_subscription` (superadmin/manager). **`runCycle` nunca reativa** — reativação exige evento explícito |
| D-6.0.5.4-3 | `archived` no contrato | **Não** — `archived` permanece exclusivo de `tenants.status` (D-6.0.5-7); `suspended/cancelled → archived` é ação administrativa, nunca `subscriptions.status` |
| D-6.0.5.4-4 | Fail-fast no `apply_subscription_transition` | Remover o comportamento silencioso `ELSE → active`; **qualquer estado desconhecido → `RAISE EXCEPTION`** (falha cedo, impede liberação de acesso indevido) |
| D-6.0.5.4-5 | Persistência de `grace_ends_at` | Gravada na entrada em `past_due` (`current_period_end + GRACE_PERIOD_DAYS` = 5 dias) e **limpa ao sair de `past_due`/`suspended`** |

**Governança reforçada pelo PO (2026-08-07) — aplicar na implementação:**
1. **Contrato de acesso intocado:** `subscriptions.status` controla o contrato; `tenants.status` controla o ciclo do tenant; `FeatureFlagService` controla disponibilidade — **Effective State** (Subscription + Tenant + Feature Availability). Sem retorno ao acoplamento antigo.
2. **Novo status só existe quando banco + domínio + testes + documentação o conhecem.**
3. **`runCycle`:** avaliar prazo → gerar transição → suspender quando necessário; **nunca** reativar automaticamente por pagamento.

---

## Decisões 6.0.5.5 (D-6.0.5.5) — aprovadas em 2026-08-07

> Subfase 6.0.5.5 — **Transições RPCs (`change_tenant_plan` + banner + `UpgradePrompt` + correção `Admin.tsx`)**. Última implementação funcional da série 6.0.5. Entry audit submetida em `docs/audit/PHASE_6_0_5_5_ENTRY_AUDIT.md`. **D-6.0.5.5-1..5 APROVADAS pelo PO em 2026-08-07 — implementação autorizada.** D-6.0.5.5-4: hardening M7/M11/M12 + E2E flow11 **adiados para o backlog pós-v1.5** (default da entry audit confirmado).
>
> **✅ IMPLEMENTAÇÃO CONCLUÍDA (2026-08-08)** — migration `20260807020000` validada em docker (T1–T12 + idempotência 2×); unit 883/883; **gate Schema Freeze REEXECUTADO → `SCHEMA FREEZE = YES`** (D-6.0.5.5-1 cumprida); Single Writer aplicado (D-6.0.5.5-3 — `Admin.tsx` sem escrita direta); escopo entregue conforme D-6.0.5.5-2/5.
>
> **✅ HARDENING DE RPCs IRMÃS CONCLUÍDO (2026-08-08 — decisão PO, D-6.0.5.5-6..8):** a validação empírica (PG16 docker, suite S1–S16 + G1) confirmou que a `20260806070000` já corrigiu 7 RPCs, mas **2 permaneciam quebradas** (`create_invoice`/`record_payment_attempt` — declaradas "limpas" incorretamente). Fix aditivo na migration **`20260808000000`** (additiva, sem mudança de regra/contrato/escopo) + validação da suite completa **S1–S16 + G1 PASS** + idempotência 2×. Aplicação na janela única de deploy (runbook §3.6, verificação §4.9).

| Código | Tema | Decisão |
|--------|------|---------|
| D-6.0.5.5-1 | **Gate "Schema Freeze Candidate"** | Obrigatório antes do início da implementação e **reexecutado no fechamento**: responder as 7 perguntas de schema (novas tabelas/colunas/FKs/policies/RPCs/funções públicas/contratos alterados) e registrar **`SCHEMA FREEZE = YES`** ou **`NO` (listar o delta)**. **Pré-requisito da PCA (6.0.5.6)** e critério de entrada da 6.0.6. Veredito preliminar: **NO** — somente a RPC `change_tenant_plan` como novo objeto de schema |
| D-6.0.5.5-2 | Escopo | **Transições de plano** (RPC `change_tenant_plan` upgrade/downgrade + `TenantSubscriptionUpdated` + correção `Admin.tsx:856`) + banner de estado + `UpgradePrompt` (D-6.0.5.3-5) + depreciação `featureAvailability.ts`. **Fora:** preços/gateway/dunning (PO); Billing Engine; novas RPCs de billing além de `change_tenant_plan` |
| D-6.0.5.5-3 | Single Writer do plano | `tenants.plan` deixa de ser escrito pela UI → **derivado/espelho de `subscriptions.plan`** (ADR-013 §3.1); única fronteira = RPC `change_tenant_plan` orquestrada por `changePlan` (`application/tenantLifecycle.ts`) |
| D-6.0.5.5-4 | Hardening opcional | M7 (guard legado `save_onboarding_step`) / M11 (trigger drift) / M12 (audit triggers em billing) + E2E flow11 — **ADIADO para o backlog pós-v1.5 (aprovado pelo PO 2026-08-07)** |
| D-6.0.5.5-5 | Contenção de schema | **Sem novas tabelas, colunas, FKs ou policies** — somente a RPC `change_tenant_plan` (fecha o schema da release v1.5) |
| D-6.0.5.5-6 | **Hardening obrigatório das RPCs irmãs (2026-08-08)** | Auditoria de estado efetivo + validação empírica em PG real + correção **aditiva** das RPCs irmãs do ciclo de billing antes da PCA. **Aprovado pelo PO** após descoberta na validação da 6.0.5.5 |
| D-6.0.5.5-7 | Escopo do hardening | **Sem alteração de regra, contrato ou escopo** — somente `CREATE OR REPLACE` qualificando referências de coluna ambíguas (`create_invoice`, `record_payment_attempt`) + grants ADR-012 reafirmados. Migration **`20260808000000`** aditiva/idempotente (2×) |
| D-6.0.5.5-8 | Validação do hardening | Suite SQL/integration **S1–S16 + G1** (PG16 docker): todas as 13 RPCs irmãs executadas em caminho de sucesso + autorização fail-fast + grants ADR-012. **TODOS PASS** pós-fix |

## Decisões 6.0.5.6 (D-6.0.5.6) — registradas em 2026-08-07

> Subfase 6.0.5.6 — **Production Compatibility Audit (PCA)**. Registro formal da etapa obrigatória da release v1.5 (planejamento — nenhuma execução até o critério de entrada ser atendido).
>
> **✅ EXECUTADA (2026-08-08, somente leitura) → ❌ `BLOCKED` inicial.** Auditoria do banco real (project ref `ushsnmlbeurfvlkieiln` — Sanchez Barber) revelou 1 incompatibilidade crítica de migration + 3 excedências de limite. **Correções aprovadas pelo PO (2026-08-08, D-6.0.5.6-5..7) e executadas → re-auditoria parcial → ✅ `READY`.**

| Código | Tema | Decisão |
|--------|------|---------|
| D-6.0.5.6-1 | Etapa obrigatória de release | **Production Compatibility Audit (PCA)** é etapa oficial da release v1.5, posicionada entre **6.0.5.5** e o **Deploy Runbook** (antes da Janela Única de Deploy) |
| D-6.0.5.6-2 | Natureza da auditoria | **Somente leitura** — não altera dados, não aplica migrations, não corrige inconsistências automaticamente, não cria registros, não executa repair migration; somente analisa e gera relatório |
| D-6.0.5.6-3 | Gate de deploy | **Nenhuma migration de produção poderá ser aplicada sem `docs/audit/PRODUCTION_COMPATIBILITY_AUDIT.md` = `READY`** (resultado obrigatório: `READY` ou `BLOCKED`) |
| D-6.0.5.6-4 | Alvo da auditoria | Executada contra o **banco real dos tenants produtivos** (ex.: Sanchez Barber) antes da primeira aplicação das migrations SaaS da release |
| D-6.0.5.6-5 | **Correção da migration `20260806030000` (2026-08-08)** | **`supabase migration repair --status applied 20260806030000`** (opção 1 recomendada pela PCA). A migration foi **pulada no remoto** e seu `cancel_subscription` (5 colunas) é incompatível com a função aplicada (11 colunas, `06050000`/`06070000`). A autorização que ela adiciona **já está no remoto** via `06070000` (`current_is_tenant_manager_from_auth_uid`). **Repair executado pelo OpenCode em 2026-08-08** — `20260806030000` agora consta como aplicada no histórico remoto |
| D-6.0.5.6-6 | **Plano dos tenants com limite excedido (2026-08-08)** | **Upgrade `free → pro` nos 3 tenants** que excediam `max_staff=1`: **Barbearia Principal** (produtivo real, 4 staff → OK em `pro` com limite 5), **Loja Demo Varejo** (3 staff) e **SMG Estética Demo** (2 staff). **Executado pelo OpenCode em 2026-08-08** via UPDATE direto em `tenants.plan` (o RPC `change_tenant_plan` ainda não está aplicado no remoto — janela única). Re-auditoria confirma `limit_check = OK` em 100% dos tenants |
| D-6.0.5.6-7 | Re-auditoria parcial pós-correção | Após as correções D-6.0.5.6-5/6, a PCA foi re-executada parcialmente (topologia de migrations + limites): **veredito final `READY`** — gate de release liberado para a janela única de deploy |
| D-6.0.5.7-1 | Plano do projeto na janela de deploy (2026-08-08) | O projeto está no **plano Free** do Supabase: **backup automático e PITR não estão disponíveis**. Não há upgrade imediato de plano para a janela |
| D-6.0.5.7-2 | Requisito de recuperação no Free (2026-08-08) | O requisito de PITR do pré-flight é substituído por: **(1)** backup lógico completo via `supabase db dump` (somente leitura); **(2)** validação de integridade, tamanho, timestamp e hash SHA-256; **(3)** cópia de custódia fora do banco/projeto Supabase; **(4)** **teste de restauração em Postgres local/temporário (17.6)** ANTES da abertura da janela |
| D-6.0.5.7-3 | Execução do backup (2026-08-08) | **Executado pelo OpenCode em 2026-08-08** (somente leitura; nenhuma alteração de schema/dados/policies/migrations): 4 artefatos (`roles`, `schema`, `data`, `data_app`) gerados em `C:\Users\admsm\AppData\Local\Temp\opencode\backups\sou-manager\20260808_20260808-093350\` + **cópia de custódia** em `C:\Users\admsm\Backups\SMG_BARBER\20260808_20260808-093350\`; hashes SHA-256 registrados; **restauração validada em container Postgres 17.6.1.106** com contagens 100% idênticas ao snapshot pré-deploy. Evidência completa em `docs/DEPLOY_LOG_FASE_6_0_5.md` |
| D-6.0.5.7-4 | Gate pós-backup | A janela única só abre com backup validado: abrir **aborta** se o backup lógico não estiver concluído e restaurado com sucesso (§2.2 do runbook) |
| D-6.0.5.8-1 | Fix de hardening `anon` nas RPCs (2026-08-08) | Verificação pós-deploy §4.9 detectou `anon` com `EXECUTE` em **~60 RPCs** (`create_invoice`, `record_payment_attempt`, `mark_invoice_paid`, `change_tenant_plan`, `suspend_subscription`, `tenant_has_feature`, financeiras, etc.). Débito **pré-existente e documentado** (`docs/security/SECURITY_AUDIT_RPC.md` — Fase 6.0.4.2, auto-grant de `anon` pelo Supabase em funções novas). **PO aprovou o fix durante a janela** |
| D-6.0.5.8-2 | Escopo do fix | `REVOKE EXECUTE ON FUNCTION ... FROM anon` nas RPCs **sem exceção pública**, preservando `get_invite_by_token` e `kiosk_get_staff` (intencionalmente públicas). Aplicado via transação atômica + registrado como migration **`20260808110000_revoke_anon_rpc_execute.sql`** (idempotente) no histórico remoto. **Executado pelo OpenCode em 2026-08-08**; re-validação: `anon_restantes = 0` |
| D-6.0.5.8-3 | Mitigação funcional verificada | RPCs são `SECURITY DEFINER` e rejeitam chamada sem sessão na 1ª linha (`IF auth.uid() IS NULL THEN RAISE EXCEPTION`); o fix é **defense-in-depth** (padrão ADR-012) |

## Decisões de Homologação (D-HOM) — aprovadas em 2026-08-08

> **Gate formal de homologação da Sanchez Barber** como tenant produtivo real — posicionado **após a janela única de deploy (6.0.5 aplicada e validada no banco real)** e **antes da Fase 6.0.6**. A homologação transforma a validação técnica em prova operacional e integra a **trilha de certificação da v1.5.0**.

| Código | Tema | Decisão |
|--------|------|---------|
| D-HOM-1 | Criação do gate | A **homologação da Sanchez Barber** é um **gate formal da release v1.5**, não uma lista informal de testes. Plano registrado em `docs/audit/HOMOLOGATION_PLAN_SANCHEZ_BARBER.md` |
| D-HOM-2 | Posição na release | Posicionada **após** 6.0.5 deployada/validada no banco real e **antes** da 6.0.6. **6.0.6 não começa enquanto a homologação não estiver formalmente `HOMOLOGADO` ou `HOMOLOGADO COM RESSALVAS`, aprovada pelo PO** |
| D-HOM-3 | Escopo dos gates | 7 gates: **H-1** Integridade operacional · **H-2** Fluxo financeiro P0 · **H-3** Chef Club · **H-4** Billing/Lifecycle · **H-5** Feature Flags · **H-6** Segurança · **H-7** Operação real (ciclo completo acompanhado) |
| D-HOM-4 | Vereditos oficiais | 🟢 **HOMOLOGADO** · 🟡 **HOMOLOGADO COM RESSALVAS** (somente não bloqueantes, com plano de ação) · 🔴 **BLOQUEADO** (falha P0/P1 ou risco de integridade) |
| D-HOM-5 | Evidência obrigatória | Cada teste exige **responsável, data, resultado e observação** — a homologação integra a trilha de certificação da v1.5.0 |
| D-HOM-6 | Modo do plano | Plano elaborado **exclusivamente documental** em 2026-08-08: nenhuma execução de teste, alteração de código ou banco até **aprovação formal do PO** |
| D-HOM-7 | Fora do escopo da homologação | Sem merge, sem baseline/tag v1.5.0, sem deploy de frontend, sem migrations novas, sem início da 6.0.6 — decisões posteriores do PO |
| D-HOM-8 | Operação real (H-7) | Ciclo real de trabalho da Sanchez Barber acompanhado (agendamento → atendimento → comanda → pagamento → comissão → fechamentos → conferência financeira); uso de dados reais conforme regra do PO |
| D-HOM-9 | **Gate H-8 — Infraestrutura Vercel / Deployment Topology** (2026-08-08) | Adicionado após detecção de que o mesmo commit (`68acda4`) foi implantado (preview) em **dois projetos Vercel** (`smg-barber` e `sou-manager`). Exige **origem oficial única** do frontend de produção do SMG Barber (domínio, branch, env e Supabase vinculados) e **deploy de produção da release v1.5 planejado** (produção atual `718f6f9` defasada). **Auditoria somente leitura executada pelo OpenCode em 2026-08-08** → `docs/audit/VERCEL_DEPLOYMENT_TOPOLOGY_AUDIT.md` (oficial: `smg-barber`/`barber.soumanager.com`; legado: `sou-manager`; riscos: double-deploy em merge, divergência de `MULTI_SCHEMA_ENABLED`, credenciais legadas no env do `sou-manager`). **Nenhuma alteração remota na Vercel — reconciliação e destino do legado são decisão do PO** |
| D-HOM-10 | **Homologação NÃO encerrada — H-8 BLOQUEADOR + Hardening da Homologação / Vercel** (2026-08-08) | Após a auditoria: produção atende frontend `718f6f9` (sem 6.0.1–6.0.5 e sem fix `68acda4`) → **homologar contra o frontend de produção não valida a release v1.5**. H-8 formalizado como **🔴 BLOQUEADOR**. Criado bloco de **Hardening (§8.1)** com 8 etapas: (1) `smg-barber` como única origem oficial; (2) destino do legado `sou-manager` (sem deletar) — **decisão do PO**; (3) **ETAPA B** — repro `Invalid Refresh Token` → logout/login → validar `auth.uid()`, tenant, Dashboard, Comissões; (4) preview oficial com `68acda4`; (5) re-teste de Comissões na Sanchez Barber sobre o preview oficial; (6) continuidade dos ~45 testes H-1..H-7; (7) registro P0/P1/P2; (8) fechamento H-1…H-8 + veredito. **Proibido até nova ordem:** merge `main`, deploy v1.5, abertura 6.0.6, alterações remotas na Vercel |
| D-HOM-11 | **Destino do legado `sou-manager` — git link DESCONECTADO (EXECUTADO 2026-08-08)** | Decisão do PO (2026-08-08): desativar o **git link** do projeto Vercel `sou-manager` para **eliminar o double-deploy** quando ocorrer o merge para `main`. **Executado** via `vercel git disconnect` (CLI 50.38.3): `sou-manager` → `link: NULL` (confirmado via API GET `/v9/projects/prj_fnQHNKxQR2XRMhAg5y9eA0qwyIN3`). **Nada deletado** — projeto, domínios (`soumanager.com`, `club.soumanager.com`), env (25 vars) e histórico preservados; **reversível** via `vercel git connect`. Projeto oficial `smg-barber` **inalterado** (link `github/sou-manager` intacto). Registro completo: `docs/audit/VERCEL_DEPLOYMENT_TOPOLOGY_AUDIT.md` §8. **ETAPA B: ADIADA (PO, 2026-08-08)** — validação local com conta de homologação no tenant Sanchez Barber (logout → login → selecionar Sanchez Barber → Dashboard → Comissões → dados reais do período → evidência) **aguardando conta de homologação** (não existe conta de teste no tenant; `profiles` só tem o superadmin; `user_tenants` vazio) |
| D-HOM-12 | **Conta de homologação no tenant Sanchez Barber — CRIADA, VALIDADA e ETAPA B EXECUTADA (2026-08-08, autorização D-HOM-11)** | Provisionada a conta de homologação no tenant produtivo `b716e290...` (Sanchez Barber): `homolog.sanchez@barber.soumanager.com` (id `189053ab-f76b-4e91-90fc-998bb693711d`, role `manager`, status `active`, `onboarding_completed=true`, membership `user_tenants` primária manager, staff auto-criado pelo trigger `36f1705b-...`). **ETAPA B (§8.1#3) EXECUTADA:** validação local no frontend (`npm run dev` + Playwright, Supabase real `ushsnmlbeurfvlkieiln`) → login UI OK (`/#/dashboard`, sem `Invalid Refresh Token`, sem redirect indevido), **0 erros de console e 0 erros HTTP**, Comissões renderizou dados reais da Sanchez (confirmada R$ 305,00 / pendente R$ 215,00 / vendas R$ 1.040,00 — HERON). **Achado EB-1 (P3, cosmético):** header/sidebar mostram "Minha Barbearia"/"PLANO FREE" porque `components/Layout.tsx:26-27` deriva nome/plano de `user.user_metadata` e a conta via SQL tem metadata mínimo — **sem impacto funcional** (authorização via `tenant_has_feature`, ADR-013). **Pitfalls corrigidos (usuário criado via SQL direto):** (1) linha ausente em `auth.identities`; (2) colunas de token (`confirmation_token`, `recovery_token`, `email_change`, `email_change_token_new`, etc.) com `NULL` → `500 Database error querying schema` do GoTrue; (3) hash bcrypt em custo 10. Senha **não versionada**. Procedimento completo + evidências: `docs/audit/HOMOLOG_ACCOUNT_PROVISIONING.md`. **Pendente:** re-teste de Comissões sobre o preview oficial `smg-barber` (§8.1#5) + testes H-1..H-7 |
| D-HOM-13 | **EB-2 CORRIGIDO — 42703 `column comandas.client_name does not exist` (APROVADO e IMPLEMENTADO 2026-08-09)** | Decisão do PO (2026-08-09): implementar a correção do achado **EB-2 (P1)** que bloqueava o fluxo de Caixa. **Aprovado:** remover as **3 colunas-fantasma** (`client_name`, `paid_amount`, `notes`) de `COMANDA_COLUMNS` em `domain/comanda/repository.ts` e ajustar `toComanda`; tornar `client_name`/`paid_amount`/`notes` **opcionais** no tipo `Comanda`; remover `paid_amount`/`notes` de `UpdateComandaInput`; **manter os fallbacks** nos consumidores (`loaders.ts` via `clientMap`, `summary.ts` via `'Cliente'`, `Commissions.tsx` via `amount_paid ?? total`); criar **regression guard** (`domain/comanda/repository.test.ts`, 5 testes); **sem migration** (não requer DDL). **Implementado e validado:** unit **888/888**, typecheck sem novos erros (125 baseline), build OK, `architecture:ci` sem novos erros (3 baseline); auditoria estrutural de 19 call sites `.from('comandas')` — todos usam somente colunas reais; write path (`prepareComandaData`) nunca escreve as colunas-fantasma. **Pendente:** validação funcional da CashClosingPage no preview oficial com a conta Sanchez (gate H-2) após deploy do preview. Registros: `docs/audit/HOMOLOGATION_PLAN_SANCHEZ_BARBER.md` (D-HOM-13), `docs/audit/HOMOLOG_ACCOUNT_PROVISIONING.md` §7.3 |
| D-HOM-14 | **H-2 — Fluxo financeiro P0 🟢 APROVADO pelo PO (2026-08-09)** | Decisão do PO: após validação funcional no **preview oficial** (`feature/phase-6.0.4-billing`, pós-`76574bc`) com a **conta de homologação** (tenant Sanchez Barber, Supabase real), o gate **H-2 é declarado APROVADO**. **Validado com dados reais:** Cash Closing (sem 42703 `comandas.client_name`), Comissões (confirmada R$ 305,00 / pendente R$ 215,00 / vendas R$ 1.040,00), console limpo nos fluxos testados. **EB-2 encerrado.** **Sequência decidida:** executar **H-3 (Chef Club) → H-4 (Billing/Lifecycle) → H-5 (Feature Flags) → H-6 (Segurança) → H-7 (Operação real)**, fechar o **veredito global v1.5.0**, depois resolver **H-8 (deploy de produção/legado)**, e só então **certificação v1.5.0 → abertura da 6.0.6**. **6.0.6 NÃO será aberta antes da homologação concluída.** A evidência formal da matriz H2-1..H2-8 (quadratura SQL, cancelamento/reversão) será registrada no **H-7 — Operação real**. Registros: `docs/audit/HOMOLOGATION_PLAN_SANCHEZ_BARBER.md` (D-HOM-14), `docs/RELEASE_CHECKLIST_v1.5.md` |
| D-HOM-16 | **H-3 — Chef Club em execução: H3-4 (consumo de créditos) validado via SQL; 2 bugs de runtime corrigidos na RPC `bulk_close_comandas_with_credits` (2026-08-13, execução da sequência H-3 autorizada em D-HOM-14)** | Dentro da execução do gate **H-3 (Chef Club)** autorizada na sequência PO (D-HOM-14), o OpenCode validou a RPC `bulk_close_comandas_with_credits` no banco real `ushsnmlbeurfvlkieiln` contra o cenário do erro `42703` histórico do checkout com créditos: **consumo de exatamente 1 crédito** (5→4; CORTE SIMPLES 4→3), comanda fechada com `membership_credit_effect=true`/`payment_method="Club dos Chefes"` **sem `42703`**; cenário negativo `P0001 Insufficient credits for this service` **sem `42703`**; **idempotência OK**. **2 bugs de runtime corrigidos e reaplicados** em `supabase/migrations/bulk_close_comandas_with_credits.sql`: (1) precedência do cast `::jsonb` (`22P02 Token "consumed" is invalid`) → parênteses na concatenação; (2) `jsonb_set` com `create_missing=false` → `by_service` vazio → `true`. **Sem decisão de negócio nova** (manutenção corretiva dentro da H-3 já autorizada; sem ADR). Unit **897/897**, build OK, `architecture:ci` sem regressões. Evidência: `docs/audit/H3_CHEF_CLUB_CREDITS_VALIDATION.md`. **Pendente:** H3-1/H3-2/H3-3/H3-5/H3-6 + reflexo no receivable (H-7) |

## Decisões 6.0.6 (D-6.0.6) — aprovadas em 2026-08-07

> Fase 6.0.6 — **Compliance & Legal**. Registro formal do gate obrigatório de certificação da release v1.5. Fase **exclusivamente documental nesta etapa** (nenhuma migration, tabela, SQL, RPC, API ou componente React). Posicionada **após a conclusão da 6.0.5.x** (incluindo PCA 6.0.5.6 + janela única de deploy) e **antes da certificação final da Release v1.5**.

| Código | Tema | Decisão |
|--------|------|---------|
| D-6.0.6-1 | Criação da fase | **6.0.6 — Compliance & Legal** é fase oficial da SMG Platform, registrada como **gate obrigatório de certificação da release v1.5** |
| D-6.0.6-2 | Posição na release | Posicionada **após** 6.0.5.x (incluindo PCA 6.0.5.6 + janela única de deploy) e **antes** da certificação final da v1.5. O **gate da release** exige a 6.0.6 concluída para a v1.5 ser certificada |
| D-6.0.6-3 | Natureza nesta etapa | **Somente documentação** — nenhum código, migration, tabela, SQL, RPC, API ou componente React será alterado nesta etapa. A definição de artefatos funcionais/visuais (Centro Jurídico UI) fica para fases posteriores, após decisão do PO |
| D-6.0.6-4 | Documentos jurídicos | Escopo de documentos legais versionados: **Termos de Uso, Política de Privacidade, LGPD, Contrato SaaS, Consentimentos, Cookies** |
| D-6.0.6-5 | Versionamento | Cada documento possui **versão, hash, data de publicação, flag obrigatório/opcional e histórico**; versões antigas nunca são substituídas nem apagadas |
| D-6.0.6-6 | Aceite eletrônico | Registra **usuário, tenant, data/hora, IP, User-Agent e versão aceita**; histórico **imutável** (append-only) |
| D-6.0.6-7 | Reaceite obrigatório | Documento alterado → **nova versão → login → reaceite → acesso**. Usuário sem reaceite fica bloqueado até aceitar a nova versão |
| D-6.0.6-8 | Centro Jurídico | Centro administrativo com histórico de aceites, documentos vigentes, versões anteriores, download, auditoria e situação do tenant |
| D-6.0.6-9 | Objetivos LGPD | Garantir **exportação** (direito à portabilidade), **retenção** conforme política, **exclusão** (direito ao esquecimento), **consentimentos registrados** e **auditoria** de aceites |
| D-6.0.6-10 | Modelo de dados (proposta) | Tabelas propostas (apenas arquitetura — nenhuma migration): **`legal_documents`**, **`document_versions`**, **`accepted_documents`** |
| D-6.0.6-11 | Fluxo oficial de onboarding | Aceite jurídico inserido no fluxo oficial entre **Onboarding** e **Criação do Tenant** |
| D-6.0.6-12 | Critérios de entrada | Arquitetura 6.0.5 concluída · PCA `READY` · schema congelado · deploy aprovado · release candidata pronta |
| D-6.0.6-13 | Gate da release v1.5 | **A v1.5 somente é considerada concluída com: documentos jurídicos existentes + aceite eletrônico + versionamento + auditoria de aceite + Centro Jurídico + checklist de compliance aprovado** |

---

## Autoridade

Este documento é de **exclusiva responsabilidade do PO (Augusto)**. Alterações comerciais exigem revisão formal do PO antes de qualquer implementação.
