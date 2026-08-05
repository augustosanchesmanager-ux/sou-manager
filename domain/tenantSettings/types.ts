/**
 * [SMG][DOMAIN][TENANT_SETTINGS] types
 *
 * Operational settings for a tenant. Company and operational data
 * that doesn't fit on the core tenants table.
 *
 * DESIGN:
 *   - Separated from tenants table for clean data model
 *   - One-to-one relationship (tenant_id is UNIQUE)
 *   - Business hours stored as JSONB for flexibility
 *   - Created during onboarding, updatable in Settings
 */

// ─── Entity ──────────────────────────────────────────────────────

export interface TenantSettings {
  id: string;
  tenant_id: string;
  chair_count: number | null;
  business_hours: BusinessHours | null;
  phone: string | null;
  cnpj: string | null;
  address_street: string | null;
  address_number: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  timezone: string;
  currency: string;
  appointment_interval_minutes: number;
  default_appointment_duration_minutes: number;
  booking_horizon_days: number;
  staff_owned_schedule: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Business Hours ──────────────────────────────────────────────

export interface BusinessHours {
  [day: string]: { open: string; close: string } | null;
}

// ─── Input ───────────────────────────────────────────────────────

export interface CreateTenantSettingsInput {
  tenant_id: string;
  chair_count?: number | null;
  business_hours?: BusinessHours | null;
  phone?: string | null;
  cnpj?: string | null;
  address_street?: string | null;
  address_number?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_zip?: string | null;
  timezone?: string | null;
  currency?: string | null;
  appointment_interval_minutes?: number | null;
  default_appointment_duration_minutes?: number | null;
  booking_horizon_days?: number | null;
  staff_owned_schedule?: boolean | null;
}
