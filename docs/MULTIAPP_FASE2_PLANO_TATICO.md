# Plano Tatico - Fase 2 da Modularizacao Real do Frontend da SMG

Data: 2026-04-07

Status: Iniciada formalmente

Status de subfase em 2026-04-09:

- trilha estrutural normal do `barber` encerrada formalmente
- legado estrutural remanescente restrito a rotas especiais de plataforma/admin tecnico
- proxima frente recomendada: dominio de administracao/plataforma, com `Admin` e `SuperAdmin` fora da leitura de modulo normal do `barber`

Atualizacao 2026-04-17:

- `SuperAdmin.logs` passou a consumir um adaptador de transicao alinhado aos contratos da onda 1 em [adminBackendWave1Adapters.ts](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/app/core/admin/adminBackendWave1Adapters.ts)
- `alert-queue` e `operational-timeline` agora ja existem como superficies transitorias alimentadas por contrato tecnico do futuro `SMG ADMIN BACKEND`
- a proxima decisao da frente deixa de ser "qual shape usar" e passa a ser "qual interface backend abrir primeiro"

Referencias:

- [ADR_001_MULTIAPP_PLATFORM.md](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/docs/ADR_001_MULTIAPP_PLATFORM.md)
- [MULTIAPP_ROADMAP_FASES.md](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/docs/MULTIAPP_ROADMAP_FASES.md)
- [MULTIAPP_FASE1_PLANO_TATICO.md](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/docs/MULTIAPP_FASE1_PLANO_TATICO.md)
- [MULTIAPP_FASE2_BLUEPRINT_FRONTEND.md](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/docs/MULTIAPP_FASE2_BLUEPRINT_FRONTEND.md)
- [MULTIAPP_FASE2_GUARD_RAILS.md](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/docs/MULTIAPP_FASE2_GUARD_RAILS.md)

## 1. Objetivo tecnico

Transformar a organizacao do frontend da SMG para refletir a arquitetura multiapp real da plataforma, separando com clareza:

- core de plataforma
- shared reutilizavel
- app-specific
- manifestos e ownership por app

O problema estrutural desta fase nao e mais autoridade de contexto. O problema agora e representacao arquitetural no codigo.

## 2. Diagnostico arquitetural

A Fase 1 deixou a fundacao pronta:

- autoridade central consolidada
- contexts endurecidos
- fronteira de tabelas e modulos formalizada
- bordas criticas do `barber` consumindo contrato central

O que ainda falta:

- a estrutura de pastas do frontend ainda nao comunica com clareza o que e plataforma e o que e app
- o `barber` ainda aparece em muitos pontos como centro implicito de organizacao
- o facade legado segue espalhando dependencias indiretas
- ainda nao existe uma fronteira visual e tecnica forte entre `core/shared` e `app-specific`

Risco principal se a Fase 2 for feita sem disciplina:

- mover arquivos sem migrar ownership
- reorganizar pastas sem criar guard rails
- trocar nomes sem reduzir acoplamento
- produzir modularizacao ornamental

## 3. Solucao proposta

A Fase 2 deve ser executada como modularizacao por fronteiras, nao como arrumacao cosmetica.

Decisoes principais:

- criar uma camada explicita de `src/app/core`
- criar uma camada explicita de `src/app/shared`
- criar uma camada explicita de `src/apps/barber`
- introduzir um registry de rotas/modulos por app como fronteira de ownership
- reduzir a dependencia estrutural do facade legado sem reabrir o contrato central

Justificativa tecnica:

- torna a arquitetura legivel no repositorio
- prepara `auto` e `club` para crescerem sem copiar estrutura do `barber`
- facilita governanca de imports
- reduz ambiguidade entre plataforma e dominio

## 4. Modelagem e estrutura

### Estrutura-alvo inicial

