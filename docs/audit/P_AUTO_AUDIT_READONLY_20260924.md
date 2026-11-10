# P-AUTO — AUDIT READ-ONLY: por que merge em `main` dispara Production no Vercel

> **Frente:** P-AUTO (dívida change-control: `MERGE ≠ DEPLOY PROD`)  
> **Data:** 2026-09-24  
> **Modo:** ✅ **AUDIT somente** — nenhum artefato remoto foi alterado (Vercel, GitHub Actions, branch protection, workflows, `vercel.json`, permissões, produção).  
> **Autorização:** ordem explícita do PO — `smg-change-control P-AUTO` → AUDIT READ-ONLY.  
> **Estado:** **STOP / P-AUTO DESIGN DECISION** — o PO escolhe a arquitetura antes de qualquer implementação.

---

## 1. Pergunta do PO

```text
PR → merge main → ??? → Vercel Production
```

**Qual componente faz o `???`?**

---

## 2. Resposta direta

**O `???` é a Git Integration do Vercel no projeto `smg-barber`, com Production Branch = `main`.**

Não há GitHub Workflow, webhook de repo, deploy hook ou `vercel.json` que dispare o Production. O disparo é o **push em `main` recebido pela integração Git conectada no painel Vercel**.

### Evidência temporal (PR #79 → merge `5a28456`)

| Instante (UTC) | Evento | Ator |
|----------------|--------|------|
| `2026-09-24T06:47:33Z` | Merge commit `5a28456` em `main` | GitHub (PO review + merge) |
| `2026-09-24T06:48:10Z` | Deployment **`Production – smg-barber`** id `6631932573`, `ref=5a284569…`, `state=success` | **`vercel[bot]`** |
| `2026-09-24T06:48:10Z+` | Status `success` → `target_url` deployment Vercel | **`vercel[bot]`** |
| `06:48:12Z` / `06:48:51Z` / `06:49:08Z` | Check-run **`deploy validation`** → **`conclusion=skipped`** (×3) | github-actions |

**Delta merge → Production: ~37 segundos**, criado exclusivamente por `vercel[bot]`.

---

## 3. Mapa do mecanismo real

```text
PR aprovado (/approve → smg-pr-approve)
        ↓
MERGE em main  (branch protection: required check "validate" + 1 review)
        ↓
push em refs/heads/main
        ↓
┌─────────────────────────────────────────────────────────────┐
│  ??? = Vercel Git Integration (GitHub App "vercel")         │
│  Projeto: smg-barber                                        │
│  Production Branch: main                                    │
│  link: type=github → augustosanchesmanager-ux/sou-manager   │
└─────────────────────────────────────────────────────────────┘
        ↓
Vercel build + deploy automático
        ↓
GitHub Deployment "Production – smg-barber" (via API Vercel)
        ↓
barber.soumanager.com atualizado
```

**Não é:** workflow de deploy · webhook do repo · `vercel.json` · GitHub Environment protection · CLI local · GitHub Action `vercel/action`.

---

## 4. Evidências por sistema

### 4.1 Vercel

| Item | Evidência | Status |
|------|-----------|--------|
| Projeto ligado ao `main` | `smg-barber` (`prj_M3cJ2cZosLONAt9IzumF2LwJZTSj`) — Git Integration `type=github` → repo `sou-manager` | ✅ (topologia H-8, 2026-08-08; sanity pós-D-HOM-11) |
| Production Branch | **`main`** | ✅ (`VERCEL_DEPLOYMENT_TOPOLOGY_AUDIT.md` §2) |
| Duplo deploy legado | Projeto `sou-manager` **desconectado** (D-HOM-11, 2026-08-08) — hoje **só `smg-barber`** recebe Production em `main` | ✅ eliminado |
| `vercel.json` | Apenas SPA rewrite `/(.*) → /index.html` — **zero** trigger de deploy | ✅ lido no worktree |
| Webhooks/automations GitHub | `GET /repos/.../hooks` → **`[]`** (0 hooks) | ✅ |
| Deploy CLI / Action no repo | `package.json` sem script `deploy`/`vercel` de publicação; **nenhum** `.github/workflows/*` contém `vercel` | ✅ |
| Preview vs Production | Push em **qualquer branch** → `Preview – smg-barber` (+ `Preview – smg-barber-staging`, `Preview – smg-estetica`); push em **`main`** → **`Production – smg-barber`** | ✅ padrão deployments API |
| GitHub Environment `Production – smg-barber` | `protection_rules: []` · `deployment_branch_policy: null` · `can_admins_bypass: true` | ✅ **sem required reviewers** |

