# Exercícios Práticos — SMG

Guia completo de exercícios práticos para capacitação no sistema SMG (Sou.Manager), o SaaS de gestão para barbearias.

---

## Como Usar Este Guia

### Formato dos Exercícios

Cada exercício segue uma estrutura padronizada:

| Elemento | Descrição |
|----------|-----------|
| **Objetivo** | O que o exercício ensina a fazer |
| **Pré-requisitos** | Condições necessárias antes de iniciar |
| **Passos** | Sequência detalhada de ações no sistema |
| **Resultado esperado** | O que deve acontecer após concluir |
| **Critérios de avaliação** | Itens verificáveis para aprovar o exercício |

### Níveis de Dificuldade

- ⚪ **Básico** — Exercício introdutório, sem dependências
- ⚪⚪ **Intermediário** — Requer conhecimento prévio de funcionalidades
- ⚪⚪⚪ **Avançado** — Integra múltiplas áreas do sistema

### Ambiente

- Todos os exercícios utilizam o **modo demo local** (`localhost`) ou ambiente de **treinamento** com dados não reais.
- Login padrão do modo demo: `teste@soumanager.local` / `12345678`
- Perfis disponíveis conforme o exercício: `barbeiro`, `recepcionista`, `gerente`, `admin`

### Critérios Gerais de Avaliação

- Concluiu o exercício sem ajuda externa
- Executou os passos na ordem correta
- Identificou e corrigiu eventuais erros
- Compreendeu o propósito de cada ação
- Finalizou no tempo estipulado (quando aplicável)

---

## Exercícios — Barbeiro

Perfil focado no atendimento direto ao cliente, agenda e comandas.

---

### Exercício B01: Primeiro Acesso

**Nível:** ⚪ Básico
**Tempo estimado:** 5 minutos

**Objetivo:** Realizar login pela primeira vez e explorar a interface principal do sistema.

**Pré-requisitos:**
- Ambiente demo configurado e rodando (`npm run dev`)
- Credenciais de barbeiro fornecidas pelo instrutor

**Passos:**

1. Abra o navegador e acesse `http://localhost:3000`
2. Localize o campo de e-mail e digite o e-mail do barbeiro fornecido
3. Digite a senha fornecida
4. Clique no botão **Entrar**
5. Observe a tela inicial — identifique a **agenda do dia** no centro
6. Localize o menu lateral esquerdo com as opções disponíveis
7. Passe o mouse sobre cada ícone do menu e leia o nome da funcionalidade
8. Clique em **Agenda** para visualizar o dia atual
9. Clique no ícone de perfil (canto superior direito) e verifique os dados do usuário logado
10. Clique em **Sair** no menu do perfil e confirme o logout

**Resultado esperado:**
- Login realizado com sucesso
- Interface exibe a agenda do dia
- Menu lateral funcional com todas as opções visíveis
- Logout executado corretamente

**Critérios de avaliação:**
- [ ] Conseguiu fazer login sem ajuda
- [ ] Identificou corretamente os elementos da tela inicial
- [ ] Navegou entre pelo menos 3 telas diferentes
- [ ] Realizou logout com sucesso
- [ ] Descreveu o propósito das funcionalidades do menu

---

### Exercício B02: Agenda do Dia

**Nível:** ⚪ Básico
**Tempo estimado:** 8 minutos

**Objetivo:** Visualizar, entender e interagir com a agenda de atendimentos do dia.

**Pré-requisitos:**
- Usuário logado como barbeiro
- Agenda contém ao menos 2 agendamentos para o dia (criar previamente se necessário)

**Passos:**

1. Acesse a tela de **Agenda** pelo menu lateral
2. Observe a visualização do dia atual — os horários são exibidos em ordem crescente
3. Identifique cada agendamento presente: cliente, horário, serviço e status
4. Clique em um agendamento com status **Confirmado**
5. Leia os detalhes exibidos no modal: nome do cliente, telefone, serviço, duração estimada
6. Feche o modal clicando no **X** ou fora dele
7. Altere a visualização de **Dia** para **Semana** usando o seletor no topo
8. Navegue entre os dias usando as setas `‹` e `›`
9. Volte para a visualização **Dia**
10. Utilize o botão **Hoje** para centralizar a agenda na data atual

**Resultado esperado:**
- Agendamentos visíveis com dados completos
- Modal de detalhes funcional
- Alternância entre visualizações dia/semana
- Navegação entre datas funcionando

**Critérios de avaliação:**
- [ ] Visualizou corretamente a agenda do dia
- [ ] Abriu e interpretou os detalhes de um agendamento
- [ ] Alternou entre visualizações (dia/semana)
- [ ] Navegou entre datas diferentes
- [ ] Retornou ao dia atual usando o botão **Hoje**

---

### Exercício B03: Atendimento Completo

**Nível:** ⚪⚪ Intermediário
**Tempo estimado:** 15 minutos

**Objetivo:** Executar o ciclo completo de um atendimento, desde a recepção do cliente até o checkout.

**Pré-requisitos:**
- Usuário logado como barbeiro
- Cliente com agendamento para o horário atual
- Serviços cadastrados no sistema

**Passos:**

**Parte 1 — Iniciar Atendimento**

1. Acesse a **Agenda** e localize o agendamento do cliente
2. Observe o status atual do agendamento (deve estar como **Confirmado** ou **Aguardando**)
3. Clique no agendamento e selecione a opção **Iniciar Atendimento**
4. Confirme a ação na janela de diálogo
5. Verifique que o status mudou para **Em Atendimento**

**Parte 2 — Registrar Serviços**

6. Com a comanda aberta, acesse a aba **Serviços**
7. Clique em **Adicionar Serviço**
8. Selecione o serviço prestado na lista (ex: Corte Masculino)
9. Confirme a inclusão
10. Repita os passos 7 a 9 para adicionar um segundo serviço, se houver

**Parte 3 — Finalizar e Checkout**

11. Clique em **Finalizar Atendimento**
12. O sistema exibe o resumo da comanda com os serviços e valor total
13. Selecione a forma de pagamento: **Dinheiro**, **Cartão** ou **Pix**
14. Confirme o checkout
15. Verifique o status final: **Concluído** na agenda e **Fechada** na comanda

**Resultado esperado:**
- Agendamento progride por todos os status: Confirmado → Em Atendimento → Concluído
- Comanda criada com os serviços registrados
- Checkout processado com sucesso
- Valor total calculado corretamente

**Critérios de avaliação:**
- [ ] Iniciou o atendimento corretamente
- [ ] Alterou o status do agendamento
- [ ] Adicionou ao menos um serviço à comanda
- [ ] Finalizou o atendimento e registrou o checkout
- [ ] O valor total da comanda corresponde à soma dos serviços
- [ ] Verificou que o agendamento aparece como **Concluído**

---

### Exercício B04: Venda de Produto

**Nível:** ⚪⚪ Intermediário
**Tempo estimado:** 10 minutos

**Objetivo:** Adicionar a venda de um produto durante o atendimento ao cliente.

**Pré-requisitos:**
- Atendimento em andamento (comanda aberta)
- Produtos cadastrados no sistema com estoque disponível

**Passos:**

1. Acesse a comanda do atendimento em andamento
2. Localize a aba **Produtos** dentro da comanda
3. Clique em **Adicionar Produto**
4. Na lista de produtos disponíveis, localize um produto (ex: Pomada Modeladora)
5. Selecione o produto e defina a **quantidade** como `1`
6. Clique em **Adicionar à Comanda**
7. Repita para um segundo produto com quantidade `2`
8. Confira o subtotal de cada produto na lista da comanda
9. Verifique que o valor total da comanda foi atualizado (serviços + produtos)
10. Finalize o checkout normalmente

**Resultado esperado:**
- Produtos adicionados à comanda
- Valor total reflete soma de serviços e produtos
- Checkout processado com sucesso
- Estoque do produto reduzido automaticamente

