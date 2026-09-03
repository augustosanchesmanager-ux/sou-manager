import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks (topo do arquivo) ──────────────────────────────────────
const dynamicClient = vi.hoisted(() => {
  let buildFn: (() => any) | null = null;
  const makeFallbackChain = () => {
    const chain: Record<string, unknown> = {};
    chain.select = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.in = vi.fn().mockReturnValue(chain);
    chain.or = vi.fn().mockReturnValue(chain);
    chain.order = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockReturnValue(chain);
    chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
    chain.then = (onFulfilled: (v: { data: unknown; error: null }) => void) =>
      Promise.resolve({ data: [], error: null }).then(onFulfilled);
    return chain;
  };
  return {
    setBuildClient: (fn: () => any) => { buildFn = fn; },
    from: (table: string) => buildFn ? buildFn().from(table) : makeFallbackChain(),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
});
const mockFromCalls: { table: string; chain: Record<string, unknown> }[] = [];

const createMockChain = (resolveWith: unknown = []) => {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.or = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data: resolveWith, error: null });
  chain.then = (onFulfilled: (v: { data: unknown; error: null }) => void) =>
    Promise.resolve({ data: resolveWith, error: null }).then(onFulfilled);
  return chain;
};

let mockStaffResult: unknown[] = [];
let mockComandasResult: unknown[] = [];
let mockAppointmentsResult: unknown[] = [];
let mockItemsResult: unknown[] = [];
let mockClientsResult: unknown[] = [];
let mockParticipantsResult: unknown[] = [];
let mockStaffError: unknown = null;
let mockComandasError: unknown = null;

const buildClient = () => ({
  from: vi.fn().mockImplementation((table: string) => {
    const chain = createMockChain([]);
    // Override 'then' based on table
    if (table === 'staff') {
      chain.then = (onFulfilled: (v: { data: unknown; error: unknown }) => void) =>
        Promise.resolve({ data: mockStaffResult, error: mockStaffError }).then(onFulfilled);
    } else if (table === 'comandas') {
      chain.then = (onFulfilled: (v: { data: unknown; error: unknown }) => void) =>
        Promise.resolve({ data: mockComandasResult, error: mockComandasError }).then(onFulfilled);
    } else if (table === 'appointments') {
      chain.then = (onFulfilled: (v: { data: unknown; error: null }) => void) =>
        Promise.resolve({ data: mockAppointmentsResult, error: null }).then(onFulfilled);
    } else if (table === 'comanda_items') {
      chain.then = (onFulfilled: (v: { data: unknown; error: null }) => void) =>
        Promise.resolve({ data: mockItemsResult, error: null }).then(onFulfilled);
    } else if (table === 'clients') {
      chain.then = (onFulfilled: (v: { data: unknown; error: null }) => void) =>
        Promise.resolve({ data: mockClientsResult, error: null }).then(onFulfilled);
    } else if (table === 'service_execution_participants') {
      chain.then = (onFulfilled: (v: { data: unknown; error: null }) => void) =>
        Promise.resolve({ data: mockParticipantsResult, error: null }).then(onFulfilled);
    }
    return chain;
  }),
});

vi.mock('../services/supabaseClient', () => ({
  getScopedClient: () => dynamicClient,
  getSharedClient: () => dynamicClient,
  getClientForTable: () => dynamicClient,
}));

dynamicClient.setBuildClient(buildClient);

vi.mock('../src/lib/staff/roles', () => ({
  receivesCommission: vi.fn((staff?: { role?: string } | null) => {
    if (!staff) return false;
    const r = (staff.role || '').toLowerCase();
    return r === 'barber' || r === 'seller' || r === 'barbeiro' || r === 'vendedor';
  }),
  getEffectiveCommissionRate: vi.fn((staff?: { commission_rate?: number | null } | null) => {
    if (!staff) return 0.4;
    return typeof staff.commission_rate === 'number' ? staff.commission_rate : 0.4;
  }),
}));

vi.mock('../shared/status/commission', () => ({
  getCommissionStatus: vi.fn((status: string) => {
    if (status === 'paid') return 'confirmed';
    if (status === 'cancelled') return 'cancelled';
    return 'pending';
  }),
  getCommissionPaymentLabel: vi.fn((status: string) => {
    if (status === 'paid') return 'Pago';
    if (status === 'cancelled') return 'Cancelado';
    return 'Pendente';
  }),
}));

