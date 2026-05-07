BEGIN;

-- ============================================================
-- Clube dos Chefes: criação transacional de assinatura + créditos
-- ============================================================

ALTER TABLE public.customer_plans
  ADD COLUMN IF NOT EXISTS service_credit_map JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.customer_credits
  ADD COLUMN IF NOT EXISTS service_balance_map JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.customer_plans
SET service_credit_map = '[]'::jsonb
WHERE service_credit_map IS NULL;

UPDATE public.customer_credits
SET service_balance_map = '[]'::jsonb
WHERE service_balance_map IS NULL;

ALTER TABLE public.customer_plans
  ALTER COLUMN service_credit_map SET DEFAULT '[]'::jsonb,
  ALTER COLUMN service_credit_map SET NOT NULL;

ALTER TABLE public.customer_credits
  ALTER COLUMN service_balance_map SET DEFAULT '[]'::jsonb,
  ALTER COLUMN service_balance_map SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'customer_credits_subscription_id_key'
      AND conrelid = 'public.customer_credits'::regclass
  ) THEN
    ALTER TABLE public.customer_credits
      ADD CONSTRAINT customer_credits_subscription_id_key UNIQUE (subscription_id);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_customer_subscriptions_tenant_client_status
  ON public.customer_subscriptions(tenant_id, client_id, status);

CREATE INDEX IF NOT EXISTS idx_customer_credits_tenant_client_subscription
  ON public.customer_credits(tenant_id, client_id, subscription_id);

CREATE INDEX IF NOT EXISTS idx_customer_plans_tenant_active
  ON public.customer_plans(tenant_id, active);

ALTER TABLE public.customer_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_plans_tenant_isolation ON public.customer_plans;
CREATE POLICY customer_plans_tenant_isolation
ON public.customer_plans
FOR ALL
TO authenticated
USING (
  public.current_is_super_admin_from_auth_uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
)
WITH CHECK (
  public.current_is_super_admin_from_auth_uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
);

DROP POLICY IF EXISTS customer_subscriptions_tenant_isolation ON public.customer_subscriptions;
CREATE POLICY customer_subscriptions_tenant_isolation
ON public.customer_subscriptions
FOR ALL
TO authenticated
USING (
  public.current_is_super_admin_from_auth_uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
)
WITH CHECK (
  public.current_is_super_admin_from_auth_uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
);

DROP POLICY IF EXISTS customer_credits_tenant_isolation ON public.customer_credits;
CREATE POLICY customer_credits_tenant_isolation
ON public.customer_credits
FOR ALL
TO authenticated
USING (
  public.current_is_super_admin_from_auth_uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
)
WITH CHECK (
  public.current_is_super_admin_from_auth_uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
);

