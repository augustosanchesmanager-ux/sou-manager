# P-AUTO — Diagnóstico READ-ONLY do Gate PR #93 (HTTP 409 no `promote`)

> **Tipo:** Diagnóstico (não-implementativo) · **Data:** 2026-09-27 · **Executor:** OpenCode (Sisyphus) — agente do PO
> **Frente:** P-AUTO (dívida change-control `MERGE ≠ DEPLOY PROD`)
> **Gate em diagnóstico:** run `36347757267` (`PO-PR93-GATE-2026-09-27`), SHA `a750872`, environment `Production`, deployment `dpl_FcVxKeXRrSt1okPnv4nndtjcjXFo`
> **Evidência persistida a partir da entrega em sessão; nenhuma mutação executada na produção, Vercel, workflows ou banco.**

---

## Escopo e restrições da frente de diagnóstico

- READ-ONLY: sem alteração de workflows, Vercel, secrets, código de produto, banco, migrations, RLS.
- Sem promote, deploy, rollback, dispatch ou approval.
- Sem criar workaround para o 409; sem transformar 409 em sucesso artificial.
- Produção e multi-tenant preservados (alias inalterado desde o gate).

---

## 1. Fluxo atual (observado)

```text
PR #93 merge (aprovação PO via /approve)
   ↓  push main = a750872 (20:00:03Z)
Vercel Git Integration — Production Branch = main (default; vercel.json não a altera)
   ↓  cria deployment target=production (20:00:06Z), build com ENV DE PRODUÇÃO
   ↓  AUTO-ASSIGN: barber.soumanager.com passa a apontar para o novo deployment (~20:00:40Z)
   ↓  vercel[bot] cria GitHub Deployment (ref=SHA, env "Production – smg-barber") + status success
   ↓
⚠️ PRODUÇÃO JÁ SERVE a750872 — ~37s após o merge, SEM AUTORIZAÇÃO DE DEPLOY
   │  (GitHub environment "Production" só protege jobs de workflow — não bloqueia vercel[bot])
   │  [deploy-validate.yml dispara → SKIP: ref=SHA ≠ 'refs/heads/main']
   ↓  ...19 minutos depois...
PO autoriza dispatch do gate (20:21:57Z)
   → resolve-validate: guardrails + listagem read-only de candidatos (GitHub Deployments API)
   → promote: environment Production → aprovação PO (20:39Z)
   → vercel promote dpl_FcVx... → HTTP 409 → FAILURE
   │  [4 deployment_status do gate → 4 runs de Deploy Validation → SKIP]
   → post-validate (if: always()): health/checkout/smoke com if promote==success → TODOS SKIPPED
      apenas a trilha roda → job SUCCESS (ilusório) → run global FAILURE
```

## 2. Fluxo desejado

```text
MERGE
  ↓
DEPLOYMENT STAGED (alias imóvel)
  ↓
🛑 PO APPROVAL
  ↓
PROMOTE
  ↓
PRODUÇÃO
  ↓
HEALTH + E2E
  ↓
CERTIFICAÇÃO
```

## 3. Causa raiz do 409 — timeline forense

| Hora (UTC) | Evento | Evidência |
|---|---|---|
| 20:00:03 | merge do PR #93 → `a750872` | git log |
| 20:00:06 | deployment `target=production` criado (Git Integration) | Vercel CLI (`vercel inspect`) |
| ~20:00:40 | **auto-assign**: `barber.soumanager.com` → `dpl_FcVxKeXRrSt1okPnv4nndtjcjXFo` (deployment nasce `Current`) | docs Vercel + observação |
| 20:00:39/40 | vercel[bot]: GitHub Deployment `6697154622` (ref=SHA) + status `success` | GitHub API |
| 20:21:57 | dispatch do gate → run `36347757267` | GitHub API |
| 20:39:21–48 | environment `Production` → queued → in_progress → promote → **409** → failure | run + logs |
| 20:39:48 | `Error: The provided deploymentId (dpl_FcVxKeXRrSt1okPnv4nndtjcjXFo) is already the current production deployment. (409)` | log do job `promote` |

Cadeia causal:

1. **Production Branch = `main` + auto-assign ON (default do Vercel)** — docs oficiais: *"pushes and merges to the Production Branch will be made live to those domains… Vercel updates your production domains to point to the new deployment"*.
2. O merge criou e **aliasou** o deployment **antes** do dispatch do gate (Δ ≈ 19 min). O deployment nasceu e vive como `Current`.
3. O `deployment_url` do gate foi exatamente esse deployment (input manual; `resolve-validate` só **lista** candidatos — não seleciona nem valida `alvo ≠ Current`).
4. `vercel promote` sobre um deployment `Current` → a API não tem alias a mover → **409** (erro observado; semântica não documentada nos docs oficiais — aparece em fórum da comunidade; tratada como inferência empiricamente confirmada).
5. **Não é bug de token**: o job chegou à API e recebeu 409 semântico (não 401).

