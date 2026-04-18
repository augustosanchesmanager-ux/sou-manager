# Blueprint Inicial - Fase 2 do Frontend Multiapp da SMG

Data: 2026-04-07

Status: Publicado como base de execucao da Fase 2

## Objetivo

Definir a fronteira estrutural inicial do frontend da SMG para que a modularizacao da Fase 2 seja guiada por ownership tecnico, e nao por reorganizacao cosmetica.

## Estrutura oficial inicial

```text
src/
├── app/
│   ├── architecture/
│   ├── core/
│   └── shared/
└── apps/
    └── barber/
        └── manifests/
```

## Regra de classificacao

### `src/app/core`

Colocar aqui:

- auth
- tenancy
- app resolution
- routing
- access control
- runtime authority

Nao colocar aqui:

- pagina de dominio
- UI especifica do `barber`
- service de negocio especifico

### `src/app/shared`

Colocar aqui:

- UI reutilizavel
- hooks reutilizaveis
- layouts compartilhados
- services que nao decidem autoridade

Nao colocar aqui:

- logica que interprete `tenant`, `schema`, `app` ou excecoes de role

### `src/apps/barber`

Colocar aqui:

- manifests do `barber`
- rotas do `barber`
- paginas do `barber`
- modulos do `barber`

Nao colocar aqui:

- regra de plataforma
- runtime authority
- dependencias que facam do `barber` o centro estrutural da SMG

## Criterio de uso

Toda nova mudanca estrutural da Fase 2 deve responder:

1. este arquivo pertence ao `core`, `shared` ou `app-specific`?
2. este arquivo decide autoridade ou apenas consome autoridade?
3. esta mudanca reduz ou aumenta acoplamento estrutural ao `barber`?
