---
name: smg-evidence
description: "Coleta e formata evidências técnicas reproduzíveis para suporte à tomada de decisão."
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

# Skill: smg-evidence

## Purpose
Turn an investigation into a durable, audit-ready evidence artifact.

## Required structure
- Front / ID
- Objective
- Environment
- EVIDENCE
- REPRODUCTION
- DATA FLOW
- ROOT CAUSE
- IMPACT
- ALTERNATIVES
- RECOMMENDATION
- RISKS
- GAPS
- DECISION NEEDED
- STATUS

## Rules
Never present inference as fact. Every important claim must point to a file, line, test, schema, runtime observation or reproduction when available.
