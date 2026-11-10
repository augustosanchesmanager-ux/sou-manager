# H-7 — Trilho B · Auditoria Read-Only de Segurança PROD

> **Tipo:** Investigação read-only · **Mutation:** NENHUMA executada
> **Data:** 2026-09-20 · **Responsável:** OpenCode (Tech Lead) + Augusto (PO)
> **Escopo:** Identificar exposição de credenciais PROD no repositório, mapear consumidores, avaliar impacto de rotação.
> **Produção:** `ushsnmlbeurfvlkieiln` — **INTACTA** (0 escritas, 0 rotações, 0 deploys)

---

## 1. Resumo Executivo

A reclassificação de gravidade do Trilho B (após verificação direta) **se mantém parcialmente**: os campos `SUPABASE_JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` e `POSTGRES_PASSWORD` em `.vercel-temp.env` estavam de fato **VAZIOS** naquele commit. Porém a investigação mais ampla encontrou:

| Achado | Severidade |
|--------|------------|
| `SUPABASE_ANON_KEY` legacy JWT PROD em histórico git (18 tags + remote branch) | 🟠 medium |
| `SUPABASE_PUBLISHABLE_KEY` PROD em histórico git (mesmos locais) | 🟡 low |
| 6 arquivos `.vercel-env-*` adicionais com mesmas chaves (não em tags) | 🟠 medium |
| `POSTGRES_PASSWORD` hardcoded em 3 arquivos de test harness rastreados (length 55-72) | 🔴 **alta — precisa confirmação manual PO** |
| `SUPABASE_JWT_SECRET` / `SERVICE_ROLE` / `VERCEL_OIDC_TOKEN` em arquivos rastreados | ✅ não encontrados |

**Correção da hipótese anterior:** a auditoria antiga (`docs/security-audit/gerar-relatorio.cjs`) reportou exposição de segredos críticos. Verificação direta mostrou que naquele arquivo específico os campos estavam vazios — mas a varredura expandida encontrou **outros locais** e um caso novo (POSTGRES_PASSWORD em harness scripts) que merece atenção prioritária.

---

## 2. Achado #1 — `.vercel-temp.env` em histórico de tags

### 2.1 Conteúdo exposto (verificado via `git show 124a099^:.vercel-temp.env`)

