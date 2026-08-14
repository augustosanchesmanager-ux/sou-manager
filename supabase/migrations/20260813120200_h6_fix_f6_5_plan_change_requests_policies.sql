-- ==============================================================================
-- H6 F6-5: plan_change_requests — policies restritas a superadmin
-- ==============================================================================
-- Contexto: homologação H-6 (docs/audit/H6_SECURITY_AUDIT.md). Achado F6-5 (P2).
--   Tabela sem tenant_id; policies legadas abertas (WITH CHECK true / USING true)
--   de 20260219230006 permitiam leitura/inserção cross-tenant.
-- Correção (aprovada pelo PO): SELECT e INSERT restritos a superadmin
--   (current_is_super_admin_from_auth_uid()). O único consumidor da tabela no
--   frontend é pages/SuperAdmin.tsx (superadmin, somente leitura) — zero regressão.
-- Modelagem definitiva (adicionar tenant_id) fica para decisão futura; o fluxo
-- legado de solicitação de troca de plano não possui call site ativo no app.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can insert plan requests" ON public.plan_change_requests;
DROP POLICY IF EXISTS "Admins can view plan requests" ON public.plan_change_requests;

CREATE POLICY "superadmin can insert plan requests" ON public.plan_change_requests
  FOR INSERT TO authenticated
  WITH CHECK (public.current_is_super_admin_from_auth_uid());

CREATE POLICY "superadmin can view plan requests" ON public.plan_change_requests
  FOR SELECT TO authenticated
  USING (public.current_is_super_admin_from_auth_uid());

-- NOTIFY pgrst, 'reload schema';
