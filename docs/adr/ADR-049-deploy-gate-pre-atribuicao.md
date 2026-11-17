# ADR-049: Gate de Deploy Pré-Atribuição — Smoke antes do Promote

**Status:** Accepted (2026-11-17 — PO aprovou **P1** como proveniência oficial do artefato e declarou o **item 1a obsoleto por incompatibilidade arquitetural**; ver [Ratificação](#ratificação-po-2026-11-17))
**Date:** 2026-11-17
**Deciders:** PO (Augusto) + OpenCode
**Requested by:** PO, 2026-11-17 — "o fluxo deve executar o smoke test diretamente contra o endpoint único gerado pelo build; somente após health check == 200 e smoke E2E == PASS no deployment isolado o `promote` é autorizado a transferir os aliases públicos"
**References:**
- `docs/audit/ERRATA_20261117_PRODUCTION_BASELINE.md` — evidência que originou este ADR
- [ADR-026](./ADR-026-merge-not-equal-deploy-prod-gate.md) — `MERGE ≠ DEPLOY PROD`, Gate C+D (Amd-01, Amd-02)
- `.github/workflows/deploy-production.yml` — implementação atual do gate
- `AGENTS.md` — seção "Mecânica real de deploy (Vercel `smg-barber`)"

---

## Context

Fatos verificados em 2026-11-17 (read-only):

1. O workflow `Deploy Production (Promote Controlado)` encadeia três jobs: `resolve-validate` → `promote` → `post-validate`.
2. O job `promote` é o que move os aliases públicos: `vercel promote <deployment>`. Log do run `44016768007`: `Promovendo deployment: smg-barber-jwacaxxdv-…` (`dpl_DKVd…`, `target=production`).
3. O `post-validate` roda health check + E2E smoke contra o **domínio público** — depois que o alias já aponta para o deployment novo.
4. Consequência observada: dois deployments serviram produção com `post-validate` em `cancelled`/`waiting` (`65a13d4` e `8686463`). Cancelar o run **não reverte o alias**: o Actions mostra `cancelled` enquanto a produção segue publicada. Código não certificado ficou em produção por ~25 minutos.
5. `commandForIgnoringBuildStep = ""` no projeto `smg-barber`: o Ignored Build Step descrito no `AGENTS.md` **não está ativo**. Cada merge em `main` gera deployment `target=production` `READY`, sem alias de domínio — porque o domínio é atribuído manualmente pelo `promote`.

Posição atual, em uma frase: **o gate é pós-atribuição.** Falha no smoke produz incidente em vez de evitar incidente.

## Problem

Como transformar o `post-validate` de **alarme pós-acontecimento** em **gate de contenção** — garantindo que o alias público só aponte para um artefato que já passou por health check e E2E smoke — mantendo as restrições vigentes:

- Plano Vercel **Hobby** (sem approval-gate nativo de produção);
- caminho único de publicação = `workflow_dispatch` + Environment `Production` + `vercel promote`;
- proibição de `vercel --prod` / `vercel deploy --prod` por CLI a partir de checkout local (`AGENTS.md`, item (D));
- alteração de workflow/CI exige PO + ADR.

## Decision

Adotar o **gate pré-atribuição**:

1. O candidato a produção é um deployment **sem alias público** (URL única do próprio deployment).
2. `resolve-validate` mantém guardrails, resolve `deployment_url` e verifica que o SHA é o HEAD de `main` (guard anti-regressão já existente).
3. Um job de validação roda **health check + E2E smoke contra a URL do candidato**, com `PLAYWRIGHT_BASE_URL` apontando para o deployment, **não** para `barber.soumanager.com`.
4. Somente com essa validação em `success` o job `promote` é autorizado a mover os aliases públicos.
5. O `post-validate` deixa de ser a única barreira e passa a verificar **convergência**: que o alias responde e serve o SHA promovido.

Resultado pretendido: falha de smoke = **deploy abortado**, com produção intocada. E `run cancelled` deixa de ter ambiguidade — se o `promote` não rodou, nada foi publicado.

**Implementação é frente separada.** Este ADR apenas registra a decisão; alterar `deploy-production.yml` exige autorização explícita do PO.

### Decisão acoplada: proveniência do artefato e o destino do item 1a

A investigação revelou uma **incompatibilidade de arquitetura** que precisa ser decidida junto, sob pena de o gate novo não ter candidato:

- Hoje o `promote` consome um deployment `target=production` que a Vercel builda automaticamente no merge.
- Se o `commandForIgnoringBuildStep` for restaurado com o comando canônico (`exit 0` quando `VERCEL_ENV=production`), **nenhum deployment `target=production` é criado** para `main`. Não há artefato para promover, e o único caminho de publicação deixa de funcionar.
- Portanto: **o item 1a não é "um freio que foi removido" — é incompatível com o fluxo de promote implementado.** Restaurá-lo sem definir a proveniência do artefato quebra a publicação.

Alternativas de proveniência:

| Alt | Descrição | Prós | Contras |
|---|---|---|---|
| **P1** | Manter `commandForIgnoringBuildStep` vazio: produção builda, não recebe alias de domínio até o `promote` | É o estado atual; zero mudança de infra; blue/green efetivo na prática | Consome cota de build em todo merge; aliases de sistema (`*.vercel.app`) acompanham a produção |
| **P2** | Configurar `main` para gerar **preview** e promover o preview | Elimina deployment de produção automático | Depende de configuração da Vercel não verificada para o par produção-branch/test-target |
| **P3** | `vercel build` + `vercel deploy --prebuilt` em CI, promovendo o artefato | Controle total do artefato e do alvo | Introduz deploy por CLI em CI — fronteira com a proibição (D) do `AGENTS.md`; mais superfície a auditar |
| **P4** | Ignored Build Step ativo + Deploy Hook/caminho externo de build para o candidato | Elimina build redundante | Cria novo caminho de build a manter, versionar e auditar |

**Recomendação registrada neste ADR:** adotar **P1** como proveniência explícita e **encerrar o item 1a como "manter vazio por decisão"**, registrando o fato — em vez de deixá-lo como pendência que sugere falha de configuração. P1 já entrega o isolamento pretendido (build sem alias) e P2–P4 acrescentam superfície sem reduzir risco proporcionalmente.

Se o PO preferir P2–P4, o gate pré-atribuição continua válido; muda apenas a origem do candidato.

## Alternatives Considered

- **A — Manter pós-atribuição e aceitar `post-validate` como alarme.** Rejeitada: contraria o propósito de gate; o custo é incidente em produção.
- **B — Rollback automático quando o smoke falhar.** Parcialmente viável, mas rollback em produção é operação destrutiva que exige autorização, e ainda assim expõe o usuário por minutos.
- **C — Aprovação humana adicional entre validação e `promote`.** Rejeitada: o Environment `Production` já provê aprovação no `promote`; duplicar gera atrito sem ganho de segurança.
- **D — Validar em staging e promover o artefato de produção.** Rejeitada: staging tem outro SHA e outro build; smoke em staging não prova o bundle promovido.

## Consequences

Positivas:
- Alias público só aponta para artefato aprovado em health check + E2E smoke.
- `cancelled`/`waiting` deixa de ser ambíguo: run `success` ⟺ publicação efetiva.
- Trilha de auditoria coerente com `D-HOM-37` (`MERGE → PROMOTION → HEALTH → E2E SMOKE → PASS → PRODUÇÃO CERTIFICADA`).

Negativas / custos:
- O caminho crítico fica mais longo: o smoke passa a acontecer **antes** do promote, somando ~2 min à publicação.
- O smoke roda contra URL de deployment, não contra o domínio: diferenças de cookie/domínio, CORS e redirects precisam ser validadas (risco de falso negativo).
- Exige mexer em `deploy-production.yml` — mudança de CI, com gates próprios.

## Ratificação (PO, 2026-11-17)

Status alterado de **Proposed** para **Accepted**. Três decisões, tomadas pelo PO na mesma deliberação:

### R1 — Proveniência **P1** aprovada como diretriz oficial da plataforma

`commandForIgnoringBuildStep` permanece **vazio**. O ciclo nativo de Git integration da Vercel compila o artefato de produção **sem atribuir o alias público**; a validação roda sobre a URL imutável do deployment (`dpl_xxx.vercel.app`) e somente o veredito positivo dispara o apontamento dos domínios oficiais.

**Confirmação empírica (2026-11-17T05:38:55Z, resolução ao vivo):** 3 segundos após o merge do PR #331 (`3ea41c5`), a Vercel iniciou o deployment `dpl_JDdQUjmPYZEgUjQv4JmG7ZHVBy3w` — `target=production`, `source=git`. Estado resolvido pela API v13: `readyState=READY`, `meta.githubCommitSha=3ea41c57fc9f4009e90f32a0bd370ecbc9fd555a`, URL `smg-barber-3yekwqdhd-augustosanchesmanager-uxs-projects.vercel.app`, respondendo **HTTP 200 sem autenticação** (`server: Vercel`). É exatamente o candidato isolado descrito em P1: existe, está pronto e **não recebe o domínio público** até o `promote`.

Esse `HTTP 200` fecha o GAP de Deployment Protection: deployments `target=production` são publicamente acessíveis, portanto o smoke pré-atribuição é tecnicamente viável contra a URL do candidato.

### R2 — Item 1a declarado **obsoleto por incompatibilidade arquitetural**

O item 1a (`commandForIgnoringBuildStep`) **deixa de ser pendência de infraestrutura** e passa a **rejeitado**. Fundamento: com o comando canônico ativo, `exit 0` quando `VERCEL_ENV=production` **cancelaria o build** — e o candidato `dpl_JDdQ…` não existiria. Sem artefato pré-construído e isolado em `target=production`, a esteira perde a capacidade de testar o candidato exato antes do `promote`. **A existência do build desacoplado do alias é a fundação do gate Blue/Green.**

Consequência operacional: **não restaurar** o campo. O invariante `MERGE ≠ DEPLOY PROD` é sustentado pela aprovação manual no Environment `Production` e pelo `vercel promote`, não por esse mecanismo. Registrado em `AGENTS.md` para que nenhuma sessão futura "corrija" a configuração e derrube a publicação.

### R3 — Escopo da implementação

O desenho cirúrgico do workflow está em `docs/audit/2026-11-17-deploy-gate-implementation-plan.md`. Alterar `.github/workflows/deploy-production.yml` é **mudança de CI** e exige autorização própria do PO — não é executada por este ADR.

## Status

**Accepted (2026-11-17).** As três pendências da versão *Proposed* estão resolvidas:

1. desenho do gate pré-atribuição — **aprovado** (seções Decision e Ratificação);
2. proveniência do artefato — **P1 aprovada** (R1); P2–P4 permanecem sem verificação técnica e não são adotadas;
3. destino do item 1a — **rejeitado por incompatibilidade arquitetural** (R2).

**Nenhum arquivo de workflow, configuração de infraestrutura ou código foi alterado por este ADR.** A implementação é frente separada, com gate próprio.
