import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    appointmentComandaSyncService,
    AppointmentComandaSyncError,
    parseSyncRpcError,
    type SyncAppointmentInput,
} from '@/services/appointmentComandaSyncService';
import * as supabaseClientModule from '@/services/supabaseClient';

vi.mock('@/services/supabaseClient', () => ({
    getScopedClient: vi.fn(),
}));

describe('appointmentComandaSyncService', () => {
    const mockRpc = vi.fn();
    const mockClient = {
        rpc: mockRpc,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(supabaseClientModule.getScopedClient).mockReturnValue(mockClient as any);
    });

    const baseInput: SyncAppointmentInput = {
        tenantId: 'tenant-123',
        appointmentId: 'appt-456',
        newStaffId: 'staff-789',
        newStartTime: '2026-10-25T14:00:00.000Z',
        newEndTime: '2026-10-25T14:45:00.000Z',
        services: [
            {
                serviceId: 'srv-1',
                name: 'Corte Moderno',
                price: 50,
                duration: 45,
            },
        ],
        notes: 'Cliente VIP',
        syncComanda: true,
    };

    describe('syncAppointmentWithComanda - Sucesso', () => {
        it('deve formatar parâmetros e chamar a RPC sync_comanda_from_appointment com sucesso quando houver comanda vinculada', async () => {
            const mockResponseData = {
                success: true,
                appointment_id: 'appt-456',
                comanda_id: 'cmd-999',
                comanda_updated: true,
                preserved_products_count: 2,
                new_total: 85,
                appointment_status: 'confirmed',
            };

            mockRpc.mockResolvedValueOnce({
                data: mockResponseData,
                error: null,
            });

            const result = await appointmentComandaSyncService.syncAppointmentWithComanda(baseInput);

            expect(mockClient.rpc).toHaveBeenCalledWith('sync_comanda_from_appointment', {
                p_tenant_id: 'tenant-123',
                p_appointment_id: 'appt-456',
                p_new_staff_id: 'staff-789',
                p_new_start_time: '2026-10-25T14:00:00.000Z',
                p_new_end_time: '2026-10-25T14:45:00.000Z',
                p_services: [
                    {
                        service_id: 'srv-1',
                        price: 50,
                        duration: 45,
                        name: 'Corte Moderno',
                    },
                ],
                p_notes: 'Cliente VIP',
                p_sync_comanda: true,
            });

            expect(result).toEqual({
                success: true,
                appointmentId: 'appt-456',
                comandaId: 'cmd-999',
                comandaUpdated: true,
                preservedProductsCount: 2,
                newTotal: 85,
                appointmentStatus: 'confirmed',
            });
        });

        it('deve formatar serviços flexivelmente quando fornecidos unitPrice, durationMinutes e quantity', async () => {
            mockRpc.mockResolvedValueOnce({
                data: {
                    success: true,
                    appointment_id: 'appt-456',
                    comanda_id: 'cmd-999',
                    comanda_updated: true,
                    preserved_products_count: 0,
                    new_total: 120,
                },
                error: null,
            });

            await appointmentComandaSyncService.syncAppointmentWithComanda({
                ...baseInput,
                services: [
                    {
                        serviceId: 'srv-2',
                        name: 'Barba e Cabelo',
                        price: 0,
                        duration: 0,
                        unitPrice: 120,
                        durationMinutes: 60,
                        quantity: 1,
                    },
                ],
            });

            expect(mockClient.rpc).toHaveBeenCalledWith('sync_comanda_from_appointment', expect.objectContaining({
                p_services: [
                    {
                        service_id: 'srv-2',
                        price: 120,
                        duration: 60,
                        name: 'Barba e Cabelo',
                        quantity: 1,
                    },
                ],
            }));
        });

        it('deve retornar resultado com comandaUpdated=false quando agendamento não tiver comanda vinculada', async () => {
            mockRpc.mockResolvedValueOnce({
                data: {
                    success: true,
                    appointment_id: 'appt-456',
                    comanda_id: null,
                    comanda_updated: false,
                    preserved_products_count: 0,
                    new_total: null,
                    appointment_status: 'confirmed',
                },
                error: null,
            });

            const result = await appointmentComandaSyncService.syncAppointmentWithComanda({
                ...baseInput,
                syncComanda: false,
            });

            expect(result.success).toBe(true);
            expect(result.comandaId).toBeNull();
            expect(result.comandaUpdated).toBe(false);
            expect(result.newTotal).toBeNull();
        });

        it('deve processar corretamente payload retornado como string JSON pela RPC', async () => {
            mockRpc.mockResolvedValueOnce({
                data: JSON.stringify({
                    success: true,
                    appointment_id: 'appt-456',
                    comanda_id: 'cmd-1',
                    comanda_updated: true,
                    preserved_products_count: 1,
                    new_total: 60,
                }),
                error: null,
            });

            const result = await appointmentComandaSyncService.syncAppointmentWithComanda(baseInput);
            expect(result.success).toBe(true);
            expect(result.comandaId).toBe('cmd-1');
            expect(result.newTotal).toBe(60);
        });
    });

    describe('syncAppointmentWithComanda - Validações e Erros', () => {
        it('deve lançar erro de validação INVALID_TENANT se parâmetros obrigatórios estiverem ausentes', async () => {
            await expect(
                appointmentComandaSyncService.syncAppointmentWithComanda({
                    ...baseInput,
                    tenantId: '',
                })
            ).rejects.toThrow('Parâmetros obrigatórios ausentes');

            expect(mockClient.rpc).not.toHaveBeenCalled();
        });

        it('deve mapear código P0003 para COMANDA_ALREADY_SETTLED com mensagem amigável', async () => {
            mockRpc.mockResolvedValueOnce({
                data: null,
                error: {
                    code: 'P0003',
                    message: 'COMANDA_ALREADY_SETTLED: Comanda ja liquidada ou fechada',
                },
            });

            await expect(
                appointmentComandaSyncService.syncAppointmentWithComanda(baseInput)
            ).rejects.toThrow('Não é possível alterar profissional/serviço: a comanda correspondente já foi fechada, paga ou possui pagamentos registrados.');
        });

        it('deve mapear código P0004 para COMANDA_HAS_CLUB_CREDITS com mensagem amigável', async () => {
            mockRpc.mockResolvedValueOnce({
                data: null,
                error: {
                    code: 'P0004',
                    message: 'COMANDA_HAS_CLUB_CREDITS: Comanda possui creditos de assinatura/clube aplicados',
                },
            });

            await expect(
                appointmentComandaSyncService.syncAppointmentWithComanda(baseInput)
            ).rejects.toThrow('A comanda vinculada possui créditos de clube ou assinatura aplicados');
        });

        it('deve mapear código P0002 para APPOINTMENT_NOT_FOUND', async () => {
            mockRpc.mockResolvedValueOnce({
                data: null,
                error: {
                    code: 'P0002',
                    message: 'APPOINTMENT_NOT_FOUND: Agendamento nao encontrado',
                },
            });

            await expect(
                appointmentComandaSyncService.syncAppointmentWithComanda(baseInput)
            ).rejects.toThrow('Agendamento não encontrado para este estabelecimento.');
        });
    });

    describe('parseSyncRpcError', () => {
        it('deve classificar erro P0001 como INVALID_TENANT', () => {
            const err = parseSyncRpcError({ code: 'P0001', message: 'Tenant invalido ou nao autorizado' });
            expect(err.code).toBe('INVALID_TENANT');
        });

        it('deve classificar erros genéricos desconhecidos como UNKNOWN_ERROR', () => {
            const err = parseSyncRpcError({ code: '42P01', message: 'relation does not exist' });
            expect(err.code).toBe('UNKNOWN_ERROR');
            expect(err.message).toBe('relation does not exist');
        });
    });
});
