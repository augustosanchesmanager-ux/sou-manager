-- Function to automatically detect and mark no-show appointments
-- Run this periodically (e.g., every 15 minutes via cron)
CREATE OR REPLACE FUNCTION public.detect_no_show_appointments(
  p_tenant_id UUID,
  p_grace_minutes INTEGER DEFAULT 15
)
RETURNS TABLE(
  appointment_id UUID,
  client_name TEXT,
  start_time TIMESTAMPTZ,
  minutes_late INTEGER
) AS $$
DECLARE
  v_now TIMESTAMPTZ;
  v_threshold TIMESTAMPTZ;
BEGIN
  v_now := NOW();
  v_threshold := v_now - (p_grace_minutes || ' minutes')::INTERVAL;
  
  -- Update appointments that are past the grace period
  UPDATE public.appointments
  SET 
    status = 'no_show',
    cancellation_reason = 'no_show',
    cancelled_at = v_now
  WHERE 
    tenant_id = p_tenant_id
    AND status IN ('pending', 'confirmed')
    AND start_time < v_threshold
    AND cancelled_at IS NULL;
  
  -- Return the updated appointments
  RETURN QUERY
  SELECT 
    apt.id,
    apt.client_name,
    apt.start_time,
    EXTRACT(EPOCH FROM (v_now - apt.start_time)) / 60 AS minutes_late
  FROM public.appointments apt
  WHERE 
    apt.tenant_id = p_tenant_id
    AND apt.status = 'no_show'
    AND apt.cancelled_at >= v_now - INTERVAL '1 minute';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comment
COMMENT ON FUNCTION public.detect_no_show_appointments IS 
'Detects appointments that have passed the grace period without check-in and marks them as no_show.
Parameters:
  p_tenant_id: UUID - The tenant ID to filter appointments
  p_grace_minutes: INTEGER - Minutes after start_time to consider as no_show (default 15)
Returns: Table with detected no-show appointments';