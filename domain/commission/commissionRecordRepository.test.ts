import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommissionRecordRepository } from './commissionRecordRepository';
import type { DatabaseClient } from '../shared/database-client';
import type { CreateCommissionRecordInput } from './commissionRecordTypes';

const TENANT_ID = 'tenant-1';
const STAFF_ID = 'staff-1';
const COMANDA_ID = 'comanda-1';

const makeInput = (overrides: Partial<CreateCommissionRecordInput> = {}): CreateCommissionRecordInput => ({
  tenant_id: TENANT_ID,
  comanda_id: COMANDA_ID,
  staff_id: STAFF_ID,
  gross_value: 100,
  net_value: 80,
  received_value: 80,
  commission_rate: 0.5,
  commission_value: 40,
  idempotency_key: 'evt-1_staff-1',
  ...overrides,
});

const makeRecord = (overrides: Record<string, unknown> = {}) => ({
  id: 'rec-1',
  tenant_id: TENANT_ID,
  record_type: 'commission',
  comanda_id: COMANDA_ID,
  comanda_item_id: null,
  staff_id: STAFF_ID,
  gross_value: 100,
  discount: 0,
  net_value: 80,
  received_value: 80,
  commission_rate: 0.5,
  commission_value: 40,
  participant_share: 1.0,
  payout_type: 'percentage',
  affects_commission: true,
  original_record_id: null,
  idempotency_key: 'evt-1_staff-1',
  event_id: 'evt-1',
  event_type: 'CheckoutCompleted',
  status: 'active',
  created_at: '2026-08-20T12:00:00Z',
  ...overrides,
});

const createMockDb = () => {
  const chainable: Record<string, unknown> = {};
  const methods = [
    'select', 'insert', 'eq', 'gte', 'lte', 'order', 'limit', 'single',
  ];
  methods.forEach(m => {
    chainable[m] = vi.fn().mockReturnValue(chainable);
  });
  chainable.data = null;
  chainable.error = null;
  // Make chainable thenable so `await query` resolves to { data, error }
  chainable.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
    const result = { data: chainable.data, error: chainable.error };
    if (chainable.error && reject) { reject(chainable.error); }
    else { resolve(result); }
    return Promise.resolve(result);
  };

  const mockFrom = vi.fn().mockReturnValue(chainable);
  const mockRpc = vi.fn().mockResolvedValue({ data: { success: true }, error: null });

  return {
    db: {
      from: mockFrom,
      rpc: mockRpc,
    } as unknown as DatabaseClient,
    chainable: chainable as unknown as {
      single: ReturnType<typeof vi.fn>;
      eq: ReturnType<typeof vi.fn>;
      insert: ReturnType<typeof vi.fn>;
      data: Record<string, unknown>[] | Record<string, unknown> | null;
      error: unknown;
      [key: string]: unknown;
    },
    mockFrom,
    mockRpc,
  };
};

