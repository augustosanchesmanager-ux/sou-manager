# SMG-GATE — Contrato Formal de Governança de Mudanças (v1.0)

> **Status:** Proposed — FASE 2 aceita pelo PO quanto à direção arquitetural; **V1.0 ainda NÃO aprovada**. Correções da FASE 2.1 aplicadas em 2026-09-24, aguardando revisão do PO.
> **Revisão:** draft r2 (FASE 2.1 — correções documentais/modelares do PO)
> **Data:** 2026-09-24
> **Deciders:** PO (Augusto) + OpenCode (Tech Lead)
> **ADR:** `docs/adr/ADR-027-smg-gate-formal-contract.md`
> **Origem histórica do protocolo:** `.opencode/SMG_CHANGE_CONTROL.md` (v1.0.0) — **preservado como está**; este documento é a sua evolução formal, não um sistema paralelo.
> **Enforcement:** `smg-stop-gate` (validação de STOP) e `smg-pr-approve` (autorização machine-enforced de PR/merge) permanecem os mecanismos. Este contrato apenas formaliza o que eles validam.

---

## 1. Escopo deste contrato

Este documento formaliza a governança de mudanças da SMG em quatro pilares:

1. **Estados** — a máquina formal de vida de uma frente.
2. **Transições** — tabela fechada origem→destino, com evidências, autorização, ambiente, alvo (`target`) e condições STOP.
3. **Authorization Record** — o único formato válido de autorização (escopado, nunca booleano global).
4. **Certification por frente** — certificação individual, sem herança.

**Não faz parte deste contrato:** enforcement funcional em skills, store persistente, alteração de CI, migrations, deploy — tudo isso é FASE futura e exige autorização separada do PO.

### 1.1 Conceitos

| Conceito | Definição |
|---|---|
| **Front** | Unidade de mudança isolada (branch própria, escopo próprio). Identificada por `front_id`, atribuída em `INTAKE`. |
| **Scope** | Conjunto concreto de arquivos/regras/ambientes cobertos por uma frente, identificada por `scope_id`. Definido em `CLASSIFY` e registrado no *front manifest*. |
| **Environment** | `local` \| `ci` \| `staging` \| `prod` \| `n/a`. **Onde** o efeito da transição se materializa. Todo efeito sobre ambiente é nomeado explicitamente na autorização. |
| **Target** | Alvo **concreto** sobre o qual a transição opera: git ref/branch/PR, commit SHA, `<deploy target>`. Campo `target` do authorization record, **separado** de `environment`: `environment` = onde; `target` = sobre o quê. Ex.: merge → `target: main`, `environment: n/a`; deploy → `target: <deploy target>`, `environment: staging` (ou `prod`). |
| **Evidence** | Fato observável: output de comando, teste, diff, log, relatório. Nunca autoriza nada por si só. |
| **Decision** | Resolução do PO sobre um gate (aprovado / rejeitado / pendente). Pode *emitir* uma autorização; não *é* uma autorização e **não habilita transição por si só**. |
| **Authorization** | Permissão explícita e escopada para executar UMA transição, materializada em um **authorization record**. |
| **Certification** | Verificação pós-ocorrência de que uma frente cumpriu o contrato, emitida por frente e por ambiente. |

### 1.2 Relação entre Evidence, Decision, Authorization e Certification

```
EVIDENCE  (fato observável — nunca autoriza)
   │
   ▼
DECISION  (PO decide sobre o gate — pode emitir…)
   │
   ▼
AUTHORIZATION  (record escopado — habilita UMA transição — nunca certifica)
   │
   ▼
CERTIFICATION  (verificação por frente+ambiente — emitida depois do ocorrido)
```

Cadeia obrigatória de habilitação — **sem atalho**:

```
DECISION  →  AUTHORIZATION RECORD  →  TRANSITION
   ✗  nunca:  DECISION  →  TRANSITION
```

- **Evidence ≠ Authorization** (I1): um relatório verde não habilita nenhuma ação.
- **Authorization ≠ Certification** (I2): autorizar `deploy` não certifica a frente.
- **Decision ≠ habilitação:** a decisão do PO é o que *emite* o authorization record; o **record** é o artefato que habilita a transição. Uma decisão explícita sem record correspondente não move a máquina (fail-closed).
- **Certificação não é pré-condição nem garantia de autorização** de outra frente (I5/I6).

---

## 2. Invariantes (I1–I10)

| # | Invariante |
|---|---|
| **I1** | Evidence não é Authorization. Nenhum output de CI, teste ou relatório autoriza transição. |
| **I2** | Authorization não é Certification. São records distintos com propósito distinto. |
| **I3** | Merge authorization não implica deploy authorization. `MERGE` e `DEPLOY` exigem records separados. |
| **I4** | STAGING authorization não implica PROD authorization. `environment` é campo obrigatório e distinto. |
| **I5** | Uma frente não herda autorização de outra frente. Records são válidos somente para o `front_id` emitido. |
| **I6** | Uma frente não herda certificação de outra frente. `certification(front A) != certification(front B)`. |
| **I7** | Uma transição não herda automaticamente autorização de outra transição. Cada transição gated exige seu próprio record, ainda que emitido na mesma decisão do PO. |
| **I8** | Booleano global (ex.: `PO_APPROVED=true`) nunca é fonte de verdade de autorização. |
| **I9** | Authorization é sempre escopada por `front_id`, `transition`, `scope_id` e `environment`. |
| **I10** | O histórico de autorização é append-only: revogações são registradas, nunca apagadas. Revogação é mecanismo explícito, nunca silenciosa, e **só existe pré-consumo** — pós-consumo o contrato prevê **reassessment event** (§6), não revogação. |

**Restrição de domínio:** nenhum item deste contrato enfraquece o pipeline D8 (`pg_cron → pg_net → Edge Function → RPCs`), nem a separação Commission×Settlement (ADR-001), nem RLS/multi-tenancy. Mudança nesses domínios tem fluxo próprio (ADR + autorização PO específica).

---

## 3. Estados (máquina formal)

