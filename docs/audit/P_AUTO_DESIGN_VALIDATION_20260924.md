# P-AUTO — DESIGN VALIDATION READ-ONLY: viabilidade da arquitetura A + C

> **Frente:** P-AUTO (dívida change-control: `MERGE ≠ DEPLOY PROD`)  
> **Data:** 2026-09-24  
> **Modo:** ✅ **DV somente leitura** — nenhuma mutação em Vercel, GitHub Actions, branch protection, workflows, `vercel.json`, secrets, PR, merge, deploy ou PROD.  
> **Autorização:** ordem explícita do PO — `smg-change-control P-AUTO → DESIGN VALIDATION READ-ONLY`.  
> **Entrada:** `docs/audit/P_AUTO_AUDIT_READONLY_20260924.md` (audit A–E, STOP).  
> **Objetivo:** fechar os 3 GAPs do audit e validar (ou ajustar) a viabilidade da composição **A + C**.  
> **Estado final:** **STOP / P-AUTO DESIGN DECISION** — decisão da PO pendente.

---

## 1. Escopo e restrições

| Item | Status |
|------|--------|
| Mutação em Vercel (settings, Production Branch, deploy hooks, env) | ❌ nenhuma |
| Mutação em GitHub (workflows, branch protection, environments, secrets) | ❌ nenhuma |
| Mutação em `vercel.json` / repo | ❌ nenhuma |
| Commit / push / PR / merge | ❌ nenhum (relatório untracked) |
| Deploy em PROD | ❌ nenhum |
| Leitura API Vercel (GET), GitHub API (GET), docs oficiais, worktree | ✅ sim |

**Invariantes verificados ao final da sessão:**

- `origin/main` = `5a2845690dcee121e68427217249c0762d1c56f6` (intocado)
- `HEAD` = `3c0ed61` (docs H3-5+P1-01 da frente anterior; não alterado)
- `git diff HEAD -- vercel.json .github/workflows/` = vazio
- `docs/audit/P_AUTO_AUDIT_READONLY_20260924.md` e este arquivo = **untracked** (fora de commit, por ordem da PO)

---

## 2. Fechamento dos 3 GAPs do audit

### GAP 1 — Production Branch ao vivo do projeto `smg-barber`

**Pergunta:** o `link.productionBranch` do projeto de produção é `main` (confirmado ao vivo nesta sessão)?

**Evidência obtida:**

| Fonte | Resultado |
|-------|-----------|
| `GET /v9/projects/prj_5qoCiw7lwSZnKgB6UcS7kSNQqRAk` (staging, ao vivo) | `link.productionBranch = homologacao` · `link.repo = sou-manager` · `autoAssignCustomDomains = true` · `customEnvironments = 1` |
| `GET /v9/projects/prj_M3cJ2cZosLONAt9IzumF2LwJZTSj` (produção, ao vivo) | **timeout/instabilidade do canal** nesta sessão; resposta parcial anterior confirmou `accountId`, `autoAssignCustomDomains = true`, `link` presente no payload |
| H-8 `VERCEL_DEPLOYMENT_TOPOLOGY_AUDIT.md` §2 (2026-08-08, GET-only) | Production Branch `smg-barber` = **`main`** |
| Comportamento 2026-09-24 | merge `5a28456` → deployment `Production – smg-barber` id `6631932573` em ~37s por `vercel[bot]` — **só é possível com Production Branch = `main`** |
| Staging como controle | campo `productionBranch` existe e é operável na mesma API/account (padrão `homologacao` prova que a alavanca A é real) |

**Veredito GAP1: FECHADO (multifonte).**  
Residual operacional: o campo `link.productionBranch` do projeto de produção não pôde ser relido por completo nesta sessão (timeout do canal API). A tríade H-8 + comportamento de deploy + leitura ao vivo do staging é suficiente para afirmar `main`. Na implementação (fase ISOLATE/IMPLEMENT, com mutação autorizada), o **primeiro passo** será reler `GET /v9/projects/prj_M3cJ2cZosLONAt9IzumF2LwJZTSj` e registrar o valor antes de qualquer `PATCH`.

---

### GAP 2 — Plano Vercel e features de gate (“require approval before Production”)

**Pergunta:** qual é o plano? Existe gate nativo de aprovação antes de Production no plano atual? As alavancas de A + C existem no plano?

**Evidência obtida:**

