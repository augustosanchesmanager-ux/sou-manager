# ADR-012 — RPC EXECUTE Grants: Least-Privilege by Default

**Status:** Accepted
**Date:** 2026-08-06
**Author:** Augusto (PO) + SMG Engineering

---

## Context

During the Fase 6.0.4.2 certification (billing + team invitation RPCs), an ACL audit of `pg_proc.proacl` revealed that the **Supabase platform auto-grants `EXECUTE` to `anon`, `authenticated` and `service_role` on every newly created function**. RPCs that the migration source clearly intended to be authenticated-only (e.g. `start_trial`, `invite_team_member`, `upsert_role_permissions`) were silently callable by anonymous users, even though each migration ended with `GRANT EXECUTE ... TO authenticated`.

A `GRANT EXECUTE TO authenticated` does **not** revoke the platform's default `anon` grant. The only way to remove it is an explicit `REVOKE EXECUTE ... FROM anon` (or `FROM PUBLIC`).

This is a structural platform behavior, not a project bug. It was confirmed empirically:

- `record_billing_event` (SECURITY DEFINER, no `auth.uid()` guard) was anon-executable and writable.
- The hardened migration `20260806030000_fix_auth_staff_id_to_profiles.sql` added the missing guard and explicit `REVOKE ... FROM anon` for every privileged RPC of the module.

## Problem

Any future migration that creates an RPC without an explicit `REVOKE ... FROM anon` leaves a privileged `SECURITY DEFINER` function callable by anonymous users. If that function also lacks an internal `auth.uid()` guard, it becomes a public write endpoint (integrity/spam risk; in a SECURITY DEFINER context, potentially a cross-tenant data risk).

This is a **silent default** that will keep recurring in Fase 6.0.5, 6.1, 6.2, etc. unless codified.

## Decision

**Every migration that creates or replaces an RPC MUST end with the grant contract:**

```sql
REVOKE EXECUTE ON FUNCTION public.<fn>(<signature>) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.<fn>(<signature>) FROM anon;
GRANT  EXECUTE ON FUNCTION public.<fn>(<signature>) TO authenticated;
```

- `REVOKE FROM PUBLIC` removes the implicit `PUBLIC` grant.
- `REVOKE FROM anon` explicitly removes the platform auto-grant to anonymous.
- `GRANT TO authenticated` (or a more specific role) is the intended caller.
- **Exceptions are explicit:** functions that must be callable by anonymous users are listed in the migration with a comment justifying the public contract. Current known exceptions: `get_invite_by_token`, `kiosk_get_staff`.

This becomes part of the **mandatory checklist of every future phase** (6.0.5, 6.1, ...) and of the Helper Function Pattern in `docs/security/SECURITY_AUDIT_RPC.md`.

## Alternatives Considered

### Alternative 1: Rely on the platform default grant

**Rejected** — the default is anon-executable, which is the vulnerability this ADR addresses.

### Alternative 2: Rely on `GRANT EXECUTE TO authenticated` only

**Rejected** — additive grant only; does not remove the platform auto-grant to `anon`. Empirically verified.

### Alternative 3: Global trigger/event to auto-revoke anon on every function creation

**Deferred** — the grant lifecycle is platform-managed; a project-side trigger is fragile and outside the current control plane. Revisit if the platform continues to auto-grant after explicit revocation.

## Consequences

- **Positive:** Least-privilege default for all new RPCs; consistent with the Fase 3.3 security posture.
- **Positive:** The authorization contract is explicit in every migration and auditable.
- **Positive:** New functions follow the same contract regardless of phase.
- **Negative:** Two extra lines per function in every migration — negligible maintenance cost.
- **Negative:** Pre-existing functions remain exposed until the backlog is executed.
- **Mitigation:** Backlog item **"Security Hardening — RPC Permission Audit"** (`docs/security/SECURITY_AUDIT_RPC.md`) inventories every existing RPC, revokes `anon` where not justified, and re-runs regression.

## References

- Migration with the hardening: `supabase/migrations/20260806030000_fix_auth_staff_id_to_profiles.sql`
- RPC security audit (backlog home): `docs/security/SECURITY_AUDIT_RPC.md`
- Platform behavior precedent (CLI bug): `docs/audit/MIGRATION_EXCEPTION_20260801.md`
- Public exceptions kept: `get_invite_by_token`, `kiosk_get_staff`
