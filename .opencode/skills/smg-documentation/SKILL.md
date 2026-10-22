---
name: smg-documentation
description: "Atualiza e audita a documentação canônica, roadmap e registros de arquitetura do projeto."
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

# Skill: smg-documentation

## Purpose

Govern the lifecycle of SMG documentation as **knowledge governance**, not merely Markdown generation. Manage documentation as a first-class system asset with traceability, classification, conflict detection, drift detection, and PO decision tracking.

## Scope

This skill operates on the `docs/` directory and any documentation artifacts in the repository. It does **not** modify product code, database, or production systems.

## Five Modes

### 1. AUDIT (Read-Only)

**Mandatory: 100% read-only.** No modifications to any documentation.

Identifies and inventories:
- Existing documents
- Documents by state: `CURRENT`, `REVIEW`, `HISTORICAL`, `CONFLICTING`, `OBSOLETE`, `UNVERIFIED`, `DUPLICATE`
- Documentation Drift (doc vs code vs database vs tests vs PO decisions)
- Missing documentation (gaps between system reality and documented knowledge)
- Undocumented PO decisions
- Potential sources of truth with confidence levels

Output: Audit report with evidence, classification candidates, drift findings, gaps, and STOP gates if business rule conflicts are detected.

### 2. CLASSIFY

Assigns document states based on **evidence**, not assumptions.

**Document States:**
- `CURRENT` — Vigent, usable as operational reference
- `REVIEW` — Needs review before use
- `HISTORICAL` — Historically valid, not current
- `CONFLICTING` — Conflicts with another source
- `OBSOLETE` — Proven superseded (not merely old)
- `UNVERIFIED` — Insufficient evidence to confirm validity
- `DUPLICATE` — Redundant or duplicate of another document

**Classification Rules:**
- Never classify as `OBSOLETE` solely based on age
- Require evidence for every classification
- Default to `UNVERIFIED` when evidence is insufficient
- Flag `CONFLICTING` when multiple sources disagree on business rules
- Cross-reference with implementation, database schema, tests, and PO decisions

### 3. RECONCILE

Identifies conflicts between documentation sources.

**Conflict Detection:**
- Document A vs Document B on same business rule
- Documentation vs Implementation
- Documentation vs Database schema/RLS
- Documentation vs PO Decision
- Documentation vs Tests

**Resolution Process:**
1. Identify all conflicting statements with file/line references
2. Map each statement to its evidence source
3. Identify the prevailing PO decision (if any)
4. If PO decision exists → mark as `CONFLICTING` with resolution pointer
5. If no PO decision → **STOP GATE — PO DECISION REQUIRED**
6. Never invent a resolution

### 4. ORGANIZE

Organizes documentation structure **only with explicit authorization**.

**Authorized Actions (with PO approval):**
- Move documents
- Rename documents
- Consolidate duplicates
- Create directory structure
- Create/update `docs/DOCUMENTATION-INDEX.md`
- Archive `HISTORICAL` documents

**CRITICAL RULE: Never delete documents automatically.**

If a document appears disposable:
- Classify as `DELETE CANDIDATE`
- Request explicit PO approval
- Prefer historical preservation when in doubt

**Structure Concept (not enforced in this task):**
```
docs/
├── README.md
├── current/
│   ├── architecture/
│   ├── domains/
│   ├── business-rules/
│   ├── database/
│   ├── security/
│   ├── operations/
│   └── ux/
├── decisions/
│   ├── ADR/
│   └── PO/
├── historical/
└── audit/
```

### 5. UPDATE

Updates documentation after authorized system changes.

**Pre-Update Checklist:**
1. Identify impacted documentation (trace from change)
2. Verify existing sources
3. Compare with current reality (code, DB, tests, PO decisions)
4. Update only what is necessary
5. Preserve history (do not overwrite without trace)
6. Update `DOCUMENTATION-INDEX.md` when structure changes

## Evidence Hierarchy (Source of Truth)

When evaluating documentation validity, consider in order:

1. **Explicit PO Decision** (recorded, dated, contextualized)
2. **Approved Business Rule** (validated with PO)
3. **Validated Implementation** (tested, deployed, verified)
4. **Actual Database/Architecture State** (migrations, RLS, RPCs)
5. **Current Operational Documentation**
6. **Approved Planning** (roadmap, specs)
7. **Historical Documentation**
8. **Drafts/Notes**

**Critical Principles:**
- Never assume newest = correct
- Never assume code = business rule
- Never assume documentation = correct
- Conflicts must be evidenced, not resolved by heuristic

## PO Decision Tracking

The skill must recognize and record PO decisions as governance artifacts.

**Decision Record Fields:**
- Decision statement
- Context/background
- Options considered
- Chosen option
- Impact assessment
- Date
- Domain (architecture, business, security, finance, etc.)
- Status (active, superseded, archived)
- Supporting evidence (links to ADRs, commits, migrations, discussions)
- Related implementation (tickets, PRs, migrations)

**Rule:** AI cannot substitute a PO decision with its own interpretation.

## Planning vs Implementation Distinction

**Mandatory distinction between:**
- `PLANNED` — Documented intent, not yet built
- `IMPLEMENTED` — Built, tested, deployed, verified

A planning document is **never** evidence that functionality exists.

## Documentation Drift Detection

Detects divergence between:
- Documentation ↔ Code
- Documentation ↔ Database (schema, RLS, RPCs, data)
- Documentation ↔ Tests
- Documentation ↔ PO Decisions

**Example:**
- Doc: "Comanda closes automatically after payment"
- Code: Comanda remains open after payment
- Result: `DOCUMENTATION DRIFT` flagged

