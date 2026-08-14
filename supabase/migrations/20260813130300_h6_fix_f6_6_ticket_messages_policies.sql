-- ==============================================================================
-- H6 F6-6: ticket_messages — isolamento por ticket/tenant + limpeza de legado
-- ==============================================================================
-- Contexto: homologação H-6 (docs/audit/H6_SECURITY_AUDIT.md). Achado F6-6 (P0).
--   ticket_messages NÃO tem tenant_id; as policies legadas
--   ("Users can see messages for their tickets" USING (true) e
--   "Users can insert messages" WITH CHECK (true), de
--   20260219230006_new_features_notifications_support_comandas.sql) eram
--   públicas: qualquer anon/autenticado lia e inseria mensagens de suporte de
--   qualquer tenant (conteúdo real retornado no probe).
-- Correção (aprovada pelo PO): policies TO authenticated com JOIN em
--   support_tickets (que tem tenant_id — 20260220150538): usuário acessa apenas
--   mensagens de tickets do próprio tenant OU criados por ele OU superadmin.
--   Limpeza de legado: drop de "Users can insert tickets" (WITH CHECK true) em
--   support_tickets — o INSERT autenticado continua coberto por
--   tenant_ticket_isolation_v2 (superadmin OU tenant_id = current_tenant). As
--   policies tenant_ticket_isolation_v2 e superadmin_global_visibility ficam
--   intactas.
-- Revoke de anon/PUBLIC em ticket_messages e support_tickets + re-grant
--   autenticado (defesa em profundidade).
-- ------------------------------------------------------------------------------

-- 1. Remove policies legadas públicas de ticket_messages
DROP POLICY IF EXISTS "Users can see messages for their tickets" ON public.ticket_messages;
DROP POLICY IF EXISTS "Users can insert messages" ON public.ticket_messages;

-- 2. Remove policy legada pública de support_tickets (WITH CHECK true)
DROP POLICY IF EXISTS "Users can insert tickets" ON public.support_tickets;

-- 3. Revoke de anon/PUBLIC (defesa em profundidade)
REVOKE ALL ON TABLE public.ticket_messages FROM anon;
REVOKE ALL ON TABLE public.ticket_messages FROM PUBLIC;
REVOKE ALL ON TABLE public.support_tickets FROM anon;
REVOKE ALL ON TABLE public.support_tickets FROM PUBLIC;

-- 4. Grants autenticados (mantêm acesso dos fluxos reais)
GRANT SELECT, INSERT ON TABLE public.ticket_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.support_tickets TO authenticated;

-- 5. SELECT — apenas mensagens de tickets do próprio tenant / do usuário / superadmin
CREATE POLICY "ticket_messages_select_v2" ON public.ticket_messages
  FOR SELECT TO authenticated
  USING (
    public.current_is_super_admin_from_auth_uid()
    OR EXISTS (
      SELECT 1 FROM public.support_tickets st
      WHERE st.id = ticket_messages.ticket_id
        AND (
          st.tenant_id = public.current_tenant_id_from_auth_uid()
          OR st.user_id = auth.uid()
        )
    )
  );

-- 6. INSERT — apenas em tickets do próprio tenant / do usuário / superadmin
CREATE POLICY "ticket_messages_insert_v2" ON public.ticket_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_is_super_admin_from_auth_uid()
    OR EXISTS (
      SELECT 1 FROM public.support_tickets st
      WHERE st.id = ticket_messages.ticket_id
        AND (
          st.tenant_id = public.current_tenant_id_from_auth_uid()
          OR st.user_id = auth.uid()
        )
    )
  );

-- NOTIFY pgrst, 'reload schema';
