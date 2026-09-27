# Runbook P-AUTO — Promoção Controlada de Produção (Fase 1)

> **Decisão:** despacho PO 2026-09-26 — arquitetura **C+D**
> (C = GitHub Actions `workflow_dispatch` + Environment Protection;
> D = `vercel promote`). Registrado como **D-HOM-35** em `docs/BUSINESS_DECISIONS.md`.
>
> **Regra vinculante:** *MERGE = autorização para integrar código.
> DEPLOY = autorização separada para promover produção.*

---

## 1. Princípio

Após o merge em `main`, o Git Integration do Vercel **continua** criando um
deployment `Production – smg-barber` automaticamente (Fase 1 **NÃO** desliga o
auto-deploy — isso é Fase 2, gate próprio). O que a Fase 1 adiciona é o
**mecanismo controlado de promoção explícita** para os 3 projetos, com:

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

1. **`VERCEL_TOKEN` não existe como secret do repositório.** O job `promote`
   falha com mensagem explícita até o PO provisionar um **token granular**
   (escopo: Deployments + Projects, só para os 3 projetos) e cadastrá-lo como
   secret `VERCEL_TOKEN` (+ opcional `VERCEL_TEAM_SCOPE`). O token OAuth
   pessoal (`vca_…`) **não** deve ser copiado para o secret.
2. **Dry-run ao vivo só pós-merge** (limitação de `workflow_dispatch`, §3.1).
3. **Auto-deploy de produção continua ativo** (Git Integration) — eliminação é
   o critério da **Fase 2**, ainda não autorizada.
4. **Previews com deployment protection (login)** podem devolver 401/403 em
   checagens HTTP diretas — este runbook só valida domínios de produção.
5. O `deployment_status` → `deploy-validate.yml` **não** dispara em promoções
   via CLI (`vercel promote` não cria GitHub Deployment) — a pós-validação
   correspondente é o job `post-validate` deste workflow.

## 7. Limites desta frente (não autorizado)

Desligar auto-deploy · alterar `prodBranch` · branch `production` · promover sem
dispatch/aprovação · deploy direto fora deste workflow · alterar Supabase ·
mexer em D-HOM-27b · Q5–Q7 · excluir branches · merge sem `/approve` do PO.
