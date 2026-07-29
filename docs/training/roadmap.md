# Roadmap — Academia SMG

---

## Visão

A **Academia SMG** será a plataforma oficial de treinamento do sistema Sou.Manager (SMG). Seu objetivo é capacitar todos os perfis de usuários — admin, gerente, barbeiro, recepcionista e caixa — para operar o sistema com autonomia e eficiência.

A plataforma será inicialmente implantada no **Sanchez Barber** como piloto, servindo como base para a evolução rumo a uma solução de treinamento escalável e multitenant para **todos os clientes SaaS** do SMG.

---

## Estrutura de Módulos

A Academia SMG será composta por **12 módulos**:

| Módulo | Nome | Perfil Principal | Conteúdo |
|--------|------|------------------|----------|
| 01 | Primeiros Passos | Todos | Cadastro inicial, primeiro login, navegação, perfil |
| 02 | Agenda | Barbeiro, Recepcionista | Agendamentos, calendário, disponibilidade, confirmar/cancelar |
| 03 | Clientes | Recepcionista, Gerente | Cadastro, busca, histórico, ficha do cliente |
| 04 | Comandas | Barbeiro, Caixa | Abertura, itens, fechamento, status da comanda |
| 05 | Checkout / PDV | Caixa | Formas de pagamento, pagamento parcial, estorno |
| 06 | Financeiro | Gerente | Fluxo de caixa, relatório financeiro, comissões |
| 07 | Fechamento de Caixa | Caixa, Gerente | Processo de fechamento, conferência, sangria |
| 08 | Relatórios | Gerente, Admin | Relatórios operacionais, financeiros, exportação CSV |
| 09 | Permissões | Admin, Gerente | Perfis de acesso, RBAC, liberação de funcionalidades |
| 10 | Configurações | Admin | Tenant, equipe, serviços, planos, integrações |
| 11 | Boas Práticas | Todos | Qualidade de dados, fluxos ideais, dicas operacionais |
| 12 | Certificação | Todos | Avaliação final, prova, certificado de conclusão |

---

## Fase 1 — Documentação Base *(Atual)*

> **Objetivo:** Consolidar todo o conhecimento operacional do SMG em documentos estruturados.

### Entregas

- Documentação detalhada dos **5 perfis de usuário** (admin, gerente, barbeiro, recepcionista, caixa)
- **FAQ** com dúvidas frequentes por perfil
- **Checklists** de operação diária (abertura, fechamento, fluxo de atendimento)
- **Exercícios práticos** por módulo para fixação do conteúdo
- Estrutura de **certificação** definida (peso por módulo, nota mínima, critérios)
- Plano de **gravação de vídeos** (roteiro, ordem, dependências)

### Timeline

| Entrega | Prazo Estimado |
|---------|----------------|
| Documentação dos 5 perfis | 4 semanas |
| FAQ consolidado | 2 semanas (paralelo) |
| Checklists operacionais | 2 semanas |
| Exercícios por módulo | 3 semanas |
| Estrutura de certificação | 1 semana |
| Plano de vídeos | 1 semana |
| **Total Fase 1** | **8 semanas** |

---

## Fase 2 — Gravação de Vídeos

> **Objetivo:** Produzir conteúdo em vídeo para todos os módulos, organizado por perfil.

### Lista de Vídeos Estimada

| Módulo | Vídeos | Duração Estimada | Ordem |
|--------|--------|------------------|-------|
| 01 — Primeiros Passos | 3 | 15 min | 1º |
| 02 — Agenda | 4 | 20 min | 2º |
| 03 — Clientes | 3 | 15 min | 3º |
| 04 — Comandas | 4 | 20 min | 4º |
| 05 — Checkout/PDV | 3 | 15 min | 5º |
| 06 — Financeiro | 3 | 15 min | 6º |
| 07 — Fechamento de Caixa | 3 | 15 min | 7º |
| 08 — Relatórios | 3 | 15 min | 8º |
| 09 — Permissões | 2 | 10 min | 9º |
| 10 — Configurações | 3 | 15 min | 10º |
| 11 — Boas Práticas | 2 | 10 min | 11º |
| 12 — Certificação | 1 | 10 min | 12º |
| **Total** | **34 vídeos** | **~170 min** | |

### Ordem de Gravação (Dependências)

Os módulos devem ser gravados em sequência, pois os vídeos posteriores referenciam conceitos introduzidos anteriormente:

1. Módulo 01 (base para todos)
2. Módulos 02 → 03 → 04 → 05 (fluxo operacional)
3. Módulos 06 → 07 → 08 (fluxo financeiro)
4. Módulos 09 → 10 → 11 (administração)
5. Módulo 12 (certificação — último)

### Equipamentos Recomendados

- **Áudio:** Microfone lapela sem fio (ex: Rode Wireless GO II)
- **Vídeo:** Gravação de tela (OBS Studio ou Loom) + câmera para introduções
- **Edição:** CapCut ou DaVinci Resolve (gratuito)
- **Hospedagem:** YouTube (privado) ou plataforma LMS (Fase 3)

