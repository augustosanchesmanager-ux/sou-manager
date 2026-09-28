# H-7 — Trilho B · Pré-condições P1–P4 (Read-Only)

> **Tipo:** Investigação read-only · **Mutation:** NENHUMA executada · **Status:** ⏸️ aguardando autorização
> **Data:** 2026-09-20 · **Responsável:** OpenCode (Tech Lead) + Augusto (PO)
> **Escopo:** Confirmar pré-condições da Fase 2 antes da execução da migração de legacy keys em PROD.
> **Produção:** `ushsnmlbeurfvlkieiln` — **INTACTA** (0 escritas, 0 rotações, 0 deploys, 0 cron changes)

---

## P1 — Vercel: env vars configuradas em Production

### Fonte

`docs/audit/VERCEL_DEPLOYMENT_TOPOLOGY_AUDIT.md` (auditoria read-only de 2026-08-08, autorizada por D-HOM-11) — única fonte confiável para o estado real das envs Vercel deployadas. Esta sessão **não consultou diretamente o Vercel Dashboard** (sem token de acesso); utilizou a auditoria prévia como referência canônica.

### Projeto A — `smg-barber` (OFICIAL · `barber.soumanager.com`)

| Env var | Status |
|---------|--------|
| `VITE_SUPABASE_URL` | ✅ deployada |
| `VITE_SUPABASE_ANON_KEY` | ✅ deployada (legacy JWT PROD) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | ❌ **NÃO deployada** |

**Total: 2 envs. Frontend usa apenas `VITE_SUPABASE_ANON_KEY` (legacy).**

### Projeto B — `sou-manager` (LEGADO · `soumanager.com`, `club.soumanager.com`)

| Env var | Status |
|---------|--------|
| `VITE_SUPABASE_URL` | ✅ |
| `VITE_SUPABASE_ANON_KEY` | ✅ (legacy) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | ✅ (nova) |
| `VITE_SUPABASE_MULTI_SCHEMA_ENABLED` | ✅ = `true` (divergente do oficial) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | ⚠️ **deployada** (legacy) |
| `SUPABASE_JWT_SECRET` | ⚠️ **deployada** |
| `POSTGRES_URL`, `POSTGRES_PASSWORD`, `POSTGRES_HOST` | ⚠️ **deployadas** (credenciais diretas) |
| `SMG_API_BASE_URL`, `SMG_API_TOKEN`, `SMG_WEBHOOK_SECRET` | ⚠️ deployadas (legado backend Next.js) |
| ... | (total: **25 envs**) |

**Total: 25 envs. git link DESCONECTADO em 2026-08-08 (D-HOM-11).** Nenhum deploy futuro é disparado por push. Mas envs continuam configuradas com credenciais sensíveis.

### Conclusões P1

1. **Frontend oficial usa exclusivamente `VITE_SUPABASE_ANON_KEY`** (legacy). Não há fallback para `VITE_SUPABASE_PUBLISHABLE_KEY` no bundle de produção atual.
2. **`sou-manager` legado** contém 25 envs com credenciais sensíveis que não foram saneadas após D-HOM-11. Está isolado de deploys automáticos mas o env permanece.
3. **Divergência funcional ativa:** `MULTI_SCHEMA_ENABLED=true` no legado vs `false` (default) no oficial — se o legado fosse acidentalmente re-ativado, o comportamento seria diferente.

### Dependências para Fase 2

- Decisão PO sobre destino do projeto `sou-manager` (legado): limpar envs, deletar projeto, ou manter como está
- Se `sou-manager` for saneado, isso reduz a superfície de exposição de legacy keys

### Riscos

- 🟠 **Risco residual:** se o `sou-manager` for re-ativado (via `vercel git connect`), o deploy usará as legacy keys expostas no env
- 🟢 Risco de migração do `smg-barber`: baixo (única env de API key, dual-key durante transição)

---

## P2 — Frontend: código consumidor de `VITE_SUPABASE_*`

### Fonte

