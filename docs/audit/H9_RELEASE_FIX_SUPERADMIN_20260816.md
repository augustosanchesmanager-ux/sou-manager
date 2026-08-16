# H-9 — RELEASE DO FIX `tenants.active` (merge + deploy + smoke pós-deploy)

> **Data:** 2026-08-16
> **Autor:** OpenCode (Tech Lead operacional), com autorização operacional explícita do PO para release do incidente.
> **Escopo:** merge fast-forward da `feature/phase-6.0.4-billing` em `main`, deploy de produção Vercel, smoke pós-deploy, registro de evidências e declaração de encerramento do incidente `tenants.active` (padrão 42703 da Trilha A).
> **Regra absoluta:** **NENHUMA migration, mudança de banco, Fase 4/Event Store/Outbox ou replay de eventos nesta execução.** Operação 100% release (código já validado no H-8.1).
> **Relacionado:** `docs/audit/H7_1_TRILHA_A_REPRODUCAO.md` · `docs/audit/H8_1_FIX_SUPERADMIN.md` (se existente) · `ROADMAP.md` (linha 8.26) · `PROJECT_STATUS.md`.

---

## 1. Objetivo

Executar o release autorizado da correção do incidente `tenants.active` — coluna inexistente (padrão 42703) usada na página `/superadmin`, última ocorrência runtime da Trilha A — colocando a correção em produção e validando a operação com smoke real.

---

## 2. Autorização (PO, 2026-08-16)

| Ação | Autorizado | Observação |
|------|-----------|------------|
| Merge `feature/phase-6.0.4-billing → main` | ✅ | Fast-forward puro confirmado via `merge-base --is-ancestor` (`718f6f9` é ancestral de `c44ca6d`) |
| Deploy de produção (Vercel `smg-barber`) | ✅ | |
| Acompanhar deployment | ✅ | |
| Smoke pós-deploy | ✅ | |
| Registrar evidências | ✅ | |
| Declarar incidente encerrado | ✅ | Somente após as evidências |
| Migrations / mudança de banco | ❌ | Fora do escopo |
| Fase 4 / Event Store / Outbox / replay | ❌ | Fora do escopo |

**Regra operacional:** parar imediatamente se qualquer divergência aparecesse antes do deploy. Nenhuma divergência ocorreu.

---

## 3. Reconhecimento pré-release (estado confirmado)

| Item | Estado |
|------|--------|
| `origin/main` antes do release | `718f6f9` (produção defasada; deploy Vercel 17/07/2026) |
| `origin/feature/phase-6.0.4-billing` | `c44ca6d` (103 commits à frente de `main`) |
| Merge-base | `718f6f9` = ancestral da branch → **fast-forward puro, zero conflitos** |
| Commit de fix presente na branch | `c44ca6d` `fix(superadmin): H-8.1 elimina ultimo uso runtime de tenants.active` (2 linhas em `pages/SuperAdmin.tsx`) |
| Correção original da Trilha A presente | `src/lib/supabase/tenant.ts:109` `fetchTenantsByIds` usa `select('id, name, slug, app_slug, plan, status, created_at')` |
| Projeto Vercel | `smg-barber` (org `augustosanchesmanager-uxs-projects`, projeto `prj_M3cJ2cZosLONAt9IzumF2LwJZTSj`) |
| CLI Vercel | `50.38.3`, autenticado como `augustosanchesmanager-uxs` |
| Deploy de produção pré-release | `dpl_369XRZ8bC87vxPaxLsDjm6C5p5xA` — `barber.soumanager.com` (17/07/2026) |
| Divergência pré-deploy | **Nenhuma** — scopo autorizado respeitado integralmente |

---

## 4. Execução do release

### 4.1 Merge (fast-forward)

```bash
git push origin origin/feature/phase-6.0.4-billing:refs/heads/main
# 718f6f9..c44ca6d  origin/feature/phase-6.0.4-billing -> main
```

- `origin/main` agora = `c44ca6d` (confirmado via `git log --oneline origin/main -1`).
- Sem merge commit, sem conflitos, sem força de push.

### 4.2 Deploy de produção (Vercel)

- O push em `main` disparou o **git integration** automaticamente.
- Novo deployment de produção: **`dpl_91Hxq6R29DLTqk18aSkPD8Jo8iBz`**
  - URL: `https://smg-barber-p35cqzzs7-augustosanchesmanager-uxs-projects.vercel.app`
  - Status: **● Ready** (duração 16s)
  - Criado: 2026-08-16 19:41:57 BRT
  - Source: branch `main` (alias `smg-barber-git-main-*`)
  - Aliases: `barber.soumanager.com` · `smg-barber.vercel.app`
