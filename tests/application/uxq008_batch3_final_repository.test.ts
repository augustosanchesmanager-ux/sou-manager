import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { AppointmentRpcRepositoryImpl } from '../../domain/appointment/rpc-repository';

function collectNonTestTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      results.push(...collectNonTestTsFiles(fullPath));
    } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

describe('UXQ-008 / ADR-056 — Lote 3 (Final): Zero Direct Supabase Client in application/', () => {
  it('should_have_zero_direct_supabase_client_imports_across_entire_application_layer', () => {
    const appDir = resolve(process.cwd(), 'application');
    const files = collectNonTestTsFiles(appDir);
    expect(files.length).toBeGreaterThan(0);

    for (const filePath of files) {
      const content = readFileSync(filePath, 'utf8');
      expect(content, `${filePath} still references createSupabaseClient`).not.toContain('createSupabaseClient');
      expect(content, `${filePath} still references supabaseClient`).not.toContain('supabaseClient');
    }
  });

  it('should_delegate_appointment_creation_and_payment_reversal_rpcs_cleanly', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { has_valid_payments: true }, error: null });
    const repo = new AppointmentRpcRepositoryImpl(() => ({ rpc }) as never);

    const check = await repo.checkComandaHasValidPayments('tenant-1', 'comanda-1');
    expect(rpc).toHaveBeenCalledWith('check_comanda_has_valid_payments', {
      p_tenant_id: 'tenant-1',
      p_comanda_id: 'comanda-1',
    });
    expect(check.data?.has_valid_payments).toBe(true);

    await repo.reverseComandaPayment({
      tenantId: 'tenant-1',
      comandaPaymentId: 'pay-1',
      motivo: 'Cancelamento',
      refundMethod: 'internal_credit',
      actorId: 'user-1',
    });
    expect(rpc).toHaveBeenCalledWith('reverse_comanda_payment', {
      p_tenant_id: 'tenant-1',
      p_comanda_payment_id: 'pay-1',
      p_motivo: 'Cancelamento',
      p_refund_method: 'internal_credit',
      p_actor_id: 'user-1',
    });
  });
});
