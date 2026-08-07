# SMG Platform — Business Architecture

> **Fase 5 — Business Architecture**
>
> Status: ✅ Concluída (Documentação) · **ALINHADO AO ADR-013 — 2026-08-06** (Subfase 0)
>
> **Autor:** Augusto (Product Owner) + OpenCode (formatação e validação técnica)
>
> **Última atualização:** 2026-08-06
>
> **Aviso (Subfase 0):** este documento é a visão **comercial** (Fase 5). A arquitetura técnica congelada é o **ADR-013** (referência única). Detalhes operacionais vivem em `TENANT_LIFECYCLE.md`, `SUBSCRIPTION_MODEL.md` e `FEATURE_FLAGS_MODEL.md`. Em caso de divergência, o ADR prevalece.

---

## Visão Geral

Este documento documenta completamente a arquitetura de negócio da SMG Platform.

**Regra:** Nenhuma divergência entre documentação e código é aceita.

**Autoridade:** Itens comerciais (produtos, módulos, planos, preços, onboarding) são de responsabilidade do Product Owner (Augusto). Itens técnicos (estrutura, nomenclatura, validação) são de responsabilidade do OpenCode.

**Decisão Estratégica (2026-07-27):** A SMG Platform foi concebida para suportar múltiplos produtos SaaS. Atualmente existe apenas um produto comercial ativo: **SMG Barber**. Novos segmentos poderão ser desenvolvidos futuramente, mediante decisão formal do Product Owner.

---

## 1. Catálogo de Produtos

### 1.1 SMG Barber

| Campo | Valor | Status |
|-------|-------|--------|
| **Nome oficial** | SMG Barber | ✅ Definido |
| **Slug** | `barber` | ✅ Definido |
| **Domínio** | `barber.soumanager.com` | ✅ Definido |
| **Descrição** | Plataforma multi-tenant para barbearias e centros de estética | ⬜ Pendente PO |
| **Público-alvo** | Barbearias, centros de estética, salões de beleza | ⬜ Pendente PO |
| **Diferenciais** | [ pendente definição do PO ] | ⬜ Pendente PO |
| **Status** | Em desenvolvimento | ✅ |

**Módulos ativos:**
- Agendamento
- Clientes
- Serviços
- Comandas (Checkout)
- Financeiro (Fechamento de Caixa)
- Comissões
- Club dos Chefes (módulo interno)
- Relatórios
- Equipe
- Estoque (parcial)
- Configurações

### 1.2 Evolução da Plataforma

A SMG Platform foi concebida para suportar múltiplos produtos SaaS compartilhando a mesma infraestrutura técnica (multi-tenant, autenticação, observabilidade, billing, Event Driven, etc.).

Atualmente existe apenas um produto comercial ativo: **SMG Barber**.

Novos segmentos poderão ser desenvolvidos futuramente, mediante decisão formal do Product Owner. Nenhuma definição de produto, domínio, módulo ou funcionalidade para futuros segmentos deve ser documentada, implementada ou planejada antes dessa decisão.

### ⚠️ Pendências do Product Owner

| # | Item | Severidade |
|---|------|------------|
| 1 | Definir descrição e público-alvo do SMG Barber | 🟡 Alta |
| 2 | Definir diferenciais competitivos do SMG Barber | 🟡 Alta |

---

## 2. Catálogo de Módulos

### 2.1 Club dos Chefes

| Campo | Valor | Status |
|-------|-------|--------|
| **Nome oficial** | Club dos Chefes | ✅ Definido |
| **Tipo** | Módulo interno do SMG Barber (NÃO é um SaaS) | ✅ Definido |
| **Slug** | `club` (código) | ✅ |
| **Descrição** | Sistema de mensalidades e fidelização para clientes da Sanchez Barber | ✅ Documentado |
| **Status** | Implementado (domain + application + pages) | ✅ |

