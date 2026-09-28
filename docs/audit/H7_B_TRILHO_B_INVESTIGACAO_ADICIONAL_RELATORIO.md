# H-7 — Trilho B · Investigação Adicional Read-Only (import-export + sou-manager legado)

> **Tipo:** Investigação read-only · **Mutation:** NENHUMA executada · **Status:** ⏸️ aguardando autorização
> **Data:** 2026-09-20 · **Responsável:** OpenCode (Tech Lead) + Augusto (PO)
> **Escopo:** Investigar `import-export` (Edge Function ativa em PROD com fonte ausente) e mapear env vars do projeto Vercel legado `sou-manager`.
> **Produção:** `ushsnmlbeurfvlkieiln` — **INTACTA** (0 escritas, 0 rotações, 0 deploys)

---

## A. Investigação `import-export`

### A.1 Estado em PROD

`supabase functions list --project-ref ushsnmlbeurfvlkieiln` (P4 anterior) confirmou:

| Atributo | Valor |
|----------|-------|
| Nome | `import-export` |
| ID | `51b517cb-cbe3-4376-9c81-0d8b94cf1dce` |
| Versão | 14 |
| Status | ACTIVE |
| verify_jwt | **false** (endpoint público) |
| Created | 1777946046464 (~2026-04-02) |
| Updated | 1777946046464 (~2026-04-02) |

⚠️ **Achado crítico:** `verify_jwt: false` significa que a função aceita invocações **sem autenticação**. Combinado com o fato de que o fonte não está no repo, isso representa uma superfície de ataque não auditável.

### A.2 Fonte no repositório local

```
$ git log --all --oneline -- 'supabase/functions/import-export/*'
(vazio)

$ ls supabase/functions/import-export/
File not found
```

**O código-fonte NÃO existe no repositório atual.** Impossível determinar via repo local quais env vars/secrets a função consome.

### A.3 Referências no repo

`grep -r "import-export"` encontrou matches em:
- `ROADMAP.md` (linha sobre F2.2 — refere-se a `supabase-usage-monitor`, não `import-export`; match incidental)
- `PROJECT_STATUS.md` (similar)
- `docs/audit/H7_B_TRILHO_B_P1_P4_READONLY_RELATORIO.md` (meu relatório anterior)

**Nenhuma migration, nenhum doc técnico, nenhuma spec** descreve o que `import-export` faz ou quais secrets consome.

### A.4 Quem invoca `import-export`?

```
$ grep -r "functions/v1/import-export" .
(sem matches além dos docs acima)
```

**Nenhum caller conhecido no código atual.** A função pode ser invocada externamente (curl, Postman, scripts) ou por um sistema não rastreado.

### A.5 Conclusão `import-export`

| Pergunta | Resposta |
|----------|----------|
| Está ativa em PROD? | ✅ sim, ACTIVE |
| Usa `SUPABASE_SERVICE_ROLE_KEY`? | ❓ **desconhecido** (fonte ausente) |
| Usa `SUPABASE_ANON_KEY`? | ❓ **desconhecido** |
| Usa `SUPABASE_PUBLISHABLE_KEY`? | ❓ **desconhecido** |
| Usa `SUPABASE_SECRET_KEY`? | ❓ **desconhecido** |
| Dependência de legacy anon/service_role? | ❓ **desconhecido** |
| Caller conhecido? | ❌ nenhum no código atual |
| verify_jwt | **false** (público, sem auth) |

**Gap crítico:** sem acesso ao código-fonte deployado, é **impossível** classificar `import-export` para a Fase 2 de migração. O caminho para fechar este gap:

1. Acessar o código via Supabase Dashboard → Edge Functions → `import-export` → "View source" (se disponível) ou via `supabase functions download import-export --project-ref ushsnmlbeurfvlkieiln` (requer CLI auth)
2. OU: contatar quem fez deploy original (~2026-04-02) para fornecer o código
3. OU: aceitar que `import-export` é um consumidor **opaco** da legacy anon/service_role key — se as legacy keys forem desativadas e a função quebrar, sabermos que precisa migração; se continuar funcionando (improvável), saberemos que não usava as legacy keys

### A.6 Risco

