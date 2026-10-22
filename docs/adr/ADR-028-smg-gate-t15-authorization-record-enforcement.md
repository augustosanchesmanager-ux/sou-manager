# ADR-028: Enforcement do Authorization Record em T15 — Store File-Based (SMG-GATE FASE 3A)

**Status:** Proposed (design apenas — implementação bloqueada até autorização explícita do PO)
**Date:** 2026-09-24
**Rev:** 2026-09-25 — revisão documental autorizada pelo PO (dec. B1: dois stores — grant imutável + evento de consumo; branch `smg-gate-consumption` provisionada; + 3 correções obrigatórias de design: proveniência de aprovação, gate PR-only, `grant_ref` determinístico — §8/§13). Status permanece Proposed; `contents: write` e FASE 3A continuam bloqueados.
**Deciders:** PO (Augusto) + OpenCode (Tech Lead)
**G0:** SMG-GATE FASE 3A — desenho do enforcement de Authorization Record para T15 (sem implementação nesta etapa)
**References:**
- `.opencode/SMG_GATE.md` (contrato formal V1.0/r2 — aprovado; fonte de verdade das regras)
- `docs/adr/ADR-027-smg-gate-formal-contract.md` (formalização do contrato; §Relations já prevê este ADR)
- `.opencode/SMG_CHANGE_CONTROL.md` (v1.0.0 — origem histórica, preservada)
- `scripts/smg-pr-approve/guards.mjs` + `guards.test.mjs` + `run.mjs` (consumidor futuro — inalterados nesta FASE)
- `.github/workflows/smg-approve.yml` (ponto de execução do consumidor — inalterado nesta FASE)
- PRE-FLIGHT READ-ONLY da FASE 3 (2026-09-24) — mapeamento de pontos de enforcement, bypasses e dependências
- Decisão PO 2026-09-25 — B1 aprovado (dois stores: `smg-gate-records` emissão + `smg-gate-consumption` consumo); revisão documental autorizada; equivalência formalizada cláusula a cláusula (§13.1)
- `docs/audit/P_02_SMG_APPROVE_TRUST_BOUNDARY.md` — frente P.02 (trust boundary do `smg-approve`); pré-condição obrigatória **antes** de qualquer concessão de `contents: write`
- `docs/adr/ADR-025-smg-pr-approve-bootstrap.md` (bootstrap do mecanismo de aprovação)
- `docs/adr/ADR-026-merge-not-equal-deploy-prod-gate.md` (trilho de deploy — fora do escopo deste ADR)

---

## Context

O contrato SMG-GATE V1.0/r2 (`.opencode/SMG_GATE.md`) foi aprovado pelo PO e o pre-flight read-only da FASE 3 mapeou o estado real do enforcement:

### 1. Problema atual

A autorização de merge hoje existe em duas camadas, nenhuma delas materializando o Authorization Record do contrato:

1. **Prosa de decisão** — a autorização do PO vive em comentários/relatórios (`/approve`, tabelas `AUTORIZADO`), sem `record_id`, sem `front_id`, sem `artifact_ref`, sem revogação e sem consumo único. Viola a cadeia `DECISION → AUTHORIZATION RECORD → TRANSITION` (contrato §1.2/§5.2): a decisão habilita a transição diretamente.
2. **Guard de identidade** — `guards.mjs` valida autor do comentário (`PO_ACCOUNT`), estado do PR, CI verde (com allowlist advisory) e idempotência. Nenhuma dessas checagens é um record.

### 2. Estado atual do SMG-GATE

- Contrato V1.0/r2 aprovado; ADR-027 com emendas da FASE 2.1.
- Enforcement machine **único**: `smg-pr-approve` (workflow `smg-approve.yml` → `run.mjs` → `guards.mjs`) + branch protection `main` (required check `validate`, 1 review, `enforce_admins`, sem force-push/delete).
- Autorizações T06/T07/T10/T12/T18/T20, revogação, expiração e certificação: **somente contrato documental** — nenhum store, nenhum executor (§5.4 e §6 declaram ausência de job/cron/store).
- Skills `smg-commit`/`smg-push`/`smg-merge`/`smg-deploy`: pré-condições de autorização escritas (**soft**, prompt-level).

### 3. Limitações do enforcement atual