20 estados. Os estados `BLOCKED`, `CANCELLED`, `POST_MERGE` e `DEPLOY_REVIEW` são formalmente novos em relação à v1.0.0 (esta é a motivação central da FASE 2).

Estados **terminais**: `CERTIFIED`, `CANCELLED`. Estados **congelados**: `BLOCKED` (exceção: transições de resolução) e `STOP` (exceção: decisão do PO).

### 3.1 INTAKE
- **Significado:** frente proposta, ainda sem investigação.
- **Entrada:** pedido de mudança registrado com `front_id` e escopo declarado (texto bruto).
- **Saída:** investigação iniciada.
- **Evidências exigidas:** registro do pedido; *front manifest* criado com ID, branch, base, escopo declarado, escopo excluído.
- **Autorização exigida:** nenhuma (investigação read-only).
- **Ambiente:** `n/a`.
- **Próximos estados:** `AUDIT`, `CANCELLED`.
- **Bloqueio/cancelamento:** `BLOCKED` se o pedido não puder ser enquadrado; `CANCELLED` se o PO julgar inválido/duplicado.

### 3.2 AUDIT
- **Significado:** coleta read-only de fatos sobre o estado atual.
- **Entrada:** `T01`.
- **Saída:** fatos consolidados.
- **Evidências exigidas:** relatório de auditoria no padrão EVIDENCE / INTERPRETATION / GAP (comandos, caminhos de arquivo, saídas reais).
- **Autorização exigida:** nenhuma. **Proibido** qualquer mutação neste estado.
- **Ambiente:** `n/a` (somente leitura; produção nunca é alterada em investigação — invariante do protocolo).
- **Próximos estados:** `CLASSIFY`, `BLOCKED`, `CANCELLED`.
- **Bloqueio/cancelamento:** `BLOCKED` se a auditoria depender de acesso indisponível; `CANCELLED` se a frente for substituída.

### 3.3 CLASSIFY
- **Significado:** definição formal de escopo, classificação de risco e da necessidade de evidência adicional.
- **Entrada:** `T02`.
- **Saída:** escopo aprovável ou lacunas apontadas.
- **Evidências exigidas:** proposta de `scope_id` com in-scope / out-of-scope; classificação de risco (dados financeiros, RLS, RPC, migrations = alto risco por padrão).
- **Autorização exigida:** nenhuma para classificar.
- **Ambiente:** `n/a`.
- **Próximos estados:** `EVIDENCE`, `STOP`, `BLOCKED`, `CANCELLED`.
- **Bloqueio/cancelamento:** `BLOCKED` se o escopo não puder ser determinado; `CANCELLED` se a frente estiver fora de escopo do produto.

### 3.4 EVIDENCE
- **Significado:** coleta deliberada de evidência para fechar lacunas identificadas em `AUDIT`/`CLASSIFY`.
- **Entrada:** `T03`.
- **Saída:** lacunas fechadas ou explicitamente mantidas como GAP.
- **Evidências exigidas:** evidência adicional datada e reprodutível para cada GAP listado.
- **Autorização exigida:** nenhuma (read-only). Se fechar o GAP exigir mutação, isso **não** cabe aqui: a frente vai a `STOP` e exige decisão/autorização do PO.
- **Ambiente:** `n/a`.
- **Próximos estados:** `STOP`, `BLOCKED`, `CANCELLED`.
- **Bloqueio/cancelamento:** `BLOCKED` se a evidência for inacessível; `CANCELLED` se a lacuna for declarada irrelevante pelo PO.

### 3.5 STOP
- **Significado:** suspensão obrigatória da frente aguardando decisão/autorização do PO. Estado duro, não sugestão.
- **Entrada:** `T05` (gate de escopo pós-`CLASSIFY`), `T04` (gate pós-`EVIDENCE`), `T09` (gate de commit), `T11` (gate de push) ou `TX1` (gatilho de STOP de qualquer estado ativo — inclui *reassessment events*, §6).
- **Saída:** decisão do PO **materializada como authorization record** da transição de saída (`DECISION → AUTHORIZATION RECORD → TRANSITION`; a decisão nunca habilita por si só).
- **Evidências exigidas:** o relatório/gate que motivou a parada; resultado `GATE: PASS` do `smg-stop-gate` para reanudar.
- **Autorização exigida:** para prosseguir, o record da transição de saída correspondente (exceto `TX2` de retorno a gate já aprovado — ver Tabela de Transições).
- **Ambiente:** `n/a` (nenhuma ação é permitida em `STOP`).
- **Próximos estados:** transição de saída pendente, `BLOCKED`, `CANCELLED`.
- **Bloqueio/cancelamento:** repetidos `STOP` com gate red levam a `BLOCKED`; decisão do PO de não continuar leva a `CANCELLED`.

### 3.6 ISOLATE
- **Significado:** checkpoint e isolamento da frente em working tree/branch própria. Nenhuma implementação começou.
- **Entrada:** `T06`.
- **Saída:** árvore isolada e verificada.
- **Evidências exigidas:** checkpoint pré-isolamento; `git status` mostrando apenas escopo da frente; confirmação de que ramos/frentes de outras frentes não foram tocados.
- **Autorização exigida:** record `T06` (escopo aprovado).
- **Ambiente:** `local` · **Target:** branch da frente.
- **Próximos estados:** `IMPLEMENT`, `BLOCKED`, `CANCELLED`.
- **Bloqueio/cancelamento:** árvore mista/contaminada → `BLOCKED` (nunca se implementa sobre escopo desconhecido).

### 3.7 IMPLEMENT
- **Significado:** execução das alterações dentro do `scope_id` aprovado.
- **Entrada:** `T07`.
- **Saída:** diff completo.
- **Evidências exigidas:** diff restrito ao escopo; nenhum arquivo fora do escopo alterado.
- **Autorização exigida:** record `T07` — **record próprio**, emitido na mesma decisão do PO que `T06`, mas separado (I7).
- **Ambiente:** `local` · **Target:** branch da frente.
- **Próximos estados:** `VALIDATE`, `BLOCKED`, `CANCELLED`.
- **Bloqueio/cancelamento:** descoberta de escopo novo durante execução → nova classificação (nunca absorvida silenciosamente); dependência externa indisponível → `BLOCKED`.

