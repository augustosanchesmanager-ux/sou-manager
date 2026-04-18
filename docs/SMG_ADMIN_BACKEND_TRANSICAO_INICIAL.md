# SMG ADMIN BACKEND - Transicao Inicial

Data de referencia: 2026-04-14

## Objetivo

Registrar a primeira fila formal de saida do frontend atual para o futuro `SMG ADMIN BACKEND`, preservando clareza entre:

- capabilities estaveis no frontend atual
- capabilities transitorias que permanecem no frontend por enquanto
- capabilities que ja entram como fila 1 de migracao

## Regra atual

A fonte de verdade tecnica desta classificacao e [platformAdminCapabilities.ts](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/app/core/admin/platformAdminCapabilities.ts).

Cada capability de platform-admin agora declara:

- `ownershipModel`
- `deliveryTarget`
- `transitionWave`

## Fila 1 de saida

Estas capabilities continuam acessiveis no frontend atual, mas ja estao marcadas como primeira fila formal de migracao para o `SMG ADMIN BACKEND`.

### Admin

- `system`
  - ownership: `platform-internal`
  - delivery target: `admin-backend-candidate`
  - transition wave: `wave-1`
  - motivo: concentra ferramentas internas e operacionais com perfil mais adequado ao backend administrativo da SMG do que ao frontend operacional atual

### SuperAdmin

- `logs`
  - ownership: `platform-observability`
  - delivery target: `admin-backend-candidate`
  - transition wave: `wave-1`
  - motivo: representa observabilidade e sinais operacionais globais com afinidade natural ao dominio do admin backend

## Capabilities estaveis no frontend atual

Estas capabilities permanecem conscientemente no frontend atual no curto prazo.

### Admin

- `overview`
- `shops`
- `users`
- `tickets`

### SuperAdmin

- nenhuma capability do `SuperAdmin` esta marcada hoje como `stable`; seu bloco permanece como visao global transitoria ate desenho mais completo do admin backend

## Capabilities transitorias em hold

Estas capabilities seguem no frontend atual, mas ja ficam classificadas como transicao planejada.

### Admin

- `access`
- `requests`

### SuperAdmin

- `overview`
- `companies`
- `users`
- `subscriptions`
- `audit`

## Criterio operacional

Enquanto o `SMG ADMIN BACKEND` nao existir como produto executavel:

- `wave-1` continua acessivel no frontend atual, mas nao deve receber expansao funcional desnecessaria
- `hold` pode receber manutencao e ajustes necessarios, sem virar expansao estrutural descontrolada
- `stable` pode evoluir apenas quando houver necessidade operacional clara do frontend atual

Em 2026-04-16, a politica de `wave-1` foi endurecida para `freeze` no registry de platform-admin:

- `Admin.system` nao deve receber expansao funcional no frontend atual
- `SuperAdmin.logs` nao deve receber expansao funcional no frontend atual

## Proxima decisao

Quando a frente do `SMG ADMIN BACKEND` for aberta formalmente:

1. migrar primeiro `Admin.system`
2. migrar em seguida `SuperAdmin.logs`
3. reavaliar o bloco `hold` do `SuperAdmin` para definir a segunda onda

O framing inicial dessa frente passa a ficar documentado em [SMG_ADMIN_BACKEND_FRENTE_INICIAL.md](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/docs/SMG_ADMIN_BACKEND_FRENTE_INICIAL.md).
