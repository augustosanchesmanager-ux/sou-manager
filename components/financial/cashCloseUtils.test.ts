import { describe, it, expect } from 'vitest';
import {
  validateCashClose,
  buildBarberSummaries,
  buildPaymentMethodRows,
  isFrontlineRole,
  buildAttendancesByBarber,
  buildOpenComandasSummary,
  filterEntries,
  type CashCloseFilters,
} from '../../components/financial/cashCloseUtils';

describe('validateCashClose', () => {
  it('returns valid when exact match', () => {
    const result = validateCashClose(100, 100);
    expect(result.isValid).toBe(true);
    expect(result.difference).toBe(0);
  });

  it('returns valid within tolerance', () => {
    const result = validateCashClose(100, 100.009);
    expect(result.isValid).toBe(true);
  });

  it('returns invalid outside tolerance', () => {
    const result = validateCashClose(100, 100.02);
    expect(result.isValid).toBe(false);
    expect(result.difference).toBeCloseTo(0.02);
  });

  it('handles negative difference', () => {
    const result = validateCashClose(200, 150);
    expect(result.isValid).toBe(false);
    expect(result.difference).toBe(-50);
  });
});

describe('isFrontlineRole', () => {
  it('returns true for barber', () => {
    expect(isFrontlineRole('barber')).toBe(true);
  });

  it('returns true for manager', () => {
    expect(isFrontlineRole('manager')).toBe(true);
  });

  it('returns false for receptionist', () => {
    expect(isFrontlineRole('receptionist')).toBe(false);
  });

  it('returns false for empty', () => {
    expect(isFrontlineRole('')).toBe(false);
  });

  it('returns false for unknown', () => {
    expect(isFrontlineRole('unknown')).toBe(false);
  });
});

describe('buildPaymentMethodRows', () => {
  it('aggregates income by method', () => {
    const entries = [
      { type: 'entrada' as const, paymentMethod: 'Dinheiro', value: 100 } as any,
      { type: 'entrada' as const, paymentMethod: 'Dinheiro', value: 50 } as any,
      { type: 'entrada' as const, paymentMethod: 'Pix', value: 200 } as any,
    ];
    const result = buildPaymentMethodRows(entries, []);
    expect(result).toHaveLength(2);
    const cash = result.find(r => r.method === 'Dinheiro');
    expect(cash?.launched).toBe(150);
    const pix = result.find(r => r.method === 'Pix');
    expect(pix?.launched).toBe(200);
  });

  it('ignores exits', () => {
    const entries = [
      { type: 'saida' as const, paymentMethod: 'Dinheiro', value: 100 } as any,
    ];
    const result = buildPaymentMethodRows(entries, []);
    expect(result).toHaveLength(0);
  });

  it('handles missing payment method', () => {
    const entries = [
      { type: 'entrada' as const, paymentMethod: null, value: 50 } as any,
    ];
    const result = buildPaymentMethodRows(entries, []);
    expect(result).toHaveLength(1);
    expect(result[0].method).toBe('Nao informado');
  });
});

describe('buildBarberSummaries', () => {
  it('handles solo comanda (no shared items)', () => {
    const comandas = [{
      comandaId: 'c1',
      staffId: 'staff1',
      staffName: 'Marcos',
      total: 100,
      status: 'paid',
      paymentMethod: 'Dinheiro',
      clientName: 'Cliente',
      appointmentId: null,
      items: [{ staffId: 'staff1', serviceName: 'Corte', quantity: 1, unitPrice: 100 }],
    }] as any[];
    const staffMap = { staff1: { name: 'Marcos', role: 'barber', commissionRate: 50 } };
    const result = buildBarberSummaries(comandas, staffMap);
    expect(result).toHaveLength(1);
    expect(result[0].totalReceived).toBe(100);
    expect(result[0].commissionRate).toBe(50);
  });

  it('splits shared comanda by item staff', () => {
    const comandas = [{
      comandaId: 'c1',
      staffId: 'staff1',
      staffName: 'Marcos',
      total: 150,
      status: 'paid',
      paymentMethod: 'Dinheiro',
      clientName: 'Cliente',
      appointmentId: null,
      items: [
        { staffId: 'staff1', serviceName: 'Corte', quantity: 1, unitPrice: 100 },
        { staffId: 'staff2', serviceName: 'Barba', quantity: 1, unitPrice: 50 },
      ],
    }] as any[];
    const staffMap = {
      staff1: { name: 'Marcos', role: 'barber', commissionRate: 50 },
      staff2: { name: 'Julia', role: 'barber', commissionRate: 40 },
    };
    const result = buildBarberSummaries(comandas, staffMap);
    expect(result).toHaveLength(2);
    const marcos = result.find(b => b.staffId === 'staff1');
    expect(marcos?.totalReceived).toBe(100);
    const julia = result.find(b => b.staffId === 'staff2');
    expect(julia?.totalReceived).toBe(50);
  });

  it('separates open and paid comandas', () => {
    const comandas = [
      {
        comandaId: 'c1', staffId: 'staff1', staffName: 'Marcos', total: 100,
        status: 'paid', paymentMethod: 'Dinheiro', clientName: 'A', appointmentId: null,
        items: [{ staffId: 'staff1', serviceName: 'Corte', quantity: 1, unitPrice: 100 }],
      },
      {
        comandaId: 'c2', staffId: 'staff1', staffName: 'Marcos', total: 80,
        status: 'open', paymentMethod: 'Dinheiro', clientName: 'B', appointmentId: null,
        items: [{ staffId: 'staff1', serviceName: 'Barba', quantity: 1, unitPrice: 80 }],
      },
    ] as any[];
    const staffMap = { staff1: { name: 'Marcos', role: 'barber', commissionRate: 50 } };
    const result = buildBarberSummaries(comandas, staffMap);
    expect(result).toHaveLength(1);
    expect(result[0].totalReceived).toBe(100);
    expect(result[0].openTotal).toBe(80);
  });

  it('handles empty comandas', () => {
    const result = buildBarberSummaries([], {});
    expect(result).toHaveLength(0);
  });
});

