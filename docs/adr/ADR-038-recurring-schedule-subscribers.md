# ADR-038: Horário Fixo Recorrente para Assinantes Chef Club com Yield Management e Janela Rolante

**Status:** Accepted  
**Date:** 2026-10-27  
**Deciders:** PO (Augusto) + Antigravity (Visão ATLAS)  
**Front:** Módulo Chef Club & Agenda (SMG Barber)  

---

## 1. Context

O **SMG Barber** dispõe de um módulo de assinaturas e clube de benefícios maduro (**Chef Club**, `domain/chefClub/`), que gerencia planos recorrentes, ciclos de faturamento e ledger de créditos de serviços (`customer_plan_credit_usages`).

No modelo operacional de barbearias de alto padrão, a "cadeira cativa" (horário fixo semanal ou quinzenal garantido, ex: toda quinta-feira às 18h com o profissional de preferência) é a principal alavanca de valor percebido, fidelização e aumento de LTV (*Lifetime Value*).

Entretanto, o inventário de tempo de uma barbearia é um ativo estritamente perecível: um horário vago às 18h de quinta-feira não pode ser estocado ou recuperado. Uma modelagem ingênua de agendamento recorrente gera vazamento crônico de receita através de:
1. Inadimplência de mensalidade com retenção indevida de horários nobres;
2. *No-show* (não comparecimento) sem ônus para o cliente, desvalorizando o tempo do barbeiro;
3. Poluição do banco de dados gerando dezenas de agendamentos no futuro sem faturamento confirmado;
4. Conflitos de agenda com folgas, férias e feriados (`scheduleBlocksApi`).

---

## 2. Problem

1. **Risco de Inadimplência com Bloqueio de Inventário:** Se o cartão de crédito do assinante falhar e a assinatura entrar em `past_due`/`overdue`, a barbearia não pode continuar com a cadeira reservada no horário nobre. Liberação manual não escala e gera perda de faturamento.
2. **Desperdício de Capacidade por No-Show:** Clientes de planos ilimitados ou com créditos mensais tendem a desmarcar em cima da hora ou faltar se não houver consequência direta no saldo de benefícios.
3. **Conflito de Disponibilidade do Barbeiro:** Profissionais possuem folgas programadas, férias ou pausas (`ScheduleBlock`). O sistema precisa arbitrar prioridades sem gerar atrito ou cancelamento cego.
4. **Ciclo de Cobrança vs. Agendamento:** O agendamento futuro só pode existir enquanto o ciclo correspondente estiver quitado.

---

## 3. Decision

Adota-se a arquitetura de **Horário Fixo Recorrente com Janela Rolante e Yield Management** fundamentada em 4 pilares:

### D1: Horizonte de Geração por Janela Rolante (15 a 30 dias / Ciclo Faturado)
- Não serão gerados agendamentos para horizontes longos (anuais/semestrais).
- A materialização física do agendamento na tabela `appointments` ocorre apenas para a **janela de 15 a 30 dias correspondente ao ciclo de faturamento vigente e efetivamente pago**.
- A geração é disparada automaticamente no evento de quitação da fatura do ciclo (`ReceivableStatus = 'paid'`) ou via rotina periódica idempotente.

### D2: Despejo Automático por Inadimplência (Grace Period de 3 a 5 dias)
- Se a cobrança da recorrência falhar e a assinatura transicionar para `past_due` / `overdue`:
  - Dispara-se a régua de cobrança automática;
  - Concede-se uma tolerância operacional de **3 a 5 dias corridos**;
  - Decorrido o prazo sem regularização, uma rotina de saneamento (`evict_overdue_subscription_appointments`) **cancela automaticamente** os agendamentos futuros não realizados daquele ciclo, liberando imediatamente os slots na agenda pública.

### D3: Precedência de Bloqueio (`ScheduleBlock`) e Compensação por Crédito Avulso
- O bloqueio de agenda do profissional (`schedule_blocks`, ex: férias, feriado, pausa médica) tem **precedência absoluta** sobre a recorrência.
- Se a data do horário fixo colidir com um bloqueio ativo:
  - O agendamento daquela semana **não é gerado**;
  - O assinante é notificado proativamente pelo sistema;
  - É creditado **1 crédito avulso de serviço** (`customer_plan_credit_usages`), com validade restrita ao ciclo de faturamento atual, permitindo que o cliente faça o auto-agendamento de um horário alternativo diretamente no portal/app.

