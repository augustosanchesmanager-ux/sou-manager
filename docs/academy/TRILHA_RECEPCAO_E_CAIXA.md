# Trilha Curricular: Especialista em Recepção & Caixa Ágil

> **SMG Academy — SMG Barber**<br />
> **Entidade Mantenedora:** SMG Intelligence<br />
> **Carga Horária:** 45 minutos | **Nível:** Operacional / Essencial<br />
> **Público-Alvo:** Recepcionistas, Operadores de Caixa e Atendentes de Balcão<br />
> **Certificação Concedida:** *Especialista em Balcão e Caixa Ágil SMG Barber*

---

## 1. Visão Geral da Trilha

A recepção é o cartão de visitas e o centro nevrálgico da barbearia. Uma recepção rápida e organizada elimina filas, encanta o cliente e garante que todo o fluxo financeiro seja registrado com 100% de precisão contábil.

Nesta trilha, você aprenderá a operar o **SMG Barber** com velocidade profissional, utilizando atalhos de teclado, dominando a Cadeira Cativa semanal e garantindo fechamentos de caixa sem diferenças.

---

## 2. Conteúdo Programático dos Módulos

### Módulo 1: O Pulso da Barbearia & Cockpit Matinal (10 min)
- **Abertura do Sistema:** Login na plataforma e conferência do fuso horário oficial (`America/Sao_Paulo`).
- **Os 6 KPIs Diários em Tempo Real:**
  - Faturamento Real do Dia (apenas pagamentos já liquidados).
  - Quantidade de atendimentos concluídos.
  - Ticket médio atualizado.
  - Serviços prestados vs produtos vendidos.
  - Ocupação percentual das cadeiras por horário.
- **Identificação de Horários de Pico:** Mapeamento visual das janelas de maior movimento (17h às 20h) para planejar encaixes conscientes.

### Módulo 2: Balcão Ágil Sem Fila & Atalho `N` (10 min)
- **Abertura Relâmpago com Tecla `N`:** Pressione `N` em qualquer tela para abrir o modal suspenso instantaneamente sem usar o mouse.
- **Busca Debounced Inteligente:** Ao digitar 3 letras do nome ou dígitos do telefone, o sistema autocompleta o histórico do cliente.
- **Cliente Balcão (Walk-in):** Como abrir comanda imediata para clientes que chegam da rua sem cadastro prévio.
- **Encaixes Rápidos na Grade:** Adicionar serviço complementar (ex: sobrancelha ou barba rápida) em barbeiro com cadeira livre sem gerar conflito de horário.

### Módulo 3: Fidelidade Ativa, Club dos Chefes & Cadeira Cativa (15 min)
- **Como Funciona a Cadeira Cativa Semanal:** Clientes com horários reservados para até 12 semanas consecutivas.
  - A 1ª sessão inicia como Confirmada (`confirmed`).
  - As sessões futuras entram com tag Cadeira Cativa (`is_recurring: true`) e status Pendente.
- **Confirmação da Semana:** Toda segunda-feira, abrir o modal de confirmação e enviar lembrete amigável via WhatsApp em 1 clique.
- **Liberação Pontual Sem Perda de Vaga:** Se o cliente avisar que vai viajar, clique em "Liberar Vaga Desta Semana". O horário fica disponível para outro cliente, preservando as reservas das próximas semanas.
- **Abatimento de Créditos do Club dos Chefes:** No checkout, o sistema detecta o plano ativo e permite abater o corte debitando 1 crédito, mantendo a comissão integral do barbeiro.

### Módulo 4: Checkout Expresso & Fechamento de Caixa Blindado (10 min)
- **Pagamento Dividido / Misto:** Receber parte em dinheiro, parte em PIX e parte no cartão na mesma comanda.
- **Calculadora de Troco Dinâmica:** Digitação do valor recebido com cálculo automático do troco e bloqueio contra valor insuficiente.
- **Sangria e Suprimento:** Lançamento imediato de retiradas (ex: troco para entregador) ou reforço de caixa com motivo justificado.
- **Rotina de Fechamento de Caixa Cego:**
  1. Clicar em **Fechar Caixa**.
  2. Contar fisicamente as cédulas na gaveta, os comprovantes de cartão e os comprovantes de PIX.
  3. Digitar os valores na tela sem ver o saldo do sistema (conferência cega).
  4. Caso haja sobra ou falta, registrar a justificativa obrigatória para auditoria.

