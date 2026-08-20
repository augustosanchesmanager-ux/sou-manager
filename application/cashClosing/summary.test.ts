import { describe, it, expect } from 'vitest';
import { calculateTotals, validate, computeDaySummary } from './summary';

const makeEntry = (overrides: Record<string, unknown> = {}) => ({
  id: 'e1',
  tenant_id: 't1',
  date: '2026-07-23T12:00:00Z',
  type: 'entrada' as const,
  value: 100,
  paymentMethod: 'Dinheiro',
  status: 'realizado' as const,
  description: 'Teste',
  category: 'Servicos',
  accountId: 'acc-1',
  costCenter: 'cc-1',
  accountName: 'Caixa Principal',
  runningBalance: 0,
  sourceType: 'comanda',
  sourceId: 'c1',
  isReversalTransaction: false,
  reversalSource: null,
  ...overrides,
});

const makeSangria = (overrides: Record<string, unknown> = {}) => ({
  id: 's1',
  tenant_id: 't1',
  type: 'sangria' as const,
  value: 50,
  description: 'Sangria teste',
  createdAt: '2026-07-23T12:00:00Z',
  ...overrides,
});

const makeSuprimento = (overrides: Record<string, unknown> = {}) => ({
  id: 'sp1',
  tenant_id: 't1',
  type: 'suprimento' as const,
  value: 200,
  description: 'Suprimento teste',
  createdAt: '2026-07-23T12:00:00Z',
  ...overrides,
});

describe('calculateTotals', () => {
  it('returns zeros for empty inputs', () => {
    const result = calculateTotals([], []);
    expect(result.totalEntradas).toBe(0);
    expect(result.totalSaidas).toBe(0);
    expect(result.saldoAtual).toBe(0);
    expect(result.totalExtrasSuprimento).toBe(0);
    expect(result.totalExtrasSangria).toBe(0);
    expect(result.totalExpected).toBe(0);
  });

  it('calculates entries only', () => {
    const entries = [
      makeEntry({ type: 'entrada', value: 500 }),
      makeEntry({ type: 'saida', value: 100 }),
    ];
    const result = calculateTotals(entries, []);
    expect(result.totalEntradas).toBe(500);
    expect(result.totalSaidas).toBe(100);
    expect(result.saldoAtual).toBe(400);
  });

  it('calculates extras only', () => {
    const extras = [
      makeSuprimento({ value: 200 }),
      makeSangria({ value: 50 }),
    ];
    const result = calculateTotals([], extras);
    expect(result.totalExtrasSuprimento).toBe(200);
    expect(result.totalExtrasSangria).toBe(50);
  });

  it('combines entries and extras for totalExpected', () => {
    const entries = [makeEntry({ type: 'entrada', value: 500 })];
    const extras = [
      makeSuprimento({ value: 200 }),
      makeSangria({ value: 50 }),
    ];
    const result = calculateTotals(entries, extras);
    expect(result.totalExpected).toBe(650);
  });
});

describe('validate', () => {
  it('returns valid when exact match', () => {
    const result = validate(100, 100);
    expect(result.isValid).toBe(true);
    expect(result.difference).toBe(0);
  });

  it('returns valid within tolerance (0.01)', () => {
    const result = validate(100, 100.005);
    expect(result.isValid).toBe(true);
  });

  it('returns invalid outside tolerance', () => {
    const result = validate(100, 101);
    expect(result.isValid).toBe(false);
    expect(result.difference).toBe(1);
  });

  it('returns invalid when received < expected', () => {
    const result = validate(200, 150);
    expect(result.isValid).toBe(false);
    expect(result.difference).toBe(-50);
  });
});

// ─── computeDaySummary ────────────────────────────────────────────