Grep recursivo em `src/` + leitura de `src/lib/supabase/client.ts`.

### Conclusões P2

| Arquivo | Linha | Variável | Status |
|---------|-------|----------|--------|
| `src/lib/supabase/client.ts` | 12 | `VITE_SUPABASE_URL` | ✅ em uso |
| `src/lib/supabase/client.ts` | 13 | `VITE_SUPABASE_ANON_KEY` | ✅ em uso |
| `src/lib/permissions/service.ts` | 13 | `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` | ✅ em uso |
| `src/bootstrap/eventInfrastructure.ts` | 124 | `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` | ✅ em uso |
| `src/middleware/resolveApp.ts` | 30, 102 | `VITE_APP_HOSTNAME_MAP`, `VITE_LOCAL_APP_SLUG` | não Supabase |
| `src/lib/supabase/schemas.ts` | 98 | `VITE_SUPABASE_MULTI_SCHEMA_ENABLED` | ✅ em uso |
| `src/lib/apps/publicUrl.ts` | 21 | `VITE_APP_PUBLIC_HOSTNAME_MAP` | não Supabase |
| `src/lib/observability/alerts.ts` | 463 | `import.meta.env.DEV` | não Supabase |
| `src/lib/observability/logger.ts` | 252 | `import.meta.env.DEV` | não Supabase |

### Resultado

- **Frontend referencia exclusivamente `VITE_SUPABASE_ANON_KEY`** (legacy JWT) como chave de API Supabase no browser bundle.
- **`VITE_SUPABASE_PUBLISHABLE_KEY` tem ZERO referências** no código de produção do frontend.
- 4 arquivos usam `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` em conjunto (par obrigatório).

### Implicação para Fase 2

O consumidor A1 do plano (`VITE_SUPABASE_ANON_KEY` → `VITE_SUPABASE_PUBLISHABLE_KEY`) é confirmado como **mudança obrigatória de código** no frontend, não apenas de env var na Vercel. As mudanças necessárias:

1. Editar `src/lib/supabase/client.ts` linha 13: `VITE_SUPABASE_ANON_KEY` → `VITE_SUPABASE_PUBLISHABLE_KEY`
2. Editar `src/lib/permissions/service.ts` linha 13
3. Editar `src/bootstrap/eventInfrastructure.ts` linha 124
4. Atualizar Vercel `smg-barber` para deployar a nova env `VITE_SUPABASE_PUBLISHABLE_KEY`
5. Build + deploy + validação (login + CRUD)

### Divergência vs plano original

Plano original (B Trilho B Fase 2) listou A1 como "atualizar Vercel env var". **Subestimado:** também requer edição de código + build + deploy. Adiciona ~15min ao escopo, mas não muda a criticidade (🟢 baixo).

### Dependências

- Build local para validar TypeScript antes do deploy
- Decisão sobre `LOCAL_DEMO_ENABLED`: o fallback local-demo (`hasSupabaseEnv` em `client.ts`) verifica apenas se URL+ANON estão presentes — após migração, fallback pode quebrar se apenas PUBLISHABLE estiver presente. **Decisão:** adicionar `VITE_SUPABASE_PUBLISHABLE_KEY` à verificação de fallback?

### Riscos

- 🟢 Baixo: troca de nome de env var em build-time, dual-key permite validação incremental
- 🟡 Médio: fallback de demo local pode precisar ajuste (não bloqueante, apenas impacta dev local sem Supabase)

---

## P3 — pg_cron D8 em PROD

### Fonte

Management API (`api.supabase.com/v1/projects/{ref}/database/query`) com `SUPABASE_ACCESS_TOKEN` de `.env.local`. CLI `supabase db query --linked` falhou por restrição IPv6 no pooler.

### `cron.job` em PROD

| jobid | jobname | schedule | active | command |
|-------|---------|----------|--------|---------|
| 3 | `d8-worker-dispatcher` | `* * * * *` | **true** | `SELECT net.http_post(url := 'https://ushsnmlbeurfvlkieiln.supabase.co/functions/v1/worker-dispatcher', headers := '{"Content-Type": "application/json", "Authorization": "Bearer <anon legacy JWT>"}', body := '{}')` |

