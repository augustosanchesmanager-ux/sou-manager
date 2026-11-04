# Artigos de Solução de Problemas & Troubleshooting — SMG Barber

> **SMG Barber** · *The Barbershop Intelligence*<br />
> **Masterbrand Tech:** SMG Intelligence<br />
> **Padrão Técnico:** `Sintoma` $\rightarrow$ `Causa Provável` $\rightarrow$ `Resolução Imediata` $\rightarrow$ `Prevenção`<br />
> **Última Atualização:** 2026-11-04 · Versão 1.0

---

## Índice Rápido dos Artigos

- [1. Agenda & Horários](#1-agenda--horários)
  - [1.1 Conflito de Horário ou Cadeira Sobreposta](#11-conflito-de-horário-ou-cadeira-sobreposta)
  - [1.2 Bloqueio de Ausência / Intervalo não Exibido](#12-bloqueio-de-ausência--intervalo-não-exibido)
- [2. Atendimento & Comandas](#2-atendimento--comandas)
  - [2.1 Comanda Bloqueada em Atendimento na Bancada](#21-comanda-bloqueada-em-atendimento-na-bancada)
  - [2.2 Comanda Sem Atribuição de Barbeiro Principal](#22-comanda-sem-atribuição-de-barbeiro-principal)
  - [2.3 Item ou Serviço Lançado Incorretamente na Comanda](#23-item-ou-serviço-lançado-incorretamente-na-comanda)
- [3. Pagamentos & Checkout](#3-pagamentos--checkout)
  - [3.1 Divergência entre Maquininha (POS) e Status da Comanda](#31-divergência-entre-maquininha-pos-e-status-da-comanda)
  - [3.2 Pagamento Dividido com Saldo Residual Incorreto](#32-pagamento-dividido-com-saldo-residual-incorreto)
  - [3.3 Troco em Dinheiro com Falta de Cédulas no Caixa](#33-troco-em-dinheiro-com-falta-de-cédulas-no-caixa)
- [4. Caixa & Fechamento Diário](#4-caixa--fechamento-diário)
  - [4.1 Comanda Fechada com Meio de Pagamento Incorreto](#41-comanda-fechada-com-meio-de-pagamento-incorreto)
  - [4.2 Divergência de Valores na Conferência Cega de Caixa](#42-divergência-de-valores-na-conferência-cega-de-caixa)
  - [4.3 Sangria ou Suprimento Esquecido Durante o Turno](#43-sangria-ou-suprimento-esquecido-durante-o-turno)
- [5. Club dos Chefes (Assinaturas)](#5-club-dos-chefes-assinaturas)
  - [5.1 Crédito do Club dos Chefes Não Disponível no Checkout](#51-crédito-do-club-dos-chefes-não-disponível-no-checkout)
  - [5.2 Cancelamento de Plano com Créditos Restantes](#52-cancelamento-de-plano-com-créditos-restantes)
- [6. Clientes & WhatsApp](#6-clientes--whatsapp)
  - [6.1 Clientes Duplicados com Histórico Dividido](#61-clientes-duplicados-com-histórico-dividido)
  - [6.2 Link do WhatsApp Não Abre Diretamente na Conversa](#62-link-do-whatsapp-não-abre-diretamente-na-conversa)
- [7. Hardware & Conexão](#7-hardware--conexão)
  - [7.1 Queda Súbita de Conexão no Meio do Atendimento](#71-queda-súbita-de-conexão-no-meio-do-atendimento)
- [8. Acessos & Permissões](#8-acessos--permissões)
  - [8.1 Barbeiro Sem Acesso à sua Própria Agenda ou Comissões](#81-barbeiro-sem-acesso-à-sua-própria-agenda-ou-comissões)
  - [8.2 Perfil de Novo Colaborador Travado em "Pendente"](#82-perfil-de-novo-colaborador-travado-em-pendente)

---

## 1. Agenda & Horários

### 1.1 Conflito de Horário ou Cadeira Sobreposta
- **Sintoma:** Dois clientes aparecem marcados no mesmo horário para o mesmo barbeiro, ou a interface exibe alerta de sobreposição de horário.
- **Causa Provável:** Criação simultânea por dois operadores, agendamento por cliente externo enquanto a recepção criava manualmente, ou duração do serviço estimada abaixo do tempo real de execução.
- **Resolução Imediata (Passo a Passo):**
  1. Abra a Agenda na visualização por colunas de profissionais.
  2. Identifique qual cliente possui tolerância ou chegou primeiro.
  3. Clique sobre o segundo agendamento e selecione **Reagendar**.
  4. Ajuste para o próximo intervalo livre ou arraste para outro profissional qualificado disponível (após confirmar o consentimento do cliente).
  5. Salve o agendamento; a notificação de confirmação via WhatsApp será atualizada automaticamente.
- **Como Prevenir:** Sempre utilize o filtro de visualização por profissional e garanta que o tempo padrão de cada serviço no catálogo reflita a duração real com margem de 5 a 10 minutos para higienização da bancada.

### 1.2 Bloqueio de Ausência / Intervalo não Exibido
- **Sintoma:** Clientes conseguem marcar horário durante o horário de almoço ou folga do barbeiro.
- **Causa Provável:** Ausência de cadastro de intervalo na grade de expediente semanal do profissional em *Configurações $\rightarrow$ Horários*.
- **Resolução Imediata (Passo a Passo):**
  1. Acesse o menu lateral e clique em **Configurações**.
  2. Selecione **Equipe & Expediente** e clique no barbeiro correspondente.
  3. Defina os horários de entrada, intervalo de almoço e saída para cada dia da semana.
  4. Caso seja um bloqueio pontual (ex: consulta médica), clique diretamente no grid da Agenda no horário desejado e selecione **Adicionar Bloqueio**.
- **Como Prevenir:** Realize o alinhamento de escala semanal às sextas-feiras com a equipe para manter os bloqueios cadastrados com antecedência.

---

## 2. Atendimento & Comandas

### 2.1 Comanda Bloqueada em Atendimento na Bancada
- **Sintoma:** O caixa tenta encerrar o atendimento do cliente, mas a comanda aparece bloqueada para edição com a mensagem *"Comanda em edição pelo profissional"*.
- **Causa Provável:** O barbeiro adicionou um serviço ou produto pelo celular e deixou a aba aberta sem confirmar ou bloquear o dispositivo.
- **Resolução Imediata (Passo a Passo):**
  1. Solicite ao barbeiro na bancada que clique em **Salvar Comanda** no seu smartphone ou tablet.
  2. Se o barbeiro já tiver finalizado e não estiver com o celular, a recepção ou gerente com perfil `manager` pode clicar em **Liberar Comanda para Checkout**.
  3. A comanda é liberada instantaneamente no balcão para seleção das formas de pagamento.
- **Como Prevenir:** Treinar os barbeiros a tocar no botão de confirmação assim que lançarem a pomada, cerveja ou barba na bancada.

### 2.2 Comanda Sem Atribuição de Barbeiro Principal
- **Sintoma:** A comanda foi aberta na recepção, mas nenhum barbeiro está associado aos serviços executados, impossibilitando o rateio de comissão.
- **Causa Provável:** Abertura rápida de comanda avulsa (ex: venda de produto de balcão) onde posteriormente foram inseridos serviços de corte sem selecionar o responsável.
- **Resolução Imediata (Passo a Passo):**
  1. Com a comanda aberta na tela, localize a linha do serviço em questão.
  2. Clique no campo **Profissional Responsável** (dropdown).
  3. Selecione o barbeiro que executou o corte ou barba.
  4. Verifique a prévia da comissão gerada na lateral da comanda.
  5. Prossiga com o checkout normalmente.
- **Como Prevenir:** Incentive a recepção a vincular o profissional logo na criação da comanda com o atalho `N` (Nova Comanda).

### 2.3 Item ou Serviço Lançado Incorretamente na Comanda
- **Sintoma:** Foi adicionado por engano um produto ou serviço na comanda do cliente antes do pagamento.
- **Causa Provável:** Seleção de item com nome parecido no catálogo rápido de itens.
- **Resolução Imediata (Passo a Passo):**
  1. Na visualização detalhada da comanda em aberto, localize o item incorreto.
  2. Clique no ícone de **Lixeira / Remover** ao lado do valor do item.
  3. O sistema solicitará confirmação; confirme a exclusão.
  4. Se o item removido era um produto físico, o saldo é estornado ao estoque do inventário automaticamente.
- **Como Prevenir:** Sempre confira os itens em voz alta com o cliente antes de clicar no botão de finalizar pagamento.

---

## 3. Pagamentos & Checkout

### 3.1 Divergência entre Maquininha (POS) e Status da Comanda
- **Sintoma:** O cliente inseriu o cartão na maquininha externa da barbearia (Stone, PagBank, Cielo, etc.), digitou a senha, a maquininha imprimiu o papel de aprovado, mas o sistema apresentou instabilidade ou timeout de rede no momento do fechamento.
- **Causa Provável:** Queda momentânea de rede durante o processamento HTTP no navegador da recepção.
- **Resolução Imediata (Passo a Passo):**
  1. > [!CAUTION]
     > **NUNCA passe o cartão do cliente novamente na maquininha**, sob risco grave de cobrança duplicada e reclamação junto à operadora.
  2. Pegue a via impressa do comprovante emitido pela maquininha e confira o valor e o código de autorização (NSU/DOC).
  3. No SMG Barber, recarregue a tela da comanda com `F5` ou abra-a novamente na lista de comandas em aberto.
  4. Selecione a mesma modalidade aprovada (Ex: *Cartão de Débito* ou *Cartão de Crédito*).
  5. No campo **Observações / NSU**, digite o número de autorização impresso no papel (ex: `NSU: 184920`).
  6. Clique em **Finalizar Comanda**. O valor será computado corretamente no fechamento de caixa e a comanda arquivada como paga.
- **Como Prevenir:** Mantenha a maquininha no Wi-Fi da loja com IP fixo ou chip de dados de alta estabilidade.

### 3.2 Pagamento Dividido com Saldo Residual Incorreto
- **Sintoma:** O cliente deseja pagar R\$ 50 em dinheiro e o restante (R\$ 40) no cartão de crédito, mas o operador tem dúvidas de como registrar parcelas mistas.
- **Causa Provável:** Falta de familiaridade com o componente de múltiplos meios de pagamento.
- **Resolução Imediata (Passo a Passo):**
  1. Na tela de checkout da comanda, selecione a opção **Múltiplos Pagamentos / Dividir**.
  2. No primeiro meio, escolha **Dinheiro**, informe o valor `50,00` e clique em **Adicionar Parcela**.
  3. O sistema atualizará o saldo restante para `40,00`.
  4. No segundo meio, selecione **Cartão de Crédito**; o sistema preencherá automaticamente o valor residual de `40,00`.
  5. Após processar a maquininha, clique em **Confirmar Recebimento Total**.
- **Como Prevenir:** Consultar o Guia de Pagamentos Rápidos no balcão da recepção.

### 3.3 Troco em Dinheiro com Falta de Cédulas no Caixa
- **Sintoma:** Cliente paga uma comanda de R\$ 45 com uma nota de R\$ 100, mas a gaveta de dinheiro físico não possui troco suficiente.
- **Causa Provável:** Fundo de troco inicial insuficiente ou alta concentração de pagamentos em dinheiro no turno.
- **Resolução Imediata (Passo a Passo):**
  1. Pergunte educadamente se o cliente possui PIX ou cartão para facilitar o troco.
  2. Caso o cliente insista no dinheiro, o gestor deve realizar um **Suprimento de Caixa** pegando troco no cofre da barbearia.
  3. Acesse *Caixa $\rightarrow$ Registrar Movimentação $\rightarrow$ Suprimento*, informe o valor adicionado à gaveta (ex: R\$ 50) e a justificativa (*"Reforço de troco"*).
  4. Entregue o troco ao cliente e finalize a comanda.
- **Como Prevenir:** Definir valor mínimo de fundo de troco (ex: R\$ 150 a R\$ 200 em notas trocadas) na rotina matinal de abertura de caixa.

---

## 4. Caixa & Fechamento Diário

### 4.1 Comanda Fechada com Meio de Pagamento Incorreto
- **Sintoma:** A recepcionista encerrou a comanda selecionando *Dinheiro*, mas o cliente pagou via *PIX*.
- **Causa Provável:** Clique automático por distração durante horário de fluxo intenso.
- **Resolução Imediata (Passo a Passo):**
  1. O operador deve corrigir a ocorrência **antes** de efetuar o fechamento cego de caixa.
  2. Acesse a aba **Caixa do Dia** ou **Comandas Fechadas**.
  3. Localize a comanda recém-fechada e clique em **Ajustar Meio de Pagamento** (disponível para perfis autorizados).
  4. Altere a forma de pagamento de *Dinheiro* para *PIX*.
  5. Confirme o ajuste. O sistema registrará a alteração no log de auditoria interno, garantindo que o saldo em dinheiro da gaveta e o saldo de PIX coincidam perfeitamente com a realidade bancária.
- **Como Prevenir:** Olhe para o comprovante impresso ou tela do PIX antes de clicar no botão final de liquidação.

### 4.2 Divergência de Valores na Conferência Cega de Caixa
- **Sintoma:** Ao realizar o fechamento no final do dia, a contagem física de cédulas não bate com o valor que o sistema registrou.
- **Causa Provável:** Troco devolvido a mais por engano, suprimento/sangria não registrado no sistema ou recebimento em dinheiro lançado como débito.
- **Resolução Imediata (Passo a Passo):**
  1. **NÃO manipule a contagem.** O fechamento é intencionalmente **cego**: declare com precisão o valor exato contado fisicamente nas notas e moedas.
  2. Digite a contagem física real na tela de fechamento.
  3. Ao fechar, o sistema gerará o relatório comparativo indicando a divergência (sobra ou falta).
  4. Abra o extrato detalhado de movimentações em dinheiro do dia e compare cada comanda individualmente com a fita do caixa.
  5. Registre a ocorrência no campo de observações do fechamento de caixa para ciência da gerência.
- **Como Prevenir:** Toda saída de dinheiro da gaveta (mesmo pequenas compras de padaria ou gelo) deve ser lançada como **Sangria** no exato momento da retirada.

### 4.3 Sangria ou Suprimento Esquecido Durante o Turno
- **Sintoma:** Foi retirada uma quantia para pagar o motoboy do delivery durante a tarde, mas o operador esqueceu de registrar no sistema e já são 19h.
- **Causa Provável:** Urgência operacional no atendimento.
- **Resolução Imediata (Passo a Passo):**
  1. Antes de iniciar o fechamento do caixa, clique em **Registrar Movimentação**.
  2. Selecione a opção **Sangria (Saída)**.
  3. Informe o valor exato retirado, selecione a categoria de despesa (ex: *Despesas Operacionais / Entregas*) e anexe a descrição.
  4. Salve a movimentação.
  5. O saldo teórico da gaveta será ajustado retroativamente para coincidir com a contagem física.
- **Como Prevenir:** Manter o bloco de comprovantes de sangria assinado ao lado da gaveta física.

---

## 5. Club dos Chefes (Assinaturas)

### 5.1 Crédito do Club dos Chefes Não Disponível no Checkout
- **Sintoma:** O cliente é assinante do Club, mas ao passar a comanda o botão de resgate de créditos não aparece ou exibe saldo zero.
- **Causa Provável:**
  1. A fatura mensal do cartão do cliente falhou ou está pendente no gateway de pagamento;
  2. O cliente foi agendado com um número de telefone diferente daquele cadastrado na assinatura;
  3. O serviço executado não faz parte do plano contratado (ex: o plano cobre corte e o cliente fez selagem).
- **Resolução Imediata (Passo a Passo):**
  1. Acesse o menu **Club dos Chefes** e busque pelo nome ou CPF do cliente.
  2. Verifique o status da assinatura: se estiver `active`, confira o saldo de créditos disponíveis do serviço específico.
  3. Caso o status esteja `past_due` (inadimplente), solicite gentilmente ao cliente a atualização do cartão ou cobre o valor avulso do atendimento.
  4. Se a assinatura estiver ativa e com créditos válidos, verifique o cadastro da comanda: assegure-se de que o cliente selecionado na comanda é o titular do plano.
  5. O botão *Resgatar Crédito do Clube* será exibido imediatamente na comanda.
- **Como Prevenir:** Sempre vincule o cliente pelo número de WhatsApp unificado desde o agendamento inicial.

### 5.2 Cancelamento de Plano com Créditos Restantes
- **Sintoma:** Cliente solicitou o cancelamento da assinatura mensal, mas ainda possui 1 crédito de corte não utilizado no período vigente.
- **Causa Provável:** O cancelamento encerra as cobranças futuras, mas o cliente já pagou pela mensalidade atual.
- **Resolução Imediata (Passo a Passo):**
  1. Na tela do cliente em *Club dos Chefes*, selecione a opção **Cancelar Assinatura ao Fim do Ciclo**.
  2. Os créditos vigentes continuam válidos para consumo até a data de expiração do ciclo atual (30 dias após o último pagamento).
  3. Nenhuma nova cobrança será realizada após o término do período.
- **Como Prevenir:** Explicar com clareza a política de expiração de ciclos no ato da adesão ao plano.

---

## 6. Clientes & WhatsApp

### 6.1 Clientes Duplicados com Histórico Dividido
- **Sintoma:** O mesmo cliente aparece duas vezes na busca: um registro com o histórico antigo de cortes e outro com o agendamento de hoje.
- **Causa Provável:** Um atendente cadastrou o cliente pelo nome completo sem DDD no telefone e outro cadastrou pelo apelido com telefone formatado.
- **Resolução Imediata (Passo a Passo):**
  1. Acesse o menu **Clientes**.
  2. Localize os dois registros através do número de telefone ou nome.
  3. Abra o perfil que possui os dados mais completos e o número de telefone correto.
  4. Clique em **Opções $\rightarrow$ Unificar Clientes**.
  5. Selecione o cadastro secundário a ser absorvido; todos os históricos de comandas, agendamentos e pontos de fidelidade serão consolidados no registro principal.
- **Como Prevenir:** A recepção deve sempre digitar os 4 últimos dígitos do telefone no campo de busca rápida antes de clicar em "Novo Cliente".

### 6.2 Link do WhatsApp Não Abre Diretamente na Conversa
- **Sintoma:** Ao clicar no botão verde de enviar lembrete ou confirmação via WhatsApp, o navegador exibe mensagem de número inválido.
- **Causa Provável:** Telefone cadastrado sem código de área (DDD) ou com dígito `9` duplicado/faltante.
- **Resolução Imediata (Passo a Passo):**
  1. Abra o cadastro do cliente e verifique o campo de telefone.
  2. O formato padrão exigido pelo WhatsApp é: `(DDD) 9XXXX-XXXX` (ex: `11987654321`).
  3. Remova espaços extras, traços manuais ou caracteres especiais incorretos.
  4. Salve o cadastro e clique novamente no ícone de envio.
- **Como Prevenir:** O formulário de cadastro possui máscara automática que valida a quantidade de dígitos no momento da digitação.

---

## 7. Hardware & Conexão

### 7.1 Queda Súbita de Conexão no Meio do Atendimento
- **Sintoma:** Mensagem de erro de rede ou carregamento infinito ao tentar salvar uma comanda.
- **Causa Provável:** Interrupção do provedor de internet de fibra ou roteador Wi-Fi travado.
- **Resolução Imediata (Passo a Passo):**
  1. Mantenha a tranquilidade: os dados em tela continuam no navegador.
  2. **NÃO feche a aba** para não perder as informações recém-digitadas.
  3. No smartphone da recepção, ative a função **Roteador Wi-Fi / Hotspot Pessoal (4G/5G)**.
  4. Conecte o computador da recepção à rede do smartphone (leva menos de 45 segundos).
  5. Clique no botão de tentar novamente; a operação continuará normalmente.
  6. Para o procedimento completo de contingência analógica caso o 4G também falhe, consulte o [Guia de Contingência de Hardware](file:///c:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/docs/help/GUIA_CONTINGENCIA_HARDWARE.md).
- **Como Prevenir:** Manter o roteador da recepção em tomada com nobreak e a senha do hotspot salva no computador do caixa.

---

## 8. Acessos & Permissões

### 8.1 Barbeiro Sem Acesso à sua Própria Agenda ou Comissões
- **Sintoma:** O profissional faz login com seu e-mail e senha, mas recebe alerta de tela não autorizada ou não visualiza seus relatórios de comissão.
- **Causa Provável:** O papel atribuído na criação do usuário foi configurado com permissão inadequada ou o cadastro de staff não foi associado ao perfil de autenticação.
- **Resolução Imediata (Passo a Passo):**
  1. O Gestor com perfil `admin` deve acessar *Configurações $\rightarrow$ Gestão de Equipe*.
  2. Localize o profissional na lista e clique em **Editar**.
  3. Verifique se o papel está marcado como `barber`.
  4. Certifique-se de que o profissional está marcado como **Ativo** e vinculado ao tenant atual da barbearia.
  5. Solicite ao profissional que faça logout e realize login novamente para renovar o token de acesso.
- **Como Prevenir:** Ao contratar novo colaborador, seguir o checklist de admissão do [Manual de Treinamento](file:///c:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/docs/training/README.md).

### 8.2 Perfil de Novo Colaborador Travado em "Pendente"
- **Sintoma:** Novo usuário criado faz login e cai na tela `/pending-approval`.
- **Causa Provável:** Políticas de segurança RLS exigem aprovação explícita do administrador do tenant antes de liberar o acesso.
- **Resolução Imediata (Passo a Passo):**
  1. O Dono ou Administrador da barbearia deve acessar a tela administrativa.
  2. No painel de aprovações pendentes, localize o e-mail do colaborador recém-cadastrado.
  3. Clique em **Aprovar Acesso** e defina o papel correspondente (`receptionist` ou `barber`).
  4. O colaborador é liberado de imediato sem necessidade de recriar a conta.
- **Como Prevenir:** Aprovar o convite do colaborador logo após o envio do cadastro inicial.
