
-- Check Minimum Stock & Auto Order
CREATE OR REPLACE FUNCTION public.check_minimum_stock(p_product_id UUID)
RETURNS VOID AS $$
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

  IF v_current_stock <= v_min_stock THEN
    -- Notify tenant
    INSERT INTO public.notifications (tenant_id, type, title, message)
    VALUES (v_tenant_id, 'STOCK_LOW', 'Estoque Baixo', 'O produto ' || v_name || ' atingiu o nível crítico.');

    IF v_auto_order = TRUE THEN
      INSERT INTO public.purchase_orders (tenant_id, product_id, quantity, status)
      VALUES (v_tenant_id, p_product_id, v_min_stock * 2, 'pending');
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Close Order (Decrement Stock)
CREATE OR REPLACE FUNCTION public.close_order(p_order_id UUID)
RETURNS VOID AS $$
DECLARE
  v_item RECORD;
BEGIN
  -- Note: Using 'comanda_id' because the existing table is 'comanda_items'
  FOR v_item IN
    SELECT service_id, quantity -- In this schema, services might be products or we add a product_id column
    FROM public.comanda_items
    WHERE comanda_id = p_order_id
  LOOP
    -- Assuming we might link services to products or items have product_id (to be added)
    -- For now, if item has product_id:
    -- UPDATE public.products SET stock_quantity = stock_quantity - v_item.quantity WHERE id = v_item.product_id;
    -- PERFORM public.check_minimum_stock(v_item.product_id);
    NULL; -- Placeholder until we link comanda_items to products
  END LOOP;
  
  UPDATE public.comandas SET status = 'paid' WHERE id = p_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
;
