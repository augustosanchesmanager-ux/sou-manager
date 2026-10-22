---
name: smg-merge
description: "Coordena a integração e merge de branches após encerramento completo da fase e autorização."
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

# Skill: smg-merge

## Purpose
Merge only when every mandatory gate is satisfied.

## Preconditions
- correct PR and base branch
- intended head SHA verified
- CI required checks green
- E2E gate satisfied where required
- review requirements satisfied
- no unresolved blocking review comments
- explicit merge authorization

## Procedure
1. Re-read all gate evidence.
2. Verify PR head has not changed.
3. Confirm no new commits invalidated validation.
4. Merge using the approved method.
5. Record merge SHA and timestamp.
6. Hand off to post-merge/deploy gate.

## STOP
Any red, missing, stale or unverifiable mandatory gate.
