# P-AUTO — Plano de Mudança Staged Production (v1) + Change-Control

> **Tipo:** Plano de mudança aprovado (read-only até este commit) · **Data:** 2026-09-27
> **Direção:** Alternativa 1 — Staged Production · **ADR:** `docs/adr/ADR-026-merge-not-equal-deploy-prod-gate.md` (Amendment-01)
> **Diagnóstico:** `docs/audit/P_AUTO_GATE409_DIAGNOSTIC_20260927.md`
> **Estado na publicação deste PR:** ISOLATE/COMMIT/PUSH/PR autorizados pelo PO; **MERGE, TOGGLE, PROMOTE, PROD não autorizados** (STOPs próprios abaixo).

---

## Front manifest (smg-change-control)

| Campo | Valor |
|---|---|
| ID | `P-AUTO` — direção `Amendment-01: Staged Production` |
| Branch | `docs/p-auto-staged-adr026` |
| Base | `main` (`a750872`) |
| Escopo IN | Diagnóstico persistido · ADR-026 Amendment-01 · índice `docs/adr/README.md` · revisão do runbook · este change-control · plano de certificação |
| Escopo OUT | ❌ `deploy-validate.yml` (achado congelado) ❌ guardrail em `deploy-production.yml` (frente futura) ❌ branch `production` (A — deferida) ❌ migrations/RLS/dados/secrets ❌ código de produto ❌ toggle Vercel (STOP #3) |
| Checkpoint | Plano v1 aprovado pelo PO (2026-09-27) |
| Current state | ISOLATE → COMMIT → PUSH → PR (autorizados) · MERGE/TOGGLE/PROMOTE/PROD (bloqueados) |

---

## 1. Decisões do PO (2026-09-27)

| Decisão | Veredito | Determinação |
|---|---|---|
| **D1 — Aprovar plano** | ✅ APROVADO | Plano Staged Production aprovado para avançar ao ISOLATE |
| **D2 — Executor do toggle** | ✅ PO / Dashboard Vercel | Augusto executa o toggle manualmente; OpenCode permanece read-only nessa etapa |
| **D3 — Política de candidato** | ✅ CONFIRMADA | O candidato promovido é a **SHA registrada no dispatch/aprovação**; push posterior não altera candidato já aprovado |
| **D4 — Granularidade docs** | ✅ "Docs até PR" em um único aval | ISOLATE → commit → push → PR + CI autorizados; **merge NÃO autorizado** |

> **Ressalva formal do PO:** D1 **não** autoriza o toggle. Direção ratificada ≠ autorização de mutação de infraestrutura.

### Regra D3 explícita (invariante de artefato)

```text
DISPATCH → SHA CANDIDATA = SHA registrada → APPROVAL → PROMOTE exatamente aquela SHA → PRODUÇÃO

main = A; dispatch = A; approval = A; promote = A
depois main = B → B NÃO é promovido; B vira novo candidato e exige novo ciclo de aprovação
```

> **Propriedade preservada: o artefato aprovado pelo PO é exatamente o artefato que chega à produção.**
> (Sem rebuild no promote staged: mesmo deployment ID, mesma build.)

## 2. Sequência de autorizações (state machine — cada STOP é explícito)

```text
AUDIT ✅ → CLASSIFY ✅ → PLANO ✅ APROVADO → ISOLATE 🟢 → COMMIT 🟢 → PUSH 🟢 → PR 🟢
   → 🛑 STOP #2: autorização de MERGE do PR de docs (PO)
   → preflight (§4) verde
   → 🛑 STOP #3: PO executa toggle Vercel: ON → OFF (dashboard)
   → Release A (merge real autorizado) → gate real → evidências
   → 🛑 STOP #4: veredito (certificação parcial | rollback)
   → Release B → gate real → certificação final → CLOSE
```

## 3. Item de mudança único (change-control)

| Campo | Valor |
|---|---|
| Tipo | Infraestrutura de plataforma (configuração Vercel) — **1 toggle** |
| Plataforma | Vercel · projeto **`smg-barber`** (`prj_M3cJ2cZosLONAt9IzumF2LwJZTSj`) |
| Path | Settings → Environments → Production → toggle **"Auto-assign Custom Production Domains"** |
| De → Para | `ON` → `OFF` (EVIDENCE de ON: comportamento observado no merge `a750872`; leitura direta de tela = preflight) |
| Efeito | Builds da Production Branch (`main`) passam a nascer **Staged** (prontos, sem servir domínio de produção). O toggle **não move o alias atual** — `barber.soumanager.com` permanece em `dpl_FcVx…` até um promote real. Efeito não-retroativo: observável no próximo deployment de produção (Release A) |
| Executor | **PO (dashboard)** — campo de API não verificado nos docs oficiais |
| Reversível | Sim, 1 clique (religar toggle) + *Instant Rollback* do alias |
| Envolve código/repo/banco/secret | **Não** (apenas docs, neste PR) |

## 4. Preflight (read-only, na janela de mudança — antes do STOP #3)

| # | Check | Evidência |
|---|---|---|
| 1 | `vercel whoami` + token válido | CLI |
| 2 | Baseline: `vercel inspect https://barber.soumanager.com` → `dpl_FcVx…` = Current, SHA registrada | gravar em evidência |
| 3 | `vercel ls smg-barber` — estados dos candidatos | gravar em evidência |
| 4 | Toggle confirmado `ON` antes da virada (leitura dashboard pelo PO) | afirmação/screenshot |
| 5 | `main` HEAD = SHA esperada; último CI green | GitHub |
| 6 | Environment `Production` reviewers intactos | GitHub |
| 7 | Nenhum gate/dispatch nem build Vercel em andamento | GitHub + Vercel |
| 8 | Rollback prontos (§5) e PO presente na janela | — |
| 9 | Freeze de merges durante mudança + Release A | combinado |
| 10 | Nenhuma migration pendente (invariante DB) | — |

## 5. Rollback

- **N1 (raio imediato):** religar o toggle → modelo original restaurado; alias intacto (o toggle não move alias).
- **N2 (alias errado pós-promote):** *Instant Rollback* documentado — reatribuir `dpl_FcVx…` sem rebuild.
- **N3 (falha pós-promote num release real):** promote do deployment anterior conhecido (runbook §4) + E2E.
- **Triggers:** alias mover sem promote · promote falhar com erro novo · steps de health/smoke não executarem.

## 6. Critérios objetivos do próximo gate (pass/fail)

1. Preflight: alias = deployment **anterior** ao candidato (prova de toggle OFF).
2. Candidato identificado: `target=production`, SHA = input do dispatch.
3. `promote` = **SUCCESS**, log **sem 409**.
4. Pós-promote: alias → candidato, SHA conferida (`vercel inspect`).
5. Steps `Health check` **e** `Smoke E2E` = `conclusion: success` (**nunca skipped**).
6. Log do smoke prova resolução via `process.env` (job sem step que escreva `.env.local`).
7. Trilha completa no step summary (todos os campos).
8. Sequência observada: merge (→staged, alias imóvel) → approval → promote (→alias muda) → E2E executa.
9. **Job success do post-validate NÃO vale como evidência** — somente steps individuais.

## 7. Alterações de workflow: necessárias?

**Nenhuma alteração é obrigatória.** `deploy-production.yml` já foi desenhado para este modelo; com toggle OFF, o `promote` deixa de encontrar o alvo `Current`. **Guardrail opcional** (verificar `alvo ≠ Current` antes do promote; alertar se SHA ≠ head) = **frente futura separada**. `deploy-validate.yml` permanece **congelado** como achado independente (bug de condição de `ref` — 7/7 runs pós-merge skipped; decisão própria futura: corrigir condição **ou** aposentar via ADR — nunca na mesma frente).

## 8. Plano de certificação — 2 releases consecutivos

- **Release A** (primeiro merge real autorizado pós-toggle): executar a sequência completa do §6 e persistir evidências (IDs, timestamps, job IDs, conclusões) em documento próprio de certificação → **certificação parcial**.
- **Release B:** repetição idêntica, **sem correção entre eles** → **certificação final P-AUTO** → CLOSE.
- Qualquer falha → STOP + rollback correspondente → nova diagnostic read-only → nova autorização. Sem "ajustar e tentar de novo".

## 9. Registro evidente (formato smg-change-control)

- **EVIDENCE:** gate real `36347757267` (409 estrutural); timeline de auto-assign; docs Vercel (staged = todos os planos, promote sem rebuild); ADR-026 previa staged como camada opcional; plano entregue e aprovado pelo PO em sessão (D1–D4).
- **INTERPRETATION:** um único toggle fecha a causa raiz; gate Fase 1 funciona sem código novo; artefato promovido = artefato servido.
- **GAP:** (1) estado do toggle inferido, não lido (verificar API/UI no preflight); (2) texto exato do UI confirmado na tela; (3) aparência de estado staged em `vercel ls` confirmada empiricamente no Release A; (4) risco aceito — promote esquecido = PROD antiga, não errada.
- **DECISION:** plano v1 **APROVADO** (D1–D4); execução do toggle pendente de STOP #3; merge deste PR pendente de STOP #2.
- **STATUS:** CONTINUE — este PR aguarda CI + autorização de merge; nenhuma mutação de infra executada.

## Nota de escopo deste PR de docs

Referências históricas do ADR-026 apontam para `docs/audit/P_AUTO_AUDIT_READONLY_20260924.md`,
`P_AUTO_DESIGN_VALIDATION_20260924.md`, `P_AUTO_CLASSIFY_SCOPE_20260924.md` e
`VERCEL_DEPLOYMENT_TOPOLOGY_AUDIT.md` — os três primeiros **não estão versionados no repositório**
(pendência de front anterior, fora do escopo autorizado deste PR; não podem ser misturados aqui).
`VERCEL_DEPLOYMENT_TOPOLOGY_AUDIT.md` está versionado.
