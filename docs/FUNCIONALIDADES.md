# 📄 Documentação de Funcionalidades - SOU MANA.GER

Esta documentação detalha todas as funcionalidades atuais do sistema **SOU MANA.GER**, refletindo as atualizações mais recentes de infraestrutura, segurança e o novo design **Neo-Premium Boutique Edition**.

---

## 🚀 1. Núcleo Operacional (O Coração da Barbearia)

### 📅 Agendamentos (`/schedule`)

* **Calendário Interativo**: Visualização diária/semanal de horários com suporte a drag-and-drop.
* **Gestão de Status**: Marcar como confirmado, em atendimento, finalizado ou cancelado.
* **Agendamento Rápido**: Atalho no dashboard para criar novos horários em segundos.
* **Conflitos**: Sistema inteligente que evita sobreposição de horários para o mesmo profissional.

### 💳 Checkout / PDV (`/checkout`)

* **Terminal de Vendas**: Interface otimizada para finalização rápida de atendimentos e venda de produtos.
* **Pagamentos Múltiplos**: Suporte a Dinheiro, PIX, Cartões e Crédito em conta.
* **Baixa Automática**: Integração com estoque e financeiro ao finalizar uma venda.
* **Emissão de Recibos**: Geração instantânea de comprovantes autenticados com marca d'água.

### 📝 Comandas (`/comandas`)

* **Controle de Consumo**: Gestão de produtos e serviços consumidos durante a permanência no local.
* **Abertura via QR**: Integração com o Totem para clientes abrirem suas próprias comandas.
* **Histórico de Comandas**: Consulta de tickets passados e auditoria de vendas detalhada.

---

## 👥 2. Gestão de Cadastros (CRM & Recursos)

### 👤 Clientes (`/clients`)

* **Ficha Completa**: Cadastro de nome, telefone, e-mail e data de nascimento.
* **Faturamento Individual**: Visualização do total gasto e última visita por cliente.
* **Importação/Exportação CSV**: Facilidade para migrar bases de dados existentes.
* **Ficha Completa**: Cadastro de nome, telefone, e-mail e data de nascimento.
* **Faturamento Individual**: Visualização do total gasto e última visita por cliente.
* **Importação/Exportação CSV**: Facilidade para migrar bases de dados existentes.
* **Edição Premium**: Modal moderno para atualização completa de dados e preferências.

### ✂️ Equipe & Profissionais (`/team`)

* **Gestão de Staff**: Cadastro de barbeiros, recepcionistas e gerentes com RLS seguro.
* **Comissões**: Configuração individual de ganhos e participação percentual.
* **Status em Tempo Real**: Monitoramento de quem está disponível ou em atendimento.

### 💎 Planos e Investimento

| Plano | Mensal | Anual (2 meses OFF) | Foco |
| :--- | :--- | :--- | :--- |
| **Gratuito** | R$ 0,00 | R$ 0,00 | Iniciantes |
| **Profissional** | R$ 59,90 | R$ 599,00 | Gestão Completa |
| **Elite** | R$ 99,90 | R$ 999,00 | IA & Escala |

### 📦 Produtos & Estoque (`/products`)

* **Controle de Ativos**: Cadastro de produtos para venda e uso profissional.
* **Alerta de Estoque Baixo**: Notificações automáticas quando itens atingem o nível crítico.
* **Histórico de Movimentação**: Registro de entradas e saídas de produtos com auditoria.

---

## 📊 3. Gestão Estratégica & BI

### 🧠 Visão de Negócio (BI) (`/bi`)

* **Análise Preditiva**: Insights gerados via **IA (Gemini)** sobre tendências do negócio.
* **Gráficos Avançados**: Visualização de faturamento, ticket médio e CAC (Custo de Aquisição de Clientes).
* **Performance da Equipe**: Ranking de produtividade e lucratividade por profissional.

### 📈 Relatórios (`/reports`)

* **Financeiro**: Fluxo de caixa detalhado e DRE simplificado.
* **Aniversariantes**: Listagem de clientes com data próxima para ações de marketing.
* **Exportação**: Geração de PDFs e planilhas de todos os indicadores.

---

## 💰 4. Módulo Financeiro Avançado

### 💵 Fluxo Financeiro (`/financial`)

* **Controle de Saldo**: Monitoramento de entradas por método de pagamento.
* **Conciliação**: Verificação de transações pendentes e confirmadas.

### 📝 Gestão de Recibos (`/receipts`)

* **Numeração Sequencial**: Controle fiscal e administrativo de comprovantes em conformidade.
* **Assinatura Digital**: Recibos autenticados para segurança jurídica.
* **Marca D'água Dinâmica**: Layout premium com logo da barbearia.

### 📋 Folha de Pagamento (`/payroll`)

* **Cálculo Automatizado**: Fechamento de quinzena/mês baseado em comissões e serviços realizados.
* **Lançamentos Manuais**: Adição de bônus ou descontos personalizados.
* **Comprovantes de Pagamento**: Geração de holerites detalhados para o staff.

---

## 🔄 5. Motor de Retorno Inteligente (Smart Return)

O sistema analisa automaticamente o comportamento de cada cliente e identifica quando ele provavelmente está na hora de cortar novamente.

* **Cálculo de Média**: Cada cliente possui um intervalo médio de retorno baseado no histórico.
* **Níveis de Alerta**:
  * 🟢 **Normal**: Recente (ex: João cortou há 10 dias, média 18).
  * 🟡 **Ação Sugerida**: Próximo da média (ex: 20 dias).
  * 🔴 **Crítico**: Ultrapassou a média (ex: 25 dias).
* **Automações**: Sugestão de agendamento, envio de lembretes e geração de promoções automáticas.

---

## 🛡️ 6. Painéis de Controle & Especializados

### 👑 Super Admin (`/admin`)

* **Ecossistema SaaS**: Gestão de todos os tenants (unidades) cadastrados.
* **Aprovação de Acessos**: Controle de novos cadastros (pendente, ativo, suspenso).
* **Gestão de Planos**: Mudança de planos (Starter, Professional, Elite) diretamente no Admin.
* **Console de Logs**: Monitoramento técnico da infraestrutura em tempo real.

### 📱 Portal do Cliente (`/portal`)

* **Painel do Cliente**: Consulta de atendimentos passados e agendamentos futuros.
* **Avaliações & Feedbacks**: Sistema de classificação de 1 a 5 estrelas após o serviço.
* **Agendamento Online**: Interface simplificada para o cliente marcar seu próprio horário.

### 🏪 Totem / Kiosk (`/totem`)

* **Autoatendimento**: Interface simplificada para tablets fixos na recepção.
* **Check-in Rápido via QR**: Entrada do cliente identificada pelo sistema de forma autônoma.
* **Abertura de Comandas**: Automação que agiliza o fluxo inicial do atendimento.

---

## 🎨 7. Design System & UX

* **Neo-Premium Boutique**: Interface minimalista com tons de dourado, preto vulcânico e emerald.
* **Dark/Light Mode**: Suporte total a temas claro e escuro.
* **Responsividade**: Experiência fluida em computadores, tablets e smartphones.

---
*Documentação atualizada em: 05/03/2026*
