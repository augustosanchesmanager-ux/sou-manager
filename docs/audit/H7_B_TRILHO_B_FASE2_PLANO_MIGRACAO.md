# H-7 — Trilho B · Fase 2: Plano Operacional de Migração de Legacy API Keys (PROD)

> **Tipo:** Proposta read-only · **Mutation:** NENHUMA executada · **Status:** ⏸️ aguardando autorização
> **Data:** 2026-09-20 · **Responsável:** OpenCode (Tech Lead) + Augusto (PO)
> **Escopo:** Mapa executável de migração de `SUPABASE_ANON_KEY` (legacy JWT) e `SUPABASE_SERVICE_ROLE_KEY` (legacy JWT) para `SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_SECRET_KEY` (sb_secret_) no projeto PROD `ushsnmlbeurfvlkieiln`.
> **Produção:** `ushsnmlbeurfvlkieiln` — **INTACTA** (0 escritas, 0 rotações, 0 deploys)

---

## 1. Princípios da migração

1. **Janela de coexistência:** chaves antiga e nova coexistem durante toda a migração. Nenhum consumidor fica sem chave válida em nenhum momento.
2. **Granularidade por componente:** cada Edge Function é um deploy discreto; cada Vercel env var é editada independentemente. Rollback por unidade.
3. **Desativação legacy só após 100% dos consumidores validados:** nenhuma chave legacy é desativada enquanto houver consumidor referenciando-a.
4. **STAGING como canário:** toda mudança é primeiro aplicada em STAGING (`tjcvuhynckocmvtqykxp`), validada, só depois replicada em PROD.
5. **Dual-key temporário em Vercel:** durante a janela de transição, ambas as envs ficam presentes; frontend lê apenas a nova.
6. **Reversibilidade:** desativação de legacy key é reversível no Dashboard (AGENTS.md §D8 confirmou); se algo quebrar, reativação é um clique.

---

## 2. Pré-condições (responsabilidade do PO)

Antes de executar Fase 2, o PO deve confirmar manualmente:

| # | Pré-condição | Como verificar |
|---|--------------|----------------|
| P1 | Quais envs Vercel estão **deployadas** hoje? | Vercel Dashboard → Settings → Environment Variables (production) |
| P2 | Frontend usa `VITE_SUPABASE_ANON_KEY` ou `VITE_SUPABASE_PUBLISHABLE_KEY` (ou ambos)? | grep em `src/lib/supabase/client.ts` + Vercel Dashboard |
| P3 | pg_cron D8 está **ativo** em PROD? | `supabase db query --linked` em PROD: `SELECT * FROM cron.job WHERE jobname LIKE '%worker%'` |
| P4 | `worker-dispatcher` Edge Function está **deployada** em PROD? | `supabase functions list --project-ref ushsnmlbeurfvlkieiln` |
| P5 | Há janela de baixo tráfego planejada? | Decisão operacional do PO |

---

## 3. Mapa de consumidores

### Legenda das colunas

- **Chave atual:** env var consumida HOJE
- **Chave substituta:** env var que substituirá após migração
- **Local:** arquivo ou configuração onde a mudança ocorre
- **Ordem:** número de sequência na execução (ver §4)
- **Validação:** como confirmar que a mudança funcionou
- **Dependências:** pré-requisitos para esta mudança
- **Risco:** probabilidade/impacto de indisponibilidade
- **Migrado:** critério para marcar consumidor como concluído
- **Desativação:** ponto em que a legacy key pode ser removida com segurança para ESTE consumidor

---

### Grupo A — Vercel (Frontend + Server-side)

| # | Consumidor | Chave atual | Chave substituta | Local | Ordem | Validação | Dependências | Risco | Migrado quando | Legacy pode desativar quando |
|---|------------|-------------|------------------|-------|-------|-----------|--------------|-------|----------------|------------------------------|
| A1 | Frontend (browser bundle) | `VITE_SUPABASE_ANON_KEY` (legacy JWT) | `VITE_SUPABASE_PUBLISHABLE_KEY` (sb_publishable_) | Vercel Dashboard → Env vars + `src/lib/supabase/client.ts` (se hardcoded) | 1 | Deploy preview em Vercel → usuário faz login e operação CRUD | P1, P2 confirmados | 🟢 baixo (build-time, dual-key seguro) | Vercel deploy verde + smoke E2E login OK | Todos os outros consumidores (B, C, D) migrados |
| A2 | Server-side em Vercel (se houver) | `SUPABASE_SERVICE_ROLE_KEY` | `SUPABASE_SECRET_KEY` | Vercel Dashboard → Env vars | 2 | Serverless function invocada + log sem 401 | P1 confirmado | 🟡 médio (afeta SSR/API routes) | Function executada com sucesso + log limpo | Todos os outros consumidores migrados |

