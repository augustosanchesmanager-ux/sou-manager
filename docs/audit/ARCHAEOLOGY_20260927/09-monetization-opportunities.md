# Oportunidades de Monetização

**Data:** 2026-09-27 | **Modo:** READ-ONLY

---

## 1. Visão Geral

O mapeamento de oportunidades de monetização identifica padrões de receita, modelos de pricing e fluxos financeiros que podem ser adotados ou adaptados no SMG Barber, baseados em evidências dos repositórios auditados.

---

## 2. Modelos de Monetização Identificados

### 2.1 `sou-manager` — Modelo Ativo

| Fonte de Receita | Evidência | Status |
|---|---|---|
| Assinaturas (Club dos Chefes) | `customer_subscriptions`, `customer_plans` | ✅ Ativo |
| Comissões sobre serviços | `domain/commission/`, `commission_rate`, `affects_commission` | ✅ Ativo |
| Transações financeiras | `transactions`, `financial_reversals` | ✅ Ativo |
| Cash Closing (settlement) | `application/cashClosing/` | ✅ Ativo |
| Ticket médio por serviço | `services` table com preços | ✅ Ativo |
| Produtos | `products` table | ✅ Ativo |
| Kiosk | `kiosk_devices`, `kiosk_sessions` | ✅ Ativo |

### 2.2 `sanchez-barber-iastudio` — Sem Monetização

| Aspecto | Evidência | Classificação |
|---|---|---|
| Pricing | **NENHUM** — sem tabela de preços | 🔴 DESCARTAR |
| Pagamento | WhatsApp-only (sem integração de pagamento) | 🟡 REFERÊNCIA |
| Comissões | `data.ts` tem preços de serviços, mas não é sistema de comissões | 🟡 REFERÊNCIA |
| Modelo de negócio | Site de marketing → WhatsApp | 🟡 REFERÊNCIA |

### 2.3 `SMG_LOUGE` — Monetização Parcial

| Aspecto | Evidência | Classificação |
|---|---|---|
| Promoter commissions | `promoter_commissions`, `compute_event_promoter_commissions` | 🟡 ADAPTAR |
| Financial closing | `financial_closings` | 🟡 ADAPTAR |
| Bar/KDS orders | `orders`, `order_items` | 🟡 ADAPTAR |
| Consumption tracking | `initial_consumption`, `consumptionStore` | 🟡 REFERÊNCIA |
| **Problema** | `commissionStore` dead, RPCs com bugs de GUC | 🔴 REESCREVER |

### 2.4 `gerador_orcamentos` — Sem Monetização

| Aspecto | Evidência | Classificação |
|---|---|---|
| Pricing | **NENHUM** — app gratuito de orçamento | 🔴 DESCARTAR |
| Desconto | **NÃO EXISTE** | 🔴 DESCARTAR |
| Aprovação | Apenas status enum, sem workflow | 🔴 DESCARTAR |
| Modelo de negócio | Construction/Engenharia (CR Engenharia) | 🔴 NÃO É SMG |

### 2.5 `smg-core` — Monetização em Draft

| Aspecto | Evidência | Classificação |
|---|---|---|
| Plans | `platform_plans` + seed 'starter' + `tenants.planId` FK | ⚠️ Schema-only |
| Feature flags | `platform_feature_flags` | ⚠️ Schema-only |
| Billing | `smg_invoices`, `billing_events` — draft SQL | ⚠️ Nunca migrado |
| Integrations | `platform_integrations` | ⚠️ Schema-only |
| Jobs | `platform_jobs` | ⚠️ Schema-only |

### 2.6 `SMG_AUTOCONTROL` — Monetização Implícita

| Aspecto | Evidência | Classificação |
|---|---|---|
| Mão de obra como receita | `NewOS.tsx:129-132` — "Mão de Obra: R$ 150,00" | 🟡 REFERÊNCIA |
| OS como agregador de receita | `Financial.tsx:17` — "OS #8839 - Scania R450" como entrada | 🟡 REFERÊNCIA |
| Entradas/Saídas | `CashEntry` com categorias livres | 🟡 REFERÊNCIA |
| **Problema** | `total_value` sem split labor/material/tax | 🔴 REESCREVER |

### 2.7 `SMG_LADINGPAGE` — Sem Monetização

| Aspecto | Evidência | Classificação |
|---|---|---|
| Pricing | **NENHUM** — grep por `R\$|preço|plano` → 0 resultados | 🔴 DESCARTAR |
| WhatsApp como substituto | `FinalCTA.tsx:36` — `wa.me/551140000000` | 🔴 REESCREVER |
| Modelo | Sales-Led / high-touch, sem preço público | 🟡 REFERÊNCIA |
| CTA de conversão | 7 links quebrados | 🔴 REESCREVER |

---

## 3. Padrões de Monetização Reutilizáveis

### 3.1 Padrão de Catálogo (gerador_orcamentos → sou-manager)

```
tenant_id + ativo + partial unique index
```

Este padrão de catálogo multi-tenant pode ser replicado para:
- `services` (já existe em `sou-manager`)
- `products` (já existe)
- Novos catálogos de módulo

### 3.2 Padrão de PDF Generation (gerador → sou-manager)

```
Puppeteer + Handlebars + tenant_id
```

Padrão de geração de documentos PDF por tenant. Potencialmente reutilizável para:
- Relatórios
- Contratos
- Orçamentos

### 3.3 Padrão de Commission (sou-manager → auto)

```
commission_rate + affects_commission + period + totalSales + totalCommission
```

O domínio `commission/` do `sou-manager` separa comissão teórica de settlement (ADR-001). O "Mão de obra" do AUTOCONTROL é o análogo automotivo.