**A regra `MERGE ≠ DEPLOY` existe apenas como processo — a infraestrutura nunca a implementou.**

## 4. Gargalo arquitetural

O auto-deploy **consome o único objeto sobre o qual o gate deveria exercer controle: o alias**. Entre merge e aprovação do PO, o Vercel já executa a ação inteira que o `promote` existiria para fazer. Depois disso, o `promote` é estruturalmente vazio — o 409 é **certeza determinística** de qualquer dispatch cujo alvo é o deployment de `main` no modelo atual. Complementarmente (já registrado no ADR-026): required reviewers do GitHub **não bloqueiam** deployments criados por `vercel[bot]`.

## 5. E2E — por que ficou SKIPPED

`post-validate` tem `if: always()` (roda sempre), mas cada step de evidência tem `if: needs.promote.result == 'success'` (`deploy-production.yml`). Promote = `failure` → health, checkout, setup e smoke **todos skipped**; só a trilha (`if: always()`) executa. O job termina `SUCCESS` porque steps skipped não falham. **Job success ≠ E2E executado** — nenhum E2E, nenhum health check e nenhuma verificação de `process.env` aconteceram.

## 6. Deploy Validation — por que os runs ficaram SKIPPED

Condição do job (`deploy-validate.yml`): `deployment_status.state == 'success' && deployment.ref == 'refs/heads/main'`.

Mapeamento completo pós-merge (**7 runs, todos `skipped`**):

| Run | Hora | Evento originador | state | deployment.ref | Motivo do skip |
|---|---|---|---|---|---|
| 36346423092 | 20:00:41 | status `success` auto-deploy smg-barber (vercel[bot]) | success ✓ | **SHA** ✗ | ref |
| 36346452130 | 20:01:04 | status deploy smg-estetica | success ✓ | SHA ✗ | ref |
| 36346475437 | 20:01:29 | status deploy smg-barber-staging | success ✓ | SHA ✗ | ref |
| 36347837609 | 20:23:18 | status `waiting` do deployment do gate | waiting ✗ | **`main`** ✗ | ambos |
| 36348834656 | 20:39:23 | status `queued` do gate | queued ✗ | `main` ✗ | ambos |
| 36348836015 | 20:39:25 | status `in_progress` do gate | in_progress ✗ | `main` ✗ | ambos |
| 36348860670 | 20:39:50 | status `failure` do gate | failure ✗ | `main` ✗ | ambos |

Nenhum criador de deployment passa `refs/heads/main`: `vercel[bot]` passa SHA; o GitHub Actions environment passa `main`. **Independência:** o bug de `ref` mata o workflow mesmo que o promote tivesse sucesso (`state`✓ / `ref`✗) — é o 4º achado congelado, confirmado em sua forma extrema: `deploy-validate.yml` é **inalcançável em qualquer mundo, inclusive no corrigido**.

## 7. Alternativas avaliadas (máx. 2)

### Alternativa 1 — Staged Production (auto-assign de domínios DESLIGADO)

- Toggle: Vercel → `smg-barber` → Settings → Environments → Production → **Auto-assign Custom Production Domains** = OFF (campo de API não verificado nos docs; disponível em todos os planos — Hobby incluso).
- Efeito: merge em `main` cria deployment `target=production` em estado **Staged** (build com env de produção; domínio **não** muda); `vercel promote` move o alias **sem rebuild** (mesmo deployment ID → trilha coerente → artefato servido = artefato validado).
- O gate Fase 1 (`deploy-production.yml`) passa a funcionar **sem alteração de workflow**.
- Riscos: releases esquecidos ficam staged (PROD antiga, não errada); toggle exige change-control; candidatos staged se acumulam (seleção por SHA do dispatch — decisão D3); semântica do 409 não é documentada oficialmente.
- Rollback: religar o toggle (raio imediato) + *Instant Rollback* do alias (reatribuição sem rebuild).

### Alternativa 2 — Production Branch dedicada (`production` ≠ `main`) — direção A+C do ADR-026

- Push/merge em `main` → Preview; produção só via branch `production` (Deploy Hook + aprovação).
- Mais forte em separação, porém: duas branches vivas, branch protection nova, secret `VERCEL_HOOK_URL`, workflow com hook, sincronização main↔production, mutação de infra inicial.
- Nota: a linha da tabela do ADR-026 que marcava "C apenas (sem A)" como *Insuficiente* pressupunha auto-assign ON; com Staged Production, a separação é alcançada sem a branch `production`.

### Descartada: manter auto-assign ON tratando o deployment auto-criado como candidato

Estruturalmente impossível — é exatamente o estado atual (409 garantido).

