# VERCEL DEPLOYMENT TOPOLOGY AUDIT — SMG BARBER (H-8)

> **Data da auditoria:** 2026-08-08
> **Autorização:** Decisão do PO (2026-08-08) — auditoria **somente leitura** dos projetos Vercel `smg-barber` e `sou-manager` para esclarecer a duplicidade detectada (mesmo commit `68acda4` implantado em dois projetos).
> **Modo:** ✅ **READ-ONLY** — nenhum projeto, domínio, variável, deployment ou configuração foi criado, alterado, excluído ou desativado.
> **Métodos de evidência:** Vercel REST API (GET exclusivamente) + CLI `vercel` em modo leitura + inspeção HTTP dos bundles deployados + `git` local.
> **Pergunta do PO:** qual dos dois projetos é o frontend oficial de produção do SMG Barber?
>
> **AÇÃO AUTORIZADA PÓS-AUDITORIA (2026-08-08, D-HOM-11):** com aprovação explícita do PO, o **git link do projeto `sou-manager` foi DESCONECTADO** (double-deploy eliminado; projeto, domínios, env e histórico **intactos**; reversível via `vercel git connect`). Ver §6 e §8.
>
> **REVALIDAÇÃO READ-ONLY (2026-09-02, D-HOM-28 — H-8 🟢 PASS COM CONDIÇÃO):** produção `smg-barber` em **`c1c40da`** (release v1.5 / FASE 6 — merge `2ce5a7f` + docs `c1c40da`; bundle `/assets/index-DXO2_Rnd.js` validado com código FASE 6 e URL de produção, sem URL de staging) — deploy automático na Vercel após o push do merge. **4 migrations corretivas tenant-scoped verificadas como aplicadas em produção** (assinaturas + guardas + MD5). Novo projeto inventariado: **`smg-estetica`** — conectado ao MESMO repo `sou-manager`, deploya os mesmos commits; **registrado para trilha própria** (decisão PO: não bloqueia o D-HOM). **Condição em aberto (PASS COM CONDIÇÃO):** ACL residual das 3 RPCs (`correct_appointment_attendance`, `register_comanda_payment`, `confirm_appointment_attendance` com `anon`/`service_role`) — retrofit na branch `chore/seguranca-acl-retrofit-3-rpcs` (migration `20260902000000…`), **homologação antes da aplicação**.

---

## 1. Resumo executivo

Os dois projetos Vercel (`smg-barber` e `sou-manager`) **servem o mesmo aplicativo** (mesmo repositório `augustosanchesmanager-ux/sou-manager`), **apontam para o mesmo Supabase** (`ushsnmlbeurfvlkieiln` — Sanchez Barber) e **reagem ao mesmo repositório** (ambos criaram preview do commit `68acda4` no mesmo instante, a 36 ms de diferença).

O **frontend oficial de produção do SMG Barber** é o projeto **`smg-barber`**, atendendo o domínio **`barber.soumanager.com`** (padrão de domínio `{produto}.soumanager.com` da TAXONOMY). O projeto `sou-manager` é o **projeto-raiz legado** (domínios `soumanager.com` e `club.soumanager.com`), com o mesmo app/Supabase, mas com **configuração divergente e env inchado** (25 variáveis, incluindo credenciais diretas de banco).

**Achado crítico adicional (histórico — RESOLVIDO em D-HOM-28, 2026-09-02):** na época da auditoria, a **produção de ambos os projetos estava defasada** — o último deployment de produção (nos dois) era o commit `718f6f9` (~2026-07-17), **sem** as fases 6.0.1–6.0.5 e **sem** o fix de comissões (`68acda4`); os builds validados estavam em **previews** da branch `feature/phase-6.0.4-billing`. **Desde 2026-09-02, a produção `smg-barber` está em `c1c40da` (FASE 6) — revalidada em D-HOM-28 (H-8 PASS COM CONDIÇÃO).**

---

## 2. Vercel Project A — `smg-barber` ✅ (OFICIAL)

