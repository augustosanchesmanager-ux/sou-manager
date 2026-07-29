# Programa de Certificação — SMG

## Visão Geral

O Programa de Certificação SMG (Sou.Manager) foi desenvolvido para capacitar e validar profissionais que utilizam a plataforma SaaS de gestão de barbearias. Seu objetivo é garantir que cada usuário — do barbeiro ao administrador do sistema — domine as funcionalidades necessárias para operar a plataforma com eficiência, segurança e excelência.

A certificação agrega valor ao profissional ao reconhecer formalmente sua competência, e beneficia o estabelecimento ao assegurar que a equipe utiliza o sistema em todo o seu potencial, reduzindo erros operacionais, aumentando a produtividade e melhorando a experiência do cliente final.

O programa está alinhado à arquitetura multi-app e multi-tenant da SMG, contemplando desde operações básicas de agendamento e checkout até funcionalidades avançadas como fechamento de caixa, comissionamento, clube de assinaturas e administração de múltiplas unidades.

---

## Níveis de Certificação

### Certificação Básica (Nível 1)

| Item | Detalhes |
|------|----------|
| **Público-alvo** | Barbeiro, Recepcionista |
| **Carga horária estimada** | 20 horas |
| **Validade** | 12 meses |

**Módulos abordados:**

- Visão geral da plataforma SMG e navegação básica
- Gestão de agendamentos (criar, editar, cancelar)
- Atendimento ao cliente e fluxo de check-in
- Checkout e fechamento de comanda
- Cadastro e consulta de clientes
- Catálogo de serviços e produtos
- Painel de atendimento do dia

**Pré-requisitos:**

- Acesso ativo à plataforma SMG com perfil de Barbeiro ou Recepcionista
- Conclusão do treinamento introdutório (vídeos e guia rápido)
- Mínimo de 30 dias de uso prático da plataforma

**Formato da prova:**

- Prova teórica online (30 questões)
- Prova prática com 3 cenários simulados
- Tempo total: 90 minutos

**Pontuação mínima para aprovação: 70%**

### Certificação Intermediária (Nível 2)

| Item | Detalhes |
|------|----------|
| **Público-alvo** | Gerente, Financeiro |
| **Carga horária estimada** | 40 horas |
| **Validade** | 12 meses |

**Módulos abordados (inclui Nível 1 +):**

- Gestão financeira: fluxo de caixa, recebimentos e despesas
- Fechamento de caixa (cash closing) e conciliação
- Comissionamento da equipe (cálculo e relatórios)
- Relatórios gerenciais e indicadores de desempenho
- Gestão da equipe: profissionais, horários e permissões
- Clube de assinaturas (ChefClub): planos, assinaturas e créditos
- Gestão de produtos e inventário
- Dashboard e analytics

**Pré-requisitos:**

- Certificação Básica (Nível 1) ativa
- Acesso à plataforma com perfil de Gerente ou Financeiro
- Mínimo de 60 dias de uso prático em funções gerenciais

**Formato da prova:**

- Prova teórica online (40 questões)
- Prova prática com 4 cenários simulados
- Projeto final (análise de caso real)
- Tempo total: 150 minutos

**Pontuação mínima para aprovação: 75%**

### Certificação Avançada (Nível 3)

| Item | Detalhes |
|------|----------|
| **Público-alvo** | Administrador do Sistema |
| **Carga horária estimada** | 60 horas |
| **Validade** | 12 meses |

**Módulos abordados (inclui Nível 1 + 2 +):**

- Administração multi-unidade e multi-tenant
- Configuração de permissões e perfis de acesso
- Personalização da plataforma (serviços, horários, regras de negócio)
- Integrações e APIs
- Segurança e auditoria (RLS, logs, políticas de acesso)
- Gestão de dados e migrações
- Resolução de problemas e suporte técnico
- Observabilidade: métricas, alertas e monitoramento
- Estratégia de rollout e implantação

**Pré-requisitos:**

- Certificação Intermediária (Nível 2) ativa
- Acesso à plataforma com perfil de Administrador do Sistema
- Mínimo de 120 dias de uso prático em funções administrativas
- Aprovação do gestor da unidade ou franquia

**Formato da prova:**