**Critérios de avaliação:**
- [ ] Acessou a aba de produtos corretamente
- [ ] Adicionou ao menos um produto à comanda
- [ ] Validou que o total inclui produtos + serviços
- [ ] Finalizou o checkout com produtos na comanda
- [ ] Verificou a redução no estoque do produto

---

### Exercício B05: Comanda com Desconto

**Nível:** ⚪⚪ Intermediário
**Tempo estimado:** 10 minutos

**Objetivo:** Aplicar um desconto a uma comanda antes de finalizar o checkout.

**Pré-requisitos:**
- Atendimento em andamento (comanda aberta)
- Ao menos um serviço registrado na comanda

**Passos:**

1. Acesse a comanda com serviços já registrados
2. Localize o campo ou botão **Desconto** no resumo da comanda
3. Clique em **Aplicar Desconto**
4. Escolha o tipo de desconto:
   - **Percentual** — informe `10` para 10%
   - Ou **Valor Fixo** — informe `15,00` para R$ 15,00 de desconto
5. Confirme a aplicação do desconto
6. Verifique que o valor total foi recalculado com o desconto
7. Confira o valor do desconto exibido separadamente no resumo
8. Finalize o checkout normalmente
9. Repita o exercício com o outro tipo de desconto (percentual/valor fixo)

**Resultado esperado:**
- Desconto aplicado corretamente
- Valor total recalculado
- Desconto visível no resumo da comanda
- Checkout concluído com valor correto

**Critérios de avaliação:**
- [ ] Identificou onde aplicar o desconto na comanda
- [ ] Aplicou desconto percentual corretamente (cálculo manual confere)
- [ ] Aplicou desconto em valor fixo corretamente
- [ ] O valor total final reflete o desconto aplicado
- [ ] Concluiu o checkout com desconto

---

### Exercício B06: Fechamento Individual

**Nível:** ⚪ Intermediário
**Tempo estimado:** 10 minutos

**Objetivo:** Realizar o fechamento individual (caixa do barbeiro) ao final do expediente.

**Pré-requisitos:**
- Barbeiro realizou ao menos 3 atendimentos no dia
- Todos os atendimentos estão com checkout concluído

**Passos:**

1. No menu lateral, acesse **Fechamento** ou **Meu Caixa**
2. Visualize o resumo do dia: total de atendimentos, valor bruto, comissões
3. Confira a lista de atendimentos realizados
4. Verifique o valor total de vendas de produtos
5. Confira o valor total de descontos concedidos
6. Clique em **Iniciar Fechamento**
7. Confira os valores exibidos na tela de conferência
8. Adicione uma observação se desejar (ex: "Dia normal de trabalho")
9. Clique em **Confirmar Fechamento**
10. O sistema exibe um resumo final do fechamento

**Resultado esperado:**
- Fechamento individual processado
- Valores de vendas e comissões corretos
- Histórico de fechamentos atualizado

**Critérios de avaliação:**
- [ ] Acessou a tela de fechamento individual
- [ ] Verificou todos os valores antes de confirmar
- [ ] Confirmou o fechamento com sucesso
- [ ] Os valores batem com a soma dos atendimentos do dia
- [ ] Compreendeu o cálculo de comissão exibido

---

### Exercício B07: Modo Offline

**Nível:** ⚪⚪⚪ Avançado
**Tempo estimado:** 15 minutos

**Objetivo:** Simular uma queda de conexão e realizar atendimentos offline, com sincronização posterior.

**Pré-requisitos:**
- Sistema rodando em modo demo
- Conhecimento básico de rede local

**Passos:**

**Parte 1 — Preparação**

1. Verifique que o sistema está conectado (indicador verde no canto superior)
2. Anote os agendamentos e serviços disponíveis
3. Em um cliente com agendamento, abra a comanda

**Parte 2 — Operação Offline**

4. Simule a desconexão: desabilite a rede do computador ou pare o servidor local
5. Observe a interface — o sistema deve exibir um indicador **Modo Offline** (geralmente um aviso amarelo/vermelho)
6. Registre um atendimento normalmente (adicione serviço, produtos)
7. Verifique que os dados estão sendo armazenados localmente
8. Finalize o atendimento e realize o checkout
9. O sistema deve exibir uma mensagem: **"Dados salvos localmente — serão sincronizados quando a conexão for restaurada"**

**Parte 3 — Sincronização**

10. Restabeleça a conexão (religue a rede ou reinicie o servidor)
11. O sistema deve exibir o indicador de sincronização: **Sincronizando...**
12. Aguarde a mensagem **Sincronização concluída**
13. Acesse a agenda e verifique que o atendimento consta como **Concluído**
14. Acesse o fechamento individual e confira que os valores offline foram incorporados

**Resultado esperado:**
- Sistema opera offline sem perda de funcionalidades principais
- Dados salvos localmente durante a desconexão
- Sincronização automática ao restaurar conexão
- Nenhum dado perdido após sincronização

**Critérios de avaliação:**
- [ ] Identificou o indicador de modo offline
- [ ] Realizou atendimento completo sem conexão
- [ ] Os dados offline foram preservados
- [ ] A sincronização ocorreu automaticamente ao reconectar
- [ ] Verificou a integridade dos dados pós-sincronização
- [ ] Nenhum dado foi perdido ou duplicado

---

## Exercícios — Recepcionista

Perfil focado em atendimento ao público, agendamentos e operações de caixa.

---

### Exercício R01: Cadastro de Cliente

**Nível:** ⚪ Básico
**Tempo estimado:** 8 minutos

**Objetivo:** Cadastrar um novo cliente no sistema com todas as informações obrigatórias.

**Pré-requisitos:**
- Usuário logado como recepcionista
- Dados de um cliente fictício em mãos

**Passos:**

1. Acesse **Clientes** pelo menu lateral
2. Clique no botão **Novo Cliente** (ou **+** )
3. Preencha os campos obrigatórios:
   - **Nome completo:** Ex: "João Silva Santos"
   - **Telefone:** Ex: "(11) 99999-8888"
   - **E-mail:** Ex: "joao.silva@email.com" (opcional mas recomendado)
4. Preencha campos opcionais:
   - **Data de nascimento:** Ex: "15/03/1990"
   - **Observações:** Ex: "Cliente prefere cortes modernos"
5. Clique em **Salvar**
6. O sistema exibe uma mensagem de sucesso: **"Cliente cadastrado com sucesso"**
7. Localize o cliente recém-criado na lista de clientes (use a busca pelo nome)

**Resultado esperado:**
- Novo cliente visível na lista
- Todos os dados preenchidos aparecem no perfil
- Cliente pode ser encontrado pela busca

**Critérios de avaliação:**
- [ ] Preencheu todos os campos obrigatórios
- [ ] Salvou o cadastro com sucesso
- [ ] Localizou o cliente na lista usando a busca
- [ ] Abriu o perfil do cliente e conferiu os dados
- [ ] Sabe diferenciar campos obrigatórios de opcionais

---

### Exercício R02: Agendamento

**Nível:** ⚪ Básico
**Tempo estimado:** 10 minutos

**Objetivo:** Agendar um horário para um cliente existente com um barbeiro específico.

**Pré-requisitos:**
- Cliente cadastrado no sistema
- Barbeiros cadastrados no sistema
- Serviços disponíveis

**Passos:**

1. Acesse **Agenda** pelo menu lateral
2. Clique no botão **Novo Agendamento** (ou **+ Agendar**)
3. No formulário de agendamento:
   - **Cliente:** Comece a digitar o nome do cliente e selecione-o na lista
   - **Serviço:** Selecione "Corte Masculino" na lista de serviços
   - **Barbeiro:** Selecione um barbeiro disponível
   - **Data:** Mantenha a data de hoje
   - **Horário:** Selecione "10:00"
4. Clique em **Salvar**
5. O sistema exibe a mensagem **"Agendamento criado com sucesso"**
6. Verifique o agendamento na agenda do dia, no horário selecionado
7. Clique no agendamento para ver os detalhes

**Resultado esperado:**
- Agendamento visível na agenda no horário correto
- Dados do cliente, serviço e barbeiro corretos nos detalhes
- Status inicial: **Confirmado** ou **Aguardando**

