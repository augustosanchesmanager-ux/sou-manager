# ADR-016: Dispatcher Server-side — Autoridade de Processamento Assíncrono Multi-tenant

**Status:** Accepted (2026-08-27 — **APROVADO PELO PO**; implementação D8 autorizada)
**Date:** 2026-08-27
**Deciders:** PO (Augusto) + OpenCode
**Prerequisite:** D8 Read-Only Diagnostic (`docs/audit/D8_READONLY_DIAGNOSTIC_20260827.md`)
**Supersedes/Blocks:** Bloqueia a certificação de produção do ADR-015 (observabilidade)

---

## Context

### O problema (D8)

O outbox financeiro (`outbox_items` → `Dispatcher` → `FinanceProvider` → `commission_records`) é consumido por um loop de dispatch **client-side** (`setInterval` ~5s em `useEventInfrastructure()`/`App.tsx`), que depende de **um browser autenticado do tenant** para operar sob o contexto RLS correto.

Evidência em produção (comanda `63742efa`, tenant B34H `f53427f0`): o item ficou **pending** indefinidamente porque **nenhuma sessão do tenant rodava o loop**. O D8 é, portanto, **limitação estrutural comprovada**, não regressão do D7 nem falha do watchdog ADR-015.

### Dois achados bloqueadores (do diagnóstico A-1 / A-2)

1. **Claim não é atômico para concorrência:** `findNext()` usa `SELECT LIMIT 1` + `UPDATE ... AND status='pending'` (optimistic lock). A documentação alega `FOR UPDATE SKIP LOCKED`, mas **não existe RPC** implementando isso. Para worker concorrente, o claim precisa ser serializado no banco.
2. **Erro de banco vira `null`:** `findNext()` captura erro de query e retorna `null`, então "não consegui consultar a fila" é indistinguível de "fila vazia". O health de execução (`heartbeat`) não prova health de pipeline.

### A pergunta central do ADR-016 (autoridade)

> **Quem tem autoridade para retirar um evento da fila e processá-lo, sem depender da sessão de um usuário?**

**Não** pode virar "`service_role` processa tudo". O contrato certificado (Trilha C + D7) deve permanecer:

```text
tenant_id explícito → claim isolado → processamento idempotente → retry → dead-letter → reversal
```

---

## Problem

Retirar o dispatcher do browser, estabelecendo uma **autoridade de processamento assíncrono server-side**, de modo que:

1. Não dependa de sessão de usuário/browser para drenar a fila;
2. Preserve isolamento multi-tenant (`tenant_id`);
3. Tenha **claim atômico** (concorrência segura entre múltiplas instâncias do worker);
4. Preserve idempotência financeira, retry, dead-letter e reversal (contrato D7/Trilha C);
5. Tenha **health semântico** (distinga worker vivo de fila saudável);
6. Seja observável e auditável, com **menor privilégio possível**;
7. Permita **rollback** (voltar ao client-side) e **reprocessamento de itens legados** (incl. `63742efa`).

---

## Decision (proposta de design — pendente aprovação do PO)

### D-1. O claim da fila é resolvido no banco, de forma atômica

**Independente do runtime**, o claim DEVE ser um RPC server-side com `FOR UPDATE SKIP LOCKED`, contido em transação única:

```plpgsql
-- (esboço conceitual — implementação só após aprovação)
CREATE OR REPLACE FUNCTION public.claim_next_outbox_item()
RETURNS TABLE (...)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.outbox_items
     SET status = 'processing',
         processing_started_at = now(),
         claimed_by = 'worker',
         dispatched_at = now(),
         updated_at = now()
   WHERE id = (
         SELECT id FROM public.outbox_items
          WHERE status = 'pending'
          ORDER BY created_at
          FOR UPDATE SKIP LOCKED
          LIMIT 1
   )
   RETURNING *;
END;
$$;
```

- **Requisito:** superfície `SECURITY DEFINER` mínima e auditada; **nunca** `service_role` no frontend; grants conforme ADR-012 (least-privilege).
- O `FOR UPDATE SKIP LOCKED` garante que **múltiplos workers** tomem itens **distintos** sem double-claim e sem deadlock.
- Isolamento por `tenant_id`: o item carrega `tenant_id`; o processamento (FinanceProvider) resolve e valida o tenant do item **dentro** do mesmo contexto transacional.

### D-2. A autoridade de execução (quem processa)

Recomendação: **Edge Function worker** rodando como agente de processamento, **ofertando o claim atômico do banco** (D-1) e delegando a execução do `FinanceProvider` (regra financeira já certificada) — mantendo a lógica de negócio em TypeScript, sem reescrever o contrato financeiro em PLpgSQL.

- A Edge Function usa **contexto de tenant resolvido por item** (não uma sessão de usuário), via chamada ao RPC de claim + validação.
- **Nunca** `service_role` indiscriminado: a função usa credencial que só invoca os RPCs de claim/processamento auditados (superfície mínima).

### D-3. Comparação de mecanismos (pg_cron vs Edge Function vs worker externo)

| Opção | Vantagem | Desvantagem | Decisão (recomendada) |
|-------|----------|-------------|------------------------|
| **pg_cron + função SQL de claim/processamento** | Transacional, zero infra; claim + processamento no mesmo X | Acopla regra financeira ao banco; complexo p/ lógica de negócio (FinanceProvider em TS) | 🟡 **Boa para o claim/ciclo**, mas limitado se o processamento precisar de TS |
| **Edge Function worker** (agendada) | Precedente no projeto (`notification-sweep`); processamento em TypeScript; prática | Requer credencial e agendamento (cron/dedicação) | 🟢 **Recomendado** (claim atômico no banco + processamento TS) |
| **Worker externo dedicado** | Máxima flexibilidade/isolamento | Infra/operacional maior | 🟡 Só se houver necessidade operacional real |
| **Continuar client-side** | Zero mudança | Não resolve D8 | 🔴 Rejeitado |

