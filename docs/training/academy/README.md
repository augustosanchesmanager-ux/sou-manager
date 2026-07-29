# Academia SMG — Plataforma de Treinamento Oficial

## Visão Geral

A **Academia SMG** é o currículo completo de treinamento da plataforma SMG (Sou.Manager). Seu objetivo é transformar novos usuários em operadores proficientes, reduzindo o tempo de onboarding e maximizando o aproveitamento de todas as funcionalidades do sistema.

Inicialmente desenvolvida para a vertical **Sanchez Barber** (app `barber`), a Academia será expandida progressivamente para atender todos os clientes do SaaS, incluindo as verticais **Auto** e **Club dos Chefes**.

A plataforma combine vídeos tutoriais, documentação escrita, exercícios práticos e avaliações objetivas, organizados em módulos progressivos que acompanham o fluxo real de operação do sistema.

---

## Metodologia

A Academia SMG segue quatro pilares metodológicos:

| Pilar | Descrição |
|-------|-----------|
| **Aprendizado modular** | Cada módulo é independente e pode ser consumido na ordem que fizer sentido para o perfil do usuário |
| **Complexidade progressiva** | Os módulos iniciais cobrem operações básicas; os avançados exploram configurações, relatórios e boas práticas |
| **Vídeo + Documentação + Exercícios** | Todo conteúdo teórico é acompanhado de demonstrações práticas e exercícios para fixação |
| **Avaliação prática** | Ao final de cada módulo, o usuário responde a um quiz de verificação; a certificação final exige aproveitamento mínimo de 80% |

---

## Módulo 01 — Primeiros Passos

**O que você vai aprender:** Ambientação completa com a plataforma SMG, desde o primeiro acesso até a personalização do perfil. O usuário será capaz de navegar pelas principais telas, alternar entre temas e configurar suas preferências.

**Pré-requisitos:** Nenhum. Este é o módulo inicial.

**Duração estimada em vídeo:** 18 minutos

**Vídeos:**
1. **Boas-vindas ao SMG** — Apresentação da plataforma, visão geral do ecossistema e o que esperar do treinamento (3 min)
2. **Visão geral do sistema** — Tour guiado pelas principais seções: Agenda, Clientes, Comandas, Financeiro e Configurações (5 min)
3. **Login e primeira senha** — Como acessar, recuperar senha e configurar autenticação de dois fatores (3 min)
4. **Navegando na interface** — Sidebar, cabeçalho, atalhos de teclado e busca global (4 min)
5. **Tema escuro/claro** — Como alternar entre os temas e configurar a preferência padrão (1 min)
6. **Configurações do perfil** — Foto, nome, idioma, notificações e preferências regionais (2 min)

**Documentação relacionada:**
- `docs/onboarding/README.md` — Guia de primeiros passos
- `docs/architecture/overview.md` — Visão geral da arquitetura

---

## Módulo 02 — Agenda

**O que você vai aprender:** Operar a agenda de agendamentos completa: criar, remarcar, cancelar e gerenciar a lista de espera. O usuário será capaz de manter a agenda organizada e evitar conflitos de horário.

**Pré-requisitos:** Módulo 01 — Primeiros Passos

**Duração estimada em vídeo:** 32 minutos

**Vídeos:**
1. **Visão geral da Agenda** — Layout, visões (dia/semana/mês) e filtros (3 min)
2. **Criando agendamentos** — Seleção de profissional, serviço, cliente e horário; agendamento rápido (5 min)
3. **Remarcando agendamentos** — Como arrastar ou usar o menu de contexto para reagendar (3 min)
4. **Cancelando agendamentos** — Fluxo de cancelamento com motivo e notificação ao cliente (3 min)
5. **Confirmando chegada** — Marcação de check-in e gatilhos para abertura automática de comanda (3 min)
6. **Bloqueios na agenda** — Como criar blocos de horário indisponível por profissional ou período (4 min)
7. **Detecção de conflitos** — Como o sistema alerta sobre sobreposições e horários duplicados (2 min)
8. **Walk-in management** — Atendimento sem agendamento prévio; fluxo rápido de check-in (4 min)
9. **Lista de espera** — Adicionar clientes à espera, notificação automática e remoção (3 min)
10. **Atalhos e produtividade** — Dicas para agendamento em lote e uso do teclado (2 min)

