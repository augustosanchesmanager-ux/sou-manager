# SMG ADMIN BACKEND - Desenho Tecnico Inicial

Data de referencia: 2026-04-17

## Objetivo

Abrir o desenho tecnico inicial do `SMG ADMIN BACKEND` com base na fila formal `wave-1` ja classificada no frontend atual.

Este documento usa como fonte de verdade tecnica:

- [adminBackendFrontier.ts](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/app/core/admin/adminBackendFrontier.ts)
- [adminBackendWave1Surfaces.ts](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/app/core/admin/adminBackendWave1Surfaces.ts)
- [adminBackendWave1Contracts.ts](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/app/core/admin/adminBackendWave1Contracts.ts)
- [adminBackendWave1Adapters.ts](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/app/core/admin/adminBackendWave1Adapters.ts)

## Boundary inicial

- frontend transition policy: `freeze-wave-1`
- auth contract: `superadmin-session`
- entry ownership: `platform-admin`
- runtime target: `smg-admin-backend`

Leitura arquitetural:

- o frontend atual continua apenas como camada transitoria para `wave-1`
- o novo backend administrativo nasce para absorver capacidades internas e de observabilidade da SMG
- a primeira fronteira nao deve tentar resolver todo o dominio de admin/plataforma; ela deve começar pequena

## Contrato inicial de autenticacao e autorizacao

Nesta etapa inicial, o contrato recomendado e:

- entrada restrita a sessao com `canAccessSuperAdmin`
- validacao administrativa central no dominio de platform-admin
- nenhuma abertura para papeis operacionais do `barber`

Ou seja:

- `Admin.system` nao vira capability multi-tenant comum
- `SuperAdmin.logs` nao vira painel de gerente local
- o backend administrativo nasce com escopo de administracao global da SMG

## Backlog inicial separado por capability

### 1. Admin.system

- definir a primeira superficie de ferramentas internas
- separar o que e manutencao operacional real do que e apenas conveniencia visual do frontend atual
- criar a primeira interface tecnica do backend administrativo para essa capability

Superficie inicial mapeada:

- `database-overview`
  - origem atual: bloco `Database (Supabase)` em [Admin.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/Admin.tsx)
  - dados minimos: `totalShops`, `totalUsers`, `activeTickets`

- `platform-stack`
  - origem atual: bloco `Stack Tecnica` em [Admin.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/Admin.tsx)
  - dados minimos: `frontendRuntime`, `backendRuntime`, `authModel`, `deployContext`

### 2. SuperAdmin.logs

- definir a primeira superficie de observabilidade administrativa
- separar sinais e alertas globais da plataforma
- criar a primeira interface tecnica do backend administrativo para essa capability

Superficie inicial mapeada:

- `alert-queue`
  - origem atual: [AlertStack.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/components/superadmin/AlertStack.tsx)
  - dados minimos: `alerts`, `openSupportTickets`, `severitySummary`
  - contrato inicial: `AdminBackendAlertQueueResponse`

- `operational-timeline`
  - origem atual: [ActivityTimeline.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/components/superadmin/ActivityTimeline.tsx)
  - dados minimos: `auditLogs`, `supportTickets`, `accessRequests`, `criticalAlerts`
  - contrato inicial: `AdminBackendOperationalTimelineResponse`

### Contratos iniciais ja modelados

- `AdminBackendAlertQueueResponse`
- `AdminBackendOperationalTimelineResponse`
- `AdminBackendDatabaseOverviewResponse`
- `AdminBackendPlatformStackResponse`

Leitura arquitetural:

- os contratos da onda 1 ja deixam explicito o shape minimo esperado do backend administrativo
- `SuperAdmin.logs` ja consome um adaptador de transicao frontend-side publicado em [adminBackendWave1Adapters.ts](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/app/core/admin/adminBackendWave1Adapters.ts)
- `alert-queue` e `operational-timeline` passam a nascer do contrato tecnico da onda 1 antes de alimentar a UI transitoria
- o proximo passo deixa de ser "inventar o shape" e passa a ser decidir a primeira interface real do backend administrativo

## Regra de implementacao

Enquanto esta frente nao estiver executando:

- `Admin.system` permanece congelado para expansao funcional no frontend
- `SuperAdmin.logs` permanece congelado para expansao funcional no frontend
- qualquer nova necessidade nesses blocos deve primeiro ser classificada como:
  - manutencao necessaria da camada transitoria
  - ou backlog real do `SMG ADMIN BACKEND`

## Gate de abertura

A frente tecnica do `SMG ADMIN BACKEND` pode ser considerada aberta quando:

1. o boundary inicial estiver aceito
2. o contrato `superadmin-session` estiver aceito como entrada inicial
3. `Admin.system` tiver backlog proprio
4. `SuperAdmin.logs` tiver backlog proprio
5. a camada transitoria do frontend estiver explicitamente limitada
