-- =============================================================================
-- Migration: Fase 6.0.2 — Onboarding Completo
--
-- 1. tenant_settings + colunas operacionais (com defaults inteligentes)
-- 2. tenants.first_appointment_at + trigger (KPI TTFA — apenas 1a ocorrência)
-- 3. RPC save_onboarding_step (persistência progressiva, idempotente, manager-only)
--
-- DESIGN: RPCs fazem apenas trabalho transacional; orquestração (validação,
-- eventos, defaults) vive nos Application Services. complete_onboarding() segue
-- sendo o finalizador (ativa tenant + marca onboarding_completed).
--
-- DEFAULTS (decisão PO 2026-08-05):
--   - timezone America/Sao_Paulo, moeda BRL
--   - intervalo entre horários 30min, duração padrão 60min
--   - horizonte de agendamento 30 dias, agenda por barbeiro ON
--   - NÃO há configuração de comissão/caixa no onboarding:
--       comissão nasce 40% por barbeiro (comportamento atual);
--       caixa obrigatório = ON (comportamento atual do fluxo de checkout).
-- =============================================================================

-- 1. tenant_settings — novas colunas operacionais
ALTER TABLE public.tenant_settings
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'BRL',
  ADD COLUMN IF NOT EXISTS appointment_interval_minutes INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS default_appointment_duration_minutes INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS booking_horizon_days INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS staff_owned_schedule BOOLEAN NOT NULL DEFAULT true;

-- 2a. tenants.first_appointment_at — KPI Time to First Appointment
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS first_appointment_at TIMESTAMPTZ;

-- 2b. Trigger: grava apenas a primeira ocorrência
CREATE OR REPLACE FUNCTION public.set_tenant_first_appointment_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tenant_id IS NOT NULL THEN
    UPDATE public.tenants
      SET first_appointment_at = now()
      WHERE id = NEW.tenant_id
        AND first_appointment_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_first_appointment_at ON public.appointments;
CREATE TRIGGER trg_set_first_appointment_at
  AFTER INSERT ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_tenant_first_appointment_at();

-- 3. RPC save_onboarding_step (persistência progressiva por bloco)
CREATE OR REPLACE FUNCTION public.save_onboarding_step(
  p_tenant_id UUID,
  p_step TEXT,
  p_data JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Security: apenas managers do tenant podem salvar passos do onboarding
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND tenant_id = p_tenant_id AND role = 'manager'
  ) THEN
    RAISE EXCEPTION 'Acesso negado: apenas managers do tenant podem configurar o onboarding';
  END IF;

  IF p_step = 'company' THEN
    INSERT INTO public.tenant_settings (
      tenant_id, phone, cnpj,
      address_street, address_number, address_city, address_state, address_zip,
      timezone, currency
    ) VALUES (
      p_tenant_id,
      NULLIF(p_data->>'phone', ''),
      NULLIF(p_data->>'cnpj', ''),
      NULLIF(p_data->>'address_street', ''),
      NULLIF(p_data->>'address_number', ''),
      NULLIF(p_data->>'address_city', ''),
      NULLIF(p_data->>'address_state', ''),
      NULLIF(p_data->>'address_zip', ''),
      COALESCE(NULLIF(p_data->>'timezone', ''), 'America/Sao_Paulo'),
      COALESCE(NULLIF(p_data->>'currency', ''), 'BRL')
    )
    ON CONFLICT (tenant_id) DO UPDATE SET
      phone = EXCLUDED.phone,
      cnpj = EXCLUDED.cnpj,
      address_street = EXCLUDED.address_street,
      address_number = EXCLUDED.address_number,
      address_city = EXCLUDED.address_city,
      address_state = EXCLUDED.address_state,
      address_zip = EXCLUDED.address_zip,
      timezone = EXCLUDED.timezone,
      currency = EXCLUDED.currency,
      updated_at = now();

  ELSIF p_step = 'operational' THEN
    INSERT INTO public.tenant_settings (
      tenant_id, business_hours,
      appointment_interval_minutes, default_appointment_duration_minutes,
      booking_horizon_days, staff_owned_schedule
    ) VALUES (
      p_tenant_id,
      p_data->'business_hours',
      COALESCE((p_data->>'appointment_interval_minutes')::INTEGER, 30),
      COALESCE((p_data->>'default_appointment_duration_minutes')::INTEGER, 60),
      COALESCE((p_data->>'booking_horizon_days')::INTEGER, 30),
      COALESCE((p_data->>'staff_owned_schedule')::BOOLEAN, true)
    )
    ON CONFLICT (tenant_id) DO UPDATE SET
      business_hours = EXCLUDED.business_hours,
      appointment_interval_minutes = EXCLUDED.appointment_interval_minutes,
      default_appointment_duration_minutes = EXCLUDED.default_appointment_duration_minutes,
      booking_horizon_days = EXCLUDED.booking_horizon_days,
      staff_owned_schedule = EXCLUDED.staff_owned_schedule,
      updated_at = now();

  ELSE
    RAISE EXCEPTION 'Passo de onboarding inválido: %', p_step;
  END IF;
END;
$$;