🔴 **Alto.** Função pública sem auth, fonte não auditável, implantada há ~6 meses sem revisão conhecida. Independente da migração de chaves, esta função merece investigação de segurança dedicada.

---

## B. Mapa das env vars do projeto Vercel legado `sou-manager`

### B.1 Limitação da auditoria

Sem token de acesso à Vercel API, **não é possível enumerar diretamente as 25 env vars deployadas no projeto `sou-manager`**. A enumeração abaixo é baseada em:

1. `docs/audit/VERCEL_DEPLOYMENT_TOPOLOGY_AUDIT.md` (auditoria 2026-08-08 via Vercel REST API — lista categorias, não todos os 25 nomes)
2. `.env.local` (env local atual — pode espelhar parcialmente o legado)
3. `.vercel/.env.production.local` (snapshot de um link ANTERIOR ao projeto `smg-barber-staging`, não `sou-manager`)
4. `.vercel-temp.env` (conteúdo histórico do commit `124a099^`)

### B.2 Env vars conhecíveis (por fonte)

#### Fonte 1: `VERCEL_DEPLOYMENT_TOPOLOGY_AUDIT.md` §3 (linha 54)

| # | Nome | Categoria |
|---|------|-----------|
| 1 | `VITE_SUPABASE_URL` | configuração |
| 2 | `VITE_SUPABASE_ANON_KEY` | credencial sensível (legacy JWT) |
| 3 | `VITE_SUPABASE_PUBLISHABLE_KEY` | credencial pública (nova) |
| 4 | `VITE_SUPABASE_MULTI_SCHEMA_ENABLED` | configuração (=`true`) |
| 5 | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | credencial pública (nova) |
| 6 | `SUPABASE_SERVICE_ROLE_KEY` | credencial sensível (legacy JWT) |
| 7 | `SUPABASE_JWT_SECRET` | credencial sensível |
| 8 | `POSTGRES_URL` | credencial sensível |
| 9 | `POSTGRES_PASSWORD` | credencial sensível |
| 10 | `POSTGRES_HOST` | configuração |
| 11 | `SMG_API_BASE_URL` | configuração |
| 12 | `SMG_API_TOKEN` | credencial sensível |
| 13 | `SMG_WEBHOOK_SECRET` | credencial sensível |

#### Fonte 2: `.env.local` (local, gitignored — 16 nomes únicos)

```
E2E_SANCHEZ_PASSWORD
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SMG_API_BASE_URL
SMG_API_TOKEN
SMG_PROFESSIONAL_ID_MAP
SMG_SERVICE_ID_MAP
SMG_WEBHOOK_SECRET
SUPABASE_ACCESS_TOKEN
SUPABASE_ANON_KEY
SUPABASE_SECRET_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_URL
VERCEL_AUTOMATION_BYPASS_SECRET
VITE_SUPABASE_ANON_KEY
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_URL
```

Adicionais vs Fonte 1: `E2E_SANCHEZ_PASSWORD`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SMG_PROFESSIONAL_ID_MAP`, `SMG_SERVICE_ID_MAP`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_ANON_KEY` (server-side), `SUPABASE_SECRET_KEY`, `SUPABASE_URL`, `VERCEL_AUTOMATION_BYPASS_SECRET`.

#### Fonte 3: `.vercel/.env.production.local` (snapshot de link a `smg-barber-staging`, NÃO `sou-manager`)

Este arquivo **NÃO** corresponde ao projeto legado. Corresponde a um link anterior a `smg-barber-staging` (projectName no `project.json`). Não é fonte válida para mapear `sou-manager`.

#### Fonte 4: `.vercel-temp.env` (commit `124a099^`)

Conteúdo já auditado — continha `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_ANON_KEY`, `SUPABASE_PUBLISHABLE_KEY`, com `JWT_SECRET`/`SERVICE_ROLE`/`POSTGRES_PASSWORD` VAZIOS. Corresponde a um DEPLOY específico (não ao env permanente do projeto).

### B.3 Enumeradores plausíveis das 25 envs (consolidado)

Combinando fontes e considerando o padrão "Next.js legacy backend" mencionado no audit:

