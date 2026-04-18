
-- Add product_id to comanda_items
ALTER TABLE public.comanda_items 
ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id);

-- Drop and recreate RPC to fix parameters
DROP FUNCTION IF EXISTS public.close_order(uuid);

CREATE OR REPLACE FUNCTION public.close_order(p_comanda_id UUID)
RETURNS VOID AS $$
DECLARE
  v_item RECORD;
BEGIN
  -- Iterate through items that are products
  FOR v_item IN
    SELECT product_id, quantity
    FROM public.comanda_items
    WHERE comanda_id = p_comanda_id AND product_id IS NOT NULL
  LOOP
    -- Decrement stock 
    UPDATE public.products
    SET stock_quantity = stock_quantity - v_item.quantity,
        updated_at = now()
    WHERE id = v_item.product_id;

    -- Check minimum stock (triggers notifications)
    PERFORM public.check_minimum_stock(v_item.product_id);
  END LOOP;
  
  -- Mark comanda as paid
  UPDATE public.comandas 
  SET status = 'paid',
      updated_at = now()
  WHERE id = p_comanda_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
;
