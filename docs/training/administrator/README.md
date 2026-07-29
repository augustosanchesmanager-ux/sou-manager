# Treinamento — Administrador do Sistema

> Manual completo de treinamento para o perfil **Administrador do Sistema** do Sou.Manager (SMG).

---

## Índice Completo

| Módulo | Título | Tempo |
|--------|--------|-------|
| 01 | Primeiro Acesso | 30 min |
| 02 | Configurações do Sistema | 45 min |
| 03 | Gestão de Usuários | 45 min |
| 04 | Permissões e Controle de Acesso | 60 min |
| 05 | Gestão de Profissionais | 30 min |
| 06 | Catálogo de Serviços | 30 min |
| 07 | Gestão de Produtos e Estoque | 30 min |
| 08 | Gestão de Fornecedores | 20 min |
| 09 | Configuração da Agenda | 30 min |
| 10 | ChefClub | 25 min |
| 11 | Kiosk e Portal | 30 min |
| 12 | Segurança | 40 min |
| 13 | Auditoria | 30 min |
| 14 | Monitoramento | 25 min |
| 15 | Observabilidade | 25 min |
| 16 | Painel Admin | 40 min |
| 17 | SuperAdmin (Plataforma) | 45 min |
| 18 | Backup e Recuperação | 20 min |
| 19 | Multi-App Architecture | 20 min |

---

## Objetivo do Treinamento

Capacitar o Administrador do Sistema a gerenciar integralmente a plataforma Sou.Manager, incluindo configurações, usuários, permissões, catálogos, segurança, monitoramento e operações avançadas do painel admin e SuperAdmin.

---

## Pré-requisitos

- Conta criada com perfil de **Administrador** ou **SuperAdmin**
- Acesso ao endereço da aplicação (ex: `barber.soumanager.com`)
- Navegador atualizado (Chrome, Edge ou Firefox)
- Conhecimento básico de operação de sistemas web
- Acesso ao e-mail institucional para recebimento de notificações

---

## Tempo Estimado

- **Total: ~10 horas**
- Módulos básicos (01–09): ~4 horas
- Módulos intermediários (10–15): ~2,5 horas
- Módulos avançados (16–19): ~2,5 horas
- Exercícios práticos: ~1 hora (incluso nos módulos)

---

## Ordem Ideal dos Módulos

```
01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09
→ 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17 → 18 → 19
```

> Os módulos são sequenciais. Não pule etapas sem ter concluído as anteriores.

---

## Módulo 01 — Primeiro Acesso

### 1.1 Login como Administrador

1. Acesse o endereço da aplicação fornecido pelo responsável.
2. Na tela de login, insira o **e-mail** e a **senha**.
3. Clique em **Entrar**.
4. Se a conta estiver pendente de aprovação, você será redirecionado para `/pending-approval`. Aguarde a aprovação de um SuperAdmin.

### 1.2 Visão Geral do Painel Admin

Após o login, o administrador acessa o **Painel Admin** que contém:

- **Lojas** — Lista de estabelecimentos vinculados ao tenant
- **Usuários** — Gestão de contas e papéis
- **Solicitações de Acesso** — Pedidos pendentes de aprovação
- **Tickets** — Chamados de suporte
- **Configurações** — Parâmetros globais do sistema

### 1.3 Navegação da Interface

- **Menu lateral** — Acesso rápido a todas as seções
- **Cabeçalho** — Notificações, perfil do usuário, logout
- **Breadcrumbs** — Caminho de navegação atual
- **Atalhos de teclado** — `Ctrl + K` para busca rápida (quando disponível)

---

## Módulo 02 — Configurações do Sistema

### 2.1 Informações do Negócio

Acesse **Configurações → Informações do Negócio**:

- **Nome do estabelecimento** — Nome oficial da barbearia
- **Nome fantasia** — Nome popular
- **E-mail de contato** — E-mail institucional
- **Telefone** — Número com DDD
- **URL do site** — Endereço web (opcional)

### 2.2 Tipo de Pessoa (PF/PJ)

- **Pessoa Física (PF)** — CPF do responsável
- **Pessoa Jurídica (PJ)** — CNPJ da empresa

> Configure corretamente pois afeta notas fiscais e relatórios financeiros.

### 2.3 Configuração de CNPJ/CPF

- **CNPJ** — Formato: `XX.XXX.XXX/XXXX-XX`
- **CPF** — Formato: `XXX.XXX.XXX-XX`
- Validação automática de dígitos verificadores
- Campo obrigatório para operações financeiras

### 2.4 Gestão de Endereço

- **CEP** — Preenchimento automático dos campos de endereço
- **Logradouro** — Rua/Avenida
- **Número** — Número do estabelecimento
- **Complemento** — Sala, andar, loja
- **Bairro** — Bairro
- **Cidade** — Cidade
- **Estado** — UF (sigla)

### 2.5 Preferências de Notificação

Configure quais notificações o sistema enviará:

- **E-mail** — Confirmações, lembretes, relatórios
- **Push** — Notificações no navegador
- **WhatsApp** — Lembretes de agendamento (se integrado)
- **Novos agendamentos** — Alerta ao criar agendamento
- **Cancelamentos** — Alerta ao cancelar agendamento
- **Pagamentos** — Alerta de recebimentos

### 2.6 Habilitação de Módulos

Cada módulo pode ser ativado ou desativado conforme a necessidade do estabelecimento:

| Módulo | Descrição |
|--------|-----------|
| Agenda | Agendamentos e calendário |
| Clientes | Cadastro e gestão de clientes |
| Serviços | Catálogo de serviços |
| Financeiro | Comandas, fechamento, relatórios |
| Equipe | Profissionais e permissões |
| Relatórios | Dashboards e análises |
| Comunicação | Notificações e mensagens |
| Produtos | Estoque e produtos |
| ChefClub | Planos de assinatura |

---

## Módulo 03 — Gestão de Usuários

### 3.1 Visão Geral

Acesse **Admin → Usuários** para ver todos os usuários do sistema.

- **Status**: Ativo, Pendente, Suspenso, Inativo
- **Papel**: SuperAdmin, Manager, Barber, Receptionist
- **Último acesso**: Data/hora do último login

### 3.2 Criar Usuário

1. Clique em **Novo Usuário**
2. Preencha:
   - Nome completo
   - E-mail (usado como login)
   - Telefone
   - Papel (função)
3. Clique em **Salvar**
4. O sistema enviará um e-mail de convite

### 3.3 Editar Usuário

1. Localize o usuário na lista
2. Clique no ícone de **editar** (lápis)
3. Altere os campos desejados
4. Clique em **Salvar**

