
-- =============================================================================
-- Migration: auto_insert_manager_into_staff
-- Purpose: Automatically insert the account creator as Manager in the staff 
-- table whenever a new profile with role 'manager' is created.
-- =============================================================================

-- Function: handles new profile insertion for managers
CREATE OR REPLACE FUNCTION public.handle_new_manager_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name TEXT;
  v_email TEXT;
  v_avatar TEXT;
BEGIN
  -- Only process manager profiles (account creators)
  IF NEW.role <> 'manager' THEN
    RETURN NEW;
  END IF;

  -- Get name and email from auth.users metadata
  SELECT 
    COALESCE(
      raw_user_meta_data->>'full_name',
      TRIM(
        COALESCE(raw_user_meta_data->>'first_name', '') || ' ' ||
        COALESCE(raw_user_meta_data->>'last_name', '')
      ),
      email
    ),
    email
  INTO v_full_name, v_email
  FROM auth.users
  WHERE id = NEW.id;

  -- Build avatar URL
  v_avatar := 'https://ui-avatars.com/api/?name=' || 
              REPLACE(url_encode(COALESCE(v_full_name, 'Gestor')), '+', '%20') ||
              '&background=random';

  -- Insert the manager into staff only if they don't already exist 
  -- (by email or if the staff table has their id matching)
  INSERT INTO public.staff (
    id,
    name,
    email,
    phone,
    role,
    avatar,
    commission_rate,
    status,
    tenant_id
  )
  VALUES (
    NEW.id,  -- Link staff id to auth user id for easy lookup
    TRIM(COALESCE(v_full_name, 'Gestor')),
    COALESCE(v_email, ''),
    '',
    'Manager',
    'https://ui-avatars.com/api/?name=' || encode(convert_to(COALESCE(TRIM(v_full_name), 'Gestor'), 'utf-8'), 'base64') || '&background=random',
    0,  -- Manager typically doesn't have commission
    'active',
    NEW.tenant_id
  )
  ON CONFLICT (id) DO NOTHING;  -- Avoid duplicates if somehow called twice

  RETURN NEW;
END;
$$;
;
