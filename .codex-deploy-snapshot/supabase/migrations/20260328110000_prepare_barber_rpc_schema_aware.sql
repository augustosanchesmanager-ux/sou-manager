BEGIN;

-- ============================================================
-- Fase 4B - RPCs schema-aware para o dominio barber
-- Data: 2026-03-28
-- Objetivo:
--   - Adaptar close_order, check_minimum_stock e deduct_chef_club_credits
--   - Manter a assinatura atual consumida pelo frontend
--   - Nao tocar em receive_purchase_order
--   - Nao alterar funcoes shared/core que permanecem em public
--
-- Estrategia conservadora:
--   - As RPCs continuam publicas em public
--   - A escolha do schema de negocio e resolvida internamente
--   - Quando existir duplicidade entre public e barber, a preferencia e:
--       1. schema com estado mais "recente"
--       2. em empate ou incerteza, fallback para public
--   - Isso preserva o legado com a flag desligada e prepara a transicao futura
--
-- Fora de escopo:
--   - receive_purchase_order
--   - get_auth_access_context
--   - current_is_super_admin_from_auth_uid
--   - current_tenant_id_from_auth_uid
-- ============================================================

CREATE OR REPLACE FUNCTION public.table_has_column(
  p_schema_name text,
  p_table_name text,
  p_column_name text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = p_schema_name
      AND table_name = p_table_name
      AND column_name = p_column_name
  );
$$;

