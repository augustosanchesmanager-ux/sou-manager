# REGRAS DE NEGOCIO — SMG-BARBER (SOU MANA.GER)

> Documentacao oficial de regra de negocio do modulo Barber do SaaS Sou.Manager.
> Gerada em 2026-07-20. Baseada em analise completa do codigo-fonte em producao.

---

## INDICE

1. [Visao Geral do Sistema](#1-visao-geral-do-sistema)
2. [Arquitetura Geral](#2-arquitetura-geral)
3. [Fluxos Principais](#3-fluxos-principais)
4. [Modulos](#4-modulos)
5. [Regras de Negocio por Modulo](#5-regras-de-negocio-por-modulo)
6. [Fluxos Financeiros](#6-fluxos-financeiros)
7. [Fluxos Operacionais](#7-fluxos-operacionais)
8. [Fluxos Administrativos](#8-fluxos-administrativos)
9. [Dependencias](#9-dependencias)
10. [Riscos Encontrados](#10-riscos-encontrados)
11. [Melhorias Arquiteturais](#11-melhorias-arquiteturais)
12. [Pontos que Precisam de Documentacao](#12-pontos-que-precisam-de-documentacao)
13. [Pontos Criticos para Producao](#13-pontos-criticos-para-producao)
14. [Pontos Criticos de Seguranca](#14-pontos-criticos-de-seguranca)
15. [Sugestoes de Padronizacao](#15-sugestoes-de-padronizacao)
16. [Indice Completo da Documentacao](#16-indice-completo-da-documentacao)

---

# 1. VISAO GERAL DO SISTEMA

## 1.1 O que e o SMG-Barber

SMG-Barber e o modulo principal do SaaS **Sou.Manager**, uma plataforma multi-tenant para barbearias e centros de estetica. O sistema gerencia o ciclo completo de operacao: agendamento, atendimento, comandas, financeiro, equipe, estoque, comissao e portal do cliente.

## 1.2 Apps Suportados

O sistema suporta multi-apps via resolucao por hostname/subdomain:

| App Slug | Descricao | Modulos Ativos |
|----------|-----------|----------------|
| `barber` | Barbearia (default) | Todos (20 modulos) |
| `estetica` | Clinica/Estetica | 16 modulos (sem comissions, chef_club, feedback, portal, kiosk) |
| `auto` | Automotivo | Nenhum modulo ativo (placeholders) |
| `club` | Clube/Assinatura | Modulos basicos (dashboard, clients, services, settings, financial, team) |

- Arquivo: `src/lib/apps/moduleRegistry.ts`
- Labels por app: `src/lib/apps/businessLabels.ts`

## 1.3 Multi-tenant

Cada tenant (barbearia/unidade) possui dados isolados por `tenant_id`. O isolamento e garantido por:
- **RLS (Row Level Security)** em todas as tabelas de dominio
- **RPCs SECURITY DEFINER** que resolvem o tenant via `auth.uid()`
- **Frontend** que filtra por `tenant_id` em todas as queries

## 1.4 Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 19 + TypeScript 5.8 + Vite 6 |
| CSS | Tailwind CSS v4 |
| Roteamento | react-router-dom com HashRouter |
| Backend | Supabase (PostgreSQL + Auth + Realtime + Edge Functions) |
| IA | Google Gemini (`@google/generative-ai`) |
| Deploy | Vercel (SPA com HashRouter) |
| Graficos | Recharts |
| PDF | jsPDF + jspdf-autotable |
| Offline | Dexie (IndexedDB) |

---

# 2. ARQUITETURA GERAL

## 2.1 Hierarquia de Providers (de dentro para fora)

```
ThemeProvider
  LoadingProvider
    AppProvider        ← resolve appSlug/schema do hostname
      AuthProvider     ← session + accessRole + profileStatus
        TenantProvider ← tenant record + memberships
          HashRouter
            AppRoutes
```

- Arquivo: `App.tsx:279-296`

## 2.2 Resolucao de App

1. `VITE_APP_HOSTNAME_MAP` (JSON env) → match exato
2. `VITE_LOCAL_APP_SLUG` → para localhost
3. Heuristica de subdomain (`barber.*`, `auto.*`, `club.*`)
4. Fallback → `barber`

- Arquivo: `src/middleware/resolveApp.ts:79-127`

## 2.3 Resolucao de Tenant

1. Busca `user_tenants` (membresias do usuario)
2. Seleciona membrosia que combina com o `appSlug`
3. Fallback: busca `profiles` e `staff` (sistema legado)
4. Para superadmin: tenant e `null` (acesso global)

- Arquivo: `src/lib/supabase/tenant.ts:235-250`

## 2.4 Resolucao de Acesso

1. RPC `get_auth_access_context()` (prioridade)
2. Fallback: query `profiles` (tenant_id, role, status)
3. Fallback: query `staff` (tenant_id, role, status)

- Arquivo: `context/AuthContext.tsx:88-156`

## 2.5 Roles de Acesso

| Role | Descricao | Permissoes |
|------|-----------|-----------|
| `superadmin` | Acesso global a todos os tenants | Total |
| `manager` | Gestor da barbearia | Acesso admin/financeiro |
| `barber` | Barbeiro/profissional | Acesso limitado (propria agenda) |
| `receptionist` | Recepcionista | Acesso limitado (sem financeiro) |

Normalizacao (aceita variants): `manager`, `gerente`, `owner`, `admin`, `adminmanager`, `admin_manager` → `manager`

- Arquivo: `context/AuthContext.tsx:61-68`

## 2.6 Guard Routes

| Guard | Comportamento | Arquivo |
|-------|--------------|---------|
| `ProtectedRoute` | Bloqueia nao-autenticados; pending/suspended → `/pending-approval` | `App.tsx:105-147` |
| `ManagerRoute` | Bloqueia `barber` e `receptionist` de paginas admin | `App.tsx:149-155` |
| `SuperAdminRoute` | Bloqueia nao-superadmins | `App.tsx:157-163` |
| `ModuleRoute` | Verifica se modulo esta habilitado para o app | `App.tsx:165-176` |
| `EsteticaBlockedRoute` | Bloqueia modulo Receipts para app estetica | `App.tsx:178-186` |

## 2.7 Schemas e Tabelas

| Schema | Uso | Tabelas |
|--------|-----|---------|
| `public` | Core compartilhado | `profiles`, `tenants`, `staff`, `audit_logs`, `notifications`, `financial_reversals`, `otp_requests`, `portal_sessions`, `support_tickets`, `ticket_messages`, `user_tenants`, `tenant_addons`, `service_execution_participants`, `apps` |
| `barber` | Dominio barbearia | `appointments`, `clients`, `comandas`, `comanda_items`, `services`, `products`, `transactions`, `promotions`, `suppliers`, `purchase_orders`, `schedule_blocks`, `customer_plans`, `customer_subscriptions`, `customer_credits`, `customer_subscription_receivables`, `customer_vouchers`, `kiosk_devices`, `kiosk_sessions`, `feedback_barber`, `feedback_shop` |

Multi-schema e controlado por `VITE_SUPABASE_MULTI_SCHEMA_ENABLED`.

- Arquivo: `src/lib/supabase/schemas.ts`

## 2.8 Local Demo Mode

Se **nao ha env vars do Supabase** E o host e `localhost`/`127.0.0.1`, o sistema entra em modo demo local:
- Session fake armazenada em `localStorage`
- Todos os Supabase reads/writes emulados via localStorage
- Email: `teste@soumanager.local`, senha: `12345678`

- Arquivo: `src/lib/supabase/client.ts:14-19`

---

# 3. FLUXOS PRINCIPAIS

## 3.1 Fluxo Central do Negocio

```
Cliente agenda
    ↓
Gera agendamento (status: confirmed)
    ↓
Comanda criada (status: blocked)
    ↓
Dia do atendimento (start_time <= hoje) → comanda desbloqueada (status: open)
    ↓
Profissional atende (status: in_progress)
    ↓
Atendimento finalizado (status: completed)
    ↓
Checkout: itens, pagamento, comissao
    ↓
Baixa financeira (RPC finance_settle_comanda)
    ↓
Gera transaction (income)
    ↓
Movimenta caixa
    ↓
Fecha caixa (cash_closings)
    ↓
Gera relatorios
```

## 3.2 Fluxo Financeiro Detalhado

```
Comanda aberta
    ↓
Checkout: define itens, descontos, forma de pagamento
    ↓
Escolha do modo de fechamento:
    ├── Pago → settleCheckoutComanda() → RPC finance_settle_comanda
    │       ├── Cria transaction (type: income)
    │       ├── Baixa estoque (apply_inventory_sale_for_comanda)
    │       ├── Marca comanda como 'paid'
    │       └── Finaliza appointment vinculado
    ├── Credito Clube → closeZeroAmountComanda() → RPC bulk_close_comandas_with_credits
    │       ├── Consome creditos da assinatura
    │       ├── financial_effect = false
    │       └── Marca comanda como 'paid'
    ├── Cortesia → closeZeroAmountComanda() → RPC bulk_close_comandas_admin
    │       ├── financial_effect = false
    │       └── Requer motivo obrigatorio
    └── Pendente → comanda fica 'open' sem baixa financeira
```

## 3.3 Fluxo de Comissao

```
Itens da comanda (comanda_items)
    ↓
service_execution_participants (quem executou cada item)
    ↓
Para cada participante:
    ├── payout_type = 'percentage' → itemPrice × (payout_value / 100) = commissionBase
    └── payout_type = 'fixed' → payout_value = commissionBase
    ↓
commissionBase × staff.commission_rate = commissionValue
    ↓
Consolidado por profissional na pagina Commissions
```

## 3.4 Fluxo de Estoque

```
Venda de produto no checkout
    ↓
finance_settle_comanda (RPC)
    ↓
apply_inventory_sale_for_comanda (RPC interno)
    ↓
Para cada item com product_id:
    ├── Decrementa products.stock_quantity
    ├── Cria inventory_movement (type: 'sale')
    └── Se stock <= minimum_stock → alerta (frontend)
```

## 3.5 Fluxo de Agendamento

```
Formulario de agendamento
    ↓
Validacoes: tenant, cliente, servico, horario
    ↓
Verificacao de conflito de blocos (schedule_blocks)
    ↓
Verificacao de overbook (conflito de horarios)
    ↓
Se servico unico → RPC create_appointment_with_comanda
Se multiplos servicos → RPC create_appointment_with_services
    ↓
RPC cria atomicamente:
    ├── appointment
    ├── comanda (status: open ou blocked)
    └── comanda_items
    ↓
Navega para /operation-success
```

---

# 4. MODULOS

## 4.1 Mapa de Modulos por App

| Modulo | barber | estetica | auto | club |
|--------|--------|----------|------|------|
| dashboard | ✅ | ✅ | ❌ | ✅ |
| checkout | ✅ | ✅ | ❌ | ❌ |
| orders | ✅ | ✅ | ❌ | ❌ |
| products | ✅ | ✅ | ❌ | ❌ |
| clients | ✅ | ✅ | ❌ | ✅ |
| schedule | ✅ | ✅ | ❌ | ❌ |
| schedule_blocks | ✅ | ✅ | ❌ | ❌ |
| services | ✅ | ✅ | ❌ | ✅ |
| comandas | ✅ | ✅ | ❌ | ❌ |
| cashflow | ✅ | ✅ | ❌ | ✅ |
| financial | ✅ | ✅ | ❌ | ✅ |
| reports | ✅ | ✅ | ❌ | ✅ |
| settings | ✅ | ✅ | ❌ | ✅ |
| suppliers | ✅ | ✅ | ❌ | ❌ |
| team | ✅ | ✅ | ❌ | ✅ |
| commissions | ✅ | ❌ | ❌ | ❌ |
| chef_club | ✅ | ❌ | ❌ | ❌ |
| feedback | ✅ | ❌ | ❌ | ❌ |
| portal | ✅ | ❌ | ❌ | ❌ |
| notifications | ✅ | ✅ | ❌ | ❌ |
| kiosk | ✅ | ❌ | ❌ | ❌ |

- Arquivo: `src/lib/apps/moduleRegistry.ts:3-98`

## 4.2 Descricao dos Modulos

### Dashboard (`/dashboard`)
Visao geral diaria/mensal com KPIs: receita, atendimentos, proximo cliente, clientes frequentes.
- Arquivo: `pages/Dashboard.tsx`
- Hooks: `src/modules/dashboard/hooks/`

### Agenda (`/schedule`)
Calendario dia/semana com drag-and-drop, bloqueio de horarios, encaixe.
- Arquivo: `pages/Schedule.tsx` (3839 linhas)

### Checkout (`/checkout/:id?`)
PDV e fechamento de comandas com itens, desconto, pagamento.
- Arquivo: `pages/Checkout.tsx` (2986 linhas)

### Comandas (`/comandas`)
Gestao de comandas: listagem, fechamento em lote, cancelamento, exportacao.
- Arquivo: `pages/Comandas.tsx` (1677 linhas)

### Clientes (`/clients`)
Cadastro, edicao, exclusao com cascata, importacao CSV, Club dos Chefes badge.
- Arquivo: `pages/Clients.tsx` (984 linhas)

### Equipe (`/team`)
CRUD de profissionais via Edge Function `admin-create-user`.
- Arquivo: `pages/Team.tsx` (431 linhas)

### Servicos (`/services`)
CRUD de servicos com categorias, precos, duracoes, toggle ativo/inativo.
- Arquivo: `pages/Services.tsx` (334 linhas)

### Produtos (`/products`)
CRUD de produtos com estoque, preco de custo/venda, alerta de estoque baixo.
- Arquivo: `pages/Products.tsx` (332 linhas)

### Financeiro (`/financial-overview`, `/cashflow`, `/expenses`, `/receipts`)
Visao geral, fluxo de caixa, despesas, recibos.
- Arquivos: `pages/FinancialOverview.tsx`, `pages/Cashflow.tsx`, `pages/Expenses.tsx`, `pages/Receipts.tsx`

### Fechamento de Caixa (`/cash-closing`)
Conferencia diaria por barbeiro, sangria/suprimento, fechamento financeiro.
- Arquivo: `pages/CashClosingPage.tsx`

### Contas a Receber (`/accounts-receivable`)
Comandas abertas, Club dos Chefes, recibos pendentes.
- Arquivo: `pages/AccountsReceivable.tsx`

### Comissoes (`/commissions`)
Calculo de comissao por profissional, com suporte a servicos compartilhados.
- Arquivo: `pages/Commissions.tsx`

### Folha de Pagamento (`/payroll`)
Calculo de salario fixo + comissao, pagamento via transaction.
- Arquivo: `pages/Payroll.tsx`

### Club dos Chefes (`/chef-club-*`)
Planos, assinaturas, creditos, recebimentos, vouchers.
- Arquivos: `pages/ChefClubPlans.tsx`, `pages/ChefClubSubscriptions.tsx`, `pages/ChefClubReceivables.tsx`

### Portal do Cliente (`/c/:tenantSlug/*`)
Landing, login OTP, app do cliente, agendamento pelo cliente.
- Arquivos: `pages/portal/PortalLanding.tsx`, `pages/portal/PortalApp.tsx`, `pages/portal/PortalSchedule.tsx`

### Kiosk/Totem (`/kiosk/:tenantSlug`)
Autoatendimento para clientes no estabelecimento.
- Arquivos: `pages/kiosk/KioskPage.tsx`, `pages/kiosk/KioskClientPage.tsx`

### Relatorios (`/reports`)
Relatorios do Clube dos Chefs (vendas em construcao).
- Arquivo: `pages/Reports.tsx`

### BI (`/bi`)
Business Intelligence com IA (Gemini).
- Arquivo: `pages/BusinessIntelligence.tsx`

### Dashboard Estrategico (`/strategic-dashboard`)
Indicadores avancados (gestores apenas).
- Arquivo: `pages/StrategicDashboard.tsx`

### Performance (`/performance`)
Pagina placeholder com KPIs estaticos.
- Arquivo: `pages/Performance.tsx`

### SuperAdmin (`/superadmin`)
Gestao global de tenants e usuarios.
- Arquivo: `pages/SuperAdmin.tsx`

### Configuracoes (`/settings`)
Configuracoes gerais do tenant.
- Arquivo: `pages/Settings.tsx`

### Controle de Acesso (`/access-control`)
Permissoes granulares por role (Barber/Receptionist).
- Arquivo: `pages/AccessControl.tsx`

---

# 5. REGRAS DE NEGOCIO POR MODULO

## 5.1 AGENDA

### Status dos Agendamentos

| Status | Label | Cor | Quando |
|--------|-------|-----|--------|
| `scheduled` | Agendado | slate-500 | Legado (migrado para confirmed) |
| `pending` | Pendente | amber-500 | Status padrao nao-normalizado |
| `confirmed` | Confirmado | blue-500 | Criacao padrao |
| `in_progress` | Em atendimento | sky-500 | Barbeiro iniciou |
| `completed` | Finalizado | emerald-500 | Atendimento concluido |
| `cancelled` | Cancelado | rose-500 | Cancelado por qualquer motivo |
| `no_show` | Nao compareceu | slate-600 | Cliente nao apareceu |

- Arquivo: `pages/Schedule.tsx:143-191`

### Regras de Criacao

- **Servico obrigatorio**: pelo menos 1 servico selecionado
- **Cliente obrigatorio**: nome do cliente obrigatorio
- **Horario**: janela 07:00-24:00, slots de 30min
- **Duracao**: soma de `duration + buffer` de todos os servicos (minimo 15min)
- **Multiplos servicos**: RPC `create_appointment_with_services` (soma precos e duracoes)
- **Servico unico**: RPC `create_appointment_with_comanda` (cria comanda atomicamente)
- **Idempotency key**: gerada uma vez por sessao de formulario
- **Lock anti-double-submit**: `scheduleCreateLockRef`

### Regras de Bloqueio (Blocks)

- **Tipos**: `full_day` ou `time_range`
- **Escopo**: todos os profissionais ou especifico
- **Recorrencia**: semanal (requer bloco de unico dia)
- **Conflito**: verifica contra blocos ativos existentes
- **Impacto**: pode cancelar agendamentos existentes dentro do bloco

### Regras de Encaixe (Overbook)

- Toggle disponivel apenas para **novos** agendamentos (nao edicoes)
- Se conflito de horario e usuario confirma "Criar como Encaixe":
  - `p_is_overbooked: true` enviado ao RPC
  - Agendamento ganha badge "ENCAIXE" com anel amber
- Drag-and-drop **NAO** permite encaixe (bloqueio duro)

### Cancelamento

- **Motivos**: `client_cancelled`, `no_show`, `rescheduled`, `registration_error`, `test`, `other`
- `no_show` → status `no_show` (nao `cancelled`)
- `registration_error` e `test` → `hidden_from_schedule: true`
- **Cascata**: comandas vinculadas sao canceladas tambem
- **Campos audit**: `cancellation_reason`, `cancellation_type`, `cancelled_at`, `cancelled_by_user_id`

### Edicao

- Atualizacao direta via `supabase.from('appointments').update()` (NAO via RPC)
- Tambem atualiza `staff_id` na comanda vinculada
- **Drag-and-drop**: recalcula horario, valida conflitos e blocos

- Arquivo: `pages/Schedule.tsx`

## 5.2 CHECKOUT / PDV

### Modos de Entrada

| Modo | Descricao | Parametro |
|------|-----------|-----------|
| `pdv` | Ponto de venda (default) | Nenhum |
| `open_comanda` | Abrir comanda existente | `mode=comanda` ou `appointmentId` |
| `edit_comanda` | Editar comanda existente | `comandaId` na URL |

### Regras de Negocio

- **Cliente obrigatorio**: nao fecha sem selecionar cliente
- **Itens obrigatorios**: pelo menos 1 item no carrinho
- **Comanda duplicada**: se cliente ja tem comanda `open` ou `blocked`, avisa antes de criar nova
- **Comanda bloqueada**: nao e abrivel via checkout (erro toast)
- **Barbeiro**: so ve/edita proprias comandas (filtro por `staff_id`)
- **Promocoes**: filtradas por data (`start <= now <= end`)
- **Credito de servico**: itens marcados `usedCredit` tem preco zerado, credito deduzido via RPC

### Calculos Financeiros

```
subtotal = SUM(item.price × item.quantity)
discountValue = parseFloat(discount) || 0
total = MAX(0, subtotal - discountValue)   // piso em 0
```

### Desconto

- **Tipos**: `barber_discount`, `barbershop_discount`, `manager_discount`, `promotion`, `correction`, `courtesy`, `other`
- **Motivos**: `fidelizacao`, `erro_operacional`, `ajuste_comercial`, `promocao`, `cortesia`, `reclamacao_cliente`, `autorizado_gestor`, `outro`
- **Auditoria**: quando `discountValue > 0`, coleta responsavel, motivo e observacao
- **Nota de auditoria**: formatada como JSON estruturado

### Fechamento Zero (Total = 0)

| Origem | Restricao |
|--------|----------|
| `club_credit` | Requer assinatura ativa + creditos disponiveis |
| `house_courtesy` | Requer motivo + role manager+ |
| `administrative_adjustment` | Requer motivo + role manager+ |

### Sincronizacao de Itens

Na atualizacao de comanda existente:
1. DELETA todos os `comanda_items` existentes
2. RE-INSERE todos os itens do carrinho atual
- Estrategia delete+insert (nao upsert)

### Idempotency

- `comandaRequestKeyRef` (UUID) por tentativa de finalizacao
- Inserido em `comandas.idempotency_key`
-|unique violation (23505)*: recupera comanda existente pela key

- Arquivo: `pages/Checkout.tsx`

## 5.3 COMANDAS

### Status

| Status | Descricao |
|--------|-----------|
| `blocked` | Comanda de agendamento futuro (desbloqueia no dia) |
| `open` | Comanda aberta, aguardando pagamento |
| `paid` | Comanda paga/fechada |
| `cancelled` | Comanda cancelada |

### Auto-desbloqueio

- Ao carregar, comandas `blocked` com `appointment.start_time <= hoje` sao atualizadas para `open`
- Arquivo: `pages/Comandas.tsx:674-722`

### Fechamento em Lote

- **Normal**: RPC `bulk_close_comandas_with_credits` (payment: Dinheiro, credits: true)
- **Admin**: RPC `bulk_close_comandas_admin` (legacy_reference_month obrigatorio, sem creditos)

### Cancelamento

- Motivos: `duplicate`, `test`, `operational_error`, `client_gave_up`, `other`
- `duplicate`, `test`, `operational_error` → `hidden_from_financial: true` (excluido de relatorios)
- Comanda `paid` → exige confirmacao explicita sobre impacto financeiro/comissao
- Fallback: se coluna `cancellation_type` nao existe, tenta update sem campos de auditoria

### Exportacao CSV

- Itens classificados como servico (`service_id` truthy) ou produto
- Participantes de servico compartilhado incluidos
- Separador: ponto-e-virgula (compatibilidade Excel BR)

- Arquivo: `pages/Comandas.tsx`

## 5.4 CLIENTES

### Status
- `active` ou `inactive`

### Display ID
```
hexStr = first 8 chars of UUID (no dashes)
displayId = parseInt(hexStr, 16) % 89999 + 1000
```

### Exclusao em Cascata

Ao excluir um cliente, o sistema deleta registros em 10 tabelas:
1. `comanda_items` (via comandas do cliente)
2. `appointments`
3. `portal_sessions`
4. `feedback_barber`
5. `feedback_shop`
6. `kiosk_sessions`
7. `customer_credits`
8. `customer_subscriptions`
9. `customer_vouchers`
10. `comandas`
11. `clients` (o proprio)

Erros de tabelas inexistentes (codes `42P01, 42703, 42501, PGRST116`) sao ignorados silenciosamente.

### Importacao CSV

- Colunas mapeadas: Nome/nome/Name/name/Cliente, Telefone/telefone/Phone/phone/Celular, Email/e-mail, Aniversario/Birthday
- Formatos de data: `dd/mm/yyyy` ou `yyyy-mm-dd`
- Clientes importados recebem `status: 'active'`

- Arquivo: `pages/Clients.tsx`

## 5.5 EQUIPE

### Roles

| Role | Descricao | Comissao | Agenda |
|------|-----------|----------|--------|
| `Manager` | Gestor | ❌ | ✅ |
| `AdminManager` | Gestor Administrativo | ❌ | ✅ |
| `Barber` | Barbeiro | ✅ | ✅ |
| `Receptionist` | Recepcionista | ❌ | ❌ |

### Regras

- Criacao via Edge Function `admin-create-user` (cria auth user + staff row)
- Senha: minimo 6 caracteres (obrigatoria apenas na criacao)
- Comissao: auto-preenchida por role (`barber`/`seller` = 50%, outros = 0%)
- Atualizacao de comissao NAO e sobrescrita ao mudar role (flag `commissionEditedManually`)
- Phone e commission_rate atualizados em update separado apos criacao

### Quem recebe comissao

```typescript
receivesCommission(staff) {
  return role === 'barber' || role === 'seller';
}
```

### Quem aparece na agenda

```typescript
shouldAppearOnSchedule(staff) {
  return role === 'barber' || role === 'manager' || role === 'seller';
}
```

- Arquivo: `src/lib/staff/roles.ts`

## 5.6 SERVICOS

### Categorias (barber)
`Cabelo`, `Barba`, `Combo`, `Quimica`, `Acabamento`, `Outros`

### Categorias (estetica)
`Facial`, `Corporal`, `Pacotes`, `Quimica`, `Acabamento`, `Outros`

### Campos
- `name`: nome interno
- `commercial_name`: nome para o cliente (display)
- `description`: descricao
- `category`: categoria
- `duration`: duracao em minutos (default 30)
- `buffer`: tempo buffer apos o servico
- `price`: preco
- `active`: boolean (toggle sem exclusao)

- Arquivo: `pages/Services.tsx`

## 5.7 PRODUTOS

### Campos
- `name`, `commercial_name`, `description`
- `cost_price`: preco de custo
- `sale_price`: preco de venda
- `stock_quantity`: estoque atual
- `minimum_stock`: estoque minimo (alerta quando `stock_quantity <= minimum_stock`)
- `auto_generate_purchase_order`: flag para pedido automatico
- `active`: boolean

### Regras
- **Sem exclusao**: nao ha botao de excluir na UI
- **Alerta de estoque baixo**: badge laranja quando `stock_quantity <= minimum_stock`
- **Normalizacao**: todos os campos numericos garantidos como Number

- Arquivo: `pages/Products.tsx`

## 5.8 FINANCEIRO

### Transactions (Ledger Universal)

Todos os eventos financeiros sao gravados na tabela `transactions`:

| Campo | Valores |
|-------|---------|
| `type` | `income` ou `expense` |
| `category` | `Receita`, `Despesa`, `Pessoal`, `Venda de Balcao`, `Fechamento de Comanda`, etc. |
| `status` | `paid` ou `pending` |
| `payment_method` | `Dinheiro`, `PIX`, `Cartao de Credito`, `Cartao de Debito`, `Transferencia`, `Outro` |
| `source_type` | `comanda`, `cash_closing`, `manual` |
| `source_id` | ID da comanda ou closing |
| `idempotency_key` | Unico por tenant |

### Fluxo de Caixa (Cashflow)

- **Entradas**: transactions com `type = 'income'`
- **Saidas**: transactions com `type = 'expense'`
- **Saldo**: `totalEntradas - totalSaidas`
- **Ticket Medio**: `totalEntradas / count(entradas)`

### Despesas

- Gravadas como `transactions` com `type = 'expense'`
- `payment_method` hardcoded como `'Dinheiro'`
- Categorias: `Infraestrutura`, `Utilidades`, `Estoque`, `Manutencao`, `Marketing`, `Pessoal`, `Impostos`, `Outros`

### Fechamento de Caixa

- **Tabela**: `cash_closings` (um registro por data)
- **Conferencia por barbeiro**: `barber_closings` (um registro por barbeiro por data)
- **Eventos**: `cash_closing_events` (timeline de acoes)
- **Sangria**: retirada de dinheiro (registrada como `expense`)
- **Suprimento**: adicao de dinheiro (registrada como `income`)
- **Validacao**: `|totalExpected - totalReceived| <= 0.01`

### Calculo por Barbeiro no Fechamento

```
commissionRate = staff.commission_rate || 40%
servicesCommission = barber.totalReceived × (commissionRate / 100)
productsCommission = sum(productValues) × (commissionRate / 100)
repasse = totalReceived - commission
```

### Checklist por Barbeiro

- `allCommandsClosed`
- `allPaymentsCompleted`
- `noPendingReversals`
- `noOpenCommands`
- `noInconsistentCommissions`
- `conferenceDone`

### Reversao Financeira

- **RPC**: `finance_reverse_transaction`
- **Tipos**: `wrong_settlement`, `full_refund`, `partial_refund`, `duplicate_charge`, `administrative_cancellation`, `financial_review`
- **Motivos**: `baixa_indevida`, `cobranca_duplicada`, `devolucao_ao_cliente`, `erro_forma_pagamento`, `erro_operacional`, `cancelamento_administrativo`, `cliente_duplicado`, `outro`
- **Regra**: so reverte transactions `income` com status `paid`
- **Efeito**: `wrong_settlement` com valor total → reabre comanda para `open`
- **Auditoria**: cria `financial_reversals` + nova transaction `expense`

### Contas a Receber

Tres fontes:
1. **Comandas abertas** (`status = 'open'`)
2. **Club dos Chefes** (`customer_subscription_receivables` com `status = 'pending'|'overdue'`)
3. **Recibos pendentes** (transactions `income` nao pagas)

### Recibos

- Numeracao: `REC-{year}-{first6charsOfId}`
- Criacao: insere transaction com `status: 'paid'`
- Categorias: `Salario`, `Receita`, `Despesa`

## 5.9 COMISSOES

### Algoritmo de Calculo

1. **Itens comissionaveis**: apenas itens de servico (`isServiceItem()`)
2. **Determinar valor base**: `unit_price` > `price` > `amount` > `unit_price × quantity`
3. **Normalizar participantes**: filtrar apenas quem `receivesCommission()`
4. **Calcular por participante**:
   - Solo: `commissionBase = itemValue`, `commissionValue = itemValue × staffRate`
   - Compartilhado: `commissionBase = itemValue × participationRate` (ou valor fixo), `commissionValue = commissionBase × staffRate`

### Regras

- **Produtos NAO geram comissao** diretamente
- **Descontos sao informativos** — nao reduzem comissao automaticamente
- **Manager e Receptionist NAO recebem comissao**
- **Servicos do Clube** com valor 0 → base de comissao = 0
- **Data de producao**: prioridade `appointment.start_time` > `comanda.closed_at` > `comanda.created_at`

### Percentual de Participacao

```typescript
normalizePercentage(value) {
  return value > 1 ? value / 100 : value;  // suporta 0.15 e 15
}
```

### Status para Comissao

- `paid` → `confirmed`
- `cancelled` → `cancelled`
- qualquer outro → `pending`

## 5.10 FOLHA DE PAGAMENTO

### Calculo

```
staffSales = SUM(comanda_items × quantity × unit_price) WHERE staff_id
rate = staff.commission_rate || 40%  // default
staffCommissions = staffSales × rate
fixed = staff.fixed_salary
netPay = fixed + staffCommissions - discounts  // discounts = 0 (nao implementado)
```

### Pagamento

- Cria transaction: `type: 'expense'`, `category: 'Pessoal'`
- Descricao: `"Folha - {staffId} - {startDate} ate {endDate}"`
- Status baseado na existencia de transaction correspondente

### Limitacao

- Calculo simplificado vs Commissions.tsx (nao considera servicos compartilhados)

## 5.11 Club dos Chefes

### Entidades

| Tabela | Descricao |
|--------|-----------|
| `customer_plans` | Planos com preco mensal e creditos |
| `customer_subscriptions` | Assinaturas de clientes |
| `customer_credits` | Creditos disponiveis por assinatura |
| `customer_subscription_receivables` | Recebimentos pendentes |
| `customer_vouchers` | Vouchers de beneficio |

### Fluxo

1. **Criacao de plano**: nome, preco, creditos por servico
2. **Criacao de assinatura**: vincula cliente + plano, gera recebivel
3. **Pagamento do recebivel**: marca como `paid`, cria transaction
4. **Uso de credito**: no checkout, item com `usedCredit = true` deduz credito
5. **RPC de deducao**: `deduct_chef_club_credits(p_subscription_id, p_service_id, p_amount)`

### Status da Assinatura

- `active`, `past_due`, `canceled`, `paused`

### Creditos por Servico

- `service_balance_map`: array com `{service_id, service_name, available, used}`
- Permite plano com creditos diferentes por tipo de servico

- Arquivo: `src/lib/supabase/chefClub.ts`

## 5.12 ESTOQUE

### Movimentacoes

- **Tabela**: `inventory_movements`
- **RPC**: `apply_inventory_sale_for_comanda` (chamada internamente por `finance_settle_comanda`)
- **Tipos**: `sale`, `return`, `reversal`, `adjustment`, `purchase`, `manual_correction`

### Regras

- Decremento idempotente por produto na venda
- Apenas itens com `product_id` movimentam estoque
- Alerta visual quando `stock_quantity <= minimum_stock`
- Flag `auto_generate_purchase_order` armazenada mas nao executada automaticamente

- Arquivo: Migration `20260602031543`

## 5.13 PERMISSOES

### Granularidade

- **7 modulos**: `schedule`, `clients`, `services`, `financial`, `team`, `reports`, `communication`
- **55 permissoes** definidas
- **2 roles configuraveis**: `Barber` e `Receptionist`

### RPCs

- `get_role_permissions(p_tenant_id, p_role)` → retorna permissoes habilitadas
- `upsert_role_permissions(p_tenant_id, p_role, p_permissions)` → salva permissoes
- `reset_role_permissions_to_default(p_tenant_id, p_role)` → reseta para defaults

### Permissoes Restritas

Algumas permissoes sao proibidas para certas roles:
- `schedule.block_times`: proibido para Barber e Receptionist
- `clients.block_clients`: proibido para Barber e Receptionist
- `financial.view_reports`: proibido para Barber e Receptionist
- `financial.process_refunds`: proibido para Barber e Receptionist

### Auditoria

- `role_permissions_audit`: log imutavel de mudancas
- Trigger: `trigger_audit_role_permissions_changes`

- Arquivo: `src/lib/permissions/definitions.ts`

## 5.14 NOTIFICACOES

### Tipos

- `comanda_aberta`: nova comanda aberta
- `estoque_baixo`: produto atingiu estoque minimo
- `pagamento_a_realizar`: contas pendentes/vencidas
- `cobranca_clube_chefes`: mensalidades pendentes
- `proximo_cliente`: proximo atendimento
- `cliente_atrasado`: horario ja passou

### Preferencias

- Por usuario, por tipo
- RPCs: `get_notification_preferences`, `set_notification_preferences`

## 5.15 VOUCHERS

### Tipos de Beneficio

- `free_service`: servico gratuito
- `discount_fixed`: desconto fixo (R$)
- `discount_percentage`: desconto percentual
- `custom_benefit`: beneficio customizado

### Status

- `available`, `used`, `expired`, `cancelled`

### Expiracao

- Vouchers com `expires_at < now` sao considerados expirados

- Arquivo: `src/lib/vouchers/index.ts`

---

# 6. FLUXOS FINANCEIROS

## 6.1 Origem e Destino dos Dados

| Evento | Origem | Destino | Cria |
|--------|--------|---------|------|
| Checkout pago | Checkout | `finance_settle_comanda` RPC | Transaction income |
| Checkout zero | Checkout | `closeZeroAmountComanda` | Nenhuma transaction |
| Cancelamento comanda | Comandas | Atualiza comanda | Nenhuma transaction |
| Reversao | Cashflow/Receipts | `finance_reverse_transaction` RPC | Transaction expense + financial_reversal |
| Despesa manual | Expenses | Insert direto | Transaction expense |
| Recibo | Receipts | Insert direto | Transaction |
| Folha | Payroll | Insert direto | Transaction expense |
| Fechamento sangria | Cash Closing | Insert direto | Transaction expense |
| Fechamento suprimento | Cash Closing | Insert direto | Transaction income |

## 6.2 Quem Cria

- **Transactions de income**: `finance_settle_comanda` (RPC) ou inserts manuais
- **Transactions de expense**: `finance_reverse_transaction` (RPC), despesas, folha, sangria

## 6.3 Quem Altera

- Nenhuma transaction e alterada apos criacao (append-only)
- Apenas `status` pode mudar (via RPCs)

## 6.4 Quem Pode Excluir

- **Ninguem**. Transactions nao sao deletadas no frontend.
- Reversoes criam novas transactions, nao deletam as originais.

## 6.5 Quem Pode Cancelar

- Reversoes: apenas `manager/admin/superadmin`
- Requisitos: income + paid + source comanda + reversibleAmount > 0

---

# 7. FLUXOS OPERACIONAIS

## 7.1 Fluxo Diario

```
Abrir caixa (cash_closings.opening_time)
    ↓
Receber clientes (agendamento + balcao)
    ↓
Atender (status: in_progress → completed)
    ↓
Criar/fechar comandas
    ↓
Registrar despesas do dia
    ↓
Fechar caixa
    ├── Conferencia por barbeiro
    ├── Sangria/Suprimento
    ├── Validacao financeira
    └── Confirmar fechamento
```

## 7.2 Fluxo de Atendimento

```
Cliente chega (ou agendado)
    ↓
Profissional inicia (status: in_progress)
    ↓
Servico executado (itens na comanda)
    ↓
Profissional finaliza (status: completed)
    ↓
Checkout: pagamento e fechamento
```

## 7.3 Fluxo de Cancelamento

```
Motivo selecionado
    ↓
Confirmacao (especialmente se paid)
    ↓
Update comanda: status, cancellation_type, cancellation_reason, cancelled_at, cancelled_by_user_id
    ↓
Se motivos de auditoria → hidden_from_financial = true
```

---

# 8. FLUXOS ADMINISTRATIVOS

## 8.1 Cadastro de Profissional

```
Manager acessa /team
    ↓
Preenche formulario (nome, email, senha, role, comissao)
    ↓
Chama Edge Function admin-create-user
    ↓
Edge Function:
    ├── Cria auth user (supabase.auth.admin)
    ├── Cria staff row
    └── Cria user_tenants row
    ↓
Update suplementar: phone, commission_rate
```

## 8.2 Configuracao de Permissoes

```
Manager acessa /access-control
    ↓
Seleciona role (Barber/Receptionist)
    ↓
Fetch permissoes atuais via RPC get_role_permissions
    ↓
Altera permissoes
    ↓
Salva via RPC upsert_role_permissions
    ↓
Audit log registrado automaticamente
```

## 8.3 Gestao de Planos (Club dos Chefes)

```
Cria plano: nome, preco, creditos por servico
    ↓
Cria assinatura: cliente + plano
    ↓
Gera recebivel (customer_subscription_receivables)
    ↓
Pagamento: mark as paid, cria transaction
    ↓
Creditos disponiveis para uso no checkout
```

---

# 9. DEPENDENCIAS

## 9.1 Mapa de Dependencias

```
App.tsx
├── ThemeProvider
├── LoadingProvider
├── AppProvider → resolveApp.ts → schemas.ts
├── AuthProvider → supabase.auth + RPC get_auth_access_context
│   └── useAuth() combina com TenantContext + AppContext
├── TenantProvider → tenant.ts → resolveTenantForUser()
└── HashRouter → Routes
    ├── ProtectedRoute (session + profileStatus)
    │   ├── ManagerRoute (accessRole)
    │   ├── SuperAdminRoute (canAccessSuperAdmin)
    │   └── ModuleRoute (isAppModuleEnabled)
    └── Layout → Sidebar + MobileBottomNav + Outlet
```

## 9.2 Mapa de Tabelas Principais

| Tabela | Schema | Depende de |
|--------|--------|-----------|
| `tenants` | public | - |
| `profiles` | public | tenants |
| `user_tenants` | public | tenants, auth.users |
| `staff` | public | tenants |
| `clients` | barber | tenants |
| `services` | barber | tenants |
| `products` | barber | tenants |
| `appointments` | barber | tenants, clients, services, staff |
| `comandas` | barber | tenants, clients, staff, appointments |
| `comanda_items` | barber | comandas, services, staff |
| `service_execution_participants` | public | comanda_items, staff |
| `transactions` | public | tenants |
| `financial_reversals` | public | transactions |
| `inventory_movements` | public | products |
| `customer_plans` | barber | tenants |
| `customer_subscriptions` | barber | tenants, clients, customer_plans |
| `customer_credits` | barber | customer_subscriptions |
| `customer_subscription_receivables` | barber | customer_subscriptions, customer_plans, transactions |
| `customer_vouchers` | barber | tenants, clients |
| `cash_closings` | barber | tenants |
| `barber_closings` | barber | cash_closings |
| `cash_closing_events` | barber | cash_closings |
| `schedule_blocks` | barber | tenants, staff |
| `promotions` | barber | tenants |
| `role_permissions` | public | tenants |
| `role_permissions_audit` | public | role_permissions |
| `notifications` | public | tenants |
| `audit_logs` | public | tenants |

## 9.3 Mapa de RPCs

| RPC | Proprietario | Parametros Chave |
|-----|-------------|-----------------|
| `get_auth_access_context` | Seguranca | (nenhum — usa auth.uid()) |
| `current_tenant_id_from_auth_uid` | Seguranca | (nenhum) |
| `current_is_super_admin_from_auth_uid` | Seguranca | (nenhum) |
| `create_appointment_with_comanda` | Agendamento | tenant, client, service, staff, start_time |
| `create_appointment_with_services` | Agendamento | tenant, client, staff, services[] |
| `finance_settle_comanda` | Financeiro | tenant, comanda_id, payment_method, amount |
| `finance_reverse_transaction` | Financeiro | tenant, transaction_id, type, amount |
| `finance_zero_close_comanda` | Financeiro | tenant, comanda_id, origin |
| `bulk_close_comandas_with_credits` | Comandas | comanda_ids[], tenant_id |
| `bulk_close_comandas_admin` | Comandas | comanda_ids[], tenant_id, legacy_month |
| `deduct_chef_club_credits` | Clube | subscription_id, service_id, amount |
| `apply_inventory_sale_for_comanda` | Estoque | tenant, comanda_id (interno) |
| `get_role_permissions` | Permissoes | tenant_id, role |
| `upsert_role_permissions` | Permissoes | tenant_id, role, permissions[] |
| `reset_role_permissions_to_default` | Permissoes | tenant_id, role |
| `generate_club_receivables` | Clube | (parametros variados) |

## 9.4 Mapa das Principais Telas

| Rota | Tela | Guard |
|------|------|-------|
| `/login` | Login | Publica |
| `/register` | Cadastro | Publica |
| `/dashboard` | Dashboard | Protected |
| `/schedule` | Agenda | Protected |
| `/checkout/:id?` | Checkout/PDV | Protected |
| `/comandas` | Comandas | Protected |
| `/clients` | Clientes | Manager |
| `/team` | Equipe | Manager |
| `/services` | Servicos | Manager |
| `/products` | Produtos | Manager |
| `/financial-overview` | Visao Financeira | Manager |
| `/cashflow` | Fluxo de Caixa | Manager |
| `/cash-closing` | Fechamento de Caixa | Manager |
| `/expenses` | Despesas | Manager |
| `/accounts-receivable` | Contas a Receber | Manager |
| `/commissions` | Comissoes | Manager + Module |
| `/payroll` | Folha | Manager |
| `/receipts` | Recibos | Manager |
| `/reports` | Relatorios | Manager |
| `/settings` | Configuracoes | Manager |
| `/access-control` | Controle de Acesso | Manager |
| `/superadmin` | SuperAdmin | SuperAdmin |
| `/c/:tenantSlug/app` | Portal do Cliente | Module Portal |
| `/kiosk/:tenantSlug` | Kiosk | Module Kiosk |

---

# 10. RISCOS ENCONTRADOS

## 10.1 Riscos Financeiros

| Risco | Localizacao | Severidade |
|-------|------------|-----------|
| **Payroll nao considera servicos compartilhados** | `pages/Payroll.tsx:98-141` | Alta |
| **Desconto nao reduz comissao automaticamente** | `pages/Commissions.tsx:1062` | Media |
| **Expenses hardcode payment_method como 'Dinheiro'** | `pages/Expenses.tsx:126` | Media |
| **Fechamento de caixa nao bloqueia divergencia** | `pages/CashClosingPage.tsx:546-554` | Media |
| **Stock decremento depende de RPC interna** — se falhar silenciosamente, estoque fica inconsistente | `src/lib/finance/settlement.ts:82-92` | Alta |

## 10.2 Riscos de Consistencia

| Risco | Localizacao | Severidade |
|-------|------------|-----------|
| **Delete+re-insert de comanda_items** — se falhar apos delete, perde dados | `pages/Checkout.tsx:1435-1441` | Alta |
| **Performance page e placeholder** — KPIs zerados, sem dados | `pages/Performance.tsx` | Baixa |
| **Reports vendas placeholder** — "Em breve" | `pages/Reports.tsx:206` | Baixa |
| **Race condition potencial no finish do checkout** — `finishLockRef` previne double-submit mas nao garante atomicidade | `pages/Checkout.tsx:1277` | Media |

## 10.3 Riscos de Seguranca

| Risco | Localizacao | Severidade |
|-------|------------|-----------|
| **Local demo mode em producao** — se env vars ausentes em localhost | `src/lib/supabase/client.ts:33` | Baixa |
| **Edge Function admin-create-user** — require session token para auth | `pages/Team.tsx:159-176` | Media |
| **Client deletion em cascata no frontend** — se RLS bloquear uma tabela, delete falha parcialmente | `pages/Clients.tsx:294-358` | Media |

## 10.4 Riscos Arquiteturais

| Risco | Localizacao | Severidade |
|-------|------------|-----------|
| **Dual directory structure** — codigo em `components/` e `src/components/` | Geral | Media |
| **AuthContext expoe `useAuth()` com merge de 3 contexts** — complexidade alta | `context/AuthContext.tsx:244-297` | Media |
| **Schedule.tsx com 3839 linhas** — componente monolitico | `pages/Schedule.tsx` | Alta |
| **Checkout.tsx com 2986 linhas** — componente monolitico | `pages/Checkout.tsx` | Alta |
| **Demo client com 1500+ linhas** — emulacao Supabase complexa | `src/lib/supabase/client.ts` | Media |

---

# 11. MELHORIAS ARQUITETURAIS

## 11.1 Prioridade Alta

1. **Extrair hooks do Schedule.tsx**: `useScheduleAppointments`, `useScheduleBlocks`, `useScheduleOverbook`, `useScheduleDragDrop`
2. **Extrair hooks do Checkout.tsx**: `useCheckoutCart`, `useCheckoutPayment`, `useCheckoutSettlement`, `useCheckoutCredits`
3. **Unificar calculo de comissao**: Payroll.tsx e Commissions.tsx usam algoritmos diferentes
4. **Validar atomicidade do delete+insert de comanda_items**: usar transacao server-side

## 11.2 Prioridade Media

5. **Extrair service_execution_participants logic** do Checkout.tsx para hook dedicado
6. **Criar hook `useFinancialTransactions`** para padronizar queries de transactions
7. **Separar logica de reversal** em servico compartilhado (duplicada em 3 paginas)
8. **Migrar Performance.tsx** de placeholder para dados reais

## 11.3 Prioridade Baixa

9. **Unificar formatadores de moeda** — padronizar `R$ ${value.toFixed(2).replace('.',',')}`
10. **Extrair BusinessLabels** de `src/lib/apps/businessLabels.ts` para hook `useBusinessLabels()`

---

# 12. PONTOS QUE PRECISAM DE DOCUMENTACAO

1. **RPC `finance_settle_comanda`** — logica completa no SQL (server-side)
2. **RPC `create_appointment_with_comanda`** — validacoes e criacao atomica
3. **RPC `create_appointment_with_services`** — logica multi-servico
4. **RPC `apply_inventory_sale_for_comanda`** — regras de decremento de estoque
5. **Edge Function `admin-create-user`** — fluxo completo de criacao
6. **Edge Function `portal-auth`** — autenticacao OTP do portal
7. **Edge Function `notification-sweep`** — varredura de notificacoes
8. **Edge Function `site-sanchez-appointments`** — API publica de agendamentos
9. **RLS policies completas** — todas as 91 migrations
10. **Triggers do banco** — audit, updated_at, auto-insert staff

---

# 13. PONTOS CRITICOS PARA PRODUCAO

1. **Idempotency keys** sao geradas no frontend via `crypto.randomUUID()` — garantem que operacoes nao sejam duplicadas
2. **RPCs usam `SECURITY DEFINER`** — executam com privilegios do owner, nao do usuario
3. **Advisory locks** no `finance_settle_comanda` — previnem concorrência na baixa financeira
4. **Timeout de 30s** em todas as chamadas financeiras — previnem requests pendentes
5. **RLS em todas as tabelas** — isento: `transactions` foi corrigido na migration `20260715000000`
6. **Cash closings** sao snapshot — dados financeiros sao serializados como JSON no fechamento
7. **CSV export usa separador `;`** — compatibilidade com Excel brasileiro
8. **BOM UTF-8** em exports CSV — compatibilidade com Excel

---

# 14. PONTOS CRITICOS DE SEGURANCA

1. **RLS obrigatorio** em todas as tabelas — `transactions` estava sem ate `20260715000000`
2. **`get_current_tenant_id()` vs `current_tenant_id_from_auth_uid()`** —后者 e SECURITY DEFINER e mais seguro
3. **Edge Functions** requerem token de autenticacao (header `Authorization`)
4. **Local demo mode** — desabilitado em producao (requer ausencia de env vars + localhost)
5. **Client deletion** — cleanup cascade pode falhar parcialmente (erros ignorados silenciosamente)
6. **SuperAdmin bypass** — `canAccessSuperAdmin` bypassa todas as restricoes de tenant
7. **Password minimo 6 caracteres** — Edge Function valida
8. **RPCs com `SET search_path = public`** — previnem SQL injection via search_path

---

# 15. SUGESTOES DE PADRONIZACAO

1. **Nomenclatura de modulos**: usar `snake_case` para slugs (`chef_club`, `schedule_blocks`)
2. **Nomenclatura de tabelas**: manter `snake_case` no banco, `camelCase` no frontend
3. **Formatacao de moeda**: criar util `formatCurrency(value: number): string`
4. **Normalizacao de roles**: centralizar em `src/lib/staff/roles.ts`
5. **Queries Supabase**: sempre usar `getClientForTable()` para domain tables
6. **Error handling**: usar `logSupabaseError()` em todos os catches
7. **Tenant validation**: sempre usar `requireTenantId()` antes de queries criticas
8. **Idempotency**: sempre usar `generateIdempotencyKey()` para operacoes de efeito colateral

---

# 16. INDICE COMPLETO DA DOCUMENTACAO

| Secao | Descricao |
|-------|-----------|
| [1](#1-visao-geral-do-sistema) | Visao Geral — Apps, multi-tenant, stack |
| [2](#2-arquitetura-geral) | Arquitetura — Providers, resolucao, schemas, demo mode |
| [3](#3-fluxos-principais) | Fluxos — Central, financeiro, comissao, estoque, agenda |
| [4](#4-modulos) | Modulos — Mapa por app, descricao de cada modulo |
| [5](#5-regras-de-negocio-por-modulo) | Regras — Agenda, Checkout, Comandas, Clientes, Equipe, Servicos, Produtos, Financeiro, Comissoes, Payroll, Clube, Estoque, Permissoes, Notificacoes, Vouchers |
| [6](#6-fluxos-financeiros) | Financeiro — Transactions, reversao, fechamento, contas |
| [7](#7-fluxos-operacionais) | Operacional — Diario, atendimento, cancelamento |
| [8](#8-fluxos-administrativos) | Admin — Cadastro equipe, permissoes, planos |
| [9](#9-dependencias) | Dependencias — Mapa de tabelas, RPCs, telas |
| [10](#10-riscos-encontrados) | Riscos — Financeiros, consistencia, seguranca, arquitetura |
| [11](#11-melhorias-arquiteturais) | Melhorias — Alta, media, baixa prioridade |
| [12](#12-pontos-que-precisam-de-documentacao) | Documentacao pendente |
| [13](#13-pontos-criticos-para-producao) | Criticos producao |
| [14](#14-pontos-criticos-de-seguranca) | Criticos seguranca |
| [15](#15-sugestoes-de-padronizacao) | Padronizacao |
| [16](#16-indice-completo-da-documentacao) | Este indice |

---

> **Nota**: Esta documentacao foi gerada por analise estatica do codigo-fonte. Regras implementadas em RPCs SQL (`finance_settle_comanda`, `create_appointment_with_comanda`, etc.) nao foram completamente documentadas pois residem no banco de dados (migrations SQL) e nao no frontend. Para documentacao completa das RPCs, consultar as migrations em `supabase/migrations/`.