| Atributo | Valor |
|----------|-------|
| Project ID | `prj_M3cJ2cZosLONAt9IzumF2LwJZTSj` |
| Criado em | 2026-04-19 |
| **Domínios** | **`barber.soumanager.com`** (produção oficial) + `smg-barber.vercel.app` |
| Repositório | `augustosanchesmanager-ux/sou-manager` (GitHub, conectado — `type: github`) |
| Production Branch | `main` |
| Framework | `Other` |
| Build Command | `npm run vercel-build` ou `npm run build` |
| Output Directory | `public` se existir, senão `.` |
| **Env vars** | **2**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (production + preview) |
| Multi-schema | `VITE_SUPABASE_MULTI_SCHEMA_ENABLED` **NÃO definido** (default `false` → tabelas em `public`) |
| Supabase (bundle) | `https://ushsnmlbeurfvlkieiln.supabase.co` (Sanchez Barber) |
| Último deploy de produção | **`c1c40da` (2026-09-02, FASE 6 — revalidado em D-HOM-28)** — `src=git`; histórico: `718f6f9` (2026-07-17) na época da auditoria |
| Preview `68acda4` | `smg-barber-ooch8xc6g-*.vercel.app` — READY (preview, protegido por login) |
| Limpeza do env | ✅ Mínimo e coerente com um SPA Vite |

## 3. Vercel Project B — `sou-manager` ⚠️ (LEGADO/RAIZ)

| Atributo | Valor |
|----------|-------|
| Project ID | `prj_fnQHNKxQR2XRMhAg5y9eA0qwyIN3` |
| Criado em | 2026-02-20 |
| **Domínios** | `soumanager.com`, `club.soumanager.com`, `soumanager.vercel.app` |
| Repositório | `augustosanchesmanager-ux/sou-manager` — **link git DESCONECTADO em 2026-08-08 (D-HOM-11, autorização PO)** — não dispara mais deploys no push; era `sourceless: true` (integração git legada/dormante) |
| Production Branch | `main` |
| Framework | `Vite` |
| Build Command | `npm run build` ou `vite build` |
| Output Directory | Nenhum |
| **Env vars** | **25** — inclui `VITE_SUPABASE_*`, `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `POSTGRES_URL`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, `SMG_API_*`, `SMG_WEBHOOK_SECRET` (legado backend Next.js) |
| Multi-schema | `VITE_SUPABASE_MULTI_SCHEMA_ENABLED=true` (production) — **divergente** do projeto oficial |
| Supabase (bundle) | `https://ushsnmlbeurfvlkieiln.supabase.co` (mesmo projeto) |
| Último deploy de produção | `718f6f9` (2026-07-17) — mesmo commit/instante do `smg-barber` |
| Preview `68acda4` | `sou-manager-dzjv3mh49-*.vercel.app` — READY (preview, criado 36 ms após o do `smg-barber`) |

---

## 4. Análise comparativa

| Item | `smg-barber` | `sou-manager` | Divergência? |
|------|--------------|---------------|--------------|
| Repositório | sou-manager | sou-manager | Não |
| Production branch | `main` | `main` | Não |
| App servido | mesmo SPA | mesmo SPA | Não |
| Supabase | `ushsnmlbeurfvlkieiln` | `ushsnmlbeurfvlkieiln` | Não |
| Domínio | `barber.soumanager.com` | `soumanager.com` / `club.soumanager.com` | Sim (distintos) |
| Env vars | 2 | 25 | **Sim (grande)** |
| `MULTI_SCHEMA_ENABLED` | não definido | `true` (prod) | **Sim (funcional)** |
| Credenciais secretas no env | não | `POSTGRES_*`, `SERVICE_ROLE`, `JWT_SECRET` | **Sim (risco)** |
| Integração git | conectada (ativa) | **desconectada em 2026-08-08 (D-HOM-11)** | **Sim (eliminada)** |
| Último deploy de produção | `718f6f9` | `718f6f9` | Não (idêntico) |

### 4.1 Origem da duplicidade (evidência)

O commit `68acda4` (fix de comissões, push em `feature/phase-6.0.4-billing`) gerou **dois deployments de preview simultâneos**:

- `smg-barber-ooch8xc6g-...` — created `1786210103585`
- `sou-manager-dzjv3mh49-...` — created `1786210103549` (36 ms antes)

