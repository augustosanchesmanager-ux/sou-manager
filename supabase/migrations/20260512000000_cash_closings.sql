BEGIN;

CREATE TABLE IF NOT EXISTS public.cash_closings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  business_date DATE NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,

  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'confirmed', 'adjusted')),

  created_by_user_id UUID REFERENCES public.profiles(id),
  confirmed_by_user_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  confirmed_at TIMESTAMPTZ,

  notes TEXT,

  expected_income NUMERIC NOT NULL DEFAULT 0,
  expected_expense NUMERIC NOT NULL DEFAULT 0,
  expected_balance NUMERIC NOT NULL DEFAULT 0,

  total_counted NUMERIC NOT NULL DEFAULT 0,
  total_difference NUMERIC NOT NULL DEFAULT 0,

  appointments_scheduled_count INTEGER NOT NULL DEFAULT 0,
  appointments_completed_count INTEGER NOT NULL DEFAULT 0,
  appointments_received_count INTEGER NOT NULL DEFAULT 0,
  appointments_cancelled_count INTEGER NOT NULL DEFAULT 0,
  appointments_pending_count INTEGER NOT NULL DEFAULT 0,
  appointments_no_show_count INTEGER NOT NULL DEFAULT 0,

  appointments_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  financial_summary JSONB NOT NULL DEFAULT '{}'::jsonb,

  UNIQUE (tenant_id, business_date)
);

ALTER TABLE public.cash_closings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own tenant cash closings"
  ON public.cash_closings FOR ALL
  USING (tenant_id = public.current_tenant_id_from_auth_uid())
  WITH CHECK (tenant_id = public.current_tenant_id_from_auth_uid());

CREATE OR REPLACE FUNCTION public.update_cash_closing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cash_closings_updated_at
  BEFORE UPDATE ON public.cash_closings
  FOR EACH ROW EXECUTE FUNCTION public.update_cash_closing_updated_at();

COMMIT;
