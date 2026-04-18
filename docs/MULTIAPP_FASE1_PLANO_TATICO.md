# Plano Tatico - Fase 1 do Core Shared Multiapp da SMG

Data: 2026-04-04

Status: Concluida formalmente em 2026-04-07

Referencias:

- [ADR_001_MULTIAPP_PLATFORM.md](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/docs/ADR_001_MULTIAPP_PLATFORM.md)
- [MULTIAPP_ROADMAP_FASES.md](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/docs/MULTIAPP_ROADMAP_FASES.md)
- [MULTI_APP_PHASE1_AUDIT.md](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/docs/MULTI_APP_PHASE1_AUDIT.md)

## 1. Objetivo tecnico

Consolidar o `shared core` multiapp da SMG para que toda nova evolucao use o mesmo contrato de:

- app
- tenant
- schema
- modulo
- permissao

O problema estrutural atacado nesta fase e impedir que o sistema continue resolvendo contexto de forma parcialmente distribuida entre telas, helpers e convencoes informais.

## 2. Diagnostico arquitetural

O repositorio ja tem a fundacao certa, mas ainda precisa de consolidacao.

Arquivos centrais ja existentes:

- [schemas.ts](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/lib/supabase/schemas.ts)
- [client.ts](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/lib/supabase/client.ts)
- [tenant.ts](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/lib/supabase/tenant.ts)
- [AppContext.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/context/AppContext.tsx)
- [TenantContext.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/context/TenantContext.tsx)
- [src/modules/index.ts](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/modules/index.ts)

Sinais positivos:

- `appSlug` ja existe como conceito formal
- schema shared vs domain ja existe
- `user_tenants` ja participa da resolucao oficial
- o projeto ja possui um registry inicial de apps

Limitacoes atuais:

- o registry de modulos ainda e raso e nao governa comportamento
- as tabelas shared/domain existem como sets, mas ainda nao como contrato operacional do time
- nao existe checklist oficial para novos modulos multiapp
- ainda falta uma camada unica para declarar suporte de modulo por app, tenant requirement e tabelas tocadas

Riscos se esta fase for pulada:

- crescimento por convencao e memoria
- novos modulos ignorando o contrato multiapp
- repeticao de logica de tenant/schema em telas
- aumento de acoplamento ao `barber`

## 3. Solucao proposta

A Fase 1 deve ser executada em quatro frentes pequenas e cumulativas.

### Frente A - Contrato central de dominio tecnico

Objetivo:

- tornar `schemas.ts` a fonte oficial de verdade da plataforma para classificacao estrutural

Arquivos-alvo:

- [schemas.ts](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/lib/supabase/schemas.ts)

Entregas:

- classificacao final e revisada de:
  - `APP_SLUGS`
  - `CORE_PUBLIC_TABLES`
  - `DOMAIN_TABLES`
  - `TENANT_GUARDED_TABLES`
  - `AppModuleSlug`
- documentacao inline curta explicando o criterio de cada grupo
- funcoes utilitarias sem sobreposicao de responsabilidade

Criterio de pronto:

- qualquer engenheiro consegue responder, olhando apenas `schemas.ts`, se uma tabela e shared, domain, tenant-guarded e qual app um modulo suporta

### Frente B - Contrato central de acesso

Objetivo:

- impedir novas variacoes de acesso a app, schema e tenant fora do core

Arquivos-alvo:

- [client.ts](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/lib/supabase/client.ts)
- [tenant.ts](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/lib/supabase/tenant.ts)

Entregas:

- contrato unico para:
  - `getSharedClient`
  - `getSchemaClient`
  - `getScopedClient`
  - `getClientForTable`
  - `requireTenantId`
  - `requireTenantContext`
- mensagens de erro consistentes para:
  - tenant ausente
  - app invalido
  - schema invalido
  - modulo nao suportado
- definicao explicita de quando uma operacao pode existir sem tenant

Criterio de pronto:

- nenhum novo modulo tenantizado precisa decidir sozinho qual schema usar ou se tenant e obrigatorio

### Frente C - Contrato central de contexto da interface

Objetivo:

- garantir que o frontend inteiro consuma o mesmo contexto oficial

Arquivos-alvo:

- [AppContext.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/context/AppContext.tsx)
- [TenantContext.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/context/TenantContext.tsx)
- [resolveApp.ts](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/middleware/resolveApp.ts)

Entregas:

- contrato explicito de `AppContextValue`
- contrato explicito de `TenantContextValue`
- estado de erro previsivel para app invalido ou tenant nao resolvido
- refresh de tenant padronizado
- documentacao curta de consumo dos contexts

Criterio de pronto:

- toda tela sabe de qual app esta falando, qual tenant esta ativo e qual e o estado de erro permitido

### Frente D - Registry oficial de modulos multiapp

Objetivo:

- transformar `src/modules` em base de governanca e nao apenas cadastro simples

Arquivos-alvo:

- [src/modules/index.ts](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/modules/index.ts)
- [src/modules/barber/index.ts](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/modules/barber/index.ts)
- [src/modules/auto/index.ts](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/modules/auto/index.ts)
- [src/modules/club/index.ts](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/modules/club/index.ts)