**Ambientes GitHub inventariados (metadata):** Preview / Preview – smg-barber / smg-barber-staging / smg-estetica / sou-manager · Production / Production – smg-barber / smg-barber-staging / smg-estetica / sou-mana.ger / sou-manager / soumanager.  
**Regra de proteção ativa em Production – smg-barber: nenhuma.**

### 4.2 GitHub

| Item | Evidência | Status |
|------|-----------|--------|
| Workflows ativos | `CI` (`ci.yml`) · `Deploy Validation` (`deploy-validate.yml`) · `smg-pr-approve` (`smg-approve.yml`) · Dependabot (dynamic) | ✅ |
| Workflow que **publica** no Vercel | **Nenhum** (`grep vercel` nos workflows → vazio) | ✅ |
| `ci.yml` | `pull_request` + `push: main` → typecheck/build/unit/architecture/lint advisory/e2e advisory → job `validate` | ✅ |
| `deploy-validate.yml` | Trigger `deployment_status`; job **só roda se** `state==success` **e** `deployment.ref == 'refs/heads/main'` | ✅ |
| Por que `deploy validation` = **skipped** | Vercel reporta `ref` = **SHA** (`5a2845690dcee…`), **não** `refs/heads/main` → condição `if` nunca verdadeira | ✅ check-runs `5a28456` → 3× `conclusion=skipped` |
| `smg-approve.yml` | Comentário `/approve` → valida gates → registra review via `REVIEW_BOT_TOKEN` — **Approval ≠ merge ≠ deploy** (comentário no próprio workflow) | ✅ |
| Branch protection `main` | required check **`validate`** (strict) · 1 approving review · `dismiss_stale_reviews` · `enforce_admins` · sem force-push · sem delete | ✅ |
| Secrets (só metadata) | `REVIEW_BOT_TOKEN` · `SUPABASE_SERVICE_ROLE_KEY` · `VITE_SUPABASE_ANON_KEY` · `VITE_SUPABASE_URL` — valores **não** lidos | ✅ |
| Actions variables | `[]` | ✅ |
| Repo webhooks | `0` | ✅ |
| Environments | 12 environments; **Production – smg-barber sem protection rules** | ✅ |

### 4.3 Fluxo atual vs fluxo desejado

**Atual (evidenciado):**

```text
PR → merge main → Vercel Git Integration (Production Branch=main)
                 → build+deploy automático (~37s)
                 → barber.soumanager.com
                 → deploy-validation SKIPPED (bug de ref SHA vs refs/heads/main)  [P-DV]
```

**Desejado (PO):**

```text
MERGE → main atualizado → 🔒 STOP → PO AUTORIZA DEPLOY
      → DEPLOY PROD → POST-DEPLOY VALIDATION
```

---

## 5. Diagnóstico (registro padrão)

**EVIDENCE:**  
Deployment `6631932573` `Production – smg-barber` criado por `vercel[bot]` 37s após merge `5a28456`; Production Branch `smg-barber` = `main`; 0 repo hooks; 0 workflows com `vercel`; `vercel.json` só rewrites; env GitHub Production sem protection rules; `deploy-validation` skipped por `ref` SHA ≠ `refs/heads/main`.

**INTERPRETATION:**  
O gate real de produção **não existe**. O único “gate” é a branch protection de `main` (review + `validate`), que autoriza **merge**, não **deploy**. Deploy é efeito colateral automático da Git Integration Vercel. O processo escrito (`MERGE → PO decide DEPLOY`) **não é implementado pela infra** — dívida formalizada como P-AUTO.

**GAP:**  
(1) Não foi lida a UI/settings Vercel ao vivo nesta sessão (Production Branch confirmada na auditoria H-8 2026-08-08 + comportamento deployments 2026-09-24 coerente); (2) não há teste de mutação (fora do escopo AUDIT); (3) feature “require approval before Production” do plano Vercel não foi verificada (pode não existir no plano atual); (4) interação entre GitHub Environment required reviewers e deployments criados via API do Vercel **não provada** — não usar como único gate sem PoC.

**DECISION:** pending PO (escolha da arquitetura — §6).

**STATUS:** **STOP** — AUDIT completo; nenhuma mutação executada.

