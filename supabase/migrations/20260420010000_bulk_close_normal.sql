CREATE OR REPLACE FUNCTION bulk_close_comandas_normal(
    p_comanda_ids UUID[],
    p_tenant_id UUID,
    p_closure_note TEXT DEFAULT NULL,
    p_payment_method TEXT DEFAULT 'Dinheiro'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_ids UUID[];
    v_updated_count INTEGER := 0;
BEGIN
    SELECT COALESCE(array_agg(DISTINCT id), ARRAY[]::UUID[])
    INTO v_ids
    FROM unnest(COALESCE(p_comanda_ids, ARRAY[]::UUID[])) AS id;

    IF COALESCE(array_length(v_ids, 1), 0) = 0 THEN
        RAISE EXCEPTION 'Selecione ao menos uma comanda';
    END IF;

    UPDATE barber.comandas
    SET
        status = 'paid',
        closure_mode = 'standard',
        closure_note = NULLIF(BTRIM(p_closure_note), ''),
        financial_effect = true,
        membership_credit_effect = true,
        payment_method = p_payment_method,
        closed_at = NOW()
    WHERE id = ANY(v_ids)
        AND status = 'open'
        AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id);

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    UPDATE barber.appointments
    SET status = 'completed'
    WHERE id IN (
        SELECT appointment_id
        FROM barber.comandas
        WHERE id = ANY(v_ids)
            AND appointment_id IS NOT NULL
            AND status = 'paid'
            AND closure_mode = 'standard'
    );

    RETURN jsonb_build_object(
        'updated_count', v_updated_count,
        'closure_mode', 'standard',
        'financial_effect', true,
        'membership_credit_effect', true
    );
END;
$$;

GRANT EXECUTE ON FUNCTION bulk_close_comandas_normal(UUID[], UUID, TEXT, TEXT) TO authenticated;