-- ============================================================================
-- Migration: 20261124190500_security_fix_gtm008_legal_acceptances.sql
-- Issue: #384 (P0-09 | GTM-008 — Compliance Jurídico & LGPD Mínimo Viável)
-- Scope:
--   1. Create append-only `public.legal_acceptances` table storing versioned
--      electronic consent per (tenant_id, user_id, document_type, version).
--   2. Enforce strict tenant_id RLS (TO authenticated) and append-only GRANTs
--      (SELECT + INSERT only — NO UPDATE or DELETE).
--   3. Create idempotent SECURITY DEFINER RPC `record_legal_acceptance`.
-- Note: Applied ONLY after PO review and explicit production authorization.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.legal_acceptances (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL,
  document_type    text NOT NULL CHECK (document_type IN ('terms_of_service', 'privacy_policy', 'lgpd_dpa')),
  document_version text NOT NULL CHECK (btrim(document_version) <> ''),
  accepted_at      timestamptz NOT NULL DEFAULT now(),
  user_agent       text NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_legal_acceptances_unique
  ON public.legal_acceptances (tenant_id, user_id, document_type, document_version);

CREATE INDEX IF NOT EXISTS idx_legal_acceptances_tenant
  ON public.legal_acceptances (tenant_id, accepted_at DESC);

ALTER TABLE public.legal_acceptances ENABLE ROW LEVEL SECURITY;

-- Append-only: no UPDATE or DELETE granted to authenticated clients
REVOKE ALL ON TABLE public.legal_acceptances FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.legal_acceptances TO authenticated;

DROP POLICY IF EXISTS "legal_acceptances_select_tenant" ON public.legal_acceptances;
CREATE POLICY "legal_acceptances_select_tenant"
  ON public.legal_acceptances
  FOR SELECT
  TO authenticated
  USING (
    public.current_is_super_admin_from_auth_uid()
    OR tenant_id = public.current_tenant_id_from_auth_uid()
  );

DROP POLICY IF EXISTS "legal_acceptances_insert_self" ON public.legal_acceptances;
CREATE POLICY "legal_acceptances_insert_self"
  ON public.legal_acceptances
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      public.current_is_super_admin_from_auth_uid()
      OR tenant_id = public.current_tenant_id_from_auth_uid()
    )
  );

CREATE OR REPLACE FUNCTION public.record_legal_acceptance(
  p_document_type text,
  p_document_version text,
  p_user_agent text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_id uuid;
  v_now timestamptz := now();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_document_type NOT IN ('terms_of_service', 'privacy_policy', 'lgpd_dpa') THEN
    RAISE EXCEPTION 'Invalid document_type: %', p_document_type;
  END IF;

  IF p_document_version IS NULL OR btrim(p_document_version) = '' THEN
    RAISE EXCEPTION 'document_version is required';
  END IF;

  v_tenant_id := public.current_tenant_id_from_auth_uid();
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Active tenant required to record legal acceptance';
  END IF;

  INSERT INTO public.legal_acceptances (
    tenant_id, user_id, document_type, document_version, accepted_at, user_agent
  )
  VALUES (
    v_tenant_id, v_user_id, p_document_type, btrim(p_document_version), v_now, p_user_agent
  )
  ON CONFLICT (tenant_id, user_id, document_type, document_version) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT la.id INTO v_id
      FROM public.legal_acceptances la
     WHERE la.tenant_id = v_tenant_id
       AND la.user_id = v_user_id
       AND la.document_type = p_document_type
       AND la.document_version = btrim(p_document_version)
     LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_id,
    'tenant_id', v_tenant_id,
    'user_id', v_user_id,
    'document_type', p_document_type,
    'document_version', btrim(p_document_version),
    'accepted_at', v_now
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.record_legal_acceptance(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_legal_acceptance(text, text, text) TO authenticated;

COMMIT;
