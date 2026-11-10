# ADR-029: `smg-repair` — Coordenador Documental de Achados (Tier 0, design apenas)

**Status:** Proposed (rascunho — nenhuma implementação, skill ou store autorizados por este ADR)
**Date:** 2026-10-01
**Deciders:** PO (Augusto) + OpenCode
**G0:** GOV-REPAIR-FOUNDATION (certificada 2026-10-01) → frente `ADR → smg-repair DESIGN READ-ONLY` (autorizada pelo PO 2026-10-01)
**References:**
- `docs/adr/ADR-027-smg-gate-formal-contract.md` (contrato SMG-GATE V1.0/r2)
- `docs/adr/ADR-028-smg-gate-t15-authorization-record-enforcement.md` (Authorization Store, FASE 3A — dependência futura/separada)
- `.opencode/SMG_GATE.md` (estado canônico do contrato; não alterado por este ADR)
- `docs/audit/CI_FINDING_01_02_LINT_ARCHITECTURE_GATES_20260928.md` (caso de teste de achado sem rota de correção)
- Design `ADR → smg-repair DESIGN READ-ONLY` (sessão 2026-10-01, 15 perguntas respondidas; persistência autorizada por este rascunho)

---

## Context

### 1. Problema

Achados de auditoria (`smg-audit`, CI, gate reports, evidências) têm **detecção**, mas não têm **dono, ciclo de vida nem rota de correção**. Evidências:

- O `SMG-GATE` mapeia 20 transições (`T01..T20`) e 13 gatilhos STOP canônicos — nenhum deles cobre "registrar/encaminhar um achado". O `smg-stop-gate` força `STOP`, mas depois do STOP nada obriga a abrir a frente de reparo: o STOP é terminal por design; o reparo é ad hoc.
- `CI_FINDING_01_02_LINT_ARCHITECTURE_GATES_20260928.md` documenta achados reais sem mecanismo que os obrigue a fechar.
- A cadeia formal do contrato (`SMG_GATE §1.2`) começa em `EVIDENCE (fato observável — nunca autoriza)` — e **para aí**: não há passo que transforme *evidence* em frente de reparo.

### 2. Estado atual da governança (o que JÁ resolve)

- **Autorização** tem contrato: `SMG_GATE §5` — Authorization Record com 17 campos, cadeia `DECISION → AUTHORIZATION RECORD → TRANSITION`, invariantes I1–I10.
- **Materialização** da autorização tem design próprio: `ADR-028` — Authorization Store file-based (FASE 3A), com gates pendentes e frente própria.
- **Enforçamento** tem dono único: `smg-stop-gate` (`SMG_GATE §4.1`: "permanece o enforcer único destas condições").
- **Execução** tem dono: `smg-implement` · **evidência**: `smg-evidence` · **validação**: `smg-validate` · **docs**: `smg-documentation`.

### 3. O que falta (o gap real)

**Encaminhamento documental**: um passo que, dado um achado, produza um contrato de reparo (o que reparar, escopo, alvo, critério de validação) e o roteie para a frente/execução existente — sem criar máquina nova.

---

## Problem

Como garantir que todo achado de auditoria tenha dono, contrato de reparo e rota até o fechamento — **sem** criar uma segunda state machine, sem novos gatilhos STOP, sem novo Authorization Store, sem novo mecanismo de autorização, e sem implementar código antes de se provar que a solução documental (Tier 0) não basta?

---

## Decision

### 4. `smg-repair` = coordenador documental — nunca executor, nunca autorizador

**Tier 0 (conclusão preservada do design):** `smg-repair` é, nesta etapa, apenas a **ideia/decisão de desenho** registrada neste ADR. Quando e se implementado (etapa futura, com nova autorização do PO), será uma skill documental com quatro deveres:

1. **Triagem** — receber finding (`smg-audit`, CI, docs, evidências) e classificar risco (`blocker` / `front-blocking` / `documental`).
2. **Contrato de reparo** — emitir um artefato (`Repair Contract`) **na forma do Authorization Record do `SMG_GATE §5`**, declarando: o que reparar, escopo, alvo e critério de validação exigido.
3. **Encaminhar** — rotear o finding para a frente/execução existente (`ISOLATE → IMPLEMENT → VALIDATE`), **nunca executar**.
4. **Rastrear estado** — manter o registro do finding até fechamento ou `accepted-risk` (decisão do PO).

**Restrições inegociáveis do papel:**

