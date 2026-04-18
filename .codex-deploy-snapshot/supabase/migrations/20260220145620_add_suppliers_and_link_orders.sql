
-- Create Suppliers Table
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant isolation suppliers" ON public.suppliers
FOR ALL USING (
  tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
);

-- Update Purchase Orders to include supplier_id
ALTER TABLE public.purchase_orders 
ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id);
;