describe('CommissionRecordRepository', () => {
  let mockDb: ReturnType<typeof createMockDb>;
  let repo: CommissionRecordRepository;

  beforeEach(() => {
    mockDb = createMockDb();
    repo = new CommissionRecordRepository(mockDb.db);
  });

  describe('create', () => {
    it('should insert a commission record with correct fields', async () => {
      const expectedRecord = makeRecord();
      mockDb.chainable.single.mockResolvedValue({ data: expectedRecord, error: null });

      const result = await repo.create(makeInput(), TENANT_ID);

      expect(mockDb.mockFrom).toHaveBeenCalledWith('commission_records');
      expect(mockDb.chainable.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: TENANT_ID,
          record_type: 'commission',
          comanda_id: COMANDA_ID,
          staff_id: STAFF_ID,
          commission_value: 40,
          original_record_id: null,
          status: 'active',
        }),
      );
      expect(result.id).toBe('rec-1');
    });

    it('should throw on insert failure', async () => {
      mockDb.chainable.single.mockResolvedValue({
        data: null,
        error: { message: 'unique violation', code: '23505' },
      });

      await expect(repo.create(makeInput(), TENANT_ID)).rejects.toThrow();
    });
  });

  describe('list', () => {
    it('should return all records for a tenant', async () => {
      const records = [makeRecord(), makeRecord({ id: 'rec-2' })];
      mockDb.chainable.data = records;
      mockDb.chainable.error = null;

      const result = await repo.list(TENANT_ID);

      expect(result).toHaveLength(2);
      expect(mockDb.mockFrom).toHaveBeenCalledWith('commission_records');
    });

    it('should filter by comanda_id', async () => {
      mockDb.chainable.data = [];
      mockDb.chainable.error = null;

      await repo.list(TENANT_ID, { comanda_id: COMANDA_ID });

      expect(mockDb.chainable.eq).toHaveBeenCalledWith('comanda_id', COMANDA_ID);
    });

    it('should filter by staff_id', async () => {
      mockDb.chainable.data = [];
      mockDb.chainable.error = null;

      await repo.list(TENANT_ID, { staff_id: STAFF_ID });

      expect(mockDb.chainable.eq).toHaveBeenCalledWith('staff_id', STAFF_ID);
    });

    it('should filter by record_type', async () => {
      mockDb.chainable.data = [];
      mockDb.chainable.error = null;

      await repo.list(TENANT_ID, { record_type: 'reversal' });

      expect(mockDb.chainable.eq).toHaveBeenCalledWith('record_type', 'reversal');
    });
  });

  describe('get', () => {
    it('should return a record by ID', async () => {
      const record = makeRecord();
      mockDb.chainable.single.mockResolvedValue({ data: record, error: null });

      const result = await repo.get('rec-1', TENANT_ID);

      expect(result?.id).toBe('rec-1');
    });

    it('should return null when not found', async () => {
      mockDb.chainable.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      const result = await repo.get('nonexistent', TENANT_ID);

      expect(result).toBeNull();
    });
  });

  describe('existsByStaffComanda', () => {
    it('should return true when record exists', async () => {
      mockDb.chainable.data = [{ id: 'rec-1' }];
      mockDb.chainable.error = null;

      const result = await repo.existsByStaffComanda(STAFF_ID, COMANDA_ID, TENANT_ID);

      expect(result).toBe(true);
    });

    it('should return false when no record exists', async () => {
      mockDb.chainable.data = [];
      mockDb.chainable.error = null;

      const result = await repo.existsByStaffComanda(STAFF_ID, COMANDA_ID, TENANT_ID);

      expect(result).toBe(false);
    });
  });

  describe('calculateDailyNet', () => {
    it('should sum commission_value for a staff on a given day', async () => {
      mockDb.chainable.data = [
        { commission_value: 40 },
        { commission_value: -15 },
        { commission_value: 20 },
      ];
      mockDb.chainable.error = null;

      const result = await repo.calculateDailyNet(STAFF_ID, '2026-08-20', TENANT_ID);

      expect(result).toBe(45);
    });

    it('should return 0 when no records exist', async () => {
      mockDb.chainable.data = [];
      mockDb.chainable.error = null;

      const result = await repo.calculateDailyNet(STAFF_ID, '2026-08-20', TENANT_ID);

      expect(result).toBe(0);
    });
  });

  describe('createReversal', () => {
    it('should call RPC and return success result', async () => {
      mockDb.mockRpc.mockResolvedValue({
        data: {
          success: true,
          idempotent: false,
          reversal_id: 'rev-1',
          commission_value: -40,
        },
        error: null,
      });

      const result = await repo.createReversal({
        tenantId: TENANT_ID,
        originalRecordId: 'rec-1',
        commissionValue: -40,
        idempotencyKey: 'evt-rev-1_staff-1_reversal',
      });

      expect(mockDb.mockRpc).toHaveBeenCalledWith('create_commission_reversal', {
        p_tenant_id: TENANT_ID,
        p_original_record_id: 'rec-1',
        p_commission_value: -40,
        p_idempotency_key: 'evt-rev-1_staff-1_reversal',
        p_event_id: null,
        p_event_type: null,
      });
      expect(result.success).toBe(true);
    });

    it('should return idempotent result when reversal already exists', async () => {
      mockDb.mockRpc.mockResolvedValue({
        data: {
          success: true,
          idempotent: true,
          reversal_id: 'rev-existing',
          message: 'Reversao ja processada',
        },
        error: null,
      });

      const result = await repo.createReversal({
        tenantId: TENANT_ID,
        originalRecordId: 'rec-1',
        commissionValue: -40,
        idempotencyKey: 'evt-rev-1_staff-1_reversal',
      });

      expect(result.success).toBe(true);
      expect(result.idempotent).toBe(true);
    });

    it('should return error when RPC fails', async () => {
      mockDb.mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Reversao excede comissao original' },
      });

      const result = await repo.createReversal({
        tenantId: TENANT_ID,
        originalRecordId: 'rec-1',
        commissionValue: -200,
        idempotencyKey: 'evt-rev-1_staff-1_reversal',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Reversao excede');
    });

    it('should handle RPC exception gracefully', async () => {
      mockDb.mockRpc.mockRejectedValue(new Error('Network error'));

      const result = await repo.createReversal({
        tenantId: TENANT_ID,
        originalRecordId: 'rec-1',
        commissionValue: -40,
        idempotencyKey: 'evt-rev-1_staff-1_reversal',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });
  });
});
