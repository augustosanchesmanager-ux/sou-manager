CREATE TABLE IF NOT EXISTS promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('service', 'product', 'all')),
  target_id UUID,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger for auto tenant_id
DROP TRIGGER IF EXISTS trg_set_tenant_id_promotions ON promotions;
CREATE TRIGGER trg_set_tenant_id_promotions
BEFORE INSERT ON promotions
FOR EACH ROW EXECUTE FUNCTION set_tenant_id();

-- RLS
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_promotions" ON promotions;
CREATE POLICY "tenant_isolation_promotions" ON promotions FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));;