- Confirmação: `vercel inspect https://barber.soumanager.com` → `dpl_91Hxq6R29DLTqk18aSkPD8Jo8iBz` (Ready, production).

---

## 5. Smoke pós-deploy

### 5.1 Validação estática do bundle servido em produção

| Verificação | Alvo | Resultado |
|-------------|------|-----------|
| HTTP 200 `https://barber.soumanager.com/` | HTML | ✅ `assets/index-BCZW83Hs.js` |
| `tenant.ts` usa `status` (não `active`) | `index-*.js` | ✅ `app_slug, plan, status, created_at` presente |
| `SuperAdmin` sem `slug, active, created_at` | `SuperAdmin-DUqljjxV.js` | ✅ padrão `active` **não encontrado** |
| `SuperAdmin` usa `slug, status, created_at` | `SuperAdmin-DUqljjxV.js` | ✅ presente |

### 5.2 Suite E2E de smoke contra a produção

Comando:
```bash
PLAYWRIGHT_BASE_URL=https://barber.soumanager.com npx playwright test --grep "@smoke"
```

**Resultado: 10/10 passaram (49.8s).** Coverage do H-9:

| Teste | Valida o que o PO pediu |
|-------|------------------------|
| 01/02 — Login page loads / form ready | AuthContext, boot do app |
| 03 — Admin can login (fixture `loggedAdmin`) | **Resolução de tenant real** via Supabase + hash route |
| 04 — Schedule page loads | **TenantContext** → dados do tenant E2E |
| 05 — Clients page loads | Leitura tenant-scoped |
| 06 — Cash closing page loads | Fluxo financeiro |
| 07 — ChefClub page loads | Módulo ativo |
| 08 — **Commissions page loads** | **Carregamento de Comissões** sem erro |
| 09 — Dashboard page loads after login | **Resolução de tenant + redirecionamento** |
| 10 — No critical console errors on login | **Ausência de 42703** e erros críticos de console |

> O fixture `loggedAdmin` provisiona tenant E2E isolado (`e2e-suite-<runId>`) via Admin API no Supabase real, loga pela UI contra a produção e valida as páginas. Teardown removeu os dados de teste (`[e2e-seed] teardown complete`).

### 5.3 Critérios do PO — status

| Critério solicitado | Status | Evidência |
|---------------------|--------|-----------|
| TenantContext | ✅ | Smoke 04/09 |
| Carregamento de Comissões | ✅ | Smoke 08 |
| Resolução de tenant | ✅ | Smoke 03/09 |
| `/superadmin` | ✅ | Bundle estático §5.1 (sem suite dedicada; última ocorrência runtime eliminada) |
| Ausência de 42703 `tenants.active` | ✅ | Smoke 10 (sem erros críticos de console) + bundle §5.1 |

---

## 6. Linha do tempo

| Hora (BRT) | Evento |
|------------|--------|
| 19:36 | Push fast-forward `feature/phase-6.0.4-billing → main` (`718f6f9..c44ca6d`) |
| 19:41:57 | Deploy Vercel `dpl_91Hxq6R29DLTqk18aSkPD8Jo8iBz` criado (Ready, 16s) |
| ~19:43 | Confirmação aliases de produção → novo deploy |
| ~19:45 | Validação estática do bundle (SuperAdmin + tenant.ts) |
| 19:49–19:50 | Smoke E2E contra produção — **10/10 passaram** |

---

## 7. Declaração de encerramento do incidente

O incidente `tenants.active` (coluna inexistente — padrão 42703 da Trilha A, última ocorrência runtime na página `/superadmin`) está **ENCERRADO** para o produto SMG Barber:

- [x] Correção `c44ca6d` em `main`
- [x] Deploy de produção `dpl_91Hxq6R29DLTqk18aSkPD8Jo8iBz` Ready
- [x] `barber.soumanager.com` servindo o bundle corrigido
- [x] Bundle de produção sem `tenants.active` e com `tenants.status`
- [x] Smoke pós-deploy 10/10
- [x] Evidências registradas

> **Nota residual:** o veredito formal do gate H-8 permanece pendente de decisão do PO (padrão de homologação). A topologia Vercel de produção aponta corretamente para `barber.soumanager.com`. As demais pendências H-6 (10 migrations) continuam aguardando aprovação explícita do PO — **fora do escopo deste release.**

---

## 8. Arquivos alterados nesta operação

| Arquivo | Mudança |
|---------|---------|
| `docs/audit/H9_RELEASE_FIX_SUPERADMIN_20260816.md` | Novo (esta evidência) |
| `ROADMAP.md` | Linha de registro do release (a ser confirmada) |
| `PROJECT_STATUS.md` | Linha de registro do release (a ser confirmada) |