### 3.4 Desativar Usuário

> ⚠️ Esta ação é reversível, mas o usuário perde acesso imediatamente.

1. Localize o usuário
2. Clique em **desativar**
3. Confirme a ação

### 3.5 Papéis de Usuário

| Papel | Descrição |
|-------|-----------|
| SuperAdmin | Acesso total à plataforma |
| Manager | Gestão do estabelecimento |
| Barber | Acesso limitado (agenda, comandas) |
| Receptionist | Acesso a recepção e agendamentos |

### 3.6 Tratamento de Solicitações de Acesso

1. Acesse **Admin → Solicitações de Acesso**
2. Revise os pedidos pendentes
3. Aprove ou rejeite conforme necessário
4. Atribua o papel apropriado

---

## Módulo 04 — Permissões e Controle de Acesso

### 4.1 Hierarquia de Papéis

```
SuperAdmin (acesso total à plataforma)
  └── Manager (gestão do estabelecimento)
        ├── Barber (profissional)
        └── Receptionist (recepção)
```

### 4.2 47 Permissões Granulares

O sistema possui **47 permissões** distribuídas em **7 módulos**:

| Módulo | Permissões | Exemplos |
|--------|------------|----------|
| Agenda | 8 | Ver agenda, criar, editar, cancelar, reagendar, bloquear, ver horários, configurar |
| Clientes | 7 | Ver clientes, criar, editar, excluir, ver histórico, exportar, importar |
| Serviços | 6 | Ver serviços, criar, editar, excluir, categorias, preços |
| Financeiro | 8 | Ver comandas, fechar, ver relatórios, comissões, fechamento diário, reverter, exportar |
| Equipe | 7 | Ver equipe, criar, editar, excluir, permissões, comissões, agenda |
| Relatórios | 6 | Dashboard, financeiro, clientes, serviços, equipe, exportar |
| Comunicação | 5 | Notificações, lembretes, promoções, chat, e-mail |

### 4.3 Presets de Permissões

Presets pré-configurados para agilizar a configuração:

| Preset | Descrição |
|--------|-----------|
| Recepção Básico | Acesso mínimo para recepcionista |
| Recepção Completo | Acesso total para recepcionista |
| Barbeiro Básico | Acesso mínimo para barbeiro |
| Barbeiro Experiente | Acesso ampliado para barbeiro |

### 4.4 Copiar Permissões entre Papéis

1. Acesse **Admin → Permissões**
2. Selecione o papel de origem
3. Clique em **Copiar Permissões**
4. Selecione o papel de destino
5. Confirme a ação

### 4.5 Permissões Proibidas

Algumas permissões são **proibidas** para certos papéis e não podem ser atribuídas:

- SuperAdmin não pode ter permissões removidas
- Manager não pode acessar configurações de plataforma
- Barber não pode gerenciar outros usuários

### 4.6 Auditoria de Permissões

- Histórico de alterações de permissões
- Quem alterou, quando e o quê
- Relatório de permissões por usuário

---

## Módulo 05 — Gestão de Profissionais

### 5.1 CRUD de Profissionais

Acesse **Equipe → Profissionais**:

- **Criar**: Nome, e-mail, telefone, especialidade, comissão
- **Editar**: Alterar dados cadastrais e configurações
- **Visualizar**: Histórico, agenda, desempenho
- **Excluir**: Remover do sistema (soft delete)

### 5.2 Atribuição de Papel

- Cada profissional pode ter um papel no sistema (Barber, Manager, etc.)
- O papel define as permissões de acesso
- Papel pode ser alterado a qualquer momento

### 5.3 Configuração de Taxa de Comissão

- **Porcentagem fixa** — Ex: 40% sobre serviços
- **Por faixa** — Comissão progressiva baseada em volume
- **Por serviço** — Diferente comissão por tipo de serviço
- **Por produto** — Comissão separada para vendas de produtos

### 5.4 Gestão de Status

| Status | Descrição |
|--------|-----------|
| Ativo | Pode acessar e ser agendado |
| Inativo | Não pode ser agendado, mas mantém dados |
| Férias | Em período de férias |
| Licença | Em licença médica ou pessoal |

### 5.5 Gestão de Avatar

- Upload de foto do profissional
- Formatos aceitos: JPG, PNG
- Tamanho máximo: 2MB
- Recorte automático disponível

---

## Módulo 06 — Catálogo de Serviços

### 6.1 CRUD de Serviços

Acesse **Catálogo → Serviços**:

- **Nome** — Nome do serviço
- **Descrição** — Detalhes do serviço
- **Duração** — Tempo estimado (minutos)
- **Preço** — Valor cobrado
- **Categoria** — Agrupamento do serviço
- **Status** — Ativo/Inativo

### 6.2 Gestão de Categorias

- Criar, editar, excluir categorias
- Exemplos: Corte, Barba, Tratamento, Combo
- Ordenação personalizada
- Ícone ou cor para identificação visual

### 6.3 Configuração de Preços

- **Preço base** — Valor padrão do serviço
- **Preço promocional** — Valor com desconto
- **Preço por profissional** — Diferente preço por barbeiro
- **Preço por horário** — Happy hour ou horário nobre

### 6.4 Configuração de Duração

- **Duração fixa** — Tempo padrão
- **Duração variável** — Mínimo e máximo
- **Tempo de preparo** — Tempo adicional se necessário
- **Intervalo entre agendamentos** — Buffer para limpeza/preparo

### 6.5 Toggle Ativo/Inativo

- Serviços inativos não aparecem para agendamento
- Dados históricos são preservados
- Pode ser reativado a qualquer momento

---

## Módulo 07 — Gestão de Produtos e Estoque

### 7.1 CRUD de Produtos

Acesse **Produtos → Estoque**:

- **Nome** — Nome do produto
- **Descrição** — Detalhes do produto
- **Código de barras** — SKU ou EAN
- **Categoria** — Tipo do produto
- **Fornecedor** — Fornecedor vinculado

### 7.2 Preço de Custo e Venda

- **Preço de custo** — Quanto custa ao estabelecimento
- **Preço de venda** — Quanto o cliente paga
- **Margem de lucro** — Calculado automaticamente
- **Markup** — Percentual sobre o custo

### 7.3 Quantidade em Estoque

- **Estoque atual** — Quantidade disponível
- **Unidade de medida** — Un, Kg, Lt, etc.
- **Atualização manual** — Entrada/saída de estoque
- **Histórico de movimentações** — Registro de todas as entradas/saídas

### 7.4 Estoque Mínimo

- **Limite mínimo** — Quantidade para alerta
- **Alerta automático** — Notificação quando abaixo do mínimo
- **Sugestão de compra** — Geração automática de pedido