---

### Grupo B — Edge Functions (6 a migrar + 1 já migrada)

| # | Consumidor | Chave atual | Chave substituta | Local | Ordem | Validação | Dependências | Risco | Migrado quando | Legacy pode desativar quando |
|---|------------|-------------|------------------|-------|-------|-----------|--------------|-------|----------------|------------------------------|
| B1 | `portal-auth` | `SUPABASE_SERVICE_ROLE_KEY` | `SUPABASE_SECRET_KEY` | `supabase/functions/portal-auth/index.ts` linha 42 + secret no Dashboard | 3 | Invoke manual + log sem 401 | Secret `sb_secret_` criado no Dashboard PROD | 🟢 baixo | Deploy + invoke OK | Após B7 (D8 secret) também migrado |
| B2 | `admin-create-user` | `SUPABASE_SERVICE_ROLE_KEY` + `SUPABASE_ANON_KEY` | `SUPABASE_SECRET_KEY` (anon removido se não usado) | `supabase/functions/admin-create-user/index.ts` linhas 53,69 + secrets | 4 | Invoke + criação de user OK | Secret criado | 🟡 médio (operação sensível) | Deploy + invoke + user criado no auth | Após B7 |
| B3 | `invite-team-member` | `SUPABASE_SERVICE_ROLE_KEY` + `SUPABASE_ANON_KEY` | `SUPABASE_SECRET_KEY` | `supabase/functions/invite-team-member/index.ts` linhas 17,43 + secrets | 5 | Invite aceito + user em staff | Secret criado | 🟢 baixo | Deploy + invite OK | Após B7 |
| B4 | `supabase-usage-monitor` | `SUPABASE_SERVICE_ROLE_KEY` + `SUPABASE_ANON_KEY` | `SUPABASE_SECRET_KEY` | `supabase/functions/supabase-usage-monitor/index.ts` linhas 69,97 + secrets | 6 | Cron invocation + log limpo | Secret criado | 🟢 baixo | Deploy + cron tick OK | Após B7 |
| B5 | `site-sanchez-appointments` | `SUPABASE_SERVICE_ROLE_KEY` | `SUPABASE_SECRET_KEY` | `supabase/functions/site-sanchez-appointments/index.ts` linha 193 + secret | 7 | Invoke + listagem OK | Secret criado | 🟢 baixo | Deploy + invoke OK | Após B7 |
| B6 | `notification-sweep` | `SUPABASE_ANON_KEY` (legacy) | `SUPABASE_PUBLISHABLE_KEY` | `supabase/functions/notification-sweep/index.ts` linha 24 + secret | 8 | Cron sweep executa + notifications criadas | `sb_publishable_` criado | 🟡 médio (anon JWT tem claims diferentes) | Deploy + sweep tick OK + notifications geradas | Após A1 + C1 (frontend + D8 usam publishable) |
| B7 | `worker-dispatcher` | `SUPABASE_PUBLISHABLE_KEYS` (já nova) | manter | — | — | — | — | — | já migrada (mas blocker `EDGE_JWT_SECRET` separado) | — |

---

### Grupo C — pg_cron / D8

| # | Consumidor | Chave atual | Chave substituta | Local | Ordem | Validação | Dependências | Risco | Migrado quando | Legacy pode desativar quando |
|---|------------|-------------|------------------|-------|-------|-----------|--------------|-------|----------------|------------------------------|
| C1 | pg_cron D8 (Edge Function invocation) | `Authorization: Bearer <anon legacy>` no SQL de `cron.schedule` | `Authorization: Bearer <sb_publishable_>` | `supabase/migrations/20260827210000_d8_worker_schedule.sql` (migration nova para re-registro) | 9 | `worker_heartbeat` atualiza + `net._http_response` retorna 2xx | P3 confirmado (cron ativo) + nova publishable key | 🟠 alto (cron afeta produção contínua) | 3 ciclos consecutivos com heartbeat OK | Após A1 + B6 + próxima desativação legacy |

