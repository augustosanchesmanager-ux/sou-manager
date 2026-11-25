import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readSource = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8');

describe('AGD-002 (#388) — Concorrência no Checkout e facade única Schedule ↔ Comanda', () => {
  it('should_guard_Checkout_finish_payment_and_unlock_with_synchronous_ref_locks', () => {
    const checkoutSource = readSource('pages/Checkout.tsx');

    expect(checkoutSource).toContain('finishLockRef.current');
    expect(checkoutSource).toContain('registerPaymentLockRef.current');
    expect(checkoutSource).toContain('unlockComandaLockRef.current');
    expect(checkoutSource).toContain('if (registerPaymentLockRef.current) return;');
    expect(checkoutSource).toContain('if (unlockComandaLockRef.current) return;');
  });

  it('should_route_Schedule_comanda_sync_exclusively_through_application_facade', () => {
    const scheduleSource = readSource('pages/Schedule.tsx');

    expect(scheduleSource).toContain("from '../application/appointment/comandaSync'");
    expect(scheduleSource).not.toContain("from '../services/comandaScheduleSyncService'");
    expect(scheduleSource).not.toContain("from '../services/appointmentComandaSyncService'");
  });
});