- **Nunca executa** — edição de arquivo pertence a `smg-implement`.
- **Nunca autoriza** — pela cadeia `SMG_GATE §1.2`, quem emite o Authorization Record é o PO (`authorized_by`); `smg-repair` produz *evidence* e *proposal*, jamais habilita transição (I1, I8).
- **Nunca enforça** — `smg-stop-gate` permanece o enforcer único (§4.1).

### 5. Fronteiras com as skills existentes (registro explícito)

| Skill | Relação com `smg-repair` | Fronteira exata |
|---|---|---|
| `smg-change-control` | Máster — `smg-repair` é um *caminho dentro* da state machine (INTAKE→AUDIT→CLASSIFY→STOP de um achado), não máquina paralela | Não altera fases, não pula STOP/GATE |
| `smg-isolate` | O Repair Contract serve de checkpoint **antes** do isolamento (gatilho 5: "checkpoint ausente antes de isolamento" = STOP) | `smg-repair` emite contrato; `smg-isolate` consome |
| `smg-implement` | Executor dentro do escopo declarado no Repair Contract | `smg-repair` nunca edita arquivo |
| `smg-validate` | O contrato declara o critério de validação — gatilho 6: "Gate de validação ausente, red, stale ou inconclusivo" = STOP | `smg-repair` declara; `smg-validate` executa e reporta |
| `smg-documentation` | Achados documentais são reparados *por* esta skill; `smg-repair` só encaminha | Atualização de docs é dever do executor doc |
| `smg-commit` | Pre-condições inalteradas — gatilho 7: commit antes de isolamento/validação = STOP; o Repair Contract satisfaz o "checkpoint" exigido | Não cria novo pré-requisito além do existente |
| `smg-stop-gate` | Enforcer único — `smg-repair` propõe, `smg-stop-gate` bloqueia | Nenhuma condição STOP nova |

### 6. Sem nova state machine, sem novos STOPs, sem novo store

- **State machine:** nenhuma. Os estados/da fase de achado (`open|contracted|repaired|closed|accepted-risk`) são **atributos de registro documental**, não estados da máquina formal do `SMG_GATE`.
- **Gatilhos STOP:** nenhum novo. Os 13 gatilhos canônicos (`SMG_GATE §4.1`) permanecem os únicos; o `smg-stop-gate` permanece inalterado.
- **Authorization Store:** **nenhum novo nesta etapa**. O Repair Contract é um documento; se um dia precisar de materialização como record, o store é o do `ADR-028` (ver §7).
- **Novo mecanismo de autorização:** proibido. Qualquer proposta de `smg-repair` com estado próprio de autorização, vocabulário STOP próprio ou store próprio de records é **concorrência de governança** e deve ser rejeitada (fundamento: `ADR-027:60` — "duas máquinas" já foi rejeitado pelo PO).

### 7. Authorization Store como dependência futura/separada

O `Authorization Store` (store de emissão `docs/records/` na branch `smg-gate-records` + store de consumo `docs/consumption/` na branch `smg-gate-consumption`) **não pertence ao `smg-repair`**:

- Já está desenhado no `ADR-028` (FASE 3A) com gates pendentes próprios (decisões PO nº 1–6 daquele ADR).
- É **pré-requisito opcional futuro**: apenas se e quando o Repair Contract precisar ser materializado como Authorization Record verificável (Tier 2).
- Este ADR **não cria, não provisiona e não descreve operação** de nenhum store; não altera o `ADR-028`.

### 8. Relação de necessidade (veredito)

O gap finding→reparo é **real e evidenciado** (§1), mas a maior parte da solução já existe no desenho atual (§2). O que falta é encaminhamento documental, não uma máquina nova. Portanto:

> **Necessário como documentação/coordenação. Não necessária nenhuma implementação de código de `smg-repair` hoje.**

---

## Tier 0 — Escopo mínimo decidido (nenhuma execução autorizada ainda)

O desenho autorizado pelo PO como próxima etapa **somente quando houver nova decisão**:

1. Skill `.opencode/skills/smg-repair/SKILL.md`: triagem → classe de risco → Repair Contract (YAML nos 17 campos do `SMG_GATE §5`) → encaminhamento.
2. Templates `Finding Contract` + `Repair Contract` (formato análogo ao exemplo `§5.1` do contrato).
3. Registro de achados abertos em `docs/audit/` (índice manual).
4. Harmonização de vocabulário (GAP DR-C01): usar exclusivamente o vocabulário do `SMG_GATE` ("finding", "record", "front", "transition") — nunca "correction/repair" como termos técnicos paralelos.

