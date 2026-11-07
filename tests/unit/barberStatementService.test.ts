import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchBarberStatementData } from '../../src/modules/commissions/barberStatementService';
import { supabase } from '../../services/supabaseClient';

vi.mock('../../services/supabaseClient', () => {
  return {
    supabase: {
      from: vi.fn(),
    },
    getScopedClient: vi.fn(() => ({
      from: vi.fn(),
    })),
  };
});

describe('barberStatementService: Extrato de Comissões & Produtividade', () => {
  const tenantId = 'tenant-test-123';
  const staffId = 'staff-heron-456';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should_reconcile_appointments_and_comandas_accurately', async () => {
    const mockAppointments = [
      {
        id: 'appt-1',
        tenant_id: tenantId,
        staff_id: staffId,
        client_name: 'Murilo',
        service_name: 'Corte do Chefe',
        price: '45.00',
        status: 'confirmed',
        start_time: '2026-11-06T20:00:00-03:00',
        created_at: '2026-11-06T18:00:00-03:00',
      },
    ];

    const mockComandas = [
      {
        id: 'cmd-1',
        client_id: 'client-1',
        staff_id: staffId,
        appointment_id: 'appt-1',
        status: 'open',
        total: 45,
        created_at: '2026-11-06T18:00:00-03:00',
        clients: { name: 'Murilo' },
      },
    ];

    const mockComandaItems = [
      {
        id: 'item-1',
        comanda_id: 'cmd-1',
        service_id: 'srv-1',
        product_name: 'Corte do Chefe',
        unit_price: 45,
        quantity: 1,
        staff_id: staffId,
        services: { name: 'Corte do Chefe' },
      },
    ];

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'appointments') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                gte: () => ({
                  lte: () => ({
                    not: () => ({
                      order: () => Promise.resolve({ data: mockAppointments, error: null }),
                    }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'comandas') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                gte: () => ({
                  lte: () => ({
                    not: () => ({
                      order: () => Promise.resolve({ data: mockComandas, error: null }),
                    }),
                  }),
                }),
              }),
              in: () => ({
                not: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'comanda_items') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                gte: () => ({
                  lte: () => Promise.resolve({ data: mockComandaItems, error: null }),
                }),
              }),
            }),
            in: () => Promise.resolve({ data: mockComandaItems, error: null }),
          }),
        };
      }
      if (table === 'service_execution_participants') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        };
      }
      if (table === 'commission_records') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                in: () => ({
                  eq: () => ({
                    eq: () => Promise.resolve({ data: [], error: null }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      return {
        select: () => Promise.resolve({ data: [], error: null }),
      };
    });

    const items = await fetchBarberStatementData({
      tenantId,
      staffId,
      startDate: '2026-11-06',
      endDate: '2026-11-06',
      commissionPercentage: 50,
    });

    expect(items.length).toBe(1);
    expect(items[0].clientName).toBe('Murilo');
    expect(items[0].grossValue).toBe(45);
    expect(items[0].commissionValue).toBe(22.5);
    expect(items[0].commissionRate).toBe(50);
    expect(items[0].comandaStatus).toBe('open');
    expect(items[0].isPaid).toBe(false);
  });

  it('should_include_appointments_without_comandas_as_projected_items', async () => {
    const mockAppointments = [
      {
        id: 'appt-standalone',
        tenant_id: tenantId,
        staff_id: staffId,
        client_name: 'Cliente Avulso',
        service_name: 'Barba Terapia',
        price: '60.00',
        status: 'confirmed',
        start_time: '2026-11-06T15:00:00-03:00',
        created_at: '2026-11-06T10:00:00-03:00',
      },
    ];

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'appointments') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                gte: () => ({
                  lte: () => ({
                    not: () => ({
                      order: () => Promise.resolve({ data: mockAppointments, error: null }),
                    }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'comandas') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                gte: () => ({
                  lte: () => ({
                    not: () => ({
                      order: () => Promise.resolve({ data: [], error: null }),
                    }),
                  }),
                }),
              }),
              in: () => ({
                not: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'comanda_items') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                gte: () => ({
                  lte: () => Promise.resolve({ data: [], error: null }),
                }),
              }),
            }),
            in: () => Promise.resolve({ data: [], error: null }),
          }),
        };
      }
      if (table === 'service_execution_participants') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        };
      }
      if (table === 'commission_records') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                in: () => ({
                  eq: () => ({
                    eq: () => Promise.resolve({ data: [], error: null }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      return {
        select: () => Promise.resolve({ data: [], error: null }),
      };
    });

    const items = await fetchBarberStatementData({
      tenantId,
      staffId,
      startDate: '2026-11-06',
      endDate: '2026-11-06',
      commissionPercentage: 50,
    });

    expect(items.length).toBe(1);
    expect(items[0].id).toBe('appt-appt-standalone');
    expect(items[0].itemName).toBe('Barba Terapia');
    expect(items[0].grossValue).toBe(60);
    expect(items[0].commissionValue).toBe(30);
    expect(items[0].isPaid).toBe(false);
  });
});
