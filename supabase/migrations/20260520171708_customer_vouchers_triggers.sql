BEGIN;

CREATE OR REPLACE FUNCTION public.validate_customer_voucher_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.tenant_id IS NULL OR NEW.customer_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id e customer_id são obrigatórios';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = NEW.customer_id
      AND c.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'Cliente inválido para o tenant do voucher';
  END IF;

  IF NEW.promotion_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.promotions p
    WHERE p.id = NEW.promotion_id
      AND p.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'Promoção inválida para o tenant do voucher';
  END IF;

  IF NEW.service_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.services s
    WHERE s.id = NEW.service_id
      AND s.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'Serviço inválido para o tenant do voucher';
  END IF;

  IF NEW.used_comanda_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.comandas c
    WHERE c.id = NEW.used_comanda_id
      AND c.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'Comanda inválida para o tenant do voucher';
  END IF;

  IF NEW.status = 'used' AND NEW.used_at IS NULL THEN
    NEW.used_at = now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_customer_vouchers_updated_at ON public.customer_vouchers;
CREATE TRIGGER trg_customer_vouchers_updated_at
BEFORE UPDATE ON public.customer_vouchers
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_customer_vouchers_validate_tenant ON public.customer_vouchers;
CREATE TRIGGER trg_customer_vouchers_validate_tenant
BEFORE INSERT OR UPDATE ON public.customer_vouchers
FOR EACH ROW
EXECUTE FUNCTION public.validate_customer_voucher_tenant();

COMMIT;
