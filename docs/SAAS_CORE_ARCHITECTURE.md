# SMG Platform — SaaS Core Architecture

> **Fase 5.5 — SaaS Core Architecture**
>
> Status: ✅ Concluída (Documentação + Design)
>
> **Autor:** Augusto (Product Owner) + OpenCode (formatação e validação técnica)
>
> **Última atualização:** 2026-07-28

---

## Visão Geral

Este documento define **como a plataforma SaaS funciona** — os mecanismos que permitem novos clientes entrarem, serem gerenciados, evoluírem de plano, receberem suporte e escalarem a operação.

**Diferença entre Fase 5 e Fase 5.5:**

| Fase | Pergunta | Escopo |
|------|----------|--------|
| **Fase 5** | *O que é a plataforma?* | Produtos, módulos, taxonomia, papéis |
| **Fase 5.5** | *Como a plataforma funciona?* | Nascimento, lifecycle, billing, features, provisionamento |

**Regra:** Toda decisão aqui influencia diretamente a implementação técnica. Nenhuma decisão é "apenas documentação" — cada bloco define estrutura de banco, APIs, UI e comportamento do sistema.

---

## Bloco 1 — Customer Onboarding (Como Nasce um Cliente)

### Pergunta Central

> Quando alguém compra o SMG Barber... o que acontece?

### Fluxo Completo (Decisão do PO — 2026-07-28)

```
1. Visitante acessa barber.soumanager.com
   ↓
2. Clica em "Começar Grátis" ou "Assinar"
   ↓
3. Usuário realiza seu cadastro (nome, email, senha)
   ↓
4. E-mail é validado
   ↓
5. Tenant é criado
   ↓
6. Primeira unidade da empresa é criada automaticamente
   ↓
7. Usuário torna-se Owner do Tenant
   ↓
8. Configurações iniciais da barbearia são gravadas
   ↓
9. Sistema direciona para o primeiro acesso
   ↓
10. Usuário conclui a configuração inicial da operação
```

**Regra:** Nenhum dado operacional (clientes, funcionários, serviços, agenda, comandas etc.) é criado automaticamente. Apenas a estrutura mínima necessária para funcionamento da plataforma.

### ⚠️ Pendências do PO

| # | Item | Status |
|---|------|--------|
| 1 | Dados obrigatórios de cadastro | ✅ Definido (fluxo 8 etapas) |
| 2 | Dados iniciais criados automaticamente | ✅ Definido (nenhum dado operacional) |
| 3 | Horários padrão | ⬜ Pendente |
| 4 | Fluxo de convite para profissionais | ⬜ Pendente |

---

## Bloco 2 — Tenant Lifecycle (Como Funciona um Tenant)

### Estados (Decisão do PO — 2026-07-28)

```
                     ┌──────────────┐
                     │    draft     │ ← Tenant criado durante o onboarding
                     └──────┬───────┘
                            │ Onboarding completo
                            ▼
                     ┌──────────────┐
                     │    trial     │ ← Período de avaliação da plataforma
                     └──────┬───────┘
                            │ Assinatura ativada
                            ▼
                     ┌──────────────┐
              ┌──────│    active    │ ← Assinatura ativa e funcionamento normal
              │      └──────┬───────┘
              │             │
       Reativação    Pagamento vencido
              │             │
              │             ▼
              │      ┌──────────────┐
              │      │  past_due    │ ← Pagamento pendente
              │      └──────┬───────┘
              │             │ Grace period expirado
              │             ▼
              │      ┌──────────────┐
              │      │  suspended   │ ← Acesso temporariamente bloqueado
              │      └──────┬───────┘
              │             │ Cancelamento ou inatividade
              │             ▼
              │      ┌──────────────┐
              └──────│  cancelled   │ ← Assinatura encerrada
                     └──────┬───────┘
                            │ Período de retenção expirado
                            ▼
                     ┌──────────────┐
                     │  archived    │ ← Tenant arquivado
                     └──────────────┘
```

### Transições de Estado

