-- Function to validate and fix comandas (orders/bills)
-- Fixes:
-- 1. Orphaned items (items without valid comanda)
-- 2. Comandas with negative totals
-- 3. Stale open comandas (older than 24h)
CREATE OR REPLACE FUNCTION public.validate_and_fix_comandas(p_tenant_id UUID)
RETURNS TABLE(
  fix_type TEXT,
  comanda_id UUID,
  description TEXT,
  fixed BOOLEAN
) AS $$
BEGIN
  -- 1. Find orphaned comanda_items
  RETURN QUERY
  SELECT 
    'orphaned_items'::TEXT AS fix_type,
    ci.id AS comanda_id,
    ('Item references missing comanda_id: ' || ci.comanda_id::TEXT)::TEXT AS description,
    false AS fixed
  FROM public.comanda_items ci
  WHERE ci.comanda_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.comandas c WHERE c.id = ci.comanda_id)
  LIMIT 100;
  
  -- 2. Find comandas with negative totals
  RETURN QUERY
  SELECT 'negative_total'::TEXT AS fix_type, c.id,
    ('Comanda has negative total: ' || c.total::TEXT)::TEXT AS description,
    false AS fixed
  FROM public.comandas c WHERE c.total < 0;
  
  -- 3. Find stale open comandas
  RETURN QUERY
  SELECT 'stale_comanda'::TEXT AS fix_type, c.id,
    ('Open comanda older than 24h')::TEXT AS description,
    false AS fixed
  FROM public.comandas c
  WHERE c.status = 'open' AND c.created_at < NOW() - INTERVAL '24 hours';

  -- 4. Auto-cancel stale open comandas
  UPDATE public.comandas
  SET status = 'cancelled'
  WHERE status = 'open' AND created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- View for quick overview of comanda health
CREATE OR REPLACE VIEW public.comandas_health AS
SELECT 
  c.status,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE c.status = 'open') AS open_comandas,
  COUNT(*) FILTER (WHERE c.status = 'paid') AS paid_comandas,
  COUNT(*) FILTER (WHERE c.status = 'cancelled') AS cancelled_comandas,
  COUNT(*) FILTER (WHERE c.created_at < NOW() - INTERVAL '24 hours' AND c.status = 'open') AS stale_open,
  SUM(c.total) FILTER (WHERE c.status = 'paid') AS total_paid
FROM public.comandas c
GROUP BY c.status;