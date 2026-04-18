# Roadmap de Implantacao - Arquitetura Multiapp da SMG

Data: 2026-04-04

Status: Fase 1 concluida formalmente e Fase 2 iniciada em 2026-04-07

Referencia principal:

- [ADR_001_MULTIAPP_PLATFORM.md](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/docs/ADR_001_MULTIAPP_PLATFORM.md)

## Objetivo

Executar a arquitetura multiapp oficial da SMG em fases, com modularizacao real, baixo impacto no `barber` e entregas objetivas por etapa.

## Diretrizes de execucao

- preservar estabilidade operacional do `barber`
- evitar big bang arquitetural
- separar endurecimento tecnico de expansao funcional
- consolidar primeiro a plataforma, depois escalar apps
- cada fase precisa deixar um artefato validavel

## Fase 0 - Governanca e baseline

### Objetivo

Transformar a decisao arquitetural em contrato oficial de execucao.

### Entregas objetivas

- ADR multiapp oficial publicada
- roadmap por fases publicado
- alinhamento dos conceitos oficiais:
  - platform
  - shared core
  - domain app
  - tenant
  - app slug
  - schema
- definicao do owner tecnico da transicao multiapp

### Criterio de saida

- time alinhado com o desenho alvo
- repositorio com referencia documental oficial

## Fase 1 - Consolidacao do core shared

### Objetivo

Fechar a fundacao tecnica que toda a plataforma usara.

### Escopo

- `AppContext`
- `TenantContext`
- resolucao de hostname e app
- resolucao oficial por `user_tenants`
- fronteira shared x domain
- helpers de acesso tenantizado
- contratos centrais de schema e modulo

### Entregas objetivas

- mapa unico de tabelas `shared` vs `domain`
- helper unico de `requireTenantContext`
- helper unico de `ensureAppSupportsModule`
- padrao oficial para `getScopedClient` e `getClientForTable`
- checklist tecnico de criacao de novos modulos multiapp

### Riscos atacados

- uso heterogeneo de contexto
- acoplamento tecnico ao legado
- ambiguidade entre app atual e schema atual

### Criterio de saida

- qualquer modulo novo ja nasce usando contrato central
- nao existe nova logica paralela de app/tenant/schema fora do core

### Status em 2026-04-07

- concluida formalmente
- contrato central endurecido
- contexts consolidados
- bordas operacionais criticas do `barber` migradas para consumo de autoridade
- legado remanescente documentado como backlog consciente

## Fase 2 - Modularizacao real do frontend

### Objetivo

Refletir no codigo a separacao entre plataforma shared e apps da SMG.

### Escopo

- reorganizar o frontend para `core/shared/apps`
- criar fronteiras explicitas de imports
- mover modulos `barber` para estrutura app-specific
- isolar o que e shared reutilizavel

### Entregas objetivas

- pasta `src/app/core`
- pasta `src/app/shared`
- pasta `src/apps/barber`
- registrador de modulos por app
- guard rail de imports entre shared e app-specific

### Riscos atacados

- crescimento por copia do `barber`
- confusao entre plataforma e produto
- baixa legibilidade arquitetural

### Criterio de saida

- leitura do repositorio deixa claro o que e plataforma e o que e dominio
- `barber` fica isolado como app, nao como estrutura central do sistema

### Status em 2026-04-13

- iniciada formalmente
- trilha estrutural normal do `barber` encerrada formalmente dentro da fase
- legado estrutural remanescente do `barber` restrito a rotas especiais de plataforma/admin tecnico
- frente residual do runtime normal do `barber` conduzida por subfrentes nomeadas e encerrada formalmente como trilha horizontal
- remanescente da fase agora concentrado em boundary de autenticacao, dominio de administracao/plataforma e compatibilidades controladas por RPC
- `/admin` e `/superadmin` passam a ser tratados por routing proprio de platform-admin, fora do manifesto tipado do `barber`
- o dominio de administracao/plataforma passa a ter contrato proprio de runtime via `requirePlatformAdminAccess`, com endurecimento iniciado em `Admin` e `SuperAdmin`
- o dominio de administracao/plataforma passa a ter registry proprio de capability boundary para orientar a separacao entre operacao de tenant, visao global da SMG e backlog do futuro `SMG ADMIN BACKEND`
- o registry de platform-admin passa a classificar capabilities tambem por `ownershipModel` e `deliveryTarget`, deixando explicito o que fica no frontend atual e o que ja aponta para o futuro `SMG ADMIN BACKEND`
- `Admin.system` e `SuperAdmin.logs` passam a formar a fila formal `wave-1` de migracao para o futuro `SMG ADMIN BACKEND`
- `Admin.system` e `SuperAdmin.logs` ficam com politica `freeze`, sem expansao funcional no frontend atual
- a frente inicial do `SMG ADMIN BACKEND` passa a ter enquadramento proprio em [SMG_ADMIN_BACKEND_FRENTE_INICIAL.md](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/docs/SMG_ADMIN_BACKEND_FRENTE_INICIAL.md)
- o desenho tecnico inicial do `SMG ADMIN BACKEND` passa a ter artefato proprio em [SMG_ADMIN_BACKEND_DESENHO_TECNICO_INICIAL.md](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/docs/SMG_ADMIN_BACKEND_DESENHO_TECNICO_INICIAL.md)
- a frente de administracao/plataforma passa a evoluir mais por separacao de capabilities e destino arquitetural do dominio do que por limpeza generica de chamadas diretas
- `supabase-monitoring` e `portal-admin` ficam fora da frente ativa e passam a aguardar o futuro `SMG ADMIN BACKEND`
- escopo tatico detalhado em [MULTIAPP_FASE2_PLANO_TATICO.md](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/docs/MULTIAPP_FASE2_PLANO_TATICO.md)