Entregas:

- tipo central de definicao de modulo por app
- campos minimos por modulo:
  - `slug`
  - `label`
  - `enabled`
  - `supportedModules`
  - `defaultSchema`
  - `requiresTenant`
- helper para consultar se o app suporta um modulo

Criterio de pronto:

- o sistema possui um contrato unico para saber o que cada app da SMG suporta

## 4. Modelagem e estrutura

### Ordem recomendada de execucao

1. Revisar `schemas.ts`
2. Consolidar `tenant.ts`
3. Consolidar `client.ts`
4. Endurecer `AppContext` e `TenantContext`
5. Evoluir `src/modules/*`
6. Publicar checklist tecnico da fase

### Artefato tecnico esperado ao final

```text
src/
├── context/
│   ├── AppContext.tsx
│   └── TenantContext.tsx
├── lib/
│   └── supabase/
│       ├── schemas.ts
│       ├── tenant.ts
│       └── client.ts
└── modules/
    ├── index.ts
    ├── barber/
    ├── auto/
    └── club/
```

### Contratos minimos que devem existir ao final da fase

#### Contrato de tabela

- shared
- domain
- tenant-guarded

#### Contrato de operacao

- requer tenant
- schema esperado
- app permitido

#### Contrato de modulo

- modulo existe
- modulo pertence ao app atual
- modulo pode ser exibido
- modulo pode acessar dados

## 5. Impactos e migracao

### O que muda

- a SMG sai de um modelo baseado em convencoes dispersas para um core shared governado
- o time passa a ter um ponto unico para entender app, tenant e schema
- novos modulos passam a nascer com contrato multiapp real

### O que nao deve mudar nesta fase

- nao mover em massa pastas de UI ainda
- nao reestruturar o frontend inteiro ainda
- nao ativar novos apps produtivos
- nao acoplar esta fase a uma refatoracao visual

### Estrategia de transicao

- endurecimento dos contratos centrais primeiro
- adocao progressiva nas telas novas e criticas depois
- modularizacao maior de frontend somente na Fase 2

## 6. Validacao

### O que testar

- `resolveApp` com hostname conhecido, desconhecido e fallback local
- `resolveTenantForUser` com:
  - usuario com membership valida
  - usuario sem membership
  - fallback legado
- `requireTenantContext` em:
  - tabela tenantizada
  - tabela shared
- `getClientForTable` em:
  - tabela shared
  - tabela domain
- validacao de modulo permitido por app

### Como garantir consistencia

- revisar qualquer novo acesso a Supabase fora do core
- bloquear criacao de helpers paralelos para tenant/schema
- usar o registry de modulos como contrato para a Fase 2

## 7. Melhorias futuras

Depois desta fase, a SMG fica pronta para:

- modularizacao real de `src/app/core`, `src/app/shared` e `src/apps/barber`
- guard rails de import entre shared e app-specific
- manifests completos por app
- multi deploy por app
- observabilidade por app e tenant

## Backlog objetivo da Fase 1

### Bloco 1 - Revisao de contratos centrais

- revisar `schemas.ts`
- revisar `tenant.ts`
- revisar `client.ts`

### Bloco 2 - Endurecimento de contextos

- revisar `AppContext.tsx`
- revisar `TenantContext.tsx`
- revisar `resolveApp.ts`

### Bloco 3 - Governanca de modulos

- revisar `src/modules/index.ts`
- revisar `src/modules/barber/index.ts`
- revisar `src/modules/auto/index.ts`
- revisar `src/modules/club/index.ts`

### Bloco 4 - Documentacao operacional

- publicar checklist de criacao de modulo multiapp
- publicar contrato resumido de app/tenant/schema/modulo

## Definicao de pronto da Fase 1

A Fase 1 sera considerada concluida quando:

- existir uma unica fonte de verdade para shared/domain/tenant-guarded
- existir uma unica fonte de verdade para app/tenant/schema access
- existir um registry minimo de modulos por app
- o time puder criar um novo modulo multiapp sem depender de suposicoes do `barber`
- a base ficar pronta para entrar na Fase 2 sem retrabalho conceitual

## Gate de fechamento da Fase 1

Para a SMG considerar esta fase encerrada, o gate minimo de saida deve exigir:

- [Checkout.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/Checkout.tsx) fora do modelo antigo nos fluxos centrais
- [Comandas.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/Comandas.tsx) fora do modelo antigo nos fluxos centrais
- principais bordas operacionais criticas sem resolucao local de `app`, `tenant` e `schema`
- excecoes de superadmin centralizadas no contrato/contexto
- baseline de tipos limpa
- lista explicita do que permanece legado por decisao consciente

## Estado atual do gate

### Ja atendido

- contrato central consolidado em:
  - [schemas.ts](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/lib/supabase/schemas.ts)
  - [tenant.ts](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/lib/supabase/tenant.ts)
  - [client.ts](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/lib/supabase/client.ts)
- contexts endurecidos em:
  - [AppContext.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/context/AppContext.tsx)
  - [TenantContext.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/context/TenantContext.tsx)
  - [AuthContext.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/context/AuthContext.tsx)
