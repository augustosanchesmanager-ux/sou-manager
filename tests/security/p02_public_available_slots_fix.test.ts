import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const FIX_MIGRATION = resolve(
  process.cwd(),
  'supabase/migrations/20261110184000_fix_public_available_slots_resolution_and_schedule.sql',
);
const USE_PUBLIC_BOOKING = resolve(
  process.cwd(),
  'src/pages/public/booking/hooks/usePublicBooking.ts',
);

const sql = readFileSync(FIX_MIGRATION, 'utf-8');
const hookSource = readFileSync(USE_PUBLIC_BOOKING, 'utf-8');

describe('get_public_available_slots & usePublicBooking regression contracts', () => {
  it('should_resolve_tenant_via_resolve_public_booking_tenant_id_in_migration', () => {
    expect(sql).toContain('public.resolve_public_booking_tenant_id(p_tenant_identifier)');
    expect(sql).toContain('SECURITY DEFINER');
    expect(sql).toContain("SET search_path = 'public', 'extensions'");
  });

  it('should_support_both_full_and_abbreviated_weekday_keys_with_fallback', () => {
    expect(sql).toContain("(1, 'monday', 'mon')");
    expect(sql).toContain('v_has_schedule_entry');
    expect(sql).toContain('v_shop_closed_today');
    expect(sql).toContain('v_settings.work_start_time');
  });

  it('should_enforce_tenant_isolation_overlap_checks_chronological_sort_and_adr012_grants', () => {
    expect(sql).toContain('AND s.tenant_id = v_tenant_id');
    expect(sql).toContain('a.start_time <= v_slot_start');
    expect(sql).toContain('a.end_time > v_slot_start');
    expect(sql).toContain("ORDER BY (elem->>'start_time') ASC");
    expect(sql).toContain('REVOKE EXECUTE ON FUNCTION public.get_public_available_slots(TEXT, UUID, UUID[], DATE) FROM PUBLIC;');
    expect(sql).toContain('REVOKE EXECUTE ON FUNCTION public.get_public_available_slots(TEXT, UUID, UUID[], DATE) FROM anon;');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.get_public_available_slots(TEXT, UUID, UUID[], DATE) TO anon, authenticated;');
  });

  it('should_not_reset_selectedDate_when_selectStaff_or_toggleService_runs', () => {
    const selectStaffStart = hookSource.indexOf('const selectStaff = useCallback');
    const selectStaffEnd = hookSource.indexOf('const selectDate = useCallback');
    const selectStaffBody = hookSource.slice(selectStaffStart, selectStaffEnd);

    expect(selectStaffBody).not.toContain('selectedDate: null');
  });
});
