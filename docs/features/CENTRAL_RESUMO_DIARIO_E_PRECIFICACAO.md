# Central de Resumo Diário & Estudo de Precificação Comercial

> **Documento Estratégico & Técnico — SMG Platform (SMG Barber)**
> **Data:** 2026-11-07
> **Responsável:** Engenharia & Arquitetura SMG
> **Aprovador:** Augusto (PO)

---

## 1. Visão Geral & Proposta de Valor

A **Central de Resumo Diário Executivo** é um módulo projetado para fornecer aos proprietários e gestores de barbearias uma visão em tempo real do fechamento operacional e financeiro do dia, sem a necessidade de esperar o fechamento formal de caixa ou exportação de relatórios complexos.

### Principais Dores Solucionadas:
1. **Falta de clareza diária:** O gestor precisa saber se o dia atingiu a meta sem ter que somar comandas manualmente.
2. **Custo elevado de mensageria:** Ferramentas de mercado cobram taxas abusivas por mensagens de WhatsApp ou exigem APIs pagas em dólar (Meta Cloud API / Twilio).
3. **Comunicação descentralizada com a equipe:** Dificuldade em compartilhar o desempenho do dia e parabenizar os barbeiros de forma ágil e padronizada.

---

## 2. Arquitetura da Solução

O módulo opera integrado à infraestrutura existente do SMG Barber (`comandas`, `appointments`, `transactions`, `staff`), sem duplicar dados nem criar tabelas pesadas de consolidação desnecessárias.

### 2.1 Camada de Dados & Segurança (RLS / Multi-tenant)
- **Isolamento Estrito:** Todas as consultas filtram rigorosamente por `tenant_id` e obedecem às políticas de RLS e ao `SECURITY DEFINER` do Supabase.
- **RPC / Agregação Otimizada:** Aproveita o endpoint `fetchTodayDashboardData` que calcula dinamicamente:
  - Faturamento em comandas pagas no dia (`comandas.status = 'paid'`);
  - Status dos agendamentos (`completed`, `in_progress`, `pending`, `cancelled`);
  - Ticket médio por cliente atendido;
  - Identificação do barbeiro destaque do dia por volume de atendimentos concluídos.

### 2.2 Camada de Apresentação (Frontend)
- Componente dedicado: `DailySummaryExecutiveCard.tsx` integrado diretamente na raiz do `pages/Dashboard.tsx`.
- Total conformidade com o Design System SMG (sem cores proibidas, visual atelier tech sofisticado com microinterações e dados tabulares legíveis).

---

## 3. Matriz de Funcionalidades por Tier

| Funcionalidade | Starter (Base) | Pro (Recomendado) | Enterprise / Rede |
| :--- | :---: | :---: | :---: |
| **Card Executivo no Dashboard** | ✅ Incluso | ✅ Incluso | ✅ Incluso |
| **4 KPIs em Tempo Real** (Faturamento, Atendimentos, Ticket Médio, Ocupação) | ✅ Incluso | ✅ Incluso | ✅ Incluso |
| **Destaque do Profissional do Dia** | ✅ Incluso | ✅ Incluso | ✅ Incluso |
| **Disparo WhatsApp via Link (wa.me)** *(Custo Zero de API)* | ✅ Incluso | ✅ Incluso | ✅ Incluso |
| **Disparo Automático de E-mail de Fechamento** | ❌ Manual | ✅ Automático (fim do dia) | ✅ Automático + Multi-destinatários |
| **Disparo 100% Automático via WhatsApp Bot** | ❌ Não disponível | 💡 Add-on Pago | ✅ Incluso no pacote |
| **Histórico Consolidado Multi-Unidades** | ❌ Não disponível | ❌ Não disponível | ✅ Incluso |

---

## 4. Análise de Custos de Infraestrutura & Operação

Uma premissa central estabelecida pelo PO é a **redução de custos na fase inicial de tração**:

### 4.1 Estratégia de Custo Zero (Ativa no Sistema):
1. **Compartilhamento WhatsApp via Deep Link (`wa.me` / `api.whatsapp.com`):**
   - **Custo para a SMG:** **R$ 0,00**
   - **Como funciona:** O sistema monta o texto completo formatado com emojis e quebras de linha e abre diretamente o WhatsApp Web / App móvel do gestor. Ele clica e envia instantaneamente para o grupo da equipe ou sócios.
2. **Disparo Transacional via E-mail:**
   - **Custo para a SMG:** Desprezível (< R$ 0,001 por envio usando provedores modernos como Resend ou Amazon SES, com milhares de envios gratuitos mensais).

### 4.2 Estratégia Futura (Automação Nativa por Bot):
- No momento em que houver demanda por envio sem intervenção humana às 22h, a barbearia ativa o **Add-on WhatsApp Pro**.
- O custo da API (ex: ~R$ 0,35 a R$ 0,45 por conversa Meta) é repassado integralmente para a mensalidade do cliente com margem de lucro.

---

## 5. Sugestão de Modelagem de Preços & Monetização

### Opção A: Como Diferencial de Retenção no Plano Padrão
- Oferecer o **Resumo Diário Executivo no Dashboard + Compartilhamento no WhatsApp com 1 clique** gratuitamente em todas as contas ativas do SMG Barber.
- **Objetivo:** Gerar dependência operacional e hábito diário nos donos de barbearia (o dono consulta o SMG toda noite para ver quanto faturou).

### Opção B: Add-on "Central de Automações & Inteligência Diária"
- **Valor Sugerido:** **R$ 49,90 / mês** por barbearia.
- **Incluso no Add-on:**
  - E-mails automáticos diários para contabilidade e sócios;
  - Lembretes automáticos de agendamento por e-mail;
  - Relatório executivo semanal comparativo de metas;
  - Templates customizáveis de WhatsApp com 1 clique.

### Opção C: Upgrade para o Plano "SMG Barber Pro"
- **Valor do Plano:** **R$ 149,90 / mês** (vs R$ 89,90 no plano básico).
- O módulo de Resumo Diário com automação entra como o principal chamariz do plano Pro, justificando o salto de ticket.

---

## 6. Próximos Passos
1. Validar a experiência de uso com barbearias pilotos (ex: Sr. Avante e Sanchez Barber).
2. Colher feedback dos gestores sobre o texto pré-formatado do WhatsApp.
3. Decidir o modelo comercial oficial (Opção A, B ou C) com o PO.
