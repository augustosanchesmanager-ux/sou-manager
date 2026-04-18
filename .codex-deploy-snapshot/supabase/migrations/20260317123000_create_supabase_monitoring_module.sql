CREATE TABLE IF NOT EXISTS public.usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type TEXT NOT NULL,
  value NUMERIC NOT NULL,
  limit_value NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS usage_logs_resource_type_created_at_idx
  ON public.usage_logs (resource_type, created_at DESC);

CREATE TABLE IF NOT EXISTS public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type TEXT NOT NULL,
  message TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('warning', 'critical')),
  current_value NUMERIC,
  limit_value NUMERIC,
  usage_pct NUMERIC,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS alerts_resource_type_created_at_idx
  ON public.alerts (resource_type, created_at DESC);

CREATE TABLE IF NOT EXISTS public.notification_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_type TEXT NOT NULL CHECK (channel_type IN ('email', 'webhook', 'internal')),
  target TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE((auth.jwt() ->> 'role') = 'super_admin', FALSE)
      OR COALESCE((auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin', FALSE);
$$;

ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_channels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super admins can read usage logs" ON public.usage_logs;
CREATE POLICY "super admins can read usage logs"
  ON public.usage_logs
  FOR SELECT
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "super admins can manage usage logs" ON public.usage_logs;
CREATE POLICY "super admins can manage usage logs"
  ON public.usage_logs
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "super admins can read alerts" ON public.alerts;
CREATE POLICY "super admins can read alerts"
  ON public.alerts
  FOR SELECT
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "super admins can manage alerts" ON public.alerts;
CREATE POLICY "super admins can manage alerts"
  ON public.alerts
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "super admins can read notification channels" ON public.notification_channels;
CREATE POLICY "super admins can read notification channels"
  ON public.notification_channels
  FOR SELECT
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "super admins can manage notification channels" ON public.notification_channels;
CREATE POLICY "super admins can manage notification channels"
  ON public.notification_channels
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());