- Prova teórica online (50 questões)
- Prova prática com 5 cenários complexos
- Projeto final (plano de implantação ou otimização)
- Tempo total: 210 minutos

**Pontuação mínima para aprovação: 80%**

---

## Estrutura da Prova

### Prova Teórica

| Característica | Nível 1 | Nível 2 | Nível 3 |
|----------------|---------|---------|---------|
| **Número de questões** | 30 | 40 | 50 |
| **Múltipla escolha** | 20 | 28 | 35 |
| **Verdadeiro/Falso** | 6 | 8 | 10 |
| **Correspondência** | 4 | 4 | 5 |
| **Tempo limite** | 60 min | 80 min | 100 min |
| **Nota de corte** | 70% | 75% | 80% |

**Tipos de questão:**

- **Múltipla escolha:** 4 alternativas (A, B, C, D), uma correta
- **Verdadeiro/Falso:** Afirmação única, justificativa obrigatória nas respostas incorretas
- **Correspondência:** Associar itens de duas colunas (ex: funcionalidade ao módulo, perfil à permissão)

**Tópicos abordados por nível:**

- **Nível 1:** Agendamentos, check-in, checkout, cadastro de clientes, catálogo, navegação
- **Nível 2:** Financeiro, comissionamento, relatórios, ChefClub, inventário, dashboard
- **Nível 3:** Administração multi-tenant, segurança, integrações, observabilidade, implantação

**Materiais de estudo de referência:**

- Guia do Usuário SMG (`docs/user-guide/`)
- Documentação Técnica (`docs/`)
- Vídeos de Treinamento (disponíveis na plataforma)
- Base de Conhecimento (FAQ e artigos)
- Playground / ambiente de testes

### Prova Prática

| Característica | Nível 1 | Nível 2 | Nível 3 |
|----------------|---------|---------|---------|
| **Cenários** | 3 | 4 | 5 |
| **Tempo limite** | 30 min | 70 min | 110 min |

**Cenários por nível:**

**Nível 1 — Operacional:**

1. Realizar agendamento completo para cliente novo, incluindo cadastro, seleção de serviço e profissional
2. Executar fluxo de check-in e checkout com pagamento em dinheiro e emissão de comanda
3. Cancelar agendamento e processar reembolso parcial

**Nível 2 — Gerencial:**

1. Executar fechamento de caixa diário, conferindo valores e resolvendo divergências
2. Calcular comissão da equipe com base em regras de rateio e serviços executados
3. Gerar relatório de desempenho mensal e exportar em CSV
4. Gerenciar plano de assinatura ChefClub: criar, ativar e cancelar assinatura de cliente

**Nível 3 — Administrativo:**

1. Configurar nova unidade com permissões de acesso e horários de funcionamento
2. Diagnosticar e corrigir falha de segurança (RLS ou permissão incorreta)
3. Integrar API externa para importação de clientes
4. Configurar observabilidade: criar alerta para alta taxa de erro no checkout
5. Planejar rollout de atualização com migração de dados

**Critérios de avaliação (aplicados a todos os níveis):**

| Critério | Peso | Descrição |
|----------|------|-----------|
| **Correção** | 40% | A tarefa foi concluída sem erros |
| **Eficiência** | 20% | Uso adequado de atalhos e funcionalidades |
| **Segurança** | 20% | Boas práticas de segurança e privacidade |
| **Documentação** | 10% | Registro claro das ações realizadas |
| **Tempo** | 10% | Conclusão dentro do limite estabelecido |

### Projeto Final

**Obrigatório para:** Nível 2 e Nível 3

**Descrição:**

O projeto final consiste na resolução de um problema real ou simulado utilizando a plataforma SMG. O candidato deve demonstrar capacidade de análise, planejamento e execução, entregando um relatório técnico completo.

**Formatos de submissão:**

- Documento PDF (mínimo 5 páginas, máximo 20)
- Template disponível em `docs/training/certification/templates/`
- Deve conter: Introdução, Desenvolvimento, Resultados, Conclusão

**Temas sugeridos:**

- **Nível 2:** Análise de fluxo de caixa e proposta de otimização; Plano de implementação do ChefClub; Estratégia de comissionamento para equipe mista
- **Nível 3:** Plano de implantação da SMG em nova unidade; Auditoria de segurança e correção de vulnerabilidades; Projeto de migração de dados de sistema legado; Arquitetura de observabilidade para operação multi-unidade

