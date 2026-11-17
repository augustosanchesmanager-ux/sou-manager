# ERRATA — Baseline real de produção (Vercel `smg-barber`)

> **Natureza:** errata documental. Corrige uma afirmação **factual incorreta** publicada no registro 7.79 do `PROJECT_STATUS.md` e em `docs/audit/MERGE_ROUND_20261116_PR319_PR321_PR322.md` (§4.4 e §6). Nenhum código, migration, RLS, RPC, workflow ou configuração de infraestrutura foi alterado por este documento.
> **Autorização:** PO, 2026-11-17 — errata cirúrgica para alinhar os registros à realidade de produção.
> **Data da verificação:** 2026-11-17, ~04:55Z.

---

## 1. O que foi afirmado

`PROJECT_STATUS.md` 7.79 (mergeado em `main` via PR #326):

> "O invariante `MERGE ≠ DEPLOY PROD` (ADR-026) se mantém por outro mecanismo: `barber.soumanager.com` está **fixo por alias no deployment `4a6406c`** (promovido pelo workflow `Deploy Production (Promote Controlado)` em 2026-11-15T08:14:36Z) e **não se moveu em nenhum dos três merges**."

`docs/audit/MERGE_ROUND_20261116_PR319_PR321_PR322.md` §6, item 2:

> "Nenhum deploy de produção foi autorizado e nenhum foi publicado: o domínio `barber.soumanager.com` **permanece no deployment `4a6406c`**."

E, em relatório de sessão, a afirmação derivada de que `smg-barber.vercel.app` servia **código não publicado**, tratada como risco de exposição.

## 2. O que é verdade

Consulta ao **alias ao vivo** (`GET /v4/aliases/<domínio>`), 2026-11-17 ~04:55Z:

```
barber.soumanager.com   -> dpl_DKVdKhp4iBgus9i2S68QG9rUUXnp | sha=8686463 | production | READY
smg-barber.vercel.app   -> dpl_DKVdKhp4iBgus9i2S68QG9rUUXnp | sha=8686463 | production | READY
main (origin)           -> 3efbc1c   (merge do PR #328, posterior)
aliasAssignedAt         -> 2026-11-17T04:23:45.840Z
```

**Produção não estava em `4a6406c`.** A linha base real evoluiu por múltiplas promoções:

| Ordem | SHA | Run do workflow | `promote` | Estado final do run |
|---|---|---|---|---|
| 1 | `4a6406c` | 2026-11-15T08:14:36Z | success | success |
| 2 | `071dee4` | 2026-11-16T07:16:11Z | success | success |
| 3 | `893c578` | 2026-11-16T13:21:43Z | success | success |
| 4 | `65a13d4` | 2026-11-16T17:05:46Z | **success** | `cancelled` (post-validate pendente) |
| 5 | `8686463` | 2026-11-17T04:22:48Z | **success** | `waiting` (post-validate pendente) |

Leitura correta: em **nenhum momento** das últimas 48h o domínio público ficou congelado num deployment antigo por mecanismo próprio. Ele **acompanhou cada promoção**. A promoção de `65a13d4` (item 4) já havia ocorrido **antes** da verificação que embasou o 7.79.

### 2.1 Coerência com o registro 7.80

O registro **7.80** — de outra sessão — afirma corretamente que #323 (`893c578`) e #324 (`65a13d4`) foram **promovidos em produção**, citando os runs `43875020259` e `43914686929`. O 7.80 está certo; o 7.79 está errado. São registros contraditórios sobre o mesmo fato.

### 2.2 O falso positivo de exposição

`smg-barber.vercel.app` e `barber.soumanager.com` apontam para o **mesmo** deployment (`8686463`, e antes `65a13d4`). O subdomínio padrão acompanha a promoção, não o HEAD de `main`. Não havia código não publicado sendo servido: o deployment mais recente de `main` (`dpl_A1KJ…`, `3efbc1c`) **não tem alias público**.

A premissa do item **1b** do backlog ("fechar o `.vercel.app` que vaza código não homologado") **não se sustenta** como formulada. Precisa ser reenunciada antes de qualquer ação.

## 3. Causa raiz do erro (falha de método)

A verificação de produção usou um script que **continha o deployment hardcoded**:

```js
const pinned = await call(`/v13/deployments/dpl_28F64fFyr245j7rbhuYbv9snvhdw`);
console.log(`barber.soumanager.com -> ${pinned.url} | sha=${pinned.meta.githubCommitSha}`);
```

A primeira linha fixa `dpl_28F64…`; a segunda imprime os metadados **desse** deployment. O texto "`barber.soumanager.com` →" era rótulo, não resolução. O script respondia `4a6406c` **independentemente** de para onde o domínio apontava — e respondeu `4a6406c` várias vezes, em horas diferentes, o que foi lido como confirmação de estabilidade (*"não se moveu"*).

**INTERPRETATION:** o erro não foi de coleta, foi de **leitura de evidência**. Saída de script de aparência factual foi aceita sem checar se o comando consultava o alias. Um valor que nunca varia entre execuções deveria ter sido tratado como suspeito, não como confirmação.

**Regra derivada (para auditorias futuras):** verificação de estado externo deve **resolver o alvo** (`/v4/aliases/<domínio>` → `deploymentId` → detalhe do deployment), nunca reimprimir metadados de um identificador conhecido.

## 4. Achado novo — cancelar o run não desfaz a promoção

A trilha acima expõe um buraco no portão de certificação (`D-HOM-37` → `MERGE → PROMOTION → HEALTH → E2E SMOKE → PASS → PRODUÇÃO CERTIFICADA`):

- Run de `65a13d4`: `resolve & validate` success, **`promote` success**, `post-validate` aguardando → run terminou `cancelled`.
- Run de `8686463`: mesmo padrão — **`promote` success** (`aliasAssignedAt = 04:23:45Z`), `post-validate` aguardando (`waiting`).

**O job `promote` é o que move o alias, e ele é o segundo de três.** Cancelar (ou não aprovar) o `post-validate` **não reverte a produção** — só encerra o run. Resultado: é possível ter produção rodando código **nunca certificado**, com o histórico do Actions mostrando `cancelled`, o que sugere que nada foi publicado.

**EVIDENCE:** `aliasAssignedAt` do deployment servido = `2026-11-17T04:23:45.840Z`; o run correspondente está `cancelled`/`waiting`, não `success`.

## 5. O que permanece válido do achado original

Re-verificado em 2026-11-17 ~04:55Z, sem alteração:

```
commandForIgnoringBuildStep: ""
link.productionBranch:       "main"
createDeployments:           enabled
requireVerifiedCommits:      true
```

- O mecanismo do **Ignored Build Step** descrito no `AGENTS.md` **continua inexistente** (`""`). Todo merge em `main` gera deployment `target=production` `READY`.
- `requireVerifiedCommits: true` foi confirmado por evidência independente: o deployment de `9b844a1` (commit próprio) nasceu `BLOCKED` com `commit.verification.reason = "unsigned"`, enquanto o de `3efbc1c` (merge commit do GitHub) ficou `READY`.
- Branch protection de `main`: `required_status_checks = ["validate"]`, `strict = true`.

## 6. Status real do invariante ADR-026

`MERGE ≠ DEPLOY PROD` **não estava sendo sustentado por mecanismo algum** no período coberto. O que havia era disciplina de operadores — e ela foi violada nas duas primeiras horas do dia 17/11, com `main` promovida a produção sem `post-validate` concluído.

No instante desta errata: `main = 3efbc1c`, produção = `8686463`. Há separação de **1 commit**, mas por ausência de novo `promote` — **não** por bloqueio técnico.

## 7. GAP

1. **Histórico de atribuição de alias por deployment não é recuperável** pela API pública — a tabela da §2 foi reconstruída cruzando runs do workflow, `aliasAssignedAt` e SHAs, não por trilha de auditoria da Vercel.
2. **`post-validate` de `65a13d4` e de `8686463` não concluído.** Pela cadeia de `D-HOM-37`, a produção atual **não está certificada**. Não verifiquei se os smoke tests chegaram a rodar.
3. **Quem aprovou os promotes** não é identificável na API do GitHub por estes comandos (o Environment registra reviewer; não consultado).
4. **Item 1b precisa ser reenunciado** — a premissa de vazamento não se sustenta como escrita.
5. `ROADMAP.md` intocado (congelado desde 2026-07-24, sem fase nova).

## 8. DECISION

1. Errata registrada. Os registros 7.79 e o doc de rodada recebem **marcador inline** apontando para este documento; o texto original **não é reescrito** — trilha de auditoria preservada.
2. **Nenhuma alteração de infraestrutura** foi feita: `commandForIgnoringBuildStep` continua `""` (item 1a pendente de decisão do PO).
   > **⚠️ ATUALIZAÇÃO (2026-11-17, ADR-049 Accepted):** o item 1a foi **decidido e encerrado — rejeitado por incompatibilidade arquitetural**. O campo permanece `""` **deliberadamente**: ativar o comando com `exit 0` em produção cancelaria o build e eliminaria o deployment `target=production` que o `vercel promote` consome, deixando o único caminho de publicação sem candidato. A decisão de proveniência **P1** foi aprovada pelo PO e o texto original acima é preservado como trilha. Ver `docs/adr/ADR-049-deploy-gate-pre-atribuicao.md` (R1/R2) e `AGENTS.md` § Mecânica real de deploy (B).
3. Recomendações ao PO, fora do escopo desta errata:
   - decidir se `post-validate` de `8686463` é executado ou se produção é **reprovada** (rollback para deployment anterior via `promote` documentado no runbook);
   - reenunciar o item 1b com base na realidade de aliases;
   - considerar mover o `promote` para **depois** do `post-validate` no workflow, para que cancelamento signifique "nada publicado" — mudança de CI, exige PO + ADR.