| Limitação | Evidência (pre-flight) |
|---|---|
| Sem Authorization Record — decisão não é rastreável por `record_id` | grep `record_id` no repo: apenas domínio financeiro (`commission_records`), nenhum record de governança |
| `guards.mjs` não valida `front_id`, `transition`, `target`, `artifact_ref`, `status` | `guards.mjs` — gates são: comentário, PR, checks, idempotência |
| Aprovação manual na UI por qualquer reviewer satisfaz a branch protection sem passar pelos guards | branch protection exige "1 approving review", não exige a do bot |
| T10/T12 (commit/push) sem enforcement machine | pre-flight, bypass nº 3 |
| Revogação/expiração sem leitor no consumo | contrato §5.4/§6: "não existe executor" |
| Deploy sem gate prévio (T17/T18) | automático pós-merge — pertence ao trilho P-DV/ADR-026 |

---

## Problem

Como materializar o Authorization Record do contrato como fonte de verdade da autorização de merge (T15) — com store file-based, fail-closed, binding ao artefato e consumo único — **sem** alterar comportamento existente desta FASE, **sem** migration/RPC/RLS, **sem** tocar em deploy, CI advisory ou as frentes P-AUTO/P-DV/P-MIG, e **sem** implementar enforcement antes de autorização própria?

---

## Decision

**Desenho adotado (FASE 3A): Authorization Record file-based no repositório, com enforcement machine exclusivamente em T15, consumido pelo ecossistema `smg-pr-approve`.** A implementação desta decisão é bloqueada até autorização explícita do PO (ver §"Não autorizado por este gate").

### 4. Authorization Record como fonte de verdade

Conforme contrato §5.2 e ADR-027 (Risco "duas fontes de verdade"): a partir da FASE 3A, **prosa só referencia `record_id`**; o record é a autorização. "PO aprovou" em relatório/comentário é *decision*, não *authorization* — só habilita T15 quando materializado em record `granted` com `artifact_ref` correspondente.

### 5. Store file-based

| Decisão | Detalhe |
|---|---|
| Formato | **JSON** — parsing nativo em Node, sem dependência nova, máquina-legível (em ambos os stores) |
| **Store de emissão** — `smg-gate-records` | **`docs/records/<record_id>.json`** — o **grant**, imutável após emissão (exceção: estados administrativos do PO, §13). Branch dedicada de governança, anexa e distinta de `main`, com `required_signatures` ON — comprovado no micro-gate de emissão (2026-09-25): escritas não-assinadas são rejeitadas (409), commits Web UI do PO são assinados por web-flow e verificados |
| **Store de consumo** — `smg-gate-consumption` | **`docs/consumption/<record_id>.json`** — o **evento de consumo**, append-only, create-only, emitido pelo consumidor automático. **A provisionar em gate próprio** (dec. PO 2026-09-25: não criada nesta revisão) |
| Granularidade | **Um arquivo por record** (não por frente) em cada store; no store de consumo o caminho é determinístico por `record_id` (bind com o grant) |
| Quantidade | Baixa (1 grant + 1 consumo por transição gated por frente) — sem necessidade de índice |
| Confiança | O consumidor lê **apenas** as branches de governança via API (`?ref=`), **nunca** do checkout do PR — um record no head do PR seria forjável pelo autor do PR (vetor de bypass do pre-flight) |
| Por que branch dedicada e não `main` | `main` exige PR+review para alterar (branch protection com `enforce_admins`); o record de T15 precisa existir **antes** do merge do PR que ele autoriza — armazená-lo em `main` criaria recursão bootstrap (record só chega em `main` mergeando um PR que exige um record). Branch dedicada com push restrito a admins resolve sem tocar na proteção de `main` |
| **Separação de autoridade** | Emissão = modalidade com assinatura verificada (PO via Web UI → web-flow; único caminho comprovado). Consumo = `GITHUB_TOKEN` do workflow, que **não assina** — estruturalmente excluído da emissão (409 provado). **A separação é enforcement de plataforma, não convenção**: o consumidor jamais escreve no store de emissão |
| Escrita | Emissão (grant): PO via Web UI, assinado (push direto). Consumo (evento): workflow `smg-approve` via `GITHUB_TOKEN`, create-only na `smg-gate-consumption`. Ver §8 |

### 6. Estrutura mínima do record

Exatamente os **17 campos** do contrato §5 — nenhuma extensão própria nesta FASE:

```json
{
  "record_id": "ar-20260924-001-merge",
  "front_id": "FR-007-smg-gate-fase3a",
  "transition": "T15",
  "scope_id": "scope-smg-gate-fase3a-enforcement",
  "environment": "n/a",
  "target": "main",
  "artifact_ref": "<PR head SHA>",
  "expires_at": null,
  "status": "granted",
  "authorized_by": "augustosanchesmanager-ux",
  "authorized_at": "2026-09-24T00:00:00-03:00",
  "consumed_at": null,
  "consumed_ref": null,
  "revoked_at": null,
  "revoked_by": null,
  "reason": "<motivo da emissão>",
  "evidence_refs": ["<PR URL>", "<gate report>"]
}
```