**Rubrica de avaliação:**

| Critério | Peso | Excelente (100%) | Satisfatório (70%) | Insuficiente (<50%) |
|----------|------|------------------|-------------------|--------------------|
| **Clareza e estrutura** | 15% | Documento bem organizado, linguagem clara | Organização adequada com pequenas falhas | Desorganizado ou confuso |
| **Análise técnica** | 30% | Análise profunda com dados e métricas | Análise básica, superficial | Análise ausente ou incorreta |
| **Aplicação prática** | 30% | Solução viável e bem fundamentada | Solução parcial ou com ressalvas | Solução inviável ou não apresentada |
| **Uso da plataforma** | 15% | Demonstra domínio avançado da SMG | Uso adequado, mas sem profundidade | Uso incorreto ou inexistente |
| **Conclusão e recomendações** | 10% | Recomendações claras e acionáveis | Recomendações genéricas | Ausência de recomendações |

---

## Cronograma de Certificação

### Periodicidade

| Certificação | Oferta | Inscrições |
|--------------|--------|------------|
| Nível 1 — Básica | Mensal (primeira semana) | Até 7 dias antes |
| Nível 2 — Intermediária | Trimestral (mar, jun, set, dez) | Até 14 dias antes |
| Nível 3 — Avançada | Semestral (jun, dez) | Até 30 dias antes |
| Recertificação | Contínua (agendamento individual) | Até 7 dias antes |

### Processo de Inscrição

1. Acessar o portal de treinamento em `training.soumanager.app`
2. Selecionar o nível de certificação desejado
3. Verificar pré-requisitos e anexar comprovantes
4. Efetuar o pagamento da taxa (quando aplicável)
5. Receber confirmação por e-mail com link de acesso
6. Realizar a prova no ambiente de testes da plataforma

### Tempo de Preparação Recomendado

| Nível | Estudo teórico | Prática | Projeto | Total estimado |
|-------|---------------|---------|---------|----------------|
| Nível 1 | 10h | 10h | — | 20h |
| Nível 2 | 15h | 15h | 10h | 40h |
| Nível 3 | 20h | 20h | 20h | 60h |

---

## Requisitos de Manutenção

### Educação Continuada

Para manter a certificação ativa, o profissional deve acumular pontos de educação continuada ao longo do ciclo de 12 meses:

| Nível | Pontos mínimos | Atividades válidas |
|-------|----------------|-------------------|
| Nível 1 | 10 pontos | Webinars, artigos técnicos, atualizações da plataforma |
| Nível 2 | 20 pontos | Cursos avançados, participação em comunidade, workshops |
| Nível 3 | 30 pontos | Mentoria, contribuição técnica, apresentações em eventos |

**Pontuação por atividade:**

| Atividade | Pontos | Limite por ciclo |
|-----------|--------|------------------|
| Webinar SMG (1h) | 2 | 10 |
| Leitura de artigo técnico + quiz | 1 | 5 |
| Curso complementar aprovado | 5 | 15 |
| Participação em comunidade (fórum/grupo) | 1 | 5 |
| Mentoria de novos usuários | 3 | 9 |
| Apresentação em evento SMG | 5 | 10 |
| Contribuição para base de conhecimento | 4 | 8 |

### Recertificação

- A certificação expira automaticamente 12 meses após a aprovação
- Para recertificar, o profissional deve:
  - Acumular os pontos mínimos de educação continuada
  - Realizar prova de recertificação (versão reduzida da prova original)
  - Nível 1: 15 questões, 30 minutos
  - Nível 2: 20 questões, 45 minutos
  - Nível 3: 25 questões, 60 minutos
- Nota de corte: mesma da certificação original
- A recertificação pode ser agendada até 30 dias antes do vencimento

### Expiração e Renovação

- **Período de carência:** 30 dias após o vencimento para recertificar sem penalidades
- **Após carência:** O profissional perde a credencial e deve refazer a certificação completa
- **Notificação:** Alertas enviados por e-mail com 90, 60, 30 e 7 dias de antecedência
- **Suspensão temporária:** Possível mediante solicitação (licença médica, afastamento)

---

## Badges e Credenciais

### Crachás Digitais (Badges)