**Documentação relacionada:**
- `docs/features/appointments/README.md` — Documentação completa da agenda
- `docs/features/appointments/conflicts.md` — Política de detecção de conflitos

---

## Módulo 03 — Clientes

**O que você vai aprender:** Gerenciar a base de clientes completa: cadastro, histórico, importação e programas de fidelidade. O usuário será capaz de manter dados organizados e acompanhar o relacionamento com cada cliente.

**Pré-requisitos:** Módulo 01 — Primeiros Passos

**Duração estimada em vídeo:** 28 minutos

**Vídeos:**
1. **Cadastro de clientes** — Formulário completo, campos obrigatórios, dados de contato e endereço (5 min)
2. **Pesquisa de clientes** — Busca por nome, telefone, e-mail; filtros avançados e busca fonética (3 min)
3. **Histórico do cliente** — Agendamentos passados, comandas, gastos e preferências (4 min)
4. **Importação CSV** — Formato esperado, mapeamento de colunas, validação e importação em lote (4 min)
5. **Aniversariantes** — Calendário de aniversários, automação de mensagens e campanhas (3 min)
6. **Club dos Chefes — Assinaturas** — Como gerenciar planos ativos, histórico de cobranças e cancelamentos (5 min)
7. **Bloqueio de clientes** — Como bloquear, motivos disponíveis e impacto nas operações (2 min)
8. **Privacidade e LGPD** — Consentimento, exclusão de dados e exportação (2 min)

**Documentação relacionada:**
- `docs/features/clients/README.md` — Gestão de clientes
- `docs/features/chefclub/README.md` — Programa Club dos Chefes

---

## Módulo 04 — Comandas

**O que você vai aprender:** Dominar o ciclo de vida completo das comandas: abertura, adição de itens, status e auditoria. O usuário será capaz de acompanhar comandas abertas e fechadas com total rastreabilidade.

**Pré-requisitos:** Módulo 01 — Primeiros Passos, Módulo 03 — Clientes

**Duração estimada em vídeo:** 25 minutos

**Vídeos:**
1. **O que é uma comanda** — Conceito, objetivo e fluxo dentro do sistema (2 min)
2. **Abrindo uma comanda** — Vinculação com agendamento ou abertura avulsa por cliente (4 min)
3. **Adicionando serviços** — Busca por serviço, quantidade, profissional responsável e comissionamento (4 min)
4. **Adicionando produtos** — Busca por produto, controle de estoque e valor (3 min)
5. **Status da comanda** — Aberta, em andamento, fechada, cancelada; transições permitidas (3 min)
6. **Histórico financeiro** — Linha do tempo de movimentações, valores e responsáveis (4 min)
7. **Ajustes de auditoria** — Correção de itens, justificativa obrigatória e trilha de auditoria (3 min)
8. **Comandas múltiplas** — Como um cliente pode ter múltiplas comandas simultâneas (2 min)

**Documentação relacionada:**
- `docs/features/comandas/README.md` — Guia completo de comandas
- `docs/adr/ADR-001-Comission-vs-Settlement.md` — Separação entre comissão e fechamento

---

## Módulo 05 — Checkout / PDV

**O que você vai aprender:** Operar o checkout e PDV com fluência: montagem do carrinho, descontos, créditos e reversões. O usuário será capaz de finalizar vendas com qualquer método de pagamento e emitir recibos.

**Pré-requisitos:** Módulo 04 — Comandas

**Duração estimada em vídeo:** 30 minutos

**Vídeos:**
1. **Montagem do carrinho** — Revisão de itens da comanda, quantidades e valores antes do fechamento (4 min)
2. **Descontos** — Tipos de desconto (percentual, valor fixo), autorização e justificativa (4 min)
3. **Créditos Club dos Chefes** — Aplicação de créditos do plano de assinatura no checkout (3 min)
4. **Execução multi-participante** — Rateio de serviços entre múltiplos profissionais (4 min)
5. **Formas de pagamento** — Dinheiro, cartão, PIX, crédito Club dos Chefes e pagamento parcelado (5 min)
6. **Recibos** — Emissão de recibo impresso, digital (WhatsApp/e-mail) e NFC-e (4 min)
7. **Reversões / Estorno** — Fluxo completo de reversão de checkout, justificativa e ajuste financeiro (4 min)
8. **Checkout rápido** — Atalhos e configurações para agilizar o fechamento (2 min)

