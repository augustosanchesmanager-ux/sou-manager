import { beforeEach, describe, expect, it, vi } from 'vitest';

const tables = vi.hoisted(() => ({
  appointments: [] as unknown[],
  comandas: [] as unknown[],
  staff: [] as unknown[],
  transactions: [] as unknown[],
  daily_summary_settings: [] as unknown[],
  summary_dispatch_logs: [] as unknown[],
}));

vi.mock('./supabaseClient', () => {
  const makeChain = (table: keyof typeof tables) => {
    const chain: Record<string, unknown> = {};
    const proxy: unknown = new Proxy(chain, {
      get: (_target, prop) => {
        if (prop === 'then') {
          return (resolve: (value: unknown) => void) =>
            resolve({ data: tables[table] ?? [], error: null });
        }
        return () => proxy;
      },
    });
    return proxy;
  };

  return {
    supabase: {
      from: (table: string) => makeChain(table as keyof typeof tables),
    },
  };
});

import { dailySummaryService } from './dailySummaryService';

describe('dailySummaryService (Resumo Diário — filtro operacional e comissão)', () => {
  const tenantId = 'tenant-sanchez';

  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear(),
    });
    tables.appointments = [];
    tables.comandas = [];
    tables.transactions = [];
    tables.daily_summary_settings = [];
    tables.summary_dispatch_logs = [];
    tables.staff = [
      { id: 'barber-1', name: 'Rubens Sanchez', role: 'barber', commission_rate: null },
      { id: 'barber-2', name: 'Diego Lima', role: 'barber', commission_rate: 40 },
      { id: 'manager-1', name: 'Marcos Gerente', role: 'manager', commission_rate: 10 },
      { id: 'admin-1', name: 'Augusto Sanchez', role: 'admin', commission_rate: 0 },
      { id: 'reception-1', name: 'Bianca Recepcao', role: 'receptionist', commission_rate: 0 },
    ];
  });

  it('should_exclude_admin_and_receptionist_when_building_staff_metrics', async () => {
    // Arrange: um agendamento para cada perfil da equipe
    tables.appointments = [
      { id: 'a1', status: 'confirmed', price: 80, staff_id: 'barber-1', start_time: '2026-11-13T13:00:00.000-03:00' },
      { id: 'a2', status: 'confirmed', price: 60, staff_id: 'admin-1', start_time: '2026-11-13T14:00:00.000-03:00' },
      { id: 'a3', status: 'confirmed', price: 50, staff_id: 'reception-1', start_time: '2026-11-13T15:00:00.000-03:00' },
    ];

    // Act
    const summary = await dailySummaryService.getDailySummary(tenantId, '2026-11-13', 'Sanchez Barber');

    // Assert: só barbeiro e gerente operacional aparecem na agenda/comissão
    const occupancyNames = summary.morning.staffOccupancy.map((st) => st.name);
    const closingNames = summary.evening.staffClosing.map((st) => st.name);

    expect(occupancyNames).toContain('Rubens Sanchez');
    expect(occupancyNames).toContain('Marcos Gerente');
    expect(occupancyNames).not.toContain('Augusto Sanchez');
    expect(occupancyNames).not.toContain('Bianca Recepcao');
    expect(closingNames).toEqual(occupancyNames);
  });

  it('should_display_zero_percent_when_barber_has_no_commission_rate', async () => {
    // Arrange: barbeiro sem commission_rate cadastrado
    tables.appointments = [
      { id: 'a1', status: 'confirmed', price: 80, staff_id: 'barber-1', start_time: '2026-11-13T13:00:00.000-03:00' },
    ];
    tables.comandas = [
      { id: 'c1', status: 'paid', total: 80, staff_id: 'barber-1', created_at: '2026-11-13T13:30:00.000-03:00' },
    ];

    // Act
    const summary = await dailySummaryService.getDailySummary(tenantId, '2026-11-13', 'Sanchez Barber');

    // Assert: regra de negócio decidida pelo PO — ausência de taxa exibe 0%, nunca 50%
    const barber = summary.morning.staffOccupancy.find((st) => st.staffId === 'barber-1');
    const barberClosing = summary.evening.staffClosing.find((st) => st.staffId === 'barber-1');

    expect(barber?.roleBadge).toBe('Comissão 0%');
    expect(barberClosing?.roleDescription).toBe('Comissão 0%');
    expect(barberClosing?.commissionAmount).toBe(0);
  });

  it('should_resolve_staff_name_from_full_list_when_comanda_belongs_to_staff_off_schedule', async () => {
    // Arrange: comanda aberta lançada por perfil que não aparece na agenda
    tables.comandas = [
      {
        id: 'c-open-1',
        status: 'open',
        total: 45,
        staff_id: 'admin-1',
        created_at: '2026-11-13T16:00:00.000-03:00',
        clients: { name: 'Cliente Balcao' },
      },
      {
        id: 'c-open-2',
        status: 'open',
        total: 30,
        staff_id: 'unknown-staff',
        created_at: '2026-11-13T17:00:00.000-03:00',
        clients: null,
      },
    ];

    // Act
    const summary = await dailySummaryService.getDailySummary(tenantId, '2026-11-13', 'Sanchez Barber');

    // Assert: nome vem da lista completa (não é perdido) e há fallback para id desconhecido
    const [adminComanda, unknownComanda] = summary.evening.openComandas;

    expect(adminComanda.staffName).toBe('Augusto Sanchez');
    expect(adminComanda.clientName).toBe('Cliente Balcao');
    expect(unknownComanda.staffName).toBe('Barbeiro da Casa');
  });

  it('should_count_cancelled_appointments_and_cash_payments', async () => {
    tables.appointments = [
      { id: 'a1', status: 'confirmed', price: 80, staff_id: 'barber-1', start_time: '2026-11-13T10:00:00.000-03:00' },
      { id: 'a2', status: 'cancelled', price: 60, staff_id: 'barber-2', start_time: '2026-11-13T11:00:00.000-03:00' },
    ];
    tables.comandas = [
      { id: 'c1', status: 'paid', total: 100, payment_method: 'cash', staff_id: 'barber-1', created_at: '2026-11-13T11:30:00.000-03:00' },
      { id: 'c2', status: 'paid', total: 50, payment_method: 'pix', staff_id: 'barber-2', created_at: '2026-11-13T12:30:00.000-03:00' },
    ];

    const summary = await dailySummaryService.getDailySummary(tenantId, '2026-11-13', 'Barbearia Teste');

    expect(summary.morning.scheduledCount).toBe(1);
    expect(summary.evening.cancelledCount).toBe(1);
    expect(summary.evening.realizedRevenue).toBe(150);
    expect(summary.evening.paymentBreakdownLabel).toContain('Dinheiro R$ 100');
    expect(summary.evening.paymentBreakdownLabel).toContain('Pix R$ 50');
  });

  it('should_use_real_alerts_and_cancelled_count_in_whatsapp_messages', async () => {
    tables.appointments = [
      { id: 'a1', status: 'cancelled', price: 50, staff_id: 'barber-1', start_time: '2026-11-13T10:00:00.000-03:00' },
      { id: 'a2', status: 'cancelled', price: 50, staff_id: 'barber-2', start_time: '2026-11-13T11:00:00.000-03:00' },
    ];
    tables.transactions = [
      { id: 't1', description: 'Aluguel', amount: 1200, date: '2026-11-13', status: 'pending', category: 'Fixo', type: 'expense' },
    ];

    const summary = await dailySummaryService.getDailySummary(tenantId, '2026-11-13', 'Barbearia Teste');
    const morningMsg = dailySummaryService.formatWhatsAppMorningMessage(summary);
    const eveningMsg = dailySummaryService.formatWhatsAppEveningMessage(summary);

    expect(morningMsg).toContain('Aluguel: R$ 1200.00');
    expect(morningMsg).not.toContain('Felipe A.');
    expect(eveningMsg).toContain('2 cancelado(s)');
  });

  it('should_detect_duplicate_dispatch_in_recordDispatch', async () => {
    const first = await dailySummaryService.recordDispatch(tenantId, '2026-11-13', 'morning', 'WHATSAPP');
    const second = await dailySummaryService.recordDispatch(tenantId, '2026-11-13', 'morning', 'WHATSAPP');

    expect(first.wasDuplicate).toBe(false);
    expect(first.item.status).toBe('SENT');
    expect(second.wasDuplicate).toBe(true);
    expect(second.item.status).toBe('SKIPPED_DUPLICATE');
  });
});