Os crachás digitais são emitidos pela plataforma **Credly** e podem ser compartilhados em redes profissionais (LinkedIn, currículos, e-mail).

| Nível | Badge | Descrição Visual |
|-------|-------|------------------|
| Nível 1 | SMG Certified Operator | Ícone prata com tesoura e barbeador |
| Nível 2 | SMG Certified Manager | Ícone ouro com gráfico e engrenagem |
| Nível 3 | SMG Certified Administrator | Ícone diamante com escudo e chave |

Cada badge contém metadados verificáveis:
- Nome completo do profissional
- Nível de certificação
- Data de emissão e validade
- ID único de verificação
- Logo da SMG

### Certificado

O certificado oficial é gerado em formato PDF e contém:
- Logotipo da SMG e Sou.Manager
- Nome completo do profissional
- Nível de certificação com descrição
- Pontuação obtida
- Data de emissão e data de validade
- Código de verificação (hash único)
- Assinatura digital do responsável pelo programa
- Selo de autenticidade com QR Code

### Processo de Verificação

Qualquer pessoa pode verificar a autenticidade de uma certificação:

1. Acessar `verify.soumanager.app`
2. Inserir o código de verificação (ex: `SMG-2026-8A3F-C2E1`)
3. Visualizar os dados públicos da certificação
4. Alternativa: Escanear o QR Code no certificado

---

## Plano de Estudos

### Cronograma Recomendado

#### Nível 1 — 4 semanas

| Semana | Tópicos | Horas |
|--------|---------|-------|
| Semana 1 | Navegação, agendamentos, check-in | 5h |
| Semana 2 | Checkout, comandas, pagamentos | 5h |
| Semana 3 | Cadastro de clientes, catálogo | 5h |
| Semana 4 | Revisão e simulados | 5h |

#### Nível 2 — 8 semanas

| Semana | Tópicos | Horas |
|--------|---------|-------|
| Semana 1-2 | Revisão Nível 1 + Financeiro básico | 10h |
| Semana 3-4 | Fechamento de caixa, comissionamento | 10h |
| Semana 5-6 | Relatórios, dashboard, ChefClub | 10h |
| Semana 7-8 | Projeto final e revisão | 10h |

#### Nível 3 — 12 semanas

| Semana | Tópicos | Horas |
|--------|---------|-------|
| Semana 1-3 | Multi-tenant, permissões, administração | 15h |
| Semana 4-6 | Segurança, auditoria, RLS | 15h |
| Semana 7-9 | Integrações, APIs, observabilidade | 15h |
| Semana 10-12 | Projeto final e revisão | 15h |

### Recursos por Nível

**Nível 1:**
- Guia rápido interativo (plataforma)
- Vídeos tutoriais (< 5 min cada)
- Flashcards de terminologia
- Lista de verificação de tarefas diárias

**Nível 2:**
- Documentação completa de módulos financeiros
- Estudos de caso de barbearias reais
- Planilhas de exercícios de comissionamento
- Webinars gravados com especialistas

**Nível 3:**
- Documentação técnica (`docs/`) e ADRs (`docs/adr/`)
- Acesso ao playground com dados simulados
- Desafios técnicos semanais
- Sessões de mentoria com administradores experientes

### Recomendações de Prática

- Dedique pelo menos 30 minutos diários de prática na plataforma
- Utilize o ambiente de testes (playground) para experimentar sem riscos
- Simule cenários reais: crie agendamentos, processe checkouts, gere relatórios
- Participe dos grupos de estudo e fóruns da comunidade
- ensine um colega — ensinar consolida o aprendizado
- Revise os erros dos simulados antes de agendar a prova oficial

---

## Simulado

### Instruções

- Este simulado contém 28 questões no formato oficial
- Tempo sugerido: 45 minutos
- Cada questão de múltipla escolha tem apenas uma resposta correta
- Ao final, confira o gabarito

### Parte 1 — Múltipla Escolha (20 questões)

**Questão 1**
Qual é a função principal do módulo de agendamento na plataforma SMG?

A) Gerenciar o estoque de produtos da barbearia
B) Controlar a entrada e saída de funcionários
C) Organizar e gerenciar os horários de atendimento dos profissionais
D) Emitir notas fiscais para os clientes

---

**Questão 2**
No fluxo de checkout, o que acontece quando uma comanda é fechada?

