# Fase 4A - Preparacao do dominio barber no schema proprio

Data: 2026-03-25

## Objetivo

Gerar uma migration SQL conservadora para preparar a migracao gradual do dominio `barber` de `public` para `barber`, sem apagar nada do schema atual e sem tocar nas RPCs criticas nesta etapa.

Migration gerada:

- `supabase/migrations/20260325140000_prepare_barber_domain_schema.sql`

## Diagnostico das tabelas encontradas

Com base nas migrations versionadas e no uso real no projeto, as tabelas do dominio operacional barber confirmadas foram:

- `appointments`
- `clients`
- `comanda_items`
- `comandas`
- `customer_credits`
- `customer_plans`
- `customer_subscriptions`
- `feedback_barber`
- `feedback_shop`
- `kiosk_devices`
- `kiosk_sessions`
- `products`
- `promotions`
- `purchase_orders`
- `schedule_blocks`
- `services`
- `suppliers`

Tabela critica com tratamento condicional:

- `transactions`

## Classificacao final por tabela

### Migra para barber

- `appointments`
- `clients`
- `comanda_items`
- `comandas`
- `customer_credits`
- `customer_plans`
- `customer_subscriptions`
- `feedback_barber`
- `feedback_shop`
- `kiosk_devices`
- `kiosk_sessions`
- `products`
- `promotions`
- `purchase_orders`
- `schedule_blocks`
- `services`
- `suppliers`

### Permanece em public

- `profiles`
- `staff`
- `user_tenants`
- `tenants`
- `tenant_addons`
- `notifications`
- `support_tickets`
- `ticket_messages`
- `audit_logs`
- `otp_requests`
- `portal_sessions`
- `plan_change_requests`
- `access_requests`
- `usage_logs`
- `alerts`
- `notification_channels`
- funcoes shared/core

### Pendente/manual

- `transactions`
  - a migration tenta copiar apenas se `public.transactions` existir no banco
  - como a DDL nao esta versionada localmente, esta tabela continua marcada como condicional/manual
- `kiosk_addons`
  - legado/substituido por `tenant_addons`
  - nao migra para `barber`

## Estrategia aplicada na migration

- cria `schema barber` com `CREATE SCHEMA IF NOT EXISTS`
- cria as tabelas barber usando `LIKE public.<tabela>` apenas quando a tabela de destino ainda nao existir
- preserva `id`
- preserva `tenant_id`
- copia somente linhas com `tenant_id IS NOT NULL`
- evita duplicidade por `ON CONFLICT (id)` quando a tabela de destino tiver PK simples em `id`
- quando nao houver PK simples em `id`, cai para `INSERT ... WHERE NOT EXISTS`
- usa apenas colunas compativeis entre `public` e `barber`
- emite `NOTICE` com resumo por tabela ao final da migration

## Divergencias estruturais e observacoes

- `transactions`
  - sem DDL versionada localmente
  - a migration nao inventa estrutura
  - se a tabela existir em `public`, ela sera clonada/copiada por introspeccao
  - se nao existir, a migration registra pendencia via `NOTICE`
- `staff`
  - permanece em `public` por dependencia do contexto autenticado e funcoes shared
- `kiosk_devices`
  - classificada como dominio barber com dependencia shared
  - migra para `barber`, mas continua dependente de infraestrutura shared em `public`
- chaves estrangeiras entre tabelas barber e dependencias shared
  - esta migration prioriza a copia conservadora
  - ela nao reescreve relacionamentos nem move dependencias shared

## Riscos remanescentes

- RPCs criticas ainda nao foram adaptadas:
  - `close_order`
  - `check_minimum_stock`
  - `deduct_chef_club_credits`
- `receive_purchase_order` continua no fallback legado temporario
- linhas sem `tenant_id` em tabelas de negocio nao sao copiadas para `barber`
- se alguma tabela barber ja existir com estrutura divergente relevante, a copia fica limitada ao conjunto de colunas compativeis

## Instrucoes exatas de execucao no Supabase

### Ambiente local

1. Garantir que o codigo atual esteja deployado localmente com a flag ainda desligada:
   - `VITE_SUPABASE_MULTI_SCHEMA_ENABLED=false`
2. Aplicar a migration:
   - `supabase db push`
   - ou executar o arquivo no SQL Editor do projeto local/staging
3. Validar o checklist abaixo
4. Manter a flag desligada nesta fase

### Ambiente de producao

1. Fazer deploy do codigo atual sem ligar a flag multi-schema do barber
2. Executar a migration `20260325140000_prepare_barber_domain_schema.sql`
3. Rodar o checklist pos-migration
4. Manter o fallback atual ativo nesta fase

## Checklist pos-migration

- validar que o schema `barber` existe:
  - `select schema_name from information_schema.schemata where schema_name = 'barber';`
- validar que as tabelas barber foram criadas:
  - `select table_name from information_schema.tables where table_schema = 'barber' order by table_name;`
- comparar contagens entre `public` e `barber` nas tabelas migradas
- validar que `tenant_id` nao ficou nulo no destino:
  - `select count(*) from barber.clients where tenant_id is null;`
  - repetir para as demais tabelas migradas
- validar ausencia de duplicidade obvia por `id`:
  - `select id, count(*) from barber.products group by id having count(*) > 1;`
  - repetir nas tabelas criticas
- validar que a aplicacao continua operando com a flag desligada:
  - `VITE_SUPABASE_MULTI_SCHEMA_ENABLED=false`
  - login
  - listagem de clientes
  - agenda
  - checkout
  - pedidos
  - produtos

## Conclusao

Esta fase prepara o schema `barber` sem quebrar o fallback atual, sem apagar dados do `public` e sem adaptar as RPCs criticas prematuramente.