**Funcionalidades:**
- Planos de assinatura (criar, editar, ativar/desativar)
- Assinaturas de clientes (criar, cancelar, pausar)
- Sistema de créditos (deduzir, expirar, gerenciar)
- Cobranças (receivables)
- Ciclo de faturamento

**Fluxo:**
```
Plano → Assinatura → Cobrança → Créditos → Uso → Cancelamento
```

**⚠️ Inconsistência identificada:** O código trata `club` como AppSlug em `domain/shared/app.ts`, mas a taxonomia oficial o classifica como módulo do SMG Barber. Precisa de alinhamento.

### 2.2 Lista Completa de Módulos (SMG Barber)

| # | Módulo | Slug | Descrição | Status |
|---|--------|------|-----------|--------|
| 1 | Agendamento | `appointments` | Gerenciamento de agenda e agendamentos | ✅ |
| 2 | Clientes | `clients` | Cadastro e gestão de clientes | ✅ |
| 3 | Serviços | `services` | Catálogo de serviços oferecidos | ✅ |
| 4 | Comandas | `orders` | Comandas e checkout | ✅ |
| 5 | Financeiro | `financial` | Fechamento de caixa e relatórios financeiros | ✅ |
| 6 | Comissões | `commissions` | Cálculo e gestão de comissões | ✅ |
| 7 | Club dos Chefes | `club` | Sistema de fidelização e mensalidades | ✅ |
| 8 | Relatórios | `reports` | Dashboards e relatórios gerenciais | ✅ |
| 9 | Equipe | `team` | Gestão de profissionais | ✅ |
| 10 | Estoque | `inventory` | Controle de produtos (parcial) | 🟡 |
| 11 | Configurações | `settings` | Configurações do estabelecimento | ✅ |
| 12 | Comunicação | `communication` | Notificações e lembretes | 🟡 |
| 13 | Marketing | `marketing` | Ferramentas de marketing | ⬜ |
| 14 | Kiosk | `kiosk` | Modo kiosk para check-in | 🟡 |
| 15 | Receipts | `receipts` | Emissão de recibos | ✅ |
| 16 | Dashboard | `dashboard` | Painel principal | ✅ |
| 17 | Onboarding | `onboarding` | Fluxo de configuração inicial | 🟡 |
| 18 | Audit | `audit` | Logs de auditoria | ✅ |
| 19 | Permissions | `permissions` | Controle de acesso | ✅ |
| 20 | Events | `events` | Sistema de eventos | ✅ |

### 2.3 Relação Módulo ↔ Produto

| Módulo | SMG Barber |
|--------|:----------:|
| Agendamento | ✅ |
| Clientes | ✅ |
| Serviços | ✅ |
| Comandas | ✅ |
| Financeiro | ✅ |
| Comissões | ✅ |
| Club dos Chefes | ✅ |
| Relatórios | ✅ |
| Equipe | ✅ |
| Estoque | ✅ |
| Configurações | ✅ |

**Legenda:** ✅ Implementado

---

## 3. Taxonomia

Referência oficial: `docs/TAXONOMY.md`

### 3.1 Termos Chave

| Termo | Definição | Status |
|-------|-----------|--------|
| **SMG Platform** | Ecossistema completo (nunca usar como produto individual) | ✅ |
| **SMG Core** | Arquitetura técnica (nunca usar como produto) | ✅ |
| **Tenant** | Unidade isolada (barbearia, estabelecimento) | ✅ |
| **Comanda** | Conta/orçamento de um cliente | ✅ |
| **Checkout** | Processo de fechamento de comanda | ✅ |
| **Club dos Chefes** | Módulo de fidelização (nunca "Club" sozinho) | ✅ |

### 3.2 Termos Proibidos

| Termo Proibido | Termo Correto |
|----------------|---------------|
| `app.soumanager.com` | `{produto}.soumanager.com` |
| `Club` (sozinho) | `Club dos Chefes` |
| `SMG Core` (como produto) | `SMG Core` (arquitetura técnica) |
| `White Label` | CANCELADO |

