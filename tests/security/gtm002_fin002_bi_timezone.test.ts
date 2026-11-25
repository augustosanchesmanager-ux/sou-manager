import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { businessDateInTimeZone } from '../../shared/dates/timezone';
import { findActiveOpenComanda } from '../../src/utils/comandaQuickActions';

const ROOT = process.cwd();

describe('GTM-002 + FIN-002 (#381) BI integrity, hardcode removal & BRT timezone', () => {
  it('should_keep_same_operational_date_at_22_30_brt_even_when_utc_rolled_over', () => {
    // 2026-11-24 22:30 BRT === 2026-11-25 01:30 UTC
    const lateNightBrt = new Date('2026-11-24T22:30:00-03:00');
    expect(lateNightBrt.toISOString().startsWith('2026-11-25')).toBe(true);
    expect(businessDateInTimeZone(lateNightBrt)).toBe('2026-11-24');

    const active = findActiveOpenComanda(
      [
        {
          id: 'cmd-brt-1',
          client_id: 'cli-1',
          status: 'open',
          created_at: '2026-11-24T21:00:00-03:00',
        },
      ],
      'cli-1',
      lateNightBrt
    );
    expect(active?.id).toBe('cmd-brt-1');
  });

  it('should_have_zero_fabricated_formulas_or_single_tenant_hardcodes_in_bi', () => {
    const cockpitSource = fs.readFileSync(
      path.join(ROOT, 'src/modules/bi/biCockpitService.ts'),
      'utf8'
    );
    const biPageSource = fs.readFileSync(
      path.join(ROOT, 'pages/BusinessIntelligence.tsx'),
      'utf8'
    );

    expect(cockpitSource).not.toContain('Math.max(incomeFromTx');
    expect(cockpitSource).not.toContain('effectiveGross * 0.45');
    expect(cockpitSource).not.toContain('effectiveGross * 0.025');
    expect(cockpitSource).not.toContain('effectiveGross * 0.85');
    expect(cockpitSource).not.toContain('85 + (count % 15)');

    expect(biPageSource).not.toContain('Sanchez Barber');
    expect(biPageSource).not.toContain('Rubens, Heron, Lucas');
    expect(biPageSource).not.toContain('effectiveGross * 0.025');
    expect(biPageSource).not.toContain('totalGrossRevenue * 0.5');
  });

  it('should_use_closed_at_and_canonical_commissions_in_daily_summary_and_actual_period_days_in_strategic_dashboard', () => {
    const dailySummarySource = fs.readFileSync(
      path.join(ROOT, 'services/dailySummaryService.ts'),
      'utf8'
    );
    const strategicSource = fs.readFileSync(
      path.join(ROOT, 'hooks/useStrategicDashboard.ts'),
      'utf8'
    );
    const cashClosingSource = fs.readFileSync(
      path.join(ROOT, 'src/hooks/useCashClosing.ts'),
      'utf8'
    );

    expect(dailySummarySource).toContain(".gte('closed_at', startIso)");
    expect(dailySummarySource).toContain("from('commission_records')");
    expect(strategicSource).not.toContain('staffCount * 12 * 30');
    expect(cashClosingSource).toContain('T00:00:00.000-03:00');
  });

  it('should_have_zero_utc_iso_date_splits_in_audited_operational_files', () => {
    const auditedFiles = [
      'pages/DailySummary.tsx',
      'components/DashboardAlerts.tsx',
      'components/AccountsPayableWidget.tsx',
      'components/dashboard/ClubReceivablesWidget.tsx',
      'components/commissions/BarberCommissionStatementModal.tsx',
      'components/payroll/PayoutCycleConfigModal.tsx',
      'src/hooks/useMembershipOverview.ts',
      'src/hooks/useRecurringBills.ts',
      'domain/cashLedger/cashLedgerRepository.ts',
      'domain/paymentTerminal/calculateFee.ts',
      'src/utils/comandaQuickActions.ts',
      'src/utils/clientProfile.ts',
      'src/lib/banking/ofxParser.ts',
    ];

    for (const relPath of auditedFiles) {
      const content = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
      expect(content, `Unexpected UTC split in ${relPath}`).not.toContain(
        ".toISOString().split('T')[0]"
      );
    }
  });
});
