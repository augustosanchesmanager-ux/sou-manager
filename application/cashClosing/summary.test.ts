import { describe, it, expect } from 'vitest';
import { calculateTotals, validate } from './summary';

const makeEntry = (overrides: Record<string, unknown> = {}) => ({
  id: 'e1',
  tenant_id: 't1',
  date: '2026-07-23T12:00:00Z',
  type: 'entrada' as const,
  value: 100,
  paymentMethod: 'Dinheiro',
  status: 'confirmado',
  ...overrides,
});

const makeSangria = (overrides: Record<string, unknown> = {}) => ({
  id: 's1',
  tenant_id: 't1',
  type: 'sangria' as const,
  value: 50,
  createdAt: '2026-07-23T12:00:00Z',
  ...overrides,
});

const makeSuprimento = (overrides: Record<string, unknown> = {}) => ({
  id: 'sp1',
  tenant_id: 't1',
  type: 'suprimento' as const,
  value: 200,
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