### 7.5 Flag de Pedido Automático

- Ative para gerar pedidos automáticos quando o estoque atingir o mínimo
- Integrado com fornecedores (quando disponível)
- Configuração de lead time de entrega

---

## Módulo 08 — Gestão de Fornecedores

### 8.1 CRUD de Fornecedores

Acesse **Produtos → Fornecedores**:

- **Razão Social** — Nome oficial da empresa
- **Nome Fantasia** — Nome popular
- **CNPJ/CPF** — Documento fiscal
- **Telefone** — Contato principal
- **E-mail** — E-mail de contato
- **Endereço** — Endereço completo

### 8.2 Informações de Contato

- **Pessoa de contato** — Nome do representante
- **Telefone direto** — Ramal ou direto
- **WhatsApp** — Número para mensagens
- **E-mail comercial** — E-mail para pedidos

### 8.3 Atribuição de Categoria

- Categorizar fornecedores por tipo de produto
- Ex: Cosméticos, Equipamentos, Mobiliário
- Facilita busca e relatórios

---

## Módulo 09 — Configuração da Agenda

### 9.1 Blocos de Horário

Configure os horários de funcionamento:

- **Segunda a Sexta** — Horário comercial padrão
- **Sábado** — Horário especial
- **Domingo** — Fechado ou horário reduzido
- **Feriados** — Bloqueio ou horário especial

### 9.2 Horários de Almoço/Pausa

- **Início do intervalo** — Horário de início
- **Fim do intervalo** — Horário de retorno
- **Duração** — Calculado automaticamente
- **Bloqueio automático** — Nenhum agendamento no intervalo

### 9.3 Horário de Funcionamento

- **Abertura** — Horário de início do expediente
- **Fechamento** — Horário de término do expediente
- **Horário de corte** — Último horário possível para agendamento
- **Antecedência mínima** — Tempo mínimo para agendar

### 9.4 Configurações de Detecção de Conflitos

- **Bloqueio de conflitos** — Impede agendamentos simultâneos
- **Buffer entre serviços** — Tempo de preparo entre atendimentos
- **Limite de sobreposição** — Máximo de agendamentos ao mesmo tempo
- **Alerta de conflito** — Notificação quando possível conflito

---

## Módulo 10 — ChefClub

### 10.1 Gestão de Planos

Acesse **ChefClub → Planos**:

- **Nome do plano** — Identificação do plano
- **Preço** — Valor mensal/anual
- **Créditos** — Quantidade de créditos incluídos
- **Benefícios** — Lista de vantagens
- **Status** — Ativo/Inativo

### 10.2 Configuração de Créditos

- **Créditos por mês** — Quantidade mensal
- **Tipos de crédito** — Serviço, produto, combo
- **Validade** — Prazo de uso dos créditos
- **Rollover** — Créditos não utilizados acumulam?

### 10.3 Configuração de Reserva Prioritária

- **Antecedência máxima** — Dias de antecedência para agendar
- **Prioridade na fila** — Clientes ChefClub têm prioridade
- **Horários exclusivos** — Alguns horários só para assinantes

### 10.4 Configuração de Desconto em Produtos

- **Percentual de desconto** — Desconto sobre produtos
- **Produtos elegíveis** — Quais produtos têm desconto
- **Limite de desconto** — Valor máximo de desconto

### 10.5 Configuração de Rollover

- **Rollover ativo** — Créditos acumulam para o próximo mês
- **Limite de rollover** — Máximo de créditos acumulados
- **Validade estendida** — Prazo adicional para uso

---

## Módulo 11 — Kiosk e Portal

### 11.1 Gestão de Dispositivos Kiosk

Acesse **Configurações → Kiosk**:

- **Nome do dispositivo** — Identificação do kiosk
- **Localização** — Onde está instalado
- **Status** — Online/Offline
- **Última conexão** — Data/hora da última comunicação

### 11.2 Configuração de Tema

- **Cor principal** — Identidade visual
- **Logo** — Logo do estabelecimento
- **Imagem de fundo** — Background do kiosk
- **Fonte** — Tipografia utilizada

### 11.3 Configuração de Timeout

- **Tempo de inatividade** — Tempo para retornar à tela inicial
- **Tela de boas-vindas** — Mensagem exibida
- **Fluxo de navegação** — Passos do cliente no kiosk

### 11.4 Tema do Portal

- **Personalização visual** — Cores, logo, fontes
- **URL personalizada** — Link do portal público
- **SEO** — Título e descrição para buscas

### 11.5 Janelas de Reagendamento/Cancelamento

- **Antecedência mínima** — Tempo mínimo para cancelar
- **Taxa de cancelamento** — Cobrança por cancelamento tardio
- **Reagendamento ilimitado** — Quantas vezes pode reagendar

### 11.6 Links Compartilháveis

- **Link de agendamento** — URL para agendamento direto
- **Link de perfil** — URL do profissional
- **Link de catálogo** — URL do catálogo de serviços
- **QR Code** — Código para acesso rápido

---

## Módulo 12 — Segurança

### 12.1 Gestão de Sessões

- **Sessões ativas** — Lista de dispositivos conectados
- **Encerramento remoto** — Finalizar sessão de outro dispositivo
- **Limite de sessões** — Máximo de dispositivos simultâneos
- **Expiração automática** — Tempo máximo de sessão

### 12.2 Políticas RLS (Row Level Security)

- **Isolamento por tenant** — Cada loja vê apenas seus dados
- **RLS habilitado** — Proteção no nível do banco de dados
- **Políticas de leitura** — Quem pode ler quais dados
- **Políticas de escrita** — Quem pode modificar quais dados

### 12.3 Auditoria de Acesso

- **Log de login** — Data, hora, IP, dispositivo
- **Log de ações** — Todas as alterações realizadas
- **Relatório de acessos** — Quem acessou o quê e quando
- **Alertas de segurança** — Notificações de acessos suspeitos

### 12.4 Boas Práticas de Segurança

- Use senhas fortes (mínimo 8 caracteres, maiúsculas, minúsculas, números, símbolos)
- Ative autenticação de dois fatores quando disponível
- Não compartilhe credenciais
- Revise permissões regularmente
- Monitore logs de auditoria
- Mantenha o sistema atualizado

### 12.5 Políticas de Senha

- **Comprimento mínimo** — 8 caracteres
- **Complexidade** — Maiúscula, minúscula, número, símbolo
- **Expiração** — Troca obrigatória a cada 90 dias
- **Histórico** — Não pode reutilizar últimas 5 senhas
- **Bloqueio** — 5 tentativas falhas = bloqueio temporário

