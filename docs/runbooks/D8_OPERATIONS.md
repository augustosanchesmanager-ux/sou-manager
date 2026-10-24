# Runbook — Operações do Worker de Outbox D8 & pg_cron

> Referência: Subfase 6.8 (Documentação Operacional) — Fase 6: Production Readiness  
> Aplicação: SMG Barber (Processamento Financeiro Assíncrono)  
> Última Atualização: 2026-10-24

---

## 1. Visão Geral da Arquitetura D8

O pipeline D8 é responsável pelo processamento assíncrono e confiável de eventos financeiros de domínio (ex: liquidação de comandas, comissões e transações de outbox):

```
pg_cron (Scheduler)
       ↓
pg_net (HTTP POST)
       ↓
worker-dispatcher (Edge Function)
       ↓
RPCs Financeiras (via role worker_dispatcher — NOLOGIN, RLS Ativo)
```

### Regras Invioláveis de Arquitetura:
- **Sem `service_role` no Data Path:** O worker **nunca** executa sob privilégios de `service_role`. Ele opera sob a role restrita `worker_dispatcher`.
- **Canônicos Intocáveis:** Não alterar arquivos canônicos de cálculo financeiro (`domain/commission/{calculate,participants,types}.ts`, `shared/numbers/normalize.ts`).
- **Verificação Contínua:** Divergência entre código de produto e o bundle exportado da Edge Function exige parada imediata (`npm run d8:verify`).

---

## 2. Monitoramento de Jobs no `pg_cron`

Para inspecionar o agendamento e a execução dos jobs do cron no PostgreSQL remoto:

### Consultar Jobs Agendados
```sql
SELECT jobid, schedule, command, nodename, nodeport, database, username, active
FROM cron.job;
```

### Consultar Histórico de Execuções Recentes
```sql
SELECT jobid, runid, job_pid, database, username, command, status, return_message, start_time, end_time
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 20;
```

> ⚠️ **Atenção:** Nunca execute `UPDATE` direto na tabela `cron.job` (resultará em `Permission Denied`). Para alterar parâmetros de um job, use sempre o par `cron.unschedule(job_id)` e `cron.schedule(...)`.

---

## 3. Diagnóstico e Resolução de Erros Comuns

### Cenário 1: Worker respondendo com HTTP 503
- **Causa Raiz Comum:** O secret `EDGE_JWT_SECRET` foi configurado no Supabase Dashboard, mas não foi propagado/injetado no Edge Runtime após redeploy da função.
- **Ação:**
  1. Forçar o redeploy da função `worker-dispatcher` via Supabase CLI ou Dashboard.
  2. Verificar se o secret está visível nas variáveis de ambiente da Edge Function.

### Cenário 2: Acúmulo de Eventos Pendentes no Outbox
- **Causa Raiz Comum:** Eventos travados com falha consecutiva ou lock prolongado.
- **Ação:**
  1. Inspecionar a tabela de outbox:
     ```sql
     SELECT id, event_type, status, retry_count, next_retry_at, error_details
     FROM domain_events_outbox
     WHERE status IN ('pending', 'failed')
     ORDER BY created_at ASC
     LIMIT 50;
     ```
  2. Verificar se há itens com `retry_count >= max_retries` movidos para dead-letter.
  3. Corrigir o problema subjacente (ex: dados corrompidos ou timeout de RPC) e resetar o status para `pending` com `next_retry_at = now()`.

---

## 4. Procedimento de Verificação de Integridade

Antes de qualquer deploy ou após alterações em regras de comissão/financeiro, execute localmente a prova de integridade:

```bash
# Validar paridade entre TypeScript de domínio e bundle exportado do worker
npm run d8:verify
```

Se o comando reportar divergência (`DIVERGENCE DETECTED`), **não realize deploy**. Alinhe os canônicos imediatamente.
