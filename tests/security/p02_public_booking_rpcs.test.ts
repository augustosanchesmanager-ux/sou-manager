/**
 * P.02-BOOKING-PUBLIC — Teste de Contrato e Segurança: RPCs de Agendamento Online Público
 *
 * Baseado no ADR-032 e SPEC_RPC_AGENDAMENTO_ONLINE_PUBLICO.md v1.1.
 *
 * Valida por inspeção estática do SQL da migration (padrão F3.1):
 * 1. Existência e isolamento das 4 RPCs públicas:
 *    - get_public_tenant_profile
 *    - get_public_available_slots
 *    - create_public_booking
 *    - cancel_public_booking
 * 2. Segurança ADR-012 (REVOKE FROM PUBLIC/anon + GRANT TO anon, authenticated).
 * 3. SECURITY DEFINER e search_path fixado em todas as 4 RPCs.
 * 4. Mecanismo anti-sobreposição (pg_advisory_xact_lock + tstzrange).
 * 5. Persistência de public_booking_tokens com sha256 e expiração de 90 dias.
 * 6. Proteção de idempotência (sem reemissão de plaintext token em repetição).
 * 7. Gravação de client_name e client_phone em appointments (denormalização para rate limit e agenda).
 * 8. Isolamento RLS das tabelas novas (appointment_services e public_booking_tokens).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const MIGRATION = resolve(
  process.cwd(),
  'supabase/migrations/20261015223000_public_online_booking_rpcs.sql',
);

const sql = readFileSync(MIGRATION, 'utf-8');

describe('P.02-BOOKING-PUBLIC — Contrato e Segurança das RPCs Públicas (ADR-032)', () => {
  const RPCS = [
    'get_public_tenant_profile',
    'get_public_available_slots',
    'create_public_booking',
    'cancel_public_booking',
  ];

  it('should_define_all_4_public_rpcs_as_security_definer', () => {
    for (const rpc of RPCS) {
      expect(sql).toContain(`FUNCTION public.${rpc}`);
      // Assegurar que cada declaração tem SECURITY DEFINER
      const rpcIdx = sql.indexOf(`FUNCTION public.${rpc}`);
      const sliceAfterRpc = sql.slice(rpcIdx, rpcIdx + 300);
      expect(sliceAfterRpc).toContain('SECURITY DEFINER');
    }
  });

  it('should_enforce_fixed_search_path_on_all_4_rpcs', () => {
    for (const rpc of RPCS) {
      const rpcIdx = sql.indexOf(`FUNCTION public.${rpc}`);
      const sliceAfterRpc = sql.slice(rpcIdx, rpcIdx + 350);
      expect(sliceAfterRpc).toContain("SET search_path = 'public', 'extensions'");
    }
  });

  it('should_comply_with_adr_012_grants_for_all_4_rpcs', () => {
    for (const rpc of RPCS) {
      expect(sql).toContain(`REVOKE EXECUTE ON FUNCTION public.${rpc}`);
      expect(sql).toContain(`FROM PUBLIC;`);
      expect(sql).toContain(`FROM anon;`);
      expect(sql).toContain(`GRANT EXECUTE ON FUNCTION public.${rpc}`);
      expect(sql).toContain(`TO anon, authenticated;`);
    }
  });

  it('should_use_pg_advisory_xact_lock_in_create_and_cancel_booking', () => {
    // create_public_booking lock
    const createIdx = sql.indexOf('FUNCTION public.create_public_booking');
    const cancelIdx = sql.indexOf('FUNCTION public.cancel_public_booking');

    const createBody = sql.slice(createIdx, cancelIdx);
    const cancelBody = sql.slice(cancelIdx);

    expect(createBody).toContain('pg_advisory_xact_lock(');
    expect(createBody).toContain('tstzrange(');
    expect(createBody).toContain("ERRCODE = '23P01'");

    expect(cancelBody).toContain('pg_advisory_xact_lock(');
  });

  it('should_persist_hashed_token_with_90_days_expiration_in_create_public_booking', () => {
    const createIdx = sql.indexOf('FUNCTION public.create_public_booking');
    const cancelIdx = sql.indexOf('FUNCTION public.cancel_public_booking');
    const createBody = sql.slice(createIdx, cancelIdx);

    expect(createBody).toContain('INSERT INTO public.public_booking_tokens');
    expect(createBody).toContain("digest(btrim(v_public_token), 'sha256')");
    expect(createBody).toContain("interval '90 days'");
    expect(createBody).toContain("'public_token', v_public_token");
    expect(createBody).toContain("'public_token_id', v_token_id");
  });

  it('should_return_null_token_on_idempotent_replay', () => {
    const createIdx = sql.indexOf('FUNCTION public.create_public_booking');
    const cancelIdx = sql.indexOf('FUNCTION public.cancel_public_booking');
    const createBody = sql.slice(createIdx, cancelIdx);

    const idempotentCheckPos = createBody.indexOf('p_idempotency_key IS NOT NULL');
    expect(idempotentCheckPos).toBeGreaterThan(-1);

    const idempotentSlice = createBody.slice(idempotentCheckPos, idempotentCheckPos + 2000);
    expect(idempotentSlice).toContain("'public_token', NULL");
    expect(idempotentSlice).toContain("'idempotent', true");
  });

  it('should_denormalize_client_name_and_client_phone_into_appointments', () => {
    const createIdx = sql.indexOf('FUNCTION public.create_public_booking');
    const cancelIdx = sql.indexOf('FUNCTION public.cancel_public_booking');
    const createBody = sql.slice(createIdx, cancelIdx);

    expect(createBody).toContain('client_name, client_phone');
    expect(createBody).toContain('btrim(p_client_name)');
    expect(createBody).toContain("regexp_replace(p_client_phone, '\\D', '', 'g')");
  });

  it('should_enable_rls_on_new_tables_appointment_services_and_public_booking_tokens', () => {
    expect(sql).toContain('ALTER TABLE public.appointment_services ENABLE ROW LEVEL SECURITY;');
    expect(sql).toContain('ALTER TABLE public.public_booking_tokens ENABLE ROW LEVEL SECURITY;');
    expect(sql).toContain('CREATE POLICY appointment_services_tenant_isolation');
    expect(sql).toContain('CREATE POLICY public_booking_tokens_tenant_isolation');
  });

  it('should_support_public_cancellation_window_and_single_use_token_revocation', () => {
    const cancelIdx = sql.indexOf('FUNCTION public.cancel_public_booking');
    const cancelBody = sql.slice(cancelIdx);

    expect(cancelBody).toContain('public_cancel_window_minutes');
    expect(cancelBody).toContain('cancellation_window_closed');
    expect(cancelBody).toContain('UPDATE public.public_booking_tokens SET revoked_at = now()');
    expect(cancelBody).toContain("status = 'cancelled'");
  });
});
