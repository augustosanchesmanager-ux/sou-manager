-- ============================================================================
-- Migration: Restore _legacy_* tables to their original names
-- Date: 2026-06-15 (v2 — multi-schema aware)
-- Description:
--   The tables appointments, services and schedule_blocks were renamed to
--   _legacy_appointments, _legacy_services and _legacy_schedule_blocks outside
--   the migration system. This script finds them in ANY schema (public, barber,
--   auto, club) and renames them back to the original names in the SAME schema.
--
--   PostgreSQL preserves all FKs, constraints, indexes, triggers and RLS
--   policies across ALTER TABLE ... RENAME TO.
--
--   If the original-name table already exists in that schema (e.g. empty shell),
--   it is dropped first.
--
--   Finally, PostgREST cache is reloaded.
-- ============================================================================

DO $$
DECLARE
  v_schema TEXT;
  v_old_name TEXT;
  v_new_name TEXT;
  v_target_exists BOOLEAN;
  v_sql TEXT;
BEGIN
  -- Iterate over each table pair and each candidate schema
  FOR v_old_name, v_new_name IN
    VALUES
      ('_legacy_appointments', 'appointments'),
      ('_legacy_services', 'services'),
      ('_legacy_schedule_blocks', 'schedule_blocks'),
      ('_legacy_comandas', 'comandas'),
      ('_legacy_comanda_items', 'comanda_items')
  LOOP
    -- Search in public, barber, auto, club schemas
    FOR v_schema IN
      SELECT s.schema_name
      FROM information_schema.schemata s
      WHERE s.schema_name IN ('public', 'barber', 'auto', 'club')
      ORDER BY
        CASE s.schema_name
          WHEN 'public' THEN 1
          WHEN 'barber' THEN 2
          WHEN 'auto' THEN 3
          WHEN 'club' THEN 4
        END
    LOOP
      -- Check if _legacy_* exists in this schema
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = v_schema AND table_name = v_old_name
      ) INTO v_target_exists;

      IF v_target_exists THEN
        -- Check if target name already exists in same schema
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = v_schema AND table_name = v_new_name
        ) INTO v_target_exists;

        IF v_target_exists THEN
          RAISE NOTICE 'Dropping existing %.% before rename', v_schema, v_new_name;
          EXECUTE format('DROP TABLE %I.%I CASCADE', v_schema, v_new_name);
        END IF;

        -- Perform the rename
        v_sql := format('ALTER TABLE %I.%I RENAME TO %I', v_schema, v_old_name, v_new_name);
        EXECUTE v_sql;
        RAISE NOTICE 'Renamed %.% → %.%', v_schema, v_old_name, v_schema, v_new_name;

        -- Only rename in the first schema where we find it
        EXIT;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- ============================================================================
-- PostgREST schema cache reload
-- ============================================================================
NOTIFY pgrst, 'reload schema';