---

## Módulo 13 — Auditoria

### 13.1 Visualizador de Logs de Auditoria

Acesse **Admin → Auditoria**:

- **Data/hora** — Quando a ação ocorreu
- **Usuário** — Quem realizou a ação
- **Ação** — O que foi feito (CREATE, UPDATE, DELETE)
- **Tabela** — Qual tabela foi afetada
- **Registro** — ID do registro alterado
- **Dados anteriores** — Estado antes da alteração
- **Dados novos** — Estado após a alteração

### 13.2 Rastreamento de Tabelas/Registros

- **Todas as tabelas** — Cobertura completa do banco
- **Registros críticos** — Clientes, pagamentos, acessos
- **Rastreamento de entidade** — Histórico completo de um registro
- **Correlação** — Relação entre ações (ex: criação → pagamento)

### 13.3 Histórico de Alterações

- **Timeline** — Visualização cronológica
- **Diff** — Comparação visual de alterações
- **Reversão** — Possibilidade de desfazer (quando aplicável)
- **Exportação** — Download em CSV ou PDF

### 13.4 Filtros e Busca

- **Por usuário** — Ações de um específico usuário
- **Por período** — Intervalo de datas
- **Por ação** — CREATE, UPDATE, DELETE
- **Por tabela** — Qual tabela afetada
- **Busca textual** — Palavras-chave nos logs

### 13.5 Considerações de Conformidade

- **LGPD** — Proteção de dados pessoais
- **Retenção** — Logs mantidos por 5 anos
- **Criptografia** — Dados protegidos em trânsito e repouso
- **Acesso restrito** — Apenas SuperAdmin pode apagar logs

---

## Módulo 14 — Monitoramento

### 14.1 Monitoramento do Supabase

Acesse **Admin → Monitoramento**:

- **Status do banco** — Online/Offline
- **Conexões ativas** — Número de conexões simultâneas
- **Queries lentas** — Queries com tempo de resposta alto
- **Erros** — Falhas de conexão ou timeout

### 14.2 Saúde do Banco de Dados

- **Tamanho do banco** — Espaço utilizado
- **Tabelas maiores** — Top 10 tabelas por tamanho
- **Índices** — Uso e eficiência de índices
- **Vacuum** — Status de limpeza do banco

### 14.3 Métricas de Recursos

- **CPU** — Uso do processador
- **Memória** — RAM utilizada
- **Disco** — Espaço em disco
- **Rede** — Tráfego de rede

### 14.4 Gestão de Armazenamento

- **Espaço total** — Capacidade disponível
- **Espaço utilizado** — Consumo atual
- **Arquivos grandes** — Imagens, documentos
- **Limpeza automática** — Políticas de retenção

### 14.5 Monitoramento de Conexões

- **Conexões ativas** — Em tempo real
- **Histórico** — Padrões de uso ao longo do tempo
- **Picos** — Momentos de maior demanda
- **Pool de conexões** — Configuração do pool

### 14.6 Regras de Automação

- **Backup automático** — Agendamento de backups
- **Limpeza de dados** — Remoção de dados antigos
- **Alertas automáticos** — Notificações por threshold
- **Relatórios periódicos** — Envio automático de relatórios

### 14.7 Configuração de Alertas

- **Critico** — Banco offline, erros de conexão
- **Alerta** — Uso de disco > 80%, queries lentas
- **Informativo** — Backup concluído, manutenção agendada
- **Canal de notificação** — E-mail, Slack, webhook

---

## Módulo 15 — Observabilidade

### 15.1 Dashboard de Observabilidade do Sistema

Acesse `/#/observability` (requer perfil Manager):

- **Visão Geral** — Total de operações, taxa de sucesso, erros, alertas ativos
- **Abas por domínio** — Checkout, CashClosing, Appointments, Commission, ChefClub
- **Distribuição de latência** — min, p50, avg, p95, max por domínio
- **Alertas** — Alertas ativos, regras, histórico
- **Logs** — Logs estruturados recentes com filtros

### 15.2 Métricas por Domínio

| Domínio | Métricas |
|---------|----------|
| Checkout | Duração, taxa de erro, rollbacks |
| CashClosing | Duração, falhas, valores |
| Appointments | Criação, cancelamentos, duração |
| Commission | Cálculos, falhas, valores |
| ChefClub | Deduções, assinaturas, erros |

### 15.3 14 Regras de Alerta

| Categoria | Regra | Limiar | Severidade |
|-----------|-------|--------|------------|
| Global | Alta taxa de erro | > 5 erros / 5 min | Crítico |
| Global | Alta latência RPC | > 3 segundos | Alerta |
| Global | Alta taxa de rollback | > 10 rollbacks / 15 min | Crítico |
| Checkout | Falha no checkout | > 3 / 5 min | Crítico |
| Checkout | Timeout no checkout | > 10 segundos | Alerta |
| Checkout | Rollback de itens | > 1 / 15 min | Crítico |
| CashClosing | Falha no fechamento | > 2 / 15 min | Crítico |
| CashClosing | Duração alta | > 15 segundos | Alerta |
| Appointment | Falha na criação | > 3 / 5 min | Crítico |
| Appointment | Duração alta | > 8 segundos | Alerta |
| Commission | Falha no cálculo | > 2 / 15 min | Alerta |
| ChefClub | Falha na dedução | > 2 / 15 min | Crítico |
| ChefClub | Falha na resolução | > 3 / 15 min | Alerta |

### 15.4 Logs Estruturados

- **Contexto** — Tenant, usuário, request, correlação
- **Níveis** — debug, info, warn, error
- **Domínio** — Checkout, CashClosing, Appointment, etc.
- **Filtros** — Por tempo, nível, domínio, usuário

### 15.5 Configuração de Webhook

```typescript
alerts.addWebhook({
  url: 'https://hooks.slack.com/services/...',
  method: 'POST',
  headers: { 'X-Custom': 'value' },
  transform: (notification) => ({
    text: notification.message,
    severity: notification.severity,
  }),
});
```

---

## Módulo 16 — Painel Admin

### 16.1 Gestão Multi-Loja

Acesse **Admin → Painel**:

- **Lista de lojas** — Todas as lojas do tenant
- **Status** — Ativa/Inativa
- **Métricas** — Agendamentos, receita, profissionais
- **Configurações** — Configurar cada loja individualmente

### 16.2 Gestão de Usuários entre Tenants

- **Usuários globais** — Usuários que podem acessar múltiplas lojas
- **Atribuição** — Vincular usuários a lojas específicas
- **Permissões por loja** — Diferentes permissões em cada loja
- **Transferência** — Mover usuário entre lojas

