---
name: smg-e2e
description: "Executa e valida a suíte de testes de ponta a ponta (E2E) com Playwright."
autoinvoke: "false"
---

# SMG Engineering Governance

These skills operate on SMG — Sou.Manager, a production multi-tenant SaaS using React/TypeScript, Supabase/PostgreSQL, RPCs, RLS, migrations, Vercel and integrations.

## Non-negotiable invariants

- Never alter production during investigation.
- Never apply a migration, change RLS/RPC/security policy, or mutate production data without explicit PO authorization.
- Never mix unrelated fronts in the same implementation, commit or PR.
- Never commit from an unverified/mixed working tree.
- Never push without explicit authorization.
- Never merge while a mandatory gate is red, unknown, or bypassed.
- Never change a test merely to make it pass without proving the product behavior is correct.
- Always preserve multi-tenancy and tenant isolation.
- Always distinguish EVIDENCE, INTERPRETATION, GAP, DECISION and STATUS.
- Always run `git diff --check` before a commit.
- Prefer minimal, reversible changes.
- STOP whenever a required decision, authorization, environment, scope, or evidence is missing.
- Treat financial data, permissions, RLS, RPCs, migrations and production as high-risk by default.

## Standard evidence record

EVIDENCE:
- file/path/line, observed behavior, test, schema or reproduction

INTERPRETATION:
- what the evidence means

GAP:
- what is not yet proven

DECISION:
- approved / rejected / pending PO decision

STATUS:
- CONTINUE or STOP

# Skill: smg-e2e

## Purpose
Run and interpret end-to-end validation.

## Procedure
1. Verify environment and target deployment.
2. Verify test data and authorization path.
3. Run smoke/core suite first.
4. Run front-specific flows.
5. Capture failures with exact test, route, expected/actual behavior and logs.
6. Compare against known baseline to separate new from pre-existing failures.
7. Never weaken assertions just to obtain green.
8. Produce a gate report.

## Output
Suite | tests | passed | failed | duration | baseline comparison | verdict

Verdict:
- PASS
- FAIL
- BLOCKED
- INCONCLUSIVE
