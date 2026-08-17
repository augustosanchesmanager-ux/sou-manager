import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks (topo do arquivo) ──────────────────────────────────────
const mockGetByBusinessDate = vi.fn();
const mockUpsert = vi.fn();
const mockUpdateBarberClosingsCount = vi.fn();
const mockBarberGetByCashClosingId = vi.fn();
const mockBarberUpsert = vi.fn();
const mockEventInsert = vi.fn();
const mockEventGetByBusinessDate = vi.fn();
const mockTransactionCreateBulk = vi.fn();
const mockTransactionList = vi.fn();

vi.mock('../../domain/cashClosing/repository', () => ({
  cashClosingRepository: {
    getByBusinessDate: (...args: unknown[]) => mockGetByBusinessDate(...args),
    upsert: (...args: unknown[]) => mockUpsert(...args),
    updateBarberClosingsCount: (...args: unknown[]) => mockUpdateBarberClosingsCount(...args),
  },
  barberClosingRepository: {
    getByCashClosingId: (...args: unknown[]) => mockBarberGetByCashClosingId(...args),
    upsert: (...args: unknown[]) => mockBarberUpsert(...args),
  },
  cashClosingEventRepository: {
    getByBusinessDate: (...args: unknown[]) => mockEventGetByBusinessDate(...args),
    insert: (...args: unknown[]) => mockEventInsert(...args),
  },
}));

vi.mock('../../domain/transaction/repository', () => ({
  transactionRepository: {
    createBulk: (...args: unknown[]) => mockTransactionCreateBulk(...args),
    list: (...args: unknown[]) => mockTransactionList(...args),
  },
}));

const mockLoadDailySnapshot = vi.fn();

vi.mock('./loaders', () => ({
  loadDailySnapshot: (...args: unknown[]) => mockLoadDailySnapshot(...args),
}));

// ─── Imports ──────────────────────────────────────────────────────
import { cashClosingApplicationService } from './index';
import { CashClosingError } from './types';
import type { CashClosingEntryExtended, SangriaSuprimento, BarberSummary, AgendaSummary, TimelineEvent, DailyAuditData, IndicatorsData } from '../../components/financial/cashCloseUtils';
import type { TotalsData, CloseCashParams, CloseBarberCashParams, OpenCashParams, SaveConferenceParams } from './types';

// ─── Builders ─────────────────────────────────────────────────────
const makeEntry = (overrides: Partial<CashClosingEntryExtended> = {}): CashClosingEntryExtended => ({
  id: 'entry-1',
  type: 'entrada',
  value: 100,
  paymentMethod: 'Dinheiro',
  status: 'confirmado',
  sourceType: 'comanda',
  sourceId: 'comanda-1',
  barberStaffId: 'staff-1',
  barberName: 'Barbeiro 1',
  comandaStatus: 'paid',
  clientName: 'João',
  ...overrides,
} as CashClosingEntryExtended);

const makeSangria = (value = 50, overrides: Partial<SangriaSuprimento> = {}): SangriaSuprimento => ({
  id: `sangria-${Date.now()}`,
  type: 'sangria',
  value,
  description: 'Sangria teste',
  createdAt: new Date().toISOString(),
  ...overrides,
});

const makeSuprimento = (value = 200, overrides: Partial<SangriaSuprimento> = {}): SangriaSuprimento => ({
  id: `suprimento-${Date.now()}`,
  type: 'suprimento',
  value,
  description: 'Suprimento teste',
  createdAt: new Date().toISOString(),
  ...overrides,
});

const makeTotals = (overrides: Partial<TotalsData> = {}): TotalsData => ({
  totalEntradas: 500,
  totalSaidas: 100,
  saldoAtual: 400,
  totalExtrasSuprimento: 200,
  totalExtrasSangria: 50,
  totalExpected: 650,
  totalReceived: 650,
  ...overrides,
});

const makeAgendaSummary = (overrides: Partial<AgendaSummary> = {}): AgendaSummary => ({
  scheduled: { count: 5, total: 250 },
  completed: { count: 8, total: 400 },
  received: { count: 7, total: 350 },
  cancelled: { count: 1, total: 50 },
  pending: { count: 0, total: 0 },
  no_show: { count: 1, total: 50 },
  ...overrides,
});

