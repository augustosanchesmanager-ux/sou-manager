# TAXONOMY.md — Glossário Oficial SMG Platform & SMG Intelligence

> **Fonte oficial de nomenclatura.** Toda documentação futura deve utilizar este documento como referência.
>
> **Última atualização:** 2026-11-04
>
> **Autoridade:** Augusto (Product Owner)
>
> **Referência Estratégica:** `docs/BRAND_ARCHITECTURE.md` (Modelo Híbrido Endossado)

---

## 1. Arquitetura de Marca & Produtos

| Camada | Nome Comercial | Assinatura / Tagline | Descrição |
|---|---|---|---|
| **Masterbrand Tech** | **SMG Intelligence** | *Business Intelligence & Service Operations* | Holding e ecossistema tecnológico central (core, dados, algoritmos e IA). |
| **Vertical Ativa** | **SMG Barber** | *The Barbershop Intelligence* | Plataforma com inteligência preditiva para barbearias de alto padrão (`barber.soumanager.com`). |
| **Vertical Planejada**| **SMG Auto** | *Automotive Business Intelligence* | Gestão de pátio e ticket médio para oficinas e estética automotiva. |

### Regras de Nomenclatura — Produto

- ✅ Sempre utilizar o nome comercial da vertical: `SMG Barber` (com tagline *The Barbershop Intelligence* quando em materiais formais)
- ❌ Nunca utilizar apenas: `Barber` ou abreviações `SMG B`
- ❌ Nunca forçar no dia a dia expressões com atrito de fala como "SMG Barber Intelligence"
- ✅ "Sou Manager": restrito à razão social ou menção transitória de 60 dias ("SMG Intelligence, antigo Sou Manager")

### 1.2 Evolução da Plataforma

A SMG Platform / SMG Intelligence foi concebida para suportar múltiplos produtos SaaS compartilhando a mesma infraestrutura técnica (multi-tenant, autenticação, observabilidade, billing, Event Driven, etc. — arquitetura 85% core / 15% vertical).

Atualmente o único produto comercial em escala ativa é o **SMG Barber**.

> **Referência:** Decisão Estratégica de Marca do PO — 2026-11-04 (`docs/BRAND_ARCHITECTURE.md`)

---

## 2. Módulos

| Módulo | Produto | Descrição |
|--------|---------|-----------|
| **Club dos Chefes** | SMG Barber | Sistema de assinatura e créditos para clientes fiéis |

### Regras de Nomenclatura — Módulos

- ✅ Sempre utilizar: `Club dos Chefes`
- ❌ Nunca utilizar apenas: `Club`, `Chefes`, `CC`
- ❌ Nunca tratar como SaaS independente

---

## 3. Plataforma

| Termo | Definição |
|-------|-----------|
| **SMG Platform** | A infraestrutura tecnológica compartilhada entre todos os produtos SMG |
| **SMG Core** | O motor de arquitetura (Application Services, Event Bus, Repository Pattern). **Não é um produto.** É a base técnica. |

### Regras de Nomenclatura — Plataforma

- ✅ `SMG Platform` — quando se refere ao ecossistema completo
- ✅ `SMG Core` — quando se refere à arquitetura técnica interna
- ❌ Nunca tratar `SMG Core` como um produto comercial
- ❌ Nunca utilizar `Core` isoladamente

---

## 4. Estrutura de Domínios

```
soumanager.com                    ← Domínio raiz
├── barber.soumanager.com         ← SMG Barber (produção) — ÚNICO DOMÍNIO ATIVO
├── admin.soumanager.com          ← Painel administrativo central
├── docs.soumanager.com           ← Documentação pública
└── status.soumanager.com         ← Status page
```

> **Nota:** Domínios para futuros produtos serão definidos quando houver decisão oficial do Product Owner.

### Regras de Domínio

- ❌ Nunca utilizar `app.soumanager.com` como domínio principal
- ✅ Cada produto possui seu próprio subdomínio
- ✅ `admin.soumanager.com` para gestão central

---

## 5. Ambientes

| Ambiente | Domínio | Supabase | Vercel | Descrição |
|----------|---------|----------|--------|-----------|
| **Development** | `localhost:3000` | Projeto dev | — | Desenvolvimento local |
| **Preview** | `pr-{id}.vercel.app` | Projeto staging | Preview | Cada PR gera um preview |
| **Demo** | `demo.soumanager.com` | Projeto demo | Production branch | Demo pública para prospects |
| **Staging** | `staging.soumanager.com` | Projeto staging | Staging branch | Validação antes de produção |
| **Production** | `{produto}.soumanager.com` | Projeto production | Production branch | Clientes reais |

