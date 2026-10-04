import { describe, it, expect, vi } from 'vitest';
import { PayoutService } from './payoutService';
import { SettlementTransitionError } from '../../domain/payout/settlementStateMachine';
import type {
    BarberPayoutSettlement,
    CancelSettlementResult,
    SettlementStatus,
} from '../../domain/payout/types';

const makeSettlement = (status: SettlementStatus): BarberPayoutSettlement => ({
    id: 'st1',
    tenantId: 't1',
    staffId: 'staff1',
    periodStart: '2026-09-29',
    periodEnd: '2026-10-05',
    grossCommission: 400,
    advancesDeducted: 350,
    bonusesAdded: 0,
    netPayout: 50,
    status,
    paidAt: status === 'paid' ? '2026-10-06T12:00:00Z' : null,
    paymentMethod: status === 'paid' ? 'pix' : null,
    cancelReason: null,
    createdAt: '2026-10-06T10:00:00Z',
});

const makeRepository = (
    status: SettlementStatus,
    rpcResult: CancelSettlementResult,
) => {
    const cancelSettlement = vi.fn().mockResolvedValue(rpcResult);
    const repository = {
        getSettlementById: vi.fn().mockResolvedValue(makeSettlement(status)),
        cancelSettlement,
    };
    return { repository, cancelSettlement };
};

const service = (repository: unknown) =>
    new PayoutService(repository as never);

describe('PayoutService.cancelSettlement', () => {
    it('rejects_cancel_of_paid_settlement_before_reaching_repository', async () => {
        const { repository, cancelSettlement } = makeRepository('paid', {
            success: true,
            unlinkedAdvances: 0,
            idempotent: false,
            message: '',
        });
        const payout = service(repository);

        await expect(
            payout.cancelSettlement('t1', 'st1', 'erro de digitacao'),
        ).rejects.toBeInstanceOf(SettlementTransitionError);

        // A RPC nunca e chamada: `paid` e terminal e nao ha como desvincular.
        expect(cancelSettlement).not.toHaveBeenCalled();
    });

    it('rejects_empty_reason_without_reaching_repository', async () => {
        const { repository, cancelSettlement } = makeRepository('draft', {
            success: true,
            unlinkedAdvances: 0,
            idempotent: false,
            message: '',
        });
        const payout = service(repository);

        await expect(payout.cancelSettlement('t1', 'st1', '   ')).rejects.toThrow(
            /Motivo obrigatorio/i,
        );
        expect(cancelSettlement).not.toHaveBeenCalled();
    });

    it('reports_unlinked_advances_from_rpc', async () => {
        const { repository, cancelSettlement } = makeRepository('approved', {
            success: true,
            unlinkedAdvances: 3,
            idempotent: false,
            message: 'ok',
        });
        const payout = service(repository);

        const { result } = await payout.cancelSettlement('t1', 'st1', 'acerto gerado em duplicidade');

        expect(result.unlinkedAdvances).toBe(3);
        expect(result.idempotent).toBe(false);
        expect(cancelSettlement).toHaveBeenCalledTimes(1);
        expect(cancelSettlement).toHaveBeenCalledWith(
            't1',
            'st1',
            'acerto gerado em duplicidade',
        );
    });

    it('propagates_idempotent_result_when_already_cancelled', async () => {
        // Retentativa apos falha de rede: a RPC responde sucesso com
        // unlinked_advances 0 e o gestor nao recebe falso erro.
        const { repository } = makeRepository('cancelled', {
            success: true,
            unlinkedAdvances: 0,
            idempotent: true,
            message: 'Liquidacao ja cancelada.',
        });
        const payout = service(repository);

        const { result } = await payout.cancelSettlement('t1', 'st1', 'tentativa 2');

        expect(result.idempotent).toBe(true);
        expect(result.unlinkedAdvances).toBe(0);
    });

    it('issues_single_repository_call_for_atomicity', async () => {
        // Uma unica chamada: desvinculo e status sao atomicos na RPC.
        // Duas chamadas reabririam a janela de descompasso contabil.
        const { repository, cancelSettlement } = makeRepository('draft', {
            success: true,
            unlinkedAdvances: 2,
            idempotent: false,
            message: 'ok',
        });
        const payout = service(repository);

        await payout.cancelSettlement('t1', 'st1', 'motivo');

        expect(cancelSettlement).toHaveBeenCalledTimes(1);
    });

    it('trims_reason_before_sending_to_repository', async () => {
        const { repository, cancelSettlement } = makeRepository('draft', {
            success: true,
            unlinkedAdvances: 0,
            idempotent: false,
            message: 'ok',
        });
        const payout = service(repository);

        await payout.cancelSettlement('t1', 'st1', '  duplicidade  ');

        expect(cancelSettlement).toHaveBeenCalledWith('t1', 'st1', 'duplicidade');
    });
});