describe('buildAttendancesByBarber', () => {
  it('calculates per-barber stats', () => {
    const comandas = [
      { staffId: 's1', total: 100, status: 'paid' },
      { staffId: 's1', total: 80, status: 'paid' },
      { staffId: 's2', total: 200, status: 'paid' },
    ] as any[];
    const result = buildAttendancesByBarber(comandas);
    expect(result).toHaveLength(2);
    const s1 = result.find(a => a.staffId === 's1');
    expect(s1?.comandaCount).toBe(2);
    expect(s1?.totalValue).toBe(180);
  });
});

describe('buildOpenComandasSummary', () => {
  it('returns only open comandas sorted by total desc', () => {
    const comandas = [
      { status: 'paid', total: 200, comandaId: 'c1', staffName: 'A', clientName: 'X' },
      { status: 'open', total: 50, comandaId: 'c2', staffName: 'B', clientName: 'Y' },
      { status: 'open', total: 100, comandaId: 'c3', staffName: 'C', clientName: 'Z' },
    ] as any[];
    const result = buildOpenComandasSummary(comandas);
    expect(result).toHaveLength(2);
    expect(result[0].total).toBe(100);
    expect(result[1].total).toBe(50);
  });

  it('returns empty for no open comandas', () => {
    const comandas = [
      { status: 'paid', total: 200, comandaId: 'c1', staffName: 'A', clientName: 'X' },
    ] as any[];
    expect(buildOpenComandasSummary(comandas)).toHaveLength(0);
  });
});

describe('filterEntries', () => {
  const baseFilters = { operatorId: null, showOnlyOpenComandas: false, onlyClubMembers: false };

  const makeEntry = (overrides: Record<string, unknown> = {}) => ({
    id: 'e1',
    barberStaffId: 'staff1',
    sourceType: 'comanda',
    sourceId: 'cmd1',
    isClubMember: false,
    type: 'entrada',
    value: 100,
    paymentMethod: 'Dinheiro',
    ...overrides,
  }) as any;

  it('returns all entries with no filters', () => {
    const entries = [makeEntry(), makeEntry({ id: 'e2' })];
    expect(filterEntries(entries, baseFilters, new Set())).toHaveLength(2);
  });

  it('filters by operatorId', () => {
    const entries = [
      makeEntry({ barberStaffId: 'staff1' }),
      makeEntry({ id: 'e2', barberStaffId: 'staff2' }),
    ];
    expect(filterEntries(entries, { ...baseFilters, operatorId: 'staff1' }, new Set())).toHaveLength(1);
  });

  it('filters by showOnlyOpenComandas', () => {
    const entries = [
      makeEntry({ sourceType: 'comanda', sourceId: 'cmd1' }),
      makeEntry({ id: 'e2', sourceType: 'comanda', sourceId: 'cmd2' }),
    ];
    const openIds = new Set(['cmd1']);
    expect(filterEntries(entries, { ...baseFilters, showOnlyOpenComandas: true }, openIds)).toHaveLength(1);
  });

  it('keeps non-comanda entries when showOnlyOpenComandas', () => {
    const entries = [
      makeEntry({ sourceType: 'manual', sourceId: null }),
      makeEntry({ id: 'e2', sourceType: 'comanda', sourceId: 'cmd2' }),
    ];
    expect(filterEntries(entries, { ...baseFilters, showOnlyOpenComandas: true }, new Set())).toHaveLength(1);
  });

  it('filters by onlyClubMembers', () => {
    const entries = [
      makeEntry({ isClubMember: true }),
      makeEntry({ id: 'e2', isClubMember: false }),
    ];
    expect(filterEntries(entries, { ...baseFilters, onlyClubMembers: true }, new Set())).toHaveLength(1);
  });

  it('combines multiple filters', () => {
    const entries = [
      makeEntry({ barberStaffId: 'staff1', isClubMember: true }),
      makeEntry({ id: 'e2', barberStaffId: 'staff1', isClubMember: false }),
      makeEntry({ id: 'e3', barberStaffId: 'staff2', isClubMember: true }),
    ];
    const result = filterEntries(entries, {
      ...baseFilters,
      operatorId: 'staff1',
      onlyClubMembers: true,
    }, new Set());
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('e1');
  });
});