Histórico de produção de **ambos** é idêntico commit a commit (`718f6f9` → `c9488bb` → `a8a6627` → `e03440f` → ... → `12e37c7`), com timestamps coincidentes — prova de que **o repositório já foi ligado aos dois projetos simultaneamente** e ambos reagiam ao mesmo repositório. Consequência (na época da auditoria): **um merge para `main` disparava deploy de produção nos DOIS projetos.**

> **Resolvido em 2026-08-08 (D-HOM-11):** o git link do `sou-manager` foi **desconectado** com autorização do PO — **um merge para `main` agora dispara deploy de produção APENAS no `smg-barber`** (oficial). Reversível via `vercel git connect`.

### 4.2 Configuração de produção defasada (achado crítico)

O último deployment de produção (ambos os projetos) é `718f6f9` — "fix(cash-closing): auditoria tecnica — comissao dinamica..." (~2026-07-17). `origin/main` no repositório local também está em `718f6f9`. Portanto:

- A produção atual **não contém** as fases 6.0.1–6.0.5 (onboarding, team invitations, billing, feature flags, lifecycle);
- A produção atual **não contém** o fix de comissões `68acda4`;
- Os builds homologados/validados (Flow14, Flow13, Smoke, fix de comissões) estão em **previews da branch** `feature/phase-6.0.4-billing`.

Isso significa que **o deploy de produção da release v1.5 ainda não aconteceu** e precisa ser planejado (merge + build + validação) — decisão do PO.

> **⚠️ SEÇÃO HISTÓRICA (estado em 2026-08-08) — RESOLVIDA em D-HOM-28 (2026-09-02):** a produção `smg-barber` agora está em **`c1c40da`** (release v1.5 / FASE 6) via deploy automático pós-merge `2ce5a7f` — a produção não depende mais de `718f6f9`.

---

## 5. Veredito

| Item | Conclusão |
|------|-----------|
| **Oficial** | **`smg-barber`** → `barber.soumanager.com` (única origem oficial do frontend de produção do SMG Barber, conforme TAXONOMY `{produto}.soumanager.com`) |
| **Duplicado/legado** | **`sou-manager`** — projeto-raiz legado (mesmo app + mesmo Supabase), domínios `soumanager.com`/`club.soumanager.com`, env com credenciais legadas de backend |
| **Conflito** | ❌ **Nenhum conflito de domínio ativo** (domínios distintos). ⚠️ **Riscos**: (1) ~~double-deploy em merge para `main`~~ → **ELIMINADO (D-HOM-11, git link do legado desconectado)**; (2) divergência funcional de `MULTI_SCHEMA_ENABLED`; (3) credenciais sensíveis no env do legado |
| **Risco de homologação** | ✅ **RESOLVIDO (D-HOM-28, 2026-09-02):** produção em `c1c40da` (release v1.5 / FASE 6). **Condição em aberto:** ACL residual das 3 RPCs (`anon`/`service_role`) — retrofit em trilha própria `chore/seguranca-acl-retrofit-3-rpcs`, **homologação antes da aplicação** |

## 6. Ações recomendadas — status de execução

