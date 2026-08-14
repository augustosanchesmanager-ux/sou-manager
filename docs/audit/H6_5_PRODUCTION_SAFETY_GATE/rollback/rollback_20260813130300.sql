-- ==============================================================================
-- ROLLBACK — 20260813130300_h6_fix_f6_6_ticket_messages_policies.sql
-- Restaura as policies LEGADAS e os GRANTS ORIGINAIS de
-- public.ticket_messages e public.support_tickets
-- Fonte:
--   policies: docs/backups/backup_pre_migration_20260728_152717.sql:11383,11391,11399
--   grants:   docs/backups/backup_pre_migration_20260728_152717.sql:13114-13116, 13138-13140
-- ==============================================================================
-- Reversão do fix F6-6: volta a permitir leitura/inserção pública de
-- ticket_messages e inserção em support_tickets (WITH CHECK true). ⚠️ Reintroduz
-- F6-6 (P0). Exige aprovação explícita do PO (AGENTS.md).
-- ==============================================================================

-- 1. Remove as policies v2 criadas pelo fix
DROP POLICY IF EXISTS "ticket_messages_select_v2" ON public.ticket_messages;
DROP POLICY IF EXISTS "ticket_messages_insert_v2" ON public.ticket_messages;

-- 2. Restaura as policies legadas abertas
CREATE POLICY "Users can see messages for their tickets" ON public.ticket_messages
  FOR SELECT
  USING (true);

CREATE POLICY "Users can insert messages" ON public.ticket_messages
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can insert tickets" ON public.support_tickets
  FOR INSERT
  WITH CHECK (true);

-- 3. Restaura os grants originais (anon + authenticated + service_role = ALL)
REVOKE SELECT, INSERT ON TABLE public.ticket_messages FROM authenticated;
REVOKE SELECT, INSERT, UPDATE ON TABLE public.support_tickets FROM authenticated;
REVOKE ALL ON TABLE public.ticket_messages FROM anon;
REVOKE ALL ON TABLE public.ticket_messages FROM PUBLIC;
REVOKE ALL ON TABLE public.support_tickets FROM anon;
REVOKE ALL ON TABLE public.support_tickets FROM PUBLIC;
GRANT ALL ON TABLE public.ticket_messages TO anon;
GRANT ALL ON TABLE public.ticket_messages TO authenticated;
GRANT ALL ON TABLE public.ticket_messages TO service_role;
GRANT ALL ON TABLE public.support_tickets TO anon;
GRANT ALL ON TABLE public.support_tickets TO authenticated;
GRANT ALL ON TABLE public.support_tickets TO service_role;

-- NOTIFY pgrst, 'reload schema';
