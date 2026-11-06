# ADR-041 — Arquitetura de Marketplace e Catálogo de Extensões

> **Status:** `ACCEPTED` (Aprovado formalmente pelo PO Augusto em 2026-11-06)  
> **Data:** 2026-11-06  
> **Decisores:** Augusto (PO) · Antigravity (Platform Architect)  
> **Fase do Roadmap:** Fase 8 (Commercial Scalability) — Subfase 8.4 (Marketplace)  
> **Contexto Técnico:** SMG Platform (SMG Barber) · Supabase PostgreSQL RLS · Edge Functions  

---

## 1. Contexto

Com a implementação e homologação da **Public API (Subfase 8.2)** e do **Webhook Dispatcher (Subfase 8.3)** através do **ADR-032**, a SMG Platform adquiriu a infraestrutura fundamental para operar como uma plataforma aberta a integrações de terceiros.

A **Subfase 8.4 (Marketplace)** tem como objetivo transformar essa capacidade técnica em uma alavanca de expansão comercial para o produto ativo **SMG Barber** (*The Barbershop Intelligence*), permitindo que desenvolvedores parceiros, fornecedores de hardware e empresas de tecnologia disponibilizem extensões, conectores e complementos que podem ser descobertos, contratados e instalados pelas barbearias diretamente pelo Cockpit da barbearia.

### Casos de Uso no Ecossistema de Barbearias:
1. **Hardware & Automação Física:** Conectores com catracas de acesso, impressoras térmicas de bancada e totens de autoatendimento.
2. **Engajamento & Canais de Atendimento:** Bots avançados de WhatsApp com IA conversacional, disparadores de campanhas SMS e programas de fidelidade gamificados.
3. **Contabilidade & Fiscal:** Conectores com ERPs contábeis (ex: ContaAzul, Omie) e emissores de NFS-e automatizados.
4. **BI & Analytics:** Dashboards analíticos de produtividade por cadeira e predição de churn de clientes do Club dos Chefes.

---

## 2. Problema

Permitir a instalação de extensões de terceiros em um ambiente SaaS multi-tenant impõe riscos críticos:
1. **Vazamento Cross-Tenant:** Uma extensão maliciosa ou mal configurada não pode, sob nenhuma hipótese, acessar dados de barbearias que não autorizaram expressamente sua instalação.
2. **Elevação Indevida de Privilégios:** A extensão não pode executar operações fora do escopo funcional estritamente aprovado pelo dono/gerente da barbearia.
3. **Falta de Governança sobre Extensões Não Auditadas:** Extensões sem validação de segurança não podem ser publicadas no catálogo geral sem processo formal de curadoria e auditoria técnica (*Review & Approval*).
4. **Cobrança Desarticulada:** Extensões pagas necessitam de modelo de billing integrado ao ciclo de vida da assinatura da barbearia, evitando fragmentação financeira.

---

## 3. Decisão Arquitetural

Fica estabelecida a arquitetura do **Marketplace de Extensões da SMG Platform** baseada em 4 pilares:

### 3.1 Catálogo Central de Extensões (`public.marketplace_extensions`)
Tabela centralizada de catálogo, com ciclo de vida estrito:
- **Status do Ciclo:** `draft` $\rightarrow$ `under_review` $\rightarrow$ `published` $\rightarrow$ `deprecated`.
- **Descoberta:** Visível para todos os tenants autenticados apenas quando `status = 'published'` e `active = true`.
- **Escopos Declarados (`required_scopes`):** Lista explícita de permissões da Public API requeridas pela extensão (ex: `['appointments:read', 'comandas:read']`).
- **Modelo de Preço (`pricing_type`):**
  - `free`: Gratuito para todos os planos.
  - `subscription`: Mensalidade recorrente vinculada à fatura do tenant.
  - `one_time`: Taxa única de ativação/licenciamento.

### 3.2 Instalação e Consentimento por Tenant (`public.tenant_extensions`)
Cada instalação cria um registro explícito e imutável vinculado ao `tenant_id`:
- **Consentimento Explícito:** O dono da barbearia precisa revisar e aceitar os escopos da Public API solicitados pela extensão antes da ativação.
- **Configurações Específicas (`settings` JSONB):** Armazenamento de parâmetros próprios da extensão por barbearia (ex: credencial de hardware, webhook customizado, token de parceiro) criptografados ou isolados.
- **Isolamento RLS:** Regra estrita onde cada barbearia só enxerga e manipula suas próprias extensões instaladas (`tenant_id = current_effective_tenant_id()`).

### 3.3 Sistema de Curadoria e Aprovação (*Review & Approval*)
- Apenas usuários com privilégio de Super-Admin (`current_is_super_admin_from_auth_uid()`) possuem autorização para alterar o status de uma extensão para `published` ou revogá-la.
- Processo de submissão inclui:
  1. Análise de código e endpoints utilizados;
  2. Testes de segurança em ambiente Sandbox (`smg_test_`);
  3. Validação de conformidade com os Webhooks e Public API (ADR-032).

