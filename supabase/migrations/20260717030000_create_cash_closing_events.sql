-- Migration: Create cash_closing_events table
-- Timeline of events during a cash register session.
-- Records opening, sales, sangrias, reversals, closings, etc.

CREATE TABLE IF NOT EXISTS public.cash_closing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cash_closing_id UUID REFERENCES public.cash_closings(id) ON DELETE CASCADE,
  barber_closing_id UUID REFERENCES public.barber_closings(id) ON DELETE SET NULL,
  business_date DATE NOT NULL,

  -- Event details
  event_type TEXT NOT NULL CHECK (event_type IN (
    'opening',
    'service',
    'sangria',
    'suprimento',
    'reversal',
    'closing',
    'barber_closing',
    'audit',
    'adjustment'
  )),
  event_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  label TEXT NOT NULL,
  detail TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Audit
  created_by_user_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: tenant isolation
ALTER TABLE public.cash_closing_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cash_closing_events_tenant_isolation" ON public.cash_closing_events;
CREATE POLICY "cash_closing_events_tenant_isolation"
  ON public.cash_closing_events FOR ALL
  USING (tenant_id = public.current_tenant_id_from_auth_uid())
  WITH CHECK (tenant_id = public.current_tenant_id_from_auth_uid());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cash_closing_events_tenant_date
  ON public.cash_closing_events (tenant_id, business_date);

CREATE INDEX IF NOT EXISTS idx_cash_closing_events_cash_closing
  ON public.cash_closing_events (cash_closing_id);

CREATE INDEX IF NOT EXISTS idx_cash_closing_events_barber_closing
  ON public.cash_closing_events (barber_closing_id);

CREATE INDEX IF NOT EXISTS idx_cash_closing_events_time
  ON public.cash_closing_events (tenant_id, business_date, event_time);

-- Comments
COMMENT ON TABLE public.cash_closing_events IS 'Timeline events for cash register sessions. Records every significant action during the day for audit and display purposes.';
COMMENT ON COLUMN public.cash_closing_events.event_type IS 'Type of event: opening, service, sangria, suprimento, reversal, closing, barber_closing, audit, adjustment';
COMMENT ON COLUMN public.cash_closing_events.barber_closing_id IS 'Links to a specific barber closing if the event is per-barber';
COMMENT ON COLUMN public.cash_closing_events.metadata IS 'JSONB for event-specific data (amount, client name, service name, etc.)';