const makeBarberSummary = (overrides: Partial<BarberSummary> = {}): BarberSummary => ({
  staffId: 'staff-1',
  staffName: 'Barbeiro 1',
  role: 'barber',
  totalReceived: 350,
  openTotal: 0,
  comandaCount: 7,
  openComandaCount: 0,
  commissionRate: 40,
  comandas: [],
  openComandas: [],
  ...overrides,
});

const makeTimeline = (): TimelineEvent[] => [
  { time: '09:00', label: 'Primeiro atendimento', type: 'service' },
  { time: '17:00', label: 'Último atendimento', type: 'service' },
];

const makeAudit = (overrides: Partial<DailyAuditData> = {}): DailyAuditData => ({
  totalComandas: 8,
  openComandas: 0,
  cancelledComandas: 1,
  reversedComandas: 0,
  pendingPayments: 0,
  pendingPaymentsTotal: 0,
  reaberturas: 0,
  manualReceivables: 0,
  manualExpenses: 0,
  totalIncome: 500,
  totalExpenses: 0,
  totalReversals: 0,
  totalTransactions: 10,
  ...overrides,
});

const makeIndicators = (overrides: Partial<IndicatorsData> = {}): IndicatorsData => ({
  ticketMedio: 50,
  clientesAtendidos: 5,
  novosClientes: 0,
  produtosVendidos: 0,
  servicosVendidos: 8,
  comissaoTotal: 140,
  tempoMedioAtendimento: 45,
  metaDoDia: 0,
  percentualMeta: 0,
  ...overrides,
});

const makeOpenCashParams = (overrides: Partial<OpenCashParams> = {}): OpenCashParams => ({
  tenantId: 'tenant-1',
  date: '2026-07-23',
  userId: 'user-1',
  ...overrides,
});

const makeCloseCashParams = (overrides: Partial<CloseCashParams> = {}): CloseCashParams => ({
  tenantId: 'tenant-1',
  date: '2026-07-23',
  userId: 'user-1',
  extras: [],
  totals: makeTotals(),
  agendaSummary: makeAgendaSummary(),
  barberSummaries: [makeBarberSummary()],
  indicators: makeIndicators(),
  timeline: makeTimeline(),
  audit: makeAudit(),
  ...overrides,
});

const makeCloseBarberCashParams = (overrides: Partial<CloseBarberCashParams> = {}): CloseBarberCashParams => ({
  tenantId: 'tenant-1',
  barberId: 'staff-1',
  barberName: 'Barbeiro 1',
  businessDate: '2026-07-23',
  countedCash: 350,
  expectedCash: 350,
  totalProduced: 350,
  totalReceived: 350,
  totalCommission: 140,
  repasse: 210,
  discounts: 0,
  advances: 0,
  balance: 210,
  comandasCount: 7,
  clientsServedCount: 5,
  productsSoldCount: 0,
  paymentMethods: { 'Dinheiro': 200, 'Pix': 150 },
  productsSold: [],
  timeline: makeTimeline(),
  cashClosingId: 'cc-1',
  userId: 'user-1',
  ...overrides,
});

const makeSaveConferenceParams = (overrides: Partial<SaveConferenceParams> = {}): SaveConferenceParams => ({
  tenantId: 'tenant-1',
  date: '2026-07-23',
  userId: 'user-1',
  totals: makeTotals(),
  totalReceived: 650,
  difference: 0,
  agendaSummary: makeAgendaSummary(),
  paymentMethodBreakdown: [{ method: 'Dinheiro', entradas: 500, saidas: 100, count: 8 }],
  extras: [],
  barberSummaries: [makeBarberSummary()],
  ...overrides,
});

// ═══════════════════════════════════════════════════════════════════
// CashClosingApplicationService
//
// Grupo A — Validation
// Grupo B — Operations
// Grupo C — Summary (pure functions)
// Grupo D — Edge Cases
// ═══════════════════════════════════════════════════════════════════

