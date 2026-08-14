-- ==============================================================================
-- H6 F6-3: tenant_has_feature — guarda de ownership (fail-closed cross-tenant)
-- ==============================================================================
-- Contexto: homologação H-6 (docs/audit/H6_SECURITY_AUDIT.md). Achado F6-3 (P2).
--   managerA (tenant A) conseguia consultar features de tenant B via RPC,
--   validando apenas `auth.uid() IS NOT NULL` — sem validar que p_tenant_id
--   pertence ao chamador.
-- Correção (aprovada pelo PO): fail-closed na própria função.
--   - O chamador só consulta features do PRÓPRIO tenant (current_tenant_id_from_auth_uid()).
--   - Superadmin (current_is_super_admin_from_auth_uid()) mantém bypass para
--     consultar features de qualquer tenant (fluxos de operação/console).
--   - Caso contrário → false (fail-closed, sem quebra de runtime).
-- Comportamento preservado para todos os call sites legítimos (o frontend e as
-- RPCs de domínio sempre passam o tenant do contexto do chamador).
-- ------------------------------------------------------------------------------
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
      AND (
        p_tenant_id = public.current_tenant_id_from_auth_uid()
        OR public.current_is_super_admin_from_auth_uid()
      )
  ), false);
$$;

-- NOTIFY pgrst, 'reload schema';