**Documentação relacionada:**
- `docs/features/checkout/README.md` — Fluxo de checkout
- `docs/features/payments/README.md` — Métodos de pagamento

---

## Módulo 06 — Financeiro

**O que você vai aprender:** Interpretar e operar o módulo financeiro: fluxo de caixa, contas a receber/pagar e conciliação. O usuário será capaz de acompanhar a saúde financeira do negócio em tempo real.

**Pré-requisitos:** Módulo 04 — Comandas, Módulo 05 — Checkout/PDV

**Duração estimada em vídeo:** 28 minutos

**Vídeos:**
1. **Visão geral do Financeiro** — Dashboard financeiro, saldo atual e indicadores-chave (3 min)
2. **Fluxo de caixa** — Entradas e saídas do dia, projeção e histórico (4 min)
3. **Receitas** — Lançamento de receitas manuais, categorização e conciliação (4 min)
4. **Despesas** — Lançamento de despesas fixas e variáveis, categorias e comprovantes (4 min)
5. **Reversões financeiras** — Impacto das reversões de checkout no fluxo de caixa (3 min)
6. **Contas a receber** — Parcelas pendentes, recebimento parcial e baixa manual (4 min)
7. **Contas a pagar** — Fornecedores, vencimentos, pagamento e conciliação (4 min)
8. **Exportação e relatórios** — Exportar dados financeiros para CSV/PDF (2 min)

**Documentação relacionada:**
- `docs/features/finance/README.md` — Módulo financeiro completo
- `docs/features/cashflow/README.md` — Fluxo de caixa

---

## Módulo 07 — Fechamento de Caixa

**O que você vai aprender:** Realizar o fechamento de caixa diário com precisão: conferência física, quebra por forma de pagamento e ajustes. O usuário será capaz de fechar o caixa de forma auditável e exportar relatórios.

**Pré-requisitos:** Módulo 05 — Checkout/PDV, Módulo 06 — Financeiro

**Duração estimada em vídeo:** 26 minutos

**Vídeos:**
1. **Visão geral do fechamento** — O que é o fechamento de caixa e por que ele é importante (2 min)
2. **Resumo financeiro** — Valor bruto, descontos, taxas e valor líquido do dia (4 min)
3. **Quebra por forma de pagamento** — Dinheiro, cartão, PIX e Club dos Chefes detalhados (4 min)
4. **Conferência física** — Como conferir o dinheiro em caixa versus o esperado pelo sistema (4 min)
5. **Sangria e Suprimento** — Retirada ou adição de valores ao caixa durante o expediente (3 min)
6. **Cartão dos barbeiros** — Pagamento direto ao profissional e registro no fechamento (3 min)
7. **Exportação** — Exportar relatório de fechamento em PDF e CSV (3 min)
8. **Histórico de fechamentos** — Consultar fechamentos anteriores e comparar períodos (3 min)

**Documentação relacionada:**
- `docs/features/cash-closing/README.md` — Fechamento de caixa completo
- `docs/features/cash-closing/troubleshooting.md` — Solução de problemas comuns

---

## Módulo 08 — Relatórios

**O que você vai aprender:** Extrair e interpretar relatórios gerenciais para tomada de decisão. O usuário será capaz de utilizar o dashboard estratégico e o BI integrado para monitorar o desempenho do negócio.

**Pré-requisitos:** Módulo 06 — Financeiro

**Duração estimada em vídeo:** 22 minutos

**Vídeos:**
1. **Relatórios de vendas** — Faturamento por período, profissional, serviço e forma de pagamento (4 min)
2. **Analytics Club dos Chefes** — Métricas de assinantes, retenção e ticket médio (3 min)
3. **Dashboard de BI** — Indicadores interativos, filtros cruzados e drill-down (4 min)
4. **Painel estratégico** — KPIs de performance, metas e comparativos (4 min)
5. **Relatório de comissões** — Comissão por profissional, período e serviço (3 min)
6. **Exportação de relatórios** — Formatos disponíveis, agendamento de envio e compartilhamento (2 min)
7. **Relatórios personalizados** — Criação de visões customizadas com filtros salvos (2 min)

