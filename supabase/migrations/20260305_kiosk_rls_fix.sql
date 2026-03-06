-- ==============================================================================
-- FIX DE PERMISSÕES PÚBLICAS (RLS) PARA TOTEM, QR CODE E PORTAL DO CLIENTE
-- Execute no SQL Editor do Supabase Dashboard
-- ==============================================================================

-- 1. Permitir leitura pública dos dados da Barbearia (Tenants)
DROP POLICY IF EXISTS "public_select_tenants" ON tenants;
CREATE POLICY "public_select_tenants" ON tenants FOR SELECT USING (true);

-- 2. Permitir leitura pública dos Serviços
DROP POLICY IF EXISTS "public_select_services" ON services;
CREATE POLICY "public_select_services" ON services FOR SELECT USING (true);

-- 3. Permitir leitura pública da Equipe (Staff / Barbeiros)
DROP POLICY IF EXISTS "public_select_staff" ON staff;
CREATE POLICY "public_select_staff" ON staff FOR SELECT USING (true);

-- 4. Permitir leitura e criação de Clientes no Autoatendimento
DROP POLICY IF EXISTS "public_select_clients" ON clients;
CREATE POLICY "public_select_clients" ON clients FOR SELECT USING (true);

DROP POLICY IF EXISTS "public_insert_clients" ON clients;
CREATE POLICY "public_insert_clients" ON clients FOR INSERT WITH CHECK (true);

-- 5. Permitir leitura e criação de Agendamentos no Autoatendimento
DROP POLICY IF EXISTS "public_select_appointments" ON appointments;
CREATE POLICY "public_select_appointments" ON appointments FOR SELECT USING (true);

DROP POLICY IF EXISTS "public_insert_appointments" ON appointments;
CREATE POLICY "public_insert_appointments" ON appointments FOR INSERT WITH CHECK (true);

-- 6. Garantir que tenant_addons seja visível anonimamente
DROP POLICY IF EXISTS "Public can view active addons to access public routes" ON tenant_addons;
CREATE POLICY "public_select_tenant_addons" ON tenant_addons FOR SELECT USING (true);
