-- 1. Add tenant_id columns if they don't exist
ALTER TABLE clients ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE comandas ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE comanda_items ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- 2. Create trigger function
CREATE OR REPLACE FUNCTION set_tenant_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    SELECT tenant_id INTO NEW.tenant_id
    FROM profiles
    WHERE id = auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Apply triggers
DROP TRIGGER IF EXISTS trg_set_tenant_id_clients ON clients;
CREATE TRIGGER trg_set_tenant_id_clients
BEFORE INSERT ON clients
FOR EACH ROW EXECUTE FUNCTION set_tenant_id();

DROP TRIGGER IF EXISTS trg_set_tenant_id_services ON services;
CREATE TRIGGER trg_set_tenant_id_services
BEFORE INSERT ON services
FOR EACH ROW EXECUTE FUNCTION set_tenant_id();

DROP TRIGGER IF EXISTS trg_set_tenant_id_staff ON staff;
CREATE TRIGGER trg_set_tenant_id_staff
BEFORE INSERT ON staff
FOR EACH ROW EXECUTE FUNCTION set_tenant_id();

DROP TRIGGER IF EXISTS trg_set_tenant_id_appointments ON appointments;
CREATE TRIGGER trg_set_tenant_id_appointments
BEFORE INSERT ON appointments
FOR EACH ROW EXECUTE FUNCTION set_tenant_id();

DROP TRIGGER IF EXISTS trg_set_tenant_id_comandas ON comandas;
CREATE TRIGGER trg_set_tenant_id_comandas
BEFORE INSERT ON comandas
FOR EACH ROW EXECUTE FUNCTION set_tenant_id();

DROP TRIGGER IF EXISTS trg_set_tenant_id_comanda_items ON comanda_items;
CREATE TRIGGER trg_set_tenant_id_comanda_items
BEFORE INSERT ON comanda_items
FOR EACH ROW EXECUTE FUNCTION set_tenant_id();

DROP TRIGGER IF EXISTS trg_set_tenant_id_products ON products;
CREATE TRIGGER trg_set_tenant_id_products
BEFORE INSERT ON products
FOR EACH ROW EXECUTE FUNCTION set_tenant_id();

DROP TRIGGER IF EXISTS trg_set_tenant_id_suppliers ON suppliers;
CREATE TRIGGER trg_set_tenant_id_suppliers
BEFORE INSERT ON suppliers
FOR EACH ROW EXECUTE FUNCTION set_tenant_id();

DROP TRIGGER IF EXISTS trg_set_tenant_id_purchase_orders ON purchase_orders;
CREATE TRIGGER trg_set_tenant_id_purchase_orders
BEFORE INSERT ON purchase_orders
FOR EACH ROW EXECUTE FUNCTION set_tenant_id();

-- 4. Secure RLS policies

-- Clients
DROP POLICY IF EXISTS "Allow public delete clients" ON clients;
DROP POLICY IF EXISTS "Allow public insert clients" ON clients;
DROP POLICY IF EXISTS "Allow public read clients" ON clients;
DROP POLICY IF EXISTS "Allow public update clients" ON clients;
CREATE POLICY "tenant_isolation_clients" ON clients FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- Services
DROP POLICY IF EXISTS "Allow public delete services" ON services;
DROP POLICY IF EXISTS "Allow public insert services" ON services;
DROP POLICY IF EXISTS "Allow public read services" ON services;
DROP POLICY IF EXISTS "Allow public update services" ON services;
CREATE POLICY "tenant_isolation_services" ON services FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- Staff
DROP POLICY IF EXISTS "Allow public delete staff" ON staff;
DROP POLICY IF EXISTS "Allow public insert staff" ON staff;
DROP POLICY IF EXISTS "Allow public read staff" ON staff;
DROP POLICY IF EXISTS "Allow public update staff" ON staff;
CREATE POLICY "tenant_isolation_staff" ON staff FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- Appointments
DROP POLICY IF EXISTS "Allow public delete appointments" ON appointments;
DROP POLICY IF EXISTS "Allow public insert appointments" ON appointments;
DROP POLICY IF EXISTS "Allow public read appointments" ON appointments;
DROP POLICY IF EXISTS "Allow public update appointments" ON appointments;
CREATE POLICY "tenant_isolation_appointments" ON appointments FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- Comandas
DROP POLICY IF EXISTS "Anyone can insert comandas" ON comandas;
DROP POLICY IF EXISTS "Anyone can see comandas" ON comandas;
DROP POLICY IF EXISTS "Anyone can update comandas" ON comandas;
CREATE POLICY "tenant_isolation_comandas" ON comandas FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- Comanda Items
DROP POLICY IF EXISTS "Anyone can delete items" ON comanda_items;
DROP POLICY IF EXISTS "Anyone can insert items" ON comanda_items;
DROP POLICY IF EXISTS "Anyone can see items" ON comanda_items;
DROP POLICY IF EXISTS "Anyone can update items" ON comanda_items;
CREATE POLICY "tenant_isolation_comanda_items" ON comanda_items FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
;
