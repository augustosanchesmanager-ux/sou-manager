BEGIN;

-- ============================================================
-- Baixa em massa de comandas COM consumo de créditos do Clube
-- ============================================================

CREATE OR REPLACE FUNCTION public.bulk_close_comandas_with_credits(
    p_comanda_ids UUID[],
    p_tenant_id UUID DEFAULT NULL,
    p_closure_note TEXT DEFAULT NULL,
    p_payment_method TEXT DEFAULT 'Dinheiro',
    p_apply_credits BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ids UUID[];
    v_updated_count INTEGER := 0;
    v_credits_consumed JSONB := '[]'::jsonb;
    v_credits_by_service JSONB := '{}'::jsonb;
    v_subscription_id UUID;
    v_client_id UUID;
    v_service_id UUID;
    v_item_count INTEGER;
    v_credit_consumed INTEGER;
    v_service_key TEXT;
    v_current_service JSONB;
    v_found_index INTEGER;
BEGIN
    SELECT COALESCE(array_agg(DISTINCT id), ARRAY[]::UUID[])
    INTO v_ids
    FROM unnest(COALESCE(p_comanda_ids, ARRAY[]::UUID[])) AS id;

    IF COALESCE(array_length(v_ids, 1), 0) = 0 THEN
        RAISE EXCEPTION 'Selecione ao menos uma comanda';
    END IF;

    IF p_apply_credits THEN
        FOR v_client_id IN
            SELECT DISTINCT c.client_id
            FROM public.comandas c
            WHERE c.id = ANY(v_ids)
              AND c.status = 'open'
              AND (p_tenant_id IS NULL OR c.tenant_id = p_tenant_id)
              AND c.client_id IS NOT NULL
        LOOP
            SELECT cs.id
            INTO v_subscription_id
            FROM public.customer_subscriptions cs
            WHERE cs.client_id = v_client_id
              AND cs.status = 'active'
              AND (p_tenant_id IS NULL OR cs.tenant_id = p_tenant_id)
            ORDER BY cs.created_at DESC
            LIMIT 1;

            IF v_subscription_id IS NOT NULL THEN
                FOR v_service_id, v_item_count IN
                    SELECT ci.service_id, COUNT(*)::INTEGER
                    FROM public.comanda_items ci
                    JOIN public.comandas c ON c.id = ci.comanda_id
                    WHERE c.id = ANY(v_ids)
                      AND c.client_id = v_client_id
                      AND c.status = 'open'
                      AND ci.service_id IS NOT NULL
                    GROUP BY ci.service_id
                LOOP
                    IF v_service_id IS NOT NULL THEN
                        v_service_key := v_service_id::text;

                        v_credit_consumed := 0;

                        PERFORM public.deduct_chef_club_credits(
                            v_subscription_id,
                            v_service_id,
                            v_item_count,
                            'Baixa em massa - Comandas'
                        );

                        v_credit_consumed := v_item_count;

                        v_current_service := COALESCE(
                            (v_credits_by_service -> v_service_key)::jsonb,
                            ('{"service_id": "' || v_service_key || '", "consumed": 0}')::jsonb
                        );

                        v_current_service := jsonb_set(
                            v_current_service,
                            '{consumed}',
                            to_jsonb((v_current_service ->> 'consumed')::integer + v_credit_consumed)
                        );

                        v_credits_by_service := jsonb_set(
                            v_credits_by_service,
                            ARRAY[v_service_key],
                            v_current_service,
                            true
                        );

                        v_credits_consumed := v_credits_consumed || jsonb_build_object(
                            'subscription_id', v_subscription_id,
                            'service_id', v_service_id,
                            'consumed', v_credit_consumed
                        );
                    END IF;
                END LOOP;
            END IF;
        END LOOP;
    END IF;

    UPDATE public.comandas
    SET
        status = 'paid',
        closure_mode = 'standard',
        closure_note = NULLIF(BTRIM(p_closure_note), ''),
        financial_effect = true,
        membership_credit_effect = p_apply_credits,
        payment_method = p_payment_method,
        closed_at = NOW()
    WHERE id = ANY(v_ids)
        AND status = 'open'
        AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id);

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    UPDATE public.appointments
    SET status = 'completed'
    WHERE id IN (
        SELECT appointment_id
        FROM public.comandas
        WHERE id = ANY(v_ids)
            AND appointment_id IS NOT NULL
            AND status = 'paid'
            AND closure_mode = 'standard'
    );

    RETURN jsonb_build_object(
        'updated_count', v_updated_count,
        'closure_mode', 'standard',
        'financial_effect', true,
        'membership_credit_effect', p_apply_credits,
        'credits_consumed', jsonb_build_object(
            'total', jsonb_array_length(v_credits_consumed),
            'by_service', v_credits_by_service
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.bulk_close_comandas_with_credits(UUID[], UUID, TEXT, TEXT, BOOLEAN) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;