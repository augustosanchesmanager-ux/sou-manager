BEGIN;

-- ============================================================
-- Clube do Chefe: tabela e helpers de recebimentos
-- ============================================================

-- ============================================================
-- Clube do Chefe: recebimentos mensais e baixa transacional
-- ============================================================

CREATE TABLE IF NOT EXISTS public.customer_subscription_receivables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES public.customer_subscriptions(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.customer_plans(id) ON DELETE RESTRICT,
  billing_cycle_start TIMESTAMPTZ NOT NULL,
  billing_cycle_end TIMESTAMPTZ NOT NULL,
  due_date DATE NOT NULL,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled', 'refunded')),
  payment_method TEXT,
  paid_at TIMESTAMPTZ,
  paid_by UUID,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (billing_cycle_end > billing_cycle_start),
  CHECK (
    (status = 'paid' AND paid_at IS NOT NULL)
    OR (status <> 'paid')
  ),
  UNIQUE (subscription_id, billing_cycle_start, billing_cycle_end)
);

CREATE INDEX IF NOT EXISTS idx_club_receivables_tenant_status_due
  ON public.customer_subscription_receivables(tenant_id, status, due_date);

CREATE INDEX IF NOT EXISTS idx_club_receivables_customer
  ON public.customer_subscription_receivables(tenant_id, customer_id);

CREATE INDEX IF NOT EXISTS idx_club_receivables_subscription
  ON public.customer_subscription_receivables(subscription_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_club_receivables_transaction_id
  ON public.customer_subscription_receivables(transaction_id)
  WHERE transaction_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_customer_subscription_receivables_updated_at ON public.customer_subscription_receivables;
CREATE TRIGGER trg_customer_subscription_receivables_updated_at
BEFORE UPDATE ON public.customer_subscription_receivables
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_timestamp();

ALTER TABLE public.customer_subscription_receivables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_subscription_receivables_tenant_isolation ON public.customer_subscription_receivables;
CREATE POLICY customer_subscription_receivables_tenant_isolation
ON public.customer_subscription_receivables
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

CREATE OR REPLACE FUNCTION public.build_chef_club_service_balance_map(p_plan_id UUID)
RETURNS TABLE (
  service_balance_map JSONB,
  total_credits INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.customer_plans%ROWTYPE;
BEGIN
  SELECT *
  INTO v_plan
  FROM public.customer_plans
  WHERE id = p_plan_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plano não encontrado';
  END IF;

  RETURN QUERY
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
    ) AS service_balance_map,
    COALESCE(SUM(credits), 0)::INTEGER AS total_credits
  FROM (
    SELECT
      NULLIF(BTRIM(entry.value ->> 'service_id'), '') AS service_id,
      NULLIF(BTRIM(entry.value ->> 'service_name'), '') AS service_name,
      GREATEST(0, COALESCE((entry.value ->> 'credits')::INTEGER, 0)) AS credits,
      entry.ordinality
    FROM jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(COALESCE(v_plan.service_credit_map, '[]'::jsonb)) = 'array'
          THEN COALESCE(v_plan.service_credit_map, '[]'::jsonb)
        ELSE '[]'::jsonb
      END
    ) WITH ORDINALITY AS entry(value, ordinality)
  ) normalized
  WHERE service_id IS NOT NULL
    AND service_name IS NOT NULL
    AND credits > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_club_receivable_for_cycle(
  p_subscription_id UUID,
  p_billing_cycle_start TIMESTAMPTZ DEFAULT NULL,
  p_billing_cycle_end TIMESTAMPTZ DEFAULT NULL,
  p_due_date DATE DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_tenant_id UUID;
  v_is_super_admin BOOLEAN;
  v_subscription public.customer_subscriptions%ROWTYPE;
  v_plan public.customer_plans%ROWTYPE;
  v_cycle_start TIMESTAMPTZ;
  v_cycle_end TIMESTAMPTZ;
  v_due_date DATE;
  v_receivable_id UUID;
BEGIN
  SELECT public.current_tenant_id_from_auth_uid(), public.current_is_super_admin_from_auth_uid()
  INTO v_auth_tenant_id, v_is_super_admin;

  SELECT *
  INTO v_subscription
  FROM public.customer_subscriptions
  WHERE id = p_subscription_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assinatura não encontrada';
  END IF;

  IF auth.uid() IS NOT NULL
     AND NOT COALESCE(v_is_super_admin, false)
     AND v_auth_tenant_id IS DISTINCT FROM v_subscription.tenant_id THEN
    RAISE EXCEPTION 'Tenant não autorizado';
  END IF;

  SELECT *
  INTO v_plan
  FROM public.customer_plans
  WHERE id = v_subscription.plan_id
    AND tenant_id = v_subscription.tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plano da assinatura não encontrado';
  END IF;

  v_cycle_start := COALESCE(p_billing_cycle_start, v_subscription.cycle_start);
  v_cycle_end := COALESCE(
    p_billing_cycle_end,
    CASE
      WHEN v_subscription.cycle_end > v_cycle_start THEN v_subscription.cycle_end
      ELSE v_cycle_start + interval '1 month'
    END
  );
  v_due_date := COALESCE(p_due_date, v_cycle_start::DATE);

  INSERT INTO public.customer_subscription_receivables (
    tenant_id,
    customer_id,
    subscription_id,
    plan_id,
    billing_cycle_start,
    billing_cycle_end,
    due_date,
    amount,
    status
  )
  VALUES (
    v_subscription.tenant_id,
    v_subscription.client_id,
    v_subscription.id,
    v_subscription.plan_id,
    v_cycle_start,
    v_cycle_end,
    v_due_date,
    COALESCE(v_plan.monthly_price, 0),
    CASE WHEN v_due_date < current_date THEN 'overdue' ELSE 'pending' END
  )
  ON CONFLICT (subscription_id, billing_cycle_start, billing_cycle_end) DO UPDATE
  SET
    plan_id = EXCLUDED.plan_id,
    amount = EXCLUDED.amount,
    due_date = EXCLUDED.due_date,
    status = CASE
      WHEN public.customer_subscription_receivables.status = 'pending'
        AND EXCLUDED.due_date < current_date THEN 'overdue'
      ELSE public.customer_subscription_receivables.status
    END,
    updated_at = now()
  RETURNING id INTO v_receivable_id;

  RETURN v_receivable_id;
END;
$$;

REVOKE ALL ON TABLE public.customer_subscription_receivables FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.customer_subscription_receivables TO authenticated;
REVOKE ALL ON FUNCTION public.build_chef_club_service_balance_map(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ensure_club_receivable_for_cycle(UUID, TIMESTAMPTZ, TIMESTAMPTZ, DATE) FROM PUBLIC, anon, authenticated;

COMMIT;
