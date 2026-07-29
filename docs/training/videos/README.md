# Plano de Gravação de Vídeos — SMG

## Introdução

Este documento define o plano completo de gravação de vídeos de treinamento para o sistema SMG (Sou.Manager), uma plataforma SaaS de gestão para barbearias. O plano abrange todos os módulos e funcionalidades do sistema, organizados por perfil de usuário, garantindo que cada operador receba o treinamento adequado às suas responsabilidades.

Os vídeos são projetados para serem objetivos, práticos e focados em fluxos reais de uso, permitindo que novos usuários se tornem produtivos rapidamente. Cada vídeo cobre um tópico específico e pode ser assistido de forma independente, facilitando a consulta sob demanda.

Públicos-alvo: Barbeiro, Recepcionista, Gerente, Financeiro e Administrador (incluindo SuperAdmin).

---

## Equipamentos Recomendados

### Microfone
- **Microfone shotgun** (ex.: Rode VideoMic NTG, Deity D3 Pro) — ideal para captação direcional, minimiza ruído ambiente.
- **Microfone de lapela** (ex.: Rode Wireless Go II, DJI Mic 2) — recomendado para gravação com facecam, mantém qualidade consistente independente da posição.
- **Evitar**: microfone embutido do notebook/headset genérico.

### Captura de Tela
- **OBS Studio** (gratuito, multiplataforma) — recomendado por sua flexibilidade, suporte a múltiplas cenas, transições e gravação em alta qualidade.
- Alternativas: Camtasia, ScreenFlow (macOS), ShareX.

### Configuração de Vídeo
- **Resolução**: 1920x1080 (Full HD) — mínimo absoluto.
- **Framerate**: 30fps — equilíbrio entre fluidez e tamanho do arquivo.
- **Bitrate de vídeo**: 10–15 Mbps para gravação local.
- **Codec**: H.264 (compatibilidade universal).

### Iluminação (para gravações com facecam)
- Luz principal (key light) posicionada a 45° do rosto, leve acima dos olhos.
- Uma segunda luz de preenchimento (fill light) do lado oposto em intensidade reduzida.
- Luz de fundo (backlight) para separar o sujeito do fundo.

### Ambiente de Gravação
- Sala silenciosa, sem eco (cortinas, tapetes, móveis estofados ajudam).
- Portas e janelas fechadas.
- Notificações do sistema operacional desativadas.
- Desktop limpo: sem arquivos pessoais, papéis de parede poluídos ou icones desnecessários.

---

## Padrão de Gravação

| Item | Padrão |
|------|--------|
| **Formato do vídeo** | MP4 |
| **Resolução** | 1920x1080 (Full HD) |
| **Framerate** | 30fps |
| **Codec de vídeo** | H.264 |
| **Codec de áudio** | AAC, 192 kbps, 44.1 kHz |
| **Idioma** | Português Brasileiro |
| **Duração por vídeo** | 5–15 minutos (nunca exceder 20 minutos) |
| **Intro** | 5 segundos — logomarca SMG + nome do módulo |
| **Outro** | 3 segundos — logomarca SMG + "Acesse: soumanager.com.br" |
| **Facecam** | Opcional — recomendada para vídeos conceituais, evitada em demonstrações de interface |

### Convenção de Nomenclatura de Arquivos

```
[perfil]-[modulo]-[sequencia].mp4
```

Onde:
- **perfil**: `barbeiro`, `recepcionista`, `gerente`, `financeiro`, `admin`
- **modulo**: sigla de 2–4 caracteres do módulo (ex.: `agenda`, `pdv`, `financeiro`)
- **sequencia**: número de dois dígitos (01, 02, 03...)

Exemplo: `barbeiro-agenda-01.mp4`, `gerente-financeiro-12.mp4`

---

## Roteiro por Perfil

### Barbeiro — Total estimado: 1h30min