| De | Para | Evento | Ação |
|----|------|--------|------|
| draft | trial | Onboarding completo | Iniciar período de avaliação |
| trial | active | Assinatura ativada | Habilitar acesso total |
| active | past_due | Pagamento vencido | Notificar, iniciar grace period |
| past_due | active | Pagamento confirmado | Reabilitar acesso |
| past_due | suspended | Grace period expirado | Bloquear acesso, manter dados |
| suspended | active | Pagamento confirmado | Reabilitar acesso (reativação) |
| suspended | cancelled | Cancelamento solicitado | Iniciar retenção de dados |
| active | cancelled | Cancelamento solicitado (sem pagamento pendente) | Iniciar retenção de dados |
| cancelled | archived | Período de retenção expirado | Arquivar dados |

### Impacto por Estado

| Estado | Login | Agendamentos | Financeiro | Club dos Chefes | Relatórios |
|--------|:-----:|:------------:|:----------:|:---------------:|:----------:|
| draft | ✅ | ❌ | ❌ | ❌ | ❌ |
| trial | ✅ | ✅ | ✅ | ✅ | ✅ |
| active | ✅ | ✅ | ✅ | ✅ | ✅ |
| past_due | ✅ | ⚠️ Read-only | ❌ | ⚠️ Read-only | ⚠️ Read-only |
| suspended | ❌ | ❌ | ❌ | ❌ | ❌ |
| cancelled | ❌ | ❌ | ❌ | ❌ | ❌ |
| archived | ❌ | ❌ | ❌ | ❌ | ❌ |

### Notificações por Transição

| Transição | Canal | Timing |
|-----------|-------|--------|
| draft → trial | Email + In-app | Imediato |
| trial → active | Email + In-app | Imediato |
| active → past_due | Email | Dia do vencimento |
| past_due → suspended | Email + In-app | Ao expirar grace period |
| suspended → active | Email + In-app | Imediato |
| active/suspended → cancelled | Email | Imediato |
| cancelled → archived | Email | Após período de retenção |

### ⚠️ Pendências do PO

| # | Item | Status |
|---|------|--------|
| 1 | Estados do lifecycle | ✅ Definido (draft, trial, active, past_due, suspended, cancelled, archived) |
| 2 | Grace period | ✅ Definido (tolerância após falha de pagamento, configurável) |
| 3 | Retenção de dados | ✅ Definido (tenant arquivado por período recuperável, exclusão conforme LGPD) |
| 4 | Auditoria de transições | ✅ Definido (eventos críticos registrados via infraestrutura de eventos) |

---

## Bloco 3 — Billing Architecture (Como Funciona o Billing)

### Decisão do PO (2026-07-28)

A plataforma utilizará **cobrança recorrente mensal**. A arquitetura permanece **desacoplada do gateway de pagamento**. O gateway definitivo será escolhido futuramente. A estrutura deve suportar expansão para diferentes meios de pagamento sem alteração arquitetural.

**Exemplos futuros (não definidos):** Cartão, PIX, Boleto, outros gateways.

### Modelo de Cobrança

| Tipo | Recorrência | Status |
|------|:----------:|--------|
| Assinatura recorrente | Mensal | ✅ Definido |
| Assinatura anual | Anual | ⬜ Futuro |
| Boleto mensal | Mensal | ⬜ Futuro |
| PIX recorrente | Mensal | ⬜ Futuro |

### Ciclo de Faturamento

```
Dia do vencimento → Gerar cobrança → Enviar ao gateway → Aguardar pagamento
                                                            ↓
                                                  ┌─────────┴─────────┐
                                                  │                   │
                                             Pago OK            Pagamento falhou
                                                  │                   │
                                                  ▼                   ▼
                                            Ativar créditos    Grace period
                                                                  │
                                                            ┌─────┴─────┐
                                                            │           │
                                                       Pago OK    Expirou
                                                            │           │
                                                            ▼           ▼
                                                      Ativar       Suspender
```

### Notificações de Pagamento