**Critérios de avaliação:**
- [ ] Selecionou o cliente corretamente na busca
- [ ] Escolheu um serviço da lista
- [ ] Atribuiu o barbeiro corretamente
- [ ] Definiu data e horário adequados
- [ ] Verificou o agendamento na agenda
- [ ] Confirmou que os detalhes estão corretos

---

### Exercício R03: Reagendamento

**Nível:** ⚪ Intermediário
**Tempo estimado:** 8 minutos

**Objetivo:** Alterar a data e/ou horário de um agendamento existente.

**Pré-requisitos:**
- Agendamento existente para um cliente
- Agenda do barbeiro com disponibilidade no novo horário

**Passos:**

1. Acesse **Agenda** e localize o agendamento que será alterado
2. Clique sobre o agendamento para abrir os detalhes
3. Selecione a opção **Reagendar**
4. No formulário de reagendamento:
   - **Nova data:** Selecione uma data para 2 dias após a data original
   - **Novo horário:** Selecione um horário disponível (ex: 14:00)
   - **Manter barbeiro:** Deixe a opção marcada
5. Clique em **Confirmar Reagendamento**
6. O sistema exibe a mensagem **"Agendamento reagendado com sucesso"**
7. Verifique que o agendamento não está mais no horário antigo
8. Navegue até a nova data e confirme que o agendamento está correto
9. Nos detalhes do agendamento, verifique o histórico de alterações

**Resultado esperado:**
- Agendamento movido para a nova data/horário
- Histórico de alterações preservado
- Notificação ao barbeiro (se aplicável)

**Critérios de avaliação:**
- [ ] Acessou a opção de reagendamento
- [ ] Alterou data e horário com sucesso
- [ ] Verificou que o agendamento antigo não existe mais
- [ ] Confirmou o agendamento na nova data
- [ ] Visualizou o histórico de alterações

---

### Exercício R04: Cancelamento

**Nível:** ⚪ Básico
**Tempo estimado:** 5 minutos

**Objetivo:** Cancelar um agendamento registrando o motivo do cancelamento.

**Pré-requisitos:**
- Agendamento existente
- Motivo do cancelamento definido

**Passos:**

1. Acesse **Agenda** e localize o agendamento a ser cancelado
2. Clique sobre o agendamento para abrir os detalhes
3. Selecione a opção **Cancelar Agendamento**
4. Na janela de confirmação, selecione o motivo do cancelamento:
   - **Cliente desistiu**
   - **Cliente não compareceu**
   - **Barbeiro indisponível**
   - **Outro** (com campo de observação)
5. Escolha **Cliente desistiu** como motivo
6. Adicione uma observação: "Cliente ligou informando imprevisto"
7. Clique em **Confirmar Cancelamento**
8. Verifique que o agendamento mudou para status **Cancelado** na agenda
9. Os agendamentos cancelados devem aparecer com uma indicação visual (ex: texto tachado, cor cinza)

**Resultado esperado:**
- Agendamento com status **Cancelado**
- Motivo registrado no histórico
- Horário liberado para novos agendamentos

**Critérios de avaliação:**
- [ ] Selecionou o motivo do cancelamento
- [ ] Adicionou observação relevante
- [ ] Confirmou o cancelamento
- [ ] Verificou o status alterado na agenda
- [ ] Verificou que o horário foi liberado

---

### Exercício R05: Checkout Completo

**Nível:** ⚪⚪ Intermediário
**Tempo estimado:** 15 minutos

**Objetivo:** Processar o checkout completo de uma comanda com serviços, produtos e descontos.

**Pré-requisitos:**
- Atendimento concluído (comanda com serviços)
- Produtos disponíveis para venda

**Passos:**

**Parte 1 — Revisão da Comanda**

1. Acesse a comanda do atendimento concluído
2. Revise os serviços registrados
3. Adicione um produto à comanda (se não houver)
4. Confira o valor total antes dos descontos

**Parte 2 — Descontos e Pagamento**

5. Aplique um desconto de **10%** sobre o total
6. Verifique o valor recalculado
7. Na seção de pagamento, selecione a forma de pagamento (ex: **Cartão de Débito**)
8. Confirme o checkout

**Parte 3 — Comprovante**

9. Após o checkout, o sistema exibe o resumo do pagamento
10. Clique em **Imprimir Comprovante** ou **Enviar Comprovante**
11. Informe o e-mail do cliente (ex: "cliente@email.com")
12. Confirme o envio

**Resultado esperado:**
- Checkout concluído com todos os itens
- Desconto aplicado corretamente
- Comprovante impresso/enviado

**Critérios de avaliação:**
- [ ] Revisou a comanda antes de finalizar
- [ ] Aplicou desconto corretamente
- [ ] Selecionou forma de pagamento adequada
- [ ] Confirmou o checkout com sucesso
- [ ] Gerou ou enviou o comprovante
- [ ] O total final está correto (serviços + produtos - desconto)

---

### Exercício R06: Lista de Espera

**Nível:** ⚪ Intermediário
**Tempo estimado:** 10 minutos

**Objetivo:** Gerenciar a lista de espera para clientes sem agendamento.

**Pré-requisitos:**
- Usuário logado como recepcionista
- Ao menos 2 barbeiros com disponibilidade

**Passos:**

1. Acesse **Lista de Espera** pelo menu lateral
2. Clique em **Adicionar à Lista**
3. Preencha:
   - **Cliente:** Selecione um cliente existente (ou cadastre um novo)
   - **Serviço desejado:** "Corte Masculino"
   - **Barbeiro preferido:** (opcional) selecione um barbeiro
   - **Observação:** "Cliente aguardando vaga"
4. Clique em **Adicionar**
5. O cliente aparece na lista de espera com status **Aguardando**
6. Simule a liberação de um barbeiro — clique em **Chamar Cliente** ao lado do nome
7. Confirme que o cliente foi notificado
8. Após o cliente ser atendido, clique em **Atender** na lista de espera
9. O sistema cria automaticamente um agendamento para o horário atual
10. Verifique o agendamento na agenda

**Resultado esperado:**
- Cliente adicionado à lista de espera
- Cliente chamado quando barbeiro disponível
- Agendamento criado automaticamente ao chamar

**Critérios de avaliação:**
- [ ] Adicionou cliente à lista de espera corretamente
- [ ] Visualizou a lista com status **Aguardando**
- [ ] Chamou o cliente corretamente
- [ ] O agendamento foi criado automaticamente
- [ ] Removeu o cliente da lista após o atendimento

---

### Exercício R07: Venda com Múltiplos Pagamentos

**Nível:** ⚪⚪ Intermediário
**Tempo estimado:** 12 minutos

**Objetivo:** Processar um checkout com formas de pagamento divididas (split payment).

**Pré-requisitos:**
- Comanda com valor mínimo de R$ 50,00
- Serviços e/ou produtos registrados

**Passos:**

1. Acesse a comanda a ser finalizada
2. No momento do checkout, localize a opção **Dividir Pagamento**
3. Clique em **Adicionar Forma de Pagamento**
4. Configure a primeira parcela:
   - **Forma:** Dinheiro
   - **Valor:** R$ 30,00
5. Clique em **Adicionar Forma de Pagamento** novamente
6. Configure a segunda parcela:
   - **Forma:** Cartão de Crédito
   - **Valor:** R$ 30,00 (ou valor restante)
7. Verifique que a soma das parcelas cobre o valor total da comanda
8. Se houver diferença, ajuste os valores até que o total seja igual ao valor da comanda
9. Confirme o checkout
10. O comprovante deve listar as duas formas de pagamento separadamente

**Resultado esperado:**
- Pagamento dividido em duas formas
- Soma das parcelas igual ao valor total
- Comprovante com detalhamento das formas de pagamento
- Checkout processado com sucesso

**Critérios de avaliação:**
- [ ] Identificou a opção de dividir pagamento
- [ ] Adicionou duas formas de pagamento diferentes
- [ ] Os valores somam exatamente o total da comanda
- [ ] Finalizou o checkout com sucesso
- [ ] O comprovante reflete as duas formas de pagamento
- [ ] Repetiu o exercício com 3 formas de pagamento (opcional)