### 3.8 VALIDATE
- **Significado:** verificação objetiva do que foi implementado.
- **Entrada:** `T08`.
- **Saída:** resultado verificável.
- **Evidências exigidas:** execução real de testes/build/typecheck/validações pertinentes ao escopo, com resultados e datas. Resultado verde antigo vira stale quando o commit muda.
- **Autorização exigida:** nenhuma.
- **Ambiente:** `local` / `ci`.
- **Próximos estados:** `STOP`, `BLOCKED`.
- **Bloqueio/cancelamento:** validação falha sem baseline → permanece em `VALIDATE` ou vai a `BLOCKED`; tentativa de enfraquecer teste para virar verde → `STOP` obrigatório (gatilho do `smg-stop-gate`).

### 3.9 COMMIT
- **Significado:** materialização isolada do trabalho em um commit.
- **Entrada:** `T10`.
- **Saída:** commit criado.
- **Evidências exigidas:** `git diff --check` limpo; working tree sem mistura de frentes; validação verde atual.
- **Autorização exigida:** record `T10` (`transition=T10`), vinculado à branch/escopo (§5.3 — o artefato é *produzido* nesta transição).
- **Ambiente:** `local` · **Target:** branch da frente.
- **Próximos estados:** `STOP` (gate de push), `BLOCKED`.
- **Bloqueio/cancelamento:** working tree sujo/misto → a transição não ocorre (fail-closed).

### 3.10 PUSH
- **Significado:** publicação da branch própria no remoto.
- **Entrada:** `T12`.
- **Saída:** branch remota atualizada.
- **Evidências exigidas:** SHA do commit; branch de origem; remoto sem força que destrua histórico.
- **Autorização exigida:** record `T12` (`transition=T12`), com `artifact_ref` = SHA a publicar (§5.3).
- **Ambiente:** `n/a` (operação de metadados do repositório) · **Target:** branch remota da frente.
- **Próximos estados:** `PR`, `BLOCKED`.
- **Bloqueio/cancelamento:** push sem record → proibido; push para branch de outra frente → `BLOCKED`; SHA divergente do `artifact_ref` → fail-closed (§5.3).

### 3.11 PR
- **Significado:** proposta de merge aberta; CI/E2E executa e produz evidência.
- **Entrada:** `T13`.
- **Saída:** checks de CI concluídos.
- **Evidências exigidas:** PR aberto para `main` a partir da branch da frente; status de todos os checks obrigatórios; resultado E2E com baseline.
- **Autorização exigida:** nenhuma adicional para *existir* o PR.
- **Ambiente:** `ci` · **Target:** PR (origem→alvo).
- **Próximos estados:** `PO_REVIEW`, `BLOCKED`.
- **Bloqueio/cancelamento:** check obrigatório red/unknown/bypassed → `BLOCKED` (nunca se mergeia com gate mandatório vermelho, desconhecido ou contornado).

### 3.12 PO_REVIEW
- **Significado:** entrega sob revisão formal do PO antes de qualquer merge.
- **Entrada:** `T14`.
- **Saída:** decisão do PO sobre o merge, **materializada em record `T15`**.
- **Evidências exigidas:** CI verde completo; evidência de validação consolidada; relatório de impacto/escopo; gate `smg-pr-approve` satisfeito **ou** decisão explícita do PO — ambos se materializam exclusivamente na emissão do record `T15` (`DECISION → AUTHORIZATION RECORD → TRANSITION`).
- **Autorização exigida:** para sair em direção a `MERGE`, record `T15`.
- **Ambiente:** `ci` · **Target:** PR.
- **Próximos estados:** `MERGE`, `STOP`, `BLOCKED`, `CANCELLED`.
- **Bloqueio/cancelamento:** gate de aprovação falho → `STOP`; escopo divergente do aprovado → `STOP` + nova classificação; PO rejeita → `CANCELLED` (ou retorno via `STOP`).

### 3.13 MERGE
- **Significado:** integração autorizada da branch no alvo.
- **Entrada:** `T15`.
- **Saída:** merge concluído.
- **Evidências exigidas:** SHA do merge; branch origem→destino; checks verdes no momento do merge.
- **Autorização exigida:** record `T15` (`transition=T15`, `target`=alvo), com `artifact_ref` = SHA do head do PR (§5.3). **Este record não autoriza deploy (I3).**
- **Ambiente:** `n/a` (operação de metadados do repositório) · **Target:** alvo do merge (ex.: `main`).
- **Próximos estados:** `POST_MERGE`, `BLOCKED`.
- **Bloqueio/cancelamento:** qualquer gate mandatório não atendido → a transição não ocorre; `artifact_ref` divergente do head atual do PR → fail-closed (§5.3).

### 3.14 POST_MERGE *(novo)*
- **Significado:** verificação do estado do repositório alvo após o merge, antes de qualquer decisão de deploy.
- **Entrada:** `T16`.
- **Saída:** estado do alvo confirmado.
- **Evidências exigidas:** histórico do alvo; confirmação de que o merge é o esperado; nenhuma regressão detectada em checks pós-merge.
- **Autorização exigida:** nenhuma (verificação).
- **Ambiente:** `n/a` / `ci` · **Target:** alvo do merge (ex.: `main`).
- **Próximos estados:** `DEPLOY_REVIEW`, `BLOCKED`.
- **Bloqueio/cancelamento:** merge incorreto detectado → `BLOCKED` (rollback/ação do PO; nunca revertido silenciosamente).

