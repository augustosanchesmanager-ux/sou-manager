# FASE 6 — Production Readiness
# Certification Gap Analysis

## 1. Cabeçalho

**Finalidade:** Documentar a análise de gaps de certificação da FASE 6 (Production Readiness), transformando a auditoria documental/read-only em artefato versionável de controle. O objetivo é **inventariar evidências** e identificar **o que falta** para cada item 6.1–6.13, **sem** declarar certificação.

**Natureza da análise:** **READ-ONLY** — nenhum arquivo de código, teste, migration, configuração, documentação oficial ou infraestrutura (Supabase/Vercel/GitHub) foi alterado. Nenhum commit, push, merge ou deploy foi executado.

**Data da análise:** 2026-09-03.

**Fontes canônicas:**
- `docs/PROJECT_MATURITY.md` (terminologia e critérios das linhas 6.1–6.13)
- `docs/PROJECT_STATUS.md` (status oficial das linhas 6.1–6.13)
- `docs/ROADMAP.md` (status oficial da Fase 6)

**Estado oficial de referência:**
- `PROJECT_STATUS.md`: linhas 6.1–6.13 = **0%**
- `ROADMAP.md`: **Fase 6 — Production Readiness — Não iniciada**

**Aviso:** Este documento **NÃO altera** a certificação oficial. A existência de evidência diferente de evidência suficiente; nenhuma linha é promovida de `0%` por este artefato. A promoção de qualquer item dependerá de gate de certificação posterior, decidido pelo PO.

---

## 2. Regra de interpretação

> Este documento é uma análise de gap e inventário de evidências.
> A existência de uma evidência não constitui, por si só, certificação do item.
> O status oficial permanece aquele registrado em PROJECT_STATUS.md.
> Nenhuma conclusão de PASS deve ser interpretada como alteração do status oficial.

---

## 3. Matriz dos 13 itens

