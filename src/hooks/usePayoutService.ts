import { useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { PayoutService } from '../../application/payout/payoutService';
import { PayoutRepository } from '../../domain/payout/payoutRepository';
import { createSharedSupabaseClient } from '../../domain/shared/supabase-client-factory';
import type {
    AdvanceRegistrationResult,
    BarberAdvance,
    BarberPayoutConfig,
    PayoutFrequency,
    RegisterAdvanceInput,
} from '../../domain/payout/types';

/**
 * [SMG][HOOKS] usePayoutService
 *
 * RESPONSABILIDADE: amarração do grafo de dependências do módulo de repasse
 * para a camada de apresentação. O componente nunca instancia
 * `PayoutRepository` nem `PayoutService` — apenas consome o serviço.
 *
 * POR QUE UM HOOK: `PayoutService` é uma classe com dependência explícita
 * (`constructor(repository)`). Sem este hook, cada componente que precisasse
 * do serviço repetiria a instanciação, e o primeiro a fazê-lo viraria de fato a
 * construção do grafo na camada de UI — o que o ADR-002 (Repository Pattern)
 * e o `guard-repository` existem para evitar.
 *
 * CLIENT COMPARTILHADO: as três tabelas do ADR-030 vivem em `public` e são
 * resolvidas por `createSharedSupabaseClient()`, que é o caminho canônico
 * quando a tabela não é de domínio com schema próprio.
 *
 * O tenant vem do `AuthContext` e nunca é informado pelo componente — assim
 * o filtro de tenant é aplicado uma única vez, no repositório.
 */
export const usePayoutService = (): PayoutService | null => {
    const { tenantId } = useAuth();

    return useMemo(() => {
        if (!tenantId) return null;
        return new PayoutService(new PayoutRepository(createSharedSupabaseClient()));
    }, [tenantId]);
};

/** Tenant corrente, para chamadas que exigem o id explícito. */
export const usePayoutTenantId = (): string | null => {
    const { tenantId } = useAuth();
    return tenantId ?? null;
};

/**
 * Hook dedicado para operações de Vales / Adiantamentos (ADR-030),
 * expondo `registerAdvance`, `reverseAdvance` e `listPendingAdvances`
 * já vinculados ao `tenantId` do contexto autenticado.
 */
export const useBarberAdvances = () => {
    const { tenantId } = useAuth();
    const service = usePayoutService();

    const registerAdvance = useCallback(
        async (
            input: Omit<RegisterAdvanceInput, 'tenantId'>,
        ): Promise<AdvanceRegistrationResult> => {
            if (!service || !tenantId) {
                throw new Error('Contexto do tenant indisponível para registrar vale');
            }
            return service.registerAdvance({
                tenantId,
                ...input,
            });
        },
        [service, tenantId],
    );

    const reverseAdvance = useCallback(
        async (
            advanceId: string,
            motivo: string,
        ): Promise<{ success: boolean; message: string }> => {
            if (!service || !tenantId) {
                throw new Error('Contexto do tenant indisponível para estornar vale');
            }
            return service.reverseAdvance(tenantId, advanceId, motivo);
        },
        [service, tenantId],
    );

    const listPendingAdvances = useCallback(
        async (staffId: string): Promise<BarberAdvance[]> => {
            if (!service || !tenantId) return [];
            return service.listPendingAdvances(tenantId, staffId);
        },
        [service, tenantId],
    );

    return {
        tenantId: tenantId ?? null,
        service,
        registerAdvance,
        reverseAdvance,
        listPendingAdvances,
    };
};

/**
 * Hook dedicado para leitura e gravação da Política de Repasse & Vales
 * (`barber_payout_configs` — ADR-030 G2) por profissional.
 */
export const useBarberPayoutConfig = () => {
    const { tenantId } = useAuth();
    const service = usePayoutService();

    const getConfigByStaff = useCallback(
        async (staffId: string): Promise<BarberPayoutConfig | null> => {
            if (!service || !tenantId || !staffId) return null;
            return service.getConfigByStaff(tenantId, staffId);
        },
        [service, tenantId],
    );

    const upsertConfig = useCallback(
        async (input: {
            staffId: string;
            frequency: PayoutFrequency;
            payoutWeekday: number | null;
            payoutMonthDay: number | null;
            allowAdvances: boolean;
        }): Promise<BarberPayoutConfig> => {
            if (!service || !tenantId) {
                throw new Error('Contexto do tenant indisponível para salvar configuração de repasse');
            }
            return service.upsertConfig({
                tenantId,
                ...input,
            });
        },
        [service, tenantId],
    );

    return {
        tenantId: tenantId ?? null,
        service,
        getConfigByStaff,
        upsertConfig,
    };
};