| Variável | Conteúdo | Privilégio |
|----------|----------|------------|
| `SUPABASE_URL` | `https://ushsnmlbeurfvlkieiln.supabase.co` | público |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | JWT legacy PROD (iat=1771444410) | baixo (RLS) |
| `SUPABASE_ANON_KEY` | mesmo JWT legacy PROD | baixo (RLS) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_CHWJRVhyx5rA3IcTHMToWg_vnXrgbWj` | baixo (publishable) |
| `SUPABASE_PUBLISHABLE_KEY` | mesmo publishable | baixo |
| `SUPABASE_JWT_SECRET` | **EMPTY** | n/a |
| `SUPABASE_SERVICE_ROLE_KEY` | **EMPTY** | n/a |
| `SUPABASE_SECRET_KEY` | **EMPTY** | n/a |
| `POSTGRES_PASSWORD` | **EMPTY** | n/a |

### 2.2 Commits que introduziram/modificaram/removeram

```
ad0b679  Refactor routes into guarded module-based configs          (2026-04-18)  ← INTRODUÇÃO
46e21ce  fix: auditoria técnica - correção schema routing           (anterior)
521beac  chore: separate portal deploy and remove unused gemini     (modificação)
124a099  fix(security): remove .vercel-temp.env do indice git (F4.1) ← REMOÇÃO
c1711da  fix(security): remove .vercel-temp.env do indice git (PR#54)← REMOÇÃO (merge)
```

### 2.3 Tags que contêm o arquivo (18 tags)

```
v1.0.0-platform-stable
v1.1.0-e2e-certified
v1.2.0-onboarding-certified
v1.3.0-team-onboarding-certified
v1.4.0-billing-foundation-6.0.4.2
v1.4.1-billing-lifecycle-6.0.4.3
v1.4.2-billing-engine-6.0.4.4
v1.4.3-effective-state-6.0.5.1
v1.4.4-commission-reversal-certified
v1.5.0-durable-outbox-trilha-c-certified
v1.6.0-d7-production-certified
v1.6.0-transactional-outbox-d7-certified
v1.7.0-adr015-pipeline-observability
v2.0.0-d8-production-certified
v2.0.1-saneamento-orfas-b-certified
v2.1.0-acl-20260908120000-certified
v2.1.0-p2.1-homologation-pass
v2.1.0-staging-gate-approved
```

**Impacto:** qualquer clone/push/pull desses tags referencia o histórico com o arquivo. `git filter-repo` reescreveria todos eles.

### 2.4 Branches que contêm o commit `46e21ce`

30+ branches locais contêm o histórico. Remoto relevante: `origin/codex/correcao-cadastro-club` contém `ad0b679` (mas não o arquivo `.vercel-temp.env` nesse caminho — a string aparece em outros arquivos introduzidos pelo mesmo commit).

### 2.5 Estado atual

- Arquivo **NÃO está no working tree** (`git ls-files` não lista)
- Está **gitignored** (`.gitignore:16`)
- Permanece em **18 tags + 30+ branches** (histórico imutável até filter-repo)

---

## 3. Achado #2 — 6 arquivos `.vercel-env-*` adicionais

Commit `ad0b679` (2026-04-18) introduziu **seis** arquivos `.vercel-env-*`, todos com 41 linhas (mesmo template de `.vercel-temp.env`):

```
.vercel-env-cutover2
.vercel-env-postcutover
.vercel-env-postcutover2
.vercel-env-predeploy
.vercel-env-rollback
.vercel-env-stable
```

### 3.1 Conteúdo

Contêm as mesmas `SUPABASE_ANON_KEY` legacy e `SUPABASE_PUBLISHABLE_KEY` (confirmado via `git log --all -S`). Não estão em nenhuma tag (apenas em branches que descendem de `ad0b679`).

### 3.2 Estado atual

- **NÃO estão no working tree** (completamente removidos, nem untracked)
- **NÃO estão gitignored** (mas não há necessidade porque não existem)
- Existem **apenas no histórico** de branches que contêm `ad0b679`

---

## 4. Achado #3 — `POSTGRES_PASSWORD` em test harness scripts 🔴

Três arquivos rastreados contêm `POSTGRES_PASSWORD` hardcoded:

| Arquivo | Comprimento | Contexto |
|---------|-------------|----------|
| `tests/d8/harness/am04_setup.ps1` | **72 chars** | docker run para D8 harness |
| `tests/d8/harness/setup.ps1` | **55 chars** | docker run para D8 harness |
| `tests/security/f1/harness/setup.ps1` | **55 chars** | docker run para F1 security harness |

### 4.1 Análise

- Comprimentos 55-72 chars **não correspondem a senhas de teste triviais** (ex.: "postgres", "test123")
- Padrão `=se...` no início sugere valor Base64 ou string gerada
- Contexto: comandos `docker run -e POSTGRES_PASSWORD=<valor>` para containers Postgres locais
- **Incerteza:** podem ser (a) senhas aleatórias para containers Docker locais de teste, ou (b) **senhas reais do banco PROD** copiadas por engano para os scripts de teste
- O D8 worker é **PRODUCTION CERTIFIED** (ADR-015, ADR-016, tag v2.0.0-d8) — seus harnesses podem ter sido escritos contra o banco PROD para validar equivalência

### 4.2 Ação requerida do PO

**Antes de qualquer outra ação:** o PO deve inspecionar manualmente os três arquivos e confirmar se os valores são:
- (a) Senhas locais de teste (severidade baixa) → atualizar para variável de ambiente
- (b) **Senhas reais do PROD** (severidade 🔴 crítica) → rotação IMEDIATA do `postgres` role no Supabase Dashboard, seguida de rotação das demais credenciais

**Esta confirmação não pode ser feita por tooling automatizado** sem expor o valor. O comando `git grep` localizou os arquivos; a leitura do conteúdo requer decisão consciente do PO.

---

## 5. Mapa de consumidores atuais

### 5.1 Vercel (25 env vars — `docs/audit/VERCEL_DEPLOYMENT_TOPOLOGY_AUDIT.md`)

Inclui: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `POSTGRES_URL`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, `SMG_API_*`, `SMG_WEBHOOK_SECRET`, `VERCEL_*`.

**Valores reais em Vercel: NÃO VERIFICÁVEIS por tooling local** — requer inspeção no Vercel Dashboard pelo PO (Settings → Environment Variables) ou via `vercel env ls`.

### 5.2 Edge Functions (`supabase/functions/`)

| Função | Variável lida | Origem |
|--------|--------------|--------|
| `portal-auth` | `SUPABASE_SERVICE_ROLE_KEY` | legacy |
| `admin-create-user` | `SUPABASE_SERVICE_ROLE_KEY` + `SUPABASE_ANON_KEY` | legacy |
| `invite-team-member` | `SUPABASE_SERVICE_ROLE_KEY` + `SUPABASE_ANON_KEY` | legacy |
| `supabase-usage-monitor` | `SUPABASE_SERVICE_ROLE_KEY` + `SUPABASE_ANON_KEY` | legacy |
| `site-sanchez-appointments` | `SUPABASE_SERVICE_ROLE_KEY` | legacy |
| `notification-sweep` | `SUPABASE_ANON_KEY` | legacy |
| `worker-dispatcher` | `SUPABASE_PUBLISHABLE_KEYS` (nova) + `APP_URL` + `EDGE_JWT_SECRET` | nova (mas blocker) |

### 5.3 pg_cron D8

`supabase/migrations/20260827210000_d8_worker_schedule.sql` registra job que chama `worker-dispatcher` com header `Authorization: Bearer <anon legacy>`. Re-registro necessário se a anon legacy for desativada.

### 5.4 Frontend (browser bundle)

`src/lib/supabase/client.ts` e outros consomem `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` (build-time). A `.env.local` local contém **ambas** as chaves; **a Vercel precisa ser inspecionada** para saber qual está deployada.

### 5.5 Tests e scripts locais

| Componente | Lê |
|------------|-----|
| `tests/e2e/helpers/supabaseAdmin.ts` | `SUPABASE_SERVICE_ROLE_KEY` |
| `tests/e2e/helpers/dbAssertions.ts` | `SUPABASE_SERVICE_ROLE_KEY` |
| `tests/e2e/validation/production-smoke.mjs` | `SUPABASE_SERVICE_ROLE_KEY` |
| `tests/homologation/h2-8/*.spec.ts` | `SUPABASE_SERVICE_ROLE_KEY` |
| `tests/e2e/setup/seed-chefclub-p03c.ts` | `SUPABASE_SERVICE_ROLE_KEY` |
| `scripts/ops/regularizacao/executar-baixa.mjs` | `SUPA_PRODUCTION_URL`/`ANON` + login (não usa service_role) |
| `scripts/h7-*` (todos) | `H7_*_SERVICE_ROLE_KEY` / `H7_*_ANON_KEY` (env-only, saneados) |
| `scripts/ops/regularizacao/validar-baixa.mjs` | `SUPA_PRODUCTION_*` + login (não usa service_role) |

---

## 6. Avaliação de impacto de rotação

### 6.1 O que **NÃO** quebra com rotação de chaves

- **Sessões de usuários autenticados:** imunes. Os JWTs de sessão são assinados pelo `SUPABASE_JWT_SECRET` (não exposto) e pelo par de chaves assimétricas; rotação das API keys não invalida sessões existentes.
- **RLS policies:** não dependem das chaves de API.
- **Trigger `set_tenant_id_from_profile()` / helpers RLS:** usam `auth.uid()` da sessão, não a chave.

### 6.2 O que **QUEBRA** se `SUPABASE_ANON_KEY` legacy for desativada

| Componente | Quebra | Mitigação |
|------------|--------|-----------|
| `pg_cron` D8 (header `Bearer <anon>`) | 🔴 401 imediato | re-registrar com `sb_publishable_` |
| Edge Function `notification-sweep` | 🔴 falha de auth | migrar para `SUPABASE_PUBLISHABLE_KEY` |
| Frontend (se Vercel usa `VITE_SUPABASE_ANON_KEY`) | 🔴 falha de auth browser | confirmar Vercel usa `VITE_SUPABASE_PUBLISHABLE_KEY` |
| Tests `production-smoke.mjs` (se ainda referenciam anon legacy) | 🟠 falha de teste | atualizar para nova chave |

### 6.3 O que **QUEBRA** se `SUPABASE_PUBLISHABLE_KEY` for desativada

| Componente | Quebra | Mitigação |
|------------|--------|-----------|
| Frontend (build-time) | 🔴 | atualizar Vercel env antes de desativar |
| Edge Function `worker-dispatcher` (lê `SUPABASE_PUBLISHABLE_KEYS`) | 🔴 | atualizar secret antes de desativar |

### 6.4 O que **QUEBRA** se `SUPABASE_SERVICE_ROLE_KEY` legacy for desativada

| Componente | Quebra | Mitigação |
|------------|--------|-----------|
| 5 Edge Functions listadas | 🔴 | migrar para `SUPABASE_SECRET_KEY` (`sb_secret_`) |
| Vercel env `SUPABASE_SERVICE_ROLE_KEY` | 🔴 | substituir por `SUPABASE_SECRET_KEY` |
| Tests que leem `SUPABASE_SERVICE_ROLE_KEY` | 🟠 | atualizar para nova variável |

---

## 7. Proposta de sequência de remediação (NÃO EXECUTAR AGORA)

Sequência ordenada por risco, requer autorização explícita do PO a cada fase:

### Fase 1 — Confirmação manual (PRÉ-ROTAÇÃO)

1. **PO inspeciona manualmente** os 3 arquivos com `POSTGRES_PASSWORD` (`tests/d8/harness/{am04_setup,setup}.ps1`, `tests/security/f1/harness/setup.ps1`) e classifica cada valor como **PROD** ou **local**.
2. **PO inspeciona Vercel Dashboard** para confirmar quais envs estão deployadas (especialmente `VITE_SUPABASE_ANON_KEY` vs `VITE_SUPABASE_PUBLISHABLE_KEY`).
3. **PO confirma consumers do pg_cron D8** — o job está ativo em PROD?

### Fase 2 — Migração de consumidores (ordem importa)

1. Criar nova `sb_publishable_` no Dashboard PROD (rotacionar a existente).
2. Atualizar Vercel: `VITE_SUPABASE_PUBLISHABLE_KEY` → nova chave (deploy necessário — janela curta de cache).
3. Atualizar Edge Function `worker-dispatcher`: secret `SUPABASE_PUBLISHABLE_KEYS` (Edge Runtime auto-inject) → nova chave.
4. Atualizar Edge Function `notification-sweep`: trocar leitura de `SUPABASE_ANON_KEY` → `SUPABASE_PUBLISHABLE_KEY`, deploy.
5. Re-registrar pg_cron D8: `cron.unschedule()` + `cron.schedule()` com `Authorization: Bearer <nova sb_publishable_>` (AGENTS.md: nunca UPDATE direto em `cron.job`).
6. Criar nova `sb_secret_` no Dashboard PROD.
7. Migrar 5 Edge Functions: trocar leitura de `SUPABASE_SERVICE_ROLE_KEY` → `SUPABASE_SECRET_KEY`, deploy de cada uma.
8. Atualizar Vercel: `SUPABASE_SERVICE_ROLE_KEY` → `SUPABASE_SECRET_KEY` (se aplicável).
9. Atualizar tests/scripts que referenciam nomes antigos.

### Fase 3 — Validação

1. Smoke test E2E em STAGING (já reusando o pipeline P2.1).
2. Verificar que frontend, Edge Functions, D8 worker, notification-sweep funcionam com chaves novas.
3. Monitorar logs por 24h.

### Fase 4 — Desativação legacy (reversível)

1. Dashboard PROD → Settings → API Keys → Disable legacy keys (`anon` + `service_role`).
2. Verificar que nada quebrou (reverter se necessário — desativação é reversível).
3. Atualizar tests/scripts para remover referências a nomes legacy.

### Fase 5 — Cleanup histórico (Change Control próprio)

**Somente após todas as fases anteriores concluídas com sucesso.** Avaliar `git filter-repo` para reescrever:
- 18 tags que contêm `.vercel-temp.env` com as chaves antigas
- Branches que descendem de `ad0b679` (contêm `.vercel-env-*`)
- `git push --force` para remote (afeta clones existentes)
- **Risco:** rewrite de tags publicadas pode quebrar processos que dependem de SHA imutável.

**Esta fase NÃO deve ser executada sem Change Control dedicado.**

---

## 8. Riscos

| # | Risco | Severidade | Mitigação |
|---|-------|------------|-----------|
| 1 | `POSTGRES_PASSWORD` em harness scripts ser credencial PROD real | 🔴 até confirmação | PO inspeciona manualmente antes de qualquer rotação |
| 2 | Rotação sem atualizar Vercel causa downtime no frontend | 🟠 | atualizar Vercel ANTES de desativar legacy |
| 3 | Edge Function deploy falha durante migração | 🟠 | testar deploy de uma função por vez |
| 4 | pg_cron não re-registrado quebra D8 worker | 🟠 | re-registrar antes de desativar anon |
| 5 | `git filter-repo` quebra referências externas a tags/commits | 🟠 | Change Control próprio, comunicar a todos os dependentes |
| 6 | Usuários PROD com sessões longas podem ver requests falharem se algo quebrar | 🟡 | rotação em horário de baixo tráfego |

---

## 9. Descobertas laterais (não bloqueiam, mas devem ser registradas)

1. **Schema drift STAGING↔PROD:** `comandas.closed_by` ausente em STAGING (detectado durante H-7-1). Não afeta esta frente.
2. **Drift similar em `outbox_items`:** staging tem `event_type/payload/metadata/retry_*` mas não `target_provider/attempts/last_error`. Edge Functions mais novas usam colunas que staging não tem. Não afeta esta frente, mas é evidência de que staging não é espelho exato de PROD.
3. **Local `.env.local.bak_bom` / `.env.local.val-bak`:** untracked, não gitignored, contêm credenciais PROD (já confirmado na investigação anterior — `SUPABASE_SERVICE_ROLE_KEY` iat=1771444410 legacy). Devem ser **deletados manualmente** pelo PO após a rotação, ou movidos para local seguro fora do repo.

---

## 10. STOP

Esta auditoria termina aqui. **Nenhuma mutação foi executada.**

### Pendente de autorização explícita do PO para prosseguir:

1. Confirmação manual dos 3 `POSTGRES_PASSWORD` (classificação PROD vs local)
2. Inspeção de Vercel envs deployadas
3. Abertura de Change Control para Fase 2 (migração de consumidores)
4. Abertura de Change Control para Fase 5 (cleanup histórico via `git filter-repo`)

### Entregas desta auditoria:

- ✅ Commits exatos contendo `SUPABASE_ANON_KEY` e `SUPABASE_PUBLISHABLE_KEY` (3 introdução/modificação + 2 remoção)
- ✅ Consumidores encontrados (Vercel, 7 Edge Functions, pg_cron, frontend, tests, scripts)
- ✅ Impacto da rotação (tabela por componente)
- ✅ Proposta de sequência em 5 fases
- ✅ Riscos (6 itens)
- ✅ Achados laterais (schema drift, bak files)
- ✅ STOP

### Não entregue (requer ação do PO ou nova autorização):

- Valores reais das credenciais (não expostos neste relatório)
- Inspeção de Vercel Dashboard
- Confirmação da classificação dos `POSTGRES_PASSWORD`
- Qualquer mutação (rotação, desativação, filter-repo, deploy)

---

## Anexo A — Comandos executados (read-only)

```bash
git log --all --oneline -- .vercel-temp.env
git log --all --oneline -S "sb_publishable_CHWJRVhyx5rA3IcTHMToWg_vnXrgbWj"
git log --all --oneline -S "qcVcEtdQW53xq9WMcjatqQj77qyU-yej2tMzQYYbtiM"
git tag --contains 46e21ce
git branch -a --contains 46e21ce
git branch -r --contains ad0b679
git cat-file -e v2.0.0-d8-production-certified:.vercel-temp.env
git cat-file -e v2.1.0-staging-gate-approved:.vercel-temp.env
git cat-file -e origin/codex/correcao-cadastro-club:.vercel-temp.env
git ls-files | grep -E '\.env|vercel-env'
git check-ignore -v .env.local .vercel-temp.env .vercel-env-*
git log --all --oneline -- .vercel-env-cutover2 .vercel-env-postcutover ...
git log --all --format='' --name-only -S "sb_publishable_..."
git grep -l 'POSTGRES_PASSWORD='
git grep -l 'SUPABASE_JWT_SECRET='
git grep -l 'VERCEL_OIDC_TOKEN'
git show 124a099^:.vercel-temp.env
git grep -l 'Deno.env.get.*SUPABASE' supabase/functions/
```

Todos retornaram dados consistentes; nenhum produziu escrita.
