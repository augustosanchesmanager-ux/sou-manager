BEGIN;

-- ------------------------------------------------------------
-- Clube do Chefe: beneficios por plano, saldo por beneficio
-- e historico de consumo no fechamento da comanda
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.customer_plan_benefits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.customer_plans(id) ON DELETE CASCADE,
  benefit_code TEXT NOT NULL,
  benefit_label TEXT NOT NULL,
  monthly_quantity INTEGER NOT NULL DEFAULT 0 CHECK (monthly_quantity >= 0),
  benefit_scope TEXT NOT NULL DEFAULT 'service' CHECK (benefit_scope IN ('service', 'product', 'combo', 'manual')),
  eligible_service_ids UUID[] DEFAULT '{}'::UUID[],
  eligible_service_names TEXT[] DEFAULT '{}'::TEXT[],
  eligible_service_categories TEXT[] DEFAULT '{}'::TEXT[],
  active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plan_id, benefit_code)
);

ALTER TABLE public.customer_credits
  DROP CONSTRAINT IF EXISTS customer_credits_subscription_id_key;

ALTER TABLE public.customer_credits
  ADD COLUMN IF NOT EXISTS benefit_code TEXT NOT NULL DEFAULT 'generic_service',
  ADD COLUMN IF NOT EXISTS benefit_label TEXT NOT NULL DEFAULT 'Creditos de Servico',
  ADD COLUMN IF NOT EXISTS source_plan_benefit_id UUID REFERENCES public.customer_plan_benefits(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_consumed_at TIMESTAMPTZ;

UPDATE public.customer_credits
SET benefit_code = COALESCE(benefit_code, 'generic_service'),
    benefit_label = COALESCE(benefit_label, 'Creditos de Servico')
WHERE benefit_code IS NULL OR benefit_label IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_credits_subscription_benefit
  ON public.customer_credits(subscription_id, benefit_code);

CREATE INDEX IF NOT EXISTS idx_customer_plan_benefits_plan ON public.customer_plan_benefits(plan_id);
CREATE INDEX IF NOT EXISTS idx_customer_plan_benefits_tenant ON public.customer_plan_benefits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customer_credits_benefit_code ON public.customer_credits(benefit_code);

CREATE TABLE IF NOT EXISTS public.customer_benefit_consumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES public.customer_subscriptions(id) ON DELETE CASCADE,
  plan_benefit_id UUID REFERENCES public.customer_plan_benefits(id) ON DELETE SET NULL,
  comanda_id UUID NOT NULL REFERENCES public.comandas(id) ON DELETE CASCADE,
  comanda_item_id UUID NOT NULL REFERENCES public.comanda_items(id) ON DELETE CASCADE,
  benefit_code TEXT NOT NULL,
  benefit_label TEXT NOT NULL,
  quantity_used INTEGER NOT NULL DEFAULT 1 CHECK (quantity_used > 0),
  balance_before INTEGER NOT NULL DEFAULT 0,
  balance_after INTEGER NOT NULL DEFAULT 0,
  original_unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  final_unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  override_mode TEXT NOT NULL DEFAULT 'auto' CHECK (override_mode IN ('auto', 'manual', 'none')),
  override_reason TEXT NOT NULL DEFAULT '',
  consumed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  consumed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  UNIQUE (comanda_item_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_benefit_consumptions_tenant ON public.customer_benefit_consumptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customer_benefit_consumptions_subscription ON public.customer_benefit_consumptions(subscription_id);
CREATE INDEX IF NOT EXISTS idx_customer_benefit_consumptions_comanda ON public.customer_benefit_consumptions(comanda_id);

ALTER TABLE public.comandas
  ADD COLUMN IF NOT EXISTS chef_club_original_total NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chef_club_savings_total NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chef_club_summary JSONB NOT NULL DEFAULT '{}'::JSONB;

ALTER TABLE public.comanda_items
  ADD COLUMN IF NOT EXISTS chef_club_benefit_code TEXT,
  ADD COLUMN IF NOT EXISTS chef_club_benefit_label TEXT,
  ADD COLUMN IF NOT EXISTS chef_club_applied_quantity INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chef_club_original_unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chef_club_final_unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chef_club_override_mode TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS chef_club_override_reason TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS chef_club_plan_benefit_id UUID REFERENCES public.customer_plan_benefits(id) ON DELETE SET NULL;

UPDATE public.comanda_items
SET
  chef_club_original_unit_price = COALESCE(unit_price, 0),
  chef_club_final_unit_price = COALESCE(unit_price, 0)
WHERE chef_club_original_unit_price = 0 AND chef_club_final_unit_price = 0;

ALTER TABLE public.customer_plan_benefits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_benefit_consumptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_plan_benefits_tenant_isolation ON public.customer_plan_benefits;
CREATE POLICY customer_plan_benefits_tenant_isolation
ON public.customer_plan_benefits
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

DROP POLICY IF EXISTS customer_credits_tenant_isolation_v2 ON public.customer_credits;
CREATE POLICY customer_credits_tenant_isolation_v2
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

DROP POLICY IF EXISTS customer_benefit_consumptions_tenant_isolation ON public.customer_benefit_consumptions;
CREATE POLICY customer_benefit_consumptions_tenant_isolation
ON public.customer_benefit_consumptions
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

CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_customer_plan_benefits_updated_at ON public.customer_plan_benefits;
CREATE TRIGGER trg_customer_plan_benefits_updated_at
BEFORE UPDATE ON public.customer_plan_benefits
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_timestamp();

CREATE OR REPLACE FUNCTION public.consume_chef_club_benefits(
  p_tenant_id UUID,
  p_consumptions JSONB,
  p_actor_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  v_balance_after INTEGER;
  v_balance_before INTEGER;
BEGIN
  IF p_consumptions IS NULL OR jsonb_typeof(p_consumptions) <> 'array' THEN
    RAISE EXCEPTION 'Consumptions payload must be a JSON array';
  END IF;

  FOR rec IN
    SELECT *
    FROM jsonb_to_recordset(p_consumptions) AS payload(
      subscription_id UUID,
      client_id UUID,
      comanda_id UUID,
      comanda_item_id UUID,
      plan_benefit_id UUID,
      benefit_code TEXT,
      benefit_label TEXT,
      quantity_used INTEGER,
      original_unit_price NUMERIC,
      final_unit_price NUMERIC,
      override_mode TEXT,
      override_reason TEXT,
      balance_id UUID,
      metadata JSONB
    )
  LOOP
    IF rec.quantity_used IS NULL OR rec.quantity_used <= 0 THEN
      RAISE EXCEPTION 'Quantity used must be greater than zero';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.customer_benefit_consumptions c
      WHERE c.comanda_item_id = rec.comanda_item_id
    ) THEN
      CONTINUE;
    END IF;

    UPDATE public.customer_credits
    SET
      available_credits = available_credits - rec.quantity_used,
      used_credits = used_credits + rec.quantity_used,
      last_consumed_at = now(),
      updated_at = now()
    WHERE tenant_id = p_tenant_id
      AND subscription_id = rec.subscription_id
      AND benefit_code = rec.benefit_code
      AND available_credits >= rec.quantity_used
    RETURNING available_credits INTO v_balance_after;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insufficient balance for benefit %', rec.benefit_code;
    END IF;

    v_balance_before := v_balance_after + rec.quantity_used;

    INSERT INTO public.customer_benefit_consumptions (
      tenant_id,
      client_id,
      subscription_id,
      plan_benefit_id,
      comanda_id,
      comanda_item_id,
      benefit_code,
      benefit_label,
      quantity_used,
      balance_before,
      balance_after,
      original_unit_price,
      final_unit_price,
      override_mode,
      override_reason,
      consumed_by,
      metadata
    ) VALUES (
      p_tenant_id,
      rec.client_id,
      rec.subscription_id,
      rec.plan_benefit_id,
      rec.comanda_id,
      rec.comanda_item_id,
      rec.benefit_code,
      rec.benefit_label,
      rec.quantity_used,
      v_balance_before,
      v_balance_after,
      COALESCE(rec.original_unit_price, 0),
      COALESCE(rec.final_unit_price, 0),
      COALESCE(rec.override_mode, 'auto'),
      COALESCE(rec.override_reason, ''),
      p_actor_id,
      COALESCE(rec.metadata, '{}'::jsonb)
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.close_order_with_chef_club(
  p_comanda_id UUID,
  p_tenant_id UUID,
  p_consumptions JSONB DEFAULT '[]'::JSONB,
  p_actor_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.close_order(p_comanda_id);

  IF p_consumptions IS NOT NULL AND jsonb_typeof(p_consumptions) = 'array' AND jsonb_array_length(p_consumptions) > 0 THEN
    PERFORM public.consume_chef_club_benefits(p_tenant_id, p_consumptions, p_actor_id);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_chef_club_benefits(UUID, JSONB, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_order_with_chef_club(UUID, UUID, JSONB, UUID) TO authenticated;

COMMIT;
