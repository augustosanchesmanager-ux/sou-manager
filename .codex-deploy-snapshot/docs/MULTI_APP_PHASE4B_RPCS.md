# Fase 4B - RPCs schema-aware do dominio barber

Data: 2026-03-28

## Objetivo

Preparar uma migration SQL separada para adaptar as RPCs criticas do dominio barber sem quebrar o contrato atual do frontend.

Migration gerada:

- `supabase/migrations/20260328110000_prepare_barber_rpc_schema_aware.sql`

## Escopo desta fase

RPCs adaptadas:

- `public.close_order`
- `public.check_minimum_stock`
- `public.deduct_chef_club_credits`

Fora de escopo:

- `receive_purchase_order`
- `get_auth_access_context`
- `current_is_super_admin_from_auth_uid`
- `current_tenant_id_from_auth_uid`

## Diagnostico por RPC

### 1. `close_order`

Le:

- `comandas`
- `comanda_items`

Escreve:

- `products`
- `comandas`
- chama `check_minimum_stock`

Dependencia de `tenant_id`:

- sim
- a atualizacao de estoque e fechamento de comanda precisam ficar restritos ao tenant da comanda

Estado anterior:

- totalmente acoplada a `public`

Estrategia aplicada:

- a funcao continua publica em `public`
- resolve internamente se deve operar em `public` ou `barber`
- usa o registro da comanda e a "frescura" temporal da comanda/itens para escolher o schema
- em empate ou incerteza, prefere `public`
- filtra `comanda_items`, `products` e `comandas` por `tenant_id`
- trata explicitamente o legado em `public` quando a comanda ou seus itens ainda nao tiverem `tenant_id`, sem abrir esse fallback para o schema `barber`

### 2. `check_minimum_stock`

Le:

- `products`

Escreve:

- `notifications` em `public`
- `purchase_orders` no schema de negocio escolhido

Dependencia de `tenant_id`:

- sim
- notificacao e pedido de compra dependem do tenant do produto

Estado anterior:

- totalmente acoplada a `public`

Estrategia aplicada:

- continua publica em `public`
- resolve o schema do produto internamente
- continua escrevendo `notifications` em `public`, porque e shared/core
- escreve `purchase_orders` no schema de negocio resolvido (`public` ou `barber`)
- em empate ou incerteza, prefere `public`

### 3. `deduct_chef_club_credits`

Le/escreve:

- `customer_credits`

Dependencia de `tenant_id`:

- sim
- o debito e restrito ao `tenant_id` da linha de creditos

Estado anterior:

- totalmente acoplada a `public`

Estrategia aplicada:

- continua publica em `public`
- resolve o schema dos creditos a partir de `subscription_id`
- escolhe entre `public` e `barber` pela linha mais recente
- em empate ou incerteza, prefere `public`
- mantem a mesma excecao quando nao encontra saldo suficiente ou assinatura correspondente

## Funcoes auxiliares criadas

- `public.table_has_column`
- `public.pick_barber_runtime_schema`
- `public.resolve_comanda_runtime_schema`
- `public.resolve_product_runtime_schema`
- `public.resolve_credit_runtime_schema`

Essas funcoes existem para evitar duplicacao de SQL e para tornar a resolucao de schema mais previsivel sem depender de mudanca no frontend.

## Estrategia geral de compatibilidade

- o frontend continua chamando exatamente as mesmas RPCs
- enquanto o legado continuar sendo o estado mais recente em `public`, as funcoes preferem `public`
- quando a operacao futura passar a atualizar primeiro o schema `barber`, as funcoes passam a escolher `barber` automaticamente para aquele registro
- se houver empate ou falta de metadado suficiente, o fallback continua sendo `public`

## `receive_purchase_order`

Nao foi alterada nesta fase.

Motivo:

- continua no fallback legado
- depende de definicao SQL nao versionada localmente
- ja existe mitigacao no frontend validando tenant antes da chamada

## Riscos remanescentes

- a heuristica de escolha de schema e conservadora e ainda privilegia `public` em empate
- registros antigos copiados na 4A podem continuar resolvendo para `public` ate que passem a ter estado mais recente em `barber`
- `notifications` continuam centralizadas em `public`
- `receive_purchase_order` segue fora do escopo
- linhas legadas sem `tenant_id` continuam fora da transicao automatica
- no caso especifico de `close_order`, o legado sem `tenant_id` continua sendo atendido apenas em `public`, como compatibilidade temporaria

## Instrucoes de execucao

1. Manter `VITE_SUPABASE_MULTI_SCHEMA_ENABLED=false`
2. Aplicar apenas a migration:
   - `supabase/migrations/20260328110000_prepare_barber_rpc_schema_aware.sql`
3. Validar o checklist funcional abaixo
4. Nao ligar a flag ainda

## Checklist funcional pos-aplicacao

- Checkout
- fechar comanda
- validar baixa de estoque
- validar geracao de efeitos de `close_order`
- validar consumo de creditos Chef Club
- Orders
- validar que `receive_purchase_order` continua funcionando como hoje
- comportamento com flag desligada
- confirmar que o fluxo segue operando em `public`
- comportamento apos futura ativacao da flag
- validar que registros atualizados em `barber` passam a favorecer `barber`
- rollback seguro
- como as assinaturas nao mudam, rollback imediato e reaplicar a versao anterior das funcoes ou restaurar a migration anterior

## Conclusao

Esta fase deixa as RPCs criticas preparadas para o modelo multi-schema sem mudar o contrato do frontend e sem romper o fallback atual.
