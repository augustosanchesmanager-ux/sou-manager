---
name: smg-change-control
description: "Coordena o protocolo formal de controle de mudanças SMG e transições entre fases."
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

# Skill: smg-change-control

## Purpose
Orchestrate the complete SMG change lifecycle without bypassing gates.

## State machine

INTAKE
→ AUDIT
→ CLASSIFY
→ [STOP if decision/authorization/scope gap]
→ ISOLATE
→ IMPLEMENT
→ VALIDATE
→ [STOP]
→ COMMIT AUTHORIZATION
→ COMMIT
→ [STOP]
→ PUSH AUTHORIZATION
→ PUSH
→ PR
→ CI / E2E
→ [STOP]
→ MERGE AUTHORIZATION
→ MERGE
→ POST-MERGE
→ DEPLOY AUTHORIZATION
→ DEPLOY
→ POST-DEPLOY
→ CLOSE

## Rules
- The orchestrator may invoke atomic skills but may not silently skip them.
- A STOP is a hard state, not a suggestion.
- A previous green result becomes stale when the commit changes.
- A new front discovered during execution creates a new classification decision; it is never silently absorbed.
- Production is always behind an explicit deployment gate.
- Database changes have an independent authorization gate.
- Maintain a front manifest throughout the lifecycle.

## Front manifest
For each front track:
- ID
- branch
- base
- scope
- excluded scope
- checkpoint
- implementation commit
- validation evidence
- PR
- CI/E2E status
- merge SHA
- deployment
- post-deploy verdict
- current state

## Output
Current state:
Next allowed transition:
Blocked by:
Evidence:
Decision required:
STATUS
