-- ============================================================================
-- Migration: 20261027180000_adr038_subscription_recurring_slots.sql
-- ADR-038: Horário Fixo Recorrente para Assinantes Chef Club com Yield Management e Janela Rolante
-- ============================================================================

BEGIN;

-- 1. Criação da tabela subscription_recurring_slots
CREATE TABLE IF NOT EXISTS public.subscription_recurring_slots (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  subscription_id   UUID NOT NULL REFERENCES public.customer_subscriptions(id) ON DELETE CASCADE,
  client_id         UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  professional_id   UUID NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT,
  service_id        UUID NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  day_of_week       SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Domingo, 1=Segunda, ..., 6=Sábado
  start_time        TIME WITHOUT TIME ZONE NOT NULL,
  duration_minutes  INTEGER NOT NULL DEFAULT 30 CHECK (duration_minutes > 0),
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_subscription_recurring_slot_professional UNIQUE (tenant_id, professional_id, day_of_week, start_time)
);

-- 2. Alteração na tabela appointments para rastreabilidade de recorrência
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS recurring_slot_id UUID REFERENCES public.subscription_recurring_slots(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES public.customer_subscriptions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN NOT NULL DEFAULT false;

-- 3. Índices de Otimização e Chaves Estrangeiras
CREATE INDEX IF NOT EXISTS idx_sub_rec_slots_tenant_active
  ON public.subscription_recurring_slots(tenant_id, is_active);

CREATE INDEX IF NOT EXISTS idx_sub_rec_slots_subscription
  ON public.subscription_recurring_slots(tenant_id, subscription_id);

CREATE INDEX IF NOT EXISTS idx_sub_rec_slots_client
  ON public.subscription_recurring_slots(tenant_id, client_id);

CREATE INDEX IF NOT EXISTS idx_sub_rec_slots_prof_dow
  ON public.subscription_recurring_slots(tenant_id, professional_id, day_of_week);

CREATE INDEX IF NOT EXISTS idx_appointments_recurring_slot
  ON public.appointments(tenant_id, recurring_slot_id);

CREATE INDEX IF NOT EXISTS idx_appointments_subscription
  ON public.appointments(tenant_id, subscription_id);

-- 4. Trigger para atualização automática de updated_at
DROP TRIGGER IF EXISTS trg_sub_rec_slots_updated_at ON public.subscription_recurring_slots;
CREATE TRIGGER trg_sub_rec_slots_updated_at
  BEFORE UPDATE ON public.subscription_recurring_slots
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at_timestamp();

-- 5. Trigger para inativação automática (soft-deactivation) em caso de cancelamento/pausa da assinatura
CREATE OR REPLACE FUNCTION public.handle_customer_subscription_recurring_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status IN ('canceled', 'paused') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE public.subscription_recurring_slots
    SET is_active = false,
        updated_at = timezone('utc'::text, now())
    WHERE subscription_id = NEW.id
      AND is_active = true;
  ELSIF NEW.status = 'active' AND OLD.status IN ('canceled', 'paused') THEN
    UPDATE public.subscription_recurring_slots
    SET is_active = true,
        updated_at = timezone('utc'::text, now())
    WHERE subscription_id = NEW.id
      AND is_active = false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_customer_subscription_recurring_sync ON public.customer_subscriptions;
CREATE TRIGGER trg_customer_subscription_recurring_sync
  AFTER UPDATE OF status ON public.customer_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_customer_subscription_recurring_sync();

-- 6. Row-Level Security (RLS v2) em subscription_recurring_slots
ALTER TABLE public.subscription_recurring_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscription_recurring_slots_select_tenant" ON public.subscription_recurring_slots;
CREATE POLICY "subscription_recurring_slots_select_tenant" ON public.subscription_recurring_slots
  FOR SELECT USING (
    public.current_is_super_admin_from_auth_uid()
    OR tenant_id = public.current_tenant_id_from_auth_uid()
  );

DROP POLICY IF EXISTS "subscription_recurring_slots_insert_tenant" ON public.subscription_recurring_slots;
CREATE POLICY "subscription_recurring_slots_insert_tenant" ON public.subscription_recurring_slots
  FOR INSERT WITH CHECK (
    public.current_is_super_admin_from_auth_uid()
    OR tenant_id = public.current_tenant_id_from_auth_uid()
  );

DROP POLICY IF EXISTS "subscription_recurring_slots_update_tenant" ON public.subscription_recurring_slots;
CREATE POLICY "subscription_recurring_slots_update_tenant" ON public.subscription_recurring_slots
  FOR UPDATE USING (
    public.current_is_super_admin_from_auth_uid()
    OR tenant_id = public.current_tenant_id_from_auth_uid()
  ) WITH CHECK (
    public.current_is_super_admin_from_auth_uid()
    OR tenant_id = public.current_tenant_id_from_auth_uid()
  );

DROP POLICY IF EXISTS "subscription_recurring_slots_delete_tenant" ON public.subscription_recurring_slots;
CREATE POLICY "subscription_recurring_slots_delete_tenant" ON public.subscription_recurring_slots
  FOR DELETE USING (
    public.current_is_super_admin_from_auth_uid()
    OR tenant_id = public.current_tenant_id_from_auth_uid()
  );

COMMIT;