```text
src/
├── app/
│   ├── core/
│   │   ├── auth/
│   │   ├── tenancy/
│   │   ├── routing/
│   │   ├── access/
│   │   └── observability/
│   └── shared/
│       ├── ui/
│       ├── hooks/
│       ├── services/
│       ├── layouts/
│       └── lib/
├── apps/
│   └── barber/
│       ├── routes/
│       ├── modules/
│       ├── pages/
│       ├── services/
│       └── manifests/
└── modules/
```

### Frentes da Fase 2

#### Frente A - Fronteiras oficiais

Objetivo:

- declarar a topologia oficial do frontend

Entregas:

- definicao da arvore alvo
- regra do que entra em `core`
- regra do que entra em `shared`
- regra do que entra em `apps/barber`

Criterio de pronto:

- qualquer arquivo novo tem destino arquitetural claro antes de ser criado

#### Frente B - Manifesto de app

Objetivo:

- explicitar ownership e composicao do `barber`

Entregas:

- manifesto inicial do `barber`
- mapa de rotas e modulos do `barber`
- identificacao do que continua shared

Criterio de pronto:

- o `barber` passa a ser consumido como app, nao como estrutura implita do sistema

#### Frente C - Guard rails estruturais

Objetivo:

- impedir mistura nova entre shared e app-specific

Entregas:

- regra de imports proibidos
- checklist de PR para mudancas estruturais
- criterio de quando um service pode continuar shared

Criterio de pronto:

- novas mudancas deixam de reintroduzir acoplamento entre plataforma e dominio

#### Frente D - Migracao progressiva de estrutura

Objetivo:

- mover a organizacao do frontend sem causar regressao operacional

Entregas:

- lista de primeiros alvos de migracao
- ordem segura de reorganizacao
- estrategia de compatibilidade para aliases e imports durante transicao

Criterio de pronto:

- a modularizacao avanca sem quebrar runtime nem reabrir autoridade local

## 5. Impactos e migracao

### O que muda

- o repositorio passa a refletir a arquitetura alvo
- ownership tecnico do `barber` fica mais claro
- shared passa a ser deliberado, nao acidental

### O que nao deve mudar

- a Fase 2 nao deve alterar a fonte oficial de autoridade
- a Fase 2 nao deve mover regra de tenant/app/schema para a borda
- a Fase 2 nao deve reenquadrar `barber` como centro estrutural permanente

### Estrategia de transicao

1. definir fronteiras e manifests
2. estabelecer guard rails
3. mover estruturas de baixo risco primeiro
4. migrar ownership do `barber` por blocos
5. manter facade legado apenas como compatibilidade controlada

## 6. Validacao

### O que testar

- imports entre `core`, `shared` e `apps/barber`
- telas migradas sem regressao funcional
- contexts e contratos centrais intactos apos reorganizacao
- ausencia de novas decisoes locais de autoridade na borda

### Como garantir consistencia

- revisar cada movimento de pasta como mudanca arquitetural, nao so de organizacao
- exigir justificativa para qualquer arquivo que permaneça fora da fronteira esperada
- manter inventario de compatibilidade enquanto houver facade legado

## 7. Melhorias futuras

Depois da Fase 2, a SMG fica pronta para:

- estabilizar o `barber` como blueprint isolado
- abrir manifests de `auto` e `club`
- reduzir ainda mais o facade legado
- preparar multi deploy com ownership tecnico mais claro

## Backlog objetivo da Fase 2

### Bloco 1 - Blueprint estrutural

- publicar estrutura alvo do frontend
- publicar regra de classificacao `core/shared/app-specific`
- publicar manifesto inicial do `barber`

Status atual do bloco:

