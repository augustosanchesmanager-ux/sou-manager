---
name: smg-isolate
description: "Cria e gerencia ambientes isolados via git worktree para execução segura de mudanças."
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

# Skill: smg-isolate

## Purpose
Safely isolate one engineering front without losing unrelated work.

## Procedure
1. Verify repository and current branch.
2. Capture `git status`, current HEAD and relevant diff.
3. Create a checkpoint before isolation.
4. Build the front manifest from `smg-classify`.
5. Preserve unrelated modifications exactly.
6. Isolate only approved files/changes.
7. Verify with `git status`, `git diff` and `git diff --check`.
8. Record checkpoint and resulting state.

## STOP conditions
- Isolation would require destructive reset without explicit approval.
- Unrelated work cannot be preserved safely.
- Branch/front identity is ambiguous.