### 3.4 Avaliações e Reputação da Comunidade (`public.extension_reviews`)
- Barbearias com a extensão instalada podem avaliar o complemento com nota de 1 a 5 estrelas e comentário técnico/operacional.
- Restrição RLS: Apenas tenants com instalação ativa podem submeter avaliações, impedindo avaliações falsas (*sybil attack*).

---

## 4. Modelagem de Dados Proposta (PostgreSQL)

```sql
-- 1. Catálogo de Extensões
CREATE TABLE IF NOT EXISTS public.marketplace_extensions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             TEXT NOT NULL UNIQUE,
  name             TEXT NOT NULL,
  headline         TEXT NOT NULL,
  description      TEXT NOT NULL,
  developer_name   TEXT NOT NULL,
  developer_email  TEXT NOT NULL,
  developer_url    TEXT NULL,
  category         TEXT NOT NULL CHECK (category IN ('hardware', 'communication', 'fiscal', 'analytics', 'marketing', 'other')),
  icon_url         TEXT NULL,
  banner_url       TEXT NULL,
  version          TEXT NOT NULL DEFAULT '1.0.0',
  pricing_type     TEXT NOT NULL CHECK (pricing_type IN ('free', 'subscription', 'one_time')),
  price_cents      INT NOT NULL DEFAULT 0,
  required_scopes  TEXT[] NOT NULL DEFAULT '{}',
  webhook_events   TEXT[] NOT NULL DEFAULT '{}',
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'under_review', 'published', 'deprecated')),
  rating_avg       NUMERIC(3,2) NOT NULL DEFAULT 5.00,
  install_count    INT NOT NULL DEFAULT 0,
  active           BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Instalações por Barbearia (Tenant)
CREATE TABLE IF NOT EXISTS public.tenant_extensions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  extension_id     UUID NOT NULL REFERENCES public.marketplace_extensions(id) ON DELETE CASCADE,
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'uninstalled')),
  granted_scopes   TEXT[] NOT NULL DEFAULT '{}',
  settings         JSONB NOT NULL DEFAULT '{}'::jsonb,
  installed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  uninstalled_at   TIMESTAMPTZ NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_tenant_extension UNIQUE (tenant_id, extension_id)
);

-- 3. Avaliações de Extensões
CREATE TABLE IF NOT EXISTS public.extension_reviews (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  extension_id     UUID NOT NULL REFERENCES public.marketplace_extensions(id) ON DELETE CASCADE,
  tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating           INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment          TEXT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_tenant_extension_review UNIQUE (extension_id, tenant_id)
);
```

---

## 5. RLS & Segurança

1. **Catálogo (`marketplace_extensions`):**
   - `SELECT`: Liberado para usuários autenticados quando `status = 'published'` e `active = true` (ou para Super-Admin de forma irrestrita).
   - `INSERT / UPDATE / DELETE`: Exclusivo para Super-Admin.
2. **Instalações (`tenant_extensions`):**
   - `SELECT / INSERT / UPDATE / DELETE`: Restrito a `tenant_id = current_effective_tenant_id()` ou Super-Admin.
3. **Avaliações (`extension_reviews`):**
   - `SELECT`: Público/Autenticado para leitura das notas e comentários.
   - `INSERT / UPDATE`: Restrito ao tenant proprietário com checagem de que a extensão está instalada em `tenant_extensions`.

---

## 6. Consequências e Trade-offs

### Positivas:
- **Modularidade Total:** Novas funcionalidades especializadas não inflam o core monolítico do SMG Barber.
- **Segurança Transparente:** O dono da barbearia tem controle granular sobre quais dados cada extensão pode acessar (RBAC por escopos).
- **Monetização & Parcerias:** Permite modelos de receita compartilhada (*revenue share*) e atração de integradores independentes.

### Atenções & Mitigações:
- **Sandbox Mandatório:** Desenvolvedores parceiros devem homologar exclusivamente via ambiente Sandbox (`smg_test_`).
- **Desativação Imediata (Kill-Switch):** Super-Admin pode revogar ou desativar uma extensão centralmente a qualquer momento em caso de vulnerabilidade detectada, suspendendo automaticamente todas as instalações nos tenants.

---

## 7. Próximos Passos (Após Aprovação do PO)

1. Validação e aprovação formal do ADR pelo PO Augusto (`PROPOSED` $\rightarrow$ `ACCEPTED`).
2. Atualização de `docs/adr/README.md` indexando o ADR-041.
3. Criação da migration SQL canônica local com as tabelas, índices e políticas RLS.
4. Implementação dos serviços de backend / RPCs de catálogo, instalação e reviews.
5. Suíte de testes unitários dedicada para integridade de catálogo e RLS multi-tenant.
