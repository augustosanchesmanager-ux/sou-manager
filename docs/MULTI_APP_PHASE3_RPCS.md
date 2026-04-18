# Fase 3 - Inventario de RPCs e Funcoes SQL

Data: 2026-03-25

## Objetivo

Registrar o inventario real das RPCs usadas pelo projeto, classificar o papel de cada uma no modelo multi-app e definir, de forma conservadora, quais:

- continuam em `public`
- precisam se tornar schema-aware
- dependem temporariamente do fallback legado

Nesta fase, nenhuma migration SQL nova foi aplicada automaticamente porque nao ha base suficiente para alterar as RPCs de negocio sem risco de quebra operacional.

## Metodo de auditoria

Foram inspecionados:

- chamadas `.rpc(...)` no frontend
- migrations SQL versionadas em `supabase/migrations`
- `dump.sql`, quando aplicavel

Chamadas RPC encontradas no frontend:

- `get_auth_access_context`
- `close_order`
- `deduct_chef_club_credits`
- `receive_purchase_order`

Observacao importante:

- `receive_purchase_order` esta em uso no frontend, mas sua definicao nao foi encontrada nem nas migrations versionadas nem no `dump.sql` presente no repositorio

## Inventario real das RPCs

### 1. `public.get_auth_access_context`

- Uso no frontend:
  - `context/AuthContext.tsx`
- Definicao encontrada:
  - `supabase/migrations/20260308_multitenant_hotfix.sql`
- Le:
  - `public.profiles`
  - `public.staff`
- Escreve:
  - nada
- Usa `tenant_id`:
  - sim, para compor o contexto autenticado
- Tipo:
  - funcao shared/core
- Classificacao final:
  - continua em `public`
- Motivo:
  - depende de perfil, papel e contexto global de autenticacao
  - nao e funcao de dominio barber
  - deve seguir disponivel como infraestrutura compartilhada

### 2. `public.current_is_super_admin_from_auth_uid`

- Uso:
  - policies e funcoes shared
- Definicao encontrada:
  - `supabase/migrations/20260308_multitenant_hotfix.sql`
- Le:
  - `public.profiles`
- Escreve:
  - nada
- Usa `tenant_id`:
  - nao diretamente
- Tipo:
  - funcao shared/core
- Classificacao final:
  - continua em `public`

### 3. `public.current_tenant_id_from_auth_uid`

- Uso:
  - policies e funcoes shared
- Definicao encontrada:
  - `supabase/migrations/20260308_multitenant_hotfix.sql`
- Le:
  - `public.profiles`
  - `public.staff`
- Escreve:
  - nada
- Usa `tenant_id`:
  - sim
- Tipo:
  - funcao shared/core
- Classificacao final:
  - continua em `public`

### 4. `public.close_order`

- Uso no frontend:
  - `pages/Checkout.tsx`
- Definicao encontrada:
  - versao inicial em `supabase/migrations/20260220145404_inventory_rpc_functions.sql`
  - versao corrigida em `supabase/migrations/20260220145723_fix_close_order_rpc_and_schema_v3.sql`
- Le:
  - `public.comanda_items`
- Escreve:
  - `public.products`
  - `public.comandas`
- Usa `tenant_id`:
  - nao na assinatura
  - implicitamente depende de dados tenantizados
- Impacto:
  - estoque
  - fechamento da comanda
  - vendas pagas
- Classificacao final:
  - precisa ser schema-aware
- Situacao atual:
  - ainda acoplada a `public`
  - o frontend manteve a chamada atual sem mudar assinatura
- Motivo para nao alterar agora:
  - migrar esta funcao sem quebra exige estrategia segura de resolucao de schema
  - a funcao auxiliar `check_minimum_stock` tambem esta acoplada a `public`
  - qualquer mudanca apressada pode afetar estoque e fechamento de venda

### 5. `public.check_minimum_stock`

- Uso:
  - chamada internamente por `close_order`
- Definicao encontrada:
  - `supabase/migrations/20260220145404_inventory_rpc_functions.sql`
- Le:
  - `public.products`
- Escreve:
  - `public.notifications`
  - `public.purchase_orders`
- Usa `tenant_id`:
  - sim, ao inserir notificacao e pedido de compra com `tenant_id` do produto
