# ADR-003: Multi-Tenant Isolation

**Status:** Accepted  
**Date:** 2026-07-24  
**Deciders:** SMG Engineering

## Context

SMG is a SaaS platform serving multiple barbershops. Each tenant's data must be completely isolated.

## Decision

### Database Level

- Row Level Security (RLS) on all domain tables
- `tenant_id` column on every tenant-scoped table
- Helper function `current_tenant_id_from_auth_uid()` (SECURITY DEFINER) for RLS policies
- Superadmin bypass via `current_is_super_admin_from_auth_uid()` (SECURITY DEFINER)

### Application Level

- `AuthContext` resolves `tenantId` via RPC `get_auth_access_context`
- `TenantContext` fetches full tenant record and user memberships
- All Repository queries filter by `tenant_id`
- `getClientForTable(tableName, tenantId)` automatically selects schema

### Schema Routing (Optional)

When `VITE_SUPABASE_MULTI_SCHEMA_ENABLED=true`:
- Shared tables → `public` schema
- Domain tables → app-specific schema (`barber`, `auto`, `club`)

When disabled (default): everything in `public`.

## Consequences

- **Positive:** Complete data isolation between tenants
- **Positive:** RLS provides database-level security enforcement
- **Positive:** Superadmin can access all tenants for support
- **Negative:** RLS policies must be maintained for every new table
- **Negative:** Multi-schema adds complexity for limited benefit at current scale

## Compliance

Verified by migration `20260227223434_fix_all_rls_policies_use_security_definer_function.sql` and security audit.