## 8. Recomendação técnica

**Alternativa 1 — Staged Production:**

1. Corrige a causa raiz com superfície mínima (1 toggle), sem branch nova, secret novo ou reescrita do gate.
2. O gate Fase 1 já desenhado para este modelo funciona como escrito (linhas 6-7 do workflow declaram a regra que a Alternativa 1 torna verdade).
3. Fidelidade de artefato: promote staged **não rebuilda** → trilha e E2E validam exatamente o que é servido.
4. Já prevista no ADR-026 como camada conhecida ("staged promote… disponível no Hobby") — elevação de refino opcional a mecanismo primário.
5. Reversível em um toggle; compatível com plano Hobby.

## 9. Critérios para certificação futura do gate

1. Preflight: `vercel inspect` prova que o alias aponta para deployment **anterior** ao candidato (toggle OFF ativo).
2. Candidato identificado: `target=production`, SHA = input do dispatch.
3. `promote` = **SUCCESS**, log sem 409.
4. Pós-promote: alias → candidato, SHA conferida.
5. Steps `Health check` **e** `Smoke E2E` = `conclusion: success` (**nunca skipped**) — conclusão do job não vale como evidência.
6. Log do smoke prova resolução via `process.env` (job sem step que escreva `.env.local`).
7. Trilha completa no step summary (todos os campos).
8. Sequência observada: merge (alias imóvel) → approval → promote (alias muda) → E2E executa.
9. Decisão formal sobre `deploy-validate.yml`: condição corrigida e demonstrada com run executado, **ou** aposentadoria via ADR — nunca misturar na mesma frente.
10. Repetibilidade: 2 releases consecutivos certificados + rehearsal de rollback (runbook §4).
11. Escopo preservado: zero toque em migration/RLS/código de produto; change-control do toggle registrado.

---

## Arquivos e fontes inspecionados

| Fonte | Extensão |
|---|---|
| `.github/workflows/deploy-production.yml` | integrais (227 linhas) |
| `.github/workflows/deploy-validate.yml` | integrais (85 linhas) |
| `.github/workflows/ci.yml`, `smg-approve.yml` | integrais |
| `vercel.json` | integral (apenas rewrites SPA — sem config de git/branch) |
| `docs/runbooks/P-AUTO_PROMOTE_RUNBOOK.md` | integral |
| `docs/adr/ADR-026-merge-not-equal-deploy-prod-gate.md` | integral |
| GitHub API (read-only) | deployments `6697154622/6697159244/6697163940/6697411689/6693555800`, statuses, runs, jobs/steps/logs do run `36347757267` |
| Vercel CLI (read-only) | `whoami`, `project ls`, `ls smg-barber`, `inspect`, `alias ls` |
| Docs oficiais Vercel | environments, git-configuration, cli/promote, promoting-a-deployment, environment-variables, promote-preview-to-production |

## Registro evidente (formato smg-change-control)

- **EVIDENCE:** 409 estruturado no run `36347757267`; auto-assign provado pela timeline (alias ~20:00:40Z < dispatch 20:21:57Z); docs Vercel: staged = todos os planos, promote sem rebuild; 7/7 runs de deploy-validate pós-merge `skipped`.
- **INTERPRETATION:** causa raiz é o auto-assign, não o `promote`; um único toggle fecha a causa raiz; o gate Fase 1 funciona sem código novo; artefato promovido = artefato servido.
- **GAP:** (1) estado do toggle inferido, não lido via API; (2) semântica do 409 fora dos docs oficiais; (3) aparência de estado staged em `vercel ls` confirmável apenas empiricamente no primeiro release pós-toggle; (4) risco aceito — promote esquecido = PROD antiga, não errada.
- **DECISION:** Alternativa 1 (Staged Production) **ratificada pelo PO em 2026-09-27** (plano P-AUTO v1, decisões D1–D4) — ver `docs/audit/P_AUTO_STAGED_CHANGE_PLAN_20260927.md` e `docs/adr/ADR-026-merge-not-equal-deploy-prod-gate.md` (Amendment-01).
- **STATUS:** diagnóstico concluído; frente avança para execução do change-control (ISOLATE → PR desta documentação) — toggle/promote/merge permanecem sob STOPs próprios do plano.

## Confirmação de não-alteração (frente de diagnóstico)

A frente de diagnóstico executou exclusivamente leitura (`Read`, `glob`, `gh api` GET/queries, `vercel` read-only, `git status`/`git diff`). **Nenhum arquivo, configuração, workflow, secret, migration ou dado de produção foi alterado.** Nenhum promote, deploy, rollback, dispatch ou approval foi executado. O alias de produção permaneceu inalterado (`barber.soumanager.com` → `dpl_FcVxKeXRrSt1okPnv4nndtjcjXFo`).
