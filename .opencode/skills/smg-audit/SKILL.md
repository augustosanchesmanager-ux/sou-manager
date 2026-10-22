---
name: smg-audit
description: "Audita arquivos e o estado do sistema em modo estritamente read-only antes de alterações."
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

# Skill: smg-audit

## Purpose
Investigate a demand, bug, regression or technical concern and identify the most probable root cause without changing product code.

## Procedure
1. Establish the requested front, environment and business behavior.
2. Inspect relevant code, tests, schema, migrations, RPCs, RLS and integration boundaries.
3. Reproduce or trace the behavior when safely possible.
4. Map data flow: UI → application → domain → repository/Supabase.
5. Identify direct cause, contributing causes and unrelated observations.
6. Assess production, tenant, security, financial and UX impact.
7. Produce an auditable evidence record.
8. If evidence is insufficient, STOP rather than guessing.

## Output
- Diagnosis
- Classification
- Risk
- Evidence
- Root cause
- Impact
- Alternatives
- Recommendation
- Gaps
- Decision required
- STATUS
