-- ============================================================================
-- 20261004030000_adr030_payout_fsm_unlink.sql
-- ADR-030: FSM de liquidação — RPC de desvinculação de vales no cancelamento
--
-- Escopo: SOMENTE a RPC que desfaz a vinculação de vales. As transições de
-- status de `barber_payout_settlements` são autorizadas pela policy
-- `barber_payout_settlements_write` (FOR ALL, gestor do tenant) e não
-- precisam de RPC.
--
-- NÃO APLICADO. Exige preflight e autorização explícita do PO.
--
-- ---------------------------------------------------------------------------
-- DECISÃO DE PO: `paid` É TERMINAL
-- ---------------------------------------------------------------------------
-- Cancelamento só existe a partir de `draft` ou `approved`. Um acerto com
-- pagamento já realizado NÃO pode ser desvinculado de seus vales: o valor
-- já saiu e devolvê-lo ao estado `pending` faria o mesmo vale ser abatido
-- novamente no acerto seguinte, subpagando o profissional de forma
-- silenciosa.
--
--     bruto 400 · vale 200 · líquido 200  -> PAGO
--     cancelamento indevido + desvinculação
--     bruto 300 · vale 200 (pending) · líquido 100 -> PAGO
--     total pago 300; correto seria 700 - 200 = 500. Faltam 200 ao barbeiro.
--
-- A regra é replicada nesta RPC para que uma chamada direta a SQL não
-- contorne a restrição da camada de aplicação.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.unlink_advances_from_settlement(
    p_tenant_id     UUID,
    p_settlement_id UUID,
    p_motivo        TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_auth_uid   UUID := auth.uid();
    v_is_super   BOOLEAN;
    v_settlement public.barber_payout_settlements%ROWTYPE;
    v_unlinked   INTEGER := 0;
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

    SELECT * INTO v_settlement
    FROM public.barber_payout_settlements
    WHERE id = p_settlement_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Liquidacao nao encontrada para este tenant';
    END IF;

    -- paid e terminal: nao ha desvinculacao possivel.
    IF v_settlement.status = 'paid' THEN
        RAISE EXCEPTION
            'Acerto ja liquidado e imutavel (ADR-030). A reversao de um pagamento realizado exige evento financeiro proprio, ainda nao modelado.';
    END IF;

    IF v_settlement.status = 'cancelled' THEN
        RAISE EXCEPTION 'Liquidacao ja cancelada';
    END IF;

    UPDATE public.barber_advances
    SET settlement_id = NULL
    WHERE settlement_id = p_settlement_id AND tenant_id = p_tenant_id;

    GET DIAGNOSTICS v_unlinked = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'settlement_id', p_settlement_id,
        'unlinked_advances', v_unlinked,
        'motivo', p_motivo,
        'message', 'Vales desvinculados da liquidacao.'
    );
END;
$$;

COMMENT ON FUNCTION public.unlink_advances_from_settlement(UUID, UUID, TEXT) IS
    'ADR-030: desvincula os vales de uma liquidacao em draft ou approved. Recusa acerto com status paid (terminal), cuja reversao exigiria evento financeiro nao modelado.';

REVOKE ALL ON FUNCTION public.unlink_advances_from_settlement(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unlink_advances_from_settlement(UUID, UUID, TEXT) TO authenticated;

COMMIT;