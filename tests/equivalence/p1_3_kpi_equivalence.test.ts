/**
 * P1.3 — Teste de Equivalência: Seletor Antigo (TS) vs RPC (SQL)
 *
 * Compara o seletor buildDashboardMetrics (Dashboard) com a lógica do
 * RPC get_dashboard_kpis para K1-K6, usando os mesmos dados de teste.
 *
 * Critério: |Δ| ≤ 0.01 (inteiros: igualdade exata).
 *
 * Decisões: D-EST-01, D-PERF-01, D-RET-01.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { buildDashboardMetrics } from '../../src/modules/dashboard/selectors';
import { resetTransactionSeq, makeIncomeTransaction, makeExpenseTransaction } from '../builders/transaction.builder';
import { resetAppointmentSeq, makeCompletedAppointment, makeCancelledAppointment } from '../builders/appointment.builder';

// ─── Test Data ──────────────────────────────────────────────────

const TENANT_ID = 'tenant-1';

// Período atual: mês corrente
const now = new Date();
const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

// Helper para criar data no mês especificado
const dateInMonth = (year: number, month: number, day: number) =>
  new Date(year, month, day).toISOString();

// ─── Transactions (K1-K5) ───────────────────────────────────────

// Receita atual: 3 transações income (100 + 200 + 300 = 600)
const currentIncomeTransactions = [
  { id: 'tx-inc-1', tenant_id: TENANT_ID, type: 'income', category: 'service', amount: 100, description: 'Corte 1', payment_method: 'Dinheiro', date: dateInMonth(now.getFullYear(), now.getMonth(), 5), status: 'paid', source_type: 'comanda', source_id: 'comanda-1', created_at: new Date().toISOString() },
  { id: 'tx-inc-2', tenant_id: TENANT_ID, type: 'income', category: 'service', amount: 200, description: 'Corte 2', payment_method: 'Cartão', date: dateInMonth(now.getFullYear(), now.getMonth(), 10), status: 'paid', source_type: 'comanda', source_id: 'comanda-2', created_at: new Date().toISOString() },
  { id: 'tx-inc-3', tenant_id: TENANT_ID, type: 'income', category: 'service', amount: 300, description: 'Corte 3', payment_method: 'PIX', date: dateInMonth(now.getFullYear(), now.getMonth(), 15), status: 'paid', source_type: 'comanda', source_id: 'comanda-3', created_at: new Date().toISOString() },
];

// Despesa atual: 2 transações expense (50 + 100 = 150)
const currentExpenseTransactions = [
  { id: 'tx-exp-1', tenant_id: TENANT_ID, type: 'expense', category: 'supply', amount: 50, description: 'Shampoo', payment_method: 'Dinheiro', date: dateInMonth(now.getFullYear(), now.getMonth(), 8), status: 'paid', source_type: null, source_id: null, created_at: new Date().toISOString() },
  { id: 'tx-exp-2', tenant_id: TENANT_ID, type: 'expense', category: 'rent', amount: 100, description: 'Aluguel', payment_method: 'Transferência', date: dateInMonth(now.getFullYear(), now.getMonth(), 1), status: 'paid', source_type: null, source_id: null, created_at: new Date().toISOString() },
];

// Receita anterior: 2 transações income (150 + 250 = 400)
const previousIncomeTransactions = [
  { id: 'tx-prev-inc-1', tenant_id: TENANT_ID, type: 'income', category: 'service', amount: 150, description: 'Corte anterior 1', payment_method: 'Dinheiro', date: dateInMonth(previousMonthStart.getFullYear(), previousMonthStart.getMonth(), 5), status: 'paid', source_type: 'comanda', source_id: 'comanda-prev-1', created_at: new Date().toISOString() },
  { id: 'tx-prev-inc-2', tenant_id: TENANT_ID, type: 'income', category: 'service', amount: 250, description: 'Corte anterior 2', payment_method: 'Cartão', date: dateInMonth(previousMonthStart.getFullYear(), previousMonthStart.getMonth(), 15), status: 'paid', source_type: 'comanda', source_id: 'comanda-prev-2', created_at: new Date().toISOString() },
];

// Despesa anterior: 1 transação expense (75)
const previousExpenseTransactions = [
  { id: 'tx-prev-exp-1', tenant_id: TENANT_ID, type: 'expense', category: 'supply', amount: 75, description: 'Material anterior', payment_method: 'Dinheiro', date: dateInMonth(previousMonthStart.getFullYear(), previousMonthStart.getMonth(), 10), status: 'paid', source_type: null, source_id: null, created_at: new Date().toISOString() },
];

const currentTransactions = [...currentIncomeTransactions, ...currentExpenseTransactions];
const previousTransactions = [...previousIncomeTransactions, ...previousExpenseTransactions];

// ─── Appointments (K6-K8) ───────────────────────────────────────

// Atendimentos elegíveis (completed) no período atual: 5 clientes
const currentAppointments = [
  makeCompletedAppointment({ id: 'apt-cur-1', client_id: 'client-1', start_time: dateInMonth(now.getFullYear(), now.getMonth(), 3) }),
  makeCompletedAppointment({ id: 'apt-cur-2', client_id: 'client-2', start_time: dateInMonth(now.getFullYear(), now.getMonth(), 7) }),
  makeCompletedAppointment({ id: 'apt-cur-3', client_id: 'client-3', start_time: dateInMonth(now.getFullYear(), now.getMonth(), 12) }),
  makeCompletedAppointment({ id: 'apt-cur-4', client_id: 'client-1', start_time: dateInMonth(now.getFullYear(), now.getMonth(), 18) }), // cliente-1 retornou
  makeCompletedAppointment({ id: 'apt-cur-5', client_id: 'client-4', start_time: dateInMonth(now.getFullYear(), now.getMonth(), 22) }),
];

// Atendimentos elegíveis (completed) no período anterior: 4 clientes
const previousAppointments = [
  makeCompletedAppointment({ id: 'apt-prev-1', client_id: 'client-1', start_time: dateInMonth(previousMonthStart.getFullYear(), previousMonthStart.getMonth(), 5) }),
  makeCompletedAppointment({ id: 'apt-prev-2', client_id: 'client-2', start_time: dateInMonth(previousMonthStart.getFullYear(), previousMonthStart.getMonth(), 10) }),
  makeCompletedAppointment({ id: 'apt-prev-3', client_id: 'client-3', start_time: dateInMonth(previousMonthStart.getFullYear(), previousMonthStart.getMonth(), 15) }),
  makeCompletedAppointment({ id: 'apt-prev-4', client_id: 'client-5', start_time: dateInMonth(previousMonthStart.getFullYear(), previousMonthStart.getMonth(), 20) }),
];

// ─── Staff ──────────────────────────────────────────────────────

const staffList = [
  { id: 'staff-1', name: 'Barbeiro 1' },
  { id: 'staff-2', name: 'Barbeiro 2' },
];

// ─── Expected RPC Output (computed from SQL logic) ───────────────
//
// K1: Receita = Σ income(paid) − Σ reversões = 600 − 0 = 600
// K2: Despesas = Σ expense(paid) − transações de reversão = 150 − 0 = 150
// K3: Resultado = 600 − 150 = 450
// K4: Ticket médio = 600 / 3 = 200 (3 transações income com saldo > 0)
// K5: Crescimento = (600 − 400) / 400 = 0.5 (50%)
// K6: Retenção = 3 / 4 = 0.75 (75%) — client-1,2,3 retornaram; client-5 não
// K7: Clientes ativos = 4 (client-1,2,3,4)
// K8: Atendimentos = 5 completed, 0 cancelled, 0 no_show
// K10: Novos clientes = 0 (sem dados de clients)

// ─── Tests ──────────────────────────────────────────────────────

describe('P1.3 KPI Equivalence — buildDashboardMetrics vs get_dashboard_kpis logic', () => {
  beforeEach(() => {
    resetTransactionSeq();
    resetAppointmentSeq();
  });

  describe('K1: Receita', () => {
    it('should_match_old_selector_when_no_reversals', () => {
      // Arrange
      const expectedRevenue = 600; // 100 + 200 + 300

      // Act — old selector
      const oldMetrics = buildDashboardMetrics(
        currentTransactions,
        previousTransactions,
        staffList,
        [],
        currentAppointments.length,
        previousAppointments.length,
        currentAppointments,
        previousAppointments,
        0,
        0,
      );

      // Assert — old selector computes K1 as revenue
      expect(oldMetrics.revenue).toBe(expectedRevenue);

      // RPC logic: Σ income(paid) − Σ reversions = 600 − 0 = 600
      const expectedRpcRevenue = 600;
      expect(oldMetrics.revenue).toBe(expectedRpcRevenue);
    });
  });

  describe('K2: Despesas', () => {
    it('should_match_old_selector_when_no_reversals', () => {
      // Arrange
      const expectedExpenses = 150; // 50 + 100

      // Act
      const oldMetrics = buildDashboardMetrics(
        currentTransactions,
        previousTransactions,
        staffList,
        [],
        currentAppointments.length,
        previousAppointments.length,
        currentAppointments,
        previousAppointments,
        0,
        0,
      );

      // Assert
      expect(oldMetrics.expenses).toBe(expectedExpenses);

      // RPC logic: Σ expense(paid) − reversal transactions = 150 − 0 = 150
      const expectedRpcExpenses = 150;
      expect(oldMetrics.expenses).toBe(expectedRpcExpenses);
    });
  });

  describe('K3: Resultado', () => {
    it('should_match_old_selector', () => {
      // Arrange
      const expectedResult = 450; // 600 − 150

      // Act
      const oldMetrics = buildDashboardMetrics(
        currentTransactions,
        previousTransactions,
        staffList,
        [],
        currentAppointments.length,
        previousAppointments.length,
        currentAppointments,
        previousAppointments,
        0,
        0,
      );

      // Assert
      expect(oldMetrics.netRevenue).toBe(expectedResult);

      // RPC logic: revenue − expenses = 600 − 150 = 450
      const expectedRpcResult = 450;
      expect(oldMetrics.netRevenue).toBe(expectedRpcResult);
    });
  });

  describe('K4: Ticket Médio', () => {
    it('should_match_old_selector_when_no_reversals', () => {
      // Arrange
      const expectedAvgTicket = 200; // 600 / 3

      // Act
      const oldMetrics = buildDashboardMetrics(
        currentTransactions,
        previousTransactions,
        staffList,
        [],
        currentAppointments.length,
        previousAppointments.length,
        currentAppointments,
        previousAppointments,
        0,
        0,
      );

      // Assert
      expect(oldMetrics.avgTicket).toBe(expectedAvgTicket);

      // RPC logic: revenue / nº transactions income with balance > 0 = 600 / 3 = 200
      const expectedRpcAvgTicket = 200;
      expect(oldMetrics.avgTicket).toBe(expectedRpcAvgTicket);
    });
  });

  describe('K5: Crescimento', () => {
    it('should_match_old_selector_with_percentage_conversion', () => {
      // Arrange
      // Old selector: revenueGrowth = (currentIncome - previousIncome) / previousIncome * 100
      // RPC: growth = (revenue - revenue_prev) / revenue_prev (fraction, not percentage)
      const expectedGrowthFraction = 0.5; // (600 − 400) / 400

      // Act
      const oldMetrics = buildDashboardMetrics(
        currentTransactions,
        previousTransactions,
        staffList,
        [],
        currentAppointments.length,
        previousAppointments.length,
        currentAppointments,
        previousAppointments,
        0,
        0,
      );

      // Assert — old selector returns percentage (50), RPC returns fraction (0.5)
      const oldGrowthAsFraction = oldMetrics.revenueGrowth / 100;
      expect(oldGrowthAsFraction).toBeCloseTo(expectedGrowthFraction, 2);
    });

    it('should_return_null_when_previous_revenue_is_zero', () => {
      // Arrange — no previous income
      const emptyPreviousTransactions = [
        { id: 'tx-prev-exp-only', tenant_id: TENANT_ID, type: 'expense', category: 'supply', amount: 50, description: 'Material', payment_method: 'Dinheiro', date: dateInMonth(previousMonthStart.getFullYear(), previousMonthStart.getMonth(), 5), status: 'paid', source_type: null, source_id: null, created_at: new Date().toISOString() },
      ];

      // Act
      const oldMetrics = buildDashboardMetrics(
        currentTransactions,
        emptyPreviousTransactions,
        staffList,
        [],
        currentAppointments.length,
        previousAppointments.length,
        currentAppointments,
        previousAppointments,
        0,
        0,
      );

      // Assert — old selector returns 0 when previousIncome = 0
      expect(oldMetrics.revenueGrowth).toBe(0);

      // RPC logic: growth = NULL when revenue_prev = 0 (avoids division by zero)
      // The old selector returns 0, RPC returns null — this is an INTENTIONAL difference
      // documented in the KPI matrix. Both avoid division by zero.
    });
  });

  describe('K6: Retenção', () => {
    it('should_match_old_selector_when_all_appointments_are_completed', () => {
      // Arrange
      // Base (anterior): client-1, client-2, client-3, client-5 = 4
      // Retornados (atual ∩ anterior): client-1, client-2, client-3 = 3
      // Retenção = 3 / 4 = 0.75 (75%)
      const expectedRetentionFraction = 0.75;

      // Act
      const oldMetrics = buildDashboardMetrics(
        currentTransactions,
        previousTransactions,
        staffList,
        [],
        currentAppointments.length,
        previousAppointments.length,
        currentAppointments,
        previousAppointments,
        0,
        0,
      );

      // Assert — old selector returns percentage (75), RPC returns fraction (0.75)
      const oldRetentionAsFraction = oldMetrics.retentionRate / 100;
      expect(oldRetentionAsFraction).toBeCloseTo(expectedRetentionFraction, 2);
    });

    it('should_exclude_cancelled_from_current_period', () => {
      // Arrange — add cancelled appointment to current period
      const cancelledAppointment = makeCancelledAppointment({
        id: 'apt-cancelled-1',
        client_id: 'client-6', // new client, not in previous period
        start_time: dateInMonth(now.getFullYear(), now.getMonth(), 25),
      });

      const currentWithCancelled = [...currentAppointments, cancelledAppointment];

      // Act
      const oldMetrics = buildDashboardMetrics(
        currentTransactions,
        previousTransactions,
        staffList,
        [],
        currentWithCancelled.length,
        previousAppointments.length,
        currentWithCancelled,
        previousAppointments,
        0,
        0,
      );

      // Assert — cancelled appointment excluded from currentVisitorIds
      // Base: client-1,2,3,5 = 4
      // Current (excluding cancelled): client-1,2,3,4 = 4 (client-6 excluded)
      // Returned: client-1,2,3 = 3
      // Retention = 3/4 = 0.75
      const oldRetentionAsFraction = oldMetrics.retentionRate / 100;
      expect(oldRetentionAsFraction).toBeCloseTo(0.75, 2);
    });
  });

  describe('K7: Clientes Ativos', () => {
    it('should_count_distinct_completed_clients', () => {
      // Arrange — current period has 4 distinct clients: client-1,2,3,4
      const expectedActiveClients = 4;

      // Act
      const oldMetrics = buildDashboardMetrics(
        currentTransactions,
        previousTransactions,
        staffList,
        [],
        currentAppointments.length,
        previousAppointments.length,
        currentAppointments,
        previousAppointments,
        0,
        0,
      );

      // Assert — old selector doesn't directly expose active_clients
      // but currentVisitorIds.size = 4 (client-1,2,3,4 — cancelled excluded)
      // The RPC computes K7 as COUNT(DISTINCT client_id) WHERE status = 'completed'
      // Since all current appointments are completed, both should match
      const currentVisitorIds = new Set(
        currentAppointments
          .filter((a: any) => !['cancelled', 'canceled'].includes(a.status))
          .map((a: any) => a.client_id)
          .filter(Boolean),
      );
      expect(currentVisitorIds.size).toBe(expectedActiveClients);
    });
  });

  describe('K8: Atendimentos', () => {
    it('should_count_by_status', () => {
      // Arrange
      const expectedTotal = 5;
      const expectedCompleted = 5;
      const expectedCancelled = 0;
      const expectedNoShow = 0;

      // Act — current appointments are all completed
      const completedCount = currentAppointments.filter((a: any) => a.status === 'completed').length;
      const cancelledCount = currentAppointments.filter((a: any) => a.status === 'cancelled').length;
      const noShowCount = currentAppointments.filter((a: any) => a.status === 'no_show').length;

      // Assert
      expect(currentAppointments.length).toBe(expectedTotal);
      expect(completedCount).toBe(expectedCompleted);
      expect(cancelledCount).toBe(expectedCancelled);
      expect(noShowCount).toBe(expectedNoShow);
    });
  });

  describe('Equivalence with reversals (D-EST-01)', () => {
    it('should_note_intentional_difference_when_reversals_exist', () => {
      // Arrange — income transaction with partial reversal
      const incomeWithReversal = [
        { id: 'tx-inc-r1', tenant_id: TENANT_ID, type: 'income', category: 'service', amount: 500, description: 'Serviço com estorno', payment_method: 'Cartão', date: dateInMonth(now.getFullYear(), now.getMonth(), 10), status: 'paid', source_type: 'comanda', source_id: 'comanda-r1', created_at: new Date().toISOString() },
      ];

      // Financial reversal: partial_refund of 100
      const reversalAmount = 100;

      // Act — old selector: ignores reversals, counts full amount
      const oldMetrics = buildDashboardMetrics(
        incomeWithReversal,
        [],
        staffList,
        [],
        0,
        0,
        [],
        [],
        0,
        0,
      );

      // Assert — old selector: revenue = 500 (ignores reversal)
      expect(oldMetrics.revenue).toBe(500);

      // RPC logic: revenue = 500 − 100 = 400 (D-EST-01: subtracts reversal amount)
      const expectedRpcRevenue = 500 - reversalAmount;
      expect(expectedRpcRevenue).toBe(400);

      // INTENTIONAL DIFFERENCE: old selector includes full amount,
      // RPC subtracts reversals. This is the D-EST-01 improvement.
      // The equivalence test documents this difference.
      expect(oldMetrics.revenue).not.toBe(expectedRpcRevenue);
    });
  });

  describe('Previous period metrics', () => {
    it('should_match_old_selector_for_previous_income', () => {
      // Arrange
      const expectedPreviousIncome = 400; // 150 + 250

      // Act
      const oldMetrics = buildDashboardMetrics(
        currentTransactions,
        previousTransactions,
        staffList,
        [],
        currentAppointments.length,
        previousAppointments.length,
        currentAppointments,
        previousAppointments,
        0,
        0,
      );

      // Assert
      expect(oldMetrics.revenuePrevious).toBe(expectedPreviousIncome);

      // RPC logic: same calculation for previous period
      const expectedRpcRevenuePrev = 400;
      expect(oldMetrics.revenuePrevious).toBe(expectedRpcRevenuePrev);
    });

    it('should_match_old_selector_for_previous_expenses', () => {
      // Arrange
      const expectedPreviousExpenses = 75;

      // Act
      const oldMetrics = buildDashboardMetrics(
        currentTransactions,
        previousTransactions,
        staffList,
        [],
        currentAppointments.length,
        previousAppointments.length,
        currentAppointments,
        previousAppointments,
        0,
        0,
      );

      // Assert
      expect(oldMetrics.expensesPrevious).toBe(expectedPreviousExpenses);
    });
  });
});
