BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS message TEXT,
  ADD COLUMN IF NOT EXISTS entity_type TEXT,
  ADD COLUMN IF NOT EXISTS entity_id UUID,
  ADD COLUMN IF NOT EXISTS severity TEXT NOT NULL DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'unread',
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'notifications'
      AND column_name = 'description'
  ) THEN
    UPDATE public.notifications
    SET message = COALESCE(NULLIF(message, ''), NULLIF(description, ''), '')
    WHERE message IS NULL OR message = '';
  ELSE
    UPDATE public.notifications
    SET message = COALESCE(message, '')
    WHERE message IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'notifications'
      AND column_name = 'read'
  ) THEN
    UPDATE public.notifications
    SET
      status = CASE WHEN COALESCE(read, false) THEN 'read' ELSE 'unread' END,
      read_at = CASE WHEN COALESCE(read, false) AND read_at IS NULL THEN created_at ELSE read_at END
    WHERE status IS NULL OR status NOT IN ('unread', 'read', 'archived');
  END IF;
END $$;

UPDATE public.notifications
SET
  severity = CASE
    WHEN lower(COALESCE(severity, 'info')) IN ('info', 'warning', 'critical') THEN lower(severity)
    ELSE 'info'
  END,
  status = CASE
    WHEN lower(COALESCE(status, 'unread')) IN ('unread', 'read', 'archived') THEN lower(status)
    ELSE 'unread'
  END,
  metadata = COALESCE(metadata, '{}'::jsonb),
  message = COALESCE(message, '');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notifications_type_check'
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_type_check
      CHECK (type IN (
        'comanda_aberta',
        'estoque_baixo',
        'pagamento_a_realizar',
        'cobranca_clube_chefes',
        'proximo_cliente',
        'cliente_atrasado',
        'appointment_reminder',
        'stock_low',
        'purchase_request',
        'transaction',
        'system_alert',
        'admin_message',
        'STOCK_LOW'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notifications_severity_check'
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_severity_check
      CHECK (severity IN ('info', 'warning', 'critical'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notifications_status_check'
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_status_check
      CHECK (status IN ('unread', 'read', 'archived'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.notifications
    WHERE tenant_id IS NULL
  ) THEN
    ALTER TABLE public.notifications ALTER COLUMN tenant_id SET NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.notifications
    WHERE message IS NULL
  ) THEN
    ALTER TABLE public.notifications ALTER COLUMN message SET NOT NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'comanda_aberta',
    'estoque_baixo',
    'pagamento_a_realizar',
    'cobranca_clube_chefes',
    'proximo_cliente',
    'cliente_atrasado'
  )),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id, type)
);

CREATE INDEX IF NOT EXISTS idx_notifications_tenant_id ON public.notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON public.notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_status_created ON public.notifications(tenant_id, status, created_at DESC);

WITH duplicate_unread_notifications AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY
        tenant_id,
        type,
        COALESCE(entity_type, ''),
        COALESCE(entity_id, '00000000-0000-0000-0000-000000000000'::uuid),
        COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid)
      ORDER BY created_at DESC, id DESC
    ) AS row_number
  FROM public.notifications
  WHERE status = 'unread'
)
UPDATE public.notifications n
SET
  status = 'archived',
  read_at = COALESCE(n.read_at, now())