**Procedimento de re-registro (per AGENTS.md):** nunca `UPDATE` direto em `cron.job`. Usar:
```sql
SELECT cron.unschedule('worker-dispatcher');  -- nome exato do job atual
SELECT cron.schedule(
  'worker-dispatcher',
  '* * * * *',
  $sql$ select net.http_post(
    url := 'https://ushsnmlbeurfvlkieiln.supabase.co/functions/v1/worker-dispatcher',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <nova sb_publishable_>'
    ),
    body := '{}'
  ) $sql$
);
```

---

### Grupo D — Tests

| # | Consumidor | Chave atual | Chave substituta | Local | Ordem | Validação | Dependências | Risco | Migrado quando | Legacy pode desativar quando |
|---|------------|-------------|------------------|-------|-------|-----------|--------------|-------|----------------|------------------------------|
| D1 | `tests/e2e/helpers/supabaseAdmin.ts` | `SUPABASE_SERVICE_ROLE_KEY` | `SUPABASE_SECRET_KEY` | linha 49 + `dbAssertions.ts` linha 11 | 10 | E2E suite roda sem erro de auth | — | 🟢 baixo (local/CI) | E2E PASS | Após todas as funções migradas |
| D2 | `tests/e2e/validation/production-smoke.mjs` | `SUPABASE_SERVICE_ROLE_KEY` | `SUPABASE_SECRET_KEY` | linha 45 | 11 | Smoke PROD PASS | — | 🟢 baixo | Smoke PASS | Idem |
| D3 | `tests/homologation/h2-8/*.spec.ts` (3 files) | `SUPABASE_SERVICE_ROLE_KEY` | `SUPABASE_SECRET_KEY` | linha 72-115 | 12 | H2-8 suite PASS | — | 🟢 baixo | H2-8 PASS | Idem |
| D4 | `tests/e2e/setup/seed-chefclub-p03c.ts` | `SUPABASE_SERVICE_ROLE_KEY` | `SUPABASE_SECRET_KEY` | linha 6 | 13 | Seed executa | — | 🟢 baixo | Seed OK | Idem |

---

### Grupo E — Scripts (nenhuma alteração necessária)

Estes já leem de ambiente com nomes novos ou via login (não service_role). Sem mudança.

| # | Consumidor | Chave | Status |
|---|------------|-------|--------|
| E1 | `scripts/h7-*` | `H7_STAGING_SERVICE_ROLE_KEY`, `H7_STAGING_ANON_KEY` | ✅ já saneado (Turno anterior) |
| E2 | `scripts/ops/regularizacao/executar-baixa.mjs` | `SUPA_PRODUCTION_ANON` + login `REG_ADMIN_*` | ✅ usa anon para login (não service_role) |
| E3 | `scripts/ops/regularizacao/validar-baixa.mjs` | idem E2 | ✅ idem |
| E4 | `scripts/check-*.mjs`, `scripts/h7-deep-*.mjs` | `H7_*` (saneados) | ✅ idem E1 |

---

### Grupo F — Ambientes locais (`.env.local`)

| # | Consumidor | Chave atual | Chave substituta | Local | Ordem | Validação | Dependências | Risco | Migrado quando | Legacy pode desativar quando |
|---|------------|-------------|------------------|-------|-------|-----------|--------------|-------|----------------|------------------------------|
| F1 | `.env.local` PROD block | `SUPABASE_SERVICE_ROLE_KEY` (legacy iat=1771444410) | `SUPABASE_SECRET_KEY` (nova sb_secret_) | raiz do repo (gitignored) | 14 | `npm run dev` + login OK | PO fornece nova key | 🟢 baixo (local) | Dev consegue logar localmente | Após todos os consumidores PROD migrados |
| F2 | `.env.local` STAGING block | `SUPABASE_SERVICE_ROLE_KEY` (legacy iat=1788187991) | `SUPABASE_SECRET_KEY` (já rotacionada em STAGING — Turno anterior) | raiz do repo | já feito | harness H-7-1 passou | — | — | já migrado | — |
| F3 | `.env.local` bloco misto (anon/publishable) | ambas presentes | manter ambas durante transição; remover anon após desativação | raiz do repo | 15 | Smoke manual | — | 🟢 baixo | Apenas publishable no .env.local | Após desativação legacy em PROD |

