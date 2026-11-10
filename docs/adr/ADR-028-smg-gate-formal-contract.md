# ADR-027: Contrato Formal `smg-gate` — Formalização da Governança Existente

**Status:** Proposed (FASE 2 aceita pelo PO quanto à direção; contrato V1.0 aguardando aprovação após correções da FASE 2.1)
**Date:** 2026-09-24 (emendado na FASE 2.1, 2026-09-24)
**Deciders:** PO (Augusto) + OpenCode (Tech Lead)
**G0:** SMG-GATE FASE 2 (formalização e desenho — sem enforcement) + FASE 2.1 (correções documentais/modelares — sem enforcement)
**References:**
- `.opencode/SMG_CHANGE_CONTROL.md` (v1.0.0 — origem histórica do protocolo)
- `.opencode/SMG_GATE.md` (contrato formal v1.0 proposto por este ADR)
- `.opencode/skills/smg-stop-gate/SKILL.md` (enforcer de STOP)
- `docs/audit/6.1.4_SMG_PR_APPROVE_AUTOMATION.md` + `docs/adr/ADR-025-smg-pr-approve-bootstrap.md` (autorização machine-enforced)
- `docs/adr/ADR-022-ci-policy-quality-gates.md`, `ADR-024-ci-workflow-regularization.md` (política de gates de CI)
- `docs/PLATFORM_CERTIFICATION.md` (certificação histórica de plataforma)
- `docs/audit/R5_DECISION_CI_GOVERNANCE.md` (descoberta dos gaps de governança de CI)
- GOVERNANCE DISCOVERY REPORT — FASE 1 (2026-09-24, read-only)

---

## Context

A SMG opera uma governança de mudança madura desde a instalação do bundle SMG Change Control Protocol: state machine v1.0.0 em `.opencode/SMG_CHANGE_CONTROL.md`, 16 skills `smg-*` com invariantes comuns, gate reports com tabelas de decisão do PO (`D-DEP-n`), disciplina EVIDENCE/INTERPRETATION/GAP/DECISION, e um único enforcement machine (workflow `smg-pr-approve`).

A FASE 1 (descoberta read-only) confirmou que **não deve existir uma segunda state machine paralela**, mas identificou lacunas estruturais:

1. **Autorização é prosa inline** — as tabelas de decisão nos relatórios de gate são booleanos de fato (`AUTORIZADO`), sem `front_id`, `transition`, `scope_id`, `environment` ou revogação. Viola a regra de que booleano global não é fonte de verdade.
2. **Estado não é persistido** — a posição de uma frente vive no texto dos relatórios; não há store de estado nem de records.
3. **Certificação é única e herda por checklist** — `PLATFORM_CERTIFICATION.md` é um documento de plataforma; não existe certificação por frente com no-inheritance.
4. **Estados ausentes** — a máquina v1.0.0 não tem `BLOCKED`, `CANCELLED`, `DEPLOY_REVIEW`; `POST-MERGE` existe como passo mas não como estado formal. Não há gate dedicado que materialize "merge ≠ deploy".
5. **Autorizações não são distinguíveis por ambiente** — nada formal impede uma autorização de staging valer para produção.

---

## Problem

Como formalizar autorização, estados, certificação e revogação com rigor escopado — sem criar uma governança paralela, sem enfraquecer a governança existente (smg-stop-gate, smg-pr-approve, D8) e sem alterar comportamento funcional?

---

## Decision

**Opção C (adotada): formalizar o mecanismo existente.** Evoluir `SMG_CHANGE_CONTROL.md` v1.0.0 para o contrato formal `smg-gate` v1.0 (`.opencode/SMG_GATE.md`), mantendo o documento histórico intacto como origem.

O contrato define:

- **20 estados** documentados com significado, entrada, saída, evidências, autorização, ambiente, próximos estados e comportamento de bloqueio/cancelamento — incluindo os novos `BLOCKED`, `CANCELLED`, `DEPLOY_REVIEW` e a formalização de `POST_MERGE`.
- **Tabela fechada de transições** (T01–T20 + TX1–TX5) com origem, destino, `scope_id`, `environment`, evidências obrigatórias, autorização obrigatória, condições STOP, bloqueio e cancelamento.
- **Authorization Record** como único formato de autorização: campos `record_id, front_id, transition, scope_id, environment, status, authorized_by, authorized_at, consumed_*, revoked_*, reason, evidence_refs`; status com transições apenas para frente (`granted→consumed|revoked|expired|rejected`); consumo único; fail-closed sem record.
- **Invariantes I1–I10**: evidence≠authorization; authorization≠certification; merge≠deploy; staging≠prod; sem herança de autorização nem certificação entre frentes; sem herança entre transições; sem booleano global; escopo obrigatório; histórico append-only com revogação explícita.
- **Certificação por frente** com `supersedes: null` obrigatório — `certification(front A) != certification(front B)`.
- **Relação explícita** evidence → decision → authorization → certification.