**Fora do Tier 0:** qualquer código, flag, workflow, store, alteração de guards, alteração de `SMG_GATE.md`.

---

## Tier Advancement Criteria (critérios de avanço — fixados agora)

| Tier | Conteúdo | Pré-condição para abrir |
|---|---|---|
| **Tier 0** | Documental (skill + templates + índice) | Decisão explícita do PO de implementar (hoje: **não** decidida) |
| **Tier 1** | Emenda de contrato (`SMG_GATE`: convenção "finding → Repair Contract" + ADR próprio) | Tier 0 em operação **e** evidência de que o encaminhamento documental não bastou |
| **Tier 2** | Código: validação de Repair Contract nos guards / checker de consistência | FASE 3A do `ADR-028` implementada **e** aprovada pelo PO; store de consumo provisionado |

**Regra de corte:** se o Tier 0 não fechar o problema, o problema era outro — **não subir de tier automaticamente**; novo diagnóstico, novo STOP, nova decisão do PO.

---

## Risks (riscos)

| # | Risco | Mitigação |
|---|---|---|
| R1 | `smg-repair` virar segundo mecanismo de governança (estado/STOP/store próprios) | §6 deste ADR — qualquer sinal disso = rejeição obrigatória |
| R2 | Vocabulário paralelo ao `SMG_GATE` (DR-C01) | §8 Tier 0 item 4 — harmonização antes de qualquer rascunho de skill |
| R3 | Terceiro store de findings fragmentando o estado | Registro documental em `docs/audit/` primeiro; store só via `ADR-028` |
| R4 | Auto-autorização (`smg-repair` emitindo record) | §4 — produz proposta, emite record só o PO; fail-closed `§5.2`: "Sem record, sem transição" |
| R5 | Aprovação manual em UI bypass dos guards | Limitação conhecida do `ADR-028 §3` — **aberta**, tratada pela FASE 3A, não por este ADR |
| R6 | Achado fechado sem evidência de `smg-validate` | Fechamento exige evidência (I1); registro `closed` só com ponteiro de evidence |
| R7 | Drift entre este ADR e a futura skill | Este ADR é a fonte; skill (se criada) referencia linha a linha |

## Rollback

Tier 0 (se algum dia implementado) é 100% documental: rollback = remover o registro da lista required (`.opencode/AGENTS.md`, se autorizado) e os templates — reversível sem estado persistido fora de `docs/`. Este ADR pode passar a `Rejected`/`Superseded` por decisão do PO sem efeito colateral, pois **não altera nenhum mecanismo existente**.

## GAPs herdados (registrados, não resolvidos por este ADR)

1. `.agents/skills/` com 15 skills vs `.opencode/` com 16 — decisão PO deferida (qual é o canônico).
2. Tag local `archive/smg-gate-fase2-20261001` — push não autorizado.
3. D4: `.opencode/` untracked — versionamento do bundle de governança pendente.
4. DR-C01: vocabulário `findings/corrections/repairs` vs `SMG_GATE` — harmonização pendente.
5. `docs/adr/README.md` — índice não atualizado com este ADR (fora do escopo autorizado desta etapa).

## Relations

- **ADR-027:** formaliza o contrato; este ADR **não o altera** — só ocupa um vazio (achado→reparo) que ele não cobria.
- **ADR-028:** Authorization Store permanece frente separada; este ADR o declara dependência futura opcional (Tier 2).
- **`SMG_GATE.md`:** inalterado. Este ADR consome §1.2, §4.1, §5 como estão.
- **Skills `smg-*`:** nenhuma alterada. Fronteiras em §5.
- **`smg-gate` FASE 3A:** não bloqueada nem desbloqueada por este ADR.

## Decisões pendentes do PO (antes de qualquer implementação)

1. **Autorizar ou não a implementação do Tier 0** (criação da skill + templates + índice) — hoje **não** autorizada.
2. Direcionar a harmonização DR-C01 (quem edita quais documentos).
3. Definir quem mantém o índice de achados abertos (`docs/audit/`).

## Não autorizado por este ADR

- ❌ Criar a skill `smg-repair` (Tier 0 permanece desenho)
- ❌ Alterar `.opencode/AGENTS.md`, `SMG_GATE.md`, `ADR-028`, `guards`, workflows, código
- ❌ Criar qualquer store, template operacional ou migration
- ❌ Executar `smg-implement`
- ❌ Commit, push, merge, deploy
- ❌ Alterar `.claude/` ou `.agent/`
