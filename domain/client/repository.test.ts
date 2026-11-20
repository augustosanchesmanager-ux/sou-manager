import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clientRepository } from './index';
import type { DatabaseClient } from '../shared/database-client';

describe('ClientRepository with notes and schedule preferences', () => {
    let mockFrom: ReturnType<typeof vi.fn>;
    let repo: typeof clientRepository;

    beforeEach(() => {
        mockFrom = vi.fn();
        const mockDb = {
            from: mockFrom,
            rpc: vi.fn(),
        } as unknown as DatabaseClient;

        // Instancia repositório com mockDb
        const { clientRepository: baseRepo } = vi.importActual('./index') as any;
        repo = Object.create(clientRepository);
        (repo as any).db = mockDb;
    });

    it('should_map_notes_and_preferred_schedule_fields_when_listing_clients', async () => {
        const mockRow = {
            id: 'c1',
            name: 'Carlos Barbeiro Lover',
            email: 'carlos@test.com',
            phone: '11999999999',
            last_visit: '2026-10-20',
            last_service: 'Barba Terapia',
            total_spent: 450,
            status: 'active',
            avatar: '',
            birthday: '1990-05-15',
            notes: 'Sensibilidade na nuca; corte degradê na zero',
            preferred_frequency: 'weekly',
            preferred_weekday: 5, // Sexta-feira
            preferred_time: '18:00',
            preferred_staff_id: 'staff-joao',
        };

        const chainable = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: [mockRow], error: null }),
        };
        mockFrom.mockReturnValue(chainable);

        const clients = await repo.list('t1');

        expect(clients).toHaveLength(1);
        expect(clients[0].notes).toBe('Sensibilidade na nuca; corte degradê na zero');
        expect(clients[0].preferred_frequency).toBe('weekly');
        expect(clients[0].preferred_weekday).toBe(5);
        expect(clients[0].preferred_time).toBe('18:00');
        expect(clients[0].preferred_staff_id).toBe('staff-joao');
    });

    it('should_include_preferences_when_creating_client', async () => {
        const mockCreated = {
            id: 'c2',
            name: 'Marcos Silva',
            email: 'marcos@test.com',
            phone: '11988888888',
            birthday: '1985-02-10',
            notes: 'Prefere tesoura no topo',
            preferred_frequency: 'biweekly',
            preferred_weekday: 6, // Sábado
            preferred_time: '10:00',
            preferred_staff_id: 'staff-pedro',
            status: 'active',
            total_spent: 0,
            last_visit: '',
            last_service: '',
            avatar: '',
        };

        const insertMock = vi.fn().mockReturnThis();
        const chainable = {
            insert: insertMock,
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockCreated, error: null }),
        };
        mockFrom.mockReturnValue(chainable);

        const client = await repo.create(
            {
                name: 'Marcos Silva',
                email: 'marcos@test.com',
                phone: '11988888888',
                birthday: '1985-02-10',
                notes: 'Prefere tesoura no topo',
                preferred_frequency: 'biweekly',
                preferred_weekday: 6,
                preferred_time: '10:00',
                preferred_staff_id: 'staff-pedro',
            },
            't1',
        );

        expect(insertMock).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'Marcos Silva',
                notes: 'Prefere tesoura no topo',
                preferred_frequency: 'biweekly',
                preferred_weekday: 6,
                preferred_time: '10:00',
                preferred_staff_id: 'staff-pedro',
                tenant_id: 't1',
            }),
        );
        expect(client.preferred_frequency).toBe('biweekly');
        expect(client.preferred_time).toBe('10:00');
    });

    it('should_create_dependent_with_parent_client_id_and_shared_phone', async () => {
        const mockChild = {
            id: 'child-1',
            name: 'Samuel',
            email: '',
            phone: '11958713888',
            birthday: '2016-04-10',
            notes: 'Corte infantil',
            parent_client_id: 'parent-1',
            is_shared_phone: true,
            status: 'active',
            total_spent: 0,
            last_visit: '',
            last_service: '',
            avatar: '',
        };

        const insertMock = vi.fn().mockReturnThis();
        const chainable = {
            insert: insertMock,
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockChild, error: null }),
        };
        mockFrom.mockReturnValue(chainable);

        const created = await repo.createDependent(
            { id: 'parent-1', phone: '(11) 95871-3888', parent_client_id: null },
            { name: 'Samuel', birthday: '2016-04-10', notes: 'Corte infantil' },
            't1',
        );

        expect(insertMock).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'Samuel',
                phone: '11958713888',
                parent_client_id: 'parent-1',
                is_shared_phone: true,
                tenant_id: 't1',
            }),
        );
        expect(created.parent_client_id).toBe('parent-1');
        expect(created.is_shared_phone).toBe(true);
    });

    it('should_reject_creating_dependent_under_another_dependent', async () => {
        await expect(
            repo.createDependent(
                { id: 'child-1', phone: '11958713888', parent_client_id: 'parent-1' },
                { name: 'Neto' },
                't1',
            ),
        ).rejects.toThrow(/limite de 1 nível/i);
    });

    it('should_keep_is_shared_phone_true_when_unlinking_dependent_whose_phone_belongs_to_titular', async () => {
        const childRow = {
            id: 'child-1',
            name: 'Samuel',
            phone: '11958713888',
            parent_client_id: 'parent-1',
            is_shared_phone: true,
        };
        const parentRow = {
            id: 'parent-1',
            name: 'Israel',
            phone: '11958713888',
            parent_client_id: null,
            is_shared_phone: false,
        };

        const updateMock = vi.fn().mockReturnThis();
        mockFrom
            .mockReturnValueOnce({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: childRow, error: null }),
            })
            .mockReturnValueOnce({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                ilike: vi.fn().mockResolvedValue({ data: [parentRow, childRow], error: null }),
            })
            .mockReturnValueOnce({
                update: updateMock,
                eq: vi.fn().mockReturnThis(),
                data: null,
                error: null,
            });

        await repo.unlinkDependent('child-1', 't1');

        expect(updateMock).toHaveBeenCalledWith({
            parent_client_id: null,
            is_shared_phone: true,
        });
    });
});
