-- =============================================================================
-- Migration: 20261113094500_storage_exports_bucket.sql
-- Purpose: Create private 'exports' bucket in Supabase Storage with tenant-scoped
--          RLS policies for asynchronous Excel (.xlsx) report exports (Sugestão 7.2).
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'exports',
  'exports',
  false,
  52428800, -- 50 MB
  ARRAY[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv'
  ]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'exports_tenant_select'
  ) THEN
    CREATE POLICY "exports_tenant_select"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'exports'
      AND (
        (storage.foldername(name))[1] = public.current_tenant_id_from_auth_uid()::text
        OR public.current_is_super_admin_from_auth_uid()
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'exports_tenant_insert'
  ) THEN
    CREATE POLICY "exports_tenant_insert"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'exports'
      AND (
        (storage.foldername(name))[1] = public.current_tenant_id_from_auth_uid()::text
        OR public.current_is_super_admin_from_auth_uid()
      )
    );
  END IF;
END $$;

-- =============================================================================
-- Retenção dos exports (LGPD) — decisão do PO em 2026-11-13: 7 dias.
-- Os arquivos contêm PII (nome, telefone, e-mail, LTV) e não podem acumular
-- indefinidamente no Storage.
--
-- LIMITAÇÃO CONHECIDA: o DELETE remove o registro em storage.objects; a remoção
-- do blob físico depende do garbage collector do Supabase Storage. Se a
-- contabilidade de armazenamento acusar órfãos, a purga deve migrar para a
-- Storage API (frente própria, com verificação de custo).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.purge_expired_exports()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  v_deleted integer;
BEGIN
  WITH expired AS (
    DELETE FROM storage.objects
    WHERE bucket_id = 'exports'
      AND created_at < now() - interval '7 days'
    RETURNING id
  )
  SELECT count(*) INTO v_deleted FROM expired;

  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_expired_exports() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purge_expired_exports() FROM anon, authenticated;

COMMENT ON FUNCTION public.purge_expired_exports() IS
  'LGPD: remove exports com mais de 7 dias do bucket privado exports (retenção decidida pelo PO em 2026-11-13).';

-- Agendamento idempotente: cron.unschedule() + cron.schedule() — nunca UPDATE em cron.job
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron ausente: purga automática de exports NÃO agendada.';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-expired-exports') THEN
    PERFORM cron.unschedule('purge-expired-exports');
  END IF;

  PERFORM cron.schedule(
    'purge-expired-exports',
    '30 6 * * *', -- 03:30 America/Sao_Paulo (UTC-3)
    'SELECT public.purge_expired_exports();'
  );
END $$;

