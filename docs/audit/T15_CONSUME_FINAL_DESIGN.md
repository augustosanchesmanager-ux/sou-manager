# T15 — Design Final do Consumo de Authorization Record (SMG-GATE FASE 3A)

**Status:** DESIGN — entregue para revisão do PO. **Design apenas:** nenhum código, nenhuma escrita de consumo, nenhum `contents: write`, nenhum record real é autorizado por este documento.
**Date:** 2026-09-25
**Base normativa:** Contrato `.opencode/SMG_GATE.md` V1.0/r2 (fonte de verdade das regras) · ADR-028 (PR #80 — decisão arquitetural B1, Rev 2026-09-25) · P.02 Trust Boundary (PR #81 — **merged**, `3bfeae5`)
**Deciders:** PO (Augusto) + OpenCode (Tech Lead)
**Autorização do gate:** PO 2026-09-25 — "Design final do `consume` AUTORIZADO; sem implementação; sem `contents: write`."

---

## 1. Objetivo e relação com o ADR-028

Este documento é a **especificação component-level** do consumidor de Authorization Record da transição T15 (merge). O ADR-028 decide **o quê** (dois stores, fail-closed, binding, consumo único); este documento especifica **como o componente `consume` valida e executa** — pipeline exato, algoritmo determinístico de `grant_ref`, contrato de proveniência de aprovação contra o modelo real da API e fronteiras do componente — **antes** de qualquer autorização de implementação.

Se qualquer coisa neste documento divergir do contrato V1.0/r2 ou do ADR-028: **prevalece o contrato/ADR → STOP → reconciliação documental** (nunca resolução heurística).

**Não substitui o ADR-028** — complementa-o (§8 e §13 do ADR são o alicerce; aqui viram algoritmo).

---

## 2. Pré-condição permanente — Invariante P.02 (arquitetural)

Com o merge do PR #81 (`3bfeae5`) e a prova viva (run `36124104780`):

```text
job privilegiado (smg-approve → run.mjs → SMG_TOKEN)
  → checkout SOMENTE da default branch (ref: ${{ github.event.repository.default_branch }})
  → nunca refs/pull/N/head (código do autor do PR = forjável)
```

**Invariante do T15:** todo job que executa o `consume` (leitura de stores, POST de review, escrita de consumo) roda com código vindo da default branch. Evidência obrigatória pós-implementação: log do step Checkout com `ref: <default>` e ausência de `refs/pull`. Violação → **STOP** (classe de bug que a P.02 eliminou — não pode ser reintroduzida por mudança futura alguma).

Defesa estrutural já em `main`: teste positivo (`default_branch` obrigatório) + negativos (`refs/pull` ❌, `pull/${{` ❌, `head.sha` ❌) em `scripts/smg-pr-approve/workflow.test.mjs`.

---

## 3. Arquitetura B1 — resumo vinculante (ADR-028 §5/§8)

| Store | Branch | Conteúdo | Escrita |
|---|---|---|---|
| Emissão (grant) | `smg-gate-records` | `docs/records/<record_id>.json` — imutável pós-emissão | **Somente PO**, Web UI assinada (`required_signatures` ON — 409 provado no micro-gate) |
| Consumo (evento) | `smg-gate-consumption` | `docs/consumption/<record_id>.json` — create-only, append-only | **Somente o workflow** via `GITHUB_TOKEN` (CREATE; nunca UPDATE/DELETE) |

- O consumidor lê **apenas** as branches de governança via **API (`?ref=`)** — nunca do checkout do PR.
- Separação de autoridade é **enforcement de plataforma**: o token do workflow não assina → estruturalmente excluído da emissão (409).
- **Propriedade normativa (PO):** um evento de consumo **nunca** cria, modifica, revoga ou renova autorização. Consumo = evidência de uso de um grant existente.

---

## 4. As 3 correções obrigatórias — especificação exata

### C1 — Proveniência da aprovação vinculada ao bot + mesmo SHA

**Formulação PO (obrigatória):** não basta "existe uma review APPROVED"; exige-se:

```text
review.state    == "APPROVED"
review.user.login == "review-bot-smg"
review.commit_id  == pr_head_sha
```

**Especificação contra o modelo real da API** (`GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews` — objeto Review):

| Campo da API | Exigência | Papel |
|---|---|---|
| `state` | `== "APPROVED"` | review de aprovação efetiva |
| `user.login` | `== "review-bot-smg"` | aprovação humana pré-existente (UI) **não satisfaz** |
| `commit_id` | `== pr_head_sha` (SHA atual do head do PR, obtido de `GET /pulls/{n}` → `head.sha`) | aprovação do bot em SHA antigo **→ STOP** |
| `id` | gravado no evento de consumo como **`approval_ref`** — id **exato** da review utilizada | nunca a mera existência de "uma aprovação" |

**Derivação de `pr_head_sha`:** `GET /pulls/{pull_number}` → `head.sha` no momento do consumo (o payload de `issue_comment` não traz o SHA do head — leitura obrigatória via API).

**Comportamento por caminho:**

1. **Rerun / aprovação já registrada** (idempotência nível 1): o NOOP só é válido se a review bot existente satisfaz C1 completa. Divergência (SHA antigo, login ≠ bot, state ≠ APPROVED) → **STOP** — nunca NOOP-silencioso.
2. **Primeiro run:** após o gate de record, o workflow POSTs a review → valida a resposta imediatamente (`state`, `user.login`, `commit_id`) → só então grava `approval_ref` e consome. Resposta divergente → **STOP sem consumo**.
3. Qualquer divergência em qualquer caminho → **STOP fail-closed**.

Onde C1 mora: função **pura** de validação (camada guards) + verificação da resposta do POST (camada run). `artifact_ref` (grant) `== pr_head_sha` (API) `== review.commit_id` (review) formam um **único ponto de verdade**.

### C2 — Gate estrutural PR-only (dupla camada)

**Formulação PO:** o consumo só pode existir para evento de PR — `github.event.issue.pull_request` existe; comentário em Issue comum → **STOP**.

1. **Camada estrutural (workflow):** o job de consumo só executa com `if: ${{ github.event.issue.pull_request }}`. Em Issue, o job **nem existe** — classe de comportamento ambíguo eliminada barata e estruturalmente.
2. **Camada de defesa (pura):** `assertPullRequestEvent(payload)` exige `payload.issue.pull_request` presente/não-vazio; ausente → **STOP**. Comentário `issue_comment` também dispara para Issues — a camada pura fecha o caso mesmo que a camada 1 regredir.

Ambas as camadas permanecem (defesa em profundidade); remover qualquer uma → violação de design → STOP na revisão.

### C3 — `grant_ref` determinístico (comprovado, não presumido)

**Formulação PO:** significa o **commit que materializou o grant atualmente válido** — nunca "último commit encontrado para o path". Histórico que impossibilite identificar a emissão de forma inequívoca → **STOP**.

**Algoritmo determinístico** (para um `record_id` candidato cujo status atual é `granted`):

```text
1. GET /contents/docs/records/<record_id>.json?ref=smg-gate-records
     → conteúdo atual + blob sha (S_head)
2. GET /commits?path=docs/records/<record_id>.json&sha=smg-gate-records
     → lista ordenada (mais recente → mais antigo), per_page=100
3. Se vazia → STOP (árvore sem histórico = anomalia)
4. Se N > 1 → STOP  (ver regra 5)
5. N = 1 → grant_ref = commits[0].sha
     a. GET /contents/...?ref=<grant_ref> → blob sha (S_emit) e conteúdo
     b. Exigir S_emit == S_head   (imutabilidade PROVADA byte a byte,
        não presumida pela ausência de commits)
     c. Conteúdo na emissão: status == "granted" + 17 campos válidos (contrato §5)
6. N > 1 com status == "granted" → IMPOSSÍVEL legitimamente:
     transições são somente para frente (I10) — granted não retorna após
     revoked/expired/rejected; logo >1 commit no path de um grant ainda
     "granted" = mutação de conteúdo proibida / histórico ambíguo → STOP
7. N > 1 com status != "granted" → o próprio gate de estado já faz STOP
     (não consumível); grant_ref não é computado para consumo.
```

**Por que `commits?path=` isolado é insuficiente (§13 do ADR):** listar commits mostra *quantos* toques houve, não *o que* mudou. A prova de imutabilidade é a comparação `S_emit == S_head` (blob sha idêntico ⇒ arquivo intocado desde a emissão) **somada** à unicidade do commit. Ambas obrigatórias.

**Uso do `grant_ref`:** gravado no evento de consumo como cross-ref; **recomputado** a cada re-read (NOOP, auditoria): divergência `grant_ref` gravado ≠ `grant_ref` recomputado → **STOP** (anomalia cross-record).

---

## 5. Pipeline do `consume` — ordem exata (fail-closed)

Respeita a ordem normativa do ADR-028 §15 (gates atuais → idempotência → gate de record → aprovação → consumo):

```text
[0] ESTRUTURAL  C2-camada-1: job só roda se issue.pull_request existe (workflow if)
[1] run.mjs     GET /pulls/{n} → pr_head_sha = head.sha; base.ref (validatePr: base != main → STOP)
[2] guards      Gates existentes preservados: PO_ACCOUNT (comentário /approve),
                estado do PR, checks + allowlist advisory, idempotência de comentário
[3] guards      C2-camada-2: assertPullRequestEvent(payload) → ausente → STOP
[4] idemp. 1    Review bot já registrada?
                  sim → C1 completa (state/user/commit_id == pr_head_sha)
                          ok → NOOP do POST · divergente → STOP
                  não → continua (POST ocorre após gate de record)
[5] run.mjs     Carregar os DOIS stores via API (?ref=):
                  records: lista candidatos + conteúdos
                  consumption: GET docs/consumption/<record_id>.json (404 = ausente)
[6] guards      C3: computar/comprovar grant_ref (algoritmo §4-C3)
[7] guards      Gate de record (§14): exatamente UM candidato granted com
                artifact_ref == pr_head_sha · target == main · environment == n/a ·
                transition == T15 · front_id presente · now ≤ expires_at
[8] guards      Estado lógico derivado (§13): granted → prossegue ·
                consumed (consumo presente + cross-refs ok) → NOOP total ·
                qualquer outro/anomalia → STOP
[9] run.mjs     POST review (se não NOOP) → C1 da resposta → falha → STOP sem consumo
[10] run.mjs    CREATE evento em docs/consumption/<record_id>.json (smg-gate-consumption)
                  cross-refs: record_id · grant_ref · pr_head_sha · target · approval_ref
                  422 (já existe) → re-read → cross-refs completos batem → NOOP
                                              divergem → STOP
```

**Ordem inegociável:** aprovar **antes** de consumir (crash pós-aprovação é recuperável no rerun via reparo; consumir-antes-aprovar cria estado irreversível). Nenhum caminho degradado ("aprovar sem record", "consumir com record inválido").

---

## 6. Modelo de dados

### 6.1 Grant — 17 campos, exatamente o contrato §5 (ADR-028 §6)

Sem extensões próprias nesta fase. Campos de identidade imutáveis: `record_id`, `front_id`, `transition`, `scope_id`, `target`, `artifact_ref`, `authorized_by`, `authorized_at`. Campos administrativos (só PO, só para frente): `status`, `revoked_at/revoked_by`, `reason`, `expires_at`.

### 6.2 Evento de consumo — campos mínimos (create-only)

```json
{
  "record_id": "ar-20260925-001-merge",
  "grant_ref": "<SHA único que materializou o grant (C3)>",
  "pr_head_sha": "<head.sha consumido>",
  "target": "main",
  "approval_ref": "<id exato da review review-bot-smg (C1)>",
  "consumed_at": "<ISO-8601>",
  "consumed_by": "smg-approve@<run_id>"
}
```

Cross-refs obrigatórios validados a cada leitura: `record_id`, `grant_ref`, `pr_head_sha`, `target` (§14 cond. 11) + `approval_ref` (§8). Schema estrito: campos extras → STOP (mesma disciplina dos 17 do grant).

---

## 7. Máquina de estados derivada (ADR-028 §13) — inalterada

| Grant | Consumption | Estado lógico | Ação |
|---|---|---|---|
| ausente | — | — | STOP |
| `granted` válido | ausente | `granted` | aprovação+consumo habilitados |
| `granted` válido | presente, cross-refs ok | `consumed` (terminal) | NOOP / auditoria |
| qualquer | presente, cross-refs inválidos | anomalia | STOP |
| ausente | presente | consumo órfão | STOP |

`consumed` é **derivado**, recalculado a cada uso, sem cache. O grant permanece `granted` fisicamente; `consumed_at`/`consumed_ref` vivem no evento.

---

## 8. Condições STOP consolidadas (fail-closed — completa, fechada)

| # | Condição | Fundamento |
|---|---|---|
| 1 | Evento não é de PR (`issue.pull_request` ausente) | **C2** |
| 2 | Review inexistente ou `state ≠ APPROVED` ou `user.login ≠ review-bot-smg` ou `commit_id ≠ pr_head_sha` | **C1** |
| 3 | `approval_ref` não corresponde à review validada | **C1** |
| 4 | Zero records candidatos para o SHA | §5.2 |
| 5 | Múltiplos records candidatos para o SHA | I7 — ambiguidade = STOP |
| 6 | Estado lógico ≠ `granted` (grant ausente/terminal, consumo inválido) | §5/§6 |
| 7 | `artifact_ref ≠ pr_head_sha` | §5.3 |
| 8 | `target ≠ main` ou `environment ≠ n/a` | I3/I9 |
| 9 | `transition ≠ T15` | I7/I8 |
| 10 | `front_id` ausente/vazio | I5 |
| 11 | `now > expires_at` (quando presente) | §5.4 |
| 12 | `grant_ref` não identificável de forma inequívoca (N≠1, blob-sha divergente, histórico ambíguo) | **C3** |
| 13 | `grant_ref` gravado ≠ recomputado no re-read | **C3** |
| 14 | Store inacessível (API falha, branch ausente, JSON inválido) — qualquer um dos dois | §14-9/§14-13 |
| 15 | Evento de consumo presente com cross-refs inválidos | §14-11 |
| 16 | Consumo órfão (presente sem grant) | §14-12 |
| 17 | Demais gates atuais (PO_ACCOUNT, estado do PR, checks) | `guards.mjs` preservados |
| 18 | Violação do invariante P.02 (checkout ≠ default branch) | §2 deste doc |

---

## 9. Idempotência e concorrência (ADR-028 §15 — preservado)

- **Nível 1:** aprovação já registrada **e** C1 válida → NOOP (exit 0, sem POST).
- **Nível 2:** consumo único — caminho determinístico + CREATE-only (422 da plataforma).
- **422 ≠ "tudo certo":** re-read + validação dos cross-refs completos → batem → NOOP legítimo; divergem → STOP.
- **Concorrência:** `concurrency` group por PR (barreira 1) + efeito 422 (barreira 2). Perdedor → 422 → re-read → NOOP/STOP.

---

## 10. Fronteiras do componente

| Camada | Arquivo-alvo (futuro) | Responsabilidade |
|---|---|---|
| Pura | `guards.mjs` — `validateAuthorizationRecord`, `assertPullRequestEvent`, `assertConsumptionTarget`, `assertCreateOnly`, `assertCrossReferences`, validador C1/C3 | Toda decisão; **zero I/O**; funções testáveis |
| I/O | `run.mjs` | API dos dois stores, POST da review, CREATE do consumo |
| Execução | `smg-approve.yml` | Ponto de execução; permissões mínimas; job `if` C2-camada-1 |

**Separação de poderes preservada:** o bot **executa**, nunca decide; o record é a materialização da decisão do PO.

---

## 11. Escopo negativo — NÃO autorizado por este gate

- ❌ Implementação: `consume`/`validateAuthorizationRecord` em `guards.mjs`, `run.mjs`, `smg-approve.yml` — **nenhum arquivo de código tocado**
- ❌ `contents: write` (qualquer escopo) — decisão posterior, após revisão deste design
- ❌ Criação de evento de consumo real (mesmo em branch de teste — barreira da assinatura é da emissão; consumo é exclusivo do fluxo autorizado)
- ❌ Authorization Record real / escrita em `smg-gate-records`
- ❌ Flag `SMG_GATE_RECORD_REQUIRED` (continua ausente/OFF — ativação é decisão própria, ADR-028 §25)
- ❌ Alteração de `smg-approve.yml`, branch protection, secrets, CI, skills
- ❌ Criação/alteração da branch `smg-gate-consumption` além do provisionamento já decidido
- ❌ Merge do PR #80 junto com qualquer ato desta frente (gate próprio)
- ❌ Qualquer coisa de T10/T12/T18/T20, P-DV, Supabase, migration, RLS, RPC

---

## 12. Critérios deste gate

**Entrada (satisfeitos):** contrato V1.0/r2 aprovado · ADR-028 B1 aprovado com as 3 correções (Rev 2026-09-25) · micro-gate de emissão fechado (7/7) · branches provisionadas · **P.02 merged e validada pós-merge** (`3bfeae5`, run `36124104780`) · design autorizado pelo PO (2026-09-25).

**Saída (exige decisão do PO):** este documento revisado e aprovado **→** então decisão sobre `contents: write` **→** então implementação T15 (com teste de equivalência contrato↔guards, ADR-028 §23).

---

## 13. Próximos passos (sequência do PO — inegociável)

```text
1. Este design ................ 🟢 executado → STOP
2. Revisão do design pelo PO ... ⏳ aguardando
3. Decisão contents: write ..... 🔒 bloqueada até 2
4. Implementação T15 ........... 🔒 bloqueada até 3
5. STOP final + ativação ....... gate próprio (flag, rollback §25)
```

---

## 14. Referências e traceability

- Contrato V1.0/r2 — `.opencode/SMG_GATE.md` (§1.2, §5, §5.2, §5.3, §5.4, §6, §14, §15, I3/I5/I7/I8/I9/I10)
- ADR-028 Rev 2026-09-25 — PR #80, branch `feature/smg-gate-fase2` (§5 stores, §8 consumidor + C1/C2, §9 binding, §13 estado derivado + C3, §14 STOP, §15 idempotência, §20 integração, §23 testes, §25 rollback)
- P.02 — PR #81 **merged** (`3bfeae5`); spec `docs/audit/P_02_SMG_APPROVE_TRUST_BOUNDARY.md` (PR #80); evidência viva: run `36124104780`, `git checkout -B main refs/remotes/origin/main`, `review-bot-smg` APPROVED
- ADR-025 (bootstrap `smg-pr-approve`) · ADR-027 (formalização do contrato) · ADR-026 (deploy — intocado)
