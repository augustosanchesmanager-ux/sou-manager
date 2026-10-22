---
name: smg-deploy
description: "Executa procedimentos controlados de deploy e transição de ambiente sob autorização do PO."
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

# Skill: smg-deploy

## Purpose
Promote an approved change through Vercel/production under explicit gates.

## Preconditions
- merge completed
- deployment target/project/environment verified
- preview validation completed where applicable
- required environment variables/configuration verified
- explicit deploy authorization
- production-impact assessment complete

## Procedure
1. Verify project and environment.
2. Verify deployment source commit.
3. Deploy/promote only the approved artifact.
4. Inspect deployment/build result.
5. Do not perform database migrations unless separately authorized.
6. Hand off to post-deploy verification.

## STOP
Wrong project, wrong environment, unknown source commit, failed build, missing authorization or unresolved production risk.
