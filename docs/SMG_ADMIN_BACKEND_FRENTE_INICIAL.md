# SMG ADMIN BACKEND - Frente Inicial

Data de referencia: 2026-04-16

## Objetivo

Abrir a frente inicial do `SMG ADMIN BACKEND` com escopo pequeno, auditavel e alinhado ao que ja foi classificado no frontend atual.

Este documento parte de [SMG_ADMIN_BACKEND_TRANSICAO_INICIAL.md](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/docs/SMG_ADMIN_BACKEND_TRANSICAO_INICIAL.md) e assume como regra operacional:

- capabilities em `wave-1` nao recebem expansao funcional no frontend atual
- o backend administrativo nasce primeiro absorvendo o que ja esta marcado como candidato formal de saida

## Escopo inicial recomendado

### Onda 1

- `Admin.system`
  - ownership atual: `platform-internal`
  - delivery target atual: `admin-backend-candidate`
  - expansion policy: `freeze`

- `SuperAdmin.logs`
  - ownership atual: `platform-observability`
  - delivery target atual: `admin-backend-candidate`
  - expansion policy: `freeze`

## Fora do escopo inicial

Estas capabilities permanecem no frontend atual por enquanto e nao entram na primeira entrega do backend administrativo:

- `Admin.overview`
- `Admin.shops`
- `Admin.users`
- `Admin.tickets`
- `Admin.access`
- `Admin.requests`
- `SuperAdmin.overview`
- `SuperAdmin.companies`
- `SuperAdmin.users`
- `SuperAdmin.subscriptions`
- `SuperAdmin.audit`

## Entregas arquiteturais minimas da frente

1. definir boundary tecnico do novo dominio de admin backend
2. decidir contrato inicial de autenticacao/autorizacao administrativa
3. modelar a primeira superficie de `system`
4. modelar a primeira superficie de `logs`
5. preservar o frontend atual apenas como camada transitoria enquanto a migracao acontece

O desenho tecnico inicial dessa frente passa a ficar registrado em [SMG_ADMIN_BACKEND_DESENHO_TECNICO_INICIAL.md](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/docs/SMG_ADMIN_BACKEND_DESENHO_TECNICO_INICIAL.md).

O mapeamento tecnico das superficies da onda 1 passa a ficar publicado em [adminBackendWave1Surfaces.ts](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/app/core/admin/adminBackendWave1Surfaces.ts).

Os contratos tecnicos iniciais da onda 1 passam a ficar publicados em [adminBackendWave1Contracts.ts](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/app/core/admin/adminBackendWave1Contracts.ts).

Os adaptadores de transicao da onda 1 passam a ficar publicados em [adminBackendWave1Adapters.ts](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/app/core/admin/adminBackendWave1Adapters.ts).

## Gate de inicio

A frente pode ser considerada aberta quando:

- `wave-1` estiver congelada para expansao funcional no frontend
- houver backlog inicial separado para `system`
- houver backlog inicial separado para `logs`
- a separacao entre frontend transitorio e backend alvo estiver documentada
