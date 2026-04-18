# Auditoria Fase 1 - Consolidacao Multi-App Barber

Data: 2026-03-25

## Objetivo

Registrar o estado real do projeto antes de qualquer refatoracao ampla para a migracao gradual do dominio `barber` de `public` para `barber`, preservando:

- compatibilidade do app atual em producao
- fallback legado `barber -> public`
- separacao entre `public` compartilhado e schemas de dominio
- isolamento por `tenant_id`

Esta fase nao aplica mudancas amplas em modulos operacionais. O foco aqui e diagnostico validavel.

## Estado atual observado

A fundacao multi-app ja existe no workspace atual:

- deteccao de app por hostname/subdominio
- `AppContext` com `appSlug` e `schema`
- `TenantContext` com `user_tenants` + `tenants.app_slug`
- helper de schema dinamico
- fallback legado para `barber` continuar em `public` enquanto `VITE_SUPABASE_MULTI_SCHEMA_ENABLED !== true`

Arquivos centrais observados:

- `src/lib/supabase/schemas.ts`
- `src/lib/supabase/client.ts`
- `src/lib/supabase/tenant.ts`
- `src/context/AppContext.tsx`
- `src/context/TenantContext.tsx`
- `context/AuthContext.tsx`

## Diagnostico tecnico objetivo

### 1. O roteamento de schema ja existe, mas o acesso de dados ainda e heterogeneo

O projeto ja possui um proxy em `services/supabaseClient.ts` que encaminha `from('tabela')` para o schema apropriado por tabela/app. Isso reduz risco de schema incorreto, mas nao resolve por si so:

- ausencia de `tenant_id` em leituras e mutacoes
- dependencias implicitas de comportamento legado
- RPCs de negocio ainda acopladas a `public`
- modulos que continuam tratando `barber` como unico contexto funcional

### 2. O maior risco atual e isolamento incompleto por tenant

Os problemas mais frequentes encontrados:

- listagens de negocio sem `.eq('tenant_id', tenantId)`
- `update`/`delete` filtrando apenas por `id`
- joins de tabelas tenantizadas sem filtro do tenant atual
- cleanup/operacoes auxiliares em cascata sem filtro por tenant

### 3. As RPCs sao hoje o principal ponto de acoplamento funcional com `public`

RPCs em uso no frontend:

- `get_auth_access_context`
- `close_order`
- `deduct_chef_club_credits`
- `receive_purchase_order`

As duas primeiras de negocio financeiro/operacional (`close_order`, `deduct_chef_club_credits`) dependem de tabelas de dominio e precisam virar schema-aware para o modelo final. `receive_purchase_order` esta em uso, mas sua definicao nao foi encontrada nas migrations versionadas do repositorio.

### 4. Existem tabelas de negocio usadas no app que nao estao totalmente versionadas no repositorio

O caso mais importante e `transactions`:

- usada em varios modulos financeiros e gerenciais
- sempre tratada como tabela de negocio tenantizada
- nenhuma migration local encontrada definindo sua estrutura

Impacto:

- a migracao `public -> barber` deve tratar `transactions` de forma condicional/introspectiva
- nao e seguro inventar DDL dessa tabela apenas com base no frontend

### 5. O projeto ainda contem muitos textos e suposicoes barber-first

Isso aparece em copy, onboarding, portal, kiosk e telas gerenciais. Na maior parte dos casos o impacto e apenas de manutencao/produto, nao de isolamento de dados. Esses pontos nao devem ser misturados com a refatoracao critica de schema/tenant.

## Arquivos criticos e risco por arquivo

Legenda de tipo de risco:

- `quebra funcional`
- `vazamento entre tenants`
- `financeiro/operacional`
- `manutencao`

### Prioridade maxima

#### `pages/Checkout.tsx`

