-- 20261026083000_setup_engagement_cron_triggers.sql
-- SMG Barber: Frente 3 — Automação de Engajamento (ADR-029)
-- Motor Time-Driven (Lembretes) + Event-Driven (Waitlist com Debounce)

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. TABELA DE IDEMPOTÊNCIA: appointment_reminder_logs
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.appointment_reminder_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
    reminder_type TEXT NOT NULL CHECK (reminder_type IN ('24h', '2h')),
    channel TEXT NOT NULL DEFAULT 'whatsapp',
    status TEXT NOT NULL DEFAULT 'claimed' CHECK (status IN ('claimed', 'sent', 'failed')),
    sent_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_appointment_reminder_tenant_type UNIQUE (tenant_id, appointment_id, reminder_type)
);

ALTER TABLE public.appointment_reminder_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "appointment_reminder_logs_tenant_select"
    ON public.appointment_reminder_logs FOR SELECT
    USING (tenant_id = public.current_tenant_id_from_auth_uid() OR public.current_is_super_admin_from_auth_uid());

CREATE POLICY "appointment_reminder_logs_tenant_insert"
    ON public.appointment_reminder_logs FOR INSERT
    WITH CHECK (tenant_id = public.current_tenant_id_from_auth_uid() OR public.current_is_super_admin_from_auth_uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. TABELA: waitlist (Fila de Espera)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.waitlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
    preferred_staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
    desired_date DATE NOT NULL,
    start_time_range TIME NULL,
    end_time_range TIME NULL,
    status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'notified', 'expired', 'booked')),
    notified_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waitlist_tenant_date_status
    ON public.waitlist (tenant_id, desired_date, status);

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "waitlist_tenant_all"
    ON public.waitlist FOR ALL
    USING (tenant_id = public.current_tenant_id_from_auth_uid() OR public.current_is_super_admin_from_auth_uid())
    WITH CHECK (tenant_id = public.current_tenant_id_from_auth_uid() OR public.current_is_super_admin_from_auth_uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RPC: claim_due_reminders (Time-Driven, Idempotente, Fuso America/Sao_Paulo)
-- ─────────────────────────────────────────────────────────────────────────────
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
        INSERT INTO public.appointment_reminder_logs (
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
        ON CONFLICT (tenant_id, appointment_id, reminder_type) DO NOTHING
        RETURNING id, appointment_id
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RPC: process_waitlist_cancellation (Event-Driven com Validação de Debounce)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.process_waitlist_cancellation(
    p_tenant_id UUID,
    p_appointment_id UUID
)
RETURNS TABLE (
    waitlist_id UUID,
    client_name TEXT,
    client_phone TEXT,
    service_name TEXT,
    slot_start TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_appointment RECORD;
    v_appt_date DATE;
    v_appt_time TIME;
BEGIN
    -- 1. Verifica se o agendamento AINDA permanece cancelado após os 2 minutos de debounce
    SELECT a.id, a.tenant_id, a.service_id, a.staff_id, a.start_time, a.status
    INTO v_appointment
    FROM public.appointments a
    WHERE a.id = p_appointment_id 
      AND a.tenant_id = p_tenant_id;

    IF NOT FOUND OR lower(v_appointment.status) NOT IN ('cancelled', 'canceled') THEN
        -- Agendamento foi reativado ou desfeito durante a janela de debounce: descarta
        RETURN;
    END IF;

    v_appt_date := (v_appointment.start_time AT TIME ZONE 'America/Sao_Paulo')::DATE;
    v_appt_time := (v_appointment.start_time AT TIME ZONE 'America/Sao_Paulo')::TIME;

    -- 2. Busca e marca os candidatos correspondentes na fila de espera
    RETURN QUERY
    WITH matching_waitlist AS (
        SELECT 
            w.id,
            c.name AS client_name,
            c.phone AS client_phone,
            COALESCE(s.name, 'Serviço') AS service_name,
            v_appointment.start_time AS slot_start
        FROM public.waitlist w
        JOIN public.clients c ON c.id = w.client_id
        LEFT JOIN public.services s ON s.id = w.service_id
        WHERE w.tenant_id = p_tenant_id
          AND w.status = 'waiting'
          AND w.desired_date = v_appt_date
          AND (w.preferred_staff_id IS NULL OR w.preferred_staff_id = v_appointment.staff_id)
          AND (w.service_id IS NULL OR w.service_id = v_appointment.service_id)
          AND (w.start_time_range IS NULL OR v_appt_time >= w.start_time_range)
          AND (w.end_time_range IS NULL OR v_appt_time <= w.end_time_range)
        ORDER BY w.created_at ASC
        LIMIT 5
        FOR UPDATE OF w SKIP LOCKED
    ),
    updated_waitlist AS (
        UPDATE public.waitlist target
        SET status = 'notified',
            notified_at = now()
        FROM matching_waitlist mw
        WHERE target.id = mw.id
        RETURNING target.id
    )
    SELECT 
        mw.id AS waitlist_id,
        mw.client_name,
        mw.client_phone,
        mw.service_name,
        mw.slot_start
    FROM matching_waitlist mw
    JOIN updated_waitlist uw ON uw.id = mw.id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. TRIGGER DE DEBOUNCE (2 minutos) NA TABELA APPOINTMENTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.waitlist_cancel_handler()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Detecta transição para cancelado (suporte a 'cancelled' e 'canceled')
    IF (lower(COALESCE(OLD.status, '')) NOT IN ('cancelled', 'canceled')) 
       AND (lower(COALESCE(NEW.status, '')) IN ('cancelled', 'canceled')) THEN

        -- Enfileira o evento na outbox durável com delay de 2 minutos
        INSERT INTO public.outbox_items (
            tenant_id,
            event_id,
            event_type,
            payload,
            metadata,
            status,
            retry_next_retry_at
        ) VALUES (
            NEW.tenant_id,
            'waitlist-cancel-' || NEW.id || '-' || extract(epoch from now())::bigint,
            'AppointmentCancelledWaitlist',
            jsonb_build_object(
                'appointment_id', NEW.id,
                'tenant_id', NEW.tenant_id,
                'start_time', NEW.start_time
            ),
            jsonb_build_object('source', 'waitlist_cancel_handler'),
            'pending',
            now() + INTERVAL '2 minutes' -- Debounce de 2 minutos
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_waitlist_appointment_cancelled ON public.appointments;
CREATE TRIGGER trg_waitlist_appointment_cancelled
    AFTER UPDATE OF status ON public.appointments
    FOR EACH ROW
    EXECUTE FUNCTION public.waitlist_cancel_handler();

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. AGENDAMENTO PG_CRON (Placeholder Seguro)
-- ─────────────────────────────────────────────────────────────────────────────
-- Execução a cada 15 minutos via pg_net chamando a Edge Function process-reminders.
-- NOTA DE DEPLOY: A URL e o Header Bearer devem ser preenchidos no momento da ativação em produção.
/*
SELECT cron.schedule(
    'invoke-reminders-job',
    '*/15 * * * *',
    $$
    SELECT net.http_post(
        url := 'https://<PROJECT-REF>.supabase.co/functions/v1/process-reminders',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer <EDGE_JWT_OU_PUBLISHABLE_KEY>'
        ),
        body := '{}'::jsonb
    );
    $$
);
*/