- blueprint estrutural inicial publicado
- fronteiras oficiais declaradas em [frontendBoundaries.ts](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/app/architecture/frontendBoundaries.ts)
- manifesto inicial do `barber` publicado em [barberAppManifest.ts](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/apps/barber/manifests/barberAppManifest.ts)
- pastas oficiais de `core`, `shared` e `apps/barber` abertas no repositorio
- primeira extracao de ownership de rotas do `barber` publicada em [barberProtectedLayoutRoutes.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/apps/barber/routes/barberProtectedLayoutRoutes.tsx)
- `App.tsx` deixou de declarar diretamente o bloco principal de rotas protegidas do `barber`
- primeira migracao fisica de ownership publicada em [src/apps/barber/pages](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/apps/barber/pages)
- adapters transitorios explicitamente mantidos em [pages/Products.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/Products.tsx), [pages/Services.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/Services.tsx) e [pages/Suppliers.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/Suppliers.tsx)
- bloco `ChefClub` tambem migrou ownership fisico para [src/apps/barber/pages](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/apps/barber/pages)
- primeiro contrato central de modulo habilitado por tenant publicado em [tenantModuleAccess.ts](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/app/core/access/tenantModuleAccess.ts)
- `chef_club` passa a ser tratado como modulo do `barber` com habilitacao tenant-scoped, allowlisted inicialmente apenas para o tenant slug `sanchez-barber`
- [ChefClubPlans.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/apps/barber/pages/ChefClubPlans.tsx) iniciou endurecimento de autoridade com `requireModuleAccess`
- [ChefClubSubscriptions.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/apps/barber/pages/ChefClubSubscriptions.tsx) agora tambem consome `requireModuleAccess` e deixa de resolver tenant localmente no fluxo central
- [ChefClubSubscriptionNew.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/apps/barber/pages/ChefClubSubscriptionNew.tsx) agora tambem consome `requireModuleAccess` no write path completo de assinatura, troca de plano e creditos
- navegacao do `ChefClub` passa a consumir o contrato central de tenant-enabled module em [Sidebar.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/components/Sidebar.tsx)
- o routing protegido do `barber` passa a respeitar o contrato central de tenant-enabled module via [guards.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/app/core/routing/guards.tsx) e [App.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/App.tsx)
- o bloco `ChefClub` fecha esta subetapa com ownership fisico em `src/apps/barber/pages` e autoridade runtime centralizada pelo contrato tenant-scoped
- rotas publicas do `barber` agora saem de `App.tsx` e passam a ser consumidas de [barberPublicRoutes.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/apps/barber/routes/barberPublicRoutes.tsx)
- rotas de layout ainda fora do manifesto de modulos passam a ser consumidas de [barberLegacyLayoutRoutes.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/apps/barber/routes/barberLegacyLayoutRoutes.tsx)
- primeira reducao objetiva do [barberLegacyLayoutRoutes.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/apps/barber/routes/barberLegacyLayoutRoutes.tsx) concluida com a migracao de `Smart Return` e `Operations` para o manifesto tipado e para [barberProtectedLayoutRoutes.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/apps/barber/routes/barberProtectedLayoutRoutes.tsx)
- segunda reducao objetiva do [barberLegacyLayoutRoutes.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/apps/barber/routes/barberLegacyLayoutRoutes.tsx) concluida com a migracao de `Reports` e `Performance` para o manifesto tipado e para [barberProtectedLayoutRoutes.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/apps/barber/routes/barberProtectedLayoutRoutes.tsx)
- terceira reducao objetiva do [barberLegacyLayoutRoutes.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/apps/barber/routes/barberLegacyLayoutRoutes.tsx) concluida com a migracao de `Financial`, `Expenses` e `Receipts` para o manifesto tipado e para [barberProtectedLayoutRoutes.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/apps/barber/routes/barberProtectedLayoutRoutes.tsx)
- quarta reducao objetiva do [barberLegacyLayoutRoutes.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/apps/barber/routes/barberLegacyLayoutRoutes.tsx) concluida com a migracao de `Payroll` e `Commissions` para o manifesto tipado e para [barberProtectedLayoutRoutes.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/apps/barber/routes/barberProtectedLayoutRoutes.tsx)
- quinta reducao objetiva do [barberLegacyLayoutRoutes.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/apps/barber/routes/barberLegacyLayoutRoutes.tsx) concluida com a migracao de `Team` e `Categories` para o manifesto tipado e para [barberProtectedLayoutRoutes.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/apps/barber/routes/barberProtectedLayoutRoutes.tsx)
- sexta reducao objetiva do [barberLegacyLayoutRoutes.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/apps/barber/routes/barberLegacyLayoutRoutes.tsx) concluida com a migracao de `Support` e `Settings` para o manifesto tipado e para [barberProtectedLayoutRoutes.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/apps/barber/routes/barberProtectedLayoutRoutes.tsx)
- setima reducao objetiva do [barberLegacyLayoutRoutes.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/apps/barber/routes/barberLegacyLayoutRoutes.tsx) concluida parcialmente: `Kiosk Admin` migrou para o manifesto tipado e para [barberProtectedLayoutRoutes.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/apps/barber/routes/barberProtectedLayoutRoutes.tsx), enquanto `Portal Admin` foi reclassificado como candidato a rota de plataforma/admin tecnico
- oitava reducao objetiva do [barberLegacyLayoutRoutes.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/apps/barber/routes/barberLegacyLayoutRoutes.tsx) concluida com a migracao de `Business Intelligence` e `Promotions` para o manifesto tipado e para [barberProtectedLayoutRoutes.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/apps/barber/routes/barberProtectedLayoutRoutes.tsx)
- nona reducao objetiva do [barberLegacyLayoutRoutes.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/apps/barber/routes/barberLegacyLayoutRoutes.tsx) foi posteriormente revisada: `Admin` deixou de ser tratado como modulo normal do `barber` e passou a ser publicado por routing proprio de platform-admin, mantendo `/admin/supabase-monitoring` fora da trilha normal por reclassificacao consciente
- decima reducao objetiva do [barberLegacyLayoutRoutes.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/apps/barber/routes/barberLegacyLayoutRoutes.tsx) concluida com a migracao de `Strategic Dashboard` para o manifesto tipado e para [barberProtectedLayoutRoutes.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/apps/barber/routes/barberProtectedLayoutRoutes.tsx)
- [SupabaseMonitoring.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/SupabaseMonitoring.tsx) sai da trilha de migracao de modulo comum do `barber` e passa a ser tratado como candidato a rota de plataforma/admin tecnico
- [PortalAdmin.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/portal/PortalAdmin.tsx) segue o mesmo enquadramento de reclassificacao de [SupabaseMonitoring.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/SupabaseMonitoring.tsx), ficando fora do manifesto tipado do `barber` por decisao consciente
- a rota `/admin/supabase-monitoring` permanece fora do manifesto tipado do `barber` por decisao consciente, aguardando reclassificacao futura para acesso apenas de administradores do sistema
- [StrategicDashboard.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/StrategicDashboard.tsx) deixa de ser legado estrutural do `barber`, mas ainda pode demandar endurecimento futuro de autoridade em frente separada
- [App.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/App.tsx) fica mais proximo de shell orquestrador e menos conhecedor do detalhe das rotas do `barber`
- rotas publicas da plataforma agora saem de `App.tsx` e passam a ser consumidas de [platformPublicRoutes.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/app/core/routing/platformPublicRoutes.tsx)
- fluxo protegido nao-app agora sai de `App.tsx` e passa a ser consumido de [platformProtectedRoutes.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/app/core/routing/platformProtectedRoutes.tsx)
- divida operacional explicita: o contrato tenant-scoped de `chef_club` ainda depende do slug `sanchez-barber` em [tenantModuleAccess.ts](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/app/core/access/tenantModuleAccess.ts) e deve evoluir depois para fonte configuravel de capacidade por tenant

