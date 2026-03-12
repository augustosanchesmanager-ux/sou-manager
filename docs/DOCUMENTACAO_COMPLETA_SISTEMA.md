# DOCUMENTACAO COMPLETA DO SISTEMA - SOU MANA.GER

Atualizado em: 2026-03-11

## 1. Objetivo
Este documento consolida a visao funcional e tecnica do sistema SOU MANA.GER, cobrindo:
- arquitetura geral
- modulos e fluxos
- rotas
- servicos e funcoes de backend
- inventario de funcoes do frontend
- ideias e futuras implementacoes

## 2. Visao geral do produto
SOU MANA.GER e uma plataforma SaaS para barbearias e centros de estetica com operacao diaria, financeiro, BI, portal do cliente e modulo de kiosk/totem.

### 2.1 Problemas que o sistema resolve
- centraliza agendamento, checkout e cadastro em um unico lugar
- organiza operacao de equipe, servicos e produtos
- estrutura visao financeira (receitas, despesas, recibos, relatorios)
- permite autosservico do cliente via Portal e Kiosk
- inclui suporte operacional e insights com IA

### 2.2 Perfis de acesso
- superadmin
- manager
- barber
- receptionist

## 3. Arquitetura tecnica
### 3.1 Stack
- frontend: React + TypeScript + Vite
- roteamento: react-router-dom (HashRouter)
- backend: Supabase (PostgreSQL, Auth, Functions)
- IA: Google Gemini
- graficos: Recharts

### 3.2 Estrutura principal
- app e rotas: `App.tsx`
- contexto de autenticacao: `context/AuthContext.tsx`
- contexto de tema: `context/ThemeContext.tsx`
- servicos: `services/*`
- paginas: `pages/*`
- funcoes serverless: `supabase/functions/*`
- documentacao: `docs/*`

### 3.3 Multi-tenant
O isolamento entre barbearias/unidades e feito por `tenant_id` (RLS no Supabase).

## 4. Fluxos principais
### 4.1 Fluxo de autenticacao interna
1. usuario acessa `/login`
2. sessao e lida no `AuthProvider`
3. contexto de acesso e resolvido por RPC `get_auth_access_context` (fallback para `profiles` e `staff`)
4. `ProtectedRoute` libera ou bloqueia acesso
5. usuarios `pending`/`suspended` vao para `/pending-approval`

### 4.2 Fluxo de operacao diaria
1. agenda/cliente/servico alimentam atendimento
2. checkout cria venda e transacao
3. financeiro e relatorios consolidam dados
4. BI e dashboard estrategico analisam desempenho

### 4.3 Fluxo portal do cliente (OTP)
1. cliente entra em `/c/:tenantSlug/login`
2. OTP e solicitado via Edge Function `portal-auth`
3. OTP validado gera token JWT do portal
4. token e sessao sao armazenados no browser
5. cliente acessa app do portal e reagendamento

### 4.4 Fluxo kiosk/totem
1. cliente acessa `/kiosk/:tenantSlug`
2. sistema cria sessao de kiosk
3. cliente se identifica (telefone/cadastro)
4. cliente agenda ou deixa feedback

## 5. Mapa de rotas
### 5.1 Publicas
- `/`
- `/login`
- `/register`
- `/register-success`
- `/reset-password`
- `/pending-approval`
- `/kiosk/:tenantSlug`
- `/kiosk/:tenantSlug/client`
- `/c/:tenantSlug`
- `/c/:tenantSlug/login`
- `/c/:tenantSlug/app`
- `/c/:tenantSlug/app/schedule`

### 5.2 Protegidas (layout principal)
- `/dashboard`
- `/strategic-dashboard`
- `/checkout/:id?`
- `/comandas`
- `/schedule`
- `/support`

### 5.3 Restritas a manager
- `/admin`
- `/team`
- `/kiosk-admin`
- `/portal-admin`
- `/settings`
- `/clients`
- `/bi`
- `/smart-return`
- `/chef-club-plans`
- `/chef-club-subscriptions`
- `/financial`
- `/expenses`
- `/receipts`
- `/payroll`
- `/reports`
- `/services`
- `/performance`
- `/operations`
- `/orders`
- `/orders/:id`
- `/products`
- `/promotions`

### 5.4 Restrita a superadmin
- `/superadmin`

## 6. Modulos do sistema
### 6.1 Operacao
- dashboard operacional
- agenda
- checkout/comandas
- pedidos e operacoes

### 6.2 Cadastros
- clientes
- equipe
- servicos
- produtos
- promocoes

### 6.3 Gestao
- financeiro
- despesas
- recibos
- relatorios
- folha
- configuracoes

### 6.4 Inteligencia
- BI
- strategic dashboard
- smart return
- widgets de suporte com IA

### 6.5 SaaS e governanca
- admin
- superadmin
- suporte interno por tickets
- chef club plans/subscriptions

### 6.6 Canais de cliente
- portal do cliente (OTP)
- kiosk/totem

