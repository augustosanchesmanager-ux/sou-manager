# Regras de Proteção de Branch — `main`

> Fase 6.1 — CI/CD / 6.4 — Hardening
> Documentação operacional das regras de proteção aplicadas à branch `main` no GitHub.
> Essas regras são configuradas na interface do GitHub (Settings → Branches), não via arquivo de configuração do repositório.

## Regras aplicadas à branch `main`

| Regra | Valor | Justificativa |
|-------|-------|---------------|
| **Branch protection enabled** | ✅ Sim | Impede pushes diretos e forçados em `main`. |
| **Require pull request reviews** | ✅ Sim | Todo PR exige aprovação de reviewer independente antes do merge. |
| **Required approving reviews** | 1 | Mínimo de uma aprovação (reviewer independente do autor). |
| **Dismiss stale reviews on new commits** | ✅ Sim | Novo commit invalida aprovações anteriores (reavaliação necessária). |
| **Require code owner review** | ❌ Não | Não há CODEOWNERS configurado no repo. |
| **Require status checks to pass before merging** | ✅ Sim | CI deve estar verde antes do merge. |
| **Required status checks** | `validate`, `build`, `typecheck`, `unit`, `architecture:ci` | Jobs obrigatórios do workflow `ci.yml`. |
| **Require branches to be up to date before merging** | ✅ Sim | O branch do PR deve estar sincronizado com `main`. |
| **Require conversation resolution before merging** | ✅ Sim | Comentários de revisão devem ser resolvidos. |
| **Include administrators** | ✅ Sim | Regras se aplicam também a administradores do repo. |
| **Restrict pushes** | ✅ Sim | Apenas quem tem permissão de escrita pode pushar; `main` não aceita push direto. |
| **Allow force pushes** | ❌ Não | Impede reescrita de histórico em `main`. |
| **Allow deletions** | ❌ Não | Impede exclusão acidental de `main`. |
| **Require linear history** | ❌ Não | Não exigido (merge commits e squash são aceitos). |
| **Require signed commits** | ❌ Não | Não exigido no momento. |

## Jobs do CI que protegem `main` (`.github/workflows/ci.yml`)

O job agregado `validate` depende de:

- `typecheck` — `tsc --noEmit` (bloqueador)
- `build` — `vite build` (bloqueador)
- `unit` — `vitest run` (bloqueador)
- `architecture:ci` — `node scripts/architecture/check.mjs --ci --baseline` (bloqueador)

Jobs advisory (não bloqueiam merge, `continue-on-error: true`):

- `lint` — `biome check src/` (apenas `src/`; `domain/`, `application/`, `components/`, `pages/`, `hooks/` da raiz não são lintados)
- `e2e-smoke` — `playwright test --grep @smoke` (exige `.env.local` com secrets reais; não executar sem autorização do PO)

## Workflows relacionados

| Workflow | Propósito |
|----------|-----------|
| `.github/workflows/ci.yml` | Integração contínua em PRs e push para `main`. |
| `.github/workflows/deploy-production.yml` | Promoção controlada de produção (workflow_dispatch, environment `Production` com required reviewer = PO). |
| `.github/workflows/deploy-validate.yml` | Validação pós-deployment (health + smoke advisory). |
| `.github/workflows/smg-approve.yml` | Automação de aprovação de PR via comando `/approve` do PO (review-bot-smg). |

## Regras de governança associadas

- **MERGE ≠ DEPLOY PROD** (ADR-026): merge em `main` não autoriza deploy de produção. Deploy requer gate separado (`deploy-production.yml` + aprovação do PO no environment `Production`).
- **Nenhum merge em `main` sem Authorization Record** no corpo do PR (bloco YAML `authorization_record`).
- **Alterar workflows/CI exige PO + ADR** (ADR-024 está *Proposed*).
- **Override de gate**: somente para falha de infraestrutura (nunca de lógica) e com autorização do PO (`docs/runbooks/ci-gate-override.md`).
- **`git diff --check` obrigatório** antes de qualquer commit.