Nomenclatura de arquivo = `record_id` (contrato: `ar-<yyyymmdd>-<seq>-<slug>`), única e imutável.

### 7. Emissor / autorizador

- **Único emissor: o PO** (`authorized_by` = `PO_ACCOUNT` = `augustosanchesmanager-ux`). Agente, bot e CI **não** emitem (contrato §5.4: `expires_at` definido só pelo PO; §6: só o PO revoga).
- Emissão = criar o arquivo JSON na branch `smg-gate-records` com `status: granted`.
- A emissão materializa a decisão do PO — a decisão sozinha, sem record, **não** habilita T15 (cadeia §5.2).

### 8. Consumidor

- **`guards.mjs` (puro)** ganharia, em FASE de implementação, uma função pura `validateAuthorizationRecord({ record, prHeadSha, target, now })` — extensão natural de `buildDecision`, mantendo o padrão existente (funções puras testáveis, sem I/O).
- **`run.mjs`** carregaria os grants candidatos do store de emissão (`GET contents/docs/records?ref=smg-gate-records`) e o consumo correspondente do store de consumo, passando ambos a `buildDecision` (derivação do estado lógico, ver §13).
- **`smg-approve.yml`** permaneceria o ponto de execução: mesmo trigger (`/approve` do PO), mesmo token; `contents: write` **somente no job que realiza o consumo**, nunca globalizado no workflow.
- Fluxo futuro (ordem obrigatória): `/approve` → guards existentes → **gate: record T15 válido e único** → **idempotência nível 1** (NOOP + reparo) → aprovação registrada (POST) → **consumo** (create do evento na `smg-gate-consumption`). Aprovar **antes** de consumir: o crash window pós-aprovação é recuperável no rerun (reparo); consumir-antes-aprovar criaria estado irreversível.
- **Propriedade normativa (PO, 2026-09-25): um evento de consumo nunca pode criar, modificar, revogar ou renovar uma autorização.** O consumo é evidência de uso de um grant existente — nunca fonte de autoridade. Por isso o consumidor **não escreve no store de emissão** (barreira física de assinatura + ausência de permissão).
- **Consumo deliberadamente estreito** — o código do consumidor é restrito a: ref obrigatório `smg-gate-consumption`; path obrigatório `docs/consumption/<record_id>.json`; operação permitida **CREATE**; operações proibidas UPDATE/DELETE/path arbitrário/branch arbitrária. Garantido por funções puras (`assertConsumptionTarget(ref, path)`, `assertCreateOnly()`, `assertCrossReferences()`); violação → **STOP fail-closed** — nunca convenção silenciosa no workflow.
- **Proveniência da aprovação (correção PO nº 1)**: aprovação válida para consumo = review com `state == "APPROVED"` **+** `user.login == review-bot-smg` **+** `commit_id == pr_head_sha`. Aprovação humana pré-existente → **não satisfaz**; aprovação do bot em SHA antigo → **STOP**. Isso amarra `artifact_ref == pr_head_sha == review.commit_id` num único ponto de verdade. `approval_ref` no consumption event = **id exato da review** utilizada — nunca a mera existência de "uma aprovação".
- **Gate estrutural PR-only (correção PO nº 2)**: o job `consume` só executa quando `github.event.issue.pull_request` existir no evento (`issue_comment` também aceita Issues); comentário em Issue simples → **STOP** estrutural. Defesa barata que elimina classe desnecessária de comportamento ambíguo.

### 9. Binding do record ao `artifact_ref` / HEAD SHA

- Na emissão: `artifact_ref` = SHA do head do PR no momento da decisão (`pr.head.sha`).
- No consumo: o consumidor compara `artifact_ref` **exato** com o `pr.head.sha` atual.
- **Divergência → fail-closed**: novo commit, rebase, force-push ou retarget no PR após a emissão torna o record não-consumível (contrato §5.3). O consumidor **recusa** (STOP); o record permanece `granted` até o PO decidir `granted→rejected` + emitir novo record. Nenhuma mutação silenciosa.
- `target` = `main` validado em conjunto (o SHA sozinho não basta se o alvo do PR mudou).

### 10. Validação de `front_id`

- Emissão: `front_id` obrigatório, não-vazio, referenciando frente existente (contrato I5).
- Consumo: record com `front_id` ausente/vazio → **STOP fail-closed**.
- Escopo do consumo por PR é garantido primariamente pela unicidade do binding: **exatamente um** record `granted` com `transition=T15` e `artifact_ref` igual ao head SHA. Se **zero ou múltiplos** candidatos → STOP (ambiguidade = falha, nunca escolha heurística).
- Mecanismo adicional de cross-check PR↔front (ex.: via `evidence_refs` contendo a URL do PR) fica para refinamento na implementação — o binding por SHA já fecha o bypass real (record forjado ou de outra frente não casa).