| # | Nome provável | Categoria | Ambiente |
|---|---------------|-----------|----------|
| 1 | `VITE_SUPABASE_URL` | config | PROD (sou-manager) |
| 2 | `VITE_SUPABASE_ANON_KEY` | sensível | PROD (sou-manager) |
| 3 | `VITE_SUPABASE_PUBLISHABLE_KEY` | pública | PROD (sou-manager) |
| 4 | `VITE_SUPABASE_MULTI_SCHEMA_ENABLED` | config | PROD (=`true`) |
| 5 | `NEXT_PUBLIC_SUPABASE_URL` | config | PROD (Next.js) |
| 6 | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | sensível | PROD (Next.js) |
| 7 | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | pública | PROD (Next.js) |
| 8 | `SUPABASE_URL` | config | PROD (server) |
| 9 | `SUPABASE_ANON_KEY` | sensível | PROD (server) |
| 10 | `SUPABASE_SERVICE_ROLE_KEY` | sensível | PROD (server) |
| 11 | `SUPABASE_JWT_SECRET` | sensível | PROD |
| 12 | `SUPABASE_SECRET_KEY` | sensível | PROD (nova, pode ou não estar) |
| 13 | `SUPABASE_ACCESS_TOKEN` | sensível | PROD (Management API) |
| 14 | `POSTGRES_URL` | sensível | PROD (DB direto) |
| 15 | `POSTGRES_PASSWORD` | sensível | PROD (DB direto) |
| 16 | `POSTGRES_HOST` | config | PROD (DB direto) |
| 17 | `POSTGRES_DATABASE` | config | PROD (DB direto) |
| 18 | `POSTGRES_USER` | config | PROD (DB direto) |
| 19 | `SMG_API_BASE_URL` | config | PROD (integração legacy) |
| 20 | `SMG_API_TOKEN` | sensível | PROD (integração legacy) |
| 21 | `SMG_WEBHOOK_SECRET` | sensível | PROD (integração legacy) |
| 22 | `SMG_SERVICE_ID_MAP` | config | PROD (integração legacy) |
| 23 | `SMG_PROFESSIONAL_ID_MAP` | config | PROD (integração legacy) |
| 24 | `E2E_SANCHEZ_PASSWORD` | sensível | PROD (teste E2E) |
| 25 | `VERCEL_AUTOMATION_BYPASS_SECRET` | sensível | PROD (Vercel) |

### B.4 Gap承认ido

**A enumeração acima é uma inferência baseada em padrões e fontes parciais.** Os nomes exatos e valores reais só podem ser confirmados via Vercel Dashboard ou Vercel REST API com token de leitura. Itens #12, #22, #23 são particularmente incertos.

---

## C. Consumidores efetivamente ativos

### C.1 No projeto `smg-barber` (oficial)

| Env | Função | Origem |
|-----|--------|--------|
| `VITE_SUPABASE_URL` | Frontend bundle | build-time |
| `VITE_SUPABASE_ANON_KEY` | Frontend bundle | build-time |

### C.2 No projeto `sou-manager` (legado)

| Env (provável) | Função inferida | Origem | Evidência de uso atual |
|----------------|------------------|--------|------------------------|
| Todos os 25 | legado Next.js + Vercel | runtime + build-time | **NENHUMA** — git link desconectado em 2026-08-08 (D-HOM-11). Não dispara mais deploys. |
| Domínios `soumanager.com`, `club.soumanager.com` | servem conteúdo estático | — | podem receber tráfego direto (não via deploy) |

### C.3 Edge Functions deployadas em PROD (5)

| Função | Env vars consumidas (inferido do código) |
|--------|-------------------------------------------|
| `admin-create-user` | `SUPABASE_SERVICE_ROLE_KEY` + `SUPABASE_ANON_KEY` |
| `portal-auth` | `SUPABASE_SERVICE_ROLE_KEY` |
| `import-export` | **desconhecido (fonte ausente)** |
| `invite-team-member` | `SUPABASE_SERVICE_ROLE_KEY` + `SUPABASE_ANON_KEY` |
| `worker-dispatcher` | `SUPABASE_PUBLISHABLE_KEYS` (nova), `APP_URL`, `EDGE_JWT_SECRET` |

---

## D. Dependências da legacy anon key