describe('computeDaySummary', () => {
  const emptyParams = {
    filteredEntries: [],
    extras: [],
    comandas: [],
    appointments: [],
    filteredComandaDetails: [],
    barberSummaries: [],
    reversalEntries: [],
  };

  it('entrada R$45 sem saida → totalExpected = R$45', () => {
    const result = computeDaySummary({
      ...emptyParams,
      filteredEntries: [makeEntry({ type: 'entrada', value: 45, paymentMethod: 'pix' })],
    });
    expect(result.totals.totalExpected).toBe(45);
    expect(result.validation.difference).toBe(0);
    expect(result.validation.isValid).toBe(true);
  });

  it('entrada R$80 + saida R$35 → totalExpected = R$45 (saldo devedor, não receita bruta)', () => {
    const result = computeDaySummary({
      ...emptyParams,
      filteredEntries: [
        makeEntry({ type: 'entrada', value: 45, paymentMethod: 'pix' }),
        makeEntry({ type: 'entrada', value: 35, paymentMethod: 'other' }),
        makeEntry({ type: 'saida', value: 35, paymentMethod: 'other' }),
      ],
    });
    expect(result.totals.totalEntradas).toBe(80);
    expect(result.totals.totalSaidas).toBe(35);
    expect(result.totals.saldoAtual).toBe(45);
    expect(result.totals.totalExpected).toBe(45);
  });

  it('entrada + suprimento → totalExpected = saldoAtual + suprimento', () => {
    const result = computeDaySummary({
      ...emptyParams,
      filteredEntries: [makeEntry({ type: 'entrada', value: 500 })],
      extras: [makeSuprimento({ value: 200 })],
    });
    expect(result.totals.totalExpected).toBe(700);
  });

  it('entrada + sangria → totalExpected = entrada − sangria', () => {
    const result = computeDaySummary({
      ...emptyParams,
      filteredEntries: [makeEntry({ type: 'entrada', value: 500 })],
      extras: [makeSangria({ value: 50 })],
    });
    expect(result.totals.totalExpected).toBe(450);
  });

  it('entrada + suprimento − sangria → formula correspondente', () => {
    const result = computeDaySummary({
      ...emptyParams,
      filteredEntries: [makeEntry({ type: 'entrada', value: 500 })],
      extras: [makeSuprimento({ value: 200 }), makeSangria({ value: 50 })],
    });
    expect(result.totals.totalExpected).toBe(650);
  });

  // ── BUG-02A: barberClosingRecords status sync ───────────────────

  it('BUG-02A: barberClosingRecords com status closed → barberClosingDetails.status = closed', () => {
    const barberSummaries = [{
      staffId: 'staff-heron',
      staffName: 'Heron',
      role: 'barber',
      commissionRate: 0.5,
      totalReceived: 45,
      comandaCount: 1,
      comandas: [{
        comandaId: 'c1',
        staffId: 'staff-heron',
        staffName: 'Heron',
        total: 45,
        status: 'paid',
        paymentMethod: 'pix',
        clientName: 'Cliente',
        appointmentId: null,
        items: [{ staffId: 'staff-heron', serviceName: 'Corte', quantity: 1, unitPrice: 45 }],
      }],
      openComandaCount: 0,
      openTotal: 0,
      openComandas: [],
    }] as any[];

    const result = computeDaySummary({
      ...emptyParams,
      filteredEntries: [makeEntry({ type: 'entrada', value: 45, paymentMethod: 'pix' })],
      barberSummaries,
      barberClosingRecords: [{ staff_id: 'staff-heron', status: 'closed' }],
    });

    const heron = result.barberClosingDetails.find(b => b.staffId === 'staff-heron');
    expect(heron).toBeDefined();
    expect(heron!.status).toBe('closed');
    expect(heron!.checklist.conferenceDone).toBe(true);
  });

  it('BUG-02A: barberClosingRecords vazio → barberClosingDetails.status = open (default)', () => {
    const barberSummaries = [{
      staffId: 'staff-heron',
      staffName: 'Heron',
      role: 'barber',
      commissionRate: 0.5,
      totalReceived: 45,
      comandaCount: 1,
      comandas: [{
        comandaId: 'c1',
        staffId: 'staff-heron',
        staffName: 'Heron',
        total: 45,
        status: 'paid',
        paymentMethod: 'pix',
        clientName: 'Cliente',
        appointmentId: null,
        items: [{ staffId: 'staff-heron', serviceName: 'Corte', quantity: 1, unitPrice: 45 }],
      }],
      openComandaCount: 0,
      openTotal: 0,
      openComandas: [],
    }] as any[];

    const result = computeDaySummary({
      ...emptyParams,
      filteredEntries: [makeEntry({ type: 'entrada', value: 45, paymentMethod: 'pix' })],
      barberSummaries,
      barberClosingRecords: [],
    });

    const heron = result.barberClosingDetails.find(b => b.staffId === 'staff-heron');
    expect(heron).toBeDefined();
    expect(heron!.status).toBe('open');
    expect(heron!.checklist.conferenceDone).toBe(false);
  });

  it('BUG-02A: sem barberClosingRecords (param omitido) → mantém behavior legado (open)', () => {
    const barberSummaries = [{
      staffId: 'staff-heron',
      staffName: 'Heron',
      role: 'barber',
      commissionRate: 0.5,
      totalReceived: 45,
      comandaCount: 1,
      comandas: [],
      openComandaCount: 0,
      openTotal: 0,
      openComandas: [],
    }] as any[];

    const result = computeDaySummary({
      ...emptyParams,
      filteredEntries: [makeEntry({ type: 'entrada', value: 45, paymentMethod: 'pix' })],
      barberSummaries,
    });

    const heron = result.barberClosingDetails.find(b => b.staffId === 'staff-heron');
    expect(heron!.status).toBe('open');
    expect(heron!.checklist.conferenceDone).toBe(false);
  });

  it('cenario H7: entrada R$80 com saida R$35 → totalExpected = R$45 (saldo devedor)', () => {
    const result = computeDaySummary({
      ...emptyParams,
      filteredEntries: [
        makeEntry({ type: 'entrada', value: 45, paymentMethod: 'pix' }),
        makeEntry({ type: 'entrada', value: 35, paymentMethod: 'other' }),
        makeEntry({ type: 'saida', value: 35, paymentMethod: 'other' }),
      ],
    });
    expect(result.totals.totalEntradas).toBe(80);
    expect(result.totals.totalSaidas).toBe(35);
    expect(result.totals.saldoAtual).toBe(45);
    expect(result.totals.totalExpected).toBe(45);
  });

  it('totalExpected matches calculateTotals for same inputs', () => {
    const entries = [makeEntry({ type: 'entrada', value: 500 })];
    const extras = [makeSuprimento({ value: 200 }), makeSangria({ value: 50 })];

    const totalsResult = calculateTotals(entries, extras);
    const summaryResult = computeDaySummary({
      ...emptyParams,
      filteredEntries: entries,
      extras,
    });

    expect(summaryResult.totals.totalExpected).toBe(totalsResult.totalExpected);
    expect(summaryResult.totals.totalExpected).toBe(650);
  });

  // ── Contrato H7: totalExpected = saldo devedor ──────────────

  it('contrato H7: saida reduz totalExpected (saldo devedor, não receita bruta)', () => {
    const result = computeDaySummary({
      ...emptyParams,
      filteredEntries: [
        makeEntry({ type: 'entrada', value: 45, paymentMethod: 'pix' }),
        makeEntry({ type: 'entrada', value: 35, paymentMethod: 'other' }),
        makeEntry({ type: 'saida', value: 35, paymentMethod: 'other' }),
      ],
    });
    expect(result.totals.totalEntradas).toBe(80);
    expect(result.totals.totalSaidas).toBe(35);
    expect(result.totals.saldoAtual).toBe(45);
    expect(result.totals.totalExpected).toBe(45);
  });

  it('contrato H7: entrada + suprimento + saida → saldo devedor correto', () => {
    const result = computeDaySummary({
      ...emptyParams,
      filteredEntries: [
        makeEntry({ type: 'entrada', value: 100 }),
        makeEntry({ type: 'saida', value: 35 }),
      ],
      extras: [makeSuprimento({ value: 20 })],
    });
    expect(result.totals.saldoAtual).toBe(65);
    expect(result.totals.totalExpected).toBe(85);
  });

  // ── reversalEntries: cálculo de totalExpected ───────────────

  it('reversalEntries R$35 NÃO altera totalExpected quando já está em filteredEntries como saida', () => {
    const reversalEntry = makeEntry({ type: 'saida', value: 35, paymentMethod: 'other' });
    const result = computeDaySummary({
      ...emptyParams,
      filteredEntries: [
        makeEntry({ type: 'entrada', value: 45, paymentMethod: 'pix' }),
        makeEntry({ type: 'entrada', value: 35, paymentMethod: 'other' }),
        reversalEntry,
      ],
      reversalEntries: [reversalEntry],
    });
    expect(result.totals.totalEntradas).toBe(80);
    expect(result.totals.totalSaidas).toBe(35);
    expect(result.totals.saldoAtual).toBe(45);
    expect(result.totals.totalExpected).toBe(45);
    expect(result.totals.totalReversals).toBe(35);
    expect(result.totals.reversalCount).toBe(1);
  });

  it('reversalEntries vazio + saida → totalExpected usa saldo devedor', () => {
    const result = computeDaySummary({
      ...emptyParams,
      filteredEntries: [
        makeEntry({ type: 'entrada', value: 45, paymentMethod: 'pix' }),
        makeEntry({ type: 'saida', value: 35, paymentMethod: 'other' }),
      ],
      reversalEntries: [],
    });
    expect(result.totals.totalExpected).toBe(10);
    expect(result.totals.totalReversals).toBe(0);
  });

  it('cenario H7 completo: R$45 Pix + R$35 saida → totalExpected = R$45', () => {
    const result = computeDaySummary({
      ...emptyParams,
      filteredEntries: [
        makeEntry({ type: 'entrada', value: 45, paymentMethod: 'pix' }),
        makeEntry({ type: 'entrada', value: 35, paymentMethod: 'other' }),
        makeEntry({ type: 'saida', value: 35, paymentMethod: 'other' }),
      ],
      reversalEntries: [
        makeEntry({ type: 'saida', value: 35, paymentMethod: 'other' }),
      ],
    });
    expect(result.totals.totalEntradas).toBe(80);
    expect(result.totals.totalSaidas).toBe(35);
    expect(result.totals.saldoAtual).toBe(45);
    expect(result.totals.totalExpected).toBe(45);
    expect(result.totals.totalReversals).toBe(35);
  });
});