- Classificacao: dominio barber
- Tabelas: `clients`, `staff`, `services`, `products`, `promotions`, `comandas`, `comanda_items`, `customer_subscriptions`, `transactions`
- RPCs: `close_order`, `deduct_chef_club_credits`
- Diagnostico:
  - boa parte das leituras ja filtra `tenant_id`
  - modulo depende de RPCs criticas ainda acopladas ao modelo legado
  - grava `transactions`, tabela nao versionada localmente
- Tipo de risco:
  - quebra funcional
  - financeiro/operacional
  - vazamento entre tenants

#### `pages/Orders.tsx`

- Classificacao: dominio barber
- Tabelas: `purchase_orders`, `suppliers`, `products`
- RPCs: `receive_purchase_order`
- Diagnostico:
  - listagens principais sem filtro por `tenant_id`
  - `update` de status por `id` apenas
  - depende de RPC nao versionada localmente
- Tipo de risco:
  - quebra funcional
  - financeiro/operacional
  - vazamento entre tenants

#### `pages/Products.tsx`

- Classificacao: dominio barber
- Tabelas: `products`
- Diagnostico:
  - listagem sem filtro por `tenant_id`
  - `update` por `id` sem `tenant_id`
  - tela sensivel por abastecer checkout, pedidos e operacao
- Tipo de risco:
  - vazamento entre tenants
  - financeiro/operacional
  - quebra funcional

### Prioridade alta

#### `pages/Promotions.tsx`

- Classificacao: dominio barber
- Tabelas: `promotions`, `services`, `products`
- Diagnostico:
  - listagem de promocoes sem `tenant_id`
  - listagem de servicos/produtos sem `tenant_id`
  - `update` e `delete` apenas por `id`
- Tipo de risco:
  - vazamento entre tenants
  - financeiro/operacional

#### `pages/Suppliers.tsx`

- Classificacao: dominio barber
- Tabelas: `suppliers`
- Diagnostico:
  - listagem sem `tenant_id`
  - `update` por `id`
  - `delete` por `id`
- Tipo de risco:
  - vazamento entre tenants
  - financeiro/operacional

#### `pages/ChefClubPlans.tsx`

- Classificacao: dominio barber
- Tabelas: `customer_plans`
- Diagnostico:
  - listagem sem `tenant_id`
  - `update` por `id`
  - toggle de status por `id`
- Tipo de risco:
  - vazamento entre tenants
  - financeiro/operacional

#### `pages/ChefClubSubscriptions.tsx`

- Classificacao: dominio barber
- Tabelas: `customer_subscriptions`, `customer_plans`, `customer_credits`, `clients`
- Diagnostico:
  - leitura com joins sem `tenant_id`
  - modulo sensivel por saldo de creditos/assinaturas
- Tipo de risco:
  - vazamento entre tenants
  - financeiro/operacional
  - quebra funcional

#### `pages/Clients.tsx`

- Classificacao: dominio barber
- Tabelas: `clients`, `customer_subscriptions`, `appointments`, `portal_sessions`, `feedback_barber`, `feedback_shop`, `kiosk_sessions`, `customer_credits`, `comandas`, `comanda_items`
- Diagnostico:
  - listagem principal ja filtra `tenant_id`
  - exclusao do cliente dispara limpezas auxiliares por `client_id` sem filtro de tenant em varias tabelas
  - exclusao de `comanda_items` por `comanda_id` sem validacao tenantizada
- Tipo de risco:
  - vazamento entre tenants
  - quebra funcional
  - manutencao

#### `pages/KioskAdmin.tsx`

- Classificacao: dominio barber com dependencia shared
- Tabelas barber: `kiosk_devices`, `kiosk_sessions`, `feedback_barber`, `feedback_shop`, `appointments`
- Tabelas shared: `tenants`, `tenant_addons`
- Diagnostico:
  - leitura de `kiosk_devices` ja filtra `tenant_id`
  - `update` e `delete` de `kiosk_devices` por `id` apenas
  - mistura correta em tese entre shared e dominio, mas ainda sem guard rails centrais
