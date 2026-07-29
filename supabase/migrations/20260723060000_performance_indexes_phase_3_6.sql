-- Performance Indexes — Fase 3.6.1
-- Adds missing indexes identified in PERFORMANCE_BASELINE.md

-- P0: comandas (tenant_id, created_at) — most common comanda query pattern
CREATE INDEX IF NOT EXISTS idx_comandas_tenant_created
    ON comandas (tenant_id, created_at DESC);

-- P0: comandas (tenant_id, appointment_id) — used in getByAppointment, findLatestByAppointment
CREATE INDEX IF NOT EXISTS idx_comandas_tenant_appointment
    ON comandas (tenant_id, appointment_id)
    WHERE appointment_id IS NOT NULL;

-- P1: comandas (tenant_id, staff_id) — filtered in list()
CREATE INDEX IF NOT EXISTS idx_comandas_tenant_staff
    ON comandas (tenant_id, staff_id)
    WHERE staff_id IS NOT NULL;

-- P1: customer_plans (tenant_id, name) — used in plan listing
CREATE INDEX IF NOT EXISTS idx_customer_plans_tenant_name
    ON customer_plans (tenant_id, name);

-- P1: customer_subscriptions (client_id, status) — active subscription lookup
CREATE INDEX IF NOT EXISTS idx_customer_subscriptions_client_status
    ON customer_subscriptions (client_id, status);

-- P2: products (tenant_id, active) — checkout product listing
CREATE INDEX IF NOT EXISTS idx_products_tenant_active
    ON products (tenant_id, active)
    WHERE active = true;

-- P2: promotions (tenant_id, active) — checkout/schedule promotion lookup
CREATE INDEX IF NOT EXISTS idx_promotions_tenant_active
    ON promotions (tenant_id, active)
    WHERE active = true;