---

## 4. Onboarding

### 4.1 Fluxo Oficial (Decisão do PO — 2026-07-28)

```
1. Usuário realiza seu cadastro (nome, email, senha)
   ↓
2. E-mail é validado
   ↓
3. Tenant é criado
   ↓
4. Primeira unidade da empresa é criada automaticamente
   ↓
5. Usuário torna-se Owner do Tenant
   ↓
6. Configurações iniciais da barbearia são gravadas
   ↓
7. Sistema direciona para o primeiro acesso
   ↓
8. Usuário conclui a configuração inicial da operação
```

**Regra:** Nenhum dado operacional (clientes, funcionários, serviços, agenda, comandas etc.) é criado automaticamente. Apenas a estrutura mínima necessária para funcionamento da plataforma.

### 4.2 Status da Implementação

| Etapa | UI | Persistência | Status |
|-------|:--:|:------------:|--------|
| Cadastro Auth | ✅ | ✅ | ✅ Completo |
| Seleção de Role | ✅ | ✅ | ✅ Completo |
| ShopSetup | ✅ | ❌ | 🟡 UI pronta, sem DB |
| ProfessionalSetup | ✅ | ❌ | 🟡 UI pronta, sem DB |
| Checklist | ✅ | ✅ | ✅ Completo |

### ⚠️ Gaps Críticos

| # | Gap | Impacto |
|---|-----|---------|
| 1 | **Sem criação de Tenant** — ShopSetup não salva nada no banco | 🔴 Onboarding quebrado |
| 2 | **Sem vínculo user→tenant** — Profissional não é associado ao tenant | 🔴 Dados órfãos |
| 3 | **Sem configurações iniciais** — Dados da barbearia não são gravados | 🟡 UX ruim |

---

## 5. Fluxo de Criação de Tenant

### 5.1 Status Atual

| Componente | Existe | Funcional |
|-----------|:------:|:---------:|
| UI de criação | ❌ | ❌ |
| RPC/Edge Function | ❌ | ❌ |
| Validação de dados | ❌ | ❌ |
| Geração de slug | ❌ | ❌ |
| Configurações iniciais | ❌ | ❌ |
| Vinculação user→tenant | ❌ | ❌ |

### 5.2 Fluxo Oficial (Decisão do PO — 2026-07-28)

```
1. Usuário realiza seu cadastro
   ↓
2. E-mail é validado
   ↓
3. Tenant é criado
   ↓
4. Primeira unidade da empresa é criada
   ↓
5. Usuário torna-se Owner do Tenant
   ↓
6. Configurações iniciais da barbearia são gravadas
   ↓
7. Sistema direciona para o primeiro acesso
   ↓
8. Usuário conclui a configuração inicial da operação
```

**Regra:** Nenhum dado operacional é criado automaticamente. Apenas a estrutura mínima necessária.

### ⚠️ Pendências do Product Owner

| # | Item | Status |
|---|------|--------|
| 1 | Dados obrigatórios para criação de tenant | ✅ Definido (fluxo 8 etapas) |
| 2 | Dados iniciais do tenant | ✅ Definido (nenhum dado operacional) |
| 3 | Regra de geração de slug | ⬜ Pendente |
| 4 | Fluxo de convite de profissionais | ⬜ Pendente |

---

## 6. Fluxo de Assinatura (Club dos Chefes)

### 6.1 Status Atual

| Componente | Existe | Funcional |
|-----------|:------:|:---------:|
| Planos | ✅ | ✅ |
| Assinaturas | ✅ | ✅ |
| Créditos | ✅ | ✅ |
| Cobranças | ✅ | ✅ |
| Ciclo de faturamento | ✅ | ✅ |
| Gateway de pagamento | ❌ | ❌ |
| Billing automático | ❌ | ❌ |

### 6.2 Fluxo Atual