- Classificacao final:
  - precisa ser schema-aware em conjunto com `close_order`
- Observacao:
  - e dependente de dominio barber com efeito colateral em tabela shared (`notifications`)

### 6. `public.deduct_chef_club_credits`

- Uso no frontend:
  - `pages/Checkout.tsx`
- Definicao encontrada:
  - `supabase/migrations/20260311_chef_club_tables.sql`
- Le/escreve:
  - `public.customer_credits`
- Usa `tenant_id`:
  - nao na assinatura
  - indiretamente, porque os creditos sao tenantizados
- Impacto:
  - saldo de creditos
  - checkout com assinatura
- Classificacao final:
  - precisa ser schema-aware
- Situacao atual:
  - ainda acoplada a `public`
  - frontend continua chamando a mesma assinatura
- Motivo para nao alterar agora:
  - qualquer erro aqui afeta saldo e cobranca de cliente
  - a refatoracao segura depende da estrategia definitiva de leitura/escrita entre `public` e `barber`

### 7. `receive_purchase_order`

- Uso no frontend:
  - `pages/Orders.tsx`
- Definicao encontrada nas migrations:
  - nao
- Definicao encontrada em `dump.sql`:
  - nao
- Le/escreve:
  - nao foi possivel confirmar com base no repositorio
- Usa `tenant_id`:
  - provavelmente sim, mas nao ha definicao versionada para comprovar
- Impacto:
  - estoque
  - recebimento de pedido
  - fluxo operacional de compras
- Classificacao final:
  - depende temporariamente do fallback legado
- Situacao atual:
  - o frontend foi endurecido na Fase 2 para validar que o pedido pertence ao `tenant` atual antes da chamada da RPC
- Motivo para nao alterar agora:
  - nao existe definicao SQL versionada suficiente para mudanca segura
  - alterar a funcao sem a fonte real do banco seria especulativo

## Classificacao consolidada

### Continua em `public`

- `get_auth_access_context`
- `current_is_super_admin_from_auth_uid`
- `current_tenant_id_from_auth_uid`

### Precisa virar schema-aware

- `close_order`
- `check_minimum_stock`
- `deduct_chef_club_credits`

### Continua temporariamente no fallback legado

- `receive_purchase_order`

## Ajustes aplicados nesta fase

Nenhuma migration SQL nova foi gerada nesta fase.

Motivo:

- `close_order` e `deduct_chef_club_credits` sao criticas demais para serem alteradas sem um desenho SQL de fallback controlado e sem ambiguidade entre `public` e `barber`
- `receive_purchase_order` nao possui definicao versionada localmente

Ajuste indireto ja existente da Fase 2, mantido como mitigacao:

- `pages/Orders.tsx` agora valida que o pedido pertence ao `tenant` atual antes de chamar `receive_purchase_order`

## Recomendacao conservadora para a proxima etapa

### Candidatas a migration SQL segura na proxima fase SQL/RPC

1. `close_order`
2. `check_minimum_stock`
3. `deduct_chef_club_credits`

### Estrategia sugerida

- manter a assinatura do frontend exatamente como esta hoje
- fazer a funcao resolver primeiro o registro-alvo pelo `id`
- tentar localizar o registro no schema `barber`
- se nao existir, cair para `public`
- usar essa mesma estrategia em todas as leituras/escritas internas da funcao

### Pre-requisito para tratar `receive_purchase_order`

- extrair do ambiente Supabase a definicao SQL atual da funcao
- versionar essa definicao no repositorio
- so depois decidir se ela vira schema-aware ou se continua ligada ao fallback

## Pendencias documentadas

- falta definicao versionada de `receive_purchase_order`
- `check_minimum_stock` ainda nao esta tratada explicitamente no plano de migracao, embora seja dependencia direta de `close_order`
- ainda nao existe migration que torne as RPCs barber schema-aware sem mudar a assinatura do frontend

## Conclusao da Fase 3

O inventario real das RPCs foi fechado.

Estado final desta fase:

- shared/core confirmadas em `public`
- funcoes barber criticas identificadas como candidatas a schema-aware
- funcao sem definicao versionada mantida explicitamente em fallback temporario
- nenhuma alteracao destrutiva ou especulativa foi aplicada no banco
