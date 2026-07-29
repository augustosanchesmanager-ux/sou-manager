# Blueprint de Criação — Agentes de Treinamento SMG

> Documento-mestre para construção de agentes (humanos e/ou IA) que onboard, treinam e certificam usuários do SMG (Sou.Manager).

---

## Índice

1. [Propósito e Escopo](#1-propósito-e-escopo)
2. [Análise Técnica: O que Existe vs. O que Está nos Docs](#2-análise-técnica-o-que-existe-vs-o-que-está-nos-docs)
3. [Classificação de Funcionalidades](#3-classificação-de-funcionalidades)
4. [Arquitetura dos Agentes de Treinamento](#4-arquitetura-dos-agentes-de-treinamento)
5. [Perfil dos Agentes por Especialidade](#5-perfil-dos-agentes-por-especialidade)
6. [Metodologia de Treinamento](#6-metodologia-de-treinamento)
7. [Sistema de Progressão](#7-sistema-de-progressão)
8. [Detecção de Erros e Correção](#8-detecção-de-erros-e-correção)
9. [Métricas de Eficácia](#9-métricas-de-eficácia)
10. [Plano de Implementação](#10-plano-de-implementação)
11. [Apêndice: Mapeamento Funcional Completo](#11-apêndice-mapeamento-funcional-completo)

---

## 1. Propósito e Escopo

### 1.1 O que é um Agente de Treinamento SMG?

Um agente de treinamento SMG é **qualquer recurso** (humano, assistente virtual, chatbot, documento interativo) capaz de:

- Onboarding de novos usuários (primeiro acesso → operação confiante)
- Diagnóstico de dificuldades operacionais
- Correção de erros recorrentes
- Certificação de proficiência por perfil
- Suporte contextual durante o uso do sistema

### 1.2 Por que Agentes?

O SMG é um sistema complexo com **5 perfis de usuário**, **47 permissões granulares**, **14 módulos de negócio** e **+70 funcionalidades**. Um treinamento único não basta. Cada perfil exige:

- Linguagem diferente (barbeiro ≠ administrador)
- Profundidade diferente (recepcionista ≠ financeiro)
- Tempo diferente (2h vs 12h)
- Abordagem diferente (prática vs conceitual)

Agentes especializados resolvem isso com **curadoria de conteúdo sob demanda**.

### 1.3 Escopo deste Documento

Este blueprint define:

- O que **já funciona** no sistema (pode ser ensinado hoje)
- O que **precisa ser melhorado** (será ensinado quando implementado)
- O que **não existe** (não ensinar, não mencionar em treinamento)
- Como **construir cada agente** (personalidade, conhecimento, metodologia)
- Como **medir sucesso** do treinamento

---

## 2. Análise Técnica: O que Existe vs. O que Está nos Docs

### 2.1 Metodologia da Análise

Cruzamos 3 fontes:
1. **Código-fonte** (commits, páginas, componentes, hooks, serviços)
2. **Documentação de treinamento** (`/docs/training/`)
3. **Roadmap e melhorias** (`IMPROVEMENTS.md`, `roadmap.md`)

### 2.2 Features Confirmadas no Código (Podem Ser Treinadas)

| Módulo | Status | Evidência no Código | Presente nos Docs? |
|--------|--------|---------------------|-------------------|
| Login/Auth | ✅ Funcional | `pages/Login.tsx`, `context/AuthContext.tsx` | ✅ Sim |
| Dashboard | ✅ Funcional | `pages/Dashboard.tsx` | ✅ Sim |
| Schedule | ✅ Funcional | `pages/Schedule.tsx`, drag/drop, conflict detection | ✅ Sim |
| Comandas | ✅ Funcional | `pages/Comandas.tsx`, `domain/comanda/` | ✅ Sim |
| Checkout/PDV | ✅ Funcional | `pages/Checkout.tsx`, multi-participant, discounts | ✅ Sim |
| Clients CRUD | ✅ Funcional | `pages/Clients.tsx`, CSV import | ✅ Sim |
| Services CRUD | ✅ Funcional | `pages/Services.tsx`, categories | ✅ Sim |
| Products CRUD | ✅ Funcional | `pages/Products.tsx`, stock | ✅ Sim |
| Team | ✅ Funcional | `pages/Team.tsx`, roles (Manager, AdminManager, Barber, Receptionist) | ✅ Parcial |
| Financial Overview | ✅ Funcional | `pages/FinancialOverview.tsx` | ✅ Sim |
| Cashflow | ✅ Funcional | `pages/Cashflow.tsx`, chart, CRUD | ✅ Sim |
| Cash Closing | ✅ Funcional (refatorado) | `pages/CashClosingPage.tsx`, `src/hooks/useCashClosing.ts`, 11 subcomponentes | ✅ Sim |
| Expenses | ✅ Funcional | `pages/Expenses.tsx` | ✅ Sim |
| Payroll | ✅ Funcional | `pages/Payroll.tsx` | ✅ Sim |
| Commissions | ✅ Funcional | `pages/Commissions.tsx`, `domain/commission/` | ✅ Sim |
| Accounts Receivable | ✅ Funcional | `pages/AccountsReceivable.tsx` | ✅ Sim |
| Receipts | ✅ Funcional | `pages/Receipts.tsx`, reversal tracking | ✅ Sim |
| ChefClub Plans | ✅ Funcional | `pages/ChefClubPlans.tsx` | ✅ Sim |
| ChefClub Subscriptions | ✅ Funcional | `pages/ChefClubSubscriptions.tsx`, lifecycle | ✅ Sim |
| ChefClub Receivables | ✅ Funcional | `pages/ChefClubReceivables.tsx` | ✅ Sim |
| Access Control | ✅ Funcional (novo) | `pages/AccessControl.tsx`, `src/lib/permissions/` (47 permissões, 7 módulos) | ✅ Sim |
| Settings | ✅ Funcional | `pages/Settings.tsx` | ✅ Sim |
| BI Dashboard | ✅ Funcional | `pages/BusinessIntelligence.tsx` | ✅ Sim |
| Strategic Dashboard | ✅ Funcional | `pages/StrategicDashboard.tsx` | ✅ Sim |
| SmartReturn (CRM) | ✅ Funcional | `pages/SmartReturn.tsx` (segmentação analítica) | ❌ Não |
| Observability | ✅ Funcional | `pages/Observability.tsx`, 14 alertas, logs | ✅ Sim |
| Offline Sync | ✅ Funcional | `pages/OfflineSync.tsx`, `src/lib/offline/` (cache, fila, logs) | ❌ Não (FAQ dizia o oposto) |
| Kiosk/Totem | ✅ Funcional | `pages/KioskPage.tsx`, `KioskAdmin.tsx`, NPS, feedback | ❌ Parcial |
| Client Portal | ✅ Funcional | `pages/PortalAdmin.tsx`, `PortalApp.tsx`, `PortalSchedule.tsx` | ❌ Não |
| Promotions | ✅ Funcional | `pages/Promotions.tsx` | ❌ Não |
| Suppliers | ✅ Funcional | `pages/Suppliers.tsx` | ❌ Não |
| Purchase Orders | ✅ Funcional | `pages/Orders.tsx`, `OrderDetails.tsx` | ❌ Não |
| Categories | ✅ Funcional | `pages/Categories.tsx` | ❌ Não |
| Operations | ✅ Funcional | `pages/Operations.tsx` | ❌ Não |
| Performance | ✅ Funcional | `pages/Performance.tsx` | ❌ Não |
| Support Tickets | ✅ Funcional | `pages/Support.tsx` | ✅ Sim |
| Onboarding Flow | ✅ Funcional | `pages/RoleSelection.tsx`, `ShopSetup.tsx`, `ProfessionalSetup.tsx` | ❌ Não |
| Admin Panel | ✅ Funcional | `pages/Admin.tsx` | ✅ Sim |
| SuperAdmin | ✅ Funcional | `pages/SuperAdmin.tsx` | ✅ Sim |
| Supabase Monitoring | ✅ Funcional | `pages/SupabaseMonitoring.tsx` | ❌ Não |
| Replay Engine | ✅ Implementado | `domain/events/replayEngine.ts` + tests | ❌ Fora do escopo |
| Event Bus/Store | ✅ Implementado | `domain/events/` completo | ❌ Fora do escopo |
| Outbox Pattern | ✅ Implementado | `domain/events/outbox/` | ❌ Fora do escopo |

### 2.3 Features nos Docs que NÃO Existem no Código (Remover dos Treinamentos)

| Feature Mencionada | Onde Aparece | Realidade | Ação |
|-------------------|-------------|-----------|------|
| Papel "Financeiro" | Doc financeiro, FAQ | Não existe como role. Acesso financeiro é via permissões do Manager. | Corrigir docs: explicar que é uma variação de permissão do gerente |
| Papel "Caixa" | FAQ | Não existe como role. | Remover menção |
| Login com Google | FAQ | Apenas e-mail/senha via Supabase Auth. | ✅ Já corrigido |
| Bloqueio de IP | Doc admin | Não implementado. | Remover menção |
| Expiração de senha (90 dias) | Doc admin | Não implementado. | Remover menção |
| Histórico de 5 senhas | Doc admin | Não implementado. | Remover menção |
| Modo manutenção | Doc admin | Não implementado. | Remover menção |
| Múltiplas filiais (visão consolidada) | FAQ | Apenas isolamento por tenant. | Corrigir: esclarecer que é por unidade |
| Conciliação bancária | IMPROVEMENTS.md | Não implementada (sugestão P1 válida) | Manter como lacuna real |
| NF-e/NFS-e | IMPROVEMENTS.md | Não implementada (sugestão P2 válida) | Manter como lacuna real |
| API pública | IMPROVEMENTS.md | Não implementada (sugestão P1 válida) | Manter como lacuna real |
| 2FA | IMPROVEMENTS.md | Não implementada (sugestão P0 válida) | Manter como lacuna real |
| LGPD tools | IMPROVEMENTS.md | Não implementada (sugestão P0 válida) | Manter como lacuna real |

### 2.4 Features no Código que os Docs Perdem (Adicionar aos Treinamentos)

| Feature | Onde Está | Perfil Impactado | Prioridade |
|---------|----------|-----------------|------------|
| SmartReturn (CRM analítico) | `pages/SmartReturn.tsx` | Gerente | Alta |
| Onboarding Flow | `pages/RoleSelection.tsx`, `ShopSetup.tsx`, `ProfessionalSetup.tsx` | Todos (primeiro contato) | Crítica |
| Offline Sync | `pages/OfflineSync.tsx`, `src/lib/offline/` | Todos (contingência) | Crítica |
| Kiosk NPS & Feedback | `KioskShopFeedback.tsx`, `KioskBarberFeedback.tsx`, `KioskAdmin.tsx` | Admin, Gerente | Alta |
| Estetica app variant | `App.tsx` (EsteticaBlockedRoute), labels | Admin | Média |
| Performance | `pages/Performance.tsx` | Gerente | Média |
| Operations | `pages/Operations.tsx` | Gerente | Média |
| Supabase Monitoring | `pages/SupabaseMonitoring.tsx` | Admin | Média |
| Promotions | `pages/Promotions.tsx` | Gerente | Alta |
| Suppliers | `pages/Suppliers.tsx` | Admin, Gerente | Média |
| Purchase Orders | `pages/Orders.tsx`, `OrderDetails.tsx` | Admin, Gerente | Média |
| Categories | `pages/Categories.tsx` | Admin | Média |
| Barber Data Scoping | commit `32ffcc4` | Barbeiro (só vê próprios dados) | Alta |
| AdminManager Role | `pages/Team.tsx` (role list) | Admin | Média |
| Granular Permissions | `src/lib/permissions/` (47 permissões) | Admin | Alta |
| Discount Audit | `src/lib/finance/discountAudit.ts` | Financeiro, Gerente | Média |
| Vouchers | `src/lib/vouchers/index.ts` | Admin, Gerente | Média |

---

## 3. Classificação de Funcionalidades

### 3.1 Legenda

| Selo | Significado | Ação para Agentes |
|------|-------------|-------------------|
| ✅ **MANTER** | Funcional, estável, documentada | Ensinar normalmente |
| 🔧 **MELHORAR** | Funcional mas com gaps de UX | Ensinar com ressalvas, documentar workarounds |
| 🏗️ **CONSTRUIR** | Não existe ou incompleta | Não ensinar até implementar |
| 🗑️ **REMOVER** | Morta, substituída ou inexistente | Remover de todos os docs e roteiros |
| ⚠️ **ATENÇÃO** | Mudou recentemente (refatoração) | Verificar docs antes de ensinar |

### 3.2 Classificação por Módulo

#### Core (✅ MANTER)
| Funcionalidade | Selo | Observação |
|---------------|------|------------|
| Login (email/senha) | ✅ | Estável |
| Dashboard | ✅ | |
| Schedule/Agenda | ✅ | Com drag/drop |
| Comandas | ✅ | |
| Checkout/PDV | ✅ | Refatorado, multi-participant |
| Clients CRUD | ✅ | |
| Services CRUD | ✅ | |
| Products CRUD | ✅ | |
| Team CRUD | ✅ | Roles: Manager, AdminManager, Barber, Receptionist |
| Settings | ✅ | |

#### Financeiro (⚠️ ATENÇÃO — refatorado recentemente)
| Funcionalidade | Selo | Observação |
|---------------|------|------------|
| Cash Closing | ⚠️ | **REFATORADO**: novos componentes, nova hook `src/hooks/useCashClosing.ts`, novas tabelas `barber_closings`, `cash_closing_events`. Docs precisam ser revisados. |
| Barber Closing Cards | ⚠️ | Novo componente `BarberClosingCard.tsx`, `BarberClosingDetailPanel.tsx` |
| ClosingTimeline | ⚠️ | Novo componente |
| Cashflow | ✅ | Estável |
| Financial Overview | ✅ | |
| Expenses | ✅ | |
| Payroll | ✅ | |
| Commissions | ✅ | |
| Accounts Receivable | ✅ | |
| Receipts | ✅ | |
| Financial Reversals | ✅ | |

#### ChefClub (✅ MANTER)
| Funcionalidade | Selo |
|---------------|------|
| Plans | ✅ |
| Subscriptions | ✅ |
| Receivables | ✅ |

#### Admin/Sistema (🔧 MELHORAR)
| Funcionalidade | Selo | Observação |
|---------------|------|------------|
| Access Control | 🔧 | Novo sistema de 47 permissões. UI pode confundir. |
| Admin Panel | ✅ | |
| SuperAdmin | ✅ | |
| Supabase Monitoring | 🔧 | Técnico demais para usuários não-dev |
| Observability | 🔧 | Dashboard técnico |
| Offline Sync | 🔧 | Funcional, mas UI pode ser confusa |
| Settings | ✅ | |

#### Módulos que os Docs Ignoram (🏗️ Adicionar ao Treinamento)
| Funcionalidade | Selo | Ação |
|---------------|------|------|
| Onboarding Flow | 🏗️ | **ADICIONAR URGENTE** aos treinamentos |
| Offline Sync | 🏗️ | **ADICIONAR URGENTE** aos treinamentos |
| SmartReturn | 🏗️ | Adicionar ao treinamento do gerente |
| Kiosk NPS | 🏗️ | Adicionar ao treinamento do admin |
| Promotions | 🏗️ | Adicionar ao treinamento do gerente |
| Suppliers/Orders | 🏗️ | Adicionar ao treinamento do admin |
| Performance | 🏗️ | Adicionar ao treinamento do gerente |
| Operations | 🏗️ | Adicionar ao treinamento do gerente |
| Estetica variant | 🏗️ | Nota explicativa nos treinamentos |

#### Features que os Docs Mencionam e NÃO Existem (🗑️ REMOVER)
| Funcionalidade | Ação |
|---------------|------|
| Papel "Financeiro" | Substituir por "Gerente com permissões financeiras" |
| Papel "Caixa" | Remover |
| Login Google | ✅ Removido |
| Bloqueio IP | Remover |
| Expiração senha | Remover |
| Modo manutenção | Remover |
| Múltiplas filiais | Esclarecer que é por tenant |

#### Features Futuras nos Docs que Permanecem Válidas (🏗️ CONSTRUIR)
| Sugestão | Prioridade | Origem |
|---------|------------|--------|
| Tour guiado (1.1) | P0 | IMPROVEMENTS.md |
| Modo sandbox (2.1) | P0 | IMPROVEMENTS.md |
| 2FA (9.1) | P0 | IMPROVEMENTS.md |
| LGPD tools (9.3) | P0 | IMPROVEMENTS.md |
| Disparo CRM automático (4.1 expandido) | P1 | IMPROVEMENTS.md |
| Conciliação bancária (3.1) | P1 | IMPROVEMENTS.md |
| API pública (8.1) | P1 | IMPROVEMENTS.md |
| Templates de permissão (6.2) | P1 | IMPROVEMENTS.md |
| Fila de espera avançada (5.1) | P1 | IMPROVEMENTS.md |
| App mobile (5.3) | P2 | IMPROVEMENTS.md |

---

## 4. Arquitetura dos Agentes de Treinamento

### 4.1 Modelo de Agentes

```
                        ┌──────────────────────────┐
                        │   ORQUESTRADOR MESTRE     │
                        │   (Supervisor de         │
                        │    Treinamento SMG)      │
                        └──────────┬───────────────┘
                                   │
           ┌───────────────────────┼───────────────────────┐
           │                       │                       │
           ▼                       ▼                       ▼
   ┌───────────────┐     ┌───────────────┐     ┌───────────────┐
   │  AGENTE       │     │  AGENTE       │     │  AGENTE       │
   │  DE PERFIL    │     │  DE MÓDULO    │     │  DE SUPORTE   │
   │  (x5)         │     │  (x14)        │     │  (x1)         │
   └───────┬───────┘     └───────┬───────┘     └───────┬───────┘
           │                     │                     │
           ▼                     ▼                     ▼
   ┌───────────────┐     ┌───────────────┐     ┌───────────────┐
   │ Conhece o     │     │ Domina um     │     │ Diagnostica   │
   │ perfil intei- │     │ módulo espe-  │     │ problemas e   │
   │ ramente       │     │ cífico        │     │ sugere corre- │
   │               │     │               │     │ ções          │
   └───────────────┘     └───────────────┘     └───────────────┘
```

### 4.2 Agentes de Perfil (5)

Cada perfil de usuário tem um **agente especialista** que:

- Conhece a jornada completa daquele perfil
- Sabe o que o perfil PODE e NÃO PODE fazer
- Adapta linguagem e profundidade ao nível do usuário
- Mantém um **mapa de progresso individual**

| Agente | Perfil | Especialização |
|--------|--------|---------------|
| **BARB** | Barbeiro | Agenda, comandas, checkout, comissão, fechamento individual |
| **RECP** | Recepcionista | Clientes, agenda, checkout, caixa, comunicação |
| **GERT** | Gerente | Tudo exceto superadmin. Foco em gestão, finanças, BI |
| **FINC** | Financeiro | Foco em fluxo de caixa, fechamento, comissões, payroll, auditoria |
| **ADMS** | Administrador | Configuração, permissões, segurança, monitoramento, superadmin |

### 4.3 Agentes de Módulo (14)

Agentes especializados em **um módulo específico** do sistema. São consultados pelos agentes de perfil quando necessário.

| Agente | Módulo | Expertise |
|--------|--------|-----------|
| MOD-SCH | Schedule | Agenda completa, conflitos, blocks, waitlist |
| MOD-CLI | Clients | CRUD, CSV, histórico, ChefClub |
| MOD-SRV | Services | Catálogo, categorias, preços |
| MOD-PRO | Products | Estoque, fornecedores, pedidos |
| MOD-COM | Comandas | Ciclo de vida, itens, participantes |
| MOD-CHK | Checkout | PDV, descontos, formas de pagamento, ChefClub credits |
| MOD-FIN | Financial | Visão geral, cashflow, recebimentos |
| MOD-CCL | CashClosing | Fechamento completo, barber cards, auditoria |
| MOD-PAY | Payroll | Folha de pagamento, comissões |
| MOD-CHF | ChefClub | Planos, assinaturas, créditos |
| MOD-PRM | Permissions | Controle de acesso, 47 permissões |
| MOD-BI | BI/Reports | Dashboards, relatórios, export |
| MOD-OBS | Observability | Métricas, alertas, logs |
| MOD-OFF | Offline | Sincronização, cache, contingência |

### 4.4 Agente de Suporte (1)

Agente **diagnosticador** que:

- Analisa sintomas reportados pelo usuário
- Cruza com permissões, estado do sistema, dados
- Sugere causa raiz e solução
- Escala para suporte humano quando necessário

---

## 5. Perfil dos Agentes por Especialidade

### 5.1 Agente BARB (Barbeiro)

**Personalidade:** Prático, direto, respeitoso. Fala a linguagem do barbeiro.

**Tom:** "Vamos resolver isso rápido. Presta atenção no passo 3."

**Conhecimento obrigatório:**
- ✅ Login, troca de senha, tema escuro/claro
- ✅ Dashboard (KPIs que o barbeiro vê)
- ✅ Agenda própria (visualizar, confirmar, concluir)
- ✅ Comandas (abrir, adicionar serviços/produtos)
- ✅ Checkout (PDV, descontos, formas de pagamento)
- ✅ ChefClub (aplicar crédito do cliente)
- ✅ Comissão (como é calculada, solo vs compartilhada)
- ✅ Fechamento individual
- ✅ Notificações
- ✅ Suporte (abrir ticket)
- ✅ Offline (como funciona, o que fazer)
- ⚠️ Barber Data Scoping: sabe que barbeiros só veem PRÓPRIOS dados

**O que NÃO pode ensinar (não faz parte do perfil):**
- Gestão de clientes (só visualizar)
- Cadastro de serviços/produtos
- Financeiro (fechamento de caixa é do gerente)
- Relatórios gerenciais
- Permissões

**Tempo estimado de treinamento:** 4h (teoria + prática supervisionada)

### 5.2 Agente RECP (Recepcionista)

**Personalidade:** Organizado, paciente, focado em atendimento.

**Tom:** "O cliente é sua prioridade. O sistema é sua ferramenta."

**Conhecimento obrigatório:**
- ✅ Dashboard (visão da recepção)
- ✅ Clientes (cadastro completo, histórico, CSV)
- ✅ Agenda (criar, editar, cancelar, waitlist, walk-in)
- ✅ Comandas (abrir, gerenciar)
- ✅ Checkout (PDV, descontos, pagamentos, ChefClub)
- ✅ Produtos (consulta, venda)
- ✅ Caixa (visão diária)
- ✅ Comunicação (lembretes, follow-up)
- ✅ Suporte
- ✅ Offline

**O que NÃO pode ensinar:**
- Cadastro de serviços/produtos
- Gestão de equipe
- Financeiro (relatórios, fechamento)
- Permissões
- ChefClub (planos, assinaturas)

**Tempo estimado de treinamento:** 6h

### 5.3 Agente GERT (Gerente)

**Personalidade:** Estratégico, orientado a dados, foco em gestão.

**Tom:** "Você precisa dos números certos para tomar a decisão certa."

**Conhecimento obrigatório (o mais abrangente):**
- ✅ Dashboard + Estratégico + BI
- ✅ Agenda completa (gerencial)
- ✅ Clientes (gestão completa)
- ✅ Serviços (catálogo)
- ✅ Produtos (estoque)
- ✅ Equipe (gestão)
- ✅ Fornecedores + Pedidos
- ✅ Promoções
- ✅ Comandas + Checkout (supervisão)
- ✅ Financeiro completo (visão geral, cashflow)
- ✅ Fechamento de caixa (completo: barber cards, timeline, export)
- ✅ Contas a pagar/receber
- ✅ Recibos + reversões
- ✅ Payroll
- ✅ Comissões (auditoria)
- ✅ Relatórios
- ✅ ChefClub (planos, assinaturas, recebíveis)
- ✅ Permissões (configurar para barbeiros/recepcionistas)
- ✅ Configurações
- ✅ Kiosk + Portal (admin)
- ✅ Observability
- ✅ SmartReturn
- ✅ Performance
- ✅ Operations
- ✅ Suporte (admin)

**Tempo estimado de treinamento:** 12h (recomendado dividir em 3 sessões de 4h)

### 5.4 Agente FINC (Financeiro)

**Personalidade:** Analítico, preciso, foco em conformidade.

**Tom:** "Cada centavo precisa ter um registro. Vamos garantir que está tudo certo."

**Conhecimento obrigatório:**
- ✅ Visão geral financeira
- ✅ Fluxo de caixa (completo)
- ✅ Sangrias e reforços
- ✅ Contas a pagar
- ✅ Contas a receber
- ✅ Recibos + reversões
- ✅ Fechamento de caixa (conferência, auditoria)
- ✅ Payroll
- ✅ Comissões (auditoria)
- ✅ Relatórios financeiros
- ✅ Auditoria (logs, ajustes)
- ✅ Controle de inconsistências
- ✅ Discount audit
- ✅ ChefClub receivables

**O que NÃO pode ensinar (operação):**
- Agenda (não é função)
- Atendimento ao cliente
- Cadastro de serviços/produtos

**Tempo estimado de treinamento:** 8h

### 5.5 Agente ADMS (Administrador)

**Personalidade:** Técnico, preciso, visão de plataforma.

**Tom:** "Sua responsabilidade é garantir que o sistema funcione para todos."

**Conhecimento obrigatório:**
- ✅ Configurações do sistema (business info, módulos)
- ✅ Gestão de usuários (criar, editar, desativar)
- ✅ Permissões (47 permissões, 7 módulos, presets)
- ✅ Profissionais + serviços + produtos (configuração)
- ✅ Fornecedores + pedidos
- ✅ ChefClub (configuração de planos)
- ✅ Kiosk (admin, NPS, temas)
- ✅ Portal (configuração)
- ✅ Segurança (sessões, RLS overview)
- ✅ Auditoria (logs completos)
- ✅ Monitoramento (Supabase, Observability)
- ✅ Admin Panel (shops, users, tickets, access requests)
- ✅ SuperAdmin (companies, subscriptions, alerts)
- ✅ Backup (procedimentos)
- ✅ Multi-App (barber, estetica, auto, club)

**Tempo estimado de treinamento:** 10h

---

## 6. Metodologia de Treinamento

### 6.1 Ciclo de Aprendizagem

Cada módulo de treinamento segue 4 estágios:

```
┌─────────────────────────────────────────────────┐
│                  1. VER                          │
│          (Vídeo + demonstração)                  │
│             5-15 minutos                         │
├─────────────────────────────────────────────────┤
│                  2. PRATICAR                     │
│         (Exercício guiado no sistema)            │
│             15-30 minutos                        │
├─────────────────────────────────────────────────┤
│                  3. VERIFICAR                    │
│        (Checklist de conclusão + quiz)           │
│             5-10 minutos                         │
├─────────────────────────────────────────────────┤
│                  4. APLICAR                      │
│     (Cenário real no dia-a-dia, supervisionado)  │
│             1-2 dias                             │
└─────────────────────────────────────────────────┘
```

### 6.2 Abordagem por Estágio do Usuário

| Estágio | Abordagem | Duração | Agente Principal |
|---------|-----------|---------|-----------------|
| 🟢 **Chegou hoje** | Tour guiado, login, navegação | 30min | Agente de Perfil |
| 🟡 **Primeira semana** | Módulos essenciais do perfil | 4-6h | Agente de Perfil |
| 🟠 **Primeiro mês** | Módulos avançados + cenários | 8-12h | Agente de Perfil + Módulo |
| 🔵 **Usuário regular** | Boas práticas, otimização | Contínuo | Agente de Suporte |
| 🟣 **Certificação** | Revisão completa + exame | 2-4h | Todos |

### 6.3 Técnicas de Ensino

| Técnica | Quando Usar | Exemplo |
|---------|------------|---------|
| **Instrução direta** | Primeiro contato com módulo | "Clique em Agenda, depois no horário vago." |
| **Descoberta guiada** | Usuário já viu o módulo | "Onde você acha que encontra o relatório de vendas?" |
| **Correção imediata** | Erro durante exercício | "Você selecionou 'Cancelar' em vez de 'Concluir'. Veja a diferença:" |
| **Cenário simulado** | Avaliação prática | "Um cliente chegou atrasado 20min. O que você faz?" |
| **Comparação** | Mostrar antes/depois | "Antes da refatoração, o fechamento era assim. Agora é assim:" |

### 6.4 Materiais de Apoio por Agente

Cada agente deve ter acesso a:

1. **Script de treinamento** - Roteiro palavra por palavra dos módulos
2. **FAQ específica** - Perguntas frequentes do perfil
3. **Checklist de conclusão** - O que o usuário precisa demonstrar
4. **Cenários reais** - Pelo menos 10 cenários com resolução
5. **Mapa de permissões** - O que o perfil pode/não pode fazer
6. **Armadilhas comuns** - Erros que usuários deste perfil mais cometem

---

## 7. Sistema de Progressão

### 7.1 Níveis de Proficiência

```
NÍVEL 1 — NOVATO
□ Consegue fazer login
□ Navega pelas telas principais
□ Conhece os ícones básicos
□ Sabe onde pedir ajuda

NÍVEL 2 — OPERACIONAL
□ Executa as tarefas diárias do perfil sem ajuda
□ Completa um ciclo de atendimento sozinho
□ Sabe o que fazer em 80% dos cenários comuns
□ Usa atalhos e boas práticas

NÍVEL 3 — AUTÔNOMO
□ Resolve problemas não-previstos
□ Ajuda colegas com dúvidas
□ Identifica oportunidades de melhoria
□ Conhece os limites do que pode fazer

NÍVEL 4 — REFERÊNCIA
□ Treina outros usuários
□ Conhece integrações (ChefClub, Kiosk, Portal)
□ Participa de teste de novas funcionalidades
□ Certificado no perfil
```

### 7.2 Critérios de Progressão

| Nível | Requisitos | Tempo Típico | Avaliação |
|-------|-----------|-------------|-----------|
| 1 → 2 | Completar módulos essenciais + 3 exercícios práticos + 1 dia de operação supervisionada | 1-2 dias | Checklist + observação |
| 2 → 3 | Completar módulos avançados + 5 cenários reais sem ajuda + 1 semana de operação independente | 1-2 semanas | Prova prática |
| 3 → 4 | 3 meses de operação sem erros críticos + certificação oficial | 3 meses + | Certificação Nível 2 ou 3 |

### 7.3 Árvore de Decisão do Agente

```
Usuário chega para treinamento
│
├─ Já usou sistema similar? → Pular módulo de navegação
├─ Erro recorrente? → Ir para correção específica
├─ Cliente antigo migrando? → Foco em diferenças (changelog)
└─ Usuário novo → Iniciar do Nível 1
```

---

## 8. Detecção de Erros e Correção

### 8.1 Erros Mais Comuns por Perfil

#### Barbeiro
| Erro | Frequência | Solução |
|------|-----------|---------|
| Fechou comanda sem registrar produto | Alta | Treinar passo-a-passo do PDV antes de finalizar |
| Esqueceu de confirmar chegada do cliente | Média | Configurar lembrete visual na agenda |
| Aplicou desconto sem permissão | Média | Reforçar que descontos precisam de autorização |
| Não entende comissão compartilhada | Alta | Usar simulação numérica no treinamento |
| Registrou serviço no profissional errado | Baixa | Verificar seleção antes de salvar |

#### Recepcionista
| Erro | Frequência | Solução |
|------|-----------|---------|
| Criou agendamento em horário conflitante | Média | Sistema já bloqueia, mas treinar leitura da agenda |
| Esqueceu de registrar pagamento | Baixa | Comanda fica aberta, treinar verificação |
| Cadastro de cliente incompleto | Alta | Tornar telefone obrigatório, treinar campos mínimos |
| Não usou lista de espera | Média | Demonstrar vantagem da lista vs. aviso manual |

#### Gerente
| Erro | Frequência | Solução |
|------|-----------|---------|
| Fechou caixa sem conferência física | Alta | Fluxo obrigatório de conferência no treinamento |
| Permissões muito permissivas | Média | Treinar princípio do menor privilégio |
| Não revisou comissões antes do payroll | Média | Checklist de fechamento mensal |
| Ignorou alertas de estoque | Baixa | Configurar notificações |

#### Financeiro
| Erro | Frequência | Solução |
|------|-----------|---------|
| Reversão sem justificativa | Média | Auditoria registra, treinar preenchimento de motivo |
| Diferença de caixa não investigada | Alta | Fluxo obrigatório: contar → comparar → investigar → ajustar |
| Payroll sem verificar comissões | Média | Checklist mensal |

#### Administrador
| Erro | Frequência | Solução |
|------|-----------|---------|
| Permissões inconsistentes entre perfis | Alta | Usar presets, evitar permissão a permissão |
| Desativou usuário sem aviso | Média | Treinar política de desativação |
| Não monitora logs de auditoria | Alta | Configurar alerta semanal |

### 8.2 Matriz de Correção

```
                    ┌──────────────────────────────────────┐
                    │         GRAVIDADE DO ERRO            │
                    │     Baixa          Alta              │
┌───────────────┬───┼──────────────────────────────────────┤
│               │Alta│ Guia rápido /     │ Intervenção     │
│ FREQUÊNCIA    │   │ FAQ contextual    │ imediata +      │
│               │   │                   │ exercício        │
│               ├───┼───────────────────┼──────────────────┤
│               │   │ Menção sutil no   │ Sessão de        │
│               │   │ treinamento       │ correção         │
│               │   │                   │ dedicada         │
└───────────────┴───┴───────────────────┴──────────────────┘
```

### 8.3 Gatilhos de Intervenção

O agente de suporte deve intervir automaticamente quando detectar:

- ❌ 3+ erros iguais em 1 hora de operação
- ❌ Qualquer erro que cause perda financeira
- ❌ Tentativa de acesso não autorizado
- ❌ Comanda aberta por mais de 24h sem movimento
- ❌ Fechamento de caixa com diferença > R$ 50 sem investigação
- ⚠️ Mais de 5 reversões no mesmo dia
- ⚠️ Mais de 3 cancelamentos de agenda no mesmo dia

---

## 9. Métricas de Eficácia

### 9.1 Indicadores de Treinamento

| Métrica | Cálculo | Meta | Frequência |
|---------|---------|------|-----------|
| **Tempo até primeiro atendimento solo** | Horas desde o login até primeira comanda fechada sem ajuda | < 8h | Por usuário |
| **Taxa de erros por sessão** | Erros detectados / operações realizadas | < 5% | Semanal |
| **Tempo médio por operação** | Tempo para abrir comanda, processar checkout, etc. | Redução de 30% em 2 semanas | Semanal |
| **NPS de treinamento** | Pesquisa pós-treinamento | > 80 | Por sessão |
| **Taxa de certificação** | Usuários certificados / total de usuários | > 90% | Mensal |
| **Tempo até certificação** | Dias entre primeiro acesso e certificação | < 30 dias | Mensal |
| **Tickets de suporte por usuário** | Tickets abertos / usuário / mês | < 2 após certificação | Mensal |

### 9.2 Dashboard do Agente

Cada agente deve ter visibilidade de:

```
┌────────────────────────────────────────────────────────┐
│  AGENTE BARB — TREINAMENTOS ATIVOS: 12                │
├────────────────────────────────────────────────────────┤
│                                                        │
│  USUÁRIO    │ NÍVEL │ MÓDULO ATUAL     │ ERROS │ TEMPO │
│─────────────┼───────┼──────────────────┼───────┼───────┤
│ João        │ 2     │ Checkout         │ 2     │ 4h    │
│ Maria       │ 1     │ Agenda           │ 5     │ 2h    │
│ Pedro       │ 3     │ Comissão         │ 0     │ 12h   │
│                                                        │
│  ⚠️ ALERTAS:                                           │
│  • Maria: 3 erros iguais em 1h — intervir              │
│  • João: sem atividade há 5 dias                        │
│                                                        │
│  MÉTRICAS DA SEMANA:                                    │
│  • Tempo médio até 1º atendimento: 6h (↓ 25%)          │
│  • Taxa de erro: 4.2% (meta < 5% ✅)                    │
│  • NPS treinamento: 85                                 │
└────────────────────────────────────────────────────────┘
```

---

## 10. Plano de Implementação

### 10.1 Fases

#### Fase 1 — Correção da Base Documental (1-2 dias)
- [ ] Corrigir FAQ (offline mode, Google login, roles)
- [ ] Corrigir IMPROVEMENTS.md (NPS, CRM)
- [ ] Remover referências a features inexistentes (Bloqueio IP, expiração senha)
- [ ] Adicionar seções faltantes (Onboarding, Offline, SmartReturn, NPS, Estetica)

#### Fase 2 — Criação dos Agentes de Perfil (3-5 dias)
- [ ] Criar script de treinamento para Agente BARB
- [ ] Criar script de treinamento para Agente RECP
- [ ] Criar script de treinamento para Agente GERT
- [ ] Criar script de treinamento para Agente FINC
- [ ] Criar script de treinamento para Agente ADMS

#### Fase 3 — Criação dos Agentes de Módulo (5-7 dias)
- [ ] MOD-SCH (Schedule)
- [ ] MOD-CLI (Clients)
- [ ] MOD-SRV (Services)
- [ ] MOD-PRO (Products)
- [ ] MOD-COM (Comandas)
- [ ] MOD-CHK (Checkout)
- [ ] MOD-FIN (Financial)
- [ ] MOD-CCL (CashClosing)
- [ ] MOD-PAY (Payroll)
- [ ] MOD-CHF (ChefClub)
- [ ] MOD-PRM (Permissions)
- [ ] MOD-BI (BI/Reports)
- [ ] MOD-OBS (Observability)
- [ ] MOD-OFF (Offline)

#### Fase 4 — Implementação na Sanchez Barber (1-2 semanas)
- [ ] Treinar 3 barbeiros usando Agente BARB
- [ ] Treinar 1 recepcionista usando Agente RECP
- [ ] Treinar 1 gerente usando Agente GERT
- [ ] Ajustar scripts com feedback real
- [ ] Validar métricas de eficácia

#### Fase 5 — Refinamento e Escala (contínuo)
- [ ] Coletar NPS de treinamento
- [ ] Ajustar com base em erros reais
- [ ] Adicionar cenários novos
- [ ] Expandir para novos clientes

### 10.2 Responsabilidades

| Papel | Responsabilidade |
|-------|-----------------|
| **Product Manager** | Validar conteúdo dos agentes contra roadmap |
| **UX Writer** | Revisar tom, linguagem, clareza dos scripts |
| **Dev responsável pelo módulo** | Validar precisão técnica do agente de módulo |
| **Trainer humano** | Conduzir primeiras sessões, ajustar com feedback |
| **Suporte** | Alimentar agente com novos erros e soluções |

### 10.3 Riscos e Mitigações

| Risco | Probabilidade | Mitigação |
|-------|--------------|-----------|
| Módulo X foi refatorado e documentação desatualizou | Alta | Checklist mensal de alinhamento código ↔ docs |
| Usuário avançou sem base | Média | Pré-requisitos obrigatórios por módulo |
| Agente IA dá informação incorreta | Média | Sempre referenciar fonte documental + humano no loop |
| Usuário não se adapta ao formato | Baixa | Oferecer agente humano como alternativa |

---

## 11. Apêndice: Mapeamento Funcional Completo

### 11.1 Todas as Páginas do Sistema × Presença nos Documentos

| Página | Perfil | No Código | No Treinamento | Ação |
|--------|--------|-----------|---------------|------|
| Login | Todos | ✅ | ✅ | Manter |
| Dashboard | Todos | ✅ | ✅ | Manter |
| StrategicDashboard | Gerente | ✅ | ✅ | Manter |
| Schedule | Todos | ✅ | ✅ | Manter |
| Clients | Gerente | ✅ | ✅ | Manter |
| Services | Gerente | ✅ | ✅ | Manter |
| Products | Gerente | ✅ | ✅ | Manter |
| Team | Gerente | ✅ | ✅ | Manter |
| Suppliers | Gerente | ✅ | ❌ | **ADICIONAR** |
| Orders | Gerente | ✅ | ❌ | **ADICIONAR** |
| OrderDetails | Gerente | ✅ | ❌ | **ADICIONAR** |
| Promotions | Gerente | ✅ | ❌ | **ADICIONAR** |
| Categories | Admin | ✅ | ❌ | **ADICIONAR** |
| Comandas | Todos | ✅ | ✅ | Manter |
| Checkout | Todos | ✅ | ✅ | Manter |
| CashClosingPage | Gerente | ✅ (refat) | ✅ | **REVISAR** (refatorado) |
| FinancialOverview | Gerente/Financeiro | ✅ | ✅ | Manter |
| Cashflow | Gerente/Financeiro | ✅ | ✅ | Manter |
| Expenses | Gerente/Financeiro | ✅ | ✅ | Manter |
| Receipts | Gerente/Financeiro | ✅ | ✅ | Manter |
| AccountsReceivable | Gerente/Financeiro | ✅ | ✅ | Manter |
| Payroll | Gerente/Financeiro | ✅ | ✅ | Manter |
| Commissions | Gerente/Financeiro | ✅ | ✅ | Manter |
| Reports | Gerente | ✅ | ✅ | Manter |
| ChefClubPlans | Gerente | ✅ | ✅ | Manter |
| ChefClubSubscriptions | Gerente | ✅ | ✅ | Manter |
| ChefClubSubscriptionNew | Gerente | ✅ | ❌ | **ADICIONAR** |
| ChefClubSubscriptionDetail | Gerente | ✅ | ❌ | **ADICIONAR** |
| ChefClubReceivables | Gerente/Financeiro | ✅ | ✅ | Manter |
| AccessControl | Admin | ✅ | ✅ | Manter |
| Settings | Admin | ✅ | ✅ | Manter |
| BusinessIntelligence | Gerente | ✅ | ✅ | Manter |
| SmartReturn | Gerente | ✅ | ❌ | **ADICIONAR** |
| Performance | Gerente | ✅ | ❌ | **ADICIONAR** |
| Operations | Gerente | ✅ | ❌ | **ADICIONAR** |
| Observability | Admin | ✅ | ✅ | Manter |
| OfflineSync | Todos | ✅ | ❌ | **ADICIONAR** |
| Admin | Admin | ✅ | ✅ | Manter |
| SuperAdmin | SuperAdmin | ✅ | ✅ | Manter |
| SupabaseMonitoring | Admin | ✅ | ❌ | **ADICIONAR** |
| KioskPage | Público (módulo) | ✅ | ❌ | **ADICIONAR** |
| KioskAdmin | Admin | ✅ | ❌ | **ADICIONAR** |
| KioskClientPage | Público (módulo) | ✅ | ❌ | **ADICIONAR** |
| PortalAdmin | Admin | ✅ | ❌ | **ADICIONAR** |
| PortalApp | Cliente | ✅ | ❌ | **ADICIONAR** |
| PortalSchedule | Cliente | ✅ | ❌ | **ADICIONAR** |
| Support | Todos | ✅ | ✅ | Manter |
| RoleSelection | Todos | ✅ | ❌ | **ADICIONAR** |
| ShopSetup | Gerente | ✅ | ❌ | **ADICIONAR** |
| ProfessionalSetup | Barbeiro | ✅ | ❌ | **ADICIONAR** |

### 11.2 Resumo de Ações

| Ação | Quantidade |
|------|-----------|
| ✅ MANTER (já nos docs) | ~35 |
| 🏗️ **ADICIONAR aos treinamentos** | **18** |
| 🔧 **REVISAR** (refatorado) | **1** (CashClosing) |
| 🗑️ **REMOVER dos docs** | **7** (roles inexistentes, segurança fictícia) |
| ✅ **CORRIGIDO** (FAQ, IMPROVEMENTS) | **4** |

### 11.3 Recomendação Final

**Prioridade zero:** Antes de qualquer treinamento ao vivo, corrigir:

1. ✅ ~FAQ (offline mode, Google login)~ → **Feito**
2. ✅ ~IMPROVEMENTS.md (NPS, CRM)~ → **Feito**
3. 🏗️ Adicionar Onboarding Flow, Offline Sync e SmartReturn aos roteiros
4. 🗑️ Remover roles Financeiro/Caixa, segurança fictícia
5. 🔧 Revisar módulo CashClosing (refatoração recente)

Após correções, o blueprint está pronto para construir os **5 agentes de perfil** que treinarão a Sanchez Barber e, posteriormente, todos os clientes do SaaS.

---

> **Documento gerado em:** 23/07/2026
> **Versão:** 1.0
> **Próxima revisão:** Após conclusão da refatoração arquitetural (Fase 4 — Event Versioning, Chaos Testing)