```
1. Admin cria plano (nome, valor, créditos, duração)
   ↓
2. Admin cria assinatura para cliente
   ↓
3. Sistema gera cobrança (receivable)
   ↓
4. Admin registra pagamento manualmente
   ↓
5. Sistema credita créditos ao cliente
   ↓
6. Cliente utiliza créditos em serviços
```

### 6.3 Fluxo Desejado (Fase 5.5)

> **Escopo (ADR-013):** o fluxo abaixo pertence ao módulo **Club dos Chefes** (assinaturas de *clientes* da barbearia) — **fora** do escopo do ADR-013, que governa a **assinatura da plataforma** (`subscriptions`, do tenant). Não confundir os dois modelos: planos do Club são criados pelo admin do tenant; planos da plataforma são `free`/`pro`/`premium`.

```
1. Cliente escolhe plano
   ↓
2. Sistema cria assinatura
   ↓
3. Gateway de pagamento cobra automaticamente
   ↓
4. Se pagamento OK → créditos liberados
   ↓
5. Se pagamento falha → grace period → suspensão
   ↓
6. Renovação automática no ciclo seguinte
```

### ⚠️ Pendências do Product Owner

| # | Item | Status |
|---|------|--------|
| 1 | Gateway de pagamento | ⬜ Pendente (escolha futura) |
| 2 | Planos oficiais (nome, valor, créditos, duração) | ✅ Definido (**por tenant** — criados pelo admin; NÃO são os planos da plataforma `free/pro/premium`) |
| 3 | Grace period após vencimento | ⬜ Pendente (Club; na plataforma é 5 dias — janela) |
| 4 | Política de cancelamento | ⬜ Pendente |
| 5 | Política de retenção de dados | ⬜ Pendente |

---

## 7. Papéis e Permissões

### 7.1 Papéis do Sistema

| Papel | Escopo | Acesso | Status |
|-------|--------|--------|--------|
| `superadmin` | Global (todos os tenants) | Total, bypassa RLS | ✅ |
| `manager` | Tenant (admin/owner) | Total dentro do tenant | ✅ |
| `barber` | Tenant (profissional) | Própria agenda, comissões | ✅ |
| `receptionist` | Tenant (atendente) | Agendamento, clientes, sem financeiro | ✅ |
| `staff` | Tenant (genérico) | Variável | ✅ |
| `seller` | Tenant (vendedor) | Própria agenda, comissões | ⚠️ Não documentado |

### 7.2 Permissões por Papel

Referência completa: `src/lib/permissions/definitions.ts` (55 permissões)

| Módulo | superadmin | manager | barber | receptionist |
|--------|:----------:|:-------:|:------:|:------------:|
| schedule | ✅ | ✅ | ✅ (próprio) | ✅ |
| clients | ✅ | ✅ | ✅ (próprio) | ✅ |
| services | ✅ | ✅ | 👁️ | 👁️ |
| financial | ✅ | ✅ | ❌ | ❌ |
| team | ✅ | ✅ | ❌ | ❌ |
| reports | ✅ | ✅ | 👁️ (próprio) | ❌ |
| communication | ✅ | ✅ | ✅ | ✅ |

**Legenda:** ✅ Total | 👁️ Somente visualização | ❌ Sem acesso

### ⚠️ Pendências do Product Owner

| # | Item | Status |
|---|------|--------|
| 1 | Confirmar se `seller` é um papel oficial | ⬜ Pendente |
| 2 | Definir se `cashier` é necessário | ⬜ Pendente |
| 3 | Definir regras de herança de permissões | ⬜ Pendente |
| 4 | Documentar quem pode convidar/remover profissionais | ⬜ Pendente |

---

## 8. Planos Comerciais

### 8.1 Estrutura Atual

> **Alinhamento 6.0.5:** `tenants.plan` CHECK real = `('free', 'pro', 'premium')` (migration `20260806020000`). O nome comercial "Elite" é **obsoleto** — o plano premium é `premium`.

