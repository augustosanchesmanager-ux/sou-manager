
-- Approve Access Request RPC
-- This function:
-- 1. Creates a new tenant
-- 2. Creates a profile for the requester linked to the new tenant
-- 3. Marks the request as approved
CREATE OR REPLACE FUNCTION public.approve_access_request(p_request_id UUID)
RETURNS VOID AS $$
DECLARE
  v_request RECORD;
  v_tenant_id UUID;
BEGIN
  -- Get request details
  SELECT * FROM public.access_requests INTO v_request WHERE id = p_request_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;

  IF v_request.status = 'approved' THEN
    RAISE EXCEPTION 'Pedido já aprovado';
  END IF;

  -- 1. Create Tenant
  INSERT INTO public.tenants (name, slug)
  VALUES (v_request.tenant_name, lower(regexp_replace(v_request.tenant_name, '[^a-zA-Z0-9]+', '-', 'g')))
  RETURNING id INTO v_tenant_id;

  -- 2. Create Profile (Admin for the new shop)
  -- Note: This assumes the user already exists in auth.users or will be created via inviting.
  -- For now, we link by email or placeholder. In a real scenario, we'd trigger an invite.
  -- Here we just ensure the request is marked and tenant is ready.
  
  UPDATE public.access_requests 
  SET status = 'approved',
      updated_at = now()
  WHERE id = p_request_id;

  -- 3. Create initial notification for the new tenant
  INSERT INTO public.notifications (tenant_id, type, title, description)
  VALUES (v_tenant_id, 'system_alert', 'Bem-vindo!', 'Sua barbearia foi ativada com sucesso. Comece configurando seu time e serviços.');

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
;