### 16.3 Aprovação de Solicitações de Acesso

1. Visualize solicitações pendentes
2. Revise dados do solicitante
3. Verifique a documentação (se aplicável)
4. Aprove ou rejeite com justificativa
5. Atribua papel e permissões

### 16.4 Gestão de Tickets de Suporte

- **Lista de tickets** — Chamados abertos
- **Status** — Aberto, Em andamento, Resolvido, Fechado
- **Prioridade** — Alta, Média, Baixa
- **Atribuição** — Designar responsável
- **Resolução** — Documentar solução aplicada

### 16.5 Configurações do Sistema

- **Configurações gerais** — Parâmetros globais
- **Integrações** — APIs externas
- **Manutenção** — Modo manutenção, atualizações
- **Logs do sistema** — Logs de aplicação

---

## Módulo 17 — SuperAdmin (para Plataformas)

> ⚠️ Este módulo é acessível apenas para perfis **SuperAdmin**.

### 17.1 Gestão de Empresas

Acesse **SuperAdmin → Empresas**:

- **Lista de empresas** — Todos os tenants da plataforma
- **Criar empresa** — Novo tenant
- **Configurar** — Parâmetros do tenant
- **Desativar** — Desativar tenant
- **Métricas** — Uso, receita, crescimento

### 17.2 Gestão de Usuários na Plataforma

- **Usuários globais** — Todos os usuários da plataforma
- **Atribuição de tenant** — Vincular usuários a tenants
- **Papéis globais** — SuperAdmin, Manager, etc.
- **Busca avançada** — Filtros por tenant, papel, status

### 17.3 Solicitações de Assinatura

- **Pedidos pendentes** — Solicitações de upgrade
- **Aprovação** — Aprovar ou rejeitar
- **Configuração** — Definir plano e limites
- **Faturamento** — Gerenciar cobranças

### 17.4 Logs de Auditoria da Plataforma

- **Visão global** — Todas as ações da plataforma
- **Filtros avançados** — Por tenant, usuário, ação, período
- **Exportação** — Download para compliance
- **Retenção** — Política de retenção de logs

### 17.5 Alertas do Sistema

- **Alertas de saúde** — Status dos serviços
- **Alertas de segurança** — Acessos suspeitos
- **Alertas de uso** — Limites de resources
- **Canais de notificação** — E-mail, Slack, webhook

### 17.6 Alertas de Risco

- **Anomalias de uso** — Padrões incomuns
- **Tentativas de acesso** — Múltiplas falhas de login
- **Exportação em massa** — Downloads grandes
- **Alterações sensíveis** — Mudanças em configurações críticas

### 17.7 Ações Rápidas

- **Reset de senha** — Resetar senha de usuário
- **Desativar conta** — Desativar imediatamente
- **Suspender tenant** — Colocar tenant em suspensão
- **Forçar logout** — Encerrar todas as sessões
- **Notificar** — Enviar notificação push para todos

---

## Módulo 18 — Backup e Recuperação

### 18.1 Considerações de Backup

- **Frequência** — Diário automático
- **Retenção** — 30 dias de backups
- **Criptografia** — Dados criptografados
- **Localização** — Armazenamento geograficamente redundante

### 18.2 Capacidades de Exportação

- **Exportar clientes** — CSV, Excel
- **Exportar agendamentos** — CSV, PDF
- **Exportar financeiro** — CSV, PDF
- **Exportar relatórios** — PDF, Excel
- **Exportar configurações** — JSON

### 18.3 Procedimentos de Recuperação

1. Identifique o tipo de dados perdidos
2. Verifique se há backup disponível
3. Solicite restauração ao suporte técnico
4. Valide os dados restaurados
5. Documente o incidente

> ⚠️ Restaurações devem ser solicitadas ao suporte técnico. Não tente restaurar dados manualmente.

---

## Módulo 19 — Multi-App Architecture

### 19.1 Variantes de Aplicação

O Sou.Manager suporta múltiplas variantes de aplicação:

| App Slug | Descrição |
|----------|-----------|
| `barber` | Barbearia (padrão) |
| `estetica` | Estética e beleza |
| `auto` | Oficina automotiva |
| `club` | Clube de assinatura |

### 19.2 Habilitação de Módulos por App

Cada variante pode ter módulos habilitados ou desabilitados:

- **barber** — Agenda, Clientes, Serviços, Financeiro, Equipe, ChefClub
- **auto** — Agenda, Clientes, Serviços, Financeiro, Equipe
- **club** — ChefClub, Clientes, Comunicação
- **estetica** — Agenda, Clientes, Serviços, Financeiro, Equipe

### 19.3 Roteamento de Schema

- **Schema compartilhado** — Tabelas centrais (profiles, tenants, staff)
- **Schema do app** — Tabelas de domínio (appointments, clients, transactions)
- **Isolamento** — Dados de cada app em schema separado (quando habilitado)

### 19.4 Isolamento por Tenant

- **RLS** — Row Level Security em todas as tabelas
- **Filtro por tenant_id** — Todas as queries filtram por tenant
- **RPCs seguras** — Funções com SECURITY DEFINER
- **Bypass de superadmin** — SuperAdmin pode acessar todos os tenants

---

## Checklist de Conclusão

- [ ] Login realizado com sucesso
- [ ] Configurações do sistema preenchidas
- [ ] Pelo menos 2 usuários criados
- [ ] Permissões configuradas para cada papel
- [ ] Profissionais cadastrados
- [ ] Serviços criados com categorias
- [ ] Produtos cadastrados com estoque
- [ ] Fornecedores cadastrados
- [ ] Agenda configurada com horários
- [ ] ChefClub configurado (se aplicável)
- [ ] Kiosk configurado (se aplicável)
- [ ] Políticas de segurança revisadas
- [ ] Logs de auditoria verificados
- [ ] Monitoramento configurado
- [ ] Observabilidade revisada
- [ ] Painel admin operacional
- [ ] Backup verificado
- [ ] Multi-app configurado (se aplicável)

---

## Perguntas Frequentes (FAQ)

### 1. Como redefinir a senha de um usuário?
Acesse **Admin → Usuários**, localize o usuário, clique em **editar** e selecione **Redefinir Senha**. O sistema enviará um e-mail de redefinição.

### 2. Como desativar um usuário sem perder seus dados?
Acesse **Admin → Usuários**, localize o usuário e clique em **Desativar**. Os dados são preservados e o usuário perde acesso imediatamente.

### 3. Como copiar permissões de um papel para outro?
Acesse **Admin → Permissões**, selecione o papel de origem, clique em **Copiar Permissões** e selecione o papel de destino.

