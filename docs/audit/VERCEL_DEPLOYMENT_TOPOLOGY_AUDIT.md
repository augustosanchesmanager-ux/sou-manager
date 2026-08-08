# VERCEL DEPLOYMENT TOPOLOGY AUDIT — SMG BARBER (H-8)

> **Data da auditoria:** 2026-08-08
> **Autorização:** Decisão do PO (2026-08-08) — auditoria **somente leitura** dos projetos Vercel `smg-barber` e `sou-manager` para esclarecer a duplicidade detectada (mesmo commit `68acda4` implantado em dois projetos).
> **Modo:** ✅ **READ-ONLY** — nenhum projeto, domínio, variável, deployment ou configuração foi criado, alterado, excluído ou desativado.
> **Métodos de evidência:** Vercel REST API (GET exclusivamente) + CLI `vercel` em modo leitura + inspeção HTTP dos bundles deployados + `git` local.
> **Pergunta do PO:** qual dos dois projetos é o frontend oficial de produção do SMG Barber?

---

## 1. Resumo executivo

Os dois projetos Vercel (`smg-barber` e `sou-manager`) **servem o mesmo aplicativo** (mesmo repositório `augustosanchesmanager-ux/sou-manager`), **apontam para o mesmo Supabase** (`ushsnmlbeurfvlkieiln` — Sanchez Barber) e **reagem ao mesmo repositório** (ambos criaram preview do commit `68acda4` no mesmo instante, a 36 ms de diferença).

O **frontend oficial de produção do SMG Barber** é o projeto **`smg-barber`**, atendendo o domínio **`barber.soumanager.com`** (padrão de domínio `{produto}.soumanager.com` da TAXONOMY). O projeto `sou-manager` é o **projeto-raiz legado** (domínios `soumanager.com` e `club.soumanager.com`), com o mesmo app/Supabase, mas com **configuração divergente e env inchado** (25 variáveis, incluindo credenciais diretas de banco).

**Achado crítico adicional:** a **produção de ambos os projetos está defasada** — o último deployment de produção (nos dois) é o commit `718f6f9` (~2026-07-17), **sem** as fases 6.0.1–6.0.5 e **sem** o fix de comissões (`68acda4`). Os builds validados recentemente (E2E Flow14/Flow13/Smoke e o fix de comissões) estão em **deployments de preview** da branch `feature/phase-6.0.4-billing`.

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
| Último deploy de produção | `718f6f9` (2026-07-17) — `src=git` |
| Preview `68acda4` | `smg-barber-ooch8xc6g-*.vercel.app` — READY (preview, protegido por login) |
| Limpeza do env | ✅ Mínimo e coerente com um SPA Vite |

## 3. Vercel Project B — `sou-manager` ⚠️ (LEGADO/RAIZ)

| Atributo | Valor |
|----------|-------|
| Project ID | `prj_fnQHNKxQR2XRMhAg5y9eA0qwyIN3` |
| Criado em | 2026-02-20 |
| **Domínios** | `soumanager.com`, `club.soumanager.com`, `soumanager.vercel.app` |
| Repositório | `augustosanchesmanager-ux/sou-manager` — link presente porém marcado **`sourceless: true`** (integração git legada/dormante) — **ainda assim dispara previews no push** |
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
| Integração git | conectada (ativa) | `sourceless: true` (legada) | **Sim** |
| Último deploy de produção | `718f6f9` | `718f6f9` | Não (idêntico) |

### 4.1 Origem da duplicidade (evidência)

O commit `68acda4` (fix de comissões, push em `feature/phase-6.0.4-billing`) gerou **dois deployments de preview simultâneos**:

- `smg-barber-ooch8xc6g-...` — created `1786210103585`
- `sou-manager-dzjv3mh49-...` — created `1786210103549` (36 ms antes)

Histórico de produção de **ambos** é idêntico commit a commit (`718f6f9` → `c9488bb` → `a8a6627` → `e03440f` → ... → `12e37c7`), com timestamps coincidentes — prova de que **o repositório já foi ligado aos dois projetos simultaneamente** e ambos continuam reagindo ao mesmo repositório. Consequência: **um merge para `main` dispara deploy de produção nos DOIS projetos.**

