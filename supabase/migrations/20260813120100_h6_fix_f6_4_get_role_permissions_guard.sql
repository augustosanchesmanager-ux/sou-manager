-- ==============================================================================
-- H6 F6-4: get_role_permissions — guarda de ownership (padrão upsert_role_permissions)
-- ==============================================================================
-- Contexto: homologação H-6 (docs/audit/H6_SECURITY_AUDIT.md). Achado F6-4 (P2).
--   managerA (tenant A) conseguia ler a matriz RBAC de tenant B via RPC
--   (SECURITY DEFINER sem validação de tenant).
-- Correção (aprovada pelo PO): guarda no mesmo padrão do upsert_role_permissions
--   (que já valida): chamador deve ser do p_tenant_id (profiles/staff ativo) OU
--   superadmin; senão RAISE 'Insufficient permissions to read role_permissions'.
-- Call sites (src/lib/permissions/service.ts) sempre passam o tenant do contexto.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_role_permissions(
  p_tenant_id UUID,
  p_role TEXT
)
RETURNS TABLE (
  permission_key TEXT,
  enabled BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Guarda: apenas membros do tenant (ativos) ou superadmin podem ler a matriz
  IF NOT (
    public.current_is_super_admin_from_auth_uid()
    OR public.current_tenant_id_from_auth_uid() = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to read role_permissions';
  END IF;

  RETURN QUERY
  SELECT rp.permission_key, rp.enabled
  FROM public.role_permissions rp
  WHERE rp.tenant_id = p_tenant_id
    AND rp.role = p_role;
END;
$$;

-- NOTIFY pgrst, 'reload schema';