Fechamento formal da trilha estrutural normal do `barber`:

- o manifesto tipado do `barber` agora cobre as rotas operacionais e administrativas normais do app
- [barberLegacyLayoutRoutes.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/apps/barber/routes/barberLegacyLayoutRoutes.tsx) deixou de concentrar legado estrutural comum e ficou restrito a casos especiais conscientemente reclassificados
- o remanescente estrutural do `barber` nao representa mais dependencia difusa de ownership; representa somente excecoes com destino arquitetural proprio
- a partir deste ponto, novas rodadas deixam de ter como objetivo "caçar rota comum" e passam a operar por frentes nomeadas

Rotas especiais explicitamente fora da trilha estrutural normal:

- `/admin/supabase-monitoring`
- `/portal-admin`

Essas rotas seguem fora do manifesto tipado do `barber` por decisao consciente porque apontam para futuro enquadramento como capacidade de plataforma/admin tecnico, nao como modulo operacional comum do app.

Decisao de execucao em 2026-04-09:

- [SupabaseMonitoring.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/SupabaseMonitoring.tsx) e [PortalAdmin.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/portal/PortalAdmin.tsx) nao entram na frente ativa desta fase
- essas telas ficam estacionadas por decisao consciente, sem nova migracao ou endurecimento no frontend atual
- o destino arquitetural recomendado passa a ser o futuro `SMG ADMIN BACKEND`
- qualquer retomada dessas capacidades deve acontecer ja no contexto de plataforma/admin tecnico, e nao como extensao tardia do app `barber`