**Documentação relacionada:**
- `docs/features/reports/README.md` — Módulo de relatórios
- `docs/features/bi-dashboard/README.md` — Dashboard de BI

---

## Módulo 09 — Permissões

**O que você vai aprender:** Configurar e auditar permissões de acesso dos usuários do sistema. O usuário será capaz de entender a hierarquia de papéis, atribuir permissões granulares e manter a segurança do ambiente.

**Pré-requisitos:** Módulo 01 — Primeiros Passos

**Duração estimada em vídeo:** 20 minutos

**Vídeos:**
1. **Hierarquia de papéis** — SuperAdmin, Manager, Barber, Receptionist, Cashier; responsabilidades de cada um (3 min)
2. **Permissões granulares** — Visão geral dos 47 itens de permissão individuais (4 min)
3. **Presets de permissão** — Perfis pré-configurados e criação de presets personalizados (4 min)
4. **Atribuindo permissões** — Como conceder e revogar permissões para usuários e grupos (3 min)
5. **Auditoria de permissões** — Histórico de alterações, relatório de acesso e revisão periódica (3 min)
6. **Boas práticas de segurança** — Princípio do menor privilégio, revisão trimestral e casos de uso (3 min)

**Documentação relacionada:**
- `docs/features/permissions/README.md` — Sistema de permissões
- `docs/security/SECURITY_AUDIT_RLS.md` — Auditoria de segurança RLS

---

## Módulo 10 — Configurações

**O que você vai aprender:** Configurar todos os aspectos operacionais do sistema: serviços, produtos, equipe, fornecedores e promoções. O usuário será capaz de personalizar o SMG para a realidade do seu negócio.

**Pré-requisitos:** Módulo 01 — Primeiros Passos, Módulo 03 — Clientes

**Duração estimada em vídeo:** 35 minutos

**Vídeos:**
1. **Configurações do negócio** — Dados da empresa, horário de funcionamento, feriados e políticas (5 min)
2. **Serviços** — Cadastro, categorias, duração, valor e comissionamento (5 min)
3. **Produtos** — Cadastro, categorias, estoque, fornecedor e margem (4 min)
4. **Gestão de equipe** — Cadastro de profissionais, vínculo, horários e comissões (5 min)
5. **Fornecedores** — Cadastro, dados de contato, condições comerciais e histórico (4 min)
6. **Pedidos de compra** — Criação de pedidos, aprovação, recebimento e conferência (5 min)
7. **Promoções** — Criação de campanhas, regras de desconto, vigência e públicos-alvo (4 min)
8. **Notificações** — Configuração de disparo automático (WhatsApp, e-mail), templates e limites (3 min)

**Documentação relacionada:**
- `docs/features/settings/README.md` — Configurações do sistema
- `docs/features/inventory/README.md` — Gestão de estoque

---

## Módulo 11 — Boas Práticas

**O que você vai aprender:** Adotar rotinas e práticas recomendadas para operação diária, segurança de dados, atendimento ao cliente e gestão de crises. O usuário será capaz de manter a excelência operacional e prevenir problemas.

**Pré-requisitos:** Todos os módulos anteriores (01 a 10) ou autorização do supervisor

**Duração estimada em vídeo:** 24 minutos

**Vídeos:**
1. **Rotina diária** — Checklist de abertura e fechamento, verificação de agendamentos e pendências (4 min)
2. **Higiene de dados** — Limpeza periódica de clientes inativos, backup e arquivamento (3 min)
3. **Práticas de segurança** — Senhas fortes, logout ao ausentar-se, não compartilhar credenciais (3 min)
4. **Atendimento ao cliente** — Uso do histórico para personalizar o atendimento, follow-up pós-serviço (4 min)
5. **Comunicação da equipe** — Uso de notas internas, registro de observações e alinhamento (3 min)
6. **Gestão de crises** — Reversão de checkout, recuperação de agenda, contato com suporte (4 min)
7. **Melhoria contínua** — Como sugerir melhorias, reportar bugs e acompanhar changelog (3 min)