### **Confirmação crítica P3:**

1. ✅ Job `d8-worker-dispatcher` está **registrado e ativo** em PROD
2. ✅ Schedule `* * * * *` (cada minuto)
3. ⚠️ **Header `Authorization` contém o legacy anon JWT** (mesmo JWT exposto em `.vercel-temp.env` histórico). Esta é a chave que será desativada na Fase 2 — **re-registro obrigatório antes da desativação**.
4. ✅ Runs recentes existem: `job_run_details` tem 5+ entradas para jobid 3 (runids 34014-34018+) — job está sendo disparado continuamente

### Conclusão P3

- O job **existe e está ativo** em PROD — diferente da hipótese inicial de "não implantado"
- Re-registro (cron.unschedule + cron.schedule com nova publishable) é **pré-condição obrigatória** antes de desativar `SUPABASE_ANON_KEY` legacy
- Cada minuto, o cron dispara o worker-dispatcher com o anon legacy — durante a janela de migração, isso pode coexistir com a nova chave (não precisa parar o cron, só re-registrar no momento certo)

### Divergência vs plano original

Nenhuma. O plano já previa o re-registro.

### Dependências

- PO cria nova `sb_publishable_` no Dashboard PROD
- Janela de execução precisa considerar que cada minuto há uma invocação — re-registro deve ser atômico (`unschedule` + `schedule` na mesma transação)

### Riscos

- 🟠 **Alto se feito errado:** se `unschedule` for executado mas `schedule` falhar, o worker para de rodar → outbox items ficam pending → comissão atrasa
- 🟢 Baixo se feito corretamente: ambas em transação única + heartbeat monitorado por 5min

---

## P4 — Edge Function `worker-dispatcher` em PROD

### Fonte

`supabase functions list --project-ref ushsnmlbeurfvlkieiln` (read-only).

### Edge Functions deployadas em PROD (5 ACTIVE)

| Função | Versão | Updated at | verify_jwt | Status |
|--------|--------|------------|------------|--------|
| `admin-create-user` | 26 | 1789336251463 (~2026-09-12) | true | ACTIVE |
| `portal-auth` | 16 | 1772680241979 (~2026-03-02) | true | ACTIVE |
| `import-export` | 14 | 1777946046464 (~2026-04-02) | false | ACTIVE |
| `invite-team-member` | 15 | 1786023134711 (~2026-08-03) | true | ACTIVE |
| `worker-dispatcher` | 18 | 1787914028740 (~2026-08-26) | true | ACTIVE |

### **Divergência importante vs plano original:**

O plano B Trilho B Fase 2 listou 6 Edge Functions para migrar (portal-auth, admin-create-user, invite-team-member, supabase-usage-monitor, site-sanchez-appointments, notification-sweep).

**Apenas 3 dessas estão deployadas em PROD:**
- ✅ `portal-auth` — deployada
- ✅ `admin-create-user` — deployada
- ✅ `invite-team-member` — deployada
- ❌ `supabase-usage-monitor` — **NÃO deployada** (existe no código, mas não em PROD)
- ❌ `site-sanchez-appointments` — **NÃO deployada**
- ❌ `notification-sweep` — **NÃO deployada**

**Extra encontrada em PROD mas não no plano:**
- ✅ `import-export` — deployada em PROD (`verify_jwt: false`), **não listada no plano**. Lê quais env vars? Requer investigação adicional.

### Conclusão P4

- **`worker-dispatcher` está deployada e ACTIVE** em PROD (v18) — diferente da hipótese inicial
- 3 Edge Functions do plano **NÃO estão em PROD** — não precisam migração在那里 (não existem在那里)
- 1 Edge Function (`import-export`) está em PROD mas não foi mapeada no plano — precisa investigação adicional antes da Fase 2

### Dependências para Fase 2