### 11. Validação de `transition`

- O consumidor só aceita `transition == "T15"` (nada de curinga — contrato I7/I8).
- Records de outras transições existindo na branch são **ignorados** por este consumidor (T06/T07/etc. não têm enforcement nesta FASE).

### 12. Validação de `target`

- Exigido: `target == "main"` e `environment == "n/a"` (merge é operação de metadados — contrato I3, FASE 2.1 correção nº 1).
- PR com `base != main` já é barrado hoje por `validatePr` — as duas checagens são complementares e ambas permanecem.

### 13. Status `granted` / `consumed` / `revoked` / `expired` / `rejected` — estado lógico derivado

- **Estados administrativos** (`granted`, `revoked`, `expired`, `rejected`) permanecem **físicos** no grant: transições **somente para frente** (I10), produzidas exclusivamente pelo PO (contrato §5/§6).
- **`consumed` passa a ser estado lógico DERIVADO** (dec. PO 2026-09-25): `grant existe e é administrativamente válido` **+** `evento de consumo existe e cross-refs batem` ⇒ estado lógico `consumed`. Derivação recalculada a cada uso do consumidor, sem cache:

| Grant (store de emissão) | Consumption (store de consumo) | Estado lógico | Ação do consumidor |
|---|---|---|---|
| ausente | — | — | STOP — sem record, sem transição |
| `granted` válido | ausente | `granted` | aprovação habilitada |
| `granted` válido | presente, cross-refs válidos | `consumed` (terminal) | NOOP (idempotência) / auditoria |
| qualquer | presente, cross-refs inválidos | anomalia | STOP fail-closed |
| ausente | presente | anomalia (consumo órfão) | STOP fail-closed |

- O valor físico `status` do grant permanece `granted` após o consumo; `consumed_at`/`consumed_ref` passam a viver fisicamente no **evento de consumo** (materialização event-sourced — nota interpretativa no contrato §5.2.1).
- O consumidor só aceita estado lógico `granted`. Qualquer outro → STOP.
- Mutações administrativas do PO (`revoked`/`expired`/`rejected`) permanecem no grant, assinadas (Web UI), sem campo apagado ou reescrito (append-only de conteúdo — I10).
- **`grant_ref` determinístico (correção PO nº 3)**: significa o **commit que materializou o grant atualmente válido** — não "último commit encontrado para o path". A implementação deve comprovar, para cada grant válido: `record_id` → arquivo existe → `status = granted` → histórico compatível → emissão identificável de forma inequívoca → `grant_ref`. Histórico que impossibilite identificar a emissão de forma inequívoca → **STOP**. `commits?path=` isolado é aproximação insuficiente: a imutabilidade do grant (contrato §5) deve ser **comprovada**, não presumida.

### 13.1 Preservação das invariantes do contrato (demonstração formal)

A separação física (grant imutável + evento de consumo) preserva cada invariante do contrato V1.0/r2:

| Invariante (contrato) | Como o modelo derivado preserva |
|---|---|
| **Terminalidade** (I10; §5 `status`) | `consumed` derivado é terminal: consumo é create-only e append-only (proteção da branch: force/delete OFF), não existe operação que o remova nem transição de volta a `granted`. `revoked/expired/rejected` permanecem físicos e terminais no grant. |
| **Revogação só pré-consumo** (§6) | Revogação continua sendo mutação administrativa assinada do PO no grant. O consumidor lê o status físico **no momento do consumo** (sem cache): `revoked` antes de consumir → STOP; após consumo não há revogação possível (derivação terminal). |
| **Binding ao artefato** (§5.3) | `artifact_ref` físico no grant + réplicas de cross-ref no consumo (`grant_ref` = SHA do commit do grant; `pr_head_sha` = mesmo artefato). Dois pontos de checagem; qualquer divergência → STOP fail-closed. |
| **Um record, um consumo** (§5.2) | Caminho determinístico `docs/consumption/<record_id>.json` + CREATE-only ⇒ no máximo **um** consumo por grant, assegurado por plataforma (422), não por convenção. |
| **Idempotência** (§15) | Nível 1 (NOOP de aprovação + reparo de consumo ausente) e nível 2 (CREATE único) preservados; rerun e concorrência convergem ao mesmo estado. |
| **Fail-closed** (§14) | Sem grant → STOP; consumo ausente + grant válido → aprovável; consumo inválido/órfão → STOP; ambiguidade → STOP. Nenhum caminho degradado. |
| **Append-only (I10)** | Grant nunca é reescrito (exceção: mutações administrativas do PO); consumo é append-only; exclusão física barrada pela proteção. I10 fica **mais forte** que no modelo de mutação in-place. |

