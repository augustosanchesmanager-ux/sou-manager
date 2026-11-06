# ADR-041 — Arquitetura de Faturamento da Plataforma SMG (Platform Billing) e Métricas de SaaS

> **Status:** `ACCEPTED` (Aprovado formalmente pelo PO Augusto em 2026-11-06)  
> **Data:** 2026-11-06  
> **Decisores:** Augusto (PO) · Antigravity (Platform Architect)  
> **Fase do Roadmap:** Fase 8 (Commercial Scalability) — Subfase 8.6 (Billing da Plataforma)  
> **Contexto Técnico:** SMG Platform (SMG Barber) · Supabase PostgreSQL RLS · ADR-013 (Tenant Lifecycle & Billing) · Super-Admin Observability  

---

## 1. Contexto

Com a abertura comercial da SMG Platform estabelecida nas Subfases 8.2 (Public API), 8.3 (Webhooks), 8.4 (Marketplace) e 8.5 (Integrações Core), a **Subfase 8.6 (Billing da Plataforma)** formaliza o mecanismo corporativo de cobrança da **SMG Platform para os estabelecimentos clientes (Barbearias / Tenants)**.

### Distinção Crítica de Domínio:
- **Billing de Clientes da Barbearia (Club dos Chefes):** Domínio de negócio em `domain/billing/` e `customer_plan_subscriptions` onde a barbearia cobra de seus clientes finais planos de assinatura de corte/barba.
- **Billing da Plataforma SMG (Platform Billing):** Domínio corporativo em que a SMG Platform cobra a mensalidade de software das barbearias contratantes (SaaS Subscription), monitora a inadimplência, emite faturas e calcula os indicadores executivos de SaaS (MRR, ARR, LTV e Churn).

---

## 2. Problema

A cobrança de mensalidades SaaS em uma arquitetura multi-tenant impõe desafios vitais:
1. **Desacoplamento do Ciclo de Vida (ADR-013):** O status financeiro da fatura não pode contaminar diretamente a máquina de estados do tenant sem passar pela esteira formal de carência (*grace period*);
2. **Multi-Unidade & Escala de Cadeiras:** Barbearias com múltiplas unidades e redes de franquias necessitam de faturamento consolidado ou cobrança proporcional por cadeira ativa (*seat-based pricing*);
3. **Auditoria e Transparência para o Dono:** O gestor da barbearia precisa acessar um histórico transparente de todas as faturas pagas e pendentes da plataforma diretamente pelo Cockpit, sem risco de visualizar cobranças de outros estabelecimentos;
4. **Visão Executiva Centralizada para o Super-Admin:** A diretoria da SMG necessita de cálculo determinístico e em tempo real dos indicadores de SaaS (MRR por plano, inadimplência e churn rate).

---

## 3. Decisão Arquitetural

Fica estabelecida a arquitetura de **Platform Billing da SMG Platform** baseada em 4 pilares:

### 3.1 Catálogo Oficial de Planos SaaS (`public.platform_plans`)
Definição dos planos comerciais da plataforma:
- **Planos Canônicos:**
  - `Starter`: Até 2 profissionais/cadeiras, agendamento e comandas básicas;
  - `Pro`: Até 6 profissionais/cadeiras, Public API (300 RPM), Webhooks e relatórios avançados;
  - `Enterprise`: Cadeiras ilimitadas, multi-unidade, SLA dedicado e concorrência customizada.
- **Ciclos de Cobrança (`billing_interval`):** `monthly` (mensal) ou `yearly` (anual com desconto).
- **Limites e Quotas (`features` JSONB):** Quota de cadeiras (`max_staff`), requisições de API (`max_api_rpm`) e módulos inclusos.

### 3.2 Assinaturas das Barbearias (`public.platform_subscriptions`)
Cada barbearia (`tenants.id`) possui uma assinatura de software ativa:
- **Status da Assinatura:** `trialing` (período de testes), `active` (em dia), `past_due` (fatura em aberto dentro da carência), `canceled` (cancelada) ou `paused`.
- **Controle de Período Vigente:** `current_period_start` e `current_period_end`.
- **Grace Period (Carência):** Janela de 5 dias corridos após o vencimento antes do acionamento da suspensão de acesso pelo motor de ciclo de vida (ADR-013).