describe('CashClosingApplicationService', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  // ═══════════════════════════════════════════════════════════════
  // Grupo A — Validation
  //
  // Funções puras de validação: validate, calculateTotals.
  // ═══════════════════════════════════════════════════════════════
  describe('Grupo A — Validation', () => {
    describe('validate', () => {
      it('should_return_valid_when_exact_match', () => {
        const result = cashClosingApplicationService.validate(100, 100);
        expect(result.isValid).toBe(true);
        expect(result.difference).toBe(0);
      });

      it('should_return_valid_when_within_tolerance', () => {
        const result = cashClosingApplicationService.validate(100, 100.005);
        expect(result.isValid).toBe(true);
      });

      it('should_return_invalid_when_outside_tolerance', () => {
        const result = cashClosingApplicationService.validate(100, 101);
        expect(result.isValid).toBe(false);
        expect(result.difference).toBe(1);
      });

      it('should_return_invalid_when_received_less_than_expected', () => {
        const result = cashClosingApplicationService.validate(200, 150);
        expect(result.isValid).toBe(false);
        expect(result.difference).toBe(-50);
      });
    });

    describe('calculateTotals', () => {
      it('should_return_zeros_for_empty_inputs', () => {
        const result = cashClosingApplicationService.calculateTotals([], []);
        expect(result.totalEntradas).toBe(0);
        expect(result.totalSaidas).toBe(0);
        expect(result.saldoAtual).toBe(0);
        expect(result.totalExtrasSuprimento).toBe(0);
        expect(result.totalExtrasSangria).toBe(0);
        expect(result.totalExpected).toBe(0);
      });

      it('should_calculate_entries_only', () => {
        const entries = [makeEntry({ value: 500 }), makeEntry({ type: 'saida', value: 100 })];
        const result = cashClosingApplicationService.calculateTotals(entries, []);
        expect(result.totalEntradas).toBe(500);
        expect(result.totalSaidas).toBe(100);
        expect(result.saldoAtual).toBe(400);
      });

      it('should_calculate_extras_only', () => {
        const extras = [makeSuprimento(200), makeSangria(50)];
        const result = cashClosingApplicationService.calculateTotals([], extras);
        expect(result.totalExtrasSuprimento).toBe(200);
        expect(result.totalExtrasSangria).toBe(50);
      });

      it('should_combine_entries_and_extras_for_totalExpected', () => {
        const entries = [makeEntry({ value: 500 })];
        const extras = [makeSuprimento(200), makeSangria(50)];
        const result = cashClosingApplicationService.calculateTotals(entries, extras);
        expect(result.totalExpected).toBe(650);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Grupo B — Operations
  //
  // Testar cada operação: sucesso, erro, side effects.
  // ═══════════════════════════════════════════════════════════════
  describe('Grupo B — Operations', () => {
    describe('openCashRegister', () => {
      it('should_create_new_cash_closing_when_none_exists', async () => {
        mockGetByBusinessDate.mockResolvedValue(null);
        mockUpsert.mockResolvedValue(undefined);
        mockEventInsert.mockResolvedValue(undefined);

        await cashClosingApplicationService.openCashRegister(makeOpenCashParams());

        expect(mockUpsert).toHaveBeenCalledTimes(1);
        expect(mockUpsert).toHaveBeenCalledWith(
          expect.objectContaining({ tenant_id: 'tenant-1', status: 'draft' }),
        );
        expect(mockEventInsert).toHaveBeenCalledTimes(1);
        expect(mockEventInsert).toHaveBeenCalledWith(
          expect.objectContaining({ event_type: 'opening' }),
        );
      });

      it('should_update_existing_cash_closing_when_one_exists', async () => {
        const existing = { id: 'cc-1', tenant_id: 'tenant-1', business_date: '2026-07-23', status: 'draft' };
        mockGetByBusinessDate.mockResolvedValue(existing);
        mockUpsert.mockResolvedValue(undefined);
        mockEventInsert.mockResolvedValue(undefined);

        await cashClosingApplicationService.openCashRegister(makeOpenCashParams());

        expect(mockUpsert).toHaveBeenCalledTimes(1);
        expect(mockUpsert).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'cc-1', opening_time: expect.any(String) }),
        );
      });

      it('should_include_period_when_provided', async () => {
        mockGetByBusinessDate.mockResolvedValue(null);
        mockUpsert.mockResolvedValue(undefined);
        mockEventInsert.mockResolvedValue(undefined);

        await cashClosingApplicationService.openCashRegister(
          makeOpenCashParams({ periodStart: '2026-07-23T08:00:00', periodEnd: '2026-07-23T18:00:00' }),
        );

        expect(mockUpsert).toHaveBeenCalledWith(
          expect.objectContaining({ period_start: '2026-07-23T08:00:00', period_end: '2026-07-23T18:00:00' }),
        );
      });
    });

    describe('closeCashRegister', () => {
      it('should_close_with_extras_when_extras_exist', async () => {
        mockTransactionCreateBulk.mockResolvedValue(undefined);
        const existing = { id: 'cc-1', tenant_id: 'tenant-1', business_date: '2026-07-23', status: 'draft' };
        mockGetByBusinessDate.mockResolvedValue(existing);
        mockUpsert.mockResolvedValue(undefined);
        mockEventInsert.mockResolvedValue(undefined);

        await cashClosingApplicationService.closeCashRegister(
          makeCloseCashParams({ extras: [makeSangria(100), makeSuprimento(50)] }),
        );

        expect(mockTransactionCreateBulk).toHaveBeenCalledTimes(1);
        expect(mockTransactionCreateBulk).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ type: 'expense', category: 'Sangria - Fechamento' }),
            expect.objectContaining({ type: 'income', category: 'Suprimento - Fechamento' }),
          ]),
          'tenant-1',
        );
        expect(mockUpsert).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'confirmed' }),
        );
        expect(mockEventInsert).toHaveBeenCalledWith(
          expect.objectContaining({ event_type: 'closing' }),
        );
      });

      it('should_close_without_extras_when_no_extras', async () => {
        mockGetByBusinessDate.mockResolvedValue({ id: 'cc-1' });
        mockUpsert.mockResolvedValue(undefined);
        mockEventInsert.mockResolvedValue(undefined);

        await cashClosingApplicationService.closeCashRegister(makeCloseCashParams());

        expect(mockTransactionCreateBulk).not.toHaveBeenCalled();
        expect(mockUpsert).toHaveBeenCalledTimes(1);
        expect(mockEventInsert).toHaveBeenCalledTimes(1);
      });

      it('should_throw_when_transaction_bulk_fails', async () => {
        mockTransactionCreateBulk.mockRejectedValue(new Error('bulk insert failed'));

        await expect(
          cashClosingApplicationService.closeCashRegister(
            makeCloseCashParams({ extras: [makeSangria(100)] }),
          ),
        ).rejects.toThrow('bulk insert failed');
      });

      it('should_skip_upsert_when_no_existing_record', async () => {
        mockGetByBusinessDate.mockResolvedValue(null);
        mockEventInsert.mockResolvedValue(undefined);

        await cashClosingApplicationService.closeCashRegister(makeCloseCashParams());

        expect(mockUpsert).not.toHaveBeenCalled();
        expect(mockEventInsert).toHaveBeenCalledTimes(1);
      });
    });

    describe('closeBarberCash', () => {
      it('should_close_barber_with_no_discrepancy', async () => {
        mockBarberGetByCashClosingId.mockResolvedValue([]);
        mockBarberUpsert.mockResolvedValue(undefined);
        mockUpdateBarberClosingsCount.mockResolvedValue(undefined);
        mockEventInsert.mockResolvedValue(undefined);

        await cashClosingApplicationService.closeBarberCash(makeCloseBarberCashParams());

        expect(mockBarberUpsert).toHaveBeenCalledTimes(1);
        expect(mockBarberUpsert).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'closed', cash_difference: 0 }),
        );
        expect(mockEventInsert).toHaveBeenCalledWith(
          expect.objectContaining({ event_type: 'barber_closing' }),
        );
      });

      it('should_mark_discrepancy_when_cash_mismatch', async () => {
        mockBarberGetByCashClosingId.mockResolvedValue([]);
        mockBarberUpsert.mockResolvedValue(undefined);
        mockUpdateBarberClosingsCount.mockResolvedValue(undefined);
        mockEventInsert.mockResolvedValue(undefined);

        await cashClosingApplicationService.closeBarberCash(
          makeCloseBarberCashParams({ countedCash: 300, expectedCash: 350 }),
        );

        expect(mockBarberUpsert).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'discrepancy', cash_difference: -50 }),
        );
      });

      it('should_update_parent_closings_count', async () => {
        mockBarberGetByCashClosingId
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ id: 'bc-1', status: 'closed' }]);
        mockBarberUpsert.mockResolvedValue(undefined);
        mockUpdateBarberClosingsCount.mockResolvedValue(undefined);
        mockEventInsert.mockResolvedValue(undefined);

        await cashClosingApplicationService.closeBarberCash(makeCloseBarberCashParams());

        expect(mockUpdateBarberClosingsCount).toHaveBeenCalledWith(
          'cc-1', 'tenant-1',
          expect.objectContaining({ barber_closings_count: 1, barber_closings_complete: true }),
        );
      });

      it('should_mark_incomplete_when_not_all_barbers_closed', async () => {
        mockBarberGetByCashClosingId
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            { id: 'bc-1', status: 'closed' },
            { id: 'bc-2', status: 'open' },
          ]);
        mockBarberUpsert.mockResolvedValue(undefined);
        mockUpdateBarberClosingsCount.mockResolvedValue(undefined);
        mockEventInsert.mockResolvedValue(undefined);

        await cashClosingApplicationService.closeBarberCash(makeCloseBarberCashParams());

        expect(mockUpdateBarberClosingsCount).toHaveBeenCalledWith(
          'cc-1', 'tenant-1',
          expect.objectContaining({ barber_closings_count: 1, barber_closings_complete: false }),
        );
      });

      it('should_upsert_with_existing_id_when_barber_already_closed', async () => {
        mockBarberGetByCashClosingId.mockResolvedValue([
          { id: 'bc-existing', staff_id: 'staff-1', status: 'open' },
        ]);
        mockBarberUpsert.mockResolvedValue(undefined);
        mockUpdateBarberClosingsCount.mockResolvedValue(undefined);
        mockEventInsert.mockResolvedValue(undefined);

        await cashClosingApplicationService.closeBarberCash(makeCloseBarberCashParams());

        expect(mockBarberUpsert).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'bc-existing' }),
        );
      });
    });

    describe('saveDraftConference', () => {
      it('should_upsert_draft_with_totals', async () => {
        mockGetByBusinessDate.mockResolvedValue(null);
        mockUpsert.mockResolvedValue(undefined);

        await cashClosingApplicationService.saveDraftConference(makeSaveConferenceParams());

        expect(mockUpsert).toHaveBeenCalledTimes(1);
        expect(mockUpsert).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'draft',
            total_counted: 650,
            total_difference: 0,
          }),
        );
      });

      it('should_use_existing_period_when_available', async () => {
        mockGetByBusinessDate.mockResolvedValue({
          id: 'cc-1',
          period_start: '2026-07-23T08:00:00',
          period_end: '2026-07-23T18:00:00',
        });
        mockUpsert.mockResolvedValue(undefined);

        await cashClosingApplicationService.saveDraftConference(makeSaveConferenceParams());

        expect(mockUpsert).toHaveBeenCalledWith(
          expect.objectContaining({
            period_start: '2026-07-23T08:00:00',
            period_end: '2026-07-23T18:00:00',
          }),
        );
      });

      it('should_generate_current_time_when_no_existing_period', async () => {
        mockGetByBusinessDate.mockResolvedValue(null);
        mockUpsert.mockResolvedValue(undefined);

        await cashClosingApplicationService.saveDraftConference(makeSaveConferenceParams());

        expect(mockUpsert).toHaveBeenCalledWith(
          expect.objectContaining({
            period_start: expect.any(String),
            period_end: expect.any(String),
          }),
        );
      });
    });

    describe('recordEvent', () => {
      it('should_insert_event_with_correct_fields', async () => {
        mockEventInsert.mockResolvedValue(undefined);

        await cashClosingApplicationService.recordEvent(
          'tenant-1', 'opening', 'Caixa aberto', 'Detail text', { key: 'value' }, 'user-1', 'cc-1',
        );

        expect(mockEventInsert).toHaveBeenCalledTimes(1);
        expect(mockEventInsert).toHaveBeenCalledWith(
          expect.objectContaining({
            tenant_id: 'tenant-1',
            event_type: 'opening',
            label: 'Caixa aberto',
            detail: 'Detail text',
            metadata: { key: 'value' },
            created_by_user_id: 'user-1',
            cash_closing_id: 'cc-1',
          }),
        );
      });

      it('should_not_throw_when_event_insert_fails', async () => {
        mockEventInsert.mockRejectedValue(new Error('db error'));

        await expect(
          cashClosingApplicationService.recordEvent('tenant-1', 'closing', 'Test'),
        ).resolves.toBeUndefined();
      });

      it('should_default_metadata_to_empty_object', async () => {
        mockEventInsert.mockResolvedValue(undefined);

        await cashClosingApplicationService.recordEvent('tenant-1', 'closing', 'Test');

        expect(mockEventInsert).toHaveBeenCalledWith(
          expect.objectContaining({ metadata: {} }),
        );
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Grupo C — Summary (computeDaySummary)
  //
  // Testar o cálculo puro do resumo diário.
  // ═══════════════════════════════════════════════════════════════
  describe('Grupo C — Summary', () => {
    it('should_compute_totals_correctly', () => {
      const result = cashClosingApplicationService.computeDaySummary({
        filteredEntries: [makeEntry({ value: 500 }), makeEntry({ type: 'saida', value: 100 })],
        extras: [makeSuprimento(200), makeSangria(50)],
        comandas: [],
        appointments: [],
        filteredComandaDetails: [],
        barberSummaries: [],
        reversalEntries: [],
      });

      expect(result.totals.totalEntradas).toBe(500);
      expect(result.totals.totalSaidas).toBe(100);
      expect(result.totals.saldoAtual).toBe(400);
      expect(result.totals.totalExtrasSuprimento).toBe(200);
      expect(result.totals.totalExtrasSangria).toBe(50);
    });

    it('should_return_empty_breakdown_when_no_entries', () => {
      const result = cashClosingApplicationService.computeDaySummary({
        filteredEntries: [],
        extras: [],
        comandas: [],
        appointments: [],
        filteredComandaDetails: [],
        barberSummaries: [],
        reversalEntries: [],
      });

      expect(result.paymentMethodBreakdown).toHaveLength(0);
      expect(result.barberClosingDetails).toHaveLength(0);
    });

    it('should_build_payment_method_breakdown', () => {
      const result = cashClosingApplicationService.computeDaySummary({
        filteredEntries: [
          makeEntry({ value: 100, paymentMethod: 'Dinheiro' }),
          makeEntry({ value: 200, paymentMethod: 'Pix' }),
          makeEntry({ value: 50, paymentMethod: 'Dinheiro' }),
        ],
        extras: [],
        comandas: [],
        appointments: [],
        filteredComandaDetails: [],
        barberSummaries: [],
        reversalEntries: [],
      });

      expect(result.paymentMethodBreakdown.length).toBeGreaterThan(0);
      const dineroEntry = result.paymentMethodBreakdown.find(([method]) => method === 'Dinheiro');
      expect(dineroEntry).toBeDefined();
      expect(dineroEntry![1].entradas).toBe(150);
    });

    it('should_build_barber_closing_details', () => {
      const result = cashClosingApplicationService.computeDaySummary({
        filteredEntries: [makeEntry({ value: 350 })],
        extras: [],
        comandas: [],
        appointments: [],
        filteredComandaDetails: [],
        barberSummaries: [makeBarberSummary({ totalReceived: 350, comandaCount: 7 })],
        reversalEntries: [],
      });

      expect(result.barberClosingDetails).toHaveLength(1);
      expect(result.barberClosingDetails[0].staffName).toBe('Barbeiro 1');
    });

    it('should_include_reversals_in_totals', () => {
      const reversal = makeEntry({ value: -50, sourceType: 'reversal', isReversalTransaction: true });
      const result = cashClosingApplicationService.computeDaySummary({
        filteredEntries: [makeEntry({ value: 500 })],
        extras: [],
        comandas: [],
        appointments: [],
        filteredComandaDetails: [],
        barberSummaries: [],
        reversalEntries: [reversal],
      });

      expect(result.totals.totalReversals).toBe(-50);
      expect(result.totals.reversalCount).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Grupo D — Edge Cases
  //
  // Situações difíceis: vazios, cancelamentos, valores extremos.
  // ═══════════════════════════════════════════════════════════════
  describe('Grupo D — Edge Cases', () => {
    it('should_handle_empty_snapshot', async () => {
      mockLoadDailySnapshot.mockResolvedValue({
        transactions: [],
        appointments: [],
        comandas: [],
        comandaItems: [],
        comandaDetails: [],
        staff: [],
        clients: [],
        services: [],
        receivables: [],
        reversals: [],
        cashClosing: null,
        barberClosings: [],
        events: [],
        openComandasCount: 0,
        openComandasTotal: 0,
        clubOverdueCount: 0,
        clubOverdueTotal: 0,
      });

      const snapshot = await cashClosingApplicationService.loadDailySnapshot('tenant-1', '2026-07-23');

      expect(snapshot.transactions).toHaveLength(0);
      expect(snapshot.comandas).toHaveLength(0);
      expect(snapshot.openComandasCount).toBe(0);
      expect(snapshot.cashClosing).toBeNull();
    });

    it('should_handle_only_cancelled_comandas', () => {
      const result = cashClosingApplicationService.computeDaySummary({
        filteredEntries: [],
        extras: [],
        comandas: [{ status: 'cancelled', total: 50 }],
        appointments: [{ id: 'apt-1', status: 'cancelled', price: 50 }],
        filteredComandaDetails: [],
        barberSummaries: [],
        reversalEntries: [],
      });

      expect(result.totals.totalEntradas).toBe(0);
      expect(result.totals.totalSaidas).toBe(0);
    });

    it('should_validate_zero_expected_zero_received', () => {
      const result = cashClosingApplicationService.validate(0, 0);
      expect(result.isValid).toBe(true);
      expect(result.difference).toBe(0);
    });

    it('should_validate_large_difference', () => {
      const result = cashClosingApplicationService.validate(100, 1000);
      expect(result.isValid).toBe(false);
      expect(result.difference).toBe(900);
    });

    it('should_validate_negative_difference', () => {
      const result = cashClosingApplicationService.validate(500, 0);
      expect(result.isValid).toBe(false);
      expect(result.difference).toBe(-500);
    });

    it('should_open_cash_register_with_minimal_params', async () => {
      mockGetByBusinessDate.mockResolvedValue(null);
      mockUpsert.mockResolvedValue(undefined);
      mockEventInsert.mockResolvedValue(undefined);

      await cashClosingApplicationService.openCashRegister({ tenantId: 't-1', date: '2026-07-23', userId: 'u-1' });

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({ tenant_id: 't-1', status: 'draft' }),
      );
    });

    it('should_close_barber_cash_with_justification_when_discrepancy', async () => {
      mockBarberGetByCashClosingId.mockResolvedValue([]);
      mockBarberUpsert.mockResolvedValue(undefined);
      mockUpdateBarberClosingsCount.mockResolvedValue(undefined);
      mockEventInsert.mockResolvedValue(undefined);

      await cashClosingApplicationService.closeBarberCash(
        makeCloseBarberCashParams({
          countedCash: 300,
          expectedCash: 350,
          justification: 'Dinheiro a menor',
        }),
      );

      expect(mockBarberUpsert).toHaveBeenCalledWith(
        expect.objectContaining({ conference_justification: 'Dinheiro a menor' }),
      );
    });
  });
});
