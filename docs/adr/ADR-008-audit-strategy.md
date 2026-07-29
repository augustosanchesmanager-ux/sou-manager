# ADR-008: Audit Strategy

**Status:** Accepted  
**Date:** 2026-07-24  
**Deciders:** SMG Engineering

## Context

Financial operations (commissions, cash closing, settlements) require a complete audit trail for compliance and debugging.

## Decision

Two-tier audit approach:

### 1. Event Store (Domain Level)

- Append-only event store for all domain events
- `event_store` table with RLS and tenant isolation
- 6 indexes for efficient querying
- Events are immutable — no UPDATE/DELETE policies

### 2. Audit Logs (Database Level)

- `audit_logs` table for Supabase-level changes
- Trigger-based capture on critical tables
- RLS with superadmin bypass

### 3. Financial Subscribers

- `AuditSubscriber` logs all domain events
- `CommissionSubscriber` calculates commissions from checkout events
- `FinanceSubscriber` enqueues financial operations via Outbox

## Consequences

- **Positive:** Complete audit trail for compliance
- **Positive:** Events can be replayed for debugging
- **Positive:** Financial operations are traceable end-to-end
- **Negative:** Storage overhead for event store
- **Negative:** Event store grows unboundedly (needs archival strategy)
