# ADR-026: `MERGE ≠ DEPLOY PROD` — Gate de Publicação C+D com Staged Production (Amendment-01)

**Status:** Accepted (Amendment-01, 2026-09-27 — direção Staged Production ratificada pelo PO; IMPLEMENT pendente de autorização explícita e change-control)
**Date:** 2026-09-24 (Amendment-01: 2026-09-27)
**Deciders:** PO (Augusto) + OpenCode
**G0:** P-AUTO (dívida change-control: `MERGE ≠ DEPLOY PROD`)
**References:**
- `docs/audit/P_AUTO_AUDIT_READONLY_20260924.md` (diagnóstico + alternativas A–E)*
- `docs/audit/P_AUTO_DESIGN_VALIDATION_20260924.md` (fechamento dos 3 GAPs + validação A+C)*
- `docs/audit/P_AUTO_CLASSIFY_SCOPE_20260924.md` (escopo da frente)*
- `docs/audit/VERCEL_DEPLOYMENT_TOPOLOGY_AUDIT.md` (H-8: Production Branch atual = `main`)
- `docs/audit/P_AUTO_GATE409_DIAGNOSTIC_20260927.md` (diagnóstico do 409 no gate real do PR #93)
- `docs/audit/P_AUTO_STAGED_CHANGE_PLAN_20260927.md` (plano de mudança aprovado — D1–D4, 2026-09-27)
- Decisão do PO (2026-09-24): direção arquitetural **A + C**
- Decisão do PO (2026-09-27): **Amendment-01** — direção primária passa a ser **Staged Production** (ver abaixo)

\* Referências de front anterior, ainda não versionadas no repositório (fora do escopo do PR que criou este arquivo; pendência registrada em `P_AUTO_STAGED_CHANGE_PLAN_20260927.md`).

---

## Context

Hoje, merge em `main` dispara automaticamente Production no Vercel em ~37 segundos (evidência: merge `5a28456` → deployment `6631932573` por `vercel[bot]`, e novamente no gate do PR #93: merge `a750872` 20:00:03Z → alias movido ~20:00:40Z), via Git Integration do projeto `smg-barber` com Production Branch = `main`.

O processo escrito exige `MERGE → 🔒 STOP → PO AUTORIZA DEPLOY → DEPLOY PROD`, mas a infraestrutura **não implementa** esse gate: branch protection de `main` autoriza apenas o *merge*, não o *deploy*. Ver audit para o mapeamento completo do mecanismo e das alternativas A–E.

Restrições do plano atual (fechadas no DV):
- Vercel **Hobby** — sem approval-gate nativo de produção, sem custom environments;
- GitHub environment `Production – smg-barber` sem protection rules; required reviewers do GitHub **não bloqueiam** deployments criados via API Vercel (`vercel[bot]`) — alternativa D descartada como gate único;
- **Staged production** (disable auto-assign de domínios + promote manual) e **Deploy Hooks** disponíveis em **todos os planos**.

---

## Problem

Como garantir tecnicamente que **nenhum deploy de produção ocorra sem autorização explícita do PO**, mantendo previews funcionando, com mudança mínima, reversível e sem upgrade de plano?

---

## Decision

Adotar a composição **A + C** (aprovada pelo PO em 2026-09-24):

### A — Production Branch separada

- Branch de produção do Git/Vercel: **`production`** (nome definitivo, registrado nesta decisão).
- Efeito: push/merge em `main` gera somente **Preview**; Production só a partir de `production`.
- Primeira mutação de infra: criar branch `production` (partindo de `origin/main = 5a28456`) e aplicar branch protection **antes** de qualquer implementação de workflow.

### C — Promoção explícita via `workflow_dispatch` + Deploy Hook

- Workflow GitHub **novo** (nome a definir na IMPLEMENT), disparo **manual** (`workflow_dispatch`), com **environment approval** (reviewer: PO) no job que aciona o hook.
- **Deploy Hook Vercel** (1 hook, branch `production`) — URL guardada como repo secret (nome previsto: `VERCEL_DEPLOY_HOOK_URL`; valor nunca exibido).
- Fail-safe: hook/workflow indisponível → deploy não sai.

### Camadas opcionais / defesa em profundidade

- **Staged promote** (desligar `autoAssignCustomDomains` em produção): domínio só muda no `vercel promote` — disponível no Hobby; avaliar como refino pós-IMPLEMENT.
- **D** (required reviewers em environment GitHub): apenas como camada extra **dentro** do workflow C e **após** PoC; nunca como gate único.

### Fluxo alvo

```text
PR → merge main → 🔒 STOP (só Preview)
    → PO dispara workflow_dispatch → environment approval
    → Deploy Hook → build em production → barber.soumanager.com
    → POST-DEPLOY VALIDATION (P-DV, frente paralela)
```

---

## Amendment-01 (2026-09-27) — Staged Production passa a ser o mecanismo primário

**Status desta emenda:** Accepted — ratificada pelo PO em 2026-09-27 (plano P-AUTO v1, decisões D1–D4), em resposta ao diagnóstico do gate real do PR #93.

**EVIDENCE**
- Gate real `PO-PR93-GATE-2026-09-27` (run `36347757267`, SHA `a750872`): job `promote` falhou com
  `Error: The provided deploymentId (dpl_FcVxKeXRrSt1okPnv4nndtjcjXFo) is already the current production deployment. (409)`.
- Cadeia: merge 20:00:03Z → deployment `target=production` 20:00:06Z → **auto-assign** do domínio `barber.soumanager.com` ~20:00:40Z → dispatch do gate 20:21:57Z → `promote` sobre deployment já `Current` → 409 estrutural.
- 7/7 runs de `deploy-validate.yml` pós-merge terminaram `skipped` (bug independente: `deployment.ref` nunca é `refs/heads/main`).
- Diagnóstico completo: `docs/audit/P_AUTO_GATE409_DIAGNOSTIC_20260927.md`.

**INTERPRETATION**
- A linha `A` (Production Branch) existiria para impedir que merge em `main` virasse produção; a camada *staged promote*, prevista neste ADR como "refino opcional", atinge o mesmo efeito com superfície mínima: desligar `Auto-assign Custom Production Domains` mantém o build de produção (Git Integration) mas remove o **movimento automático do alias** — exatamente o recurso que o gate precisa controlar.
- A tese original "C apenas (sem A) é insuficiente — push em `main` continuaria disparando Production" pressuponha auto-assign ON. Com staged, `C + D + Staged` é suficiente: o merge passa a criar deployments **staged** (build ok, domínio imóvel) e o `promote` da Fase 1 torna-se efetivo.

**DECISION PO (2026-09-27)**
1. Direção primária = **Staged Production** (toggle `Auto-assign Custom Production Domains` = OFF no projeto `smg-barber`) + **C** (`workflow_dispatch` + Environment approval) + **D** (`vercel promote`) — C e D já operacionais desde a Fase 1 (D-HOM-35).
2. **`A` (Production Branch `production`) = DEFERRED/SUPERSEDED** — não necessária para o gate; pode ser reavaliada como defesa em profundidade.
3. **Deploy Hook = deferred** — o `promote` da Fase 1 substitui o hook no fluxo atual.
4. **`deploy-validate.yml` = achado independente e congelado** — bug de condição de `ref` comprovado no mesmo gate; decisão própria futura (corrigir a condição **ou** aposentar via ADR), nunca na mesma frente.

**Fluxo alvo (Amendment-01)**

```text
MERGE → DEPLOYMENT STAGED (alias imóvel) → 🛑 PO APPROVAL → PROMOTE
   → PRODUÇÃO → HEALTH + E2E → CERTIFICAÇÃO
```

**Política de candidato (D3 — invariante de artefato)**

```text
DISPATCH → SHA CANDIDATA = SHA registrada → APPROVAL → PROMOTE exatamente aquela SHA → PRODUÇÃO
```

Push posterior em `main` cria novo candidato e exige novo ciclo de aprovação. O promote staged **não rebuilda** (mesmo deployment ID, mesma build) — **o artefato aprovado pelo PO é exatamente o artefato que chega à produção.**

**Execução:** pendente de change-control (`docs/audit/P_AUTO_STAGED_CHANGE_PLAN_20260927.md`) — o toggle é executado **somente** após STOP #3 do plano, pelo PO, no dashboard Vercel. Este ADR formaliza a decisão; **não autoriza a mutação.**

---

## Alternatives Considered

| Alt | Desfecho | Motivo |
|-----|----------|--------|
| A apenas | Aceitável como base, insuficiente sozinho | Sem trilha formal de autorização |
| B (manual CLI/dashboard) | Rejeitada como estado final | Gate só humano, sem auditoria |
| C apenas (sem A) | **Insuficiente** (com auto-assign ON — tese original) | Push em `main` continuaria disparando Production |
| D (só env reviewers GitHub) | **Rejeitada como gate único** | Provado no DV: não bloqueia `vercel[bot]` |
| E (desconectar Git Integration) | Overkill | A+C cobre o caso com Preview preservado |
| **Staged (auto-assign OFF) + C + D** | **ADOPTED — Amendment-01 (2026-09-27)** | Remove o auto-assign; `promote` torna-se efetivo; sem rebuild; superfície mínima (1 toggle); Hobby; reversível |

Matriz completa: `docs/audit/P_AUTO_AUDIT_READONLY_20260924.md` §6*; diagnóstico que motivou a emenda: `docs/audit/P_AUTO_GATE409_DIAGNOSTIC_20260927.md`.

---

## Consequences

**Positivas**
- `MERGE ≠ DEPLOY PROD` passa a ser propriedade da infraestrutura, não só do processo.
- Autorização fica registrada no GitHub (quem, quando, approval do environment).
- Totalmente reversível: religar o toggle (N1) + *Instant Rollback* do alias (N2).
- Sem custo: Hobby, sem novos recursos; gate Fase 1 funciona sem alteração de workflow.
- Promote sem rebuild → trilha de auditoria e E2E validam o artefato servido.

**Negativas / riscos**
- Passo extra a cada produção (promoção esquecida → PROD antiga, não errada).
- Toggle é configuração de dashboard (não IaC) → exige change-control e registro (preflight do plano §4).
- Candidatos staged se acumulam a cada push → seleção obrigatória pela SHA do dispatch (regra D3).
- `deploy-validate.yml` permanece inoperante até decisão própria (achado congelado).

**Guardrails de implementação (invariantes)**
- Zero alteração em migrations, RPCs, RLS, dados de produção ou código funcional do SMG.
- Nenhuma mutação remota antes da validação do ISOLATE pelo PO; toggle apenas após STOP #3.
- Escopo estrito ao manifest do plano (`docs/audit/P_AUTO_STAGED_CHANGE_PLAN_20260927.md`).
- Nunca misturar: este change-control · guardrail do `deploy-production.yml` · correção/aposentadoria do `deploy-validate.yml` · branch `production`.