**O que permanece intocado:** `smg-stop-gate` como enforcer de STOP; `smg-pr-approve` como integração machine-enforced; as 16 skills; `SMG_CHANGE_CONTROL.md` como registro histórico; D8, RLS/RPC e domínio financeiro.

---

## Alternatives Considered

| Opção | Descrição | Veredito |
|-------|-----------|----------|
| **A — Sistema paralelo novo** | Criar `smg-gate` como state machine/store independente ao lado do protocolo atual | ❌ Duas máquinas concorrentes, dois vocabulários (`STOP/GATE` vs `STOP`), duas fontes de verdade de autorização. Viola a direção da FASE 1 e a regra "não criar governança paralela". |
| **B — Status quo (prosa)** | Manter autorização inline nos relatórios; documentar apenas boas intenções | ❌ Não fecha as 5 lacunas; booleanos de fato continuam sem escopo, sem revogação, sem certificação por frente. |
| **C — Formalizar o existente** | Contrato formal sobre a máquina v1.0.0, preservando origem e enforcement | ✅ **Adotado.** Fecha as lacunas sem duplicar nem enfraquecer. |
| **D — Store persistente desde já** | Implementar tabela/serviço de records na FASE 2 | ❌ Fora da autorização da FASE 2 (formalização e desenho apenas). Fica para FASE futura com autorização própria. |

---

## Consequences

### O que muda
1. `.opencode/SMG_GATE.md` passa a ser o contrato formal de referência (Proposed até aprovação do PO).
2. `SMG_CHANGE_CONTROL.md` ganha nota de evolução apontando o contrato — conteúdo v1.0.0 preservado.
3. Gate reports passam, **em futura FASE**, a referenciar `record_id`s em vez de serem a autorização.
4. ADR-027 (este) registra a decisão.

### O que NÃO muda nesta FASE
- Nenhuma skill alterada; nenhum enforcement criado; nenhum workflow/CI alterado.
- Nenhum store/DB/serviço criado.
- Nenhuma migration, RLS, RPC, deploy, merge ou push.
- Frentes ativas P-AUTO, P-DV e P-MIG intocadas.
- D8 e domínio financeiro intocados (restrição de domínio do contrato §2).

---

## Risks

| Risco | Mitigação |
|-------|-----------|
| Contrato divergir da prática (skills continuam com vocabulário v1.0.0) | Mapeamento formal no contrato §8; FASE de enforcement (futura) alinha skills de uma vez, com autorização própria. |
| Duas fontes de verdade durante a transição | Regra: prosa só *referencia* `record_id`; store (quando existir) é a fonte de verdade. |
| Colisão de nome `STOP` (estado) vs `smg-stop-gate` (skill) | Nomeados explicitamente no contrato: skill = mecanismo de validação; estado = situação da frente. |
| Records virarem formalismo burocrático sem enforcement | Enforcement é FASE futura; até lá o contrato é governança declarada + revisão do PO nos gates. |
| Escopo aprovado ser contornado por record mal escopado | I7 + I9: record por transição, escopo coincidente com o aprovado, consumo único. |

---

## Migration Strategy

1. **FASE 1 (concluída):** descoberta read-only → GOVERNANCE DISCOVERY REPORT → aprovação do PO (Opção 1/C).
2. **FASE 2 (esta, STOP ao final):** contrato `SMG_GATE.md` + ADR-027 + ponteiro em `SMG_CHANGE_CONTROL.md`. Validações documentais apenas. **STOP obrigatório para revisão do PO.**
3. **FASE 3 (futura, exige autorização separada):** store de states/records; adaptação das skills; engate do `smg-pr-approve` em records; atualização do `AGENTS.md`; atualização do índice de ADRs e da documentação operacional. Nada desta FASE executa sem nova autorização.
4. **Nenhuma frente existente** muda de estado ou de artefato em nenhuma fase deste plano.

---

## Relations