---

## 6. Alternativas → `MERGE ≠ DEPLOY PROD`

Todas as alternativas visam:

```text
MERGE → main atualizado → 🔒 STOP → PO AUTORIZA DEPLOY → DEPLOY PROD → POST-DEPLOY VALIDATION
```

### Alternativa A — **Production Branch separada** (ex.: `production` / `release/prod`)

**Mecanismo:** Vercel passa a tratar só a branch `production` como Production. Push/merge em `main` gera apenas **Preview**. PO (ou pipeline autorizado) promove `main` → `production` somente após autorização.

| Critério | Avaliação |
|----------|-----------|
| **Impacto** | Quebra o auto-deploy atual; `main` deixa de ir a PROD sozinho |
| **Risco** | Baixo–médio — passo extra de promoção; risco de esquecer promover (PROD fica “antiga”, não “errada”) |
| **Complexidade** | **Baixa** — 1 setting Vercel + branch `production` (+ protection na branch) |
| **Reversibilidade** | **Alta** — voltar Production Branch = `main` |
| **Staging/Preview** | **Preservado** — previews por push continuam iguais |
| **Rollback** | Redeploy do SHA anterior em `production` (ou revert + promote) |
| **Fluxo SMG** | Encaixa no estado desejado: merge ≠ deploy; deploy = evento explícito após decisão PO |

**Risco residual:** quem tem push em `production` pode deployar sem passar pelo processo — mitigar com branch protection + (opcional) required reviewers.

---

### Alternativa B — **Deploy exclusivamente manual via Vercel CLI / dashboard** após gate PO

**Mecanismo:** manter Git Integration só para Preview (ou Production Branch apontar para branch ociosa); Production só via `vercel --prod` / promote / redeploy manual com credenciais do time, após ordem do PO.

| Critério | Avaliação |
|----------|-----------|
| **Impacto** | Operação de deploy vira procedure humana documentada |
| **Risco** | **Médio** — depende de disciplina e de quem tem token; erro de projeto/env |
| **Complexidade** | Média — runbook + credencial + quem executa |
| **Reversibilidade** | Alta — religar Production Branch = `main` |
| **Staging/Preview** | Preservados se Git Integration de preview continuar |
| **Rollback** | CLI/dashboard redeploy de versão anterior |
| **Fluxo SMG** | Gate = processo/autorização humana; sem trava técnica se alguém com acesso decidir |

**Risco residual:** sem gate técnico no Vercel; qualquer collaborator com acesso ao projeto pode deployar.

---

### Alternativa C — **GitOps: workflow `workflow_dispatch` + Vercel Deploy Hook / GitHub Environment approval**

**Mecanismo:** desligar auto-Production (via Production Branch ou ignored build); criar Deploy Hook do Vercel; GitHub Actions com `workflow_dispatch` (e/ou environment `Production` **required reviewers** = PO) que aciona o hook somente após aprovação.

| Critério | Avaliação |
|----------|-----------|
| **Impacto** | Deploy vira botão no GitHub, auditável, com trilha de quem autorizou |
| **Risco** | Médio — novo workflow + secret do hook; falha do hook = deploy não sai (fail-safe) |
| **Complexidade** | **Média–alta** — 1 workflow novo + 1 hook + desligar auto-deploy + docs |
| **Reversibilidade** | Alta — remover workflow e religar auto Production Branch |
| **Staging/Preview** | Preservados (hook só para Production) |
| **Rollback** | Job de rollback / redeploy do SHA anterior no mesmo workflow |
| **Fluxo SMG** | **Mais próximo do processo formal**: deploy = transição explícita com autorização registrada no GitHub |

**Risco residual:** complexity de manter o workflow alinhado com `smg-change-control`; secret do hook no repo secrets.

---

### Alternativa D — **Só GitHub Environment required reviewers em `Production – smg-barber`**

**Mecanismo:** adicionar protection rule (required reviewers) no environment GitHub usado pelo deployment da Vercel.

| Critério | Avaliação |
|----------|-----------|
| **Impacto** | Teoricamente pausa deployment status até aprovação |
| **Risco** | **Alto se assumido sem PoC** — deployment é criado pela **API Vercel**; a proteção de environment do GitHub pode **não** bloquear o build/deploy real no Vercel (só o fluxo Actions) |
| **Complexidade** | Baixa de configurar |
| **Reversibilidade** | Alta |
| **Staging/Preview** | N/A (só Production) |
| **Rollback** | Inalterado |
| **Fluxo SMG** | **Não recomendada como único gate** sem prova de que interrompe o `vercel[bot]` |

