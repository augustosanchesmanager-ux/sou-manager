import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createReverseCommissionHandler } from './reverseCommissionHandler';
import type { ReverseCommissionRepository, ReverseCommissionData, CommissionReversalResult } from './reverseCommissionHandler';
import type { OperationContext } from './financeProvider';

const makeContext = (overrides?: Partial<OperationContext>): OperationContext => ({
  tenantId: 'tenant-1',
  idempotencyKey: 'evt_1_reverse_commission',
  sourceEvent: 'CheckoutReverted',
  eventId: 'evt_1',
  ...overrides,
});

const makeData = (overrides?: Partial<ReverseCommissionData>): ReverseCommissionData => ({
  comandaId: 'com-1',
  reversedAmount: 100,
  originalCommission: 50,
  originalReceivedValue: 100,
  ...overrides,
});

const makeMockRepository = (): ReverseCommissionRepository => ({
  persistReversal: vi.fn().mockResolvedValue(undefined),
});

describe('reverseCommissionHandler', () => {
  let repository: ReverseCommissionRepository;

  beforeEach(() => {
    repository = makeMockRepository();
  });

  it('should calculate proportional reversal for 100% reversal', async () => {
    const handler = createReverseCommissionHandler(repository);
    const data = makeData({
      reversedAmount: 100,
      originalCommission: 50,
      originalReceivedValue: 100,
    });

    const result = await handler.execute(data as unknown as Record<string, unknown>, makeContext());

    expect(result.success).toBe(true);
    expect(repository.persistReversal).toHaveBeenCalledTimes(1);
    const [, reversalResult] = (repository.persistReversal as any).mock.calls[0];
    expect(reversalResult.reversalAmount).toBe(50);
    expect(reversalResult.proportion).toBe(1);
  });

  it('should calculate proportional reversal for 50% reversal', async () => {
    const handler = createReverseCommissionHandler(repository);
    const data = makeData({
      reversedAmount: 50,
      originalCommission: 50,
      originalReceivedValue: 100,
    });

    const result = await handler.execute(data as unknown as Record<string, unknown>, makeContext());

    expect(result.success).toBe(true);
    const [, reversalResult] = (repository.persistReversal as any).mock.calls[0];
    expect(reversalResult.reversalAmount).toBeCloseTo(25, 2);
    expect(reversalResult.proportion).toBeCloseTo(0.5, 2);
  });

  it('should cap reversal at originalCommission when reversedAmount exceeds', async () => {
    const handler = createReverseCommissionHandler(repository);
    const data = makeData({
      reversedAmount: 200,
      originalCommission: 50,
      originalReceivedValue: 100,
    });

    const result = await handler.execute(data as unknown as Record<string, unknown>, makeContext());

    expect(result.success).toBe(true);
    const [, reversalResult] = (repository.persistReversal as any).mock.calls[0];
    expect(reversalResult.reversalAmount).toBe(50);
  });

  it('should return error when comandaId is missing', async () => {
    const handler = createReverseCommissionHandler(repository);
    const data = { reversedAmount: 100, originalCommission: 50, originalReceivedValue: 100 };

    const result = await handler.execute(data as unknown as Record<string, unknown>, makeContext());

    expect(result.success).toBe(false);
    expect(result.error).toContain('comandaId');
  });

  it('should return error when reversedAmount is negative', async () => {
    const handler = createReverseCommissionHandler(repository);
    const data = makeData({ reversedAmount: -10 });

    const result = await handler.execute(data as unknown as Record<string, unknown>, makeContext());

    expect(result.success).toBe(false);
    expect(result.error).toContain('reversedAmount');
  });

  it('should return error when repository fails', async () => {
    repository.persistReversal = vi.fn().mockRejectedValue(new Error('DB connection lost'));
    const handler = createReverseCommissionHandler(repository);

    const result = await handler.execute(makeData() as unknown as Record<string, unknown>, makeContext());

    expect(result.success).toBe(false);
    expect(result.error).toContain('DB connection lost');
  });

  it('should return 0 reversal when originalReceivedValue is 0', async () => {
    const handler = createReverseCommissionHandler(repository);
    const data = makeData({
      reversedAmount: 50,
      originalCommission: 50,
      originalReceivedValue: 0,
    });

    const result = await handler.execute(data as unknown as Record<string, unknown>, makeContext());

    expect(result.success).toBe(true);
    const [, reversalResult] = (repository.persistReversal as any).mock.calls[0];
    expect(reversalResult.reversalAmount).toBe(0);
    expect(reversalResult.proportion).toBe(0);
  });
});
