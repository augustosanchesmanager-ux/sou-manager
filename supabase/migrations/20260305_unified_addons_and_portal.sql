-- 1. Cria a nova tabela unificada de add-ons
CREATE TABLE IF NOT EXISTS tenant_addons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  addon_key VARCHAR(50) NOT NULL, -- 'TOTEM_QR', 'CLIENT_PORTAL'
  status VARCHAR(20) NOT NULL DEFAULT 'disabled', -- 'enabled', 'disabled'
  activated_at TIMESTAMPTZ,
  limits JSONB, -- Armazena config expecifica: max_devices, theme, windows_hours etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, addon_key)
);

-- 2. Migra os dados antigos de kiosk_addons (se existirem) para a nova tabela
DO $$ 
BEGIN
  -- Tenta inserir dados baseados no kiosk_addons se a tabela existir
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'kiosk_addons') THEN
    INSERT INTO tenant_addons (tenant_id, addon_key, status, activated_at, limits, created_at)
    SELECT 
      tenant_id, 
      'TOTEM_QR', 
      status, 
      activated_at, 
      jsonb_build_object('theme', kiosk_theme, 'max_devices', max_devices),
      NOW()
    FROM kiosk_addons
    ON CONFLICT (tenant_id, addon_key) DO NOTHING;
  END IF;
END $$;

-- 3. Cria tabela de requests OTP para o Portal do Cliente
CREATE TABLE IF NOT EXISTS otp_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone VARCHAR(20) NOT NULL,
  code_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER DEFAULT 0,
  last_sent_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'pending' -- 'pending', 'verified', 'expired'
);

-- 4. Cria tabela de sessões logadas do Portal do Cliente
CREATE TABLE IF NOT EXISTS portal_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  device_fingerprint VARCHAR(255)
);

-- Habilitar RLS
ALTER TABLE tenant_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_sessions ENABLE ROW LEVEL SECURITY;

-- Policies para tenant_addons
-- Adicionamos permissão total para gestores do tenant logado
CREATE POLICY "Tenants can manage their specific addons" ON tenant_addons 
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- Policy pública que possibilita o Totem ou Portal de validar se a rota está ativa
CREATE POLICY "Public can view active addons to access public routes" ON tenant_addons 
  FOR SELECT USING (status = 'enabled');

-- Policies para OTP Requests (Backend vai manipular, mas criaremos acesso restrito)
-- Apenas public/anon mode (Edge function gerando OTP) e Auth user logado para checagem
CREATE POLICY "Tenants can view their otp_requests" ON otp_requests 
  FOR SELECT USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Public can insert OTP requests" ON otp_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update open OTP requests" ON otp_requests FOR UPDATE USING (status = 'pending');

-- Policies para Portal Sessions
CREATE POLICY "Tenants can view and manage portal sessions" ON portal_sessions 
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Public can insert portal sessions upon auth" ON portal_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can select portal sessions for validation" ON portal_sessions FOR SELECT USING (true);
CREATE POLICY "Public can update active portal sessions" ON portal_sessions FOR UPDATE USING (true);


-- Indexação de performance para as novas tabelas
CREATE INDEX IF NOT EXISTS idx_tenant_addons_tenant_key ON tenant_addons(tenant_id, addon_key);
CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_requests(phone);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_token ON portal_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_client ON portal_sessions(client_id);