- Tipo de risco:
  - vazamento entre tenants
  - quebra funcional
  - manutencao

#### `components/NotificationCenter.tsx`

- Classificacao: core/shared
- Tabelas: `notifications`
- Diagnostico:
  - busca notificacoes sem filtro por `tenant_id` ou `user_id`
  - `markAsRead` e `markAllAsRead` operam por ids sem restricao adicional
  - realtime fixado em `public:notifications`
- Tipo de risco:
  - vazamento entre tenants
  - manutencao

#### `components/Layout.tsx`

- Classificacao: core/shared
- Tabelas: `notifications`
- Diagnostico:
  - contador de nao lidas sem filtro por `tenant_id` ou `user_id`
  - fallback textual "Minha Barbearia" explicita suposicao barber-first
- Tipo de risco:
  - vazamento entre tenants
  - manutencao

### Prioridade media

#### `pages/Schedule.tsx`

- Classificacao: dominio barber
- Tabelas: `staff`, `services`, `clients`, `promotions`, `appointments`, `customer_subscriptions`, `comandas`, `comanda_items`
- Diagnostico:
  - listagens principais ja usam `tenant_id`
  - modulo e operacionalmente critico e deve ser auditado com cuidado na Fase 2
  - ha varias mutacoes e criacoes encadeadas; precisa padronizacao central, mesmo sem falha grave obvia em todas as operacoes
- Tipo de risco:
  - quebra funcional
  - financeiro/operacional
  - manutencao

#### `pages/Comandas.tsx`

- Classificacao: dominio barber
- Tabelas: `comandas`, `comanda_items`
- Diagnostico:
  - listagem ja filtra tenant para usuarios nao-superadmin
  - mutacao de cancelamento usa `tenant_id` no fluxo principal
  - ainda depende de comportamento legado do proxy e merece endurecimento posterior
- Tipo de risco:
  - financeiro/operacional
  - manutencao

#### `pages/Cashflow.tsx`

- Classificacao: dominio barber
- Tabelas: `transactions`
- Diagnostico:
  - leitura usa `tenant_id`
  - depende da tabela `transactions`, nao versionada localmente
- Tipo de risco:
  - quebra funcional
  - financeiro/operacional
  - manutencao

#### `pages/Expenses.tsx`

- Classificacao: dominio barber
- Tabelas: `transactions`
- Diagnostico:
  - CRUD ja tenantizado
  - depende da tabela `transactions`, nao versionada localmente
- Tipo de risco:
  - financeiro/operacional
  - manutencao

#### `pages/Payroll.tsx`

- Classificacao: dominio barber
- Tabelas: `staff`, `comanda_items`, `transactions`
- Diagnostico:
  - leituras e gravacoes principais usam `tenant_id`
  - depende da tabela `transactions`
  - impacto operacional alto por lidar com pagamentos
- Tipo de risco:
  - financeiro/operacional
  - manutencao

#### `pages/Reports.tsx`

- Classificacao: dominio barber
- Tabelas: `transactions`, `staff`, `comandas`, `comanda_items`
- Diagnostico:
  - leituras principais usam `tenant_id`
  - depende de `transactions`
- Tipo de risco:
  - manutencao
  - financeiro/operacional

### Shared/admin e observacoes complementares

#### `context/AuthContext.tsx`

- Classificacao: core/shared
- Tabelas/RPCs: `profiles`, `staff`, `get_auth_access_context`
- Diagnostico:
  - deve continuar em `public`
  - dependencia correta de RPC shared
- Tipo de risco:
  - quebra funcional, caso a RPC shared seja alterada de forma incompatível

#### `src/lib/supabase/tenant.ts`

- Classificacao: core/shared
- Tabelas: `tenants`, `user_tenants`, `profiles`, `staff`
- Diagnostico:
  - base correta para consolidar exigencia de tenant
  - ainda precisa helpers mais defensivos na Fase 2
- Tipo de risco:
  - manutencao