**Conclusão recomendada (a confirmar pelo PO):** **Edge Function worker + claim atômico no banco (`FOR UPDATE SKIP LOCKED`)**. O claim e a serialização ficam no Postgres (D-1); o processamento financeiro permanece em TypeScript (FinanceProvider existente), sem reescrever o contrato D7.

### D-4. Health semântico (corrige o achado A-2)

O novo worker DEVE expor, separando "worker vivo" de "pipeline saudável":

```text
DISPATCHER_ALIVE            (o loop/worker está executando)
QUEUE_QUERY_HEALTHY         (findNext/claim consultou com sucesso — erro de query ≠ fila vazia)
QUEUE_DEPTH                 (pending / processing / published / dead_letter)
STALE_ITEMS                 (processing > limiar → recovery)
DEAD_LETTERS
LAST_SUCCESSFUL_DISPATCH
LAST_DISPATCH_ERROR
OLDEST_PENDING_AGE          (alerta por idade do item mais antigo — pegaria 63742efa)
```

- **Correção obrigatória:** erros de query do outbox **não** podem ser silenciados como "fila vazia" — devem alimentar `LAST_DISPATCH_ERROR` e alerta.
- Integração com o dashboard/health do ADR-015 (tab Pipeline) para expor a health semântica do worker.

### D-5. Failure / Retry / Reversal / Idempotência (preservar contrato)

- **Retry/dead-letter:** já existem em `outbox_items` (Trilha C). O worker reutiliza o mesmo fluxo; sem alteração de contrato.
- **Idempotência:** `processed_operations` continua como ledger; `FinanceProvider` reutilizado.
- **Reversal:** contrato D7/Trilha B intacto; o worker não altera regra de reversal.
- **Rollback:** feature flag que alterna despacho server-side ↔ client-side, permitindo reverter a qualquer momento.

### D-6. Observabilidade e auditoria

- Logs estruturados com `eventId` + `tenantId` + `correlationId` (padrão ADR-015).
- Métricas de health semântico (D-4) persistidas/consultáveis.
- Rastreio de quem reclamou/processou cada item (`claimed_by`).

### D-7. Agendamento do worker

- Edge Function precisa de agendamento. A decidir no design detalhado: Supabase **pg_cron** para invocar a Edge Function (via `pg_net`/HTTP) **ou** Vercel Cron → Edge Function **ou** Supabase Cron (Edge Function schedule no `config.toml`).
- Nenhuma escolha de agendamento é feita antes da aprovação do ADR; o claim serializado no banco (D-1) torna o mecanismo de disparo indiferente p/ corretude (vários disparos são seguros).

### D-8. Reprocessamento de itens legados (incl. `63742efa`)

- Após o D8 em produção, **procedimento oficial** de reaprocessamento pelo mecanismo de claim (não bypass). O `63742efa` entra na fila normal e é processado idempotentemente.
- **Nada** de `INSERT/UPDATE` manual, credencial, ou bypass de RLS.

---

## Alternatives Considered

- **A1 — Manter client-side:** rejeitado (não resolve D8; fila fica refém de browser).
- **A2 — `service_role` no worker com acesso irrestrito:** rejeitado (transforma o worker em superusuário; quebra isolamento/auditoria).
- **A3 — Reescrever todo o processamento financeiro em PLpgSQL via pg_cron:** avaliado; acopla regra de negócio ao banco e duplica a lógica do FinanceProvider. Preferível manter processamento em TS com claim no banco.
- **A4 — Edge Function worker com claim atômico no banco (D-1/D-2):** **recomendado**.
- **A5 — Worker externo dedicado:** reserva caso A4 seja insuficiente operacionalmente.

---

## Consequences

**Positivas**
- Fila drena **sem** depender de sessão/browser → elimina a condição que originou o D8.
- Claim atômico no banco → concorrência segura e escalável.
- Health semântico → distingue worker vivo de pipeline saudável (resolve A-2).
- Contrato D7/Trilha C preservado (idempotência, retry, dead-letter, reversal).
- Rollback via feature flag.

**Negativas / Trade-offs**
- Nova superfície server-side (Edge Function + agendamento) a manter/operar.
- Risco de privilégio elevado — mitigado por superfície `SECURITY DEFINER` mínima + auditoria.
- Não reescreve a regra financeira; depende do FinanceProvider em TS (mantido).

**Decisão de processo**
- ADR-016 é **Proposed**; **não implementa nada** até aprovação explícita do PO.
- Após aprovação, seguir trilha: implementação → testes concorrência/chaos → auditoria → produção.
- **Só então** ADR-015 PROD CERTIFIED (desbloqueio condicionado ao D8).

---

## Status

**Accepted (2026-08-27)** — APROVADO PELO PO. Implementação do D8 autorizada. Uma única trilha ativa (D8). Requisitos obrigatórios de design antes do código: **claim atômico no banco (`FOR UPDATE SKIP LOCKED`) + Edge Function worker + isolamento por `tenant_id` + health semântico**; agendamento (D-7) pode permanecer em aberto desde que não afete a corretude, mas a implementação DEVE tornar explícito como o worker é acionado em produção e como detectamos que parou de ser acionado.