| Evento | Canal | Mensagem |
|--------|-------|----------|
| Cobrança gerada | Email + In-app | "Sua assinatura foi renovada" |
| Lembrete (3 dias antes) | Email | "Sua assinatura vence em 3 dias" |
| Pagamento confirmado | Email + In-app | "Pagamento confirmado!" |
| Pagamento falhou | Email + In-app | "Houve um problema com seu pagamento" |
| Grace period (dia 3) | Email + In-app | "Seu pagamento está atrasado há 3 dias" |
| Suspensão | Email + In-app | "Sua assinatura foi suspensa" |

### ⚠️ Pendências do PO

| # | Item | Status |
|---|------|--------|
| 1 | Modelo de cobrança | ✅ Definido (recorrência mensal) |
| 2 | Gateway de pagamento | ✅ Definido (arquitetura desacoplada via adapters, substituição futura sem impacto) |
| 3 | Meios de pagamento aceitos | ✅ Definido (expansão futura via adapters) |
| 4 | NFe | ⬜ Pendente |
| 5 | Política de reembolso | ⬜ Pendente |

---

## Bloco 3.5 — Notifications (Camada de Notificações)

### Decisão do PO (2026-07-28)

A plataforma deverá possuir uma **camada própria de notificações**. Os canais serão definidos futuramente. A arquitetura não deve depender de um único provedor.

### Princípios

| Princípio | Descrição |
|-----------|-----------|
| **Canais configuráveis** | E-mail, push, WhatsApp, SMS ou outros — definidos futuramente |
| **Provedor desacoplado** | A arquitetura não depende de um único provedor |
| **Extensível** | Novos canais podem ser adicionados sem alteração estrutural |

### Eventos que Disparam Notificações

| Evento | Canal | Status |
|--------|-------|--------|
| Onboarding completo | Configurável | ⬜ Futuro |
| Pagamento confirmado | Configurável | ⬜ Futuro |
| Pagamento falhou | Configurável | ⬜ Futuro |
| Grace period (lembrete) | Configurável | ⬜ Futuro |
| Suspensão | Configurável | ⬜ Futuro |
| Cancelamento | Configurável | ⬜ Futuro |
| Reativação | Configurável | ⬜ Futuro |

---

## Bloco 3.6 — Audit & History (Auditoria e Histórico)

### Decisão do PO (2026-07-28)

Toda alteração crítica do tenant deverá permanecer auditável. Eventos como criação, alteração de plano, suspensão, cancelamento, reativação e exclusão lógica devem permanecer registrados utilizando a infraestrutura de eventos já existente.

**Não implementar nada nesta etapa; apenas documentar.**

### Eventos Críticos a Serem Auditados

| Evento | Aggregate | Status |
|--------|-----------|--------|
| Criação do tenant | tenant | ✅ Documentado |
| Alteração de plano | tenant | ✅ Documentado |
| Suspensão | tenant | ✅ Documentado |
| Cancelamento | tenant | ✅ Documentado |
| Reativação | tenant | ✅ Documentado |
| Exclusão lógica | tenant | ✅ Documentado |

### Infraestrutura

- Utilizar `event_store` existente (Fase 4.3)
- Utilizar `appEventBus` para publicação
- Utilizar `AuditSubscriber` para persistência

---

## Bloco 4 — Feature Flags (Como o Código Sabe o Que Abrir)

### Conceito

Feature flags são a ponte entre **planos comerciais** e **comportamento do código**.

```
Plano Free → Feature Flag: club_dos_chefes = false → Botão "Club" não aparece
Plano Pro → Feature Flag: club_dos_chefes = true → Botão "Club" aparece
```

### Catálogo de Features

#### Por Módulo