CREATE OR REPLACE FUNCTION public.create_chef_club_subscription(
  p_tenant_id UUID,
  p_client_id UUID,
  p_plan_id UUID,
  p_next_billing_date DATE,
  p_replace_existing BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_tenant_id UUID;
  v_is_super_admin BOOLEAN;
  v_plan public.customer_plans%ROWTYPE;
  v_subscription public.customer_subscriptions%ROWTYPE;
  v_existing_subscription public.customer_subscriptions%ROWTYPE;
  v_cycle_start TIMESTAMPTZ := now();
  v_cycle_end TIMESTAMPTZ;
  v_service_balance_map JSONB;
  v_total_credits INTEGER;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant obrigatório';
  END IF;

  IF p_client_id IS NULL THEN
    RAISE EXCEPTION 'Cliente obrigatório';
  END IF;

  IF p_plan_id IS NULL THEN
    RAISE EXCEPTION 'Plano obrigatório';
  END IF;

  IF p_next_billing_date IS NULL THEN
    RAISE EXCEPTION 'Próxima cobrança obrigatória';
  END IF;

  SELECT public.current_tenant_id_from_auth_uid(), public.current_is_super_admin_from_auth_uid()
  INTO v_auth_tenant_id, v_is_super_admin;

  IF NOT COALESCE(v_is_super_admin, false) AND v_auth_tenant_id IS DISTINCT FROM p_tenant_id THEN
    RAISE EXCEPTION 'Tenant não autorizado';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'Tenant não encontrado';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = p_client_id
      AND c.tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'Cliente não encontrado para este tenant';
  END IF;

  SELECT *
  INTO v_plan
  FROM public.customer_plans cp
  WHERE cp.id = p_plan_id
    AND cp.tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plano não encontrado para este tenant';
  END IF;

  IF NOT COALESCE(v_plan.active, false) THEN
    RAISE EXCEPTION 'Plano inativo';
  END IF;

  IF jsonb_typeof(COALESCE(v_plan.service_credit_map, '[]'::jsonb)) <> 'array'
     OR jsonb_array_length(COALESCE(v_plan.service_credit_map, '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'Plano sem créditos por serviço configurados';
  END IF;

  SELECT
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'service_id', service_id,
          'service_name', service_name,
          'available', credits,
          'used', 0
        )
        ORDER BY ordinality
      ),
      '[]'::jsonb
    ),
    COALESCE(SUM(credits), 0)::INTEGER
  INTO v_service_balance_map, v_total_credits
  FROM (
    SELECT
      NULLIF(BTRIM(entry.value ->> 'service_id'), '') AS service_id,
      NULLIF(BTRIM(entry.value ->> 'service_name'), '') AS service_name,
      GREATEST(0, COALESCE((entry.value ->> 'credits')::INTEGER, 0)) AS credits,
      entry.ordinality
    FROM jsonb_array_elements(v_plan.service_credit_map) WITH ORDINALITY AS entry(value, ordinality)
  ) normalized
  WHERE service_id IS NOT NULL
    AND service_name IS NOT NULL
    AND credits > 0;

  IF v_total_credits <= 0 OR jsonb_array_length(v_service_balance_map) = 0 THEN
    RAISE EXCEPTION 'Plano sem créditos por serviço configurados';
  END IF;

  v_cycle_end := (p_next_billing_date::TIMESTAMP + time '12:00')::TIMESTAMPTZ;

  SELECT *
  INTO v_existing_subscription
  FROM public.customer_subscriptions cs
  WHERE cs.tenant_id = p_tenant_id
    AND cs.client_id = p_client_id
    AND cs.status = 'active'
  ORDER BY cs.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF NOT p_replace_existing THEN
      RAISE EXCEPTION 'Cliente já possui assinatura ativa';
    END IF;

    UPDATE public.customer_subscriptions
    SET
      plan_id = p_plan_id,
      status = 'active',
      cycle_start = v_cycle_start,
      cycle_end = v_cycle_end,
      next_billing_date = p_next_billing_date,
      canceled_at = NULL,
      updated_at = now()
    WHERE id = v_existing_subscription.id
    RETURNING * INTO v_subscription;
  ELSE
    INSERT INTO public.customer_subscriptions (
      tenant_id,
      client_id,
      plan_id,
      status,
      started_at,
      cycle_start,
      cycle_end,
      next_billing_date
    )
    VALUES (
      p_tenant_id,
      p_client_id,
      p_plan_id,
      'active',
      v_cycle_start,
      v_cycle_start,
      v_cycle_end,
      p_next_billing_date
    )
    RETURNING * INTO v_subscription;
  END IF;

  INSERT INTO public.customer_credits (
    tenant_id,
    client_id,
    subscription_id,
    available_credits,
    used_credits,
    service_balance_map,
    period_start,
    period_end
  )
  VALUES (
    p_tenant_id,
    p_client_id,
    v_subscription.id,
    v_total_credits,
    0,
    v_service_balance_map,
    v_subscription.cycle_start,
    v_subscription.cycle_end
  )
  ON CONFLICT (subscription_id) DO UPDATE
  SET
    tenant_id = EXCLUDED.tenant_id,
    client_id = EXCLUDED.client_id,
    available_credits = EXCLUDED.available_credits,
    used_credits = EXCLUDED.used_credits,
    service_balance_map = EXCLUDED.service_balance_map,
    period_start = EXCLUDED.period_start,
    period_end = EXCLUDED.period_end,
    updated_at = now()
  WHERE p_replace_existing
     OR (
       public.customer_credits.used_credits = 0
       AND public.customer_credits.available_credits = 0
       AND (
         public.customer_credits.service_balance_map = '[]'::jsonb
         OR public.customer_credits.service_balance_map = '{}'::jsonb
       )
     );

  RETURN jsonb_build_object(
    'subscription', to_jsonb(v_subscription),
    'credits', (
      SELECT to_jsonb(cc)
      FROM public.customer_credits cc
      WHERE cc.subscription_id = v_subscription.id
      LIMIT 1
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_chef_club_subscription(UUID, UUID, UUID, DATE, BOOLEAN) TO authenticated;

-- Prévia do backfill seguro:
-- SELECT cs.id AS subscription_id, cs.tenant_id, cs.client_id, cs.plan_id, cp.name AS plan_name, cp.service_credit_map
-- FROM public.customer_subscriptions cs
-- JOIN public.customer_plans cp ON cp.id = cs.plan_id AND cp.tenant_id = cs.tenant_id
-- LEFT JOIN public.customer_credits cc ON cc.subscription_id = cs.id
-- WHERE cs.status = 'active'
--   AND jsonb_typeof(COALESCE(cp.service_credit_map, '[]'::jsonb)) = 'array'
--   AND jsonb_array_length(COALESCE(cp.service_credit_map, '[]'::jsonb)) > 0
--   AND (
--     cc.id IS NULL
--     OR (
--       cc.available_credits = 0
--       AND cc.used_credits = 0
--       AND (cc.service_balance_map = '[]'::jsonb OR cc.service_balance_map = '{}'::jsonb)
--     )
--   );

WITH backfill_source AS (
  SELECT
    cs.id AS subscription_id,
    cs.tenant_id,
    cs.client_id,
    cs.cycle_start,
    cs.cycle_end,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'service_id', normalized.service_id,
          'service_name', normalized.service_name,
          'available', normalized.credits,
          'used', 0
        )
        ORDER BY normalized.ordinality
      ),
      '[]'::jsonb
    ) AS service_balance_map,
    COALESCE(SUM(normalized.credits), 0)::INTEGER AS available_credits
  FROM public.customer_subscriptions cs
  JOIN public.customer_plans cp
    ON cp.id = cs.plan_id
   AND cp.tenant_id = cs.tenant_id
  LEFT JOIN public.customer_credits cc
    ON cc.subscription_id = cs.id
  CROSS JOIN LATERAL (
    SELECT
      NULLIF(BTRIM(entry.value ->> 'service_id'), '') AS service_id,
      NULLIF(BTRIM(entry.value ->> 'service_name'), '') AS service_name,
      GREATEST(0, COALESCE((entry.value ->> 'credits')::INTEGER, 0)) AS credits,
      entry.ordinality
    FROM jsonb_array_elements(COALESCE(cp.service_credit_map, '[]'::jsonb)) WITH ORDINALITY AS entry(value, ordinality)
    WHERE jsonb_typeof(COALESCE(cp.service_credit_map, '[]'::jsonb)) = 'array'
  ) normalized
  WHERE cs.status = 'active'
    AND normalized.service_id IS NOT NULL
    AND normalized.service_name IS NOT NULL
    AND normalized.credits > 0
    AND (
      cc.id IS NULL
      OR (
        cc.available_credits = 0
        AND cc.used_credits = 0
        AND (cc.service_balance_map = '[]'::jsonb OR cc.service_balance_map = '{}'::jsonb)
      )
    )
  GROUP BY cs.id, cs.tenant_id, cs.client_id, cs.cycle_start, cs.cycle_end
  HAVING COALESCE(SUM(normalized.credits), 0) > 0
)
INSERT INTO public.customer_credits (
  tenant_id,
  client_id,
  subscription_id,
  available_credits,
  used_credits,
  service_balance_map,
  period_start,
  period_end
)
SELECT
  tenant_id,
  client_id,
  subscription_id,
  available_credits,
  0,
  service_balance_map,
  cycle_start,
  cycle_end
FROM backfill_source
ON CONFLICT (subscription_id) DO UPDATE
SET
  tenant_id = EXCLUDED.tenant_id,
  client_id = EXCLUDED.client_id,
  available_credits = EXCLUDED.available_credits,
  used_credits = 0,
  service_balance_map = EXCLUDED.service_balance_map,
  period_start = EXCLUDED.period_start,
  period_end = EXCLUDED.period_end,
  updated_at = now()
WHERE public.customer_credits.available_credits = 0
  AND public.customer_credits.used_credits = 0
  AND (
    public.customer_credits.service_balance_map = '[]'::jsonb
    OR public.customer_credits.service_balance_map = '{}'::jsonb
  );

NOTIFY pgrst, 'reload schema';

COMMIT;
