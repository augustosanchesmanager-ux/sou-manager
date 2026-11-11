import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const HYBRID_MIGRATION = resolve(
  process.cwd(),
  'supabase/migrations/20261111203000_hybrid_immediate_slot_public_booking.sql',
);
const SETTINGS_PAGE = resolve(
  process.cwd(),
  'pages/portal/OnlineBookingSettings.tsx',
);
const ABOUT_TAB = resolve(
  process.cwd(),
  'src/pages/public/booking/AboutUsTab.tsx',
);

const sql = readFileSync(HYBRID_MIGRATION, 'utf-8');
const settingsSource = readFileSync(SETTINGS_PAGE, 'utf-8');
const aboutSource = readFileSync(ABOUT_TAB, 'utf-8');

describe('Hybrid Immediate Slot & Min Booking Notice regression contracts', () => {
  it('should_inject_immediate_5min_rounded_slot_without_shifting_fixed_grid', () => {
    expect(sql).toContain('WITH fixed_grid AS');
    expect(sql).toContain('next_fixed AS');
    expect(sql).toContain('v_immediate_slot');
    expect(sql).toContain('v_notice_target < nf.next_start_at');
    expect(sql).toContain('GREATEST(COALESCE(v_settings.min_booking_notice_minutes, 30), 0)');
  });

  it('should_preserve_tenant_isolation_overlap_checks_and_adr012_grants', () => {
    expect(sql).toContain('public.resolve_public_booking_tenant_id(p_tenant_identifier)');
    expect(sql).toContain('AND s.tenant_id = v_tenant_id');
    expect(sql).toContain('a.start_time <= v_slot_start');
    expect(sql).toContain('a.end_time > v_slot_start');
    expect(sql).toContain('REVOKE EXECUTE ON FUNCTION public.get_public_available_slots(TEXT, UUID, UUID[], DATE) FROM PUBLIC;');
    expect(sql).toContain('REVOKE EXECUTE ON FUNCTION public.get_public_available_slots(TEXT, UUID, UUID[], DATE) FROM anon;');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.get_public_available_slots(TEXT, UUID, UUID[], DATE) TO anon, authenticated;');
  });

  it('should_expose_min_booking_notice_minutes_options_in_OnlineBookingSettings', () => {
    expect(settingsSource).toContain('minBookingNoticeMinutes');
    expect(settingsSource).toContain("label: '0 min (Imediato)'");
    expect(settingsSource).toContain('min_booking_notice_minutes: minBookingNoticeMinutes');
  });

  it('should_not_fallback_zero_notice_to_30_in_AboutUsTab', () => {
    expect(aboutSource).toContain('min_booking_notice_minutes ?? 30');
    expect(aboutSource).not.toContain('min_booking_notice_minutes || 30');
  });
});