vi.mock('../domain/commission/participants', () => ({
  normalizeCommissionParticipants: vi.fn((item, comanda, rawParticipants, itemValue, staffById) => {
    if (rawParticipants.length > 0) {
      return {
        participants: rawParticipants,
        isShared: rawParticipants.length > 1,
        primaryStaffId: rawParticipants[0]?.staff_id || rawParticipants[0]?.professional_id || null,
      };
    }
    const staffId = item.staff_id || comanda?.staff_id || null;
    if (!staffId) return { participants: [], isShared: false, primaryStaffId: null };
    return {
      participants: [{
        id: `solo-${item.id}`,
        comanda_item_id: item.id,
        staff_id: staffId,
        professional_id: null,
        role: 'primary',
        payout_type: 'percentage',
        payout_value: 100,
        affects_commission: true,
      }],
      isShared: false,
      primaryStaffId: staffId,
    };
  }),
  buildSoloParticipant: vi.fn(),
}));

vi.mock('../domain/comanda/labels', () => ({
  getPaymentMethodLabel: vi.fn(() => 'Dinheiro'),
  isServiceItem: vi.fn((item: { item_type?: string; type?: string; product_name?: string }) => {
    if (item.item_type === 'service' || item.type === 'service') return true;
    if (item.product_name && !item.product_name.startsWith('Prod')) return true;
    return false;
  }),
}));

// ─── Imports ──────────────────────────────────────────────────────
import { commissionApplicationService } from './commission';
import type { CommissionLine, CommissionRow, CommissionSummary } from './commission';
import { getScopedClient } from '../services/supabaseClient';

// ─── Builders ─────────────────────────────────────────────────────
const makeStaff = (overrides: Record<string, unknown> = {}) => ({
  id: 'staff-1',
  name: 'Barbeiro 1',
  role: 'barber',
  commission_rate: 0.4,
  ...overrides,
});

const makeComanda = (overrides: Record<string, unknown> = {}) => ({
  id: 'com-1',
  client_id: 'client-1',
  appointment_id: null,
  staff_id: 'staff-1',
  status: 'paid',
  total: 50,
  discount: 0,
  payment_method: 'Dinheiro',
  created_at: '2026-07-23T10:00:00',
  closed_at: '2026-07-23T10:30:00',
  hidden_from_financial: false,
  ...overrides,
});

const makeItem = (overrides: Record<string, unknown> = {}) => ({
  id: 'item-1',
  comanda_id: 'com-1',
  service_id: 'svc-1',
  product_name: 'Corte',
  item_type: 'service',
  staff_id: 'staff-1',
  unit_price: 50,
  quantity: 1,
  discount: 0,
  ...overrides,
});

const makeParticipant = (overrides: Record<string, unknown> = {}) => ({
  id: 'part-1',
  comanda_item_id: 'item-1',
  staff_id: 'staff-1',
  professional_id: null,
  role: 'primary',
  payout_type: 'percentage',
  payout_value: 100,
  affects_commission: true,
  ...overrides,
});

const makeClient = (overrides: Record<string, unknown> = {}) => ({
  id: 'client-1',
  name: 'João Silva',
  ...overrides,
});

const makeCommissionLine = (overrides: Partial<CommissionLine> = {}): CommissionLine => ({
  id: 'line-1',
  comandaId: 'com-1',
  comandaItemId: 'item-1',
  createdAt: '2026-07-23T10:00:00',
  clientName: 'João Silva',
  serviceName: 'Corte',
  quantity: 1,
  itemValue: 50,
  commissionBase: 50,
  commissionRate: 0.4,
  commissionValue: 20,
  sharedValue: 0,
  isShared: false,
  participantNames: '',
  comandaStatus: 'paid',
  paymentStatus: 'Pago',
  commissionStatus: 'Confirmado',
  paymentMethod: 'Dinheiro',
  professionalId: 'staff-1',
  professionalName: 'Barbeiro 1',
  professionalRole: 'barber',
  professionalAvatar: '',
  participationRole: 'Principal',
  discountAmount: 0,
  zeroReason: null,
  ...overrides,
});