- Investigar `import-export`: quais env vars consome? Tem service_role? Anon? Publishable?
- Se `import-export` consumir `SUPABASE_SERVICE_ROLE_KEY`, adiciona 1 consumidor ao plano

### Riscos

- 🟢 Edge Functions deployadas: cada deploy é granular, rollback viável
- 🟡 `import-export` descoberta tardia: requer investigação adicional antes da migração (não bloqueante, mas deveria ser feita antes da Fase 2)

---

## Resumo de divergências vs plano original

| # | Item do plano | Estado real | Impacto |
|---|---------------|-------------|---------|
| 1 | A1: "atualizar Vercel env var" | Requer também **edição de código** + build + deploy | 🟡 amplia escopo em ~15min |
| 2 | B6: migrar `notification-sweep` anon → publishable | **Função NÃO deployada em PROD** | 🟢 simplifica — não há o que migrar |
| 3 | B4: migrar `supabase-usage-monitor` service_role → secret | **Função NÃO deployada em PROD** | 🟢 simplifica — não há o que migrar |
| 4 | B5: migrar `site-sanchez-appointments` service_role → secret | **Função NÃO deployada em PROD** | 🟢 simplifica — não há o que migrar |
| 5 | (não no plano) `import-export` deployada em PROD | **Descoberta tardia** | 🟡 requer investigação antes da Fase 2 |

## Pendente para a Fase 2 (atualizado após P1–P4)

### Consumidores a migrar (atualizado)

- **A1 — Vercel + frontend código:** `VITE_SUPABASE_ANON_KEY` → `VITE_SUPABASE_PUBLISHABLE_KEY` (4 arquivos `src/`)
- **A2 — Vercel server-side:** `SUPABASE_SERVICE_ROLE_KEY` → `SUPABASE_SECRET_KEY` (se aplicável)
- **B1 — `portal-auth`:** `SUPABASE_SERVICE_ROLE_KEY` → `SUPABASE_SECRET_KEY`
- **B2 — `admin-create-user`:** `SUPABASE_SERVICE_ROLE_KEY` (+ `SUPABASE_ANON_KEY`) → `SUPABASE_SECRET_KEY`
- **B3 — `invite-team-member`:** `SUPABASE_SERVICE_ROLE_KEY` (+ `SUPABASE_ANON_KEY`) → `SUPABASE_SECRET_KEY`
- **B4 — `worker-dispatcher`:** já em `SUPABASE_PUBLISHABLE_KEYS` (nova) — sem mudança exceto blocker `EDGE_JWT_SECRET`
- **C1 — pg_cron D8:** re-registrar `cron.unschedule` + `cron.schedule` com nova `sb_publishable_`
- **D1–D4 — Tests:** atualizar env names (baixa prioridade, pode ser feito em qualquer momento)
- **F1 — `.env.local` PROD block:** `SUPABASE_SERVICE_ROLE_KEY` → `SUPABASE_SECRET_KEY`
- **G1–G3 — Docs:** atualizar referências a env names legacy

### Consumidores removidos do plano (não deployados em PROD)

- ~~`notification-sweep`~~
- ~~`supabase-usage-monitor`~~
- ~~`site-sanchez-appointments`~~

### Consumidor adicional descoberto (requer investigação)

- **`import-export`** — presente em PROD (`verify_jwt: false`!), não mapeado no plano. Investigar quais env vars consome antes da Fase 2.

---

## STOP

Esta investigação termina aqui. **Nenhuma mutação foi executada.**

### Pendente de autorização do PO:

1. Investigar `import-export` (env vars que consome) — read-only adicional
2. Decidir destino do projeto Vercel `sou-manager` legado (25 envs com credenciais sensíveis)
3. Confirmar P1–P5 e autorizar início da Fase 2 (com escopo atualizado pós-divergências)
4. Janela de baixo tráfego (P5)

### Não entregue (depende de ação do PO ou nova autorização):

- Valores reais das credenciais (não expostos)
- Decisão sobre `import-export`
- Decisão sobre legado `sou-manager`
- Qualquer mutação
