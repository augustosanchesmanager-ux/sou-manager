BEGIN;

-- Revisable proposal only: auditable inventory settlement for Barber comandas.
-- Do not apply to production before SQL review and local Supabase validation.

CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  movement_type TEXT NOT NULL CHECK (
    movement_type IN (
      'sale',
      'return',
      'reversal',
      'adjustment',
      'purchase',
      'manual_correction'
    )
  ),
  quantity_delta INTEGER NOT NULL CHECK (quantity_delta <> 0),
  quantity_before INTEGER NOT NULL CHECK (quantity_before >= 0),
  quantity_after INTEGER NOT NULL CHECK (quantity_after >= 0),
  source_type TEXT NOT NULL CHECK (
    source_type IN (
      'comanda',
      'financial_reversal',
      'manual',
      'purchase_order'
    )
  ),
  source_id UUID NOT NULL,
  idempotency_key TEXT,
  reason TEXT,
  created_by_user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_movements_tenant_idempotency
ON public.inventory_movements(tenant_id, idempotency_key)
WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_created
ON public.inventory_movements(tenant_id, product_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_source
ON public.inventory_movements(tenant_id, source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_type_created
ON public.inventory_movements(tenant_id, movement_type, created_at DESC);

ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inventory_movements_select_by_tenant_or_superadmin"
ON public.inventory_movements;

CREATE POLICY "inventory_movements_select_by_tenant_or_superadmin"
ON public.inventory_movements
FOR SELECT
TO authenticated
USING (
  public.current_is_super_admin_from_auth_uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
);

REVOKE ALL ON TABLE public.inventory_movements FROM anon;
REVOKE ALL ON TABLE public.inventory_movements FROM authenticated;
GRANT SELECT ON TABLE public.inventory_movements TO authenticated;

COMMENT ON TABLE public.inventory_movements IS
  'Auditable stock ledger for tenant-scoped product movements. Direct writes are blocked; sensitive writes must happen through validated RPCs.';

CREATE OR REPLACE FUNCTION public.apply_inventory_sale_for_comanda(
  p_tenant_id UUID,
  p_comanda_id UUID,
  p_source_idempotency_key TEXT,
  p_created_by_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_uid UUID := auth.uid();
  v_item RECORD;
  v_product RECORD;
  v_existing_movement RECORD;
  v_inventory_key TEXT;
  v_quantity_before INTEGER;
  v_quantity_after INTEGER;
  v_created_count INTEGER := 0;
  v_idempotent_count INTEGER := 0;
  v_product_count INTEGER := 0;
BEGIN
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'Usuario autenticado obrigatorio';
  END IF;
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id obrigatorio para baixa de estoque';
  END IF;
  IF p_comanda_id IS NULL THEN
    RAISE EXCEPTION 'comanda_id obrigatorio para baixa de estoque';
  END IF;
  IF p_created_by_user_id IS NULL THEN
    RAISE EXCEPTION 'created_by_user_id obrigatorio para baixa de estoque';
  END IF;
  IF p_created_by_user_id IS DISTINCT FROM v_auth_uid THEN
    RAISE EXCEPTION 'Usuario de baixa de estoque nao corresponde ao usuario autenticado';
  END IF;

  PERFORM 1
  FROM public.comandas c
  WHERE c.id = p_comanda_id
    AND c.tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comanda nao encontrada para este tenant na baixa de estoque';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.comanda_items ci
    WHERE ci.comanda_id = p_comanda_id
      AND ci.tenant_id = p_tenant_id
      AND ci.product_id IS NOT NULL
      AND COALESCE(ci.quantity, 0) <= 0
  ) THEN
    RAISE EXCEPTION 'Item de produto com quantidade invalida na comanda';
  END IF;

  FOR v_item IN
    SELECT
      ci.product_id,
      SUM(COALESCE(ci.quantity, 0))::INTEGER AS quantity,
      jsonb_agg(
        jsonb_build_object(
          'comanda_item_id', ci.id,
          'quantity', ci.quantity,
          'unit_price', ci.unit_price,
          'product_name', ci.product_name
        )
        ORDER BY ci.created_at, ci.id
      ) AS source_items
    FROM public.comanda_items ci
    WHERE ci.comanda_id = p_comanda_id
      AND ci.tenant_id = p_tenant_id
      AND ci.product_id IS NOT NULL
    GROUP BY ci.product_id
  LOOP
    v_product_count := v_product_count + 1;
    v_inventory_key := 'inventory-sale-comanda:' || p_tenant_id::TEXT || ':' || p_comanda_id::TEXT || ':' || v_item.product_id::TEXT;

    SELECT im.id, im.source_type, im.source_id, im.product_id, im.movement_type
    INTO v_existing_movement
    FROM public.inventory_movements im
    WHERE im.tenant_id = p_tenant_id
      AND im.idempotency_key = v_inventory_key
    LIMIT 1;

    IF FOUND THEN
      IF v_existing_movement.source_type IS DISTINCT FROM 'comanda'
         OR v_existing_movement.source_id IS DISTINCT FROM p_comanda_id
         OR v_existing_movement.product_id IS DISTINCT FROM v_item.product_id
         OR v_existing_movement.movement_type IS DISTINCT FROM 'sale' THEN
        RAISE EXCEPTION 'Chave de idempotencia de estoque ja utilizada em outro movimento';
      END IF;

      v_idempotent_count := v_idempotent_count + 1;
      CONTINUE;
    END IF;

    SELECT p.id, p.tenant_id, COALESCE(p.stock_quantity, 0)::INTEGER AS stock_quantity, p.name
    INTO v_product
    FROM public.products p
    WHERE p.id = v_item.product_id
      AND p.tenant_id = p_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto da comanda nao encontrado para este tenant: %', v_item.product_id;
    END IF;

    IF v_item.quantity <= 0 THEN
      RAISE EXCEPTION 'Quantidade agregada invalida para produto %', v_item.product_id;
    END IF;

    v_quantity_before := v_product.stock_quantity;

    IF v_quantity_before < v_item.quantity THEN
      RAISE EXCEPTION 'Estoque insuficiente para o produto %. Disponivel: %, solicitado: %',
        COALESCE(v_product.name, v_item.product_id::TEXT),
        v_quantity_before,
        v_item.quantity;
    END IF;

    v_quantity_after := v_quantity_before - v_item.quantity;

    IF v_quantity_after < 0 THEN
      RAISE EXCEPTION 'Baixa de estoque bloquearia estoque negativo para produto %', v_item.product_id;
    END IF;

    UPDATE public.products
    SET stock_quantity = v_quantity_after,
        updated_at = now()
    WHERE id = v_item.product_id
      AND tenant_id = p_tenant_id;

    INSERT INTO public.inventory_movements (
      tenant_id,
      product_id,
      movement_type,
      quantity_delta,
      quantity_before,
      quantity_after,
      source_type,
      source_id,
      idempotency_key,
      reason,
      created_by_user_id,
      metadata
    ) VALUES (
      p_tenant_id,
      v_item.product_id,
      'sale',
      -v_item.quantity,
      v_quantity_before,
      v_quantity_after,
      'comanda',
      p_comanda_id,
      v_inventory_key,
      'Baixa automatica por fechamento financeiro de comanda',
      p_created_by_user_id,
      jsonb_build_object(
        'comanda_id', p_comanda_id,
        'tenant_id', p_tenant_id,
        'source_idempotency_key', NULLIF(BTRIM(COALESCE(p_source_idempotency_key, '')), ''),
        'items', COALESCE(v_item.source_items, '[]'::jsonb)
      )
    );

    v_created_count := v_created_count + 1;

    IF to_regprocedure('public.check_minimum_stock(uuid)') IS NOT NULL THEN
      EXECUTE 'SELECT public.check_minimum_stock($1)' USING v_item.product_id;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'comanda_id', p_comanda_id,
    'product_count', v_product_count,
    'created_count', v_created_count,
    'idempotent_count', v_idempotent_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_inventory_sale_for_comanda(UUID, UUID, TEXT, UUID) FROM PUBLIC;
COMMENT ON FUNCTION public.apply_inventory_sale_for_comanda(UUID, UUID, TEXT, UUID) IS
  'Applies idempotent product stock decrement for comanda settlement. Intended for internal SECURITY DEFINER RPC use only.';

-- Fase 4B revisada - baixa financeira centralizada de comandas com estoque auditavel.
-- Mudanca minima: chama apply_inventory_sale_for_comanda depois do lock/status checks
-- e antes de atualizar a comanda/criar transaction. Se estoque falhar, a transacao inteira falha.

CREATE OR REPLACE FUNCTION public.finance_settle_comanda(
  p_tenant_id UUID, p_comanda_id UUID, p_payment_method TEXT, p_paid_amount NUMERIC,
  p_payment_date_real TIMESTAMPTZ DEFAULT now(), p_source TEXT DEFAULT 'checkout',
  p_notes TEXT DEFAULT NULL, p_idempotency_key TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_uid UUID := auth.uid();
  v_auth_tenant_id UUID;
  v_is_super_admin BOOLEAN := false;
  v_access_role TEXT;
  v_membership_role TEXT;
  v_has_authorized_membership BOOLEAN := false;
  v_comanda public.comandas%ROWTYPE;
  v_existing_transaction public.transactions%ROWTYPE;
  v_transaction_id UUID;
  v_payment_date_real TIMESTAMPTZ := COALESCE(p_payment_date_real, now());
  v_settled_at TIMESTAMPTZ := now();
  v_source TEXT := NULLIF(BTRIM(COALESCE(p_source, '')), '');
  v_notes TEXT := NULLIF(BTRIM(COALESCE(p_notes, '')), '');
  v_idempotency_key TEXT := NULLIF(BTRIM(COALESCE(p_idempotency_key, '')), '');
  v_payment_method TEXT := NULLIF(BTRIM(COALESCE(p_payment_method, '')), '');
BEGIN
  IF v_auth_uid IS NULL THEN RAISE EXCEPTION 'Usuario autenticado obrigatorio'; END IF;
  IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id obrigatorio'; END IF;
  IF p_comanda_id IS NULL THEN RAISE EXCEPTION 'comanda_id obrigatorio'; END IF;
  IF v_payment_method IS NULL THEN RAISE EXCEPTION 'Forma de pagamento obrigatoria'; END IF;
  IF COALESCE(p_paid_amount, 0) <= 0 THEN RAISE EXCEPTION 'Valor pago deve ser maior que zero'; END IF;

  SELECT public.current_tenant_id_from_auth_uid(), public.current_is_super_admin_from_auth_uid()
  INTO v_auth_tenant_id, v_is_super_admin;
  SELECT LOWER(BTRIM(COALESCE(p.role, ''))) INTO v_access_role
  FROM public.profiles p WHERE p.id = v_auth_uid LIMIT 1;
  IF v_access_role IS NULL THEN
    SELECT LOWER(BTRIM(COALESCE(s.role, ''))) INTO v_access_role
    FROM public.staff s WHERE s.id = v_auth_uid LIMIT 1;
  END IF;
  SELECT LOWER(BTRIM(COALESCE(ut.role, ''))) INTO v_membership_role
  FROM public.user_tenants ut
  WHERE ut.user_id = v_auth_uid AND ut.tenant_id = p_tenant_id
  ORDER BY COALESCE(ut.is_primary, false) DESC LIMIT 1;
  v_has_authorized_membership := COALESCE(v_membership_role IN ('owner', 'admin', 'manager', 'gerente', 'superadmin', 'super admin'), false);

  IF NOT COALESCE(v_is_super_admin, false)
     AND COALESCE(v_access_role, '') NOT IN ('owner', 'admin', 'manager', 'gerente', 'superadmin', 'super admin')
     AND NOT COALESCE(v_has_authorized_membership, false) THEN
    RAISE EXCEPTION 'Usuario sem permissao para baixa financeira central';
  END IF;
  IF NOT COALESCE(v_is_super_admin, false)
     AND NOT COALESCE(v_has_authorized_membership, false)
     AND v_auth_tenant_id IS DISTINCT FROM p_tenant_id THEN
    RAISE EXCEPTION 'Tenant nao autorizado';
  END IF;

  IF v_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing_transaction FROM public.transactions t
    WHERE t.tenant_id = p_tenant_id AND t.idempotency_key = v_idempotency_key LIMIT 1;
    IF FOUND THEN
      IF v_existing_transaction.source_type IS DISTINCT FROM 'comanda'
         OR v_existing_transaction.source_id IS DISTINCT FROM p_comanda_id THEN
        RAISE EXCEPTION 'Chave de idempotencia ja utilizada em outro lancamento';
      END IF;
      RETURN jsonb_build_object('success', true, 'idempotent', true, 'comanda_id', v_existing_transaction.source_id, 'transaction_id', v_existing_transaction.id, 'status', 'paid', 'message', 'Baixa ja processada anteriormente. Transacao original retornada.');
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('finance_settle_comanda:' || p_tenant_id::text || ':' || p_comanda_id::text));
  SELECT * INTO v_comanda FROM public.comandas c
  WHERE c.id = p_comanda_id AND c.tenant_id = p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Comanda nao encontrada para este tenant'; END IF;

  IF v_comanda.status = 'paid' THEN
    SELECT * INTO v_existing_transaction FROM public.transactions t
    WHERE t.tenant_id = p_tenant_id AND t.source_type = 'comanda' AND t.source_id = p_comanda_id
      AND t.idempotency_key = v_idempotency_key AND t.type = 'income' AND COALESCE(t.status, 'paid') = 'paid'
    ORDER BY t.date DESC, t.id DESC LIMIT 1;
    IF FOUND AND v_idempotency_key IS NOT NULL THEN
      RETURN jsonb_build_object('success', true, 'idempotent', true, 'comanda_id', p_comanda_id, 'transaction_id', v_existing_transaction.id, 'status', 'paid', 'message', 'Comanda ja estava baixada. Transacao existente retornada.');
    END IF;
    RAISE EXCEPTION 'Comanda ja esta baixada';
  END IF;
  IF v_comanda.status NOT IN ('open', 'blocked') THEN RAISE EXCEPTION 'Comanda nao pode ser baixada no status atual: %', v_comanda.status; END IF;

  PERFORM public.apply_inventory_sale_for_comanda(
    p_tenant_id,
    p_comanda_id,
    v_idempotency_key,
    v_auth_uid
  );

  UPDATE public.comandas SET status = 'paid', payment_method = v_payment_method,
    closure_mode = COALESCE(NULLIF(closure_mode, ''), 'standard'), financial_effect = true,
    payment_date_real = v_payment_date_real, settled_at = v_settled_at,
    settled_by_user_id = v_auth_uid, closed_at = v_payment_date_real
  WHERE id = p_comanda_id AND tenant_id = p_tenant_id;

  INSERT INTO public.transactions (tenant_id, user_id, type, category, description, amount, payment_method, date, status, notes, source_type, source_id, idempotency_key, metadata)
  VALUES (p_tenant_id, v_auth_uid, 'income', 'Receita de Comanda',
    'Baixa financeira de comanda ' || p_comanda_id::text || ' via ' || COALESCE(v_source, 'financeiro'),
    p_paid_amount, v_payment_method, v_payment_date_real, 'paid', v_notes, 'comanda', p_comanda_id, v_idempotency_key,
    jsonb_build_object('source', COALESCE(v_source, 'financeiro'), 'comanda_id', p_comanda_id, 'tenant_id', p_tenant_id, 'comanda_total', COALESCE(v_comanda.total, 0), 'paid_amount', p_paid_amount, 'amount_difference', p_paid_amount - COALESCE(v_comanda.total, 0), 'payment_date_real', v_payment_date_real, 'settled_at', v_settled_at, 'settled_by_user_id', v_auth_uid, 'notes', v_notes, 'idempotency_key', v_idempotency_key))
  RETURNING id INTO v_transaction_id;

  IF v_comanda.appointment_id IS NOT NULL THEN
    UPDATE public.appointments SET status = 'completed'
    WHERE id = v_comanda.appointment_id AND tenant_id = p_tenant_id AND status <> 'completed';
  END IF;
  RETURN jsonb_build_object('success', true, 'idempotent', false, 'comanda_id', p_comanda_id, 'transaction_id', v_transaction_id, 'status', 'paid', 'message', 'Baixa financeira registrada com sucesso.');
END;
$$;

REVOKE ALL ON FUNCTION public.finance_settle_comanda(UUID, UUID, TEXT, NUMERIC, TIMESTAMPTZ, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_settle_comanda(UUID, UUID, TEXT, NUMERIC, TIMESTAMPTZ, TEXT, TEXT, TEXT) TO authenticated;

-- Future reversal/return plan, not implemented in this migration:
-- - Add apply_inventory_return_for_financial_reversal(...)
-- - Full refund of a comanda may return all product quantities.
-- - Partial refund must not return stock automatically without item/quantity selection.
-- - Return idempotency should be deterministic by financial_reversal_id.
-- - A reason must be mandatory and copied into inventory_movements.reason/metadata.

-- Local validation notes, do not run in production:
-- 1. Create a tenant product with stock_quantity = 5 and a paid comanda item quantity = 2; settlement must leave stock_quantity = 3 and create one sale movement.
-- 2. Create a service-only comanda; settlement must create no inventory_movements rows.
-- 3. Create a mixed service/product comanda; settlement must decrement only the product.
-- 4. Retry settlement with the same comanda/idempotency key; stock must not decrement twice and transaction must not duplicate.
-- 5. Try settlement with product stock lower than requested quantity; RPC must fail before creating transaction.
-- 6. Try a comanda item whose product belongs to another tenant; RPC must fail.
-- 7. Try p_tenant_id from another tenant for the comanda; RPC must fail.
-- 8. Confirm no transaction exists when inventory failure aborts settlement.
-- 9. Confirm cash closing and reports continue to read transactions/comanda_items as before.

NOTIFY pgrst, 'reload schema';

COMMIT;
