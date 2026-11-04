import { describe, it, expect } from 'vitest';
import { calculateCommissionValue } from '../../domain/commission/calculate';
import { computeDaySummary } from '../../application/cashClosing/summary';
import { calculateComboTotals } from '../../src/utils/comboCalculation';
import { getClientInactivityStatus } from '../../src/utils/clientReengagement';
import { checkoutApplicationService } from '../../application/checkout';
import { staffRoleRank, canAssignStaffRole } from '../../supabase/functions/_shared/staff-role-hierarchy';

describe('FASE 7.2: Business Rules Canonical Inventory Audit', () => {
  describe('RN-COM-001 & ADR-001: Separation of Commission vs Cash Settlement', () => {
    it('should calculate theoretical commission via domain/commission independently of cash closing', () => {
      // 50% de comissão sobre R$ 100 base para participante com 100% de cota
      const participant = {
        affects_commission: true,
        payout_type: 'percentage' as const,
        payout_value: 100,
      };
      const commission = calculateCommissionValue(100, participant, 0.5);
      expect(commission).toBe(50);
    });

    it('should compute cash closing settlement via application/cashClosing without mutating theoretical rates', () => {
      const result = computeDaySummary({
        filteredEntries: [],
        extras: [],
        comandas: [],
        appointments: [],
        filteredComandaDetails: [],
        barberSummaries: [
          {
            staffId: 'barber-1',
            staffName: 'Carlos',
            role: 'barber',
            commissionRate: 0.5,
            totalReceived: 200,
            pendingTotal: 0,
            openTotal: 0,
            comandaCount: 2,
            openComandaCount: 0,
            comandas: [],
            openComandas: [],
          } as any,
        ],
        reversalEntries: [],
      });

      const carlos = result.barberClosingDetails.find((b) => b.staffId === 'barber-1');
      expect(carlos).toBeDefined();
      expect(carlos!.totalProduced).toBe(200);
      expect(carlos!.pendingReceived).toBe(0);
    });
  });

  describe('RN-CMD-003: Combo Calculation and Promotional Discounts', () => {
    it('should correctly calculate fixed discount for combo services', () => {
      const services = [
        { id: 's1', name: 'Corte', price: 50, duration: 30 },
        { id: 's2', name: 'Barba', price: 40, duration: 30 },
      ];

      const combo = calculateComboTotals({
        services,
        discountAmount: 15,
        discountType: 'fixed',
      });

      expect(combo.sumPrice).toBe(90);
      expect(combo.finalPrice).toBe(75);
      expect(combo.discountValue).toBe(15);
      expect(combo.sumDuration).toBe(60);
      expect(combo.savings).toBe(15);
    });

    it('should correctly calculate percentage discount for combo services', () => {
      const services = [
        { id: 's1', name: 'Corte', price: 60, duration: 30 },
        { id: 's2', name: 'Sobrancelha', price: 40, duration: 15 },
      ];

      const combo = calculateComboTotals({
        services,
        discountAmount: 20, // 20%
        discountType: 'percentage',
      });

      expect(combo.sumPrice).toBe(100);
      expect(combo.finalPrice).toBe(80);
      expect(combo.discountValue).toBe(20);
      expect(combo.savings).toBe(20);
    });
  });

  describe('RN-CLI-002: Client Inactivity Tiers & Churn Prevention', () => {
    it('should classify client within 30 days as active', () => {
      const recentDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
      const status = getClientInactivityStatus(recentDate);
      expect(status.tier).toBe('active');
    });

    it('should classify client between 31 and 60 days as absent', () => {
      const absentDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
      const status = getClientInactivityStatus(absentDate);
      expect(status.tier).toBe('absent');
    });

    it('should classify client beyond 60 days as critical', () => {
      const criticalDate = new Date(Date.now() - 75 * 24 * 60 * 60 * 1000).toISOString();
      const status = getClientInactivityStatus(criticalDate);
      expect(status.tier).toBe('critical');
    });

    it('should classify client without visits as never', () => {
      expect(getClientInactivityStatus(null).tier).toBe('never');
      expect(getClientInactivityStatus(undefined).tier).toBe('never');
      expect(getClientInactivityStatus('').tier).toBe('never');
    });
  });

  describe('RN-PAY-001: Checkout Server-side Pricing and Tampering Rejection', () => {
    it('should reject finish request if item total does not match cart sum', () => {
      const errors = checkoutApplicationService.validateFinishRequest({
        tenantId: 'tenant-1',
        appSlug: 'barber',
        schema: 'public',
        userId: 'user-1',
        client: { id: 'c-1', name: 'João' },
        cart: [{ id: 'i-1', name: 'Corte', type: 'service', price: 60, quantity: 1 }],
        total: 10, // Tampered: expected 60
        discountValue: 0,
        paymentStatus: 'paid',
        paymentMethod: 'cash',
        closureMode: 'standard',
        closureNote: '',
        shouldApplyFinancialEffects: true,
        shouldDeductMembershipCredits: false,
        isLegacyClubSettlement: false,
        canCloseWithAdministrativeOrigin: false,
        shouldSettleZeroWithAudit: false,
        zeroCloseReason: '',
        creditItems: [],
        shouldCollectDiscountAudit: false,
        internalSettlementTitle: 'Fechamento',
      });

      expect(errors).toContain('Total inconsistente: esperado R$ 60.00, recebido R$ 10.00.');
    });
  });

  describe('RN-AUTH-002: Role Hierarchy & Manager Access Gating', () => {
    it('should rank managerial roles above operational roles', () => {
      expect(staffRoleRank('superadmin')).toBe(4);
      expect(staffRoleRank('admin')).toBe(3);
      expect(staffRoleRank('manager')).toBe(2);
      expect(staffRoleRank('owner')).toBe(2);
      expect(staffRoleRank('barber')).toBe(1);
      expect(staffRoleRank('receptionist')).toBe(1);
    });

    it('should prevent managers from creating or escalating to admin roles', () => {
      // Manager (rank 2) NÃO pode criar admin (rank 3)
      expect(canAssignStaffRole('manager', 'admin')).toBe(false);
      // Manager pode criar barbeiro e recepcionista (rank 1)
      expect(canAssignStaffRole('manager', 'barber')).toBe(true);
      expect(canAssignStaffRole('manager', 'receptionist')).toBe(true);
      // Superadmin pode criar admin
      expect(canAssignStaffRole('superadmin', 'admin')).toBe(true);
    });
  });
});
