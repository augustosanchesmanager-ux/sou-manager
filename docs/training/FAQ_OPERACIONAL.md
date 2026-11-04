# FAQ Operacional & Contingência — SMG Barber
## Dúvidas Frequentes, Atalhos e Procedimentos de Balcão

> **SMG Barber — SMG Intelligence**<br />
> **Data de Atualização:** 2026-11-04<br />
> **Status:** CANÔNICO E OBRIGATÓRIO<br />
> **Público-Alvo:** Recepcionistas, Operadores de Caixa, Barbeiros e Suporte Interno

---

## 1. Dúvidas Frequentes da Rotina de Atendimento

### 1.1 O que fazer se a internet da barbearia cair durante o expediente?
- **Resposta:** O SMG Barber possui tolerância a oscilações de rede. Se a conexão cair, um banner discreto informará que o sistema está em modo offline. As telas abertas permanecem operacionais. Assim que a rede for restabelecida, o sistema sincroniza os dados automaticamente com os servidores centrais. Para pagamentos com cartão, utilize a maquininha física com chip/4G e lance o comprovante normalmente.

### 1.2 O cliente consumiu uma cerveja, mas decidiu não cortar o cabelo. Como proceder?
- **Resposta:** O SMG Barber permite produtos avulsos de balcão sem serviço obrigatório. Abra a comanda normalmente, exclua o serviço de corte e mantenha a cerveja. Em seguida, processe o Checkout no valor exato da cerveja. A comanda é liquidada sem gerar comissão indevida de corte.

### 1.3 O cliente agendou, mas não compareceu (No-Show). Devo excluir o horário?
- **Resposta:** **Não exclua o horário.** Altere o status do agendamento para **Não Compareceu (No-Show)**. Isso é fundamental para que a inteligência preditiva do sistema compute a taxa de falta desse cliente e alerte a recepção caso ele tente agendar novos horários em dias de pico.

### 1.4 Lancei uma forma de pagamento errada no Checkout. Como corrigir?
- **Resposta:** Se a comanda ainda estiver aberta ou na tela de Checkout, basta clicar no ícone de lixeira ao lado da forma de pagamento lançada e adicionar a forma correta. Se a comanda já tiver sido finalizada, acerte a divergência durante o **Fechamento de Caixa** justificando o motivo no campo de conferência.

### 1.5 Como funciona a dedução da taxa de maquininha da comissão do barbeiro?
- **Resposta:** Se sua barbearia habilitou o repasse de taxa de cartão, o SMG Barber calcula a dedução líquida proporcional de forma automática.
  - *Exemplo:* Corte de R$ 100,00 pago no cartão com taxa de 3% (R$ 3,00) e comissão do barbeiro de 50%. A receita líquida é R$ 97,00, gerando R$ 48,50 de comissão líquida para o barbeiro e R$ 48,50 para a casa, sem prejuízo para nenhuma das partes.

---

## 2. Atalhos de Teclado Operacionais

Os atalhos de teclado foram desenvolvidos para agilizar a rotina no balcão físico da barbearia:

| Atalho | Ação Executada | Contexto de Uso |
|:---:|---|---|
| **`N`** | Abre o modal de **Abertura Rápida de Comanda** | Funciona em qualquer tela da recepção |
| **`Escape`** | Fecha instantaneamente qualquer modal ou tela suspensa | Em qualquer janela/modal aberto |
| **`Enter`** | Confirma a ação do formulário ativo | Em inputs e caixas de diálogo |

---

## 3. Procedimentos de Contingência e Casos Extremos

### 3.1 Comanda com status Bloqueada (`blocked`)
- **O que significa:** A comanda foi travada para edição temporária pela recepção ou pela bancada.
- **Como destravar:** Clique na comanda e selecione **Desbloquear Comanda**. Apenas operadores autorizados podem realizar alterações após o destravamento.

### 3.2 Cliente com saldo de créditos no Club dos Chefes
- **O que fazer no checkout:** Quando o cliente é assinante do Club dos Chefes, o sistema exibe automaticamente um selo dourado com o saldo de créditos. Ao clicar em **Abater com Crédito do Club**, o valor do corte é zerado na cobrança, e a comissão do barbeiro é garantida com base no valor acordado no plano.

### 3.3 Mensagem de erro de CPF ou Telefone Duplicado
- **O que significa:** O sistema impede que dois clientes tenham o mesmo número de WhatsApp ou documento.
- **Como resolver:** Verifique se o cliente já não está cadastrado na lista de clientes. Se for um retorno de cliente antigo, basta selecioná-lo na busca em vez de criar um novo cadastro.