| Consumidor | Depende de `SUPABASE_ANON_KEY` legacy? | Evidência |
|------------|----------------------------------------|-----------|
| Frontend `smg-barber` | ✅ SIM | `client.ts:13`, `permissions/service.ts:13`, `eventInfrastructure.ts:124` |
| Frontend `sou-manager` legado | ✅ SIM (provavelmente) | inferência — mesmo bundle, mesmas vars |
| `admin-create-user` | ✅ SIM | `index.ts:69` |
| `invite-team-member` | ✅ SIM | `index.ts:43` |
| `notification-sweep` | ✅ SIM (em código) | `index.ts:24` — mas **NÃO deployada em PROD** |
| `supabase-usage-monitor` | ✅ SIM (em código) | `index.ts:69,97` — mas **NÃO deployada em PROD** |
| `site-sanchez-appointments` | ❌ não | usa apenas service_role |
| `import-export` | ❓ **desconhecido** | fonte ausente |
| `worker-dispatcher` | ❌ não | usa publishable nova |
| `portal-auth` | ❌ não | usa apenas service_role |
| pg_cron D8 | ✅ SIM | header `Authorization: Bearer <anon legacy>` |
| Tests (vários) | ✅ SIM | leem `VITE_SUPABASE_ANON_KEY` |

**Contagem confirmada de dependências ativas em PROD:** 6 (frontend + admin-create-user + invite-team-member + pg_cron D8 + tests E2E locais).

---

## E. Dependências da `service_role`

| Consumidor | Depende de `SUPABASE_SERVICE_ROLE_KEY`? | Evidência |
|------------|------------------------------------------|-----------|
| `admin-create-user` | ✅ SIM | `index.ts:53` |
| `portal-auth` | ✅ SIM | `index.ts:42` |
| `invite-team-member` | ✅ SIM | `index.ts:17` |
| `supabase-usage-monitor` | ✅ SIM (em código) | `index.ts:97` — **NÃO deployada em PROD** |
| `site-sanchez-appointments` | ✅ SIM (em código) | `index.ts:193` — **NÃO deployada em PROD** |
| `import-export` | ❓ **desconhecido** | fonte ausente |
| `worker-dispatcher` | ❌ não | usa `worker_dispatcher` role (não service_role) |
| `notification-sweep` | ❌ não | usa apenas anon |
| Frontend | ❌ não | RLS protege; frontend não usa service_role |
| pg_cron D8 | ❌ não | usa anon (acima) |
| Tests | ✅ SIM | leem `SUPABASE_SERVICE_ROLE_KEY` |
| Vercel `sou-manager` legado | ✅ SIM (provavelmente) | env listada na auditoria |

**Contagem confirmada de dependências ativas em PROD:** 5 (3 Edge Functions + tests + legado Vercel).

---

## F. Riscos encontrados

| # | Risco | Severidade | Mitigação proposta |
|---|-------|------------|--------------------|
| R1 | `import-export` é endpoint público (`verify_jwt: false`) com fonte não auditável | 🔴 crítico | Investigação de segurança dedicada ANTES da migração |
| R2 | `import-export` pode usar legacy anon/service_role — quebra silenciosa se desativarmos | 🟠 alto | Confirmar fonte via Supabase Dashboard antes de desativar legacy |
| R3 | Frontend `sou-manager` legado pode ainda receber tráfego direto (domínios ativos) | 🟠 alto | Verificar analytics / logs de acesso nos domínios legados |
| R4 | 25 envs no legado contêm credenciais — exposição histórica de `.vercel-temp.env` é parte desse conjunto | 🟡 médio | Decisão PO sobre destino do legado (deletar projeto? limpar envs?) |
| R5 | pg_cron D8 quebra IMEDIATAMENTE se legacy anon for desativada sem re-registro prévio | 🟠 alto | Re-registro é pré-condição absoluta (já no plano) |
| R6 | `.vercel/.env.production.local` contém `VITE_SUPABASE_ANON_KEY` legacy em texto claro no disco local | 🟡 médio | Sanitizar arquivo após uso (não commitado — `.vercel/` é gitignored) |

---

## G. Ajustes necessários no plano original da Fase 2

### G.1 Adições obrigatórias