Conclusão: a mudança é de **materialização** (física: um arquivo mutado → dois arquivos), não de **semântica** (todas as regras observáveis do contrato preservadas). Registrada nota interpretativa no contrato (§5.2.1); ADR permanece `Proposed`.

### 14. Fail-closed

O consumidor bloqueia (`STOP`, exit 1, sem POST de aprovação) quando **qualquer** condição falha:

| # | Condição | Fundamento |
|---|---|---|
| 1 | Nenhum record candidato para o SHA | §5.2 "Sem record, sem transição" |
| 2 | Múltiplos records candidatos para o SHA | I7 (uma transição exata), ambiguidade = STOP |
| 3 | Estado lógico ≠ `granted` (grant ausente/terminal, ou consumo inválido) | §5/§6 (terminais, sem reuso) |
| 4 | `artifact_ref != pr.head.sha` | §5.3 |
| 5 | `target != main` ou `environment != n/a` | I3/I9 |
| 6 | `transition != T15` | I7/I8 |
| 7 | `front_id` ausente/vazio | I5 |
| 8 | `now > expires_at` (quando presente) | §5.4 (consumo vencido = STOP) |
| 9 | Store inacessível (API falha, branch ausente, JSON inválido) — qualquer um dos dois stores | fail-closed por padrão |
| 10 | Demais gates atuais (PO_ACCOUNT, PR state, checks) | `guards.mjs` existente — preservados |
| 11 | Evento de consumo presente com cross-refs inválidos (`record_id`, `grant_ref`, `pr_head_sha`, `target`) | anomalia = fail-closed (nunca re-consumir, nunca sobrescrever) |
| 12 | Evento de consumo órfão (presente sem grant correspondente) | anomalia = fail-closed (investigar antes de qualquer avanço) |
| 13 | Branch de consumo ausente / inacessível | fail-closed por padrão (sem consumo registrado, transição não pode ser consumida) |

Nenhum caminho degradado ("aprovar sem record", "aprovar com record inválido") é permitido.

### 15. Idempotência

- **Dois níveis, independentes, agora distribuídos em dois stores:**
  1. **Aprovação já registrada** → NOOP preservado (`hasExistingApproval`, exit 0 sem POST) — sem reconsumo nem falha por estado lógico `consumed`.
  2. **Consumo único do record** → um grant comporta exatamente **um** consumo (`consumed` terminal). Garantido por construção: caminho determinístico `docs/consumption/<record_id>.json` + **CREATE-only** → exigência de criação única por `record_id`.
- **`422` (arquivo já existe) ≠ "já consumido, tudo certo".** Ao receber 422, o consumidor **faz re-read** do evento de consumo existente e valida os **cross-refs completos** (`record_id`, `grant_ref`, `pr_head_sha`, `target`) contra o grant: batem → NOOP (consumo prévio legítimo); **divergem → STOP** (anomalia — nunca considerar consumido por palpite).
- **Concorrência (duas execuções simultâneas do workflow)**: escritas na branch de consumo precisam serializar — o workflow futuro usa `concurrency` group por PR (barreira 1) + o efeito create-only do 422 (barreira 2, plataforma). Ambos independentes; o perdedor cai no caminho 422 → re-read → validação → NOOP/STOP.
- Ordem no `buildDecision` futuro: gates atuais → idempotência nível 1 (NOOP) → gate de record → aprovação (POST) → consumo (CREATE na `smg-gate-consumption`).

### 16. Revogação

- Somente **pré-consumo**, somente pelo PO: editar o arquivo na branch de records (`status: revoked`, `revoked_at`, `revoked_by`, `reason`) — contrato §6.
- O consumidor lê o status **no momento do consumo**: record revogado → STOP imediato (não há cache de "record aprovado ontem").
- Pós-consumo **não existe revogação** — problema posterior é *reassessment event* (§6), tratado por processo, não por este consumidor.
- `revoked` é terminal; reuso = novo record (I10).

### 17. Expiração

- `expires_at` opcional, definido somente pelo PO na emissão (§5.4).
- Sem executor/cron: validade é **semântica** — o consumidor calcula `now > expires_at` no consumo. Vencido → STOP (fail-closed) e o PO documenta a constatação preenchendo `status: expired`.
- `expired` terminal; nenhum reuso.

### 18. Consumo terminal

- `granted→consumed` com preenchimento de `consumed_at` e `consumed_ref` (id do review aprovado ou SHA do head) é a **única** mutação de consumo.
- `consumed` não transiciona para nenhum estado — inclusive não para `revoked` (correção nº 2 da FASE 2.1).

