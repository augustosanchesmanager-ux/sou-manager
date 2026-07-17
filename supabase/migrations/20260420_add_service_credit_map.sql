-- Add service_credit_map column to customer_plans
ALTER TABLE customer_plans ADD COLUMN IF NOT EXISTS service_credit_map JSONB DEFAULT '[]'::jsonb;

-- Add RLS policy if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'customer_plans_tenant_access' AND tablename = 'customer_plans'
    ) THEN
        CREATE POLICY customer_plans_tenant_access ON customer_plans
        FOR ALL USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
    END IF;
END
$$;