| Item | Critério oficial | Evidência encontrada | Evidência disponível / força da evidência | Gap | Tipo do gap | Critério objetivo de PASS | Próxima ação |
| ---- | ---------------- | -------------------- | --------------------------------- | --- | ----------- | ------------------------- | ------------ |
| **6.1 CI/CD** | GitHub Actions, branch protection, deploy automático | Deploy automático Vercel existente (`vercel.json`; topologia em `docs/audit/VERCEL_DEPLOYMENT_TOPOLOGY_AUDIT.md`; git link do projeto oficial `smg-barber` — ver decisão D-HOM-11). `package.json` contém `architecture:ci` (guard de arquitetura com baseline). **Não há `.github/workflows/`.** Os guards `architecture:ci` são executados localmente/manualmente, não em pipeline. Sem evidência de branch protection. | ❌ Não | GitHub Actions; branch protection; pipeline CI formal | 🔴 Infraestrutura + 🔴 Processo | Pipeline CI (GitHub Actions) rodando typecheck + build + unit + `architecture:ci`; branch protection em `main`/`develop` configurado e documentado | Definir pipeline CI no GitHub Actions; documentar política de branch protection |
| **6.2 Observabilidade** | Sentry, correlation IDs, error boundary | Observabilidade própria em `src/lib/observability/` (logger, events, metrics, alerts, dashboard `/#/observability`, webhooks — ADR-015 `docs/adr/ADR-015-pipeline-observability.md`). `createCorrelationId()` existe e é efetivamente usado em `src/lib/observability/logger.ts` e `src/lib/observability/instrumentation.ts`. **Não há Sentry** (`package.json`/src sem `@sentry`). **Não há ErrorBoundary global** identificado. | 🟡 Parcial | Sentry ausente; ErrorBoundary ausente; equivalência observabilidade-própria × Sentry não formalizada | 🟡 Código | Decisão do PO: Sentry como requisito literal OU observabilidade própria formalmente aceita como equivalente; ErrorBoundary global adicionado | Decisão de escopo (PO); implementar ErrorBoundary |
| **6.3 Ambientes** | Development, Preview, Demo, Staging, Production | Todas as categorias têm evidência presencial: **Development** (`npm run dev`); **Preview** (Vercel previews de branch); **Demo** (local demo mode em `src/lib/supabase/client.ts`); **Staging** (relatórios `STAGING_*` em `docs/audit/`, ref `tjcvuhynckocmvtqykxp`); **Production** (Vercel `smg-barber`, `barber.soumanager.com`, ref `ushsnmlbeurfvlkieiln`) | 🟡 Parcial | Matriz formal de ambientes não documentada (propósito, dados, URL/ref, responsáveis) | 🔴 Documentação | Matriz de ambientes publicada e referenciada no TAXONOMY | Redigir matriz de ambientes |
| **6.4 Hardening** | ESLint, Prettier, .env.example | Verificado: **sem base ESLint**, **sem Prettier**, **sem `.env.example`** (AGENTS.md confirma "No formatter configured"; nenhum arquivo `.eslintrc*`/`eslint.config.*`/`.prettierrc*`/`prettier.config.*`/`.env.example` no repo) | ❌ Não | ESLint, Prettier e `.env.example` ausentes | 🔴 Infraestrutura (+ 🔴 Documentação para `.env.example`) | ESLint + Prettier configurados e rodando (local + CI); `.env.example` com todas as variáveis `VITE_*` | Configurar tooling de lint/format; criar `.env.example` |
| **6.5 E2E Críticos** | 3 fluxos críticos | Playwright configurado (`playwright.config.ts`); suite E2E em `tests/e2e/` (7 page objects, fixtures de auth, flows, regression); smoke real **10/10** com chaves reais documentado no `PROJECT_STATUS.md`; P0/P1/P2 mapeados | 🟡 Parcial | Formalização inequívoca dos "3 fluxos críticos" como critério; integração ao CI (depende de 6.1) | 🔴 Processo (+ 🔴 Código p/ CI) | Os ≥3 fluxos críticos formalmente nomeados, executados e verdes no CI | Formalizar os 3 fluxos; integrar ao CI (6.1) |
| **6.6 Deploy de Produção** | Contas, staging, smoke tests | Deploy real executado: `docs/DEPLOY_LOG_FASE_6_0_5.md`, `docs/DEPLOY_RUNBOOK_FASE_6_0_5.md`, `docs/audit/PRODUCTION_COMPATIBILITY_AUDIT.md` (PCA = READY); janela única de deploy com 6 migrations aplicadas + pós-deploy E2E (Flow14 1/1, Flow13 8/8, Smoke 10/10) | 🟢 Forte — deploy executado | Separar "deploy já executado" de "certificação formal do item 6.6"; runbook canônico único | 🔴 Documentação (consolidar) | Runbook de deploy versionado e referenciado; evidência da última execução apontada | Consolidar runbook de deploy canônico |
| **6.7 Release Notes** | Formato padronizado | `docs/RELEASE_PROCESS.md` seção "### 11. Release Notes" documenta o formato (Features, Bugs corrigidos, Breaking changes, Migrações, Impacto nos usuários); Checklist de Release presente (item "Release notes publicada"); `docs/RELEASE_CHECKLIST_v1.5.md` | 🟡 Parcial | **Formato documentado SIM**; falta evidência de Release Notes efetivamente aplicada/publicada para uma release | 🔴 Processo (documental) | Template de Release Notes aplicado e publicado para a release v1.5 | Publicar Release Notes da v1.5 usando o formato definido |
| **6.8 Docs Operacionais** | Processos e procedimentos | Runbooks/processos: `docs/DEPLOY_RUNBOOK_FASE_6_0_5.md`, `docs/RELEASE_PROCESS.md`, `docs/audit/MIGRATION_EXCEPTION_20260801.md`, `AGENTS.md` (procedimentos operacionais), `docs/audit/DEPLOYMENT_PLAN_20260728.md`, `scripts/ops/` (runbooks de saneamento/regularização) | 🟢 Forte | Cobertura ampla; manter organização/consistência | 🔴 Documentação (contínua) | Conjunto de docs operacionais versionado e referenciado | Continuar padrão; indexar docs operacionais |
| **6.9 Health Checks** | Endpoints de saúde | Sinais/health da camada **worker/D8** existem: `worker_heartbeat`, `net._http_response`, health semântico (`DISPATCHER_ALIVE`, `QUEUE_QUERY_HEALTHY`, `QUEUE_DEPTH`, `LAST_DISPATCH_ERROR`) em `docs/adr/ADR-016-dispatcher-server-side.md`, `docs/audit/D8_READONLY_DIAGNOSTIC_20260827.md` | 🟡 Parcial | **Não confundir** `worker health signal` (health do pipeline/worker) com **application health endpoint** (health do app/web). Sem endpoint de health dedicado do app/web identificado | 🟡 Código | Endpoint de health do app/web (ex.: uptime/status) acessível e consumido por um monitor | Definir endpoint de health do app/web |
| **6.10 Backup** | Estratégia de backup | Backup executado: dump lógico D-6.0.5.7 + restore test em Docker (Postgres 17.6) com contagens 100% idênticas documentado em `docs/DEPLOY_LOG_FASE_6_0_5.md`; custódia local de backup sob perfil do responsável | 🟢 Forte — backup executado | Separar "backup executado" de "política formal de backup" (frequência, retenção, responsável) | 🔴 Documentação (política) | Política de backup versionada; último restore test apontado | Redigir política/cadência de backup |
| **6.11 Disaster Recovery** | Plano de DR | Verificado: **nenhum** documento de plano de DR localizado no repositório | ❌ Não | Plano de DR inexistente (RPO, RTO, cenários, procedimento de recuperação, responsáveis, critérios de acionamento) | 🔴 Documentação (estrutural) | Documento de DR (RPO/RTO, cenários, recuperação, responsáveis) versionado | Redigir plano de DR (não nesta etapa) |
| **6.12 Deploy Validation** | Pipeline e rollback | `docs/RELEASE_PROCESS.md` seção "### 10. Rollback" documenta o procedimento (fix-forward ou reverter via Vercel; "Rollback disponível em < 5 min"); PCA (`PRODUCTION_COMPATIBILITY_AUDIT.md`) como validação pré-deploy | 🟡 Parcial | Separar "rollback documentado" de "rollback efetivamente testado": `RELEASE_CHECKLIST_v1.5.md` indica rollback "testado conceitualmente", mas **não executado como teste operacional**; sem pipeline automatizado (rel. 6.1) | 🔴 Processo (+ 🔴 Código) | Rollback executado e validado em 1 ciclo real; integrado ao pipeline (6.1) | Executar teste de rollback; integrar ao CI (6.1) |
| **6.13 Production Certification** | Checklist de prontidão | Checklists correlatos: `docs/PLATFORM_CERTIFICATION.md` (checklist de 9 itens, "CONCLUÍDA COM RESSALVAS"), `docs/RELEASE_CHECKLIST_v1.5.md`, PCA | 🟡 Parcial | Checklist único da FASE 6 que consolide 6.1–6.13 e funcione como gate formal de prontidão não existe | 🔴 Documentação (estrutural) | Checklist de prontidão da FASE 6 com gate por linha comprovado por evidência | Consolidar checklist de prontidão da FASE 6 (não nesta etapa) |