A) O cliente é removido do sistema
B) Os serviços são registrados e o pagamento é processado
C) O profissional é automaticamente desligado do turno
D) O estoque de produtos é zerado

---

**Questão 3**
Qual perfil de usuário tem acesso ao módulo de relatórios gerenciais?

A) Apenas Barbeiro
B) Apenas Recepcionista
C) Gerente e Financeiro
D) Todos os perfis

---

**Questão 4**
O que é o ChefClub na plataforma SMG?

A) Um clube de descontos para funcionários
B) Um sistema de assinaturas e planos de fidelidade para clientes
C) Um fornecedor de produtos capilares
D) Uma ferramenta de comunicação interna

---

**Questão 5**
Qual é a tecla de atalho para abrir o painel de agendamentos do dia?

A) Ctrl + A
B) Ctrl + D
C) F2
D) A plataforma não possui teclas de atalho

---

**Questão 6**
No cálculo de comissão, o que significa `affects_commission` em um serviço?

A) O serviço é gratuito e não gera comissão
B) O serviço pode ser comissionado e entra no cálculo
C) O serviço é cancelado automaticamente
D) O serviço afeta o estoque de produtos

---

**Questão 7**
Qual(is) tabela(s) utiliza(m) o schema compartilhado (`public`) na arquitetura multi-schema?

A) Apenas `appointments`
B) `profiles`, `tenants`, `staff`, `audit_logs`
C) Apenas `clients`
D) Todas as tabelas do sistema

---

**Questão 8**
O que a política de Row Level Security (RLS) impede?

A) A criação de novos usuários no sistema
B) O acesso a dados de outros tenants sem permissão
C) A execução de consultas SQL no banco
D) A exportação de relatórios

---

**Questão 9**
Qual é a função da RPC `get_auth_access_context`?

A) Criar um novo tenant no sistema
B) Resolver o tenantId e permissões do usuário autenticado
C) Excluir sessões expiradas
D) Gerar relatórios de auditoria

---

**Questão 10**
Em um fechamento de caixa diário, qual informação NÃO é necessária?

A) Total de recebimentos do dia
B) Total de despesas registradas
C) Histórico de vendas dos últimos 30 dias
D) Conferência dos valores em caixa

---

**Questão 11**
Como a plataforma SMG garante a idempotência em operações financeiras?

A) Com bloqueio de usuário
B) Através de chaves de idempotência e constraints UNIQUE no banco
C) Com senhas de uso único
D) Através de confirmação por e-mail

---

**Questão 12**
Qual componente é responsável por notificar eventos de negócio para subscribers?

A) RPC do Supabase
B) Event Bus (`appEventBus`)
C) Hook React `useEffect`
D) Serviço de e-mail

---

**Questão 13**
O que é a Outbox no contexto da arquitetura de eventos da SMG?

A) Um repositório de backups
B) Uma fila de entrega confiável de eventos com retry e dead letter
C) Um cache de consultas ao banco
D) Um módulo de envio de e-mails

---

**Questão 14**
No módulo de observabilidade, qual é a finalidade de um histograma?

A) Contar o número de erros em um intervalo
B) Medir a distribuição de latência de operações
C) Registrar logs de auditoria
D) Exibir o status dos serviços

---

**Questão 15**
Qual a diferença entre Commission e Settlement segundo o ADR-001?

A) São sinônimos, não há diferença
B) Commission é teórica; Settlement é o pagamento efetivo considerando descontos e avanços
C) Commission é para serviços; Settlement é para produtos
D) Commission é mensal; Settlement é diário

---

**Questão 16**
Qual o valor da variável `LOCAL_DEMO_USER_ID` usada no modo demo local?

A) `00000000-0000-0000-0000-000000000001`
B) `demo-user-id`
C) `local-demo-user`
D) Não possui valor fixo, é gerado aleatoriamente

---

**Questão 17**
Em qual arquivo está centralizada a instância do cliente Supabase?

A) `src/utils/api.ts`
B) `services/supabaseClient.ts`
C) `context/DatabaseContext.tsx`
D) `App.tsx`

---

**Questão 18**
Qual rota é protegida pelo `SuperAdminRoute`?

A) `/dashboard`
B) `/agendamentos`
C) `/superadmin`
D) `/perfil`