Proxima frente recomendada apos o fechamento desta subfase:

- endurecimento de autoridade residual de telas ja enquadradas estruturalmente
- primeiro candidato natural historico: [StrategicDashboard.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/StrategicDashboard.tsx)
- frente alternativa futura, fora do escopo ativo atual: reclassificacao runtime das rotas especiais de plataforma/admin tecnico no contexto do `SMG ADMIN BACKEND`

Status inicial da frente de autoridade residual:

- [StrategicDashboard.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/StrategicDashboard.tsx) iniciou endurecimento de autoridade
- o fluxo central de carga analitica agora consome `requireModuleAccess` com o modulo `strategic_dashboard`
- queries principais deixam de usar `supabase` direto e passam a operar com `client` e `tenantId` resolvidos pelo contrato central
- a frente foi aberta sem misturar endurecimento de autoridade com nova rodada estrutural
- [BusinessIntelligence.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/BusinessIntelligence.tsx), [SmartReturn.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/SmartReturn.tsx), [Reports.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/Reports.tsx), [Promotions.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/Promotions.tsx), [Cashflow.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/Cashflow.tsx) e [Commissions.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/Commissions.tsx) ja migraram leitura e, quando aplicavel, write path principal para `requireModuleAccess`
- [Dashboard.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/Dashboard.tsx) foi tratado como subfrente propria: ganhou modulo `dashboard` no contrato central e migrou leitura e write path principais para autoridade centralizada
- [Operations.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/Operations.tsx) e [Payroll.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/Payroll.tsx) tambem deixaram o modelo antigo de `supabase` direto e tenant interpretado localmente
- [Team.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/Team.tsx) entrou como subfrente propria: CRUD e ajuste operacional de `staff` agora consomem o contrato central, enquanto `auth.getSession()` e `functions.invoke('admin-create-user')` permanecem explicitamente enquadrados como boundary administrativo
- [KioskAdmin.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/KioskAdmin.tsx) entrou como subfrente propria: leitura e mutacoes de `tenant_addons`, `kiosk_devices`, `appointments`, `kiosk_sessions`, `feedback_barber` e `feedback_shop` agora consomem o contrato central do modulo `kiosk_admin`
- [Schedule.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/Schedule.tsx) ainda aparece em scans textuais por manter o fluxo antigo comentado como legado explicitamente desativado, mas o runtime ativo ja opera com autoridade centralizada; o resíduo atual e de cleanup documental, nao de decisoes locais em producao
- o inventario remanescente da frente residual deixa de ser uma fila unica de telas e passa a operar por subfrentes nomeadas quando o modulo mistura runtime normal com boundary administrativo ou regras de produto mais densas
- o remanescente de `supabase` direto no repositorio passa a se concentrar principalmente em: paginas de autenticacao, paginas de administracao/plataforma, compatibilidades conscientemente mantidas em RPCs especificas e boundaries administrativos explicitos
- classificacao operacional atual do remanescente:
- paginas de autenticacao como [Login.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/Login.tsx), [Register.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/Register.tsx), [ResetPassword.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/ResetPassword.tsx) e partes de [Settings.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/Settings.tsx) ficam fora desta regua por pertencerem ao boundary de autenticacao
- [Admin.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/Admin.tsx) e [SuperAdmin.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/SuperAdmin.tsx) passam a ser lidos como dominio de administracao/plataforma, e nao como remanescente normal do runtime operacional do `barber`
- `/admin` e `/superadmin` passam a ser publicados por routing proprio de platform-admin em vez de permanecerem acoplados ao manifesto tipado do `barber`
- [context/AuthContext.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/context/AuthContext.tsx) agora expõe `requirePlatformAdminAccess`, criando um contrato explicito para runtime de administracao/plataforma fora da regua de modulo normal do `barber`
- [platformAdminCapabilities.ts](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/app/core/admin/platformAdminCapabilities.ts) publica o primeiro registry explicito de capability boundary para o dominio de platform-admin, separando `Admin` e `SuperAdmin` por responsabilidade real e nao apenas por nome de tela
- [Admin.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/Admin.tsx) agora consome `adminConsoleTabs` tambem na navegacao visual principal, fechando o ultimo resíduo visivel em que a capability boundary ainda nao era a fonte de verdade da tela
- [platformAdminCapabilities.ts](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/app/core/admin/platformAdminCapabilities.ts) passa a classificar cada capability tambem por `ownershipModel` e `deliveryTarget`, deixando explicito o que e suporte/tenant, o que e visao global da SMG e o que ja nasce como candidato ao futuro `SMG ADMIN BACKEND`
- [Admin.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/Admin.tsx) iniciou endurecimento do dominio de platform-admin: `openShopPanel`, `fetchOverview`, `fetchShops`, `fetchUsers` e as cargas centrais de `tickets`/`requests` passam a consumir o contrato de platform-admin, enquanto realtime, tickets e mutacoes administrativas mais especificas permanecem como boundaries explicitos
- [Admin.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/Admin.tsx) fecha a segunda rodada de endurecimento do dominio de platform-admin: `ticket_messages`, `support_tickets`, aprovacao/rejeicao de `profiles`, mudanca de plano em `tenants` e ajuste de cargo em `staff` deixam de usar `supabase.from(...)` direto; o resíduo local fica restrito a realtime e `auth.admin.getUserById`, que permanecem boundaries especiais e honestos
- [SuperAdmin.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/SuperAdmin.tsx) iniciou endurecimento do dominio de platform-admin: o `fetchData` principal deixa de usar `supabase` direto e passa a consumir `requirePlatformAdminAccess`
- leitura consolidada de [SuperAdmin.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/SuperAdmin.tsx): no frontend atual, o painel ja nao expõe segundo write path escondido via `supabase`; o runtime ativo remanescente e predominantemente de leitura global, filtros locais e exportacao, o que deixa a próxima evolucao mais ligada a desenho de capability do dominio do que a “caça a chamadas diretas”
- [Checkout.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/Checkout.tsx) e [Orders.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/Orders.tsx) permanecem inventariados como compatibilidades controladas em RPCs especificas, sem reabrir autoridade local de tabela na borda