### 3.15 DEPLOY_REVIEW *(novo)*
- **Significado:** gate dedicado de deploy. Onde a decisão "mergar ≠ implantar" materializa-se: avalia ambiente alvo, plano e riscos **antes** de qualquer implantação.
- **Entrada:** `T17`.
- **Saída:** decisão de implantar (e em qual ambiente) ou de não implantar.
- **Evidências exigidas:** checklist pré-deploy; plano de rollback; identificação do ambiente alvo (`staging`/`prod`) e do `<deploy target>`; estado atual do ambiente confirmado.
- **Autorização exigida:** para sair em direção a `DEPLOY`, record `T18` com `environment` explícito e `target` explícito. `staging` e `prod` exigem records distintos (I4).
- **Ambiente:** `staging` ou `prod` (candidato) · **Target:** `<deploy target>`.
- **Próximos estados:** `DEPLOY`, `STOP`, `BLOCKED`, `CANCELLED`.
- **Bloqueio/cancelamento:** sem plano de rollback → `STOP`; ambiente desconhecido/inacessível → `BLOCKED`; PO decide não implantar → `CANCELLED` (merge permanece; frente pode encerrar sem deploy) ou retorno via `STOP`.

### 3.16 DEPLOY
- **Significado:** implantação efetiva no ambiente nomeado no record.
- **Entrada:** `T18`.
- **Saída:** implantação concluída.
- **Evidências exigidas:** ref SHA implantada; resultado do mecanismo de deploy; confirmação do ambiente.
- **Autorização exigida:** record `T18` (`transition=T18`, `environment=staging|prod`, `target=<deploy target>`), com `artifact_ref` = ref/SHA a implantar (§5.3).
- **Ambiente:** `staging` ou `prod` — exatamente o do record · **Target:** `<deploy target>` — exatamente o do record.
- **Próximos estados:** `POST_DEPLOY`, `BLOCKED`.
- **Bloqueio/cancelamento:** divergência entre ambiente/target do record e realidade → não executa (fail-closed); `artifact_ref` divergente → fail-closed (§5.3); falha de deploy → `BLOCKED`.

### 3.17 POST_DEPLOY
- **Significado:** verificação pós-implantação no ambiente afetado.
- **Entrada:** `T19`.
- **Saída:** comportamento confirmado.
- **Evidências exigidas:** smoke/validação no ambiente implantado; comparação com baseline; registro de incidentes se houver.
- **Autorização exigida:** nenhuma (verificação).
- **Ambiente:** o mesmo do deploy · **Target:** o do deploy.
- **Próximos estados:** `CERTIFIED`, `BLOCKED`, `STOP`.
- **Bloqueio/cancelamento:** regressão detectada → `BLOCKED` + ação de rollback sujeita a autorização própria.

### 3.18 CERTIFIED
- **Significado:** frente verificada e encerrada com certificação **para o escopo e ambiente emitidos**. É o fecho legitimado (substitui o `CLOSE` genérico da v1.0.0).
- **Entrada:** `T20`.
- **Saída:** terminal — nenhuma. **`CERTIFIED` não transiciona para nenhum estado, inclusive `CANCELLED`** (§3.20).
- **Evidências exigidas:** verificação pós-deploy completa; certificação record emitida.
- **Autorização exigida:** record `T20` (`transition=T20`) **e** certificação record (dois artifacts distintos — I2).
- **Ambiente:** o ambiente da certificação (`staging` ou `prod` — certificar `staging` não certifica `prod`: I4/I6).
- **Próximos estados:** nenhum (terminal).
- **Bloqueio/cancelamento:** — (para alterar uma frente certificada, abre-se uma **nova** frente; I5/I6). **Invalidar uma certificação não é previsto neste contrato** — seria um mecanismo/decisão específica futura, com ADR próprio; não existe hoje.

### 3.19 BLOCKED *(novo)*
- **Significado:** frente congelada por impedimento externo ou por condição que impede avanço seguro.
- **Entrada:** `TX3` de qualquer estado ativo.
- **Saída:** resolução do impedimento.
- **Evidências exigidas:** descrição do impedimento, data, responsável pelo desbloqueio.
- **Autorização exigida:** nenhuma para entrar; para sair, gate `PASS` do `smg-stop-gate` + records exigidos pela transição de saída.
- **Ambiente:** herdado do estado de origem (fica congelado junto).
- **Próximos estados:** `STOP` (reentrada por gate) ou `CANCELLED`.
- **Comportamento:** **nenhuma transição de progresso é permitida** a partir de `BLOCKED`. Nenhuma ação lateral, commit, push ou deploy.

### 3.20 CANCELLED *(novo)*
- **Significado:** frente encerrada sem certificação, por decisão do PO ou por abandono formal.
- **Entrada:** `TX5` de qualquer estado **não-terminal** (`INTAKE`…`POST_DEPLOY`, `STOP`, `BLOCKED`). **`CERTIFIED` não admite `TX5`** — uma frente certificada jamais se torna `CANCELLED`; invalidar certificação exigiria mecanismo próprio, que **não existe** neste contrato (§3.18).
- **Saída:** terminal — nenhuma.
- **Evidências exigidas:** motivo documentado (DECISION: rejected/cancelled).
- **Autorização exigida:** record `T-cancel` (a decisão do PO emite o record; o record é que habilita `TX5` — `DECISION → AUTHORIZATION RECORD → TRANSITION`).
- **Ambiente:** `n/a`.
- **Próximos estados:** nenhum (terminal).
- **Comportamento:** histórico **preservado integralmente**; nada é apagado. Reabrir o tema exige **nova frente com novo `front_id`** (I5). `CANCELLED` ≠ `CERTIFIED` — nunca conta como certificação (I6).

---

## 4. Tabela de Transições

Legenda de autorização: **record `Txx`** = authorization record obrigatório; **—** = automática quando as evidências exigidas estão presentes.

`front_id` e `scope_id` são vinculados por instância: toda transição pertence a exatamente uma frente e opera sobre o `scope_id` dela (I9). A coluna `environment` indica **onde** o efeito se materializa; a coluna `target` indica **sobre o quê** a transição opera (git ref, PR, SHA, `<deploy target>`) — as duas nunca se misturam (§1.1).

