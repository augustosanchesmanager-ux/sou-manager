# Trilha Curricular: Gestão Executiva & Dono da Barbearia

> **SMG Academy — SMG Barber**<br />
> **Entidade Mantenedora:** SMG Intelligence<br />
> **Carga Horária:** 60 minutos | **Nível:** Estratégico / Gestão Avançada<br />
> **Público-Alvo:** Proprietários, Sócios, Gerentes Gerais e Consultores de Barbearia<br />
> **Certificação Concedida:** *Gestão Executiva & Business Intelligence SMG Barber*

---

## 1. Visão Geral da Trilha

Um dono de barbearia não pode perder tempo somando comandas de papel ou tentando adivinhar por que o faturamento caiu no meio do mês. O **SMG Barber** foi arquitetado pela **SMG Intelligence** como um motor preditivo para elevar o lucro por cadeira, reter clientes VIP e fechar o caixa sem um único centavo de divergência.

Esta trilha ensina o proprietário e o gerente a dominar os números do negócio, automatizar a retenção via WhatsApp e transformar serviços avulsos em receita recorrente previsível com o Club dos Chefes.

---

## 2. Conteúdo Programático dos Módulos

### Módulo 1: O Cockpit Executivo & Leitura dos 6 KPIs Vitais (15 min)
- **Faturamento Real vs Faturamento Projetado:** O Cockpit contabiliza estritamente os pagamentos já liquidados (nunca comanda aberta ou previsão hipotética).
- **Os 6 Indicadores-Chave Diários:**
  1. *Faturamento Real do Dia:* Total em R$ liquidado no caixa.
  2. *Clientes Atendidos:* Volume real de pessoas que passaram pelas cadeiras.
  3. *Ticket Médio Real:* Receita bruta dividida pelo total de clientes atendidos.
  4. *Serviços Prestados:* Procedimentos capilares e de barba realizados.
  5. *Produtos Vendidos:* Quantidade de pomadas, cosméticos e bebidas faturadas.
  6. *Taxa de Ocupação das Cadeiras:* Capacidade produtiva aproveitada vs tempo ocioso dos barbeiros.
- **Identificação de Gargalos:** Como detectar quais dias da semana ou faixas de horário (ex: quartas-feiras das 14h às 16h) estão gerando prejuízo por cadeira ociosa.

### Módulo 2: Inteligência de Retenção & Combate ao Churn via WhatsApp (15 min)
- **O Custo do Cliente Perdido (Churn):** Conquistar um novo cliente custa até 7 vezes mais do que manter um cliente frequente.
- **Filtros Preditivos de Inatividade:** No menu **Clientes** (`/#/clients`), filtre em 1 clique:
  - Clientes sem visita entre **30 e 44 dias** (risco moderado).
  - Clientes sem visita entre **45 e 59 dias** (risco alto de churn).
  - Clientes inativos há **mais de 60 dias** (abandono iminente).
- **Disparo Personalizado com 1 Toque:** O sistema abre a conversa no WhatsApp Web ou App com o nome do cliente, o nome do barbeiro habitual dele e uma mensagem acolhedora convidando para renovar o visual.
- **Métrica de Recuperação:** Monitoramento da taxa de retorno após campanhas ativas de WhatsApp (> 40% de conversão média comprovada).

### Módulo 3: Governança Financeira, Fechamento de Caixa Cego & Auditoria (15 min)
- **O Princípio Canônico ADR-001:** Separação rígida entre a comissão teórica individual do barbeiro (`domain/commission/`) e o rateio efetivo do fechamento de caixa (`application/cashClosing/`).
- **A Proteção da Conferência Cega:** A recepcionista ou operador não vê o saldo esperado pelo sistema. Ele precisa contar fisicamente dinheiro, comprovantes e PIX. Se houver sobra ou falta, uma **Diferença de Caixa** é aberta com justificativa obrigatória.
- **Controle Rigoroso de Sangrias e Suprimentos:** Toda saída de caixa ao longo do dia para compras avulsas (gelo, materiais, lanches) deve conter responsável e motivo para não mascarar o lucro líquido do dia.
- **Repasse Equilibrado de Taxas de Cartão:** Configuração transparente para dedução da taxa de maquininha de forma proporcional na comissão do barbeiro, eliminando atritos no dia do pagamento.