## 7. Servicos e funcoes criticas
### 7.1 `services/geminiService.ts`
- `generateBusinessInsights(metrics)`: gera recomendacao estrategica a partir de metricas
- `generateSupportResponse(userQuestion)`: responde duvidas com base de conhecimento do produto

### 7.2 `services/portalApi.ts`
- `requestOtp(tenantId, phone)`
- `verifyOtp(tenantId, phone, code)`
- `validateSession(tenantId, clientId, token)`

### 7.3 `context/AuthContext.tsx`
- `deriveAccessRole(rawRole, isSuperAdmin)`
- `fetchAccessContext(userId)`
- `clearAuthState()`
- `applySession(nextSession)`
- `signOut()`
- `useAuth()`

### 7.4 `context/ThemeContext.tsx`
- `toggleTheme()`
- `useTheme()`

### 7.5 `components/PortalAuthProvider.tsx`
- `requestOtp(tId, phone)`
- `verifyOtp(tId, phone, code)`
- `logout()`
- `usePortalAuth()`

### 7.6 Edge Function `supabase/functions/portal-auth/index.ts`
Acoes implementadas:
- `request_otp`
- `verify_otp`
- `validate_session`

Controles implementados:
- validacao de tenant
- rate limit de OTP
- expirar codigo por tempo/tentativa
- emissao de JWT do portal
- hash de token em `portal_sessions`

### 7.7 Edge Function `supabase/functions/admin-create-user/index.ts`
- cria usuario no Auth com privilegio admin da function
- valida permissao do solicitante
- bloqueia criacao de super admin por usuario nao-superadmin
- cria/atualiza registro em `staff`

## 8. Estado atual por funcionalidade
### 8.1 Ativo
- autenticacao e RBAC
- agenda, checkout, comandas
- cadastros principais
- financeiro/despesas/recibos/relatorios
- portal + kiosk (com dependencia de addon)
- admin/superadmin/suporte

### 8.2 Parcial ou em ajuste
- onboarding com persistencia incompleta
- performance com dados demonstrativos
- order details com estrutura fixa
- payroll com trechos simulados

