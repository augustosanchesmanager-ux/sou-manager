import { useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { PayoutService } from '../../application/payout/payoutService';
import { PayoutRepository } from '../../domain/payout/payoutRepository';
import { createSharedSupabaseClient } from '../../domain/shared/supabase-client-factory';

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