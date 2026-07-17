-- ============================================================================
-- DIAGNOSTIC v2: Check ALL tables used by the frontend
-- Run this in Supabase SQL Editor
-- ============================================================================

-- 1. Find ALL tables that exist with _legacy_ prefix in any schema
SELECT
  table_schema,
  table_name
FROM information_schema.tables
WHERE table_name LIKE '_legacy_%'
  AND table_schema IN ('public', 'barber', 'auto', 'club')
ORDER BY table_schema, table_name;

-- 2. Check which of the critical frontend tables exist and their row counts
DO $$
DECLARE
  v_schema TEXT;
  v_table TEXT;
  v_exists BOOLEAN;
  v_count BIGINT;
BEGIN
  FOR v_schema, v_table IN
    VALUES
      ('public', 'comandas'),
      ('barber', 'comandas'),
      ('public', 'comanda_items'),
      ('barber', 'comanda_items'),
      ('public', 'appointments'),
      ('barber', 'appointments'),
      ('public', 'services'),
      ('barber', 'services'),
      ('public', 'schedule_blocks'),
      ('barber', 'schedule_blocks'),
      ('public', 'clients'),
      ('barber', 'clients'),
      ('public', 'staff'),
      ('barber', 'staff'),
      ('public', 'transactions'),
      ('barber', 'transactions'),
      ('public', 'customer_subscriptions'),
      ('barber', 'customer_subscriptions'),
      ('public', 'customer_plans'),
      ('barber', 'customer_plans'),
      ('public', 'customer_credits'),
      ('barber', 'customer_credits'),
      ('public', 'products'),
      ('barber', 'products'),
      ('public', 'promotions'),
      ('barber', 'promotions'),
      ('public', 'service_execution_participants'),
      ('barber', 'service_execution_participants'),
      ('public', 'financial_reversals'),
      ('barber', 'financial_reversals')
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = v_schema AND table_name = v_table
    ) INTO v_exists;

    IF v_exists THEN
      EXECUTE format('SELECT COUNT(*) FROM %I.%I', v_schema, v_table) INTO v_count;
      RAISE NOTICE 'OK: %.% exists with % rows', v_schema, v_table, v_count;
    ELSE
      RAISE NOTICE 'MISSING: %.% does NOT exist', v_schema, v_table;
    END IF;
  END LOOP;
END $$;

-- 3. Check RLS policies on comandas (the table causing the error)
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'comandas'
  AND schemaname IN ('public', 'barber')
ORDER BY schemaname, policyname;
