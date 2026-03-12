# Documentacao de Funcionalidades - SOU MANA.GER

Documento de status funcional do sistema com base no codigo atual.

Atualizado em: 09/03/2026

## 1) Funcoes ativas

### 1.1 Acesso, seguranca e perfis
- `Login` (`/login`): autenticacao com Supabase Auth.
- `Cadastro` (`/register`) e `Recuperacao de senha` (`/reset-password`): fluxo operacional.
- `Bloqueio por status de perfil` (`/pending-approval`): usuarios pendentes/suspensos nao entram no app principal.
- `RBAC por rota`: restricao para gerente e super admin em rotas especificas.

### 1.2 Operacao diaria
- `Dashboard` (`/dashboard`): KPIs, agenda do dia, atalhos operacionais e insight IA.
- `Agenda` (`/schedule`): CRUD de agendamentos, vinculo com cliente/profissional/servico e atualizacao de status.
- `Checkout / PDV` (`/checkout/:id?`): venda com servicos/produtos, comanda e registro de transacao.
- `Comandas` (`/comandas`): listagem, detalhamento de itens e fechamento.

### 1.3 Cadastros
- `Clientes` (`/clients`): cadastro, edicao, busca e historico relacionado.
- `Equipe` (`/team`): cadastro e manutencao de profissionais.
- `Servicos` (`/services`): cadastro/edicao/ativacao.
- `Produtos` (`/products`): cadastro e controle operacional de estoque.
- `Promocoes` (`/promotions`): criacao, edicao e aplicacao por tipo.

### 1.4 Financeiro e gestao
- `Financeiro` (`/financial`): entradas/saidas e consolidacao.
- `Despesas` (`/expenses`): lancamentos e filtros.
- `Recibos` (`/receipts`): consulta de recibos baseada em transacoes.
- `Relatorios` (`/reports`): visao consolidada de resultados.
- `Operacoes` (`/operations`) e `Pedidos` (`/orders`): acompanhamento operacional e compras/reposicao.

### 1.5 Inteligencia e estrategia
- `BI` (`/bi`): analise de indicadores e insights com Gemini (com fallback quando IA nao configurada).
- `Smart Return` (`/smart-return`): identificacao de clientes em risco de nao retorno.
- `Strategic Dashboard` (`/strategic-dashboard`): indicadores estrategicos por periodo.

### 1.6 SaaS, suporte e governanca
- `Admin` (`/admin`): visao de usuarios, tenants, chamados e operacao administrativa.
- `Super Admin` (`/superadmin`): controle global de acessos e visao de requests.
- `Suporte` (`/support`): abertura e resposta de tickets com mensagens.
- `Configuracoes` (`/settings`): preferencias da unidade e parametros basicos.

### 1.7 Kiosk (Totem) e Portal do Cliente
- `Kiosk Publico` (`/kiosk/:tenantSlug` e `/kiosk/:tenantSlug/client`): identificacao, agendamento e feedback.
- `Kiosk Admin` (`/kiosk-admin`): dispositivos, addons e monitoramento do modulo.
- `Portal Cliente` (`/c/:tenantSlug`, `/c/:tenantSlug/login`, `/c/:tenantSlug/app`, `/c/:tenantSlug/app/schedule`): login OTP, agenda e feedback.
- `Portal Admin` (`/portal-admin`): administracao de addons do portal.

### 1.8 Modulos de plano/assinatura
- `Chef Club Plans` (`/chef-club-plans`): gerenciamento de planos.
- `Chef Club Subscriptions` (`/chef-club-subscriptions`): acompanhamento de assinaturas ativas/inativas.

## 2) Funcoes em ajuste

### 2.1 Onboarding inicial
- `RoleSelection`, `ShopSetup` e `ProfessionalSetup` (`/onboarding/*`) estao com fluxo visual pronto, mas sem persistencia completa no banco.
- Evidencia no codigo: comentarios `Logic to create ... would go here` nos arquivos de onboarding.

### 2.2 Performance da unidade
- `Performance` (`/performance`) esta em modo demonstrativo, com cards/graficos estaticos e sem carga real de dados.

### 2.3 Detalhe de pedido
- `OrderDetails` (`/orders/:id`) atualmente exibe estrutura fixa/exemplo e nao carrega dados dinamicos do pedido selecionado.

### 2.4 Folha de pagamento
- `Payroll` (`/payroll`) funciona no calculo base e registro de pagamento, mas ainda tem itens parciais:
- descontos/vales estao mockados em `0`;
- recibo avancado esta simulado (mensagem de "recibo simulado").

### 2.5 Ajustes pontuais em modulos ativos
- `Admin`: acao de menu por usuario ainda retorna mensagem "em breve".
- `Dashboard`: campo de NPS enviado para IA com valor mockado.
- `Strategic Dashboard`: estimativa de receita por barbeiro usa proxy quando nao ha preco no appointment.

## 3) Observacoes de operacao
- Portal e Kiosk dependem de addon habilitado por tenant (`tenant_addons`). Quando desabilitado, a tela mostra indisponibilidade de acesso (comportamento esperado).
- Recursos de IA dependem de `VITE_GEMINI_API_KEY` valida.

## 4) Proxima revisao sugerida
- Atualizar este documento sempre que uma funcionalidade sair do estado "em ajuste" para "ativa".