### 4. Como configurar diferentes preços por profissional?
Acesse **Catálogo → Serviços**, edite o serviço, ative **Preço por profissional** e configure o valor para cada profissional.

### 5. Como verificar quem alterou uma configuração?
Acesse **Admin → Auditoria**, filtre por tabela ou ação desejada. O log mostra quem, quando e o que foi alterado.

### 6. Como configurar o modo manutenção?
Acesse **Admin → Configurações → Sistema** e ative o **Modo Manutenção**. Os usuários verão uma mensagem de manutenção.

### 7. Como adicionar uma nova loja?
Acesse **SuperAdmin → Empresas** e clique em **Nova Empresa**. Preencha os dados e configure as permissões.

### 8. Como exportar dados para planilha?
Acesse a seção desejada (Clientes, Agendamentos, etc.) e clique em **Exportar**. Escolha o formato (CSV, Excel, PDF).

### 9. Como configurar notificações por e-mail?
Acesse **Configurações → Notificações** e selecione quais eventos devem gerar notificação por e-mail.

### 10. Como bloquear um IP suspeito?
Acesse **Admin → Segurança → IPs Bloqueados** e adicione o IP à lista de bloqueio.

### 11. Como configurar a comissão de um profissional?
Acesse **Equipe → Profissionais**, edite o profissional e configure a **Taxa de Comissão** conforme o modelo desejado.

### 12. Como verificar o uso de armazenamento?
Acesse **Admin → Monitoramento → Armazenamento** para ver o espaço total, utilizado e detalhes por tipo de arquivo.

### 13. Como configurar o ChefClub?
Acesse **ChefClub → Planos**, crie um novo plano, configure créditos, benefícios e preços.

### 14. Como ativar o modo kiosk?
Acesse **Configurações → Kiosk**, crie um novo dispositivo, configure tema e timeout.

### 15. Como verificar alertas de segurança?
Acesse **Admin → Monitoramento → Alertas** para ver alertas ativos de segurança, uso e sistema.

### 16. Como alterar o horário de funcionamento?
Acesse **Configurações → Agenda → Horário de Funcionamento** e configure os dias e horários.

### 17. Como configurar detecção de conflitos?
Acesse **Configurações → Agenda → Conflitos** e configure buffer entre serviços e limites de sobreposição.

### 18. Como verificar logs de conexão?
Acesse **Admin → Monitoramento → Conexões** para ver conexões ativas, histórico e padrões de uso.

### 19. Como configurar webhook para alertas?
Acesse **Admin → Observabilidade → Webhooks** e adicione a URL do webhook com método e headers.

### 20. Como forçar logout de todos os usuários?
Acesse **SuperAdmin → Ações Rápidas → Forçar Logout** para encerrar todas as sessões ativas.

---

## Erros Mais Comuns

### 1. Usuário não consegue acessar o sistema
**Causa**: Conta pendente de aprovação ou desativada.
**Solução**: Verifique o status em **Admin → Usuários** e ative ou aprove a conta.

### 2. Permissões não são aplicadas imediatamente
**Causa**: Cache de permissões no navegador.
**Solução**: Solicite ao usuário fazer logout e login novamente, ou limpe o cache do navegador.

### 3. Serviço não aparece para agendamento
**Causa**: Serviço está inativo ou sem categoria.
**Solução**: Verifique o status em **Catálogo → Serviços** e ative o serviço.

### 4. Estoque não atualiza automaticamente
**Causa**: Movimentação não registrada.
**Solução**: Registre a entrada/saída manualmente em **Produtos → Estoque**.

### 5. Comissão calculada incorretamente
**Causa**: Taxa de comissão configurada incorretamente.
**Solução**: Verifique a configuração em **Equipe → Profissionais → Comissão**.

### 6. Alerta de conflito de agenda
**Causa**: Dois agendamentos no mesmo horário para o mesmo profissional.
**Solução**: Verifique a configuração de buffer e conflitos em **Configurações → Agenda**.

### 7. Usuário recebe erro de "Acesso Negado"
**Causa**: Permissão não atribuída ao papel do usuário.
**Solução**: Verifique as permissões em **Admin → Permissões** e adicione a permissão necessária.

### 8. Backup não está sendo executado
**Causa**: Configuração de backup desabilitada ou erro de conexão.
**Solução**: Verifique o status em **Admin → Monitoramento → Backups**.

### 9. Kiosk não conecta ao servidor
**Causa**: Dispositivo offline ou configuração incorreta.
**Solução**: Verifique a conexão de rede e a configuração em **Configurações → Kiosk**.

### 10. Logs de auditoria não aparecem
**Causa**: Filtro de data incorreto ou logs expirados.
**Solução**: Verifique os filtros em **Admin → Auditoria** e ajuste o período.

### 11. Notificações não são enviadas
**Causa**: Configuração de notificação desabilitada ou e-mail inválido.
**Solução**: Verifique **Configurações → Notificações** e o e-mail do usuário.

### 12. Fechamento diário calcula valor errado
**Causa**: Transação não registrada ou desconto aplicado incorretamente.
**Solução**: Revise as transações no dia em **Financeiro → Comandas**.

---

## Procedimentos Obrigatórios

### Ao Iniciar o Expediente
1. Verificar status do sistema em **Monitoramento**
2. Revisar alertas pendentes
3. Confirmar que todos os profissionais estão ativos
4. Verificar estoque de produtos críticos

### Ao Criar um Usuário
1. Verificar se o e-mail não está em uso
2. Atribuir o papel correto
3. Configurar permissões adequadamente
4. Enviar convite e confirmar ativação

### Ao Alterar Permissões
1. Documentar o motivo da alteração
2. Testar com o usuário afetado
3. Verificar se não há impacto em outros usuários
4. Registrar a alteração nos logs de auditoria

### Ao Fechar o Expediente
1. Revisar o fechamento diário
2. Verificar se há tickets pendentes
3. Confirmar que backups foram executados
4. Documentar ocorrências do dia

### Mensalmente
1. Revisar permissões de todos os usuários
2. Analisar logs de auditoria
3. Verificar uso de armazenamento
4. Revisar alertas de segurança
5. Atualizar documentação

---

## Boas Práticas

