# ADR 029: Arquitetura de Automação de Engajamento (Fila de Espera e Lembretes)

## 1. Contexto e Problema
A Frente 3 (Automação de Engajamento) exige o envio de notificações assíncronas aos clientes da barbearia (ex: lembretes de agenda e alertas de vagas na fila de espera). O desafio central em um ambiente SaaS multi-tenant serverless (Vercel + Supabase) é:
- **Timezone:** O banco opera em UTC, mas as regras de negócio de agendamento ocorrem no fuso horário local (`America/Sao_Paulo`).
- **Concorrência e Idempotência:** Uma queda de rede ou um cold start prolongado de uma Edge Function pode causar retentativas invisíveis. O cliente não pode receber 3 e-mails ou pushes para o mesmo lembrete.
- **Falsos Positivos na Fila de Espera:** Se um profissional altera o horário de um cliente e logo desfaz a ação (ou cancela e reagenda imediatamente), disparar um webhook instantâneo gera notificações de fila enganosas.

## 2. Decisão

Adotaremos uma arquitetura híbrida no Supabase, segregando eventos baseados em tempo (Time-Driven) e baseados em mutação de dados (Event-Driven), ambos blindados por chaves de idempotência no PostgreSQL.

### 2.1. Lembretes (Time-Driven via `pg_cron`)
1. **Agendador:** O `pg_cron` executará uma rotina a cada 15 minutos.
2. **Workers Restritos:** A rotina fará um `POST` (usando `pg_net`) para a Edge Function `process-reminders`.
3. **Resolução de Timezone:** A Edge Function não fará cálculo de horas no código (Deno/JS). Ela invocará a RPC `claim_due_reminders()`, delegando a query de período e cast de fuso horário exclusivamente para o PostgreSQL (`AT TIME ZONE`).
4. **Idempotência Forte:** Antes de retornar os clientes a notificar, a RPC utilizará `SELECT ... FOR UPDATE SKIP LOCKED` contra a nova tabela `appointment_reminder_logs`. A chave composta `(tenant_id, appointment_id, reminder_type)` garantirá que um lembrete processado jamais seja reencaminhado.

### 2.2. Fila de Espera (Event-Driven via `pg_net` com Debounce)
1. **Gatilho Desacoplado:** Um Trigger monitorará transições `UPDATE appointments SET status = 'CANCELED'`.
2. **Mecanismo de Debounce (Atraso):** Em vez de acionar a notificação instantaneamente, o Trigger publicará o evento na fila interna de tarefas (dispatcher) agendado para `NOW() + INTERVAL '2 minutes'`.
3. **Validação Final:** Quando a Edge Function `waitlist-notifier` processar a tarefa 2 minutos depois, ela validará o status atual. Se o agendamento não estiver mais `CANCELED`, o evento será descartado em silêncio.
4. **Matching First-Come, First-Served:** Se confirmado, o worker cruza o horário liberado com os blocos da tabela `waitlist` (respeitando o `tenant_id`) e dispara o webhook/email mudando o status da fila para `NOTIFIED`. A confirmação da reserva na UI lidará com o lock em tempo real caso dois clientes cliquem juntos.

## 3. Consequências
- **Positivo:** Resiliência total contra falsos positivos operacionais e duplicação de mensagens.
- **Positivo:** A lógica de timezone (a maior causa de bugs em agendamentos) fica centralizada no banco, imune ao fuso do servidor de origem da request.
- **Risco Mitigado:** A Service Role nas Edge Functions só trafega dados pós-filtro RPC, prevenindo vazamentos cross-tenant.

## 4. Status
**Aprovado por:** Augusto (PO)
**Data:** 26 de Outubro de 2026