- **`SMG_CHANGE_CONTROL.md`**: origem histórica, preservado. O contrato formaliza a mesma máquina; a nota de evolução em seu cabeçalho liga os dois. Nenhuma cláusula da v1.0.0 é revogada — apenas complementada.
- **`smg-stop-gate`**: permanece o enforcer das condições STOP (contrato §4.1) e das transições TX1/TX2/TX4. O contrato não duplica sua lógica: fornece o vocabulário de estados que ele já valida em prosa.
- **`smg-pr-approve`**: permanece o ponto de integração machine-enforced do gate de merge (T15). Em FASE futura, seus guards passarão a exigir um authorization record válido (`transition=T15`, `front_id` do PR) em vez de apenas identidade do comentarista — mudança que exige autorização própria (não coberta por este ADR).

---

## FASE 2.1 — Emendas ao contrato (2026-09-24)

A revisão do PO aceitou a FASE 2 quanto ao escopo e direção arquitetural, mas **não aprovou o contrato V1.0** enquanto persistissem inconsistências internas. As 7 correções obrigatórias abaixo foram aplicadas somente em `.opencode/SMG_GATE.md` (e neste ADR). Nenhuma alteração de enforcement, CI, skills, store, migration ou comportamento.

| # | Inconsistência | Correção aplicada |
|---|----------------|-------------------|
| 1 | `environment` enum não incluía `repo`, mas tabelas/exemplos usavam `repo` | Separação formal `environment` (onde: `local\|ci\|staging\|prod\|n/a`) × `target` (sobre o quê: git ref/PR/SHA/`<deploy target>`). Campo `target` adicionado ao record, aos blocos de estado e como coluna da tabela de transições. Ex.: merge → `target: main`, `environment: n/a`; deploy → `target: <deploy target>`, `environment: staging\|prod`. |
| 2 | Revogação descrita também após `consumed`, contradizendo `granted→consumed` | `consumed` é **terminal**: não existe revogação pós-consumo. Problema posterior = ***reassessment event*** (append-only no histórico, via `TX1`→`STOP`) → nova decisão. O record `consumed` nunca é alterado; nada é desfeito por mudança de status. §6 reescrito. |
| 3 | `TX5` partia de "qualquer" inclusive terminais, conflitando com `CERTIFIED` terminal | `TX5` só parte de estados **não-terminais**; `CERTIFIED` jamais vira `CANCELLED`. Invalidação de certificação = mecanismo futuro inexistente, não criado agora (exigiria ADR próprio). §3.18/§3.20/TX5 corrigidos. |
| 4 | `status=expired` sem semântica | `expires_at` **opcional**, definido só pelo PO na emissão; validade semântica/derivada (sem executor nesta FASE); consumo com record vencido = fail-closed `STOP`; `expired` terminal, sem reuso. §5.4 novo. |
| 5 | `certified_with_reservations` sem definição | Formalizada em §7.3: gates mandatórios todos verdes + risco não-mandatório aberto documentado; **terminal** (estado `CERTIFIED`); riscos tenant/segurança/financeira **não** podem ser ressalva; prazo `due?` opcional cujo descumprimento não invalida, mas obriga nova frente; registro em `reservations` append-only + histórico. |
| 6 | "Decisão explícita do PO" podia parecer habilitar transição diretamente | Cadeia inequívoca `DECISION → AUTHORIZATION RECORD → TRANSITION` formalizada em §1.2, §3.5, §3.12, T15, §3.20, §5.2. A decisão **emite** o record; o record habilita. |
| 7 | Vínculo de COMMIT/PUSH/MERGE/DEPLOY ao artefato não estava decidido | Decisão arquitetural registrada em §5.3: records `T12/T15/T18` carregam `artifact_ref` (SHA/ref na emissão); mudança posterior de branch/commit/artefato torna o record **não-consumível** (fail-closed) → `granted→rejected` + novo record, nunca mutação silenciosa. `T10` vincula branch+`scope_id` (artefato é produzido). Implementação = enforcement futuro. |

**Fora do escopo da FASE 2.1 (confirmado):** enforcement, CI, skills, store, migrations, RLS/RPC, deploy, commit/push/PR/merge, verificação automática de `artifact_ref`/`expires_at`, mecanismo de invalidação de certificação.

---

## Não autorizado por este gate

- ❌ Enforcement funcional nas skills ou workflows
- ❌ Store persistente (banco, tabela, serviço)
- ❌ Alteração de CI, branch protection, secrets
- ❌ Alteração de `AGENTS.md` ou do bundle de instalação
- ❌ Commit, push, PR, merge, deploy
- ❌ Migration, DDL/DML, RLS, RPC
- ❌ Alteração das frentes P-AUTO, P-DV, P-MIG
- ❌ Início de smg-flow, smg-preflight, smg-scope-guard
