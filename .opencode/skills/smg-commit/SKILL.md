---
name: smg-commit
description: "Prepara e executa commits semânticos atômicos após aprovação formal do gate correspondente."
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

# Skill: smg-commit

## Purpose
Prepare and create a commit containing only the authorized front.

## Preconditions
- scope manifest exists
- isolation verified
- validation gates passed
- `git diff --check` passed
- no unresolved unrelated changes
- explicit commit authorization exists

## Procedure
1. Re-check branch and HEAD.
2. Review staged diff file-by-file.
3. Confirm no secrets, generated noise or unrelated changes.
4. Stage only approved files.
5. Re-run `git diff --cached --check`.
6. Create a focused commit with a descriptive message.
7. Record commit SHA and included files.

## STOP
If scope, authorization or validation is incomplete.