---

## Exercícios — Gerente

Perfil focado na administração da barbearia, configurações, equipe e relatórios.

---

### Exercício G01: Configuração Inicial

**Nível:** ⚪ Básico
**Tempo estimado:** 10 minutos

**Objetivo:** Configurar as informações básicas do negócio no sistema.

**Pré-requisitos:**
- Usuário logado como gerente
- Primeiro acesso ao ambiente (ou ambiente resetado)

**Passos:**

1. Acesse **Configurações** → **Barbearia** pelo menu lateral
2. Na aba **Dados da Barbearia**:
   - **Nome fantasia:** "Barbearia do Gerente"
   - **Razão social:** "Barbearia do Gerente Ltda."
   - **CNPJ:** "00.000.000/0001-00"
   - **Telefone:** "(11) 3333-4444"
   - **WhatsApp:** "(11) 99999-0000"
   - **Endereço:** "Rua Exemplo, 123 — Centro"
3. Na aba **Horário de Funcionamento**:
   - **Segunda a Sexta:** 09:00 — 19:00
   - **Sábado:** 09:00 — 17:00
   - **Domingo:** Fechado
4. Na aba **Preferências**:
   - **Moeda:** R$
   - **Fuso horário:** America/São_Paulo
   - **Duração padrão do agendamento:** 30 minutos
5. Clique em **Salvar Configurações**
6. Acesse novamente a tela e confirme que os dados foram persistidos

**Resultado esperado:**
- Informações da barbearia salvas
- Horário de funcionamento configurado
- Preferências aplicadas nos agendamentos

**Critérios de avaliação:**
- [ ] Preencheu todos os campos obrigatórios
- [ ] Configurou horário de funcionamento corretamente
- [ ] Definiu a duração padrão dos agendamentos
- [ ] Salvou e verificou a persistência dos dados
- [ ] Compreendeu o impacto de cada configuração

---

### Exercício G02: Cadastro de Serviço

**Nível:** ⚪ Intermediário
**Tempo estimado:** 10 minutos

**Objetivo:** Criar um novo serviço com preço, duração e comissão.

**Pré-requisitos:**
- Acesso como gerente
- Serviços existentes para referência

**Passos:**

1. Acesse **Serviços** pelo menu lateral
2. Clique em **Novo Serviço**
3. Preencha os campos:
   - **Nome:** "Barba Tradicional"
   - **Descrição:** "Aparação de barba com tesoura e máquina, incluisse hidratação"
   - **Categoria:** "Barba"
   - **Duração:** 30 minutos
   - **Valor:** R$ 45,00
   - **Comissão (%)** : 50
4. Na seção **Comissão por profissional**, mantenha a comissão padrão
5. Clique em **Salvar**
6. Crie um segundo serviço:
   - **Nome:** "Corte Degradê"
   - **Duração:** 45 minutos
   - **Valor:** R$ 70,00
   - **Comissão (%)** : 60
7. Salve e verifique ambos os serviços na lista
8. Edite o serviço "Barba Tradicional" e altere o valor para R$ 50,00
9. Salve a alteração

**Resultado esperado:**
- Serviços criados corretamente
- Valores, durações e comissões configurados
- Serviço editado com sucesso
- Serviços visíveis no momento do agendamento

**Critérios de avaliação:**
- [ ] Criou serviço com dados completos
- [ ] Configurou duração e valor corretamente
- [ ] Definiu a comissão do profissional
- [ ] Salvou e localizou o serviço na lista
- [ ] Editou o serviço com sucesso
- [ ] Verificou que o serviço aparece no agendamento

---

### Exercício G03: Gestão de Equipe

**Nível:** ⚪⚪ Intermediário
**Tempo estimado:** 12 minutos

**Objetivo:** Adicionar um novo profissional à equipe e configurar seu perfil.

**Pré-requisitos:**
- Acesso como gerente
- E-mail do novo profissional disponível

**Passos:**

**Parte 1 — Convidar Profissional**

1. Acesse **Equipe** pelo menu lateral
2. Clique em **Convidar Profissional**
3. Preencha:
   - **Nome completo:** "Carlos Barbeiro"
   - **E-mail:** "carlos@barbearia.com"
   - **Telefone:** "(11) 97777-8888"
   - **Função:** Barbeiro
4. Clique em **Enviar Convite**
5. O sistema exibe a mensagem **"Convite enviado com sucesso"**

**Parte 2 — Configurar Profissional**

6. Na lista da equipe, localize Carlos (status: **Pendente** ou **Ativo**)
7. Clique sobre o nome para abrir a configuração
8. Na aba **Serviços**, marque os serviços que Carlos pode realizar:
   - Corte Masculino ✅
   - Barba Tradicional ✅
   - Corte Degradê ✅
9. Na aba **Comissões**, ajuste a comissão de Carlos para **55%** em todos os serviços
10. Na aba **Horários**, defina o horário de trabalho:
    - **Segunda a Sexta:** 10:00 — 18:00
    - **Sábado:** 09:00 — 14:00
11. Clique em **Salvar**

**Resultado esperado:**
- Novo profissional na lista da equipe
- Serviços associados ao profissional
- Comissão personalizada configurada
- Horário de trabalho definido

**Critérios de avaliação:**
- [ ] Enviou convite com dados corretos
- [ ] Associou os serviços que o profissional pode realizar
- [ ] Configurou comissão personalizada
- [ ] Definiu horários de trabalho
- [ ] Verificou que o profissional aparece na agenda

---

### Exercício G04: Fechamento de Caixa

**Nível:** ⚪⚪ Avançado
**Tempo estimado:** 15 minutos

**Objetivo:** Realizar o fechamento de caixa geral da barbearia, consolidando todos os profissionais.

**Pré-requisitos:**
- Múltiplos atendimentos concluídos no dia
- Ao menos 2 barbeiros com atendimentos
- Ao menos 1 fechamento individual concluído

**Passos:**

**Parte 1 — Revisão do Dia**

1. Acesse **Financeiro** → **Fechamento de Caixa**
2. Visualize o resumo geral do dia:
   - Total de atendimentos
   - Faturamento bruto (serviços + produtos)
   - Total de descontos concedidos
   - Total de comissões
   - Valor líquido
3. Confira a relação de profissionais e seus totais individuais

**Parte 2 — Conferência**

4. Clique em **Detalhar por Profissional**
5. Selecione um barbeiro e confira:
   - Quantidade de atendimentos
   - Valor total de serviços
   - Valor total de produtos
   - Comissão calculada
6. Repita a conferência para o segundo barbeiro

**Parte 3 — Fechamento**

7. Clique em **Iniciar Fechamento de Caixa**
8. No formulário:
   - **Total em dinheiro:** Informe o valor físico em caixa
   - **Total em cartão:** Informe o valor das máquinas de cartão
   - **Total em Pix:** Informe o valor recebido via Pix
9. Verifique se os valores informados batem com o sistema
10. Clique em **Confirmar Fechamento**
11. Acesse **Histórico de Fechamentos** e confirme que o fechamento foi registrado

**Resultado esperado:**
- Fechamento de caixa geral concluído
- Valores por profissional corretos
- Totais por forma de pagamento conferidos
- Histórico de fechamento disponível

**Critérios de avaliação:**
- [ ] Acessou o resumo geral do dia
- [ ] Conferiu os totais por profissional
- [ ] Verificou a coerência entre fechamentos individuais e geral
- [ ] Informou os valores físicos de cada forma de pagamento
- [ ] Confirmou o fechamento com sucesso
- [ ] Localizou o fechamento no histórico

---

### Exercício G05: Relatório Semanal

**Nível:** ⚪ Intermediário
**Tempo estimado:** 10 minutos

**Objetivo:** Gerar e interpretar um relatório semanal de desempenho.

**Pré-requisitos:**
- Dados de atendimentos dos últimos 7 dias
- Usuário logado como gerente

