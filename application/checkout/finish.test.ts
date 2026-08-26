import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

// ─── Mocks (topo do arquivo) ──────────────────────────────────────
const mockUpdate = vi.fn();
const mockList = vi.fn();
const mockInsertWithIdempotency = vi.fn().mockResolvedValue('new-comanda-id');
const mockGetStatus = vi.fn().mockResolvedValue('open');

vi.mock('../../domain/comanda/repository', () => ({
  comandaRepository: {
    list: (...args: unknown[]) => mockList(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    get: vi.fn(),
    getStatus: (...args: unknown[]) => mockGetStatus(...args),
    insertWithIdempotency: (...args: unknown[]) => mockInsertWithIdempotency(...args),
  },
}));

const mockSupabaseFrom = vi.fn();
const mockSupabaseRpc = vi.fn();

vi.mock('../../services/supabaseClient', () => ({
  supabase: {
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
    rpc: (...args: unknown[]) => mockSupabaseRpc(...args),
  },
  getSharedClient: vi.fn(() => ({
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
    rpc: (...args: unknown[]) => mockSupabaseRpc(...args),
  })),
  getClientForTable: vi.fn(() => ({
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
    rpc: (...args: unknown[]) => mockSupabaseRpc(...args),
  })),
}));

const mockSettleCheckoutComandaAndEnqueue = vi.fn();
vi.mock('../../src/lib/finance/settlement', () => ({
  settleCheckoutComandaAndEnqueue: (...args: unknown[]) => mockSettleCheckoutComandaAndEnqueue(...args),
}));

const mockCloseZeroAmountComanda = vi.fn();
const mockBuildZeroCloseAuditNote = vi.fn(() => 'audit-note-text');
vi.mock('../../src/lib/finance/zeroClose', () => ({
  closeZeroAmountComanda: (...args: unknown[]) => mockCloseZeroAmountComanda(...args),
  buildZeroCloseAuditNote: (...args: unknown[]) => mockBuildZeroCloseAuditNote(...args),
}));

// ─── Imports (depois dos mocks) ──────────────────────────────────
import { checkoutApplicationService, type FinishRequest, type CheckoutCartItem } from '../checkout';

// ─── Builders ─────────────────────────────────────────────────────
import {
  makeFinishRequest,
  makeCartItem,
  makePaidRequest,
  makePendingRequest,
  makeLegacyRequest,
  makeZeroCloseRequest,
  makeCreditRequest,
} from '../../../tests/builders/checkout.builder';

// ─── Factories ────────────────────────────────────────────────────
import {
  createComandaChain,
  createItemsCallSequence,
  createSimpleChain,
  makeDefaultItemsSequence,
} from '../../../tests/factories/mockDatabaseClient';

// ─── Scenarios ────────────────────────────────────────────────────
import {
  makeSuccessfulPaidScenario,
  makePendingScenario,
  makeLegacyClubScenario,
  makeZeroCloseScenario,
  makeCreditScenario,
  makeItemsInsertFailureScenario,
  makeItemsErrorScenario,
  makeConcurrencyScenario,
  makeIdempotencyScenario,
  buildMockFromImplementation,
} from '../../../tests/scenarios/checkout.scenario';

// ─── Observability (regression) ───────────────────────────────────
import { instrumentService } from '../../src/lib/observability/instrumentation';

// ═══════════════════════════════════════════════════════════════════
// CheckoutApplicationService.finish()
//
// Grupo A — Validation
// Grupo B — Happy Path
// Grupo C — Rollback
// Grupo D — Settlement
// Grupo E — Idempotency
// ═══════════════════════════════════════════════════════════════════

describe('CheckoutApplicationService', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  // ═══════════════════════════════════════════════════════════════
  // Grupo A — Validation
  //
  // Todos os cenários que devem falhar ANTES de qualquer side effect.
  // Após cada teste de validação, garantir que nenhum mock foi chamado.
  // ═══════════════════════════════════════════════════════════════
  describe('Grupo A — Validation', () => {
    describe('validateFinishRequest (pure function)', () => {
      it('should_return_empty_when_request_is_valid', () => {
        expect(checkoutApplicationService.validateFinishRequest(makeFinishRequest())).toHaveLength(0);
      });
      it('should_return_error_when_client_is_missing', () => {
        expect(checkoutApplicationService.validateFinishRequest(makeFinishRequest({ client: undefined as any })))
          .toContain('Cliente é obrigatório.');
      });
      it('should_return_error_when_cart_is_empty', () => {
        expect(checkoutApplicationService.validateFinishRequest(makeFinishRequest({ cart: [] })))
          .toContain('Pelo menos um item é obrigatório.');
      });
      it('should_return_error_when_tenant_is_missing', () => {
        expect(checkoutApplicationService.validateFinishRequest(makeFinishRequest({ tenantId: '' })))
          .toContain('Tenant inválido para finalizar operação.');
      });
      it('should_return_multiple_errors_when_multiple_invalidations', () => {
        expect(checkoutApplicationService.validateFinishRequest(
          makeFinishRequest({ client: undefined as any, cart: [], tenantId: '' }),
        ).length).toBeGreaterThanOrEqual(2);
      });
    });

    describe('validateFinishRequest — legacy club', () => {
      it('should_return_error_when_legacy_without_permission', () => {
        expect(checkoutApplicationService.validateFinishRequest(makeFinishRequest({
          isLegacyClubSettlement: true, canCloseWithAdministrativeOrigin: false,
          legacyReferenceMonth: '2026-07', closureNote: 'Motivo',
        }))).toContain('Baixa administrativa exige permissão de gerente, admin ou superadmin.');
      });
      it('should_return_error_when_legacy_without_reference_month', () => {
        expect(checkoutApplicationService.validateFinishRequest(makeFinishRequest({
          isLegacyClubSettlement: true, canCloseWithAdministrativeOrigin: true,
          legacyReferenceMonth: undefined, closureNote: 'Motivo',
        }))).toContain('Informe o mês de referência para a baixa administrativa.');
      });
      it('should_return_error_when_legacy_without_closure_note', () => {
        expect(checkoutApplicationService.validateFinishRequest(makeFinishRequest({
          isLegacyClubSettlement: true, canCloseWithAdministrativeOrigin: true,
          legacyReferenceMonth: '2026-07', closureNote: '',
        }))).toContain('Informe o motivo obrigatório para a baixa administrativa.');
      });
      it('should_return_no_errors_when_legacy_is_fully_valid', () => {
        expect(checkoutApplicationService.validateFinishRequest(makeFinishRequest({
          isLegacyClubSettlement: true, canCloseWithAdministrativeOrigin: true,
          legacyReferenceMonth: '2026-07', closureNote: 'Ajuste',
        }))).toHaveLength(0);
      });
    });

    describe('validateFinishRequest — zero-paid checkout', () => {
      it('should_return_error_when_club_credit_without_chefClubInfo', () => {
        expect(checkoutApplicationService.validateFinishRequest(makeFinishRequest({
          paymentStatus: 'paid', total: 0, zeroCloseOrigin: 'club_credit', chefClubInfo: null,
        }))).toContain('Crédito do Clube consumido no checkout: há crédito aplicado e disponível.');
      });
      it('should_return_error_when_administrative_adjustment_without_permission', () => {
        expect(checkoutApplicationService.validateFinishRequest(makeFinishRequest({
          paymentStatus: 'paid', total: 0, zeroCloseOrigin: 'administrative_adjustment',
          canCloseWithAdministrativeOrigin: false,
        }))).toContain('Baixa administrativa zero exige permissão de gerente, admin ou superadmin.');
      });
      it('should_return_error_when_house_courtesy_without_reason', () => {
        expect(checkoutApplicationService.validateFinishRequest(makeFinishRequest({
          paymentStatus: 'paid', total: 0, zeroCloseOrigin: 'house_courtesy', zeroCloseReason: '',
        }))).toContain('Informe o motivo obrigatório para finalizar comanda zero.');
      });
      it('should_return_error_when_administrative_adjustment_without_reason', () => {
        expect(checkoutApplicationService.validateFinishRequest(makeFinishRequest({
          paymentStatus: 'paid', total: 0, zeroCloseOrigin: 'administrative_adjustment',
          canCloseWithAdministrativeOrigin: true, zeroCloseReason: '',
        }))).toContain('Informe o motivo obrigatório para finalizar comanda zero.');
      });
      it('should_return_no_errors_when_house_courtesy_with_reason', () => {
        expect(checkoutApplicationService.validateFinishRequest(makeFinishRequest({
          paymentStatus: 'paid', total: 0, zeroCloseOrigin: 'house_courtesy', zeroCloseReason: 'Cortesia',
        }))).toHaveLength(0);
      });
    });

    describe('validateFinishRequest — discount audit', () => {
      it('should_return_error_when_barber_discount_without_responsible', () => {
        expect(checkoutApplicationService.validateFinishRequest(makeFinishRequest({
          shouldCollectDiscountAudit: true,
          discountAuditDraft: {
            amount: 10, type: 'barber_discount', reasonType: 'loyalty', reasonNote: 'Fidelidade',
            responsibleStaffId: null, responsibleStaffName: null, commissionImpact: 'reduz',
          },
        }))).toContain('Selecione o profissional responsável pelo desconto.');
      });
      it('should_return_error_when_discount_without_reason_note', () => {
        expect(checkoutApplicationService.validateFinishRequest(makeFinishRequest({
          shouldCollectDiscountAudit: true,
          discountAuditDraft: {
            amount: 10, type: 'barber_discount', reasonType: 'loyalty', reasonNote: '',
            responsibleStaffId: 'staff-1', responsibleStaffName: 'Marcos', commissionImpact: 'reduz',
          },
        }))).toContain('Informe uma observação para auditar o desconto.');
      });
    });

    describe('finish — validation gate', () => {
      it('should_throw_CheckoutError_when_cart_is_empty', async () => {
        await expect(checkoutApplicationService.finish(makeFinishRequest({ cart: [] }), 'idem-1'))
          .rejects.toThrow('Pelo menos um item é obrigatório.');
      });
      it('should_throw_CheckoutError_when_client_is_missing', async () => {
        await expect(checkoutApplicationService.finish(makeFinishRequest({ client: undefined as any }), 'idem-1'))
          .rejects.toThrow('Cliente é obrigatório.');
      });
      it('should_throw_CheckoutError_with_VALIDATION_ERROR_code', async () => {
        try {
          await checkoutApplicationService.finish(makeFinishRequest({ cart: [] }), 'idem-1');
          expect.fail('Should have thrown');
        } catch (err: any) {
          expect(err.code).toBe('VALIDATION_ERROR');
        }
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // prepareComandaData (pure function)
  // ═══════════════════════════════════════════════════════════════
  describe('prepareComandaData', () => {
    it('should_build_correct_payload_for_paid_checkout', () => {
      const data = checkoutApplicationService.prepareComandaData(makeFinishRequest({
        paymentStatus: 'paid', total: 50, cart: [makeCartItem({ staff_id: 'staff-1' })],
      }));
      expect(data.client_id).toBe('client-1');
      expect(data.staff_id).toBe('staff-1');
      expect(data.total).toBe(50);
      expect(data.status).toBe('open');
      expect(data.financial_effect).toBe(true);
    });

    it('should_set_staff_id_null_when_multiple_staff_in_cart', () => {
      const data = checkoutApplicationService.prepareComandaData(makeFinishRequest({
        cart: [makeCartItem({ id: 'i1', staff_id: 's1' }), makeCartItem({ id: 'i2', staff_id: 's2' })],
      }));
      expect(data.staff_id).toBeNull();
    });

    it('should_set_closed_at_null_when_settleViaRpc', () => {
      const data = checkoutApplicationService.prepareComandaData(makeFinishRequest({
        paymentStatus: 'paid', total: 50, shouldSettleZeroWithAudit: false,
      }));
      expect(data.closed_at).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Grupo B — Happy Path
  //
  // Fluxos que terminam com sucesso, verificando o resultado
  // e os side effects esperados.
  // ═══════════════════════════════════════════════════════════════
  describe('Grupo B — Happy Path', () => {
    it('should_complete_pdv_checkout_with_settlement', async () => {
      const scenario = makeSuccessfulPaidScenario();
      mockSupabaseFrom.mockImplementation(buildMockFromImplementation(scenario));
      mockSettleCheckoutComandaAndEnqueue.mockResolvedValue(scenario.rpcResult);
      mockInsertWithIdempotency.mockResolvedValue('comanda-paid-1');

      const result = await checkoutApplicationService.finish(scenario.request, scenario.idempotencyKey);

      expect(result.comandaId).toBe('comanda-paid-1');
      expect(result.paymentStatus).toBe('paid');
      expect(result.isLegacyClubSettlement).toBe(false);
      expect(mockSettleCheckoutComandaAndEnqueue).toHaveBeenCalledTimes(1);
    });

    it('should_return_comandaId_and_status_on_success', async () => {
      const scenario = makeSuccessfulPaidScenario();
      mockSupabaseFrom.mockImplementation(buildMockFromImplementation(scenario));
      mockSettleCheckoutComandaAndEnqueue.mockResolvedValue(scenario.rpcResult);
      mockInsertWithIdempotency.mockResolvedValue('comanda-paid-1');

      const result = await checkoutApplicationService.finish(scenario.request, scenario.idempotencyKey);

      expect(result).toHaveProperty('comandaId', 'comanda-paid-1');
      expect(result).toHaveProperty('paymentStatus', 'paid');
      expect(result).toHaveProperty('isLegacyClubSettlement', false);
    });

    it('should_create_new_comanda_when_no_existing', async () => {
      const scenario = makeSuccessfulPaidScenario();
      mockSupabaseFrom.mockImplementation(buildMockFromImplementation(scenario));
      mockSettleCheckoutComandaAndEnqueue.mockResolvedValue(scenario.rpcResult);
      mockInsertWithIdempotency.mockResolvedValue('comanda-paid-1');

      const result = await checkoutApplicationService.finish(scenario.request, scenario.idempotencyKey);

      expect(result.comandaId).toBe('comanda-paid-1');
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('should_update_existing_comanda_when_provided', async () => {
      mockList.mockResolvedValue([]);
      mockUpdate.mockResolvedValue(undefined);
      const scenario = makeSuccessfulPaidScenario();
      scenario.request.comandaId = 'existing-comanda';
      mockSupabaseFrom.mockImplementation(buildMockFromImplementation(scenario));
      mockSettleCheckoutComandaAndEnqueue.mockResolvedValue(scenario.rpcResult);

      const result = await checkoutApplicationService.finish(scenario.request, scenario.idempotencyKey);

      expect(result.comandaId).toBe('existing-comanda');
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('should_create_comanda_with_correct_staff_id_when_single_staff', async () => {
      const scenario = makeSuccessfulPaidScenario();
      mockSupabaseFrom.mockImplementation(buildMockFromImplementation(scenario));
      mockSettleCheckoutComandaAndEnqueue.mockResolvedValue(scenario.rpcResult);
      mockInsertWithIdempotency.mockResolvedValue('comanda-paid-1');

      const result = await checkoutApplicationService.finish(scenario.request, scenario.idempotencyKey);

      expect(result.comandaId).toBe('comanda-paid-1');
      expect(mockInsertWithIdempotency).toHaveBeenCalledTimes(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Grupo C — Rollback
  //
  // Cenários onde uma operação intermediária falha e o sistema
  // deve compensar (rollback) para manter consistência.
  // ═══════════════════════════════════════════════════════════════
  describe('Grupo C — Rollback', () => {
    it('should_throw_when_comanda_status_changed_to_paid', async () => {
      mockGetStatus.mockResolvedValue('paid');

      await expect(
        checkoutApplicationService.finish(
          makeFinishRequest({ comandaId: 'comanda-race', paymentStatus: 'paid', total: 50 }),
          'idem-concurrency',
        ),
      ).rejects.toThrow('não está mais aberta');
    });

    it('should_throw_when_items_insert_count_mismatches', async () => {
      const scenario = makeItemsInsertFailureScenario();
      mockSupabaseFrom.mockImplementation(buildMockFromImplementation(scenario));

      await expect(
        checkoutApplicationService.finish(scenario.request, scenario.idempotencyKey),
      ).rejects.toThrow('Inconsistência pós-sync');
    });

    it('should_throw_when_items_insert_fails', async () => {
      const scenario = makeItemsErrorScenario();
      mockSupabaseFrom.mockImplementation(buildMockFromImplementation(scenario));

      await expect(
        checkoutApplicationService.finish(scenario.request, scenario.idempotencyKey),
      ).rejects.toThrow('insert failed');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Grupo D — Settlement
  //
  // Todos os caminhos de liquidação financeira: RPC, zero-close,
  // legacy, pendente, crédito.
  // ═══════════════════════════════════════════════════════════════
  describe('Grupo D — Settlement', () => {
    describe('RPC settlement', () => {
      it('should_call_settleCheckoutComandaAndEnqueue_when_paid', async () => {
        const scenario = makeSuccessfulPaidScenario();
        mockSupabaseFrom.mockImplementation(buildMockFromImplementation(scenario));
        mockSettleCheckoutComandaAndEnqueue.mockResolvedValue(scenario.rpcResult);

        await checkoutApplicationService.finish(scenario.request, scenario.idempotencyKey);

        expect(mockSettleCheckoutComandaAndEnqueue).toHaveBeenCalledTimes(1);
      });

      it('should_set_comanda_status_open_when_settleViaRpc', async () => {
        const scenario = makeSuccessfulPaidScenario();
        mockSupabaseFrom.mockImplementation(buildMockFromImplementation(scenario));
        mockSettleCheckoutComandaAndEnqueue.mockResolvedValue(scenario.rpcResult);
        mockInsertWithIdempotency.mockResolvedValue('comanda-paid-1');

        const result = await checkoutApplicationService.finish(scenario.request, scenario.idempotencyKey);

        expect(result.comandaId).toBe('comanda-paid-1');
      });

      it('should_set_payment_method_null_when_settleViaRpc', async () => {
        const data = checkoutApplicationService.prepareComandaData(makePaidRequest(50));
        expect(data.payment_method).toBeNull();
      });
    });

    describe('pending payment', () => {
      it('should_skip_settlement_when_payment_is_pending', async () => {
        const scenario = makePendingScenario();
        mockGetStatus.mockResolvedValue('open');
        mockList.mockResolvedValue([{ id: 'existing-open-comanda' }]);
        mockUpdate.mockResolvedValue(undefined);
        mockSupabaseFrom.mockImplementation(buildMockFromImplementation(scenario));

        const result = await checkoutApplicationService.finish(scenario.request, scenario.idempotencyKey);

        expect(result.paymentStatus).toBe('pending');
        expect(mockSettleCheckoutComandaAndEnqueue).not.toHaveBeenCalled();
      });

      it('should_set_status_to_open_when_payment_is_pending', () => {
        const data = checkoutApplicationService.prepareComandaData(makePendingRequest(50));
        expect(data.status).toBe('open');
        expect(data.closed_at).toBeNull();
      });
    });

    describe('legacy club settlement', () => {
      it('should_skip_RPC_settlement_when_legacy', async () => {
        const scenario = makeLegacyClubScenario();
        mockList.mockResolvedValue([]);
        mockUpdate.mockResolvedValue(undefined);
        mockSupabaseFrom.mockImplementation(buildMockFromImplementation(scenario));

        const result = await checkoutApplicationService.finish(scenario.request, scenario.idempotencyKey);

        expect(result.isLegacyClubSettlement).toBe(true);
        expect(mockSettleCheckoutComandaAndEnqueue).not.toHaveBeenCalled();
        expect(mockBuildZeroCloseAuditNote).toHaveBeenCalled();
      });

      it('should_build_legacy_audit_note_when_isLegacyClubSettlement', () => {
        checkoutApplicationService.prepareComandaData(makeFinishRequest({
          isLegacyClubSettlement: true, closureNote: 'Ajuste', userId: 'manager-1',
        }));
        expect(mockBuildZeroCloseAuditNote).toHaveBeenCalledWith(
          expect.objectContaining({ origin: 'administrative_adjustment', source: 'checkout', reason: 'Ajuste' }),
        );
      });

      it('should_set_legacy_reference_month_formatted', () => {
        const data = checkoutApplicationService.prepareComandaData(makeFinishRequest({
          isLegacyClubSettlement: true, canCloseWithAdministrativeOrigin: true,
          legacyReferenceMonth: '2026-07', closureNote: 'Motivo',
        }));
        expect(data.legacy_reference_month).toBe('2026-07-01');
      });

      it('should_set_null_legacy_reference_month_when_not_legacy', () => {
        const data = checkoutApplicationService.prepareComandaData(makeFinishRequest({ isLegacyClubSettlement: false }));
        expect(data.legacy_reference_month).toBeNull();
      });
    });

    describe('zero-amount close', () => {
      it('should_call_closeZeroAmount_when_shouldSettleZeroWithAudit', async () => {
        const scenario = makeZeroCloseScenario('house_courtesy');
        mockSupabaseFrom.mockImplementation(buildMockFromImplementation(scenario));
        mockCloseZeroAmountComanda.mockResolvedValue({ success: true });

        await checkoutApplicationService.finish(scenario.request, scenario.idempotencyKey);

        expect(mockCloseZeroAmountComanda).toHaveBeenCalledTimes(1);
        expect(mockSettleCheckoutComandaAndEnqueue).not.toHaveBeenCalled();
      });

    it('should_call_closeZeroAmount_with_club_credit_origin', async () => {
      const scenario = makeZeroCloseScenario('club_credit');
      scenario.request.chefClubInfo = { id: 'sub-1' };
      mockSupabaseFrom.mockImplementation(buildMockFromImplementation(scenario));
      mockCloseZeroAmountComanda.mockResolvedValue({ success: true });

      await checkoutApplicationService.finish(scenario.request, scenario.idempotencyKey);

      expect(mockCloseZeroAmountComanda).toHaveBeenCalledTimes(1);
    });

      it('should_set_null_closed_at_when_shouldSettleZeroWithAudit', () => {
        const data = checkoutApplicationService.prepareComandaData(makeFinishRequest({
          paymentStatus: 'paid', total: 0, shouldSettleZeroWithAudit: true,
        }));
        expect(data.closed_at).toBeNull();
      });
    });

    describe('chef club credits', () => {
      it('should_deduct_credits_when_shouldDeductMembershipCredits_with_items', async () => {
        const scenario = makeCreditScenario();
        mockSupabaseFrom.mockImplementation(buildMockFromImplementation(scenario));
        mockSettleCheckoutComandaAndEnqueue.mockResolvedValue(scenario.rpcResult);
        mockSupabaseRpc.mockResolvedValue({ error: null });

        await checkoutApplicationService.finish(scenario.request, scenario.idempotencyKey);

        expect(mockSupabaseRpc).toHaveBeenCalledWith(
          'deduct_chef_club_credits',
          expect.objectContaining({ p_subscription_id: 'sub-1', p_service_id: 'svc-1', p_amount: 1 }),
        );
      });

      it('should_not_deduct_credits_when_no_chefClubInfo', async () => {
        const scenario = makeSuccessfulPaidScenario();
        mockSupabaseFrom.mockImplementation(buildMockFromImplementation(scenario));
        mockSettleCheckoutComandaAndEnqueue.mockResolvedValue(scenario.rpcResult);

        await checkoutApplicationService.finish(
          makeFinishRequest({
            paymentStatus: 'paid', total: 50,
            shouldDeductMembershipCredits: false, creditItems: [], chefClubInfo: null,
          }),
          scenario.idempotencyKey,
        );

        expect(mockSupabaseRpc).not.toHaveBeenCalled();
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Grupo E — Idempotency
  //
  // Garantir que operações duplicadas não criam efeitos colaterais.
  // ═══════════════════════════════════════════════════════════════
  describe('Grupo E — Idempotency', () => {
    it('should_find_existing_comanda_on_23505_error', async () => {
      const scenario = makeIdempotencyScenario();
      mockSupabaseFrom.mockImplementation(buildMockFromImplementation(scenario));
      mockInsertWithIdempotency.mockResolvedValue('existing-idem-comanda');
      mockSettleCheckoutComandaAndEnqueue.mockResolvedValue(scenario.rpcResult);

      const result = await checkoutApplicationService.finish(
        makeFinishRequest({ paymentStatus: 'paid', total: 50, comandaId: undefined }),
        scenario.idempotencyKey,
      );

      expect(result.comandaId).toBe('existing-idem-comanda');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// Grupo F — Observability Regression
//
// Reproduz o bug de produção: a instrumentação (Fase 3.5) embrulhava os
// métodos do serviço e quebrava o `this`, fazendo `finish()` lançar
// "Cannot read properties of undefined (reading 'validateFinishRequest')".
//
// Este grupo instrumenta o singleton como em produção (App.tsx →
// useObservability → initializeInstrumentation) e reexecuta os fluxos
// críticos para provar que o wrapper preserva `this` e a sincronicidade.
// ═══════════════════════════════════════════════════════════════════
describe('CheckoutApplicationService — Observability Regression', () => {
  const CHECKOUT_CONFIG = {
    finish: { operation: 'Checkout.finish', businessEvent: 'CHECKOUT_COMPLETED', metric: 'checkout_duration_ms' },
    validateFinishRequest: { operation: 'Checkout.validate', metric: 'checkout_validate_duration_ms' },
    syncComanda: { operation: 'Checkout.syncComanda', metric: 'checkout_sync_comanda_duration_ms' },
    syncItemsWithCompensation: { operation: 'Checkout.syncItems', metric: 'checkout_sync_items_duration_ms' },
    settleComanda: { operation: 'Checkout.settle', metric: 'checkout_settle_duration_ms' },
  };

  beforeAll(() => {
    instrumentService(checkoutApplicationService as any, CHECKOUT_CONFIG as any);
  });

  beforeEach(() => { vi.clearAllMocks(); });

  it('should_keep_validateFinishRequest_synchronous_when_instrumented', () => {
    const errors = checkoutApplicationService.validateFinishRequest(makeFinishRequest()) as any;
    expect(Array.isArray(errors)).toBe(true);
    expect(errors).toHaveLength(0);
  });

  it('should_still_return_validation_errors_synchronously_when_instrumented', () => {
    const errors = checkoutApplicationService.validateFinishRequest(makeFinishRequest({ cart: [] })) as any;
    expect(Array.isArray(errors)).toBe(true);
    expect(errors).toContain('Pelo menos um item é obrigatório.');
  });

  it('should_complete_finish_without_losing_this_when_instrumented', async () => {
    const scenario = makeSuccessfulPaidScenario();
    mockSupabaseFrom.mockImplementation(buildMockFromImplementation(scenario));
    mockSettleCheckoutComandaAndEnqueue.mockResolvedValue(scenario.rpcResult);
    mockInsertWithIdempotency.mockResolvedValue('comanda-instrumented-1');

    const result = await checkoutApplicationService.finish(scenario.request, scenario.idempotencyKey);

    expect(result.comandaId).toBe('comanda-instrumented-1');
    expect(result.paymentStatus).toBe('paid');
    expect(mockSettleCheckoutComandaAndEnqueue).toHaveBeenCalledTimes(1);
  });

  it('should_throw_validation_error_through_wrapper_when_instrumented', async () => {
    await expect(
      checkoutApplicationService.finish(makeFinishRequest({ cart: [] }), 'idem-instrumented'),
    ).rejects.toThrow('Pelo menos um item é obrigatório.');
  });

  it('should_complete_zero_close_through_wrapper_when_instrumented', async () => {
    const scenario = makeZeroCloseScenario('house_courtesy');
    mockSupabaseFrom.mockImplementation(buildMockFromImplementation(scenario));
    mockCloseZeroAmountComanda.mockResolvedValue({ success: true });

    const result = await checkoutApplicationService.finish(scenario.request, scenario.idempotencyKey);

    expect(result.paymentStatus).toBe('paid');
    expect(mockCloseZeroAmountComanda).toHaveBeenCalledTimes(1);
  });

  it('should_complete_legacy_settlement_through_wrapper_when_instrumented', async () => {
    const scenario = makeLegacyClubScenario();
    mockList.mockResolvedValue([]);
    mockUpdate.mockResolvedValue(undefined);
    mockSupabaseFrom.mockImplementation(buildMockFromImplementation(scenario));

    const result = await checkoutApplicationService.finish(scenario.request, scenario.idempotencyKey);

    expect(result.isLegacyClubSettlement).toBe(true);
    expect(mockSettleCheckoutComandaAndEnqueue).not.toHaveBeenCalled();
  });
});
