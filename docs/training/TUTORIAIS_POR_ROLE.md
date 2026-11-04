# Tutoriais por Papel (Role) — SMG Barber
## Trilhas Práticas para Recepção, Barbeiro e Dono/Gerente

> **SMG Barber — SMG Intelligence**<br />
> **Data de Atualização:** 2026-11-04<br />
> **Status:** CANÔNICO E OBRIGATÓRIO<br />
> **Público-Alvo:** Recepcionistas, Barbeiros, Gerentes e Proprietários

---

## 1. Trilha da Recepção & Operador de Caixa

A recepção é o coração operacional do SMG Barber. A agilidade no balcão define o ritmo e o conforto do cliente.

### 1.1 Abertura Rápida de Comanda com Atalho `N`
1. Em qualquer tela do sistema, pressione a tecla **`N`**.
2. Digite o nome do cliente. Se ele já for cadastrado, o sistema autocompleta seu histórico e telefone.
3. Se for um cliente novo sem agendamento, selecione **"Cliente Balcão"**.
4. Selecione o profissional que irá atendê-lo e clique em **Criar Comanda**. A comanda abre instantaneamente.

### 1.2 Como Gerenciar um Encaixe na Agenda
1. Acesse a tela da **Agenda** (`/#/schedule`).
2. Localize a coluna do barbeiro desejado.
3. Clique sobre o espaço entre horários ou no botão **Novo Encaixe**.
4. Defina o serviço solicitado e confirme. O sistema calcula a duração dinâmica automaticamente e posiciona o badge como **Em Andamento** ou **Confirmado**.

### 1.3 Confirmação Semanal da "Cadeira Cativa"
1. Clientes com cadeira cativa possuem horários reservados toda semana.
2. Na segunda-feira ou na véspera, clique no horário marcado com o ícone de cadeira cativa.
3. Clique em **Confirmar Semana**. O sistema gera automaticamente a mensagem de confirmação para o WhatsApp do cliente.
4. Se o cliente avisar que não poderá ir, selecione **Liberar Vaga Desta Semana**. O horário é liberado para outros clientes sem perder as reservas das semanas futuras.

### 1.4 Realizando o Checkout com Pagamento Dividido
1. Acesse a comanda do cliente e clique no botão dourado **Ir para Checkout**.
2. O sistema exibe o resumo com serviços prestados e produtos consumidos.
3. **Para pagamento misto:**
   - Se o cliente for do **Club dos Chefes**, o corte é abatido automaticamente com 1 crédito.
   - Para os demais itens (ex: cerveja R$ 15,00 e pomada R$ 40,00 = R$ 55,00):
   - Lance R$ 30,00 em **Cartão de Crédito**.
   - Lance R$ 25,00 em **Dinheiro**. Digite o valor que o cliente entregou (ex: nota de R$ 50,00). O sistema calcula instantaneamente o troco: R$ 25,00.
4. Clique em **Finalizar Atendimento**. A comanda é liquidada e a vaga é liberada.

---

## 2. Trilha do Barbeiro & Profissional da Bancada

O barbeiro tem acesso simplificado e cirúrgico para gerenciar seus clientes direto na bancada, sem complexidade administrativa.

### 2.1 Acessando o Modo Barbeiro no Smartphone
1. Abra o navegador do celular e acesse o endereço da barbearia (ex: `barber.soumanager.com`).
2. Faça login com seu e-mail e senha.
3. O sistema detecta o perfil de Barbeiro e abre diretamente o **Modo Barbeiro Mobile**.

### 2.2 Consultando sua Agenda do Dia
- Sua tela exibe exclusivamente os clientes agendados para a sua cadeira.
- Os cartões mostram o nome do cliente, o serviço solicitado, o horário e observações de estilo.
- Quando o cliente sentar na cadeira, clique em **Iniciar Atendimento** para que a recepção saiba que o serviço começou.

### 2.3 Lançando Produtos e Adicionais na Bancada
1. Durante o atendimento, se o cliente pedir uma cerveja, café especial ou decidir comprar uma pomada de finalização:
2. Clique no botão **+ Adicionar Item** na comanda do cliente.
3. Selecione o produto no catálogo rápido.
4. O item entra na conta do cliente e sua comissão sobre a venda do produto é computada imediatamente.

### 2.4 Acompanhando seu Extrato de Comissão em Tempo Real
1. No menu superior ou inferior, clique em **Meu Extrato**.
2. Veja o somatório de serviços do dia, vendas de produtos e sua comissão líquida acumulada.
3. O cálculo já desconta as taxas acordadas com o dono (se houver), garantindo total transparência.

---

## 3. Trilha do Dono & Gerente Geral

O proprietário utiliza o SMG Barber como seu motor de inteligência e governança executiva.

### 3.1 Auditoria Matinal no Cockpit Operacional
1. Ao abrir a barbearia, acesse o **Dashboard** (`/#/dashboard`).
2. Verifique os 6 KPIs do dia:
   - Quantas cadeiras estão ocupadas na grade.
   - A previsão de faturamento e ticket médio estimado.
   - Os horários de pico da barbearia.

### 3.2 Realizando o Fechamento de Caixa Sem Divergências
1. No final do expediente, acesse **Financeiro > Fechamento de Caixa** (`/#/cash-closing`).
2. Clique em **Novo Fechamento**.
3. Realize a **Conferência Cega**:
   - Conte o dinheiro físico na gaveta e digite o valor.
   - Some os canhotos das maquininhas de cartão e digite os totais de débito e crédito.
   - Confira o total de PIX recebidos na conta da empresa.
4. Clique em **Processar Fechamento**.
5. O sistema compara os valores físicos digitados com os registros do banco de dados:
   - Se bater: o caixa é homologado com status verde.
   - Se houver divergência: o sistema solicita a justificativa obrigatória do operador antes do encerramento.

### 3.3 Reengajamento de Clientes Inativos (Combate ao Churn)
1. Acesse o menu **Clientes** (`/#/clients`).
2. Filtre por **"Sem Visita > 30 Dias"**.
3. O sistema exibe a lista dos clientes que costumavam cortar o cabelo com frequência, mas sumiram no último mês.
4. Clique no botão verde de **WhatsApp** ao lado do nome do cliente.
5. O sistema abre o WhatsApp Web / App com uma mensagem personalizada com o nome do cliente e do barbeiro que o atende, aumentando a conversão de retorno em mais de 40%.

### 3.4 Gestão do Club dos Chefes (Receita Recorrente)
1. Acesse **Club dos Chefes > Planos** (`/#/chef-club/plans`).
2. Crie ou ajuste os planos de fidelidade (ex: 2 cortes/mês ou cortes ilimitados).
3. Monitore na aba de **Assinaturas** quais clientes estão com pagamento em dia e quantos créditos já consumiram no mês.