| ID | Origem | Destino | Transição | scope_id | environment | target | Evidências obrigatórias | Autorização obrigatória | Condições STOP | Condição de bloqueio | Condição de cancelamento |
|----|--------|---------|-----------|----------|-------------|--------|--------------------------|--------------------------|----------------|----------------------|--------------------------|
| T01 | INTAKE | AUDIT | iniciar auditoria | o declarado | `n/a` | — | pedido registrado; front manifest criado | — | pedido sem escopo declarado | sem acesso à base de investigação | pedido inválido/duplicado |
| T02 | AUDIT | CLASSIFY | classificar | em revisão | `n/a` | — | relatório EVIDENCE/INTERPRETATION/GAP completo | — | relatório com fatos não observados | fatos inacessíveis | — |
| T03 | CLASSIFY | EVIDENCE | coletar evidência | em revisão | `n/a` | — | lista de lacunas justificada | — | tentativa de mutação para fechar GAP | evidência inacessível | GAP declarada irrelevante pelo PO |
| T04 | EVIDENCE | STOP | gate de evidência | proposto | `n/a` | — | lacunas fechadas ou mantidas como GAP explícito | — | — | — | PO descarta a frente |
| T05 | CLASSIFY | STOP | gate de escopo | proposto | `n/a` | — | proposta de escopo (in/out) + risco | — | — | escopo indeterminável | escopo fora do produto |
| T06 | STOP | ISOLATE | iniciar isolamento | aprovado | `local` | branch da frente | relatório de escopo aprovado; checkpoint | **record T06** | árvore não isolada | checkpoint falha | PO não aprova escopo |
| T07 | ISOLATE | IMPLEMENT | implementar | aprovado | `local` | branch da frente | working tree limpo e isolado | **record T07** | escopo misturado descoberto | dependência externa indisponível | escopo novo não aprovável |
| T08 | IMPLEMENT | VALIDATE | validar | aprovado | `local`/`ci` | — | diff completo no escopo | — | — | — | — |
| T09 | VALIDATE | STOP | gate de commit | aprovado | `local`/`ci` | — | testes/build/typecheck atuais e verdes | — | resultado inconclusivo/stale; pedido de enfraquecer teste | validação sem baseline | — |
| T10 | STOP | COMMIT | commitar | aprovado | `local` | branch da frente | `git diff --check` limpo; validação verde | **record T10** | working tree misto/sujo | — | — |
| T11 | COMMIT | STOP | gate de push | aprovado | `local` | SHA do commit | SHA do commit | — | — | — | — |
| T12 | STOP | PUSH | push | aprovado | `n/a` | branch remota da frente | SHA + branch correta | **record T12** (`artifact_ref`=SHA) | push para branch alheia | remoto inacessível | — |
| T13 | PUSH | PR | abrir PR | aprovado | `ci` | PR (origem→alvo) | PR aberto origem→alvo correto | — | — | — | — |
| T14 | PR | PO_REVIEW | submeter à revisão | aprovado | `ci` | PR | todos os checks obrigatórios concluídos; E2E com baseline | — | check red/unknown/bypassed | CI indisponível | — |
| T15 | PO_REVIEW | MERGE | mergear | aprovado | `n/a` | alvo do merge (ex.: `main`) | CI verde; gate `smg-pr-approve` satisfeito ou decisão explícita do PO — ambos se materializam no record T15 (`DECISION → AUTHORIZATION RECORD → TRANSITION`); relatório de impacto | **record T15** (`artifact_ref`=head do PR) | gate mandatório falho; escopo divergente | — | PO rejeita a entrega |
| T16 | MERGE | POST_MERGE | verificar pós-merge | aprovado | `n/a`/`ci` | alvo do merge (ex.: `main`) | SHA do merge; histórico confirmado | — | — | merge incorreto detectado | — |
| T17 | POST_MERGE | DEPLOY_REVIEW | avaliar deploy | aprovado | `staging`/`prod` (candidato) | `<deploy target>` | checklist pré-deploy; plano de rollback; ambiente e target declarados | — | plano de rollback ausente | ambiente inacessível | PO decide não implantar |
| T18 | DEPLOY_REVIEW | DEPLOY | implantar | aprovado | **`staging` OU `prod`** | `<deploy target>` | estado atual do ambiente confirmado | **record T18** (`environment` e `target` explícitos; `artifact_ref`=ref a implantar; I4) | divergência record×realidade | falha do mecanismo de deploy | — |
| T19 | DEPLOY | POST_DEPLOY | verificar pós-deploy | aprovado | o do deploy | o do deploy | smoke/validação no ambiente; baseline | — | — | regressão detectada | — |
| T20 | POST_DEPLOY | CERTIFIED | certificar | aprovado | o do deploy | o do deploy | pós-deploy completo | **record T20** + **certification record** (I2) | verificação incompleta | — | PO não certifica |
| TX1 | *qualquer ativo* | STOP | gatilho STOP | — | `n/a` | — | relatório que motivou a parada | — | qualquer gatilho da §4.1 | — | — |
| TX2 | STOP | *estado de origem pendente* | reanudar | — | `n/a` | — | `GATE: PASS` do `smg-stop-gate` | record da transição pendente, se a parada foi por autorização ausente | gate ainda red | — | — |
| TX3 | *qualquer ativo* | BLOCKED | bloquear | — | congelado | — | impedimento documentado (o quê, desde quando, quem resolve) | — | — | impedimento externo verificado | — |
| TX4 | BLOCKED | STOP | desbloquear | — | `n/a` | — | impedimento resolvido com evidência | gates da transição pendente | desbloqueio sem evidência | — | — |
| TX5 | *qualquer não-terminal (exceto CERTIFIED)* | CANCELLED | cancelar | — | `n/a` | — | motivo documentado | **record T-cancel** (a decisão do PO emite o record) | — | — | decisão do PO |

### 4.1 Condições STOP canônicas (gatilhos do `smg-stop-gate`)

O `smg-stop-gate` permanece o enforcer único destas condições; qualquer gatilho força `TX1`:

