-- Migration: Create barber_closings table
-- Individual cash register closing records per barber/professional.
-- Complements (does not replace) the general cash_closings record.

CREATE TABLE IF NOT EXISTS public.barber_closings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cash_closing_id UUID NOT NULL REFERENCES public.cash_closings(id) ON DELETE CASCADE,
  business_date DATE NOT NULL,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT,

  -- Status
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'discrepancy')),

  -- Financial summary (per barber)
  total_produced NUMERIC NOT NULL DEFAULT 0,
  total_received NUMERIC NOT NULL DEFAULT 0,
  commission_total NUMERIC NOT NULL DEFAULT 0,
  repasse_total NUMERIC NOT NULL DEFAULT 0,
  discounts_total NUMERIC NOT NULL DEFAULT 0,
  advances_total NUMERIC NOT NULL DEFAULT 0,
  balance NUMERIC NOT NULL DEFAULT 0,

  -- Payment method breakdown (JSONB: { "Dinheiro": 500, "PIX": 1200, ... })
  payment_methods JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Physical conference
  counted_cash NUMERIC NOT NULL DEFAULT 0,
  expected_cash NUMERIC NOT NULL DEFAULT 0,
  cash_difference NUMERIC NOT NULL DEFAULT 0,
  conference_justification TEXT,

  -- Checklist (JSONB snapshot of checklist state)
  checklist JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Counts
  comandas_count INTEGER NOT NULL DEFAULT 0,
  clients_served_count INTEGER NOT NULL DEFAULT 0,
  products_sold_count INTEGER NOT NULL DEFAULT 0,

  -- Audit
  closed_by_user_id UUID REFERENCES public.profiles(id),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  UNIQUE (tenant_id, cash_closing_id, staff_id)
);

-- RLS: tenant isolation
ALTER TABLE public.barber_closings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "barber_closings_tenant_isolation" ON public.barber_closings;
CREATE POLICY "barber_closings_tenant_isolation"
  ON public.barber_closings FOR ALL
  USING (tenant_id = public.current_tenant_id_from_auth_uid())
  WITH CHECK (tenant_id = public.current_tenant_id_from_auth_uid());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_barber_closings_tenant_date
  ON public.barber_closings (tenant_id, business_date);

CREATE INDEX IF NOT EXISTS idx_barber_closings_cash_closing
  ON public.barber_closings (cash_closing_id);

CREATE INDEX IF NOT EXISTS idx_barber_closings_staff
  ON public.barber_closings (staff_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_barber_closings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS barber_closings_updated_at ON public.barber_closings;
CREATE TRIGGER barber_closings_updated_at
  BEFORE UPDATE ON public.barber_closings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_barber_closings_updated_at();

-- Comments
COMMENT ON TABLE public.barber_closings IS 'Individual cash register closing records per barber. Complements the general cash_closings record for per-professional auditing.';
COMMENT ON COLUMN public.barber_closings.total_produced IS 'Total value of services/products produced by this barber';
COMMENT ON COLUMN public.barber_closings.total_received IS 'Total payments received by this barber';
COMMENT ON COLUMN public.barber_closings.commission_total IS 'Calculated commission for this barber';
COMMENT ON COLUMN public.barber_closings.repasse_total IS 'Amount to transfer to the barber (received minus commission)';
COMMENT ON COLUMN public.barber_closings.counted_cash IS 'Physical cash counted by the barber';
COMMENT ON COLUMN public.barber_closings.expected_cash IS 'Cash amount expected based on payment methods';
COMMENT ON COLUMN public.barber_closings.cash_difference IS 'counted_cash minus expected_cash';
COMMENT ON COLUMN public.barber_closings.checklist IS 'JSONB snapshot: { allCommandsClosed, allPaymentsCompleted, noPendingReversals, noOpenCommands, noInconsistentCommissions, conferenceDone }';
COMMENT ON COLUMN public.barber_closings.payment_methods IS 'JSONB breakdown: { "Dinheiro": 500, "PIX": 1200, "Debito": 300, ... }';