### 4.2 Configuração de produção defasada (achado crítico)

O último deployment de produção (ambos os projetos) é `718f6f9` — "fix(cash-closing): auditoria tecnica — comissao dinamica..." (~2026-07-17). `origin/main` no repositório local também está em `718f6f9`. Portanto:

- A produção atual **não contém** as fases 6.0.1–6.0.5 (onboarding, team invitations, billing, feature flags, lifecycle);
- A produção atual **não contém** o fix de comissões `68acda4`;
- Os builds homologados/validados (Flow14, Flow13, Smoke, fix de comissões) estão em **previews da branch** `feature/phase-6.0.4-billing`.

Isso significa que **o deploy de produção da release v1.5 ainda não aconteceu** e precisa ser planejado (merge + build + validação) — decisão do PO.

---

## 5. Veredito

| Item | Conclusão |
|------|-----------|
| **Oficial** | **`smg-barber`** → `barber.soumanager.com` (única origem oficial do frontend de produção do SMG Barber, conforme TAXONOMY `{produto}.soumanager.com`) |
| **Duplicado/legado** | **`sou-manager`** — projeto-raiz legado (mesmo app + mesmo Supabase), domínios `soumanager.com`/`club.soumanager.com`, env com credenciais legadas de backend |
| **Conflito** | ❌ **Nenhum conflito de domínio ativo** (domínios distintos). ⚠️ **Riscos**: (1) double-deploy em merge para `main`; (2) divergência funcional de `MULTI_SCHEMA_ENABLED`; (3) credenciais sensíveis no env do legado |
| **Risco de homologação** | 🔴 **Produção defasada** (`718f6f9`): homologar frontend que esteja no ar hoje ≠ homologar a release v1.5. O deploy da release deve entrar no plano de homologação |

## 6. Ações recomendadas (NENHUMA executada — aguardam decisão do PO)

1. **Confirmar `smg-barber` como única origem oficial** e planejar o destino do `sou-manager` (desativar/suspender projeto ou remover ligação git) — decisão do PO; nada foi alterado.
2. **Eliminar o double-deploy:** como ambos reagem ao push/merge, desconectar a integração git do `sou-manager` (ou outra mitigação) antes de qualquer merge para `main`.
3. **Reconciliar env:** remover divergência de `VITE_SUPABASE_MULTI_SCHEMA_ENABLED` e limpar credenciais legadas (`POSTGRES_*`, `SERVICE_ROLE`, `JWT_SECRET`, `SMG_*`) do projeto que deixar de ser usado.
4. **Planejar o deploy de produção da release v1.5** (merge para `main` + build + smoke pós-deploy) como etapa explícita da homologação — antes do veredito final.
5. **Adicionar o gate H-8** ao plano de homologação (registrado em `docs/audit/HOMOLOGATION_PLAN_SANCHEZ_BARBER.md` e `RELEASE_CHECKLIST_v1.5.md`).

## 7. Evidências coletadas (somente leitura)

- `vercel whoami` / `vercel projects ls` — inventário do time `team_KgriBFsF8Nb5FBNH2Sku6opS` (11 projetos).
- Vercel REST API (GET): `/v9/projects/{id}`, `/v9/projects/{id}/domains`, `/v9/projects/{id}/env`, `/v6/deployments?target=production`, `/v6/deployments?limit=100` (busca por `68acda4`).
- HTTP: bundles de produção de `barber.soumanager.com` e `soumanager.com` → `supabase ref = ushsnmlbeurfvlkieiln`.
- `vercel env pull` (produção, `smg-barber`) + `.vercel/.env.production.local` (snapshot anterior).
- `git log origin/main` → `718f6f9` (produção atual).

> **Garantia:** durante esta auditoria **nenhuma alteração** foi feita em qualquer projeto Vercel (env, domínio, deployment, link git ou configuração). A única escrita foi local: os arquivos deste relatório e os arquivos temporários de evidência.
