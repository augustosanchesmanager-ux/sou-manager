# P-AUTO — Fase 1.5: Prova Operacional Controlada (2026-09-27)

> **Frente:** P-AUTO (governança merge ≠ deploy) — Fase 1.5 do despacho PO 2026-09-27.
> **Escopo autorizado:** merge do PR #91 → workflow em `main` → provisionar `VERCEL_TOKEN` → dry-run → provar resolução/autorização/trilha/bloqueios → STOP.
> **Proibido nesta etapa (PO):** promoção real (`vercel promote`), desligar auto-deploy, alterar `prodBranch`, criar branch `production`, abrir Fase 2.
> **Decisão registrada:** `docs/BUSINESS_DECISIONS.md` (D-HOM-36) · `ROADMAP.md` (8.82) · `PROJECT_STATUS.md` (7.43).

---

## 1. Estado de entrada

| Item | Estado |
|------|--------|
| PR #91 (Fase 1, C+D) | MERGED — `b170aaae0281196282b43a94c8e79b9806ab8d9d` (2026-09-27T05:01Z), squash |
| Workflow `deploy-production.yml` | Em `main` — workflow id `368116377`, `Deploy Production (Promote Controlado)`, `active` |
| Environment `Production` | Protegido — `required_reviewers` = `augustosanchesmanager-ux` (id `259449180`); 0 secrets próprios |
| Auto-deploy Vercel | **Ativo** por decisão do PO (merge → `Production – smg-barber` permanece; não alterado) |

---

## 2. Provisionamento do `VERCEL_TOKEN`

### 2.1 Tentativa do agente — BLOQUEADA (403)

```
POST https://api.vercel.com/v3/user/tokens?teamId=team_KgriBFsF8Nb5FBNH2Sku6opS
→ HTTP 403 {"error":{"code":"forbidden","message":"Cannot create tokens for this app."}}
```

**Causa (doc oficial Vercel):** sessões OAuth criadas por `vercel login` **não podem criar novos tokens** — a API exige um *classic personal access token* com escopo de conta inteira (`Account → Settings → Tokens`). Inventário negativo antes da decisão: repo secrets (4, nenhum Vercel), environment `Production` (0), env vars locais (0), disco (apenas menções em docs).

### 2.2 Handoff do PO (opção a do STOP)

| Ação | Resultado |
|------|-----------|
| PO deixou o token em `%TEMP%\opencode\vercel_token.txt` | 60 chars, prefixo `vcp_` (não é o OAuth `vca_`) |
| `gh secret set VERCEL_TOKEN --body <valor lido do arquivo>` | exit 0 → secret `VERCEL_TOKEN 2026-09-27T12:35:45Z` |
| Valor impresso em algum log/transcrição? | **NUNCA** — lido para variável, setado, variável descartada |
| Arquivo removido do disco | SIM (`Test-Path` → false) |
| Temporários `vt-body.json`/`vt-resp.json` (da tentativa 403) | Removidos |

### 2.3 Escopo verificado (sem expor o valor)

| Probe | Resultado |
|-------|-----------|
| `GET /v2/user` | HTTP 200 |
| `GET /v10/projects?limit=100&teamId=team_KgriBFs…` | HTTP 200 — 14 projetos legíveis |
| `GET /v10/projects/prj_M3cJ2cZosLONAt9IzumF2LwJZTSj` (smg-barber) | HTTP 200 |
| `GET /v10/projects/prj_5qoCiw7lwSZnKgB6UcS7kSNQqRAk` (smg-barber-staging) | HTTP 200 |
| `GET /v10/projects/prj_my8ykBB67rDKQZi4RKPtv7MotAC2` (smg-estetica) | HTTP 200 |

**Interpretação:** o token cobre os **3 projetos do mapeamento** (escopo team — não é project-scoped de 1 projeto). Não existe escopo Vercel "exatamente 3 projetos"; a cobertura observada atende o objetivo da promoção nos 3 projetos.

---

## 3. Provas do mecanismo (6/6)

### P1 — Input obrigatório bloqueado pela API (422)

```
gh workflow run deploy-production.yml -f project=smg-barber -f sha=b170aaa…
→ HTTP 422: Required input 'authorization_ref' not provided
```

### P2 — Dry-run: resolução do candidato + trilha de auditoria

