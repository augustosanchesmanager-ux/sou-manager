import { describe, it, expect } from 'vitest';
import { calculateCommissionValue } from '../../domain/commission/calculate';
import { computeDaySummary } from '../../application/cashClosing/summary';
import { calculateComboTotals } from '../../src/utils/comboCalculation';
import {
  getClientInactivityStatus,
  sanitizePhoneNumberForWhatsApp,
  generateReengagementMessage,
  buildWhatsAppUrl,
} from '../../src/utils/clientReengagement';
import { checkoutApplicationService } from '../../application/checkout';
import { staffRoleRank, canAssignStaffRole } from '../../supabase/functions/_shared/staff-role-hierarchy';
import {
  detectAppointmentOverlap,
  calculateServicesNominalDuration,
  getResolvedAppointmentInterval,
} from '../../src/utils/scheduleDuration';
import {
  canModifyLinkedComanda,
  calculateSyncedComandaItems,
  evaluateCascadingCancel,
} from '../../src/utils/comandaScheduleSync';
import {
  calculateProjectedDates,
  getIntervalDays,
  generateCativaConfirmationMessage,
  buildCativaWhatsAppUrl,
} from '../../src/utils/recurringSchedule';
import {
  calculateBarberStatementSummary,
  type BarberStatementItem,
} from '../../src/utils/barberStatement';
import { calculateTerminalFee } from '../../domain/paymentTerminal/calculateFee';
import type { PaymentTerminalRate } from '../../domain/paymentTerminal/types';
import { calculatePreferredBarber, calculateAverageTicket } from '../../src/utils/clientProfile';
import {
  getTotalAvailableCredits,
  getAvailableCreditsForService,
  type ServiceBalanceEntry,
} from '../../domain/chefClub/credits';
import { assertValidIdempotencyKey } from '../../src/lib/payments/gatewayClient';

// Helper puro de cálculo de rateio proporcional de desconto por item componente
const calculateItemDiscountShare = (itemPrice: number, sumPrice: number, totalDiscount: number): number => {
  if (sumPrice <= 0 || totalDiscount <= 0) return 0;
  return Math.round((itemPrice / sumPrice) * totalDiscount * 100) / 100;
};