### 3.3 Gestão de Faturas da Plataforma (`public.platform_invoices`)
Faturas emitidas pela SMG para a barbearia:
- **Status da Fatura:** `pending` (aguardando pagamento), `paid` (liquidada), `overdue` (vencida) ou `void` (cancelada).
- **Valores e Taxas:** `amount_cents` (valor total), `discount_cents` e `paid_at`.
- **Meios de Liquidação:** Linha digitável de boleto, Pix Copia e Cola (QR Code dinâmico) ou link de pagamento seguro.

### 3.4 RPCs e Métricas Executivas de SaaS (Super-Admin)
- RPC `public.get_saas_executive_metrics()`: Agrega em tempo real:
  - **MRR (Monthly Recurring Revenue):** Soma das assinaturas ativas normalizadas para base mensal;
  - **ARR (Annual Recurring Revenue):** $\text{MRR} \times 12$;
  - **Contagem de Assinantes:** Distribuídos por plano (`Starter`, `Pro`, `Enterprise`);
  - **Inadimplência (Past Due Volume):** Total em atraso aguardando regularização;
  - **Churn Rate:** Percentual de cancelamentos nos últimos 30 dias.

---

## 4. Modelagem de Dados Proposta (PostgreSQL)

```sql
-- 1. Planos Comerciais da Plataforma
CREATE TABLE IF NOT EXISTS public.platform_plans (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             TEXT NOT NULL UNIQUE,
  name             TEXT NOT NULL,
  description      TEXT NOT NULL,
  price_cents      INT NOT NULL,
  billing_interval TEXT NOT NULL CHECK (billing_interval IN ('monthly', 'yearly')),
  max_staff        INT NOT NULL DEFAULT 2,
  max_api_rpm      INT NOT NULL DEFAULT 60,
  features         JSONB NOT NULL DEFAULT '{}'::jsonb,
  active           BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Assinaturas das Barbearias
CREATE TABLE IF NOT EXISTS public.platform_subscriptions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_id              UUID NOT NULL REFERENCES public.platform_plans(id) ON DELETE RESTRICT,
  status               TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'paused')),
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end   TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  canceled_at          TIMESTAMPTZ NULL,
  trial_ends_at        TIMESTAMPTZ NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Faturas Emitidas pela SMG para as Barbearias
CREATE TABLE IF NOT EXISTS public.platform_invoices (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id  UUID NOT NULL REFERENCES public.platform_subscriptions(id) ON DELETE CASCADE,
  tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_number   TEXT NOT NULL UNIQUE,
  amount_cents     INT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'void')),
  due_date         DATE NOT NULL,
  paid_at          TIMESTAMPTZ NULL,
  payment_method   TEXT NULL CHECK (payment_method IN ('pix', 'credit_card', 'boleto')),
  payment_link     TEXT NULL,
  pdf_url          TEXT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 5. RLS & Segurança

1. **`platform_plans`:**
   - `SELECT`: Liberado para usuários autenticados para que donos de barbearia vejam opções de upgrade de plano;
   - `INSERT / UPDATE / DELETE`: Exclusivo de Super-Admin.
2. **`platform_subscriptions`:**
   - `SELECT`: Restrito a `tenant_id = public.current_effective_tenant_id() OR public.current_is_super_admin_from_auth_uid()`;
   - Mutações de plano/status gerenciadas por RPCs de segurança com validação de permissão gerencial ou Super-Admin.
3. **`platform_invoices`:**
   - `SELECT`: Cada barbearia só visualiza suas próprias faturas (`tenant_id = public.current_effective_tenant_id()`);
   - Super-Admin tem visão global de faturamento para fins de conciliação fiscal e cobrança.

---

## 6. Consequências & Trade-offs

### Positivas:
- **Previsibilidade Financeira:** Gestão automatizada do fluxo de faturamento da SMG Platform;
- **Governança de Acesso Justa:** Notificação prévia de vencimento e aplicação de carência (*grace period*) antes da suspensão automática;
- **Clareza Executiva:** Métricas vitais de SaaS disponíveis em tempo real sem planilhas externas.

### Mitigações:
- **Idempotência de Webhook de Pagamento:** Confirmações de pagamento de faturas da plataforma via Pix/Boleto devem ser protegidas por chave de idempotência para evitar duplicidade de baixa.

---

## 7. Próximos Passos (Após Aprovação do PO)

1. Aprovação formal do ADR-041 pelo PO Augusto (`PROPOSED` $\rightarrow$ `ACCEPTED`);
2. Atualização do índice `docs/adr/README.md`;
3. Criação da migration SQL canônica local com as tabelas, índices e RLS;
4. Implementação do serviço `services/platformBillingService.ts` e suíte de testes unitários dedicada.
