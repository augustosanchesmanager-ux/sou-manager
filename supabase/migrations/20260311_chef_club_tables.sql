BEGIN;

-- ============================================================
-- Clube do Chefe: planos, assinaturas e saldo de creditos
-- ============================================================

CREATE TABLE IF NOT EXISTS public.customer_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  monthly_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  service_credits INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  priority_booking BOOLEAN NOT NULL DEFAULT false,
  product_discount NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (product_discount >= 0 AND product_discount <= 100),
  max_rollover_credits INTEGER NOT NULL DEFAULT 0,
  credit_validity_days INTEGER NOT NULL DEFAULT 30 CHECK (credit_validity_days > 0),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS public.customer_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.customer_plans(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled', 'paused')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cycle_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  cycle_end TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  next_billing_date DATE NOT NULL DEFAULT ((now() + interval '30 days')::date),
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES public.customer_subscriptions(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  available_credits INTEGER NOT NULL DEFAULT 0,
  used_credits INTEGER NOT NULL DEFAULT 0,
  period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subscription_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_plans_tenant ON public.customer_plans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customer_plans_active ON public.customer_plans(active);
CREATE INDEX IF NOT EXISTS idx_customer_subscriptions_tenant ON public.customer_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customer_subscriptions_client ON public.customer_subscriptions(client_id);
CREATE INDEX IF NOT EXISTS idx_customer_subscriptions_plan ON public.customer_subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_customer_subscriptions_status ON public.customer_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_customer_credits_tenant ON public.customer_credits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customer_credits_client ON public.customer_credits(client_id);
CREATE INDEX IF NOT EXISTS idx_customer_credits_subscription ON public.customer_credits(subscription_id);

CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_customer_plans_updated_at ON public.customer_plans;
CREATE TRIGGER trg_customer_plans_updated_at
BEFORE UPDATE ON public.customer_plans
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_customer_subscriptions_updated_at ON public.customer_subscriptions;
CREATE TRIGGER trg_customer_subscriptions_updated_at
BEFORE UPDATE ON public.customer_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_customer_credits_updated_at ON public.customer_credits;
CREATE TRIGGER trg_customer_credits_updated_at
BEFORE UPDATE ON public.customer_credits
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_timestamp();

-- RLS
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

-- Debita creditos consumidos no checkout
CREATE OR REPLACE FUNCTION public.deduct_chef_club_credits(
  p_subscription_id UUID,
  p_amount INTEGER,
  p_reference TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows INTEGER;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;

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
END;
$$;

GRANT EXECUTE ON FUNCTION public.deduct_chef_club_credits(UUID, INTEGER, TEXT) TO authenticated;

COMMIT;
