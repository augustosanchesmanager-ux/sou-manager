
-- Create a function that auto-sets tenant_id from the current user's profile during INSERT
CREATE OR REPLACE FUNCTION public.set_tenant_id_from_profile()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  -- If tenant_id is already set, don't override it
  IF NEW.tenant_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Get tenant_id from the current user's profile
  SELECT tenant_id INTO v_tenant_id
  FROM public.profiles
  WHERE id = auth.uid();

  NEW.tenant_id := v_tenant_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply trigger to all tables that need tenant_id
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['clients', 'staff', 'services', 'products', 'appointments', 'comandas', 'comanda_items', 'promotions', 'purchase_orders', 'suppliers', 'notifications']
  LOOP
    -- Drop old trigger if it exists
    EXECUTE format('DROP TRIGGER IF EXISTS trg_set_tenant_id ON public.%I', tbl);

    -- Create new trigger
    EXECUTE format(
      'CREATE TRIGGER trg_set_tenant_id
       BEFORE INSERT ON public.%I
       FOR EACH ROW
       EXECUTE FUNCTION public.set_tenant_id_from_profile()',
      tbl
    );
  END LOOP;
END;
$$;

-- Also fix RLS policies to add proper WITH CHECK for INSERT operations
-- For clients
DROP POLICY IF EXISTS "tenant_isolation_clients_insert" ON public.clients;
CREATE POLICY "tenant_isolation_clients_insert" ON public.clients
  FOR INSERT WITH CHECK (
    tenant_id = (SELECT profiles.tenant_id FROM profiles WHERE profiles.id = auth.uid())
  );

-- For staff
DROP POLICY IF EXISTS "tenant_isolation_staff_insert" ON public.staff;
CREATE POLICY "tenant_isolation_staff_insert" ON public.staff
  FOR INSERT WITH CHECK (
    tenant_id = (SELECT profiles.tenant_id FROM profiles WHERE profiles.id = auth.uid())
  );

-- For services
DROP POLICY IF EXISTS "tenant_isolation_services_insert" ON public.services;
CREATE POLICY "tenant_isolation_services_insert" ON public.services
  FOR INSERT WITH CHECK (
    tenant_id = (SELECT profiles.tenant_id FROM profiles WHERE profiles.id = auth.uid())
  );

-- For products
DROP POLICY IF EXISTS "tenant_isolation_products_insert" ON public.products;
CREATE POLICY "tenant_isolation_products_insert" ON public.products
  FOR INSERT WITH CHECK (
    tenant_id = (SELECT profiles.tenant_id FROM profiles WHERE profiles.id = auth.uid())
  );

-- For appointments
DROP POLICY IF EXISTS "tenant_isolation_appointments_insert" ON public.appointments;
CREATE POLICY "tenant_isolation_appointments_insert" ON public.appointments
  FOR INSERT WITH CHECK (
    tenant_id = (SELECT profiles.tenant_id FROM profiles WHERE profiles.id = auth.uid())
  );

-- For comandas
DROP POLICY IF EXISTS "tenant_isolation_comandas_insert" ON public.comandas;
CREATE POLICY "tenant_isolation_comandas_insert" ON public.comandas
  FOR INSERT WITH CHECK (
    tenant_id = (SELECT profiles.tenant_id FROM profiles WHERE profiles.id = auth.uid())
  );

-- For comanda_items
DROP POLICY IF EXISTS "tenant_isolation_comanda_items_insert" ON public.comanda_items;
CREATE POLICY "tenant_isolation_comanda_items_insert" ON public.comanda_items
  FOR INSERT WITH CHECK (
    tenant_id = (SELECT profiles.tenant_id FROM profiles WHERE profiles.id = auth.uid())
  );

-- For promotions
DROP POLICY IF EXISTS "tenant_isolation_promotions_insert" ON public.promotions;
CREATE POLICY "tenant_isolation_promotions_insert" ON public.promotions
  FOR INSERT WITH CHECK (
    tenant_id = (SELECT profiles.tenant_id FROM profiles WHERE profiles.id = auth.uid())
  );
;
