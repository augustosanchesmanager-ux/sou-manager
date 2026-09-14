-- ============================================================
-- F3.1 — approve_access_request: adiciona guarda auth.uid()/superadmin
--
-- Achado da auditoria de segurança (Categoria 3, severidade média):
-- a RPC legada approve_access_request é SECURITY DEFINER e seu corpo
-- cria tenant, marca o pedido como aprovado e insere notificação SEM
-- nenhuma guarda de auth.uid() ou superadmin. A correção h6
-- (20260813120500) apenas revogou anon/PUBLIC e concedeu authenticated —
-- logo qualquer usuário autenticado (inclusive barber/receptionist)
-- ainda pode invocar a operação administrativa.
--
-- Correção: adiciona as duas guardas canônicas no corpo, no mesmo padrão
-- das demais RPCs administrativas (20260807010000 / 20260807020000):
--   1. auth.uid() IS NULL           -> 'Authentication required'
--   2. NOT super_admin_from_auth_uid -> 'Insufficient permissions: superadmin'
-- O corpo de negócio e o SECURITY DEFINER são preservados intactos.
-- ============================================================

CREATE OR REPLACE FUNCTION public.approve_access_request(p_request_id UUID)
RETURNS VOID AS $$
DECLARE
  v_request RECORD;
  v_tenant_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.current_is_super_admin_from_auth_uid() THEN
    RAISE EXCEPTION 'Insufficient permissions: superadmin required to approve access requests';
  END IF;

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