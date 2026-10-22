---
name: smg-pr
description: "Prepara pull requests estruturados com rastreabilidade documental completa para revisão."
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

# Skill: smg-pr

## Purpose
Open or review a pull request as a controlled gate.

## Procedure
1. Verify source branch, target branch and commit range.
2. Compare changed files against the front manifest.
3. Confirm validation evidence.
4. Create/update PR with scope, evidence, risks, tests and manual validation.
5. Inspect CI/status checks and review feedback.
6. Keep PR draft when required gates are incomplete.

## Never
- Hide unrelated changes.
- Claim CI is green without checking.
- Treat branch-protection assumptions as proven without evidence.
