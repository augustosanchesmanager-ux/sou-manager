/**
 * [SMG][DOMAIN][TENANT] types
 *
 * Tenant entity types for the SaaS lifecycle.
 *
 * DESIGN:
 *   - TenantStatus uses PostgreSQL ENUM (tenant_status) — PO directive
 *   - Plan is TEXT for now (free/pro/elite), will become ENUM when Billing is added
 *   - TenantSettings are in a separate table (operational data)
 *   - Company data (name, CNPJ, address) lives on tenants + tenant_settings
 */

// ─── Status ──────────────────────────────────────────────────────

export type TenantStatus =
  | 'draft'
  | 'trial'
  | 'active'
  | 'past_due'
  | 'suspended'
  | 'cancelled'
  | 'archived';

// ─── Plan ────────────────────────────────────────────────────────

export type TenantPlan = 'free' | 'pro' | 'elite';

// ─── Entity ──────────────────────────────────────────────────────

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  plan: TenantPlan;
  app_slug: string;
  created_at: string;
  updated_at: string;
}

// ─── Input ───────────────────────────────────────────────────────

export interface CreateTenantInput {
  name: string;
  app_slug?: string;
}
