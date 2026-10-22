---
name: smg-implement
description: "Executa modificações mínimas de código conforme o plano aprovado para a subfase."
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

# Skill: smg-implement

## Purpose
Implement only an explicitly approved front.

## Procedure
1. Read the approved scope and evidence.
2. Verify branch and isolated working tree.
3. Make the smallest viable change.
4. Preserve existing domain rules unless the decision explicitly changes them.
5. Add/update tests for the intended behavior.
6. Do not expand scope opportunistically.
7. Do not apply migrations or production writes.
8. Return changed files, rationale, risks and validation needed.

## STOP conditions
- Requested behavior conflicts with an existing domain decision.
- Implementation requires a migration/RLS/RPC/security change not explicitly authorized.
- Unrelated code must be changed to proceed.
