-- ============================================================
-- MÓDULO TOTEM + QR (AUTOATENDIMENTO) - MIGRAÇÃO COMPLETA
-- Execute no SQL Editor do Supabase (https://supabase.com/dashboard/project/ushsnmlbeurfvlkieiln/sql)
-- ============================================================

-- 1. kiosk_addons — controle do add-on por tenant
CREATE TABLE IF NOT EXISTS public.kiosk_addons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'disabled' CHECK (status IN ('enabled', 'disabled')),
  activated_at TIMESTAMPTZ,
  max_devices INT DEFAULT 1,
  kiosk_theme TEXT DEFAULT 'default' CHECK (kiosk_theme IN ('default', 'sanchez', 'custom')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id)
);

-- 2. kiosk_devices — dispositivos totem cadastrados
CREATE TABLE IF NOT EXISTS public.kiosk_devices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  theme TEXT DEFAULT 'default' CHECK (theme IN ('default', 'sanchez', 'custom')),
  timeout_seconds INT DEFAULT 30,
  visible_services UUID[] DEFAULT '{}',
  visible_barbers UUID[] DEFAULT '{}',
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. kiosk_sessions — sessões de uso do totem/QR
CREATE TABLE IF NOT EXISTS public.kiosk_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  device_id UUID REFERENCES public.kiosk_devices(id) ON DELETE SET NULL,
  channel TEXT CHECK (channel IN ('totem', 'qr')) DEFAULT 'totem',
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  client_id UUID,
  status TEXT DEFAULT 'initiated' CHECK (status IN ('initiated', 'identified', 'completed', 'expired')),
  ip_address TEXT,
  user_agent TEXT,
  action_log JSONB DEFAULT '[]'::jsonb
);

-- 4. feedback_barber — avaliações de barbeiro via totem/QR
CREATE TABLE IF NOT EXISTS public.feedback_barber (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  client_id UUID,
  barber_id UUID,
  session_id UUID REFERENCES public.kiosk_sessions(id) ON DELETE SET NULL,
  rating INT CHECK (rating BETWEEN 1 AND 5),
  tags TEXT[] DEFAULT '{}',
  comment TEXT,
  source_channel TEXT CHECK (source_channel IN ('totem', 'qr', 'app')) DEFAULT 'totem',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. feedback_shop — NPS e avaliações da barbearia
CREATE TABLE IF NOT EXISTS public.feedback_shop (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  client_id UUID,
  session_id UUID REFERENCES public.kiosk_sessions(id) ON DELETE SET NULL,
  nps INT CHECK (nps BETWEEN 0 AND 10),
  reasons TEXT[] DEFAULT '{}',
  comment TEXT,
  marketing_opt_in BOOLEAN DEFAULT false,
  source_channel TEXT CHECK (source_channel IN ('totem', 'qr', 'app')) DEFAULT 'totem',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Colunas adicionais em appointments
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'app' CHECK (source IN ('app', 'kiosk')),
  ADD COLUMN IF NOT EXISTS channel TEXT CHECK (channel IN ('totem', 'qr', 'whatsapp', 'admin'));

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_kiosk_addons_tenant ON public.kiosk_addons(tenant_id);
CREATE INDEX IF NOT EXISTS idx_kiosk_devices_tenant ON public.kiosk_devices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_kiosk_sessions_tenant ON public.kiosk_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_kiosk_sessions_device ON public.kiosk_sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_feedback_barber_tenant ON public.feedback_barber(tenant_id);
CREATE INDEX IF NOT EXISTS idx_feedback_barber_barber ON public.feedback_barber(barber_id);
CREATE INDEX IF NOT EXISTS idx_feedback_shop_tenant ON public.feedback_shop(tenant_id);
CREATE INDEX IF NOT EXISTS idx_appointments_source ON public.appointments(source);
CREATE INDEX IF NOT EXISTS idx_appointments_channel ON public.appointments(channel);

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- kiosk_addons
ALTER TABLE public.kiosk_addons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "kiosk_addons_select" ON public.kiosk_addons;
DROP POLICY IF EXISTS "kiosk_addons_insert" ON public.kiosk_addons;
DROP POLICY IF EXISTS "kiosk_addons_update" ON public.kiosk_addons;
CREATE POLICY "kiosk_addons_select" ON public.kiosk_addons FOR SELECT USING (true);
CREATE POLICY "kiosk_addons_insert" ON public.kiosk_addons FOR INSERT WITH CHECK (true);
CREATE POLICY "kiosk_addons_update" ON public.kiosk_addons FOR UPDATE USING (true);

-- kiosk_devices
ALTER TABLE public.kiosk_devices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "kiosk_devices_all" ON public.kiosk_devices;
CREATE POLICY "kiosk_devices_all" ON public.kiosk_devices FOR ALL USING (true);

-- kiosk_sessions
ALTER TABLE public.kiosk_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "kiosk_sessions_all" ON public.kiosk_sessions;
CREATE POLICY "kiosk_sessions_all" ON public.kiosk_sessions FOR ALL USING (true);

-- feedback_barber
ALTER TABLE public.feedback_barber ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "feedback_barber_all" ON public.feedback_barber;
CREATE POLICY "feedback_barber_all" ON public.feedback_barber FOR ALL USING (true);

-- feedback_shop
ALTER TABLE public.feedback_shop ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "feedback_shop_all" ON public.feedback_shop;
CREATE POLICY "feedback_shop_all" ON public.feedback_shop FOR ALL USING (true);
