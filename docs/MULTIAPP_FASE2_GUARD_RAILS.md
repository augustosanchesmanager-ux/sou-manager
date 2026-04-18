# Guard Rails - Fase 2 da Modularizacao do Frontend da SMG

Data: 2026-04-07

Status: Ativo

## 1. Objetivo tecnico

Evitar que a Fase 2 vire reorganizacao cosmetica de pastas.

Os guard rails desta fase existem para proteger:

- ownership arquitetural
- fronteiras entre `core`, `shared` e `app-specific`
- autoridade central consolidada na Fase 1
- reducao progressiva do legado sem reabrir decisao local na borda

## 2. Regra principal

Toda mudanca estrutural precisa provar que:

- consome autoridade
- nao interpreta autoridade
- reduz acoplamento
- deixa ownership mais claro

## 3. Matriz de fronteiras

### `src/app/core`

Pode:

- centralizar runtime authority
- resolver `app`, `tenant`, `schema` e `module access`
- importar contratos shared e helpers de plataforma

Nao pode:

- depender de implementacoes `app-specific`
- assumir `barber` como referencia estrutural
- empurrar decisao de autoridade de volta para tela

### `src/app/shared`

Pode:

- conter UI reutilizavel
- conter hooks, layouts, helpers e services reutilizaveis
- ser consumido por `core` e por apps

Nao pode:

- decidir `app`, `tenant`, `schema` ou excecoes de role
- importar manifestos ou rotas de apps
- virar atalho para autoridade indireta

### `src/apps/barber`

Pode:

- declarar manifesto, rotas, ownership e composicao do app `barber`
- consumir `core` e `shared`
- manter adaptadores transitorios para paginas ainda fora da fronteira final

Nao pode:

- recriar resolucao de contexto
- virar estrutura central implicita da plataforma
- ser importado por `core` como dependencia de autoridade

## 4. Politica de imports

Permitido:

- `core` -> `shared`
- `app-specific` -> `core`
- `app-specific` -> `shared`
- `app-specific` -> contratos centrais em `src/lib` e `src/context` durante a transicao

Proibido:

- `shared` -> `app-specific`
- `core` -> implementacao de dominio do `barber`
- qualquer camada nova -> resolucao local de `app`, `tenant` ou `schema`

Transitorio aceitavel:

- `src/apps/barber` importar `pages/` enquanto a primeira onda de migracao nao move ownership completo
- `services/supabaseClient.ts` continuar como facade de compatibilidade, desde que nao volte a concentrar decisao arquitetural

## 5. Checklist de PR estrutural

Toda mudanca da Fase 2 deve responder:

1. O arquivo novo pertence a `core`, `shared` ou `app-specific`?
2. A mudanca move ownership real ou apenas caminho de import?
3. Existe algum ponto novo interpretando autoridade na borda?
4. O `barber` esta sendo tratado como app isolado ou como centro estrutural?
5. O legado remanescente ficou menor, igual ou maior?

## 6. Criterio de permanencia do facade legado

O facade legado pode permanecer apenas quando:

- a autoridade ja estiver resolvida antes do consumo
- o uso for compatibilidade transitiva
- existir inventario explicito no plano da fase

O facade legado deve sair do caminho principal quando:

- o modulo ja tiver manifesto e ownership claro
- o fluxo central ja estiver em `core` ou `app-specific`
- a substituicao nao reabrir regressao operacional

## 7. Gate de validacao

Uma mudanca estrutural da Fase 2 so e aceita quando:

- ownership novo fica mais claro no repositorio
- nenhum boundary novo fica ambiguo
- a autoridade continua no `core/contexto`
- o legado continua inventariado
- a mudanca nao recentraliza o `barber`
