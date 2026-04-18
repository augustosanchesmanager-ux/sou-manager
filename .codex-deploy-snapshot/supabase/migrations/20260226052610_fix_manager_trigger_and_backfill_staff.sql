
-- =============================================================================
-- Migration: fix_manager_trigger_and_backfill_staff
-- Fix trigger to cover both 'manager' and 'superadmin' roles
-- Also backfill existing managers/superadmins that are not yet in staff
-- =============================================================================

-- Drop and recreate the function to cover superadmin AND manager roles
DROP FUNCTION IF EXISTS public.handle_new_manager_profile() CASCADE;

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
  -- Process only manager and superadmin profiles (account creators)
  IF NEW.role NOT IN ('manager', 'superadmin') THEN
    RETURN NEW;
  END IF;

  -- Skip if tenant_id is null
  IF NEW.tenant_id IS NULL THEN
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
      NEW.full_name,
      split_part(email, '@', 1)
    ),
    email
  INTO v_full_name, v_email
  FROM auth.users
  WHERE id = NEW.id;

  -- Insert into staff only if no Manager already exists for this email+tenant
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
    'https://ui-avatars.com/api/?name=' || REPLACE(COALESCE(v_full_name, 'Gestor'), ' ', '+') || '&background=0066ff&color=fff',
    0,
    'active',
    NEW.tenant_id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.staff 
    WHERE tenant_id = NEW.tenant_id 
    AND email = COALESCE(v_email, '')
  );

  RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS trg_auto_insert_manager_to_staff ON public.profiles;

CREATE TRIGGER trg_auto_insert_manager_to_staff
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_manager_profile();

-- =============================================================================
-- BACKFILL: Insert existing managers/superadmins that are not yet in staff
-- =============================================================================
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
SELECT DISTINCT ON (u.email, p.tenant_id)
  COALESCE(
    NULLIF(TRIM(
      COALESCE(u.raw_user_meta_data->>'first_name', '') || ' ' ||
      COALESCE(u.raw_user_meta_data->>'last_name', '')
    ), ''),
    u.raw_user_meta_data->>'full_name',
    p.full_name,
    split_part(u.email, '@', 1)
  ) AS name,
  u.email,
  '',
  'Manager',
  'https://ui-avatars.com/api/?name=' || REPLACE(
    COALESCE(
      NULLIF(TRIM(
        COALESCE(u.raw_user_meta_data->>'first_name', '') || ' ' ||
        COALESCE(u.raw_user_meta_data->>'last_name', '')
      ), ''),
      p.full_name,
      split_part(u.email, '@', 1)
    ), ' ', '+'
  ) || '&background=0066ff&color=fff',
  0,
  'active',
  p.tenant_id
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.role IN ('manager', 'superadmin')
  AND p.tenant_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.staff s
    WHERE s.tenant_id = p.tenant_id
    AND s.email = u.email
  );
;
