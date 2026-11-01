-- ============================================================================
-- F05 — profiles.tenant_id/status eram autoeditáveis e permitiam pivot
-- ============================================================================
-- Achado: docs/security-audit/relatorio-auditoria-seguranca.pdf (F05, alto)
-- Superfície: public.profiles (policy tenant_isolation_profiles_update_v2)
--
-- A policy de UPDATE aceitava id = auth.uid(), e o trigger F1 protegia apenas a
-- coluna role. Qualquer usuário autenticado podia executar
--   PATCH /rest/v1/profiles?id=eq.<seu_id>
--   { "tenant_id": "<tenant-da-vítima>", "status": "active" }
-- e, na requisição seguinte, current_tenant_id_from_auth_uid() passava a
-- resolver o tenant da vítima. O mesmo vetor permitia autoaprovação de pending.
--
-- Correção: trigger BEFORE UPDATE OF tenant_id, status que bloqueia a troca por
-- usuário comum. Superadmin, service_role e fluxos internos SECURITY DEFINER
-- (accept_invite/provision_new_tenant) continuam autorizados.
--
-- Rollback: DROP TRIGGER trg_f5_profiles_tenant_status_guard ON public.profiles;
--           DROP FUNCTION public.f5_guard_profiles_tenant_status();
-- ============================================================================

CREATE OR REPLACE FUNCTION public.f5_guard_profiles_tenant_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- UPDATE que não muda tenant_id nem status: não é escopo desta proteção.
  IF NEW.tenant_id IS NOT DISTINCT FROM OLD.tenant_id
     AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- service_role/postgres e funções SECURITY DEFINER rodam fora das roles de
  -- API. Os fluxos internos (accept_invite/provision_new_tenant) validam o
  -- vínculo antes de gravar; aqui não é possível distinguir o RPC do SQL direto
  -- sem essa checagem de role.
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL
     AND public.current_is_super_admin_from_auth_uid() THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'F5-SEC: tenant_id/status de profiles só podem ser alterados por superadmin ou fluxo interno'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_f5_profiles_tenant_status_guard ON public.profiles;

CREATE TRIGGER trg_f5_profiles_tenant_status_guard
  BEFORE UPDATE OF tenant_id, status ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.f5_guard_profiles_tenant_status();