#### `pages/Admin.tsx`, `pages/SuperAdmin.tsx`, `pages/Support.tsx`, `pages/portal/*`

- Classificacao: majoritariamente core/shared
- Diagnostico:
  - usam tabelas shared e realtime em `public`
  - contem varias suposicoes barber-first de copy e naming
  - nao sao foco inicial da migracao do dominio barber, exceto onde cruzam com tabelas operacionais
- Tipo de risco:
  - manutencao
  - em alguns casos, vazamento entre tenants nas features shared mal filtradas

## Classificacao de tabelas

### Core/shared - permanecem em `public`

- `tenants`
- `profiles`
- `user_tenants`
- `tenant_addons`
- `notifications`
- `support_tickets`
- `ticket_messages`
- `audit_logs`
- `portal_sessions`
- `otp_requests`
- `apps`
- `usage_logs`
- `alerts`
- `notification_channels`
- `access_requests`
- `plan_change_requests`
- funcoes de auth/acesso

### Dominio barber - devem migrar para schema dinamico

- `clients`
- `services`
- `staff`
- `appointments`
- `comandas`
- `comanda_items`
- `products`
- `purchase_orders`
- `suppliers`
- `promotions`
- `customer_plans`
- `customer_subscriptions`
- `customer_credits`
- `schedule_blocks`
- `kiosk_devices`
- `kiosk_sessions`
- `feedback_barber`
- `feedback_shop`
- `transactions` se existir no banco

### Ambiguo / com dependencia shared

- `kiosk_devices`
  - classificacao final: dominio barber com dependencia shared
- `kiosk_sessions`
  - dominio barber, mas parte do fluxo depende de `tenants` e `tenant_addons`
- `notifications`
  - shared por desenho atual, mas precisa isolamento por `tenant_id` e/ou `user_id`
- `transactions`
  - dominio barber na pratica, mas estrutura nao versionada localmente

## Inventario de RPCs e funcoes SQL

### `public.get_auth_access_context`

- Uso: `context/AuthContext.tsx`
- Le:
  - `public.profiles`
  - `public.staff`
- Escreve: nada
- Depende de `tenant_id`: sim, para resolver contexto
- Classificacao:
  - continua em `public`
- Observacao:
  - e funcao shared e nao deve migrar para schema de dominio

### `public.current_is_super_admin_from_auth_uid`

- Uso indireto em policies e migrations
- Le:
  - `public.profiles`
- Escreve: nada
- Depende de `tenant_id`: nao diretamente
- Classificacao:
  - continua em `public`

### `public.current_tenant_id_from_auth_uid`

- Uso indireto em policies e migrations
- Le:
  - `public.profiles`
  - `public.staff`
- Escreve: nada
- Depende de `tenant_id`: sim
- Classificacao:
  - continua em `public`

### `public.close_order`

- Uso: `pages/Checkout.tsx`
- Le:
  - `public.comanda_items`
- Escreve:
  - `public.products`
  - `public.comandas`
- Depende de `tenant_id`: operacionalmente sim, mas a assinatura atual nao explicita schema/tenant
- Classificacao:
  - precisa ser schema-aware
- Observacao:
  - impacta estoque e fechamento de venda

### `public.deduct_chef_club_credits`

- Uso: `pages/Checkout.tsx`
- Le/escreve:
  - `public.customer_credits`
- Depende de `tenant_id`: sim, por modelo de negocio
- Classificacao:
  - precisa ser schema-aware
- Observacao:
  - impacta saldo de creditos e fidelizacao

### `public.receive_purchase_order`

- Uso: `pages/Orders.tsx`
- Definicao local encontrada: nao
- Tabelas afetadas: nao foi possivel confirmar via migrations do repositorio
- Depende de `tenant_id`: provavelmente sim
- Classificacao:
  - depende de fallback legado temporario
- Observacao:
  - nao deve ser refatorada sem versionar primeiro a definicao atual do banco

## Lista consolidada de arquivos afetados

### Modulos barber criticos

