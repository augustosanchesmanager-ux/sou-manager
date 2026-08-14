-- ==============================================================================
-- ROLLBACK — 20260813120100_h6_fix_f6_4_get_role_permissions_guard.sql
-- Restaura o corpo ORIGINAL de public.get_role_permissions(uuid,text)
-- Fonte: supabase/migrations/20260717000000_role_permissions_system.sql:115-135
-- ==============================================================================
-- Reversão da guarda F6-4: volta a retornar a matriz RBAC de p_tenant_id de
-- QUALQUER tenant. ⚠️ Reintroduz o achado F6-4.
-- Exige aprovação explícita do PO (AGENTS.md — operação reversa/destrutiva).
-- ==============================================================================
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
  RETURN QUERY
  SELECT rp.permission_key, rp.enabled
  FROM public.role_permissions rp
  WHERE rp.tenant_id = p_tenant_id
    AND rp.role = p_role;
END;
$$;

-- NOTIFY pgrst, 'reload schema';
