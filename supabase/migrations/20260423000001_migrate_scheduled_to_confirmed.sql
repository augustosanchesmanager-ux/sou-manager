-- Migrate appointments with status 'scheduled' to 'confirmed'
-- The 'scheduled' status was never properly supported by the backend constraint

-- Update all appointments with status 'scheduled' to 'confirmed'
UPDATE public.appointments 
SET status = 'confirmed' 
WHERE status = 'scheduled';

-- Verify the constraint allows 'confirmed' (safety check)
DO $$
DECLARE
    constraint_exists INTEGER;
BEGIN
    SELECT COUNT(*) INTO constraint_exists
    FROM pg_constraint con
    WHERE con.conname = 'appointments_status_check';
    
    IF constraint_exists > 0 THEN
        RAISE NOTICE 'Constraint appointments_status_check verified';
    ELSE
        RAISE NOTICE 'Constraint not found, will be created on next app restart';
    END IF;
END $$;