# Manual do Usuário — SMG Barber
## The Barbershop Intelligence · Guia de Operações dos 8 Módulos

> **SMG Barber — SMG Intelligence**<br />
> **Data de Atualização:** 2026-11-04<br />
> **Status:** CANÔNICO E OBRIGATÓRIO<br />
> **Responsável Formal:** Augusto (PO)<br />
> **Ambiente:** Operação de Balcão, Bancada e Gestão

---

## Sumário dos Módulos
1. [Módulo 1: Cockpit & Home Operacional do Dia](#1-cockpit--home-operacional-do-dia)
2. [Módulo 2: Agenda de Atendimentos & Cadeira Cativa](#2-agenda-de-atendimentos--cadeira-cativa)
3. [Módulo 3: Comandas & Balcão PDV](#3-comandas--balcão-pdv)
4. [Módulo 4: Checkout Expresso & Formas de Pagamento](#4-checkout-expresso--formas-de-pagamento)
5. [Módulo 5: Fechamento de Caixa & Extrato de Comissão](#5-fechamento-de-caixa--extrato-de-comissão)
6. [Módulo 6: Clientes, CRM 360° & WhatsApp](#6-clientes-crm-360--whatsapp)
7. [Módulo 7: Club dos Chefes (Assinaturas e Créditos)](#7-club-dos-chefes-assinaturas-e-créditos)
8. [Módulo 8: Configurações, Equipe & Serviços](#8-configurações-equipe--serviços)

---

## 1. Cockpit & Home Operacional do Dia

O **Cockpit Operacional** (`/#/dashboard`) é o centro de comando matinal da barbearia. Ele consolida o pulso financeiro e a produtividade da equipe em tempo real com precisão de fuso horário de Brasília (`America/Sao_Paulo`).

### 1.1 Os 6 KPIs Diários em Tempo Real
- **Faturamento Real do Dia:** Somatório estrito dos pagamentos liquidados em comandas pagas no dia (nunca inclui previsões teóricas ou comandas abertas).
- **Atendimentos Realizados:** Quantidade de clientes que já concluíram o atendimento e tiveram suas comandas pagas.
- **Ticket Médio do Dia:** Razão entre faturamento bruto e total de clientes atendidos.
- **Serviços Prestados:** Total de cortes, barbas e procedimentos executados.
- **Produtos Vendidos:** Bebidas, pomadas e itens de balcão comercializados no dia.
- **Ocupação das Cadeiras:** Percentual da grade horária preenchida em relação à capacidade máxima dos barbeiros em escala.

---

## 2. Agenda de Atendimentos & Cadeira Cativa

A **Agenda** (`/#/schedule`) é estruturada visualmente em colunas verticais por profissional, utilizando a Paleta Atelier de identificação rápida (`barber-1` a `barber-6`).

### 2.1 Estados Semânticos do Agendamento
- 🟡 **Pendente:** Horário solicitado pelo cliente (online ou WhatsApp) aguardando confirmação.
- 🟤 **Confirmado:** Presença confirmada pelo cliente.
- 🟢 **Em Andamento:** Cliente sentado na cadeira sendo atendido.
- 🟩 **Concluído:** Serviço finalizado, comanda gerada pronta para cobrança.
- 🔴 **Cancelado:** Horário desmarcado previamente.
- ⚫ **Não Compareceu (No-Show):** Cliente faltou sem aviso prévio.

### 2.2 Agendamento Recorrente ("Cadeira Cativa Semanal")
Permite fixar o cliente VIP em seu horário favorito semanal, quinzenal ou mensal por até 12 sessões consecutivas:
- A 1ª sessão é criada como **Confirmada** (`confirmed`).
- As sessões futuras entram com a tag **Cadeira Cativa** (`is_recurring: true`) e status **Pendente**.
- Toda semana, a recepção abre o modal de confirmação semanal (`RecurringConfirmModal`) e valida com 1 clique via WhatsApp se o cliente comparecerá naquela semana, liberando a vaga pontual caso ele viaje, sem desmanchar as semanas seguintes.

---

## 3. Comandas & Balcão PDV

A gestão de comandas (`/#/comandas`) foi projetada para velocidade e segurança de balcão:

### 3.1 Abertura Rápida Instantânea (Tecla `N`)
- Em qualquer tela do sistema, pressione a tecla de atalho **`N`** para abrir o modal de abertura instantânea.
- Digite o nome do cliente ou selecione **"Cliente Balcão / Avulso"**, escolha o barbeiro e confirme. Uma nova comanda é criada em menos de 3 segundos.

### 3.2 Comanda Multi-Barbeiro e Itens de Balcão
- Uma única comanda pode conter serviços de barbeiros diferentes (ex: Barbeiro A faz o corte; Barbeiro B faz a barba terapia). Cada profissional terá sua comissão calculada com precisão.
- Produtos de consumo (cervejas, energéticos, pomadas) podem ser adicionados avulsos (`service_id: null`) sem exigir um serviço atrelado.
- **Bloqueio de Comanda:** Caso o cliente saia para fumar ou aguarde na recepção, a comanda pode ser colocada em status **Bloqueada** (`blocked`), impedindo alterações acidentais.

---

## 4. Checkout Expresso & Formas de Pagamento

O **Checkout Expresso** (`/#/checkout`) finaliza a experiência do cliente com rapidez e rigor financeiro:

### 4.1 Formas de Pagamento Homologadas
- **Dinheiro:** Com campo de valor entregue e cálculo automático instantâneo de troco em reais.
- **PIX:** Confirmação de recebimento instantâneo.
- **Cartão de Débito & Cartão de Crédito:** Lançamento de transação por maquininha física.
- **Créditos Club dos Chefes:** Se o cliente for assinante do clube, o sistema detecta os créditos disponíveis e permite abater o serviço contratado sem cobrança adicional.

### 4.2 Pagamento Misto / Dividido
O operador pode combinar múltiplas formas em uma mesma transação:
- Exemplo: Conta de R$ 100,00 ➔ 1 crédito do corte pelo Club + R$ 30,00 no PIX da pomada + R$ 20,00 no Cartão da cerveja.
- O sistema valida a soma exata dos pagamentos antes de liberar a finalização.

---

## 5. Fechamento de Caixa & Extrato de Comissão

O módulo financeiro do SMG Barber respeita o **ADR-001** (Separação estrita entre comissão teórica e rateio de caixa):

### 5.1 Rotina de Fechamento de Caixa
1. Ao final do turno, o operador clica em **Fechar Caixa**.
2. **Conferência Física:** O operador conta e digita o dinheiro físico gaveta, os comprovantes de maquininha de cartão e os PIX recebidos.
3. O sistema compara o valor físico com o saldo registrado em banco, apontando eventuais sobras ou faltas com justificativa obrigatória.

### 5.2 Extrato de Comissão Transparente do Barbeiro
- O profissional visualiza no smartphone ou na bancada o valor líquido exato de sua comissão.
- O sistema desconta automaticamente a taxa da maquininha de cartão de forma proporcional da comissão do barbeiro (quando configurado nas regras da barbearia), eliminando brigas no dia do acerto.

---

## 6. Clientes, CRM 360° & WhatsApp

A tela de **Clientes** (`/#/clients`) centraliza o relacionamento e a inteligência de retenção:

### 6.1 Perfil 360° do Cliente
- Histórico completo de visitas e serviços contratados.
- Barbeiro de preferência e estilo de corte anotado.
- Faturamento vitalício (LTV) e ticket médio histórico.

### 6.2 Alertas de Churn & Reengajamento Inteligente
- O sistema identifica automaticamente clientes que não frequentam a barbearia há mais de 30, 45 ou 60 dias.
- Com 1 clique no botão **WhatsApp**, o sistema abre a conversa com o cliente trazendo uma mensagem personalizada e carinhosa com nome, barbeiro habitual e convite para agendar.

---

## 7. Club dos Chefes (Assinaturas e Créditos)

O **Club dos Chefes** (`/#/chef-club/plans`) transforma clientes avulsos em receita recorrente previsível para a barbearia:

### 7.1 Regras de Funcionamento
- O cliente assina um plano mensal (ex: "Plano Vip — 4 Cortes por Mês").
- Os créditos de corte são disponibilizados na conta do cliente.
- Ao passar pelo Checkout, o sistema reconhece a assinatura ativa e debita 1 crédito, registrando o serviço e gerando a comissão correspondente ao barbeiro que o atendeu.

---

## 8. Configurações, Equipe & Serviços

A área administrativa (`/#/settings`, `/#/team`, `/#/services`) define os parâmetros operacionais da unidade:

- **Equipe:** Cadastro de barbeiros, fotos, percentuais de comissão e horários de trabalho.
- **Serviços:** Catálogo de serviços com tempo de duração nominal em minutos e preço em BRL.
- **Produtos:** Controle de estoque de bancada e balcão com preço de custo e venda.