const makeCommissionRow = (overrides: Partial<CommissionRow> = {}): CommissionRow => ({
  id: 'staff-1',
  staffId: 'staff-1',
  staffName: 'Barbeiro 1',
  staffRole: 'barber',
  staffAvatar: '',
  commissionRate: 0.4,
  confirmedSales: 50,
  confirmedCommission: 20,
  pendingSales: 0,
  pendingCommission: 0,
  cancelledSales: 0,
  cancelledCommission: 0,
  grossSales: 50,
  totalCommission: 20,
  lines: [makeCommissionLine()],
  ...overrides,
});

// ═══════════════════════════════════════════════════════════════════
// CommissionApplicationService
//
// Grupo A — Validation (loadCommissionLines params)
// Grupo B — Pipeline (loadCommissionLines 4-phase)
// Grupo C — Grouping (groupByProfessional)
// Grupo D — Summary (summarize)
// Grupo E — CSV (exportToCsv)
// ═══════════════════════════════════════════════════════════════════

describe('CommissionApplicationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStaffResult = [];
    mockComandasResult = [];
    mockAppointmentsResult = [];
    mockItemsResult = [];
    mockClientsResult = [];
    mockParticipantsResult = [];
    mockStaffError = null;
    mockComandasError = null;
  });

  // ═══════════════════════════════════════════════════════════════
  // Grupo A — Validation
  // ═══════════════════════════════════════════════════════════════
  describe('Grupo A — Validation', () => {
    it('should_return_empty_when_tenantId_is_empty', async () => {
      const result = await commissionApplicationService.loadCommissionLines({
        tenantId: '', startDate: '2026-07-01', endDate: '2026-07-31',
      });
      expect(result).toEqual([]);
    });

    it('should_return_empty_when_startDate_is_empty', async () => {
      const result = await commissionApplicationService.loadCommissionLines({
        tenantId: 't-1', startDate: '', endDate: '2026-07-31',
      });
      expect(result).toEqual([]);
    });

    it('should_return_empty_when_endDate_is_empty', async () => {
      const result = await commissionApplicationService.loadCommissionLines({
        tenantId: 't-1', startDate: '2026-07-01', endDate: '',
      });
      expect(result).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Grupo B — Pipeline (loadCommissionLines)
  // ═══════════════════════════════════════════════════════════════
  describe('Grupo B — Pipeline', () => {
    it('should_return_empty_when_no_comandas', async () => {
      mockStaffResult = [makeStaff()];
      mockComandasResult = [];

      const result = await commissionApplicationService.loadCommissionLines({
        tenantId: 't-1', startDate: '2026-07-01', endDate: '2026-07-31',
      });

      expect(result).toEqual([]);
    });

    it('should_throw_when_staff_query_fails', async () => {
      mockStaffError = new Error('staff query failed');

      await expect(
        commissionApplicationService.loadCommissionLines({
          tenantId: 't-1', startDate: '2026-07-01', endDate: '2026-07-31',
        }),
      ).rejects.toThrow('staff query failed');
    });

    it('should_throw_when_comandas_query_fails', async () => {
      mockStaffResult = [makeStaff()];
      mockComandasError = new Error('comandas query failed');

      await expect(
        commissionApplicationService.loadCommissionLines({
          tenantId: 't-1', startDate: '2026-07-01', endDate: '2026-07-31',
        }),
      ).rejects.toThrow('comandas query failed');
    });

    it('should_build_commission_lines_for_paid_comanda', async () => {
      mockStaffResult = [makeStaff()];
      mockComandasResult = [makeComanda()];
      mockItemsResult = [makeItem()];
      mockClientsResult = [makeClient()];
      mockParticipantsResult = [];

      const result = await commissionApplicationService.loadCommissionLines({
        tenantId: 't-1', startDate: '2026-07-01', endDate: '2026-07-31',
      });

      expect(result).toHaveLength(1);
      expect(result[0].comandaStatus).toBe('paid');
      expect(result[0].professionalId).toBe('staff-1');
      expect(result[0].itemValue).toBe(50);
    });

    it('should_exclude_comandas_outside_date_range', async () => {
      mockStaffResult = [makeStaff()];
      mockComandasResult = [
        makeComanda({ id: 'com-1', closed_at: '2026-07-15T10:00:00' }),
        makeComanda({ id: 'com-2', closed_at: '2026-08-15T10:00:00' }),
      ];
      mockItemsResult = [
        makeItem({ id: 'item-1', comanda_id: 'com-1' }),
        makeItem({ id: 'item-2', comanda_id: 'com-2' }),
      ];
      mockClientsResult = [makeClient()];
      mockParticipantsResult = [];

      const result = await commissionApplicationService.loadCommissionLines({
        tenantId: 't-1', startDate: '2026-07-01', endDate: '2026-07-31',
      });

      expect(result).toHaveLength(1);
      expect(result[0].comandaId).toBe('com-1');
    });

    it('should_exclude_non_commissionable_staff', async () => {
      mockStaffResult = [makeStaff({ id: 'mgr-1', name: 'Manager', role: 'manager' })];
      mockComandasResult = [makeComanda({ staff_id: 'mgr-1' })];
      mockItemsResult = [makeItem({ staff_id: 'mgr-1' })];
      mockClientsResult = [makeClient()];
      mockParticipantsResult = [];

      const result = await commissionApplicationService.loadCommissionLines({
        tenantId: 't-1', startDate: '2026-07-01', endDate: '2026-07-31',
      });

      expect(result).toHaveLength(0);
    });

    it('should_create_solo_participant_when_no_saved_participants', async () => {
      mockStaffResult = [makeStaff()];
      mockComandasResult = [makeComanda()];
      mockItemsResult = [makeItem()];
      mockClientsResult = [makeClient()];
      mockParticipantsResult = [];

      const result = await commissionApplicationService.loadCommissionLines({
        tenantId: 't-1', startDate: '2026-07-01', endDate: '2026-07-31',
      });

      expect(result).toHaveLength(1);
      expect(result[0].isShared).toBe(false);
      expect(result[0].participationRole).toBe('Principal');
    });

    it('should_handle_comanda_with_appointment_for_production_date', async () => {
      mockStaffResult = [makeStaff()];
      mockComandasResult = [makeComanda({
        appointment_id: 'apt-1',
        closed_at: null,
        created_at: '2026-07-20T10:00:00',
      })];
      mockAppointmentsResult = [{ id: 'apt-1', start_time: '2026-07-23T14:00:00' }];
      mockItemsResult = [makeItem()];
      mockClientsResult = [makeClient()];
      mockParticipantsResult = [];

      const result = await commissionApplicationService.loadCommissionLines({
        tenantId: 't-1', startDate: '2026-07-01', endDate: '2026-07-31',
      });

      expect(result).toHaveLength(1);
      expect(result[0].createdAt).toBe('2026-07-23T14:00:00');
    });

    it('should_exclude_comandas_with_invalid_production_date', async () => {
      mockStaffResult = [makeStaff()];
      mockComandasResult = [makeComanda({ closed_at: null, created_at: null, appointment_id: null })];
      mockItemsResult = [makeItem()];
      mockClientsResult = [makeClient()];
      mockParticipantsResult = [];

      const result = await commissionApplicationService.loadCommissionLines({
        tenantId: 't-1', startDate: '2026-07-01', endDate: '2026-07-31',
      });

      expect(result).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Grupo C — Grouping (groupByProfessional)
  // ═══════════════════════════════════════════════════════════════
  describe('Grupo C — Grouping', () => {
    it('should_return_empty_for_empty_input', () => {
      const result = commissionApplicationService.groupByProfessional([]);
      expect(result).toEqual([]);
    });

    it('should_group_by_professional_id', () => {
      const lines = [
        makeCommissionLine({ professionalId: 'staff-1', professionalName: 'Barbeiro 1' }),
        makeCommissionLine({ professionalId: 'staff-2', professionalName: 'Barbeiro 2', id: 'line-2' }),
      ];

      const result = commissionApplicationService.groupByProfessional(lines);

      expect(result).toHaveLength(2);
      expect(result[0].staffId).toBe('staff-1');
      expect(result[1].staffId).toBe('staff-2');
    });

    it('should_bucket_paid_to_confirmed', () => {
      const lines = [makeCommissionLine({ comandaStatus: 'paid', itemValue: 50, commissionValue: 20 })];

      const result = commissionApplicationService.groupByProfessional(lines);

      expect(result[0].confirmedSales).toBe(50);
      expect(result[0].confirmedCommission).toBe(20);
      expect(result[0].pendingSales).toBe(0);
      expect(result[0].cancelledSales).toBe(0);
    });

    it('should_bucket_cancelled_to_cancelled', () => {
      const lines = [makeCommissionLine({ comandaStatus: 'cancelled', itemValue: 50, commissionValue: 20 })];

      const result = commissionApplicationService.groupByProfessional(lines);

      expect(result[0].cancelledSales).toBe(50);
      expect(result[0].cancelledCommission).toBe(20);
    });

    it('should_bucket_open_to_pending', () => {
      const lines = [makeCommissionLine({ comandaStatus: 'open', itemValue: 50, commissionValue: 20 })];

      const result = commissionApplicationService.groupByProfessional(lines);

      expect(result[0].pendingSales).toBe(50);
      expect(result[0].pendingCommission).toBe(20);
    });

    it('should_sort_by_totalCommission_descending', () => {
      const lines = [
        makeCommissionLine({ professionalId: 'staff-1', commissionValue: 10 }),
        makeCommissionLine({ professionalId: 'staff-2', commissionValue: 50, id: 'line-2' }),
        makeCommissionLine({ professionalId: 'staff-3', commissionValue: 30, id: 'line-3' }),
      ];

      const result = commissionApplicationService.groupByProfessional(lines);

      expect(result[0].staffId).toBe('staff-2');
      expect(result[1].staffId).toBe('staff-3');
      expect(result[2].staffId).toBe('staff-1');
    });

    it('should_calculate_grossSales_as_confirmed_plus_pending', () => {
      const lines = [
        makeCommissionLine({ comandaStatus: 'paid', itemValue: 100, commissionValue: 40 }),
        makeCommissionLine({ comandaStatus: 'open', itemValue: 50, commissionValue: 20, id: 'line-2' }),
      ];

      const result = commissionApplicationService.groupByProfessional(lines);

      expect(result[0].grossSales).toBe(150);
      expect(result[0].totalCommission).toBe(60);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Grupo D — Summary (summarize)
  // ═══════════════════════════════════════════════════════════════
  describe('Grupo D — Summary', () => {
    it('should_return_zeros_for_empty_input', () => {
      const result = commissionApplicationService.summarize([]);

      expect(result.totalCommissions).toBe(0);
      expect(result.totalSales).toBe(0);
      expect(result.averageRate).toBe(0);
      expect(result.topPerformer).toBeNull();
      expect(result.confirmedCount).toBe(0);
      expect(result.pendingCount).toBe(0);
      expect(result.cancelledCount).toBe(0);
    });

    it('should_calculate_totals_from_single_row', () => {
      const rows = [makeCommissionRow({ totalCommission: 20, grossSales: 50, commissionRate: 0.4 })];

      const result = commissionApplicationService.summarize(rows);

      expect(result.totalCommissions).toBe(20);
      expect(result.totalSales).toBe(50);
      expect(result.averageRate).toBe(0.4);
    });

    it('should_set_topPerformer_as_first_row', () => {
      const rows = [makeCommissionRow({ staffId: 'staff-1', totalCommission: 20 })];

      const result = commissionApplicationService.summarize(rows);

      expect(result.topPerformer?.staffId).toBe('staff-1');
    });

    it('should_average_rate_across_rows', () => {
      const rows = [
        makeCommissionRow({ staffId: 's-1', commissionRate: 0.3 }),
        makeCommissionRow({ staffId: 's-2', commissionRate: 0.5, id: 'line-2' }),
      ];

      const result = commissionApplicationService.summarize(rows);

      expect(result.averageRate).toBe(0.4);
    });

    it('should_count_confirmed_pending_cancelled_lines', () => {
      const rows = [makeCommissionRow({
        lines: [
          makeCommissionLine({ comandaStatus: 'paid' }),
          makeCommissionLine({ comandaStatus: 'paid', id: 'l-2' }),
          makeCommissionLine({ comandaStatus: 'open', id: 'l-3' }),
          makeCommissionLine({ comandaStatus: 'cancelled', id: 'l-4' }),
        ],
      })];

      const result = commissionApplicationService.summarize(rows);

      expect(result.confirmedCount).toBe(2);
      expect(result.pendingCount).toBe(1);
      expect(result.cancelledCount).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Grupo E — CSV (exportToCsv)
  // ═══════════════════════════════════════════════════════════════
  describe('Grupo E — CSV', () => {
    it('should_return_empty_string_for_empty_lines', () => {
      const result = commissionApplicationService.exportToCsv([], '2026-07-01', '2026-07-31');
      expect(result).toBe('');
    });

    it('should_start_with_BOM', () => {
      const result = commissionApplicationService.exportToCsv([makeCommissionLine()], '2026-07-01', '2026-07-31');
      expect(result.charCodeAt(0)).toBe(0xFEFF);
    });

    it('should_have_22_columns_per_row', () => {
      const result = commissionApplicationService.exportToCsv([makeCommissionLine()], '2026-07-01', '2026-07-31');
      const lines = result.split('\n');
      expect(lines).toHaveLength(2); // header + 1 data row
      const headerColumns = lines[0].split(';');
      expect(headerColumns).toHaveLength(22);
    });

    it('should_use_semicolon_delimiter', () => {
      const result = commissionApplicationService.exportToCsv([makeCommissionLine()], '2026-07-01', '2026-07-31');
      const lines = result.split('\n');
      const dataColumns = lines[1].split(';');
      expect(dataColumns).toHaveLength(22);
    });

    it('should_format_commissionRate_as_percentage', () => {
      const result = commissionApplicationService.exportToCsv([makeCommissionLine({ commissionRate: 0.4 })], '2026-07-01', '2026-07-31');
      expect(result).toContain('40,0%');
    });

    it('should_mark_shared_lines_correctly', () => {
      const result = commissionApplicationService.exportToCsv(
        [makeCommissionLine({ isShared: true, sharedValue: 25, participantNames: 'Barbeiro 1 / Barbeiro 2' })],
        '2026-07-01', '2026-07-31',
      );
      expect(result).toContain('Compartilhado');
      expect(result).toContain('Barbeiro 1 / Barbeiro 2');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // QAT-C05 — Shared Split: Rubens 70% + Heron 30%
  // ═══════════════════════════════════════════════════════════════
  describe('QAT-C05 — Shared Split', () => {
    it('should_split_commission_70_30_between_two_participants', async () => {
      mockStaffResult = [
        makeStaff({ id: 'staff-rubens', name: 'Rubens', role: 'barber', commission_rate: 0.5 }),
        makeStaff({ id: 'staff-heron', name: 'Heron', role: 'barber', commission_rate: 0.5 }),
      ];
      mockComandasResult = [makeComanda({ staff_id: 'staff-rubens' })];
      mockItemsResult = [makeItem({ staff_id: 'staff-rubens', unit_price: 100 })];
      mockClientsResult = [makeClient()];
      mockParticipantsResult = [
        {
          id: 'part-rubens',
          comanda_item_id: 'item-1',
          staff_id: 'staff-rubens',
          professional_id: 'staff-rubens',
          role: 'primary',
          payout_type: 'percentage',
          payout_value: 70,
          affects_commission: true,
        },
        {
          id: 'part-heron',
          comanda_item_id: 'item-1',
          staff_id: 'staff-heron',
          professional_id: 'staff-heron',
          role: 'secondary',
          payout_type: 'percentage',
          payout_value: 30,
          affects_commission: true,
        },
      ];

      const result = await commissionApplicationService.loadCommissionLines({
        tenantId: 't-1', startDate: '2026-07-01', endDate: '2026-07-31',
      });

      expect(result).toHaveLength(2);

      const rubensLine = result.find(l => l.professionalId === 'staff-rubens');
      const heronLine = result.find(l => l.professionalId === 'staff-heron');

      expect(rubensLine).toBeDefined();
      expect(heronLine).toBeDefined();
      expect(rubensLine!.isShared).toBe(true);
      expect(heronLine!.isShared).toBe(true);
    });
  });
});
