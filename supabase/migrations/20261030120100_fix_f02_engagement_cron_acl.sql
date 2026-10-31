-- ============================================================================
-- F02 — claim_due_reminders / process_waitlist_cancellation expõem PII
-- ============================================================================
-- Achado: docs/security-audit/relatorio-auditoria-seguranca.pdf (F02, crítico)
-- Superfície:
--   public.claim_due_reminders(uuid, integer)
--   public.process_waitlist_cancellation(uuid, uuid)
--
-- As duas funções são SECURITY DEFINER e foram criadas sem REVOKE. O default do
-- PostgreSQL concedeu EXECUTE a PUBLIC, e o Supabase também materializou grants
-- para anon/authenticated. Com a anon key (pública), qualquer cliente chamava a
-- RPC e recebia nome/telefone de clientes de todos os tenants, além de consumir
-- a janela de idempotência dos lembretes.
--
-- Correção: revogar PUBLIC/anon/authenticated e manter EXECUTE apenas para o
-- caminho interno de cron/worker (service_role e worker_dispatcher).
--
-- Além do ACL, a função é recriada para corrigir uma ambiguidade de PL/pgSQL:
-- `ON CONFLICT (tenant_id, ...)` resolvia `tenant_id` como variável de saída e
-- falhava em runtime com "column reference tenant_id is ambiguous". O alvo passa
-- a ser a constraint única, mantendo o comportamento idempotente original.
--
-- Operação: o agendador (pg_cron/pg_net) deve enviar um JWT de service_role ou
-- da role worker_dispatcher. A anon key não é mais aceita nessas RPCs.
--
-- Rollback: recriar claim_due_reminders como em
-- 20261026083000_setup_engagement_cron_triggers.sql e
-- GRANT EXECUTE ... TO anon, authenticated (não recomendado).
-- ============================================================================

REVOKE ALL ON FUNCTION public.claim_due_reminders(uuid, integer)
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.process_waitlist_cancellation(uuid, uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_due_reminders(
    p_tenant_id UUID DEFAULT NULL,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    reminder_log_id UUID,
    tenant_id UUID,
    appointment_id UUID,
    client_id UUID,
    client_name TEXT,
    client_phone TEXT,
    service_name TEXT,
    start_time TIMESTAMPTZ,
    reminder_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_now_sp TIMESTAMP WITHOUT TIME ZONE;
    v_window_start TIMESTAMP WITHOUT TIME ZONE;
    v_window_end TIMESTAMP WITHOUT TIME ZONE;
BEGIN
    -- Regra 21 SMG: Cálculo no fuso operacional de São Paulo
    v_now_sp := (now() AT TIME ZONE 'America/Sao_Paulo');
    v_window_start := v_now_sp + INTERVAL '2 hours';
    v_window_end := v_now_sp + INTERVAL '2 hours 15 minutes';

    RETURN QUERY
    WITH eligible_appointments AS (
        SELECT 
            a.id AS app_id,
            a.tenant_id AS app_tenant_id,
            a.client_id AS app_client_id,
            COALESCE(c.name, a.client_name, 'Cliente') AS app_client_name,
            c.phone AS app_client_phone,
            COALESCE(s.name, a.service_name, 'Serviço') AS app_service_name,
            a.start_time AS app_start_time,
            '2h'::TEXT AS app_reminder_type
        FROM public.appointments a
        LEFT JOIN public.clients c ON c.id = a.client_id
        LEFT JOIN public.services s ON s.id = a.service_id
        WHERE (p_tenant_id IS NULL OR a.tenant_id = p_tenant_id)
          AND a.status IN ('confirmed', 'scheduled')
          -- Janela de 2h a 2h15m no fuso America/Sao_Paulo
          AND (a.start_time AT TIME ZONE 'America/Sao_Paulo') >= v_window_start
          AND (a.start_time AT TIME ZONE 'America/Sao_Paulo') < v_window_end
          -- Não pode ter sido reivindicado ou enviado anteriormente
          AND NOT EXISTS (
              SELECT 1 
              FROM public.appointment_reminder_logs arl
              WHERE arl.tenant_id = a.tenant_id
                AND arl.appointment_id = a.id
                AND arl.reminder_type = '2h'
          )
        ORDER BY a.start_time ASC
        LIMIT p_limit
        FOR UPDATE OF a SKIP LOCKED
    ),
    inserted_logs AS (
        INSERT INTO public.appointment_reminder_logs AS arl (
            tenant_id,
            appointment_id,
            reminder_type,
            status
        )
        SELECT 
            ea.app_tenant_id,
            ea.app_id,
            ea.app_reminder_type,
            'claimed'
        FROM eligible_appointments ea
        ON CONFLICT ON CONSTRAINT uq_appointment_reminder_tenant_type DO NOTHING
        RETURNING arl.id, arl.appointment_id
    )
    SELECT 
        il.id AS reminder_log_id,
        ea.app_tenant_id AS tenant_id,
        ea.app_id AS appointment_id,
        ea.app_client_id AS client_id,
        ea.app_client_name AS client_name,
        ea.app_client_phone AS client_phone,
        ea.app_service_name AS service_name,
        ea.app_start_time AS start_time,
        ea.app_reminder_type AS reminder_type
    FROM inserted_logs il
    JOIN eligible_appointments ea ON ea.app_id = il.appointment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_due_reminders(uuid, integer)
  TO service_role, worker_dispatcher;

GRANT EXECUTE ON FUNCTION public.process_waitlist_cancellation(uuid, uuid)
  TO service_role, worker_dispatcher;
