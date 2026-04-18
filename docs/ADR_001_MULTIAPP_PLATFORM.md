# ADR 001 - Arquitetura Multiapp da SMG

Data: 2026-04-04

Status: Aprovado

Decisores:

- SMG
- Arquitetura principal da plataforma

## Contexto

A SMG evoluiu de um produto principal com forte orientacao `barber-first` para uma plataforma que ja possui sinais reais de operacao multiapp.

O estado atual do repositorio e do banco mostra:

- resolucao de app por hostname e subdominio
- `AppContext` com `appSlug` e `schema`
- `TenantContext` com resolucao por `user_tenants`
- proxy Supabase com roteamento por tabela e schema
- fundacao SQL para `barber`, `auto` e `club`
- migracao progressiva do dominio `barber` de `public` para schema dedicado

Apesar disso, a plataforma ainda nao esta formalmente consolidada como arquitetura oficial da SMG.

Os principais riscos do estado atual sao:

- crescimento de novos apps por copia do `barber`
- mistura entre plataforma shared e dominio operacional
- acoplamento excessivo do frontend ao contexto atual do `barber`
- assimetria entre maturidade do `barber` e a base de `auto` e `club`
- dificuldade de governanca tecnica, release e ownership por app

## Problema

A SMG precisa escalar para um modelo multiapp sustentavel sem reconstruir a base atual e sem causar alto impacto operacional no `barber`, que hoje e o app mais sensivel e mais maduro da plataforma.

## Decisao

A SMG adotara oficialmente a seguinte direcao arquitetural:

**single platform + shared core + multi schema + multi deploy**

Isso significa:

- uma unica plataforma base da SMG
- um nucleo compartilhado para identidade, acesso, tenancy, observabilidade e servicos cross-app
- um schema de banco por app para dados operacionais de dominio
- um deploy separado por app, mesmo com reaproveitamento do mesmo repositorio e do mesmo core

## Desenho alvo

```text
SMG Platform
├── Shared Core
│   ├── auth
│   ├── tenancy
│   ├── app resolution
│   ├── access control
│   ├── shared UI
│   ├── observability
│   └── platform services
├── SMG Barber
│   └── dominio operacional barber
├── SMG Auto
│   └── dominio operacional auto
├── SMG Club
│   └── dominio operacional club
└── Supabase
    ├── public
    ├── barber
    ├── auto
    └── club
```

## Fronteiras oficiais

### 1. Plataforma shared em `public`

Permanecem em `public`:

- autenticacao e identidade
- `profiles`
- `tenants`
- `user_tenants`
- `tenant_addons`
- `notifications`
- `audit_logs`
- `support_tickets`
- `ticket_messages`
- `portal_sessions`
- configuracoes e servicos de plataforma
- RPCs e helpers core/shared

Regra:

- tudo que e identidade, acesso, governanca, billing, suporte, auditoria e configuracao global fica no core shared

### 2. Dominio operacional por app em schema dedicado

Cada app operara seu dominio principal em schema proprio:

- `barber.*`
- `auto.*`
- `club.*`

Regra:

- tudo que representa operacao de negocio e dado operacional do app deve residir no schema do app

### 3. Deploy independente por app

Cada app deve ter ciclo de release proprio:

- `barber.soumanager.com`
- `auto.soumanager.com`
- `club.soumanager.com`

Regra:

- compartilhar codigo nao significa compartilhar release

## Principios arquiteturais obrigatorios

1. O `barber` deixa de ser referencia estrutural do restante da plataforma.
2. `user_tenants` passa a ser a fonte oficial de associacao usuario x tenant.
3. `profiles.tenant_id` permanece apenas como compatibilidade legada durante a transicao.
4. Nenhum novo app da SMG deve nascer por copia integral do `barber`.
5. Todo modulo novo deve declarar claramente se e `shared/core` ou `app-specific`.
6. Todo acesso a tabela tenantizada deve exigir contexto explicito de `tenant_id`.
7. Todo modulo deve declarar os apps suportados.
8. O frontend deve refletir a separacao entre plataforma e apps.
9. O rollout deve ser incremental e com baixo impacto no `barber`.

## Estrutura recomendada de frontend

```text
src/
├── app/
│   ├── core/
│   ├── shared/
│   └── platform/
├── apps/
│   ├── barber/
│   ├── auto/
│   └── club/
└── modules/
    ├── shared/
    └── app-specific/
```

Diretriz:

- `core` concentra auth, tenant, app resolution, access e observability
- `shared` concentra UI, hooks e servicos reaproveitaveis
- `apps` concentra rotas, modulos, policies e services especificos de cada app

## Fluxo oficial de contexto

1. O usuario autentica na plataforma.
2. O app ativo e resolvido pelo hostname/subdominio.
3. O tenant compativel e resolvido via `user_tenants`.
4. O papel do usuario e resolvido dentro do tenant selecionado.
5. O client Supabase direciona leitura e escrita para o schema correto.
6. A RLS reforca isolamento por `tenant_id`.

## Consequencias positivas

- escalabilidade real para novos apps da SMG
- menor acoplamento entre dominos
- menor risco de vazamento entre tenants
- deploys mais seguros por app
- melhor governanca tecnica
- melhor preparacao para squads por dominio
- reutilizacao de plataforma sem duplicacao estrutural

## Consequencias e trade-offs

- aumento inicial de disciplina arquitetural
- necessidade de modularizacao explicita no frontend
- necessidade de checklist mais forte para shared x domain
- manutencao temporaria de compatibilidade legada no `barber`
- necessidade de rollout por fases, nao por big bang

## O que esta fora desta decisao

Esta ADR nao define:

- detalhamento funcional de cada app
- design system final por app
- cronograma fechado de todas as entregas
- split fisico imediato em multiplos repositorios

Esses pontos serao tratados no roadmap de execucao e em ADRs complementares quando necessario.

## Guard rails de execucao

Durante a implantacao desta arquitetura, a SMG deve seguir obrigatoriamente:

- priorizar baixo impacto no `barber`
- evitar migracoes simultaneas de banco, frontend e produto no mesmo pacote
- nao misturar branding com isolamento de dados
- nao criar novos modulos diretamente no legado se eles ja nascerem como multiapp
- tratar `shared` e `domain` como contratos explicitos
- testar resolucao de app, tenant, schema e permissao em toda entrega estrutural

## Resultado esperado

Ao final da implantacao em fases, a SMG passa a operar oficialmente como plataforma multiapp:

- com core compartilhado governado
- com dominos isolados por schema
- com deploy separado por app
- com crescimento de `auto` e `club` sem dependencia estrutural do `barber`

## Referencias

- [ARQUITETURA.md](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/docs/ARQUITETURA.md)
- [MULTI_APP_PHASE1_AUDIT.md](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/docs/MULTI_APP_PHASE1_AUDIT.md)
- [MULTI_APP_PHASE4A_MIGRATION.md](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/docs/MULTI_APP_PHASE4A_MIGRATION.md)
- [MULTI_APP_PHASE4B_RPCS.md](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/docs/MULTI_APP_PHASE4B_RPCS.md)
- [MULTI_APP_BARBER_CUTOVER_RUNBOOK.md](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/docs/MULTI_APP_BARBER_CUTOVER_RUNBOOK.md)
