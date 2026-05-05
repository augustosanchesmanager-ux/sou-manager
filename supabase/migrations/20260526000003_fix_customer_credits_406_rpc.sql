BEGIN;

-- Create RPC to safely get current credits for a subscription (handles multiple cycles)
CREATE OR REPLACE FUNCTION get_current_subscription_credits(
  p_subscription_id UUID,
  p_tenant_id UUID
)
RETURNS TABLE (
  id UUID,
  available_credits NUMERIC,
  used_credits NUMERIC,
  service_balance_map JSONB,
  period_start TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cc.id,
    cc.available_credits,
    cc.used_credits,
    cc.service_balance_map,
    cc.period_start
  FROM public.customer_credits cc
  WHERE cc.subscription_id = p_subscription_id
    AND cc.tenant_id = p_tenant_id
  ORDER BY cc.period_start DESC
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION get_current_subscription_credits(UUID, UUID) TO anon, authenticated, service_role;

COMMENT ON FUNCTION get_current_subscription_credits IS
'Returns the most recent credits record for a subscription. Use this instead of
 querying customer_credits directly with .maybeSingle() which fails with 406
 when multiple cycle records exist (per Phase 5 per-cycle credits).';