Fechamento formal da frente residual do runtime normal do `barber`:

- as telas operacionais e analiticas normais do `barber` deixam de compor uma fila aberta de endurecimento generico
- o runtime normal remanescente do `barber` fica, na pratica, encerrado como frente horizontal desta fase
- o que sobra no inventario ja nao e backlog comum de tela operacional; pertence a boundary de autenticacao, dominio de administracao/plataforma ou compatibilidade controlada
- novas rodadas deixam de nascer de varredura textual por `supabase` e passam a nascer por dominio arquitetural explicito

Proxima frente recomendada apos o fechamento desta frente residual:

- classificar e desenhar o destino arquitetural de [Admin.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/Admin.tsx) e [SuperAdmin.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/SuperAdmin.tsx) como dominio de administracao/plataforma
- continuar endurecimento do runtime de [Admin.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/Admin.tsx) e [SuperAdmin.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/SuperAdmin.tsx) sem misturar com redesenho funcional nem com o backlog do futuro `SMG ADMIN BACKEND`
- a próxima subetapa mais honesta deixa de ser endurecimento generico de chamadas e passa a ser separacao de capabilities dentro do dominio de administracao/plataforma: o que e operacao de suporte/tenant, o que e visao global da SMG e o que deve nascer ja apontando para o futuro `SMG ADMIN BACKEND`
- classificacao inicial atual:
- `Admin` concentra principalmente capabilities de `tenant-support` e `tenant-governance`
- `SuperAdmin` concentra principalmente capabilities de `platform-visibility` e `platform-observability`
- `system` em `Admin` e `logs` em `SuperAdmin` ja ficam explicitamente marcados como `admin-backend-candidate`
- `system` em `Admin` e `logs` em `SuperAdmin` passam a compor a fila formal `wave-1` de saida para o `SMG ADMIN BACKEND`, documentada em [SMG_ADMIN_BACKEND_TRANSICAO_INICIAL.md](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/docs/SMG_ADMIN_BACKEND_TRANSICAO_INICIAL.md)
- `system` em `Admin` e `logs` em `SuperAdmin` passam a operar com politica `freeze`, sem expansao funcional no frontend atual
- a frente inicial do backend administrativo passa a ficar enquadrada em [SMG_ADMIN_BACKEND_FRENTE_INICIAL.md](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/docs/SMG_ADMIN_BACKEND_FRENTE_INICIAL.md)
- o desenho tecnico inicial da frente passa a ficar registrado em [SMG_ADMIN_BACKEND_DESENHO_TECNICO_INICIAL.md](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/docs/SMG_ADMIN_BACKEND_DESENHO_TECNICO_INICIAL.md) e em [adminBackendFrontier.ts](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/app/core/admin/adminBackendFrontier.ts)
- a onda 1 do `SMG ADMIN BACKEND` passa a ter superficies tecnicas mapeadas em [adminBackendWave1Surfaces.ts](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/app/core/admin/adminBackendWave1Surfaces.ts), separando blocos atuais de `Admin.system` e `SuperAdmin.logs` em backlog de backend mais concreto
- manter [Checkout.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/Checkout.tsx) e [Orders.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/Orders.tsx) como compatibilidades controladas por RPC ate decisao propria de estabilizacao
- manter auth fora desta mesma regua, por pertencer a boundary proprio