**Run [`36297352392`](https://github.com/augustosanchesmanager-ux/sou-manager/actions/runs/36297352392)** → `success`

| Job | Resultado | Evidência-chave |
|-----|-----------|-----------------|
| resolve & validate (read-only) | `success` | guard echo: `Projeto=smg-barber \| DryRun=true \| Promote=false \| Auth=PO-despacho-2026-09-27-Fase1.5-dryrun`; outputs `project`/`domain`/`promote`/`authorization_ref` setados; step "Listar deployments GitHub" executou (read-only → step summary) |
| promote | **`skipped`** | `dry_run=true` → `if: promote == 'true'` falso |
| post-validate | `success` | step "Trilha de auditoria" executou: projeto, domínio, SHA `b170aaa…`, commit do run, deployment alvo (dry-run), auth ref, executor, `VALIDATE_RESULT=success`, `PROMOTE_RESULT=skipped`, timestamp, nota de rollback |

### P3 — Bloqueio por confirm errado (dupla trava)

**Run [`36297512092`](https://github.com/augustosanchesmanager-ux/sou-manager/actions/runs/36297512092)** (`dry_run=false`, `confirm=CONFIRM-ERRADO`) → `failure`

```
##[error]dry_run=false exige confirm identico ao projeto ('smg-barber'). Recusado.
##[error]Process completed with exit code 1.
```

Jobs: resolve = `failure` · promote = `skipped` (job nunca criado) · run conclusion = `failure`.

### P4 — Gate de autorização humana (environment approval)

**Run [`36297602761`](https://github.com/augustosanchesmanager-ux/sou-manager/actions/runs/36297602761)** (`dry_run=false`, `confirm=smg-barber`, `deployment_url=dpl_fase15_gate_sentinel_NAO_APROVAR`):

1. resolve `success` — guard echo real: `Projeto=smg-barber | DryRun=false | Promote=true | Auth=PO-despacho-2026-09-27-Fase1.5-gate-proof`
2. promote → **`waiting`**; `GET …/pending_deployments`:
   - environment `Production` (id `12299465010`)
   - `reviewers: [augustosanchesmanager-ux / 259449180]`, `current_user_can_approve: true`
3. **Cancelado SEM aprovar** (`gh run cancel`) → run `cancelled`, promote `cancelled`, **`stepsExecuted=0`** (nenhum step do promote rodou), `pending_deployments: []` pós-cancel.

**Conclusão:** o gate segura promoção real; nenhum `vercel promote` foi executado.

### P5 — Acesso ao secret pelo workflow (sonda descartável)

Mecanismo: branch `proof/fase15-secret-probe` de `main` com step-sonda no job `resolve-validate` (sem environment), dispatch via `gh workflow run --ref` (o GitHub executa a definição do workflow da ref indicada; o arquivo existe na default branch), **branch local + remota deletadas após a prova** — `main` permaneceu intocado em todo o processo.

**Run [`36319736451`](https://github.com/augustosanchesmanager-ux/sou-manager/actions/runs/36319736451)** → `success`:

```
VERCEL_TOKEN_PROBE: ***                    (env do step — mascarado)
SONDA: VERCEL_TOKEN presente no workflow, len=60
SONDA valor (mascarado pelo GitHub): ***    (valor bruto ecoado → mascarado pelo GitHub)
```

Jobs: resolve `success` · post-validate `success` · promote `skipped`.

**Quatro condições do despacho (seção 2):**

| Condição | Evidência |
|----------|-----------|
| Secret existe | `gh secret list` → `VERCEL_TOKEN 2026-09-27T12:35:45Z` |
| Não aparece em logs | valor ecoado → `***` (máscara do GitHub) |
| Workflow consegue acessá-lo | `len=60` lido dentro do step |
| Nenhum valor exposto | transcrição e logs sem o valor; arquivo do PO removido |

### P6 — Dry-run padrão (defesa em profundidade)

`dry_run` é `type: boolean, default: true` no workflow — dispatch sem informar o campo audita, nunca promove (P2).

---

## 4. O que NÃO foi feito (guardas do despacho)

- ❌ Nenhum `vercel promote` executado (promote `stepsExecuted=0` no pior caso, `skipped` nos demais)
- ❌ Nenhum deployment promovido/alterado; sentinelas nunca aprovadas
- ❌ Auto-deploy Vercel permanece ativo; `prodBranch` inalterado; branch `production` não criada
- ❌ Fase 2 não iniciada; critério 12 (eliminação do auto-deploy) segue pendente
- ❌ OAuth pessoal `vca_` **nunca** usado como secret (bloqueio 403, conforme esperado)
- ❌ Branch históricas pendências (docs/h8-*, docs/h7-*, fix/reversal-sep-staff-id etc.) não tocadas

---

## 5. Limitações e GAPs

| # | Limitação | Nota |
|---|-----------|------|
| L-1 | Conteúdo dos step summaries não é exposto por API REST | Evidência = logs dos steps + status de jobs/steps (step executou com `exit 0` ⇒ summary escrita) |
| G-1 | Token com escopo team (14 projetos), não "exatamente 3" | API/dashboard Vercel não oferecem escopo multi-projeto seletivo; cobertura dos 3 alvo comprovada (P200) |
| G-2 | Promoção real ainda não exercitada de ponta a ponta | `vercel promote` só roda pós-aprovação do environment — exige decisão/autorização do PO com deployment candidato real |
| G-3 | Dual-path `main → auto-deploy` segue ativo | Aceito pelo PO; eventual desligamento = Fase 2 (não autorizada) |

---

## 6. Próxima etapa (decisão do PO)

1. **Promoção real controlada** — dispatch `dry_run=false` com `deployment_url` de um deployment candidato real + `confirm=smg-barber` + aprovação do environment (gate P4) → valida P5/G-2 de ponta a ponta (promote + health + smoke).
2. **Fase 2** — auditoria da implementação + eventual desligamento do auto-deploy/`ignoreCommand` (🔴 não autorizada).
3. **Merge deste PR docs-only** — aguarda `/approve` do PO.