1. Autorização PO ausente.
2. Mutações de produção solicitadas durante investigação.
3. Migration / RLS / RPC / política de segurança sem autorização explícita.
4. Escopo de working tree misto ou desconhecido.
5. Checkpoint ausente antes de isolamento/operação destrutiva.
6. Gate de validação ausente, red, stale ou inconclusivo.
7. Commit solicitado antes de isolamento/validação.
8. Push solicitado sem autorização explícita.
9. Merge solicitado com gates mandatórios não atendidos.
10. Deploy solicitado sem autorização explícita.
11. Falha E2E sem comparação de baseline.
12. Pedido de enfraquecer/remover teste para forçar verde.
13. Risco não resolvido de integridade tenant/segurança/financeira.

Os 13 gatilhos acima são os da skill `smg-stop-gate` (inalterada). Este contrato reconhece ainda, no nível do contrato, o ***reassessment event*** (§6) — problema constatado **após** o consumo de um authorization record — como gatilho de `TX1`, com entrada em `STOP`.

---

## 5. Authorization Record — contrato mínimo

Um authorization record é o **único** artefato que habilita uma transição gated. Contrato (especificação; nesta FASE não há banco nem serviço):

| Campo | Tipo | Obrigatório | Regra |
|-------|------|-------------|-------|
| `record_id` | string | ✅ | Único, imutável, atribuído na emissão (formato: `ar-<yyyymmdd>-<seq>-<slug>`). |
| `front_id` | string | ✅ | Deve corresponder a uma frente em existência (I5). |
| `transition` | enum `T01..T20, TX2, TX5` | ✅ | **Exatamente uma** transição; nenhum curinga (I7, I8). |
| `scope_id` | string | ✅ | Escopo coberto; deve coincidir com o escopo aprovado da frente. |
| `environment` | enum `local\|ci\|staging\|prod\|n/a` | ✅ | **Onde** o efeito ocorre. Sem ambiente, sem record (I4, I9). Nunca misturar com `target`. |
| `target` | string | ✅ quando aplicável | **Sobre o quê** a transição opera: git ref/branch/PR, `<deploy target>`. Obrigatório para toda transição com alvo material (T06, T07, T10, T11, T12, T13, T14, T15, T16, T17, T18, T19, T20); `n/a` quando não há alvo material (ex.: T05, T09, TX*). |
| `artifact_ref` | string | ✅ para T12, T15, T18 | SHA/ref do artefato **existente** consumido pela transição (§5.3). Para `T10` (commit) o artefato é *produzido*, não consumido — o vínculo é branch+`scope_id`. |
| `expires_at` | ISO-8601 | opcional | Validade temporal definida pelo **PO na emissão** (§5.4). Ausente = sem validade temporal. |
| `status` | enum `granted\|consumed\|revoked\|expired\|rejected` | ✅ | Transições: `granted→consumed`, `granted→revoked`, `granted→expired`, `granted→rejected`. **Todos os estados são terminais** — reversão proibida (I10). `revoked` só é alcançável a partir de `granted` (§6). |
| `authorized_by` | string | ✅ | Identidade do PO (ex.: `PO_ACCOUNT=augustosanchesmanager-ux`). |
| `authorized_at` | ISO-8601 | ✅ | Timestamp da emissão. |
| `consumed_at` | ISO-8601 | na `consumed` | Momento da execução da transição. |
| `consumed_ref` | string | na `consumed` | Referência do resultado (SHA, run ID, etc.). |
| `revoked_at` | ISO-8601 | na `revoked` | Ver §6 — somente pré-consumo. |
| `revoked_by` | string | na `revoked` | Ver §6 — somente pré-consumo. |
| `reason` | string | ✅ | Motivo da emissão (e, se aplicável, da revogação/rejeição/expiração). |
| `evidence_refs` | string[] | ✅ | Ponteiros para as evidências que sustentam a decisão (§1.2). |

### 5.1 Exemplo ilustrativo

```yaml
record_id: ar-20260926-014-merge
front_id: FR-007-smg-gate-fase2
transition: T15                     # somente PO_REVIEW → MERGE
scope_id: scope-smg-gate-fase2-docs
environment: n/a                    # merge é operação de metadados: não afeta ambiente (I3)
target: main                        # alvo concreto do merge
artifact_ref: "<PR head SHA>"       # vínculo com o artefato (§5.3)
expires_at: null                    # sem validade temporal (§5.4)
status: granted
authorized_by: augustosanchesmanager-ux
authorized_at: "2026-09-26T14:03:00-03:00"
consumed_at: null
consumed_ref: null
revoked_at: null
revoked_by: null
reason: "Revisão FASE 2.1 aprovada; CI verde; escopo apenas documental."
evidence_refs:
  - docs/audit/SMG_GATE_FASE2_20260924.md
  - "ci: run #1234 PASS"
```

Exemplo de deploy (ambiente separado de alvo):

```yaml
transition: T18
target: smg-barber                 # <deploy target> (ex.: projeto/alvo de deploy)
environment: staging               # prod exige record distinto (I4)
artifact_ref: "<ref SHA a implantar>"
status: granted
```

### 5.2 Regras de uso

- **Um record, uma transição, um consumo.** Após `consumed`, nunca volta a `granted` — `consumed` é terminal (§6).
- **Sem record, sem transição.** Falta de record = `STOP` (fail-closed), não exceção.
- **Decision nunca habilita diretamente.** `DECISION → AUTHORIZATION RECORD → TRANSITION` (§1.2). Toda "decisão explícita do PO" citada neste contrato significa: decisão que **emite** o record correspondente.
- **Records de uma frente só valem para ela** (I5); o `front_id` é verificado no consumo.
- **Booleano global proibido** (I8). Frases como "PO aprovou" em relatório **não são** record — são evidence/decision e devem referenciar um `record_id`.
- **Vínculo com artefato:** records de `T12`/`T15`/`T18` só são consumíveis contra o `artifact_ref` emitido (§5.3).

### 5.2.1 Nota interpretativa — estado lógico e materialização (PO, 2026-09-25)