---

### Grupo G — Documentação (consistência)

| # | Consumidor | Chave referenciada | Local | Ação | Ordem | Validação |
|---|------------|-------------------|-------|------|-------|-----------|
| G1 | `docs/DOCUMENTACAO_COMPLETA_SISTEMA.md` linha 233 | `SUPABASE_SERVICE_ROLE_KEY` (Edge Function) | docs/ | Atualizar para `SUPABASE_SECRET_KEY` | 16 | grep no docs |
| G2 | `docs/DEPLOY_CHECKLIST_FASE_3_4.md` linha 104 | `SUPABASE_SERVICE_ROLE_KEY=<service-role-key>` | docs/ | Atualizar para `SUPABASE_SECRET_KEY` | 17 | grep no docs |
| G3 | `docs/audit/VERCEL_DEPLOYMENT_TOPOLOGY_AUDIT.md` linha 54 | lista env vars incluindo `SUPABASE_SERVICE_ROLE_KEY` | docs/ | Adicionar nota sobre migração | 18 | grep no docs |

---

## 4. Sequência segura de execução (resumo)

```
Pré-condições P1-P5 confirmadas pelo PO
    ↓
[Criar chaves novas no Dashboard PROD]
   - sb_publishable_ (1x)
   - sb_secret_ (1x, ou múltiplas se quiser segregação por componente)
    ↓
[STAGING — espelho da PROD]
   1. Atualizar STAGING Vercel envs (já parcialmente feito)
   2. Re-deploy Edge Functions em STAGING (B1-B6)
   3. Re-registrar pg_cron STAGING (C1)
   4. Validar STAGING com E2E + smoke
    ↓
[Janela de baixo tráfego em PROD]
   1. A1: Atualizar Vercel PROD + deploy frontend
   2. A2: Atualizar Vercel server-side (se aplicável)
   3. B1-B5: Deploy Edge Functions uma por vez, validando cada
   4. B6: Deploy notification-sweep (anon→publishable)
   5. C1: Re-registrar pg_cron PROD com nova publishable
   6. D1-D4: Atualizar tests (pode ser feito em qualquer momento)
   7. F1, F3: Atualizar .env.local local
    ↓
[Período de observação 24-48h]
   ↓
[Desativação legacy no Dashboard PROD]
   - Disable SUPABASE_ANON_KEY legacy (reversível)
   - Disable SUPABASE_SERVICE_ROLE_KEY legacy (reversível)
    ↓
[Cleanup]
   - Remover env vars legacy de Vercel (F3)
   - G1-G3: Atualizar docs
```

---

## 5. Métodos de validação por fase

### Validação STAGING (canário)

- **Frontend:** login de teste + CRUD básico em `/admin`, `/portal`
- **Edge Functions:** invoke manual via `curl` ou trigger via UI
- **pg_cron:** `SELECT * FROM worker_heartbeat ORDER BY updated_at DESC LIMIT 5` — 3+ heartbeats consecutivos em 5min
- **notification-sweep:** `SELECT COUNT(*) FROM notifications WHERE created_at > now() - interval '5 minutes'` deve aumentar

### Validação PROD (pós-migração)

- Mesma bateria da STAGING, com usuários reais
- Monitoramento de logs de Edge Functions por 1h após cada deploy
- Verificar Dashboard Supabase → Logs → Edge Functions → status 2xx
- Verificar `worker_heartbeat` em PROD

### Validação final (pré-desativação legacy)

- Confirmar que **nenhum** dos 18 consumers acima ainda referencia `SUPABASE_ANON_KEY` ou `SUPABASE_SERVICE_ROLE_KEY` (grep final em todo o repo, incluindo docs)
- Confirmar que `net._http_response` para worker-dispatcher retorna 200 consistentemente por 24h
- Confirmar que notification-sweep gera notificações em PROD

---

## 6. Riscos e mitigações