**Documentação relacionada:**
- `docs/best-practices/README.md` — Guia de boas práticas
- `docs/support/README.md` — Procedimentos de suporte

---

## Módulo 12 — Certificação

**O que você vai aprender:** Preparar-se para a certificação oficial SMG. O usuário será capaz de obter os selos de proficiência que atestam sua capacidade de operar o sistema em nível básico, avançado ou especialista.

**Pré-requisitos:** Todos os módulos anteriores (01 a 11) concluídos com quizzes aprovados

**Duração estimada em vídeo:** 15 minutos

**Vídeos:**
1. **Níveis de certificação** — Bronze (operador), Prata (supervisor), Ouro (administrador) e Platina (especialista) (3 min)
2. **Preparação para o exame** — Conteúdo cobrado por nível, material de estudo e simulados (4 min)
3. **Inscrição no exame** — Como agendar, formato (online/presencial) e regras (2 min)
4. **Credenciais e selos** — Como acessar e compartilhar os selos de certificação (3 min)
5. **Manutenção da certificação** — Recertificação anual, atualizações e novos módulos (3 min)

**Documentação relacionada:**
- `docs/certification/README.md` — Programa de certificação
- `docs/certification/levels.md` — Detalhes por nível

---

## Como Navegar na Academia

### Caminhos recomendados por perfil

| Perfil | Caminho recomendado |
|--------|---------------------|
| **Barber** (Profissional) | Módulos 01 → 02 → 03 → 04 → 05 → 11 |
| **Receptionist** (Recepcionista) | Módulos 01 → 02 → 03 → 04 → 05 → 09 → 11 |
| **Cashier** (Operador de caixa) | Módulos 01 → 04 → 05 → 06 → 07 → 09 |
| **Manager** (Gerente) | Todos os módulos (01 a 12) |
| **SuperAdmin** | Todos os módulos (01 a 12) + documentação de segurança |

### Pré-requisitos entre módulos

```
01 ──→ 02 ──→ 03 ──→ 04 ──→ 05 ──→ 06 ──→ 07
                            │                │
                            └──→ 08 ─────────┘
                                  │
      09 ──→ 10 ──→ 11 ──→ 12
```

Módulos 09 e 10 podem ser cursados em paralelo após o Módulo 01.

### Quizzes de autoavaliação

Ao final de cada módulo, o usuário encontra um quiz com 5 a 10 questões objetivas. Para avançar ao módulo seguinte, é necessário acertar no mínimo 60% das questões. O quiz pode ser refeito quantas vezes for necessário.

---

## Progress Tracking

### Como o progresso é medido

O progresso na Academia SMG é rastreado com base em três métricas:

1. **Visualização de vídeos** — Cada vídeo assistido por completo conta como 1 ponto para o módulo. Vídeos acelerados ou pulados não contam integralmente.
2. **Quizzes concluídos** — Cada quiz respondido com aproveitamento mínimo de 60% desbloqueia a conclusão do módulo.
3. **Avaliação prática** — Módulos com componente prático exigem a execução de uma tarefa no sistema (ex.: criar um agendamento, abrir uma comanda, realizar um fechamento de caixa) para validação.

### Conclusão de módulo

Um módulo é considerado **concluído** quando:
- 100% dos vídeos foram assistidos
- O quiz foi aprovado com 60% ou mais
- A avaliação prática (quando aplicável) foi realizada com sucesso

Módulos concluídos são marcados com um selo verde no painel do usuário.

### Progresso da certificação

A certificação final (Módulo 12) só fica disponível quando todos os 11 módulos anteriores estão concluídos. O progresso acumulado é exibido como uma barra de progresso global na página inicial da Academia:

```
Módulos concluídos: ████████░░ 8/11 (72%)
```

Após a certificação, o usuário recebe:
- **Selo digital** para compartilhamento em redes sociais e currículo
- **Certificado em PDF** com dados do usuário e data de obtenção
- **Distintivo no sistema** visível no perfil do usuário dentro do SMG