### Módulo 4: Club dos Chefes & Previsibilidade de Receita Recorrente (15 min)
- **A Máquina de Receita Previsível:** Transformar a sazonalidade da barbearia em assinaturas mensais pagas via cartão ou PIX recorrente.
- **Estruturação de Planos Lucrativos:**
  - *Plano Essencial:* 2 cortes por mês por um valor atrativo.
  - *Plano VIP Club:* Cortes ilimitados ou 4 cortes/mês + desconto em produtos de bancada.
- **Controle de Créditos Automatizado:** O sistema bloqueia abusos e debita créditos automaticamente no Checkout Expresso sem burocracia.
- **Remuneração da Equipe no Club:** Cada corte abatido pelo plano gera comissão garantida para o barbeiro com base no valor de face estabelecido pelo dono, motivando o time a apoiar o clube de assinaturas.

---

## 3. Exercícios Práticos Simulados (Hands-On no Demo Mode)

Acesse o sistema com perfil de Administrador e realize os 4 desafios executivos:

| Exercício | Cenário Operacional | Ação Prática Esperada |
|---|---|---|
| **Exercício 1** | O dono precisa saber qual barbeiro teve o maior faturamento e ticket médio da semana. | Acessar o Dashboard/Relatórios, filtrar por profissional e extrair o ranking de faturamento por cadeira. |
| **Exercício 2** | Identificar 5 clientes fiéis que sumiram há mais de 45 dias e disparar mensagens de reengajamento. | Acessar a tela Clientes, aplicar o filtro "Sem Visita > 45 Dias" e clicar no botão WhatsApp para gerar a mensagem personalizada. |
| **Exercício 3** | O fechamento de caixa apresentou uma falta de R$ 20,00 na gaveta de dinheiro. | Auditar o fechamento, verificar se houve alguma sangria esquecida e homologar o fechamento com justificativa registrada no sistema. |
| **Exercício 4** | Criar um novo plano de fidelidade para atrair executivos ("Club Executivo — 4 Cortes/Mês"). | Acessar Club dos Chefes > Planos, clicar em **+ Novo Plano**, definir o preço mensal em BRL, quantidade de 4 créditos e salvar. |

---

## 4. Avaliação Teórico-Operacional (Auto-Teste)

1. **Por que o Cockpit Executivo do SMG Barber contabiliza apenas transações já liquidadas?**
   - a) Para garantir que o faturamento reflita o dinheiro real que entrou na conta/caixa, sem ilusões de previsões teóricas.
   - b) Porque o sistema não sabe calcular estimativas.
   - c) Por uma limitação de espaço visual na tela.
   - d) Para pagar impostos antes da hora.
2. **Qual é o principal impacto financeiro de ativar o motor de reengajamento contra Churn via WhatsApp?**
   - a) Aumentar as contas telefônicas da barbearia.
   - b) Recuperar clientes antigos a um custo de aquisição (CAC) praticamente zero, aumentando o LTV (Lifetime Value).
   - c) Irritar clientes para que eles parem de cortar cabelo.
   - d) Cancelar o cadastro de quem não responder em 2 horas.
3. **Qual a diferença fundamental entre Comissão Teórica e Rateio de Fechamento de Caixa segundo o ADR-001?**
   - a) São a mesma coisa e usam as mesmas tabelas no banco de dados.
   - b) A comissão teórica apura o direito individual do barbeiro por serviço/produto prestado; o rateio de fechamento de caixa liquida e reconcilia o dinheiro físico/bancário efetivamente arrecadado no turno.
   - c) Comissão teórica é em dinheiro vivo e rateio é apenas em cartão.
   - d) O rateio exclui qualquer comissão dos funcionários.
4. **Como o Club dos Chefes ajuda a equilibrar o fluxo de caixa da barbearia no início do mês?**
   - a) Obriga os clientes a trabalhar na barbearia.
   - b) Gera receita previsível e recorrente no dia do vencimento do plano, garantindo o pagamento dos custos fixos da empresa.
   - c) Não traz nenhum benefício financeiro.
   - d) Faz com que os barbeiros ganhem menos.
5. **O que deve ser feito se o Fechamento de Caixa apontar uma diferença (sobra ou falta)?**
   - a) Alterar os valores do sistema até bater magicamente com a gaveta.
   - b) Apagar o histórico de comandas do dia.
   - c) Registrar a justificativa obrigatória e aprovar o fechamento com trilha de auditoria completa registrada.
   - d) Demitir a recepcionista imediatamente sem apurar o motivo.

*(Nota de corte para aprovação: 80% de acertos — mínimo 4 de 5 questões).*
