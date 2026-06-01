-- Performance indexes for common query patterns
-- Created: 2026-04-24

-- Appointments: filter by client + date range
CREATE INDEX IF NOT EXISTS idx_appointments_client_start ON public.appointments(client_id, start_time DESC);

-- Appointments: filter by staff + date range  
CREATE INDEX IF NOT EXISTS idx_appointments_staff_start ON public.appointments(staff_id, start_time DESC);

-- Appointments: filter by status + date (for dashboard counts)
CREATE INDEX IF NOT EXISTS idx_appointments_status_start ON public.appointments(status, start_time DESC);

-- Comandas: filter by client + status
CREATE INDEX IF NOT EXISTS idx_comandas_client_status ON public.comandas(client_id, status);

-- Comanda items: filter by service (for revenue reports)
CREATE INDEX IF NOT EXISTS idx_comanda_items_service ON public.comanda_items(service_id);

-- Transactions: filter by tenant + type + date (for reports)
DO $$
BEGIN
  IF to_regclass('public.transactions') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_transactions_tenant_type_date
    ON public.transactions(tenant_id, type, date DESC);
  END IF;
END $$;

-- Clients: active clients lookup
CREATE INDEX IF NOT EXISTS idx_clients_tenant_status ON public.clients(tenant_id, status);

-- Staff: active staff lookup
CREATE INDEX IF NOT EXISTS idx_staff_tenant_status ON public.staff(tenant_id, status);

-- Services: active services lookup
CREATE INDEX IF NOT EXISTS idx_services_tenant_active ON public.services(tenant_id, active);

-- Feedback: tenant + created_at for recent feedback
CREATE INDEX IF NOT EXISTS idx_feedback_barber_tenant_created ON public.feedback_barber(tenant_id, created_at DESC);

-- Support tickets: created_at for recent tickets
CREATE INDEX IF NOT EXISTS idx_support_tickets_created ON public.support_tickets(created_at DESC);

-- Transactions: date for reports
DO $$
BEGIN
  IF to_regclass('public.transactions') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_transactions_date
    ON public.transactions(date DESC);
  END IF;
END $$;

-- Promotions: created_at for recent promotions
CREATE INDEX IF NOT EXISTS idx_promotions_created ON public.promotions(created_at DESC);

-- Purchase orders: created_at for recent orders
CREATE INDEX IF NOT EXISTS idx_purchase_orders_created ON public.purchase_orders(created_at DESC);