**Passos:**

1. Acesse **Relatórios** pelo menu lateral
2. Selecione o tipo de relatório: **Desempenho Semanal**
3. Defina o período: **Últimos 7 dias**
4. Clique em **Gerar Relatório**
5. Analise as seções do relatório:
   - **Faturamento:** Total do período, média por dia
   - **Atendimentos:** Quantidade total, média por dia
   - **Ticket médio:** Faturamento / total de atendimentos
   - **Profissionais:** Desempenho individual (atendimentos, faturamento, comissão)
   - **Serviços mais realizados:** Ranking de serviços
   - **Produtos mais vendidos:** Ranking de produtos
6. Clique em **Exportar** e selecione **CSV**
7. Salve o arquivo na máquina local
8. Abra o arquivo e confirme que os dados estão coerentes com o relatório na tela

**Resultado esperado:**
- Relatório semanal gerado com dados corretos
- Interpretação das métricas possível
- Exportação em CSV realizada

**Critérios de avaliação:**
- [ ] Selecionou o período correto
- [ ] Interpretou corretamente o faturamento e ticket médio
- [ ] Identificou o profissional com melhor desempenho
- [ ] Identificou o serviço mais realizado
- [ ] Exportou o relatório em CSV
- [ ] Validou os dados exportados

---

### Exercício G06: Configuração de Permissões

**Nível:** ⚪⚪⚪ Avançado
**Tempo estimado:** 12 minutos

**Objetivo:** Ajustar permissões de acesso para diferentes funções na barbearia.

**Pré-requisitos:**
- Acesso como gerente
- Múltiplos perfis de usuário criados

**Passos:**

1. Acesse **Configurações** → **Permissões**
2. Visualize a lista de funções (roles): Gerente, Barbeiro, Recepcionista, Financeiro
3. Selecione a função **Recepcionista**
4. Analise as permissões atuais agrupadas por módulo:
   - **Agenda:** Visualizar, Criar, Editar, Cancelar
   - **Clientes:** Visualizar, Criar, Editar
   - **Financeiro:** Visualizar (apenas)
   - **Relatórios:** Nenhum
5. Altere a permissão **Financeiro → Visualizar** para **Nenhum** (recepcionista não vê valores)
6. Adicione permissão **Relatórios → Visualizar Resumo do Dia**
7. Clique em **Salvar**
8. Teste: faça login como recepcionista e verifique que a tela Financeiro não está mais acessível
9. Volte às permissões e restaure as configurações originais

**Resultado esperado:**
- Permissões alteradas e salvas
- Efeito visível ao logar com o perfil modificado
- Restauração bem-sucedida

**Critérios de avaliação:**
- [ ] Navegou até a tela de permissões
- [ ] Identificou as permissões atuais de cada função
- [ ] Alterou permissões corretamente
- [ ] Salvou e verificou o efeito das alterações
- [ ] Restaurou as permissões originais

---

### Exercício G07: Criação de Promoção

**Nível:** ⚪⚪ Intermediário
**Tempo estimado:** 10 minutos

**Objetivo:** Criar uma promoção com desconto para atrair clientes.

**Pré-requisitos:**
- Serviços cadastrados
- Acesso como gerente

**Passos:**

1. Acesse **Promoções** pelo menu lateral
2. Clique em **Nova Promoção**
3. Configure a promoção:
   - **Nome:** "Promoção Corte + Barba"
   - **Descrição:** "Corte Masculino + Barba Tradicional por preço especial"
   - **Período de validade:** Data de hoje até 30 dias
   - **Tipo de desconto:** Percentual
   - **Valor do desconto:** 20%
   - **Aplicar sobre:** Combo de serviços
4. Selecione os serviços incluídos:
   - Corte Masculino ✅
   - Barba Tradicional ✅
5. Defina o valor do combo: R$ 60,00 (soma original: R$ 75,00 — desconto de 20%)
6. Clique em **Ativar Promoção**
7. Verifique que a promoção aparece como **Ativa** na lista
8. Crie um agendamento para testar: o combo deve aparecer como opção

**Resultado esperado:**
- Promoção criada e ativa
- Combo disponível no agendamento
- Valor com desconto aplicado corretamente

**Critérios de avaliação:**
- [ ] Configurou nome e descrição da promoção
- [ ] Definiu período de validade
- [ ] Selecionou os serviços do combo
- [ ] O preço do combo reflete o desconto corretamente
- [ ] Ativou a promoção
- [ ] Verificou a promoção no fluxo de agendamento

---

### Exercício G08: Gestão de Estoque

**Nível:** ⚪⚪ Intermediário
**Tempo estimado:** 15 minutos

**Objetivo:** Gerenciar o estoque de produtos, incluindo entrada, saída e ajuste.

**Pré-requisitos:**
- Produtos cadastrados
- Acesso como gerente

**Passos:**

**Parte 1 — Entrada de Estoque**

1. Acesse **Estoque** pelo menu lateral
2. Clique em **Nova Entrada**
3. Selecione o produto: "Pomada Modeladora"
4. Informe a quantidade: 10 unidades
5. Informe o valor de custo unitário: R$ 12,00
6. Selecione o fornecedor: "Fornecedor Padrão" (crie se necessário)
7. Clique em **Confirmar Entrada**
8. Verifique que o estoque do produto foi atualizado

**Parte 2 — Ajuste Manual**

9. Localize o produto "Pomada Modeladora" na lista
10. Clique em **Ajustar Estoque**
11. Informe o motivo: "Ajuste de inventário"
12. Defina a quantidade correta: 8 unidades (ajuste de -2)
13. Confirme o ajuste

**Parte 3 — Relatório de Estoque**

14. Acesse **Relatórios** → **Estoque**
15. Gere o relatório de produtos com estoque baixo (menos de 5 unidades)
16. Exporte o relatório

**Resultado esperado:**
- Entrada de estoque registrada
- Quantidade atualizada corretamente
- Ajuste manual registrado com motivo
- Relatório de estoque baixo gerado

**Critérios de avaliação:**
- [ ] Registrou entrada de estoque com dados corretos
- [ ] Verificou a atualização da quantidade
- [ ] Realizou ajuste manual com justificativa
- [ ] Gerou relatório de estoque baixo
- [ ] Exportou o relatório com sucesso
- [ ] O histórico mostra as movimentações

---

## Exercícios — Financeiro

Perfil focado em movimentações financeiras, fechamento de caixa e auditoria.

---

### Exercício F01: Fluxo de Caixa

**Nível:** ⚪ Básico
**Tempo estimado:** 8 minutos

**Objetivo:** Registrar uma entrada e uma saída financeira no fluxo de caixa.

**Pré-requisitos:**
- Usuário logado como financeiro
- Categorias financeiras cadastradas

**Passos:**

**Parte 1 — Registrar Despesa**

1. Acesse **Financeiro** → **Fluxo de Caixa**
2. Clique em **Nova Movimentação**
3. Selecione **Tipo:** Saída
4. Preencha:
   - **Categoria:** "Contas a Pagar" (crie se necessário)
   - **Descrição:** "Pagamento de aluguel"
   - **Valor:** R$ 2.500,00
   - **Data:** Hoje
   - **Forma de pagamento:** Transferência Bancária
5. Clique em **Salvar**
6. Verifique a movimentação na lista do fluxo de caixa

**Parte 2 — Registrar Receita**

7. Clique em **Nova Movimentação**
8. Selecione **Tipo:** Entrada
9. Preencha:
   - **Categoria:** "Receita de Serviços"
   - **Descrição:** "Recebimento de convênio"
   - **Valor:** R$ 800,00
   - **Data:** Hoje
10. Salve e verifique na lista

**Parte 3 — Saldo**

11. Observe o **saldo do dia** no topo da tela
12. O saldo deve refletir: saldo anterior + entradas - saídas

**Resultado esperado:**
- Despesa registrada no fluxo de caixa
- Receita registrada no fluxo de caixa
- Saldo do dia calculado corretamente