| Código | Vídeo | Duração | Descrição |
|--------|-------|---------|-----------|
| B-01 | Primeiro Acesso e Navegação | 8 min | Login, recuperação de senha, visão geral da interface, menu lateral, alternância entre módulos |
| B-02 | Visão Geral do Dashboard | 6 min | Métricas do dia: agendamentos, faturamento, comissão, clientes atendidos, indicadores visuais |
| B-03 | Agenda — Visualização e Confirmação | 10 min | Visualizar agenda do dia/semana, filtrar por status, confirmar presença, remarcar da agenda |
| B-04 | Atendimento — Ciclo Completo | 12 min | Iniciar atendimento, executar serviços, adicionar produtos, finalizar, transição para checkout |
| B-05 | Comandas — Abertura e Gerenciamento | 8 min | Abrir comanda, adicionar itens (serviços/produtos), visualizar total parcial, comandas abertas |
| B-06 | Checkout/PDV — Venda de Serviços e Produtos | 12 min | Tela de PDV, seleção de forma de pagamento (dinheiro, cartão, pix), divisão de pagamento, emissão de recibo |
| B-07 | Descontos e ChefClub no PDV | 8 min | Aplicar desconto por porcentagem/valor, validar planos ChefClub, aplicar benefício no checkout |
| B-08 | Comissão — Entendendo Seus Ganhos | 8 min | Visualizar comissão por serviço, comissão acumulada no período, relatório individual de ganhos |
| B-09 | Fechamento Individual | 6 min | Fechamento do próprio caixa, conferência de valores, divergências, confirmação |
| B-10 | Notificações e Suporte | 5 min | Central de notificações, preferências, canal de suporte, FAQ, abertura de chamado |
| B-11 | Modo Offline | 5 min | Como funciona o modo offline, limitações, sincronização automática ao reconectar |
| B-12 | Boas Práticas e Erros Comuns | 8 min | Fluxos recomendados, erros frequentes (comanda não fechada, serviço não finalizado), dicas de produtividade |

### Recepcionista — Total estimado: 1h50min

| Código | Vídeo | Duração | Descrição |
|--------|-------|---------|-----------|
| R-01 | Primeiro Acesso e Dashboard | 6 min | Login, visão da recepção, atalhos rápidos, painel do dia |
| R-02 | Cadastro de Clientes | 10 min | Criar novo cliente (dados pessoais, contato, preferências), editar, buscar, cliente frequente |
| R-03 | Agenda — Agendamentos | 12 min | Agendar novo horário, selecionar profissional, serviço, horário disponível, confirmação automática |
| R-04 | Reagendamento e Cancelamento | 8 min | Remarcar agendamento, cancelar com motivo, notificação ao profissional, política de no-show |
| R-05 | Lista de Espera | 5 min | Adicionar cliente à lista de espera, critérios de prioridade, notificar quando vaga abrir |
| R-06 | Comandas para Recepção | 6 min | Abrir comanda para cliente sem agendamento, associar a profissional, adicionar observações |
| R-07 | Checkout e Recebimentos | 12 min | Finalizar vendas, múltiplas formas de pagamento, dividir conta, estornar, emitir recibo |
| R-08 | Produtos — Consulta e Venda | 6 min | Catálogo de produtos, consultar estoque, adicionar venda de produto avulso |
| R-09 | Caixa Diário | 8 min | Abertura de caixa, movimentações, sangria, reforço, fechamento parcial |
| R-10 | Comunicação com Clientes | 6 min | Enviar mensagem (WhatsApp integrado), lembrete de agendamento, pesquisa de satisfação |
| R-11 | Suporte e Problemas Frequentes | 8 min | Problemas comuns (agenda conflitante, cliente não encontrado, pagamento recusado) |
| R-12 | Boas Práticas | 5 min | Fluxo ideal de recepção, organização da agenda, dicas de atendimento ao cliente |

### Gerente — Total estimado: 3h30min