1. **Princípio do menor privilégio** — Apenas as permissões necessárias
2. **Revisão periódica** — Permissões devem ser revisadas mensalmente
3. **Documentação** — Todas as alterações devem ser documentadas
4. **Teste antes de aplicar** — Teste mudanças em ambiente de homologação quando possível
5. **Backup regular** — Verifique backups diariamente
6. **Monitoramento ativo** — Verifique alertas diariamente
7. **Senhas fortes** — Exija senhas complexas
8. **Autenticação de dois fatores** — Ative sempre que possível
9. **Sessões seguras** — Limite sessões simultâneas
10. **Logs de auditoria** — Revise semanalmente
11. **Comunicação** — Informe usuários sobre mudanças
12. **Treinamento** — Treine novos usuários adequadamente
13. **Contingência** — Tenha plano para falhas
14. **Atualizações** — Mantenha o sistema atualizado
15. **Compliance** — Siga LGPD e regulamentações

---

## Fluxos Operacionais

### Fluxo 1: Onboarding de Novo Profissional

```
1. Receber solicitação de cadastro
2. Verificar documentação
3. Criar usuário em Admin → Usuários
4. Atribuir papel (Barber/Receptionist)
5. Cadastrar profissional em Equipe → Profissionais
6. Configurar comissão
7. Configurar permissões
8. Enviar credenciais de acesso
9. Agendar treinamento inicial
10. Confirmar acesso e funcionamento
```

### Fluxo 2: Configuração de Novo Serviço

```
1. Receber solicitação do novo serviço
2. Verificar se há categoria adequada
3. Criar categoria se necessário
4. Criar serviço em Catálogo → Serviços
5. Configurar preço
6. Configurar duração
7. Vincular profissionais que realizam o serviço
8. Testar agendamento do serviço
9. Publicar e notificar equipe
```

### Fluxo 3: Configuração de Permissões

```
1. Identificar a necessidade do usuário
2. Verificar papel atual
3. Verificar permissões disponíveis
4. Selecionar permissões necessárias
5. Verificar permissões proibidas
6. Aplicar alterações
7. Testar com o usuário
8. Documentar alteração
9. Registrar em auditoria
```

### Fluxo 4: Resposta a Ticket de Suporte

```
1. Receber notificação de ticket
2. Classificar prioridade
3. Analisar problema
4. Buscar solução na base de conhecimento
5. Responder ao usuário
6. Verificar se problema foi resolvido
7. Documentar solução
8. Fechar ticket
9. Atualizar FAQ se necessário
```

### Fluxo 5: Revisão de Segurança Mensal

```
1. Acessar Admin → Auditoria
2. Filtrar último mês
3. Analisar logs de acesso
4. Verificar tentativas de login falhas
5. Revisar permissões de todos os usuários
6. Verificar usuários inativos
7. Revisar alertas de segurança
8. Atualizar políticas se necessário
9. Documentar achados
10. Apresentar relatório à gestão
```

---

## Cenários Reais

### Cenário 1: Novo Funcionário Precisa de Acesso

**Situação**: Um novo barbeiro foi contratado e precisa acessar o sistema.

**Procedimento**:
1. Criar usuário com e-mail institucional
2. Atribuir papel "Barber"
3. Cadastrar profissional com dados completos
4. Configurar comissão conforme contrato
5. Configurar permissões básicas de agenda
6. Enviar convite por e-mail
7. Orientar sobre primeiro acesso e navegação
8. Verificar se o acesso foi realizado

### Cenário 2: Preço de Serviço Precisa de Atualização

**Situação**: O preço do corte de barba aumentou de R$ 35 para R$ 45.

**Procedimento**:
1. Acessar Catálogo → Serviços
2. Localizar o serviço "Corte de Barba"
3. Editar o preço para R$ 45
4. Verificar se há preço promocional ativo
5. Atualizar preço promocional se necessário
6. Verificar se há pacotes que incluem o serviço
7. Atualizar pacotes se necessário
8. Notificar equipe sobre a alteração
9. Verificar se o novo preço está correto no app

### Cenário 3: Usuário Trancado (Lockout)

**Situação**: Um usuário errou a senha 5 vezes e foi bloqueado.

**Procedimento**:
1. Verificar logs de auditoria para confirmar tentativas
2. Verificar se há tentativas suspeitas
3. Desbloquear a conta em Admin → Usuários
4. Solicitar redefinição de senha
5. Orientar sobre política de senhas
6. Verificar se há acesso indevido
7. Documentar o incidente

### Cenário 4: Login Suspeito Detectado

**Situação**: Um login foi realizado de um IP desconhecido em horário incomum.

**Procedimento**:
1. Verificar logs de auditoria do login
2. Identificar IP, dispositivo e localização
3. Contatar o usuário para confirmar
4. Se não confirmado, desativar conta imediatamente
5. Forçar logout de todas as sessões
6. Solicitar redefinição de senha
7. Verificar se houve alterações indevidas
8. Documentar o incidente
9. Implementar medidas preventivas

### Cenário 5: Revogar Acesso Imediatamente

**Situação**: Um funcionário foi demitido e precisa perder acesso imediatamente.

**Procedimento**:
1. Acessar Admin → Usuários
2. Localizar o usuário
3. Clicar em "Desativar"
4. Verificar se há sessões ativas
5. Forçar logout se necessário
6. Verificar se há dados pessoais para exportar
7. Documentar a desativação
8. Verificar se há permissões especiais a revogar
9. Confirmar que o acesso foi bloqueado

### Cenário 6: Configurar Nova Localização de Barbearia

**Situação**: O estabelecimento vai abrir uma segunda unidade.

**Procedimento**:
1. Acessar SuperAdmin → Empresas (se SuperAdmin)
2. Criar novo tenant para a nova unidade
3. Configurar dados da nova unidade
4. Criar profissionais vinculados
5. Configurar serviços e preços
6. Configurar agenda e horários
7. Configurar permissões
8. Testar funcionamento
9. Documentar configurações
10. Treinar equipe da nova unidade

### Cenário 7: Migrar de Outro Sistema

**Situação**: O estabelecimento está migrando de outro software de agendamento.

**Procedimento**:
1. Exportar dados do sistema anterior (clientes, serviços, profissionais)
2. Formatar dados conforme template do SMG
3. Importar dados usando ferramenta de importação
4. Verificar integridade dos dados importados
5. Configurar permissões e papéis
6. Treinar equipe no novo sistema
7. Monitorar por 1 semana
8. Resolver problemas identificados
9. Desativar sistema anterior
10. Documentar processo de migração

### Cenário 8: Integrar com Ferramentas Externas

**Situação**: O estabelecimento quer integrar com WhatsApp Business ou sistema de pagamento.

**Procedimento**:
1. Verificar integrações disponíveis em Configurações
2. Configurar credenciais da API externa
3. Testar integração em ambiente de homologação
4. Configurar webhooks se necessário
5. Testar fluxo completo
6. Monitorar por 1 semana
7. Resolver problemas identificados
8. Documentar configuração

