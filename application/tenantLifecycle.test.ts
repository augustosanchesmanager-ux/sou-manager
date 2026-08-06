import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks (topo do arquivo) ──────────────────────────────────────
const mockEventBus = vi.hoisted(() => {
  const publish = vi.fn();
  return { publish };
});

vi.mock('../domain/events/app-bus', () => ({
  appEventBus: { publish: mockEventBus.publish },
}));

const mockRpcClient = vi.hoisted(() => {
  const rpcSingle = vi.fn();
  const rpc = vi.fn().mockReturnValue({ single: rpcSingle });
  return { rpc, rpcSingle };
});

// ─── Imports (depois dos mocks) ──────────────────────────────────
import { TenantLifecycleServiceImpl } from './tenantLifecycle';
import type { SubscriptionStatus, TenantPlan } from './tenantLifecycle';

const service = new TenantLifecycleServiceImpl(() => mockRpcClient as any);

interface FakeRow {
  id: string;
  tenant_id: string;
  plan: TenantPlan;
  status: SubscriptionStatus;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: string | null;
  canceled_at: string | null;
  created_at: string | null;
}

const fakeTrialingRow = (overrides: Partial<FakeRow> = {}): FakeRow => ({
  id: 'sub-1',
  tenant_id: 'tenant-1',
  plan: 'free',
  status: 'trialing',
  trial_started_at: '2026-08-06T10:00:00.000Z',
  trial_ends_at: '2026-08-20T10:00:00.000Z',
  current_period_start: '2026-08-06T10:00:00.000Z',
  current_period_end: '2026-08-20T10:00:00.000Z',
  cancel_at_period_end: null,
  canceled_at: null,
  created_at: '2026-08-06T10:00:00.000Z',
  ...overrides,
});

describe('TenantLifecycleService.startTrial', () => {
  beforeEach(() => {
    mockRpcClient.rpcSingle.mockReset();
    mockRpcClient.rpc.mockReset();
    mockRpcClient.rpc.mockReturnValue({ single: mockRpcClient.rpcSingle });
    mockEventBus.publish.mockReset();
    mockRpcClient.rpcSingle.mockResolvedValue({ data: fakeTrialingRow(), error: null });
  });

  describe('Validação (regra de negócio)', () => {
    it('rejeita tenantId vazio', async () => {
      await expect(service.startTrial('')).rejects.toThrow('tenantId é obrigatório');
    });

    it('rejeita plano inválido', async () => {
      await expect(service.startTrial('tenant-1', 'ultra' as any)).rejects.toThrow(
        'Plano inválido',
      );
    });

    it('não chama RPC quando a validação falha', async () => {
      await expect(service.startTrial('')).rejects.toThrow();
      expect(mockRpcClient.rpc).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });
  });

  describe('Happy path', () => {
    it('chama RPC start_trial com os parâmetros corretos', async () => {
      await service.startTrial('tenant-1', 'pro');

      expect(mockRpcClient.rpc).toHaveBeenCalledWith('start_trial', {
        p_tenant_id: 'tenant-1',
        p_plan: 'pro',
      });
    });

    it('usa p_plan null quando plano não informado', async () => {
      await service.startTrial('tenant-1');

      expect(mockRpcClient.rpc).toHaveBeenCalledWith('start_trial', {
        p_tenant_id: 'tenant-1',
        p_plan: null,
      });
    });

    it('retorna a view da subscription', async () => {
      const result = await service.startTrial('tenant-1');

      expect(result).toEqual({
        id: 'sub-1',
        tenantId: 'tenant-1',
        plan: 'free',
        status: 'trialing',
        trialStartedAt: '2026-08-06T10:00:00.000Z',
        trialEndsAt: '2026-08-20T10:00:00.000Z',
        currentPeriodStart: '2026-08-06T10:00:00.000Z',
        currentPeriodEnd: '2026-08-20T10:00:00.000Z',
        cancelAtPeriodEnd: null,
        canceledAt: null,
        createdAt: '2026-08-06T10:00:00.000Z',
      });
    });

    it('publica TenantSubscriptionCreated e TenantTrialStarted', async () => {
      await service.startTrial('tenant-1');

      expect(mockEventBus.publish).toHaveBeenCalledTimes(2);

      const created = mockEventBus.publish.mock.calls[0][0];
      expect(created.eventType).toBe('TenantSubscriptionCreated');
      expect(created.aggregateId).toBe('sub-1');
      expect(created.aggregateType).toBe('tenant_subscription');
      expect(created.payload).toEqual({
        subscriptionId: 'sub-1',
        tenantId: 'tenant-1',
        plan: 'free',
        status: 'trialing',
        trialStartedAt: '2026-08-06T10:00:00.000Z',
        trialEndsAt: '2026-08-20T10:00:00.000Z',
      });
      expect(created.metadata).toMatchObject({
        tenantId: 'tenant-1',
        source: 'TenantLifecycleService',
      });

      const trial = mockEventBus.publish.mock.calls[1][0];
      expect(trial.eventType).toBe('TenantTrialStarted');
      expect(trial.payload).toEqual({
        subscriptionId: 'sub-1',
        tenantId: 'tenant-1',
        trialStartedAt: '2026-08-06T10:00:00.000Z',
        trialEndsAt: '2026-08-20T10:00:00.000Z',
      });
    });
  });

  describe('Erros', () => {
    it('propaga erro da RPC com contexto e não publica eventos', async () => {
      mockRpcClient.rpcSingle.mockResolvedValue({
        data: null,
        error: { message: 'Insufficient permissions to start trial' },
      });

      await expect(service.startTrial('tenant-1')).rejects.toThrow(
        'Erro ao iniciar trial: Insufficient permissions to start trial',
      );
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });

    it('rejeita resultado inválido', async () => {
      mockRpcClient.rpcSingle.mockResolvedValue({ data: null, error: null });

      await expect(service.startTrial('tenant-1')).rejects.toThrow(
        'RPC start_trial retornou resultado inválido',
      );
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });
  });
});

