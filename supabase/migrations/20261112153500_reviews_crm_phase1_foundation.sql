-- ============================================================================
-- Fase 1: Fundação de Dados e Multilocação — Ecossistema de Avaliações,
-- Retenção (Churn Recovery) e CRM (LTV Materializado)
-- ============================================================================

-- 1. Extensão de online_booking_settings (sem duplicar tabela existente)
ALTER TABLE public.online_booking_settings
  ADD COLUMN IF NOT EXISTS google_place_id TEXT,
  ADD COLUMN IF NOT EXISTS is_review_funnel_active BOOLEAN NOT NULL DEFAULT false;

GRANT SELECT (
  google_place_id,
  is_review_funnel_active
) ON public.online_booking_settings TO anon;

-- 2. Materialização do LTV em public.clients + Trigger assíncrono em appointments
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS lifetime_value NUMERIC(12,2) NOT NULL DEFAULT 0;

-- Backfill inicial seguro considerando atendimentos já concluídos
UPDATE public.clients c
SET lifetime_value = GREATEST(
  COALESCE(c.lifetime_value, 0),
  COALESCE((
    SELECT SUM(COALESCE(a.price, 0))
    FROM public.appointments a
    WHERE a.client_id = c.id
      AND a.tenant_id = c.tenant_id
      AND a.status = 'completed'
  ), 0)
)
WHERE EXISTS (
  SELECT 1
  FROM public.appointments a
  WHERE a.client_id = c.id
    AND a.tenant_id = c.tenant_id
    AND a.status = 'completed'
);

CREATE OR REPLACE FUNCTION public.fn_sync_client_ltv()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delta NUMERIC(12,2) := 0;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.client_id IS NOT NULL AND NEW.status = 'completed' THEN
      v_delta := COALESCE(NEW.price, 0);
      IF v_delta <> 0 THEN
        UPDATE public.clients
        SET lifetime_value = GREATEST(0, COALESCE(lifetime_value, 0) + v_delta)
        WHERE id = NEW.client_id
          AND tenant_id = NEW.tenant_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Caso 1: mudou para completed
    IF OLD.status IS DISTINCT FROM 'completed' AND NEW.status = 'completed' THEN
      IF NEW.client_id IS NOT NULL THEN
        UPDATE public.clients
        SET lifetime_value = GREATEST(0, COALESCE(lifetime_value, 0) + COALESCE(NEW.price, 0))
        WHERE id = NEW.client_id
          AND tenant_id = NEW.tenant_id;
      END IF;
    -- Caso 2: saiu de completed (ex: cancelamento/reversão)
    ELSIF OLD.status = 'completed' AND NEW.status IS DISTINCT FROM 'completed' THEN
      IF OLD.client_id IS NOT NULL THEN
        UPDATE public.clients
        SET lifetime_value = GREATEST(0, COALESCE(lifetime_value, 0) - COALESCE(OLD.price, 0))
        WHERE id = OLD.client_id
          AND tenant_id = OLD.tenant_id;
      END IF;
    -- Caso 3: permaneceu completed mas valor ou cliente foi corrigido
    ELSIF OLD.status = 'completed' AND NEW.status = 'completed' THEN
      IF OLD.client_id IS DISTINCT FROM NEW.client_id THEN
        IF OLD.client_id IS NOT NULL THEN
          UPDATE public.clients
          SET lifetime_value = GREATEST(0, COALESCE(lifetime_value, 0) - COALESCE(OLD.price, 0))
          WHERE id = OLD.client_id
            AND tenant_id = OLD.tenant_id;
        END IF;
        IF NEW.client_id IS NOT NULL THEN
          UPDATE public.clients
          SET lifetime_value = GREATEST(0, COALESCE(lifetime_value, 0) + COALESCE(NEW.price, 0))
          WHERE id = NEW.client_id
            AND tenant_id = NEW.tenant_id;
        END IF;
      ELSIF COALESCE(OLD.price, 0) <> COALESCE(NEW.price, 0) AND NEW.client_id IS NOT NULL THEN
        v_delta := COALESCE(NEW.price, 0) - COALESCE(OLD.price, 0);
        UPDATE public.clients
        SET lifetime_value = GREATEST(0, COALESCE(lifetime_value, 0) + v_delta)
        WHERE id = NEW.client_id
          AND tenant_id = NEW.tenant_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_ltv ON public.appointments;
CREATE TRIGGER trg_sync_ltv
  AFTER INSERT OR UPDATE OF status, price, client_id
  ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_sync_client_ltv();

