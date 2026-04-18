
-- =============================================================================
-- Migration: auto_insert_manager_into_staff_v2
-- Fixed version: Replace broken function with clean implementation
-- Uses gen_random_uuid() for staff.id (staff table's PK is auto-generated)
-- =============================================================================

-- Drop previous version
DROP FUNCTION IF EXISTS public.handle_new_manager_profile() CASCADE;

-- Recreate the function cleanly
CREATE OR REPLACE FUNCTION public.handle_new_manager_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name TEXT;
  v_email TEXT;
BEGIN
  -- Only process manager profiles (account creators)
  IF NEW.role <> 'manager' THEN
    RETURN NEW;
  END IF;

  -- Get name and email from auth.users
  SELECT 
    COALESCE(
      NULLIF(TRIM(
        COALESCE(raw_user_meta_data->>'first_name', '') || ' ' ||
        COALESCE(raw_user_meta_data->>'last_name', '')
      ), ''),
      raw_user_meta_data->>'full_name',
      split_part(email, '@', 1)
    ),
    email
  INTO v_full_name, v_email
  FROM auth.users
  WHERE id = NEW.id;

  -- Only insert if there isn't already a staff entry for this email/tenant
  INSERT INTO public.staff (
    name,
    email,
    phone,
    role,
    avatar,
    commission_rate,
    status,
    tenant_id
  )
  SELECT
    COALESCE(v_full_name, 'Gestor'),
    COALESCE(v_email, ''),
    '',
    'Manager',
    'https://ui-avatars.com/api/?name=' || COALESCE(v_full_name, 'Gestor') || '&background=random',
    0,
    'active',
    NEW.tenant_id
  WHERE NEW.tenant_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.staff 
      WHERE tenant_id = NEW.tenant_id 
      AND email = COALESCE(v_email, '')
      AND role = 'Manager'
    );

  RETURN NEW;
END;
$$;

-- Create the trigger on profiles table
DROP TRIGGER IF EXISTS trg_auto_insert_manager_to_staff ON public.profiles;

CREATE TRIGGER trg_auto_insert_manager_to_staff
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_manager_profile();
;