## 9. Dependencias de ambiente
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_GEMINI_API_KEY`
- `PORTAL_JWT_SECRET` (Edge Function)
- `SUPABASE_SERVICE_ROLE_KEY` (Edge Function)

## 10. Futuras ideias e implementacoes
### 10.1 Curto prazo (prioridade alta)
- finalizar persistencia completa do onboarding
- concluir `OrderDetails` com dados dinamicos
- remover simulacoes de `Payroll` (descontos, recibo real)
- consolidar logs de erro para auth/portal

### 10.2 Medio prazo
- testes automatizados (unitarios + integracao + e2e)
- observabilidade (tracking de falhas, auditoria e alertas)
- cache e otimzacoes de consultas para dashboards
- motor de promocoes com regras avancadas

### 10.3 Longo prazo
- app mobile para staff e cliente
- integracao nativa WhatsApp para OTP/transacionais
- recomendacoes de IA por perfil de cliente
- previsao de demanda e sugestao de escala da equipe

### 10.4 Evolucoes tecnicas recomendadas
- tipagem mais forte em consultas Supabase
- padronizacao de camada de repositorio (data access)
- feature flags por tenant/addon
- suite de migracoes com validacao CI

## 11. Riscos tecnicos monitorados
- dependencia de variaveis de ambiente para IA e portal
- partes do sistema ainda com dados mockados
- fluxo de OTP depende de qualidade de canais de entrega externos

## 12. Anexo A - Mapa autoextraido de funcoes
Inventario consolidado das funcoes mais relevantes para manutencao e onboarding, agrupado por subsistema.

### 12.1 `pages` (fluxos de negocio)

| Arquivo | Funcoes/handlers | Responsabilidade |
|---|---|---|
| `pages/Dashboard.tsx` | `handleGenerateInsight`, `handleCreateNewClient`, `handleConfirmAppointment`, `handleCancelAppointment`, `handleCompleteAppointment` | Gestao da operacao do dia, atalhos rapidos e acao de IA no painel principal. |
| `pages/Schedule.tsx` | `handleSave`, `handleDropAppointment`, `handleCancelAppointment`, `selectClient`, `exportToCSV` | Agenda completa: criacao/edicao, drag-and-drop, cancelamento e exportacao. |
| `pages/Checkout.tsx` | `handleSelectClient`, `handleAddItem`, `handleRemoveItem`, `calculateItemPrice`, `handleFinish` | Fluxo de venda e fechamento com servicos/produtos. |
| `pages/Clients.tsx` | `handleCreateClient`, `handleSaveEdit`, `handleDelete`, `handleExportCSV`, `handleConfirmImport` | CRUD de clientes, importacao e exportacao de base. |
| `pages/Financial.tsx` | `handleSaveEntrada`, `handleConfirmImport`, `handleExportCSV` | Lancamentos financeiros e consolidacao de entradas. |
| `pages/Orders.tsx` | `fetchData`, `handleSaveOrder`, `handleUpdateStatus`, `handleReceiveOrder`, `handleWhatsAppOrder` | Ciclo de pedidos de compra e atualizacao de status. |
| `pages/KioskAdmin.tsx` | `loadAll`, `handleActivateAddon`, `handleSaveSettings`, `handleAddDevice`, `toggleDevice` | Administracao do addon kiosk, dispositivos e configuracoes visuais. |
| `pages/kiosk/KioskPage.tsx` | `createSession`, `handleMenuChoice`, `handleIdentified`, `handleActivity`, `loadTenant` | Jornada principal do totem/kiosk para atendimento no ponto fisico. |
| `pages/kiosk/KioskClientPage.tsx` | `createSession`, `handleMenuChoice`, `handleIdentified`, `resetToHome` | Jornada alternativa do cliente em modo kiosk-client. |
| `pages/kiosk/components/KioskSchedule.tsx` | `loadServices`, `loadBarbers`, `generateSlots`, `handleConfirm` | Agendamento no kiosk com geracao de slots e confirmacao. |
| `pages/portal/PortalLogin.tsx` | `handleSendOtp`, `handleOtpChange`, `handleOtpKeyDown`, `handleVerifyOtp`, `loadTenant` | Login OTP do portal do cliente. |
| `pages/portal/PortalApp.tsx` | `loadPortalData`, `checkCanAction`, `confirmAction`, `submitReview`, `handleLogout` | App do portal para cliente: consulta, acoes em agendamento e feedback. |
| `pages/portal/PortalSchedule.tsx` | `loadInitialData`, `generateSlots`, `handleConfirm` | Reagendamento/autosservico no portal do cliente. |

### 12.2 `components` (UI e widgets)

| Arquivo | Funcoes/handlers | Responsabilidade |
|---|---|---|
| `components/Layout.tsx` | `fetchUnreadCount` | Estrutura de layout com contagem de notificacoes e integracao de cabecalho/sidebar. |
| `components/Sidebar.tsx` | `toggleGroup`, `isActive`, `handleLogout`, `handleChangePlan` | Navegacao lateral com controle de grupos, rota ativa e acoes de sessao/plano. |
| `components/NotificationCenter.tsx` | `fetchNotifications`, `markAsRead`, `markAllAsRead`, `getIcon` | Centro de notificacoes com leitura individual e em lote. |
| `components/SupportWidget.tsx` | `sendMessage`, `handleSubmit`, `renderContent` | Widget de suporte interno com respostas assistidas. |
| `components/LandingSupportWidget.tsx` | `getSaleReply`, `sendMessage`, `handleSubmit` | Widget comercial na landing para duvidas de conversao. |
| `components/OnboardingChecklist.tsx` | `checkProgress`, `handleCompleteOnboarding` | Checklist de ativacao inicial da conta/unidade. |
| `components/PortalAuthProvider.tsx` | `requestOtp`, `verifyOtp`, `logout`, `usePortalAuth` | Estado de autenticacao do portal de cliente no frontend. |

### 12.3 `context` (estado global)

| Arquivo | Funcoes/handlers | Responsabilidade |
|---|---|---|
| `context/AuthContext.tsx` | `deriveAccessRole`, `fetchAccessContext`, `clearAuthState`, `applySession`, `signOut`, `useAuth` | Sessao principal, tenant, papel de acesso e regras de autorizacao da aplicacao. |
| `context/ThemeContext.tsx` | `toggleTheme`, `useTheme` | Persistencia e alternancia de tema (light/dark). |

### 12.4 `services` e `supabase/functions` (integracoes e backend)

| Arquivo | Funcoes/handlers | Responsabilidade |
|---|---|---|
| `services/supabaseClient.ts` | `supabase` | Inicializacao do client Supabase no frontend. |
| `services/portalApi.ts` | `requestOtp`, `verifyOtp`, `validateSession` | Camada de API para autenticacao e sessao do portal. |
| `services/geminiService.ts` | `generateBusinessInsights`, `generateSupportResponse` | Integracao com IA para insights de negocio e suporte guiado. |
| `supabase/functions/portal-auth/index.ts` | `request_otp`, `verify_otp`, `validate_session` | Edge function de OTP do portal com rate limit, expiracao e emissao/validacao de token. |
| `supabase/functions/admin-create-user/index.ts` | `Deno.serve` (handler principal) | Criacao administrativa de usuarios com validacao de privilegio e sincronizacao com `staff`. |

### 12.5 Guia de leitura
Use este anexo como mapa de entrada para onboarding tecnico: comece por `context` e `services`, depois avance para `pages` de operacao critica (`Dashboard`, `Schedule`, `Checkout`).
Para refatoracoes, priorize arquivos com handlers de fluxo transacional e autenticacao (agenda, checkout, portal OTP), pois concentram maior impacto funcional.
Quando precisar de detalhe fino, abra o arquivo citado e consulte as secoes anteriores de fluxos, modulos e riscos.
