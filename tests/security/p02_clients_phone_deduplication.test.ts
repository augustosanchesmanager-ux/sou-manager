import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const DEDUP_MIGRATION = resolve(
  process.cwd(),
  'supabase/migrations/20261111214500_clients_phone_deduplication_and_unique_guard.sql',
);

const sql = readFileSync(DEDUP_MIGRATION, 'utf-8');

describe('Clients Phone Deduplication & Unique Guard migration contracts', () => {
  it('should_define_immutable_normalize_br_phone_ignoring_placeholders', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.normalize_br_phone(p_raw TEXT)');
    expect(sql).toContain('IMMUTABLE');
    expect(sql).toContain("br !~ '^(\\d)\\1+$'");
  });

  it('should_enforce_partial_unique_index_excluding_placeholders_and_shared_phones', () => {
    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS clients_tenant_canon_phone_uidx');
    expect(sql).toContain('ON public.clients (tenant_id, public.normalize_br_phone(phone))');
    expect(sql).toContain('AND public.normalize_br_phone(phone) IS NOT NULL');
    expect(sql).toContain('AND is_shared_phone = false');
  });

  it('should_update_public_and_internal_rpcs_to_reuse_canonical_phone_client', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.create_public_booking');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.create_site_sanchez_appointment');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.import_clients_batch');
    expect(sql).toContain('public.normalize_br_phone(c.phone) = v_canon_phone');
    expect(sql).toContain('ORDER BY c.is_shared_phone ASC, c.created_at ASC');
  });
});
