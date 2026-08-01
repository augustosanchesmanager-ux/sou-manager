import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks (topo do arquivo) ──────────────────────────────────────
const mockRpcClient = vi.hoisted(() => {
  const rpcSingle = vi.fn();
  const rpc = vi.fn().mockReturnValue({ single: rpcSingle });
  return { rpc, rpcSingle };
});

vi.mock('../domain/shared/supabase-client-factory', () => ({
  createSupabaseClient: () => ({ from: vi.fn(), rpc: mockRpcClient.rpc }),
}));

const mockEventBus = vi.hoisted(() => {
  const publish = vi.fn();
  return { publish };
});

vi.mock('../domain/events/app-bus', () => ({
  appEventBus: { publish: mockEventBus.publish },
}));

// ─── Imports (depois dos mocks) ──────────────────────────────────
import { tenantProvisioningService, type ProvisionTenantRequest } from './tenantProvisioning';

const validRequest = (overrides: Partial<ProvisionTenantRequest> = {}): ProvisionTenantRequest => ({
  userId: 'user-1',
  tenantName: 'Barbearia Teste',
  firstName: 'João',
  lastName: 'Silva',
  ...overrides,
});

describe('TenantProvisioningService.provision', () => {
  beforeEach(() => {
    mockRpcClient.rpcSingle.mockReset();
    mockRpcClient.rpc.mockReset();
    mockRpcClient.rpc.mockReturnValue({ single: mockRpcClient.rpcSingle });
    mockEventBus.publish.mockReset();
  });

  describe('Validação (regra de negócio)', () => {
    it('rejeita sem userId', async () => {
      await expect(
        tenantProvisioningService.provision(validRequest({ userId: '' })),
      ).rejects.toThrow('userId é obrigatório');
    });

    it('rejeita sem tenantName', async () => {
      await expect(
        tenantProvisioningService.provision(validRequest({ tenantName: '   ' })),
      ).rejects.toThrow('Nome do tenant é obrigatório');
    });

    it('rejeita sem firstName', async () => {
      await expect(
        tenantProvisioningService.provision(validRequest({ firstName: '' })),
      ).rejects.toThrow('Nome do responsável é obrigatório');
    });

    it('não chama RPC quando a validação falha', async () => {
      await expect(
        tenantProvisioningService.provision(validRequest({ userId: '' })),
      ).rejects.toThrow();
      expect(mockRpcClient.rpc).not.toHaveBeenCalled();
    });
  });

  describe('Happy path (novo tenant)', () => {
    beforeEach(() => {
      mockRpcClient.rpcSingle.mockResolvedValue({
        data: { tenant_id: 't-1', slug: 'barbearia-teste', already_exists: false },
        error: null,
      });
    });

    it('chama RPC provision_new_tenant com os parâmetros corretos', async () => {
      await tenantProvisioningService.provision(validRequest());

      expect(mockRpcClient.rpc).toHaveBeenCalledWith('provision_new_tenant', {
        p_user_id: 'user-1',
        p_tenant_name: 'Barbearia Teste',
        p_first_name: 'João',
        p_last_name: 'Silva',
        p_app_slug: 'barber',
      });
    });

    it('usa appSlug default "barber" quando não informado', async () => {
      await tenantProvisioningService.provision(validRequest());
      expect(mockRpcClient.rpc.mock.calls[0][1].p_app_slug).toBe('barber');
    });

    it('usa o appSlug informado', async () => {
      await tenantProvisioningService.provision(validRequest({ appSlug: 'auto' }));
      expect(mockRpcClient.rpc.mock.calls[0][1].p_app_slug).toBe('auto');
    });

    it('retorna resultado e publica TenantCreated apenas para tenant novo', async () => {
      const result = await tenantProvisioningService.provision(
        validRequest({ appSlug: 'auto' }),
      );

      expect(result).toEqual({
        tenantId: 't-1',
        slug: 'barbearia-teste',
        alreadyExists: false,
      });

      expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
      const event = mockEventBus.publish.mock.calls[0][0];
      expect(event.eventType).toBe('TenantCreated');
      expect(event.aggregateId).toBe('t-1');
      expect(event.aggregateType).toBe('tenant');
      expect(event.payload).toEqual({
        tenantId: 't-1',
        slug: 'barbearia-teste',
        name: 'Barbearia Teste',
        appSlug: 'auto',
      });
      expect(event.metadata).toMatchObject({
        tenantId: 't-1',
        userId: 'user-1',
        source: 'TenantProvisioningService',
      });
    });
  });

  describe('Idempotência (tenant já existia)', () => {
    beforeEach(() => {
      mockRpcClient.rpcSingle.mockResolvedValue({
        data: { tenant_id: 't-1', slug: 'barbearia-teste', already_exists: true },
        error: null,
      });
    });

    it('retorna alreadyExists=true sem publicar evento', async () => {
      const result = await tenantProvisioningService.provision(validRequest());

      expect(result).toEqual({
        tenantId: 't-1',
        slug: 'barbearia-teste',
        alreadyExists: true,
      });
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });
  });

  describe('Erros', () => {
    it('propaga erro da RPC com contexto', async () => {
      mockRpcClient.rpcSingle.mockResolvedValue({
        data: null,
        error: { message: 'falha de rede' },
      });

      await expect(
        tenantProvisioningService.provision(validRequest()),
      ).rejects.toThrow('Erro ao criar tenant: falha de rede');
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });

    it('rejeita resultado inválido (sem tenant_id)', async () => {
      mockRpcClient.rpcSingle.mockResolvedValue({ data: null, error: null });

      await expect(
        tenantProvisioningService.provision(validRequest()),
      ).rejects.toThrow('RPC provision_new_tenant retornou resultado inválido');
    });
  });
});
