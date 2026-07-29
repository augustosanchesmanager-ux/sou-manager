# SECURITY_AUDIT_RPC.md

> Fase 3.3.2 — RPC Security Audit

**Audit Date:** 2026-07-23
**Scope:** All PostgreSQL functions in `supabase/migrations/`

---

## Executive Summary

| Category | Count | Status |
|----------|------:|--------|
| Secure RPCs (tenant + auth validated) | 20+ | ✅ |
| RPCs with issues | 7 | ⚠️ |
| CRITICAL issues | 1 | ❌ |
| HIGH issues | 1 | ❌ |
| MEDIUM issues | 5 | 📋 |

---

## Helper Functions

All helper functions use `SECURITY DEFINER` and are correct:

| Function | Purpose |
|---|---|
| `current_tenant_id_from_auth_uid()` | Returns tenant_id from profiles/staff |
| `current_is_super_admin_from_auth_uid()` | Returns boolean if superadmin |
| `get_auth_access_context()` | Returns full access context |

---

## Secure RPCs (All Validated)

### Appointment RPCs

| Function | SECURITY DEFINER | Tenant Check | Auth Check | Status |
|---|---|---|---|---|
| `create_appointment_with_comanda()` | YES | ✅ p_tenant_id vs auth tenant | ✅ | ✅ Seguro |
| `create_appointment_with_services()` | YES | ✅ | ✅ | ✅ Seguro |

### Financial RPCs

| Function | SECURITY DEFINER | Tenant Check | Auth Check | Status |
|---|---|---|---|---|
| `finance_settle_comanda()` | YES | ✅ + role check | ✅ | ✅ Seguro |
| `finance_reverse_transaction()` | YES | ✅ + role check | ✅ | ✅ Seguro |
| `finance_zero_close_comanda()` | YES | ✅ + role check | ✅ | ✅ Seguro |

### ChefClub RPCs

| Function | SECURITY DEFINER | Tenant Check | Auth Check | Status |
|---|---|---|---|---|
| `create_chef_club_subscription()` | YES | ✅ | ✅ | ✅ Seguro |
| `pay_club_receivable()` | YES | ✅ via receivable | ✅ | ✅ Seguro |
| `generate_club_receivables()` | YES | ✅ | ✅ | ✅ Seguro |
| `refresh_club_receivable_statuses()` | YES | ✅ | ✅ | ✅ Seguro |
| `deduct_chef_club_credits()` | YES | ✅ via subscription | ✅ | ✅ Seguro |
| `ensure_club_receivable_for_cycle()` | YES | ✅ via subscription | ✅ | ✅ Seguro |

### Notification RPCs

| Function | SECURITY DEFINER | Tenant Check | Auth Check | Status |
|---|---|---|---|---|
| `create_internal_notification()` | YES | ✅ | ✅ | ✅ Seguro |
| `list_internal_notifications()` | YES | ✅ | ✅ | ✅ Seguro |
| `count_unread_notifications()` | YES | ✅ | ✅ | ✅ Seguro |
| `mark_notification_read()` | YES | ✅ | ✅ | ✅ Seguro |
| `mark_all_notifications_read()` | YES | ✅ | ✅ | ✅ Seguro |
| `archive_notification()` | YES | ✅ | ✅ | ✅ Seguro |
| `get_notification_preferences()` | YES | ✅ | ✅ | ✅ Seguro |
| `set_notification_preferences()` | YES | ✅ | ✅ | ✅ Seguro |
| `generate_system_notifications()` | YES | ✅ | ✅ | ✅ Seguro |

### Permission RPCs

| Function | SECURITY DEFINER | Tenant Check | Auth Check | Status |
|---|---|---|---|---|
| `get_role_permissions()` | YES | ✅ p_tenant_id | ✅ | ✅ Seguro |
| `upsert_role_permissions()` | YES | ✅ + staff check | ✅ | ✅ Seguro |
| `reset_role_permissions_to_default()` | YES | ✅ + staff check | ✅ | ✅ Seguro |

### Bulk Operations

| Function | SECURITY DEFINER | Tenant Check | Auth Check | Status |
|---|---|---|---|---|
| `bulk_close_comandas_normal()` | YES | ✅ p_tenant_id | ✅ | ✅ Seguro |

---

## RPCs with Issues

### ❌ CRITICAL

| Function | Issue | Risk |
|---|---|---|
| `approve_access_request()` | **NO auth.uid() check, NO tenant validation** | Any authenticated user can approve access requests |

**Recommendation:** Add `ASSERT current_is_super_admin_from_auth_uid(), 'Not authorized';` at the start of the function.

### ❌ HIGH

| Function | Issue | Risk |
|---|---|---|
| `close_order()` | **NO auth check, NO tenant validation** | Any user can close any order |

**Recommendation:** This appears to be a legacy function superseded by `finance_settle_comanda()`. Either add proper validation or deprecate/remove it.

### ⚠️ MEDIUM

| Function | Issue | Risk |
|---|---|---|
| `detect_no_show_appointments()` | Takes p_tenant_id but no auth.uid() check | Designed for cron, but callable by any user |
| `validate_and_fix_comandas()` | Takes p_tenant_id but no auth check | Same as above |
| `bulk_close_comandas_admin()` | Uses legacy `get_current_tenant_id()` | May fail for staff-only users |
| `backfill_service_execution_participants()` | No auth check | Admin function without guard |
| `build_chef_club_service_balance_map()` | No auth check | Utility function, low risk |

### ⚠️ LOW

| Function | Issue | Risk |
|---|---|---|
| `is_super_admin()` (monitoring module) | Uses JWT claims (`auth.jwt() ->> 'role'`) | JWT claims are user-editable in Supabase |

---

## Schema Reference

### SECURITY DEFINER Functions

All sensitive functions correctly use `SECURITY DEFINER` to execute with elevated privileges while validating permissions internally. This is the correct pattern for Supabase RPCs.

### Helper Function Pattern

The recommended pattern for all new RPCs:

```sql
CREATE OR REPLACE FUNCTION public.my_function(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id uuid;
    v_is_super_admin boolean;
BEGIN
    -- Get auth context
    SELECT tenant_id, is_super_admin 
    INTO v_tenant_id, v_is_super_admin
    FROM get_auth_access_context();
    
    -- Validate tenant
    IF NOT v_is_super_admin AND v_tenant_id != p_tenant_id THEN
        RAISE EXCEPTION 'Tenant mismatch';
    END IF;
    
    -- ... business logic ...
END;
$$;

GRANT EXECUTE ON FUNCTION public.my_function(uuid) TO authenticated;
```

---

## Conclusion

**20+ RPCs are properly secured** with tenant validation and auth checks. The critical issues are in 2 legacy functions (`approve_access_request`, `close_order`) that predate the current security architecture.

**Risk assessment:** The core financial and subscription RPCs are solid. The legacy functions should be deprecated or fixed before production.