---

## 3. Exercícios Práticos Simulados (Hands-On no Demo Mode)

Acesse o ambiente com `teste@soumanager.local` / `12345678` e complete os 5 desafios práticos:

| Exercício | Cenário Operacional | Ação Prática Esperada |
|---|---|---|
| **Exercício 1** | Cliente entra na loja sem agendamento e pede corte com o Barbeiro 1. | Pressionar a tecla `N`, selecionar "Cliente Balcão", escolher "Corte Tradicional", atribuir ao Barbeiro 1 e abrir a comanda. |
| **Exercício 2** | Cliente VIP com Cadeira Cativa avisa que não poderá comparecer esta semana. | Abrir a agenda, localizar o card com badge de cadeira cativa, clicar em "Liberar Vaga Desta Semana" e confirmar a liberação. |
| **Exercício 3** | Cliente consome 1 corte (abatido pelo Club) + 1 pomada (R$ 45,00) + 1 cerveja (R$ 15,00). Total: R$ 60,00. | No Checkout, abater o corte com crédito do Club, lançar R$ 40,00 no Cartão de Crédito e R$ 20,00 em Dinheiro, calculando troco de R$ 0,00. |
| **Exercício 4** | O motoboy trouxe gelo para a barbearia e a recepção precisa pagar R$ 30,00 da gaveta. | Acessar Caixa, clicar em **Lançar Sangria**, digitar R$ 30,00 com a justificativa "Compra de gelo para bebidas" e salvar. |
| **Exercício 5** | Fim de expediente: o caixa tem R$ 450,00 em notas e R$ 890,00 em comprovantes de cartão. | Realizar o Fechamento de Caixa Cego, preencher os valores contados fisicamente e emitir o relatório de conferência. |

---

## 4. Avaliação Teórico-Operacional (Auto-Teste)

Responda mentalmente ou anote suas respostas antes de conferir o gabarito no Sistema de Certificação:

1. **Qual é a tecla de atalho universal para Abertura Rápida de Comanda em qualquer tela?**
   - a) `Ctrl + P`
   - b) `Tecla N`
   - c) `Espaço`
   - d) `Tecla C`
2. **O que acontece ao clicar em "Liberar Vaga Desta Semana" na Cadeira Cativa?**
   - a) Exclui permanentemente todos os agendamentos das 12 semanas seguintes.
   - b) Cancela a assinatura do Club dos Chefes do cliente.
   - c) Libera apenas o horário da semana atual para outro cliente, preservando as semanas futuras.
   - d) Gera uma multa automática de 50% na conta do cliente.
3. **Por que o Fechamento de Caixa do SMG Barber adota o modelo de Conferência Cega?**
   - a) Para impedir que o operador veja antecipadamente o valor esperado pelo sistema, garantindo idoneidade na contagem física da gaveta.
   - b) Porque o sistema não calcula valores em dinheiro.
   - c) Para permitir que o operador feche o caixa sem contar o dinheiro.
   - d) Para transferir automaticamente o saldo para a conta bancária do dono.
4. **Em uma conta de R$ 80,00, o cliente paga R$ 50,00 no PIX e o restante em dinheiro, entregando uma nota de R$ 50,00. Quanto é o troco?**
   - a) R$ 10,00
   - b) R$ 20,00
   - c) R$ 30,00
   - d) R$ 50,00
5. **Se o cliente é assinante do Club dos Chefes e possui créditos disponíveis, o que acontece com a comissão do barbeiro que o atendeu?**
   - a) O barbeiro não recebe nada porque o serviço foi gratuito.
   - b) O barbeiro recebe sua comissão integral garantida com base no valor acordado no plano.
   - c) O cliente precisa pagar a comissão do barbeiro em dinheiro à parte.
   - d) A comissão é rateada entre todos os funcionários da recepção.

*(Nota de corte para aprovação: 80% de acertos — mínimo 4 de 5 questões).*