| Módulo | Feature | Free | Pro | Elite |
|--------|---------|:----:|:---:|:-----:|
| **Agenda** | Agendamento básico | ✅ | ✅ | ✅ |
| | Agendamento recorrente | ❌ | ✅ | ✅ |
| | Bloqueio de horário | ❌ | ✅ | ✅ |
| | Lista de espera | ❌ | ❌ | ✅ |
| **Clientes** | Cadastro de clientes | ✅ | ✅ | ✅ |
| | Histórico de visitas | ✅ | ✅ | ✅ |
| | Ficha completa | ❌ | ✅ | ✅ |
| | Importação em lote | ❌ | ❌ | ✅ |
| **Financeiro** | Abertura/fechamento de caixa | ✅ | ✅ | ✅ |
| | Sangria/Suprimento | ✅ | ✅ | ✅ |
| | Relatório financeiro básico | ✅ | ✅ | ✅ |
| | Relatório financeiro avançado | ❌ | ❌ | ✅ |
| **Comissões** | Cálculo de comissão | ✅ | ✅ | ✅ |
| | Relatório de comissões | ❌ | ✅ | ✅ |
| **Club dos Chefes** | Planos e assinaturas | ❌ | ✅ | ✅ |
| | Sistema de créditos | ❌ | ✅ | ✅ |
| | Dashboard Club | ❌ | ❌ | ✅ |
| **Relatórios** | Dashboard básico | ✅ | ✅ | ✅ |
| | Relatórios por período | ❌ | ✅ | ✅ |
| | BI e analytics | ❌ | ❌ | ✅ |
| **Equipe** | Cadastro de profissionais | ≤2 | ≤10 | ∞ |
| | Escala de horários | ❌ | ✅ | ✅ |
| **Estoque** | Controle básico | ❌ | ✅ | ✅ |
| | Relatório de estoque | ❌ | ❌ | ✅ |
| **Admin** | Configurações básicas | ✅ | ✅ | ✅ |
| | Multi-unidade | ❌ | ❌ | ✅ |
| | API pública | ❌ | ❌ | ✅ |

#### Limites Numéricos

**Decisão do PO (2026-07-28):** A documentação **não deve** definir valores numéricos. Limites são configuráveis por plano e administrados pelo catálogo comercial. A arquitetura deve apenas suportar:

- habilitação/desabilitação de funcionalidades;
- limites configuráveis por plano;
- expansão futura sem alteração estrutural.

| Limite | Free | Pro | Elite |
|--------|:----:|:---:|:-----:|
| Profissionais | Configurável | Configurável | Configurável |
| Clientes cadastrados | Configurável | Configurável | Configurável |
| Agendamentos/mês | Configurável | Configurável | Configurável |
| Serviços | Configurável | Configurável | Configurável |
| Produtos | Configurável | Configurável | Configurável |
| Storage | Configurável | Configurável | Configurável |
| Relatórios/mês | Configurável | Configurável | Configurável |

### Implementação Técnica

```typescript
// Exemplo de uso no código
const { hasFeature, getLimit } = useFeatureFlags();

// Verificar se feature está habilitada
if (hasFeature('club_dos_chefes')) {
  // Mostrar módulo Club dos Chefes
}

// Verificar limite
const limit = getLimit('max_professionals');
if (currentStaff >= limit) {
  // Mostrar upgrade prompt
}
```

### ⚠️ Pendências do PO

| # | Item | Status |
|---|------|--------|
| 1 | Lista de features por plano | ✅ Definido (catálogo acima) |
| 2 | Limites numéricos por plano | ✅ Definido (configurável, sem valores fixos) |
| 3 | Comportamento ao atingir limite | ⬜ Pendente |
| 4 | Override de feature flags por tenant | ⬜ Pendente |

---

## Bloco 5 — Provisionamento (Como a Criação Acontece)

### Fluxo Oficial (Decisão do PO — 2026-07-28)

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

**Regra:** Nenhum dado operacional (clientes, funcionários, serviços, agenda, comandas etc.) é criado automaticamente. Apenas a estrutura mínima necessária para funcionamento da plataforma.

### Quem Cria?

| Opção | Quando Usar | Complexidade | Status |
|-------|-------------|:------------:|--------|
| **Edge Function** | Criação via UI (onboarding) | 🟡 Média | ⬜ |
| **RPC** | Criação via API/integração | 🟡 Média | ⬜ |
| **Worker (fila)** | Criação em lote, async | 🔴 Alta | ⬜ |
| **Webhook** | Criação por parceiro externo | 🔴 Alta | ⬜ |

**Recomendação:** Edge Function para onboarding via UI. RPC para integrações futuras.

### Transacionalidade

