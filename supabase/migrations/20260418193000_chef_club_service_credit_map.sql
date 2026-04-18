BEGIN;

ALTER TABLE public.customer_plans
ADD COLUMN IF NOT EXISTS service_credit_map JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.customer_credits
ADD COLUMN IF NOT EXISTS service_balance_map JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION public.deduct_chef_club_credits(
  p_subscription_id UUID,
  p_service_id UUID DEFAULT NULL,
  p_amount INTEGER DEFAULT 1,
  p_reference TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credit_record public.customer_credits%ROWTYPE;
  v_rows INTEGER;
  v_balance_index INTEGER;
  v_balance JSONB;
  v_available INTEGER;
  v_used INTEGER;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;

  IF p_service_id IS NULL THEN
    UPDATE public.customer_credits
    SET
      available_credits = available_credits - p_amount,
      used_credits = used_credits + p_amount,
      updated_at = now()
    WHERE subscription_id = p_subscription_id
      AND available_credits >= p_amount;

    GET DIAGNOSTICS v_rows = ROW_COUNT;

    IF v_rows = 0 THEN
      RAISE EXCEPTION 'Insufficient credits or subscription not found';
    END IF;

    RETURN;
  END IF;

  SELECT *
  INTO v_credit_record
  FROM public.customer_credits
  WHERE subscription_id = p_subscription_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription credits not found';
  END IF;

  SELECT ordinality - 1, value
  INTO v_balance_index, v_balance
  FROM jsonb_array_elements(COALESCE(v_credit_record.service_balance_map, '[]'::jsonb)) WITH ORDINALITY AS entries(value, ordinality)
  WHERE value ->> 'service_id' = p_service_id::text
  LIMIT 1;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'No credits configured for this service';
  END IF;

  v_available := COALESCE((v_balance ->> 'available')::INTEGER, 0);
  v_used := COALESCE((v_balance ->> 'used')::INTEGER, 0);

  IF v_available < p_amount THEN
    RAISE EXCEPTION 'Insufficient credits for this service';
  END IF;

  v_balance := jsonb_set(v_balance, '{available}', to_jsonb(v_available - p_amount));
  v_balance := jsonb_set(v_balance, '{used}', to_jsonb(v_used + p_amount));

  UPDATE public.customer_credits
  SET
    available_credits = GREATEST(0, available_credits - p_amount),
    used_credits = used_credits + p_amount,
    service_balance_map = jsonb_set(
      COALESCE(service_balance_map, '[]'::jsonb),
      ARRAY[v_balance_index::text],
      v_balance,
      false
    ),
    updated_at = now()
  WHERE id = v_credit_record.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.deduct_chef_club_credits(UUID, UUID, INTEGER, TEXT) TO authenticated;

COMMIT;