| Código | Vídeo | Duração | Descrição |
|--------|-------|---------|-----------|
| G-01 | Primeiro Acesso e Configuração Inicial | 12 min | Login, configurações iniciais da barbearia (nome, endereço, horário de funcionamento), convite de equipe |
| G-02 | Dashboard e Painel Estratégico | 10 min | Indicadores-chave (faturamento diário/mensal, ticket médio, clientes novos vs. recorrentes, taxa de ocupação) |
| G-03 | BI — Visão do Negócio | 12 min | Relatórios inteligentes, gráficos de desempenho, comparativo períodos, exportação de dados |
| G-04 | Gestão de Clientes | 10 min | Lista completa, filtros, histórico de atendimentos, anotações, campanha de marketing |
| G-05 | Catálogo de Serviços | 8 min | Cadastrar/editar serviços, definir preço, duração, comissão, categorias ativação |
| G-06 | Gestão de Produtos e Estoque | 10 min | Cadastrar produtos, controle de estoque, movimentações, ajuste manual, alerta de estoque mínimo |
| G-07 | Gestão de Equipe | 10 min | Cadastrar profissionais, vínculo, horários de trabalho, dias de folga, bloqueio de agenda |
| G-08 | Fornecedores e Pedidos | 8 min | Cadastro de fornecedores, histórico de pedidos, notas fiscais |
| G-09 | Promoções | 6 min | Criar promoções (serviço avulso, combo, fidelidade), período de vigência, divulgação |
| G-10 | Comandas e Checkout | 10 min | Visão geral de comandas abertas, fechamento centralizado, revisão de checkout |
| G-11 | Visão Geral Financeira | 10 min | Painel financeiro, receita bruta/líquida, despesas, resultados do período |
| G-12 | Fluxo de Caixa | 12 min | Entradas e saídas, projeção, saldo atual, conciliação |
| G-13 | Fechamento de Caixa | 15 min | Processo completo de fechamento, conferência de valores, divergências, relatório final |
| G-14 | Contas a Pagar e Receber | 10 min | Lançamentos, vencimentos, baixa manual, conciliação bancária |
| G-15 | Folha de Pagamento | 8 min | Cálculo automático, comissões + fixo, holerite, aprovação |
| G-16 | Comissões | 10 min | Configuração de regras de comissão, relatório por profissional, aprovação de comissão |
| G-17 | Relatórios | 8 min | Relatórios gerenciais (desempenho, financeiro, operacional), exportação CSV/PDF |
| G-18 | ChefClub — Planos e Assinaturas | 12 min | Configurar planos de assinatura, gerenciar assinantes, benefícios, faturamento recorrente |
| G-19 | ChefClub — Recebíveis | 6 min | Recebíveis de assinaturas, conciliação, inadimplência, recuperação |
| G-20 | Permissões e Controle de Acesso | 10 min | Definir perfis de acesso, permissões por módulo, restrições por profissional |
| G-21 | Configurações e Administração | 8 min | Configurações gerais, preferências do sistema, integrações, domínio personalizado |

### Financeiro — Total estimado: 2h

| Código | Vídeo | Duração | Descrição |
|--------|-------|---------|-----------|
| F-01 | Visão Geral Financeira | 8 min | Painel financeiro completo, saldo, receitas/despesas do período, indicadores |
| F-02 | Fluxo de Caixa Completo | 12 min | Demonstrativo de fluxo de caixa, origem e aplicação de recursos, saldo projetado |
| F-03 | Sangrias e Reforços | 6 min | Registrar sangria (retirada de caixa), reforço (depósito), motivos, aprovação |
| F-04 | Contas a Pagar | 10 min | Lançamento de contas, categorização, vencimento, pagamento, histórico |
| F-05 | Contas a Receber | 10 min | Recebíveis (serviços, produtos, assinaturas), baixa, conciliação, relatório de inadimplência |
| F-06 | Recibos e Reversões | 8 min | Emissão de segunda via, estorno de pagamento, reversão de comanda, auditoria |
| F-07 | Fechamento de Caixa Detalhado | 15 min | Fechamento completo com conferência de valores por forma de pagamento, divergências |
| F-08 | Folha de Pagamento | 10 min | Processamento da folha, cálculo de comissões, descontos, aprovação e pagamento |
| F-09 | Comissões e Auditoria | 10 min | Auditoria de comissões calculadas, divergências, ajustes manuais, aprovação final |
| F-10 | Auditoria Financeira | 8 min | Log de alterações financeiras, rastreamento de operações, trilha de auditoria |
| F-11 | Relatórios Financeiros | 8 min | DRE, balancete, fluxo de caixa, relatórios fiscais, exportação |
| F-12 | Controle de Inconsistências | 10 min | Identificar e resolver divergências (caixa x sistema, comissões, recebíveis) |

### Administrador — Total estimado: 2h30min

