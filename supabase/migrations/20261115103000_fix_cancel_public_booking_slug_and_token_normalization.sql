-- ============================================================================
-- Migration: 20261115103000_fix_cancel_public_booking_slug_and_token_normalization.sql
-- Description:
--   1. Atualiza public.cancel_public_booking para resolver o tenant via
--      public.resolve_public_booking_tenant_id(p_tenant_identifier), suportando
--      slugs customizados de online_booking_settings.slug alem de tenants.slug/id.
--   2. Aplica normalizacao defensiva de tokens Base64 vindos de URL
--      (replace(btrim(p_public_token), ' ', '+')) antes de calcular o SHA-256.
--   3. Garante retorno idempotente caso o agendamento ja tenha sido cancelado
--      internamente no painel SMG, revogando o token se ainda nao revogado.
--   4. Garante fallback de 120 minutos em public_cancel_window_minutes quando
--      nao houver registro em tenant_settings.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cancel_public_booking(
  p_tenant_identifier TEXT,
  p_public_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  v_tenant_id UUID;
  v_normalized_token TEXT;
  v_token_hash TEXT;
  v_token RECORD;
  v_cancel_window INTEGER;
BEGIN
  IF p_tenant_identifier IS NULL OR btrim(p_tenant_identifier) = '' OR p_public_token IS NULL OR btrim(p_public_token) = '' THEN
    RAISE EXCEPTION 'invalid_token' USING ERRCODE = 'P0001';
  END IF;

  v_tenant_id := public.resolve_public_booking_tenant_id(p_tenant_identifier);

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'invalid_token' USING ERRCODE = 'P0001';
  END IF;

  v_normalized_token := replace(btrim(p_public_token), ' ', '+');
  v_token_hash := encode(extensions.digest(v_normalized_token, 'sha256'), 'hex');

  SELECT t.id, t.appointment_id, t.expires_at, t.revoked_at, a.status, a.start_time, a.staff_id, a.cancelled_at
    INTO v_token
    FROM public.public_booking_tokens t
    JOIN public.appointments a ON a.id = t.appointment_id AND a.tenant_id = v_tenant_id
   WHERE t.tenant_id = v_tenant_id
     AND t.token_hash = v_token_hash
   LIMIT 1;

  IF v_token.id IS NULL THEN
    RAISE EXCEPTION 'invalid_token' USING ERRCODE = 'P0001';
  END IF;

  IF v_token.expires_at <= now() THEN
    RAISE EXCEPTION 'token_expired' USING ERRCODE = 'P0001';
  END IF;

  IF lower(coalesce(v_token.status, '')) = 'cancelled' THEN
    IF v_token.revoked_at IS NULL THEN
      UPDATE public.public_booking_tokens
         SET revoked_at = now()
       WHERE id = v_token.id
         AND tenant_id = v_tenant_id;
    END IF;

    RETURN jsonb_build_object(
      'appointment_id', v_token.appointment_id,
      'status', 'cancelled',
      'cancelled_at', v_token.cancelled_at,
      'cancelled', true,
      'idempotent', true
    );
  END IF;

  IF v_token.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'token_revoked' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(ts.public_cancel_window_minutes, 120) INTO v_cancel_window
    FROM public.tenant_settings ts
   WHERE ts.tenant_id = v_tenant_id;

  v_cancel_window := COALESCE(v_cancel_window, 120);

  IF now() > v_token.start_time - (v_cancel_window || ' minutes')::interval THEN
    RAISE EXCEPTION 'cancellation_window_closed' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_tenant_id::text || ':' || coalesce(v_token.staff_id::text, ''), 0));

  UPDATE public.appointments
     SET status = 'cancelled', cancelled_at = now(), cancellation_type = NULL
   WHERE id = v_token.appointment_id
     AND tenant_id = v_tenant_id
     AND lower(coalesce(status, 'pending')) NOT IN ('cancelled', 'no_show', 'completed');

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'appointment_id', v_token.appointment_id,
      'status', 'cancelled',
      'cancelled_at', (SELECT cancelled_at FROM public.appointments WHERE id = v_token.appointment_id AND tenant_id = v_tenant_id),
      'cancelled', true,
      'idempotent', true
    );
  END IF;

  UPDATE public.comandas
     SET status = 'cancelled'
   WHERE appointment_id = v_token.appointment_id
     AND tenant_id = v_tenant_id
     AND status IN ('open', 'blocked');

  UPDATE public.public_booking_tokens
     SET revoked_at = now()
   WHERE id = v_token.id
     AND tenant_id = v_tenant_id;

  RETURN jsonb_build_object(
    'appointment_id', v_token.appointment_id,
    'status', 'cancelled',
    'cancelled_at', now(),
    'cancelled', true,
    'idempotent', false
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cancel_public_booking(TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cancel_public_booking(TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.cancel_public_booking(TEXT, TEXT) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
