-- Fix RLS for profiles table
DROP POLICY IF EXISTS "Superadmins can view all profiles" ON profiles;
CREATE POLICY "Superadmins can view all profiles" 
ON profiles FOR SELECT 
USING (
  role IN ('Super Admin', 'superadmin') 
  OR EXISTS (
    SELECT 1 FROM profiles px 
    WHERE px.id = auth.uid() AND px.role IN ('Super Admin', 'superadmin')
  )
);

-- Fix RLS for access_requests table
DROP POLICY IF EXISTS "superadmin_requests_visibility" ON access_requests;
CREATE POLICY "superadmin_requests_visibility" 
ON access_requests FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM profiles px 
    WHERE px.id = auth.uid() AND px.role IN ('Super Admin', 'superadmin')
  )
);

-- Fix RLS for support_tickets table
DROP POLICY IF EXISTS "superadmin_global_visibility" ON support_tickets;
CREATE POLICY "superadmin_global_visibility" 
ON support_tickets FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM profiles px 
    WHERE px.id = auth.uid() AND px.role IN ('Super Admin', 'superadmin')
  )
);;
