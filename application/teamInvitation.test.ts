import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks (topo do arquivo) ──────────────────────────────────────
const mockEventBus = vi.hoisted(() => {
  const publish = vi.fn();
  return { publish };
});

vi.mock('../domain/events/app-bus', () => ({
  appEventBus: { publish: mockEventBus.publish },
}));

const mockRepo = vi.hoisted(() => ({
  create: vi.fn(),
  getByToken: vi.fn(),
  accept: vi.fn(),
  revoke: vi.fn(),
  resend: vi.fn(),
  listForTenant: vi.fn(),
  listForCurrentUser: vi.fn(),
}));

// ─── Imports (depois dos mocks) ──────────────────────────────────
import { TeamInvitationServiceImpl } from './teamInvitation';
import type { Invitation } from '../domain/invitation/types';

const service = new TeamInvitationServiceImpl(mockRepo as any);

const fakeInvitation = (overrides: Partial<Invitation> = {}): Invitation => ({
  id: 'inv-1',
  tenantId: 'tenant-1',
  email: 'barbeiro@example.com',
  role: 'barber',
  status: 'pending',
  token: 'token-abc',
  expiresAt: '2026-08-13T00:00:00.000Z',
  invitedBy: 'user-manager',
  acceptedAt: null,
  resendCount: 0,
  createdAt: '2026-08-06T00:00:00.000Z',
  ...overrides,
});

describe('TeamInvitationService.invite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo.create.mockResolvedValue(fakeInvitation());
  });

  describe('Validação (regra de negócio)', () => {
    it('rejeita sem tenantId', async () => {
      await expect(
        service.invite({ tenantId: '', email: 'a@b.com', role: 'barber' }),
      ).rejects.toThrow('tenantId é obrigatório');
    });

    it('rejeita email inválido', async () => {
      await expect(
        service.invite({ tenantId: 't-1', email: 'invalido', role: 'barber' }),
      ).rejects.toThrow('Email inválido');
    });

    it('rejeita papel não convidável (D2)', async () => {
      await expect(
        service.invite({ tenantId: 't-1', email: 'a@b.com', role: 'manager' as any }),
      ).rejects.toThrow('Papel não convidável');
    });

    it('não chama repository quando a validação falha', async () => {
      await expect(
        service.invite({ tenantId: '', email: 'a@b.com', role: 'barber' }),
      ).rejects.toThrow();
      expect(mockRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('Happy path', () => {
    it('cria convite com email normalizado e retorna view', async () => {
      const result = await service.invite({
        tenantId: 'tenant-1',
        email: '  BARBEIRO@Example.com ',
        role: 'barber',
      });

      expect(mockRepo.create).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        email: 'barbeiro@example.com',
        role: 'barber',
      });

      expect(result).toEqual({
        id: 'inv-1',
        email: 'barbeiro@example.com',
        role: 'barber',
        status: 'pending',
        expiresAt: '2026-08-13T00:00:00.000Z',
        resendCount: 0,
        invitedBy: 'user-manager',
        createdAt: '2026-08-06T00:00:00.000Z',
        acceptedAt: null,
      });
      expect(result).not.toHaveProperty('token');
    });

    it('publica StaffInvited com payload correto', async () => {
      await service.invite({ tenantId: 'tenant-1', email: 'a@b.com', role: 'barber' });

      expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
      const event = mockEventBus.publish.mock.calls[0][0];
      expect(event.eventType).toBe('StaffInvited');
      expect(event.aggregateId).toBe('inv-1');
      expect(event.aggregateType).toBe('invitation');
      expect(event.payload).toEqual({
        invitationId: 'inv-1',
        tenantId: 'tenant-1',
        email: 'barbeiro@example.com',
        role: 'barber',
      });
      expect(event.metadata).toMatchObject({
        tenantId: 'tenant-1',
        source: 'TeamInvitationService',
      });
    });
  });

  describe('Erros', () => {
    it('propaga erro do repository', async () => {
      mockRepo.create.mockRejectedValue(new Error('Team limit reached: the free plan allows 1 professional'));
      await expect(
        service.invite({ tenantId: 't-1', email: 'a@b.com', role: 'barber' }),
      ).rejects.toThrow('Team limit reached');
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });
  });
});

describe('TeamInvitationService.accept', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo.accept.mockResolvedValue({ tenantId: 'tenant-1', role: 'barber', staffId: 'staff-1' });
  });

  it('rejeita token vazio', async () => {
    await expect(service.accept('   ', 'João', 'Silva')).rejects.toThrow('Token do convite é obrigatório');
  });

  it('aceita convite e publica StaffAccepted', async () => {
    const result = await service.accept('token-abc', 'João', 'Silva');

    expect(mockRepo.accept).toHaveBeenCalledWith('token-abc', 'João', 'Silva');
    expect(result).toEqual({ tenantId: 'tenant-1', role: 'barber', staffId: 'staff-1' });

    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
    const event = mockEventBus.publish.mock.calls[0][0];
    expect(event.eventType).toBe('StaffAccepted');
    expect(event.payload).toMatchObject({
      tenantId: 'tenant-1',
      staffId: 'staff-1',
      role: 'barber',
    });
    expect(event.metadata).toMatchObject({ userId: 'staff-1', source: 'TeamInvitationService' });
  });

  it('propaga erro de aceite (ex.: convite expirado)', async () => {
    mockRepo.accept.mockRejectedValue(new Error('Invite has expired'));
    await expect(service.accept('token-abc', 'João', 'Silva')).rejects.toThrow('Invite has expired');
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });
});

describe('TeamInvitationService.revoke/resend/list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo.revoke.mockResolvedValue(undefined);
    mockRepo.resend.mockResolvedValue(fakeInvitation({ resendCount: 1 }));
    mockRepo.listForTenant.mockResolvedValue([
      {
        id: 'inv-1',
        email: 'a@b.com',
        role: 'barber',
        status: 'pending',
        expiresAt: '2026-08-13T00:00:00.000Z',
        resendCount: 0,
        invitedBy: 'user-1',
        createdAt: '2026-08-06T00:00:00.000Z',
        acceptedAt: null,
      },
    ]);
    mockRepo.listForCurrentUser.mockResolvedValue([]);
  });

  it('revoke valida id e delega', async () => {
    await service.revoke('inv-1');
    expect(mockRepo.revoke).toHaveBeenCalledWith('inv-1');
  });

  it('revoke rejeita id vazio', async () => {
    await expect(service.revoke('')).rejects.toThrow('invitationId é obrigatório');
  });

  it('resend delega e retorna view sem token', async () => {
    const result = await service.resend('inv-1');
    expect(mockRepo.resend).toHaveBeenCalledWith('inv-1');
    expect(result.resendCount).toBe(1);
    expect(result).not.toHaveProperty('token');
  });

  it('list delega para listForTenant', async () => {
    const rows = await service.list();
    expect(mockRepo.listForTenant).toHaveBeenCalledTimes(1);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('inv-1');
  });

  it('listForCurrentUser delega', async () => {
    const rows = await service.listForCurrentUser();
    expect(mockRepo.listForCurrentUser).toHaveBeenCalledTimes(1);
    expect(rows).toEqual([]);
  });
});