| Campo | Valores | Status |
|-------|---------|--------|
| Planos | `free`, `pro`, `premium` | ✅ Definido no DB (CHECK) |
| Feature flags | ⚠️ Parcial (enforcement via `moduleRegistry` + `PLAN_LIMITS`; tabela/persistência é proposta 6.0.5.3) | 🟡 |
| Limites por plano | Configuráveis (único implementado: `max_staff` free=1/pro=5/premium=∞) | ✅ Definido |
| Feature gating | ⚠️ Parcial (`chef_club` por plano + módulos por app) | 🟡 |

### 8.2 Definição dos Planos (Decisão do PO — 2026-07-28)

| Plano | Objetivo | Status |
|-------|----------|--------|
| **free** | Permitir que pequenas barbearias conheçam a plataforma. Disponibiliza apenas funcionalidades essenciais. | ✅ Definido |
| **pro** | Plano principal da plataforma. Atende praticamente toda a operação da barbearia. Será o plano recomendado comercialmente. | ✅ Definido |
| **premium** (era "Elite") | Plano premium. Destinado a empresas que desejam recursos avançados, BI, automações e futuras integrações. | ✅ Definido |

**Regra:** A documentação **não deve** definir preços, pois isso pertence à estratégia comercial e poderá mudar sem impacto na arquitetura.

### 8.3 Limites por Plano

**Decisão do PO (2026-07-28):** A arquitetura deve controlar limites utilizando **Feature Flags** e configurações por plano. Não documentar valores numéricos. Esses limites serão administrados pelo catálogo comercial futuramente.

A documentação deve apenas garantir que a arquitetura suporta:
- habilitação/desabilitação de funcionalidades;
- limites configuráveis por plano;
- expansão futura sem alteração estrutural.

### ⚠️ Pendências do Product Owner

| # | Item | Status |
|---|------|--------|
| 1 | Nomes dos planos | ✅ Definido (free, pro, premium — Elite obsoleto) |
| 2 | Preços dos planos | ⬜ Pendente (estratégia comercial) |
| 3 | Funcionalidades por plano | ✅ Definido (catálogo em `FEATURE_FLAGS_MODEL.md`) |
| 4 | Limites por plano | ✅ Definido (configurável; implementado: `max_staff` free=1/pro=5/premium=∞) |
| 5 | Período de trial | ✅ Definido (**14 dias** do provisionamento — D3, âncora `tenants.created_at`) |
| 6 | Regras de upgrade/downgrade | ⬜ Pendente (BillingService — 6.0.5.2) |

---

## 9. Ciclo de Vida do Tenant

### 9.1 Estados Atuais no Código

> **Alinhamento 6.0.5:** `tenants.active` (boolean) é **legado** — foi substituído por `tenants.status` (ENUM `tenant_status`, 7 valores). `tenants.plan` é `free/pro/premium` (CHECK). Referência completa: `TENANT_LIFECYCLE.md`.

| Campo | Tipo | Valores | Location |
|-------|------|---------|----------|
| `tenants.status` | `tenant_status` (enum) | draft/trial/active/past_due/suspended/cancelled/archived | tenant.ts |
| `tenants.plan` | `string` (CHECK) | free/pro/premium | tenant.ts |
| `profiles.status` | `string` | pending/active/suspended | AuthContext.tsx |

### 9.2 Estados Oficiais (Decisão do PO — 2026-07-28; máquina congelada — ADR-013 §5)

> **Alinhamento 6.0.5:** cancelamento é **pedido** (`cancel_at_period_end`) — **não é transição**. Reativação é `suspended → active`, **nunca** `cancelled → active`. `suspended` e retenção dependem de D-6.0.5-1/2/4.

