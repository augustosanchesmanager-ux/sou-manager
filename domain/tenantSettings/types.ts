/**
 * [SMG][DOMAIN][TENANT_SETTINGS] types
 *
 * Operational settings for a tenant. Company and operational data
 * that doesn't fit on the core tenants table, plus Online Booking
 * customization and Home Care Product Showcase settings.
 *
 * DESIGN:
 *   - Separated from tenants table for clean data model
 *   - One-to-one relationship (tenant_id is UNIQUE)
 *   - Business hours stored as JSONB for flexibility
 *   - Created during onboarding, updatable in Settings & OnlineBookingSettings
 */

// ─── Entity: tenant_settings ─────────────────────────────────────

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
  work_start_time?: string | null;
  work_end_time?: string | null;
  booking_enabled?: boolean | null;
  instagram_url?: string | null;
  whatsapp_number?: string | null;
  maps_url?: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Entity: online_booking_settings ─────────────────────────────

export type BookingThemeMode = 'dark' | 'light';

export interface OnlineBookingAutomationsConfig {
  reminders_24h_2h?: boolean;
  reactive_waitlist?: boolean;
  [key: string]: unknown;
}

export interface OnlineBookingSettingsRecord {
  id?: string;
  tenant_id: string;
  is_active: boolean;
  display_name: string | null;
  slug: string | null;
  display_address: string | null;
  logo_url: string | null;
  cover_banner_url: string | null;
  primary_color: string;
  theme_mode: BookingThemeMode;
  slogan: string | null;
  about_text: string | null;
  show_products: boolean;
  featured_product_ids: string[];
  featured_service_ids: string[];
  phone_whatsapp: string | null;
  instagram_url: string | null;
  google_maps_url: string | null;
  weekly_schedule: Record<string, unknown> | null;
  automations_config: OnlineBookingAutomationsConfig | null;
  created_at?: string;
  updated_at?: string;
}

export interface UpsertOnlineBookingSettingsInput {
  tenant_id: string;
  is_active: boolean;
  display_name?: string | null;
  slug?: string | null;
  display_address?: string | null;
  logo_url?: string | null;
  cover_banner_url?: string | null;
  primary_color?: string | null;
  theme_mode?: BookingThemeMode;
  slogan?: string | null;
  about_text?: string | null;
  show_products?: boolean;
  featured_product_ids?: string[];
  featured_service_ids?: string[];
  phone_whatsapp?: string | null;
  instagram_url?: string | null;
  google_maps_url?: string | null;
  weekly_schedule?: Record<string, unknown> | null;
  automations_config?: OnlineBookingAutomationsConfig | null;
  work_start_time?: string;
  work_end_time?: string;
}

export interface ShowcaseProductItem {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  sale_price: number;
  image_url: string | null;
  stock_quantity: number;
  active: boolean;
}

// ─── Business Hours & Branding ───────────────────────────────────

export interface DaySchedule {
  open: string;
  close: string;
}

export interface BrandingSettings {
  display_name?: string | null;
  slug?: string | null;
  display_address?: string | null;
  cover_url?: string | null;
  cover_banner_url?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  theme_mode?: BookingThemeMode | null;
  slogan?: string | null;
  about_text?: string | null;
  show_products?: boolean;
  featured_product_ids?: string[];
  featured_service_ids?: string[];
}

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
  work_start_time?: string | null;
  work_end_time?: string | null;
  booking_enabled?: boolean | null;
  instagram_url?: string | null;
  whatsapp_number?: string | null;
  maps_url?: string | null;
}