---

**Questão 19**
Qual migration centralizou a correção de todas as políticas RLS usando função SECURITY DEFINER?

A) `20260227223434_fix_all_rls_policies_use_security_definer_function.sql`
B) `20260308_multitenant_hotfix.sql`
C) `20260723000000_security_fix_rls_critical.sql`
D) `20260226052610_fix_manager_trigger_and_backfill_staff.sql`

---

**Questão 20**
Qual o tempo limite para a prova teórica do Nível 3?

A) 60 minutos
B) 80 minutos
C) 100 minutos
D) 120 minutos

---

### Parte 2 — Verdadeiro ou Falso (5 questões)

**Questão 21**
No modo demo local, o login é feito com `teste@soumanager.local` / `12345678`.

( ) Verdadeiro
( ) Falso

---

**Questão 22**
O HashRouter é utilizado porque o Vercel redireciona todas as rotas para `index.html` e o HashRouter funciona corretamente nesse cenário.

( ) Verdadeiro
( ) Falso

---

**Questão 23**
A função `current_tenant_id_from_auth_uid()` é uma função SECURITY INVOKER.

( ) Verdadeiro
( ) Falso

---

**Questão 24**
A certificação Nível 1 tem validade de 24 meses.

( ) Verdadeiro
( ) Falso

---

**Questão 25**
O Replay Engine permite reproduzir eventos do EventStore através do EventBus para reconstrução de estado.

( ) Verdadeiro
( ) Falso

---

### Parte 3 — Correspondência (3 exercícios)

**Exercício 26 — Associe o perfil de usuário à permissão principal:**

| Perfil | Permissão |
|--------|-----------|
| 1. Barbeiro | A. Acesso a relatórios financeiros e comissionamento |
| 2. Recepcionista | B. Configuração de tenants, RLS e integrações |
| 3. Gerente | C. Agendamento, atendimento e checkout |
| 4. Administrador do Sistema | D. Check-in, cadastro de clientes e agendamentos |

**Resposta:** 1-__, 2-__, 3-__, 4-__

---

**Exercício 27 — Associe o componente ao propósito:**

| Componente | Propósito |
|------------|-----------|
| 1. EventBus (appEventBus) | A. Fila confiável com retry e dead letter |
| 2. EventStore | B. Publicação e assinatura de eventos de negócio |
| 3. Outbox | C. Armazenamento append-only de eventos |
| 4. ReplayEngine | D. Reprodução de eventos para reconstrução de estado |

**Resposta:** 1-__, 2-__, 3-__, 4-__

---

**Exercício 28 — Associe o alerta ao seu gatilho:**

| Alerta | Gatilho |
|--------|---------|
| 1. High error rate | A. > 1 rollback / 15 min (Items sync) |
| 2. Checkout timeout | B. > 3 erros / 5 min |
| 3. Items sync rollback | C. > 2 / 15 min (Credit deduction) |
| 4. ChefClub credit failure | D. > 10 segundos |

**Resposta:** 1-__, 2-__, 3-__, 4-__

---

### Gabarito

**Parte 1 — Múltipla Escolha**

| Questão | Resposta |
|---------|----------|
| 1 | C |
| 2 | B |
| 3 | C |
| 4 | B |
| 5 | A |
| 6 | B |
| 7 | B |
| 8 | B |
| 9 | B |
| 10 | C |
| 11 | B |
| 12 | B |
| 13 | B |
| 14 | B |
| 15 | B |
| 16 | A |
| 17 | B |
| 18 | C |
| 19 | A |
| 20 | C |

**Parte 2 — Verdadeiro ou Falso**

| Questão | Resposta |
|---------|----------|
| 21 | Verdadeiro |
| 22 | Verdadeiro |
| 23 | Falso (é SECURITY DEFINER) |
| 24 | Falso (12 meses) |
| 25 | Verdadeiro |

**Parte 3 — Correspondência**

| Exercício | Respostas |
|-----------|-----------|
| 26 | 1-C, 2-D, 3-A, 4-B |
| 27 | 1-B, 2-C, 3-A, 4-D |
| 28 | 1-B, 2-D, 3-A, 4-C |

---

*Documento de certificação SMG — Sou.Manager v1.0*
*Última atualização: Julho 2026*