| Opção | Descrição | Recomendação |
|-------|-----------|-------------|
| **Tudo ou nada** | Se qualquer etapa falhar, tudo é revertido | ✅ Recomendado |
| **Parcial** | Criar o que conseguir, marcar erros | ❌ Evitar |
| **Retry automático** | Retry em caso de falha transient | ✅ Para etapas independentes |

### Idempotência

- Criação de tenant deve ser idempotente por `owner_email`
- Se o mesmo email tentar criar dois tenants, retornar o existente
- Chave de idempotência: `email + slug`

### ⚠️ Pendências do PO

| # | Item | Status |
|---|------|--------|
| 1 | Ordem de criação | ✅ Definido (fluxo 8 etapas) |
| 2 | Transacionalidade | ⬜ Pendente |
| 3 | Comportamento em caso de erro | ⬜ Pendente |
| 4 | Provisionamento em lote (revendedores) | ⬜ Pendente |

---

## Bloco 6 — Official Catalog (Catálogo Oficial)

### Estrutura

```
SMG Platform
│
├── Produto Comercial Ativo
│     └── SMG Barber (barber.soumanager.com)
│         ├── Módulos
│         │   ├── Agenda
│         │   │   ├── Agendamento
│         │   │   ├── Bloqueio de Horário
│         │   │   ├── Confirmacao Automatica
│         │   │   └── Lista de Espera
│         │   ├── Clientes
│         │   │   ├── Cadastro
│         │   │   ├── Historico
│         │   │   ├── Ficha Completa
│         │   │   └── Importacao
│         │   ├── Serviços
│         │   │   ├── Cadastro
│         │   │   ├── Categorias
│         │   │   └── Duracao
│         │   ├── Comandas (PDV)
│         │   │   ├── Criar Comanda
│         │   │   ├── Adicionar Itens
│         │   │   ├── Checkout
│         │   │   └── NFe
│         │   ├── Financeiro (Caixa)
│         │   │   ├── Abertura
│         │   │   ├── Movimentacoes
│         │   │   ├── Sangria/Suprimento
│         │   │   └── Fechamento
│         │   ├── Comissões
│         │   │   ├── Calculo
│         │   │   ├── Rateio
│         │   │   └── Relatorio
│         │   ├── Club dos Chefes
│         │   │   ├── Planos
│         │   │   ├── Assinaturas
│         │   │   ├── Creditos
│         │   │   └── Cobrancas
│         │   ├── Relatórios
│         │   │   ├── Dashboard
│         │   │   ├── Financeiro
│         │   │   ├── Comissao
│         │   │   └── Exportacao
│         │   ├── BI
│         │   │   ├── Dashboard
│         │   │   ├── Analytics
│         │   │   └── Tendencias
│         │   ├── Equipe
│         │   │   ├── Cadastro
│         │   │   ├── Escala
│         │   │   └── Comissao
│         │   ├── Estoque
│         │   │   ├── Produtos
│         │   │   ├── Entrada
│         │   │   ├── Saida
│         │   │   └── Relatorio
│         │   ├── Configurações
│         │   │   ├── Horarios
│         │   │   ├── Pagamento
│         │   │   ├── Notificacoes
│         │   │   └── Integracoes
│         │   └── Administração
│         │       ├── Usuarios
│         │       ├── Permissoes
│         │       ├── Audit Log
│         │       └── Backup
│         │
│         ├── Features (por módulo) → Ver Bloco 4
│         ├── Permissões (por role) → Ver Bloco 8
│         ├── Planos
│         │   ├── Free
│         │   ├── Pro
│         │   └── Elite
│         └── Dependências
│             ├── Club dos Chefes depende de: Clientes, Serviços
│             ├── Comissões depende de: Serviços, Equipe
│             ├── BI depende de: Relatórios, Financeiro
│             └── Estoque depende de: Serviços (produtos vinculados)
│
└── Evolução da Plataforma
      └── A plataforma foi concebida para suportar múltiplos produtos.
          Novos segmentos poderão ser desenvolvidos futuramente,
          mediante decisão formal do Product Owner.
```

### Usuários do Catálogo