### Bloco 2 - Guard rails de arquitetura

- definir imports permitidos e proibidos
- definir checklist de PR estrutural
- definir criterio de permanencia temporaria do facade legado

Status atual do bloco:

- guard rails oficiais publicados em [MULTIAPP_FASE2_GUARD_RAILS.md](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/docs/MULTIAPP_FASE2_GUARD_RAILS.md)
- politica inicial de ownership entre `core`, `shared` e `app-specific` documentada
- checklist de PR estrutural definido

### Bloco 3 - Primeira onda de migracao

- selecionar os primeiros modulos/pastas de baixo risco
- mover ownership do `barber` sem alterar contrato central
- revisar aliases, caminhos e pontos de acoplamento

## Gate de fechamento da Fase 2

Para a SMG considerar a Fase 2 encerrada, o gate minimo deve exigir:

- leitura do repositorio deixa claro o que e `core`, `shared` e `app-specific`
- `barber` aparece como app isolado, nao como estrutura central implicita
- guard rails de imports e ownership publicados
- nenhuma reorganizacao reabriu autoridade local na borda
- facade legado reduzido ou explicitamente enquadrado como compatibilidade transitiva

Gate de fechamento da subfase estrutural normal do `barber`:

- manifesto tipado do `barber` cobre as rotas normais do app
- [barberLegacyLayoutRoutes.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/src/apps/barber/routes/barberLegacyLayoutRoutes.tsx) fica restrito a casos especiais conscientemente classificados
- [App.tsx](/C:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/App.tsx) permanece como shell orquestrador, nao como publicador manual do runtime normal do `barber`
- nenhuma reducao de legado estrutural reabriu autoridade local na borda