| Código | Vídeo | Duração | Descrição |
|--------|-------|---------|-----------|
| A-01 | Primeiro Acesso e Admin Panel | 8 min | Login administrativo, painel de administração, visão geral da plataforma |
| A-02 | Configurações do Sistema | 10 min | Configurações globais, personalização, branding, domínio, e-mail transacional |
| A-03 | Gestão de Usuários | 10 min | Lista de usuários, cadastro, ativação/bloqueio, vínculo com barbearia |
| A-04 | Permissões Detalhadas | 15 min | Configuração granular de permissões, criação de papéis personalizados, herança |
| A-05 | Gestão de Profissionais e Serviços | 10 min | Cadastro avançado, vínculo multi-unidade, matriz de serviços x profissionais |
| A-06 | Produtos e Fornecedores | 8 min | Catálogo consolidado, fornecedores, importação/exportação |
| A-07 | Configuração de Agenda | 6 min | Bloqueios globais, feriados, capacidade por horário, regras de agendamento |
| A-08 | ChefClub — Configuração | 10 min | Configuração completa do módulo de assinaturas, planos, gateway de pagamento |
| A-09 | Kiosk e Portal | 10 min | Configuração do quiosque de autoatendimento, portal do cliente, personalização |
| A-10 | Segurança e Auditoria | 12 min | Logs de acesso, tentativas de login, sessões ativas, políticas de senha, 2FA |
| A-11 | Monitoramento e Observabilidade | 10 min | Dashboard de observabilidade, métricas do sistema, alertas, health checks |
| A-12 | SuperAdmin — Gestão da Plataforma | 12 min | Visão multi-tenant, gestão de tenants, métricas da plataforma, suporte a tenants |
| A-13 | Backup e Recuperação | 6 min | Política de backup, restauração, procedimentos de disaster recovery |
| A-14 | Multi-App Architecture | 8 min | Arquitetura multi-app (barber, auto, club), schema routing, hostname resolution |

---

## Ordem Ideal de Gravação

A ordem de gravação segue uma progressão lógica, começando pelos módulos fundamentais que são pré-requisito para os demais.

### Fase 1 — Módulos Core (Fundação)
Gravar primeiro os módulos que todos os perfis utilizam:
- Dashboard e navegação básica
- Agenda (visualização, agendamento)
- Comandas (abertura, gerenciamento)
- Checkout / PDV

**Vídeos**: B-01, B-02, B-03, B-05, B-06, R-01, R-03, R-06, R-07, G-01, G-02, G-10

### Fase 2 — Módulos Financeiros
Após a base operacional consolidada:
- Fluxo de caixa
- Contas a pagar/receber
- Fechamento de caixa
- Comissões

**Vídeos**: G-11, G-12, G-13, G-14, G-16, F-01, F-02, F-04, F-05, F-07, F-09

### Fase 3 — Administração e Configuração
Configurações avançadas e gestão da plataforma:
- Catálogo de serviços e produtos
- Gestão de equipe
- Permissões
- Configurações do sistema

**Vídeos**: G-04, G-05, G-06, G-07, G-20, G-21, A-01, A-02, A-03, A-04

### Fase 4 — Módulos Avançados
Funcionalidades especializadas:
- ChefClub (planos, assinaturas, recebíveis)
- Kiosk e Portal
- BI e relatórios inteligentes
- Observabilidade

**Vídeos**: G-03, G-18, G-19, A-08, A-09, A-11, A-14

### Fase 5 — Conteúdo Específico por Perfil
Vídeos complementares e de nicho:
- Modo offline
- Lista de espera
- Promoções
- Fornecedores e pedidos

**Vídeos**: B-11, R-05, G-08, G-09, F-03, F-06, F-08, F-10, F-11, F-12, A-10, A-12, A-13

### Fase 6 — Boas Práticas e Erros Comuns
Finalizar com vídeos de consolidação:
- Boas práticas por perfil
- Erros comuns e como evitá-los
- Suporte e problemas frequentes

**Vídeos**: B-10, B-12, R-10, R-11, R-12

---

## Checklist Pré-Gravação