**If drift involves business rule:**
→ **STOP GATE — PO DECISION REQUIRED**

## Documentation Index

Maintains/validates `docs/DOCUMENTATION-INDEX.md` (verify exists before creating).

**Index must enable identification of:**
- Document name/path
- Domain
- Purpose
- State (`CURRENT`, `REVIEW`, `HISTORICAL`, `CONFLICTING`, `OBSOLETE`, `UNVERIFIED`, `DUPLICATE`)
- Source of truth
- Related documents
- Historical versions
- Documents under review
- Known conflicts

## STOP GATES

The skill enforces hard stops for:

1. **Business Rule Conflict** — Conflicting rules in documentation or doc vs implementation
2. **Financial Conflict** — Discrepancy in commission, settlement, cash closing, pricing rules
3. **Security Conflict** — RLS, RPC, permission, or auth documentation vs implementation mismatch
4. **Ambiguous PO Decision** — Decision recorded but unclear, contradictory, or incomplete
5. **Document Deletion Request** — Any request to delete a document (must be `DELETE CANDIDATE` + PO approval)
6. **Code-Documentation Drift (Business Rule)** — Implementation contradicts documented business rule

**STOP Output:**
```
GATE: STOP
Reason: [specific trigger]
Evidence: [file/path/line references]
Required Action: [what must happen to proceed]
Decision Owner: PO
```

## Change Control Integration

This skill integrates into the SMG Change Control flow:

```
smg-change-control
        ↓
smg-isolate
        ↓
smg-implement
        ↓
smg-validate
        ↓
smg-documentation  ← Updates docs after validated implementation
        ↓
smg-commit
        ↓
smg-push
        ↓
smg-pr
        ↓
STOP / PO
        ↓
smg-merge
```

**During AUDIT/CLASSIFY/RECONCILE:** Read-only, no change control integration needed.

**During ORGANIZE/UPDATE:** Runs after `smg-validate`, before `smg-commit`. Documentation changes are part of the same front.

## Security Boundaries

This skill has **no authorization** to:
- Modify production systems
- Modify Supabase (database, auth, edge functions, etc.)
- Execute migrations
- Mutate data
- Deploy
- Modify product code during AUDIT mode
- Commit
- Push
- Open PR
- Merge

**Only authorized in this task:** Creation of branch `chore/smg-documentation-governance`.

## Procedure Summary

### AUDIT Mode
1. Scan `docs/` and repository for documentation files
2. Inventory each document with metadata
3. Assess state against evidence hierarchy
4. Detect drift (doc vs code vs DB vs tests vs PO decisions)
5. Identify missing documentation
6. Identify undocumented PO decisions
7. Produce audit report
8. **STOP** if business rule conflicts found

### CLASSIFY Mode
1. For each document from audit (or provided list)
2. Gather evidence for each potential state
3. Assign state with evidence citation
4. Flag `CONFLICTING` with cross-references
5. Default to `UNVERIFIED` when evidence insufficient
6. Output classification manifest

### RECONCILE Mode
1. Identify conflicting statements across sources
2. Map each to evidence
3. Check for prevailing PO decision
4. If PO decision exists → link resolution
5. If no PO decision → **STOP GATE**
6. Output conflict register

### ORGANIZE Mode (Requires PO Authorization)
1. Present proposed changes (moves, renames, consolidation, structure)
2. Obtain explicit PO approval per change or batch
3. Execute approved changes
4. Update `DOCUMENTATION-INDEX.md`
5. Archive `HISTORICAL` documents
6. Output change log

### UPDATE Mode (After Validated Implementation)
1. Trace from implementation to impacted docs
2. Verify current doc content against new reality
3. Update minimally
4. Preserve historical trace
5. Update index
6. Output update log

## Output Formats

### Audit Report
```
DOCUMENT INVENTARY:
- path | domain | purpose | candidate_state | evidence_strength | drift_detected | gaps | conflicts | PO_decisions_missing

DRIFT FINDINGS:
- doc_path | code_path | db_object | test_path | po_decision | divergence_description | severity | STOP_GATE

MISSING DOCUMENTATION:
- domain | expected_doc | reason | evidence_of_gap

UNDOCUMENTED PO DECISIONS:
- decision | date | domain | evidence | impact
```

### Classification Manifest
```
DOCUMENT | STATE | EVIDENCE | CONFIDENCE | CONFLICTS | NOTES
```

### Conflict Register
```
CONFLICT_ID | SOURCE_A | SOURCE_B | STATEMENT_A | STATEMENT_B | EVIDENCE_A | EVIDENCE_B | PO_DECISION | RESOLUTION_POINTER | STOP_GATE
```

### Organization Change Log
```
ACTION | FROM_PATH | TO_PATH | AUTHORIZATION | TIMESTAMP | INDEX_UPDATED
```

### Update Log
```
DOC_PATH | CHANGE_SUMMARY | TRIGGER_COMMIT | EVIDENCE_BEFORE | EVIDENCE_AFTER | INDEX_UPDATED
```

## Validation Gates

Before any documentation modification (ORGANIZE/UPDATE):
- [ ] `git diff --check` passes
- [ ] No production modifications
- [ ] PO authorization recorded (for ORGANIZE)
- [ ] Implementation validated (for UPDATE, via smg-validate evidence)
- [ ] Index updated if structure changed
- [ ] Historical trace preserved
- [ ] No automatic deletions

## First Execution Note

The first execution of this skill will be a separate task: `smg-documentation AUDIT` in 100% read-only mode to inventory and classify existing SMG documentation.

**This task only creates and validates the skill. No audit is executed here.**

---

*Skill created per SMG governance requirements. Follows SMG Engineering Governance invariants and Change Control Protocol.*