describe('TenantLifecycleService.activate', () => {
  beforeEach(() => {
    mockRpcClient.rpcSingle.mockReset();
    mockRpcClient.rpc.mockReset();
    mockRpcClient.rpc.mockReturnValue({ single: mockRpcClient.rpcSingle });
    mockEventBus.publish.mockReset();
    mockRpcClient.rpcSingle.mockResolvedValue({
      data: fakeTrialingRow({ status: 'active' }),
      error: null,
    });
  });

  it('rejeita tenantId vazio', async () => {
    await expect(service.activate('')).rejects.toThrow('tenantId é obrigatório');
  });

  it('chama RPC activate_subscription e publica TenantSubscriptionUpdated', async () => {
    const result = await service.activate('tenant-1');

    expect(mockRpcClient.rpc).toHaveBeenCalledWith('activate_subscription', {
      p_tenant_id: 'tenant-1',
    });
    expect(result.status).toBe('active');

    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
    const event = mockEventBus.publish.mock.calls[0][0];
    expect(event.eventType).toBe('TenantSubscriptionUpdated');
    expect(event.payload).toEqual({
      subscriptionId: 'sub-1',
      tenantId: 'tenant-1',
      plan: 'free',
      status: 'active',
    });
    expect(event.metadata).toMatchObject({ source: 'TenantLifecycleService' });
  });

  it('propaga erro da RPC sem publicar evento', async () => {
    mockRpcClient.rpcSingle.mockResolvedValue({
      data: null,
      error: { message: 'Insufficient permissions to activate subscription' },
    });

    await expect(service.activate('tenant-1')).rejects.toThrow(
      'Erro ao ativar assinatura',
    );
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });
});

describe('TenantLifecycleService.cancel', () => {
  const cancelRequestRow = fakeTrialingRow({
    status: 'active',
    current_period_end: '2026-09-06T10:00:00.000Z',
    cancel_at_period_end: '2026-09-06T10:00:00.000Z',
    canceled_at: null,
  });

  beforeEach(() => {
    mockRpcClient.rpcSingle.mockReset();
    mockRpcClient.rpc.mockReset();
    mockRpcClient.rpc.mockReturnValue({ single: mockRpcClient.rpcSingle });
    mockEventBus.publish.mockReset();
    mockRpcClient.rpcSingle.mockResolvedValue({ data: cancelRequestRow, error: null });
  });

  it('rejeita tenantId vazio', async () => {
    await expect(service.cancel('')).rejects.toThrow('tenantId é obrigatório');
  });

  it('chama RPC cancel_subscription e NÃO muda o status (D-A: pedido)', async () => {
    const result = await service.cancel('tenant-1');

    expect(mockRpcClient.rpc).toHaveBeenCalledWith('cancel_subscription', {
      p_tenant_id: 'tenant-1',
    });

    // Acesso mantido: status permanece active; cancelamento marcado p/ fim do período
    expect(result.status).toBe('active');
    expect(result.cancelAtPeriodEnd).toBe('2026-09-06T10:00:00.000Z');
    expect(result.canceledAt).toBeNull();
  });

  it('publica TenantSubscriptionUpdated (pedido) e NÃO TenantSubscriptionCancelled', async () => {
    await service.cancel('tenant-1');

    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
    const event = mockEventBus.publish.mock.calls[0][0];
    expect(event.eventType).toBe('TenantSubscriptionUpdated');
    expect(event.payload).toEqual({
      subscriptionId: 'sub-1',
      tenantId: 'tenant-1',
      plan: 'free',
      status: 'active',
      cancelAtPeriodEnd: '2026-09-06T10:00:00.000Z',
    });
    expect(event.metadata).toMatchObject({ source: 'TenantLifecycleService' });
  });

  it('propaga erro da RPC sem publicar evento', async () => {
    mockRpcClient.rpcSingle.mockResolvedValue({
      data: null,
      error: { message: 'Insufficient permissions to cancel subscription' },
    });

    await expect(service.cancel('tenant-1')).rejects.toThrow('Erro ao cancelar assinatura');
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });
});

describe('TenantLifecycleService.getStatus', () => {
  beforeEach(() => {
    mockRpcClient.rpcSingle.mockReset();
    mockRpcClient.rpc.mockReset();
    mockRpcClient.rpc.mockReturnValue({ single: mockRpcClient.rpcSingle });
    mockEventBus.publish.mockReset();
  });

  it('chama RPC get_subscription e retorna a view', async () => {
    mockRpcClient.rpcSingle.mockResolvedValue({ data: fakeTrialingRow(), error: null });

    const result = await service.getStatus();

    expect(mockRpcClient.rpc).toHaveBeenCalledWith('get_subscription');
    expect(result?.tenantId).toBe('tenant-1');
    expect(result?.status).toBe('trialing');
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('retorna null quando não há subscription', async () => {
    mockRpcClient.rpcSingle.mockResolvedValue({ data: null, error: null });

    expect(await service.getStatus()).toBeNull();
  });

  it('propaga erro da RPC', async () => {
    mockRpcClient.rpcSingle.mockResolvedValue({
      data: null,
      error: { message: 'falha de rede' },
    });

    await expect(service.getStatus()).rejects.toThrow(
      'Erro ao consultar assinatura: falha de rede',
    );
  });
});