- **O estado do Authorization Record é o estado lógico.** A tabela §5 define os campos e transições terminais; ela **não prescreve** a materialização física do `status`.
- Uma implementação **event-sourced** é conforme a este contrato quando materializa o record como **grant imutável + evento de consumo**, derivando o estado lógico (`grant granted` + evento de consumo válido ⇒ `consumed`), **desde que preserve** as invariantes do contrato: terminalidade (I10), revogação só pré-consumo (§6), binding ao artefato (§5.3), um record/um consumo, idempotência, fail-closed e append-only (I10).
- **Propriedade normativa:** um evento de consumo **nunca pode criar, modificar, revogar ou renovar uma autorização** — ele apenas atesta o uso de um grant existente. Autoridade continua exclusiva do grant emitido pelo PO.
- A materialização concreta é decisão de ADR (ver ADR-028, Rev. 2026-09-25 — B1, dois stores). **Esta nota não autoriza implementação**: é esclarecimento interpretativo da especificação, sem alteração de versão (permanece V1.0/r2).

### 5.3 Vínculo com o artefato (decisão arquitetural — não implementada nesta FASE)

**Cenário em questão:** autorização emitida → branch/commit muda → a autorização continua válida?

**Decisão:** **Não.** Toda autorização de `COMMIT`/`PUSH`/`MERGE`/`DEPLOY` é vinculada ao artefato específico consumido, conforme:

| Transição | Vínculo | Observação |
|---|---|---|
| `T10` (commit) | branch + `scope_id` (working tree) | O artefato é **produzido** na consumo; não existe SHA na emissão. Mudança de branch/escopo antes do consumo já é coberta pelas condições STOP (working tree misto). |
| `T12` (push) | `artifact_ref` = SHA a publicar + `target` = branch | SHA existe na emissão (pós-commit). |
| `T15` (merge) | `artifact_ref` = SHA do head do PR + `target` = alvo | SHA existe na emissão (pós-PR). |
| `T18` (deploy) | `artifact_ref` = ref/SHA a implantar + `target` = `<deploy target>` + `environment` | SHA/ref existe na emissão. |

**Regra do cenário:** se, **apois a emissão**, a branch/commit/artefato mudar (novo commit, rebase, force-push, retarget de PR, troca de ref), o record **deixa de ser consumível**: a consumo compara `artifact_ref` com o estado atual e, em divergência, é **fail-closed** (`STOP`). O record permanece `granted` até o PO decidir: `granted→rejected` (rejeição formal, registrada) + emissão de **novo** record para o artefato novo (novo `record_id`, nova `authorized_at` — I10). Nenhuma mutação silenciosa do record ocorre, e a decisão de reemissão é uma nova `DECISION` na cadeia `DECISION → AUTHORIZATION RECORD → TRANSITION`.

*Implementação desta verificação é FASE futura (enforcement) — nesta FASE registra-se apenas a regra.*

### 5.4 Semântica de `expired`

| Questão | Resposta do contrato |
|---------|----------------------|
| **Existe `expires_at`?** | Sim — campo **opcional** no authorization record. |
| **É obrigatório?** | Não. Record sem `expires_at` não tem validade temporal. |
| **Quem define?** | O **PO**, no momento da emissão (`authorized_by`). Nunca é derivado, inferido ou definido por agente/bot/CI. |
| **O que acontece quando expira?** | O record deixa de ser consumível: `granted→expired` (terminal). Se alguém tentar consumar uma transição com record vencido → `STOP` fail-closed. Nenhum efeito lateral ocorreu (nada foi executado). |
| **A expiração é automática?** | A validade é **semântica/derivada**: vale a partir de `expires_at` por definição deste contrato. **Não existe executor** (job, cron, store) que mude o status nesta FASE — a leitura do record no momento do consumo deve constatar `now > expires_at` e tratar como expirado. O preenchimento de `expired` documenta a constatação; o campo `expires_at` é quem determina a validade. |
| **Record expirado pode ser reutilizado?** | **Nunca.** `expired` é terminal. Novo intento = nova decisão do PO → novo record com novo `record_id` (I10). |

---

## 6. Revogação

| Questão | Resposta do contrato |
|---------|----------------------|
| **Quem pode revogar?** | Apenas o PO (`revoked_by` = identidade PO). Nenhum agente, bot ou CI revoga. |
| **Quando pode revogar?** | **Somente enquanto o record estiver `granted`** — inclusive imediatamente antes do consumo. **Revogação após o consumo não existe**: `consumed` é terminal e não transiciona para `revoked`. |
| **Efeito da revogação** | Toda transição que dependa do record é impedida imediatamente. Se a frente já tiver avançado, ela retorna a `STOP` via `TX1`. Gates dependentes (CI, branch protection) permanecem valendo — revogação não desliga enforcement. |
| **Record revogado pode ser reutilizado?** | **Nunca.** `revoked` é terminal. Novo intento = novo record com novo `record_id` (I10). |
| **E se o problema só aparecer DEPOIS do consumo?** | **Não é revogação — é *reassessment event*.** Registro append-only no histórico da frente (via `TX1` → `STOP`) descrevendo o problema e apontando o `record_id` consumido. O record permanece `consumed`, intocado — **o ocorrido não é apagado nem desfeito por mudança de status**. A nova decisão do PO pode emitir um novo record para uma transição compensatória, bloquear a frente (`BLOCKED`) ou cancelá-la (`CANCELLED`, se não certificada). |
| **Como aparece no histórico?** | Revogação: preenchimento de `revoked_at`/`revoked_by`/`reason` + entrada no relatório de gate. Reassessment event: entrada datada no histórico da frente, referenciando o `record_id` consumido. Em ambos, nada é apagado ou reescrito (I10). |

---

## 7. Certificação por frente

A certificação deixa de ser um checklist único de plataforma (`docs/PLATFORM_CERTIFICATION.md`, registro histórico) e passa a ser emitida **por frente e por ambiente**.

### 7.1 Contrato do certification record