### Cenário 9: Lidar com Incidente de Segurança

**Situação**: Um dado sensível pode ter sido acessado indevidamente.

**Procedimento**:
1. Identificar o escopo do incidente
2. Coletar evidências (logs de auditoria)
3. Conter o incidente (desativar contas comprometidas)
4. Avaliar impacto
5. Notificar usuários afetados (se aplicável)
6. Implementar correções
7. Documentar o incidente
8. Revisar políticas de segurança
9. Apresentar relatório à gestão
10. Implementar melhorias preventivas

### Cenário 10: Revisão Mensal de Auditoria

**Situação**: É dia 1 de o mês e precisa-se fazer a revisão mensal de auditoria.

**Procedimento**:
1. Acessar Admin → Auditoria
2. Filtrar período do mês anterior
3. Analisar padrões de acesso
4. Verificar alterações em configurações
5. Verificar permissões modificadas
6. Verificar transações financeiras
7. Identificar anomalias
8. Documentar achados
9. Apresentar relatório à gestão
10. Implementar melhorias identificadas

### Cenário 11: Configurar Fechamento Diário

**Situação**: O estabelecimento precisa configurar o fechamento diário automático.

**Procedimento**:
1. Acessar Configurações → Financeiro
2. Configurar horário de fechamento
3. Definir que dados serão incluídos
4. Configurar destinatários do relatório
5. Testar fechamento em ambiente de homologação
6. Configurar backup automático
7. Documentar configuração
8. Treinar equipe sobre o processo

---

## Checklist Operacional Diário

### Manhã (Ao Iniciar o Expediente)
- [ ] Verificar status do sistema
- [ ] Revisar alertas pendentes
- [ ] Confirmar profissionais ativos
- [ ] Verificar estoque crítico
- [ ] Revisar agendamentos do dia
- [ ] Confirmar que notificações estão funcionando

### Durante o Dia
- [ ] Monitorar tickets de suporte
- [ ] Verificar erros no sistema
- [ ] Responder solicitações de acesso
- [ ] Monitorar alertas de segurança
- [ ] Verificar integrações

### Noite (Ao Encerrar o Expediente)
- [ ] Revisar fechamento diário
- [ ] Verificar tickets pendentes
- [ ] Confirmar backups executados
- [ ] Documentar ocorrências
- [ ] Verificar sessões ativas

---

## Critérios para Aprovação

Para ser aprovado no treinamento de Administrador do Sistema, o candidato deve:

1. **Completar todos os 19 módulos** com nota mínima de 70% em cada
2. **Executar os exercícios práticos** com sucesso
3. **Demonstrar compreensão** dos conceitos de segurança e permissões
4. **Ser capaz de configurar** o sistema do zero
5. **Resolver cenários reais** apresentados pelo instrutor
6. **Compreender a hierarquia** de papéis e permissões
7. **Ser capaz de monitorar** o sistema e responder a alertas
8. **Demonstrar conhecimento** de boas práticas de segurança

---

## Exercícios Práticos

### Exercício 1: Configuração Inicial Completa

**Objetivo**: Configurar o sistema do zero para uma nova barbearia.

**Instruções**:
1. Criar uma nova conta de administrador
2. Preencher todas as informações do negócio (PJ com CNPJ)
3. Configurar endereço completo
4. Configurar preferências de notificação
5. Habilitar todos os módulos relevantes
6. Criar 3 categorias de serviço
7. Criar 5 serviços com preços e durações diferentes
8. Cadastrar 3 profissionais com diferentes comissões
9. Configurar horário de funcionamento
10. Testar agendamento de um serviço

**Critério de aprovação**: Sistema configurado e funcional, com agendamento realizado com sucesso.

### Exercício 2: Gestão de Usuários e Permissões

**Objetivo**: Gerenciar usuários e configurar permissões granulares.

**Instruções**:
1. Criar 4 usuários com papéis diferentes (Manager, 2 Barbers, 1 Receptionist)
2. Configurar permissões personalizadas para cada papel
3. Copiar permissões de um preset para um papel
4. Desativar um usuário e verificar que perdeu acesso
5. Reativar o usuário
6. Verificar logs de auditoria das alterações realizadas
7. Exportar relatório de permissões

**Critério de aprovação**: Todos os usuários criados com permissões corretas, logs de auditoria consistentes.

### Exercício 3: Configuração de Segurança

**Objetivo**: Configurar e testar medidas de segurança.

**Instruções**:
1. Configurar política de senhas (mínimo 10 caracteres)
2. Verificar sessões ativas
3. Forçar logout de um usuário específico
4. Verificar logs de acesso de um período
5. Identificar tentativas de login falhas
6. Configurar alerta de acesso suspeito
7. Documentar procedimento de resposta a incidentes

**Critério de aprovação**: Política de segurança configurada, logs revisados, procedimento documentado.

### Exercício 4: Gestão de Estoque e Produtos

**Objetivo**: Gerenciar produtos, estoque e fornecedores.

**Instruções**:
1. Cadastrar 3 fornecedores
2. Criar 10 produtos com diferentes categorias
3. Configurar preços de custo e venda
4. Definir estoque mínimo para cada produto
5. Registrar entrada de 50 unidades de um produto
6. Verificar que estoque foi atualizado
7. Simular venda e verificar baixa no estoque
8. Verificar se alerta de estoque mínimo foi gerado

**Critério de aprovação**: Produtos cadastrados, estoque movimentado corretamente, alertas funcionando.

### Exercício 5: Monitoramento e Resposta a Alertas

**Objetivo**: Monitorar o sistema e responder a alertas.

**Instruções**:
1. Acessar dashboard de observabilidade
2. Identificar métricas de latência
3. Verificar regras de alerta configuradas
4. Simular um cenário de erro (se possível)
5. Verificar como o alerta é disparado
6. Configurar webhook para notificação
7. Revisar logs estruturados
8. Documentar processo de resposta a alertas

**Critério de aprovação**: Dashboard compreendido, alertas configurados, processo documentado.

### Exercício 6: Cenário Completo de Onboarding

**Objetivo**: Executar fluxo completo de onboarding de novo profissional.

**Instruções**:
1. Receber "solicitação" de novo barbeiro
2. Criar usuário com papel Barber
3. Cadastrar profissional com dados completos
4. Configurar comissão de 40%
5. Configurar permissões básicas de agenda
6. Criar 3 serviços específicos para o profissional
7. Configurar horário de trabalho do profissional
8. Testar agendamento com o novo profissional
9. Verificar que comissão está configurada
10. Documentar todo o processo

**Critério de aprovação**: Profissional totalmente configurado e funcional, com agendamento e comissão corretos.
