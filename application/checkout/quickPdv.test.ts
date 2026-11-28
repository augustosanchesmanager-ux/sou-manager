import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildDefaultTerminalSnapshot,
  buildQuickPdvCompetenceIso,
  calculateQuickPdvTotals,
  quickRegisterAndSettle,
  QuickPdvPartialFailureError,
  settleExistingComandaQuick,
} from './quickPdv';
import type { PaymentTerminalWithRates } from '../../domain/paymentTerminal/types';

const mockFinish = vi.fn();
const mockSyncComanda = vi.fn();
const mockSyncItemsWithCompensation = vi.fn();
const mockSyncParticipants = vi.fn();
const mockCreateAppointment = vi.fn();
const mockChangeStatus = vi.fn();
const mockComandaItemList = vi.fn();
const mockComandaUpdate = vi.fn();
const mockMarkAsFiado = vi.fn();
const mockClientCreate = vi.fn();
const mockGetByBusinessDate = vi.fn();
const mockWalletRecordTransaction = vi.fn();
const mockSettleComandaWithClubCredits = vi.fn();
const mockTriggerAsyncFiscalEmission = vi.fn();
const mockSettlementRpc = vi.fn();
const mockMarkCustomerVoucherUsed = vi.fn();

vi.mock('../checkout', async () => {
  const actual = await vi.importActual<typeof import('../checkout')>('../checkout');
  return {
    ...actual,
    checkoutApplicationService: {
      finish: (...args: any[]) => mockFinish(...args),
      syncComanda: (...args: any[]) => mockSyncComanda(...args),
      syncItemsWithCompensation: (...args: any[]) => mockSyncItemsWithCompensation(...args),
      syncParticipants: (...args: any[]) => mockSyncParticipants(...args),
    },
  };
});

vi.mock('../appointment', () => ({
  appointmentApplicationService: {
    createAppointment: (...args: any[]) => mockCreateAppointment(...args),
    changeStatus: (...args: any[]) => mockChangeStatus(...args),
  },
}));

vi.mock('../../domain/comanda/item-repository', () => ({
  comandaItemRepository: {
    list: (...args: any[]) => mockComandaItemList(...args),
  },
}));