- `Checkout` ja consumindo autoridade via contexto em vez de resolver localmente os blocos principais
- `Comandas` ja consumindo autoridade via contexto em vez de resolver localmente os blocos principais
- `Orders` com fetch, criacao, atualizacao e validacao de recebimento migrados para `requireModuleAccess`
- `Products` com CRUD central migrado para `requireModuleAccess`
- `Suppliers` com listagem, criacao, atualizacao e exclusao migradas para `requireModuleAccess`
- `Services` com listagem, criacao, atualizacao, toggle e exclusao migrados para `requireModuleAccess`
- `Clients` com listagem, detalhe, criacao, atualizacao, exclusao e importacao migrados para `requireModuleAccess`
- `Schedule` com leitura base, leitura de agendamentos, bloqueios, cancelamento, mudanca de status, movimentacao, navegacao para checkout e save principal puxados para o contrato central
- excecao de superadmin centralizada via `requireModuleAccess(..., { allowMissingTenant: true })`
- baseline de tipos limpa com `npx.cmd tsc --noEmit`

### Encerramento formal

A SMG encerra formalmente a Fase 1 em 2026-04-07 com a seguinte leitura:

- o core shared multiapp passou a ser a autoridade oficial de `app`, `tenant`, `schema` e `module access`
- as bordas operacionais criticas do `barber` passaram a consumir autoridade em vez de interpretar autoridade
- as excecoes arquiteturais relevantes ficaram centralizadas e auditaveis
- o legado remanescente ficou explicitamente inventariado e fora da autoridade principal
- a baseline de tipos permaneceu limpa durante a consolidacao

Residual nao bloqueante para a conclusao:

- remocao textual do bloco legado comentado em [Schedule.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/Schedule.tsx), sem impacto de runtime ou de autoridade
- manutencao do inventario do legado remanescente enquanto a Fase 2 avancar

## Legado remanescente por decisao consciente

Neste momento, o legado remanescente deve ser tratado como backlog explicito da SMG, nao como lacuna invisivel.

### 1. Bordas que ainda permanecem no modelo antigo de autoridade local ou em estado misto controlado

Essas telas ainda precisam de migracao de autoridade e continuam sendo o legado mais relevante para a SMG:

- [Promotions.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/Promotions.tsx)
- [Expenses.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/Expenses.tsx)
- [Payroll.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/Payroll.tsx)
- [Reports.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/Reports.tsx)
- [Cashflow.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/Cashflow.tsx)
- [KioskAdmin.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/KioskAdmin.tsx)

Decisao consciente nesta fase:

- essas bordas ainda podem permanecer em compatibilidade temporaria, desde que nao recebam novas decisoes locais de `app`, `tenant`, `schema` ou excecoes de role
- essas bordas continuam sendo o backlog principal de migracao de autoridade na SMG

### 2. Bordas ja migradas em autoridade, mas ainda apoiadas no facade legado de forma indireta

Essas telas ja deixaram de interpretar autoridade localmente, mas ainda dependem do facade por compatibilidade via contrato/contexto:

- [Checkout.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/Checkout.tsx)
- [Comandas.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/Comandas.tsx)
- [Orders.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/Orders.tsx)
- [Products.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/Products.tsx)
- [Schedule.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/Schedule.tsx)
- [Clients.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/Clients.tsx)
- [Services.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/Services.tsx)
- [Suppliers.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/Suppliers.tsx)

Decisao consciente nesta fase:

- essas telas podem continuar dependendo do facade apenas como ponto de passagem tecnico, nao como fonte de autoridade
- qualquer proxima evolucao nelas deve continuar consumindo `requireModuleAccess` ou contrato equivalente, sem regressao de contexto local

### 3. Facade legado ainda mantido por compatibilidade

Arquivo:

- [supabaseClient.ts](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/services/supabaseClient.ts)

Decisao consciente:

- o facade permanece por compatibilidade transversal do repositorio
- ele continua sendo o ponto de passagem legado para telas ainda nao migradas
- ele nao deve voltar a ser lugar de decisao espalhada; a autoridade nova deve continuar vindo do contrato/contexto

### 4. Superadmin como excecao controlada

Estado atual:

- o caso de superadmin sem tenant fixo ja foi centralizado em [AuthContext.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/context/AuthContext.tsx)

Decisao consciente:

- novas excecoes de superadmin nao devem ser tratadas direto na tela
- qualquer regra nova deve entrar primeiro no contrato/contexto

## Decisao de transicao

Com a Fase 1 encerrada, a SMG abre imediatamente a Fase 2 mantendo a mesma regua de revisao tecnica:

1. nenhuma mudanca de modularizacao pode reabrir autoridade local na borda
2. a Fase 2 deve reorganizar estrutura, ownership e fronteiras sem enfraquecer o contrato central construido
3. o facade legado continua em compatibilidade controlada, mas o objetivo agora passa a ser reduzir superficie estrutural e dependencias indiretas
4. a prioridade deixa de ser fundacao de contrato e passa a ser modularizacao real do frontend e preparacao para escalabilidade multiapp
