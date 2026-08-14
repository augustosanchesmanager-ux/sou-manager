-- ==============================================================================
-- ROLLBACK — 20260813120000_h6_fix_f6_3_tenant_has_feature_guard.sql
-- Restaura o corpo ORIGINAL de public.tenant_has_feature(uuid,text)
-- Fonte: supabase/migrations/20260807000000_phase_6_0_5_3_feature_flags.sql:93-122
-- ==============================================================================
-- Reversão da guarda fail-closed F6-3: volta a aceitar p_tenant_id de QUALQUER
-- tenant (validando apenas auth.uid() IS NOT NULL). ⚠️ Reintroduz o achado F6-3.
-- Exige aprovação explícita do PO (AGENTS.md — operação reversa/destrutiva).
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.tenant_has_feature(
  p_tenant_id uuid,
  p_feature text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT
      CASE
        WHEN t.status IN ('suspended', 'archived') THEN false
        WHEN ff.feature_key IS NOT NULL THEN ff.override
        ELSE EXISTS (
          SELECT 1
          FROM public.plan_features pf
          WHERE pf.plan_slug = t.plan
            AND pf.feature_key = p_feature
        )
      END
    FROM public.tenants t
    LEFT JOIN public.feature_flags ff
      ON ff.tenant_id = t.id
     AND ff.feature_key = p_feature
    WHERE t.id = p_tenant_id
      AND auth.uid() IS NOT NULL
  ), false);
$$;

-- NOTIFY pgrst, 'reload schema';
