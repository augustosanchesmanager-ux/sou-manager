# ADR-048: Gate Controlado para Aplicação de Migrations Supabase em Produção

**Status:** Accepted
**Date:** 2026-11-12
**Deciders:** PO (Augusto) + Antigravity
**References:**
- [`ADR-022-ci-policy-quality-gates.md`](./ADR-022-ci-policy-quality-gates.md)
- [`ADR-026-merge-not-equal-deploy-prod-gate.md`](./ADR-026-merge-not-equal-deploy-prod-gate.md)
- [`AGENTS.md`](../../AGENTS.md)
- [`.github/workflows/deploy-production.yml`](../../.github/workflows/deploy-production.yml)

---

## Context

O fluxo de frontend em produção já segue o princípio **`MERGE ≠ DEPLOY PROD`** (ADR-026): merges na branch `main` não publicam automaticamente em produção; a promoção ocorre apenas via `workflow_dispatch` manual com confirmação dupla e aprovação humana no GitHub Environment `Production` (`.github/workflows/deploy-production.yml`).

Para o banco de dados Supabase, migrations versionadas em `supabase/migrations/` precisam de um mecanismo reproduzível e auditável para aplicação no projeto remoto de produção, respeitando a regra normativa do `AGENTS.md`:
- *Aplicar migration no banco remoto de produção exige aprovação explícita do PO.*
- *Alterar ou criar workflows de CI/CD exige autorização do PO + ADR.*

## Problem

Um workflow disparado automaticamente por `on: push` em `main` (`paths: ['supabase/migrations/**']`) violaria o princípio `MERGE ≠ DEPLOY PROD` caso o environment não esteja protegido ou caso haja necessidade de coordenar ordem entre migration e promoção do frontend. Além disso, execuções concorrentes ou fora do `HEAD` da `main` oferecem risco de corrida e regressão de schema.

## Decision

Adotar o workflow [`.github/workflows/cd-migrations.yml`](../../.github/workflows/cd-migrations.yml) (`CD - Apply Supabase Migrations (Controlado)`) seguindo o mesmo padrão de governança do `deploy-production.yml`:

1. **Disparo exclusivamente manual (`workflow_dispatch`):** nunca executa automaticamente no merge em `main`.
2. **Inputs obrigatórios de auditoria e segurança:**
   - `authorization_ref` (obrigatório): referência da autorização do PO;
   - `dry_run` (`boolean`, padrão `true`): executa `supabase db push --dry-run` para pré-visualizar migrations pendentes sem alterar o banco;
   - `confirm`: quando `dry_run=false`, exige digitação exata de `supabase-prod`.
3. **Environment `Production` obrigatório:** utiliza exatamente o Environment `Production` (P maiúsculo), reutilizando os revisores humanos configurados no repositório.
4. **Concorrência serializada (`cancel-in-progress: false`):** impede duas execuções simultâneas de `supabase db push` contra produção.
5. **Guard anti-regressão:** antes de aplicar (`dry_run=false`), valida que `$GITHUB_SHA` coincide com o `HEAD` atual de `main`.
6. **Segredos necessários no GitHub (`Settings > Secrets and variables > Actions`):**
   - `SUPABASE_ACCESS_TOKEN`
   - `SUPABASE_PROJECT_ID`
   - `SUPABASE_DB_PASSWORD`

## Alternatives Considered

- **`on: push` em `main` com `environment: production` (minúsculo):** descartado por quebrar `MERGE ≠ DEPLOY PROD` e pelo risco de criar um environment paralelo sem proteção de revisores obrigatórios.
- **Aplicação apenas local via CLI do desenvolvedor:** descartado como padrão exclusivo por não gerar trilha centralizada no GitHub Actions (`GITHUB_STEP_SUMMARY`) vinculada ao commit e `authorization_ref`.

## Consequences

- **Positivas:** trilha completa de auditoria, dry-run padrão antes de qualquer mutação, proteção contra execução concorrente e alinhamento integral com ADR-026 e `AGENTS.md`.
- **Operacionais:** após o merge de uma migration em `main`, o PO (ou operador autorizado) deve acionar manualmente o workflow `CD - Apply Supabase Migrations (Controlado)` e aprovar no Environment `Production`.