| # | Risco | Severidade | Mitigação |
|---|-------|------------|-----------|
| R1 | Frontend quebra durante deploy Vercel | 🟡 médio | Dual-key temporário (manter anon e publishable durante janela); preview deploy antes de production |
| R2 | Edge Function deploy falha | 🟢 baixo | Cada função tem deploy discreto; rollback imediato via `supabase functions deploy --no-verify` |
| R3 | pg_cron re-registro perde invocações durante janela | 🟠 alto | Executar `unschedule` e `schedule` em transação única; monitorar `worker_heartbeat` imediatamente |
| R4 | `sb_publishable_` não funciona para uma função que espera claims do anon JWT | 🟠 alto | Validar em STAGING primeiro; ter rollback pronto (re-deploy com `SUPABASE_ANON_KEY` legacy) |
| R5 | Desativação legacy quebra consumer esquecido | 🟠 alto | Grep final pré-desativação; manter legado desativado por 7 dias antes de remover env vars |
| R6 | Tests não rodam após mudança de nome de env var | 🟢 baixo | Rodar `npm run test` localmente; CI validará |
| R7 | Usuários com sessões longas podem ver inconsistências | 🟡 médio | Executar em horário de baixo tráfego; sessões existentes permanecem válidas (JWT secret é separado) |
| R8 | `EDGE_JWT_SECRET` blocker afeta worker-dispatcher independentemente desta migração | 🔴 alto (separado) | NÃO incluir neste plano; frente própria de infraestrutura |

---

## 7. Critério para desativação das legacy keys

**Condições simultâneas (TODAS devem ser verdade):**

1. ✅ Todos os 6 grupos (A, B, C, D, F, G) marcados como "Migrado"
2. ✅ Período de observação ≥ 24h sem incidentes relacionados
3. ✅ Grep final confirma zero referências a `SUPABASE_ANON_KEY` (legacy) ou `SUPABASE_SERVICE_ROLE_KEY` em código de runtime (excluindo docs históricas e testes de migração)
4. ✅ `worker_heartbeat` mostra 24h+ de operação saudável em PROD
5. ✅ PO aprova explicitamente a desativação

**Método de desativação (reversível):**

```
Dashboard PROD → Settings → API Keys
  → Localizar "Legacy anon key" → Disable (não Delete)
  → Localizar "Legacy service_role key" → Disable (não Delete)
```

**Período de segurança:** manter desativadas (não deletadas) por ≥ 7 dias antes de considerar remoção definitiva.

---

## 8. Não-objetivos deste plano

Explicitamente **fora** do escopo desta migração:

1. **`EDGE_JWT_SECRET` blocker no worker-dispatcher** (PROD retorna 503) — frente própria de infraestrutura D8
2. **Cleanup histórico via `git filter-repo`** das 18 tags com `.vercel-temp.env` — Change Control separado
3. **`POSTGRES_PASSWORD` nos test harness scripts** — confirmado como placeholder `secret` (baixo risco); hardening futuro não-bloqueante
4. **Rotação de `SUPABASE_JWT_SECRET`** — não exposto, sem necessidade
5. **Promoção da V2 para PROD** — frente separada, exige Change Control próprio
6. **Cleanup STAGING (tenant Q3 preservado + auth users órfãos)** — preservado por instrução do PO até documentação H-7-1 ser revisada
7. **Deploy de `worker-dispatcher` em STAGING** (404 atual) — frente D8 separada
8. **Q4 Cash Closing** — frente separada

---

## 9. STOP

Este plano termina aqui. **Nenhuma mutação foi executada, nenhuma chave foi criada/rotacionada/desativada.**

### Pendente de autorização explícita do PO para Fase 2:

1. Confirmação das 5 pré-condições (P1-P5) listadas em §2
2. Aprovação da sequência de §4
3. Fornecimento das novas chaves (sb_publishable_, sb_secret_) criadas no Dashboard PROD
4. Confirmação da janela de baixo tráfego
5. Autorização para iniciar execução

### Após Fase 2 concluída e validada:

6. Autorização separada para desativação legacy (§7)
7. Autorização separada para `git filter-repo` (Change Control próprio)
8. Autorização separada para promoção V2 → PROD (Change Control completo)
