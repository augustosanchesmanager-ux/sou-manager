---
name: smg-push
description: "Envia commits e tags anotadas aos repositórios remotos sob aprovação do gate correspondente."
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

# Skill: smg-push

## Purpose
Push an already validated commit/branch only after explicit authorization.

## Preconditions
- explicit PO authorization to push
- branch is correct
- commit SHA is known
- working tree state is understood
- no unexpected commits are present

## Procedure
1. Verify remote/branch target.
2. Verify local commit ancestry.
3. Push only the intended branch.
4. Record remote result and SHA.
5. Do not merge, deploy or rewrite history as part of this skill.

## STOP
Any uncertainty about destination, authorization, branch, or remote state.