```
                     ┌─────────────┐
                     │    draft    │ ← Tenant criado durante o onboarding
                     └──────┬──────┘
                            │ Onboarding completo (F10)
                            ▼
                     ┌─────────────┐
                     │    trial    │ ← Período de avaliação (14d)
                     └──────┬──────┘
                            │ Assinatura ativada (engine)
                            ▼
                     ┌─────────────┐
                     │   active    │ ← Assinatura ativa e funcionamento normal
                     └──────┬──────┘
                            │ Vencimento sem pagamento (engine)
                            ▼
                     ┌─────────────┐
                     │  past_due   │ ← Pagamento pendente — grace (5 dias, janela)
                     └──────┬──────┘
                            │ Grace expirado [6.0.5]
                            ▼
                     ┌─────────────┐
                     │  suspended  │ ← Acesso bloqueado [6.0.5]
                     └──────┬──────┘
                            │ Pagamento confirmado → active
                            │ Retenção (D-6.0.5-4)
                            ▼
                     ┌─────────────┐
                     │  cancelled  │ ← cancel_at_period_end atingido (efetivação)
                     └──────┬──────┘
                            │ Retenção administrativa (D-6.0.5-4)
                            ▼
                     ┌─────────────┐
                     │  archived   │ ← Tenant arquivado (dados preservados, F5)
                     └─────────────┘
```

### 9.3 Transições de Estado

> **Alinhamento:** transições efetivadas pelo **Billing Engine** (`apply_subscription_transition`/`runCycle`) + writer único (TenantLifecycleService — ADR-013 §3.1).

| De | Para | Evento |
|----|------|--------|
| draft | trial | Onboarding completo |
| trial | active | Assinatura ativada / trial expirado (free) |
| active | past_due | Vencimento sem pagamento |
| past_due | active | Pagamento confirmado |
| past_due | suspended | Grace expirado **[6.0.5.4]** |
| suspended | active | Pagamento confirmado (reativação) **[6.0.5.4]** |
| suspended | cancelled | Retenção encerrada *(D-6.0.5-4)* |
| active | cancelled | `cancel_at_period_end` atingido (efetivação) |
| cancelled | archived | Retenção administrativa *(D-6.0.5-4)* |

### ⚠️ Pendências do Product Owner

| # | Item | Status |
|---|------|--------|
| 1 | Estados do lifecycle | ✅ Definido (draft, trial, active, past_due, suspended, cancelled, archived) |
| 2 | Grace period padrão | ✅ Definido (**janela de 5 dias** após vencimento — nunca status) |
| 3 | O que acontece com dados ao cancelar | ✅ Definido (dados **preservados** — F5; nunca excluídos automaticamente) |
| 4 | Período de retenção de dados | ⬜ Pendente (D-6.0.5-4) |
| 5 | Processo de reativação | ⬜ Pendente (reativação = `suspended → active`; `cancelled → active` não existe — D-6.0.5-2) |

---

## 10. Estratégia de Domínios

### 10.1 Domínio Oficial

```
soumanager.com
├── barber.soumanager.com        ← SMG Barber (ÚNICO DOMÍNIO ATIVO)
├── admin.soumanager.com         ← Administração
├── docs.soumanager.com          ← Documentação
└── status.soumanager.com        ← Status page
```

> **Nota:** Domínios para futuros produtos serão definidos quando houver decisão oficial do Product Owner.

### 10.2 Resolução de Domínio

**Implementado em:** `src/middleware/resolveApp.ts`

```
1. VITE_APP_HOSTNAME_MAP (match exato)
   ↓ (fallback)
2. VITE_LOCAL_APP_SLUG (localhost only)
   ↓ (fallback)
3. Heurística de subdomínio (barber.*, auto.*, etc.)
   ↓ (fallback)
4. barber (padrão)
```

### ⚠️ Pendências do Product Owner

| # | Item | Prioridade |
|---|------|-----------|
| 1 | Definir suporte a domínios customizados por tenant | 🟡 |
| 2 | Definir configuração DNS | 🟡 |

---

## Resumo de Decisões e Pendências do Product Owner

> **Todas as decisões abaixo são exclusivamente sobre o SMG Barber.**

### ✅ Decisões Incorporadas (2026-07-28)