---

## 4. Conteúdo da matriz — notas de verificação

Todas as evidências acima foram verificadas contra o repositório. Caminhos citados foram conferidos; as fontes canônicas (`PROJECT_MATURITY.md`, `PROJECT_STATUS.md`, `ROADMAP.md`) foram consultadas. Nenhuma evidência foi inventada.

**Item 6.2 — Ponto resolvido na verificação:** `createCorrelationId()` existe e é **efetivamente utilizado** em `src/lib/observability/logger.ts` e `src/lib/observability/instrumentation.ts`. Logo, o componente "correlation IDs" do critério está presente no código. Não está automaticamente concluído que Sentry é obrigatório nem que a observabilidade própria é equivalente — trata-se de **decisão de escopo pendente do PO** (critério literal menciona Sentry, mas nenhum documento formal define a equivalência ou a obrigatoriedade).

**Item 6.9 — Separação obrigatória:**
```
worker health signal   ≈  health da camada worker/D8 (heartbeat, net._http_response, health semântico)
application health endpoint ≈  endpoint de health do app/web (não identificado)
```
A presença de health do worker não comprova a existência de um endpoint de health da aplicação.

---

## 5. Dependências de Certificação

```
6.4 → 6.1 → 6.5 → 6.12
```

- **6.4 (tooling/hardening)** influencia a **qualidade do CI (6.1)**: sem lint/formatter e `.env.example` estabelecidos, o pipeline de CI parte de uma base de qualidade não padronizada.
- **6.1 (CI)** influencia a **automação dos testes (6.5)** e da **validação de deploy/rollback (6.12)**: os testes E2E críticos e a validação de pipeline dependem de um pipeline confiável para rodarem de forma contínua e reprodutível.
- **6.12 (deploy validation/rollback)** depende de um pipeline confiável (6.1) para ser validado de forma operacional.

**6.13** é o **fechamento da certificação** e consolida os gates dos itens anteriores. **Não deve ser usado para mascarar gaps dos itens anteriores** — não pode ser promovido enquanto 6.1–6.12 tiverem gaps abertos não resolvidos/documentados.

---

## 6. Decisões Pendentes do PO

### 6.2
- Decidir se **Sentry será requisito literal** ou se a **observabilidade própria será formalmente aceita como implementação equivalente** (nenhuma equivalência formal foi localizada nos documentos).
- Decidir sobre **ErrorBoundary** (ausente no momento).