| Usuário | Usa o Catálogo Para |
|---------|---------------------|
| **Comercial** | Vender planos, mostrar funcionalidades |
| **Onboarding** | Guiar novo cliente, criar tenant |
| **Suporte** | Diagnosticar problemas, orientar uso |
| **Documentação** | Gerar manuais, tutoriais, FAQs |
| **Desenvolvimento** | Implementar features, criar testes |

---

## Bloco 7 — Module Architecture (Arquitetura de Módulos)

### Árvore Completa

```
SMG Barber
│
├── 📅 Agenda
│   ├── Agendamento (criar, editar, cancelar)
│   ├── Bloqueio de Horário
│   ├── Confirmacao Automatica (email/SMS)
│   ├── Lista de Espera
│   └── Recorrência
│
├── 👥 Clientes
│   ├── Cadastro (nome, telefone, email)
│   ├── Histórico de Visitas
│   ├── Ficha Completa (notas, preferências)
│   ├── Importação em Lote (CSV)
│   └── Exportação
│
├── 💇 Serviços
│   ├── Cadastro (nome, duração, valor)
│   ├── Categorias
│   ├── Serviços vinculados a profissionais
│   └── Promocões
│
├── 🧾 Comandas (PDV)
│   ├── Criar Comanda
│   ├── Adicionar Itens (serviços + produtos)
│   ├── Checkout (pagamento)
│   ├── NFe
│   └── Recibo
│
├── 💰 Financeiro (Caixa)
│   ├── Abertura de Caixa
│   ├── Movimentações (entradas)
│   ├── Sangria / Suprimento
│   ├── Fechamento de Caixa
│   └── Relatório do Dia
│
├── 💵 Comissões
│   ├── Cálculo (por profissional)
│   ├── Rateio (por serviço)
│   ├── Relatório de Comissões
│   └── Exportação
│
├── 🏆 Club dos Chefes
│   ├── Planos (criar, editar)
│   ├── Assinaturas (criar, cancelar)
│   ├── Créditos (deduzir, expirar)
│   ├── Cobranças
│   └── Dashboard
│
├── 📊 Relatórios
│   ├── Dashboard Geral
│   ├── Relatório Financeiro
│   ├── Relatório de Comissões
│   ├── Relatório de Clientes
│   ├── Relatório de Agendamentos
│   └── Exportação (CSV/PDF)
│
├── 📈 BI
│   ├── Dashboard Executivo
│   ├── Analytics
│   ├── Tendências
│   └── Comparativos
│
├── 👨‍💼 Equipe
│   ├── Cadastro de Profissionais
│   ├── Escala de Horários
│   ├── Comissão Individual
│   └── Desempenho
│
├── 📦 Estoque
│   ├── Cadastro de Produtos
│   ├── Entrada de Estoque
│   ├── Saída de Estoque (venda)
│   ├── Relatório de Estoque
│   └── Alertas de Estoque Baixo
│
├── ⚙️ Configurações
│   ├── Horários de Funcionamento
│   ├── Formas de Pagamento
│   ├── Notificações
│   ├── Integrações
│   └── Dados do Estabelecimento
│
└── 🔐 Administração
    ├── Gerenciar Usuários
    ├── Permissões (RBAC)
    ├── Audit Log
    └── Backup / Exportação
```

### Dependências entre Módulos

```mermaid
graph TD
    A[Agenda] --> B[Clientes]
    A --> C[Serviços]
    D[Comandas] --> B
    D --> C
    E[Financeiro] --> D
    F[Comissões] --> C
    F --> G[Equipe]
    H[Club dos Chefes] --> B
    H --> C
    I[Relatórios] --> E
    I --> F
    I --> A
    J[BI] --> I
    K[Estoque] --> D
    L[Configurações] --> A
    L --> G
```

---

## Bloco 8 — Roles & Permissions Matrix (Matriz de Papéis e Permissões)

### Hierarquia de Papéis

```
Owner (dono do tenant)
  └── Administrador (acesso total dentro do tenant)
        └── Gerente (acesso operacional, sem configurações críticas)
              ├── Recepcionista (agendamento + clientes, sem financeiro)
              ├── Barbeiro (própria agenda + comissões)
              └── Caixa (financeiro, sem agendamento)
```

