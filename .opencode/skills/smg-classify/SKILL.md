---
name: smg-classify
description: "Classifica o tipo, escopo, risco e requisitos de governança de uma mudança proposta."
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

# Skill: smg-classify

## Purpose
Classify files and changes into independent engineering fronts before implementation or commit.

## Procedure
1. Capture branch, HEAD and working-tree state.
2. Enumerate modified, staged and untracked files.
3. Group each file by front, ticket, migration, CI baseline, refactor, feature or unrelated work.
4. Infer relationships only when supported by diff/content.
5. Mark ambiguous files as UNKNOWN instead of assigning them by guess.
6. Produce an explicit scope manifest.

## STOP conditions
- A file belongs plausibly to multiple fronts and cannot be resolved.
- A migration appears unrelated to the active front.
- Existing work would be overwritten or discarded.
- The active front is not identifiable.

## Output
FRONT → files → rationale → confidence → excluded files → unresolved files → STATUS