### Certificação
- Decidir **quando uma evidência existente será considerada suficiente** para certificação formal de cada item (o critério objetivo de PASS deve ser aprovado/deferido pelo PO, não pelo OpenCode).

### 6.1
- Definir a **política de CI / branch protection** (qual pipeline, quais branches protegidas, quais checks obrigatórios).

Nenhuma dessas decisões foi tomada automaticamente.

---

## 7. Backlog de Certificação

### 🔴 Gaps objetivos
- **6.4** — ESLint, Prettier, `.env.example` (ausentes)
- **6.11** — Plano de Disaster Recovery (inexistente)
- Demais ausências efetivamente confirmadas durante a análise.

### 🟡 Gaps parciais
- **6.1** — Vercel + checks locais, mas sem GitHub Actions / branch protection / pipeline CI
- **6.2** — Observabilidade própria + correlation IDs efetivos, mas sem Sentry / ErrorBoundary (decisão de escopo pendente)
- **6.3** — Ambientes todos presentes, mas sem matriz formal
- **6.5** — Suite E2E + smoke 10/10, mas sem formalização dos 3 fluxos críticos / integração ao CI
- **6.7** — Formato de Release Notes documentado, mas sem evidência de aplicação a uma release
- **6.9** — Health do worker (D8) existe, mas sem endpoint de health do app/web
- **6.12** — Rollback documentado, mas não testado operacionalmente; sem automação
- **6.13** — Vários checklists correlatos, mas sem checklist único de prontidão da FASE 6

### 🟢 Evidência forte existente
Registros de itens com evidência operacional forte — **sem declarar certificação automática**:
- **6.6** — Deploy de produção executado (PCA READY, janela única 6 migrations, E2E pós-deploy verdes)
- **6.8** — Documentação operacional (runbooks, RELEASE_PROCESS, AGENTS.md)
- **6.10** — Backup executado (dump + restore test 100% idêntico)
- **6.5** — Suíte E2E Playwright + smoke real 10/10 (evidência forte, pendente de formalização do critério)

> A classificação acima reflete **presença de evidência**, não **certificação**. A promoção de qualquer item de `0%` depende de gate de certificação posterior, decidido pelo PO.

---

## 8. Ordem Recomendada

```
Bloco 1 — Fundação
6.4 → 6.1 → 6.5

Bloco 2 — Operação
6.3 → 6.9 → 6.10 → 6.11 → 6.12

Bloco 3 — Governança
6.2 → 6.7 → 6.8 → 6.13
```

> **Aviso:** esta é uma **recomendação de planejamento**, não uma decisão de execução. A ordem final é do PO.

---

## 9. Estado Oficial — NÃO ALTERAR

```
PROJECT_STATUS.md:
6.1–6.13 = 0%

ROADMAP.md:
Fase 6 — Production Readiness = Não iniciada
```

> Este documento **NÃO altera** nenhum desses estados.
> A promoção de qualquer item dependerá de gate de certificação posterior.

---

## 10. Controle de Escopo

- **Único arquivo criado nesta operação:** `docs/audit/FASE_6_GAP_ANALYSIS.md`.
- **Nenhum outro arquivo foi modificado.**
- **Nenhum arquivo foi staged, commitado, pushado, mergeado ou deployado.**
- `git add`, `git commit`, `git push`, merge e deploy **não** foram executados.
- As fontes canônicas foram consultadas (somente leitura).

---

## Referências

- `docs/PROJECT_MATURITY.md` — Fase 6 (critérios das linhas 6.1–6.13)
- `docs/PROJECT_STATUS.md` — status oficial das linhas 6.1–6.13
- `docs/ROADMAP.md` — status oficial da Fase 6
- `docs/RELEASE_PROCESS.md` — seções 10 (Rollback) e 11 (Release Notes)
- `docs/RELEASE_CHECKLIST_v1.5.md` — checklist de release
- `docs/PLATFORM_CERTIFICATION.md` — checklist de certificação da plataforma
- `docs/DEPLOY_LOG_FASE_6_0_5.md`, `docs/DEPLOY_RUNBOOK_FASE_6_0_5.md` — deploy/backup real
- `docs/audit/PRODUCTION_COMPATIBILITY_AUDIT.md` — PCA (READY)
- `docs/audit/VERCEL_DEPLOYMENT_TOPOLOGY_AUDIT.md` — topologia Vercel
- `docs/adr/ADR-015-pipeline-observability.md`, `docs/adr/ADR-016-*` — observabilidade e health do worker
- `AGENTS.md`, `package.json`, `vercel.json`, `src/lib/observability/*`, `tests/e2e/*`, `scripts/ops/*`