**Critérios de avaliação:**
- [ ] Registrou uma saída com todos os dados
- [ ] Registrou uma entrada com todos os dados
- [ ] As movimentações aparecem na lista
- [ ] O saldo do dia reflete as movimentações
- [ ] Selecionou categorias adequadas

---

### Exercício F02: Fechamento com Conferência

**Nível:** ⚪⚪ Avançado
**Tempo estimado:** 20 minutos

**Objetivo:** Realizar o fechamento de caixa com conferência física dos valores.

**Pré-requisitos:**
- Atendimentos concluídos no dia
- Meios de pagamento variados nos atendimentos
- Acesso como financeiro

**Passos:**

**Parte 1 — Preparação**

1. Acesse **Financeiro** → **Fechamento de Caixa**
2. Anote os valores esperados por forma de pagamento:
   - Total em dinheiro: R$ XXX,XX
   - Total em cartão de crédito: R$ XXX,XX
   - Total em cartão de débito: R$ XXX,XX
   - Total em Pix: R$ XXX,XX

**Parte 2 — Conferência**

3. Para cada forma de pagamento, informe o valor **contado fisicamente**:
   - Se houver diferença, o sistema deve exibir um alerta
   - Exemplo: sistema espera R$ 300,00 em dinheiro, você informa R$ 295,00
   - O sistema exibe: **"Diferença de R$ 5,00 para menos em Dinheiro"**
4. Adicione uma justificativa para a diferença: "Troco inicial não contabilizado"

**Parte 3 — Finalização**

5. Revise o resumo da conferência
6. Clique em **Confirmar Fechamento com Conferência**
7. O sistema registra o fechamento com as diferenças apontadas
8. Acesse **Histórico** e verifique o fechamento com a observação de diferença

**Resultado esperado:**
- Fechamento com conferência realizado
- Diferenças apontadas e justificadas
- Histórico registra valores esperados vs. informados

**Critérios de avaliação:**
- [ ] Anotou os valores esperados do sistema
- [ ] Informou valores físicos com diferença proposital
- [ ] O sistema alertou sobre a diferença
- [ ] Justificou a diferença adequadamente
- [ ] Confirmou o fechamento com sucesso
- [ ] Verificou o histórico com as diferenças

---

### Exercício F03: Processamento de Reversão

**Nível:** ⚪⚪⚪ Avançado
**Tempo estimado:** 15 minutos

**Objetivo:** Reverter uma transação processada e restaurar o estado anterior.

**Pré-requisitos:**
- Checkout concluído (comanda fechada)
- Acesso como financeiro

**Passos:**

**Parte 1 — Identificar Transação**

1. Acesse **Financeiro** → **Transações**
2. Localize a transação a ser revertida (use filtros: data, valor, cliente)
3. Abra os detalhes da transação
4. Verifique o status: **Concluída**

**Parte 2 — Reversão**

5. Clique em **Reverter Transação**
6. O sistema exibe os efeitos da reversão:
   - Serviços serão estornados
   - Estoque dos produtos será restaurado
   - Comissões serão recalculadas
   - Valor será estornado
7. Selecione o motivo da reversão:
   - **"Cliente solicitou estorno"**
8. Adicione observação: "Cliente não ficou satisfeito com o serviço"
9. Confirme a reversão

**Parte 3 — Verificação**

10. Verifique que a comanda agora tem status **Reversão Processada** ou **Cancelada**
11. Confira que o estoque dos produtos foi restaurado
12. Acesse **Relatórios** → **Comissões** e veja se a comissão foi ajustada
13. Verifique que a transação original aparece com status **Revertida**

**Resultado esperado:**
- Transação revertida com sucesso
- Estoque restaurado
- Comissão recalculada
- Histórico de reversão registrado

**Critérios de avaliação:**
- [ ] Localizou a transação correta
- [ ] Leu os efeitos da reversão antes de confirmar
- [ ] Selecionou motivo e observação adequados
- [ ] Confirmou a reversão com sucesso
- [ ] Verificou o estorno no estoque
- [ ] Verificou o recálculo de comissão
- [ ] Comprovante de reversão gerado

---

### Exercício F04: Cálculo de Folha

**Nível:** ⚪⚪⚪ Avançado
**Tempo estimado:** 20 minutos

**Objetivo:** Calcular a folha de pagamento dos profissionais com base nas comissões.

**Pré-requisitos:**
- Múltiplos atendimentos concluídos no período
- Profissionais com comissões configuradas
- Acesso como financeiro

**Passos:**

**Parte 1 — Período de Cálculo**

1. Acesse **Financeiro** → **Folha de Pagamento**
2. Selecione o período: **Últimos 30 dias**
3. Clique em **Calcular**

**Parte 2 — Revisão Individual**

4. Para cada profissional, revise:
   - Total de atendimentos no período
   - Faturamento bruto gerado
   - Percentual de comissão
   - Valor da comissão calculada
   - Descontos (se houver)
   - Valor líquido
5. Selecione um profissional e clique em **Detalhar**
6. Verifique a lista de atendimentos que compõem a comissão
7. Confira o cálculo manual de um atendimento: valor serviço × percentual comissão

**Parte 3 — Ajustes**

8. Se houver valores incorretos, use a opção **Ajustar Comissão**
9. Informe o valor correto e o motivo: "Ajuste manual aprovado pelo gerente"
10. Após revisão, clique em **Fechar Folha do Período**
11. A folha agora consta como **Fechada**

**Resultado esperado:**
- Folha de pagamento calculada
- Comissões individuais detalhadas
- Cálculo manual confere com o sistema
- Folha fechada e registrada

**Critérios de avaliação:**
- [ ] Selecionou o período correto
- [ ] Revisou as comissões de cada profissional
- [ ] Verificou o cálculo manual de ao menos um atendimento
- [ ] O cálculo do sistema confere com o manual
- [ ] Realizou ajuste se necessário
- [ ] Fechou a folha do período

---

### Exercício F05: Auditoria de Comissões

**Nível:** ⚪⚪⚪ Avançado
**Tempo estimado:** 20 minutos

**Objetivo:** Auditar as comissões calculadas em um período, identificando divergências.

**Pré-requisitos:**
- Folha de pagamento calculada
- Acesso como financeiro

**Passos:**

**Parte 1 — Extrair Dados**

1. Acesse **Relatórios** → **Auditoria de Comissões**
2. Selecione o período: **Últimos 30 dias**
3. Gere o relatório detalhado

**Parte 2 — Verificação**

4. O relatório exibe:
   - Lista de todos os atendimentos por profissional
   - Valor do serviço
   - Percentual de comissão aplicado
   - Valor da comissão calculada
   - Data do atendimento
   - Checkout vinculado
5. Selecione 3 atendimentos aleatórios
6. Para cada um, calcule manualmente a comissão: `valor_serviço × percentual / 100`
7. Confira se o valor calculado pelo sistema é igual ao seu cálculo manual

**Parte 3 — Divergências**

8. Se encontrar divergência, registre:
   - Clique em **Apontar Divergência**
   - Informe o valor esperado
   - Informe o valor calculado pelo sistema
   - Adicione observação
   - Selecione gravidade: **Baixa**, **Média** ou **Crítica**
9. Exporte o relatório de auditoria

**Resultado esperado:**
- Relatório de auditoria gerado
- Cálculos manuais conferem com o sistema
- Divergências registradas (se houver)
- Relatório exportado

**Critérios de avaliação:**
- [ ] Gerou o relatório de auditoria de comissões
- [ ] Calculou manualmente 3 comissões
- [ ] Os cálculos manuais conferem com o sistema
- [ ] Registrou divergência corretamente (se aplicável)
- [ ] Exportou o relatório
- [ ] Compreendeu o impacto de comissões incorretas

---

### Exercício F06: Investigação de Inconsistência

**Nível:** ⚪⚪⚪ Avançado
**Tempo estimado:** 25 minutos

**Objetivo:** Investigar e resolver uma inconsistência financeira simulada.

**Pré-requisitos:**
- Dados de múltiplos dias no sistema
- Acesso como financeiro

**Passos:**

**Parte 1 — Cenário**