| # | Decisão | Seção |
|---|---------|-------|
| 1 | Fluxo de onboarding: 8 etapas, sem dados operacionais automáticos | 4, 5 |
| 2 | Lifecycle: draft → trial → active → past_due → suspended → cancelled → archived (máquina congelada — ADR-013 §5) | 9 |
| 3 | Planos: free, pro, premium. Sem preços na documentação | 8 |
| 4 | Limites: configuráveis por plano, sem valores fixos (implementado: `max_staff`) | 8 |

### 🔴 Pendências Restantes (Bloqueiam Fase 5)

| # | Item | Seção |
|---|-------|------|
| 1 | Definir descrição e público-alvo do SMG Barber | 1 |
| 2 | Definir gateway de pagamento (futuro) | 6 |
| 3 | Decisões de negócio D-6.0.5-1..8 (suspensão, reativação, retenção) | 9 |

### 🟡 Pendências Altas (Recomendadas antes da Fase 6)

| # | Item | Seção |
|---|------|-------|
| 4 | Definir horários padrão | 5 |
| 5 | Definir fluxo de convite de profissionais | 5 |
| 6 | Definir regras de upgrade/downgrade | 8 |
| 7 | Confirmar se `seller` e `cashier` são papéis oficiais | 7 |
| 8 | Definir regras de herança de permissões | 7 |

### 🟠 Médias (Podem ser definidas depois)

| # | Item | Seção |
|---|------|-------|
| 9 | Definir suporte a domínios customizados por tenant | 10 |
| 10 | Definir diferenciais competitivos do SMG Barber | 1 |

---

## Próximos Passos

1. **Product Owner** deve responder às 3 pendências críticas (itens 1-3 acima)
2. **OpenCode** deve validar respostas e atualizar este documento
3. **Após aprovação:** Iniciar Fase 5.5 (SaaS Core Architecture)
4. **Fase 5.5** definirá a arquitetura técnica de multi-tenant e billing

---

## Referências

- **Arquitetura oficial (congelada):** `docs/adr/ADR-013-billing-tenant-featureflags.md` (Accepted, 2026-08-06)
- `docs/SUBSCRIPTION_MODEL.md` — Contrato comercial
- `docs/TENANT_LIFECYCLE.md` / `docs/LIFECYCLE_MODEL.md` — Ciclo de vida
- `docs/FEATURE_FLAGS_MODEL.md` — Catálogo e matriz de flags
- `docs/TAXONOMY.md` — Glossário oficial
- `docs/REGRA_DE_NEGOCIO_SMG_BARBER.md` — Regras de negócio
- `docs/FUNCIONALIDADES.md` — Inventário de funcionalidades
- `src/lib/permissions/definitions.ts` — 55 permissões definidas
- `src/modules/` — Definições de módulos
- `domain/shared/app.ts` — App slugs oficiais
- `src/middleware/resolveApp.ts` — Resolução de domínio

---

## Mudanças

| Data | Versão | Alteração |
|------|--------|-----------|
| 2026-08-06 | 4.0 | **Subfase 0 (ADR-013).** Alinhamento: planos `free/pro/premium` (Elite obsoleto; CHECK real), trial 14 dias (D3), máquina congelada (cancelamento=pedido; reativação=suspended→active), `tenants.status` enum (active boolean legado), grace=janela de 5 dias, retenção=dados preservados (F5), Club dos Chefes fora do escopo do ADR-013, dependências D-6.0.5 explícitas. Sem alteração de código. |
| 2026-07-28 | 3.0 | Fase 5 CONCLUÍDA. 5 definições finais incorporadas: Grace Period, Retenção de Dados, Gateway (adapters), Notificações (camada própria), Auditoria (eventos existentes). |
| 2026-07-28 | 2.0 | Decisões do PO incorporadas: onboarding (8 etapas), lifecycle (7 estados), billing (mensal), planos (Free/Pro/Elite), hierarquia de papéis. Pendências reduzidas. |
| 2026-07-27 | 1.0 | Criação do documento |