- `pages/Checkout.tsx`
- `pages/Orders.tsx`
- `pages/Products.tsx`
- `pages/Promotions.tsx`
- `pages/Suppliers.tsx`
- `pages/ChefClubPlans.tsx`
- `pages/ChefClubSubscriptions.tsx`
- `pages/Clients.tsx`
- `pages/Schedule.tsx`
- `pages/Comandas.tsx`
- `pages/Cashflow.tsx`
- `pages/Expenses.tsx`
- `pages/Payroll.tsx`
- `pages/Reports.tsx`
- `pages/KioskAdmin.tsx`
- `pages/kiosk/*`
- `pages/portal/PortalSchedule.tsx`

### Shared/core com impacto de isolamento

- `components/NotificationCenter.tsx`
- `components/Layout.tsx`
- `context/AuthContext.tsx`
- `src/lib/supabase/schemas.ts`
- `src/lib/supabase/client.ts`
- `src/lib/supabase/tenant.ts`

## Plano incremental proposto para a Fase 2

### Bloco 1 - endurecimento central

Objetivo: criar regras unicas antes de tocar nos modulos.

Arquivos base:

- `src/lib/supabase/schemas.ts`
- `src/lib/supabase/client.ts`
- `src/lib/supabase/tenant.ts`

Acao:

- reforcar classificacao de tabelas shared x barber
- validar `appSlug`
- exigir tenant autenticado em tabela tenantizada
- expor helper para cliente correto por tabela
- expor helper para bloquear modulo incompatível com app atual

### Bloco 2 - prioridade maxima operacional e financeira

Arquivos:

- `pages/Checkout.tsx`
- `pages/Orders.tsx`
- `pages/Products.tsx`

Acao:

- trocar acessos mais sensiveis para helpers centrais
- garantir `tenant_id` em todas as queries/mutations de negocio
- garantir `id + tenant_id` em updates/deletes
- isolar dependencia de RPC legada onde ainda nao for seguro migrar

### Bloco 3 - modulos de negocio com vazamento evidente

Arquivos:

- `pages/Promotions.tsx`
- `pages/Suppliers.tsx`
- `pages/ChefClubPlans.tsx`
- `pages/ChefClubSubscriptions.tsx`
- `pages/Clients.tsx`
- `pages/KioskAdmin.tsx`

Acao:

- corrigir listagens sem `tenant_id`
- corrigir mutacoes por `id` apenas
- separar shared x dominio no fluxo kiosk

### Bloco 4 - modulos barber de alta sensibilidade operacional

Arquivos:

- `pages/Schedule.tsx`
- `pages/Comandas.tsx`
- `services/scheduleBlocksApi.ts`
- `pages/Cashflow.tsx`
- `pages/Expenses.tsx`
- `pages/Payroll.tsx`
- `pages/Reports.tsx`

Acao:

- consolidar o mesmo padrao
- evitar regressao funcional
- mapear impacto real da tabela `transactions`

### Bloco 5 - shared com isolamento por tenant/user

Arquivos:

- `components/NotificationCenter.tsx`
- `components/Layout.tsx`

Acao:

- manter `notifications` em `public`
- filtrar por `tenant_id` e/ou `user_id`
- revisar realtime em `public`

## Pendencias travadas antes da Fase 2

- validar este relatorio
- confirmar que a Fase 2 comeca apenas apos aprovacao deste diagnostico
- manter `receive_purchase_order` no fallback ate versionar a funcao atual do banco
- tratar `transactions` como tabela de negocio existente, porem nao totalmente documentada localmente

## Resultado esperado apos validacao desta fase

Com este relatorio validado, a Fase 2 pode avancar com escopo claro, reduzindo o risco de:

- quebrar o fluxo atual do barber
- mexer cedo demais em RPCs nao versionadas
- misturar problema de branding com problema de isolamento de dados
- iniciar migracao de schema sem fechar os vazamentos mais perigosos de `tenant_id`