### Timeline

| Entrega | Prazo Estimado |
|---------|----------------|
| Gravação Módulos 01–05 | 3 semanas |
| Gravação Módulos 06–09 | 2 semanas |
| Gravação Módulos 10–12 | 1 semana |
| Edição e revisão | 2 semanas |
| **Total Fase 2** | **8 semanas** |

---

## Fase 3 — Plataforma de Treinamento

> **Objetivo:** Implementar uma plataforma de aprendizagem (LMS) para hospedar e gerenciar o treinamento.

### Opções de LMS

| Plataforma | Custo Estimado | Prós | Contras |
|------------|---------------|------|---------|
| **TalentLMS** | $89–$139/mês | Fácil uso, APIs, certificados nativos | Custo recorrente |
| **Moodle** | Gratuito (self-host) | Open source, flexível | Requer infraestrutura |
| **Notion + Typeform** | ~$10/mês | Simples, baixo custo | Limitado para escalar |
| **Custom (React)** | Variável | Totalmente integrado ao SMG | Custo de desenvolvimento |

### Funcionalidades

- **Módulos interativos** com quizzes após cada vídeo
- **Progresso do aluno** rastreado por módulo e por perfil
- **Certificado automático** ao completar todos os módulos do perfil
- **Trilhas por perfil** (admin vê módulos 01, 09, 10, 11; barbeiro vê 01, 02, 04, 11)
- **Notificações** de lembrete para alunos incompletos

### Timeline

| Entrega | Prazo Estimado |
|---------|----------------|
| Definição da plataforma | 1 semana |
| Configuração e integração | 3 semanas |
| Importação de conteúdo | 1 semana |
| Testes com Sanchez Barber (piloto) | 2 semanas |
| **Total Fase 3** | **7 semanas** |

---

## Fase 4 — Evolução para Clientes

> **Objetivo:** Transformar a Academia SMG em um produto escalável e multitenant para todos os clientes SaaS.

### Funcionalidades Planejadas

- **White-label:** Portal de treinamento customizável com identidade visual de cada cliente
- **Customização por cliente:** Adição de módulos específicos por tipo de negócio (barber, auto, club)
- **Multi-idioma:** Português, inglês e espanhol (inicialmente)
- **Analytics:** Dashboard de conclusão, taxa de aprovação, tempo médio por módulo
- **Integração com o SMG:** Bloqueio de funcionalidades até conclusão do treinamento (opcional)
- **Gamificação:** Badges, ranking de alunos, certificados compartilháveis

### Timeline

| Entrega | Prazo Estimado |
|---------|----------------|
| Arquitetura multitenant | 3 semanas |
| White-label engine | 4 semanas |
| Multi-idioma | 2 semanas |
| Analytics dashboard | 3 semanas |
| Piloto com 3 clientes | 4 semanas |
| **Total Fase 4** | **16 semanas** |

---

## Resumo do Timeline Geral

| Fase | Duração | Início Estimado | Fim Estimado |
|------|---------|-----------------|--------------|
| Fase 1 — Documentação Base | 8 semanas | Semana 1 | Semana 8 |
| Fase 2 — Gravação de Vídeos | 8 semanas | Semana 9 | Semana 16 |
| Fase 3 — Plataforma de Treinamento | 7 semanas | Semana 17 | Semana 23 |
| Fase 4 — Evolução para Clientes | 16 semanas | Semana 24 | Semana 39 |
| **Total** | **~39 semanas** | | |

---

## Métricas de Sucesso

| Métrica | Meta |
|---------|------|
| Taxa de conclusão do treinamento (Sanchez) | > 90% dos funcionários |
| Nota média na certificação | > 7/10 |
| Tempo médio para conclusão por perfil | < 4 horas |
| Redução de chamados de suporte operacional | > 40% em 3 meses |
| NPS dos treinandos | > 8 |
| Clientes ativos na plataforma (Fase 4) | 10+ em 6 meses |

---

## Dependências e Riscos

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| **Disponibilidade de colaboradores para gravação** | Atraso na Fase 2 | Agendar gravações com antecedência, gravar em horários alternativos |
| **Mudanças frequentes no sistema** | Vídeos e docs ficam desatualizados | Processo de revisão trimestral, vídeos curtos e modulares |
| **Custo de plataforma LMS** | Orçamento estourado | Começar com opção gratuita (Moodle) ou custom in-app |
| **Baixa adoção pelos funcionários** | Métricas de sucesso não atingidas | Gamificação, certificação obrigatória, suporte dedicado |
| **Escopo da Fase 4 crescer demais** | Atraso na entrega | Priorizar funcionalidades MVP, entrega iterativa |
| **Dependência de um único responsável pelo conteúdo** | Risco de conhecimento perdido | Documentar processos, ter backup de gravação |

---

*Documento gerado em Julho 2026 — Academia SMG / Sou.Manager*