- [ ] **Roteiro revisado e aprovado** — texto final revisado por colega, sem erros ou ambiguidades
- [ ] **Ambiente de teste configurado** — dados demo carregados (clientes, serviços, produtos, comandas, agendamentos)
- [ ] **Gravação de tela testada** — OBS Studio configurado com a resolução e bitrate corretos
- [ ] **Nível do microfone verificado** — gravação de teste de 10s, sem clipping, sem ruído de fundo
- [ ] **Sem ruído ambiente** — janelas fechadas, ar condicionado desligado, avisar moradores/colegas
- [ ] **Desktop limpo** — sem arquivos pessoais, atalhos desnecessários, fundo neutro ou wallpaper padrão
- [ ] **Zoom do navegador em 100%** — evitar zoom acidental que distorce a interface
- [ ] **Barra de notificações limpa** — fechar abas desnecessárias, silenciar notificações do sistema
- [ ] **Janela do navegador redimensionada** — 1920x1080 padrão, sem barra de favoritos excessiva
- [ ] **Ferramentas de anotação desativadas** — desligar realce de clique, cursor personalizado se aplicável
- [ ] **Usuário demo logado** — perfil correto para o vídeo (barbeiro, recepcionista, etc.)
- [ ] **Senhas e dados sensíveis ocultos** — evitar expor credenciais reais
- [ ] **Bateria do notebook carregando** — evitar queda durante a gravação

---

## Checklist Pós-Gravação

- [ ] **Vídeo exportado no formato correto** — MP4, H.264, 1920x1080, 30fps
- [ ] **Qualidade verificada** — áudio sincronizado, sem cortes, sem ruídos, imagem nítida
- [ ] **Legendas/CC adicionadas** — arquivo SRT ou legendas incorporadas
- [ ] **Thumbnail criada** (se aplicável) — 1280x720, texto legível, identidade visual SMG
- [ ] **Upload realizado no storage definido** — YouTube (não listado), Vimeo, ou storage interno
- [ ] **Documentação atualizada** — link do vídeo adicionado ao guia do módulo correspondente
- [ ] **Planilha de rastreamento marcada** — status: "Concluído", data, duração real
- [ ] **Nome do arquivo conforme padrão** — `[perfil]-[modulo]-[sequencia].mp4`
- [ ] **Metadados preenchidos** — título, descrição, tags (ver seção Metadados dos Vídeos)
- [ ] **Backup do arquivo fonte** — manter projeto OBS (`.json`) e raw video para reedição

---

## Metadados dos Vídeos

### Formato do Título

```
SMG — [Perfil] — [Nome do Vídeo]
```

Exemplos:
- `SMG — Barbeiro — Primeiro Acesso e Navegação`
- `SMG — Gerente — Fechamento de Caixa`
- `SMG — Administrador — Gestão de Usuários`

### Template de Descrição

```
🎯 Neste vídeo você aprenderá sobre [tópico] no SMG (Sou.Manager).

📌 O que você verá:
• [Tópico 1]
• [Tópico 2]
• [Tópico 3]

👤 Perfil: [Barbeiro / Recepcionista / Gerente / Financeiro / Administrador]
⏱ Duração: [X] minutos
📁 Módulo: [Nome do módulo]

🔗 Documentação relacionada: [link para docs]
💬 Dúvidas? Acesse nosso suporte em [link de suporte]

#SMG #SouManager #Treinamento #[Perfil]
```

### Tags / Categorias

Tags obrigatórias para todos os vídeos:
- `SMG`
- `Sou.Manager`
- `Treinamento`
- `[Perfil]` (ex.: `Barbeiro`, `Gerente`)
- `[Módulo]` (ex.: `Agenda`, `Checkout`, `Financeiro`)

Tags opcionais por conteúdo:
- `ChefClub`, `PDV`, `Comissão`, `Fluxo de Caixa`, `BI`, `Kiosk`, `Admin`

### Links para Documentação Relacionada

Cada vídeo deve referenciar:
1. O guia do módulo correspondente em `docs/`
2. A seção relevante do manual do usuário
3. Link para a central de ajuda / FAQ

---

> **Última atualização:** Julho de 2026
>
> Este plano é um documento vivo. Conforme novos módulos são lançados ou fluxos são alterados, os vídeos correspondentes devem ser atualizados ou criados. Consulte o roadmap do produto em `docs/ROADMAP.md` para alinhamento com o cronograma de releases.