### D4: Yield Management de Créditos e Proteção contra No-Show
- **Débito na Geração:** O crédito de serviço do plano é debitado no momento em que o agendamento é materializado na janela rolante, garantindo que o slot na cadeira do barbeiro está garantido por saldo.
- **Cancelamento Antecipado (>= 12h):** Se o cliente cancelar o agendamento com antecedência mínima de 12 horas (configurável pelo tenant), o agendamento é cancelado e o crédito retorna integralmente para o saldo disponível do ciclo.
- **Cancelamento Tardio (< 12h) ou No-Show:** Se o cliente cancelar com menos de 12 horas ou faltar ao horário agendado, **o crédito é retido e perdido definitivamente**. A comanda associada é finalizada como ausência, protegendo a barbearia e educando o cliente sobre o custo da capacidade ociosa.

---

## 4. Data Contract & Modelagem

### 4.1 Nova Tabela: `subscription_recurring_slots`
Armazena a regra abstrata do horário fixo contratado pelo assinante.

```sql
CREATE TABLE IF NOT EXISTS public.subscription_recurring_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES public.customer_subscriptions(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    professional_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT,
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Domingo, 1=Segunda, ..., 6=Sábado
    start_time TIME NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT uq_slot_professional_time UNIQUE (tenant_id, professional_id, day_of_week, start_time)
);
```

### 4.2 Alterações em `appointments`
Inclusão de rastreabilidade de recorrência e proteção de ciclo:

- `recurring_slot_id`: UUID nullable apontando para `subscription_recurring_slots(id)`.
- `subscription_id`: UUID nullable apontando para `customer_subscriptions(id)`.
- `is_recurring`: BOOLEAN NOT NULL DEFAULT FALSE.
- `credit_usage_id`: UUID nullable vinculando ao débito no ledger de créditos.

### 4.3 RPCs de Automação e Isolamento
- `generate_subscription_recurring_appointments(p_tenant_id UUID, p_cycle_id UUID)`: Executa a materialização respeitando conflitos, feriados e disponibilidade de créditos.
- `evict_overdue_subscription_appointments(p_tenant_id UUID, p_grace_period_days INT)`: Realiza o cancelamento dos slots futuros de clientes inadimplentes.

---

## 5. Alternatives Considered

1. **Geração em lote para o ano todo:**  
   *Rejeitado.* Geraria centenas de registros fantasmas em caso de cancelamento e criaria atrito insustentável na agenda caso o profissional mudasse horários de trabalho.
2. **Reserva virtual sem agendamento no banco:**  
   *Rejeitado.* A agenda do SMG Barber (`Schedule.tsx`) e as comissões (`domain/commission/`) dependem da entidade concreta `appointments`. Não ter o registro inviabilizaria relatórios de ocupação e sincronização com comandas.
3. **Estorno de crédito irrestrito em No-Show:**  
   *Rejeitado.* Destrói a rentabilidade da barbearia em horários nobres (quinta a sábado). O inventário de horário nobre exige compromisso bilateral.

---

## 6. Consequences & Governance

### Positivas
- **Aumento de Retenção:** Assinantes têm a certeza do horário fixo garantido.
- **Proteção de Faturamento:** Cadeiras de inadimplentes são liberadas sem depender de ação humana.
- **Respeito ao Barbeiro:** Menos no-shows e remuneração preservada através de regras claras de cancelamento tardio.
- **Arquitetura Leve:** Banco de dados sem poluição de agendamentos fictícios distantes.

### Atenção & Invariantes
- **Multi-Tenant e RLS:** Todas as tabelas e RPCs devem aplicar rigorosamente a RLS tenant-scoped (`tenant_id = current_tenant_id_from_auth_uid()`).
- **Idempotência D8:** A geração de agendamentos deve ser estritamente idempotente (não duplicar agendamentos se a rotina rodar múltiplas vezes no mesmo dia).
- **Sem quebra de D7/D8:** Não altera o cálculo canônico de comissões nem as regras de fechamento de caixa (ADR-001).

---

## 7. Status

- **Status Atual:** Proposed
- **Próximos Passos:** Submissão para aprovação formal do PO (Augusto), seguida de migration e desenvolvimento dos serviços em branch dedicada.