vi.mock('../../domain/comanda/repository', () => ({
  comandaRepository: {
    update: (...args: any[]) => mockComandaUpdate(...args),
    markAsFiado: (...args: any[]) => mockMarkAsFiado(...args),
    list: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../domain/comanda/settlement-repository', () => ({
  comandaSettlementRepository: {
    getClient: () => ({
      rpc: (...args: any[]) => mockSettlementRpc(...args),
    }),
  },
}));

vi.mock('../../domain/client/repository', () => ({
  clientRepository: {
    create: (...args: any[]) => mockClientCreate(...args),
    getOneById: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('../../domain/cashClosing/repository', () => ({
  cashClosingRepository: {
    getByBusinessDate: (...args: any[]) => mockGetByBusinessDate(...args),
  },
}));

vi.mock('../../domain/clientWallet/walletRepository', () => ({
  clientWalletRepository: {
    getWallet: vi.fn().mockResolvedValue(null),
    recordTransaction: (...args: any[]) => mockWalletRecordTransaction(...args),
  },
}));

vi.mock('../../domain/chefClub/clientCreditCheck', () => ({
  checkClientCreditEligibility: vi.fn().mockResolvedValue(null),
  settleComandaWithClubCredits: (...args: any[]) => mockSettleComandaWithClubCredits(...args),
}));

vi.mock('../../domain/fiscal/fiscalTrigger', () => ({
  triggerAsyncFiscalEmission: (...args: any[]) => mockTriggerAsyncFiscalEmission(...args),
}));

vi.mock('../../src/lib/vouchers', () => ({
  markCustomerVoucherUsed: (...args: any[]) => mockMarkCustomerVoucherUsed(...args),
}));

const sampleTerminal: PaymentTerminalWithRates = {
  id: 'term-stone-1',
  tenant_id: 'tenant-1',
  name: 'Stone Balcão',
  acquirer: 'stone',
  is_default: true,
  is_active: true,
  rates: [
    {
      id: 'rate-debit',
      terminal_id: 'term-stone-1',
      tenant_id: 'tenant-1',
      method: 'debit',
      installments_min: 1,
      installments_max: 1,
      rate_percentage: 1.5,
      fixed_fee: 0,
      settlement_days: 1,
    },
    {
      id: 'rate-credit',
      terminal_id: 'term-stone-1',
      tenant_id: 'tenant-1',
      method: 'credit_sight',
      installments_min: 1,
      installments_max: 1,
      rate_percentage: 3.2,
      fixed_fee: 0,
      settlement_days: 30,
    },
  ],
};

describe('ADR-059 quickPdv application orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockComandaItemList.mockResolvedValue([]);
    mockGetByBusinessDate.mockResolvedValue(null);
    mockChangeStatus.mockResolvedValue(undefined);
    mockSettlementRpc.mockResolvedValue({ data: { valid: true }, error: null });
    mockMarkCustomerVoucherUsed.mockResolvedValue({});
    mockFinish.mockResolvedValue({
      comandaId: 'cmd-123',
      paymentStatus: 'paid',
      isLegacyClubSettlement: false,
    });
  });

  describe('buildQuickPdvCompetenceIso', () => {
    it('should_use_current_instant_when_date_is_today_and_time_omitted', () => {
      const fixedNow = new Date(2026, 10, 28, 15, 30, 0, 0);
      const iso = buildQuickPdvCompetenceIso('2026-11-28', '', fixedNow);
      expect(iso).toBe(fixedNow.toISOString());
    });

    it('should_use_local_midday_when_date_is_past_and_time_omitted', () => {
      const fixedNow = new Date(2026, 10, 28, 15, 30, 0, 0);
      const iso = buildQuickPdvCompetenceIso('2026-11-26', null, fixedNow);
      const expected = new Date(2026, 10, 26, 12, 0, 0, 0).toISOString();
      expect(iso).toBe(expected);
    });

    it('should_apply_explicit_optional_time_when_provided', () => {
      const fixedNow = new Date(2026, 10, 28, 18, 0, 0, 0);
      const iso = buildQuickPdvCompetenceIso('2026-11-27', '09:45', fixedNow);
      const expected = new Date(2026, 10, 27, 9, 45, 0, 0).toISOString();
      expect(iso).toBe(expected);
    });

    it('should_reject_future_competence_date', () => {
      const fixedNow = new Date(2026, 10, 28, 15, 30, 0, 0);
      expect(() => buildQuickPdvCompetenceIso('2026-11-29', null, fixedNow)).toThrow(
        'Data de competencia'.replace('competencia', 'competência'),
      );
    });
  });

  describe('buildDefaultTerminalSnapshot', () => {
    it('should_calculate_snapshot_for_default_terminal_on_debit', () => {
      const snap = buildDefaultTerminalSnapshot(
        [sampleTerminal],
        'debit',
        100,
        '2026-11-28T15:00:00.000Z',
      );

      expect(snap).not.toBeNull();
      expect(snap?.terminalId).toBe('term-stone-1');
      expect(snap?.feePercentage).toBe(1.5);
      expect(snap?.feeAmount).toBe(1.5);
      expect(snap?.netAmount).toBe(98.5);
    });

    it('should_return_null_for_cash_or_missing_terminals', () => {
      expect(
        buildDefaultTerminalSnapshot([sampleTerminal], 'cash', 100, '2026-11-28T15:00:00.000Z'),
      ).toBeNull();
      expect(
        buildDefaultTerminalSnapshot([], 'credit', 100, '2026-11-28T15:00:00.000Z'),
      ).toBeNull();
    });
  });

  describe('settleExistingComandaQuick (Modal A)', () => {
    it('should_delegate_paid_checkout_to_canonical_service_with_extras_and_terminal_snapshot', async () => {
      mockComandaItemList.mockResolvedValue([
        {
          id: 'item-db-1',
          comanda_id: 'cmd-123',
          service_id: 'srv-cut',
          product_id: null,
          product_name: 'Corte Degradê',
          quantity: 1,
          unit_price: 50,
          staff_id: 'staff-heron',
        },
      ]);

      const result = await settleExistingComandaQuick({
        tenantId: 'tenant-1',
        userId: 'staff-heron',
        actorRole: 'barber',
        comanda: {
          id: 'cmd-123',
          total: 45, // desconto prévio de R$ 5 preservado
          staff_id: 'staff-heron',
          appointment_id: 'apt-1',
          client_id: 'cli-1',
          client_name: 'João Silva',
          client_phone: '11999998888',
        },
        addedItems: [
          {
            item: { id: 'prd-1', type: 'product', name: 'Pomada Matte', price: 40 },
            quantity: 1,
            staffId: 'staff-heron',
          },
        ],
        paymentMethod: 'debit',
        terminals: [sampleTerminal],
        idempotencyKey: 'idem-express-1',
      });

      expect(mockFinish).toHaveBeenCalledTimes(1);
      const [finishReq, idemKey] = mockFinish.mock.calls[0];
      expect(idemKey).toBe('idem-express-1');
      expect(finishReq.comandaId).toBe('cmd-123');
      expect(finishReq.total).toBe(85);
      expect(finishReq.discountValue).toBe(5);
      expect(finishReq.cart).toHaveLength(2);
      expect(finishReq.settlementSource).toBe('quick_pdv_express');
      expect(finishReq.terminalSnapshot?.terminalId).toBe('term-stone-1');
      expect(result.total).toBe(85);
      expect(mockTriggerAsyncFiscalEmission).toHaveBeenCalledTimes(1);
    });

    it('should_settle_via_club_credits_when_paymentMethod_is_club_credit', async () => {
      const result = await settleExistingComandaQuick({
        tenantId: 'tenant-1',
        userId: 'mgr-1',
        comanda: {
          id: 'cmd-club',
          total: 50,
          client_id: 'cli-vip',
          client_name: 'Carlos VIP',
        },
        paymentMethod: 'club_credit',
      });

      expect(mockSettleComandaWithClubCredits).toHaveBeenCalledTimes(1);
      expect(mockFinish).not.toHaveBeenCalled();
      expect(result.total).toBe(0);
      expect(result.paymentLabel).toBe('Club dos Chefes');
    });

    it('should_settle_fiado_with_valid_pin_and_reject_fiado_without_client', async () => {
      await expect(
        settleExistingComandaQuick({
          tenantId: 'tenant-1',
          comanda: { id: 'cmd-avulso', total: 50, client_id: null },
          paymentMethod: 'fiado',
          auditPin: '123456',
        }),
      ).rejects.toThrow('Fiado exige cliente cadastrado');

      await settleExistingComandaQuick({
        tenantId: 'tenant-1',
        comanda: { id: 'cmd-fiado', total: 50, client_id: 'cli-1', client_name: 'Pedro' },
        paymentMethod: 'fiado',
        auditPin: '654321',
      });

      expect(mockSettlementRpc).toHaveBeenCalledWith('validate_audit_pin', {
        p_pin: '654321',
        p_tenant_id: 'tenant-1',
      });
      expect(mockMarkAsFiado).toHaveBeenCalledTimes(1);
      expect(mockWalletRecordTransaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('quickRegisterAndSettle (Modal B)', () => {
    it('should_create_inline_client_appointment_and_settle_comanda_together', async () => {
      mockClientCreate.mockResolvedValue({
        id: 'cli-new-1',
        name: 'Cliente Novo Heron',
        phone: '11988887777',
      });
      mockCreateAppointment.mockResolvedValue({
        appointmentId: 'apt-new-1',
        comandaId: 'cmd-new-1',
        totalPrice: 95,
      });

      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      const result = await quickRegisterAndSettle({
        tenantId: 'tenant-1',
        actorUserId: 'mgr-1',
        actorRole: 'owner',
        staffId: 'staff-heron',
        inlineNewClient: { name: 'Cliente Novo Heron', phone: '11988887777' },
        competenceDate: todayStr,
        optionalTime: '14:30',
        items: [
          { item: { id: 'srv-1', type: 'service', name: 'Corte', price: 50, duration: 30 }, quantity: 1 },
          { item: { id: 'prd-1', type: 'product', name: 'Pomada', price: 45 }, quantity: 1 },
        ],
        paymentMethod: 'pix',
      });

      expect(mockClientCreate).toHaveBeenCalledTimes(1);
      expect(mockCreateAppointment).toHaveBeenCalledWith(
        expect.objectContaining({
          staffId: 'staff-heron',
          serviceIds: ['srv-1'],
          isOverbooked: true,
        }),
      );
      expect(mockFinish).toHaveBeenCalledWith(
        expect.objectContaining({
          comandaId: 'cmd-new-1',
          relatedAppointmentId: 'apt-new-1',
          total: 95,
          settlementSource: 'quick_pdv_batch',
        }),
        expect.any(String),
      );
      expect(result.createdClient?.id).toBe('cli-new-1');
      expect(result.comandaId).toBe('cmd-123');
    });

    it('should_reject_retroactive_date_for_barber_and_receptionist', async () => {
      await expect(
        quickRegisterAndSettle({
          tenantId: 'tenant-1',
          actorUserId: 'barber-1',
          actorRole: 'barber',
          staffId: 'barber-1',
          clientName: 'Consumidor Final',
          competenceDate: '2025-01-10',
          items: [{ item: { id: 'srv-1', type: 'service', name: 'Corte', price: 50 }, quantity: 1 }],
          paymentMethod: 'pix',
        }),
      ).rejects.toThrow('dias anteriores');

      await expect(
        quickRegisterAndSettle({
          tenantId: 'tenant-1',
          actorUserId: 'rec-1',
          actorRole: 'receptionist',
          staffId: 'barber-1',
          clientName: 'Consumidor Final',
          competenceDate: '2025-01-10',
          items: [{ item: { id: 'srv-1', type: 'service', name: 'Corte', price: 50 }, quantity: 1 }],
          paymentMethod: 'pix',
        }),
      ).rejects.toThrow('dias anteriores');
    });

    it('should_reject_other_staffId_when_actor_is_barber', async () => {
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      await expect(
        quickRegisterAndSettle({
          tenantId: 'tenant-1',
          actorUserId: 'barber-1',
          actorRole: 'barber',
          staffId: 'barber-2',
          clientName: 'Consumidor Final',
          competenceDate: todayStr,
          items: [{ item: { id: 'srv-1', type: 'service', name: 'Corte', price: 50 }, quantity: 1 }],
          paymentMethod: 'pix',
        }),
      ).rejects.toThrow('própria cadeira');
    });

    it('should_require_audit_pin_for_manager_on_confirmed_closed_cash_day', async () => {
      mockGetByBusinessDate.mockResolvedValue({ id: 'cc-1', status: 'confirmed' });
      mockCreateAppointment.mockResolvedValue({
        appointmentId: 'apt-retro-1',
        comandaId: 'cmd-retro-1',
        totalPrice: 50,
      });

      await expect(
        quickRegisterAndSettle({
          tenantId: 'tenant-1',
          actorUserId: 'mgr-1',
          actorRole: 'manager',
          staffId: 'staff-heron',
          clientName: 'Cliente Retro',
          competenceDate: '2026-11-20',
          items: [{ item: { id: 'srv-1', type: 'service', name: 'Corte', price: 50 }, quantity: 1 }],
          paymentMethod: 'cash',
        }),
      ).rejects.toThrow('PIN do gestor');

      await quickRegisterAndSettle({
        tenantId: 'tenant-1',
        actorUserId: 'mgr-1',
        actorRole: 'manager',
        staffId: 'staff-heron',
        clientName: 'Cliente Retro',
        competenceDate: '2026-11-20',
        items: [{ item: { id: 'srv-1', type: 'service', name: 'Corte', price: 50 }, quantity: 1 }],
        paymentMethod: 'cash',
        auditPin: '123456',
      });

      expect(mockFinish).toHaveBeenCalledWith(
        expect.objectContaining({
          auditPin: '123456',
        }),
        expect.any(String),
      );
    });

    it('should_preserve_recovery_state_and_retry_without_duplicating_appointment', async () => {
      mockCreateAppointment.mockResolvedValue({
        appointmentId: 'apt-rec-1',
        comandaId: 'cmd-rec-1',
        totalPrice: 50,
      });
      mockFinish.mockRejectedValueOnce(new Error('Falha temporária de rede'));

      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      let capturedError: unknown;
      try {
        await quickRegisterAndSettle({
          tenantId: 'tenant-1',
          actorUserId: 'mgr-1',
          actorRole: 'owner',
          staffId: 'staff-heron',
          clientName: 'Cliente Retry',
          competenceDate: todayStr,
          items: [{ item: { id: 'srv-1', type: 'service', name: 'Corte', price: 50 }, quantity: 1 }],
          paymentMethod: 'pix',
        });
      } catch (err) {
        capturedError = err;
      }

      expect(capturedError).toBeInstanceOf(QuickPdvPartialFailureError);
      const recovery = (capturedError as QuickPdvPartialFailureError).recovery;
      expect(recovery.appointmentId).toBe('apt-rec-1');
      expect(recovery.comandaId).toBe('cmd-rec-1');

      // Segunda tentativa usando resumeState: NÃO deve chamar createAppointment novamente!
      mockFinish.mockResolvedValueOnce({
        comandaId: 'cmd-rec-1',
        paymentStatus: 'paid',
        isLegacyClubSettlement: false,
      });

      await quickRegisterAndSettle({
        tenantId: 'tenant-1',
        actorUserId: 'mgr-1',
        actorRole: 'owner',
        staffId: 'staff-heron',
        clientName: 'Cliente Retry',
        competenceDate: todayStr,
        items: [{ item: { id: 'srv-1', type: 'service', name: 'Corte', price: 50 }, quantity: 1 }],
        paymentMethod: 'pix',
        resumeState: recovery,
      });

      expect(mockCreateAppointment).toHaveBeenCalledTimes(1);
      expect(mockFinish).toHaveBeenCalledTimes(2);
    });

    it('should_allow_product_only_quick_sale_without_creating_appointment', async () => {
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      await quickRegisterAndSettle({
        tenantId: 'tenant-1',
        actorUserId: 'mgr-1',
        actorRole: 'owner',
        staffId: 'staff-heron',
        clientName: 'Consumidor Final',
        competenceDate: todayStr,
        items: [{ item: { id: 'prd-1', type: 'product', name: 'Pomada', price: 45 }, quantity: 2 }],
        paymentMethod: 'pix',
      });

      expect(mockCreateAppointment).not.toHaveBeenCalled();
      expect(mockFinish).toHaveBeenCalledWith(
        expect.objectContaining({
          total: 90,
          relatedAppointmentId: undefined,
        }),
        expect.any(String),
      );
    });

    it('should_apply_manual_discount_and_voucher_computing_gross_and_net_totals', async () => {
      mockCreateAppointment.mockResolvedValue({
        appointmentId: 'apt-disc-1',
        comandaId: 'cmd-disc-1',
        totalPrice: 70,
      });

      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      const result = await quickRegisterAndSettle({
        tenantId: 'tenant-1',
        actorUserId: 'mgr-1',
        actorRole: 'owner',
        staffId: 'staff-heron',
        clientId: 'cli-1',
        clientName: 'João Fiel',
        competenceDate: todayStr,
        items: [{ item: { id: 'srv-1', type: 'service', name: 'Combo', price: 100, duration: 45 }, quantity: 1 }],
        paymentMethod: 'pix',
        discountValue: 10,
        discountBearer: 'house',
        discountReasonNote: 'Cliente VIP fidelidade',
        voucherId: 'vch-1',
        voucherCode: 'VIP20',
        voucherDiscount: 20,
      });

      expect(mockFinish).toHaveBeenCalledWith(
        expect.objectContaining({
          total: 70,
          discountValue: 10,
          voucherId: 'vch-1',
          voucherCode: 'VIP20',
          voucherDiscount: 20,
          discountBearer: 'house',
          shouldCollectDiscountAudit: true,
          discountAuditDraft: expect.objectContaining({
            amount: 10,
            type: 'barbershop_discount',
            reasonNote: 'Cliente VIP fidelidade',
          }),
        }),
        expect.any(String),
      );
      expect(mockMarkCustomerVoucherUsed).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        voucherId: 'vch-1',
        usedByUserId: 'mgr-1',
        usedComandaId: 'cmd-123',
      });
      expect(result.grossTotal).toBe(100);
      expect(result.discountValue).toBe(10);
      expect(result.voucherDiscount).toBe(20);
      expect(result.total).toBe(70);
    });

    it('should_reject_manual_discount_for_barber_role', async () => {
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      await expect(
        quickRegisterAndSettle({
          tenantId: 'tenant-1',
          actorUserId: 'barber-1',
          actorRole: 'barber',
          staffId: 'barber-1',
          clientName: 'Consumidor Final',
          competenceDate: todayStr,
          items: [{ item: { id: 'srv-1', type: 'service', name: 'Corte', price: 50 }, quantity: 1 }],
          paymentMethod: 'pix',
          discountValue: 5,
        }),
      ).rejects.toThrow('desconto manual');
    });

    it('should_route_zero_net_total_to_audited_zero_close_only_for_manager_with_pin', async () => {
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      await expect(
        quickRegisterAndSettle({
          tenantId: 'tenant-1',
          actorUserId: 'rec-1',
          actorRole: 'receptionist',
          staffId: 'staff-heron',
          clientName: 'Cliente Voucher Total',
          competenceDate: todayStr,
          items: [{ item: { id: 'srv-1', type: 'service', name: 'Corte', price: 50 }, quantity: 1 }],
          paymentMethod: 'pix',
          voucherId: 'vch-100',
          voucherCode: 'FREE100',
          voucherDiscount: 50,
          auditPin: '123456',
        }),
      ).rejects.toThrow('cortesia por um gestor');

      mockCreateAppointment.mockResolvedValue({
        appointmentId: 'apt-zero-1',
        comandaId: 'cmd-zero-1',
        totalPrice: 0,
      });

      const result = await quickRegisterAndSettle({
        tenantId: 'tenant-1',
        actorUserId: 'mgr-1',
        actorRole: 'manager',
        staffId: 'staff-heron',
        clientName: 'Cliente Voucher Total',
        competenceDate: todayStr,
        items: [{ item: { id: 'srv-1', type: 'service', name: 'Corte', price: 50 }, quantity: 1 }],
        paymentMethod: 'pix',
        voucherId: 'vch-100',
        voucherCode: 'FREE100',
        voucherDiscount: 50,
        auditPin: '123456',
      });

      expect(mockFinish).toHaveBeenCalledWith(
        expect.objectContaining({
          total: 0,
          voucherDiscount: 50,
          shouldSettleZeroWithAudit: true,
          canCloseWithAdministrativeOrigin: true,
          zeroCloseOrigin: 'house_courtesy',
          zeroClosePin: '123456',
          terminalSnapshot: null,
        }),
        expect.any(String),
      );
      expect(result.total).toBe(0);
    });
  });

  describe('calculateQuickPdvTotals', () => {
    it('should_calculate_gross_voucher_manual_and_net_with_floor_at_zero', () => {
      expect(calculateQuickPdvTotals(100, 15, 25)).toEqual({
        grossTotal: 100,
        voucherDiscount: 25,
        manualDiscount: 15,
        totalDiscount: 40,
        netTotal: 60,
      });

      expect(calculateQuickPdvTotals(40, 30, 25)).toEqual({
        grossTotal: 40,
        voucherDiscount: 25,
        manualDiscount: 15,
        totalDiscount: 40,
        netTotal: 0,
      });
    });
  });
});
