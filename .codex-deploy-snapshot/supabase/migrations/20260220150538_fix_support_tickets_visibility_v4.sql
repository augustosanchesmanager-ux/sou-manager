
-- 1. Ensure tenant_id exists in support_tickets
ALTER TABLE public.support_tickets 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

-- 2. Drop existing policies to clean up
DROP POLICY IF EXISTS "superadmin sees all tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Enable read for superadmins" ON public.support_tickets;
DROP POLICY IF EXISTS "Users can see their own tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "tenant isolation support_tickets" ON public.support_tickets;

-- 3. Create Robust Super Admin Policy (checks JWT metadata + profiles)
CREATE POLICY "superadmin_global_visibility" ON public.support_tickets
FOR SELECT USING (
  (auth.jwt() -> 'user_metadata' ->> 'role' = 'Super Admin') OR
  (auth.jwt() -> 'user_metadata' ->> 'role' = 'superadmin') OR
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND (role = 'Super Admin' OR role = 'superadmin')
  )
);

-- 4. Create Standard Tenant Policy
CREATE POLICY "tenant_ticket_isolation" ON public.support_tickets
FOR ALL USING (
  tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()) OR
  user_id = auth.uid()
);

-- 5. Ensure access_requests is also visible to Super Admin
DROP POLICY IF EXISTS "superadmin sees all requests" ON public.access_requests;
CREATE POLICY "superadmin_requests_visibility" ON public.access_requests
FOR ALL USING (
  (auth.jwt() -> 'user_metadata' ->> 'role' = 'Super Admin') OR
  (auth.jwt() -> 'user_metadata' ->> 'role' = 'superadmin') OR
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND (role = 'Super Admin' OR role = 'superadmin')
  )
);
;