### Matriz de Permissões

| Ação | Owner | Admin | Gerente | Recepcionista | Barbeiro | Caixa |
|------|:-----:|:-----:|:-------:|:-------------:|:--------:|:-----:|
| **Agenda** |
| Ver agenda | ✅ | ✅ | ✅ | ✅ | ✅ (própria) | ❌ |
| Criar agendamento | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Editar agendamento | ✅ | ✅ | ✅ | ✅ | ✅ (próprio) | ❌ |
| Cancelar agendamento | ✅ | ✅ | ✅ | ✅ | ✅ (próprio) | ❌ |
| Bloquear horário | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Clientes** |
| Ver clientes | ✅ | ✅ | ✅ | ✅ | ✅ (próprios) | ❌ |
| Criar cliente | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Editar cliente | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Excluir cliente | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Serviços** |
| Ver serviços | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Criar serviço | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Editar serviço | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Excluir serviço | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Comandas** |
| Ver comandas | ✅ | ✅ | ✅ | ✅ | ✅ (próprias) | ✅ |
| Criar comanda | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Adicionar itens | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Checkout | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| **Financeiro** |
| Ver caixa | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Abrir caixa | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Fechar caixa | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Sangria/Suprimento | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| **Comissões** |
| Ver comissões | ✅ | ✅ | ✅ | ❌ | ✅ (próprias) | ❌ |
| Editar regras | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Club dos Chefes** |
| Ver planos | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Criar/editar planos | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Gerenciar assinaturas | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Relatórios** |
| Ver dashboard | ✅ | ✅ | ✅ | ❌ | ✅ (próprios) | ❌ |
| Ver relatórios financeiros | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Exportar dados | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Configurações** |
| Ver configurações | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Editar horários | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Editar dados do salão | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Administração** |
| Gerenciar usuários | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Editar permissões | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Ver audit log | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Backup / Exportação | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

### ⚠️ Pendências do PO

| # | Item | Status |
|---|------|--------|
| 1 | Hierarquia de papéis | ✅ Definido (Owner → Admin → Gerente → Recepcionista → Barbeiro → Caixa) |
| 2 | Matriz de permissões | ✅ Definido (tabela acima) |
| 3 | Papéis `seller` e `cashier` | ⬜ Pendente |
| 4 | Regras de herança | ⬜ Pendente |
| 5 | Quem pode convidar/remover profissionais | ⬜ Pendente |

---

## Bloco 9 — Data Structure Multi-Tenant

### Tabelas Compartilhadas (public schema)

| Tabela | Descrição |
|--------|-----------|
| `profiles` | Usuários (auth) |
| `tenants` | Tenants (estabelecimentos) |
| `user_tenants` | Vínculo user→tenant |
| `plans` | Planos da plataforma |
| `audit_logs` | Logs de auditoria globais |

### Tabelas por Tenant (barber schema)

| Tabela | Descrição |
|--------|-----------|
| `staff` | Profissionais do tenant |
| `clients` | Clientes do tenant |
| `services` | Serviços oferecidos |
| `appointments` | Agendamentos |
| `comandas` | Comandas |
| `comanda_items` | Itens da comanda |
| `transactions` | Transações financeiras |
| `cash_closings` | Fechamentos de caixa |
| `service_execution_participants` | Participantes de execução |
| `schedule_blocks` | Bloqueios de horário |
| `products` | Produtos |
| `inventory_movements` | Movimentações de estoque |
| `customer_plans` | Planos Club dos Chefes |
| `customer_subscriptions` | Assinaturas Club dos Chefes |
| `customer_credits` | Créditos Club dos Chefes |
| `customer_subscription_receivables` | Cobranças Club dos Chefes |

### Tabelas de Billing

| Tabela | Descrição |
|--------|-----------|
| `platform_subscriptions` | Assinaturas da plataforma (tenant↔plano) |
| `platform_invoices` | Faturas da plataforma |
| `platform_payments` | Pagamentos da plataforma |
| `processed_operations` | Operações processadas (idempotência) |

### Tabelas de Controle