| Campo | Regra |
|-------|-------|
| `cert_id` | Único, imutável (`cert-<yyyymmdd>-<seq>-<slug>`). |
| `front_id` | A frente certificada. **Um cert por frente** — nunca cobre outra (I6). |
| `scope_id` | Escopo exato coberto. |
| `environment` | `staging` ou `prod` — certificar um não certifica outro (I4). |
| `verdict` | `certified` \| `certified_with_reservations` (semântica em §7.3). |
| `certified_by` | PO. |
| `certified_at` | ISO-8601. |
| `reservations` | Lista. **Obrigatória e não-vazia** quando `verdict=certified_with_reservations`; vazia/omitida quando `certified`. Cada item: `description` (risco aberto), `evidence_refs`, `due?` (prazo opcional definido pelo PO). Append-only. |
| `evidence_refs` | Pós-deploy, validações, gates percorridos. |
| `supersedes` | **`null` obrigatoriamente** — não existe herança nem sucessão automática de certificação entre frentes. |

### 7.2 Propriedade central

```
certification(front A) != certification(front B)
```

Para qualquer par de frentes distintas. Não há cascata, bulk ou "certificação da plataforma" que cubra frentes futuras. A `PLATFORM_CERTIFICATION.md` permanece como **registro histórico** da Fase 5.6 e não certifica nenhuma frente nova.

### 7.3 Semântica de `certified_with_reservations`

| Questão | Resposta do contrato |
|---------|----------------------|
| **O que caracteriza?** | A frente passou em **todos os gates mandatórios** e no pós-deploy, **mas** existe um (ou mais) risco **não-mandatório** aberto, documentado como GAP aceita, que o PO decide registrar em vez de bloquear a certificação. |
| **É terminal?** | **Sim.** O estado da máquina é `CERTIFIED` (§3.18); o `verdict` qualifica o certification record. A frente termina certificada. |
| **Quais riscos podem permanecer abertos?** | Apenas riscos **não-mandatórios**. Risco de integridade **tenant/segurança/financeira não pode** ficar como ressalva: é gatilho de STOP (§4.1, item 13) e deve ser resolvido **antes** de `T20`. |
| **Existe prazo para resolução?** | Opcional: `reservations[].due`, definido pelo PO na emissão. **O descumprimento do prazo não invalida a certificação** — inexistência de invalidação é regra deste contrato (§3.18). O descumprimento gera **obrigação documental** de abrir uma **nova frente** para tratar a ressalva (novo `front_id`; I5/I6). |
| **A frente pode ser considerada certificada?** | **Sim** — estado `CERTIFIED` alcançado. Contudo, qualquer citação da certificação deve **exibir as ressalvas anexas**; omiti-las distorce o `verdict`. |
| **Como a ressalva fica registrada?** | No campo `reservations` do certification record (append-only, com `description` + `evidence_refs` + `due?`) e em entrada correspondente no histórico da frente. |

---

## 8. Mapeamento: governança atual (v1.0.0) → este contrato

| v1.0.0 (`SMG_CHANGE_CONTROL.md` / skills) | Contrato smg-gate V1 |
|--------------------------------------------|----------------------|
| `STOP/GATE` (passo prosaico) | Estado formal `STOP` + `TX1/TX2` + gatilhos §4.1 (enforcer: `smg-stop-gate`) |
| `COMMIT AUTHORIZATION` / `PUSH AUTHORIZATION` / `MERGE AUTHORIZATION` / `DEPLOY AUTHORIZATION` (passos) | Transições gated `T10/T12/T15/T18` + authorization records |
| `CI/E2E` (passo) | Evidência exigida nas transições `T14→T15` (estado `PR`/`PO_REVIEW`) |
| `POST-MERGE` (passo) | Estado formal `POST_MERGE` |
| *(inexistente)* | Estado `DEPLOY_REVIEW` (gate dedicado: merge ≠ deploy) |
| `CLOSE` (terminal único) | `CERTIFIED` (terminal legitimado) \| `CANCELLED` (terminal sem certificação) |
| *(inexistente)* | `BLOCKED` (congelamento com motivo) |
| *front manifest* (lista de campos na skill `smg-change-control`) | Base do `front_id`/`scope_id` — o manifest é a representação legível da frente; os records referenciam seus IDs |
| Relatórios de gate com tabelas `D-DEP-n` (autorização em prosa) | Relatórios **referenciam** `record_id`s; a prosa deixa de ser a fonte de verdade |
| `PLATFORM_CERTIFICATION.md` (checklist único) | Registro histórico + novo modelo por frente (§7) |
| `smg-stop-gate` (skill de gate) | **Permanece** — enforcer canônico dos gatilhos §4.1 e de `TX2` |
| `smg-pr-approve` (workflow CI) | **Permanece** — ponto de integração machine-enforced do gate `T15` (passará a exigir record válido, FASE futura) |
| Cabeçalho de invariantes das 16 skills | Mapeado a I1–I10 (as skills continuam valendo; não são alteradas nesta FASE) |

---

## 9. Relação com outros artefatos

| Artefato | Relação |
|----------|---------|
| `.opencode/SMG_CHANGE_CONTROL.md` | **Origem histórica.** Preservado sem alteração de significado. Este contrato formaliza a mesma máquina, com estados adicionados. |
| `.opencode/AGENTS.md` | Permanece o ponto de entrada operacional; aponta o fluxo. Alterações de texto nele são FASE futura (não autorizada nesta FASE). |
| `smg-stop-gate` | Enforcer de STOP (§4.1, TX1/TX2/TX4). |
| `smg-pr-approve` | Integração machine-enforced do gate de merge (T15). |
| ADR-001/015/016 (financeiro/D8) | Não afetados — restrição de domínio da §2. |
| `docs/PLATFORM_CERTIFICATION.md` | Vira registro histórico; certificação de frente vive em §7. |

---

## 10. Fora de escopo desta FASE (exige autorização PO separada)

- Store persistente de states/records (banco, tabela, serviço).
- Enforcement funcional em skills ou workflows (alteração das 16 skills, `smg-pr-approve`, branch protection, CI).
- Alteração de `AGENTS.md`, `README.md` do bundle.
- Qualquer migration, DDL/DML, RLS, RPC, deploy, merge ou push.
- Verificação automática de `artifact_ref`/`expires_at` (§5.3/§5.4 — regras documentadas; execução é enforcement futuro).
- Mecanismo de invalidação de certificação (não existe; exigiria ADR próprio).
- Início de smg-flow, smg-preflight ou smg-scope-guard.