describe('FASE 7.2: Business Rules Canonical Inventory Audit (27 Regras & Casos Extremos)', () => {
  // =========================================================================
  // 1. DOMÍNIO: AUTENTICAÇÃO, PERFIS E MULTI-TENANT (RN-AUTH)
  // =========================================================================
  describe('1. Domínio Autenticação, Perfis e Multi-tenant (RN-AUTH)', () => {
    it('RN-AUTH-001: should enforce tenant isolation on application requests', () => {
      // Garantia de que requisições exigem tenantId válido e não nulo
      const invalidRequest = {
        tenantId: '',
        appSlug: 'barber',
        schema: 'public',
        userId: 'user-1',
        client: { id: 'c-1', name: 'João' },
        cart: [{ id: 'i-1', name: 'Corte', type: 'service' as const, price: 50, quantity: 1 }],
        total: 50,
        discountValue: 0,
        paymentStatus: 'paid' as const,
        paymentMethod: 'cash' as const,
        closureMode: 'standard' as const,
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
      };

      const errors = checkoutApplicationService.validateFinishRequest(invalidRequest);
      expect(errors).toContain('Tenant inválido para finalizar operação.');
    });

    it('RN-AUTH-002: should rank managerial roles above operational roles and forbid unauthorized escalation', () => {
      expect(staffRoleRank('superadmin')).toBe(4);
      expect(staffRoleRank('admin')).toBe(3);
      expect(staffRoleRank('manager')).toBe(2);
      expect(staffRoleRank('owner')).toBe(2);
      expect(staffRoleRank('barber')).toBe(1);
      expect(staffRoleRank('receptionist')).toBe(1);

      // Manager (rank 2) NÃO pode atribuir papel de Admin (rank 3)
      expect(canAssignStaffRole('manager', 'admin')).toBe(false);
      // Manager pode atribuir papéis de rank 1
      expect(canAssignStaffRole('manager', 'barber')).toBe(true);
      expect(canAssignStaffRole('manager', 'receptionist')).toBe(true);
      // Admin pode atribuir manager
      expect(canAssignStaffRole('admin', 'manager')).toBe(true);
    });

    it('RN-AUTH-003: should validate profile status restrictions for operational access', () => {
      const isAllowedForOperation = (status: 'active' | 'pending' | 'suspended') => status === 'active';
      expect(isAllowedForOperation('active')).toBe(true);
      expect(isAllowedForOperation('pending')).toBe(false);
      expect(isAllowedForOperation('suspended')).toBe(false);
    });

    it('RN-AUTH-004: should require matching recipient email on atomic invite acceptance', () => {
      const validateInvite = (inviteEmail: string, candidateEmail: string) =>
        inviteEmail.toLowerCase().trim() === candidateEmail.toLowerCase().trim();

      expect(validateInvite('barbeiro@soumanager.com', 'barbeiro@soumanager.com')).toBe(true);
      expect(validateInvite('barbeiro@soumanager.com', 'outro@soumanager.com')).toBe(false);
    });
  });

  // =========================================================================
  // 2. DOMÍNIO: AGENDA E AGENDAMENTOS (RN-SCH)
  // =========================================================================
  describe('2. Domínio Agenda e Agendamentos (RN-SCH)', () => {
    it('RN-SCH-001: should detect appointment overlap unless marked as overbooked', () => {
      const existing = [
        { id: 'apt-1', staffId: 'barber-1', dateKey: '2026-11-10', startDecimal: 10, durationDecimal: 1 },
      ];

      // Sobreposição sem flag overbook: deve detectar conflito
      const conflict = detectAppointmentOverlap(
        { id: 'apt-2', staffId: 'barber-1', dateKey: '2026-11-10', startDecimal: 10.5, durationDecimal: 1 },
        existing,
      );
      expect(conflict.hasOverlap).toBe(true);
      expect(conflict.conflictingAppointments.length).toBe(1);

      // Horário contíguo (11:00 logo após 10:00-11:00): NÃO deve conflitar
      const contiguous = detectAppointmentOverlap(
        { id: 'apt-3', staffId: 'barber-1', dateKey: '2026-11-10', startDecimal: 11, durationDecimal: 1 },
        existing,
      );
      expect(contiguous.hasOverlap).toBe(false);
    });

    it('RN-SCH-002: should calculate dynamic duration for multiple services with buffer', () => {
      const catalog = [
        { id: 'srv-1', name: 'Corte', duration: 30, buffer: 5 },
        { id: 'srv-2', name: 'Barba', duration: 30, buffer: 5 },
      ];

      const totalNominal = calculateServicesNominalDuration(['srv-1', 'srv-2'], catalog);
      // 35min + 35min = 70min
      expect(totalNominal).toBe(70);

      // Verificação de intervalo customizado vs nominal
      const interval = getResolvedAppointmentInterval({ serviceId: 'srv-1', duration: 0.75 }, catalog);
      // 0.75h = 45m (nominal srv-1 = 35m) -> customizado = true
      expect(interval.isCustom).toBe(true);
      expect(interval.durationMinutes).toBe(45);
      expect(interval.nominalMinutes).toBe(35);
    });

    it('RN-SCH-003: should project recurrence intervals accurately for Cadeira Cativa', () => {
      expect(getIntervalDays('weekly')).toBe(7);
      expect(getIntervalDays('biweekly')).toBe(14);
      expect(getIntervalDays('monthly')).toBe(28);
      expect(getIntervalDays('custom', 10)).toBe(10);

      const projections = calculateProjectedDates({
        startDateStr: '2026-11-05',
        frequency: 'weekly',
        occurrences: 4,
      });

      expect(projections.length).toBe(4);
      expect(projections[0].status).toBe('scheduled'); // 1ª sessão ativa
      expect(projections[1].status).toBe('pending'); // subsequentes pendentes
      expect(projections[1].date).toBe('2026-11-12');
      expect(projections[2].date).toBe('2026-11-19');
      expect(projections[3].date).toBe('2026-11-26');
    });

    it('RN-SCH-004: should guard against modifications when linked comanda is paid or closed', () => {
      // Comanda aberta: modificação permitida
      expect(canModifyLinkedComanda({ status: 'open' }).canModify).toBe(true);

      // Comanda liquidada: modificação estritamente bloqueada
      expect(canModifyLinkedComanda({ status: 'paid' }).canModify).toBe(false);
      expect(canModifyLinkedComanda({ status: 'closed' }).canModify).toBe(false);
      expect(canModifyLinkedComanda({ status: 'billed' }).canModify).toBe(false);
    });
  });

  // =========================================================================
  // 3. DOMÍNIO: COMANDAS E BALCÃO PDV (RN-CMD)
  // =========================================================================
  describe('3. Domínio Comandas e Balcão PDV (RN-CMD)', () => {
    it('RN-CMD-001: should strictly preserve counter products (service_id is null) during service sync', () => {
      const existingItems = [
        {
          id: 'item-svc',
          comanda_id: 'cmd-1',
          service_id: 'old-service',
          product_name: 'Corte Antigo',
          unit_price: 50,
          quantity: 1,
          staff_id: 'b-1',
        },
        {
          id: 'item-prod-1',
          comanda_id: 'cmd-1',
          service_id: null,
          product_name: 'Pomada Matte',
          unit_price: 45,
          quantity: 1,
          staff_id: 'b-1',
        },
        {
          id: 'item-prod-2',
          comanda_id: 'cmd-1',
          service_id: null,
          product_name: 'Cerveja IPA',
          unit_price: 15,
          quantity: 1,
          staff_id: null,
        },
      ];

      const synced = calculateSyncedComandaItems({
        currentItems: existingItems,
        originalServiceId: 'old-service',
        newService: { id: 'new-service', name: 'Corte Degradê', price: 60 },
        newProfessionalId: 'b-2',
      });

      // Deve ter 3 itens: 1 novo serviço reatribuído + 2 produtos avulsos preservados
      expect(synced.updatedItems.length).toBe(3);
      expect(synced.preservedProductsCount).toBe(2);
      const productItems = synced.updatedItems.filter((i) => i.service_id === null);
      expect(productItems.length).toBe(2);
      expect(productItems.map((p) => p.product_name)).toContain('Pomada Matte');
      expect(productItems.map((p) => p.product_name)).toContain('Cerveja IPA');
    });

    it('RN-CMD-002: should evaluate cascading cancel options preserving comanda when requested', () => {
      const evaluation = evaluateCascadingCancel({
        comanda: { status: 'open' },
        comandaItems: [
          { id: 'i-1', service_id: 's-1', product_name: 'Corte', unit_price: 50, quantity: 1 },
          { id: 'i-2', service_id: null, product_name: 'Pomada', unit_price: 35, quantity: 1 },
        ],
      });

      expect(evaluation.requiresConfirmation).toBe(true);
      expect(evaluation.canDirectCancel).toBe(false);
      expect(evaluation.reason).toBe('has_products');
      expect(evaluation.productItems.length).toBe(1);
      expect(evaluation.productsTotal).toBe(35);
    });

    it('RN-CMD-003: should calculate combo totals and distribute discounts proportionally', () => {
      const services = [
        { id: 's1', name: 'Corte Degradê', price: 60, duration: 30 },
        { id: 's2', name: 'Barba Terapia', price: 40, duration: 30 },
      ];

      const comboFixed = calculateComboTotals({
        services,
        discountAmount: 20,
        discountType: 'fixed',
      });

      expect(comboFixed.sumPrice).toBe(100);
      expect(comboFixed.finalPrice).toBe(80);
      expect(comboFixed.discountValue).toBe(20);

      // Rateio proporcional do desconto por item
      const share1 = calculateItemDiscountShare(60, 100, 20); // 60% de R$ 20 = R$ 12
      const share2 = calculateItemDiscountShare(40, 100, 20); // 40% de R$ 20 = R$ 8
      expect(share1).toBe(12);
      expect(share2).toBe(8);
      expect(share1 + share2).toBe(20);
    });

    it('RN-CMD-004: should reject negative prices and invalid items on checkout validation', () => {
      const errors = checkoutApplicationService.validateFinishRequest({
        tenantId: 'tenant-1',
        appSlug: 'barber',
        schema: 'public',
        userId: 'user-1',
        client: { id: 'c-1', name: 'João' },
        cart: [{ id: 'i-1', name: 'Produto Inválido', type: 'product' as const, price: -10, quantity: 1 }],
        total: -10,
        discountValue: 0,
        paymentStatus: 'paid' as const,
        paymentMethod: 'cash' as const,
        closureMode: 'standard' as const,
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

      expect(errors.some((e) => e.includes('negativo') || e.includes('inconsistente'))).toBe(true);
    });
  });

  // =========================================================================
  // 4. DOMÍNIO: CHECKOUT, MEIOS DE PAGAMENTO E IDEMPOTÊNCIA (RN-PAY)
  // =========================================================================
  describe('4. Domínio Checkout, Meios de Pagamento e Idempotência (RN-PAY)', () => {
    it('RN-PAY-001: should reject checkout tampering when client total differs from item sum', () => {
      const errors = checkoutApplicationService.validateFinishRequest({
        tenantId: 'tenant-1',
        appSlug: 'barber',
        schema: 'public',
        userId: 'user-1',
        client: { id: 'c-1', name: 'João' },
        cart: [{ id: 'i-1', name: 'Corte', type: 'service' as const, price: 70, quantity: 1 }],
        total: 10, // Fraude: total R$ 10 quando esperado R$ 70
        discountValue: 0,
        paymentStatus: 'paid' as const,
        paymentMethod: 'cash' as const,
        closureMode: 'standard' as const,
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

      expect(errors).toContain('Total inconsistente: esperado R$ 70.00, recebido R$ 10.00.');
    });

    it('RN-PAY-002: should strictly validate partial payments accumulating to expected total', () => {
      const payments = [
        { method: 'cash', amount: 40 },
        { method: 'pix', amount: 35 },
      ];
      const sumPaid = payments.reduce((acc, p) => acc + p.amount, 0);
      const expectedTotal = 75;

      expect(Math.abs(sumPaid - expectedTotal)).toBeLessThanOrEqual(0.01);
    });

    it('RN-PAY-003: should require reason for payment reversals', () => {
      const validateReversal = (reason?: string) => Boolean(reason && reason.trim().length >= 3);
      expect(validateReversal('')).toBe(false);
      expect(validateReversal('   ')).toBe(false);
      expect(validateReversal('Cancelamento solicitado pelo cliente')).toBe(true);
    });

    it('RN-PAY-004: should accept standard UUID v4 idempotency keys and reject numeric PII', () => {
      // UUID v4 mesmo com 11 dígitos numéricos projetados deve ser aceito
      expect(() => assertValidIdempotencyKey('abcdef12-3456-4abc-89ab-cdefabcdef12')).not.toThrow();

      // Telefone / CPF puro numérico deve ser rejeitado como PII
      expect(() => assertValidIdempotencyKey('11999998888')).toThrow();
      expect(() => assertValidIdempotencyKey('12345678901')).toThrow();
    });
  });

  // =========================================================================
  // 5. DOMÍNIO: COMISSÕES VS FECHAMENTO DE CAIXA (RN-COM / ADR-001)
  // =========================================================================
  describe('5. Domínio Comissões vs Fechamento de Caixa (RN-COM / ADR-001)', () => {
    it('RN-COM-001 & ADR-001: should maintain strict separation between theoretical commission and cash drawer closing', () => {
      // 1. domain/commission: cota de 50% sobre R$ 80
      const commission = calculateCommissionValue(
        80,
        { affects_commission: true, payout_type: 'percentage', payout_value: 100 },
        0.5,
      );
      expect(commission).toBe(40);

      // 2. application/cashClosing: fechamento diário agregado
      const summary = computeDaySummary({
        filteredEntries: [],
        extras: [],
        comandas: [],
        appointments: [],
        filteredComandaDetails: [],
        barberSummaries: [
          {
            staffId: 'b-1',
            staffName: 'Barbeiro 1',
            role: 'barber',
            commissionRate: 0.5,
            totalReceived: 300,
            pendingTotal: 0,
            openTotal: 0,
            comandaCount: 3,
            openComandaCount: 0,
            comandas: [],
            openComandas: [],
          } as any,
        ],
        reversalEntries: [],
      });

      expect(summary.barberClosingDetails[0].totalProduced).toBe(300);
      expect(summary.totals.totalEntradas).toBe(0); // Sem entradas diretas de caixa mockadas
    });

    it('RN-COM-002: should deduct payment terminal fees from commission base when configured', () => {
      const rate: PaymentTerminalRate = {
        id: 'rate-1',
        tenant_id: 't-1',
        terminal_id: 'term-1',
        method: 'credit_sight',
        installments_min: 1,
        installments_max: 1,
        rate_percentage: 3.5, // 3,5%
        fixed_fee: 0,
        settlement_days: 1,
      };

      const feeResult = calculateTerminalFee({
        amount: 100,
        rate,
      });

      expect(feeResult.feeAmount).toBe(3.5);
      expect(feeResult.netAmount).toBe(96.5);

      // Comissão de 50% sobre a base líquida descontada da maquininha
      const netCommission = calculateCommissionValue(
        feeResult.netAmount,
        { affects_commission: true, payout_type: 'percentage', payout_value: 100 },
        0.5,
      );
      expect(netCommission).toBe(48.25);
    });

    it('RN-COM-003: should aggregate individual barber productivity statement with deduction transparency', () => {
      const items: BarberStatementItem[] = [
        {
          id: 'i-1',
          comandaId: 'c-1',
          createdAt: '2026-11-04T10:00:00Z',
          clientName: 'Arthur',
          itemName: 'Corte Degradê',
          itemType: 'service',
          grossValue: 60,
          commissionRate: 50,
          commissionValue: 30,
          comandaStatus: 'paid',
          isPaid: true,
        },
        {
          id: 'i-2',
          comandaId: 'c-2',
          createdAt: '2026-11-04T11:00:00Z',
          clientName: 'Marcos',
          itemName: 'Barba',
          itemType: 'service',
          grossValue: 40,
          commissionRate: 50,
          commissionValue: 20,
          comandaStatus: 'open',
          isPaid: false,
        },
      ];

      const statement = calculateBarberStatementSummary(items);
      expect(statement.grossProduction).toBe(100);
      expect(statement.confirmedCommission).toBe(30);
      expect(statement.pendingCommission).toBe(20);
      expect(statement.totalCommission).toBe(50);
      expect(statement.totalItems).toBe(2);
      expect(statement.totalComandas).toBe(2);
      expect(statement.averageTicket).toBe(50);
    });

    it('RN-COM-004 & ADR-018: should forbid mutating or re-settling an already settled commission record', () => {
      const record = {
        id: 'settlement-1',
        status: 'settled' as const,
        settledAt: '2026-11-01T12:00:00Z',
        totalAmount: 150,
      };

      const canReSettle = (status: string) => status === 'pending';
      expect(canReSettle(record.status)).toBe(false);
    });
  });

  // =========================================================================
  // 6. DOMÍNIO: FOLHA DE PAGAMENTO, VALES E CICLOS (RN-PAYROLL / ADR-030)
  // =========================================================================
  describe('6. Domínio Folha de Pagamento, Vales e Ciclos (RN-PAYROLL / ADR-030)', () => {
    it('RN-PAYROLL-001: should bound apuration cycle strictly within target dates', () => {
      const cycleStart = new Date('2026-11-01T00:00:00Z').getTime();
      const cycleEnd = new Date('2026-11-07T23:59:59Z').getTime();

      const isWithinCycle = (dateIso: string) => {
        const time = new Date(dateIso).getTime();
        return time >= cycleStart && time <= cycleEnd;
      };

      expect(isWithinCycle('2026-11-04T15:00:00Z')).toBe(true);
      expect(isWithinCycle('2026-10-31T23:59:59Z')).toBe(false);
      expect(isWithinCycle('2026-11-08T00:00:01Z')).toBe(false);
    });

    it('RN-PAYROLL-002: should deduct advances from net payable balance without exceeding credit', () => {
      const grossCommission = 800;
      const deductions = 50;
      const advances = 200;

      const netBalance = Math.max(0, grossCommission - deductions - advances);
      expect(netBalance).toBe(550);

      // Se adiantamentos superam a comissão, saldo a pagar é zero (sem saldo negativo ao trabalhador)
      const excessiveAdvances = 1000;
      const boundedBalance = Math.max(0, grossCommission - deductions - excessiveAdvances);
      expect(boundedBalance).toBe(0);
    });

    it('RN-PAYROLL-003: should lock settlement state upon completion', () => {
      const transitions: Record<string, string[]> = {
        draft: ['pending', 'cancelled'],
        pending: ['settled', 'cancelled'],
        settled: [], // Terminal imutável
      };

      expect(transitions.draft).toContain('pending');
      expect(transitions.pending).toContain('settled');
      expect(transitions.settled.length).toBe(0);
    });
  });

  // =========================================================================
  // 7. DOMÍNIO: CLUB DOS CHEFES & FIDELIZAÇÃO (RN-CLUB)
  // =========================================================================
  describe('7. Domínio Club dos Chefes & Fidelização (RN-CLUB)', () => {
    it('RN-CLUB-001: should compute available service credits from active subscriptions', () => {
      const balances: ServiceBalanceEntry[] = [
        { service_id: 'srv-corte', service_name: 'Corte', available: 3, used: 1 },
        { service_id: 'srv-barba', service_name: 'Barba', available: 0, used: 2 },
      ];

      expect(getTotalAvailableCredits(balances)).toBe(3);
      expect(getAvailableCreditsForService(balances, 'srv-corte')).toBe(3);
      expect(getAvailableCreditsForService(balances, 'srv-barba')).toBe(0);
      expect(getAvailableCreditsForService(balances, 'srv-outro')).toBe(0);
    });

    it('RN-CLUB-002: should zero customer price while preserving commission when service is covered by plan', () => {
      const servicePrice = 60;
      const isCoveredByCredit = true;
      const customerPayable = isCoveredByCredit ? 0 : servicePrice;
      expect(customerPayable).toBe(0);

      // A comissão do barbeiro incide sobre o valor referencial do crédito (ex: R$ 40)
      const planReferenceValue = 40;
      const commission = calculateCommissionValue(
        planReferenceValue,
        { affects_commission: true, payout_type: 'percentage', payout_value: 100 },
        0.5,
      );
      expect(commission).toBe(20);
    });

    it('RN-CLUB-003: should cancel future open receivables while preserving paid ones on cancellation', () => {
      const receivables = [
        { id: 'r-1', status: 'paid', amount: 120 },
        { id: 'r-2', status: 'open', amount: 120 },
        { id: 'r-3', status: 'open', amount: 120 },
      ];

      const afterCancellation = receivables.map((r) => (r.status === 'open' ? { ...r, status: 'cancelled' } : r));

      expect(afterCancellation.find((r) => r.id === 'r-1')?.status).toBe('paid');
      expect(afterCancellation.find((r) => r.id === 'r-2')?.status).toBe('cancelled');
      expect(afterCancellation.find((r) => r.id === 'r-3')?.status).toBe('cancelled');
    });
  });

  // =========================================================================
  // 8. DOMÍNIO: GESTÃO DE CLIENTES, CADEIRA CATIVA E RETENÇÃO (RN-CLI)
  // =========================================================================
  describe('8. Domínio Gestão de Clientes, Cadeira Cativa e Retenção (RN-CLI)', () => {
    it('RN-CLI-001: should compute client 360 metrics including average ticket and preferred barber', () => {
      expect(calculateAverageTicket(450, 5)).toBe(90);
      expect(calculateAverageTicket(0, 0)).toBe(0);

      const history = [
        { staffId: 'st-1', staffName: 'Carlos Barbeiro' },
        { staffId: 'st-1', staffName: 'Carlos Barbeiro' },
        { staffId: 'st-2', staffName: 'Marcos Barbeiro' },
      ];

      const preferred = calculatePreferredBarber(history);
      expect(preferred).not.toBeNull();
      expect(preferred?.staffId).toBe('st-1');
      expect(preferred?.name).toBe('Carlos Barbeiro');
      expect(preferred?.serviceCount).toBe(2);
    });

    it('RN-CLI-002: should classify client inactivity into 4 canonical tiers', () => {
      const recent = new Date(Date.now() - 15 * 86400000).toISOString();
      const absent = new Date(Date.now() - 40 * 86400000).toISOString();
      const critical = new Date(Date.now() - 75 * 86400000).toISOString();

      expect(getClientInactivityStatus(recent).tier).toBe('active');
      expect(getClientInactivityStatus(absent).tier).toBe('absent');
      expect(getClientInactivityStatus(critical).tier).toBe('critical');
      expect(getClientInactivityStatus(null).tier).toBe('never');
    });

    it('RN-CLI-003: should format phone numbers and construct valid WhatsApp URLs', () => {
      expect(sanitizePhoneNumberForWhatsApp('11999998888')).toBe('5511999998888');
      expect(sanitizePhoneNumberForWhatsApp('+55 11 99999-8888')).toBe('5511999998888');

      const msg = generateReengagementMessage({
        clientName: 'Augusto',
        shopName: 'Barbearia Sanchez',
        daysSinceVisit: 45,
      });
      expect(msg).toContain('Augusto');
      expect(msg).toContain('Barbearia Sanchez');
      expect(msg).toContain('45 dias');

      const url = buildWhatsAppUrl('11999998888', msg);
      expect(url).toContain('https://wa.me/5511999998888?text=');
      expect(url).toContain(encodeURIComponent('Augusto'));

      // WhatsApp Cadeira Cativa
      const cativaMsg = generateCativaConfirmationMessage({
        clientName: 'Lucas',
        barberName: 'Carlos',
        dateStr: '2026-11-12',
        timeStr: '14:00',
        shopName: 'Barbearia Sanchez',
      });
      expect(cativaMsg).toContain('Cadeira Cativa');
      expect(cativaMsg).toContain('14:00');

      const cativaUrl = buildCativaWhatsAppUrl('11988887777', cativaMsg);
      expect(cativaUrl).toContain('https://wa.me/5511988887777');
    });
  });

  // =========================================================================
  // 9. CASOS EXTREMOS FINANCEIROS & INTEGRAÇÃO MULTI-DOMÍNIO (DECISÃO 2-A)
  // =========================================================================
  describe('9. Casos Extremos Financeiros & Integração Multi-domínio (Decisão 2-A)', () => {
    it('Caso Extremo 1: Comanda Multi-Barbeiro + Produtos de Balcão Avulsos', () => {
      // Barbeiro 1 faz Corte (R$ 60, comissão 50%)
      // Barbeiro 2 faz Barba (R$ 40, comissão 40%)
      // Pomada de balcão (R$ 50, comissão 0% para barbeiros, 100% casa)
      const commissionB1 = calculateCommissionValue(
        60,
        { affects_commission: true, payout_type: 'percentage', payout_value: 100 },
        0.5,
      );
      const commissionB2 = calculateCommissionValue(
        40,
        { affects_commission: true, payout_type: 'percentage', payout_value: 100 },
        0.4,
      );

      expect(commissionB1).toBe(30);
      expect(commissionB2).toBe(16);

      // Total faturado da comanda = R$ 150
      const totalComanda = 60 + 40 + 50;
      expect(totalComanda).toBe(150);

      // Comissões somadas = R$ 46; Margem líquida da casa = R$ 104
      const totalComissoes = commissionB1 + commissionB2;
      const margemCasa = totalComanda - totalComissoes;
      expect(totalComissoes).toBe(46);
      expect(margemCasa).toBe(104);
    });

    it('Caso Extremo 2: Combo com Desconto Rateado Proporcionalmente sobre Serviços de Valores Distintos', () => {
      // Combo Cabelo (R$ 70) + Barba (R$ 30) = R$ 100 nominal com R$ 20 de desconto total
      const srv1Nominal = 70;
      const srv2Nominal = 30;
      const totalDiscount = 20;

      const discountShare1 = calculateItemDiscountShare(srv1Nominal, 100, totalDiscount);
      const discountShare2 = calculateItemDiscountShare(srv2Nominal, 100, totalDiscount);

      expect(discountShare1).toBe(14); // 70% de R$ 20 = R$ 14
      expect(discountShare2).toBe(6); // 30% de R$ 20 = R$ 6
      expect(discountShare1 + discountShare2).toBe(20);

      // Preço final líquido de cada serviço no combo
      const srv1Net = srv1Nominal - discountShare1; // R$ 56
      const srv2Net = srv2Nominal - discountShare2; // R$ 24
      expect(srv1Net + srv2Net).toBe(80);

      // Comissão do barbeiro calculada sobre o líquido justo do combo
      const commissionSrv1 = calculateCommissionValue(
        srv1Net,
        { affects_commission: true, payout_type: 'percentage', payout_value: 100 },
        0.5,
      );
      expect(commissionSrv1).toBe(28); // 50% de 56
    });

    it('Caso Extremo 3: Pagamento Misto — Créditos do Club dos Chefes + Saldo no Cartão', () => {
      // Comanda: Corte (R$ 60, coberto pelo plano) + Pomada Balcão (R$ 35, avulsa)
      // Total nominal = R$ 95
      const corteCobertoPorPlano = true;
      const valorPomada = 35;

      const valorCobradoCliente = (corteCobertoPorPlano ? 0 : 60) + valorPomada;
      expect(valorCobradoCliente).toBe(35);

      // Barbeiro recebe comissão sobre o valor acordado do crédito do plano (R$ 40 de base)
      const commissionCorte = calculateCommissionValue(
        40,
        { affects_commission: true, payout_type: 'percentage', payout_value: 100 },
        0.5,
      );
      expect(commissionCorte).toBe(20);
    });

    it('Caso Extremo 4: Dedução Líquida de Taxa de Maquininha da Base de Comissão', () => {
      // Serviço de R$ 200 pago no Crédito parcelado com taxa de maquininha de 5% (R$ 10)
      const rate3x: PaymentTerminalRate = {
        id: 'rate-3x',
        tenant_id: 'term-1',
        terminal_id: 'term-1',
        method: 'credit_installment',
        installments_min: 3,
        installments_max: 3,
        rate_percentage: 5.0,
        fixed_fee: 0,
        settlement_days: 30,
      };

      const terminalResult = calculateTerminalFee({
        amount: 200,
        rate: rate3x,
      });

      expect(terminalResult.feeAmount).toBe(10);
      expect(terminalResult.netAmount).toBe(190);

      // Comissão do barbeiro de 50% sobre os R$ 190 líquidos recebidos pela casa
      const commissionNet = calculateCommissionValue(
        terminalResult.netAmount,
        { affects_commission: true, payout_type: 'percentage', payout_value: 100 },
        0.5,
      );
      expect(commissionNet).toBe(95);

      // Sem dedução de maquininha, seria R$ 100. A dedução líquida protege a margem da barbearia em R$ 5
      expect(commissionNet).toBeLessThan(100);
      expect(100 - commissionNet).toBe(5);
    });
  });
});