| Tabela | Descrição |
|--------|-----------|
| `feature_flags` | Feature flags por tenant/plano |
| `usage_limits` | Limites de uso por tenant |
| `event_store` | Eventos de domínio |
| `outbox` | Fila de eventos |

---

## Resumo de Decisões e Pendências do Product Owner

### ✅ Decisões Incorporadas (2026-07-28)

| # | Bloco | Decisão |
|---|-------|---------|
| 1 | 1 | Fluxo de onboarding: 8 etapas, sem dados operacionais automáticos |
| 2 | 2 | Lifecycle: draft → trial → active → past_due → suspended → cancelled → archived |
| 3 | 2 | Grace period: tolerância após falha de pagamento, configurável |
| 4 | 2 | Retenção de dados: tenant arquivado por período recuperável, exclusão conforme LGPD |
| 5 | 2 | Auditoria: eventos críticos registrados via infraestrutura de eventos existente |
| 6 | 3 | Cobrança: recorrência mensal, gateway desacoplado via adapters |
| 7 | 3.5 | Notificações: camada própria, canais configuráveis, provedor desacoplado |
| 8 | 4 | Planos: Free, Pro, Elite. Limites configuráveis, sem valores fixos |
| 9 | 5 | Provisionamento: fluxo 8 etapas, sem criação automática de dados |
| 10 | 8 | Hierarquia: Owner → Admin → Gerente → Recepcionista → Barbeiro → Caixa |
| 11 | 8 | Matriz de permissões definida |

### 🔴 Pendências Restantes

**Nenhuma.** Fase 5.5 concluída.

### 🟡 Pendências Altas (Recomendadas antes da Fase 6)

| # | Bloco | Item |
|---|-------|------|
| 1 | 1 | Definir horários padrão |
| 2 | 1 | Definir fluxo de convite para profissionais |
| 3 | 3 | Definir se NFe é obrigatório |
| 4 | 3 | Definir política de reembolso |
| 5 | 4 | Definir comportamento ao atingir limite |
| 6 | 4 | Definir override de feature flags por tenant |
| 7 | 5 | Definir transacionalidade |
| 8 | 5 | Definir comportamento em caso de erro |
| 9 | 5 | Definir provisionamento em lote |
| 10 | 8 | Definir se `seller` e `cashier` são oficiais |
| 11 | 8 | Definir regras de herança |
| 12 | 8 | Definir quem pode convidar/remover |

---

## Próximos Passos

1. **Fase 5.5 está oficialmente encerrada**
2. **Iniciar Fase 5.6 (Platform Certification)** — validar toda a documentação criada nas fases 5 e 5.5
3. **Após Fase 5.6:** Architecture Freeze v1.0 — alterações arquiteturais somente mediante ADR
4. **Fase 6 (Production Readiness)** — implementação, testes e produção

---

## Referências

- `docs/BUSINESS_ARCHITECTURE.md` — Fase 5 (produtos, módulos, taxonomia)
- `docs/TAXONOMY.md` — Glossário oficial
- `docs/REGRA_DE_NEGOCIO_SMG_BARBER.md` — Regras de negócio
- `src/lib/permissions/definitions.ts` — 55 permissões definidas
- `domain/shared/app.ts` — App slugs oficiais
- `src/middleware/resolveApp.ts` — Resolução de domínio
- `src/lib/supabase/tenant.ts` — Tenant types
- `context/AuthContext.tsx` — Role normalization

---

## Mudanças

| Data | Versão | Alteração |
|------|--------|-----------|
| 2026-07-28 | 3.0 | Fase 5.5 CONCLUÍDA. 5 definições finais incorporadas: Grace Period, Retenção de Dados, Gateway (adapters), Notificações (camada própria), Auditoria (eventos existentes). Pendências críticas: 0. |
| 2026-07-28 | 2.0 | Decisões do PO incorporadas: onboarding (8 etapas), lifecycle (7 estados), billing (mensal, gateway desacoplado), planos (Free/Pro/Elite, limites configuráveis), hierarquia de papéis. Pendências reduzidas de 15 para 5 críticas. |
| 2026-07-27 | 1.0 | Criação do documento |