## Fase 3 - Estabilizacao total do dominio Barber

### Objetivo

Fazer do `barber` o blueprint operacional da arquitetura sem alto impacto em producao.

### Escopo

- concluir endurecimento tenantizado dos modulos criticos
- concluir migracao segura do dominio `barber`
- estabilizar RPCs schema-aware
- preparar ativacao definitiva do schema `barber`

### Entregas objetivas

- queries criticas com `tenant_id` obrigatorio
- updates/deletes com `id + tenant_id`
- cutover controlado `public -> barber`
- checklist de smoke test do `barber`
- rollback documentado e validado

### Riscos atacados

- vazamento entre tenants
- quebra operacional no checkout, agenda e estoque
- dependencia excessiva do fallback legado

### Criterio de saida

- `barber` operando de forma estavel no modelo multi-schema
- legado reduzido ao minimo necessario

## Fase 4 - Contrato oficial para novos apps

### Objetivo

Preparar `auto` e `club` para nascerem sobre a plataforma, nao sobre o legado do `barber`.

### Escopo

- manifesto por app
- roteamento de modulos por app
- contratos de menu, rotas e permissoes
- template de schema por app
- template de bootstrap de dominio

### Entregas objetivas

- `app manifest` oficial
- `module registry` por app
- contrato de rotas por app
- checklist de onboarding tecnico para novo app
- template de migration para schema de novo dominio

### Riscos atacados

- replicacao estrutural indevida
- divergencia entre apps da plataforma
- dependencia de conhecimento tribal

### Criterio de saida

- `auto` e `club` podem ser expandidos com padrao previsivel

## Fase 5 - Multi deploy operacional

### Objetivo

Separar o ciclo de release dos apps da SMG.

### Escopo

- pipelines por app
- variaveis por app
- dominios e subdominios por app
- smoke test por deploy
- estrategia de rollback por app

### Entregas objetivas

- deploy independente de `barber`
- deploy independente de `auto`
- deploy independente de `club`
- matriz de ambientes por app
- checklist de release por app

### Riscos atacados

- acoplamento de release
- rollback amplo demais
- manutencao operacional centralizada em excesso

### Criterio de saida

- cada app publica sem carregar o risco operacional dos outros

## Fase 6 - Governanca de plataforma

### Objetivo

Sustentar o crescimento da arquitetura com controle tecnico e operacional.

### Escopo

- observabilidade por app e tenant
- auditoria de uso por app
- convencoes de ownership
- padrao de ADRs complementares
- padrao de feature flags por app

### Entregas objetivas

- dashboard por app
- trilha de auditoria por app
- mapa de ownership por modulo
- checklists de arquitetura para PRs estruturais

### Criterio de saida

- a arquitetura multiapp deixa de depender de memoria do time e passa a ser governada por processo

## Sequencia recomendada

1. Fase 0
2. Fase 1
3. Fase 2
4. Fase 3
5. Fase 4
6. Fase 5
7. Fase 6

## Priorizacao pratica imediata

Se a SMG quiser seguir com baixo risco e alta alavancagem, a ordem de trabalho imediata deve ser:

1. consolidar core shared
2. modularizar frontend
3. estabilizar `barber`
4. formalizar contrato de novos apps
5. separar deploys

## Definicao de sucesso

A implantacao sera considerada bem-sucedida quando:

- a plataforma tiver fronteiras claras entre shared e domain
- o `barber` estiver estavel no modelo multiapp
- `auto` e `club` puderem evoluir sem reaproveitamento estrutural indevido
- cada app puder ser entregue com release independente
- a governanca tecnica da SMG estiver documentada e operacional