### 19. Proteção contra reutilização

| Vetor | Barreira |
|---|---|
| Reusar record já consumido | estado lógico `consumed` (consumo existe com cross-refs válidos) → STOP para novo consumo; NOOP apenas na mesma aprovação |
| Reusar record de outra frente/PR | binding por SHA exato; ambiguidade → STOP |
| Reusar record revogado/expirado/rejeitado | status físico terminal ≠ `granted` → STOP |
| Fabricar record no próprio PR | consumidor lê só as branches de governança via API (`?ref=`); emissão exige assinatura verificada (409 provado), restrita ao PO — push restrito a admins |
| **Forjar consumo sem grant** (consumo órfão) | consumo sem grant correspondente → anomalia → STOP (§14 cond. 12) |
| **Consumo cross-record** (consumo de um record anexado a outro) | caminho determinístico por `record_id` + cross-ref `grant_ref`/`pr_head_sha` validados contra o grant → casamento entre stores exigido; divergência → STOP |
| **Forjar consumo com grant alheio** | consumo com `grant_ref`/cross-refs de outro grant → STOP (§14 cond. 11) |
| Replay (duplicar consumo) | CREATE-only → 422 → re-read → NOOP legítimo; novo conteúdo sem atualização → STOP |
| Alterar record consumido retroativamente | imutabilidade por convenção + assinatura obrigatória na emissão; histórico em `evidence_refs`/relatório de gate |

### 20. Integração futura com `smg-pr-approve`

- **Ponto de integração**: `guards.mjs` (validação pura) + `run.mjs` (I/O dos records) — exatamente como ADR-027 §Relations e ADR-027 linha 109 já prevêem: "seus guards passarão a exigir um authorization record válido (`transition=T15`, `front_id` do PR)".
- `smg-approve.yml`: mesma estrutura; ajustes mínimos futuros = permissão de leitura do store de emissão (`contents: read` em `smg-gate-records`) + **escrita restrita ao store de consumo** (`contents: write` em `smg-gate-consumption`, preferencialmente apenas no job que realiza o consumo) + `concurrency` group por PR — **alteração de workflow, exige autorização própria**. O token nunca obtém escrita no store de emissão (barreira estrutural além da assinatura).
- Branch protection de `main` permanece como piso (independente e cumulativa — revogação não desliga enforcement, §6).
- Separação de poderes preservada (`guards.mjs` header): o bot **executa**, nunca decide; o record é a materialização da decisão do PO.

---

## Escopo da FASE 3A

### 21. Limites da FASE 3A

1. **Um único enforcement machine novo**: consumo de record em **T15** (merge), no caminho `/approve`.
2. **Stores file-based** no repositório: `smg-gate-records` (emissão — provisionada 2026-09-24, `required_signatures` ON) e `smg-gate-consumption` (consumo — desenhada, a provisionar em gate próprio), sem banco.
3. **T10/T12 permanecem soft** (skills inalteradas).
4. **T18/T20 permanecem no trilho P-DV/ADR-026.**
5. Nenhuma migration, RPC, RLS, alteração de deploy, alteração de CI/CD.
6. CI advisory permanece advisory (PO vetou migração prematura — `FASE_6_CLOSING_BACKLOG.md`).
7. Emissão de record é **manual pelo PO** — sem UI, sem automação, sem bot emissor.
8. ADR-028 (este) formaliza o desenho **antes** de qualquer implementação.

### 22. Exclusões explícitas

| Excluído | Motivo |
|---|---|
| `T10` (commit) | Soft nesta fase (decisão de escopo do PO) |
| `T12` (push) | Soft nesta fase (decisão de escopo do PO) |
| `T18` (deploy) | Trilho P-DV / ADR-026 |
| `T20` (certificação) | Trilho P-DV / FASE futura |
| Deploy gate (pré-deploy) | P-DV — `merge ≠ deploy` |
| Frente P-DV | Frente separada, não tocada |
| Supabase | Store é file-based |
| RLS | Nenhum dado de banco |
| RPC | Nenhum acesso a banco |
| CI advisory (`lint advisory`, `e2e smoke advisory`) | Permanece advisory; fora do gate de record |

---

## Alternatives Considered

