---
name: smg-postdeploy
description: "Conduz verificações de integridade, smoke tests e observabilidade pós-deploy em produção."
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

# Skill: smg-postdeploy

## Purpose
Verify production after a deployment.

## Procedure
1. Verify deployed version/commit.
2. Run smoke/core flows.
3. Check critical routes and integrations.
4. Inspect runtime errors/logs when available.
5. Validate critical business invariants, especially financial and tenant isolation behavior.
6. Compare against pre-deploy baseline.
7. Record incidents, regressions or rollback recommendation.

## Verdict
HEALTHY / DEGRADED / FAILED / INCONCLUSIVE