O gerente reportou que o fechamento de caixa de ontem está com uma diferença de R$ 35,00 a mais no sistema em relação ao dinheiro físico.

**Parte 2 — Investigação**

1. Acesse **Financeiro** → **Histórico de Fechamentos**
2. Localize o fechamento de ontem e abra os detalhes
3. Anote o valor total em dinheiro esperado pelo sistema
4. Acesse **Transações** e filtre por ontem, forma de pagamento = **Dinheiro**
5. Liste todas as transações em dinheiro de ontem
6. Some manualmente os valores
7. Confira se a soma bate com o valor do fechamento
8. Se bater, o problema pode estar em uma movimentação avulsa ou ajuste manual

**Parte 3 — Movimentações Avulsas**

9. Acesse **Fluxo de Caixa** e filtre por ontem
10. Verifique se há movimentações avulsas em dinheiro
11. Identifique uma entrada de R$ 35,00 sem descrição clara
12. Abra a movimentação e veja os detalhes

**Parte 4 — Resolução**

13. Edite a movimentação para adicionar descrição: "Troco extra deixado pelo barbeiro"
14. Registre uma observação no fechamento de caixa: "Diferença justificada — troco extra não registrado anteriormente"
15. Exporte o relatório de auditoria do dia

**Resultado esperado:**
- Inconsistência identificada
- Causa raiz encontrada (movimentação sem descrição)
- Resolução documentada
- Histórico atualizado

**Critérios de avaliação:**
- [ ] Localizou o fechamento com diferença
- [ ] Usou filtros para isolar transações em dinheiro
- [ ] Somou manualmente e comparou com o sistema
- [ ] Identificou a movimentação avulsa como causa
- [ ] Corrigiu a descrição da movimentação
- [ ] Documentou a resolução no histórico
- [ ] Compreendeu o fluxo de investigação

---

## Exercícios — Administrador

Perfil com acesso total ao sistema, focado em configurações avançadas, segurança e monitoramento.

---

### Exercício A01: Criação de Usuário

**Nível:** ⚪ Básico
**Tempo estimado:** 8 minutos

**Objetivo:** Criar um novo usuário administrativo no sistema.

**Pré-requisitos:**
- Usuário logado como administrador
- E-mail válido para o novo usuário

**Passos:**

1. Acesse **Administração** → **Usuários**
2. Clique em **Criar Usuário**
3. Preencha:
   - **Nome completo:** "Admin Treinamento"
   - **E-mail:** "admin.treinamento@soumanager.com"
   - **Função:** Administrador
4. Escolha o método de criação:
   - **Convidar por e-mail** (o usuário recebe um link para definir a senha)
5. Clique em **Criar**
6. O sistema exibe: **"Usuário criado com sucesso. Convite enviado para admin.treinamento@soumanager.com"**
7. Verifique que o novo usuário aparece na lista com status **Pendente**
8. Altere o status para **Ativo** manualmente (simulação de aceite de convite)
9. Edite o usuário e adicione um telefone de contato

**Resultado esperado:**
- Usuário criado com sucesso
- Convite enviado
- Usuário visível na lista
- Dados editáveis

**Critérios de avaliação:**
- [ ] Preencheu todos os campos obrigatórios
- [ ] Selecionou a função correta
- [ ] Criou o usuário com sucesso
- [ ] Verificou o status na lista
- [ ] Editou dados adicionais
- [ ] Compreendeu o fluxo de convite vs. criação direta

---

### Exercício A02: Configuração de Permissões

**Nível:** ⚪⚪ Avançado
**Tempo estimado:** 12 minutos

**Objetivo:** Configurar permissões granulares para perfis específicos.

**Pré-requisitos:**
- Acesso como administrador
- Perfis de usuário criados

**Passos:**

**Parte 1 — Criar Perfil Customizado**

1. Acesse **Administração** → **Perfis de Acesso**
2. Clique em **Novo Perfil**
3. Configure:
   - **Nome:** "Barbeiro Sênior"
   - **Descrição:** "Barbeiro com acesso a relatórios individuais"
4. Defina as permissões:

   | Módulo | Permissão |
   |--------|-----------|
   | Agenda | Visualizar, Criar, Editar |
   | Atendimento | Visualizar, Criar, Editar, Finalizar |
   | Comissão | Visualizar próprias |
   | Relatórios | Visualizar resumo individual |
   | Produtos | Visualizar, Vender |
   | Financeiro | Nenhum |
   | Configurações | Nenhum |

5. Clique em **Salvar**

**Parte 2 — Atribuir Perfil**

6. Acesse **Usuários**
7. Selecione um barbeiro existente
8. Na aba **Perfil de Acesso**, altere de **Barbeiro** para **Barbeiro Sênior**
9. Salve

**Parte 3 — Testar**

10. Faça logout e login como o barbeiro que recebeu o perfil **Barbeiro Sênior**
11. Verifique que o menu **Relatórios** está acessível
12. Verifique que o menu **Financeiro** não está acessível

**Resultado esperado:**
- Perfil customizado criado
- Permissões granulares configuradas
- Perfil atribuído a um usuário
- Efeito verificado no login

**Critérios de avaliação:**
- [ ] Criou perfil com permissões específicas
- [ ] Atribuiu o perfil a um usuário
- [ ] Testou o login com o novo perfil
- [ ] As permissões configuradas foram aplicadas
- [ ] Restaurou o perfil original (passo opcional de limpeza)

---

### Exercício A03: Monitoramento do Sistema

**Nível:** ⚪⚪ Intermediário
**Tempo estimado:** 10 minutos

**Objetivo:** Utilizar o dashboard de monitoramento e observabilidade.

**Pré-requisitos:**
- Acesso como administrador
- Sistema com atividade recente

**Passos:**

1. Acesse **Monitoramento** pelo menu lateral (rota `/#/observability`)
2. Visualize o painel **Overview**:
   - Total de operações realizadas
   - Taxa de sucesso
   - Taxa de erro
   - Alertas ativos
3. Clique na aba **Checkout**
4. Analise os gráficos de latência (mínimo, médio, p95, máximo)
5. Clique na aba **Alertas**
6. Identifique os alertas ativos (se houver)
7. Visualize a tabela de regras de alerta na parte inferior
8. Clique em uma regra para ver detalhes (threshold, severidade, histórico)
9. Acesse a aba **Logs**
10. Filtre por **severidade = error** e veja os erros recentes
11. Clique em um log para expandir e ver detalhes completos

**Resultado esperado:**
- Painel de monitoramento carregado
- Métricas visíveis e compreensíveis
- Alertas e logs acessíveis

**Critérios de avaliação:**
- [ ] Acessou o dashboard de observabilidade
- [ ] Leu e interpretou as métricas do overview
- [ ] Visualizou gráficos de latência por domínio
- [ ] Identificou alertas ativos e suas regras
- [ ] Filtrou e analisou logs de erro
- [ ] Compreendeu a função de cada seção do dashboard

---

### Exercício A04: Resposta a Chamado

**Nível:** ⚪⚪⚪ Avançado
**Tempo estimado:** 20 minutos

**Objetivo:** Simular o atendimento a um chamado de suporte técnico.

**Pré-requisitos:**
- Acesso como administrador
- Conhecimento da estrutura do sistema

**Passos:**

**Parte 1 — Cenário do Chamado**

> "Recepcionista reporta que, ao tentar criar um agendamento para o cliente 'João Silva', o sistema não encontra o cliente na busca, mesmo ele estando cadastrado."

**Parte 2 — Investigação**

1. Acesse **Clientes** e busque por "João Silva"
2. Verifique que o cliente existe (crie se não existir)
3. Tente reproduzir o erro: vá em **Agenda** → **Novo Agendamento**
4. Na busca de cliente, digite "João Silva"
5. Observe o comportamento — o cliente aparece ou não?
6. Se aparecer, o chamado pode ser erro do usuário (treinamento)
7. Se não aparecer, investigue: o cliente pode estar inativo

**Parte 3 — Resolução**