| Item | Evidência | Resultado |
|------|-----------|-----------|
| Plano do time/team | `docs/audit/6.1.3_STAGING_READINESS_PLAN.md:281` — “Hobby comporta múltiplos projetos”; custo R$ 0 | **Hobby** (documentação interna; `GET /v2/teams/...` com timeout nesta sessão — residual) |
| Custom environments | `GET .../custom-environments` ao vivo: `accountLimit.total = 0`, `environments = []` | **0 custom envs** — consistente com Hobby (custom staging env = Pro/Enterprise) |
| “Staged production deployment” (desligar auto-assign de domínios + promote manual) | Docs Vercel *Environments* / *Promoting Deployments*: **“All plans”** (inclui Hobby) | ✅ **disponível no plano atual** — alavanca C reforçada |
| Preview branch como staging persistente | Docs: **All plans, including Hobby** | ✅ disponível |
| `autoAssignCustomDomains` (produção e staging) | Leitura ao vivo staging = `true`; parcial produção = `true` | Hoje **ligado** — toggle é a chave do staged promote |
| Feature nativa “require approval before Production” no Hobby | Sem indício em docs; deployment protection Hobby = Standard (login em preview), **não** approval-gate de deploy de produção | ❌ **não existe** no plano atual |
| Rolling Releases / manual approval de produção | Docs Vercel: recurso Pro+ | ❌ fora do plano |
| Deploy Hooks | Docs: disponíveis em todos os planos (limite 5/projeto no Hobby); `GET .../deploy-hooks` retornou vazio (nenhum hook criado) | ✅ **disponível** — alavanca C |
| Git Integration + Production Branch | Campo existe, staging usa `homologacao` | ✅ alavanca A operável |

**Veredito GAP2: FECHADO.**

- Plano = **Hobby** (docs internos + ausência total de custom environments ao vivo).  
- **Não existe** gate nativo Vercel “aprovar antes de Production” neste plano.  
- **A + C é viável no Hobby sem upgrade:**  
  - **A** = trocar `link.productionBranch` (uma alavanca de settings);  
  - **C** = `workflow_dispatch` (GitHub, grátis) + **Deploy Hook** Vercel (plano todos) + **staged production** (disable auto-assign → promote manual — plano todos) como camada extra.  
- **D** (env reviewers) e rolling release **não** são alavancas deste plano.

---

### GAP 3 — GitHub Environment required reviewers × deployments criados via API Vercel

**Pegunta:** reviewers no environment `Production – smg-barber` bloqueariam o deploy real do `vercel[bot]`?

**Evidência obtida:**

| Fonte | Resultado |
|-------|-----------|
| `GET /repos/.../environments` (ao vivo) | **12 environments**, todos com `protection_rules: []` |
| `GET .../environments/Production – smg-barber` (ao vivo) | `protection_rules: []` · `deployment_branch_policy: null` · `can_admins_bypass: true` |
| Branch protection `main` (ao vivo) | required check `validate` (strict) · 1 review · `enforce_admins` · sem force-push — **gates merge, não deploy** |
| Deployments recentes | `vercel[bot]` cria deployment via **Deployments API** (não via workflow job) |
| Docs GitHub (required reviewers) | Aplicam-se a **workflow jobs que referenciam o environment** — “approve workflow jobs that reference the environment” |
| Docs GitHub (Deployments API) | Terceiros criam deployment/status sem passar por protection rules de environment de Actions |

**Veredito GAP3: FECHADO.**

1. Hoje **nenhum** environment tem protection rules — D sequer está configurado.  
2. Mesmo configurado, required reviewers do GitHub **não bloqueiam** o caminho `push main → Vercel Git Integration → build PROD` (o deploy real é do Vercel; o GitHub só recebe o *status*).  
3. **D continua descartada como gate único.** Pode vir, no máximo, defesa em profundidade **após PoC**, e apenas se o fluxo de deploy passar a ser um **workflow GitHub** (é o que a alavanca C faz — aí o environment approval do job **sim** trava o `curl` do Deploy Hook antes dele existir).

---

## 3. Validação da arquitetura proposta A + C

### 3.1 Definição operacional (alvo do design)

```text
PR → merge main → build/preview only → 🔒 STOP (sem Production automático)
    → PO autoriza (workflow_dispatch + approval)
    → Deploy Hook / promote → DEPLOY PROD
    → POST-DEPLOY VALIDATION (P-DV, independente)
```

### 3.2 Componente A — Production Branch separada

| Critério | Avaliação DV |
|---------|----------------|
| Mecânica | Vercel passa a tratar só `production` (ou `release/prod`) como Production; push em `main` = **Preview** only |
| Disponibilidade no plano | ✅ Hobby — mesmo mecanismo que staging usa (`homologacao`) |
| Efeito no gap principal | ✅ **Corta** `merge main → PROD` imediatamente |
| Reversibilidade | ✅ Alta — voltar `productionBranch = main` |
| Risco residual | Promoção esquecida (PROD fica “antiga”, não “errada”); push indevido em `production` → mitigar com branch protection na branch de release |
| Pré-requisito de implementação | Releitura GET do `productionBranch` atual + criar branch `production` + settings change (mutação — fase posterior, com ordem) |