**GAP:** exige PoC controlado — **fora do AUDIT** (mudança de config). Manter como complemento, nunca como única barreira até validado.

---

### Alternativa E — **Desligar Git Integration do `smg-barber` + deploy 100% promovido (híbrido A+C)**

**Mecanismo:** desconectar git do projeto oficial (como já feito com `sou-manager` em D-HOM-11) e publicar Production só por CLI ou hook pós-autorização; previews podem ficar em projeto/staging separado.

| Critério | Avaliação |
|----------|-----------|
| **Impacto** | Alto — perde conveniência de preview automático no mesmo projeto (ou mantém em outro projeto) |
| **Risco** | Médio–alto — quebra workflows de preview se não redesenhados |
| **Complexidade** | Alta — topologia de projetos |
| **Reversibilidade** | Média — `vercel git connect` (já provado em D-HOM-11) |
| **Staging/Preview** | **Em risco** se não houver plano de preview separado |
| **Rollback** | CLI promote/redeploy |
| **Fluxo SMG** | Máxima separação, maior custo operacional |

---

### Matriz comparativa (síntese)

| Alt | Gate técnico real? | Complexidade | Reversível | Preview OK | Risco principal |
|-----|-------------------|--------------|------------|------------|-----------------|
| **A** Production Branch separada | Sim (deploy só na branch de release) | Baixa | Alta | Sim | Promoção esquecida / push indevido em `production` |
| **B** Manual CLI/dashboard | Fraco (humano) | Média | Alta | Sim | Deploy por acesso direto |
| **C** Deploy Hook + workflow_dispatch (+ env approval) | **Sim + auditável** | Média–alta | Alta | Sim | Manutenção do workflow/secret |
| **D** Só env reviewers GitHub | **Não provado** p/ Vercel API | Baixa | Alta | N/A | **Falsa sensação de segurança** |
| **E** Desligar git integration | Sim | Alta | Média | Precisa redesenhar | Quebra de preview |

**Observação de composição:** **A** é a alavanca mínima que corta `main → PROD` imediatamente. **C** acrescenta o **passo positivo** (“PO autoriza deploy”) com trilha de auditoria. **D** só entra como defesa em profundidade **após** PoC. **B** é aceitável só como transição. **E** é overkill frente a A+C no estado atual do SMG.

---

## 7. Relação com pendências já registradas

| Pendência | Relação com P-AUTO |
|-----------|-------------------|
| **P-DV** (`deploy-validate` skipped) | Paralela — melhora **validação pós-deploy**; não **impede** deploy indevido. Corrigir depois não substitui o gate de produção. |
| **P-MIG** (migration untracked) | Independente — estado de schema; fora do fluxo Vercel. |
| **P-AUTO** (esta frente) | Corta a causa: **auto-deploy em merge**. |

---

## 8. Restrições respeitadas neste audit

- ❌ Nenhuma alteração em Vercel, GitHub Actions, branch protection, workflows, `vercel.json`, permissões ou produção  
- ❌ Nenhum secret/valor exposto (só nomes e timestamps)  
- ❌ Nenhum commit/push desta frente (relatório local; commit exige autorização separada do PO)  
- ✅ Somente leitura: worktree + GitHub API GET + cruzamento com auditoria H-8 pré-existente  

---

## 9. STOP — P-AUTO DESIGN DECISION

**Diagnóstico:** o `???` = **Git Integration Vercel + Production Branch `main`** no projeto `smg-barber`.

**Decisão exigida do PO:** escolher arquitetura (A–E ou composição) para impor:

```text
MERGE → 🔒 STOP → PO AUTORIZA DEPLOY → DEPLOY PROD → POST-DEPLOY VALIDATION
```

**Recomendação técnica (não é decisão):** **A + C** — Production Branch separada (corta o auto-deploy com mudança mínima e reversível) **mais** caminho explícito de autorização (workflow_dispatch / deploy hook) para materializar o gate PO com trilha de auditoria; **D** somente como camada extra após PoC.

**Próximo estado após escolha do PO:** CLASSIFY → (opcional novo stop de scope) → ISOLATE → IMPLEMENT — **não iniciado**.

**STATUS: STOP**