8. Se o cliente estiver **Inativo**, vá em **Clientes** e edite
9. Altere o status para **Ativo**
10. Volte ao agendamento e confirme que o cliente agora aparece
11. Adicione uma observação no perfil do cliente: "Reativado por admin — chamado #1234"
12. Acesse **Monitoramento** → **Logs** e verifique se há logs de erro relacionados à busca
13. Documente a resolução em **Administração** → **Histórico de Chamados**:
    - **Chamado:** "Cliente não aparece na busca de agendamento"
    - **Solução:** "Cliente estava com status inativo. Reativado e orientado recepcionista sobre verificação de status."
    - **Categoria:** "Treinamento / Configuração"
    - **Status:** Resolvido

**Resultado esperado:**
- Causa do chamado identificada
- Resolução aplicada
- Chamado documentado

**Critérios de avaliação:**
- [ ] Reproduziu o erro reportado
- [ ] Identificou a causa raiz
- [ ] Aplicou a correção necessária
- [ ] Verificou que o erro foi resolvido
- [ ] Documentou o chamado no sistema
- [ ] Classificou corretamente a categoria do chamado

---

### Exercício A05: Revisão de Segurança

**Nível:** ⚪⚪⚪ Avançado
**Tempo estimado:** 20 minutos

**Objetivo:** Realizar uma revisão de segurança básica no sistema.

**Pré-requisitos:**
- Acesso como administrador
- Múltiplos usuários ativos

**Passos:**

**Parte 1 — Auditoria de Usuários**

1. Acesse **Administração** → **Usuários**
2. Liste todos os usuários ativos
3. Verifique se há usuários com mais de 90 dias sem login
4. Identifique usuários com função incompatível com suas atividades
5. Anote os usuários que devem ser revisados

**Parte 2 — Auditoria de Perfis**

6. Acesse **Administração** → **Perfis de Acesso**
7. Revise cada perfil:
   - As permissões são compatíveis com a função?
   - Há permissões excessivas (ex: financeiro para barbeiro)?
8. Ajuste permissões se necessário

**Parte 3 — Sessões Ativas**

9. Acesse **Administração** → **Sessões Ativas**
10. Identifique sessões abertas
11. Se houver sessões suspeitas, clique em **Revogar Sessão**

**Parte 4 — Relatório**

12. Acesse **Relatórios** → **Segurança**
13. Gere o relatório de auditoria de segurança
14. Exporte o relatório

**Resultado esperado:**
- Usuários inativos ou suspeitos identificados
- Permissões revisadas e ajustadas
- Sessões ativas auditadas
- Relatório de segurança exportado

**Critérios de avaliação:**
- [ ] Listou usuários e verificou atividade recente
- [ ] Identificou potenciais riscos de segurança
- [ ] Revisou permissões de cada perfil
- [ ] Verificou sessões ativas
- [ ] Gerou e exportou relatório de auditoria
- [ ] Documentou as ações tomadas

---

### Exercício A06: Configuração de Kiosk

**Nível:** ⚪⚪⚪ Avançado
**Tempo estimado:** 15 minutos

**Objetivo:** Configurar um dispositivo no modo kiosk (autoatendimento) para clientes.

**Pré-requisitos:**
- Acesso como administrador
- Dispositivo ou navegador para simular o kiosk

**Passos:**

**Parte 1 — Ativar Modo Kiosk**

1. Acesse **Administração** → **Kiosk / Autoatendimento**
2. Clique em **Configurar Novo Kiosk**
3. Configure:
   - **Nome do dispositivo:** "Kiosk Entrada"
   - **Localização física:** "Hall de entrada"
   - **Modo de operação:** **Autoatendimento**
   - **Tempo de inatividade para reset:** 30 segundos
4. Selecione as funcionalidades disponíveis:
   - Lista de serviços ✅
   - Agendamento rápido ✅
   - Check-in de agendamento ✅
   - Visualização de preços ✅
5. Clique em **Salvar**

**Parte 2 — Personalizar**

6. Na aba **Aparência**:
   - **Tema:** Escuro
   - **Logotipo:** Faça upload de uma imagem (use qualquer imagem de teste)
   - **Mensagem de boas-vindas:** "Bem-vindo à Barbearia!"
7. Salve as alterações

**Parte 3 — Testar**

8. Copie a **URL do kiosk** fornecida pelo sistema
9. Abra uma nova aba anônima/privada no navegador com a URL do kiosk
10. Verifique que a interface de autoatendimento é exibida:
   - Não há menu lateral
   - Botões grandes e visíveis
   - Opções limitadas às configuradas
11. Teste o fluxo: consulte serviços disponíveis
12. Feche a aba e verifique se o kiosk volta à tela inicial (timeout de 30s)

**Resultado esperado:**
- Kiosk configurado com funcionalidades limitadas
- Aparência personalizada
- Interface de autoatendimento funcional
- Timeout e reset funcionando

**Critérios de avaliação:**
- [ ] Criou configuração de kiosk com dados corretos
- [ ] Personalizou tema e logotipo
- [ ] Acessou a URL do kiosk em aba anônima
- [ ] A interface exibe apenas as funcionalidades selecionadas
- [ ] Testou o timeout e reset automático
- [ ] Compreendeu as opções de segurança do modo kiosk

---

## Apêndices

### A. Resumo de Perfis e Exercícios

| Perfil | Exercícios | Módulos Cobertos |
|--------|-----------|------------------|
| Barbeiro | B01 a B07 | Agenda, Atendimento, Comanda, Produtos, Fechamento, Offline |
| Recepcionista | R01 a R07 | Clientes, Agenda, Checkout, Lista de Espera, Pagamentos |
| Gerente | G01 a G08 | Configurações, Serviços, Equipe, Fechamento, Relatórios, Promoções, Estoque |
| Financeiro | F01 a F06 | Fluxo de Caixa, Fechamento, Reversão, Folha, Auditoria |
| Administrador | A01 a A06 | Usuários, Permissões, Monitoramento, Suporte, Segurança, Kiosk |

### B. Sequência Sugerida para Treinamento

| Dia | Conteúdo | Duração Estimada |
|-----|----------|------------------|
| 1 | B01, B02, R01, R02 — Fundamentos | 2h |
| 2 | B03, B04, B05, R03, R04 — Atendimento e Agendamento | 3h |
| 3 | B06, R05, R06, R07 — Checkout e Caixa | 3h |
| 4 | G01, G02, G03, G08 — Gestão de Negócio | 3h |
| 5 | G04, G05, G06, G07 — Gerência Avançada | 3h |
| 6 | F01, F02, F03 — Financeiro Básico | 3h |
| 7 | F04, F05, F06 — Auditoria e Folha | 3h |
| 8 | A01, A02, A03 — Administração | 2h |
| 9 | A04, A05, A06 — Suporte e Segurança | 2h |
| 10 | B07 + Revisão Geral + Avaliação Final | 3h |

### C. Glossário

| Termo | Definição |
|-------|-----------|
| **Agendamento** | Compromisso de um cliente com um barbeiro em data/horário específicos |
| **Comanda** | Registro detalhado dos serviços e produtos consumidos em um atendimento |
| **Checkout** | Finalização da comanda com registro de pagamento |
| **Comissão** | Percentual do valor do serviço devido ao profissional |
| **Desconto** | Redução aplicada sobre o valor total da comanda |
| **Fechamento de Caixa** | Consolidação financeira do dia, geral por forma de pagamento |
| **Fluxo de Caixa** | Registro de todas as entradas e saídas financeiras |
| **Folha de Pagamento** | Cálculo das comissões e valores devidos aos profissionais |
| **Kiosk** | Modo de autoatendimento para clientes realizarem check-in e consultas |
| **Lista de Espera** | Fila de clientes aguardando vaga sem agendamento prévio |
| **Modo Offline** | Operação do sistema sem conexão com a internet |
| **Reversão** | Estorno completo de uma transação financeira |
| **Ticket Médio** | Valor médio gasto por cliente por atendimento |
| **Split Payment** | Divisão do pagamento em múltiplas formas ou parcelas |