1. **`import-export`** — adicionar como consumidor **condicional**: se confirmar uso de legacy keys, incluir na migração; se não usar, deletar a função por segurança (recomendação independente)
2. **`sou-manager` legado** — adicionar **pré-condição** de saneamento: PO decide destino (deletar projeto, limpar envs, ou manter)
3. **Testes E2E locais** — confirmar que tests não rodam contra PROD inadvertidamente (já usam STAGING per código)

### G.2 Remoções do plano original

- ~~B4 `supabase-usage-monitor`~~ — NÃO deployada em PROD
- ~~B5 `site-sanchez-appointments`~~ — NÃO deployada em PROD
- ~~B6 `notification-sweep`~~ — NÃO deployada em PROD

### G.3 Mudanças de escopo

- **A1 (frontend)** — confirmado requer **edição de código** + build + deploy (não apenas Vercel)
- **C1 (pg_cron)** — confirmado requer re-registro atômico (transação)
- **Sequência:** importar-export decisão **ANTES** de criar/rotacionar chaves (não pode esperar)

---

## H. Recomendação de janela/ordem para futura migração

### H.1 Pré-condições obrigatórias (antes de criar/rotacionar chaves)

1. **Decisão sobre `import-export`:**
   - Opção A: Investigar fonte no Supabase Dashboard (download ou view source) — **recomendado**
   - Opção B: Deletar a função (não há caller conhecido; é pública sem auth; risco de segurança independente)
   - Opção C: Aceitar como consumidor opaco e tratar falha pós-desativação

2. **Decisão sobre `sou-manager` legado:**
   - Opção A: Deletar projeto Vercel (remove 25 envs e domínios)
   - Opção B: Limpar envs (manter projeto, remover credenciais)
   - Opção C: Manter como está (status quo — sem deploys automáticos)

3. **Confirmação do frontend `smg-barber`:** editar código + build + deploy com `VITE_SUPABASE_PUBLISHABLE_KEY`

### H.2 Sequência recomendada de migração (sujeita a P1–H.1)

```
[PRÉ] Decisões sobre import-export e sou-manager legado
   ↓
[STAGING canário]
   1. Re-deploy Edge Functions B1-B3 (portal-auth, admin-create-user, invite-team-member) com SUPABASE_SECRET_KEY
   2. Re-deploy worker-dispatcher (se necessário — blocker EDGE_JWT_SECRET separado)
   3. Re-registrar pg_cron STAGING com nova publishable
   4. Atualizar frontend STAGING (Vercel preview deploy) com publishable
   5. Validar: login E2E + smoke + worker_heartbeat
   ↓
[PROD janela baixo tráfego]
   1. Edge Functions B1-B3 (deploy discreto por função, com rollback pronto)
   2. pg_cron C1 (re-registro atômico)
   3. Frontend A1 (build + deploy Vercel + validação login)
   4. Tests D1-D4 (atualização de nomes — sem impacto runtime)
   5. .env.local F1 (atualização local)
   ↓
[Observação ≥24h]
   ↓
[Desativação legacy — 5 condições AND]
   1. Todos os consumidores migrados e validados
   2. Sem incidentes relacionados por 24h
   3. Grep final: zero referências a SUPABASE_ANON_KEY/SERVICE_ROLE_KEY em runtime
   4. worker_heartbeat mostra 24h+ saudável
   5. PO aprova explicitamente
```

### H.3 Janela de baixo tráfego

Recomendação: **madrugada de domingo** (menor tráfego no SaaS de barbearias). Confirmar com analytics.

---

## STOP

Esta investigação termina aqui. **Nenhuma mutação foi executada.**

### Pendente de autorização do PO:

1. **Decisão sobre `import-export`:** investigar fonte / deletar / aceitar opaco
2. **Decisão sobre `sou-manager` legado:** deletar / limpar / manter
3. **Confirmação de janela** (P5)
4. **Autorização para iniciar Fase 2** (com escopo atualizado)

### Não entregue (depende de ação do PO ou nova autorização):

- Enumeração completa e verificada das 25 envs do `sou-manager` (requer Vercel API token)
- Fonte do `import-export` (requer Supabase Dashboard ou CLI auth)
- Valores reais de qualquer credencial (nunca expostos)
- Qualquer mutação
