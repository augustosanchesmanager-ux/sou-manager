BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.customer_vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  promotion_id UUID REFERENCES public.promotions(id) ON DELETE SET NULL,
  voucher_code TEXT,
  title TEXT NOT NULL,
  description TEXT,
  benefit_type TEXT NOT NULL,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  discount_amount NUMERIC,
  discount_percentage NUMERIC,
  status TEXT NOT NULL DEFAULT 'available',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  used_comanda_id UUID REFERENCES public.comandas(id) ON DELETE SET NULL,
  issued_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  used_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  cancelled_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  cancellation_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT customer_vouchers_status_check
    CHECK (status IN ('available', 'used', 'expired', 'cancelled')),
  CONSTRAINT customer_vouchers_benefit_type_check
    CHECK (benefit_type IN ('free_service', 'discount_fixed', 'discount_percentage', 'custom_benefit')),
  CONSTRAINT customer_vouchers_discount_amount_check
    CHECK (discount_amount IS NULL OR discount_amount >= 0),
  CONSTRAINT customer_vouchers_discount_percentage_check
    CHECK (discount_percentage IS NULL OR (discount_percentage >= 0 AND discount_percentage <= 100)),
  CONSTRAINT customer_vouchers_cancel_reason_check
    CHECK (status <> 'cancelled' OR NULLIF(BTRIM(cancellation_reason), '') IS NOT NULL),
  CONSTRAINT customer_vouchers_used_at_check
    CHECK (status <> 'used' OR used_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_customer_vouchers_tenant
  ON public.customer_vouchers(tenant_id);

CREATE INDEX IF NOT EXISTS idx_customer_vouchers_customer
  ON public.customer_vouchers(customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_vouchers_status
  ON public.customer_vouchers(status);

CREATE INDEX IF NOT EXISTS idx_customer_vouchers_expires_at
  ON public.customer_vouchers(expires_at);

CREATE INDEX IF NOT EXISTS idx_customer_vouchers_tenant_customer_status
  ON public.customer_vouchers(tenant_id, customer_id, status);

COMMIT;