| # | Ação | Status |
|---|------|--------|
| 1 | **Confirmar `smg-barber` como única origem oficial** e planejar o destino do `sou-manager` | ✅ Oficial confirmado; **destino definitivo do legado continua decisão do PO** (git link desconectado por ora — projeto/domínios/env preservados) |
| 2 | **Eliminar o double-deploy:** desconectar a integração git do `sou-manager` | ✅ **EXECUTADO em 2026-08-08 (D-HOM-11)** — ver §8 |
| 3 | **Reconciliar env:** remover divergência de `VITE_SUPABASE_MULTI_SCHEMA_ENABLED` e limpar credenciais legadas (`POSTGRES_*`, `SERVICE_ROLE`, `JWT_SECRET`, `SMG_*`) do projeto que deixar de ser usado | ⏳ Aguarda decisão do PO (env do legado) |
| 4 | **Planejar o deploy de produção da release v1.5** (merge para `main` + build + smoke pós-deploy) como etapa explícita da homologação — antes do veredito final | ✅ **Realizado (H-8 🟢 PASS COM CONDIÇÃO, D-HOM-28, 2026-09-02): produção em `c1c40da` (FASE 6)** — deploy automático pós-merge `2ce5a7f`; smoke pós-deploy = revalidação read-only |
| 5 | **Adicionar o gate H-8** ao plano de homologação | ✅ Registrado (H-8 em `HOMOLOGATION_PLAN_SANCHEZ_BARBER.md` + `RELEASE_CHECKLIST_v1.5.md`) |
| 6 | **Proteção de preview** (Vercel Authentication) | ⏳ Decisão do PO (2026-08-08: manter por ora; validar via localhost) |
| 7 | **Inventariar `smg-estetica`** (terceiro projeto Vercel, mesmo repo `sou-manager`, deploya os mesmos commits) — registrar evolução em trilha própria | ✅ **Registrado (D-HOM-28, 2026-09-02)** — não bloqueia o D-HOM; trilha própria futura |

## 7. Evidências coletadas (somente leitura)

- `vercel whoami` / `vercel projects ls` — inventário do time `team_KgriBFsF8Nb5FBNH2Sku6opS` (11 projetos).
- Vercel REST API (GET): `/v9/projects/{id}`, `/v9/projects/{id}/domains`, `/v9/projects/{id}/env`, `/v6/deployments?target=production`, `/v6/deployments?limit=100` (busca por `68acda4`).
- HTTP: bundles de produção de `barber.soumanager.com` e `soumanager.com` → `supabase ref = ushsnmlbeurfvlkieiln`.
- `vercel env pull` (produção, `smg-barber`) + `.vercel/.env.production.local` (snapshot anterior).
- `git log origin/main` → `718f6f9` (produção atual na época da auditoria).
- **Revalidação 2026-09-02 (D-HOM-28, read-only):** bundle de produção `barber.soumanager.com` → `/assets/index-DXO2_Rnd.js` (247KB, código FASE 6 — `bulk_close_comandas_admin` presente, URL de produção sem staging) em `c1c40da`; consultas DB read-only (assinaturas/guardas/ACL das RPCs tenant-scoped + `get_comanda_payment_summary`); inventário Vercel → **`smg-estetica`** (mesmo repo, mesmos commits).

## 8. Execução autorizada pós-auditoria (D-HOM-11) — desconexão do git link do `sou-manager`

| Item | Detalhe |
|------|---------|
| Decisão | PO (2026-08-08): **desativar o git link do legado `sou-manager`** — melhor opção para eliminar o double-deploy antes do merge em `main`; reversível |
| Comando | `vercel git disconnect` (CLI 50.38.3), diretório temporário linkado ao projeto `sou-manager` (`prj_fnQHNKxQR2XRMhAg5y9eA0qwyIN3`) |
| Confirmação | `sou-manager` → `link: NULL` (GET `/v9/projects/prj_fnQHNKxQR2XRMhAg5y9eA0qwyIN3` após a ação) |
| Preservado | Projeto, domínios (`soumanager.com`, `club.soumanager.com`, `soumanager.vercel.app`), env (25 vars) e histórico de deployments — **nada deletado** |
| Reversão | `vercel git connect` (relink) — reativável a qualquer momento |
| Verificação de sanidade | `smg-barber` (`prj_M3cJ2cZosLONAt9IzumF2LwJZTSj`) **inalterado**: link `type=github`, repo `sou-manager` |
| Registro | D-HOM-11 em `docs/BUSINESS_DECISIONS.md`; §8.1 #2 do plano de homologação; `RELEASE_CHECKLIST_v1.5.md`; `PROJECT_STATUS.md` |

> **Garantia:** durante a auditoria **nenhuma alteração** foi feita em qualquer projeto Vercel (env, domínio, deployment, link git ou configuração). A única escrita foi local: os arquivos deste relatório e os arquivos temporários de evidência. A **única** alteração remota autorizada foi a desconexão do git link do `sou-manager` (D-HOM-11, §8) — nenhuma outra mutação foi executada.