| Opção | Descrição | Veredito |
|---|---|---|
| **A — Records em `main`** | Arquivos versionados em `main`, lidos via API | ❌ Recursão bootstrap: record precisa existir antes do merge, mas chega em `main` mergeando um PR que exige record. Exigiria exceção à proteção de `main`. |
| **B — Records no head do PR** | Arquivo lido do próprio checkout do PR | ❌ Forjável pelo autor do PR — binding vira teatro de segurança (bypass do pre-flight nº 5 agravado). |
| **C — Store Supabase (tabela)** | Table `authorization_records` + leitura via client | ❌ Exige migration/RLS/RPC — exclusão explícita da FASE 3A. Além disso record é governança de repo, não dado de tenant. |
| **D — Branch dedicada `smg-gate-records`** | JSON por record em branch anexa, push restrito a admins, leitura via API | ✅ **Adotado.** Sem recursão, sem tocar em `main`, sem banco, consumidor confiável. |
| **E — Enforcement em tudo de uma vez (T10/T12/T15/T18)** | Guard completo de uma vez | ❌ Fora do escopo aprovado (FASE 3A = T15 primeiro); aumenta superfície de risco sem ganho imediato. |

---

## Consequences

### O que muda (somente após autorização de implementação)

1. Novo store: branch `smg-gate-records` + `docs/records/*.json`.
2. `guards.mjs`: função `validateAuthorizationRecord` + gate em `buildDecision` (+ `guards.test.mjs`).
3. `run.mjs`: leitura dos records via API + escrita do consumo.
4. `smg-approve.yml`: permissões mínimas para ler/escrever a branch de records.
5. Regras de branch da `smg-gate-records` (push restrito a admins) — configuração GitHub, decidida pelo PO.
6. ADR-028 passa de Proposed → Accepted quando a implementação for autorizada.

### O que NÃO muda nesta FASE (design)

- Nenhum arquivo de código alterado por esta tarefa (somente este ADR criado).
- Nenhum comportamento existente alterado.

---

## Test Strategy (futura — 23)

Não executável nesta FASE; especificada aqui para a autorização futura:

1. **Unitário (puro)** — `guards.test.mjs`:
   - record ausente → STOP; múltiplos candidatos → STOP;
   - `artifact_ref` divergente → STOP; `status` terminal ≠ `granted` → STOP;
   - `target`/`environment` errados → STOP; `transition != T15` → STOP;
   - `front_id` vazio → STOP; `expires_at` vencido → STOP;
   - record válido único → aprovação habilitada.
2. **Idempotência** — já aprovado → NOOP sem tocar no record; consumo marca `consumed` uma única vez.
3. **Estrutura** — JSON do record com exatamente os 17 campos; campos extras → STOP (validação de schema estrita).
4. **Estratégia de equivalência** — teste contrato×guards (padrão do D8: `equivalence.test.ts`): cada condição fail-closed da §14 tem caso de teste correspondente.
5. **Integração manual** — PR sandbox: `/approve` sem record bloqueia; com record consome; novo commit após emissão bloqueia.
6. **Regressão** — `npm run test`, `npm run typecheck`, `npm run build` verdes; fluxo atual (sem record) documentadamente transiciona apenas com autorização.

---

## Risks (24)

| Risco | Mitigação |
|---|---|
| Bloquear merge legítimo se consumo existir sem fluxo de emissão | Regra de ouro: **nunca ativar o gate antes de o fluxo de emissão estar operante**; ativação por flag/env no workflow para rollback barato |
| Token do workflow sem permissão na branch de records | Decisão explícita do PO na implementação (escopo mínimo: contents naquela branch) |
| Branch `smg-gate-records` sem proteção → push forjado | Regra de branch protection na implementação (push = admins apenas); listada como decisão PO |
| Emissão manual: PO vira gargalo / record esquecido antes do `/approve` | Operação inicial assistida; métrica informal de atrito; refinamento futuro (emissão semi-automática) exige novo gate |
| Drift contrato×guards | Teste de equivalência (§Test Strategy 4) |
| Dois records para o mesmo SHA (duplicidade) | Ambiguidade → STOP; disciplina de `record_id` sequencial único |
| Confiar em prosa antiga durante a transição | Regra ADR-027: prosa só referencia `record_id`; gate report de transição cita o record |

---

## Rollback (25)

1. **Desativação operacional**: gate ligado por flag (env var no workflow, ex.: `SMG_GATE_RECORD_REQUIRED=true`) → desligar a flag restaura o comportamento **exato** de hoje (guards de identidade + CI + idempotência), sem deploy de código.
2. **Rollback de código**: revert do commit que altera `guards.mjs`/`run.mjs`/`smg-approve.yml` — mudanças isoladas e pequenas; branch protection de `main` e demais gates nunca são tocados, então o piso de segurança (CI verde + 1 review + `enforce_admins`) permanece em qualquer cenário de rollback.
3. **Rollback de dados**: records em branch dedicada são **inertes** sem o consumidor — nenhuma limpeza urgente; arquivos podem permanecer ou ser arquivados por decisão do PO (nada é apagado automaticamente — I10).
4. **Rollback de configuração**: regra da branch de records removida pelo PO se necessário.