-- 3. Tabela universal de avaliações (Estabelecimento + Qualquer Colaborador do Tenant)
CREATE TABLE IF NOT EXISTS public.tenant_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  review_scope TEXT NOT NULL DEFAULT 'establishment'
    CHECK (review_scope IN ('establishment', 'staff')),
  staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  staff_role_snapshot TEXT,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'resolved', 'archived')),
  resolution_note TEXT,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  source_channel TEXT NOT NULL DEFAULT 'whatsapp'
    CHECK (source_channel IN ('whatsapp', 'kiosk', 'qr', 'app', 'public_link')),
  public_token TEXT,
  redirected_to_google BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_reviews_tenant_status_created
  ON public.tenant_reviews(tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tenant_reviews_tenant_staff
  ON public.tenant_reviews(tenant_id, staff_id)
  WHERE staff_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tenant_reviews_tenant_client
  ON public.tenant_reviews(tenant_id, client_id)
  WHERE client_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tenant_reviews_public_token
  ON public.tenant_reviews(public_token)
  WHERE public_token IS NOT NULL;

ALTER TABLE public.tenant_reviews ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tenant_reviews'
      AND policyname = 'tenant_reviews_select_authenticated'
  ) THEN
    CREATE POLICY "tenant_reviews_select_authenticated" ON public.tenant_reviews
      FOR SELECT TO authenticated
      USING (
        public.current_is_super_admin_from_auth_uid()
        OR tenant_id = public.current_tenant_id_from_auth_uid()
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tenant_reviews'
      AND policyname = 'tenant_reviews_write_authenticated'
  ) THEN
    CREATE POLICY "tenant_reviews_write_authenticated" ON public.tenant_reviews
      FOR ALL TO authenticated
      USING (
        public.current_is_super_admin_from_auth_uid()
        OR tenant_id = public.current_tenant_id_from_auth_uid()
      )
      WITH CHECK (
        public.current_is_super_admin_from_auth_uid()
        OR tenant_id = public.current_tenant_id_from_auth_uid()
      );
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE ON TABLE public.tenant_reviews TO authenticated;

-- 4. Caixa de Entrada de Alertas do Tenant (Realtime)
CREATE TABLE IF NOT EXISTS public.tenant_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  alert_type TEXT NOT NULL DEFAULT 'low_rating',
  severity TEXT NOT NULL DEFAULT 'warning'
    CHECK (severity IN ('info', 'warning', 'critical')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  reference_table TEXT,
  reference_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_alerts_tenant_unread_created
  ON public.tenant_alerts(tenant_id, is_read, created_at DESC);

ALTER TABLE public.tenant_alerts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tenant_alerts'
      AND policyname = 'tenant_alerts_select_authenticated'
  ) THEN
    CREATE POLICY "tenant_alerts_select_authenticated" ON public.tenant_alerts
      FOR SELECT TO authenticated
      USING (
        public.current_is_super_admin_from_auth_uid()
        OR tenant_id = public.current_tenant_id_from_auth_uid()
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tenant_alerts'
      AND policyname = 'tenant_alerts_update_authenticated'
  ) THEN
    CREATE POLICY "tenant_alerts_update_authenticated" ON public.tenant_alerts
      FOR UPDATE TO authenticated
      USING (
        public.current_is_super_admin_from_auth_uid()
        OR tenant_id = public.current_tenant_id_from_auth_uid()
      )
      WITH CHECK (
        public.current_is_super_admin_from_auth_uid()
        OR tenant_id = public.current_tenant_id_from_auth_uid()
      );
  END IF;
END $$;

GRANT SELECT, UPDATE ON TABLE public.tenant_alerts TO authenticated;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.tenant_alerts;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

-- 5. Cache de Prova Social (Google Places / Destaques)
CREATE TABLE IF NOT EXISTS public.tenant_reviews_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  external_review_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_photo_url TEXT,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  relative_time_description TEXT,
  published_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'google_places',
  is_visible BOOLEAN NOT NULL DEFAULT true,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, external_review_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_reviews_cache_public
  ON public.tenant_reviews_cache(tenant_id, is_visible, rating DESC, published_at DESC);

ALTER TABLE public.tenant_reviews_cache ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tenant_reviews_cache'
      AND policyname = 'tenant_reviews_cache_select_public'
  ) THEN
    CREATE POLICY "tenant_reviews_cache_select_public" ON public.tenant_reviews_cache
      FOR SELECT TO anon, authenticated
      USING (is_visible = true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tenant_reviews_cache'
      AND policyname = 'tenant_reviews_cache_write_manager'
  ) THEN
    CREATE POLICY "tenant_reviews_cache_write_manager" ON public.tenant_reviews_cache
      FOR ALL TO authenticated
      USING (
        public.current_is_super_admin_from_auth_uid()
        OR (
          tenant_id = public.current_tenant_id_from_auth_uid()
          AND public.current_is_manager_from_auth_uid(tenant_id)
        )
      )
      WITH CHECK (
        public.current_is_super_admin_from_auth_uid()
        OR (
          tenant_id = public.current_tenant_id_from_auth_uid()
          AND public.current_is_manager_from_auth_uid(tenant_id)
        )
      );
  END IF;
END $$;

GRANT SELECT ON TABLE public.tenant_reviews_cache TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tenant_reviews_cache TO authenticated;