**A é VALIDADA** como alavanca mínima e necessária.

### 3.3 Componente C — workflow_dispatch + Deploy Hook (+ staged promote)

| Critério | Avaliação DV |
|---------|----------------|
| Mecânica | Workflow manual (`workflow_dispatch`) com environment approval do job; passo `curl` no Deploy Hook Vercel (ou `vercel promote` para staged) |
| Disponibilidade no plano | ✅ Actions grátis; Deploy Hook = todos os planos; staged production (disable auto-assign) = **All plans** |
| Trilha de auditoria | ✅ quem disparou, quando, SHA, approval do environment |
| Fail-safe | ❌ hook/workflow fora do ar → deploy não sai (desejável) |
| Composição com A | ✅ A impede auto; C materializa o “PO autoriza” |
| Environment approval (D no fluxo certo) | ✅ Com C, o gate passa a ser **job do workflow** (que usa o environment) — reviewers GitHub **sim** aplicam; protege o `curl` do hook |
| Risco residual | Manutenção do workflow + secret do hook; complexity vs `smg-change-control` |

**C é VALIDADA** como mecanismo de autorização explícita, com a ressalva: o approval só é enforced no caminho do **workflow**, não no push direto (por isso A é obrigatório junto).

### 3.4 Alternativas reavaliadas após DV

| Alt | DV update |
|-----|-----------|
| **A + C (recomendada)** | ✅ Viável no Hobby; sem upgrade; reversível; preenche MERGE ≠ DEPLOY |
| A só | ⚠️ Corta auto, mas “quem tem push em `production`” ainda deploya sem trilha formal |
| B (só manual CLI) | ❌ sem gate técnico; depende de disciplina |
| C só (sem A) | ❌ insuficiente — push em `main` ainda dispara Production pela Git Integration |
| D (só env reviewers) | ❌ **provado** que não bloqueia `vercel[bot]`; 0 rules hoje |
| E (desconectar git) | ⚠️ overkill; preview redesenhado; A+C cobre o caso |
| Staged promote (disable auto-assign) como **camada extra** | ✅ All plans — complemento forte de C (até sem mudar Production Branch, o domínio só muda no promote; ainda assim build de Production pode rodar — A continua necessária para não “buildar PROD” sem ordem) |

### 3.5 Composição recomendada (não é decisão PO)

```text
A  Production Branch = production   →  merge main não publica
C  workflow_dispatch + env approval + Deploy Hook  →  promote explícito auditável
+  (opcional) staged: auto-assign off  →  domínio só no Promote
D  (apenas após PoC, dentro do fluxo do workflow)  →  defense in depth
```

**Fora de escopo desta DV (pendências independentes):** P-DV (bug `ref` SHA vs `refs/heads/main`), P-MIG (migration untracked).

---

## 4. Resíduos e limitações desta sessão

1. `GET` completo do projeto de produção e do billing do time = timeout no canal (CLI/API); fechado via H-8 + staging + comportamento + docs.  
2. Nenhum teste de mutação (por design — mutação = fase posterior com ordem do PO).  
3. Deploy Hooks: nenhum criado (endpoint vazio) — criação é passo de implementação.  
4. Valores de secrets nunca lidos (só nomes/metadata).

---

## 5. Restrições respeitadas

- ❌ Zero mutação Vercel / GitHub / workflows / `vercel.json` / branch protection / secrets / PROD  
- ❌ Zero commit/push/PR/merge desta frente  
- ✅ Somente GET + docs + worktree  
- ✅ Relatórios permanecem **untracked** até decisão/escopo do PO  

---

## 6. STOP — P-AUTO DESIGN DECISION

**Diagnóstico (do audit, reafirmado):** `???` = Git Integration Vercel + Production Branch `main` em `smg-barber`.

**DV respondeu:** os 3 GAPs estão fechados; **A + C é viável no plano Hobby atual**, sem upgrade, sem PoC obrigatória para o núcleo (A+C); **D** permanece apenas como complemento pós-PoC dentro do fluxo do workflow.

**Decisão exigida do PO (uma de):**

1. **Aprovar A + C** (recomendação técnica) → CLASSIFY → ISOLATE → IMPLEMENT  
2. **Aprovar variante** (ex.: A + C + staged promote; ou branch name específica `production` vs `release/prod`)  
3. **Rejeitar / escolher outra alternativa** (A–E ou composição)

**Próximo estado após escolha:** `smg-change-control P-AUTO → CLASSIFY` (ou novo stop de scope) — **não iniciado**.

**STATUS: STOP**  
**MUTAÇÕES: 0**  
**COMMITS DESTA FRENTE: 0**
