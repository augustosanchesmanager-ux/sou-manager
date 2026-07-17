-- ============================================================================
-- DIAGNOSTIC: Check state of appointments, services, schedule_blocks
-- Run this in Supabase SQL Editor to understand what's happening
-- ============================================================================

-- 1. Check which schemas have these tables
SELECT
  table_schema,
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_schema = t.table_schema AND c.table_name = t.table_name) AS column_count
FROM information_schema.tables t
WHERE table_name IN ('appointments', 'services', 'schedule_blocks',
                      '_legacy_appointments', '_legacy_services', '_legacy_schedule_blocks')
  AND table_schema IN ('public', 'barber', 'auto', 'club')
ORDER BY table_schema, table_name;

-- 2. Check row counts for all variants
DO $$
DECLARE
  rec RECORD;
  cnt BIGINT;
BEGIN
  FOR rec IN
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_name IN ('appointments', 'services', 'schedule_blocks',
                          '_legacy_appointments', '_legacy_services', '_legacy_schedule_blocks')
      AND table_schema IN ('public', 'barber', 'auto', 'club')
    ORDER BY table_schema, table_name
  LOOP
    EXECUTE format('SELECT COUNT(*) FROM %I.%I', rec.table_schema, rec.table_name) INTO cnt;
    RAISE NOTICE 'Schema: %, Table: %, Rows: %', rec.table_schema, rec.table_name, cnt;
  END LOOP;
END $$;

-- 3. Check if RLS is enabled on the tables
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE tablename IN ('appointments', 'services', 'schedule_blocks',
                     '_legacy_appointments', '_legacy_services', '_legacy_schedule_blocks')
  AND schemaname IN ('public', 'barber');

-- 4. Check RLS policies on appointments (example)
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('appointments', 'services', 'schedule_blocks')
  AND schemaname IN ('public', 'barber')
ORDER BY schemaname, tablename, policyname;