CREATE OR REPLACE FUNCTION public.pick_barber_runtime_schema(
  p_public_exists boolean,
  p_public_freshness timestamptz,
  p_barber_exists boolean,
  p_barber_freshness timestamptz
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_public_exists AND NOT p_barber_exists THEN
    RETURN 'public';
  END IF;

  IF p_barber_exists AND NOT p_public_exists THEN
    RETURN 'barber';
  END IF;

  IF NOT p_public_exists AND NOT p_barber_exists THEN
    RETURN NULL;
  END IF;

  IF p_public_freshness IS NOT NULL AND p_barber_freshness IS NOT NULL THEN
    IF p_barber_freshness > p_public_freshness THEN
      RETURN 'barber';
    END IF;

    RETURN 'public';
  END IF;

  IF p_public_freshness IS NULL AND p_barber_freshness IS NOT NULL THEN
    RETURN 'barber';
  END IF;

  RETURN 'public';
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_comanda_runtime_schema(
  p_comanda_id uuid
)
RETURNS TABLE (
  schema_name text,
  tenant_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_public_exists boolean := false;
  v_barber_exists boolean := false;
  v_public_tenant_id uuid;
  v_barber_tenant_id uuid;
  v_public_row_ts timestamptz;
  v_barber_row_ts timestamptz;
  v_public_items_ts timestamptz;
  v_barber_items_ts timestamptz;
  v_public_freshness timestamptz;
  v_barber_freshness timestamptz;
BEGIN
  SELECT
    c.tenant_id,
    COALESCE((to_jsonb(c) ->> 'updated_at')::timestamptz, (to_jsonb(c) ->> 'created_at')::timestamptz)
  INTO v_public_tenant_id, v_public_row_ts
  FROM public.comandas c
  WHERE c.id = p_comanda_id
  LIMIT 1;
  v_public_exists := FOUND;

  SELECT
    c.tenant_id,
    COALESCE((to_jsonb(c) ->> 'updated_at')::timestamptz, (to_jsonb(c) ->> 'created_at')::timestamptz)
  INTO v_barber_tenant_id, v_barber_row_ts
  FROM barber.comandas c
  WHERE c.id = p_comanda_id
  LIMIT 1;
  v_barber_exists := FOUND;

  IF v_public_exists THEN
    SELECT max(
      COALESCE((to_jsonb(ci) ->> 'updated_at')::timestamptz, (to_jsonb(ci) ->> 'created_at')::timestamptz)
    )
    INTO v_public_items_ts
    FROM public.comanda_items ci
    WHERE ci.comanda_id = p_comanda_id
      AND (v_public_tenant_id IS NULL OR ci.tenant_id = v_public_tenant_id);

    v_public_freshness := CASE
      WHEN v_public_row_ts IS NULL THEN v_public_items_ts
      WHEN v_public_items_ts IS NULL THEN v_public_row_ts
      ELSE GREATEST(v_public_row_ts, v_public_items_ts)
    END;
  END IF;

  IF v_barber_exists THEN
    SELECT max(
      COALESCE((to_jsonb(ci) ->> 'updated_at')::timestamptz, (to_jsonb(ci) ->> 'created_at')::timestamptz)
    )
    INTO v_barber_items_ts
    FROM barber.comanda_items ci
    WHERE ci.comanda_id = p_comanda_id
      AND (v_barber_tenant_id IS NULL OR ci.tenant_id = v_barber_tenant_id);

    v_barber_freshness := CASE
      WHEN v_barber_row_ts IS NULL THEN v_barber_items_ts
      WHEN v_barber_items_ts IS NULL THEN v_barber_row_ts
      ELSE GREATEST(v_barber_row_ts, v_barber_items_ts)
    END;
  END IF;

  schema_name := public.pick_barber_runtime_schema(
    v_public_exists,
    v_public_freshness,
    v_barber_exists,
    v_barber_freshness
  );

  tenant_id := CASE schema_name
    WHEN 'barber' THEN v_barber_tenant_id
    WHEN 'public' THEN v_public_tenant_id
    ELSE NULL
  END;

  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_product_runtime_schema(
  p_product_id uuid
)
RETURNS TABLE (
  schema_name text,
  tenant_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_public_exists boolean := false;
  v_barber_exists boolean := false;
  v_public_tenant_id uuid;
  v_barber_tenant_id uuid;
  v_public_freshness timestamptz;
  v_barber_freshness timestamptz;
BEGIN
  SELECT
    p.tenant_id,
    COALESCE((to_jsonb(p) ->> 'updated_at')::timestamptz, (to_jsonb(p) ->> 'created_at')::timestamptz)
  INTO v_public_tenant_id, v_public_freshness
  FROM public.products p
  WHERE p.id = p_product_id
  LIMIT 1;
  v_public_exists := FOUND;

  SELECT
    p.tenant_id,
    COALESCE((to_jsonb(p) ->> 'updated_at')::timestamptz, (to_jsonb(p) ->> 'created_at')::timestamptz)
  INTO v_barber_tenant_id, v_barber_freshness
  FROM barber.products p
  WHERE p.id = p_product_id
  LIMIT 1;
  v_barber_exists := FOUND;

  schema_name := public.pick_barber_runtime_schema(
    v_public_exists,
    v_public_freshness,
    v_barber_exists,
    v_barber_freshness
  );

  tenant_id := CASE schema_name
    WHEN 'barber' THEN v_barber_tenant_id
    WHEN 'public' THEN v_public_tenant_id
    ELSE NULL
  END;

  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_credit_runtime_schema(
  p_subscription_id uuid
)
RETURNS TABLE (
  schema_name text,
  tenant_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_public_exists boolean := false;
  v_barber_exists boolean := false;
  v_public_tenant_id uuid;
  v_barber_tenant_id uuid;
  v_public_freshness timestamptz;
  v_barber_freshness timestamptz;
BEGIN
  SELECT
    c.tenant_id,
    COALESCE((to_jsonb(c) ->> 'updated_at')::timestamptz, (to_jsonb(c) ->> 'created_at')::timestamptz)
  INTO v_public_tenant_id, v_public_freshness
  FROM public.customer_credits c
  WHERE c.subscription_id = p_subscription_id
  LIMIT 1;
  v_public_exists := FOUND;

  SELECT
    c.tenant_id,
    COALESCE((to_jsonb(c) ->> 'updated_at')::timestamptz, (to_jsonb(c) ->> 'created_at')::timestamptz)
  INTO v_barber_tenant_id, v_barber_freshness
  FROM barber.customer_credits c
  WHERE c.subscription_id = p_subscription_id
  LIMIT 1;
  v_barber_exists := FOUND;

  schema_name := public.pick_barber_runtime_schema(
    v_public_exists,
    v_public_freshness,
    v_barber_exists,
    v_barber_freshness
  );

  tenant_id := CASE schema_name
    WHEN 'barber' THEN v_barber_tenant_id
    WHEN 'public' THEN v_public_tenant_id
    ELSE NULL
  END;

  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_minimum_stock(
  p_product_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schema text;
  v_tenant_id uuid;
  v_current_stock integer;
  v_min_stock integer;
  v_auto_order boolean;
  v_name text;
BEGIN
  SELECT resolved.schema_name, resolved.tenant_id
  INTO v_schema, v_tenant_id
  FROM public.resolve_product_runtime_schema(p_product_id) AS resolved;

  IF v_schema IS NULL OR v_tenant_id IS NULL THEN
    RETURN;
  END IF;

  IF v_schema = 'barber' THEN
    SELECT p.stock_quantity, p.minimum_stock, p.auto_generate_purchase_order, p.name
    INTO v_current_stock, v_min_stock, v_auto_order, v_name
    FROM barber.products p
    WHERE p.id = p_product_id
      AND p.tenant_id = v_tenant_id
    LIMIT 1;
  ELSE
    SELECT p.stock_quantity, p.minimum_stock, p.auto_generate_purchase_order, p.name
    INTO v_current_stock, v_min_stock, v_auto_order, v_name
    FROM public.products p
    WHERE p.id = p_product_id
      AND p.tenant_id = v_tenant_id
    LIMIT 1;
  END IF;

  IF NOT FOUND OR v_current_stock IS NULL OR v_min_stock IS NULL THEN
    RETURN;
  END IF;

  IF v_current_stock <= v_min_stock THEN
    INSERT INTO public.notifications (tenant_id, type, title, message)
    VALUES (
      v_tenant_id,
      'STOCK_LOW',
      'Estoque Baixo',
      'O produto ' || coalesce(v_name, 'sem nome') || ' atingiu o nivel critico.'
    );

    IF COALESCE(v_auto_order, false) THEN
      IF v_schema = 'barber' THEN
        INSERT INTO barber.purchase_orders (tenant_id, product_id, quantity, status)
        VALUES (v_tenant_id, p_product_id, v_min_stock * 2, 'pending');
      ELSE
        INSERT INTO public.purchase_orders (tenant_id, product_id, quantity, status)
        VALUES (v_tenant_id, p_product_id, v_min_stock * 2, 'pending');
      END IF;
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.close_order(
  p_comanda_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schema text;
  v_tenant_id uuid;
  v_item record;
  v_item_select_sql text;
  v_product_update_sql text;
  v_comanda_update_sql text;
BEGIN
  SELECT resolved.schema_name, resolved.tenant_id
  INTO v_schema, v_tenant_id
  FROM public.resolve_comanda_runtime_schema(p_comanda_id) AS resolved;

  IF v_schema IS NULL THEN
    RETURN;
  END IF;

  v_product_update_sql := CASE
    WHEN v_schema = 'public' AND v_tenant_id IS NULL AND public.table_has_column(v_schema, 'products', 'updated_at') THEN
      format(
        'UPDATE %I.products
         SET stock_quantity = stock_quantity - $1,
             updated_at = now()
         WHERE id = $2',
        v_schema
      )
    WHEN v_schema = 'public' AND v_tenant_id IS NULL THEN
      format(
        'UPDATE %I.products
         SET stock_quantity = stock_quantity - $1
         WHERE id = $2',
        v_schema
      )
    WHEN v_schema = 'public' AND public.table_has_column(v_schema, 'products', 'updated_at') THEN
      format(
        'UPDATE %I.products
         SET stock_quantity = stock_quantity - $1,
             updated_at = now()
         WHERE id = $2
           AND (tenant_id = $3 OR tenant_id IS NULL)',
        v_schema
      )
    WHEN public.table_has_column(v_schema, 'products', 'updated_at') THEN
      format(
        'UPDATE %I.products
         SET stock_quantity = stock_quantity - $1,
             updated_at = now()
         WHERE id = $2
           AND tenant_id = $3',
        v_schema
      )
    ELSE
      format(
        'UPDATE %I.products
         SET stock_quantity = stock_quantity - $1
         WHERE id = $2
           AND tenant_id = $3',
        v_schema
      )
  END;

  v_item_select_sql := CASE
    WHEN v_schema = 'public' AND v_tenant_id IS NULL THEN
      format(
        'SELECT product_id, quantity
         FROM %I.comanda_items
         WHERE comanda_id = $1
           AND product_id IS NOT NULL',
        v_schema
      )
    WHEN v_schema = 'public' THEN
      format(
        'SELECT product_id, quantity
         FROM %I.comanda_items
         WHERE comanda_id = $1
           AND (tenant_id = $2 OR tenant_id IS NULL)
           AND product_id IS NOT NULL',
        v_schema
      )
    ELSE
      format(
        'SELECT product_id, quantity
         FROM %I.comanda_items
         WHERE comanda_id = $1
           AND tenant_id = $2
           AND product_id IS NOT NULL',
        v_schema
      )
  END;

  IF v_schema = 'public' AND v_tenant_id IS NULL THEN
    FOR v_item IN
      EXECUTE v_item_select_sql
      USING p_comanda_id
    LOOP
      EXECUTE v_product_update_sql
      USING v_item.quantity, v_item.product_id;

      PERFORM public.check_minimum_stock(v_item.product_id);
    END LOOP;
  ELSE
    FOR v_item IN
      EXECUTE v_item_select_sql
      USING p_comanda_id, v_tenant_id
    LOOP
      EXECUTE v_product_update_sql
      USING v_item.quantity, v_item.product_id, v_tenant_id;

      PERFORM public.check_minimum_stock(v_item.product_id);
    END LOOP;
  END IF;

  v_comanda_update_sql := CASE
    WHEN v_schema = 'public' AND v_tenant_id IS NULL AND public.table_has_column(v_schema, 'comandas', 'updated_at') THEN
      format(
        'UPDATE %I.comandas
         SET status = $1,
             updated_at = now()
         WHERE id = $2',
        v_schema
      )
    WHEN v_schema = 'public' AND v_tenant_id IS NULL THEN
      format(
        'UPDATE %I.comandas
         SET status = $1
         WHERE id = $2',
        v_schema
      )
    WHEN v_schema = 'public' AND public.table_has_column(v_schema, 'comandas', 'updated_at') THEN
      format(
        'UPDATE %I.comandas
         SET status = $1,
             updated_at = now()
         WHERE id = $2
           AND (tenant_id = $3 OR tenant_id IS NULL)',
        v_schema
      )
    WHEN public.table_has_column(v_schema, 'comandas', 'updated_at') THEN
      format(
        'UPDATE %I.comandas
         SET status = $1,
             updated_at = now()
         WHERE id = $2
           AND tenant_id = $3',
        v_schema
      )
    ELSE
      format(
        'UPDATE %I.comandas
         SET status = $1
         WHERE id = $2
           AND tenant_id = $3',
        v_schema
      )
  END;

  IF v_schema = 'public' AND v_tenant_id IS NULL THEN
    EXECUTE v_comanda_update_sql
    USING 'paid', p_comanda_id;
  ELSE
    EXECUTE v_comanda_update_sql
    USING 'paid', p_comanda_id, v_tenant_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.deduct_chef_club_credits(
  p_subscription_id uuid,
  p_amount integer,
  p_reference text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows integer;
  v_schema text;
  v_tenant_id uuid;
  v_credit_update_sql text;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;

  SELECT resolved.schema_name, resolved.tenant_id
  INTO v_schema, v_tenant_id
  FROM public.resolve_credit_runtime_schema(p_subscription_id) AS resolved;

  IF v_schema IS NULL OR v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Insufficient credits or subscription not found';
  END IF;

  v_credit_update_sql := CASE
    WHEN public.table_has_column(v_schema, 'customer_credits', 'updated_at') THEN
      format(
        'UPDATE %I.customer_credits
         SET available_credits = available_credits - $1,
             used_credits = used_credits + $1,
             updated_at = now()
         WHERE subscription_id = $2
           AND tenant_id = $3
           AND available_credits >= $1',
        v_schema
      )
    ELSE
      format(
        'UPDATE %I.customer_credits
         SET available_credits = available_credits - $1,
             used_credits = used_credits + $1
         WHERE subscription_id = $2
           AND tenant_id = $3
           AND available_credits >= $1',
        v_schema
      )
  END;

  EXECUTE v_credit_update_sql
  USING p_amount, p_subscription_id, v_tenant_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    RAISE EXCEPTION 'Insufficient credits or subscription not found';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_minimum_stock(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_chef_club_credits(uuid, integer, text) TO authenticated;

COMMIT;