**Decisão do PO necessária:** Como mapear "Mão de obra" no domínio `commission/`?

### 3.4 Padrão de Promoter Commissions (LOUGE → potencial)

```
compute_event_promoter_commissions → approve → mark_paid → adjust
```

Padrão de comissões por evento com aprovação e pagamento. Potencialmente adaptável para:
- Comissões de equipe no SMG Barber
- Referral programs

**Problema:** RPCs têm bugs de GUC e falta de auth check.

### 3.5 Padrão de Subscription (sou-manager → potencial)

```
customer_subscriptions + customer_plans + customer_subscription_receivables
```

Padrão de assinaturas com recebíveis. Potencialmente reutilizável para:
- Club dos Chefes
- Planos de assinatura para outros módulos

---

## 4. Lacunas de Monetização no SMG Barber

| # | Lacuna | Evidência | Impacto |
|---|---|---|---|
| M-1 | Sem pricing público | `SMG_LADINGPAGE` — grep → 0 resultados | Toda conversão depende de WhatsApp |
| M-2 | Sem plano/ tier | `smg-core` — `platform_plans` só draft | Sem modelo de assinatura estruturado |
| M-3 | Sem billing | `smg-core` — `smg_invoices` só draft | Sem faturamento automatizado |
| M-4 | Sem feature flags em produção | `smg-core` — `platform_feature_flags` só schema | Sem gated features |
| M-5 | Sem integração de pagamento | `sanchez` — WhatsApp-only | Sem pagamento direto |
| M-6 | Sem analytics de receita | `SMG_LADINGPAGE` — zero tracking | Sem métricas de conversão |
| M-7 | Sem promoções/discounts | `gerador` — desconto NÃO existe | Sem mecanismo de desconto |
| M-8 | Sem aprovação de orçamento | `gerador` — apenas status enum | Sem workflow de aprovação |

---

## 5. Oportunidades de Monetização Cruzadas

| # | Oportunidade | Origem | Destino | Modelo |
|---|---|---|---|---|
| MO-1 | Plano 'starter' | smg-core | sou-manager | Subscription |
| MO-2 | Feature flags | smg-core | sou-manager | Gated features |
| MO-3 | Billing draft | smg-core | sou-manager | Invoice |
| MO-4 | Promoter commissions | LOUGE | sou-manager | Commission |
| MO-5 | PDF generation | gerador | sou-manager | Document generation |
| MO-6 | Catálogo pattern | gerador | sou-manager | Multi-tenant catalog |
| MO-7 | Mão de obra → commission | AUTOCONTROL | sou-manager `auto` | Commission |
| MO-8 | OS → comanda | AUTOCONTROL | sou-manager | Order management |
| MO-9 | Entradas/Saídas | AUTOCONTROL | sou-manager | Cash flow |
| MO-10 | Sales-Led + WhatsApp | LADINGPAGE | sou-manager | Lead generation |

---

## 6. Riscos de Monetização

| # | Risco | Evidência | Impacto | Probabilidade |
|---|---|---|---|---|
| MR-1 | `service_role` JWT compromete dados financeiros | `gerador` — `index.html` | Perda total de receita | **ALTA** |
| MR-2 | RLS `USING(true)` em tabelas financeiras | `gerador` — `budgets` | Exposição de dados financeiros | **ALTA** |
| MR-3 | Sem tenant isolation em transações | `gerador` — `x-tenant-id` confiado | Cross-tenant financeiro | **MÉDIA** |
| MR-4 | Password plaintext em tabela financeira | `gerador` — `api/register.ts:43` | Comprometimento de credenciais | **ALTA** |
| MR-5 | RBAC morto permite acesso a dados financeiros | `smg-core` — `isPlatformAdmin` bypass | Exposição financeira | **MÉDIA** |
| MR-6 | Escalão de privilégio viewer→super_admin | `smg-core` — policy `FOR ALL` | Tomada de controle financeiro | **MÉDIA** |
| MR-7 | Split-brain schema causa inconsistência financeira | `LOUGE` — `public.*` vs `lounge.*` | Dados financeiros inconsistentes | **ALTA** |
| MR-8 | Sem pricing → receita não mensurável | `LADINGPAGE` — 0 resultados | Impossível medir receita | **ALTA** |

---

## 7. Recomendações de Monetização

### 7.1 Ações Imediatas (P0)

1. **Corrigir service_role JWT** — comprometimento total de dados financeiros
2. **Corrigir RLS `USING(true)`** — tabelas financeiras totalmente abertas
3. **Implementar tenant isolation** — header confiado sem validação

### 7.2 Ações de Curto Prazo (P1)

4. **Aplicar billing draft** — `smg_invoices`, `billing_events`
5. **Ativar feature flags** — `platform_feature_flags`
6. **Definir pricing** — decisão de PO necessária
7. **Adicionar analytics de receita** — tracking de conversão

### 7.3 Ações de Médio Prazo (P2)

8. **Adaptar promoter commissions** — para comissões de equipe
9. **Implementar PDF generation** — para relatórios e contratos
10. **Definir modelo de planos** — `platform_plans` → produção

### 7.4 Decisões de PO

| # | Decisão | Motivo |
|---|---|---|
| D-1 | Preço público ou sales-led? | Sem preço, receita não mensurável |
| D-2 | "Mão de obra" → commission ou serviço? | ADR-001 exige separação |
| D-3 | Billing via smg-core ou nativo? | Draft existe mas não aplicado |
| D-4 | Feature flags como fonte de receita? | `platform_feature_flags` → monetização |
