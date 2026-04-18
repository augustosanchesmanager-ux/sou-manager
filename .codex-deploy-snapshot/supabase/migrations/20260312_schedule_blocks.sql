BEGIN;

CREATE TABLE IF NOT EXISTS public.schedule_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  professional_id uuid NULL REFERENCES public.staff(id) ON DELETE SET NULL,
  block_type text NOT NULL CHECK (block_type IN ('full_day', 'time_range')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  start_time time NULL,
  end_time time NULL,
  reason text NOT NULL,
  notes text NULL,
  recurrence_type text NOT NULL DEFAULT 'none' CHECK (recurrence_type IN ('none', 'weekly')),
  recurrence_until date NULL,
  existing_appointments_action text NOT NULL DEFAULT 'keep' CHECK (existing_appointments_action IN ('keep', 'review', 'cancel')),
  created_by uuid NULL,
  removed_by uuid NULL,
  removed_at timestamptz NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT schedule_blocks_date_range_check CHECK (end_date >= start_date),
  CONSTRAINT schedule_blocks_time_order_check CHECK (
    block_type = 'full_day'
    OR (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
  ),
  CONSTRAINT schedule_blocks_full_day_time_null_check CHECK (
    block_type <> 'full_day'
    OR (start_time IS NULL AND end_time IS NULL)
  ),
  CONSTRAINT schedule_blocks_weekly_single_day_check CHECK (
    recurrence_type <> 'weekly'
    OR start_date = end_date
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_schedule_blocks_unique_active
ON public.schedule_blocks (
  tenant_id,
  COALESCE(professional_id, '00000000-0000-0000-0000-000000000000'::uuid),
  block_type,
  start_date,
  end_date,
  COALESCE(start_time, '00:00:00'::time),
  COALESCE(end_time, '00:00:00'::time),
  COALESCE(recurrence_type, 'none'),
  COALESCE(recurrence_until, start_date)
)
WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_schedule_blocks_tenant_dates
ON public.schedule_blocks (tenant_id, start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_schedule_blocks_professional
ON public.schedule_blocks (tenant_id, professional_id, status);

ALTER TABLE public.schedule_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_schedule_blocks ON public.schedule_blocks;
CREATE POLICY tenant_isolation_schedule_blocks
ON public.schedule_blocks
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

DROP POLICY IF EXISTS public_select_schedule_blocks ON public.schedule_blocks;
CREATE POLICY public_select_schedule_blocks
ON public.schedule_blocks
FOR SELECT
TO anon
USING (status = 'active');

DROP TRIGGER IF EXISTS trg_schedule_blocks_updated_at ON public.schedule_blocks;
CREATE TRIGGER trg_schedule_blocks_updated_at
BEFORE UPDATE ON public.schedule_blocks
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_timestamp();

COMMIT;
