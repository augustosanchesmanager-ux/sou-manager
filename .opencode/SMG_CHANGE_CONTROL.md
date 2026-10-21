# SMG Change Control Protocol

Version: 1.0.0

> **Nota de evolução (2026-09-24):** este documento é a **origem histórica** do protocolo e permanece válido como registro da v1.0.0. A formalização do contrato (estados, transições, authorization records, certificação por frente e invariantes I1–I10) está formalizada em `docs/adr/ADR-028-smg-gate-formal-contract.md` (ADR-028). Não existe segunda state machine: o ADR-028 formaliza esta mesma máquina, acrescentando os estados `BLOCKED`, `CANCELLED`, `POST_MERGE` e `DEPLOY_REVIEW`.

This document describes the operational state machine implemented by the SMG OpenCode skills.

## State machine

INTAKE
→ AUDIT
→ CLASSIFY
→ STOP/GATE
→ ISOLATE
→ IMPLEMENT
→ VALIDATE
→ STOP/GATE
→ COMMIT AUTHORIZATION
→ COMMIT
→ STOP/GATE
→ PUSH AUTHORIZATION
→ PUSH
→ PR
→ CI/E2E
→ STOP/GATE
→ MERGE AUTHORIZATION
→ MERGE
→ POST-MERGE
→ DEPLOY AUTHORIZATION
→ DEPLOY
→ POST-DEPLOY
→ CLOSE

## Evidence discipline

Every material decision should distinguish:

- EVIDENCE — observed facts, command output, test results, diffs, logs.
- INTERPRETATION — what the evidence means.
- GAP — what remains unknown or unverified.
- DECISION — explicit authorized action or STOP.

## Governance

The protocol is intentionally conservative. Investigation must not become implementation, and implementation must not become deployment without the corresponding authorization and evidence gates.