FROM duplicate_unread_notifications duplicate
WHERE n.id = duplicate.id
  AND duplicate.row_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_unread_dedupe
  ON public.notifications (
    tenant_id,
    type,
    COALESCE(entity_type, ''),
    COALESCE(entity_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE status = 'unread';

CREATE INDEX IF NOT EXISTS idx_notification_preferences_tenant_user
  ON public.notification_preferences(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_type
  ON public.notification_preferences(type);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant isolation notifications" ON public.notifications;
DROP POLICY IF EXISTS notifications_select ON public.notifications;
DROP POLICY IF EXISTS notifications_insert ON public.notifications;
DROP POLICY IF EXISTS notifications_update ON public.notifications;
DROP POLICY IF EXISTS notifications_delete ON public.notifications;

CREATE POLICY notifications_select
ON public.notifications
FOR SELECT
TO authenticated
USING (
  public.current_is_super_admin_from_auth_uid()
  OR (
    tenant_id = public.current_tenant_id_from_auth_uid()
    AND (user_id IS NULL OR user_id = auth.uid())
  )
);

CREATE POLICY notifications_insert
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  public.current_is_super_admin_from_auth_uid()
  OR (
    tenant_id = public.current_tenant_id_from_auth_uid()
    AND (user_id IS NULL OR user_id = auth.uid())
  )
);

CREATE POLICY notifications_update
ON public.notifications
FOR UPDATE
TO authenticated
USING (
  public.current_is_super_admin_from_auth_uid()
  OR (
    tenant_id = public.current_tenant_id_from_auth_uid()
    AND (user_id IS NULL OR user_id = auth.uid())
  )
)
WITH CHECK (
  public.current_is_super_admin_from_auth_uid()
  OR (
    tenant_id = public.current_tenant_id_from_auth_uid()
    AND (user_id IS NULL OR user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS notification_preferences_select ON public.notification_preferences;
DROP POLICY IF EXISTS notification_preferences_insert ON public.notification_preferences;
DROP POLICY IF EXISTS notification_preferences_update ON public.notification_preferences;
DROP POLICY IF EXISTS notification_preferences_delete ON public.notification_preferences;

CREATE POLICY notification_preferences_select
ON public.notification_preferences
FOR SELECT
TO authenticated
USING (
  public.current_is_super_admin_from_auth_uid()
  OR (tenant_id = public.current_tenant_id_from_auth_uid() AND user_id = auth.uid())
);

CREATE POLICY notification_preferences_insert
ON public.notification_preferences
FOR INSERT
TO authenticated
WITH CHECK (
  public.current_is_super_admin_from_auth_uid()
  OR (tenant_id = public.current_tenant_id_from_auth_uid() AND user_id = auth.uid())
);

CREATE POLICY notification_preferences_update
ON public.notification_preferences
FOR UPDATE
TO authenticated
USING (
  public.current_is_super_admin_from_auth_uid()
  OR (tenant_id = public.current_tenant_id_from_auth_uid() AND user_id = auth.uid())
)
WITH CHECK (
  public.current_is_super_admin_from_auth_uid()
  OR (tenant_id = public.current_tenant_id_from_auth_uid() AND user_id = auth.uid())
);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notification_preferences_updated_at ON public.notification_preferences;
CREATE TRIGGER trg_notification_preferences_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.notification_type_catalog()
RETURNS TABLE(type TEXT, label TEXT, description TEXT)
LANGUAGE sql
STABLE
AS $$
  VALUES
    ('comanda_aberta', 'Comandas abertas', 'Avisar quando uma nova comanda for aberta.'),
    ('estoque_baixo', 'Estoque baixo', 'Avisar quando um produto atingir o estoque minimo.'),
    ('pagamento_a_realizar', 'Pagamentos a realizar', 'Avisar sobre contas pendentes, vencendo ou vencidas.'),
    ('cobranca_clube_chefes', 'Cobrancas do Clube dos Chefes', 'Avisar sobre mensalidades pendentes ou vencidas.'),
    ('proximo_cliente', 'Proximo cliente', 'Avisar sobre o proximo atendimento da agenda.'),
    ('cliente_atrasado', 'Cliente atrasado', 'Avisar quando o horario do atendimento ja passou.')
$$;

CREATE OR REPLACE FUNCTION public.create_internal_notification(
  p_tenant_id UUID,
  p_user_id UUID DEFAULT NULL,
  p_type TEXT DEFAULT NULL,
  p_title TEXT DEFAULT NULL,
  p_message TEXT DEFAULT NULL,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_severity TEXT DEFAULT 'info',
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_tenant_id UUID;
  v_is_super_admin BOOLEAN;
  v_user_id UUID;
  v_inserted_id UUID;
  v_first_id UUID;
  v_metadata JSONB := COALESCE(p_metadata, '{}'::jsonb);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado';
  END IF;

  IF p_tenant_id IS NULL OR p_type IS NULL OR NULLIF(BTRIM(p_title), '') IS NULL OR NULLIF(BTRIM(p_message), '') IS NULL THEN
    RAISE EXCEPTION 'Dados obrigatorios de notificacao ausentes';
  END IF;

  IF p_type NOT IN (
    'comanda_aberta',
    'estoque_baixo',
    'pagamento_a_realizar',
    'cobranca_clube_chefes',
    'proximo_cliente',
    'cliente_atrasado'
  ) THEN
    RAISE EXCEPTION 'Tipo de notificacao invalido: %', p_type;
  END IF;

  IF COALESCE(p_severity, 'info') NOT IN ('info', 'warning', 'critical') THEN
    RAISE EXCEPTION 'Severidade invalida: %', p_severity;
  END IF;

  SELECT public.current_tenant_id_from_auth_uid(), public.current_is_super_admin_from_auth_uid()
  INTO v_current_tenant_id, v_is_super_admin;

  IF NOT COALESCE(v_is_super_admin, false) AND p_tenant_id <> v_current_tenant_id THEN
    RAISE EXCEPTION 'Tenant invalido para notificacao';
  END IF;

  FOR v_user_id IN
    SELECT DISTINCT candidate.user_id
    FROM (
      SELECT p.id AS user_id
      FROM public.profiles p
      WHERE p.tenant_id = p_tenant_id
        AND COALESCE(lower(p.status), 'active') = 'active'
    ) candidate
    WHERE (p_user_id IS NULL OR candidate.user_id = p_user_id)
      AND NOT EXISTS (
        SELECT 1
        FROM public.notification_preferences pref
        WHERE pref.tenant_id = p_tenant_id
          AND pref.user_id = candidate.user_id
          AND pref.type = p_type
          AND pref.enabled = false
      )
  LOOP
    INSERT INTO public.notifications (
      tenant_id,
      user_id,
      type,
      title,
      message,
      entity_type,
      entity_id,
      severity,
      status,
      metadata,
      created_at
    )
    VALUES (
      p_tenant_id,
      v_user_id,
      p_type,
      BTRIM(p_title),
      BTRIM(p_message),
      NULLIF(BTRIM(p_entity_type), ''),
      p_entity_id,
      COALESCE(p_severity, 'info'),
      'unread',
      v_metadata,
      now()
    )
    ON CONFLICT (
      tenant_id,
      type,
      (COALESCE(entity_type, '')),
      (COALESCE(entity_id, '00000000-0000-0000-0000-000000000000'::uuid)),
      (COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid))
    )
    WHERE status = 'unread'
    DO UPDATE SET
      title = EXCLUDED.title,
      message = EXCLUDED.message,
      severity = EXCLUDED.severity,
      metadata = EXCLUDED.metadata,
      created_at = now()
    RETURNING id INTO v_inserted_id;

    v_first_id := COALESCE(v_first_id, v_inserted_id);
  END LOOP;

  RETURN v_first_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_internal_notifications(
  p_status TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  user_id UUID,
  type TEXT,
  title TEXT,
  message TEXT,
  entity_type TEXT,
  entity_id UUID,
  severity TEXT,
  status TEXT,
  read_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado';
  END IF;

  v_tenant_id := public.current_tenant_id_from_auth_uid();

  RETURN QUERY
  SELECT
    n.id,
    n.tenant_id,
    n.user_id,
    n.type,
    n.title,
    n.message,
    n.entity_type,
    n.entity_id,
    n.severity,
    n.status,
    n.read_at,
    n.metadata,
    n.created_at
  FROM public.notifications n
  WHERE n.tenant_id = v_tenant_id
    AND (n.user_id IS NULL OR n.user_id = auth.uid())
    AND (p_status IS NULL OR n.status = p_status)
  ORDER BY n.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 100))
  OFFSET GREATEST(0, COALESCE(p_offset, 0));
END;
$$;

CREATE OR REPLACE FUNCTION public.count_unread_notifications()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado';
  END IF;

  v_tenant_id := public.current_tenant_id_from_auth_uid();

  SELECT COUNT(*)::integer INTO v_count
  FROM public.notifications n
  WHERE n.tenant_id = v_tenant_id
    AND (n.user_id IS NULL OR n.user_id = auth.uid())
    AND n.status = 'unread';

  RETURN COALESCE(v_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado';
  END IF;

  v_tenant_id := public.current_tenant_id_from_auth_uid();

  UPDATE public.notifications
  SET status = 'read', read_at = COALESCE(read_at, now())
  WHERE id = p_notification_id
    AND tenant_id = v_tenant_id
    AND (user_id IS NULL OR user_id = auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado';
  END IF;

  v_tenant_id := public.current_tenant_id_from_auth_uid();

  UPDATE public.notifications
  SET status = 'read', read_at = COALESCE(read_at, now())
  WHERE tenant_id = v_tenant_id
    AND (user_id IS NULL OR user_id = auth.uid())
    AND status = 'unread';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN COALESCE(v_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_notification(p_notification_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado';
  END IF;

  v_tenant_id := public.current_tenant_id_from_auth_uid();

  UPDATE public.notifications
  SET status = 'archived', read_at = COALESCE(read_at, now())
  WHERE id = p_notification_id
    AND tenant_id = v_tenant_id
    AND (user_id IS NULL OR user_id = auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION public.get_notification_preferences()
RETURNS TABLE(type TEXT, label TEXT, description TEXT, enabled BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado';
  END IF;

  v_tenant_id := public.current_tenant_id_from_auth_uid();

  RETURN QUERY
  SELECT
    catalog.type,
    catalog.label,
    catalog.description,
    COALESCE(pref.enabled, true) AS enabled
  FROM public.notification_type_catalog() catalog
  LEFT JOIN public.notification_preferences pref
    ON pref.tenant_id = v_tenant_id
   AND pref.user_id = auth.uid()
   AND pref.type = catalog.type
  ORDER BY array_position(ARRAY[
    'comanda_aberta',
    'estoque_baixo',
    'pagamento_a_realizar',
    'cobranca_clube_chefes',
    'proximo_cliente',
    'cliente_atrasado'
  ], catalog.type);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_notification_preferences(p_preferences JSONB)
RETURNS TABLE(type TEXT, label TEXT, description TEXT, enabled BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_item JSONB;
  v_type TEXT;
  v_enabled BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado';
  END IF;

  IF p_preferences IS NULL OR jsonb_typeof(p_preferences) <> 'array' THEN
    RAISE EXCEPTION 'Preferencias invalidas';
  END IF;

  v_tenant_id := public.current_tenant_id_from_auth_uid();

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_preferences)
  LOOP
    v_type := v_item->>'type';
    v_enabled := COALESCE((v_item->>'enabled')::boolean, true);

    IF v_type IN (
      'comanda_aberta',
      'estoque_baixo',
      'pagamento_a_realizar',
      'cobranca_clube_chefes',
      'proximo_cliente',
      'cliente_atrasado'
    ) THEN
      INSERT INTO public.notification_preferences (tenant_id, user_id, type, enabled)
      VALUES (v_tenant_id, auth.uid(), v_type, v_enabled)
      ON CONFLICT (tenant_id, user_id, type)
      DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now();
    END IF;
  END LOOP;

  RETURN QUERY SELECT * FROM public.get_notification_preferences();
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_system_notifications(
  p_tenant_id UUID DEFAULT NULL,
  p_upcoming_minutes INTEGER DEFAULT 60,
  p_billing_days INTEGER DEFAULT 3
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_is_super_admin BOOLEAN;
  v_count INTEGER := 0;
  v_row RECORD;
  v_due_date DATE;
  v_due_day INTEGER;
  v_generated_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado';
  END IF;

  SELECT public.current_tenant_id_from_auth_uid(), public.current_is_super_admin_from_auth_uid()
  INTO v_tenant_id, v_is_super_admin;

  v_tenant_id := COALESCE(p_tenant_id, v_tenant_id);

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant invalido';
  END IF;

  IF NOT COALESCE(v_is_super_admin, false) AND v_tenant_id <> public.current_tenant_id_from_auth_uid() THEN
    RAISE EXCEPTION 'Tenant invalido';
  END IF;

  FOR v_row IN
    SELECT id, name, stock_quantity, minimum_stock
    FROM public.products
    WHERE tenant_id = v_tenant_id
      AND COALESCE(active, true) = true
      AND COALESCE(stock_quantity, 0) <= COALESCE(minimum_stock, 0)
      AND COALESCE(minimum_stock, 0) >= 0
  LOOP
    SELECT public.create_internal_notification(
      v_tenant_id,
      NULL,
      'estoque_baixo',
      'Estoque baixo',
      'O produto ' || v_row.name || ' está com estoque abaixo do mínimo.',
      'products',
      v_row.id,
      CASE WHEN COALESCE(v_row.stock_quantity, 0) <= 0 THEN 'critical' ELSE 'warning' END,
      jsonb_build_object('stock_quantity', v_row.stock_quantity, 'minimum_stock', v_row.minimum_stock)
    ) INTO v_generated_id;
    IF v_generated_id IS NOT NULL THEN v_count := v_count + 1; END IF;
  END LOOP;

  FOR v_row IN
    SELECT id, description, amount, date, status, to_jsonb(t) AS payload
    FROM public.transactions t
    WHERE tenant_id = v_tenant_id
      AND type IN ('expense', 'recurring')
      AND lower(COALESCE(status, 'pending')) IN ('pending', 'overdue')
  LOOP
    v_due_date := NULL;
    v_due_day := NULLIF(v_row.payload->>'due_day', '')::integer;

    IF v_row.date IS NOT NULL THEN
      v_due_date := v_row.date::date;
    ELSIF v_due_day IS NOT NULL THEN
      v_due_date := make_date(EXTRACT(YEAR FROM current_date)::integer, EXTRACT(MONTH FROM current_date)::integer, LEAST(GREATEST(v_due_day, 1), 28));
    END IF;

    IF v_due_date IS NOT NULL AND v_due_date <= current_date + GREATEST(COALESCE(p_billing_days, 3), 0) THEN
      SELECT public.create_internal_notification(
        v_tenant_id,
        NULL,
        'pagamento_a_realizar',
        CASE WHEN v_due_date < current_date THEN 'Pagamento vencido' ELSE 'Pagamento a realizar' END,
        'Existe um pagamento de R$ ' || to_char(COALESCE(v_row.amount, 0), 'FM999G999G990D00') || ' com vencimento em ' || to_char(v_due_date, 'DD/MM/YYYY') || '.',
        'transactions',
        v_row.id,
        CASE WHEN v_due_date < current_date OR lower(COALESCE(v_row.status, '')) = 'overdue' THEN 'critical' ELSE 'warning' END,
        jsonb_build_object('due_date', v_due_date, 'amount', v_row.amount, 'status', v_row.status)
      ) INTO v_generated_id;
      IF v_generated_id IS NOT NULL THEN v_count := v_count + 1; END IF;
    END IF;
  END LOOP;

  FOR v_row IN
    SELECT
      cs.id,
      cs.status,
      cs.next_billing_date,
      c.name AS client_name,
      cp.monthly_price
    FROM public.customer_subscriptions cs
    JOIN public.clients c ON c.id = cs.client_id AND c.tenant_id = cs.tenant_id
    LEFT JOIN public.customer_plans cp ON cp.id = cs.plan_id AND cp.tenant_id = cs.tenant_id
    WHERE cs.tenant_id = v_tenant_id
      AND (
        cs.status = 'past_due'
        OR (
          cs.status = 'active'
          AND cs.next_billing_date <= current_date + GREATEST(COALESCE(p_billing_days, 3), 0)
        )
      )
  LOOP
    SELECT public.create_internal_notification(
      v_tenant_id,
      NULL,
      'cobranca_clube_chefes',
      'Cobrança do Clube dos Chefes',
      'O cliente ' || COALESCE(v_row.client_name, 'sem nome') || ' possui uma cobrança ' ||
        CASE
          WHEN v_row.status = 'past_due' OR v_row.next_billing_date < current_date THEN 'vencida'
          WHEN v_row.next_billing_date = current_date THEN 'vencendo hoje'
          ELSE 'pendente'
        END || ' no Clube dos Chefes.',
      'customer_subscriptions',
      v_row.id,
      CASE WHEN v_row.status = 'past_due' OR v_row.next_billing_date < current_date THEN 'critical' ELSE 'warning' END,
      jsonb_build_object('next_billing_date', v_row.next_billing_date, 'status', v_row.status, 'monthly_price', v_row.monthly_price)
    ) INTO v_generated_id;
    IF v_generated_id IS NOT NULL THEN v_count := v_count + 1; END IF;
  END LOOP;

  SELECT a.*
  INTO v_row
  FROM public.appointments a
  WHERE a.tenant_id = v_tenant_id
    AND lower(COALESCE(a.status, 'pending')) IN ('pending', 'confirmed')
    AND COALESCE(a.hidden_from_schedule, false) = false
    AND a.start_time >= now()
    AND a.start_time <= now() + (GREATEST(COALESCE(p_upcoming_minutes, 60), 1) || ' minutes')::interval
  ORDER BY a.start_time ASC
  LIMIT 1;

  IF FOUND THEN
    SELECT public.create_internal_notification(
      v_tenant_id,
      NULL,
      'proximo_cliente',
      'Próximo cliente',
      'O próximo cliente a ser atendido é ' || COALESCE(v_row.client_name, 'sem nome') || ', às ' || to_char(v_row.start_time AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') || '.',
      'appointments',
      v_row.id,
      'info',
      jsonb_build_object('start_time', v_row.start_time, 'status', v_row.status)
    ) INTO v_generated_id;
    IF v_generated_id IS NOT NULL THEN v_count := v_count + 1; END IF;
  END IF;

  FOR v_row IN
    SELECT id, client_name, start_time, status
    FROM public.appointments
    WHERE tenant_id = v_tenant_id
      AND lower(COALESCE(status, 'pending')) IN ('pending', 'confirmed')
      AND COALESCE(hidden_from_schedule, false) = false
      AND start_time < now()
      AND start_time >= now() - interval '1 day'
    ORDER BY start_time ASC
  LOOP
    SELECT public.create_internal_notification(
      v_tenant_id,
      NULL,
      'cliente_atrasado',
      'Cliente atrasado',
      'O cliente ' || COALESCE(v_row.client_name, 'sem nome') || ' está atrasado para o atendimento das ' || to_char(v_row.start_time AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') || '.',
      'appointments',
      v_row.id,
      CASE WHEN v_row.start_time < now() - interval '30 minutes' THEN 'critical' ELSE 'warning' END,
      jsonb_build_object('start_time', v_row.start_time, 'status', v_row.status)
    ) INTO v_generated_id;
    IF v_generated_id IS NOT NULL THEN v_count := v_count + 1; END IF;
  END LOOP;

  RETURN jsonb_build_object('generated', v_count, 'tenant_id', v_tenant_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_comanda_open()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_name TEXT;
BEGIN
  IF NEW.tenant_id IS NULL OR NEW.status <> 'open' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND COALESCE(OLD.status, '') = COALESCE(NEW.status, '') THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_client_name
  FROM public.clients
  WHERE id = NEW.client_id AND tenant_id = NEW.tenant_id
  LIMIT 1;

  PERFORM public.create_internal_notification(
    NEW.tenant_id,
    NULL,
    'comanda_aberta',
    'Nova comanda aberta',
    'Uma nova comanda foi aberta para ' || COALESCE(v_client_name, 'comanda #' || substring(NEW.id::text from 1 for 8)) || '.',
    'comandas',
    NEW.id,
    'info',
    jsonb_build_object('comanda_id', NEW.id, 'client_id', NEW.client_id)
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_low_stock_product()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.active, true) = true
    AND COALESCE(NEW.stock_quantity, 0) <= COALESCE(NEW.minimum_stock, 0)
    AND COALESCE(NEW.minimum_stock, 0) >= 0
  THEN
    PERFORM public.create_internal_notification(
      NEW.tenant_id,
      NULL,
      'estoque_baixo',
      'Estoque baixo',
      'O produto ' || NEW.name || ' está com estoque abaixo do mínimo.',
      'products',
      NEW.id,
      CASE WHEN COALESCE(NEW.stock_quantity, 0) <= 0 THEN 'critical' ELSE 'warning' END,
      jsonb_build_object('stock_quantity', NEW.stock_quantity, 'minimum_stock', NEW.minimum_stock)
    );
  ELSE
    UPDATE public.notifications
    SET status = 'archived', read_at = COALESCE(read_at, now())
    WHERE tenant_id = NEW.tenant_id
      AND type = 'estoque_baixo'
      AND entity_type = 'products'
      AND entity_id = NEW.id
      AND status = 'unread';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_minimum_stock(p_product_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_stock INTEGER;
  v_min_stock INTEGER;
  v_auto_order BOOLEAN;
  v_tenant_id UUID;
  v_name TEXT;
BEGIN
  SELECT stock_quantity, minimum_stock, auto_generate_purchase_order, tenant_id, name
  INTO v_current_stock, v_min_stock, v_auto_order, v_tenant_id, v_name
  FROM public.products
  WHERE id = p_product_id;

  IF v_tenant_id IS NULL THEN
    RETURN;
  END IF;

  IF COALESCE(v_current_stock, 0) <= COALESCE(v_min_stock, 0) THEN
    PERFORM public.create_internal_notification(
      v_tenant_id,
      NULL,
      'estoque_baixo',
      'Estoque baixo',
      'O produto ' || COALESCE(v_name, 'sem nome') || ' está com estoque abaixo do mínimo.',
      'products',
      p_product_id,
      CASE WHEN COALESCE(v_current_stock, 0) <= 0 THEN 'critical' ELSE 'warning' END,
      jsonb_build_object('stock_quantity', v_current_stock, 'minimum_stock', v_min_stock)
    );

    IF COALESCE(v_auto_order, false) = true THEN
      INSERT INTO public.purchase_orders (tenant_id, product_id, quantity, status)
      VALUES (v_tenant_id, p_product_id, GREATEST(COALESCE(v_min_stock, 0) * 2, 1), 'pending');
    END IF;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_comanda_open_insert ON public.comandas;
CREATE TRIGGER trg_notify_comanda_open_insert
AFTER INSERT ON public.comandas
FOR EACH ROW
WHEN (NEW.status = 'open')
EXECUTE FUNCTION public.notify_comanda_open();

DROP TRIGGER IF EXISTS trg_notify_comanda_open_update ON public.comandas;
CREATE TRIGGER trg_notify_comanda_open_update
AFTER UPDATE OF status ON public.comandas
FOR EACH ROW
WHEN (NEW.status = 'open' AND OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.notify_comanda_open();

DROP TRIGGER IF EXISTS trg_notify_low_stock_product ON public.products;
CREATE TRIGGER trg_notify_low_stock_product
AFTER INSERT OR UPDATE OF stock_quantity, minimum_stock, active ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.notify_low_stock_product();

REVOKE ALL ON FUNCTION public.create_internal_notification(UUID, UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_internal_notifications(TEXT, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.count_unread_notifications() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_notification_read(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_all_notifications_read() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.archive_notification(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_notification_preferences() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_notification_preferences(JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.generate_system_notifications(UUID, INTEGER, INTEGER) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_internal_notification(UUID, UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_internal_notifications(TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_unread_notifications() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_notification(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_notification_preferences() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_notification_preferences(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_system_notifications(UUID, INTEGER, INTEGER) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