// ─── validate — divergencia real (H7 numbers) ────────────────────

describe('validate — divergencia real com cenario H7', () => {
  it('esperado R$80, contado R$79 → difference = -1, isValid = false', () => {
    const result = validate(80, 79);
    expect(result.difference).toBe(-1);
    expect(result.isValid).toBe(false);
  });

  it('esperado R$80, contado R$81 → difference = +1, isValid = false', () => {
    const result = validate(80, 81);
    expect(result.difference).toBe(1);
    expect(result.isValid).toBe(false);
  });

  it('esperado R$80, contado R$80 → difference = 0, isValid = true', () => {
    const result = validate(80, 80);
    expect(result.difference).toBe(0);
    expect(result.isValid).toBe(true);
  });

  it('esperado R$80, contado R$79.995 → dentro da tolerancia, isValid = true', () => {
    const result = validate(80, 79.995);
    expect(result.isValid).toBe(true);
  });

  it('esperado R$80, contado R$80.02 → fora da tolerancia, isValid = false', () => {
    const result = validate(80, 80.02);
    expect(result.isValid).toBe(false);
  });
});

// ─── validate — contrato H7: counted como input independente ────

describe('validate — contrato H7: counted como input do operador', () => {
  it('expected R$45, counted R$45 → difference 0, isValid true', () => {
    const result = validate(45, 45);
    expect(result.difference).toBe(0);
    expect(result.isValid).toBe(true);
    expect(result.totalExpected).toBe(45);
    expect(result.totalReceived).toBe(45);
  });

  it('expected R$45, counted R$44 → difference -1, isValid false', () => {
    const result = validate(45, 44);
    expect(result.difference).toBe(-1);
    expect(result.isValid).toBe(false);
    expect(result.totalExpected).toBe(45);
    expect(result.totalReceived).toBe(44);
  });

  it('expected R$45, counted R$46 → difference +1, isValid false', () => {
    const result = validate(45, 46);
    expect(result.difference).toBe(1);
    expect(result.isValid).toBe(false);
    expect(result.totalExpected).toBe(45);
    expect(result.totalReceived).toBe(46);
  });

  it('expected R$45, counted R$0 → difference -45, isValid false (caixa vazio)', () => {
    const result = validate(45, 0);
    expect(result.difference).toBe(-45);
    expect(result.isValid).toBe(false);
  });

  it('expected R$45, counted R$90 → difference +45, isValid false (dobro)', () => {
    const result = validate(45, 90);
    expect(result.difference).toBe(45);
    expect(result.isValid).toBe(false);
  });

  it('expected R$75, counted R$74.999 → dentro tolerancia, isValid true', () => {
    const result = validate(75, 74.999);
    expect(result.isValid).toBe(true);
    expect(result.difference).toBeCloseTo(-0.001, 3);
  });

  it('expected R$75, counted R$75.02 → fora tolerancia, isValid false', () => {
    const result = validate(75, 75.02);
    expect(result.isValid).toBe(false);
    expect(result.difference).toBeCloseTo(0.02, 2);
  });
});
