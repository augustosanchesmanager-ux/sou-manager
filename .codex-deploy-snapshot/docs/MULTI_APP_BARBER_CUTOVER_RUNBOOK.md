# Cutover seguro do schema `barber`

Data: 2026-04-02

## Resumo

O rollback foi necessário porque a primeira tentativa de ativar `VITE_SUPABASE_MULTI_SCHEMA_ENABLED=true` encontrou dois bloqueios de infraestrutura no schema `barber`:

- schema `barber` nao exposto na API do Supabase (`406`)
- schema/tabelas `barber` sem grants para a API (`403`)

Esses dois problemas ja foram corrigidos.

Migrations aplicadas como parte da estabilizacao:

- `20260402183000_grant_barber_schema_api_access.sql`
- `20260402190000_resync_barber_domain_from_public.sql`

## Estado atual

- producao continua em fallback legado:
  - `VITE_SUPABASE_MULTI_SCHEMA_ENABLED=false`
- `barber.soumanager.com` e `soumanager.com` estao servindo o deployment estavel
- a API do schema `barber` agora responde `200`
- o tenant principal `Barbearia Principal` (`b716e290-f7f6-4449-b790-5ae9dcdadcab`) esta alinhado entre `public` e `barber` em:
  - `clients`
  - `services`
  - `products`
  - `appointments`
  - `comandas`
  - `transactions`

## Risco residual antes do proximo corte

Enquanto a flag continuar desligada, o sistema segue escrevendo em `public`.

Isso significa que qualquer tentativa futura de ligar a flag sem uma ressincronizacao imediatamente anterior ao corte pode reintroduzir diferencas entre `public` e `barber`.

O principal exemplo observado foi:

- `1` comanda aberta nova em `public` ainda nao refletida em `barber` apos a investigacao

Tambem existe um delta historico em `comanda_items`:

- `48` itens existem em `barber` e nao em `public`
- todos pertencem a comandas `paid`
- nenhum esta orfao

Conclusao:

- nao apagar esses itens automaticamente
- tratar como legado historico
- focar no alinhamento do fluxo operacional aberto logo antes do corte

## Procedimento recomendado para o proximo cutover

### 1. Preparacao

- manter o app operando normalmente com:
  - `VITE_SUPABASE_MULTI_SCHEMA_ENABLED=false`
- avisar janela curta de mudanca
- evitar operacoes de checkout no momento exato do corte

### 2. Ressincronizacao final

Executar novamente a logica de ressincronizacao `public -> barber` imediatamente antes da ativacao.

Como a migration ja foi aplicada, a forma segura e reexecutar o SQL da migration `20260402190000_resync_barber_domain_from_public.sql` no SQL Editor, removendo apenas o `BEGIN/COMMIT` se necessario.

Objetivo:

- trazer para `barber` tudo que foi gravado em `public` desde a ultima ressincronizacao

### 3. Validacoes obrigatorias antes da flag

Conferir no tenant principal:

- `clients`: `public` == `barber`
- `services`: `public` == `barber`
- `products`: `public` == `barber`
- `appointments`: `public` == `barber`
- `comandas`: `public` == `barber`
- `transactions`: `public` == `barber`
- `open comandas`: `public` == `barber`
- `open comanda_items`: `public` == `barber`

### 4. Ativacao

- alterar `VITE_SUPABASE_MULTI_SCHEMA_ENABLED=true` em `Production`
- fazer novo deploy de producao
- validar imediatamente:
  - login
  - clientes
  - agenda
  - checkout
  - fechamento de comanda
  - baixa de estoque
  - creditos Chef Club
  - `receive_purchase_order`

### 5. Rollback

Se houver qualquer comportamento de “sumiu dado” ou falha operacional:

- voltar `VITE_SUPABASE_MULTI_SCHEMA_ENABLED=false`
- redeploy de producao

## Checklist SQL minimo de comparacao

### Contagens do tenant principal

```sql
select 'clients' as table_name,
  (select count(*) from public.clients where tenant_id = 'b716e290-f7f6-4449-b790-5ae9dcdadcab') as public_count,
  (select count(*) from barber.clients where tenant_id = 'b716e290-f7f6-4449-b790-5ae9dcdadcab') as barber_count
union all
select 'services',
  (select count(*) from public.services where tenant_id = 'b716e290-f7f6-4449-b790-5ae9dcdadcab'),
  (select count(*) from barber.services where tenant_id = 'b716e290-f7f6-4449-b790-5ae9dcdadcab')
union all
select 'products',
  (select count(*) from public.products where tenant_id = 'b716e290-f7f6-4449-b790-5ae9dcdadcab'),
  (select count(*) from barber.products where tenant_id = 'b716e290-f7f6-4449-b790-5ae9dcdadcab')
union all
select 'appointments',
  (select count(*) from public.appointments where tenant_id = 'b716e290-f7f6-4449-b790-5ae9dcdadcab'),
  (select count(*) from barber.appointments where tenant_id = 'b716e290-f7f6-4449-b790-5ae9dcdadcab')
union all
select 'comandas',
  (select count(*) from public.comandas where tenant_id = 'b716e290-f7f6-4449-b790-5ae9dcdadcab'),
  (select count(*) from barber.comandas where tenant_id = 'b716e290-f7f6-4449-b790-5ae9dcdadcab')
union all
select 'transactions',
  (select count(*) from public.transactions where tenant_id = 'b716e290-f7f6-4449-b790-5ae9dcdadcab'),
  (select count(*) from barber.transactions where tenant_id = 'b716e290-f7f6-4449-b790-5ae9dcdadcab');
```

### Comandas abertas

```sql
select 'open_comandas' as metric,
  (select count(*) from public.comandas where tenant_id = 'b716e290-f7f6-4449-b790-5ae9dcdadcab' and status = 'open') as public_count,
  (select count(*) from barber.comandas where tenant_id = 'b716e290-f7f6-4449-b790-5ae9dcdadcab' and status = 'open') as barber_count
union all
select 'open_comanda_items',
  (
    select count(*)
    from public.comanda_items
    where tenant_id = 'b716e290-f7f6-4449-b790-5ae9dcdadcab'
      and comanda_id in (
        select id
        from public.comandas
        where tenant_id = 'b716e290-f7f6-4449-b790-5ae9dcdadcab'
          and status = 'open'
      )
  ) as public_count,
  (
    select count(*)
    from barber.comanda_items
    where tenant_id = 'b716e290-f7f6-4449-b790-5ae9dcdadcab'
      and comanda_id in (
        select id
        from barber.comandas
        where tenant_id = 'b716e290-f7f6-4449-b790-5ae9dcdadcab'
          and status = 'open'
      )
  ) as barber_count;
```

## Conclusao

O proximo corte nao deve ser tratado como “ligar a flag e testar”.

O procedimento correto agora e:

1. ressincronizar
2. comparar contagens operacionais
3. ligar a flag
4. validar smoke test imediatamente
5. rollback rapido se necessario