Nunca: desligar branch protection de `main`, remover gates de CI ou reduzir review count como forma de "rollback" (violaria ADR-025/6.1.4 — proibições explícitas).

---

## Migration Strategy — store file-based → substituição futura (26)

Caso o modelo file-based venha a ser substituído (ex.: tabela Supabase), a migração segue sem mudança de semântica:

1. **Novo ADR próprio** — substituição de store é mudança arquitetural (regra do AGENTS.md); este ADR passaria a `Superseded`.
2. **Schema 1:1** — os 17 campos do contrato são colunas diretas; `record_id` é PK natural (imutável, já formatado).
3. **Import**: exportar todos os `docs/records/*.json` → INSERT com `ON CONFLICT (record_id) DO NOTHING` (idempotente, sem reuso de consumo).
4. **Dual-read sombra**: consumidor lê novo store e valida contra o file-based em modo não-bloqueante até paridade total.
5. **Corte**: consumidor passa a ler o novo store (fail-closed mantido); file-based vira snapshot de auditoria (não deletado).
6. **Semântica imutável**: transições status, terminais, revogação/expiração/consumo — **nenhuma regra do contrato muda**; só a localização da fonte de verdade.
7. Se e quando banco: record é **governança de repo, não dado de tenant** — decisão de escopo RLS explícita exigirá atenção própria (não herda isolamento multi-tenant automaticamente).

---

## Relations

- **ADR-027**: este ADR materializa exatamente o que ele deixou para "FASE futura" (linha 109: guards passando a exigir record em T15; §Migration Strategy item 3). Contrato V1.0 permanece a fonte das regras; este ADR decide **como** T15 as cumpre.
- **`smg-gate` contrato (`.opencode/SMG_GATE.md`)**: preservado integralmente — este ADR não cria requisito além dos §5/§5.2/§5.3/§5.4/§6 e I3/I5/I7/I8/I9/I10.
- **ADR-025 (`smg-pr-approve`)**: mecanismo bootstrap preservado; este ADR estende os guards, não substitui a exceção de governança.
- **ADR-026 + P-DV**: T18/T20 e deploy gate **intocados** — fusão de trilhos explicitamente proibida (invariante `merge ≠ deploy`).
- **Skills `smg-*`**: inalteradas; T10/T12 soft; nenhuma skill ganha exigência de record nesta FASE.

---

## Decisões pendentes do PO (antes da implementação)

1. **Autorizar a implementação da FASE 3A** (desbloqueio do status "BLOQUEADA").
2. ~~Criar a branch **`smg-gate-records`**~~ — **feito** (2026-09-24, protegida: force/delete OFF, `enforce_admins`, `required_signatures` ON; micro-gate de emissão fechado 2026-09-25).
3. **Criar a branch `smg-gate-consumption`** — pendente, gate próprio (pre-flight READ-ONLY → decisão de provisionamento → criação). Decidido pelo PO 2026-09-25: B1 aprovado como arquitetura; branch **não criada** nesta revisão.
4. Escopo mínimo de permissão do token do workflow (`smg-approve.yml`): leitura do store de emissão + escrita **restrita ao store de consumo** (idealmente só no job de consumo) — aprovação do PO (secrets/config são responsabilidade do PO).
5. Confirmação do formato/`environment: n/a` + `target: main` como validação obrigatória no consumo (espelha contrato §5.1).
6. Modo de ativação: flag `SMG_GATE_RECORD_REQUIRED` (recomendado, rollback em 1 clique) vs ativação direta.

---

## Não autorizado por este gate

- ❌ Implementação do enforcement (`guards.mjs`, `run.mjs`, `smg-approve.yml`)
- ❌ Criação da branch **`smg-gate-consumption`** ou de qualquer record/evento real (gate próprio pendente — ver "Decisões pendentes", item 3)
- ❌ Qualquer escrita de consumo, mesmo em branch de teste
- ❌ Alteração de skills, CI (`ci.yml`), branch protection ou secrets
- ❌ Migration, RLS, RPC, qualquer toque em Supabase
- ❌ Store funcional (arquivos de código do consumidor)
- ❌ Alteração de deploy ou qualquer item do trilho P-DV
- ❌ Commit, push, PR, merge, deploy (esta revisão é documental; commit/push exigem autorização própria, conforme contrato §4 gatilhos 9–10)
- ❌ Alteração das frentes P-AUTO, P-DV, P-MIG
- ❌ Enforcement de T10, T12, T18 ou T20
