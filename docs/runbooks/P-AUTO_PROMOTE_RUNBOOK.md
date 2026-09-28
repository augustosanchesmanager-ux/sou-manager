# Runbook P-AUTO — Promoção Controlada de Produção (Fase 1)

> **Decisão:** despacho PO 2026-09-26 — arquitetura **C+D**
> (C = GitHub Actions `workflow_dispatch` + Environment Protection;
> D = `vercel promote`). Registrado como **D-HOM-35** em `docs/BUSINESS_DECISIONS.md`.
>
> **Regra vinculante:** *MERGE = autorização para integrar código.
> DEPLOY = autorização separada para promover produção.*
>
> **Amendment-01 (2026-09-27) — Staged Production:** direção ratificada pelo PO
> (D1–D4; `docs/adr/ADR-026-merge-not-equal-deploy-prod-gate.md`,
> `docs/audit/P_AUTO_STAGED_CHANGE_PLAN_20260927.md`). Após a **execução do toggle**
> `Auto-assign Custom Production Domains` = OFF no projeto `smg-barber` (somente pelo PO,
> após STOP #3 do plano), o merge em `main` passa a criar deployments **staged**
> (build ok, **domínio não muda**) e o `promote` passa a mover o alias de fato.
> **Enquanto o toggle estiver ON, vigia o modelo da Fase 1** (auto-assign ativo —
> `promote` do deployment de `main` retorna 409 estrutural, evidência no gate do PR #93).

---

## 1. Princípio

Após o merge em `main`, o Git Integration do Vercel **continua** criando um
deployment `Production – smg-barber` automaticamente (a Fase 1 **NÃO** desliga o
build automático). Com o **Amendment-01 executado** (toggle `Auto-assign Custom
Production Domains` = OFF), esse deployment nasce **staged**: build com env de
produção, mas o **domínio de produção não muda** — o alias só se move via
`promote`. O que a Fase 1 adiciona é o **mecanismo controlado de promoção
explícita** para os 3 projetos, com:

1. **Dispatch manual** (`workflow_dispatch`) — nada promove sozinho por este workflow;
2. **`dry_run=true` por padrão** — dispatch acidental nunca promove;
3. **Confirmação dupla** — `dry_run=false` exige `confirm` idêntico ao nome do projeto
   e `deployment_url` preenchido;
4. **Environment Protection** — o job `promote` referencia o environment GitHub
   `Production`, que possui **required reviewer = PO**
   (`augustosanchesmanager-ux`, id `259449180`): a execução fica **pausada até o PO
   aprovar**;
5. **Trilha de auditoria** em `$GITHUB_STEP_SUMMARY` (projeto, domínio, SHA,
   deployment alvo, authorization_ref, executor, timestamp, resultado dos jobs).

## 2. Mapeamento (3 projetos)

| Projeto Vercel | Projeto ID | Domínio de produção | Environment GitHub acionado |
|---|---|---|---|
| `smg-barber` | `prj_M3cJ2cZosLONAt9IzumF2LwJZTSj` | https://barber.soumanager.com | `Production` (reviewer: PO) |
| `smg-barber-staging` | `prj_5qoCiw7lwSZnKgB6UcS7kSNQqRAk` | https://staging.barber.soumanager.com | `Production` (reviewer: PO) |
| `smg-estetica` | `prj_my8ykBB67rDKQZi4RKPtv7MotAC2` | https://estetica.soumanager.com.br | `Production` (reviewer: PO) |

Legado `sou-manager` (`prj_fnQHNKxQR2XRMhAg5y9eA0qwyIN3`): **fora de escopo**
(sem gitLink, decisão D-HOM-11 pendente de gate próprio).

## 3. Procedimento de promoção

### 3.1 Dry-run (sempre primeiro)

Actions → **Deploy Production (Promote Controlado)** → *Run workflow*:

| Input | Valor |
|---|---|
| `project` | um dos 3 projetos da tabela |
| `sha` | SHA de `main` que se pretende promover (auditoria) |
| `authorization_ref` | referência da autorização do PO (PR/decisão) |
| `deployment_url` | vazio |
| `dry_run` | **true** (padrão) |
| `confirm` | vazio |

O dry-run executa somente `resolve-validate` (read-only: guardrails + listagem de
candidatos via GitHub Deployments API) e grava a trilha de auditoria. **Não requer
aprovação de environment e não toca em produção.**

> **Limitação:** `workflow_dispatch` só aparece se o arquivo existir na default
> branch — o primeiro dry-run ao vivo só é possível **após o merge deste PR**
> (a validação estática pré-merge é feita no gate desta fase).

### 3.2 Promoção real (duas aprovações)

0. **Preflight do candidato:** `vercel inspect <domínio de produção>` → confirmar que o
   deployment **atual (Current)** é **diferente** do candidato a promover (com Amendment-01
   executado, o candidato originado de `main` deve estar **staged**, nunca `Current`). Se o
   candidato já for `Current`, **abortar o dispatch** — o auto-assign está ON (toggle
   religado ou mudança ainda não executada; ver §7).
1. Recuperar o **deployment alvo** (ID ou URL Vercel):
   `GET /v6/deployments?projectId=<id>&target=production` (ou o deployment desejado
   via `vercel ls <projeto> --token <token>`).
2. Dispatch com:

| Input | Valor |
|---|---|
| `project` | projeto alvo |
| `sha` | SHA de origem |
| `authorization_ref` | **obrigatório** — referência da autorização do PO |
| `deployment_url` | ID/URL do deployment a promover (**obrigatório**) |
| `dry_run` | **false** |
| `confirm` | exatamente o nome do projeto (**obrigatório**) |

3. **Aprovação 1 (humana):** o job `promote` fica `waiting` no Environment
   `Production` até o **PO aprovar**.
4. **Aprovação 2 (mecânica):** guardrails recusam a execução se `confirm ≠ project`
   ou `deployment_url` vazio.
5. `vercel promote <deployment>` executa (requer secret `VERCEL_TOKEN` — ver §6).
6. `post-validate` roda health check no domínio (HTTP 200, até 300s) + smoke E2E
   (`test:e2e:smoke`) **somente quando o promote foi bem-sucedido**, e grava a
   trilha final.

> **Regra D3 (política de candidato — Amendment-01):** o candidato aprovado é a
> **SHA registrada no `dispatch`**. Pushes posteriores em `main` criam um novo
> candidato e exigem novo ciclo de aprovação — **o artefato aprovado pelo PO é
> exatamente o artefato que chega à produção** (promote staged não rebuilda:
> mesmo deployment ID, mesma build).

### 3.3 Pós-promoção

- Conferir domínio alvo no navegador (login GoTrue + dashboard).
- Conferir a trilha de auditoria no run do workflow (campos obrigatórios:
  projeto, SHA, deployment alvo, authorization_ref, executor, timestamp).

## 4. Rollback

Promover o **deployment anterior conhecido** com o mesmo mecanismo:

1. Identificar o último deployment `success` anterior (`vercel ls` / API
   `GET /v6/deployments`);
2. Dispatch `dry_run=false` com `deployment_url` = deployment anterior,
   `authorization_ref` = nova autorização do PO, `confirm` = nome do projeto;
3. Aprovar no Environment;
4. Validar domínio (health + smoke).

Rollback é **promoção de deployment antigo**, não `vercel rollback` cego — o
alvo fica explícito na trilha de auditoria.

## 5. Trilha de auditoria

Todo dispatch grava no `$GITHUB_STEP_SUMMARY`:

| Campo | Origem |
|---|---|
| Projeto / Domínio | inputs + mapeamento fixo |
| SHA informado + commit do run | inputs + `$GITHUB_SHA` |
| Deployment alvo | `deployment_url` (ou "dry-run") |
| Dry run | input `dry_run` |
| Authorization ref | input obrigatório |
| Executor | `$GITHUB_ACTOR` |
| Resultado resolve-validate / promote | `needs.*.result` |
| Timestamp | UTC ISO |

## 6. GAPs conhecidos (Fase 1)

1. ~~**`VERCEL_TOKEN` não existe como secret do repositório.**~~ **SUPERADO**
   (evidência: gate `36347757267` — o job `promote` chegou à API do Vercel e
   retornou 409 semântico, não "token ausente"). Manter o secret como **token
   granular** (escopo: Deployments + Projects, só para os 3 projetos; opcional
   `VERCEL_TEAM_SCOPE`); o token OAuth pessoal (`vca_…`) **não** deve ser
   copiado para o secret.
2. **Dry-run ao vivo só pós-merge** (limitação de `workflow_dispatch`, §3.1).
3. **Auto-assign de produção** (Git Integration) — **em transição**: com o
   Amendment-01 (Staged Production), o toggle `Auto-assign Custom Production
   Domains` será desligado exclusivamente pelo change-control
   (`docs/audit/P_AUTO_STAGED_CHANGE_PLAN_20260927.md`, STOP #3, executor = PO).
   O **build** automático de `main` continua; o que deixa de acontecer é o
   movimento automático do alias. Enquanto o toggle estiver ON, vigia o modelo
   Fase 1 (409 estrutural no promote do deployment de `main`).
4. **Previews com deployment protection (login)** podem devolver 401/403 em
   checagens HTTP diretas — este runbook só valida domínios de produção.
5. O `deployment_status` → `deploy-validate.yml` **não** dispara em promoções
   via CLI (`vercel promote` não cria GitHub Deployment) — a pós-validação
   correspondente é o job `post-validate` deste workflow.
   **ACHADO INDEPENDENTE (congelado):** a condição do job
   (`deployment.ref == 'refs/heads/main'`) **nunca é satisfeita** — `vercel[bot]`
   passa SHA e o GitHub Actions environment passa `main`; 7/7 runs pós-merge do
   gate do PR #93 terminaram `skipped`. O workflow é inalcançável em qualquer
   mundo, inclusive pós-promote. Decisão própria futura (corrigir a condição
   **ou** aposentar via ADR) — **nunca misturar com esta frente**.

## 7. Limites desta frente (não autorizado)

Desligar o Git Integration (build automático) · alterar `prodBranch` · branch
`production` · trocar `Auto-assign Custom Production Domains` **fora** do
change-control P-AUTO Staged (único caminho autorizado: STOP #3 do
`docs/audit/P_AUTO_STAGED_CHANGE_PLAN_20260927.md`, executor = PO) · promover
sem dispatch/aprovação · deploy direto fora deste workflow · alterar Supabase ·
mexer em D-HOM-27b · Q5–Q7 · excluir branches · merge sem `/approve` do PO ·
editar `deploy-production.yml` ou `deploy-validate.yml` nesta frente (guardrail
e correção de `ref` = frentes futuras separadas).
