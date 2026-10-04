-- ============================================================================
-- 20261004040000_adr030_atomic_cancel_payout_settlement.sql
-- ADR-030: cancelamento atomico de liquidacao + desvinculacao de vales
--
-- Escopo: SUBSTITUI unlink_advances_from_settlement por uma unica RPC que
-- executa validacao de status, desvinculacao e mudanca de estado na mesma
-- transacao. Remove a RPC transitoria para que nenhum ambiente versione
-- codigo morto com SECURITY DEFINER.
--
-- POR QUE A UNIFICACAO: a versao anterior fazia duas chamadas (unlink via
-- RPC, depois UPDATE do status). Se a segunda falhasse, os vales ja tinham
-- voltado a `pending` enquanto o acerto seguia `approved` com
-- advances_deducted > 0 e nenhum vale vinculado — documento contabilmente
-- corrompido ate intervencao manual.
--
-- IDEMPOTENCIA POR DESENHO: retentativa apos falha de rede conclui com
-- sucesso em vez de levantar erro, porque e o cenario mais provavel e um
-- falso "ja cancelada" forçaria o gestor a desistir.
--
-- NÃO APLICADO. Exige preflight e autorização explicita do PO.
-- ============================================================================

BEGIN;

-- 1. Coluna de rastreabilidade: por que um acerto foi destruido.
ALTER TABLE public.barber_payout_settlements
    ADD COLUMN IF NOT EXISTS cancel_reason TEXT NULL;

COMMENT ON COLUMN public.barber_payout_settlements.cancel_reason IS
    'ADR-030: motivo do cancelamento da liquidacao. Preenchido pela RPC cancel_payout_settlement.';

-- 2. Remove a RPC transitoria (DROP tambem revoga seu ACL).
DROP FUNCTION IF EXISTS public.unlink_advances_from_settlement(UUID, UUID, TEXT);

-- 3. RPC atomica e idempotente.
CREATE OR REPLACE FUNCTION public.cancel_payout_settlement(
    p_tenant_id     UUID,
    p_settlement_id UUID,
    p_motivo        TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_auth_uid UUID := auth.uid();
    v_is_super BOOLEAN;
    v_status   TEXT;
    v_unlinked INTEGER := 0;
BEGIN
    IF v_auth_uid IS NULL THEN RAISE EXCEPTION 'Usuario autenticado obrigatorio'; END IF;
    IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id obrigatorio'; END IF;
    IF p_settlement_id IS NULL THEN RAISE EXCEPTION 'settlement_id obrigatorio'; END IF;
    IF p_motivo IS NULL OR BTRIM(p_motivo) = '' THEN
        RAISE EXCEPTION 'Motivo obrigatorio para cancelamento de liquidacao';
    END IF;

    SELECT public.current_is_super_admin_from_auth_uid() INTO v_is_super;
    IF NOT COALESCE(v_is_super, false)
       AND NOT public.current_is_manager_from_auth_uid(p_tenant_id) THEN
        RAISE EXCEPTION 'Somente gestao do tenant pode cancelar liquidacao';
    END IF;

    -- Trava pessimista: serializa cancelamentos concorrentes sobre a tupla.
    SELECT s.status INTO v_status
    FROM public.barber_payout_settlements s
    WHERE s.id = p_settlement_id AND s.tenant_id = p_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Liquidacao nao encontrada para este tenant';
    END IF;

    -- paid e terminal. A reversao de um pagamento realizado exige evento
    -- financeiro proprio, ainda nao modelado (divida registrada no ADR-030).
    IF v_status = 'paid' THEN
        RAISE EXCEPTION
            'Acerto ja liquidado e imutavel (ADR-030). A reversao de um pagamento realizado exige evento financeiro proprio, ainda nao modelado.';
    END IF;

    -- Idempotencia por desenho: retentativa conclui com sucesso.
    IF v_status = 'cancelled' THEN
        RETURN jsonb_build_object(
            'success', true,
            'idempotent', true,
            'unlinked_advances', 0,
            'message', 'Liquidacao ja cancelada.'
        );
    END IF;

    UPDATE public.barber_advances
    SET settlement_id = NULL
    WHERE settlement_id = p_settlement_id AND tenant_id = p_tenant_id;

    GET DIAGNOSTICS v_unlinked = ROW_COUNT;

    UPDATE public.barber_payout_settlements
    SET status = 'cancelled',
        cancel_reason = BTRIM(p_motivo)
    WHERE id = p_settlement_id AND tenant_id = p_tenant_id;

    RETURN jsonb_build_object(
        'success', true,
        'idempotent', false,
        'unlinked_advances', v_unlinked,
        'message', 'Liquidacao cancelada e vales desvinculados.'
    );
END;
$$;

COMMENT ON FUNCTION public.cancel_payout_settlement(UUID, UUID, TEXT) IS
    'ADR-030: cancela a liquidacao e desvincula seus vales em uma unica transacao. Recusa acerto paid (terminal). Idempotente quando ja cancelada.';

REVOKE ALL ON FUNCTION public.cancel_payout_settlement(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_payout_settlement(UUID, UUID, TEXT) TO authenticated;

COMMIT;