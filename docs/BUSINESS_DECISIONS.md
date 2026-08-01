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

> Trial de **14 dias** para planos pagos. Contado a partir do `complete_onboarding()`.

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

## Autoridade

Este documento é de **exclusiva responsabilidade do PO (Augusto)**. Alterações comerciais exigem revisão formal do PO antes de qualquer implementação.
