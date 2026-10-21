---
description: Deployment command and governance protocol for SMG releases. Enforces SMG Change Control and PO authorization gates.
---

# /deploy - SMG Production Deployment Governance

$ARGUMENTS

---

## 🛑 MANDATORY GOVERNANCE GATE (ADR-026 & SMG PROTOCOL)

> **CRITICAL INVARIANT:** `MERGE ≠ DEPLOY PROD` (ADR-026).
> An agent is **STRICTLY FORBIDDEN** from running automated production deployments (e.g. `vercel --prod`) or bypassing tests.
> Every deployment requires:
> 1. Complete validation passing through `npm run smg:verify` and CI gates.
> 2. Explicit, documented and individual authorization from the human Product Owner (**Augusto**).
> 3. Execution exclusively through the formal `smg-deploy` gate protocol.

---

## Sub-commands

```
/deploy check      - Run pre-deployment local verification (npm run smg:verify)
/deploy status     - Check CI and environment gate status
/deploy request    - Generate formal Deployment Authorization Request for PO (Augusto)
```

> **BANNED:** Flags such as `--skip-tests` or direct CLI deployment execution are strictly prohibited.

---

## Pre-Deployment Verification Checklist

Before requesting any deployment authorization to the PO:

```markdown
## 🛡️ SMG Pre-Deploy Checklist

### Code Quality & Type Safety
- [ ] TypeScript compilation passing (`npx tsc --noEmit`)
- [ ] Architecture guards passing (`node scripts/architecture/check.mjs --ci --baseline`)
- [ ] Unit test suite passing (`npm test`)

### Security & Multi-tenancy
- [ ] No hardcoded secrets or credentials detected
- [ ] Database migrations strictly enforce `tenant_id` and RLS
- [ ] No direct bypass of Supabase RLS policies

### Governance
- [ ] Change isolated in dedicated branch
- [ ] Working tree clean (`git status --short`)
- [ ] `git diff --check` cleanly passed
- [ ] Explicit PO deployment authorization recorded

### Ready to submit for PO Approval? (STOP/GATE)
```

---

## Deployment Governance Flow

```
┌─────────────────────────────────┐
│  /deploy check                  │
│  (npm run smg:verify)           │
└────────────────┬────────────────┘
                 │
            Pass? ──No──► STOP & Fix issues
                 │
                Yes
                 │
                 ▼
┌─────────────────────────────────┐
│  Generate PO Deployment Request │
│  (smg-deploy evidence record)   │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│  🛑 STOP GATE: PO Approval      │
│  (Augusto must confirm deploy)  │
└────────────────┬────────────────┘
                 │
           Authorized? ──No──► STOP execution
                 │
                Yes
                 │
                 ▼
┌─────────────────────────────────┐
│  Authorized Deploy Promotion    │
│  (Executed via approved CI/CD)  │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│  smg-postdeploy Smoke Check     │
└─────────────────────────────────┘
```

---

## Output Format: Deployment Authorization Request

When preparing a deployment for the PO, output the following structured block:

```markdown
### DEPLOYMENT AUTHORIZATION REQUEST (ADR-026)

EVIDENCE:
- Branch / Commit SHA: <hash>
- Local Verification: PASS (npm run smg:verify)
- CI Pipeline Status: PASS
- Multi-tenant / RLS Impact: <assessed impact>

INTERPRETATION:
- Release summary and scope of changes.

GAP:
- None identified.

DECISION REQUIRED (PO - Augusto):
- [ ] APPROVED: Proceed with production deployment.
- [ ] REJECTED: Deployment blocked.

STATUS:
- STOP — Waiting for explicit PO decision.
```
