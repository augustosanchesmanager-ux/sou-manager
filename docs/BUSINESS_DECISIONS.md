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

## Decisões 6.0.5.6 (D-6.0.5.6) — registradas em 2026-08-07

> Subfase 6.0.5.6 — **Production Compatibility Audit (PCA)**. Registro formal da etapa obrigatória da release v1.5 (planejamento — nenhuma execução até o critério de entrada ser atendido).

| Código | Tema | Decisão |
|--------|------|---------|
| D-6.0.5.6-1 | Etapa obrigatória de release | **Production Compatibility Audit (PCA)** é etapa oficial da release v1.5, posicionada entre **6.0.5.5** e o **Deploy Runbook** (antes da Janela Única de Deploy) |
| D-6.0.5.6-2 | Natureza da auditoria | **Somente leitura** — não altera dados, não aplica migrations, não corrige inconsistências automaticamente, não cria registros, não executa repair migration; somente analisa e gera relatório |
| D-6.0.5.6-3 | Gate de deploy | **Nenhuma migration de produção poderá ser aplicada sem `docs/audit/PRODUCTION_COMPATIBILITY_AUDIT.md` = `READY`** (resultado obrigatório: `READY` ou `BLOCKED`) |
| D-6.0.5.6-4 | Alvo da auditoria | Executada contra o **banco real dos tenants produtivos** (ex.: Sanchez Barber) antes da primeira aplicação das migrations SaaS da release |

---

## Autoridade

Este documento é de **exclusiva responsabilidade do PO (Augusto)**. Alterações comerciais exigem revisão formal do PO antes de qualquer implementação.