### Regras de Ambiente

- ✅ Sempre 3 ambientes no mínimo: Development, Staging, Production
- ✅ Preview automático para cada PR
- ✅ Demo separada para demonstrações
- ❌ Nunca deploy direto para produção sem passar por staging

---

## 6. Multi-Tenant

| Termo | Definição |
|-------|-----------|
| **Tenant** | Unidade organizacional isolada (ex: uma barbearia) |
| **Tenant ID** | Identificador único do tenant no banco de dados |
| **Tenant Isolation** | Isolamento de dados via RLS policies |
| **Tenant Onboarding** | Processo de criação de um novo tenant |

### Regras Multi-Tenant

- ✅ Cada cliente pertence a um produto específico
- ✅ Isolamento via RLS + `tenant_id` em todas as tabelas de domínio
- ✅ Tenant resolution via subdomínio ou hostname mapping
- ❌ Nunca permitir acesso cross-tenant
- ❌ Nunca armazenar dados de tenants diferentes na mesma tabela sem isolamento

---

## 7. Termos Técnicos

| Termo | Definição |
|-------|-----------|
| **Event Bus** | Sistema de publicação/subscrição de eventos de domínio |
| **Event Store** | Repositório append-only de eventos |
| **Outbox Pattern** | Padrão de entrega confiável de eventos |
| **Upcaster** | Transformador de eventos de versões antigas para novas |
| **Replay** | Reexecução de eventos armazenados |
| **Chaos Testing** | Testes de resiliência com cenários de falha |
| **Architecture Guards** | Verificações automatizadas de conformidade arquitetural |
| **ADR** | Architecture Decision Record — registro formal de decisão |

---

## 8. Termos de Negócio

| Termo | Definição |
|-------|-----------|
| **Comanda** | Registro de serviços/produtos de um atendimento |
| **Fechamento** | Processo de encerramento e fechamento financeiro do dia |
| **Comissão** | Percentual do profissional sobre serviços prestados |
| **Settlement** | Pagamento efetivo ao profissional (diferente de comissão) |
| **Club dos Chefes** | Sistema de assinatura com créditos mensais |

### 8.1 Termos de Billing (Tenant)

| Termo | Definição |
|-------|-----------|
| **Tenant Subscription** | Assinatura SaaS do tenant (Billing 6.0.4) — **não confundir** com assinatura do Club dos Chefes (`customer_subscriptions`). Eventos usam prefixo `TenantSubscription*`. |
| **Trial** | Período de avaliação — 14 dias contados do **provisionamento** do tenant (`tenants.created_at`), não do onboarding (D3/F3). |
| **Grace Period** | Janela de tolerância após `past_due` — 5 dias antes de suspender. |
| **Transition Rule (F10)** | `draft → trial → active` é obrigatório. Nunca `draft → active` direto. |
| **Plan** | `free` (1 profissional), `pro` (5), `premium` (ilimitado). Slugs oficiais: `free`, `pro`, `premium` — o slug `elite` foi **deprecado** e normalizado para `premium` (D1). |
| **Billing Event** | Registro de auditoria em `billing_events` (ex.: `TenantTrialStarted`, `TenantSubscriptionActivated`, `TenantSubscriptionCancelled`). |
| **Billing Domain Event** | Evento de domínio difundido via EventBus (ex.: `TenantTrialStarted`, `TenantSubscriptionCreated/Updated/Cancelled`) — emitido centralmente por `TenantLifecycleService`. |
| **Invoice** | Fatura gerada pelo Billing Engine (6.0.4.4) — agregação `invoice`. |
| **Payment Attempt** | Tentativa de cobrança contra uma invoice — agregação `payment`. |

---

## 9. Nomenclatura Proibida

| ❌ Nunca utilizar | ✅ Utilizar |
|-------------------|------------|
| `Club` | `Club dos Chefes` |
| `SMG Core` (como produto) | `SMG Platform` (como produto) |
| `app.soumanager.com` | `{produto}.soumanager.com` |
| `White Label` | *(cancelado — não faz parte do roadmap)* |
| `Multi-App` | `Multi-Tenant` |
| `Barber` (sozinho) | `SMG Barber` |

---

## 10. Referências

- **Roadmap:** `ROADMAP.md`
- **Arquitetura:** `ARCHITECTURE.md`
- **ADRs:** `docs/adr/`
- **Status do Projeto:** `PROJECT_STATUS.md`
- **Maturidade:** `docs/PROJECT_MATURITY.md`

---

> **Nota para OpenCode:** Toda referência a produtos, módulos ou termos neste documento deve ser utilizada em toda documentação futura. Em caso de dúvida, consultar este documento primeiro.
